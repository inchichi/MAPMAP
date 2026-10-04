import json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
import theme_pipeline
from run_records import record_event, review_html
from reuse_town_decorations import flower_basket_positions
from town_attached_materials import isolate


class RunRecordsTests(unittest.TestCase):
    def test_all_baskets_include_unregistered_right_side(self):
        positions=flower_basket_positions()
        self.assertEqual(len(positions),13)
        self.assertIn((896,416),positions)
        self.assertIn((896,448),positions)

    def test_tree_mislabeled_canopy_is_not_missing(self):
        objects={o['id']:o for o in theme_pipeline.catalog()}
        trees=[isolate(objects[n]) for n in ['tree_1','tree_2','tree_3']]
        self.assertEqual(trees[0].tobytes(),trees[1].tobytes())
        self.assertEqual(trees[1].tobytes(),trees[2].tobytes())
        self.assertIsNotNone(trees[1].crop((0,64,32,96)).getbbox())

    def test_logs_append_and_review_exposes_apply_module(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp)
            record_event(folder,'one');record_event(folder,'two')
            self.assertEqual([json.loads(s)['event'] for s in (folder/'events.jsonl').read_text().splitlines()],['one','two'])
            self.assertIn('themeResultPage.ts',review_html(folder))

    def test_wrong_browser_receipt_is_not_logged(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp);(folder/'manifest.json').write_text(json.dumps({'placements':[{'id':'expected'}]}))
            with patch.object(theme_pipeline,'get_folder',return_value=folder):
                with self.assertRaises(theme_pipeline.HTTPException):
                    theme_pipeline.applied('a'*32,theme_pipeline.AppliedReceipt(placement_ids=['wrong']))
            self.assertFalse((folder/'events.jsonl').exists())

    def test_status_retries_sharing_violation(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp)
            with patch.object(Path,'replace',side_effect=[PermissionError(),None]) as replace, patch.object(theme_pipeline.time,'sleep'):
                theme_pipeline.save_status(folder,{'status':'ready'})
            self.assertEqual(replace.call_count,2)


if __name__=='__main__':unittest.main()
