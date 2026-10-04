"""Stage 5 — 자동 QA 게이트. "색이 비슷한가"만 보던 평가를 축별로 분리한다.

- 구조 보존: 실루엣 IoU (원본 vs 결과 알파 마스크) — 문서의 구조 축.
- 스타일 일관성: 팔레트 준수율 (결과 픽셀이 스펙 팔레트에 스냅되어 있는 비율).
- 이음새: 경계 패치 LPIPS — `pip install lpips`가 있으면 지각 거리, 없으면
  경계 양쪽 픽셀 통계 차이(그래디언트 근사)로 폴백. 문서: "이음새를 눈이 아니라
  숫자로 보기 시작."
- 내용 충실도: 원본과 결과의 엣지·명암 상관 — 실루엣 안쪽 '내용'이 보존됐는지.
  위 세 축은 전부 결과물 자체나 마스크만 보므로, 모델이 입력을 무시하고 다른 그림을
  그려도 전부 통과한다(벽돌 타일 -> 도시 풍경). 이 축만 원본과 결과를 비교한다.
  임계값이 아직 소표본 기준이라 advisory(경고 전용)로 종합 판정에서 제외한다.

각 축은 0.0(나쁨)~1.0(좋음) 점수 + 통과 여부를 돌려주고, run_qa가 종합 판정한다.
"""

from __future__ import annotations

import numpy as np
from PIL import Image

import postprocess

# 통과 임계값 — 파이프라인 응답에 그대로 노출되므로 발표/보고서 수치와 일치시킬 것.
SILHOUETTE_IOU_MIN = 0.995   # Stage 4가 알파를 재적용하므로 사실상 1.0이어야 정상
PALETTE_COMPLIANCE_MIN = 0.999  # 팔레트 스냅 후이므로 1.0이어야 정상
SEAM_SCORE_MIN = 0.55        # 경계 지각 거리 기반(낮을수록 이음새 불연속이 큼)
# 잠정값. Flux 스프라이트 20장 실측에서 내용 보존 0.77~0.92 / 재생성 0.04~0.12로 갈렸고,
# 그 사이 구간을 잡았다. 표본이 작아 advisory로만 쓴다 — 캘리브레이션 후 차단으로 승격할 것.
CONTENT_FIDELITY_MIN = 0.35

_lpips_model = None
_lpips_failed = False


def _try_lpips():
    """lpips가 설치되어 있으면 AlexNet 모델을 lazy 로드한다(1회). 실패 시 폴백."""
    global _lpips_model, _lpips_failed
    if _lpips_model is not None or _lpips_failed:
        return _lpips_model
    try:
        import lpips
        import torch  # noqa: F401 — lpips가 요구

        _lpips_model = lpips.LPIPS(net="alex", verbose=False)
        _lpips_model.eval()
    except Exception:
        _lpips_failed = True
        _lpips_model = None
    return _lpips_model


def silhouette_iou(original: Image.Image, styled: Image.Image) -> float:
    """알파>0 마스크의 IoU. 원본에 알파가 없으면 1.0(실루엣 개념 없음)."""
    if original.mode not in ("RGBA", "LA", "PA") and not (
        original.mode == "P" and "transparency" in original.info
    ):
        return 1.0
    mask_a = np.array(original.convert("RGBA").getchannel("A")) > 0
    styled_rgba = styled.convert("RGBA")
    if styled_rgba.size != original.size:
        styled_rgba = styled_rgba.resize(original.size, Image.NEAREST)
    mask_b = np.array(styled_rgba.getchannel("A")) > 0
    union = np.logical_or(mask_a, mask_b).sum()
    if union == 0:
        return 1.0
    return float(np.logical_and(mask_a, mask_b).sum() / union)


def palette_compliance(styled: Image.Image, spec: dict) -> float:
    """불투명 픽셀 중 스펙 팔레트 색과 정확히 일치하는 비율."""
    palette = postprocess.spec_palette_colors(spec)
    pixels = np.array(styled.convert("RGBA"))
    opaque = pixels[..., 3] > 0
    if not opaque.any():
        return 1.0
    rgb = pixels[..., :3][opaque]
    # 각 픽셀이 팔레트의 어느 색과든 정확히 같은지 (N_pixels, N_palette) 비교.
    matches = (rgb[:, None, :] == palette[None, :, :]).all(axis=-1).any(axis=-1)
    return float(matches.mean())


