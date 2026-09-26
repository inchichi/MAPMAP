"""Plan-driven revisions of the applied ruins result; never fall back to town."""
import hashlib, json, re, shutil, time, uuid
import numpy as np
from PIL import Image
from contracts import Dsl, Plan, GroupManifest, check_folder
from theme_pipeline import ROOT, REPO, save_status, recolor
from town_plan_style import edit, read, write
from run_records import record_event
from ruins_decoration_margin import extract as extract_margin
from ruins_composition import compose

MAP = 'floor-1-ruins'
PIPELINE = 'crypt-ruins-plan-v1'


def baseline():
    manifest = read(REPO/'public/crypt-style', f'active-{MAP}.json')
    if manifest['mapId'] != MAP or not re.fullmatch('[a-f0-9]{32}', manifest['id']):
        raise ValueError('Invalid ruins selection')
    folder = ROOT/manifest['id']
    spec = read(folder, 'sources.json')
    if spec['mapId'] != MAP or spec['hashes'] != manifest['source_hashes']:
        raise ValueError('Ruins source records do not match')
    for path, digest in spec['hashes'].items():
        if hashlib.sha256((REPO/path).read_bytes()).hexdigest() != digest:
            raise ValueError('Ruins source changed; extract the map again')
    return folder, manifest, spec


def sample():
    folder, manifest, spec = baseline()
    variants = [v for v in spec['variants'] if v['kind'] == 'prop']
    return {'dsl': {'parser': 'manual', 'theme': 'christmas', 'source_text': '폐허마을 크리스마스 눈과 전구',
                    'night': bool(manifest['night']), 'twinkle': True, 'decorations': ['snow', 'lights'],
                    'target_maps': [MAP]},
            'plan': [{'asset': v['id'], 'kind': v['kind'], 'action': 'decorate', 'decorations': ['snow', 'lights'],
                      'prompt': 'Add small snow caps and warm Christmas bulbs attached inside this exact pixel-art object. Preserve its silhouette, supports, position and gray background.'}
                     for v in variants[:2]], 'parent_run_id': folder.name}


def prepare_data(dsl, plan):
    dsl = Dsl.model_validate(dsl).model_dump(exclude_none=True)
    rows = [r.model_dump(exclude_none=True) for r in Plan.model_validate(plan).root]
    if dsl['target_maps'] != [MAP]: raise ValueError('Expected floor-1-ruins, not town')
    if not rows or len({r['asset'] for r in rows}) != len(rows): raise ValueError('Plan needs unique assets')
    parent, manifest, spec = baseline()
    variants = {v['id']: v for v in spec['variants'] if v['kind'] == 'prop'}
    for row in rows:
        if row['asset'] not in variants: raise ValueError('Select an extracted ruins prop: '+row['asset'])
        if row['candidates'] != 1 or row.get('seed') is not None: raise ValueError('One candidate, service-selected seed only')
    # New requests start from original pixels, never from an earlier theme.
    dsl['composition_mode'] = 'original'
    dsl['extraction_profile'] = 'reference-difference-v1'
    folder = ROOT/uuid.uuid4().hex
    folder.mkdir()
    groups = []
    for row in rows:
        name = row['asset']
        shutil.copy2(parent/f'{name}-original.png', folder/f'{name}-original.png')
        source = Image.open(folder/f'{name}-original.png').convert('RGBA')
        instances = [{'x': p['x'], 'y': p['y'], 'w': source.width, 'h': source.height} for p in spec['instances'] if p['asset'] == name]
        row['instances'] = len(instances)
        groups.append({'group_id': name, 'kind': variants[name]['kind'], 'confidence': 0.5, 'source': 'cc',
                       'layer': 'prop', 'hash': hashlib.sha256(source.tobytes()).hexdigest(), 'instances': instances})
    group_manifest = GroupManifest(mapId=MAP, tileset='src/games/crypt-crawler/assets/tilesets/ninja-dungeon-16.tsx',
                                   tile_size=[spec['tile_size']]*2, groups=groups).model_dump(exclude_none=True)
    shutil.copy2(parent/'original-map.png', folder/'original-map.png')
    # Keep all source crops/instances available for a later revision of this run.
    for v in spec['variants']:
        if not (folder/f'{v["id"]}-original.png').exists(): shutil.copy2(parent/f'{v["id"]}-original.png', folder/f'{v["id"]}-original.png')
    for name, data in [('dsl', dsl), ('plan', rows), ('group-manifest', group_manifest), ('labels', {}), ('sources', spec), ('parent-manifest', manifest)]:
        write(folder, name+'.json', data)
    (folder/'review.html').write_text('<!doctype html><html lang="ko"><meta charset="utf-8"><body><script type="module" src="/src/editor/cryptResultGallery.ts"></script></body></html>', encoding='utf8')
    save_status(folder, {'id': folder.name, 'mapId': MAP, 'pipeline': PIPELINE, 'parent_run_id': parent.name,
                        'status': 'queued', 'stage': 2, 'created': time.time(), 'prompt': dsl['source_text'],
                        'total_objects': len(rows), 'completed_objects': 0, 'object_results': {},
                        'instances': sum(r['instances'] for r in rows), 'original': f'/theme-runs/{folder.name}/original-map.png'})
    return folder.name


