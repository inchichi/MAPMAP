import unittest
from PIL import Image
from dsl_general import parse
from planner import build
from ruins_decoration_margin import extract


class GeneralThemeTests(unittest.TestCase):
    def test_theme_text_is_forwarded_without_christmas_additions(self):
        sources={'mapId':'floor-1-ruins','variants':[{'id':'prop-00','kind':'prop','width':16,'height':16}],
                 'instances':[{'asset':'prop-00'}]}
        for text in ['할로윈 호박과 거미줄','가을 낙엽','심해 산호와 푸른 장식']:
            dsl=parse(text,sources['mapId'])
            prompt=build(dsl,sources)[0]['prompt']
            self.assertIn(text,prompt)
            self.assertNotIn('snow',prompt)
            self.assertEqual(dsl['color']['gain'],[1,1,1])

    def test_difference_accepts_purple_not_only_snow(self):
        source=Image.new('RGBA',(16,16),(60,60,60,255))
        raw=Image.new('RGB',(160,160),'#808080')
        raw.paste((60,60,60),(32,32,128,128))
        raw.paste((160,20,180),(44,44,56,56))
        base,deco,offset=extract(source,raw,generic=True)
        self.assertIsNotNone(deco.getbbox())
        self.assertEqual(base.crop((3,3,19,19)).tobytes(),source.tobytes())
        self.assertEqual(offset['x'],-3)
