import unittest
import numpy as np
from theme_pipeline import catalog
from profile_decorations import profiles
from town_attached_materials import isolate

class TownMaterialsTests(unittest.TestCase):
    def test_every_target_has_fixed_size_nonempty_source(self):
        objects=[o for o in catalog() if o['id'] in profiles()]
        self.assertEqual(len(objects),29)
        for o in objects:
            image=isolate(o)
            self.assertEqual(list(image.size),o['box'][2:])
            self.assertIsNotNone(image.getbbox(),o['id'])

    def test_building_excludes_fountains_but_keeps_door(self):
        obj=next(o for o in catalog() if o['id']=='town_hall');a=np.array(isolate(obj))
        self.assertEqual(int(a[420,64,3]),0)
        self.assertGreater(int(a[440,240,3]),0)

    def test_tree_excludes_house_wall(self):
        obj=next(o for o in catalog() if o['id']=='tree_2');a=np.array(isolate(obj))
        self.assertEqual(int(a[0,0,3]),0)

if __name__=='__main__':unittest.main()
