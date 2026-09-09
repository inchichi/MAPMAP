from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

import kontext_client


class _FakePipeline:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def __call__(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(
            images=[Image.new("RGB", (kwargs["width"], kwargs["height"]), "white")]
        )


class KontextClientTest(unittest.TestCase):
    def setUp(self) -> None:
        kontext_client._RESULT_CACHE.clear()

    def test_defaults_are_fixed_for_baseline(self) -> None:
        with patch.dict(
            os.environ,
            {
                "FLUX_KONTEXT_STEPS": "",
                "FLUX_KONTEXT_SEED": "",
                "FLUX_KONTEXT_LORA_SCALE": "",
            },
            clear=False,
        ):
            os.environ.pop("FLUX_KONTEXT_STEPS")
            os.environ.pop("FLUX_KONTEXT_SEED")
            os.environ.pop("FLUX_KONTEXT_LORA_SCALE")
            config = kontext_client.get_kontext_config()
        self.assertEqual(config.steps, 24)
        self.assertEqual(config.seed, 42)
        self.assertEqual(config.lora_scale, 1.0)

    def test_edit_keeps_size_passes_seed_and_uses_lora_scale(self) -> None:
        fake = _FakePipeline()
        config = kontext_client.get_kontext_config()
        source = Image.new("RGBA", (32, 32), (10, 20, 30, 255))
        source.putpixel((0, 0), (10, 20, 30, 0))

        with patch.object(kontext_client, "_ensure_pipeline", return_value=fake):
            result = kontext_client.edit_image(
                source,
                "winter prop, pixel art",
                config=config,
                seed=99,
                lora_scale=0.0,
            )

        call = fake.calls[0]
        self.assertEqual(result.size, source.size)
        self.assertEqual((call["width"], call["height"]), source.size)
        self.assertEqual(call["max_area"], 32 * 32)
        self.assertFalse(call["_auto_resize"])
        self.assertEqual(call["num_inference_steps"], 24)
        self.assertEqual(call["generator"].initial_seed(), 99)
        self.assertEqual(call["joint_attention_kwargs"], {"scale": 0.0})
        self.assertTrue(call["prompt"].startswith("gdtpix, "))
        self.assertEqual(result.getpixel((0, 0))[3], 0)

    def test_long_prompt_preserves_trigger_and_style_tail(self) -> None:
        built = kontext_client._build_prompt(
            "long concept " * 100 + "pixel art, game asset, limited palette, clean edges",
            0.5,
        )
        self.assertLessEqual(len(built), 300)
        self.assertTrue(built.startswith("gdtpix, "))
        self.assertTrue(built.endswith("limited palette, clean edges"))

    def test_alpha_resize_uses_nearest_sampling(self) -> None:
        alpha = Image.new("L", (2, 2), 0)
        alpha.putpixel((0, 0), 255)
        original = Image.merge("RGBA", (alpha, alpha, alpha, alpha))
        restored = kontext_client._restore_alpha(
            original, Image.new("RGB", (4, 4), "white")
        )
        self.assertEqual(restored.getpixel((0, 0))[3], 255)
        self.assertEqual(restored.getpixel((3, 3))[3], 0)


if __name__ == "__main__":
    unittest.main()
