import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from map_color_coverage import build, render_atlas


class CoverageTests(unittest.TestCase):
    def test_all_tiles_and_fragment_share_color_without_changing_alpha(self):
        m=ET.fromstring('<map width="3" height="1" tilewidth="1" tileheight="1"><tileset firstgid="1"/><layer><data>1,2,3</data></layer></map>')
        ts=ET.fromstring('<tileset columns="3" tilewidth="1" tileheight="1"/>')
        atlas=Image.new('RGBA',(3,1));atlas.putdata([(10,100,30,255),(20,40,150,255),(40,120,20,128)])
        direction={'palette':['#101020','#405070','#708090'],'recolor_strength':.5,'brightness':.8}
        tree=dict(direction,palette=['#301010','#905020','#cc9030'])
        rows=[{'kind':'tree','asset':'whole','document_plan':{'color':tree,'evidence':['p1'],'evidence_audit':{'supported':True}}}]
        objects=[{'category':'tree','tile_gids':[3],'complete_stamp':False}]
        with tempfile.TemporaryDirectory() as tmp, patch('theme_pipeline.sources',return_value=(m,ts,atlas,{})):
            _,_,report=build(Path(tmp),'example',direction,rows,objects)
            result=Image.open(Path(tmp)/'themed-atlas.png')
            self.assertEqual(result.getchannel('A').tobytes(),atlas.getchannel('A').tobytes())
            self.assertTrue(all(a[:3]!=b[:3] for a,b in zip(atlas.getdata(),result.getdata())))
            self.assertEqual(report['covered_tiles'],3)
            self.assertEqual(report['category_tiles']['tree'],[3])

    def test_out_of_range_tile_fails_instead_of_claiming_coverage(self):
        m=ET.fromstring('<map width="1" height="1" tilewidth="1" tileheight="1"><tileset firstgid="1"/><layer><data>2</data></layer></map>')
        ts=ET.fromstring('<tileset columns="1"/>')
        with self.assertRaises(ValueError):render_atlas(m,ts,Image.new('RGBA',(1,1)))

if __name__=='__main__':unittest.main()
