import unittest
import numpy as np
from PIL import Image
from pixel_style import native_sprite,pixel_prompt


class PixelStyleTests(unittest.TestCase):
    def test_palette_and_alpha_are_bounded(self):
        a=np.random.default_rng(0).integers(0,256,(80,80,4),dtype=np.uint8)
        sprite,report=native_sprite(Image.fromarray(a),(32,32))
        self.assertEqual(sprite.size,(32,32))
        self.assertLessEqual(report['opaque_colors'],24)
        self.assertTrue(set(np.unique(np.array(sprite)[:,:,3]))<={0,255})

    def test_input_untouched_and_transparency_kept(self):
        source=Image.new('RGBA',(16,16),(120,70,30,0));before=source.tobytes()
        result,_=native_sprite(source)
        self.assertEqual(source.tobytes(),before)
        self.assertIsNone(result.getbbox())

    def test_policy_applies_to_every_prompt(self):
        self.assertIn('Do not use photorealism',pixel_prompt('Add a lantern.'))


if __name__=='__main__':unittest.main()