def _patch_pairs_lpips(patches_a: np.ndarray, patches_b: np.ndarray) -> float:
    """두 패치 묶음의 평균 LPIPS 거리(0~). 모델이 없으면 -1."""
    model = _try_lpips()
    if model is None:
        return -1.0
    import torch

    def to_tensor(batch: np.ndarray) -> "torch.Tensor":
        tensor = torch.from_numpy(batch.astype(np.float32) / 255.0)
        return tensor.permute(0, 3, 1, 2) * 2.0 - 1.0

    with torch.no_grad():
        distance = model(to_tensor(patches_a), to_tensor(patches_b))
    return float(distance.mean().item())


def seam_score(image: Image.Image, tile_width: int, tile_height: int, patch: int = 8) -> dict:
    """타일 경계를 걸치는 패치 쌍으로 이음새 불연속을 정량화한다.

    각 내부 타일 경계에서 경계 왼쪽/위 패치와 오른쪽/아래 패치를 잘라 비교한다.
    반환: {"score": 0~1(높을수록 매끄러움), "metric": "lpips"|"gradient"}.
    """
    rgb = np.array(image.convert("RGB"))
    height, width = rgb.shape[:2]
    pairs_a: list[np.ndarray] = []
    pairs_b: list[np.ndarray] = []

    for x in range(tile_width, width, tile_width):
        if x - patch < 0 or x + patch > width:
            continue
        for y in range(0, height - patch + 1, max(patch, tile_height)):
            pairs_a.append(rgb[y:y + patch, x - patch:x])
            pairs_b.append(rgb[y:y + patch, x:x + patch])
    for y in range(tile_height, height, tile_height):
        if y - patch < 0 or y + patch > height:
            continue
        for x in range(0, width - patch + 1, max(patch, tile_width)):
            pairs_a.append(rgb[y - patch:y, x:x + patch])
            pairs_b.append(rgb[y:y + patch, x:x + patch])

    if not pairs_a:
        return {"score": 1.0, "metric": "none", "pairs": 0}

    batch_a = np.stack(pairs_a)
    batch_b = np.stack(pairs_b)

    lpips_distance = _patch_pairs_lpips(batch_a, batch_b)
    if lpips_distance >= 0:
        # LPIPS는 0(동일)~1+(상이). 경계 패치는 내용이 원래 다르므로 0.6을 최악으로 정규화.
        return {
            "score": float(max(0.0, 1.0 - lpips_distance / 0.6)),
            "metric": "lpips",
            "pairs": len(pairs_a),
        }

    # 폴백: 경계에서 만나는 픽셀 열/행의 평균 색 차이(0~441) 기반 근사.
    edge_a = batch_a[:, :, -1, :].astype(np.float64)
    edge_b = batch_b[:, :, 0, :].astype(np.float64)
    difference = np.sqrt(np.square(edge_a - edge_b).sum(axis=-1)).mean()
    return {
        "score": float(max(0.0, 1.0 - difference / 128.0)),
        "metric": "gradient",
        "pairs": len(pairs_a),
    }


def _sobel_magnitude(gray: np.ndarray) -> np.ndarray:
    """외부 의존성 없이 Sobel 엣지 강도를 계산한다(scipy/skimage 불필요)."""
    kernel_x = np.array([[1.0, 0.0, -1.0], [2.0, 0.0, -2.0], [1.0, 0.0, -1.0]])

    def correlate(image: np.ndarray, kernel: np.ndarray) -> np.ndarray:
        out = np.zeros_like(image)
        rows, cols = image.shape
        for i in range(3):
            for j in range(3):
                out[1:-1, 1:-1] += kernel[i, j] * image[i:i + rows - 2, j:j + cols - 2]
        return out

    return np.hypot(correlate(gray, kernel_x), correlate(gray, kernel_x.T))


