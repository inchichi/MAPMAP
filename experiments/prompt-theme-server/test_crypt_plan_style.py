import json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from fastapi import HTTPException
import crypt_plan_style as pipeline
import theme_pipeline
from contracts import check_folder


class CryptPlanTests(unittest.TestCase):
    def test_revision_uses_ruins_coordinates_and_preserves_unselected_overlay(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(pipeline, 'ROOT', Path(tmp)):
            parent = Path(tmp)/('a'*32); parent.mkdir()
            Image.new('RGBA', (8,4), (20,30,40,255)).save(parent/'original-map.png')
            Image.new('RGBA', (8,4), (90,80,70,255)).save(parent/'decoration-map.png')
            Image.new('RGBA', (2,2), (50,60,70,255)).save(parent/'prop-00-original.png')
            manifest = {'id': parent.name, 'mapId': 'floor-1-ruins', 'width': 8, 'height': 4, 'night': .36,
                        'source_hashes': {}, 'bulbs': [[7,3]], 'instances': 1, 'overlay': f'/theme-runs/{parent.name}/decoration-map.png'}
            spec = {'mapId': 'floor-1-ruins', 'hashes': {}, 'tile_size': 16,
                    'variants': [{'id':'prop-00', 'kind':'prop', 'width':2, 'height':2}],
                    'instances': [{'asset':'prop-00', 'x':2, 'y':1}]}
            (parent/'crypt-manifest.json').write_text(json.dumps(manifest))
            dsl = {'parser':'manual', 'theme':'christmas', 'night':True, 'decorations':[], 'target_maps':['floor-1-ruins']}
            plan = [{'asset':'prop-00', 'kind':'prop', 'action':'recolor'}]
            with patch.object(pipeline, 'baseline', return_value=(parent, manifest, spec)):
                run_id = pipeline.prepare_data(dsl, plan)
                with self.assertRaises(ValueError): pipeline.prepare_data(dict(dsl, target_maps=['town']), plan)
                with self.assertRaises(ValueError): pipeline.prepare_data(dsl, [dict(plan[0], asset='roof_blue_large')])
            pipeline.run(run_id)
            folder = Path(tmp)/run_id
            result = Image.open(folder/'decoration-map.png')
            self.assertEqual(result.size, (8,4))
            self.assertEqual(result.getpixel((7,3)), (90,80,70,255))
            self.assertEqual(result.getpixel((2,1)), (45,54,63,255))
            self.assertEqual(Image.open(parent/'decoration-map.png').getpixel((2,1)), (90,80,70,255))
            self.assertEqual(len(check_folder(folder)), 6)
            self.assertFalse(any(check_folder(folder).values()))
            self.assertEqual(json.loads((folder/'status.json').read_text())['mapId'], 'floor-1-ruins')

    def test_api_rejects_cross_map_contract_before_starting_worker(self):
        req = theme_pipeline.IntegrationRequest(mapId='floor-1-ruins', dsl={'target_maps':['town']},
                                                plan=[{'asset':'roof_blue_large'}])
        with self.assertRaises(HTTPException) as error: theme_pipeline.integration_submit(req)
        self.assertEqual(error.exception.status_code, 422)


if __name__ == '__main__': unittest.main()
