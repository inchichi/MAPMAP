import unittest
import numpy as np
from PIL import Image, ImageDraw
from registered_decoration import extract_registered


class RegisteredDecorationTest(unittest.TestCase):
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
