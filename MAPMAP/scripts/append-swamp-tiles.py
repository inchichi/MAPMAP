"""2장 늪 지역 타일을 town-32 시트 맨 아래에 덧붙인다 (덧붙이기 사슬의 마지막 단계).

사슬 순서: generate-transition-tiles → append-cave-tiles → append-tree-variants → **이 스크립트**.
앞 단계를 다시 돌리면 시트가 잘려 이 타일이 사라지므로, 그때는 이 스크립트도 다시 돌린다.
기준(BASE_SLOTS)보다 아래는 지우고 다시 붙이므로 몇 번 돌려도 결과가 같다(멱등).

그림체: 바닥·나무는 1장처럼 town 타일셋을 늪 색으로 바꿔 쓰고(docs/chapter2-art-candidates.md
의 비교안 C), 잎 없는 고목만 LPC([LPC] Trees, CC-BY-SA 3.0)를 쓴다. 고목은 잎이 없어 LPC
특유의 진한 명암이 town 그림체와 덜 부딪힌다(notes/shots/ch2-style/ 비교 그림).

경계 — 1장 맵의 약점이 경계였다(상하좌우 4방향 마스크라 안쪽 모서리가 각지고 같은 모양이
줄지어 반복된다). 여기서는:
  * 꼭짓점 4개(TL·TR·BL·BR)가 풀인지로 모양을 정하는 16가지 꼭짓점 타일. 대각선·안쪽 모서리가
    둥글게 이어진다. 생성기는 칸이 아니라 꼭짓점마다 재질을 정한다.
  * 경계선이 타일 변을 지나는 자리를 변마다 가운데·좌·우(±7px) 중에서 고른다. 이웃 타일과
    같은 변을 공유하므로 생성기가 변 좌표의 해시로 정하면 선이 끊기지 않고, 32px 마다 같은
    리듬으로 반복되는 톱니 모양이 사라진다. 안쪽에서는 결정적 잡음으로 굽이친다.
    gid 표: bank_<water|mud>["<마스크>:<n e s w 이동, 0/1/2>"].
  * 풀 쪽 가장자리를 어둡게(젖은 흙), 물 쪽에 반투명 그림자 띠(둑의 깊이)를 둔다.
  * 경계 타일은 투명 바탕의 '풀 덮개'다. 물/진흙 칸은 바닥 레이어에 그대로 두고 덮개를
    shadow_lower 레이어에 얹는다. 그래서 흐르는 물 렌더링(cave_fill_Water_*)이 물가 끝까지
    움직인다 — 물가 타일에 물을 그려 넣으면 그 부분만 멈춰 보인다.

출력: town-32.png / town-32.tsx / rendering/townTilesetImageSize.ts / scripts/swamp-tile-gids.json
"""
import colorsys
import json
import math
import os
import re
import sys
from collections import deque

from PIL import Image

TSX = 'src/games/my-sample-rpg/assets/tilesets/town-32.tsx'
PNG = 'src/games/my-sample-rpg/assets/tilesets/town-32.png'
SIZE_TS = 'src/games/my-sample-rpg/rendering/townTilesetImageSize.ts'
OUT_GIDS = 'scripts/swamp-tile-gids.json'
BRIDGE_PNG = os.environ.get(
    'LPC_WOOD_BRIDGE', '../art-src/ch2/5-lpc-wood-bridges/bridge-wood-square_0.png')
TOWN_TMX = 'src/games/my-sample-rpg/assets/maps/town.tmx'
HOUSE_BOX = (12, 30, 19, 40)        # town.tmx 의 붉은 지붕 오두막(물레골이 찍는 것과 같은 집)
HOUSE_PROPS = {412, 419, 420, 433, 326, 327, 328, 334, 335, 336, 342, 343, 344, 350, 351, 352}
DEAD_TREES_PNG = os.environ.get(
    'LPC_DEAD_TREES', '../art-src/ch2/3-lpc-trees/lpc-trees/trees-dead.png')

COLUMNS, TILE = 8, 32
PREV_TILECOUNT = 1350          # append-tree-variants.py 가 끝낸 상태
BASE_SLOTS = 1352              # 그 시트의 칸 수(169행) — 새 타일은 다음 행부터
TYPE_PREFIX = 'swamp_'

