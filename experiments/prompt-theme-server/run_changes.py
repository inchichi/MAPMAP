"""Change List rows for one run: plan.json when present, else derived from older run records."""
import json
from collections import Counter
from contracts import Plan

ACTIONS = ['decorate', 'recolor', 'add', 'cover', 'skip']


def read_json(path):
    return json.loads(path.read_text(encoding='utf8')) if path.is_file() else None


def url(folder, name):
    return f'/theme-runs/{folder.name}/{name}' if (folder/name).is_file() else None


def images(folder, asset):
    return {'before': url(folder, f'{asset}-original.png'),
            'after': url(folder, f'{asset}/composite.png'),
            'decoration': url(folder, f'{asset}/decoration.png') or url(folder, f'{asset}-decoration.png')}


def generation(folder, name):
    record = read_json(folder/name/'generation.json') if name else None
    if not record:
        return {}
    seed = record.get('seed')
    # Only a recorded integer seed is a seed; older FLUX runs say "service random; not exposed".
    return {'prompt': record.get('prompt', ''), 'model': record.get('model'), 'steps': record.get('steps'),
            'seed': seed if isinstance(seed, int) else None, 'generation': f'{name}/generation.json'}


def shared_request(folder, asset, result):
    if result.get('shared_request'):
        return result['shared_request']
    if (folder/asset/'generation.json').is_file():
        return asset
    sheets = [p.parent.name for p in folder.glob('*/generation.json')]
    return sheets[0] if len(sheets) == 1 else None


def derived_action(folder, asset, result):
    if result.get('status', 'ready') != 'ready':
        return 'skip'
    # frost_only: no snow was detected, so only the frost colour correction is applied.
    if not result.get('frost_only') and images(folder, asset)['decoration']:
        return 'decorate'
    return 'recolor' if (folder/asset/'composite.png').is_file() else 'skip'


def instance_counts(sources):
    counts = Counter(i['asset'] for i in sources.get('instances', []) if isinstance(i, dict))
    tiles = sources.get('width', 0) * sources.get('height', 0)
    grids = [v for v in sources.values() if isinstance(v, list) and tiles and len(v) == tiles]
    for variant in sources.get('variants', []):
        if variant.get('count'):
            counts[variant['id']] = variant['count']
        elif 'gid' in variant and grids and variant['id'] not in counts:
            counts[variant['id']] = sum(grid.count(variant['gid']) for grid in grids)
    return counts


def derived_rows(folder, status):
    results = status.get('object_results', {})
    sources = read_json(folder/'sources.json')
    if sources:
        counts = instance_counts(sources)
        variants = sources.get('variants', [])
    else:
        manifest = read_json(folder/'manifest.json') or {}
        counts = Counter()
        variants = [{'id': o['id'], 'kind': o.get('category'), 'width': o['box'][2], 'height': o['box'][3]}
                    for o in manifest.get('objects', [])]
        counts.update({v['id']: 1 for v in variants})
    rows = []
    for variant in variants:
        asset = variant['id']
        result = results.get(asset, {})
        shared = shared_request(folder, asset, result)
        info = generation(folder, shared)
        rows.append({'asset': asset, 'kind': variant.get('kind') or asset.rsplit('-', 1)[0],
                     'action': derived_action(folder, asset, result), 'instances': counts.get(asset) or None,
                     'prompt': info.get('prompt', ''), 'seed': info.get('seed'), 'model': info.get('model'),
                     'steps': info.get('steps'), 'generation': info.get('generation'),
                     'shared_request': shared if shared != asset else None,
                     'generation_seconds': result.get('generation_seconds'),
                     'frost_only': bool(result.get('frost_only')), 'gid': variant.get('gid'),
                     'size': [variant['width'], variant['height']] if 'width' in variant else None,
                     'images': images(folder, asset)})
    return rows


def plan_rows(folder, plan, status):
    rows = []
    for item in plan:
        asset = item['asset']
        instances = item.get('instances')
        info = generation(folder, asset if (folder/asset/'generation.json').is_file() else None)
        seed = item.get('seed') if isinstance(item.get('seed'), int) else info.get('seed')
        rows.append(dict(item, instances=len(instances) if isinstance(instances, list) else instances, seed=seed,
                         model=info.get('model'), steps=info.get('steps'), generation=info.get('generation'),
                         generation_seconds=status.get('object_results', {}).get(asset, {}).get('generation_seconds'),
                         images=images(folder, asset)))
    return rows


def changes(folder):
    status = read_json(folder/'status.json') or {}
    plan = read_json(folder/'plan.json')
    if plan is not None:
        Plan.model_validate(plan)  # raises pydantic.ValidationError on a contract violation
    rows = plan_rows(folder, plan, status) if plan is not None else derived_rows(folder, status)
    counts = Counter(row['action'] for row in rows)
    return {'id': folder.name, 'mapId': status.get('mapId', 'town'), 'pipeline': status.get('pipeline'),
            'prompt': status.get('prompt', ''), 'status': status.get('status'),
            'parent_run_id': status.get('parent_run_id'),
            'source': 'plan.json' if plan is not None else 'derived',
            'counts': {action: counts.get(action, 0) for action in ACTIONS},
            'rows': rows, 'dsl': read_json(folder/'dsl.json'), 'validation': read_json(folder/'validation.json'),
            'preview': url(folder, 'preview.png'), 'original': url(folder, 'original-map.png'),
            'review': url(folder, 'review.html')}
