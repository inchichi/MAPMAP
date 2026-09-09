"""Stage 4 — 규격 스냅(결정론적 후처리). AI 출력을 그대로 쓰지 않는다.

디벨롭 방향 문서의 원칙: "구조는 코드가 지키고, 스타일은 모델이 만든다."
- 팔레트 스냅: StyleSpec의 N색 팔레트로 양자화 → 색 일관성이 하드 제약이 된다.
- NN 다운스케일: 타일 크기의 정수배로 생성된 결과를 nearest로 줄여 픽셀 그리드를
  타일 격자와 정렬한다 (nerijs/pixel-art-xl 노하우).
- 알파 재적용: 원본 실루엣이 1픽셀도 흔들리지 않게 원본 알파를 되씌운다.

모든 함수는 순수 PIL/numpy — GPU/모델 없이 결정론적으로 동작한다.
"""

from __future__ import annotations

import numpy as np
from PIL import Image


def spec_palette_colors(spec: dict) -> np.ndarray:
    """StyleSpec 팔레트를 (N,3) uint8 배열로. anchors가 n_colors보다 적으면
    anchors 사이 보간으로 부족분을 채워 N색 팔레트를 만든다."""
    anchors = [_hex_to_rgb(color) for color in spec["palette"]["anchors"]]
    n_colors = spec["palette"]["n_colors"]
    if len(anchors) >= n_colors:
        return np.array(anchors[:n_colors], dtype=np.uint8)
    # 앵커 사이를 선형 보간해 중간 색을 만든다 — 결정론적이고 스펙에 종속.
    anchors_arr = np.array(anchors, dtype=np.float64)
    positions = np.linspace(0, len(anchors) - 1, n_colors)
    lower = np.floor(positions).astype(int)
    upper = np.minimum(lower + 1, len(anchors) - 1)
    fraction = (positions - lower)[:, None]
    palette = anchors_arr[lower] * (1 - fraction) + anchors_arr[upper] * fraction
    return np.round(palette).astype(np.uint8)


def _hex_to_rgb(color: str) -> tuple[int, int, int]:
    value = color.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16))


def snap_palette(image: Image.Image, palette: np.ndarray) -> Image.Image:
    """각 픽셀을 팔레트에서 가장 가까운 색으로 스냅한다(알파는 보존).

    팔레트가 하드 제약이므로 어떤 에셋을 몇 번 변환해도 색 공간이 스펙 밖으로
    벗어나지 않는다 — 스타일 드리프트의 결정론적 차단.
    """
    rgba = image.convert("RGBA")
    pixels = np.array(rgba)
    rgb = pixels[..., :3].astype(np.int32)
    # (H,W,1,3) - (N,3) → (H,W,N) 거리. 타일/시트 크기(수백 px)에서는 충분히 빠르다.
    distances = np.square(rgb[..., None, :] - palette[None, None, :, :].astype(np.int32)).sum(axis=-1)
    nearest = np.argmin(distances, axis=-1)
    snapped = palette[nearest]
    out = np.concatenate([snapped, pixels[..., 3:4]], axis=-1).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def nn_downscale(image: Image.Image, target_size: tuple[int, int]) -> Image.Image:
    """정수배 큰 생성 결과를 NEAREST로 목표 크기에 스냅한다 — 픽셀 그리드 정렬."""
    if image.size == target_size:
        return image
    return image.resize(target_size, Image.NEAREST)


def reapply_alpha(styled: Image.Image, original: Image.Image) -> Image.Image:
    """원본 알파 채널을 변환 결과에 그대로 되씌운다 — 실루엣 불변 강제.

    원본에 알파가 없으면 결과를 그대로 돌려준다(배경 보존은 상위 분기 담당).
    """
    if original.mode not in ("RGBA", "LA", "PA") and not (
        original.mode == "P" and "transparency" in original.info
    ):
        return styled
    original_alpha = original.convert("RGBA").getchannel("A")
    out = styled.convert("RGBA")
    if out.size != original_alpha.size:
        out = out.resize(original_alpha.size, Image.NEAREST)
    out.putalpha(original_alpha)
    return out


def spec_snap(styled: Image.Image, original: Image.Image, spec: dict) -> Image.Image:
    """Stage 4 전체: NN 크기 정합 → 팔레트 스냅 → 원본 알파 재적용."""
    out = nn_downscale(styled, original.size)
    out = snap_palette(out, spec_palette_colors(spec))
    return reapply_alpha(out, original)
