import unittest
import tempfile
import json
from pathlib import Path
from unittest.mock import patch
from fastapi import HTTPException
from theme_pipeline import approve
from theme_pipeline import sources,catalog
from town_vision_pipeline import shared_objects
from town_attached_materials import isolate

class MapCatalogTests(unittest.TestCase):
    def test_approval_checks_selected_map_and_still_rejects_changed_sources(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp)
            (folder/'status.json').write_text(json.dumps({'status':'ready','mapId':'harvest-village','pipeline':'town-vision-v1'}))
            (folder/'manifest.json').write_text(json.dumps({'source_hashes':{'harvest':'original'},'objects':[],'placements':[]}))
            with patch('theme_pipeline.get_folder',return_value=folder),patch('theme_pipeline.record_event'),patch('theme_pipeline.sources',return_value=(None,None,None,{'harvest':'original'})) as source:
                self.assertEqual(approve('a'*32)['mapId'],'harvest-village')
                source.assert_called_once_with('harvest-village')
                source.return_value=(None,None,None,{'harvest':'changed'})
                with self.assertRaises(HTTPException) as error:approve('a'*32)
                self.assertEqual(error.exception.status_code,409)

    def test_map_sources_are_distinct_and_unknown_rejected(self):
        self.assertNotEqual(sources('town')[3],sources('harvest-village')[3])
        with self.assertRaises(ValueError):sources('../town')

    def test_harvest_stamps_reuse_exact_pixels(self):
        objects=catalog('harvest-village')
        self.assertTrue(all(o['mapId']=='harvest-village' for o in objects))
        groups=shared_objects(objects)
        self.assertEqual(sum(len(o['instances']) for o in groups),len(objects))
        self.assertTrue(any(len(o['instances'])>1 for o in groups))
        self.assertTrue(any(o.get('complete_stamp') is False for o in groups))
        for obj in groups:self.assertEqual(isolate(obj).size,tuple(obj['box'][2:]))

if __name__=='__main__':unittest.main()
