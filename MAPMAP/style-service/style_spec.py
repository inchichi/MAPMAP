"""StyleSpec — 시나리오 기반 스타일 명세(JSON)의 검증·저장·프롬프트 합성.

디벨롭 방향 문서의 Stage 1 수신부. 자유도는 LLM이 만드는 concept/palette/material/
lighting/motif에만 있고, 구조 규격(immutable 목록)은 서버가 강제로 덮어써 LLM이
건드릴 수 없다. 스펙은 specs/<style_id>.json 으로 저장되며, 앵커 승인 상태
(anchors_approved)가 파이프라인 실행의 게이트가 된다.
"""

from __future__ import annotations

import json
import re
import threading
from pathlib import Path

_SPECS_DIR = Path(__file__).resolve().parent / "specs"
_lock = threading.Lock()

# LLM이 무엇을 보내든 서버가 강제하는 불변 목록 — 스키마 수준 차단.
IMMUTABLE_FIELDS = ("silhouette", "tile_grid", "collision", "anchor_points", "alpha_mask")

CATEGORIES = ("terrain_tile", "object", "character_sprite")

_STYLE_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_\-]{1,63}$")
_HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def _str_list(value, field: str, max_items: int = 12) -> list[str]:
    _require(isinstance(value, list) and len(value) <= max_items, f"{field}는 최대 {max_items}개의 목록이어야 합니다.")
    out = []
    for item in value:
        _require(isinstance(item, str) and 0 < len(item.strip()) <= 200, f"{field} 항목이 올바르지 않습니다.")
        out.append(item.strip())
    return out


def validate_spec(raw: dict) -> dict:
    """LLM/에디터가 보낸 StyleSpec을 검증·정규화한다. immutable은 무조건 서버 값으로 덮어쓴다."""
    _require(isinstance(raw, dict), "StyleSpec은 객체여야 합니다.")

    style_id = raw.get("style_id")
    _require(isinstance(style_id, str) and bool(_STYLE_ID_RE.match(style_id)),
             "style_id는 소문자/숫자/_/- 2~64자여야 합니다.")

    concept = raw.get("concept")
    _require(isinstance(concept, str) and 0 < len(concept.strip()) <= 500, "concept이 필요합니다(500자 이내).")

    palette = raw.get("palette")
    _require(isinstance(palette, dict), "palette 객체가 필요합니다.")
    n_colors = palette.get("n_colors")
    _require(isinstance(n_colors, int) and 4 <= n_colors <= 64, "palette.n_colors는 4~64 정수여야 합니다.")
    anchors = palette.get("anchors")
    _require(isinstance(anchors, list) and 2 <= len(anchors) <= 16, "palette.anchors는 2~16개여야 합니다.")
    for color in anchors:
        _require(isinstance(color, str) and bool(_HEX_RE.match(color)), f"팔레트 색상 형식 오류: {color}")

    lighting = raw.get("lighting") or {}
    _require(isinstance(lighting, dict), "lighting은 객체여야 합니다.")
    lighting_out = {}
    for key in ("key", "ambient"):
        value = lighting.get(key, "")
        _require(isinstance(value, str) and len(value) <= 200, f"lighting.{key}가 올바르지 않습니다.")
        lighting_out[key] = value.strip()

    per_category = raw.get("per_category_prompt") or {}
    _require(isinstance(per_category, dict), "per_category_prompt는 객체여야 합니다.")
    per_category_out = {}
    for category, prompt in per_category.items():
        _require(category in CATEGORIES, f"알 수 없는 카테고리: {category}")
        _require(isinstance(prompt, str) and len(prompt) <= 300, f"{category} 프롬프트가 올바르지 않습니다.")
        per_category_out[category] = prompt.strip()

    style_strength = raw.get("style_strength", 0.5)
    _require(isinstance(style_strength, (int, float)) and 0.1 <= float(style_strength) <= 0.9,
             "style_strength는 0.1~0.9여야 합니다.")

    negative = raw.get("negative_prompt", "")
    _require(isinstance(negative, str) and len(negative) <= 300, "negative_prompt가 올바르지 않습니다.")

    return {
        "style_id": style_id,
        "concept": concept.strip(),
        "palette": {"n_colors": n_colors, "anchors": [color.lower() for color in anchors]},
        "material": _str_list(raw.get("material", []), "material"),
        "lighting": lighting_out,
        "motif": _str_list(raw.get("motif", []), "motif"),
        "per_category_prompt": per_category_out,
        "style_strength": float(style_strength),
        "negative_prompt": negative.strip(),
        # LLM 출력이 무엇이든 서버 상수로 강제 — 자유도는 위 필드까지만.
        "immutable": list(IMMUTABLE_FIELDS),
        "anchors_approved": False,
    }


def _spec_path(style_id: str) -> Path:
    _require(bool(_STYLE_ID_RE.match(style_id)), f"style_id 형식 오류: {style_id}")
    return _SPECS_DIR / f"{style_id}.json"


def save_spec(raw: dict) -> dict:
    """검증 후 저장. 같은 style_id가 있으면 덮어쓰되 앵커 승인 상태는 리셋한다(스펙이 바뀌면 앵커 재승인)."""
    spec = validate_spec(raw)
    with _lock:
        _SPECS_DIR.mkdir(parents=True, exist_ok=True)
        _spec_path(spec["style_id"]).write_text(
            json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    return spec


def load_spec(style_id: str) -> dict:
    path = _spec_path(style_id)
    if not path.is_file():
        raise FileNotFoundError(f"StyleSpec이 없습니다: {style_id}")
    return json.loads(path.read_text(encoding="utf-8"))


def list_specs() -> list[dict]:
    if not _SPECS_DIR.is_dir():
        return []
    out = []
    for path in sorted(_SPECS_DIR.glob("*.json")):
        try:
            spec = json.loads(path.read_text(encoding="utf-8"))
            out.append({
                "style_id": spec["style_id"],
                "concept": spec.get("concept", ""),
                "anchors_approved": bool(spec.get("anchors_approved")),
                "palette": spec.get("palette", {}),
            })
        except (json.JSONDecodeError, KeyError):
            continue
    return out


def set_anchors_approved(style_id: str, approved: bool) -> dict:
    with _lock:
        spec = load_spec(style_id)
        spec["anchors_approved"] = bool(approved)
        _spec_path(style_id).write_text(
            json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    return spec


def build_prompt(spec: dict, category: str) -> str:
    """StyleSpec을 카테고리별 SDXL 프롬프트로 합성한다 — 세리팀 피드백대로
    자연어 문장이 아니라 전용 키워드 프롬프트 형식."""
    parts: list[str] = [spec["concept"]]
    category_prompt = spec.get("per_category_prompt", {}).get(category)
    if category_prompt:
        parts.append(category_prompt)
    if spec.get("material"):
        parts.append(", ".join(spec["material"]))
    lighting = spec.get("lighting", {})
    if lighting.get("key"):
        parts.append(f"lighting: {lighting['key']}")
    if lighting.get("ambient"):
        parts.append(f"ambient: {lighting['ambient']}")
    if spec.get("motif"):
        parts.append(", ".join(spec["motif"]))
    parts.append("pixel art, game asset, limited palette, clean edges")
    return ", ".join(part for part in parts if part)
