"""SpecDriven Asset Restyling — Stage 3 카테고리 라우터 + 파이프라인 오케스트레이션.

흐름(디벨롭 방향 문서 2.2):
  승인된 StyleSpec/앵커 → 카테고리 라우터(지형/오브젝트/캐릭터 분기)
  → 변환 → Stage 4 규격 스냅(결정론) → Stage 5 자동 QA → 통과분만 적용.

카테고리별 분기:
  - terrain_tile:      낮은 strength(구조 우선) + circular padding 이음새 모드
  - object:            스펙 strength 그대로
  - character_sprite:  중간 strength + 원본 실루엣 하드 제약(Stage 4 알파 재적용).
                       pig/slime 시트는 기존 배경 보존 전용 경로(monster_stylize) 재사용.
  - ui:                기본 제외(요청 시 object 취급)

denoising strength 분리는 문서 Week 1 항목("타일은 낮게, 컨셉은 높게"),
circular padding은 이음새 3단계 중 1단계(가장 싼 실험)의 구현이다.
"""

from __future__ import annotations

import contextlib
import io

from PIL import Image

import asset_store
import inventory
import monster_stylize
import postprocess
import qa_gate
import sdxl_service
import style_spec

# 카테고리별 strength 배율 — spec.style_strength(단일 노브)에 곱한다.
_STRENGTH_SCALE = {
    "terrain_tile": 0.7,
    "object": 1.0,
    "character_sprite": 0.85,
    "ui": 1.0,
}

_MONSTER_KEYS = ("pig", "slime")


@contextlib.contextmanager
def seamless_mode(enabled: bool):
    """UNet/VAE의 Conv2d padding_mode를 circular로 몽키패치한다(문서 이음새 1단계).

    왼쪽 끝 바깥이 오른쪽 끝으로 이어진 것처럼 계산되어 타일 경계 연속성이 좋아진다.
    with 블록을 벗어나면 원래 모드로 복원한다.
    """
    if not enabled:
        yield
        return
    import torch

    pipeline = sdxl_service._get_pipeline()
    patched: list[tuple[torch.nn.Conv2d, str]] = []
    for module in (*pipeline.unet.modules(), *pipeline.vae.modules()):
        if isinstance(module, torch.nn.Conv2d) and module.padding_mode == "zeros":
            patched.append((module, module.padding_mode))
            module.padding_mode = "circular"
    try:
        yield
    finally:
        for module, mode in patched:
            module.padding_mode = mode


def _monster_key_for(path: str) -> str | None:
    lowered = path.lower()
    for key in _MONSTER_KEYS:
        if key in lowered:
            return key
    return None


def _transform(original: Image.Image, path: str, category: str, spec: dict,
               alpha_erode: int) -> Image.Image:
    """카테고리 분기 실행 — 반환은 원본 크기의 스타일 결과(Stage 4 이전)."""
    strength = max(0.1, min(0.9, spec["style_strength"] * _STRENGTH_SCALE.get(category, 1.0)))
    prompt = style_spec.build_prompt(spec, category)

    if category == "character_sprite":
        monster_key = _monster_key_for(path)
        if monster_key:
            # 게임의 색 기반 프레임 슬라이싱을 지키는 기존 전용 경로 재사용.
            return monster_stylize.stylize_monster_sheet(
                original, prompt, monster_key, alpha=1.0, alpha_erode=alpha_erode
            )
        return sdxl_service.style_transfer_image(
            original, prompt, content_size=512, alpha_erode=alpha_erode,
            preserve_size=True, strength=strength,
        )

    seamless = category == "terrain_tile"
    with seamless_mode(seamless):
        return sdxl_service.style_transfer_image(
            original, prompt, content_size=512, alpha_erode=alpha_erode,
            preserve_size=True, strength=strength,
        )


def run_pipeline(style_id: str, targets: list[dict], apply: bool = False,
                 alpha_erode: int = 0, force_unapproved: bool = False) -> dict:
    """대상 목록을 라우팅→변환→규격 스냅→QA까지 돌리고, apply면 통과분만 덮어쓴다.

    targets: [{"path": "src/games/.../x.png", "category": 옵션(없으면 인벤토리)}]
    반환: {"style_id", "results": [{path, category, qa, applied, preview_png(b64 아님, 크기만)}], ...}
    """
    spec = style_spec.load_spec(style_id)
    if not spec.get("anchors_approved") and not force_unapproved:
        raise PermissionError(
            "앵커가 승인되지 않았습니다. 앵커를 생성·확인·승인한 뒤 실행하세요(승인 게이트)."
        )

    results: list[dict] = []
    previews: dict[str, bytes] = {}

    for target in targets:
        path = target.get("path")
        entry: dict = {"path": path}
        try:
            if not isinstance(path, str):
                raise ValueError("path가 없습니다.")
            category = target.get("category") or inventory.category_of(path)
            if category not in style_spec.CATEGORIES and category != "ui":
                raise ValueError(f"알 수 없는 카테고리: {category}")
            entry["category"] = category

            original = Image.open(io.BytesIO(asset_store.read_original_or_current(path)))
            original.load()

            styled = _transform(original, path, category, spec, alpha_erode)

            # Stage 4 — 결정론적 규격 스냅. 몬스터 시트는 배경까지 원본 보존이 목적이라
            # 팔레트 스냅을 건너뛴다(스냅하면 배경색이 변해 슬라이싱이 깨질 수 있음).
            if category == "character_sprite" and _monster_key_for(path):
                snapped = styled
            else:
                snapped = postprocess.spec_snap(styled, original, spec)

            # Stage 5 — QA. 타일셋이면 이음새 축 포함.
            asset_meta = inventory.entry_of(path) or {}
            tileset = asset_meta.get("tileset") or {}
            qa = qa_gate.run_qa(
                original, snapped, spec,
                tile_width=tileset.get("tileWidth"),
                tile_height=tileset.get("tileHeight"),
            )
            entry["qa"] = qa

            buffer = io.BytesIO()
            snapped.save(buffer, format="PNG")
            previews[path] = buffer.getvalue()

            if apply and qa["passed"]:
                asset_store.backup_and_write(path, buffer.getvalue())
                entry["applied"] = True
            else:
                entry["applied"] = False
        except (ValueError, FileNotFoundError, OSError, PermissionError) as error:
            entry["error"] = str(error)
            entry["applied"] = False
        results.append(entry)

    passed = sum(1 for entry in results if entry.get("qa", {}).get("passed"))
    return {
        "style_id": style_id,
        "results": results,
        "summary": {
            "total": len(results),
            "qa_passed": passed,
            "applied": sum(1 for entry in results if entry.get("applied")),
            "failed": sum(1 for entry in results if "error" in entry),
        },
        "_previews": previews,  # server.py가 b64로 직렬화해 응답에 싣는다.
    }
