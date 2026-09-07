"""황금이삭 마을(harvest-village.tmx) 생성기.

디자인: 4안 심사 패널 우승안 "harvest-village · 황금이삭 마을" + 이식
(빨래터, 가로등-꽃 가로수길 축선, 시장 넘침 상자). 티르코네일 수교의 물이
흘러내려와 들녘을 적시는 하류 농촌 마을 — 북벽 전체가 그 수교이고, 중앙
아치 관문으로 두 마을이 이어진다.

  북쪽 관문 아치 → 가로등 가로수길 → 우물 광장(수확 종탑) → 동쪽 장터와
  울타리 밭(밀·갈이흙) → 서쪽 개울(관개 수로)가 개울가 오두막·빨래터를 지나
  방죽못으로 → 남서 과수원 → 남쪽 촌장 농원 저택(대저택).

건물은 기존 town.tmx에서 추출한 조립 템플릿(스타일 완전 일치), 조경은
LPC 마을 소품(town_prop_*, scripts/append-cave-tiles.py가 벤더링), 지형은
사냥터와 같은 잔디↔흙/잔디↔자갈 전환 타일(561..598)로 유기적 경계를 만든다.
물은 수교의 석재 수로 문법(물가 309/311, 물 310/318/319/324)을 재사용해
'석재로 두른 관개 수로'로 그린다 — 방죽못 남단은 석벽(45)으로 막은 방죽이다.

objectgroup(NPC 13/포탈/건물·장식 주석)은 보존한다. 몬스터는 없다.
"""
import json
import random
import re
from collections import deque

SRC = 'src/games/my-sample-rpg/assets/maps/harvest-village.tmx'
TOWN = 'src/games/my-sample-rpg/assets/maps/town.tmx'
GIDS_PATH = 'scripts/lpc-cave-gids.json'
W = H = 60

G = json.load(open(GIDS_PATH))
rnd = random.Random(20260907)

# ---- town-32 기본 gid ----
GRASS, GRASS_ALT = 517, 518
DIRT, COBBLE = 507, 515
DIRT_EDGE_BASE, COBBLE_EDGE_BASE = 561, 580   # mask1..15 + 대각4
WATER_L, WATER, WATER_R = 309, 310, 311        # 석재 수로 물(수교 문법)
WATER_TL, WATER_T, WATER_TR = 316, 317, 320
WATER_ALT = (318, 319, 324)
STONE_BRICK = 45                               # 방죽 석벽
LAMP_BASE, LAMP_TOP = (356, 357), (365, 366)   # 가로등 2x2
FLOWER_BARREL = 493
TREE_CANOPY = [[326, 327, 328], [334, 335, 336], [342, 343, 344]]
TREE_TRUNK = [350, 351, 352]
ROCK_PILE = [527, 528]
INVISIBLE_BLOCK = 302
SHADE = 64

LAYER_NAMES = ['ground', 'shadow_lower', 'object', 'shadow_upper',
               'object_upper', 'deco', 'roof']
FIRST_LAYER_ID = 20   # 기존 objectgroup id(2,3,10,11…)와 충돌하지 않게 넉넉히

L = {n: [0] * (W * H) for n in LAYER_NAMES}


def put(layer, x, y, gid):
    if 0 <= x < W and 0 <= y < H and gid:
        L[layer][y * W + x] = gid


def get(layer, x, y):
    if 0 <= x < W and 0 <= y < H:
        return L[layer][y * W + x]
    return 0


def clear(layer, x, y):
    if 0 <= x < W and 0 <= y < H:
        L[layer][y * W + x] = 0


# ---------------------------------------------------------------- 템플릿 추출
def extract_templates():
    src = open(TOWN).read()
    layers = {}
    for m in re.finditer(r'<layer id="\d+" name="([^"]+)"[^>]*>\s*<data encoding="csv">\s*([\d,\s]+?)</data>', src):
        vals = [int(v) for v in m.group(2).replace('\n', ',').split(',') if v.strip()]
        layers[m.group(1)] = vals
    TW = 50
    BOXES = {
        'mansion_blue': (17, 0, 34, 17), 'house_red': (12, 30, 19, 40),
        'clock_tower': (25, 31, 30, 39), 'market_tent': (30, 31, 38, 39),
        'stall_awning': (10, 12, 15, 17), 'fountain': (18, 12, 21, 16),
        'aqueduct': (0, 44, 50, 50),
    }
    out = {}
    for name, (x0, y0, x1, y1) in BOXES.items():
        tpl = {}
        for lname, vals in layers.items():
            grid = [[vals[y * TW + x] for x in range(x0, x1)] for y in range(y0, y1)]
            if any(any(r) for r in grid):
                tpl[lname] = grid
        hgt, wid = y1 - y0, x1 - x0

        def occ(x, y):
            return any(tpl[l][y][x] for l in tpl)
        ys = [y for y in range(hgt) if any(occ(x, y) for x in range(wid))]
        xs = [x for x in range(wid) if any(occ(x, y) for y in range(hgt))]
        ty0, ty1, tx0, tx1 = min(ys), max(ys) + 1, min(xs), max(xs) + 1
        out[name] = {'w': tx1 - tx0, 'h': ty1 - ty0,
                     'layers': {l: [row[tx0:tx1] for row in tpl[l][ty0:ty1]] for l in tpl}}
    return out