GRASS, GRASS_ALT, DIRT = 517, 457, 507
# 고목 후보(잎 없는 것 13그루, 위에서 아래·왼쪽에서 오른쪽 순) 중 쓸 것. 그림자가 발밑에 깔리는
# 것만 남긴다 — town 나무 그림자가 발밑 타원이라, 오른쪽 위로 길게 뻗는 그림자(2·8·10·11·12)는
# 빛 방향이 어긋나 보인다. 6·12 는 뿌리에 주황 잎이 남아 있다. notes/shots/ch2-style/deadtrees.png
DEAD_TREE_KEEP = (0, 1, 3, 4, 5, 7, 9)
STELE_HALF_WIDTH = 30   # 잘린 LPC 비석의 왼쪽 끝~가운데 폭(px) — notes/shots/ch2-style/stele-try.png
TUFTS = [458, 459, 460, 461, 462]
TREE = [[326, 327, 328], [334, 335, 336], [342, 343, 344], [350, 351, 352]]

# 꼭짓점 비트: 1=TL 2=TR 4=BL 8=BR (켜짐 = 그 꼭짓점이 풀)


def h32(*vals):
    """결정적 의사난수 [0,1)."""
    x = 2166136261
    for v in vals:
        x = ((x ^ (v & 0xFFFFFFFF)) * 16777619) & 0xFFFFFFFF
    return x / 0xFFFFFFFF


# ---------------------------------------------------------------- 색 바꾸기
def shift_pixels(img, fn, select):
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0 or not select(r, g, b, a):
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            h, s, v = fn(h, s, v)
            nr, ng, nb = colorsys.hsv_to_rgb(h % 1.0, max(0.0, min(1.0, s)), max(0.0, min(1.0, v)))
            px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    return out


def is_green(r, g, b, a):
    h, s, _v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return 0.10 <= h <= 0.50 and s >= 0.10


def is_leaf(r, g, b, a):
    return a == 255 and is_green(r, g, b, a)


def swamp_grass(h, s, v):
    # 이끼 낀 탁한 초록: 노랑 쪽으로 조금, 채도·밝기를 낮춘다(갈색으로 가지 않게 h 는 조금만)
    return h + 0.005, s * 0.70, v * 0.74


def swamp_canopy(h, s, v):
    return h - 0.01, s * 0.75, v * 0.72


def wet_mud(h, s, v):
    # 마른 흙(황갈색) → 젖은 진흙(어두운 갈색)
    return 0.07, min(1.0, s * 1.05 + 0.05), v * 0.55


# ---------------------------------------------------------------- 꼭짓점 경계
def smooth(t):
    return t * t * (3 - 2 * t)


CROSS_SHIFT = 0.22   # 경계선이 타일 변을 지나는 자리: 가운데에서 ±7px (변마다 생성기가 고른다)
SIDE_ORDER = ('n', 'e', 's', 'w')


def crossing_sides(mask):
    """경계선이 지나는 변(양 끝 꼭짓점의 재질이 다른 변)."""
    tl, tr, bl, br = (mask & 1 != 0), (mask & 2 != 0), (mask & 4 != 0), (mask & 8 != 0)
    return {'n': tl != tr, 'e': tr != br, 's': bl != br, 'w': tl != bl}


def warp(t, shift):
    """[0,1] → [0,1] 단조 함수. 0.5+shift 를 0.5 로 보낸다(경계선이 그 자리를 지나게)."""
    m = 0.5 + shift
    return 0.5 * t / m if t <= m else 0.5 + 0.5 * (t - m) / (1 - m)


