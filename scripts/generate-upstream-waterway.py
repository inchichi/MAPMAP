"""2장 첫 맵 '수로 상류길'(upstream-waterway, 40x24) 생성기.

이야기(docs/chapter2-sunken-forest.md, c2-01 "사라지는 물"): 딴따라마을 수문 위 아치를 지나
개울을 거슬러 오르면, 북동쪽에서 내려오던 물이 한가운데의 구멍으로 빨려 들어 사라진다. 구멍
아래쪽 옛 물길은 말라 진흙 바닥만 남았다(마을 물이 줄어든 까닭). 구멍 곁에는 반쯤 잠긴 룬
비석이 있고(봉인 떡밥), 동쪽 끝은 물에 잠긴 숲 — 갈대골로 가는 길은 아직 건널 수 없다.

  남서 아치(딴따라마을) ─ 마른 물길을 따라 북동 ─ 물이 빨려 드는 구멍 + 룬 비석 ─ 동쪽 전망 둑

지형은 꼭짓점 재질 격자(GRASS/WATER/MUD/HOLE)로 정하고 경계는 scripts/swamp_terrain.py 의
규칙(꼭짓점 16가지 + 변별 경계 위치)으로 깐다. 물은 바닥 레이어의 cave_fill_Water(흐르는 물
렌더링 대상), 풀 경계는 shadow_lower 의 투명 덮개다. 그림체는 비교안 C(늪 색 town 타일 +
LPC 고목) — docs/chapter2-art-candidates.md.

규칙(1장 생성기와 같음): 손으로 TMX 를 고치지 않는다. object 레이어의 0 이 아닌 칸이 벽이다.
투명 충돌(302)은 물 위에만 쓰고, 땅 위의 막힘은 눈에 보이는 것(나무·덤불·비석)으로만 만든다.
"""
import json
import math
import random
import re
import sys
from collections import deque

sys.path.insert(0, 'scripts')
import swamp_terrain as st  # noqa: E402

W, H = 40, 24
OUT = 'src/games/my-sample-rpg/assets/maps/upstream-waterway.tmx'
LAYER_NAMES = ['ground', 'shadow_lower', 'object', 'shadow_upper', 'object_upper', 'deco', 'roof']
FIRST_LAYER_ID = 10
rnd = random.Random(20261004)

S = st.gids()
LPC = json.load(open('scripts/lpc-cave-gids.json', encoding='utf-8'))
INVISIBLE_BLOCK = 302
BUSHES = [1150, 1151, 1152]
ROCKS = [527, 528]
STUMPS = [463, 464]
CATTAIL = (LPC['town_prop_cattail_r0c0'], LPC['town_prop_cattail_r1c0'])
LOG_SINGLE = 1189
STELE = S['stele']   # 2x2 룬 비석(append-swamp-tiles.py 가 잘린 LPC 비석을 대칭으로 복원)
HOLE_FILL = LPC['cave_fill_Hole_Black_00']
HOLE = 3   # 꼭짓점 재질(물 속 구멍)

# 이야기 지점(칸 좌표)
ARRIVAL = (5, 21)                 # 딴따라마을에서 올라와 서는 칸
GATE = (4, 23, 3, 1)              # 아치(포탈) x, y, w, h — 남쪽 가장자리
VILLAGE_SPAWN = (12, 5)           # 돌아갈 때 딴따라마을 도착 칸(수문 아치 아래)
SINK = (21, 10)                   # 구멍 칸(2x2 꼭짓점 구멍의 가운데 칸)
STELE_AT = (23, 13)               # 비석 2x2 의 왼쪽 위 칸 — 상호작용 오브젝트는 왼쪽 아래 칸
LOOKOUT = (34, 13)                # 동쪽 전망 둑 끝(표지판 칸)
# 몬스터(2장 첫 맵 — 도착 레벨 약 19 보다 조금 약하게). 늪뱀은 물가를 기어 다니고, 식인 꽃은
# 제자리 함정(monsterCatalog 의 stationary). 꽃 하나는 전망 둑 길목을 지킨다.
MONSTERS = [
    ('늪뱀-1', 'monster_snake', 16, (13, 11)),
    ('늪뱀-2', 'monster_snake', 16, (6, 14)),
    ('늪뱀-3', 'monster_snake', 17, (27, 10)),
    ('늪뱀-4', 'monster_snake', 17, (28, 18)),
    ('식인 꽃-1', 'monster_flower', 17, (18, 14)),
    ('식인 꽃-2', 'monster_flower', 18, (31, 14)),
    ('식인 꽃-3', 'monster_flower', 17, (27, 7)),
]


