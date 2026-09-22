"""Group manifest for maps whose tileset names its tiles (town-32.tsx): strip position suffixes
from the TSX `type` names, then each connected cluster of a group's cells on the map is one instance."""
import json, re, sys
import xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image
from contracts import GroupManifest

POSITION = {'top', 'upper', 'mid', 'middle', 'lower', 'bottom', 'left', 'right', 'center', 'centre'}
KINDS = [('roof', 'roof'), ('market', 'stall'), ('tree', 'tree'), ('fountain', 'fountain'), ('window', 'window'),
         ('door', 'door'), ('wall', 'wall'), ('banner', 'banner'), ('lamp', 'lamp'), ('flower', 'flower'),
         ('fence', 'fence'), ('planter', 'planter'), ('shadow', 'shadow'), ('stall', 'stall'), ('well', 'well')]
FLAGS = 0x1fffffff


def group_id(tile_type):
    parts = tile_type.split('_')
    while len(parts) > 1 and (parts[-1] in POSITION or parts[-1].isdigit()):
        parts.pop()
    return '_'.join(parts)


def kind_of(group):
    return next(((kind, 1.0) for word, kind in KINDS if word in group.split('_')), (group.split('_')[0], 0.5))


def load_map(repo, map_path):
    root = ET.parse(repo/map_path).getroot()
    ref = root.find('tileset')
    tsx = (repo/map_path).parent/ref.get('source')
    tileset = ET.parse(tsx).getroot()
    return root, tileset, tsx.resolve(), int(ref.get('firstgid'))


def layers(root):
    width = int(root.get('width'))
    for layer in root.findall('layer'):
        if layer.get('visible', '1') == '0': continue
        values = [int(v) for v in layer.find('data').text.replace('\n', '').split(',') if v.strip()]
        yield layer.get('name'), width, values


def build(repo, map_id, map_path):
    root, tileset, tsx, first = load_map(repo, map_path)
    tw, th = int(root.get('tilewidth')), int(root.get('tileheight'))
    types = {int(t.get('id')): t.get('type') or t.get('class') for t in tileset.findall('tile')}
    tile_ids, cells, layer_of = {}, {}, {}
    for tid, name in types.items():
        if name: tile_ids.setdefault(group_id(name), []).append(tid)
    for layer_name, width, values in layers(root):
        for index, raw in enumerate(values):
            name = types.get((raw & FLAGS)-first) if raw else None
            if not name: continue
            group = group_id(name)
            cells.setdefault(group, set()).add((index % width, index // width))
            layer_of.setdefault(group, layer_name)
    groups = []
    for group in sorted(cells):
        pending, instances = set(cells[group]), []
        while pending:
            stack, points = [pending.pop()], []
            while stack:
                x, y = stack.pop()
                points.append((x, y))
                for n in [(x+dx, y+dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]:
                    if n in pending:
                        pending.remove(n)
                        stack.append(n)
            xs, ys = [p[0] for p in points], [p[1] for p in points]
            instances.append({'x': min(xs)*tw, 'y': min(ys)*th, 'w': (max(xs)-min(xs)+1)*tw, 'h': (max(ys)-min(ys)+1)*th})
        kind, confidence = kind_of(group)
        groups.append({'group_id': group, 'kind': kind, 'confidence': confidence, 'source': 'tsx', 'layer': layer_of[group],
                       'tile_ids': sorted(tile_ids[group]), 'instances': sorted(instances, key=lambda i: (i['y'], i['x']))})
    manifest = {'version': 'group-manifest-v1', 'mapId': map_id, 'tileset': tsx.relative_to(repo.resolve()).as_posix(),
                'tile_size': [tw, th], 'groups': groups}
    return GroupManifest.model_validate(manifest).model_dump(exclude_none=True)


def crop(repo, map_path, group, instance):
    """RGBA crop of one instance with only this group's tiles (neighbours stay out of the source)."""
    root, tileset, tsx, first = load_map(repo, map_path)
    tw, th = int(root.get('tilewidth')), int(root.get('tileheight'))
    atlas = Image.open(tsx.parent/tileset.find('image').get('source')).convert('RGBA')
    cols = int(tileset.get('columns'))
    wanted = set(group['tile_ids'])
    out = Image.new('RGBA', (instance['w'], instance['h']))
    for _, width, values in layers(root):
        for index, raw in enumerate(values):
            tid = (raw & FLAGS)-first
            if not raw or tid not in wanted: continue
            x, y = index % width*tw-instance['x'], index // width*th-instance['y']
            if not (0 <= x < instance['w'] and 0 <= y < instance['h']): continue
            tile = atlas.crop((tid % cols*tw, tid // cols*th, (tid % cols+1)*tw, (tid // cols+1)*th))
            if raw & 0x20000000: tile = tile.transpose(Image.Transpose.TRANSPOSE)
            if raw & 0x80000000: tile = tile.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            if raw & 0x40000000: tile = tile.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
            out.alpha_composite(tile, (x, y))
    return out


if __name__ == '__main__':
    repo = Path(__file__).resolve().parents[2]
    print(json.dumps(build(repo, 'town', 'src/games/my-sample-rpg/assets/maps/town.tmx'), ensure_ascii=False, indent=2))
