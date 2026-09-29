import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch
import numpy as np
from PIL import Image
from pydantic import ValidationError
from town_vision_pipeline import palette_color,Recognition,Direction,accept,save,run,PIPELINE


class TownVisionTests(unittest.TestCase):
    def test_palette_changes_hue_without_changing_geometry_or_alpha(self):
        source=Image.new('RGBA',(3,2),(160,120,80,173))
        direction={'palette':['#161c42','#62548b','#c6b7df'],'recolor_strength':.5,'brightness':.9}
        output=palette_color(source,direction)
        before=np.array(source);after=np.array(output)
        self.assertEqual(source.size,output.size)
        np.testing.assert_array_equal(before[:,:,3],after[:,:,3])
        self.assertNotAlmostEqual(after[0,0,0]/after[0,0,2],160/80,places=1)

    def test_ground_sprite_survives_outside_host_without_changing_host_alpha(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);folder=root/'trial';folder.mkdir()
            source=Image.new('RGBA',(32,32),(100,80,60,127))
            source.save(folder/'host-original.png')
            source.save(folder/'ground-style-reference.png')
            Image.new('RGBA',(128,128),'white').save(folder/'original-map.png')
            save(folder,'status.json',{'id':'trial','status':'queued'})
            save(folder,'dsl.json',{'palette':['#000000','#808080','#ffffff'],'recolor_strength':0,
                'brightness':1,'night':False,'twinkle':False,'decorations':[]})
            save(folder,'plan.json',[{'asset':'host','action':'decorate','document_plan':{},
                'decoration_route':{'placement':'ground','items':['Add one box.']}}])
            save(folder,'objects.json',[{'id':'host','box':[0,0,32,32],
                'instances':[{'id':'host','box':[0,0,32,32]}]}])
            save(folder,'source-hashes.json',{'source':'unchanged'})
            anchor={'building':'host','x':80,'y':80,'width':32,'height':32}
            def generated(*args):
                asset=folder/'ground-assets'/'box';asset.mkdir(parents=True)
                sprite=Image.new('RGBA',(32,32),'orange');sprite.save(asset/'sprite.png')
                return sprite,'box'
            with patch('theme_pipeline.ROOT',root),patch('theme_pipeline.sources',return_value=(None,None,None,{'source':'unchanged'})),\
                 patch('placement_evaluation.ground_placements',return_value={'placements':[anchor]}),\
                 patch('decoration_routes.generate_ground',side_effect=generated):
                run('trial')
            colors=Image.open(folder/'recolor-map.png')
            decorations=Image.open(folder/'decoration-map.png')
            self.assertEqual(colors.getpixel((0,0))[3],127)
            self.assertEqual(colors.getpixel((80,80))[3],0)
            self.assertEqual(decorations.getpixel((80,80))[3],255)
            self.assertEqual(Image.open(folder/'host-original.png').tobytes(),source.tobytes())

    def test_empty_unused_palette_has_no_visual_effect(self):
        fields=dict(theme='night',palette=[],recolor_strength=0,brightness=.8,night=True,twinkle=False,decorations=[])
        direction=Direction.model_validate(fields).model_dump()
        source=Image.new('RGBA',(2,2),(120,80,40,255))
        self.assertEqual(palette_color(source,direction).getpixel((0,0)),(96,64,32,255))
        with self.assertRaises(ValidationError):Direction.model_validate(dict(fields,recolor_strength=.3))

    def test_palette_preserves_alpha_and_dimensions(self):
        a=np.array([[[200,70,20,255],[30,200,80,127],[0,0,0,0]]],dtype='uint8')
        result=palette_color(Image.fromarray(a),{'palette':['#151533','#663399','#c0a0ff'],'recolor_strength':.5,'brightness':.8})
        self.assertEqual(result.size,(3,1))
        np.testing.assert_array_equal(np.array(result)[:,:,3],a[:,:,3])
        self.assertFalse(np.array_equal(np.array(result)[:,:,:3],a[:,:,:3]))

    def test_invalid_kind_and_strength_rejected(self):
        with self.assertRaises(ValidationError):Recognition(kind='invented',label='test',features=[],composition='single')
        with self.assertRaises(ValidationError):Direction(theme='x',palette=['#000000']*3,recolor_strength=2,brightness=1,night=False,twinkle=False,decorations=[])

    def test_visual_accept_rejects_failed_objects(self):
        with tempfile.TemporaryDirectory() as temp:
            folder=Path(temp)
            save(folder,'status.json',{'pipeline':PIPELINE,'status':'review_required'})
            save(folder,'validation.json',{'failed_objects':['tree: extraction failed']})
            with self.assertRaisesRegex(ValueError,'Failed objects'):accept(folder)

    def test_visual_accept_rejects_stale_sources(self):
        with tempfile.TemporaryDirectory() as temp:
            folder=Path(temp)
            save(folder,'status.json',{'pipeline':PIPELINE,'status':'review_required'})
            save(folder,'validation.json',{'failed_objects':[]})
            save(folder,'source-hashes.json',{'tmx':'old'})
            with patch('theme_pipeline.sources',return_value=(None,None,None,{'tmx':'new'})):
                with self.assertRaisesRegex(ValueError,'Source changed'):accept(folder)


if __name__=='__main__':unittest.main()
