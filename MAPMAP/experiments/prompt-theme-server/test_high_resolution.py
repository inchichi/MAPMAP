import unittest
from PIL import Image
from ruins_decoration_margin import extract

class HighResolutionTests(unittest.TestCase):
    def test_texture_and_world_dimensions_are_separate(self):
        source=Image.new('RGBA',(16,16),(40,50,60,255))
        base,deco,meta=extract(source,Image.new('RGB',(160,160),'purple'),generic=True,high_resolution=True)
        self.assertEqual(deco.size,(132,132))
        self.assertEqual(meta['display_width'],22)
        self.assertEqual(meta['x'],-3)
        self.assertEqual(base.crop((18,18,114,114)).tobytes(),source.resize((96,96),Image.Resampling.NEAREST).tobytes())