TPL = extract_templates()


def stamp_template(name, ox, oy, skip_ground_bg=True):
    """템플릿을 (ox,oy)에 찍는다. skip_ground_bg면 다른 레이어가 비어 있는 칸의
    ground(주변 자갈 바닥)는 건너뛰어 지형이 비치게 한다."""
    t = TPL[name]
    for lname, grid in t['layers'].items():
        for dy, row in enumerate(grid):
            for dx, gid in enumerate(row):
                if not gid:
                    continue
                if lname == 'ground' and skip_ground_bg:
                    others = any(
                        t['layers'][l][dy][dx]
                        for l in t['layers'] if l != 'ground')
                    if not others:
                        continue
                put(lname, ox + dx, oy + dy, gid)


# ---------------------------------------------------------------- LPC 소품
def vprop(name):
    return G[f'town_prop_{name}']


def stamp_vprop(prefix, x, y, cols, rows_, solid_rows=1, layer_top='object_upper'):
    """마을 소품 멀티타일. 바닥 solid_rows 행은 object(충돌), 위는 layer_top."""
    for r in range(rows_):
        for c in range(cols):
            key = f'town_prop_{prefix}_r{r}c{c}'
            gid = G.get(key if rows_ * cols > 1 else f'town_prop_{prefix}')
            if not gid:
                continue
            ty = y - (rows_ - 1) + r
            put('object' if r >= rows_ - solid_rows else layer_top, x + c, ty, gid)


def put_town_tree(x, y):
    for dy in range(3):
        for dx in range(3):
            put('object_upper', x + dx, y + dy, TREE_CANOPY[dy][dx])
    for dx in range(3):
        put('object', x + dx, y + 3, TREE_TRUNK[dx])


def put_lamp(x, y):
    put('object', x, y, LAMP_BASE[0])
    put('object', x + 1, y, LAMP_BASE[1])
    put('object_upper', x, y - 1, LAMP_TOP[0])
    put('object_upper', x + 1, y - 1, LAMP_TOP[1])


# ---------------------------------------------------------------- 지형: 잔디 밑칠
for y in range(H):
    for x in range(W):
        put('ground', x, y, GRASS)
for _ in range(160):
    cx, cy = rnd.randrange(W), rnd.randrange(H)
    r = rnd.randint(1, 3)
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r and rnd.random() < 0.7:
                put('ground', x, y, GRASS_ALT)

# ---------------------------------------------------------------- 길 그리기
import math


def ease(t):
    return (1 - math.cos(math.pi * t)) / 2


def walk(points):
    out = []
    for i in range(len(points) - 1):
        x0, y0 = points[i]
        x1, y1 = points[i + 1]
        steps = max(abs(x1 - x0), abs(y1 - y0))
        for st in range(steps + 1):
            t = st / steps if steps else 0.0
            e = ease(t)
            out.append((round(x0 + (x1 - x0) * e), round(y0 + (y1 - y0) * e)))
    return out


def paint(cells, points, r=1):
    for (x, y) in walk(points):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                cells.add((x + dx, y + dy))


