"""딴따라마을(harvest-village.tmx) 생성기.

디자인: 4안 심사 패널 우승안 "harvest-village" + 이식
(빨래터, 가로등-꽃 가로수길 축선, 시장 넘침 상자). 티르코네일 수교의 물이
흘러내려와 들녘을 적시는 하류 농촌 마을 — 북벽 전체가 그 수교이고, 중앙
아치 관문으로 두 마을이 이어진다.

  북쪽 관문 아치 → 가로등 가로수길 → 우물 광장 → 동쪽 장터와
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

G = json.load(open(GIDS_PATH, encoding='utf-8'))
rnd = random.Random(20260907)

# ---- town-32 기본 gid ----
# 주의: 518은 잔디가 아니라 우측에 흙 세로줄이 붙은 전환 타일(시트 이름 거짓말).
# 잔디 변형은 사냥터 생성기와 같은 457을 쓴다.
GRASS, GRASS_ALT = 517, 457
DIRT, COBBLE = 507, 515
DIRT_EDGE_BASE, COBBLE_EDGE_BASE = 561, 580   # mask1..15 + 대각4
WATER_L, WATER, WATER_R = 309, 310, 311        # 석재 수로 물(수교 문법)
WATER_TL, WATER_T, WATER_TR = 316, 317, 320
WATER_ALT = (318, 319, 324)
STONE_BRICK = 45                               # 방죽 석벽
# 가로등 2x3(town.tmx 와 같은 조립): 받침·기둥·등갓. 예전 (365,366) 등갓은
# 다른 가로등의 조각이라 기둥이 받침과 어긋났다.
LAMP_BASE, LAMP_MID, LAMP_TOP = (356, 357), (348, 349), (340, 341)
FLOWER_BARREL = 493
# 동굴 상자 키 이름은 실제 그림과 어긋나 있다(crate_mush=수정, crate_crystal=부서진
# 상자). 마을에는 농산물이 담긴 상자 그림(1095)만 쓴다.
CRATE = 1095
# 나무 기둥에 박힌 녹색 팻말(서 있는 표지판). 'sign_blank'(1194)는 기둥 없는 걸이 간판이라
# 잔디 위에 떠 보였다.
SIGN_POST = 1193
# 돌 받침 화분(받침 9 + 위에 얹는 덤불 1). 저택 뒤뜰·광장의 단정한 장식.
URN_BASE, URN_BUSH = 9, 1
WASH_TUB = 473   # 나무 빨래통
# (LPC 'bench'(1147/1148) 는 옆에서 본 통나무 덩어리처럼 보여 쓰지 않는다)
LOG_STACK, LOG_SINGLE = 1190, 1189
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
    src = open(TOWN, encoding='utf-8').read()
    layers = {}
    for m in re.finditer(r'<layer id="\d+" name="([^"]+)"[^>]*>\s*<data encoding="csv">\s*([\d,\s]+?)</data>', src):
        vals = [int(v) for v in m.group(2).replace('\n', ',').split(',') if v.strip()]
        layers[m.group(1)] = vals
    TW = 50
    BOXES = {
        'mansion_blue': (17, 0, 34, 17), 'house_red': (12, 30, 19, 40),
        'market_tent': (30, 31, 38, 39),
        'stall_awning': (10, 12, 15, 17), 'fountain': (18, 12, 21, 16),
        'aqueduct': (0, 44, 50, 50),
    }
    # 추출 상자에 함께 잘려 들어오는 town.tmx 주변 소품(건물 앞 나무·꽃바구니)은
    # 템플릿에서 뺀다 — 그대로 찍으면 집 벽에 나무·화분이 붙는다.
    tree_gids = {g for row in TREE_CANOPY for g in row} | set(TREE_TRUNK)
    # 오두막 옆벽에 붙은 회색 바닥 띠 + 통·바구니(412/419/420)도 뺀다 — 잔디 위에 돌바닥 조각이
    # 떠 보였다. 벽 그림자(shadow_upper)는 남겨 잔디에 드리우게 한다.
    STRIP = {'house_red': tree_gids | {FLOWER_BARREL, 412, 419, 420}, 'stall_awning': tree_gids}
    out = {}
    for name, (x0, y0, x1, y1) in BOXES.items():
        tpl = {}
        strip = STRIP.get(name, set())
        for lname, vals in layers.items():
            grid = [[0 if vals[y * TW + x] in strip else vals[y * TW + x] for x in range(x0, x1)]
                    for y in range(y0, y1)]
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
    """템플릿을 (ox,oy)에 찍는다. skip_ground_bg면 바닥 소품(object/shadow_lower)이
    없는 칸의 ground(주변 자갈 바닥)는 건너뛰어 지형이 비치게 한다 — 지붕 모서리나
    그림자만 있는 칸에 회색 자갈 조각이 남지 않게."""
    t = TPL[name]
    for lname, grid in t['layers'].items():
        for dy, row in enumerate(grid):
            for dx, gid in enumerate(row):
                if not gid:
                    continue
                if lname == 'ground' and skip_ground_bg:
                    others = any(
                        t['layers'][l][dy][dx]
                        for l in ('object', 'shadow_lower') if l in t['layers'])
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


# 나무는 town 나무 한 그림체로 통일 — 수관 색만 바꾼 변형(deep/autumn,
# scripts/append-tree-variants.py)을 섞는다. LPC 나무(tree_med_*, tree_round, tree_autumn)는
# 외곽선·명암이 달라 town 타일과 섞이면 이질적이었다.
TREE_VARIANTS = json.load(open('scripts/tree-variant-gids.json', encoding='utf-8'))


def put_town_tree(x, y, kind='town'):
    canopy, trunk = ((TREE_CANOPY, TREE_TRUNK) if kind == 'town'
                     else (TREE_VARIANTS[kind]['canopy'], TREE_VARIANTS[kind]['trunk']))
    for dy in range(3):
        for dx in range(3):
            put('object_upper', x + dx, y + dy, canopy[dy][dx])
    for dx in range(3):
        put('object', x + dx, y + 3, trunk[dx])


def put_urn(x, y):
    put('object', x, y, URN_BASE)
    put('object_upper', x, y - 1, URN_BUSH)


def put_lamp(x, y):
    for dx in range(2):
        put('object', x + dx, y, LAMP_BASE[dx])
        put('object_upper', x + dx, y - 1, LAMP_MID[dx])
        put('object_upper', x + dx, y - 2, LAMP_TOP[dx])


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
# (예전에는 광장에서 저택 '뒤편'(북쪽 지붕)으로 자갈길을 냈다 — 현관은 남쪽이라 막다른
#  길이었다. 이제 광장은 35행에서 끝나고 저택 뒤는 화분 정원이다.)
# 동쪽 들길(흙): 광장 → 밭 사잇길 → 동쪽 끝
paint(dirt_cells, [(36, 30), (44, 30), (52, 31), (57, 31)], r=1)
# 장터 지선(흙): 척추 → 장터 천막 앞 → 밭 A 서문
paint(dirt_cells, [(31, 14), (38, 14), (41, 14)], r=1)
dirt_cells.update({(42, 14), (42, 15)})   # 밭 A 서문까지 잇는다
# 건초 골목(흙): 동쪽 들길 → 건초 마당
paint(dirt_cells, [(40, 32), (40, 47), (42, 49)], r=1)
# 서쪽 산책로(흙): 광장 → 갈림길 → 과수원/방죽못
# 대각선으로 그리면 계단식 얼룩이 생겨서, 곧은 2칸 폭 길을 직각으로 잇는다.
def lane(x0, y0, x1, y1):
    """(x0,y0)~(x1,y1) 직사각형(양 끝 포함)을 흙길로 칠한다."""
    for y in range(min(y0, y1), max(y0, y1) + 1):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            dirt_cells.add((x, y))


lane(12, 35, 25, 36)    # 광장 → 서쪽 갈림길 → 방죽못
lane(16, 37, 17, 47)    # 과수원 고랑(두 나무 열 사이)
lane(11, 43, 15, 44)    # 고랑 → 못가 벤치(두 나무 행 사이)
# 저택 정면 산책로(흙): 건초 마당 곁을 지나 남쪽 정면 현관으로
paint(dirt_cells, [(40, 47), (40, 53), (38, 56), (33, 57), (30, 57)], r=1)
# 오두막 앞길(흙): 산책로 → 두 집 문앞(이웃끼리 다져진 지름길)
lane(13, 18, 27, 19)    # 두 오두막 문앞 → 가로수길
lane(14, 17, 14, 17)    # 서쪽 오두막 문턱
lane(18, 20, 18, 34)    # 두 텃밭 사이 → 광장 서쪽 길
# 좌판(북/남): 차양 밑과 앞을 다져진 흙바닥으로 — 잔디 위 회색 돌 조각 대신.
STALLS = [(42, 24), (42, 34)]
for sx, sy in STALLS:
    lane(sx + 1, sy + 1, sx + 3, sy + 4)
    lane(sx, sy + 4, sx + 3, sy + 4)   # 앞마당을 서쪽 길(39~41열)까지 잇는다
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
    put('ground', x, y, WATER_FILLS[0] if rnd.random() < 0.4 else rnd.choice(WATER_FILLS[1:]))

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
# 마을 시청과 같은 건물로 보이지 않게 지붕을 테라코타 변형 타일로 바꾼다
# (scripts/append-tree-variants.py 가 만든 mansion-roof-terracotta 매핑).
ROOF_TERRACOTTA = {int(k): v for k, v in TREE_VARIANTS['mansion-roof-terracotta'].items()}
for lname in LAYER_NAMES:
    for y in range(40, 40 + TPL['mansion_blue']['h']):
        for x in range(22, 22 + TPL['mansion_blue']['w']):
            g = get(lname, x, y)
            if g in ROOF_TERRACOTTA:
                put(lname, x, y, ROOF_TERRACOTTA[g])
# 저택 현관: 굴 입구 같은 어두운 문(544/552)을 벽으로 메우고 오두막과 같은 나무 아치문을 단다
put('object', 29, 54, 82)
put('object', 29, 55, 90)
for r in range(2):
    for c in range(3):
        put('deco', 28 + c, 54 + r, ((6, 7, 8), (14, 15, 16))[r][c])
# 오두막 문: 돌 아치 + 유리창 나무 두짝문(2x2). 예전의 저택 현관 타일(544/552)은
# 어두운 굴 입구처럼 보여 오두막에 어울리지 않았다.
COTTAGE_DOOR = ((6, 7, 8), (14, 15, 16))   # 6/14 는 왼쪽 문틀 끝 몇 픽셀
WINDOW_FLOWER = (5, 29)         # 창 위/꽃상자 달린 아래


def stamp_cottage(ox, oy, layout):
    """붉은 지붕 오두막(앞벽 4칸: ox+1..ox+4, 벽 줄: oy+4..oy+7). 문·창은 장식 레이어라
    벽 충돌은 그대로다."""
    stamp_template('house_red', ox, oy)
    for dx in range(1, 5):
        for dy in range(4, 8):
            clear('deco', ox + dx, oy + dy)
    door_x, windows = layout
    for r in range(2):
        for c in range(3):
            put('deco', ox + door_x - 1 + c, oy + 6 + r, COTTAGE_DOOR[r][c])
    for wx, (top, bottom) in windows:
        put('deco', ox + wx, oy + 4, top)
        put('deco', ox + wx, oy + 5, bottom)


# 문 그림은 타일 반 칸만큼 치우쳐 있어 4칸 앞벽 정중앙에 올 수 없다. 그래서 문을 오른쪽,
# 꽃창 하나를 왼쪽에 둔 비대칭 오두막으로 짠다(양끝 1·4열 창은 지붕 처마에 가려진다).
COTTAGE_LAYOUT = (3, ((2, WINDOW_FLOWER),))
stamp_cottage(11, 9, COTTAGE_LAYOUT)
stamp_cottage(19, 10, COTTAGE_LAYOUT)
stamp_template('market_tent', 34, 17)   # 33열이면 가로수길 가로등(33~34열)과 겹친다
for sx, sy in STALLS:
    # 템플릿의 자갈 바닥 조각은 버리고 위에서 깐 흙바닥(오토타일 결과)을 되살린다
    saved = {(x, y): get('ground', x, y) for x in range(sx, sx + 6) for y in range(sy, sy + 6)}
    stamp_template('stall_awning', sx, sy)
    for (x, y), g in saved.items():
        put('ground', x, y, g)
    # 차양 밑 진열 상자 두 개(차양 끝단이 상자 윗부분을 살짝 덮는다)
    put('object', sx + 1, sy + 2, CRATE)
    put('object', sx + 3, sy + 2, CRATE)

# ---------------------------------------------------------------- 울타리 밭
def fence_rect(x0, y0, x1, y1, gates=()):
    """둘레 피켓 울타리. 가로변은 정면 피켓(fence_h_m), 세로변은 측면 세로
    레일(fence_v — 판자가 상하로 이어지는 전용 타일)이라 끊김 없이 이어진다.
    gates 위치는 개구부(닫힌 문짝 타일은 충돌이 생겨 길을 막는다)."""
    for x in range(x0, x1 + 1):
        for y in (y0, y1):
            if (x, y) in gates:
                continue
            put('object', x, y, vprop('fence_h_m'))
    for y in range(y0 + 1, y1):
        for x in (x0, x1):
            if (x, y) in gates:
                continue
            put('object', x, y, vprop('fence_v'))


def field_rows(x0, y0, x1, y1, kind='wheat'):
    """밭 내부: 갈이흙 + 밀 이랑을 한 줄 걸러 심는다(shadow_lower 데칼).
    kind='garden'(오두막 텃밭): 바닥을 갈이흙으로 깔고 새싹 이랑·양배추 이랑을 번갈아(밟고 지나가는 데칼)."""
    if kind == 'garden':
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                put('ground', x, y, vprop('plowed_tile'))
                crop = 'flower_c' if (y - y0) % 2 == 0 else ('bush_low' if (x - x0) % 2 == 0 else None)
                if crop:
                    put('shadow_lower', x, y, vprop(crop))
        return
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
fence_rect(11, 20, 17, 25, gates=((14, 20), (15, 20)))
field_rows(12, 22, 16, 24, 'garden')
fence_rect(19, 21, 23, 25, gates=((21, 21), (22, 21)))
field_rows(20, 23, 22, 24, 'garden')

# ---------------------------------------------------------------- 과수원 + 나무
# 과수원은 과일나무 2열 x 3행의 반듯한 격자 — 큰 나무 8그루를 몰아 심으면 숲처럼 뭉개진다.
# 두 열 사이(16~17열)는 키안이 서는 고랑으로 비운다.
ORCHARD = [(12, 39), (19, 39), (12, 45), (19, 45), (12, 51), (19, 51)]
for x, y in ORCHARD:
    put_town_tree(x, y)
put_town_tree(17, 9, 'autumn')     # 두 오두막 사이 가을 나무 한 그루(포인트)

# 외곽 나무 — 같은 나무를 4칸마다 세운 '벽' 대신 모서리·가장자리에 몇 그루씩 어긋나게
# 모은 숲덤불로 테두리를 암시한다(통행 밀봉은 아래 투명 충돌 타일이 맡는다).
EDGE_TREES = [
    ('town', 0, 7), ('deep', 2, 13),                           # 서쪽: 수교 아래
    ('town', 0, 27), ('deep', 2, 31),                          # 서쪽: 중간
    ('town', 0, 49), ('deep', 3, 53), ('town', 1, 56),         # 남서 모서리
    ('town', 57, 7), ('deep', 56, 23),                         # 동쪽
    ('town', 57, 39), ('deep', 55, 49), ('town', 57, 53),      # 남동 모서리
    ('deep', 50, 56),
]
for kind, x, y in EDGE_TREES:
    put_town_tree(x, y, kind)

# ---------------------------------------------------------------- 소품/드레싱
# 우물 광장
stamp_vprop('well_roof', 31, 29, 2, 2)
put('object', 30, 29, FLOWER_BARREL)
put('object', 34, 29, FLOWER_BARREL)
put_urn(27, 33)
put_urn(35, 33)
# 가로등은 관문 한 쌍 + 광장 남쪽 한 쌍 + 저택 앞 하나만 — 농촌 마을에 11개는 과했다.
# (광장 북쪽 (36,28) 가로등은 브란(36,25)의 이름표와 겹쳤다.)
for x, y in ((25, 34), (37, 34)):
    put_lamp(x, y)
# 가로수길(척추) — 관문 바로 앞 한 쌍만 두고 나머지는 꽃 리듬으로 잇는다
put_lamp(26, 9)
put_lamp(33, 9)
for y in range(8, 25, 2):
    for x, k in ((27, 0), (32, 0)):   # 양옆 같은 꽃 — 축선이 좌우 대칭으로 읽히게
        if not get('object', x, y) and not get('object_upper', x, y):   # 가로등 밑은 비운다
            put('shadow_lower', x, y, vprop(f'flower_{"abcd"[(y // 2 + k) % 4]}'))
# 관문 앞 꽃무리 + 표지판
for x, y in ((25, 6), (26, 7), (34, 6), (33, 7), (24, 7), (35, 7)):
    put('shadow_lower', x, y, vprop(f'flower_{"abcd"[(x + y) % 4]}'))
put('object', 36, 7, SIGN_POST)   # 가로등(33~34열)과 겹치지 않게
# 수문(개울 상류) — 이멜의 분필 수위표(팻말)
put('object', 10, 7, SIGN_POST)
# 빨래터(개울가): 빨래통 + 바구니(상자) + 물가 부들
put('object', 10, 15, WASH_TUB)
put('object', 10, 16, CRATE)
for x, y in ((9, 12), (5, 17), (9, 26), (5, 30), (9, 34)):
    stamp_vprop('cattail', x, y, 1, 2)
# 방죽못가 꽃 한 무더기
put('shadow_lower', 11, 44, vprop('flower_b'))
# 과수원: 사과 상자(엎질러진 것 포함) + 지름길 풀
put('object', 15, 41, CRATE)   # 과수원 고랑 길가의 사과 상자
# 건초 마당
stamp_vprop('cart', 42, 49, 2, 2)
stamp_vprop('haystack', 45, 49, 2, 2)
stamp_vprop('haybale', 45, 52, 2, 2)
stamp_vprop('hay_blocks', 48, 50, 2, 2)
put('object', 44, 52, CRATE)

# 장터 넘침: 천막 동쪽 상자·자루 + 길에 버려진 상자 하나
put('object', 41, 20, CRATE)
put('object', 41, 21, CRATE)
# 저택 뒤뜰: 저택 중심(30열)을 기준으로 좌우 대칭인 돌 화분 4개 + 사이사이 꽃.
# 가운데(29~31열)는 세라핀(30,38)이 서는 자리라 비운다.
for x in (24, 27, 33, 36):
    put_urn(x, 39)
for x in (25, 26, 34, 35):
    put('shadow_lower', x, 39, vprop(f'flower_{"abcd"[x % 4]}'))
# 밭 곳곳: 허수아비/통나무/바위
stamp_vprop('scarecrow', 50, 13, 1, 2)
# 장작더미는 건초 마당 수레 곁에 둔다(들판 한가운데 덩그러니 놓인 통나무·바위는 뺐다).
put('object', 47, 52, LOG_STACK)    # 두란(43,50)의 이름표 자리는 비운다
put('object', 48, 52, LOG_SINGLE)
# 오두막 사이 다져진 길 옆 수풀/꽃
# (예전 (13,17)/(21,17)은 오두막 벽 바로 앞·위였다)
for x, y in ((11, 17), (25, 16)):
    stamp_vprop('bush_round', x, y, 1, 1)
for x, y in ((12, 16), (22, 16), (18, 8), (26, 8)):
    put('shadow_lower', x, y, vprop(f'flower_{"abcd"[(x * 3 + y) % 4]}'))
# (예전에는 잔디 전체에 꽃을 무작위로 흩뿌렸다 — 지저분해 보여서 뺐다. 꽃은 오두막
#  앞·가로수길·관문처럼 의도한 자리에만 둔다.)

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
    ('장터앞', (36, 25)), ('밭A문', (43, 14)), ('밭B문', (52, 34)),
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

MAX_GID = 1350  # town-32 tilecount (나무·지붕 색 변형 포함)
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
src = open(SRC, encoding='utf-8').read()
head = src[:src.index(' <layer ')]
tail = src[src.index(' <objectgroup '):]
head = re.sub(r'nextlayerid="\d+"',
              f'nextlayerid="{FIRST_LAYER_ID + len(LAYER_NAMES)}"', head)
parts = []
for i, name in enumerate(LAYER_NAMES, start=FIRST_LAYER_ID):
    rows = ',\n'.join(','.join(str(v) for v in L[name][y * W:(y + 1) * W]) for y in range(H))
    parts.append(f' <layer id="{i}" name="{name}" width="{W}" height="{H}">\n'
                 f'  <data encoding="csv">\n{rows}\n</data>\n </layer>\n')
open(SRC, 'w', encoding='utf-8', newline='\n').write(head + ''.join(parts) + tail)
print('wrote', SRC)
