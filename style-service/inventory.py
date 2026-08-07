"""Stage 0 — 에셋 인벤토리 (오프라인 1회, 필요 시 재빌드).

.tsx 타일셋 메타(타일 크기·columns·타일 타입)를 파싱하고, 에셋 폴더의 PNG 전부에
카테고리 태그(terrain_tile / object / character_sprite / ui)를 붙여 inventory.json
으로 저장한다. 이 태그가 Stage 3 카테고리 라우터의 입력이다.

문서의 SAM 분할·lineart 추출은 후속 훅 — 묶인 오브젝트 분할은 현재 에디터의
셀 선택 + object_extract 흐름이 담당하고 있어, 인벤토리는 카테고리·그리드·알파
메타를 우선 제공한다.
"""

from __future__ import annotations

import json
import threading
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image

import asset_store
import style_service_config

_INVENTORY_PATH = Path(__file__).resolve().parent / "inventory.json"
_lock = threading.Lock()

# 경로 접두(assets/ 하위 첫 폴더) → 카테고리. 규칙에 없으면 object.
_CATEGORY_BY_FOLDER = {
    "tilesets": "terrain_tile",
    "monsters": "character_sprite",
    "spritesheets": "character_sprite",
    "boss": "character_sprite",
    "portraits": "ui",
    "fonts": "ui",
    "skills": "ui",
    "portal": "object",
    "weapons": "object",
    "armor": "object",
    "vfx": "object",
}


def _parse_tsx(path: Path) -> dict | None:
    """Tiled .tsx에서 타일 그리드 메타와 (있으면) 타일 타입 태그를 뽑는다."""
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError:
        return None
    image = root.find("image")
    if image is None:
        return None
    tile_types = {}
    for tile in root.findall("tile"):
        tile_type = tile.get("type")
        if tile_type:
            tile_types[int(tile.get("id", "-1"))] = tile_type
    return {
        "name": root.get("name", path.stem),
        "tileWidth": int(root.get("tilewidth", "0")),
        "tileHeight": int(root.get("tileheight", "0")),
        "tileCount": int(root.get("tilecount", "0")),
        "columns": int(root.get("columns", "0")),
        "imageSource": image.get("source", ""),
        "tileTypeCount": len(tile_types),
    }


def build_inventory() -> dict:
    """에셋 폴더를 스캔해 인벤토리를 만들고 저장한다."""
    config = style_service_config.get_config()
    root = asset_store.assets_root()

    tilesets: dict[str, dict] = {}
    for tsx_path in sorted(root.rglob("*.tsx")):
        meta = _parse_tsx(tsx_path)
        if meta is None or not meta["imageSource"]:
            continue
        image_relative = (
            (tsx_path.parent / meta["imageSource"]).resolve().relative_to(config["project_dir"]).as_posix()
        )
        tilesets[image_relative] = meta

    assets: list[dict] = []
    for png_path in sorted(root.rglob("*.png")):
        relative = png_path.relative_to(config["project_dir"]).as_posix()
        subpath = png_path.relative_to(root)
        folder = subpath.parts[0] if len(subpath.parts) > 1 else ""

        try:
            with Image.open(png_path) as image:
                width, height = image.size
                has_alpha = image.mode in ("RGBA", "LA", "PA") or (
                    image.mode == "P" and "transparency" in image.info
                )
        except OSError:
            continue

        entry: dict = {
            "path": relative,
            "category": _CATEGORY_BY_FOLDER.get(folder, "object"),
            "width": width,
            "height": height,
            "hasAlpha": has_alpha,
        }
        if relative in tilesets:
            entry["category"] = "terrain_tile"
            entry["tileset"] = tilesets[relative]
        # 문서의 불변 영역(immutable region) 훅 — 길(path) 보호 등은 여기에 명시한다.
        entry["immutableRegions"] = []
        assets.append(entry)

    inventory = {"assets": assets, "tilesetCount": len(tilesets), "assetCount": len(assets)}
    with _lock:
        _INVENTORY_PATH.write_text(
            json.dumps(inventory, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    return inventory


def load_inventory(rebuild_if_missing: bool = True) -> dict:
    if _INVENTORY_PATH.is_file():
        try:
            return json.loads(_INVENTORY_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    if rebuild_if_missing:
        return build_inventory()
    return {"assets": [], "tilesetCount": 0, "assetCount": 0}


def category_of(path: str) -> str:
    """인벤토리에서 에셋 카테고리를 찾는다. 없으면 즉석 재빌드 후 재시도, 그래도 없으면 object."""
    inventory = load_inventory()
    for entry in inventory["assets"]:
        if entry["path"] == path:
            return entry["category"]
    inventory = build_inventory()
    for entry in inventory["assets"]:
        if entry["path"] == path:
            return entry["category"]
    return "object"


def entry_of(path: str) -> dict | None:
    for entry in load_inventory()["assets"]:
        if entry["path"] == path:
            return entry
    return None
