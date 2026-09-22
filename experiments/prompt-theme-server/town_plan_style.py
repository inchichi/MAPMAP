"""Town vertical slice: dsl.json + group-manifest.json + plan.json -> one edit per decorate group ->
decoration extracted from the diff -> placed at every identical instance -> town placements (existing runtime).
Usage: python town_plan_style.py prepare <dsl.json> <plan.json>   -> prints run id
       python town_plan_style.py run <run-id>"""
import json, sys, time, uuid
import numpy as np
from PIL import Image, ImageFilter
from theme_pipeline import ROOT, REPO, FLUX, save_status, sources, layers, recolor
from object_decorations import request_image
from crypt_full_style import extract_material
from run_records import record_event
from contracts import Dsl, Plan, check_folder
import groups_tsx

MAP = 'src/games/my-sample-rpg/assets/maps/town.tmx'
PIPELINE = 'town-plan-v1'
NIGHT = .58
# extract_material keeps only the top part for these kinds; roofs, fountains etc. use the full height.
LIMIT_KIND = {'tree': 'tree'}
DECORATION_WORDS = {'snow': 'thin soft white snow caps on the upper edges', 'lights': 'small warm golden Christmas bulbs on a dark cable',
                    'garland': 'a thin green garland'}


def read(folder, name):
    return json.loads((folder/name).read_text(encoding='utf8'))


