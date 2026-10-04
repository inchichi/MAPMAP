import unittest
from dsl import parse
from planner import build


class PlanningTests(unittest.TestCase):
    def test_preserve_color_and_negations(self):
        d=parse('크리스마스 밤 원본 색 유지, 눈 없이 전구 반짝임 없이','floor-1-ruins')
        self.assertEqual(d['decorations'],['lights'])
        self.assertFalse(d['twinkle'])
        self.assertEqual(d['color']['gain'],[1,1,1])

    def test_color_only_has_no_model_decorations(self):
        d=parse('겨울 색과 명암 변경','floor-1-ruins')
        rows=build(d,{'mapId':'floor-1-ruins','variants':[{'id':'prop-01','kind':'prop','width':16,'height':16}],
                      'instances':[{'asset':'prop-01'},{'asset':'prop-01'}]})
        self.assertEqual(rows[0]['action'],'recolor')
        self.assertEqual(rows[0]['instances'],2)
        self.assertTrue(rows[0]['recolor_base'])
        self.assertIn('unknown',rows[0]['prompt'])

    def test_unsupported_requests_are_not_silently_accepted(self):
        for prompt in ['할로윈 호박','크리스마스 낮','크리스마스 가랜드','크리스마스 새 집','크리스마스 원본 색 유지']:
            with self.subTest(prompt=prompt),self.assertRaises(ValueError):parse(prompt,'floor-1-ruins')

    def test_target_map_checked(self):
        with self.assertRaises(ValueError):parse('겨울 눈','town')
        with self.assertRaises(ValueError):build(parse('겨울 눈','floor-1-ruins'),{'mapId':'town'})


if __name__=='__main__':unittest.main()