def field(mask, shifts, salt, x, y):
    """픽셀 중심에서 '풀다움' 값(0.5 초과 = 풀).

    shifts: 변별 경계 위치 {'n','e','s','w': -1|0|1}. 위·아래 변의 이동은 v 에 따라,
    왼·오른 변의 이동은 u 에 따라 섞어 안쪽까지 매끄럽게 이어진다. 이웃 타일은 같은 변을
    같은 값으로 고르므로(생성기가 변 좌표로 정한다) 경계선이 끊기지 않는다."""
    u = (x + 0.5) / TILE
    v = (y + 0.5) / TILE
    uu = (1 - v) * warp(u, shifts['n'] * CROSS_SHIFT) + v * warp(u, shifts['s'] * CROSS_SHIFT)
    vv = (1 - u) * warp(v, shifts['w'] * CROSS_SHIFT) + u * warp(v, shifts['e'] * CROSS_SHIFT)
    tl, tr = float(mask & 1 != 0), float(mask & 2 != 0)
    bl, br = float(mask & 4 != 0), float(mask & 8 != 0)
    su, sv = smooth(uu), smooth(vv)
    base = (tl * (1 - su) + tr * su) * (1 - sv) + (bl * (1 - su) + br * su) * sv
    # 안쪽에서만 굽이치는 잡음: 변에서 0
    edge = min(u, 1 - u, v, 1 - v) * 2
    w = smooth(min(1.0, edge * 2.2))
    n = 0.0
    for k, (freq, amp) in enumerate([(1.7, 0.22), (3.5, 0.09), (7.0, 0.04)]):
        n += amp * (value_noise(u * freq, v * freq, salt * 7 + k) - 0.5) * 2
    return base + n * w


