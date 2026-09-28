import unittest
import numpy as np
from PIL import Image
from sprite_tone import tone


class ToneTest(unittest.TestCase):
    def test_geometry_alpha_and_shading(self):
        src=Image.fromarray(np.array([[[30,30,30,255],[200,200,200,128],[1,2,3,0]]],dtype='uint8'))
        result,overlay=tone(src)
        self.assertEqual(result.size,src.size)
        self.assertEqual(list(result.getchannel('A').getdata()),[255,128,0])
        self.assertEqual(result.getpixel((2,0)),src.getpixel((2,0)))
        self.assertLess(result.getpixel((0,0))[0],result.getpixel((1,0))[0])
        self.assertLess(result.getpixel((1,0))[0],200)
        self.assertEqual(overlay.getpixel((2,0))[3],0)


if __name__=='__main__': unittest.main()
