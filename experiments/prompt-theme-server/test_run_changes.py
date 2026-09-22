import json, tempfile, unittest
from pathlib import Path
from run_changes import changes


def write(path, data=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data) if data is not None else '', encoding='utf8')


class RunChangesTests(unittest.TestCase):
    def test_derives_rows_from_crypt_run_records(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)/('a'*32)
            write(folder/'status.json', {'mapId': 'floor-1-ruins', 'pipeline': 'crypt-ruins-winter-v1', 'status': 'ready',
                                         'object_results': {'prop-00': {'status': 'ready', 'shared_request': 'objects'},
                                                            'prop-04': {'status': 'ready', 'shared_request': 'objects', 'frost_only': True},
                                                            'wall-354': {'status': 'ready', 'shared_request': 'surfaces'}}})
            write(folder/'sources.json', {'variants': [{'id': 'prop-00', 'kind': 'prop', 'width': 16, 'height': 16},
                                                       {'id': 'prop-04', 'kind': 'prop', 'width': 16, 'height': 16},
                                                       {'id': 'wall-354', 'kind': 'wall', 'gid': 354, 'width': 16, 'height': 16, 'count': 7}],
                                          'instances': [{'asset': 'prop-00', 'x': 0, 'y': 0}, {'asset': 'prop-00', 'x': 16, 'y': 0}]})
            write(folder/'objects/generation.json', {'prompt': 'snow caps', 'model': 'FLUX.1-Kontext-dev', 'seed': 'service random; not exposed'})
            for name in ['prop-00/decoration.png', 'prop-00/composite.png', 'prop-04/decoration.png', 'prop-04/composite.png', 'wall-354/composite.png', 'prop-00-original.png']:
                write(folder/name)
            result = changes(folder)
            rows = {row['asset']: row for row in result['rows']}
            self.assertEqual(result['source'], 'derived')
            self.assertEqual(result['counts'], {'decorate': 1, 'recolor': 2, 'add': 0, 'cover': 0, 'skip': 0})
            self.assertEqual(rows['prop-00']['instances'], 2)
            self.assertEqual(rows['prop-00']['prompt'], 'snow caps')
            self.assertIsNone(rows['prop-00']['seed'])
            self.assertEqual(rows['prop-04']['action'], 'recolor')
            self.assertEqual(rows['wall-354']['instances'], 7)
            self.assertEqual(rows['prop-00']['images']['before'], f'/theme-runs/{folder.name}/prop-00-original.png')
            self.assertIsNone(rows['wall-354']['images']['decoration'])

    def test_plan_json_wins_and_keeps_recorded_seed(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)/('b'*32)
            write(folder/'status.json', {'status': 'ready'})
            write(folder/'plan.json', [{'asset': 'roof_blue_large', 'kind': 'roof', 'action': 'decorate', 'prompt': 'snow',
                                        'instances': [{'x': 1, 'y': 2}, {'x': 3, 'y': 4}], 'seed': 42},
                                       {'asset': 'well', 'kind': 'prop', 'action': 'skip', 'prompt': ''}])
            result = changes(folder)
            self.assertEqual(result['source'], 'plan.json')
            self.assertEqual(result['mapId'], 'town')
            self.assertEqual(result['rows'][0]['instances'], 2)
            self.assertEqual(result['rows'][0]['seed'], 42)
            self.assertEqual(result['counts']['skip'], 1)


if __name__ == '__main__':
    unittest.main()
