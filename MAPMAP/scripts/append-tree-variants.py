"""town-32 의 색 변형 타일(나무 수관, 저택 지붕)을 시트 아래에 덧붙인다.

저택 지붕: 마을 시청(푸른 지붕)을 물레골 농원 저택으로 그대로 옮겨 쓰면 같은 건물로
보인다. 지붕의 파란 픽셀만 테라코타(따뜻한 갈색)로 바꾼 타일을 만들어, 같은 짜임이라도
다른 집으로 읽히게 한다(분수 물빛은 그대로).


LPC 나무(tree_med_a/b, tree_round, tree_autumn)는 외곽선이 진하고 명암이 거칠어 town
타일셋의 부드러운 파스텔 그림체와 섞이면 이질적이다. 그래서 맵의 나무는 town 나무 한
종으로 통일하고, 단조롭지 않게 수관 색만 바꾼 변형을 만든다(좌우 반전은 빛 방향이
뒤집혀 쓰지 않는다).

  deep   : 짙은 숲 초록(숲 안쪽·그늘)
  autumn : 주황 단풍(포인트)

append-cave-tiles.py 와 같은 규약: 기존 타일 id 는 건드리지 않고 PNG 아래에 행을 붙인 뒤
tsx 의 tilecount·이미지 높이와 townTilesetImageSize.ts 를 갱신한다. 멱등 — 기준
상태(1264칸)보다 크면 먼저 잘라낸 뒤 다시 붙인다. gid 는 scripts/tree-variant-gids.json 에
{변형: [[수관 3x3], [밑동 3]]} 로 기록한다.
"""
import colorsys
import json
import re

from PIL import Image

TSX = 'src/games/my-sample-rpg/assets/tilesets/town-32.tsx'
PNG = 'src/games/my-sample-rpg/assets/tilesets/town-32.png'
SIZE_TS = 'src/games/my-sample-rpg/rendering/townTilesetImageSize.ts'
OUT_GIDS = 'scripts/tree-variant-gids.json'

BASE_TILECOUNT = 1264
COLUMNS, TILE = 8, 32
TREE = [[326, 327, 328], [334, 335, 336], [342, 343, 344], [350, 351, 352]]   # 수관 3행 + 밑동


def shift_deep(h, s, v):
    return h + 0.04, min(1.0, s * 1.15), v * 0.74


def shift_autumn(h, s, v):
    # 밝은 잎은 주황, 어두운 잎은 붉은 갈색 쪽으로
    return (0.075 if v > 0.55 else 0.035), min(1.0, s * 1.25 + 0.1), min(1.0, v * 1.02)


VARIANTS = [('deep', shift_deep), ('autumn', shift_autumn)]

# 마을 시청(town.tmx 17..33, 0..16)에서 지붕이 파란 타일들
MANSION_BOX = (17, 0, 34, 17)


def is_roof_blue(r, g, b, a):
    if a < 200:
        return False
    h, s, _v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return 0.55 <= h <= 0.68 and s >= 0.25


def shift_terracotta(h, s, v):
    return 0.035, min(1.0, s * 0.9 + 0.1), min(1.0, v * 0.97)


def is_leaf(r, g, b, a):
    if a < 255:
        return False   # 반투명 접지 그림자는 그대로
    h, s, _v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return 0.14 <= h <= 0.48 and s >= 0.12


def recolor(tile, fn):
    out = tile.copy()
    px = out.load()
    for y in range(TILE):
        for x in range(TILE):
            r, g, b, a = px[x, y]
            if not is_leaf(r, g, b, a):
                continue
            h, s, v = fn(*colorsys.rgb_to_hsv(r / 255, g / 255, b / 255))
            nr, ng, nb = colorsys.hsv_to_rgb(h % 1.0, s, v)
            px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    return out


sheet = Image.open(PNG).convert('RGBA')
base_rows = BASE_TILECOUNT // COLUMNS
sheet = sheet.crop((0, 0, COLUMNS * TILE, base_rows * TILE))   # 멱등: 기준 상태로