cobble_cells, dirt_cells = set(), set()
# 북문 → 광장 척추(자갈, 가로수길) — 관문 아치(x28-31)에서 광장까지 일직선
paint(cobble_cells, [(29, 3), (29, 25)], r=1)
paint(cobble_cells, [(30, 3), (30, 25)], r=1)
# 우물 광장(자갈) — 유기적 가장자리를 위해 원형 블롭 3개
for (cx, cy, rr) in ((30, 30, 6), (26, 31, 4), (35, 31, 4)):
    for y in range(cy - rr, cy + rr + 1):
        for x in range(cx - rr, cx + rr + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= rr * rr:
                cobble_cells.add((x, y))
# 저택 진입로(자갈)
paint(cobble_cells, [(30, 36), (30, 40)], r=1)
# 동쪽 들길(흙): 광장 → 밭 사잇길 → 동쪽 끝
paint(dirt_cells, [(36, 30), (44, 30), (52, 31), (57, 31)], r=1)
# 장터 지선(흙): 척추 → 장터 천막 앞 → 밭 A 서문
paint(dirt_cells, [(31, 14), (38, 14), (41, 14)], r=1)
# 건초 골목(흙): 동쪽 들길 → 건초 마당
paint(dirt_cells, [(40, 32), (40, 47), (42, 49)], r=1)
# 서쪽 산책로(흙): 광장 → 갈림길 → 과수원/방죽못
paint(dirt_cells, [(25, 33), (18, 37), (12, 37)], r=1)
paint(dirt_cells, [(18, 37), (17, 44), (12, 47)], r=1)
# 저택 정면 산책로(흙): 건초 마당 곁을 지나 남쪽 정면 현관으로
paint(dirt_cells, [(40, 47), (40, 53), (38, 56), (33, 57), (30, 57)], r=1)
# 오두막 앞길(흙): 산책로 → 두 집 문앞(이웃끼리 다져진 지름길)
paint(dirt_cells, [(20, 33), (17, 27), (14, 19)], r=1)
paint(dirt_cells, [(14, 18), (22, 18)], r=0)
# 관문 아래 통로(자갈)
for y in range(0, 7):
    for x in range(28, 32):
        cobble_cells.add((x, y))

# ---------------------------------------------------------------- 개울과 방죽못
# 관개 수로: 수교 서쪽 배수구(x6-8)에서 남하 → 방죽못(2..9, 40..47)
stream_cols = (6, 7, 8)
water_cells = set()
for y in range(6, 40):
    for x in stream_cols:
        water_cells.add((x, y))
for y in range(40, 48):
    for x in range(2, 10):
        water_cells.add((x, y))

# 물은 LPC 뮤트 물(물결 텍스처)로 채우고, 둑은 자갈로 둘러 잔디와 유기적으로
# 전환시킨다 — 물↔자갈의 직선 이음은 '석재 수로 둑'으로 읽힌다.
WATER_FILLS = [G[f'cave_fill_Water_{i:02d}'] for i in (0, 1, 2, 3) if f'cave_fill_Water_{i:02d}' in G]
for (x, y) in water_cells:
    put('object', x, y, INVISIBLE_BLOCK)
for (x, y) in sorted(water_cells):
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, 1), (1, -1), (-1, -1)):
        nb = (x + dx, y + dy)
        if nb not in water_cells and 0 <= nb[0] < W and 0 <= nb[1] < H:
            cobble_cells.add(nb)
# 방죽(남단 석벽) — 못의 물을 막는 둑
for x in range(1, 11):
    put('object', x, 48, STONE_BRICK)

for (x, y) in dirt_cells:
    if 0 <= x < W and 0 <= y < H:
        put('ground', x, y, DIRT)
for (x, y) in cobble_cells:
    if 0 <= x < W and 0 <= y < H:
        put('ground', x, y, COBBLE)

# ---------------------------------------------------------------- 오토타일(경계 정리)
snapshot = list(L['ground'])


def ground_at(x, y):
    return snapshot[y * W + x] if 0 <= x < W and 0 <= y < H else None


GRASSY = {GRASS, GRASS_ALT}


def autotile(target_gid, base):
    for y in range(H):
        for x in range(W):
            if ground_at(x, y) != target_gid:
                continue
            mask = 0
            for bit, (dx, dy) in enumerate(((0, -1), (1, 0), (0, 1), (-1, 0))):
                if ground_at(x + dx, y + dy) in GRASSY:
                    mask |= 1 << bit
            if mask:
                put('ground', x, y, base + (mask - 1))
                continue
            diags = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
            hit = [i for i, (dx, dy) in enumerate(diags) if ground_at(x + dx, y + dy) in GRASSY]
            if len(hit) == 1:
                put('ground', x, y, base + 15 + hit[0])


autotile(DIRT, DIRT_EDGE_BASE)
autotile(COBBLE, COBBLE_EDGE_BASE)

# 물 채움(오토타일 이후 — 물 위엔 전환 타일이 필요 없다)
for (x, y) in water_cells:
    put('ground', x, y, WATER_FILLS[0] if rnd.random() < 0.7 else rnd.choice(WATER_FILLS))

