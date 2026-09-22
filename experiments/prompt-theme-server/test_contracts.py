import json, shutil, tempfile, unittest
from pathlib import Path
from pydantic import ValidationError
import contracts
from run_changes import changes

SAMPLES = contracts.SCHEMAS/'samples'


class ContractTests(unittest.TestCase):
    def test_samples_are_valid(self):
        for folder in SAMPLES.iterdir():
            report = contracts.check_folder(folder)
            self.assertTrue(report, folder.name)
            self.assertEqual({name: None for name in report}, report, folder.name)

    def test_schema_files_match_models(self):
        for name in contracts.CONTRACTS:
            written = json.loads((contracts.SCHEMAS/f'{name}.schema.json').read_text(encoding='utf8'))
            self.assertEqual(contracts.schema(name), written, f'run: python contracts.py schemas ({name})')

    def test_rejects_unknown_action_and_missing_layer(self):
        with self.assertRaises(ValidationError):
            contracts.Plan.model_validate([{'asset': 'a', 'kind': 'roof', 'action': 'MODIFY'}])
        manifest = json.loads((SAMPLES/'crypt-floor-1-ruins/crypt-manifest.json').read_text(encoding='utf8'))
        del manifest['overlay']
        with self.assertRaises(ValidationError):
            contracts.Manifest.model_validate(manifest)
        manifest['layers'] = {'decoration': '/theme-runs/x/decoration.png'}
        contracts.Manifest.model_validate(manifest)

    def test_cc_group_needs_hash(self):
        with self.assertRaises(ValidationError):
            contracts.Group.model_validate({'group_id': 'prop-00', 'kind': 'prop', 'confidence': 1, 'source': 'cc',
                                            'layer': 'prop', 'instances': [{'x': 0, 'y': 0}]})

    def test_change_list_reads_sample_plan(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)/('c'*32)
            folder.mkdir()
            shutil.copy(SAMPLES/'town/plan.json', folder/'plan.json')
            (folder/'status.json').write_text('{"status": "ready"}', encoding='utf8')
            result = changes(folder)
            self.assertEqual(result['source'], 'plan.json')
            self.assertEqual(result['counts']['decorate'], 2)
            self.assertEqual(result['counts']['recolor'], 1)


if __name__ == '__main__':
    unittest.main()
