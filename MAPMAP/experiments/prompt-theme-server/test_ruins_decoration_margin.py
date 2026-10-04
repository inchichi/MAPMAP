import unittest
import numpy as np
from PIL import Image, ImageDraw
from ruins_decoration_margin import extract


class MarginTests(unittest.TestCase):
    def test_source_unchanged_and_attached_snow_outside_alpha_survives(self):
        source=Image.new('RGBA',(16,16));ImageDraw.Draw(source).rectangle((3,3,12,12),fill=(220,110,35,255))
        raw=Image.new('RGB',(160,160),'#808080')
        scaled=source.resize((96,96),Image.Resampling.NEAREST);raw.paste(scaled,(32,32),scaled)
        ImageDraw.Draw(raw).rectangle((50,44,109,49),fill='white')
        ImageDraw.Draw(raw).rectangle((0,0,10,10),fill='white')
        base,deco,offset=extract(source,raw)
        self.assertEqual(offset,{'x':-3,'y':-3,'margin':3})
        self.assertEqual(base.crop((3,3,19,19)).tobytes(),source.tobytes())
        self.assertEqual(base.size,(22,22))
        self.assertGreater(np.count_nonzero((np.array(deco)[:,:,3]>0)&(np.array(base)[:,:,3]==0)),0)
        self.assertEqual(deco.getpixel((0,0))[3],0)

    def test_unchanged_input_does_not_produce_decorations(self):
        source=Image.new('RGBA',(16,16),(240,180,70,255))
        raw=Image.new('RGB',(160,160),'#808080');raw.paste(source.resize((96,96)),(32,32))
        _,deco,_=extract(source,raw)
        self.assertEqual(deco.getchannel('A').getbbox(),None)


if __name__=='__main__':unittest.main()
