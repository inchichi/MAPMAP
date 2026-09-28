"""Prepare paired TMX evidence, run isolated VLM classification, and review results."""
import argparse
import hashlib
import html
import json
import time
from pathlib import Path

from PIL import Image, ImageDraw

MODEL = 'Qwen/Qwen3-VL-8B-Instruct'
CATEGORIES = ['building', 'tree', 'fence', 'column', 'sign', 'container',
              'furniture', 'plant', 'rock', 'light', 'ruin', 'other', 'unknown']
PROMPT = '''Identify ONLY the target pixel-art object in image 1. It is an enlarged
TMX object crop on a neutral background. If image 2 is supplied, it is surrounding
map context: the red rectangle marks the SAME target; ignore other objects.
The rectangle and neutral background are annotations, not object features.
Do not invent details hidden by low resolution. A crop may contain a fragment or
multiple touching objects: report that ambiguity. Choose unknown if uncertain.
Return only JSON with category (one of CATEGORY_LIST), label (short English),
visible_features (list of short English strings), ambiguity (short English string,
empty if none). Classify the original, not a holiday version. No decoration ideas.
'''.replace('CATEGORY_LIST', ', '.join(CATEGORIES))


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf8')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def evidence(source, world, x, y, margin=48):
    """Coordinates stay native; enlarge only classifier input copies."""
    w, h = source.size
    if x < 0 or y < 0 or x+w > world.width or y+h > world.height:
        raise ValueError('Object outside original map')
    background = Image.new('RGBA', source.size, (104, 104, 104, 255))
    background.alpha_composite(source)
    scale = max(1, min(12, 384 // max(w, h)))
    isolated = background.convert('RGB').resize((w*scale, h*scale), Image.Resampling.NEAREST)
    left, top = max(0, x-margin), max(0, y-margin)
    right, bottom = min(world.width, x+w+margin), min(world.height, y+h+margin)
    context = world.crop((left, top, right, bottom)).convert('RGB')
    zoom = max(1, min(4, 512 // max(context.size)))
    context = context.resize((context.width*zoom, context.height*zoom), Image.Resampling.NEAREST)
    box = [(x-left)*zoom, (y-top)*zoom, (x+w-left)*zoom-1, (y+h-top)*zoom-1]
    ImageDraw.Draw(context).rectangle(box, outline=(255, 30, 30), width=2)
    return isolated, context, dict(native_target=[x, y, w, h], context_origin=[left, top], context_scale=zoom)


def prepare(root):
    repo = Path(__file__).resolve().parents[1]
    root.mkdir(parents=True, exist_ok=False)
    selections = [
        ('14108377af854127a990463f567719c0', 'floor-0-town',
         ['object-00', 'object-02', 'tree-round', 'tree-pine', 'prop-column', 'prop-marker']),
        ('3019d65036e0459aa6de0bf0ef830ac7', 'floor-1-ruins',
         ['prop-00', 'prop-04', 'prop-08', 'prop-12', 'prop-20', 'prop-29'])]
    cases = []
    for run_id, map_id, assets in selections:
        folder = repo/'public/theme-runs'/run_id
        spec = json.loads((folder/'sources.json').read_text(encoding='utf8'))
        for path, expected in spec['hashes'].items():
            if digest(repo/path) != expected:
                raise ValueError(f'Stale source: {path}')
        world = Image.open(folder/'original-map.png').convert('RGBA')
        for asset in assets:
            path = folder/f'{asset}-original.png'
            source = Image.open(path).convert('RGBA')
            placement = next(p for p in spec['instances'] if p['asset'] == asset)
            isolated, context, coords = evidence(source, world, int(placement['x']), int(placement['y']))
            case_id = f'case-{len(cases):02d}'
            isolated.save(root/f'{case_id}-crop.png')
            context.save(root/f'{case_id}-context.png')
            cases.append(dict(id=case_id, asset=asset, map_id=map_id, source_run=run_id,
                              source_sha256=digest(path), source_hashes=spec['hashes'],
                              crop_sha256=digest(root/f'{case_id}-crop.png'),
                              context_sha256=digest(root/f'{case_id}-context.png'), **coords))
    write(root/'manifest.json', dict(model=MODEL, prompt=PROMPT, cases=cases,
          created=time.time(), label_status='unreviewed', auto_apply=False))
    print(root)


def infer(root, model_dir):
    import torch
    import transformers
    from huggingface_hub import model_info, snapshot_download
    from transformers import AutoProcessor, Qwen3VLForConditionalGeneration

    start = time.time()
    def status(stage, **kwargs):
        write(root/'status.json', dict(stage=stage, elapsed_seconds=time.time()-start, **kwargs))
    try:
        status('downloading')
        revision = model_info(MODEL).sha
        write(root/'settings.json', dict(model=MODEL, revision=revision, dtype='bfloat16',
              quantization=None, transformers=transformers.__version__, torch=torch.__version__,
              do_sample=False, max_new_tokens=256, prompt=PROMPT))
        snapshot_download(MODEL, revision=revision, local_dir=str(model_dir), max_workers=2,
                          allow_patterns=['*.json', '*.safetensors', '*.txt', '*.jinja'])
        free, _ = torch.cuda.mem_get_info()
        if free < 21*2**30:
            raise RuntimeError('Need 21 GiB free on selected GPU; existing jobs left untouched')
        status('loading')
        model = Qwen3VLForConditionalGeneration.from_pretrained(
            model_dir, dtype=torch.bfloat16, device_map='cuda:0', local_files_only=True)
        processor = AutoProcessor.from_pretrained(model_dir, local_files_only=True)
        model.eval()
        manifest = json.loads((root/'manifest.json').read_text(encoding='utf8'))
        total = len(manifest['cases'])*2
        completed = 0
        for case in manifest['cases']:
            for mode in ['crop_only', 'crop_and_context']:
                result_path = root/f'{case["id"]}-{mode}.json'
                if result_path.exists():
                    raise RuntimeError('Existing result found; use a new experiment folder')
                status('inference', completed=completed, total=total, case=case['id'], mode=mode)
                began = time.perf_counter()
                paths = [root/f'{case["id"]}-crop.png']
                if mode == 'crop_and_context': paths.append(root/f'{case["id"]}-context.png')
                content = [{'type':'image', 'image':Image.open(p).convert('RGB')} for p in paths]
                content.append({'type':'text', 'text':PROMPT})
                inputs = processor.apply_chat_template([{'role':'user', 'content':content}],
                    tokenize=True, add_generation_prompt=True, return_dict=True, return_tensors='pt').to('cuda')
                with torch.inference_mode():
                    outputs = model.generate(**inputs, max_new_tokens=256, do_sample=False)
                raw = processor.batch_decode(outputs[:, inputs['input_ids'].shape[1]:],
                                             skip_special_tokens=True)[0]
                parsed, error = None, None
                try:
                    cleaned = raw.strip()
                    if cleaned.startswith('```'): cleaned = cleaned.split('\n', 1)[1].rsplit('```', 1)[0]
                    parsed = json.loads(cleaned)
                    if (not isinstance(parsed, dict) or parsed.get('category') not in CATEGORIES
                        or not isinstance(parsed.get('label'), str)
                        or not isinstance(parsed.get('ambiguity'), str)
                        or not isinstance(parsed.get('visible_features'), list)
                        or not all(isinstance(v, str) for v in parsed['visible_features'])):
                        raise ValueError('Invalid classification schema')
                except (ValueError, TypeError) as exc:
                    error = str(exc)
                    parsed = None
                write(result_path, dict(case=case['id'], mode=mode, raw=raw, parsed=parsed,
                      validation_error=error, seconds=time.perf_counter()-began,
                      status='unreviewed' if parsed else 'invalid', source_sha256=case['source_sha256']))
                completed += 1
        status('complete', completed=completed, total=total, peak_gpu_gib=torch.cuda.max_memory_allocated()/2**30)
    except Exception as exc:
        status('failed', error=str(exc))
        raise


def report(root):
    manifest = json.loads((root/'manifest.json').read_text(encoding='utf8'))
    rows = []
    for case in manifest['cases']:
        results = []
        for mode in ['crop_only', 'crop_and_context']:
            path = root/f'{case["id"]}-{mode}.json'
            value = json.loads(path.read_text(encoding='utf8')) if path.exists() else {'status':'pending'}
            results.append('<pre>'+html.escape(json.dumps(value.get('parsed') or value, ensure_ascii=False, indent=2))+'</pre>')
        rows.append(f'<section><h2>{html.escape(case["map_id"]+" / "+case["asset"])}</h2>'
                    f'<div class="grid"><div><img src="{case["id"]}-crop.png"><p>추출 확대본</p>'
                    f'<img src="{case["id"]}-context.png"><p>빨간 박스: 분류 대상</p></div>'
                    f'<div><h3>단독 입력</h3>{results[0]}</div><div><h3>주변 맵 병행</h3>{results[1]}</div></div></section>')
    page = '''<!doctype html><meta charset="utf-8"><title>오브젝트 인식 비교</title>
    <style>body{background:#101827;color:#e6edf7;font:16px system-ui;max-width:1400px;margin:32px auto;padding:20px}
    section{background:#1c293b;padding:24px;margin:20px 0;border-radius:16px}.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px}
    img{max-width:100%;max-height:320px;object-fit:contain;image-rendering:pixelated}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:15px}
    p{color:#b5c4da}</style><h1>Qwen3-VL: 오브젝트 단독 vs 주변 맵 병행</h1>
    <p>원본 12종 / 결과는 미검수 후보입니다. 일치율은 정확도가 아닙니다. 사람이 정답을 확인하기 전 자동 적용하지 않습니다.</p>'''
    (root/'comparison.html').write_text(page+''.join(rows), encoding='utf8')


def collect(root):
    """Finite collector for the already-started job; never starts inference."""
    import subprocess
    remote = '/home/user6/services/qwen-vl-recognition/'+root.name
    for _ in range(120):
        check = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8',
            '-p', '2206', 'user6@100.115.43.81', 'cat '+remote+'/status.json'],
            capture_output=True, text=True, timeout=20)
        if check.returncode:
            print('Connection unavailable; retrying without restarting job', flush=True)
            time.sleep(30)
            continue
        status = json.loads(check.stdout)
        write(root/'remote-status.json', status)
        print(json.dumps(status), flush=True)
        if status['stage'] in ('complete', 'failed'):
            subprocess.run(['scp', '-o', 'BatchMode=yes', '-P', '2206',
                            'user6@100.115.43.81:'+remote+'/*.json', str(root)], check=True)
            subprocess.run(['scp', '-o', 'BatchMode=yes', '-P', '2206',
                            'user6@100.115.43.81:'+remote+'/process.log', str(root)], check=True)
            report(root)
            return
        time.sleep(30)
    raise TimeoutError('Collector stopped after one hour; remote job left untouched')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['prepare', 'infer', 'report', 'collect'])
    parser.add_argument('folder', type=Path)
    parser.add_argument('--model-dir', type=Path, default=Path('/home/user6/services/qwen-vl-recognition/model'))
    args = parser.parse_args()
    if args.action == 'prepare': prepare(args.folder)
    elif args.action == 'infer': infer(args.folder, args.model_dir)
    elif args.action == 'collect': collect(args.folder)
    else: report(args.folder)