class Map:
    def __init__(self):
        self.L = {n: [0] * (W * H) for n in LAYER_NAMES}

    def inb(self, x, y):
        return 0 <= x < W and 0 <= y < H

    def set(self, layer, x, y, gid):
        if self.inb(x, y) and gid:
            self.L[layer][y * W + x] = gid

    def get(self, layer, x, y):
        return self.L[layer][y * W + x] if self.inb(x, y) else 0


m = Map()


# ---------------------------------------------------------------- 꼭짓점 재질
def catmull(points, steps_per_unit=6):
    pts = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        steps = max(4, int(math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * steps_per_unit))
        for s in range(steps + 1):
            t = s / steps
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2
                                    + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3) for k in (0, 1)))
    return out


def dist_to_path(path, x, y):
    return min(math.hypot(x - px, y - py) for px, py in path)


def wobble(x, y, salt):
    return (st.h32(int(x * 3), int(y * 3), salt) - 0.5) * 0.5


# 위에서 내려오는 물길(북동 → 구멍). 폭이 좁아야 흐르는 물로 그려진다(4칸 이하).
CHANNEL = catmull([(33.5, -1.0), (32.4, 2.0), (29.6, 3.6), (26.6, 5.4), (24.4, 7.4), (22.6, 9.4)])
# 말라 버린 옛 물길(구멍 아래 → 남서 아치). 진흙.
DRY_BED = catmull([(19.2, 12.6), (16.0, 13.6), (12.6, 14.8), (9.2, 16.6), (6.6, 18.8), (5.4, 21.6), (5.2, 24.5)])
# 동쪽 잠긴 숲의 물(맵 동쪽 끝까지)
POND = [(40.5, 12.5, 4.6, 8.5), (37.8, 19.5, 3.2, 3.2), (38.5, 6.5, 2.6, 3.0)]


def vertex_material(x, y):
    if math.hypot(x - (SINK[0] + 1), y - (SINK[1] + 1)) < 0.75:
        return HOLE
    if math.hypot(x - (SINK[0] + 1), y - (SINK[1] + 1)) < 2.0 + wobble(x, y, 3):
        return st.WATER
    if dist_to_path(CHANNEL, x, y) < 0.95 + wobble(x, y, 5) * 0.5:
        return st.WATER
    for cx, cy, rx, ry in POND:
        if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 + wobble(x, y, 7):
            return st.WATER
    if dist_to_path(DRY_BED, x, y) < 1.05 + wobble(x, y, 11) * 0.7:
        return st.MUD
    return st.GRASS


vmat = [[vertex_material(x, y) for x in range(W + 1)] for y in range(H + 1)]

# 전망 둑: 잠긴 숲 물 쪽으로 튀어나온 풀 곶. 끝을 물이 세 방향에서 감싸게 곶 둘레를 물로 판다.
lx, ly = LOOKOUT
for y in range(ly - 4, ly + 6):
    for x in range(lx - 3, W + 1):
        if not (0 <= y <= H):
            continue
        spit = abs(y - (ly + 1)) <= 1.2 and x <= lx + 1.5
        if spit:
            vmat[y][x] = st.GRASS
        elif x >= lx - 1 and math.hypot((x - lx - 1) / 3.6, (y - ly - 1) / 3.4) < 1:
            vmat[y][x] = st.WATER