# ---------------------------------------------------------------- 수교(북벽) + 관문
# 50폭 템플릿 + 동쪽 10칸은 중간부(10..19열)를 이어붙인다
stamp_template('aqueduct', 0, 0, skip_ground_bg=False)
aq = TPL['aqueduct']
for lname, grid in aq['layers'].items():
    for dy, row in enumerate(grid):
        for dx in range(10, 20):
            if row[dx]:
                put(lname, 40 + dx, dy, row[dx])
# 관문: 중앙 아치(x28-31)를 뚫는다 — 충돌 해제 + 터널 어둠 + 통로
for y in range(0, 6):
    for x in range(28, 32):
        clear('object', x, y)
        clear('shadow_lower', x, y)
        put('ground', x, y, COBBLE)
for y in range(0, 4):
    for x in range(28, 32):
        put('shadow_upper', x, y, SHADE)   # 아치 그늘 — 지나는 캐릭터도 어두워진다
# 관문 좌우 기둥(아치 벽면) — 석벽으로 관문 틀을 세운다
for y in range(0, 6):
    for gx in (27, 32):
        put('object', gx, y, STONE_BRICK)

# ---------------------------------------------------------------- 건물
stamp_template('mansion_blue', 22, 40)
stamp_template('house_red', 11, 9)
stamp_template('house_red', 19, 10)
stamp_template('clock_tower', 23, 20)
stamp_template('market_tent', 33, 17)
stamp_template('stall_awning', 42, 24)
stamp_template('stall_awning', 42, 34)

# ---------------------------------------------------------------- 울타리 밭
def fence_rect(x0, y0, x1, y1, gates=()):
    """둘레 피켓 울타리(1타일 완결형 — 세로 변도 같은 타일: 탑다운 관례상
    울타리는 항상 정면을 본다). gates 위치는 가로변이면 문짝, 세로변이면 개구부."""
    for x in range(x0, x1 + 1):
        for y in (y0, y1):
            if (x, y) in gates:
                continue   # 문은 개구부 — 닫힌 문짝 타일은 충돌이 생겨 길을 막는다
            put('object', x, y, vprop('fence_h_m'))
    for y in range(y0 + 1, y1):
        for x in (x0, x1):
            if (x, y) in gates:
                continue
            put('object', x, y, vprop('fence_h_m'))


