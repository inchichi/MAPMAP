import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from theme_pipeline import catalog
from town_profiles import PARTS
from profile_decorations import get_profile
from town_attached_materials import isolate


class TownObjectCatalogTests(unittest.TestCase):
    def test_parent_fragments_are_not_standalone_objects(self):
        objects=catalog()
        self.assertEqual(len(objects),35)
        self.assertFalse(set(PARTS)&{obj['id'] for obj in objects})
        for obj in objects:
            with self.subTest(asset=obj['id']):
                self.assertEqual(get_profile(obj)['box'],obj['box'])
                source=isolate(obj)
                self.assertEqual(source.size,tuple(obj['box'][2:]))
                self.assertIsNotNone(source.getbbox())

    def test_identical_instances_share_one_generation_source(self):
        from town_vision_pipeline import shared_objects
        groups=shared_objects(catalog())
        ids=[i['id'] for group in groups for i in group['instances']]
        self.assertEqual(len(ids),len(set(ids)))
        self.assertEqual(set(ids),{o['id'] for o in catalog()})
        pots=next(g for g in groups if any(i['id']=='prop_2' for i in g['instances']))
        self.assertEqual(pots['box'][2:],[32,32])
        self.assertTrue({'prop_2','prop_2_2','prop_2_3','prop_4','prop_5'}.issubset({i['id'] for i in pots['instances']}))
        self.assertLess(len(groups),len(catalog()))

    def test_one_generation_is_composited_at_all_instance_coordinates(self):
        from town_vision_pipeline import shared_objects,run,save,read
        from theme_pipeline import sources
        pot=next(g for g in shared_objects(catalog()) if g['id']=='prop_2')
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);folder=root/'test';folder.mkdir()
            save(folder,'status.json',{'id':'test'})
            save(folder,'dsl.json',{'palette':['#000000','#888888','#ffffff'],'recolor_strength':0,'brightness':1,'night':False,'twinkle':False,'decorations':['snow']})
            save(folder,'plan.json',[{'asset':'prop_2','action':'decorate','prompt':'test'}])
            save(folder,'objects.json',[pot]);save(folder,'source-hashes.json',sources()[3])
            Image.new('RGBA',(1600,1600)).save(folder/'original-map.png')
            source=isolate(pot);source.save(folder/'prop_2-original.png')
            overlay=Image.new('RGBA',source.size,'white');overlay.putalpha(source.getchannel('A'))
            with patch('theme_pipeline.ROOT',root),patch('object_decorations.request_image',return_value=source.convert('RGB')) as generate,patch('profile_decorations.extract_profile',return_value=(overlay,None,None,{})):
                run('test')
            self.assertEqual(generate.call_count,1)
            self.assertEqual(read(folder,'validation.json')['failed_objects'],[])
            result=Image.open(folder/'decoration-map.png')
            for instance in pot['instances']:
                x,y,w,h=instance['box']
                expected=Image.alpha_composite(Image.new('RGBA',source.size),overlay)
                self.assertEqual(result.crop((x,y,x+w,y+h)).tobytes(),expected.tobytes())


if __name__=='__main__':unittest.main()
