"""Stage 2 — 스타일 앵커 생성·캐싱·승인 게이트.

"스타일마다 일관성이 없다"의 직접 해법: StyleSpec으로 앵커 이미지 3~5장을 먼저
생성하고, 사람 승인을 거친 앵커를 이후 모든 에셋 변환의 고정 참조로 쓴다.
매 타일마다 프롬프트로 스타일을 재해석하게 두지 않는다.

현재 구현의 일관성 장치(문서의 StyleAligned/IP-Adapter 대응):
- 고정 시드 시퀀스 + 동일 합성 프롬프트로 앵커 세트 생성
- 생성 직후 스펙 팔레트로 스냅 → 앵커 세트의 색 공간이 곧 스펙
- 변환 단계는 앵커와 같은 프롬프트·팔레트를 공유 (앵커 = 기계가 읽는 무드보드)
StyleAligned(배치 어텐션 공유)·IP-Adapter는 SDXL 브랜치 검증 후 여기에 끼운다.

앵커는 anchors/<style_id>/anchor-N.png 로 캐싱된다 — 스타일당 1회 생성.
"""

from __future__ import annotations

import json
import shutil
from functools import lru_cache
from pathlib import Path

from PIL import Image

import postprocess
import style_spec
from style_service_config import get_config

_ANCHORS_DIR = Path(__file__).resolve().parent / "anchors"

ANCHOR_COUNT = 4
ANCHOR_SIZE = 768

# 앵커는 카테고리 대표 장면으로 구성 — 같은 스타일이 지형/오브젝트/캐릭터에서
# 어떻게 보이는지 세트로 확인시킨다(승인 게이트에서 사람이 보는 것).
_ANCHOR_SUBJECTS = (
    "wide terrain ground texture",
    "stone wall and floor tiles",
    "a small prop object, single item",
    "a small creature character, full body",
)


@lru_cache(maxsize=1)
def _get_txt2img_pipeline():
    import torch
    from diffusers import StableDiffusionXLPipeline

    import sdxl_service

    # img2img 파이프라인과 가중치를 공유해 VRAM 이중 적재를 피한다.
    base = sdxl_service._get_pipeline()
    pipeline = StableDiffusionXLPipeline.from_pipe(base)
    pipeline.set_progress_bar_config(disable=True)
    return pipeline


def _anchor_dir(style_id: str) -> Path:
    return _ANCHORS_DIR / style_id


def list_anchors(style_id: str) -> list[str]:
    directory = _anchor_dir(style_id)
    if not directory.is_dir():
        return []
    return sorted(path.name for path in directory.glob("anchor-*.png"))


def read_anchor(style_id: str, name: str) -> bytes:
    if "/" in name or "\\" in name or ".." in name:
        raise ValueError(f"앵커 이름 형식 오류: {name}")
    path = _anchor_dir(style_id) / name
    if not path.is_file():
        raise FileNotFoundError(f"앵커가 없습니다: {style_id}/{name}")
    return path.read_bytes()


def generate_anchors(style_id: str, force: bool = False) -> dict:
    """스펙으로 앵커 세트를 생성·캐싱한다. 이미 있으면(force 아님) 캐시를 반환."""
    spec = style_spec.load_spec(style_id)
    directory = _anchor_dir(style_id)

    if not force and list_anchors(style_id):
        return {"style_id": style_id, "anchors": list_anchors(style_id), "cached": True}

    if directory.is_dir():
        shutil.rmtree(directory)
    directory.mkdir(parents=True, exist_ok=True)

    import torch

    config = get_config()
    pipeline = _get_txt2img_pipeline()
    palette = postprocess.spec_palette_colors(spec)
    negative = spec.get("negative_prompt") or "photo, realistic, blurry, watermark, text"

    prompts = []
    for index, subject in enumerate(_ANCHOR_SUBJECTS[:ANCHOR_COUNT]):
        prompt = f"{subject}, {style_spec.build_prompt(spec, 'terrain_tile' if index < 2 else ('object' if index == 2 else 'character_sprite'))}"
        prompts.append(prompt)
        # 시드를 스타일 시드에서 파생 — 같은 스펙이면 언제 다시 생성해도 같은 앵커.
        generator = torch.Generator(device=config["sdxl_device"]).manual_seed(
            config["sdxl_seed"] + index
        )
        image = pipeline(
            prompt=prompt,
            negative_prompt=negative,
            width=ANCHOR_SIZE,
            height=ANCHOR_SIZE,
            num_inference_steps=config["sdxl_steps"],
            guidance_scale=config["sdxl_guidance_scale"],
            generator=generator,
        ).images[0]
        # 앵커도 팔레트 스냅 — 승인 게이트에서 보는 색이 곧 파이프라인의 색.
        snapped = postprocess.snap_palette(image.convert("RGBA"), palette)
        snapped.convert("RGB").save(directory / f"anchor-{index + 1}.png")

    (directory / "meta.json").write_text(
        json.dumps({"style_id": style_id, "prompts": prompts}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    # 새로 생성했으니 승인 상태는 리셋 — 승인은 사람(또는 CSD 게이트)이 다시 한다.
    style_spec.set_anchors_approved(style_id, False)
    return {"style_id": style_id, "anchors": list_anchors(style_id), "cached": False}


def approve_anchors(style_id: str, approved: bool) -> dict:
    """승인 게이트 — 승인된 스타일만 파이프라인 실행이 허용된다."""
    if approved and not list_anchors(style_id):
        raise ValueError("앵커가 없어 승인할 수 없습니다. 먼저 앵커를 생성하세요.")
    spec = style_spec.set_anchors_approved(style_id, approved)
    return {"style_id": style_id, "anchors_approved": spec["anchors_approved"]}
