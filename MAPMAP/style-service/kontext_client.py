"""FLUX.1-Kontext image editing client."""

from __future__ import annotations

import os
import threading
from collections import OrderedDict
from dataclasses import dataclass, replace
from hashlib import sha256
from pathlib import Path

import torch
from huggingface_hub import get_token
from huggingface_hub.errors import GatedRepoError, HfHubHTTPError
from PIL import Image, ImageFilter

try:
    from diffusers import FluxKontextPipeline
except ImportError as exc:  # pragma: no cover - import-time guard
    FluxKontextPipeline = None  # type: ignore[assignment]
    _DIFFUSERS_IMPORT_ERROR = exc
else:
    _DIFFUSERS_IMPORT_ERROR = None


MODEL_ID = os.environ.get("FLUX_KONTEXT_MODEL_ID", "black-forest-labs/FLUX.1-Kontext-dev")
DEFAULT_LORA_PATH = (
    Path(__file__).resolve().parents[2]
    / "Flux-training"
    / "outputs"
    / "gdt_kontext_lora"
    / "gdt_kontext_lora.safetensors"
)

_PIPELINE: FluxKontextPipeline | None = None
_PIPELINE_LOCK = threading.Lock()
_INFERENCE_LOCK = threading.Lock()
_RESULT_CACHE: OrderedDict[str, Image.Image] = OrderedDict()
_RESULT_CACHE_LOCK = threading.Lock()
_RESULT_CACHE_LIMIT = 8
DEFAULT_SEED = 42
# Keep the combined prompt below the 77-token CLIP limit while preserving the
# training trigger and the style tail when concept text is too long.
_MAX_PROMPT_CHARS = 300


@dataclass(frozen=True)
class KontextConfig:
    model_id: str
    steps: int
    guidance_scale: float
    device: str
    dtype: str
    use_cpu_offload: bool
    quantize: bool
    lora_path: str
    lora_scale: float
    seed: int
    max_sequence_length: int


def _parse_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    value = value.strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    return default


def _resolve_dtype(name: str) -> torch.dtype:
    mapping = {
        "bfloat16": torch.bfloat16,
        "bf16": torch.bfloat16,
        "float16": torch.float16,
        "fp16": torch.float16,
        "float32": torch.float32,
        "fp32": torch.float32,
    }
    try:
        return mapping[name.strip().lower()]
    except KeyError as exc:
        raise ValueError(f"Unsupported FLUX_KONTEXT_DTYPE: {name}") from exc


def _validate_strength(value: float) -> float:
    if not 0.0 < value <= 1.0:
        raise ValueError(f"edit intensity must be between 0.0 and 1.0, got {value}")
    return float(value)


def _validate_lora_scale(value: float) -> float:
    if not 0.0 <= value <= 1.0:
        raise ValueError(f"LoRA scale must be between 0.0 and 1.0, got {value}")
    return float(value)


def get_kontext_config() -> KontextConfig:
    cuda_available = torch.cuda.is_available()
    device = os.environ.get("FLUX_KONTEXT_DEVICE", "cuda" if cuda_available else "cpu")
    if device not in {"cuda", "cpu"}:
        raise ValueError(f"Unsupported FLUX_KONTEXT_DEVICE: {device}")

    dtype = _resolve_dtype(os.environ.get("FLUX_KONTEXT_DTYPE", "bfloat16"))
    if device == "cpu":
        dtype = torch.float32
    steps = int(os.environ.get("FLUX_KONTEXT_STEPS", "24"))
    guidance_scale = float(os.environ.get("FLUX_KONTEXT_GUIDANCE", "2.5"))
    lora_scale = _validate_lora_scale(float(os.environ.get("FLUX_KONTEXT_LORA_SCALE", "1.0")))
    seed = int(os.environ.get("FLUX_KONTEXT_SEED", str(DEFAULT_SEED)))
    max_sequence_length = int(os.environ.get("FLUX_KONTEXT_MAX_SEQUENCE_LENGTH", "512"))
    use_cpu_offload = _parse_bool(
        os.environ.get("FLUX_KONTEXT_CPU_OFFLOAD"), default=device == "cuda"
    )
    quantize = _parse_bool(
        os.environ.get("FLUX_KONTEXT_QUANTIZE"), default=device == "cuda"
    )
    if device != "cuda":
        use_cpu_offload = False
        quantize = False
    if steps <= 0:
        raise ValueError(f"FLUX_KONTEXT_STEPS must be positive, got {steps}")
    if guidance_scale < 0.0:
        raise ValueError(f"FLUX_KONTEXT_GUIDANCE must not be negative, got {guidance_scale}")
    if max_sequence_length <= 0:
        raise ValueError(
            f"FLUX_KONTEXT_MAX_SEQUENCE_LENGTH must be positive, got {max_sequence_length}"
        )
    return KontextConfig(
        model_id=MODEL_ID,
        steps=steps,
        guidance_scale=guidance_scale,
        device=device,
        dtype={torch.bfloat16: "bfloat16", torch.float16: "float16", torch.float32: "float32"}[dtype],
        use_cpu_offload=use_cpu_offload,
        quantize=quantize,
        lora_path=os.environ.get("FLUX_KONTEXT_LORA_PATH", str(DEFAULT_LORA_PATH)),
        lora_scale=lora_scale,
        seed=seed,
        max_sequence_length=max_sequence_length,
    )