def write(folder, name, data):
    (folder/name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf8')


def default_prompt(row):
    added = ', '.join(DECORATION_WORDS[d] for d in row['decorations'] if d in DECORATION_WORDS) or 'winter decorations'
    return (f'Add {added} to this pixel-art {row["kind"]}. Preserve its exact silhouette, tiles, colours and position. '
            'Keep the gray background empty. No new objects, no text, no cast shadows.')


def prepare(dsl_path, plan_path):
    dsl = Dsl.model_validate_json(open(dsl_path, encoding='utf8').read()).model_dump(exclude_none=True)
    plan = [row.model_dump(exclude_none=True) for row in Plan.model_validate_json(open(plan_path, encoding='utf8').read()).root]
    manifest = groups_tsx.build(REPO, 'town', MAP)
    groups = {group['group_id']: group for group in manifest['groups']}
    unknown = [row['asset'] for row in plan if row['asset'] not in groups]
    if unknown: raise ValueError(f'plan.json asset not in group manifest: {unknown}')
    folder = ROOT/uuid.uuid4().hex
    folder.mkdir()
    color = dsl.get('color', {'gain': [1, 1, 1], 'bias': [0, 0, 0]})
    original, _, _, hashes = layers(color)
    original.save(folder/'original-map.png')
    variants, instances, skipped = [], [], []
    for row in plan:
        group = groups[row['asset']]
        first = groups_tsx.crop(REPO, MAP, group, group['instances'][0])
        first.save(folder/f'{row["asset"]}-original.png')
        variants.append({'id': row['asset'], 'kind': row['kind'], 'width': first.width, 'height': first.height})
        for instance in group['instances']:
            # The edit is made on the first instance, so it is placed only where the source pixels are identical.
            same = instance is group['instances'][0] or groups_tsx.crop(REPO, MAP, group, instance).tobytes() == first.tobytes()
            (instances if same else skipped).append({'asset': row['asset'], 'x': instance['x'], 'y': instance['y']})
        row['instances'] = sum(i['asset'] == row['asset'] for i in instances)
    write(folder, 'dsl.json', dsl)
    write(folder, 'group-manifest.json', manifest)
    write(folder, 'plan.json', plan)
    write(folder, 'sources.json', {'mapId': 'town', 'hashes': hashes, 'variants': variants, 'instances': instances, 'skipped_instances': skipped})
    (folder/'review.html').write_text('<!doctype html><html lang="ko"><meta charset="utf-8"><body><script type="module" src="/src/editor/cryptResultGallery.ts"></script></body></html>', encoding='utf8')
    spec = {'theme': dsl['theme'], 'decorations': dsl['decorations'], 'night': dsl['night'], 'twinkle': dsl.get('twinkle', False),
            'color': color, 'warnings': dsl.get('warnings', [])}
    save_status(folder, {'id': folder.name, 'mapId': 'town', 'pipeline': PIPELINE, 'status': 'queued', 'stage': 2, 'created': time.time(),
                         'prompt': dsl.get('source_text', ''), 'spec': spec, 'total_objects': len(plan), 'completed_objects': 0,
                         'instances': len(instances), 'object_results': {row['asset']: {'status': 'pending'} for row in plan},
                         'original': f'/theme-runs/{folder.name}/original-map.png'})
    record_event(folder, 'prepared', plan_rows=len(plan), instances=len(instances), skipped_instances=len(skipped))
    return folder.name


def edit(folder, row, source):
    target = folder/row['asset']
    target.mkdir(exist_ok=True)
    scale = max(1, min(6, 1024 // max(source.size)))
    scaled = source.resize((source.width*scale, source.height*scale), Image.Resampling.NEAREST)
    canvas = Image.new('RGB', (scaled.width+64, scaled.height+64), '#808080')
    canvas.paste(scaled, (32, 32), scaled)
    if not (target/'flux-raw.png').exists():
        request_image(target, canvas, row['prompt'] or default_prompt(row), FLUX, 1.0, pipeline=PIPELINE)
    raw = Image.open(target/'flux-raw.png').convert('RGB').resize(canvas.size, Image.Resampling.LANCZOS)
    aligned = raw.crop((32, 32, 32+scaled.width, 32+scaled.height))
    aligned.save(target/'aligned-high.png')
    overlay = extract_material(source, aligned, LIMIT_KIND.get(row['kind'], row['kind']))
    overlay.save(target/'decoration.png')
    Image.alpha_composite(source, overlay).save(target/'composite.png')
    return overlay


def run(run_id):
    folder = ROOT/run_id
    status, plan, spec = read(folder, 'status.json'), read(folder, 'plan.json'), read(folder, 'sources.json')
    lock = ROOT/'.batch.lock'
    with lock.open('x') as handle: handle.write(run_id)
    try:
        for row in plan:
            name = row['asset']
            source = Image.open(folder/f'{name}-original.png').convert('RGBA')
            status.update(status='running', stage=4, current_object=name)
            status['object_results'][name] = {'status': 'running', 'started_at': time.time()}
            save_status(folder, status)
            result = {'status': 'ready', 'action': row['action'], 'source_available': True}
            if row['action'] == 'decorate':
                overlay = edit(folder, row, source)
                timing = folder/name/'request-timing.json'
                if timing.exists(): result['generation_seconds'] = json.loads(timing.read_text())['generation_seconds']
                if not overlay.getbbox(): result['empty'] = True
            elif row['action'] == 'recolor':
                (folder/name).mkdir(exist_ok=True)
                recolor(source, status['spec']['color']).save(folder/name/'composite.png')
            else:
                result['status'] = 'skipped'  # add / cover / skip are recorded only in this slice
            status['object_results'][name] = result
            status['completed_objects'] = sum(r['status'] in ('ready', 'skipped') for r in status['object_results'].values())
            save_status(folder, status)
        finalize(folder, status, plan, spec)
    except Exception as error:
        status.update(status='failed', error=f'{type(error).__name__}: {error}')
        save_status(folder, status)
        raise
    finally:
        lock.unlink(missing_ok=True)


def finalize(folder, status, plan, spec):
    status.update(stage=6, current_object=None)
    save_status(folder, status)
    original = Image.open(folder/'original-map.png').convert('RGBA')
    decoration_map, recolor_map = Image.new('RGBA', original.size), Image.new('RGBA', original.size)
    out_of_bounds, warnings = 0, []
    actions = {row['asset']: row['action'] for row in plan}
    for instance in spec['instances']:
        name, x, y = instance['asset'], instance['x'], instance['y']
        if actions[name] == 'decorate':
            overlay = Image.open(folder/name/'decoration.png').convert('RGBA')
            allowed = np.array(Image.open(folder/f'{name}-original.png').getchannel('A').filter(ImageFilter.MaxFilter(5)))
            out_of_bounds += int(((np.array(overlay)[:, :, 3] > 0) & (allowed == 0)).sum())
            decoration_map.alpha_composite(overlay, (x, y))
        elif actions[name] == 'recolor':
            recolor_map.alpha_composite(Image.open(folder/name/'composite.png').convert('RGBA'), (x, y))
    decoration_map.save(folder/'decoration-map.png')
    recolor_map.save(folder/'recolor-map.png')
    _, tinted, _, _ = layers(status['spec']['color'])
    preview = Image.alpha_composite(tinted, recolor_map)
    if status['spec']['night']: preview = Image.alpha_composite(preview, Image.new('RGBA', preview.size, (7, 19, 46, 148)))
    Image.alpha_composite(preview, decoration_map).save(folder/'preview.png')
    run_id = folder.name
    settings = {'runId': run_id, 'night': NIGHT if status['spec']['night'] else 0, 'twinkle': status['spec']['twinkle'], 'color': status['spec']['color']}
    Image.new('RGBA', (1, 1)).save(folder/'settings.png')
    placement = lambda pid, url: {'id': f'{run_id}-{pid}', 'kind': 'object', 'col': 0, 'row': 0, 'imageUrl': f'/theme-runs/{run_id}/{url}',
                                  'anchor': 'top-left', 'renderLayer': 'decoration', 'sourceGroup': 'prompt-theme', 'visible': True, 'sourceAssetId': pid}
    placements = [dict(placement('settings', 'settings.png'), themeSettings=settings)]
    if recolor_map.getbbox(): placements.append(placement('recolor-map', 'recolor-map.png'))
    placements.append(placement('decoration-map', 'decoration-map.png'))
    boxes = {}
    for instance in spec['instances']: boxes.setdefault(instance['asset'], instance)
    objects = [{'id': v['id'], 'category': v['kind'], 'box': [boxes[v['id']]['x'], boxes[v['id']]['y'], v['width'], v['height']]}
               for v in spec['variants'] if v['id'] in boxes]
    unchanged = sources()[3] == spec['hashes']
    write(folder, 'manifest.json', {'pipeline': PIPELINE, 'spec': status['spec'], 'source_hashes': spec['hashes'], 'objects': objects,
                                    'placements': placements, 'geometry_preserved': True, 'alpha_preserved': out_of_bounds == 0})
    write(folder, 'validation.json', {'source_hashes_unchanged': unchanged, 'alpha_preserved': out_of_bounds == 0,
                                      'tiles_covered': len(spec['instances']), 'skipped_instances': len(spec['skipped_instances']),
                                      'changed_pixels': int((np.array(decoration_map)[:, :, 3] > 0).sum() + (np.array(recolor_map)[:, :, 3] > 0).sum()),
                                      'out_of_bounds_pixels': out_of_bounds})
    if spec['skipped_instances']: warnings.append(f'원본 픽셀이 다른 인스턴스 {len(spec["skipped_instances"])}곳은 이번 결과에서 제외했습니다.')
    warnings += [f'{name}: 추출된 장식 없음' for name, r in status['object_results'].items() if r.get('empty')]
    problems = {name: error for name, error in check_folder(folder).items() if error}
    if problems or not unchanged: raise ValueError(f'contract/source check failed: {problems or "source hashes changed"}')
    status.update(status='ready', stage=7, preview=f'/theme-runs/{run_id}/preview.png', preview_revision=time.time(), warnings=warnings)
    save_status(folder, status)
    record_event(folder, 'finalized', instances=len(spec['instances']), out_of_bounds_pixels=out_of_bounds)


if __name__ == '__main__':
    if sys.argv[1:2] == ['prepare'] and len(sys.argv) == 4:
        print(prepare(sys.argv[2], sys.argv[3]), flush=True)
    elif sys.argv[1:2] == ['run'] and len(sys.argv) == 3:
        run(sys.argv[2])
    else:
        print(__doc__)
        sys.exit(2)
