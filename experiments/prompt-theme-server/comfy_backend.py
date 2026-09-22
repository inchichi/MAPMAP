"""ComfyUI adapter: upload the input, queue an API-format workflow, poll /history, download the result.
The seed is chosen here and written into the sampler, so the recorded seed is the one really used."""
import hashlib, io, json, random, time, uuid
from pathlib import Path
import requests
from PIL import Image

WORKFLOWS = Path(__file__).parent/'comfy-workflows'
TEXT_NODES = {'CLIPTextEncode', 'TextEncodeQwenImageEdit', 'TextEncodeQwenImageEditPlus'}
SAMPLERS = {'KSampler', 'KSamplerAdvanced', 'SamplerCustomAdvanced'}
MODEL_FILES = ('.safetensors', '.gguf', '.ckpt', '.pt', '.pth')


def load_workflow(name):
    text = (WORKFLOWS/f'{name}.json').read_text(encoding='utf8')
    return json.loads(text), hashlib.sha256(text.encode('utf8')).hexdigest()


def upstream_text(graph, link):
    """Follow a conditioning link back to the text encoder that feeds it."""
    seen, queue = set(), [link]
    while queue:
        node_id = str(queue.pop(0)[0])
        if node_id in seen or node_id not in graph: continue
        seen.add(node_id)
        node = graph[node_id]
        if node['class_type'] in TEXT_NODES: return node
        queue += [value for value in node['inputs'].values() if isinstance(value, list) and len(value) == 2]
    return None


def bind(workflow, image_name, prompt, seed):
    """Return a copy with the input image, positive prompt and seed filled in."""
    graph = json.loads(json.dumps(workflow))
    loaders = [node for node in graph.values() if node['class_type'] == 'LoadImage']
    samplers = [node for node in graph.values() if node['class_type'] in SAMPLERS]
    if len(loaders) != 1 or len(samplers) != 1:
        raise ValueError('workflow needs exactly one LoadImage and one sampler node')
    loaders[0]['inputs']['image'] = image_name
    sampler = samplers[0]['inputs']
    if 'positive' in sampler:
        positive = upstream_text(graph, sampler['positive'])
    else:  # SamplerCustomAdvanced takes a guider
        positive = upstream_text(graph, sampler['guider'])
    if positive is None: raise ValueError('positive prompt node not found')
    positive['inputs']['prompt' if 'prompt' in positive['inputs'] else 'text'] = prompt
    seeded = False
    for node in [samplers[0]] + [n for n in graph.values() if n['class_type'] == 'RandomNoise']:
        for key in ('seed', 'noise_seed'):
            if key in node['inputs']:
                node['inputs'][key] = seed
                seeded = True
    if not seeded: raise ValueError('seed input not found')
    return graph


def model_files(graph):
    return sorted({value for node in graph.values() for key, value in node['inputs'].items()
                   if '_name' in key and isinstance(value, str) and value.endswith(MODEL_FILES)})


def main_model(graph):
    return next((value for node in graph.values() for key, value in node['inputs'].items()
                 if key in ('unet_name', 'ckpt_name') and isinstance(value, str)), None)


def sampler_steps(graph):
    return next((node['inputs'].get('steps') for node in graph.values()
                 if node['class_type'] in SAMPLERS | {'BasicScheduler'} and 'steps' in node['inputs']), None)


def generate(url, image_path, prompt, workflow_name, seed=None, timeout=1800):
    """Run one image edit. Returns (RGB image resized to the input size, record for generation.json)."""
    workflow, workflow_sha = load_workflow(workflow_name)
    seed = random.randrange(2**32) if seed is None else seed
    source = Image.open(image_path)
    with open(image_path, 'rb') as f:
        upload = requests.post(url+'/upload/image', files={'image': (f'theme-{uuid.uuid4().hex}.png', f, 'image/png')},
                               data={'overwrite': 'true'}, timeout=60)
    upload.raise_for_status()
    stored = upload.json()
    name = f"{stored['subfolder']}/{stored['name']}" if stored.get('subfolder') else stored['name']
    graph = bind(workflow, name, prompt, seed)
    queued = requests.post(url+'/prompt', json={'prompt': graph, 'client_id': uuid.uuid4().hex}, timeout=60)
    if not queued.ok: raise RuntimeError(f'ComfyUI rejected the workflow: {queued.text[:500]}')
    prompt_id = queued.json()['prompt_id']
    deadline = time.time()+timeout
    while True:
        history = requests.get(f'{url}/history/{prompt_id}', timeout=30).json().get(prompt_id)
        if history and history.get('status', {}).get('completed'): break
        if history and history.get('status', {}).get('status_str') == 'error':
            raise RuntimeError(f'ComfyUI run failed: {json.dumps(history["status"])[:500]}')
        if time.time() > deadline: raise TimeoutError(f'ComfyUI run {prompt_id} timed out')
        time.sleep(1)
    images = [image for output in history['outputs'].values() for image in output.get('images', [])]
    if not images: raise RuntimeError('ComfyUI run produced no image')
    view = requests.get(url+'/view', params={key: images[0][key] for key in ('filename', 'subfolder', 'type')}, timeout=120)
    view.raise_for_status()
    result = Image.open(io.BytesIO(view.content)).convert('RGB')
    if result.size != source.size:
        result = result.resize(source.size, Image.Resampling.LANCZOS)
    return result, {'backend': 'comfy', 'comfy_url': url, 'workflow': workflow_name, 'workflow_sha256': workflow_sha,
                    'model': main_model(graph), 'models': model_files(graph), 'steps': sampler_steps(graph),
                    'seed': seed, 'prompt_id': prompt_id}


def health(url):
    response = requests.get(url+'/system_stats', timeout=10)
    response.raise_for_status()
    return response.json()
