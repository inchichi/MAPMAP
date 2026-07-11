"""FreeStyle-based local text-guided style transfer helpers."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageFilter

from style_service_config import get_config

_BACKGROUND_GRAY = (128, 128, 128)


def _has_alpha(image: Image.Image) -> bool:
    return image.mode in ("RGBA", "LA", "PA") or (
        image.mode == "P" and "transparency" in image.info
    )


def erode_alpha(alpha_channel: Image.Image, pixels: int) -> Image.Image:
    """Erode an alpha mask by a few pixels."""
    if pixels <= 0:
        return alpha_channel
    return alpha_channel.filter(ImageFilter.MinFilter(pixels * 2 + 1))


def _resize_short_edge(image: Image.Image, target_short_edge: int) -> Image.Image:
    if target_short_edge <= 0:
        return image
    short_edge = min(image.width, image.height)
    if short_edge <= 0:
        return image
    scale = target_short_edge / short_edge
    width = max(1, round(image.width * scale))
    height = max(1, round(image.height * scale))
    return image.resize((width, height), Image.LANCZOS)


def _round_to_multiple(value: int, multiple: int = 8) -> int:
    return max(multiple, ((value + multiple - 1) // multiple) * multiple)


def _prepare_model_image(image: Image.Image, content_size: int) -> Image.Image:
    if content_size > 0:
        image = _resize_short_edge(image, content_size)

    width = _round_to_multiple(image.width)
    height = _round_to_multiple(image.height)
    if (width, height) != image.size:
        image = image.resize((width, height), Image.LANCZOS)
    return image


def _resolve_repo_paths() -> tuple[Path, Path, Path, Path]:
    config = get_config()
    repo_dir = config["freestyle_repo_dir"]
    diffusers_test_dir = config["freestyle_diffusers_test_dir"]
    model_dir = config["freestyle_model_dir"]
    unet_dir = config["freestyle_unet_dir"]

    script_path = diffusers_test_dir / "stable_diffusion_xl_test.py"
    if not script_path.is_file():
        raise FileNotFoundError(
            f"FreeStyle script not found: {script_path}. "
            "Set FREESTYLE_REPO_DIR to a checkout of the FreeStyle repository."
        )
    if not model_dir.is_dir():
        raise FileNotFoundError(
            f"FreeStyle model directory not found: {model_dir}. "
            "Download the SDXL weights into the FreeStyle repo first."
        )
    if not unet_dir.exists():
        raise FileNotFoundError(
            f"FreeStyle unet directory not found: {unet_dir}."
        )
    return repo_dir, diffusers_test_dir, model_dir, unet_dir


def _find_output_image(output_dir: Path) -> Path:
    pngs = sorted(output_dir.rglob("*.png"))
    if not pngs:
        raise FileNotFoundError(f"FreeStyle did not produce an image in {output_dir}")
    return pngs[0]


def _run_freestyle(content: Image.Image, style_prompt: str) -> Image.Image:
    prompt = style_prompt.strip()
    if not prompt:
        raise ValueError("style_prompt must not be empty")

    config = get_config()
    _repo_dir, diffusers_test_dir, model_dir, unet_dir = _resolve_repo_paths()

    with tempfile.TemporaryDirectory(prefix="freestyle-style-") as temp_root:
        temp_root_path = Path(temp_root)
        refimg_dir = temp_root_path / "refimg"
        refimg_dir.mkdir(parents=True, exist_ok=True)
        output_dir = temp_root_path / "output"
        output_dir.mkdir(parents=True, exist_ok=True)
        prompt_json = temp_root_path / "prompt.json"

        content_path = refimg_dir / "content.png"
        content.save(content_path)
        prompt_json.write_text(json.dumps([prompt], ensure_ascii=False), encoding="utf-8")

        command = [
            sys.executable,
            str(diffusers_test_dir / "stable_diffusion_xl_test.py"),
            "--refimgpath",
            str(refimg_dir),
            "--model_name",
            str(model_dir),
            "--unet_name",
            str(unet_dir),
            "--prompt_json",
            str(prompt_json),
            "--num_images_per_prompt",
            str(config["freestyle_num_images_per_prompt"]),
            "--output_dir",
            str(output_dir),
            "--sampler",
            str(config["freestyle_sampler"]),
            "--steps",
            str(config["freestyle_steps"]),
            "--cfg",
            str(config["freestyle_cfg"]),
            "--height",
            str(content.height),
            "--width",
            str(content.width),
            "--seed",
            str(config["freestyle_seed"]),
            "--n",
            str(config["freestyle_n"]),
            "--b",
            str(config["freestyle_b"]),
            "--s",
            str(config["freestyle_s"]),
            "--exist_ok",
        ]

        env = os.environ.copy()
        pythonpath = [str(config["freestyle_repo_dir"]), str(diffusers_test_dir)]
        if env.get("PYTHONPATH"):
            pythonpath.append(env["PYTHONPATH"])
        env["PYTHONPATH"] = os.pathsep.join(pythonpath)
        env["PYTHONUTF8"] = "1"
        env["PYTHONIOENCODING"] = "utf-8"

        completed = subprocess.run(
            command,
            cwd=str(diffusers_test_dir),
            env=env,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        if completed.returncode != 0:
            detail = completed.stderr.strip() or completed.stdout.strip()
            raise RuntimeError(
                "FreeStyle inference failed"
                + (f": {detail}" if detail else ".")
            )

        output_image_path = _find_output_image(Path(f"{output_dir}_fp16"))
        result = Image.open(output_image_path)
        result.load()
        return result


def style_transfer_image(
    content: Image.Image,
    style_prompt: str,
    alpha: float = 1.0,
    content_size: int = 512,
    alpha_erode: int = 0,
    preserve_size: bool = False,
) -> Image.Image:
    """Run FreeStyle on a PIL image and return the styled image."""
    if not 0.0 <= alpha <= 1.0:
        raise ValueError(f"alpha must be between 0.0 and 1.0, got {alpha}")

    source_alpha: Image.Image | None = None
    original_size = content.size
    if _has_alpha(content):
        rgba = content.convert("RGBA")
        source_alpha = rgba.getchannel("A")
        gray = Image.new("RGB", rgba.size, _BACKGROUND_GRAY)
        gray.paste(rgba, mask=source_alpha)
        content = gray

    model_input = content.convert("RGB")
    model_input = _prepare_model_image(model_input, content_size)

    result = _run_freestyle(model_input, style_prompt)

    if result.size != model_input.size:
        result = result.resize(model_input.size, Image.LANCZOS)

    if source_alpha is not None or preserve_size:
        if result.size != original_size:
            resample = Image.BOX if result.width >= original_size[0] else Image.LANCZOS
            result = result.resize(original_size, resample)

    if source_alpha is None:
        return result.convert("RGB")

    result = result.convert("RGBA")
    result.putalpha(erode_alpha(source_alpha, alpha_erode))
    return result
