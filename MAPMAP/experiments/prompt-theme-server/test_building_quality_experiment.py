import unittest
import numpy as np
from PIL import Image
from building_quality_experiment import extract_snow, place_wire, night_composite


class BuildingQualityTests(unittest.TestCase):
    def test_connected_gray_shading_is_preserved(self):
        original=Image.new('RGBA',(20,20),(30,50,130,255))
        generated=original.convert('RGB')
        generated.paste((230,235,245),(5,5,10,10))
        generated.paste((120,135,150),(10,5,13,10))
        overlay,hard,seed,mask=extract_snow(original,generated,np.ones((20,20),bool))
        self.assertTrue(mask[7,11]);self.assertFalse(seed[7,11])
        self.assertGreater(np.count_nonzero(np.array(overlay)[:,:,3]),np.count_nonzero(np.array(hard)[:,:,3]))

    def test_snow_cannot_enter_protected_facade(self):
        original=Image.new('RGBA',(20,20),(30,50,130,255))
        allowed=np.zeros((20,20),bool);allowed[:10]=True
        _,_,_,mask=extract_snow(original,Image.new('RGB',(20,20),'white'),allowed)
        self.assertFalse(mask[10:].any())

    def test_disconnected_gray_is_not_snow(self):
        original=Image.new('RGBA',(20,20),(30,50,130,255))
        generated=original.convert('RGB');generated.paste((140,150,160),(0,0,3,3))
        _,_,_,mask=extract_snow(original,generated,np.ones((20,20),bool))
        self.assertFalse(mask.any())

    def test_wire_dark_pixels_survive_placement(self):
        wire=Image.new('RGBA',(8,4),(20,20,20,255));wire.putpixel((4,3),(255,180,20,255))
        placed=np.array(place_wire(wire,(32,32),[[(2,5),(20,14)]]))
        self.assertTrue(((placed[:,:,0]==20)&(placed[:,:,3]>0)).any())

    def test_night_dims_wire_but_preserves_emission(self):
        day=Image.new('RGBA',(10,10),(200,200,200,255))
        light=Image.new('RGBA',(10,10));light.putpixel((5,5),(255,180,20,255))
        night=np.array(night_composite(day,light))
        self.assertLess(night[0,0,0],200)
        self.assertEqual(night[5,5,0],255)

if __name__=='__main__':unittest.main()
