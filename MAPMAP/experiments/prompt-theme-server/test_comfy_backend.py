import io, json, tempfile, unittest
from pathlib import Path
from unittest.mock import Mock, patch
from PIL import Image
import comfy_backend
from object_decorations import request_image


def png(size):
    buffer = io.BytesIO()
    Image.new('RGB', size, (200, 10, 10)).save(buffer, format='PNG')
    return buffer.getvalue()


class FakeComfy:
    """Answers the four ComfyUI endpoints the adapter uses."""
    def __init__(self):
        self.graph, self.polls = None, 0

    def post(self, url, **kwargs):
        if url.endswith('/upload/image'):
            return Mock(ok=True, raise_for_status=Mock(), json=Mock(return_value={'name': 'theme-in.png', 'subfolder': '', 'type': 'input'}))
        self.graph = kwargs['json']['prompt']
        return Mock(ok=True, json=Mock(return_value={'prompt_id': 'p1', 'node_errors': {}}))

    def get(self, url, **kwargs):
        if url.endswith('/history/p1'):
            self.polls += 1
            done = {'p1': {'status': {'completed': True, 'status_str': 'success'},
                           'outputs': {'13': {'images': [{'filename': 'theme_1.png', 'subfolder': '', 'type': 'output'}]}}}}
            return Mock(json=Mock(return_value={} if self.polls == 1 else done))
        return Mock(content=png((64, 48)), raise_for_status=Mock())


class ComfyBackendTests(unittest.TestCase):
    def test_generate_binds_inputs_and_records_the_real_seed(self):
        fake = FakeComfy()
        with tempfile.TemporaryDirectory() as tmp, patch.object(comfy_backend, 'requests', fake), patch('time.sleep'):
            path = Path(tmp)/'in.png'
            Image.new('RGB', (32, 32)).save(path)
            image, info = comfy_backend.generate('http://comfy', path, 'add snow', 'flux-kontext-edit', seed=1234)
        self.assertEqual(image.size, (32, 32))
        self.assertEqual(fake.graph['1']['inputs']['image'], 'theme-in.png')
        self.assertEqual(fake.graph['6']['inputs']['text'], 'add snow')
        self.assertEqual(fake.graph['11']['inputs']['seed'], 1234)
        self.assertEqual((info['seed'], info['steps'], info['model']), (1234, 28, 'flux1-dev-kontext_fp8_scaled.safetensors'))
        self.assertIn('clip_l.safetensors', info['models'])
        self.assertEqual(len(info['workflow_sha256']), 64)

    def test_positive_prompt_is_traced_from_the_sampler(self):
        graph = {
            '1': {'class_type': 'LoadImage', 'inputs': {'image': ''}},
            '2': {'class_type': 'TextEncodeQwenImageEdit', 'inputs': {'prompt': 'neg', 'image': ['1', 0]}},
            '3': {'class_type': 'TextEncodeQwenImageEdit', 'inputs': {'prompt': 'pos', 'image': ['1', 0]}},
            '4': {'class_type': 'KSampler', 'inputs': {'seed': 0, 'steps': 4, 'positive': ['3', 0], 'negative': ['2', 0]}}}
        bound = comfy_backend.bind(graph, 'x.png', 'snow', 9)
        self.assertEqual((bound['3']['inputs']['prompt'], bound['2']['inputs']['prompt']), ('snow', 'neg'))
        with self.assertRaises(ValueError):
            comfy_backend.bind({'1': graph['1']}, 'x.png', 'snow', 9)

    def test_request_image_falls_back_to_flux_and_says_why(self):
        response = Mock(content=png((8, 8)))
        with tempfile.TemporaryDirectory() as tmp, \
                patch('object_decorations.comfy_backend.generate', side_effect=ConnectionError('comfy down')), \
                patch('object_decorations.requests.post', return_value=response):
            folder = Path(tmp)
            request_image(folder, Image.new('RGB', (8, 8)), 'snow', 'http://flux', 1.0, backend='comfy')
            record = json.loads((folder/'generation.json').read_text(encoding='utf8'))
        self.assertEqual(record['seed'], 'service random; not exposed')
        self.assertIn('comfy down', record['comfy_fallback'])

    def test_request_image_records_comfy_run(self):
        info = {'backend': 'comfy', 'workflow': 'flux-kontext-edit', 'seed': 77, 'steps': 28, 'model': 'm.safetensors', 'models': []}
        with tempfile.TemporaryDirectory() as tmp, \
                patch('object_decorations.comfy_backend.generate', return_value=(Image.new('RGB', (8, 8)), info)):
            folder = Path(tmp)
            request_image(folder, Image.new('RGB', (8, 8)), 'snow', 'http://flux', 1.0, backend='comfy')
            record = json.loads((folder/'generation.json').read_text(encoding='utf8'))
            self.assertTrue((folder/'flux-raw.png').exists())
        self.assertEqual((record['backend'], record['seed'], record['model']), ('comfy', 77, 'm.safetensors'))
        self.assertNotIn('alpha', record)


if __name__ == '__main__':
    unittest.main()
