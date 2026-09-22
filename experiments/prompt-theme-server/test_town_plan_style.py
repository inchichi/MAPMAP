import json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
import numpy as np
from PIL import Image
import groups_tsx
import town_plan_style
from contracts import check_folder
from run_changes import changes

SAMPLE = town_plan_style.REPO/'contracts/samples/town'
TILESET = town_plan_style.REPO/'src/games/my-sample-rpg/assets/tilesets/town-32.png'


def fake_edit(folder, canvas, prompt, flux, alpha, pipeline=None):
    """Stands in for the model: white snow on each column's top pixels and a few yellow bulbs."""
    pixels = np.array(canvas).copy()
    gray = np.abs(pixels.astype(int)-128).max(2) < 6
    for x in range(pixels.shape[1]):
        ys = np.flatnonzero(~gray[:, x])
        if len(ys): pixels[ys[0]:ys[0]+6, x] = [245, 248, 255]
    Image.fromarray(pixels).save(folder/'flux-raw.png')
    return Image.fromarray(pixels)


class GroupTests(unittest.TestCase):
    def test_position_suffixes_are_stripped(self):
        self.assertEqual(groups_tsx.group_id('roof_blue_large_upper_03'), 'roof_blue_large')
        self.assertEqual(groups_tsx.group_id('fountain_large_top_left'), 'fountain_large')
        self.assertEqual(groups_tsx.group_id('planter_tree_canopy'), 'planter_tree_canopy')
        self.assertEqual(groups_tsx.kind_of('market_canopy_peak'), ('stall', 1.0))
        self.assertEqual(groups_tsx.kind_of('clocktower_face')[1], 0.5)


@unittest.skipUnless(TILESET.read_bytes()[:4] == b'\x89PNG', 'town tileset is a Git LFS pointer here')
class TownSliceTests(unittest.TestCase):
    def test_plan_runs_end_to_end_with_a_fake_edit(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(town_plan_style, 'ROOT', Path(tmp)), \
                patch.object(town_plan_style, 'request_image', fake_edit):
            run_id = town_plan_style.prepare(SAMPLE/'dsl.json', SAMPLE/'plan.json')
            town_plan_style.run(run_id)
            folder = Path(tmp)/run_id
            status = json.loads((folder/'status.json').read_text(encoding='utf8'))
            validation = json.loads((folder/'validation.json').read_text(encoding='utf8'))
            manifest = json.loads((folder/'manifest.json').read_text(encoding='utf8'))
            self.assertEqual(status['status'], 'ready')
            self.assertTrue(validation['source_hashes_unchanged'] and validation['alpha_preserved'])
            self.assertEqual(validation['out_of_bounds_pixels'], 0)
            self.assertEqual([p['sourceAssetId'] for p in manifest['placements']], ['settings', 'recolor-map', 'decoration-map'])
            self.assertFalse(any(check_folder(folder).values()))
            self.assertEqual(changes(folder)['counts']['decorate'], 2)
            self.assertFalse((Path(tmp)/'.batch.lock').exists())


if __name__ == '__main__':
    unittest.main()
