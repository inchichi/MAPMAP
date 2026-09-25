"""Read-only pixel overlap audit. Reports candidates, never marks user failures."""
import argparse
import html
import json
import re
import uuid
from pathlib import Path

import numpy as np
from PIL import Image


def overlap(a, ax, ay, b, bx, by):
    left, top = max(ax, bx), max(ay, by)
    right = min(ax + a.shape[1], bx + b.shape[1])
    bottom = min(ay + a.shape[0], by + b.shape[0])
    if left >= right or top >= bottom:
        return 0
    return int(np.count_nonzero(a[top-ay:bottom-ay, left-ax:right-ax] &
                               b[top-by:bottom-by, left-bx:right-bx]))


def outside(mask, x, y, width, height):
    ys, xs = np.nonzero(mask)
    return int(np.count_nonzero((xs+x < 0) | (ys+y < 0) |
                               (xs+x >= width) | (ys+y >= height)))


def audit(root, run_id):
    if not re.fullmatch('[a-f0-9]{32}', run_id):
        raise ValueError('Invalid run ID')
    run = root / run_id
    spec = json.loads((run / 'sources.json').read_text(encoding='utf8'))
    plan = json.loads((run / 'plan.json').read_text(encoding='utf8'))
    selected = {row['asset'] for row in plan if row['action'] == 'decorate'}
    instances = spec['instances']
    masks = {}
    for p in instances:
        name = p['asset']
        if name not in masks:
            masks[name] = np.array(Image.open(run / f'{name}-original.png').convert('RGBA'))[:, :, 3] > 0
    width, height = spec['width']*spec['tile_size'], spec['height']*spec['tile_size']
    rows = []
    decorations = {}
    for name in selected:
        folder = run / name
        offset = json.loads((folder / 'placement.json').read_text(encoding='utf8'))
        mask = np.array(Image.open(folder / 'decoration.png').convert('RGBA'))[:, :, 3] > 0
        decorations[name] = (mask, offset)
    for index, p in enumerate(instances):
        name = p['asset']
        if name not in selected:
            continue
        mask, offset = decorations[name]
        x, y = p['x'] + offset['x'], p['y'] + offset['y']
        hits = []
        decoration_hits = []
        for other_index, q in enumerate(instances):
            if index == other_index:
                continue
            count = overlap(mask, x, y, masks[q['asset']], q['x'], q['y'])
            if count:
                hits.append({'instance': other_index, 'asset': q['asset'], 'pixels': count})
            if q['asset'] in decorations:
                other_mask, other_offset = decorations[q['asset']]
                count = overlap(mask, x, y, other_mask, q['x'] + other_offset['x'], q['y'] + other_offset['y'])
                if count:
                    decoration_hits.append({'instance': other_index, 'pixels': count})
        rows.append({'instance': index, 'asset': name, 'x': p['x'], 'y': p['y'],
                     'outside_pixels': outside(mask, x, y, width, height), 'foreign_hits': hits,
                     'decoration_hits': decoration_hits})
    output = run / 'audits' / uuid.uuid4().hex
    output.mkdir(parents=True)
    report = {'run_id': run_id, 'placements': len(rows), 'reference_instances': len(instances),
              'overlap_candidates': sum(bool(r['foreign_hits']) for r in rows),
              'boundary_candidates': sum(r['outside_pixels'] > 0 for r in rows),
              'decoration_overlap_candidates': sum(bool(r['decoration_hits']) for r in rows),
              'scope': 'Selected decoration alpha versus other extracted original instances, other selected decorations and map bounds. Does not check walls, characters, inherited decorations or visual quality.',
              'user_marked_failure': False, 'rows': rows}
    (output / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf8')
    preview = Image.open(run / 'preview.png').convert('RGB')
    cards = []
    for row in rows:
        x, y = row['x'], row['y']
        file = f"instance-{row['instance']}.png"
        preview.crop((x-24, y-24, x+40, y+40)).save(output / file)
        label = f"{row['asset']} ({x}, {y}) · overlap {len(row['foreign_hits'])} · deco {len(row['decoration_hits'])} · outside {row['outside_pixels']}"
        cards.append(f'<figure><img src="{file}"><figcaption>{html.escape(label)}</figcaption></figure>')
    summary = {k: v for k, v in report.items() if k != 'rows'}
    (output / 'review.html').write_text('<meta charset="utf-8"><title>Placement audit</title><style>body{background:#202127;color:#eee;font:14px sans-serif}main{display:flex;flex-wrap:wrap}figure{margin:8px;width:256px}img{width:256px;image-rendering:pixelated}pre{white-space:pre-wrap}</style><h1>Placement audit</h1><pre>' + html.escape(json.dumps(summary, indent=2)) + '</pre><main>' + ''.join(cards) + '</main>', encoding='utf8')
    return output, summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('run_id')
    args = parser.parse_args()
    output, summary = audit(Path(__file__).resolve().parents[2] / 'public/theme-runs', args.run_id)
    print(json.dumps({'output': str(output), **summary}, indent=2))
