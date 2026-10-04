"""Grade every used source tile, with audited category overrides shared by GID."""
from PIL import Image


def render_atlas(m, ts, atlas):
    tw, th, mw, mh = [int(m.get(k)) for k in ('tilewidth', 'tileheight', 'width', 'height')]
    first = int(m.find('tileset').get('firstgid'))
    cols = int(ts.get('columns'))
    result = Image.new('RGBA', (mw * tw, mh * th))
    used = set()
    for layer in m.findall('layer'):
        if layer.get('visible', '1') == '0':
            continue
        for index, raw in enumerate(int(v) for v in layer.find('data').text.replace('\n', '').split(',') if v.strip()):
            if not raw:
                continue
            gid = raw & 0x1fffffff
            used.add(gid)
            tid = gid - first
            x, y = tid % cols * tw, tid // cols * th
            if tid < 0 or x + tw > atlas.width or y + th > atlas.height:
                raise ValueError('Tile lies outside atlas')
            tile = atlas.crop((x, y, x + tw, y + th))
            if raw & 0x20000000: tile = tile.transpose(Image.Transpose.TRANSPOSE)
            if raw & 0x80000000: tile = tile.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            if raw & 0x40000000: tile = tile.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
            result.alpha_composite(tile, (index % mw * tw, index // mw * th))
    return result, used


def build(folder, map_id, direction, rows, objects):
    from theme_pipeline import sources
    from town_vision_pipeline import palette_color, save
    m, ts, source, hashes = sources(map_id)
    if len(m.findall('tileset')) != 1:
        raise ValueError('Full-map color requires one supported tileset; no partial fallback')
    atlas = palette_color(source, direction)
    # Category overrides originate in audited plans, never in theme-name rules.
    overrides = {}
    for row in rows:
        plan = row.get('document_plan', {})
        if plan.get('color') and plan.get('evidence_audit', {}).get('supported'):
            overrides.setdefault(row['kind'], {'color': plan['color'], 'asset': row['asset'], 'evidence': plan.get('evidence', [])})
    tw, th = int(ts.get('tilewidth')), int(ts.get('tileheight'))
    cols = int(ts.get('columns'))
    first = int(m.find('tileset').get('firstgid'))
    assignments = {}
    for obj in objects:
        kind = obj.get('recognition', {}).get('kind', obj.get('category'))
        if kind not in overrides:
            continue
        # Only proven tile membership can receive category color, including fragments.
        for gid in obj.get('tile_gids', []):
            if gid in assignments and assignments[gid] != kind:
                raise ValueError('Conflicting material categories for a shared tile')
            assignments[gid] = kind
    for gid, kind in assignments.items():
        tid = gid - first
        x, y = tid % cols * tw, tid // cols * th
        tile = source.crop((x, y, x + tw, y + th))
        atlas.paste(palette_color(tile, overrides[kind]['color']), (x, y))
    if atlas.size != source.size or atlas.getchannel('A').tobytes() != source.getchannel('A').tobytes():
        raise ValueError('Atlas geometry or alpha changed')
    original, used = render_atlas(m, ts, source)
    preview, _ = render_atlas(m, ts, atlas)
    report = {'used_tiles': len(used), 'covered_tiles': len(used), 'uncovered_tiles': [],
              'atlas_alpha_preserved': True, 'coverage_complete': True,
              'global_direction': direction, 'category_overrides': overrides,
              'category_tiles': {kind: sorted(g for g in used if assignments.get(g) == kind) for kind in overrides},
              'policy': 'Global RGB grading for every tile; audited category colors override it. Decoration eligibility does not exclude RGB grading.',
              'visual_review_required': True}
    atlas.save(folder / 'themed-atlas.png')
    save(folder, 'color-coverage.json', report)
    return original, preview, report
