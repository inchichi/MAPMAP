import unittest
import numpy as np
from PIL import Image
from profile_decorations import profiles,get_profile,profile_masks,extract_profile,grow
from theme_pipeline import catalog,layers


class ProfileTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        _,_,cls.objects,_=layers({'gain':[1,1,1],'bias':[0,0,0]})

    def test_registered_sources_match_tmx(self):
        configured=profiles()
        for obj in catalog():
            if obj['id'] in configured:self.assertEqual(get_profile(obj)['box'],obj['box'])

    def test_unknown_object_has_no_silent_fallback(self):
        with self.assertRaises(ValueError):get_profile({'id':'new_house','box':[0,0,96,96]})

    def test_changed_geometry_requires_review(self):
        with self.assertRaises(ValueError):get_profile({'id':'tree_1','box':[448,384,128,128]})

    def test_first_input_settings_preserved(self):
        p=profiles()
        self.assertEqual(p['town_hall']['strength'],1)
        self.assertEqual(p['town_hall']['canvas'],[512,480])
        self.assertEqual(p['tree_1']['canvas'],[320,320])
        self.assertEqual(p['tree_1']['scale'],2)
        self.assertEqual(p['tree_1']['strength'],.5)

    def test_regions_exclude_protection(self):
        for p in profiles().values():
            x,y,w,h=p['box'];original=self.objects.crop((x,y,x+w,y+h))
            regions,protected=profile_masks(original,p)
            self.assertTrue(regions['snow'].any())
            for region in regions.values():self.assertFalse((region&protected).any())

    def test_generated_pixels_are_found_at_new_locations(self):
        p=profiles()['tree_1'];x,y,w,h=p['box'];original=self.objects.crop((x,y,x+w,y+h))
        regions,_=profile_masks(original,p)
        positions=np.argwhere(regions['snow'])
        for y,x in [positions[len(positions)//3],positions[len(positions)*2//3]]:
            generated=original.convert('RGB');generated.putpixel((int(x),int(y)),(250,250,250))
            overlay,_,_,counts=extract_profile(original,generated,p,['snow'])
            self.assertGreater(counts['snow'],0)
            self.assertEqual(np.array(overlay)[y,x,3],255)

    def test_growth_does_not_jump_between_components(self):
        seed=np.zeros((10,10),bool);seed[1,1]=True
        candidate=np.zeros_like(seed);candidate[1:3,1:3]=True;candidate[7:,7:]=True
        result=grow(seed,candidate,32)
        self.assertEqual(int(result.sum()),4)

if __name__=='__main__':unittest.main()
