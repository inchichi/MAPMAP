"""바이옴 타일(3장 눈 등) — 2장 늪 지형 도구와 신전(동굴) 도구가 쓰는 타일을 색만 바꿔 **따로 된 타일셋**
(assets/tilesets/biome-<바이옴>.png/.tsx, firstgid = town-32 다음 칸)에 담고, 원래 gid → 바이옴 gid 치환표를
scripts/biome-gids.json 에 쓴다. town-32 에 덧붙이지 않는 까닭: 시트 높이가 8192px 를 넘으면 WebGL 최대 텍스처
크기에 걸려 타일셋 전체가 검게 나온다(헤드리스 브라우저에서 9440px 로 실제로 그랬다). 생성기는 같은 코드로 맵을 만들고
TMX 를 쓸 때 치환표로 번호만 바꾼다(swamp_mapkit.SwampMap(biome=...)). 그래서 생성기 구조는 그대로 재사용한다.

사슬 순서: … → append-swamp-tiles → append-ruins-tiles → **이 스크립트**. 앞 단계를 다시 돌리면 이것도 다시 돌린다.
기준(BASE_SLOTS) 아래를 지우고 다시 붙이므로 멱등이다.

  snow  풀 → 눈(그늘은 푸른 회색), 흙 → 언 흙, 물 → 얼음(정지 — 흐르는 물은 cave_fill_Water 타일만 움직인다),
        돌 → 푸른 기, 잎 → 눈 덮인 짙은 침엽, 나무·소품 윗면에 눈(여러 칸짜리는 합친 그림에서 얹어 칸 경계에 줄이
        생기지 않게), 독안개 → 눈보라(snow_blizzard_* — 눈보라 장치가 이 이름을 읽는다), 안개 장막 → 눈더미.
"""
import colorsys
import json
import math
import re
import sys

from PIL import Image

TSX = 'src/games/my-sample-rpg/assets/tilesets/town-32.tsx'
PNG = 'src/games/my-sample-rpg/assets/tilesets/town-32.png'
BIOME_TSX = 'src/games/my-sample-rpg/assets/tilesets/biome-snow.tsx'
BIOME_PNG = 'src/games/my-sample-rpg/assets/tilesets/biome-snow.png'
TOWN_TMX = 'src/games/my-sample-rpg/assets/maps/town.tmx'
OUT_GIDS = 'scripts/biome-gids.json'
COLUMNS, TILE = 8, 32
PREV_TILECOUNT = 1798          # append-ruins-tiles.py 가 끝낸 상태
BASE_SLOTS = 1800              # 그 시트의 칸 수(225행)
TYPE_PREFIX = 'biome_'

SWAMP = json.load(open('scripts/swamp-tile-gids.json', encoding='utf-8'))
LPC = json.load(open('scripts/lpc-cave-gids.json', encoding='utf-8'))
KIT_PROPS = [1150, 1151, 1152, 527, 528, 463, 464, 1189, LPC['town_prop_cattail_r0c0'], LPC['town_prop_cattail_r1c0']]
CAVE_MATS = ['Mudstone_Gray', 'Dirt_Tan', 'Water', 'Water_Deep', 'Rock_Dark', 'Rock_Black']
CAVE_PAIRS = [('Dirt_Tan', 'Mudstone_Gray'), ('Dirt_Tan', 'Water'), ('Dirt_Tan', 'Rock_Black'),
              ('Mudstone_Gray', 'Rock_Dark'), ('Rock_Dark', 'Rock_Black'), ('Water', 'Water_Deep')]


# ---------------------------------------------------------------- 눈 색
SNOW_LIGHT = (244, 248, 252)
SNOW_SHADE = (170, 186, 208)


def lerp(a, b, t):
    return tuple(round(a[k] + (b[k] - a[k]) * t) for k in range(3))


def snow_pixel(r, g, b, foliage):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if v < 0.12:
        return (r, g, b)
    if 0.15 <= h <= 0.45 and s >= 0.15:            # 풀·잎
        if foliage:                                  # 잎: 눈 덮인 짙은 침엽
            nr, ng, nb = colorsys.hsv_to_rgb(0.42, min(1, s * 0.6), v * 0.62)
            return (round(nr * 255), round(ng * 255), round(nb * 255))
        return lerp(SNOW_SHADE, SNOW_LIGHT, min(1.0, max(0.0, (v - 0.25) / 0.55)))
    if 0.45 < h <= 0.7 and s >= 0.15:              # 물 → 얼음
        nr, ng, nb = colorsys.hsv_to_rgb(0.56, s * 0.45, min(1.0, 0.55 + v * 0.5))
        return (round(nr * 255), round(ng * 255), round(nb * 255))
    if s < 0.18:                                   # 돌·회색 → 푸른 기
        nr, ng, nb = colorsys.hsv_to_rgb(0.58, max(s, 0.10), min(1.0, v * 1.04))
        return (round(nr * 255), round(ng * 255), round(nb * 255))
    # 밝은 갈색·노랑(짚 지붕, 모래 둑) → 눈이 덮였다
    if v > 0.62 and s < 0.65:
        return lerp(SNOW_SHADE, SNOW_LIGHT, min(1.0, (v - 0.55) / 0.4))
    # 흙·나무(어두운 갈색) → 색상은 두고 차갑게 바랜다
    nr, ng, nb = colorsys.hsv_to_rgb(h, s * 0.45, min(1.0, v * 0.95))
    return (round(nr * 255), round(ng * 255), round(nb * 255))


