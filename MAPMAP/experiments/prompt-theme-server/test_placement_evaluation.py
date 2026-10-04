import unittest
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from placement_evaluation import reachable,ground_placements,load_constraints,wall_anchors


class PlacementTests(unittest.TestCase):
    def test_connectivity_detects_narrow_corridor(self):
        blocked=np.ones((3,5),bool);blocked[1,:]=False
        self.assertEqual(len(reachable(blocked,(0,1))),5)
        blocked[1,2]=True
        self.assertEqual(len(reachable(blocked,(0,1))),2)

    def test_real_map_protects_npcs_and_connectivity(self):
        repo=Path(__file__).resolve().parents[2]
        path=repo/'src/games/my-sample-rpg/assets/maps/town.tmx'
        report=ground_placements(path);_,_,blocked,reserved,_,_=load_constraints(path)
        self.assertTrue(report['placements'])
        for p in report['placements']:
            self.assertFalse(blocked[p['row'],p['col']]);self.assertFalse(reserved[p['row'],p['col']])
        self.assertEqual(report['final_reachable_tiles'],report['baseline_reachable_tiles']-len(report['placements']))

    def test_wall_anchor_avoids_colored_window(self):
        source=Image.new('RGBA',(160,200),'#bbbbbb')
        ImageDraw.Draw(source).rectangle((0,100,60,150),fill='blue')
        points=wall_anchors(source)
        self.assertTrue(points)
        self.assertTrue(all(p['x']>60 or p['y']>150 for p in points))


if __name__=='__main__':unittest.main()
