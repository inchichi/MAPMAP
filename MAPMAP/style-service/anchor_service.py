"""Stage 2 fixed-source style anchors for the Kontext backend."""

from __future__ import annotations

import io
import json
import shutil
from pathlib import Path

from PIL import Image

import asset_store
import kontext_client
import object_extract
import postprocess
import style_spec

_ANCHORS_DIR = Path(__file__).resolve().parent / "anchors"

ANCHOR_COUNT = 4

_ANCHOR_SOURCES = (
    ("wide terrain tile", "object", "tile_wall_0_48", "terrain_tile"),
    ("stone structure", "object", "clock_tower", "object"),
    ("small prop object", "object", "tree_1", "object"),
    (
        "small creature character",
        "asset",
        "src/games/my-sample-rpg/assets/monsters/monster-pig-sheet.png",
        "character_sprite",
    ),
)


def _anchor_dir(style_id: str) -> Path:
    return _ANCHORS_DIR / style_id


def list_anchors(style_id: str) -> list[str]:
    directory = _anchor_dir(style_id)
    if not directory.is_dir():
        return []
    return sorted(path.name for path in directory.glob("anchor-*.png"))


def read_anchor(style_id: str, name: str) -> bytes:
    if "/" in name or "\\" in name or ".." in name:
        raise ValueError(f"Invalid anchor name: {name}")
    path = _anchor_dir(style_id) / name
    if not path.is_file():
        raise FileNotFoundError(f"Anchor does not exist: {style_id}/{name}")
    return path.read_bytes()


def _read_source(source_kind: str, source_id: str) -> Image.Image:
    if source_kind == "object":
        data = object_extract.read_png(source_id)
    else:
        data = asset_store.read_original_or_current(source_id)
    image = Image.open(io.BytesIO(data))
    image.load()
    return image


def generate_anchors(style_id: str, force: bool = False) -> dict:
    """Create anchors by editing fixed repository images instead of using txt2img."""
    spec = style_spec.load_spec(style_id)
    directory = _anchor_dir(style_id)

    if not force and list_anchors(style_id):
        return {"style_id": style_id, "anchors": list_anchors(style_id), "cached": True}

    if directory.is_dir():
        shutil.rmtree(directory)
    directory.mkdir(parents=True, exist_ok=True)

    config = kontext_client.get_kontext_config()
    palette = postprocess.spec_palette_colors(spec)
    prompts: list[str] = []
    sources: list[dict] = []
    for index, (subject, source_kind, source_id, category) in enumerate(
        _ANCHOR_SOURCES[:ANCHOR_COUNT]
    ):
        prompt = f"{subject}, {style_spec.build_prompt(spec, category)}"
        seed = config.seed + index
        image = _read_source(source_kind, source_id)
        edited = kontext_client.edit_image(
            image,
            prompt,
            strength=0.5,
            config=config,
            seed=seed,
        )
        snapped = postprocess.snap_palette(edited.convert("RGBA"), palette)
        snapped.convert("RGB").save(directory / f"anchor-{index + 1}.png")
        prompts.append(prompt)
        sources.append(
            {
                "subject": subject,
                "source_kind": source_kind,
                "source_id": source_id,
                "category": category,
                "seed": seed,
                "size": list(image.size),
            }
        )

    (directory / "meta.json").write_text(
        json.dumps(
            {
                "style_id": style_id,
                "model": config.model_id,
                "lora_path": config.lora_path,
                "lora_scale": config.lora_scale,
                "steps": config.steps,
                "guidance_scale": config.guidance_scale,
                "prompts": prompts,
                "sources": sources,
                "anchor_semantics": "fixed-source Kontext edit; no txt2img",
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    style_spec.set_anchors_approved(style_id, False)
    return {"style_id": style_id, "anchors": list_anchors(style_id), "cached": False}


def approve_anchors(style_id: str, approved: bool) -> dict:
    if approved and not list_anchors(style_id):
        raise ValueError("Cannot approve anchors before generating them")
    spec = style_spec.set_anchors_approved(style_id, approved)
    return {"style_id": style_id, "anchors_approved": spec["anchors_approved"]}
