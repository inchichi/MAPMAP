import unittest
import json, tempfile
from pathlib import Path
from unittest.mock import patch
from fastapi import HTTPException
import theme_pipeline
import numpy as np
from PIL import Image
from theme_pipeline import parse_prompt, recolor, align, key_strip, catalog, layers
from object_decorations import object_kind, surface_masks, extract_attached

class ThemeTests(unittest.TestCase):
    def test_only_stall_uses_strips(self):
        self.assertEqual(object_kind({'id':'blacksmith_stall','category':'building'}),'stall')
        self.assertEqual(object_kind({'id':'town_hall','category':'building'}),'building')

    def test_roof_lights_follow_lower_edge_not_fixed_height(self):
        a=np.zeros((60,60,4),dtype='uint8')
        a[:]=[160,160,160,255]
        for x in range(60):a[:10+x//3,x]=[30,50,130,255]
        snow,lights=surface_masks(Image.fromarray(a),'building')
        self.assertTrue(lights[10,0]);self.assertTrue(lights[28,59])
        self.assertFalse(lights[40,30]);self.assertFalse(snow[50,30])

    def test_tree_extraction_excludes_trunk_and_transparency(self):
        original=Image.new('RGBA',(30,40),(0,0,0,0))
        original.paste((60,120,30,255),(3,2,27,25))
        original.paste((120,60,30,255),(12,25,18,40))
        overlay=extract_attached(original,Image.new('RGB',original.size,'white'),'tree',['snow'])
        a=np.array(overlay)
        self.assertTrue(a[10,10,3]);self.assertFalse(a[30,14,3]);self.assertFalse(a[0,0,3])

    def test_fountain_water_is_not_decoration(self):
        original=Image.new('RGBA',(60,60),(30,160,210,255))
        overlay=extract_attached(original,Image.new('RGB',original.size,'white'),'fountain',['snow'])
        self.assertFalse(np.array(overlay)[:,:,3].any())

    def test_unrequested_snow_is_not_extracted(self):
        original=Image.new('RGBA',(30,40),(60,120,30,255))
        overlay=extract_attached(original,Image.new('RGB',original.size,'white'),'tree',['lights'])
        self.assertFalse(np.array(overlay)[:,:,3].any())

    def test_complete_building_bulb_is_reanchored_to_eaves(self):
        original=Image.new('RGBA',(80,80),(160,160,160,255))
        original.paste((30,50,130,255),(0,0,80,20))
        generated=original.convert('RGB')
        generated.paste((255,170,20),(30,30,35,36))
        overlay=extract_attached(original,generated,'building',['lights'])
        alpha=np.array(overlay)[:,:,3]
        self.assertEqual(np.count_nonzero(alpha),90)
        self.assertFalse(alpha[30:].any())

    def test_stall_lights_follow_opaque_awning_bottom(self):
        original=Image.new('RGBA',(96,96))
        original.paste((200,170,120,255),(0,0,96,32))
        overlay=align(original,{'lights':Image.new('RGBA',(96,12),(255,180,20,255))})
        alpha=np.array(overlay)[:,:,3]
        self.assertTrue(alpha[31].any())
        self.assertFalse(alpha[32:].any())

    def test_windows_below_roof_are_not_eaves(self):
        original=Image.new('RGBA',(80,100),(160,160,160,255))
        original.paste((30,50,130,255),(0,0,80,20))
        original.paste((160,60,30,255),(20,50,30,60))
        snow,lights=surface_masks(original,'building')
        self.assertFalse(snow[50:60,20:30].any())
        self.assertFalse(lights[50:60,20:30].any())

    def test_stall_chooses_one_complete_strip(self):
        image=Image.new('RGB',(100,100),'magenta')
        image.paste((255,240,220),(10,10,90,20))
        image.paste((255,170,20),(10,70,90,85))
        self.assertEqual(key_strip(image,'snow').size,(80,10))
        self.assertEqual(key_strip(image,'lights').size,(80,15))

    def test_explicit_prompt(self):
        s=parse_prompt('크리스마스 밤 눈과 전구 반짝임')
        self.assertEqual(s['decorations'],['snow','lights'])
        self.assertTrue(s['night']); self.assertTrue(s['twinkle'])

    def test_negations(self):
        s=parse_prompt('크리스마스 낮, 눈 없이 전구는 제외, 원본 색 유지')
        self.assertFalse(s['night']);self.assertEqual(s['decorations'],[])
        self.assertEqual(s['color']['gain'],[1,1,1])

    def test_unknown_is_not_guessed(self):
        with self.assertRaises(ValueError):parse_prompt('사이버펑크 도시')

    def test_alpha_and_size_preserved(self):
        source=Image.new('RGBA',(13,17),(30,40,50,128))
        result=recolor(source,parse_prompt('가을')['color'])
        self.assertEqual(result.size,source.size)
        np.testing.assert_array_equal(np.array(source)[:,:,3],np.array(result)[:,:,3])

    def test_decorations_do_not_fill_holes(self):
        source=Image.new('RGBA',(32,32),(100,100,100,255))
        source.paste((0,0,0,0),(12,12,20,32))
        overlay=align(source,{'lights':Image.new('RGBA',(16,5),(255,200,0,255))})
        self.assertFalse(np.array(overlay)[12:32,12:20,3].any())

    def test_failed_chroma_key_is_rejected(self):
        with self.assertRaises(ValueError):key_strip(Image.new('RGB',(64,64),'white'))
        with self.assertRaises(ValueError):key_strip(Image.new('RGB',(64,64),'magenta'))

    def test_tmx_extraction(self):
        self.assertIn('tree_1',{o['id'] for o in catalog()})
        original,tinted,objects,hashes=layers({'gain':[1,1,1],'bias':[0,0,0]})
        self.assertEqual(original.size,(1600,1600))
        np.testing.assert_array_equal(np.array(original),np.array(tinted))
        self.assertEqual(len(hashes),3)

    def test_apply_requires_ready_result(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);folder=root/('a'*32);folder.mkdir()
            (folder/'status.json').write_text(json.dumps({'status':'failed'}))
            with patch.object(theme_pipeline,'ROOT',root), patch.object(theme_pipeline.requests,'post') as post:
                with self.assertRaises(HTTPException) as error:theme_pipeline.apply('a'*32)
                self.assertEqual(error.exception.status_code,409)
                post.assert_not_called()

    def test_apply_rejects_changed_source(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);folder=root/('b'*32);folder.mkdir()
            (folder/'status.json').write_text(json.dumps({'status':'ready'}))
            (folder/'manifest.json').write_text(json.dumps({'source_hashes':{}}))
            with patch.object(theme_pipeline,'ROOT',root), patch.object(theme_pipeline.requests,'post') as post:
                with self.assertRaises(HTTPException) as error:theme_pipeline.apply('b'*32)
                self.assertEqual(error.exception.status_code,409)
                post.assert_not_called()

if __name__=='__main__':unittest.main()