def _masked_correlation(a: np.ndarray, b: np.ndarray, mask: np.ndarray) -> float:
    """마스크 안쪽에서의 피어슨 상관. 한쪽이 평탄하면 0.0, 둘 다 평탄하면 1.0."""
    va, vb = a[mask], b[mask]
    if va.size < 16:
        return 1.0
    va = va - va.mean()
    vb = vb - vb.mean()
    na, nb = float((va * va).sum()), float((vb * vb).sum())
    if na <= 1e-9 and nb <= 1e-9:
        return 1.0          # 원본도 결과도 단색 — 보존할 내용이 없다
    if na <= 1e-9 or nb <= 1e-9:
        return 0.0          # 한쪽만 단색 — 내용이 사라졌거나 새로 생겼다
    return float((va * vb).sum() / np.sqrt(na * nb))


def content_fidelity(original: Image.Image, styled: Image.Image) -> dict:
    """실루엣 '안쪽' 내용이 원본과 얼마나 같은지.

    실루엣 IoU와 팔레트 준수는 결과물만 보므로, 알파만 맞으면 안에 무엇이 그려져도
    통과한다. 이 축은 원본과 결과의 명암·엣지 구조를 직접 비교해 그 구멍을 막는다.
    반환: {"score", "edge", "luma", "pixels"} — score는 0~1로 클램프한 평균.
    """
    base = original.convert("RGBA")
    result = styled.convert("RGBA")
    if result.size != base.size:
        result = result.resize(base.size, Image.NEAREST)

    alpha = np.array(base.getchannel("A"))
    mask = alpha > 0
    if not mask.any():
        mask = np.ones_like(alpha, dtype=bool)

    gray_a = np.asarray(base.convert("L"), dtype=np.float64)
    gray_b = np.asarray(result.convert("L"), dtype=np.float64)

    luma = _masked_correlation(gray_a, gray_b, mask)
    # 엣지는 3x3 커널이 가장자리를 못 쓰므로 마스크를 1픽셀 안쪽으로 줄인다.
    inner = np.zeros_like(mask)
    inner[1:-1, 1:-1] = mask[1:-1, 1:-1]
    edge = _masked_correlation(_sobel_magnitude(gray_a), _sobel_magnitude(gray_b), inner)

    return {
        "score": float(max(0.0, min(1.0, 0.5 * edge + 0.5 * luma))),
        "edge": round(float(edge), 4),
        "luma": round(float(luma), 4),
        "pixels": int(mask.sum()),
    }


def run_qa(
    original: Image.Image,
    styled: Image.Image,
    spec: dict,
    tile_width: int | None = None,
    tile_height: int | None = None,
) -> dict:
    """축별 점수 + 종합 판정. 타일 크기가 주어지면 이음새 축도 평가한다."""
    iou = silhouette_iou(original, styled)
    compliance = palette_compliance(styled, spec)
    fidelity = content_fidelity(original, styled)
    axes = {
        "silhouette_iou": {"score": round(iou, 4), "passed": iou >= SILHOUETTE_IOU_MIN},
        "palette_compliance": {"score": round(compliance, 4), "passed": compliance >= PALETTE_COMPLIANCE_MIN},
        # advisory=True — 점수는 남기되 종합 판정(passed)에는 반영하지 않는다.
        "content_fidelity": {
            "score": round(fidelity["score"], 4),
            "passed": fidelity["score"] >= CONTENT_FIDELITY_MIN,
            "advisory": True,
            "edge": fidelity["edge"],
            "luma": fidelity["luma"],
        },
    }
    if tile_width and tile_height:
        seam = seam_score(styled, tile_width, tile_height)
        axes["seam"] = {
            "score": round(seam["score"], 4),
            "passed": seam["score"] >= SEAM_SCORE_MIN,
            "metric": seam["metric"],
            "pairs": seam["pairs"],
        }
    blocking = [axis for axis in axes.values() if not axis.get("advisory")]
    return {"passed": all(axis["passed"] for axis in blocking), "axes": axes}
