import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch
import numpy as np
from PIL import Image
from pydantic import ValidationError
from town_vision_pipeline import palette_color,Recognition,Direction,accept,save,PIPELINE


class TownVisionTests(unittest.TestCase):
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
