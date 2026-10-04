"""SDXL img2img helpers for the local style service."""

from __future__ import annotations

from functools import lru_cache

from PIL import Image, ImageFilter

from style_service_config import get_config

_BACKGROUND_GRAY = (128, 128, 128)


def _has_alpha(image: Image.Image) -> bool:
    return image.mode in ("RGBA", "LA", "PA") or (image.mode == "P" and "transparency" in image.info)


def erode_alpha(alpha_channel: Image.Image, pixels: int) -> Image.Image:
    if pixels <= 0:
        return alpha_channel
    return alpha_channel.filter(ImageFilter.MinFilter(pixels * 2 + 1))


def _prepare_model_image(image: Image.Image, content_size: int) -> Image.Image:
    if content_size > 0:
        scale = content_size / min(image.size)
        image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.LANCZOS)
    size = tuple(max(8, ((value + 7) // 8) * 8) for value in image.size)
    return image if image.size == size else image.resize(size, Image.LANCZOS)


@lru_cache(maxsize=1)
def _get_pipeline():
    import torch
    from diffusers import StableDiffusionXLImg2ImgPipeline

    config = get_config()
    dtype = torch.float16 if config["sdxl_device"] == "cuda" else torch.float32
    pipeline = StableDiffusionXLImg2ImgPipeline.from_pretrained(
        config["sdxl_model"], torch_dtype=dtype, use_safetensors=True
    )
    pipeline = pipeline.to(config["sdxl_device"])
    pipeline.set_progress_bar_config(disable=True)
    return pipeline


def _run_sdxl(content: Image.Image, style_prompt: str, strength: float | None,
              guidance_scale: float | None) -> Image.Image:
    if not style_prompt.strip():
        raise ValueError("style_prompt must not be empty")
    config = get_config()
    import torch

    generator = torch.Generator(device=config["sdxl_device"]).manual_seed(config["sdxl_seed"])
    return _get_pipeline()(
        prompt=style_prompt.strip(),
        image=content,
        strength=config["sdxl_strength"] if strength is None else strength,
        guidance_scale=config["sdxl_guidance_scale"] if guidance_scale is None else guidance_scale,
        num_inference_steps=config["sdxl_steps"],
        generator=generator,
    ).images[0].convert("RGB")


def style_transfer_image(content: Image.Image, style_prompt: str, alpha: float = 1.0,
                         content_size: int = 1024, alpha_erode: int = 0,
                         preserve_size: bool = False, strength: float | None = None,
                         guidance_scale: float | None = None) -> Image.Image:
    if not 0.0 <= alpha <= 1.0:
        raise ValueError(f"alpha must be between 0.0 and 1.0, got {alpha}")
    source_alpha = None
    original_size = content.size
    if _has_alpha(content):
        rgba = content.convert("RGBA")
        source_alpha = rgba.getchannel("A")
        content = Image.new("RGB", rgba.size, _BACKGROUND_GRAY)
        content.paste(rgba, mask=source_alpha)
    model_input = _prepare_model_image(content.convert("RGB"), content_size)
    if strength is not None and not 0.0 < strength <= 1.0:
        raise ValueError(f"strength must be between 0.0 and 1.0, got {strength}")
    if guidance_scale is not None and guidance_scale < 0.0:
        raise ValueError(f"guidance_scale must not be negative, got {guidance_scale}")
    result = _run_sdxl(model_input, style_prompt, strength, guidance_scale)
    if source_alpha is not None or preserve_size:
        result = result.resize(original_size, Image.LANCZOS)
    if source_alpha is None:
        return result
    result = result.convert("RGBA")
    result.putalpha(erode_alpha(source_alpha, alpha_erode))
    return result