# 물과 진흙이 바로 붙지 않게(경계 덮개는 풀↔한 재질만 그린다): 물 곁의 진흙 꼭짓점은 풀로
for y in range(H + 1):
    for x in range(W + 1):
        if vmat[y][x] == st.MUD and any(
                0 <= x + dx <= W and 0 <= y + dy <= H and vmat[y + dy][x + dx] in (st.WATER, HOLE)
                for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
            vmat[y][x] = st.GRASS
# 구멍 둘레는 반드시 물(구멍 경계 타일은 물↔구멍만 있다)
for y in range(H + 1):
    for x in range(W + 1):
        if vmat[y][x] == HOLE:
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    if vmat[y + dy][x + dx] == st.GRASS:
                        vmat[y + dy][x + dx] = st.WATER

# ---------------------------------------------------------------- 바닥 · 경계 덮개 · 물 충돌
water_cells = set()
mud_cells = set()
for y in range(H):
    for x in range(W):
        c = st.cell_corners(vmat, x, y)
        if HOLE in c:
            mask = sum(bit for bit, v in zip((1, 2, 4, 8), c) if v == HOLE)
            m.set('ground', x, y, HOLE_FILL if mask == 15 else LPC[f'cave_edge_Water__Hole_Black_m{mask:02d}'])
            water_cells.add((x, y))
            continue
        base, over = st.cell_tiles(vmat, x, y)
        if base is None:
            m.set('ground', x, y, S['grass'] if st.h32(x, y, 3) > 0.3 else S['grass_alt'])
            continue
        m.set('ground', x, y, base)
        if over:
            m.set('shadow_lower', x, y, over)
        n_water = sum(v == st.WATER for v in c)
        if n_water >= 2:
            water_cells.add((x, y))
        if base == S['mud']:
            mud_cells.add((x, y))
for (x, y) in water_cells:
    m.set('object', x, y, INVISIBLE_BLOCK)

# ---------------------------------------------------------------- 지켜야 할 길·자리
walk = set()
for px, py in catmull([(ARRIVAL[0] + 0.5, ARRIVAL[1] + 0.5), (8.0, 17.0), (13.0, 16.6), (18.0, 15.4),
                       (22.0, 15.0), (27.0, 16.4), (LOOKOUT[0] - 1.0, LOOKOUT[1] + 0.5)]):
    for dx in range(-1, 2):
        for dy in range(-1, 2):
            walk.add((int(px) + dx, int(py) + dy))
for x in range(GATE[0] - 1, GATE[0] + GATE[2] + 1):
    for y in range(GATE[1] - 2, H):
        walk.add((x, y))
for dx in range(-1, 3):
    walk.add((STELE_AT[0] + dx, STELE_AT[1] + 2))
    walk.add((STELE_AT[0] + dx, STELE_AT[1] + 3))
for dx in range(-3, 4):
    for dy in range(-3, 3):
        if math.hypot(dx, dy) < 3.2:
            walk.add((SINK[0] + dx, SINK[1] + 3 + dy))
walk = {c for c in walk if c not in water_cells}
for _n, kind, _l, (mx, my) in MONSTERS:
    r = 1 if kind == 'monster_snake' else 0       # 순찰하는 뱀은 둘레 3x3 을 비운다
    for dx in range(-r, r + 1):
        for dy in range(-r, r + 1):
            walk.add((mx + dx, my + dy))
reserved = set(walk)
# 몬스터가 나무 윗부분에 가려 생기지 않게: 몬스터 칸 둘레(위로 두 줄까지)에는 수관을 걸지 않는다.
no_canopy = {(mx + dx, my + dy) for _n, _k, _l, (mx, my) in MONSTERS for dx in (-1, 0, 1) for dy in (-2, -1, 0)}


def free(x, y):
    return m.inb(x, y) and (x, y) not in reserved and (x, y) not in water_cells and not m.get('object', x, y) \
        and not m.get('object_upper', x, y)


# 비석 2x2: 윗줄 object_upper, 아랫줄은 충돌. 왼쪽 아래 칸은 상호작용 오브젝트(sunken_stele)가 그린다.
sx, sy = STELE_AT
for c in range(2):
    m.set('object_upper', sx + c, sy, STELE[0][c])
m.set('object', sx + 1, sy + 1, STELE[1][1])
for c in range(2):
    reserved.add((sx + c, sy))
    reserved.add((sx + c, sy + 1))

# ---------------------------------------------------------------- 나무
canopy_cells = set()
trunk_centers = []


def can_place(cells_needing_free, canopy):
    for (x, y) in cells_needing_free:
        if not free(x, y):
            return False
    for (x, y) in canopy:
        if (x, y) in canopy_cells or (x, y) in reserved and (x, y) in walk and False:
            return False
    return True


def upper_layer_for(cell):
    """나무 윗부분을 그릴 레이어. 뒤(먼저 심은) 나무가 object_upper 를 쓰고 있으면 앞 나무는
    deco 에 그려 위에 오게 한다. 둘 다 차 있으면 None(세 겹은 덩어리져 보여 심지 않는다).
    나무는 위(뒤) 행부터 심으므로 나중에 심는 쪽이 늘 앞이다."""
    if cell in no_canopy:
        return None
    if not m.get('object_upper', *cell):
        return 'object_upper'
    if not m.get('deco', *cell):
        return 'deco'
    return None


def put_swamp_tree(cx, foot_y):
    """늪 색 town 나무: 3x4, 밑동 행이 foot_y, 가운데 열이 cx."""
    x0 = cx - 1
    trunk = [(x0 + c, foot_y) for c in range(3)]
    canopy = [(x0 + c, foot_y - 3 + r) for r in range(3) for c in range(3)]
    if any(not m.inb(*t) or not free(*t) for t in trunk):
        return False
    if any(c in walk and c[1] >= foot_y - 1 for c in canopy):
        return False
    layers = {c: upper_layer_for(c) for c in canopy if m.inb(*c)}
    if any(v is None for v in layers.values()):
        return False
    for r in range(3):
        for c in range(3):
            cell = (x0 + c, foot_y - 3 + r)
            if cell in layers:
                m.set(layers[cell], *cell, S['tree']['canopy'][r][c])
                canopy_cells.add(cell)
    for c in range(3):
        m.set('object', x0 + c, foot_y, S['tree']['trunk'][c])
    trunk_centers.append((cx, foot_y))
    return True


def put_dead_tree(i, fx, fy, in_water=False):
    """LPC 고목: 밑동 칸 (fx, fy)만 충돌, 아랫줄 나머지는 바닥 데칼(뿌리·그림자), 윗줄은 나무 레이어.
    in_water: 물에 잠긴 고목(가라앉은 숲) — 밑동이 물 칸이어야 한다."""
    t = S['dead_trees'][i]
    grid, foot = t['grid'], t['foot_col']
    rows = len(grid)
    cells = {}
    for r, row in enumerate(grid):
        for c, g in enumerate(row):
            cells[(fx - foot + c, fy - rows + 1 + r)] = g
    if any(not m.inb(*p) for p in cells):
        return False
    if in_water:
        if (fx, fy) not in water_cells or m.get('shadow_lower', fx, fy):
            return False
    elif not free(fx, fy):
        return False
    layers = {}
    for (x, y), g in cells.items():
        if (x, y) == (fx, fy):
            continue
        if y == fy:
            if m.get('shadow_lower', x, y) or ((x, y) in water_cells) != in_water and g:
                return False
            continue
        layers[(x, y)] = upper_layer_for((x, y))
        if layers[(x, y)] is None:
            return False
    for (x, y), g in cells.items():
        if (x, y) == (fx, fy):
            m.set('object', x, y, g)
            if in_water:
                m.set('shadow_lower', x, y, 0)
        elif y == fy:
            m.set('shadow_lower', x, y, g)
        else:
            m.set(layers[(x, y)], x, y, g)
            canopy_cells.add((x, y))
    trunk_centers.append((fx, fy))
    return True


def edge_distance(x, y):
    return min(x, y, W - 1 - x, H - 1 - y)


# 숲: 가장자리 띠 + 숲 덩이(원), 빈터·길에서는 0. 후보를 섞어 심어 줄 맞춘 느낌을 없앤다.
# 수관끼리는 겹치지 않는다(put_* 가 거절). 가장자리는 2칸 간격까지 촘촘히.
GROVES = [(9, 4, 4.5), (15, 2, 3.5), (3, 9, 3.5), (10, 20, 3.0), (17, 20, 3.5), (28, 21, 3.5),
          (27, 1, 2.5), (36, 1, 3.0), (2, 17, 3.0)]
CLEARINGS = [(14, 9, 3.0), (25, 16, 3.5)]


def tree_density(x, y):
    if (x, y) in walk or (x, y) in water_cells:
        return 0.0
    d = edge_distance(x, y)
    p = 0.95 if d <= 1 else 0.6 if d <= 2 else 0.05
    for gx, gy, r in GROVES:
        g = math.hypot(x - gx, y - gy)
        if g < r:
            p = max(p, 0.85 * (1 - g / r) + 0.25)
    for cx, cy, r in CLEARINGS:
        if math.hypot(x - cx, y - cy) < r:
            p *= 0.05
    return p


cands = [(y, rnd.random(), x) for y in range(1, H) for x in range(W)]
cands.sort()
dead_order = [0, 3, 4, 5, 6, 2, 1]
for y, _r, x in cands:
    if rnd.random() >= tree_density(x, y):
        continue
    gap = 2 if edge_distance(x, y) <= 1 else 3
    if any(abs(ox - x) < gap and abs(oy - y) < 2 for ox, oy in trunk_centers):
        continue
    if rnd.random() < 0.55:
        put_dead_tree(dead_order[len(trunk_centers) % len(dead_order)], x, y)
    else:
        put_swamp_tree(x, y) or put_dead_tree(dead_order[len(trunk_centers) % len(dead_order)], x, y)
# 가라앉은 숲: 동쪽 물속에 선 고목들(물가에서 2칸 이상 떨어진 얕은 물, 서로 3칸 이상)
drowned = 0
for y, _r, x in cands:
    if drowned >= 6 or x < LOOKOUT[0] or (x, y) not in water_cells:
        continue
    if not all((x + dx, y + dy) in water_cells for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
        continue
    if any(abs(ox - x) < 3 and abs(oy - y) < 3 for ox, oy in trunk_centers):
        continue
    if put_dead_tree(dead_order[drowned % len(dead_order)], x, y, in_water=True):
        drowned += 1
print(f'나무 {len(trunk_centers)}그루 (물속 고목 {drowned})')

# ---------------------------------------------------------------- 물가 갈대 · 덤불 · 통나무 · 돌
bank = [(x, y) for y in range(1, H) for x in range(W)
        if (x, y) not in water_cells and any((x + dx, y + dy) in water_cells for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
for (x, y) in bank:
    if rnd.random() < 0.28 and free(x, y) and free(x, y - 1) and (x, y - 1) not in canopy_cells:
        m.set('object', x, y, CATTAIL[1])
        m.set('object_upper', x, y - 1, CATTAIL[0])
for (x, y) in [(3, 13), (13, 20), (26, 19), (17, 6), (9, 9)]:
    if free(x, y):
        m.set('object', x, y, LOG_SINGLE)
for (x, y) in [(28, 12), (11, 11), (19, 19), (6, 6)]:
    if free(x, y):
        m.set('object', x, y, ROCKS[(x + y) % 2])
for (x, y) in [(15, 9), (30, 21), (2, 17)]:
    if free(x, y):
        m.set('object', x, y, STUMPS[(x + y) % 2])
for (x, y) in bank:
    if (x, y) not in walk and not m.get('shadow_lower', x, y) and rnd.random() < 0.35:
        m.set('shadow_lower', x, y, S['tufts'][rnd.randrange(5)])
for y in range(H):
    for x in range(W):
        if m.get('ground', x, y) in (S['grass'], S['grass_alt']) and not m.get('shadow_lower', x, y) \
                and (x, y) not in walk and rnd.random() < 0.05:
            m.set('shadow_lower', x, y, S['tufts'][rnd.randrange(5)])


# ---------------------------------------------------------------- 고립 칸 메우기 / 검증
def flood(start):
    walls = {(i % W, i // W) for i, g in enumerate(m.L['object']) if g}
    seen = {start}
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if m.inb(*n) and n not in seen and n not in walls:
                seen.add(n)
                q.append(n)
    return walls, seen


# 맵 가장자리 한 줄: 막는다. 단 눈에 보이는 것(수관·나무·덤불·물)이 있는 칸만 — 빈 땅이면 덤불을
# 둔다. 그래서 투명 벽에 부딪히는 일은 없다(아치 칸은 비운다).
gate_cells = {(x, GATE[1]) for x in range(GATE[0], GATE[0] + GATE[2])}
for y in range(H):
    for x in range(W):
        if edge_distance(x, y) != 0 or (x, y) in gate_cells:
            continue
        if m.get('object', x, y):
            continue
        covered = (x, y) in water_cells or m.get('object_upper', x, y) or m.get('deco', x, y)
        if not covered and put_dead_tree(dead_order[(x * 3 + y) % len(dead_order)], x, y):
            continue
        if covered:
            m.set('object', x, y, INVISIBLE_BLOCK)
            continue
        # 덤불·돌·그루터기를 섞고, 가끔 한 칸 안쪽에도 덤불을 둬 일직선 담장처럼 보이지 않게
        k = st.h32(x, y, 41)
        m.set('object', x, y, BUSHES[int(k * 3)] if k < 0.72 else ROCKS[(x + y) % 2] if k < 0.86 else STUMPS[(x + y) % 2])
        ix, iy = x + (1 if x == 0 else -1 if x == W - 1 else 0), y + (1 if y == 0 else -1 if y == H - 1 else 0)
        if st.h32(x, y, 43) < 0.35 and free(ix, iy):
            m.set('object', ix, iy, BUSHES[int(st.h32(x, y, 47) * 3)])

walls, seen = flood(ARRIVAL)
orphans = [(x, y) for y in range(H) for x in range(W) if (x, y) not in walls and (x, y) not in seen]
for (x, y) in orphans:
    m.set('object', x, y, BUSHES[(x + y) % 3])      # 갇힌 빈 칸은 눈에 보이는 덤불로
if orphans:
    print(f'고립 칸 {len(orphans)}개를 덤불로 메움')
walls, seen = flood(ARRIVAL)

STELE_FRONT = (STELE_AT[0], STELE_AT[1] + 2)
checks = [(n, p) for n, _k, _l, p in MONSTERS] + [('도착 칸', ARRIVAL), ('비석 앞', STELE_FRONT), ('전망 둑', (LOOKOUT[0], LOOKOUT[1] + 1)),
          ('구멍 남쪽 물가', next((SINK[0], y) for y in range(SINK[1], H) if (SINK[0], y) not in water_cells))] + \
         [(f'아치 {x}', (x, GATE[1])) for x in range(GATE[0], GATE[0] + GATE[2])]
problems = []
for name, p in checks:
    if p in walls:
        problems.append(f'{name}{p} 벽')
    elif p not in seen:
        problems.append(f'{name}{p} 도달 불가')
# 가장자리: 아치 말고는 걸어서 맵 밖으로 나갈 틈이 없어야 한다
for x in range(W):
    for y in (0, H - 1):
        if (x, y) in seen and not (y == H - 1 and GATE[0] <= x < GATE[0] + GATE[2]):
            problems.append(f'가장자리 열림 {(x, y)}')
for y in range(H):
    for x in (0, W - 1):
        if (x, y) in seen:
            problems.append(f'가장자리 열림 {(x, y)}')
max_gid = max(max(v) for v in m.L.values())
tilecount = int(re.search(r'tilecount="(\d+)"', open('src/games/my-sample-rpg/assets/tilesets/town-32.tsx', encoding='utf-8').read()).group(1))
if max_gid > tilecount:
    problems.append(f'gid {max_gid} 가 타일셋 범위 밖')
print(f'벽 {len(walls)} / 도달 {len(seen)} / 전체 {W * H} / 물 {len(water_cells)} / 진흙 {len(mud_cells)}')
if problems:
    print('!! 문제:')
    for p in problems:
        print('   -', p)
    raise SystemExit(1)
print('검증 통과')


# ---------------------------------------------------------------- TMX 출력
def xml_escape(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def props_xml(props):
    out = []
    for pname, ptype, pval in props:
        if ptype == 'list':
            out.append(f'    <property name="{pname}" type="list">')
            out += [f'     <item value="{xml_escape(v)}"/>' for v in pval]
            out.append('    </property>')
            continue
        t = f' type="{ptype}"' if ptype else ''
        out.append(f'    <property name="{pname}"{t} value="{xml_escape(str(pval))}"/>')
    return out


def character(oid, name, tx, ty, props):
    """칸 (tx, ty)에 서는 캐릭터·소품(x = 칸 중심, y = 칸 바닥)."""
    return '\n'.join([f'  <object id="{oid}" name="{name}" type="character" x="{tx * 32 + 16}" y="{ty * 32 + 32}" '
                      f'width="32" height="32">', '   <properties>'] + props_xml(props) +
                     ['   </properties>', '  </object>'])


def portal(oid, name, x, y, w, h, props):
    """포탈은 왼쪽 위 기준."""
    return '\n'.join([f'  <object id="{oid}" name="{name}" type="portal" x="{x * 32}" y="{y * 32}" '
                      f'width="{w * 32}" height="{h * 32}">', '   <properties>'] + props_xml(props) +
                     ['   </properties>', '  </object>'])


chars = [
    character(20 + i, name, x, y, [('blocksMovement', 'bool', 'true'), ('monster.level', 'int', lvl), ('type', '', kind)])
    for i, (name, kind, lvl, (x, y)) in enumerate(MONSTERS)
] + [
    character(1, 'sunken_stele', STELE_AT[0], STELE_AT[1] + 1, [
        ('blocksMovement', 'bool', 'true'),
        ('controller.dialogueLines', 'list', ['물가에 반쯤 잠긴 돌 비석이다.',
                                               '이끼 사이로 낯선 글자가 희미하게 빛나고 있다.']),
        ('controller.scriptId', '', 'vn-dialogue'),
        ('type', '', 'swamp_stele_r1c0')]),
    character(2, 'reed_valley_sign', LOOKOUT[0], LOOKOUT[1], [
        ('type', '', 'sign_inn'), ('blocksMovement', 'bool', 'false'),
        ('displayText', '', '갈대골 → (물길 잠김)')]),
    character(3, 'aqueduct_sign', GATE[0] + GATE[2], GATE[1] - 2, [
        ('type', '', 'sign_inn'), ('blocksMovement', 'bool', 'false'), ('displayText', '', '딴따라마을 ↓')]),
]
portals = [
    portal(10, 'aqueduct_gate', GATE[0], GATE[1], GATE[2], GATE[3], [
        ('appearanceType', '', 'stairs_stone_step_base_00'), ('targetFacing', '', 'down'),
        ('targetSceneId', '', 'harvest-village'),
        ('targetSpawnTileX', 'int', VILLAGE_SPAWN[0]), ('targetSpawnTileY', 'int', VILLAGE_SPAWN[1])]),
]

out = ['<?xml version="1.0" encoding="UTF-8"?>',
       f'<map version="1.10" tiledversion="1.12.1" orientation="orthogonal" renderorder="right-down" '
       f'width="{W}" height="{H}" tilewidth="32" tileheight="32" infinite="0" '
       f'nextlayerid="{FIRST_LAYER_ID + len(LAYER_NAMES)}" nextobjectid="40">',
       '<!-- scripts/generate-upstream-waterway.py 가 생성한다. 손으로 고치지 말고 스크립트를 고친 뒤 다시 돌릴 것. -->',
       ' <tileset firstgid="1" source="../tilesets/town-32.tsx"/>']
for i, name in enumerate(LAYER_NAMES, start=FIRST_LAYER_ID):
    rows = ',\n'.join(','.join(str(v) for v in m.L[name][y * W:(y + 1) * W]) for y in range(H))
    out.append(f' <layer id="{i}" name="{name}" width="{W}" height="{H}">\n  <data encoding="csv">\n{rows}\n</data>\n </layer>')
out.append(' <objectgroup id="2" name="characters">')
out.append('  <!-- 룬 비석(sunken_stele, c2-01 조사 목표), 갈대골 표지판, 아치 표지판 / 늪뱀 4(Lv16~17), 식인 꽃 3(Lv17~18, 제자리) -->')
out += chars
out.append(' </objectgroup>')
out.append(' <objectgroup id="3" name="portals">')
out.append(f'  <!-- 아치 → 딴따라마을 수문 아래 {VILLAGE_SPAWN}. 딴따라마을 쪽 포탈(upstream_gate)은 이 맵의 도착 칸 {ARRIVAL} 을 들고 있다. -->')
out += portals
out.append(' </objectgroup>')
out.append('</map>')
open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')
print(f'저장: {OUT}')
