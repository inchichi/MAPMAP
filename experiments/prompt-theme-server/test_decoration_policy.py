import unittest
from decoration_policy import plan_extraction


class PolicyTest(unittest.TestCase):
    def test_types_not_theme_choose_materials(self):
        p=plan_extraction('우주 정거장에 눈과 전구')
        self.assertEqual(p['method'],'material-mask')
        self.assertEqual(p['materials'],['snow','lights'])
        self.assertTrue(p['requires_review'])

    def test_halloween_does_not_claim_semantic_extraction(self):
        p=plan_extraction('할로윈 밤')
        self.assertEqual([i['type'] for i in p['items']],['pumpkin','web'])
        self.assertEqual(p['method'],'review-only-difference')

    def test_negative_and_unknown_require_review(self):
        for text in ['snow without lights','눈 없이 전구','우주풍']:
            self.assertEqual(plan_extraction(text)['method'],'review-only-difference')


if __name__=='__main__':unittest.main()