def field_rows(x0, y0, x1, y1, kind='wheat'):
    """밭 내부: 갈이흙 + 밀 이랑을 한 줄 걸러 심는다(shadow_lower 데칼)."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put('ground', x, y, DIRT)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if (y - y0) % 2 == 0:
                put('shadow_lower', x, y, vprop('wheat_tile' if kind == 'wheat' else 'plowed_tile'))
            else:
                put('shadow_lower', x, y, vprop('plowed_tile'))


# 밭 A(북동): 밀밭 — 서쪽에 문
fence_rect(43, 9, 56, 20, gates=((43, 14), (43, 15)))
field_rows(45, 11, 55, 19, 'wheat')
# 밭 B(남동): 갈이밭(파종기) — 북쪽에 문
fence_rect(49, 35, 56, 45, gates=((52, 35), (53, 35)))
field_rows(50, 37, 55, 44, 'plowed')
# 오두막 텃밭 두 곳(울타리 + 갈이흙 + 꽃)
fence_rect(11, 20, 17, 25, gates=((14, 20),))
field_rows(12, 22, 16, 24, 'plowed')
fence_rect(19, 21, 23, 25, gates=((21, 21),))
field_rows(20, 23, 22, 24, 'plowed')

# ---------------------------------------------------------------- 과수원 + 나무
ORCHARD = [(12, 40), (16, 41), (20, 42), (12, 45), (16, 46), (20, 47), (12, 50), (16, 50)]
for i, (x, y) in enumerate(ORCHARD):
    if i % 3 == 2:
        stamp_vprop('tree_round', x, y + 3, 2, 4)
    else:
        stamp_vprop('tree_med_a' if i % 3 == 0 else 'tree_med_b', x, y + 3, 3, 4)
stamp_vprop('tree_autumn', 24, 13, 3, 4)     # 광장 북서 가을 나무 한 그루(포인트)

# 외곽 나무 병풍(동/서/남) — 시야 밀봉
for y in range(6, H - 3, 4):
    put_town_tree(0, y) if y % 8 < 4 else stamp_vprop('tree_med_b', 0, y + 3, 3, 4)
for y in range(8, H - 4, 4):
    put_town_tree(W - 3, y)
for x in range(2, W - 3, 4):
    if 19 <= x <= 41:
        continue   # 저택 정면 산책로 구간
    put_town_tree(x, H - 4)

# ---------------------------------------------------------------- 소품/드레싱
# 우물 광장
stamp_vprop('well_roof', 31, 29, 2, 2)
put('object', 30, 29, FLOWER_BARREL)
put('object', 34, 29, FLOWER_BARREL)
stamp_vprop('bench', 27, 33, 2, 1)
stamp_vprop('bench', 34, 33, 2, 1)
for x, y in ((25, 28), (36, 28), (25, 34), (37, 34)):
    put_lamp(x, y)
# 종탑(시계탑) 앞 팻말
put('object', 28, 26, vprop('sign_blank'))
# 가로수길(척추) — 가로등+꽃 리듬(축선 액자: 이식안)
for y in (9, 15, 21):
    put_lamp(26, y)
    put_lamp(33, y)
for y in range(8, 25, 2):
    put('shadow_lower', 27, y, vprop(f'flower_{"abcd"[(y // 2) % 4]}'))
    put('shadow_lower', 32, y, vprop(f'flower_{"abcd"[(y // 2 + 2) % 4]}'))
# 관문 앞 꽃무리 + 표지판
for x, y in ((25, 6), (26, 7), (34, 6), (33, 7), (24, 7), (35, 7)):
    put('shadow_lower', x, y, vprop(f'flower_{"abcd"[(x + y) % 4]}'))
put('object', 33, 7, vprop('sign_blank'))
# 수문(개울 상류) — 이멜의 분필 수위표(팻말)
put('object', 10, 7, vprop('sign_blank'))
# 빨래터(개울가, 이식안): 벤치 + 물가 부들 + 바구니(상자)
stamp_vprop('bench', 9, 15, 2, 1)
put('object', 10, 16, G['cave_prop_crate_mush'])
for x, y in ((9, 12), (5, 17), (9, 26), (5, 30), (9, 34)):
    stamp_vprop('cattail', x, y, 1, 2)
# 방죽못 벤치 두 개(노을 명당) + 꽃
stamp_vprop('bench', 11, 43, 2, 1)
stamp_vprop('bench', 11, 46, 2, 1)
put('shadow_lower', 13, 43, vprop('flower_b'))
# 과수원: 사과 상자(엎질러진 것 포함) + 지름길 풀
put('object', 18, 44, G['cave_prop_crate_mush'])
put('shadow_lower', 17, 45, vprop('flower_c'))
put('shadow_lower', 15, 47, vprop('flower_c'))
# 건초 마당
stamp_vprop('cart', 42, 49, 2, 2)
stamp_vprop('haystack', 45, 49, 2, 2)
stamp_vprop('haybale', 45, 52, 2, 2)
stamp_vprop('hay_blocks', 48, 50, 2, 2)
put('object', 44, 52, G['cave_prop_crate_bones'])

# 장터 넘침: 천막 동쪽 상자·자루 + 길에 버려진 상자 하나
put('object', 41, 20, G['cave_prop_crate_mush'])
put('object', 41, 21, G['cave_prop_crate_crystal'])
put('object', 46, 29, G['cave_prop_crate_mush'])
stamp_vprop('sign_inn', 38, 16, 1, 1)   # 천막 위 장터 간판
# 저택 진입로 생울타리(한 칸은 기사들이 밟아 눕힌 풀: 이식안)
for y in range(37, 40):
    stamp_vprop('hedge_low_m', 28, y, 1, 1)
    if y != 38:
        stamp_vprop('hedge_low_m', 32, y, 1, 1)
put('shadow_lower', 32, 38, vprop('flower_a'))
# 저택 앞 화단 + 가로등
put('object', 28, 39, FLOWER_BARREL)
put('object', 32, 39, FLOWER_BARREL)
put_lamp(27, 39)
# 밭 곳곳: 허수아비/통나무/바위
stamp_vprop('scarecrow', 50, 13, 1, 2)
stamp_vprop('logpile', 44, 21, 2, 2)
put('object', 12, 30, ROCK_PILE[0])
put('object', 47, 33, ROCK_PILE[1])
# 오두막 사이 다져진 길 옆 수풀/꽃
for x, y in ((13, 17), (21, 17), (16, 26), (23, 27)):
    stamp_vprop('bush_round', x, y, 1, 1)
for x, y in ((12, 16), (22, 16), (18, 8), (26, 8)):
    put('shadow_lower', x, y, vprop(f'flower_{"abcd"[(x * 3 + y) % 4]}'))
# 잔디에 꽃 흩뿌림(소량)
for y in range(H):
    for x in range(W):
        if get('ground', x, y) in (GRASS, GRASS_ALT) and not get('object', x, y) \
                and not get('shadow_lower', x, y) and not get('object_upper', x, y) \
                and rnd.random() < 0.012:
            put('shadow_lower', x, y, vprop(f'flower_{"abcd"[(x * 7 + y) % 4]}'))

# ---------------------------------------------------------------- 외곽 밀봉
for x in range(W):
    for y in (0, 1, H - 1):
        if not get('object', x, y):
            put('object', x, y, INVISIBLE_BLOCK)
for y in range(H):
    for x in (0, W - 1):
        if not get('object', x, y):
            put('object', x, y, INVISIBLE_BLOCK)

# ---------------------------------------------------------------- 검증
walls = {(i % W, i // W) for i, g in enumerate(L['object']) if g}
start = (29, 7)   # 관문 아래 도착 지점
seen = {start}
q = deque([start])
while q:
    x, y = q.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nb = (x + dx, y + dy)
        if 0 <= nb[0] < W and 0 <= nb[1] < H and nb not in seen and nb not in walls:
            seen.add(nb)
            q.append(nb)

CHECK = [
    ('관문도착', (29, 7)), ('에디터스폰(맵중앙)', (30, 30)), ('우물앞', (32, 31)),
    ('종탑앞', (26, 27)), ('장터앞', (36, 25)), ('밭A문', (43, 14)), ('밭B문', (52, 34)),
    ('건초마당', (43, 48)), ('오두막1문', (14, 19)), ('오두막2문', (22, 19)),
    ('빨래터', (10, 17)), ('방죽못벤치', (13, 45)), ('과수원', (17, 43)),
    ('저택정면', (30, 57)), ('갈림길', (19, 38)), ('수문', (10, 8)),
]
NPC_TILES = [('마리네', (34, 30)), ('파딘', (48, 13)), ('로나', (14, 22)),
             ('두란', (43, 50)), ('키안', (17, 42)), ('헤나', (31, 8)),
             ('브란', (36, 25)), ('이멜', (11, 8)), ('테오', (10, 43)),
             ('세라핀', (30, 38)), ('갈렌', (28, 32)), ('마욘', (19, 36)), ('리네', (11, 19))]
problems = []
for name, pt in CHECK + NPC_TILES:
    if pt in walls:
        problems.append(f'{name}{pt} 막힘')
    elif pt not in seen:
        problems.append(f'{name}{pt} 도달 불가')

for x in range(W):
    for y in (0, H - 1):
        if (x, y) not in walls:
            problems.append(f'외곽 개방 ({x},{y})')
for y in range(H):
    for x in (0, W - 1):
        if (x, y) not in walls:
            problems.append(f'외곽 개방 ({x},{y})')

MAX_GID = max(G.values())
for name in LAYER_NAMES:
    bad = [g for g in L[name] if g and not (1 <= g <= MAX_GID)]
    if bad:
        problems.append(f'{name}: gid 범위 밖 {sorted(set(bad))[:5]}')

print(f'충돌 {len(walls)} / 도달가능 {len(seen)} / 전체 {W * H}')
for name in LAYER_NAMES:
    print(f'  {name:14s} {sum(1 for g in L[name] if g):5d}')
if problems:
    print('!! 문제:')
    for p in problems[:30]:
        print('   -', p)
    raise SystemExit(1)
print('검증 통과')

# ---------------------------------------------------------------- TMX 출력
src = open(SRC).read()
head = src[:src.index(' <layer ')]
tail = src[src.index(' <objectgroup '):]
head = re.sub(r'nextlayerid="\d+"',
              f'nextlayerid="{FIRST_LAYER_ID + len(LAYER_NAMES)}"', head)
parts = []
for i, name in enumerate(LAYER_NAMES, start=FIRST_LAYER_ID):
    rows = ',\n'.join(','.join(str(v) for v in L[name][y * W:(y + 1) * W]) for y in range(H))
    parts.append(f' <layer id="{i}" name="{name}" width="{W}" height="{H}">\n'
                 f'  <data encoding="csv">\n{rows}\n</data>\n </layer>\n')
open(SRC, 'w').write(head + ''.join(parts) + tail)
print('wrote', SRC)
