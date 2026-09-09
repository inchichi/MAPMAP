"""Stable style-transfer contract backed by FLUX.1-Kontext."""

from __future__ import annotations

from PIL import Image

import kontext_client


def _has_alpha(image: Image.Image) -> bool:
    return kontext_client._has_alpha(image)


def erode_alpha(alpha_channel: Image.Image, pixels: int) -> Image.Image:
    return kontext_client.erode_alpha(alpha_channel, pixels)


def style_transfer_image(
    content: Image.Image,
    style_prompt: str,
    alpha: float = 1.0,
    content_size: int = 1024,
    alpha_erode: int = 0,
    preserve_size: bool = False,
    strength: float | None = None,
    guidance_scale: float | None = None,
) -> Image.Image:
    """Keep the SDXL service contract while mapping strength to edit intensity.

    Kontext receives the size prepared by the caller. ``content_size`` and
    ``preserve_size`` remain accepted for API compatibility but do not resize the
    input here.
    """
    if not 0.0 <= alpha <= 1.0:
        raise ValueError(f"alpha must be between 0.0 and 1.0, got {alpha}")
    if not 0 <= alpha_erode <= 3:
        raise ValueError(f"alpha_erode must be between 0 and 3, got {alpha_erode}")
    if strength is not None and not 0.0 < strength <= 1.0:
        raise ValueError(f"edit intensity must be between 0.0 and 1.0, got {strength}")
    if guidance_scale is not None and guidance_scale < 0.0:
        raise ValueError(f"guidance_scale must not be negative, got {guidance_scale}")
    del content_size, preserve_size
    return kontext_client.edit_image(
        content,
        style_prompt,
        strength=0.5 if strength is None else float(strength),
        alpha_erode=alpha_erode,
        guidance_scale=guidance_scale,
    )
