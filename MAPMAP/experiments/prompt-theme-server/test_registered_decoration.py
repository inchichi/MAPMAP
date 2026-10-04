import unittest
import numpy as np
from PIL import Image, ImageDraw
from registered_decoration import extract_registered
from unittest.mock import patch
from registered_decoration import RegistrationError


class RegisteredDecorationTest(unittest.TestCase):
    def test_large_translation_remains_blocked_and_logged(self):
        source=Image.new('RGBA',(32,32),(170,90,40,255))
        raw=Image.new('RGB',(256,256),'#808080')
        warp=np.array([[1,0,0],[0,1,-34]],dtype=np.float32)
        with patch('registered_decoration.cv2.findTransformECC',return_value=(.99,warp)):
            with self.assertRaises(RegistrationError) as caught:
                extract_registered(source,raw)
        self.assertFalse(caught.exception.report['approved'])
        self.assertEqual(caught.exception.report['limits']['maximum_translation_native_pixels'],2)

    def test_identical_source_has_no_decoration_and_base_is_unchanged(self):
        source = Image.new('RGBA', (32,32))
        ImageDraw.Draw(source).rectangle((4,4,27,27), fill=(170,90,40,255))
        raw = Image.new('RGB',(256,256),'#808080')
        scaled = source.resize((192,192),Image.Resampling.NEAREST)
        raw.paste(scaled,(32,32),scaled)
        base,deco,placement,report = extract_registered(source,raw)
        self.assertIsNone(deco.getbbox())
        self.assertTrue(np.array_equal(np.array(base.crop((18,18,210,210))),np.array(scaled)))
        self.assertEqual(placement['display_width'],38)

    def test_new_interior_detail_survives(self):
        source = Image.new('RGBA',(32,32),(170,90,40,255))
        raw = Image.new('RGB',(256,256),'#808080')
        raw.paste(source.resize((192,192)),(32,32))
        ImageDraw.Draw(raw).ellipse((110,110,126,126),fill=(20,210,230))
        _,deco,_,report = extract_registered(source,raw)
        self.assertGreater(report['kept_pixels'],50)
        self.assertEqual(report['exterior_pixels'],0)


if __name__ == '__main__': unittest.main()
