import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi import HTTPException
from PIL import Image
import theme_pipeline as pipeline


class BrowserApprovalTests(unittest.TestCase):
    def test_approval_requires_complete_files_and_never_calls_shared_state(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            run_id = 'c' * 32
            folder = root / run_id
            folder.mkdir()
            pipeline.save_status(folder, {'status': 'ready', 'prompt': '크리스마스 눈'})
            manifest = {'source_hashes': {}, 'objects': [{'id': 'tree_1'}], 'placements': [
                {'imageUrl': f'/theme-runs/{run_id}/tree.png'}]}
            (folder / 'manifest.json').write_text(json.dumps(manifest), encoding='utf8')
            with patch.object(pipeline, 'ROOT', root), patch.object(pipeline, 'sources', return_value=(None, None, None, {})), patch.object(pipeline.requests, 'post') as post, patch.object(pipeline.requests, 'get') as get:
                with self.assertRaises(HTTPException):
                    pipeline.approve(run_id)
                Image.new('RGBA', (2, 2)).save(folder / 'tree.png')
                self.assertEqual(pipeline.approve(run_id)['targets'], ['tree_1'])
                self.assertEqual(pipeline.status(run_id)['prompt'], '크리스마스 눈')
                post.assert_not_called()
                get.assert_not_called()

    def test_approval_rejects_changed_sources(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            folder = root / ('d' * 32)
            folder.mkdir()
            pipeline.save_status(folder, {'status': 'ready'})
            (folder / 'manifest.json').write_text('{"source_hashes": {}}', encoding='utf8')
            with patch.object(pipeline, 'ROOT', root), patch.object(pipeline, 'sources', return_value=(None, None, None, {'changed': 'hash'})):
                with self.assertRaises(HTTPException):
                    pipeline.approve(folder.name)