def run(run_id):
    folder = ROOT/run_id
    status, rows, dsl = read(folder, 'status.json'), read(folder, 'plan.json'), read(folder, 'dsl.json')
    recovery = read(folder, 'recovery.json') if (folder/'recovery.json').exists() else {}
    parent = read(folder, 'parent-manifest.json')
    spec = read(folder, 'sources.json')
    lock = ROOT/'.batch.lock'
    with lock.open('x') as handle: handle.write(run_id)
    try:
        fresh = dsl.get('composition_mode') == 'original'
        revisions = {} if fresh else parent.get('asset_revisions', {}).copy()
        for row in rows:
            name = row['asset']
            status.update(status='running', stage=4, current_object=name)
            save_status(folder, status)
            source = Image.open(folder/f'{name}-original.png').convert('RGBA')
            result = {'status': 'skipped', 'action': row['action']}
            if row['action'] in ('decorate', 'recolor'):
                (folder/name).mkdir(exist_ok=True)
                if row['action'] == 'decorate':
                    edit(folder, row, source, pipeline=PIPELINE)
                    padded, deco, offset = extract_margin(source, Image.open(folder/name/'flux-raw.png'), generic=fresh)
                    deco.save(folder/name/'decoration.png')
                    base = recolor(source, dsl.get('color', {'gain':[1,1,1], 'bias':[0,0,0]})) if row.get('recolor_base') else source
                    base.save(folder/name/'recolor.png')
                    if not np.array_equal(np.array(base)[:,:,3],np.array(source)[:,:,3]): raise ValueError('Base alpha changed')
                    padded.paste(base,(offset['margin'],offset['margin']))
                    padded.save(folder/name/'base-padded.png')
                    output = Image.alpha_composite(padded, deco)
                    result['postprocess_profile']='reference-difference-v1' if fresh else 'padded-margin-3-v1'
                    result['generation_seconds'] = read(folder/name, 'request-timing.json')['generation_seconds']
                    if name in recovery.get('reused_assets', []):
                        result['reused_from'] = recovery['source_run_id']
                else:
                    output = recolor(source, dsl.get('color', {'gain': [1,1,1], 'bias': [0,0,0]}))
                    if not np.array_equal(np.array(output)[:,:,3],np.array(source)[:,:,3]): raise ValueError('Alpha changed')
                    offset={'x':0,'y':0,'margin':0}
                output.save(folder/name/'composite.png')
                write(folder/name,'placement.json',dict(offset,twinkle=row['action']=='decorate' and dsl.get('twinkle',False)))
                revisions[name]=run_id
                result['status'] = 'ready'
            status['object_results'][name] = result
            status['completed_objects'] += 1
            save_status(folder, status)
        for path, digest in spec['hashes'].items():
            if hashlib.sha256((REPO/path).read_bytes()).hexdigest() != digest: raise ValueError('Source changed')
        overlay,bulbs,base_id=compose(ROOT,parent,spec,revisions, original=fresh)
        overlay.save(folder/'decoration-map.png')
        original = Image.open(folder/'original-map.png').convert('RGBA')
        night = .36 if dsl['night'] else 0
        preview = Image.alpha_composite(original, Image.new('RGBA', original.size, (12,23,58,round(night*255))))
        Image.alpha_composite(preview, overlay).save(folder/'preview.png')
        write(folder, 'crypt-manifest.json', dict(parent, id=run_id, parent_run_id=parent['id'], bulbs=bulbs,
                                                 composition_base_id=base_id, asset_revisions=revisions, night=night, theme=dsl['theme'],
                                                 overlay=f'/theme-runs/{run_id}/decoration-map.png'))
        write(folder, 'validation.json', {'source_hashes_unchanged': True, 'all_variant_alpha_preserved': True,
                                         'alpha_scope':'base sprite; decoration independently padded by 3 pixels'})
        if any(check_folder(folder).values()): raise ValueError('Invalid contracts')
        status.update(status='ready', stage=7, current_object=None, preview=f'/theme-runs/{run_id}/preview.png')
        save_status(folder, status)
        record_event(folder, 'crypt_plan_finalized', parent_run_id=parent['id'])
    except Exception as error:
        status.update(status='failed', error=str(error)); save_status(folder, status)
        raise
    finally: lock.unlink(missing_ok=True)