def _ensure_pipeline(config: KontextConfig) -> FluxKontextPipeline:
    global _PIPELINE
    if _PIPELINE is not None:
        return _PIPELINE
    if FluxKontextPipeline is None:
        raise RuntimeError(
            "diffusers is not installed. Install the style-service requirements first."
        ) from _DIFFUSERS_IMPORT_ERROR

    with _PIPELINE_LOCK:
        if _PIPELINE is not None:
            return _PIPELINE

        lora_path = Path(config.lora_path).expanduser()
        if not lora_path.is_file():
            raise FileNotFoundError(f"Kontext LoRA file does not exist: {lora_path}")
        if get_token() is None:
            raise RuntimeError(
                "Hugging Face authentication is required for FLUX.1-Kontext-dev. "
                "Run `huggingface-cli login` or set HF_TOKEN, then restart the service."
            )

        dtype = _resolve_dtype(config.dtype)
        try:
            if config.quantize:
                from diffusers import BitsAndBytesConfig as DiffusersBitsAndBytesConfig
                from diffusers import FluxTransformer2DModel
                from transformers import BitsAndBytesConfig as TransformersBitsAndBytesConfig
                from transformers import T5EncoderModel

                nf4 = {
                    "load_in_4bit": True,
                    "bnb_4bit_quant_type": "nf4",
                    "bnb_4bit_compute_dtype": dtype,
                }
                transformer = FluxTransformer2DModel.from_pretrained(
                    config.model_id,
                    subfolder="transformer",
                    quantization_config=DiffusersBitsAndBytesConfig(**nf4),
                    torch_dtype=dtype,
                )
                text_encoder_2 = T5EncoderModel.from_pretrained(
                    config.model_id,
                    subfolder="text_encoder_2",
                    quantization_config=TransformersBitsAndBytesConfig(**nf4),
                    torch_dtype=dtype,
                )
                pipeline = FluxKontextPipeline.from_pretrained(
                    config.model_id,
                    transformer=transformer,
                    text_encoder_2=text_encoder_2,
                    torch_dtype=dtype,
                )
            else:
                pipeline = FluxKontextPipeline.from_pretrained(config.model_id, torch_dtype=dtype)
        except (GatedRepoError, HfHubHTTPError) as exc:
            raise RuntimeError(
                "FLUX.1-Kontext-dev is gated on Hugging Face. Accept the model terms and "
                "sign in before starting the style service."
            ) from exc
        except ImportError as exc:
            raise RuntimeError(
                "A required Kontext runtime dependency is missing. Reinstall style-service requirements."
            ) from exc

        pipeline.load_lora_weights(str(lora_path), adapter_name="default")
        pipeline.set_progress_bar_config(disable=True)
        if config.use_cpu_offload:
            pipeline.enable_model_cpu_offload()
        else:
            pipeline = pipeline.to(config.device)
        _PIPELINE = pipeline
        return pipeline


def _build_prompt(prompt: str, strength: float, pixel_art: bool = True) -> str:
    text = " ".join(prompt.split())
    if not text:
        raise ValueError("Prompt must not be empty.")
    if text.casefold().startswith("gdtpix"):
        text = text[6:].lstrip(" ,")
    strength = _validate_strength(strength)
    if strength <= 0.33:
        intensity = "Subtle edit; preserve structure and layout."
    elif strength <= 0.66:
        intensity = "Balanced edit; preserve the main structure."
    else:
        intensity = "Strong edit; preserve the main structure."

    prefix = f"gdtpix, {intensity} "
    if pixel_art:
        prefix += "Crisp pixel art, hard grid edges, flat limited palette, no blur or anti-aliasing. "
    available = _MAX_PROMPT_CHARS - len(prefix)
    if len(text) > available:
        # Preserve the style tail when a prompt is too long. The training trigger and edit
        # instruction stay at the front, while concept text is removed first.
        text = "…" + text[-max(1, available - 1):].lstrip()
    return prefix + text


def _has_alpha(image: Image.Image) -> bool:
    return image.mode in ("RGBA", "LA", "PA") or (
        image.mode == "P" and "transparency" in image.info
    )