def tile_of(gid):
    t = gid - 1
    return sheet.crop(((t % COLUMNS) * TILE, (t // COLUMNS) * TILE,
                       (t % COLUMNS) * TILE + TILE, (t // COLUMNS) * TILE + TILE))


new_tiles, gids = [], {}
for name, fn in VARIANTS:
    rows = []
    for row in TREE:
        out_row = []
        for g in row:
            new_tiles.append(recolor(tile_of(g), fn))
            out_row.append(BASE_TILECOUNT + len(new_tiles))   # 새 gid = 기존 개수 + 순번
        rows.append(out_row)
    gids[name] = {'canopy': rows[:3], 'trunk': rows[3]}

# ---- 저택 지붕 변형
town_src = open('src/games/my-sample-rpg/assets/maps/town.tmx', encoding='utf-8').read()
town_layers = [[int(v) for v in m.group(1).replace('\n', ',').split(',') if v.strip()]
               for m in re.finditer(r'<data encoding="csv">\s*([\d,\s]+?)</data>', town_src)]
mansion_gids = sorted({layer[y * 50 + x] for layer in town_layers
                       for y in range(MANSION_BOX[1], MANSION_BOX[3])
                       for x in range(MANSION_BOX[0], MANSION_BOX[2]) if layer[y * 50 + x]})
roof_map = {}
for g in mansion_gids:
    tile = tile_of(g)
    px = tile.load()
    changed = False
    for y in range(TILE):
        for x in range(TILE):
            r, gg, b, a = px[x, y]
            if is_roof_blue(r, gg, b, a):
                h, s_, v = shift_terracotta(*colorsys.rgb_to_hsv(r / 255, gg / 255, b / 255))
                nr, ng, nb = colorsys.hsv_to_rgb(h, s_, v)
                px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
                changed = True
    if changed:
        new_tiles.append(tile)
        roof_map[g] = BASE_TILECOUNT + len(new_tiles)
gids['mansion-roof-terracotta'] = roof_map

tilecount = BASE_TILECOUNT + len(new_tiles)
rows_total = -(-tilecount // COLUMNS)
out = Image.new('RGBA', (COLUMNS * TILE, rows_total * TILE), (0, 0, 0, 0))
out.paste(sheet, (0, 0))
for i, tile in enumerate(new_tiles):
    t = BASE_TILECOUNT + i
    out.paste(tile, ((t % COLUMNS) * TILE, (t // COLUMNS) * TILE))
out.save(PNG)

tsx = open(TSX, encoding='utf-8').read()
tsx = re.sub(r'tilecount="\d+"', f'tilecount="{tilecount}"', tsx)
tsx = re.sub(r'(<image source="town-32.png" width="\d+" height=")\d+(")', rf'\g<1>{out.height}\2', tsx)
# 새 타일 type 이름(에디터 사이드바·분류용) — 이전 실행분은 지우고 다시 쓴다
tsx = re.sub(r'\s*<tile id="\d+" type="tree_variant_[^"]*"/>', '', tsx)
lines = []
for name in [n for n in gids if n in dict(VARIANTS)]:
    for r, row in enumerate(gids[name]['canopy'] + [gids[name]['trunk']]):
        for c, g in enumerate(row):
            part = 'trunk' if r == 3 else f'canopy_r{r}'
            lines.append(f'  <tile id="{g - 1}" type="tree_variant_{name}_{part}_c{c}"/>')
for old, new in roof_map.items():
    lines.append(f'  <tile id="{new - 1}" type="mansion_roof_terracotta_from_{old - 1}"/>')
tsx = re.sub(r'\s*<tile id="\d+" type="mansion_roof_terracotta_[^"]*"/>', '', tsx)
tsx = tsx.replace('</tileset>', '\n'.join(lines) + '\n</tileset>')
open(TSX, 'w', encoding='utf-8', newline='\n').write(tsx)

size_ts = open(SIZE_TS, encoding='utf-8').read()
size_ts = re.sub(r'TOWN_TILESET_IMAGE_HEIGHT = \d+', f'TOWN_TILESET_IMAGE_HEIGHT = {out.height}', size_ts)
open(SIZE_TS, 'w', encoding='utf-8', newline='\n').write(size_ts)

json.dump(gids, open(OUT_GIDS, 'w', encoding='utf-8', newline='\n'), indent=1)
print(f'tilecount {tilecount}, height {out.height}, gids {gids}')
