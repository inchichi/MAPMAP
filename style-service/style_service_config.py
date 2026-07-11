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

    freestyle_repo_dir = _resolve_path(
        os.environ.get("FREESTYLE_REPO_DIR", raw.get("freestyleRepoDir", "../../FreeStyle")),
        _SERVICE_DIR,
    )
    freestyle_diffusers_test_dir = _resolve_path(
        os.environ.get(
            "FREESTYLE_DIFFUSERS_TEST_DIR",
            raw.get("freestyleDiffusersTestDir", "diffusers_test"),
        ),
        freestyle_repo_dir,
    )
    freestyle_model_dir = _resolve_path(
        os.environ.get(
            "FREESTYLE_MODEL_DIR",
            raw.get("freestyleModelDir", "diffusers_test/stable-diffusion-xl-base-1.0"),
        ),
        freestyle_repo_dir,
    )
    freestyle_unet_dir = _resolve_path(
        os.environ.get(
            "FREESTYLE_UNET_DIR",
            raw.get("freestyleUnetDir", "diffusers_test/stable-diffusion-xl-base-1.0/unet"),
        ),
        freestyle_repo_dir,
    )

    _config = {
        "project_dir": project_dir,
        "assets_subdir": raw.get("assetsSubdir", "src/games/my-sample-rpg/assets"),
        "external_projects": external_projects,
        "freestyle_repo_dir": freestyle_repo_dir,
        "freestyle_diffusers_test_dir": freestyle_diffusers_test_dir,
        "freestyle_model_dir": freestyle_model_dir,
        "freestyle_unet_dir": freestyle_unet_dir,
        "freestyle_sampler": os.environ.get("FREESTYLE_SAMPLER", raw.get("freestyleSampler", "DDIM")),
        "freestyle_steps": _resolve_int(os.environ.get("FREESTYLE_STEPS", raw.get("freestyleSteps", 30))),
        "freestyle_cfg": _resolve_int(os.environ.get("FREESTYLE_CFG", raw.get("freestyleCfg", 5))),
        "freestyle_num_images_per_prompt": _resolve_int(
            os.environ.get(
                "FREESTYLE_NUM_IMAGES_PER_PROMPT",
                raw.get("freestyleNumImagesPerPrompt", 1),
            )
        ),
        "freestyle_n": _resolve_int(os.environ.get("FREESTYLE_N", raw.get("freestyleN", 160))),
        "freestyle_b": _resolve_float(os.environ.get("FREESTYLE_B", raw.get("freestyleB", 2.5))),
        "freestyle_s": _resolve_float(os.environ.get("FREESTYLE_S", raw.get("freestyleS", 1.0))),
        "freestyle_seed": _resolve_int(
            os.environ.get("FREESTYLE_SEED", raw.get("freestyleSeed", 123456789))
        ),
        "host": os.environ.get("STYLE_SERVICE_HOST", raw["host"]),
        "port": int(os.environ.get("STYLE_SERVICE_PORT", raw["port"])),
    }
    return _config
