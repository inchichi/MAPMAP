import unittest
import numpy as np
from PIL import Image,ImageDraw
from ground_prop_pilot import extract_sprite


class GroundPropTests(unittest.TestCase):
    def test_isolated_sprite_gets_native_grid(self):
        raw=Image.new('RGB',(256,256),'#808080')
        ImageDraw.Draw(raw).ellipse((64,64,190,190),fill='#dc7811')
        sprite,report=extract_sprite(raw)
        self.assertEqual(sprite.size,(32,32))
        self.assertLessEqual(report['opaque_colors'],24)
        self.assertEqual(sprite.getbbox()[3],30)
        self.assertTrue(set(np.unique(np.array(sprite)[:,:,3]))<={0,255})

    def test_changed_ground_background_is_rejected(self):
        raw=Image.new('RGB',(256,256),'#808080')
        ImageDraw.Draw(raw).rectangle((0,128,255,255),fill='green')
        with self.assertRaisesRegex(ValueError,'Background'):extract_sprite(raw)

    def test_multiple_objects_are_rejected(self):
        raw=Image.new('RGB',(256,256),'#808080');draw=ImageDraw.Draw(raw)
        draw.rectangle((40,80,90,140),fill='orange');draw.rectangle((160,80,220,140),fill='orange')
        with self.assertRaisesRegex(ValueError,'Multiple'):extract_sprite(raw)


if __name__=='__main__':unittest.main()