def erode_alpha(alpha_channel: Image.Image, pixels: int) -> Image.Image:
    if pixels <= 0:
        return alpha_channel
    return alpha_channel.filter(ImageFilter.MinFilter(pixels * 2 + 1))


def _restore_alpha(original: Image.Image, edited: Image.Image, alpha_erode: int = 0) -> Image.Image:
    if not _has_alpha(original):
        return edited

    original_alpha = original.convert("RGBA").getchannel("A")
    restored = edited.convert("RGBA")
    if restored.size != original_alpha.size:
        original_alpha = original_alpha.resize(restored.size, Image.Resampling.NEAREST)
    restored.putalpha(erode_alpha(original_alpha, alpha_erode))
    return restored


def _cache_key(
    content: Image.Image,
    prompt: str,
    strength: float,
    guidance_scale: float,
    seed: int,
    lora_scale: float,
    alpha_erode: int,
    config: KontextConfig,
) -> str:
    digest = sha256()
    digest.update(content.convert("RGBA").tobytes())
    digest.update(str(content.size).encode())
    digest.update(prompt.encode())
    digest.update(
        f"{strength}:{guidance_scale}:{seed}:{lora_scale}:{alpha_erode}:{config}".encode()
    )
    return digest.hexdigest()


def _cached_result(key: str) -> Image.Image | None:
    with _RESULT_CACHE_LOCK:
        image = _RESULT_CACHE.get(key)
        if image is None:
            return None
        _RESULT_CACHE.move_to_end(key)
        return image.copy()


def _store_cached_result(key: str, image: Image.Image) -> None:
    with _RESULT_CACHE_LOCK:
        _RESULT_CACHE[key] = image.copy()
        _RESULT_CACHE.move_to_end(key)
        while len(_RESULT_CACHE) > _RESULT_CACHE_LIMIT:
            _RESULT_CACHE.popitem(last=False)


def edit_image(
    content: Image.Image,
    prompt: str,
    *,
    strength: float = 0.5,
    config: KontextConfig | None = None,
    alpha_erode: int = 0,
    guidance_scale: float | None = None,
    seed: int | None = None,
    lora_scale: float | None = None,
) -> Image.Image:
    config = config or get_kontext_config()
    strength = _validate_strength(float(strength))
    guidance = config.guidance_scale if guidance_scale is None else float(guidance_scale)
    if guidance < 0.0:
        raise ValueError(f"guidance_scale must not be negative, got {guidance}")
    if not 0 <= alpha_erode <= 3:
        raise ValueError(f"alpha_erode must be between 0 and 3, got {alpha_erode}")
    effective_seed = config.seed if seed is None else int(seed)
    effective_lora_scale = config.lora_scale if lora_scale is None else _validate_lora_scale(float(lora_scale))
    if effective_lora_scale != config.lora_scale:
        config = replace(config, lora_scale=effective_lora_scale)
    key = _cache_key(
        content,
        prompt,
        strength,
        guidance,
        effective_seed,
        effective_lora_scale,
        alpha_erode,
        config,
    )
    cached = _cached_result(key)
    if cached is not None:
        return cached

    pipeline = _ensure_pipeline(config)
    source = content.convert("RGB")
    built_prompt = _build_prompt(prompt, strength)
    call_kwargs = {
        "image": source,
        "prompt": built_prompt,
        "width": source.width,
        "height": source.height,
        "max_area": source.width * source.height,
        "_auto_resize": False,
        "num_inference_steps": config.steps,
        "guidance_scale": guidance,
        "max_sequence_length": config.max_sequence_length,
        "generator": torch.Generator("cpu").manual_seed(effective_seed),
    }

    with _INFERENCE_LOCK:
        with torch.inference_mode():
            result = pipeline(
                **call_kwargs,
                joint_attention_kwargs={"scale": effective_lora_scale},
            )

    image = _restore_alpha(content, result.images[0], alpha_erode)
    _store_cached_result(key, image)
    return image


def get_runtime_status() -> dict[str, object]:
    config = get_kontext_config()
    cuda_available = torch.cuda.is_available()
    cuda_name = torch.cuda.get_device_name(0) if cuda_available else None
    return {
        "model_id": config.model_id,
        "device": config.device,
        "dtype": config.dtype,
        "steps": config.steps,
        "guidance_scale": config.guidance_scale,
        "lora_path": config.lora_path,
        "lora_scale": config.lora_scale,
        "seed": config.seed,
        "max_sequence_length": config.max_sequence_length,
        "use_cpu_offload": config.use_cpu_offload,
        "quantize": config.quantize,
        "cuda_available": cuda_available,
        "cuda_name": cuda_name,
        "loaded": _PIPELINE is not None,
        "lora_file_present": Path(config.lora_path).expanduser().is_file(),
        "hf_token_present": get_token() is not None,
    }