def recolor(img, foliage=False):
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = snow_pixel(r, g, b, foliage) + (a,)
    return out


def snow_caps(img, depth=2):
    """윗면(위가 비어 있는 불투명 픽셀)에 눈을 얹는다 — 합친 그림 단위로."""
    out = img.copy()
    src = img.load()
    px = out.load()
    for x in range(img.width):
        for y in range(img.height):
            if src[x, y][3] < 128:
                continue
            if y == 0 or src[x, y - 1][3] < 128:
                for d in range(depth):
                    if y + d < img.height and src[x, y + d][3] >= 128:
                        px[x, y + d] = (lerp(SNOW_LIGHT, SNOW_SHADE, d / max(1, depth))) + (255,)
    return out


def blizzard(img, salt):
    """독안개 → 눈보라: 하얗게, 바람결 사선 줄무늬."""
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            streak = 0.15 if ((x + 2 * y + salt) % 11) < 2 else 0.0
            px[x, y] = (236, 242, 250, min(255, round(a * 0.9 + 255 * streak)))
    return out


# ---------------------------------------------------------------- 시트
def main():
    sheet = Image.open(PNG).convert('RGBA')
    tsx = open(TSX, encoding='utf-8').read()
    count = int(re.search(r'tilecount="(\d+)"', tsx).group(1))
    if count < PREV_TILECOUNT:
        sys.exit(f'tilecount {count} < {PREV_TILECOUNT}: append-ruins-tiles.py 를 먼저 돌린다')
    types = {int(i) + 1: t for i, t in re.findall(r'<tile id="(\d+)" type="([^"]+)"', tsx)}
    sheet = sheet.crop((0, 0, COLUMNS * TILE, (BASE_SLOTS // COLUMNS) * TILE))
    if count > PREV_TILECOUNT:      # 예전 판(town-32 에 덧붙였던 것)을 걷어 낸다
        sheet.save(PNG)
        tsx = re.sub(r'\s*<tile id="\d+" type="snow_[^"]*"/>', '', tsx)
        tsx = re.sub(r'tilecount="\d+"', f'tilecount="{PREV_TILECOUNT}"', tsx)
        tsx = re.sub(r'(<image source="town-32.png" width="\d+" height=")\d+(")', rf'\g<1>{sheet.height}\2', tsx)
        open(TSX, 'w', encoding='utf-8', newline='\n').write(tsx)
        size_ts_path = 'src/games/my-sample-rpg/rendering/townTilesetImageSize.ts'
        size_ts = open(size_ts_path, encoding='utf-8').read()
        size_ts = re.sub(r'TOWN_TILESET_IMAGE_HEIGHT = \d+', f'TOWN_TILESET_IMAGE_HEIGHT = {sheet.height}', size_ts)
        open(size_ts_path, 'w', encoding='utf-8', newline='\n').write(size_ts)

    def tile_of(gid):
        t = gid - 1
        return sheet.crop(((t % COLUMNS) * TILE, (t // COLUMNS) * TILE,
                           (t % COLUMNS) * TILE + TILE, (t // COLUMNS) * TILE + TILE))

    new_tiles = []
    remap = {}

    def add(old_gid, img, name=None):
        if old_gid in remap:
            return remap[old_gid]
        new_tiles.append((name or f'snow_{types.get(old_gid, old_gid)}', img))
        remap[old_gid] = BASE_SLOTS + len(new_tiles)
        return remap[old_gid]

    def add_group(grid, foliage=False):
        """여러 칸 그림(나무·고목)을 합쳐 칠하고 눈을 얹은 뒤 다시 칸으로 자른다."""
        rows, cols = len(grid), len(grid[0])
        whole = Image.new('RGBA', (cols * TILE, rows * TILE), (0, 0, 0, 0))
        for r, row in enumerate(grid):
            for c, gid in enumerate(row):
                if gid:
                    whole.alpha_composite(tile_of(gid), (c * TILE, r * TILE))
        whole = snow_caps(recolor(whole, foliage))
        for r, row in enumerate(grid):
            for c, gid in enumerate(row):
                if gid and gid not in remap:
                    add(gid, whole.crop((c * TILE, r * TILE, (c + 1) * TILE, (r + 1) * TILE)))

    # 지형(바닥·물가 덮개·풀 무늬) — 눈을 얹지 않는다
    for gid in [SWAMP['grass'], SWAMP['grass_alt'], SWAMP['mud'], *SWAMP['tufts'],
                *SWAMP['bank_water'].values(), *SWAMP['bank_mud'].values()]:
        add(gid, recolor(tile_of(gid)))
    add(SWAMP['water_fill'], recolor(tile_of(SWAMP['water_fill'])), 'snow_ice_fill')
    # 나무·고목(합쳐서 눈)
    add_group([*SWAMP['tree']['canopy'], SWAMP['tree']['trunk']], foliage=True)
    for tree in SWAMP['dead_trees']:
        add_group(tree['grid'])
    add_group(SWAMP['stele'])
    # 소품(한 칸 또는 위아래 두 칸)
    add_group([[LPC['town_prop_cattail_r0c0']], [LPC['town_prop_cattail_r1c0']]], foliage=True)
    for gid in KIT_PROPS[:8]:
        add_group([[gid]], foliage=gid in (1150, 1151, 1152))
    for gid in (SWAMP['deck_h'], SWAMP['deck_v'], SWAMP['raft']):
        add_group([[gid]])
    add(SWAMP['deck_shadow'], recolor(tile_of(SWAMP['deck_shadow'])))
    # 집(짚 지붕 오두막): 템플릿 상자 안의 모든 타일 — 지붕에 눈
    house = SWAMP['house_thatch']
    x0, y0, x1, y1 = house['box']
    mapping = {int(k): v for k, v in house['map'].items()}
    src = open(TOWN_TMX, encoding='utf-8').read()
    house_grids = []
    for m in re.finditer(r'<layer id="\d+" name="([^"]+)"[^>]*>\s*<data encoding="csv">\s*([\d,\s]+?)</data>', src):
        if m.group(1) == 'ground':
            continue
        vals = [int(v) for v in m.group(2).replace('\n', ',').split(',') if v.strip()]
        grid = [[(mapping.get(vals[y * 50 + x], vals[y * 50 + x]) if vals[y * 50 + x] not in house['props'] else 0)
                 for x in range(x0 + 1, x0 + 6)] for y in range(y0, y0 + 8)]
        house_grids.append(grid)
    for grid in house_grids:
        add_group(grid)
    # 눈보라·눈더미(독안개·장막을 바꿔)
    for i, gid in enumerate(SWAMP['fog']):
        add(gid, blizzard(tile_of(gid), i * 3), f'snow_blizzard_{i}')
    add(SWAMP['fog_edge_w'], blizzard(tile_of(SWAMP['fog_edge_w']), 5), 'snow_blizzard_edge_w')
    add(SWAMP['fog_wall'], snow_caps(recolor(tile_of(SWAMP['fog_wall'])), 3), 'snow_drift_wall')
    # 동굴(서리굴): 여섯 재질의 바닥·전환 타일
    for mat in CAVE_MATS:
        for key in sorted(k for k in LPC if k.startswith(f'cave_fill_{mat}_')):
            add(LPC[key], recolor(tile_of(LPC[key])), f'snow_{key}')
    for a, b in CAVE_PAIRS:
        for key in sorted(k for k in LPC if k.startswith(f'cave_edge_{a}__{b}_m')):
            add(LPC[key], recolor(tile_of(LPC[key])), f'snow_{key}')

    # 바이옴 타일셋: 칸 0 = gid BASE_SLOTS + 1 (firstgid). town-32 는 건드리지 않는다.
    rows_total = -(-len(new_tiles) // COLUMNS)
    out = Image.new('RGBA', (COLUMNS * TILE, rows_total * TILE), (0, 0, 0, 0))
    for i, (_name, img) in enumerate(new_tiles):
        out.paste(img, ((i % COLUMNS) * TILE, (i // COLUMNS) * TILE))
    out.save(BIOME_PNG)
    names = [n if n.startswith('snow_') else re.sub(r'[^A-Za-z0-9_]', '_', TYPE_PREFIX + n) for n, _ in new_tiles]
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             f'<tileset version="1.10" tiledversion="1.12.1" name="biome-snow" tilewidth="{TILE}" tileheight="{TILE}" '
             f'tilecount="{len(new_tiles)}" columns="{COLUMNS}">',
             f' <image source="biome-snow.png" width="{out.width}" height="{out.height}"/>']
    lines += [f' <tile id="{i}" type="{name}"/>' for i, name in enumerate(names)]
    lines.append('</tileset>')
    open(BIOME_TSX, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines) + '\n')
    json.dump({'snow': {'remap': {str(k): v for k, v in remap.items()}}}, open(OUT_GIDS, 'w', encoding='utf-8', newline='\n'),
              indent=1)
    print(f'biome tiles {len(new_tiles)} (gid {BASE_SLOTS + 1}..{BASE_SLOTS + len(new_tiles)}), {BIOME_PNG} {out.size}')


if __name__ == '__main__':
    main()
