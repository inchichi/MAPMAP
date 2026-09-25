import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('restore_ruins', Path(__file__).with_name('restore-crypt-ruins.py'))
restore_ruins = importlib.util.module_from_spec(spec)
spec.loader.exec_module(restore_ruins)
REPO = Path(__file__).resolve().parents[1]


class RestoreRuinsTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.repo = Path(self.temporary.name)
        for name in restore_ruins.SOURCES:
            target = self.repo / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(REPO / name, target)
            if target.suffix in {'.tmx', '.tsx'}:
                target.write_bytes(target.read_bytes().replace(b'\r\n', b'\n'))
        self.archive = REPO / restore_ruins.ARCHIVE

    def test_real_archive_restore_apply_repeat_and_conflict(self):
        state = self.repo / 'public/crypt-style'
        state.mkdir()
        zero = state / 'active.json'
        zero.write_text('{"id":"keep-zero"}')
        active = state / 'active-floor-1-ruins.json'
        active.write_text('{"id":"previous"}')
        run = restore_ruins.restore(self.repo, self.archive)
        self.assertEqual(json.loads(active.read_text())['id'], 'previous')
        restore_ruins.restore(self.repo, self.archive, apply=True)
        self.assertEqual(json.loads(active.read_text())['id'], run)
        self.assertEqual(json.loads(zero.read_text())['id'], 'keep-zero')
        self.assertEqual(len(list(state.glob('before-ruins-restore-*.json'))), 1)
        restore_ruins.restore(self.repo, self.archive, apply=True)
        self.assertEqual(len(list(state.glob('before-ruins-restore-*.json'))), 1)
        folder = self.repo / 'public/theme-runs' / run
        manifest = json.loads((folder / 'crypt-manifest.json').read_bytes())
        sources = json.loads((folder / 'sources.json').read_bytes())
        self.assertEqual(manifest['source_hashes'], sources['hashes'])
        restore_ruins.verified_hashes(self.repo, sources['hashes'])
        original = (folder / 'prop-00-original.png').read_bytes()
        (folder / 'prop-00-original.png').write_bytes(b'keep my experiment')
        before = active.read_bytes()
        with self.assertRaisesRegex(ValueError, 'refusing overwrite'):
            restore_ruins.restore(self.repo, self.archive, apply=True)
        self.assertEqual(active.read_bytes(), before)
        self.assertEqual((folder / 'prop-00-original.png').read_bytes(), b'keep my experiment')
        self.assertTrue(original)

    def test_changed_source_rejected_before_writing(self):
        source = self.repo / f'public/crypt-maps/{restore_ruins.MAP}.tmx'
        source.write_bytes(source.read_bytes() + b'changed')
        with self.assertRaisesRegex(ValueError, 'Source content changed'):
            restore_ruins.restore(self.repo, self.archive, apply=True)
        self.assertFalse((self.repo / 'public/theme-runs').exists())

    def test_lfs_pointer_has_actionable_error(self):
        pointer = self.repo / 'pointer.zip'
        pointer.write_text('version https://git-lfs.github.com/spec/v1\n')
        with self.assertRaisesRegex(ValueError, 'git lfs pull'):
            restore_ruins.restore(self.repo, pointer)

    def test_archive_traversal_rejected(self):
        malformed = self.repo / 'malformed.zip'
        with zipfile.ZipFile(self.archive) as original, zipfile.ZipFile(malformed, 'w') as output:
            output.writestr('selected-manifest.json', original.read('selected-manifest.json'))
            output.writestr('runs/' + 'a' * 32 + '/../outside.png', b'unsafe')
        with self.assertRaisesRegex(ValueError, 'Unsafe archive path'):
            restore_ruins.restore(self.repo, malformed, apply=True)
        self.assertFalse((self.repo / 'public/theme-runs').exists())


if __name__ == '__main__':
    unittest.main()
