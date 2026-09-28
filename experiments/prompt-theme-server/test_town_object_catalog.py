import unittest
from theme_pipeline import catalog
from town_profiles import PARTS
from profile_decorations import get_profile
from town_attached_materials import isolate


class TownObjectCatalogTests(unittest.TestCase):
    def test_parent_fragments_are_not_standalone_objects(self):
        objects=catalog()
        self.assertEqual(len(objects),29)
        self.assertFalse(set(PARTS)&{obj['id'] for obj in objects})
        for obj in objects:
            with self.subTest(asset=obj['id']):
                self.assertEqual(get_profile(obj)['box'],obj['box'])
                source=isolate(obj)
                self.assertEqual(source.size,tuple(obj['box'][2:]))
                self.assertIsNotNone(source.getbbox())


if __name__=='__main__':unittest.main()
