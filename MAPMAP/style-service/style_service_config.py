"""Shared configuration for the local style service."""

from __future__ import annotations

import json
import os
from pathlib import Path

_SERVICE_DIR = Path(__file__).resolve().parent
_CONFIG_PATH = _SERVICE_DIR / "config.json"

_config: dict | None = None


def _resolve_path(raw_value: str, base_dir: Path) -> Path:
    path = Path(raw_value)
    return path if path.is_absolute() else (base_dir / path).resolve()


def _resolve_int(value: str | int) -> int:
    return int(value)


def _resolve_float(value: str | float) -> float:
    return float(value)


def get_config() -> dict:
    """Load and cache the style-service config."""
    global _config
    if _config is not None:
        return _config

    raw = json.loads(_CONFIG_PATH.read_text(encoding="utf-8"))

    project_dir = _resolve_path(
        os.environ.get("EDITOR_PROJECT_DIR", raw["projectDir"]),
        _SERVICE_DIR,
    )

    external_projects: dict[str, dict] = {}
    for pid, entry in raw.get("externalProjects", {}).items():
        root = _resolve_path(os.environ.get(f"EXT_{pid.upper()}_ROOT", entry["root"]), _SERVICE_DIR)
        external_projects[pid] = {
            "name": entry.get("name", pid),
            "root": root,
            "assets_subdir": entry.get("assetsSubdir"),
        }

    sdxl_model = os.environ.get(
        "SDXL_MODEL", raw.get("sdxlModel", "stabilityai/stable-diffusion-xl-base-1.0")
    )

    _config = {
        "project_dir": project_dir,
        "assets_subdir": raw.get("assetsSubdir", "src/games/my-sample-rpg/assets"),
        "external_projects": external_projects,
        "sdxl_model": sdxl_model,
        "sdxl_device": os.environ.get("SDXL_DEVICE", raw.get("sdxlDevice", "cuda")),
        "sdxl_steps": _resolve_int(os.environ.get("SDXL_STEPS", raw.get("sdxlSteps", 30))),
        "sdxl_guidance_scale": _resolve_float(os.environ.get("SDXL_GUIDANCE_SCALE", raw.get("sdxlGuidanceScale", 5.0))),
        "sdxl_strength": _resolve_float(os.environ.get("SDXL_STRENGTH", raw.get("sdxlStrength", 0.45))),
        "sdxl_seed": _resolve_int(os.environ.get("SDXL_SEED", raw.get("sdxlSeed", 123456789))),
        "host": os.environ.get("STYLE_SERVICE_HOST", raw["host"]),
        "port": int(os.environ.get("STYLE_SERVICE_PORT", raw["port"])),
    }
    return _config