def value_noise(x, y, salt):
    x0, y0 = math.floor(x), math.floor(y)
    fx, fy = smooth(x - x0), smooth(y - y0)
    a = h32(x0, y0, salt)
    b = h32(x0 + 1, y0, salt)
    c = h32(x0, y0 + 1, salt)
    d = h32(x0 + 1, y0 + 1, salt)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def distance_to(cells, inside):
    """inside(True/False) 칸들에서, 반대편 칸까지의 맨해튼 거리(최대 4)."""
    dist = {}
    q = deque()
    for y in range(TILE):
        for x in range(TILE):
            if cells[y][x] != inside:
                continue
            if any(0 <= x + dx < TILE and 0 <= y + dy < TILE and cells[y + dy][x + dx] != inside
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                dist[(x, y)] = 1
                q.append((x, y))
    while q:
        x, y = q.popleft()
        d = dist[(x, y)]
        if d >= 4:
            continue
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < TILE and 0 <= ny < TILE and cells[ny][nx] == inside and (nx, ny) not in dist:
                dist[(nx, ny)] = d + 1
                q.append((nx, ny))
    return dist


def shift_key(shifts):
    """변별 이동 → 타일 이름·gid 표의 열쇠 'nesw' 각 자리 0/1/2 (= -1/0/+1)."""
    return ''.join(str(shifts[k] + 1) for k in SIDE_ORDER)


def bank_overlay(grass_tex, mask, shifts, kind):
    """투명 바탕 위 풀 덮개. kind: 'water' | 'mud'."""
    salt = mask * 131 + int(shift_key(shifts), 3) * 17
    cells = [[field(mask, shifts, salt, x, y) > 0.5 for x in range(TILE)] for y in range(TILE)]
    out = Image.new('RGBA', (TILE, TILE), (0, 0, 0, 0))
    po = out.load()
    gp = grass_tex.load()
    inner = distance_to(cells, True)
    outer = distance_to(cells, False)
    salt += 0 if kind == 'water' else 999
    for y in range(TILE):
        for x in range(TILE):
            r, g, b, a = gp[x, y]
            if cells[y][x]:
                d = inner.get((x, y))
                k = 1.0
                if d == 1:
                    k = 0.62 if kind == 'water' else 0.78    # 젖은 가장자리
                elif d == 2:
                    k = 0.80 if kind == 'water' else 0.90
                po[x, y] = (round(r * k), round(g * k), round(b * k), 255)
            else:
                d = outer.get((x, y))
                # 경계 밖으로 삐져나온 풀잎 몇 픽셀(칼로 자른 선을 흐린다)
                if d == 1 and h32(x, y, salt) < 0.22:
                    po[x, y] = (round(r * 0.7), round(g * 0.7), round(b * 0.7), 255)
                elif kind == 'water' and d is not None and d <= 2:
                    po[x, y] = (18, 26, 20, 110 if d == 1 else 55)   # 둑 그림자
                elif kind == 'mud' and d == 1:
                    po[x, y] = (30, 22, 14, 70)
    # 타일 변에서 경계선이 지나는 곳이 이웃과 맞는지 확인(가운데 ±1px)
    return out


# ---------------------------------------------------------------- LPC 고목
def find_sprites(img):
    """알파 연결 요소 → (x0,y0,x1,y1) 목록."""
    w, h = img.size
    a = img.getchannel('A').load()
    seen = bytearray(w * h)
    boxes = []
    for y in range(h):
        for x in range(w):
            if a[x, y] == 0 or seen[y * w + x]:
                continue
            q = deque([(x, y)])
            seen[y * w + x] = 1
            x0 = x1 = x
            y0 = y1 = y
            n = 0
            while q:
                cx, cy = q.popleft()
                n += 1
                x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and a[nx, ny] > 0:
                            seen[ny * w + nx] = 1
                            q.append((nx, ny))
            if n > 400:
                boxes.append((x0, y0, x1 + 1, y1 + 1))
    return boxes


def leafiness(img):
    """잎(초록·주황 덩어리) 비율 — 잎 없는 나무만 고르려고."""
    px = img.load()
    leaf = total = 0
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a < 200:
                continue
            total += 1
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s > 0.45 and v > 0.45:
                leaf += 1
    return leaf / max(1, total)


def trunk_foot(img):
    """불투명(줄기) 픽셀의 가장 아래 줄 가운데 x, 그 y."""
    px = img.load()
    for y in range(img.height - 1, -1, -1):
        xs = [x for x in range(img.width) if px[x, y][3] >= 250]
        if xs:
            return (min(xs) + max(xs)) // 2, y
    return img.width // 2, img.height - 1


def slice_tree(sprite):
    """고목 한 그루를 타일 격자로. 줄기 밑동이 아래 줄 가운데 칸 바닥에서 4px 위에 오게."""
    fx, fy = trunk_foot(sprite)
    cols = max(1, math.ceil(max(fx, sprite.width - fx) * 2 / TILE))
    if cols % 2 == 0:
        cols += 1
    foot_col = cols // 2
    left = foot_col * TILE + TILE // 2 - fx
    bottom_pad = 4
    rows = math.ceil((fy + 1 + bottom_pad + max(0, sprite.height - fy - 1)) / TILE)
    canvas = Image.new('RGBA', (cols * TILE, rows * TILE), (0, 0, 0, 0))
    top = rows * TILE - bottom_pad - (fy + 1)
    canvas.alpha_composite(sprite, (left, top))
    grid = [[canvas.crop((c * TILE, r * TILE, (c + 1) * TILE, (r + 1) * TILE)) for c in range(cols)]
            for r in range(rows)]
    return grid, foot_col


def main():
    sheet = Image.open(PNG).convert('RGBA')
    tsx = open(TSX, encoding='utf-8').read()
    count = int(re.search(r'tilecount="(\d+)"', tsx).group(1))
    if count < PREV_TILECOUNT:
        sys.exit(f'tilecount {count} < {PREV_TILECOUNT}: append-tree-variants.py 를 먼저 돌린다')
    sheet = sheet.crop((0, 0, COLUMNS * TILE, (BASE_SLOTS // COLUMNS) * TILE))

    def tile_of(gid):
        t = gid - 1
        return sheet.crop(((t % COLUMNS) * TILE, (t // COLUMNS) * TILE,
                           (t % COLUMNS) * TILE + TILE, (t // COLUMNS) * TILE + TILE))

    new_tiles = []   # (type_name, image)

    def add(name, img):
        new_tiles.append((name, img))
        return BASE_SLOTS + len(new_tiles)   # gid = 칸 번호 + 1

    gids = {}
    grass = shift_pixels(tile_of(GRASS), swamp_grass, is_green)
    gids['grass'] = add('swamp_grass', grass)
    gids['grass_alt'] = add('swamp_grass_alt', shift_pixels(tile_of(GRASS_ALT), swamp_grass, is_green))
    gids['tufts'] = [add(f'swamp_tuft_{i}', shift_pixels(tile_of(g), swamp_grass, is_green))
                     for i, g in enumerate(TUFTS)]
    gids['water_fill'] = json.load(open('scripts/lpc-cave-gids.json', encoding='utf-8'))['cave_fill_Water_00']
    gids['mud'] = add('swamp_mud', shift_pixels(tile_of(DIRT), wet_mud, lambda *p: True))

    # 경계 덮개: 모양(꼭짓점 마스크)마다, 경계가 지나는 변의 위치(-1/0/+1) 조합을 모두 만든다.
    # 대각선 두 모양(6, 9)은 네 변을 다 지나 조합이 81가지라 가운데(0)만 둔다(드물게 쓰인다).
    import itertools
    for kind in ('water', 'mud'):
        table = {}
        for mask in range(1, 15):
            cross = [k for k, c in crossing_sides(mask).items() if c]
            options = [(0,)] * len(cross) if len(cross) == 4 else [(-1, 0, 1)] * len(cross)
            for combo in itertools.product(*options):
                shifts = {k: 0 for k in SIDE_ORDER}
                shifts.update(dict(zip(cross, combo)))
                key = shift_key(shifts)
                table[f'{mask}:{key}'] = add(f'swamp_bank_{kind}_m{mask:02d}_{key}',
                                             bank_overlay(grass, mask, shifts, kind))
        gids[f'bank_{kind}'] = table

    # 룬 비석 2x2. LPC 소품 시트(lpc/sheet__props.png)의 stele_rune 은 시트를 만들 때 오른쪽
    # 3분의 1이 잘려 나갔다(이름표 열도 한 칸 밀려 있다: r?c0 은 금 기둥 조각). 남은 왼쪽 절반을
    # 좌우로 뒤집어 붙인 대칭 비석을 만든다 — 둥근 비석이라 대칭이 자연스럽고 글자는 룬이다.
    lpc_gids = json.load(open('scripts/lpc-cave-gids.json', encoding='utf-8'))
    src = Image.new('RGBA', (TILE * 2, TILE * 2), (0, 0, 0, 0))
    for r, name in enumerate(('cave_prop_stele_rune_r0c1', 'cave_prop_stele_rune_r1c1')):
        src.alpha_composite(tile_of(lpc_gids[name]), (0, r * TILE))
        src.alpha_composite(tile_of(lpc_gids[name.replace('c1', 'c2')]), (TILE, r * TILE))
    half = STELE_HALF_WIDTH
    left = src.crop((0, 0, half, TILE * 2))
    stele = Image.new('RGBA', (TILE * 2, TILE * 2), (0, 0, 0, 0))
    offset = TILE - half
    stele.alpha_composite(left, (offset, 0))
    stele.alpha_composite(left.transpose(Image.FLIP_LEFT_RIGHT), (offset + half, 0))
    gids['stele'] = [[add(f'swamp_stele_r{r}c{c}', stele.crop((c * TILE, r * TILE, (c + 1) * TILE, (r + 1) * TILE)))
                      for c in range(2)] for r in range(2)]

    canopy = []
    for r, row in enumerate(TREE):
        out_row = []
        for c, g in enumerate(row):
            img = tile_of(g) if r == 3 else shift_pixels(tile_of(g), swamp_canopy, is_leaf)
            out_row.append(add(f'swamp_tree_{"trunk" if r == 3 else f"canopy_r{r}"}_c{c}', img))
        canopy.append(out_row)
    gids['tree'] = {'canopy': canopy[:3], 'trunk': canopy[3]}

    dead = Image.open(DEAD_TREES_PNG).convert('RGBA')
    picks = []
    for box in sorted(find_sprites(dead), key=lambda b: (b[1] // 120, b[0])):
        w, h = box[2] - box[0], box[3] - box[1]
        if not (60 <= w <= 170 and 100 <= h <= 175):
            continue
        sprite = dead.crop(box)
        if leafiness(sprite) > 0.08:
            continue
        picks.append((box, sprite))
    picks = [p for i, p in enumerate(picks) if i in DEAD_TREE_KEEP]
    gids['dead_trees'] = []
    for i, (box, sprite) in enumerate(picks):
        grid, foot_col = slice_tree(sprite)
        g_rows = [[add(f'swamp_deadtree_{i}_r{r}c{c}', t) for c, t in enumerate(row)]
                  for r, row in enumerate(grid)]
        gids['dead_trees'].append({'source_box': list(box), 'grid': g_rows, 'foot_col': foot_col})

    # 아래 타일은 갈대골(2장 두 번째 맵)에서 더했다. 앞 타일의 gid 가 밀리지 않게 늘 맨 뒤에 붙인다.
    # ---- 갈대골 초가: town 오두막의 붉은 기와 → 짚 지붕, 흰 벽돌 → 흙벽. 문·창·꽃상자는 그대로.
    town = open(TOWN_TMX, encoding='utf-8').read()
    town_layers = [[int(v) for v in mm.group(1).replace(chr(10), ',').split(',') if v.strip()]
                   for mm in re.finditer(r'<data encoding="csv">\s*([\d,\s]+?)</data>', town)]
    x0, y0, x1, y1 = HOUSE_BOX
    house_gids = sorted({layer[y * 50 + x] for layer in town_layers for y in range(y0, y1)
                         for x in range(x0, x1) if layer[y * 50 + x] and layer[y * 50 + x] not in HOUSE_PROPS})

    def thatch(img):
        out = img.copy()
        px = out.load()
        for yy in range(TILE):
            for xx in range(TILE):
                r, g, b, a = px[xx, yy]
                if a == 0:
                    continue
                h, s_, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if (h >= 0.94 or h <= 0.045) and s_ >= 0.35:          # 붉은 기와 → 짚
                    h, s_, v = 0.11, s_ * 0.62, min(1.0, v * 1.02)
                elif s_ <= 0.12 and v >= 0.62:                         # 흰 벽돌 → 흙벽
                    h, s_, v = 0.085, 0.24, v * 0.86
                else:
                    continue
                nr, ng, nb = colorsys.hsv_to_rgb(h, s_, v)
                px[xx, yy] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
        return out

    house_map = {}
    for g in house_gids:
        before = tile_of(g)
        after = thatch(before)
        if list(after.getdata()) != list(before.getdata()):
            house_map[g] = add(f'swamp_house_from_{g - 1}', after)
    gids['house_thatch'] = {'box': list(HOUSE_BOX), 'props': sorted(HOUSE_PROPS), 'map': house_map}

    # ---- 나무 데크(늪 위 길): [LPC] 판자 다리(Xenodora, CC-BY-SA 3.0). 가로·세로 판자를 32px 로
    # 잘라 이어 붙일 수 있게 하고, 데크 남쪽 물 칸에 드리우는 그림자 띠를 따로 둔다.
    bridge = Image.open(BRIDGE_PNG).convert('RGBA')
    gids['deck_h'] = add('swamp_deck_h', bridge.crop((160, 96, 192, 128)))
    gids['deck_v'] = add('swamp_deck_v', bridge.crop((96, 32, 128, 64)))
    shadow = Image.new('RGBA', (TILE, TILE), (0, 0, 0, 0))
    sp = shadow.load()
    for yy in range(10):
        for xx in range(TILE):
            sp[xx, yy] = (14, 22, 18, round(120 * (1 - yy / 10)))
    gids['deck_shadow'] = add('swamp_deck_shadow', shadow)
    # 나룻배(1칸, 나루 포탈 그림): 세로 판자를 둥근 뗏목 모양으로 오리고 판자 틈은 짙은 나무색으로.
    raft = Image.new('RGBA', (TILE, TILE), (0, 0, 0, 0))
    planks = bridge.crop((96, 32, 128, 64))
    rp, pp = raft.load(), planks.load()
    for yy in range(TILE):
        for xx in range(TILE):
            dx, dy = (xx - 15.5) / 14.5, (yy - 18) / 10.5
            d = dx * dx + dy * dy
            if d <= 1:
                r, g, b, a = pp[xx, yy]
                rp[xx, yy] = (r, g, b, 255) if a > 0 else (72, 44, 24, 255)
            elif d <= 1.2:
                rp[xx, yy] = (40, 26, 16, 255)
    gids['raft'] = add('swamp_raft', raft)

    # 아래 타일은 잠긴숲(c2-03)에서 더했다 — 독안개. roof 레이어(캐릭터 위)에 깐다.
    # 이어 붙여도 이음새가 없게 주기 경계가 맞는 값 잡음(한 칸 주기)으로 짙기를 정한다.
    def fog_tile(salt, alpha_lo, alpha_hi, ramp=None):
        img = Image.new('RGBA', (TILE, TILE), (0, 0, 0, 0))
        fp = img.load()
        for yy in range(TILE):
            for xx in range(TILE):
                n = 0.0
                for k, (freq, amp) in enumerate([(2, 0.55), (4, 0.3), (8, 0.15)]):
                    u, v = xx / TILE * freq, yy / TILE * freq
                    x0, y0 = int(u) % freq, int(v) % freq
                    fx, fy = smooth(u - int(u)), smooth(v - int(v))
                    c = [[h32(x0 + i, y0 + j, salt + k) if True else 0 for i in (0, 1)] for j in (0, 1)]
                    c = [[h32((x0 + i) % freq, (y0 + j) % freq, salt + k) for i in (0, 1)] for j in (0, 1)]
                    n += amp * ((c[0][0] * (1 - fx) + c[0][1] * fx) * (1 - fy) + (c[1][0] * (1 - fx) + c[1][1] * fx) * fy)
                a = alpha_lo + (alpha_hi - alpha_lo) * n
                if ramp == 'w':
                    a *= smooth(xx / (TILE - 1))           # 서쪽 끝에서 0 → 동쪽으로 짙어진다
                fp[xx, yy] = (176, 196, 164, round(255 * max(0.0, min(1.0, a))))
        return img

    gids['fog'] = [add(f'swamp_fog_{i}', fog_tile(700 + i * 11, 0.30, 0.62)) for i in range(3)]
    gids['fog_edge_w'] = add('swamp_fog_edge_w', fog_tile(760, 0.30, 0.62, ramp='w'))
    # 안개 장막(상호작용 오브젝트 그림): 희뿌연 둥근 안개 덩어리. 가운데는 거의 불투명, 가장자리로 갈수록
    # 부드럽게 사라진다(네모 모서리가 보이지 않게 칸 안에서 완전히 0 이 된다).
    wall = fog_tile(790, 0.0, 1.0)
    wp = wall.load()
    for yy in range(TILE):
        for xx in range(TILE):
            _r, _g, _b, a = wp[xx, yy]
            d = math.hypot((xx - 15.5) / 15.5, (yy - 16.5) / 15.5)
            body = max(0.0, min(1.0, (1.0 - d) / 0.45))
            shade = 0.86 + 0.14 * (a / 255)
            wp[xx, yy] = (round(214 * shade), round(226 * shade), round(208 * shade), round(255 * 0.95 * body))
    gids['fog_wall'] = add('swamp_fog_wall', wall)

    total_slots = BASE_SLOTS + len(new_tiles)
    rows_total = -(-total_slots // COLUMNS)
    out = Image.new('RGBA', (COLUMNS * TILE, rows_total * TILE), (0, 0, 0, 0))
    out.paste(sheet, (0, 0))
    for i, (_name, img) in enumerate(new_tiles):
        t = BASE_SLOTS + i
        out.paste(img, ((t % COLUMNS) * TILE, (t // COLUMNS) * TILE))
    out.save(PNG)

    tsx = re.sub(r'\s*<tile id="\d+" type="' + TYPE_PREFIX + r'[^"]*"/>', '', tsx)
    tsx = re.sub(r'tilecount="\d+"', f'tilecount="{total_slots}"', tsx)
    tsx = re.sub(r'(<image source="town-32.png" width="\d+" height=")\d+(")', rf'\g<1>{out.height}\2', tsx)
    lines = [f'  <tile id="{BASE_SLOTS + i}" type="{name}"/>' for i, (name, _img) in enumerate(new_tiles)]
    tsx = tsx.replace('</tileset>', '\n'.join(lines) + '\n</tileset>')
    open(TSX, 'w', encoding='utf-8', newline='\n').write(tsx)

    size_ts = open(SIZE_TS, encoding='utf-8').read()
    size_ts = re.sub(r'TOWN_TILESET_IMAGE_HEIGHT = \d+', f'TOWN_TILESET_IMAGE_HEIGHT = {out.height}', size_ts)
    open(SIZE_TS, 'w', encoding='utf-8', newline='\n').write(size_ts)

    json.dump(gids, open(OUT_GIDS, 'w', encoding='utf-8', newline='\n'), indent=1)
    print(f'swamp tiles {len(new_tiles)} (gid {BASE_SLOTS + 1}..{total_slots}), '
          f'dead trees {len(picks)}, sheet height {out.height}')


if __name__ == '__main__':
    main()
