"""사냥터(hunting-ground.tmx) 지형 생성기.

town.tmx의 레이어 규약을 그대로 따른다:
  ground / shadow_lower / object / shadow_upper / object_upper / deco / roof
  - object = 충돌 레이어(createWallTileLookup)이자 캐릭터와 함께 y-정렬되는 레이어
  - object 이후 레이어는 캐릭터 위에 그려진다(나무 수관이 플레이어를 가림)

기존 objectgroup(characters/portals)은 그대로 보존한다.
"""
import math
import random
import re
from collections import deque

SRC = 'src/games/my-sample-rpg/assets/maps/hunting-ground.tmx'
TOWN = 'src/games/my-sample-rpg/assets/maps/town.tmx'
W = H = 50

# ---- 타일 gid ----
GRASS = 517
GRASS_ALT = 457
DIRT = 507
COBBLE = 515
STONE_3x3 = [[532, 533, 534], [540, 541, 542], [548, 549, 550]]
TUFTS = [458, 459, 460, 461, 462]
TALLGRASS_3x3 = [[470, 471, 472], [478, 479, 480], [486, 487, 488]]
TREE_CANOPY = [[326, 327, 328], [334, 335, 336], [342, 343, 344]]
TREE_TRUNK = [350, 351, 352]
TREE_SMALL = 325
ROCKS = [527, 528]
STUMPS = [463, 464]
# 캐스트 그림자 타일(전부 alpha 128 단색). SHADOW_FILL은 꽉 찬 칸,
# SHADOW_TAPER는 좌상단 절반만 덮는 대각 타일로 스트립 끝을 마감한다.
SHADOW_FILL = 64
SHADOW_TAPER = 63
CRYSTAL = 494
PIT_TOP, PIT_BOTTOM = 501, 544
POST = [313, 329, 345, 305]

LAYER_NAMES = ['ground', 'shadow_lower', 'object', 'shadow_upper',
               'object_upper', 'deco', 'roof']
FIRST_LAYER_ID = 10   # TMX는 layer/objectgroup이 id 공간을 공유 — 기존 2,3을 피한다


def read_layers(path):
    s = open(path).read()
    out = {}
    for m in re.finditer(
        r'<layer id="\d+" name="([^"]+)" width="(\d+)" height="(\d+)">\s*'
        r'<data encoding="csv">\s*(.*?)\s*</data>', s, re.S
    ):
        out[m.group(1)] = [int(x) for x in m.group(4).replace('\n', '').split(',') if x.strip()]
    return out


class Map:
    def __init__(self):
        self.L = {n: [0] * (W * H) for n in LAYER_NAMES}
        self.keep_clear = set()

    def set(self, layer, x, y, gid):
        if 0 <= x < W and 0 <= y < H and gid:
            self.L[layer][y * W + x] = gid

    def clear(self, layer, x, y):
        # set()은 gid=0을 무시하므로(빈 칸 덮어쓰기 방지) 지우기는 따로 둔다.
        if 0 <= x < W and 0 <= y < H:
            self.L[layer][y * W + x] = 0

    def get(self, layer, x, y):
        return self.L[layer][y * W + x] if 0 <= x < W and 0 <= y < H else 0

    def free(self, x, y, w=1, h=1):
        for dy in range(h):
            for dx in range(w):
                cx, cy = x + dx, y + dy
                if not (0 <= cx < W and 0 <= cy < H):
                    return False
                if (cx, cy) in self.keep_clear or self.get('object', cx, cy):
                    return False
        return True


m = Map()
rnd = random.Random(20260831)

# ---------------------------------------------------------------- 보호 구역
KEEP_CLEAR_POINTS = [(7, 5), (13, 7), (26, 5), (16, 16), (45, 12), (2, 10)]
for px, py in KEEP_CLEAR_POINTS:
    for dy in range(-1, 2):
        for dx in range(-1, 2):
            m.keep_clear.add((px + dx, py + dy))
for py in range(9, 13):
    for px in range(0, 4):
        m.keep_clear.add((px, py))
    for px in range(46, 50):
        m.keep_clear.add((px, py))

# ---------------------------------------------------------------- 길
# 부드러운 곡선(코사인 이징)으로 중심선을 잡고, 폭 3으로만 칠한다.
# 열 사이 기울기가 1 이하라 ±1 폭만으로 자연히 이어진다 — 사각형 메움 금지(계단 방지).
TRAIL_PTS = [(0, 11), (9, 11), (16, 9), (24, 8), (32, 10), (40, 12), (46, 11), (49, 11)]


def ease(t):
    return (1 - math.cos(math.pi * t)) / 2


def trail_center(x):
    for i in range(len(TRAIL_PTS) - 1):
        x0, y0 = TRAIL_PTS[i]
        x1, y1 = TRAIL_PTS[i + 1]
        if x0 <= x <= x1:
            t = 0 if x1 == x0 else (x - x0) / (x1 - x0)
            return y0 + (y1 - y0) * ease(t)
    return float(TRAIL_PTS[-1][1])


trail = set()


def walk(points):
    """폴리라인을 한 칸씩 걸어 좌표 목록을 만든다 — 구간 사이가 끊기지 않는다."""
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


def paint(points, r=1):
    """3x3 브러시로 칠한다 — 대각 구간에서도 항상 이어진다."""
    for (x, y) in walk(points):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                trail.add((x + dx, y + dy))


# 본길: 서쪽 관문 → 동굴 입구
paint(TRAIL_PTS, r=1)
# 남쪽 지선: 본길 → 오두막 남쪽 → 수정 광맥
paint([(11, 11), (12, 19), (15, 26), (21, 31), (28, 33), (33, 33)], r=1)

for p in trail:
    m.keep_clear.add(p)

# ---------------------------------------------------------------- ground
for y in range(H):
    for x in range(W):
        m.set('ground', x, y, GRASS)

for _ in range(110):
    cx, cy = rnd.randrange(W), rnd.randrange(H)
    r = rnd.randint(1, 3)
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r and rnd.random() < 0.7:
                m.set('ground', x, y, GRASS_ALT)

for (x, y) in trail:
    m.set('ground', x, y, DIRT)

# 동굴 앞 암반 지대 — 겹친 원들로 유기적인 윤곽을 만든다
def blob(circles):
    cells = set()
    for (cx, cy, r) in circles:
        rr = r * r
        for y in range(int(cy - r) - 1, int(cy + r) + 2):
            for x in range(int(cx - r) - 1, int(cx + r) + 2):
                if 0 <= x < W and 0 <= y < H and (x - cx) ** 2 + (y - cy) ** 2 <= rr:
                    cells.add((x, y))
    return cells


# 바닥은 자갈로 깔고(3x3 큰 바위를 바닥에 반복하면 격자 이음매가 드러난다),
# 이끼 낀 3x3 바위는 나중에 '놓인 바위'로 몇 덩이만 세운다.
# 바닥은 자갈 한 겹만. heavy cobble 3x3(532~534/540~542/548~550)은 채우기 타일이 아니라
# 낱개 바위 노두라서, 반복해 깔면 3줄마다 가로띠 + 3칸마다 세로 이음매가 드러난다.
# → 바닥은 COBBLE로 깔고, 바위는 아래에서 간격을 두고 낱개로 세운다.
rock = blob([(46, 8, 5.6), (45, 13, 5.0), (48, 11, 4.6), (43, 10, 3.4)])
for (x, y) in rock:
    if (x, y) not in trail:
        m.set('ground', x, y, COBBLE)

# 남쪽 빈터의 수정 광맥
VEIN_CENTER = (31, 31)
vein = blob([(31, 31, 2.6), (33, 30, 2.0)])
for (x, y) in blob([(31, 31, 4.0), (33, 30, 3.4)]):
    if (x, y) not in trail:
        m.set('ground', x, y, COBBLE)

# ---------------------------------------------------------------- 오두막 이식
town = read_layers(TOWN)
HX0, HX1, HY0, HY1 = 12, 18, 29, 39
DEST_X, DEST_Y = 4, 15
# ground와 shadow_upper는 옮기지 않는다.
# ground: town의 자갈 광장 바닥이라 숲 지형과 안 맞는다.
# shadow_upper: 오두막 오른쪽 세로 그림자 스트립(gid 64x3 + 63)이 딸려온다. 그건 자갈
#   광장 위라서 성립하던 연출이고, 잔디 위에 얹으면 술통을 덮는 회색 막대로 보인다.
#   또 이 맵의 나무/바위/술통은 전부 스프라이트에 접지 그림자가 내장돼 있어 별도
#   그림자 레이어를 쓰지 않는다 — 오두막만 캐스트 그림자를 갖는 것도 일관성에 어긋난다.
SKIP_LAYERS = {'ground', 'shadow_upper'}
for name in LAYER_NAMES:
    if name not in town or name in SKIP_LAYERS:
        continue
    for y in range(HY0, HY1 + 1):
        for x in range(HX0, HX1 + 1):
            g = town[name][y * W + x]
            if g:
                m.set(name, DEST_X + (x - HX0), DEST_Y + (y - HY0), g)
# 오두막 앞마당
for y in range(DEST_Y + 8, DEST_Y + 11):
    for x in range(DEST_X, DEST_X + 6):
        m.set('ground', x, y, DIRT)
# 본길과 잇는 샛길
for y in range(round(trail_center(7)), DEST_Y + 9):
    for x in (7, 8):
        m.set('ground', x, y, DIRT)
        m.keep_clear.add((x, y))
# 오두막이 놓인 칸은 벽이어야 하므로 보호 해제
for y in range(DEST_Y, DEST_Y + 11):
    for x in range(DEST_X, DEST_X + 7):
        m.keep_clear.discard((x, y))

# 오두막 캐스트 그림자. 이 타일셋은 빛이 왼쪽에서 오므로(지붕 왼쪽 면이 밝고,
# town.tmx의 건물 그림자도 전부 오른쪽으로 떨어진다) 오두막 오른쪽 한 칸에 세운다.
# shadow_lower에 그린다 — object보다 먼저 그려지므로 술통/바구니와 캐릭터가 그림자
# '위'에 서고, 충돌 판정(createWallTileLookup은 object 레이어만 본다)에도 영향이 없다.
# 세로 범위는 지붕 오른쪽 처마부터 벽 기단까지, 끝은 대각 타일로 마감한다.
SHADOW_X = DEST_X + 5
for y in range(DEST_Y + 2, DEST_Y + 8):
    m.set('shadow_lower', SHADOW_X, y, SHADOW_FILL)
m.set('shadow_lower', SHADOW_X, DEST_Y + 8, SHADOW_TAPER)


# ---------------------------------------------------------------- 배치 헬퍼
def put_tree(x, y):
    # 수관 3x3 + 밑동 3x1 = 3x4 전체가 맵 안에 있고, object/object_upper 모두 비어 있어야 한다.
    # (밑동만 검사하면 뒤에 놓인 나무가 앞 나무의 수관을 덮어써 '잘린 나무'가 생긴다)
    if x < 0 or y < 0 or x + 3 > W or y + 4 > H:
        return False
    for dy in range(4):
        for dx in range(3):
            if m.get('object_upper', x + dx, y + dy) or m.get('object', x + dx, y + dy):
                return False
    if not m.free(x, y + 3, 3, 1):
        return False
    for dy in range(3):
        for dx in range(3):
            m.set('object_upper', x + dx, y + dy, TREE_CANOPY[dy][dx])
    for dx in range(3):
        m.set('object', x + dx, y + 3, TREE_TRUNK[dx])
    return True


def put_single(x, y, gid):
    if not m.free(x, y) or m.get('object_upper', x, y):
        return False
    m.set('object', x, y, gid)
    return True


def put_tallgrass(x, y):
    """3x3 블록 2~4개를 겹쳐 불규칙한 수풀 덩이를 만든다(정사각형 티 제거)."""
    blocks = [(x, y)]
    for _ in range(rnd.randint(1, 3)):
        blocks.append((x + rnd.randint(-2, 2), y + rnd.randint(-2, 2)))
    cells = {}
    for (bx, by) in blocks:
        for dy in range(3):
            for dx in range(3):
                cx, cy = bx + dx, by + dy
                if not (0 <= cx < W and 0 <= cy < H):
                    return False
                if (cx, cy) in trail or m.get('shadow_lower', cx, cy):
                    return False
                cells[(cx, cy)] = TALLGRASS_3x3[dy][dx]
    for (cx, cy), gid in cells.items():
        m.set('shadow_lower', cx, cy, gid)
    return True


def put_post(x, y):
    if not m.free(x, y + 3):
        return False
    for i in range(4):
        if m.get('object_upper', x, y + i) or m.get('object', x, y + i):
            return False
    for i, g in enumerate(POST):
        m.set('object' if i == len(POST) - 1 else 'object_upper', x, y + i, g)
    return True


def forest(x0, y0, x1, y1, density=1.0, jitter=2):
    """격자 티를 없앤 숲 — 위치를 흔들고 확률로 건너뛴다."""
    placed = 0
    y = y0
    row = 0
    while y <= y1:
        x = x0 + (row % 2) * 2
        while x <= x1:
            if rnd.random() < density:
                jx = x + rnd.randint(-jitter, jitter)
                jy = y + rnd.randint(-1, 1)
                if put_tree(jx, jy):
                    placed += 1
                elif rnd.random() < 0.5:
                    put_single(jx + 1, jy + 3, TREE_SMALL)
            x += 3 + rnd.randint(0, 1)
        y += 4
        row += 1
    return placed


# ---------------------------------------------------------------- 숲
# 북쪽 — 수관이 화면 밖으로 이어지도록 y=-1부터
forest(-1, -1, W - 1, 0, density=0.95, jitter=1)
# 남쪽 깊은 숲
forest(-1, 37, W - 1, 46, density=0.9, jitter=2)
# 서쪽 관문 위/아래
forest(-1, 3, 2, 6, density=0.9, jitter=1)
forest(-1, 19, 2, 34, density=0.8, jitter=1)
# 동쪽 동굴 위/아래
forest(46, 1, 49, 5, density=0.85, jitter=1)
forest(46, 17, 49, 34, density=0.8, jitter=1)
# 안쪽 숲 덩어리 — 빈터를 남기며
forest(18, 13, 32, 24, density=0.72, jitter=2)
forest(34, 17, 45, 30, density=0.62, jitter=2)
forest(3, 27, 16, 34, density=0.6, jitter=2)
forest(30, 3, 40, 5, density=0.55, jitter=2)
forest(22, 27, 28, 32, density=0.45, jitter=2)

# ---------------------------------------------------------------- 수정 광맥
for (x, y) in sorted(vein):
    m.keep_clear.discard((x, y))
    if rnd.random() < 0.55:          # 격자로 꽉 찬 느낌을 피한다
        put_single(x, y, CRYSTAL)
for (x, y) in [(29, 33), (35, 30), (31, 27)]:
    put_single(x, y, ROCKS[rnd.randrange(2)])

# ---------------------------------------------------------------- 사냥꾼 야영지
cx, cy = 27, 12
for y in range(cy - 1, cy + 3):
    for x in range(cx - 1, cx + 4):
        if (x, y) not in trail:
            m.set('ground', x, y, DIRT)
for (dx, dy, gid) in [(0, 0, 420), (1, 0, 353), (2, 0, 419),
                      (0, 2, 333), (2, 2, 559), (1, 2, 493)]:
    put_single(cx + dx, cy + dy, gid)
put_post(cx + 3, cy - 3)
put_post(44, 8)     # 동굴 앞 표지 기둥

# ---------------------------------------------------------------- 이끼 바위(3x3 큰 덩이)
def put_boulder(x, y):
    if x < 0 or y < 0 or x + 3 > W or y + 3 > H:
        return False
    # 주변 1칸까지 비어 있어야 다른 바위와 붙어 슬래브로 보이지 않는다
    for dy in range(-1, 4):
        for dx in range(-1, 4):
            if m.get('object', x + dx, y + dy) in STONE_3x3[0] + STONE_3x3[1] + STONE_3x3[2]:
                return False
    for dy in range(3):
        for dx in range(3):
            if not m.free(x + dx, y + dy) or m.get('object_upper', x + dx, y + dy):
                return False
    for dy in range(3):
        for dx in range(3):
            m.set('object', x + dx, y + dy, STONE_3x3[dy][dx])
    return True


# heavy cobble 3x3은 이 배율에서 그냥 갈색 덩어리로 보여 쓰지 않는다.
# 암반 느낌은 '자갈 바닥 + 작은 바위 군집(g527/g528)'만으로 낸다 — 그쪽이 훨씬 잘 읽힌다.

# ---------------------------------------------------------------- 바위 / 구덩이
for _ in range(34):
    put_single(rnd.randrange(W), rnd.randrange(H), ROCKS[rnd.randrange(2)])
for _ in range(34):
    put_single(rnd.randrange(41, 50), rnd.randrange(4, 19), ROCKS[rnd.randrange(2)])
# 큰 구덩이는 배경과 안 어울려 쓰지 않는다(PIT_TOP/PIT_BOTTOM 미사용).

# ---------------------------------------------------------------- 덤불 / 그루터기 / 작은 나무
for _ in range(26):
    put_single(rnd.randrange(W), rnd.randrange(H), STUMPS[rnd.randrange(2)])
for _ in range(55):
    put_single(rnd.randrange(W), rnd.randrange(H), TREE_SMALL)

# ---------------------------------------------------------------- 산울타리(오두막 정원)
# hedge 3x3은 top/mid/lower 한 세트라 겹치면 내부 경계선이 드러난다 — 낱개로만, 그것도 정원에만 쓴다.
def put_hedge(x, y):
    if x < 0 or y < 0 or x + 3 > W or y + 3 > H:
        return False
    for dy in range(3):
        for dx in range(3):
            if not m.free(x + dx, y + dy) or m.get('object_upper', x + dx, y + dy):
                return False
    for dy in range(3):
        for dx in range(3):
            m.set('object', x + dx, y + dy, TALLGRASS_3x3[dy][dx])
    return True


put_hedge(DEST_X - 3, DEST_Y + 7)
put_hedge(DEST_X + 7, DEST_Y + 7)

# ---------------------------------------------------------------- 풀 데칼
for _ in range(1100):
    x, y = rnd.randrange(W), rnd.randrange(H)
    if (x, y) in trail or m.get('shadow_lower', x, y) or m.get('object', x, y):
        continue
    m.set('shadow_lower', x, y, TUFTS[rnd.randrange(len(TUFTS))])
# 길 가장자리에도 몇 포기 — 흙/잔디 경계를 흐린다
for (x, y) in list(trail):
    edge = any((x + dx, y + dy) not in trail for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)))
    if edge and rnd.random() < 0.35 and not m.get('object', x, y):
        m.set('shadow_lower', x, y, TUFTS[rnd.randrange(len(TUFTS))])

# ---------------------------------------------------------------- 기본 스폰 칸 비우기
# 포털 스폰 없이 씬을 열면(에디터의 맵 전환 버튼) createInitialPlayerCharacter가 플레이어를
# 맵 중앙에 놓는다. 그 칸이 object(=충돌) 레이어면 이동 판정이 '목적지 AABB'를 보기 때문에
# 자기가 선 칸이 계속 걸려 사방 어디로도 못 움직인다 — 그래서 여기서 반드시 비워야 한다.
#
# keep_clear가 아니라 배치가 끝난 뒤 걷어내는 방식인 이유: keep_clear에 점을 더하면 put_* 의
# 성공/실패가 바뀌어 rnd 소비 순서가 밀리고 숲 전체가 다시 섞인다. 사후 제거는 rnd를 건드리지
# 않으므로 이 한 그루 말고는 결과가 그대로다.
def clear_object_at(x, y):
    """(x,y)를 덮은 오브젝트를 통째로 걷어낸다 — 큰 나무는 수관+밑동을 함께 지운다."""
    if not m.get('object', x, y):
        return
    # 큰 나무: 밑동 3x1(object) 위에 수관 3x3(object_upper). 밑동만 지우면 공중 수관이 남는다.
    for x0 in range(x - 2, x + 1):
        y0 = y - 3
        if y0 < 0 or x0 < 0 or x0 + 3 > W:
            continue
        if [m.get('object', x0 + dx, y) for dx in range(3)] != TREE_TRUNK:
            continue
        if any(m.get('object_upper', x0 + dx, y0 + dy) != TREE_CANOPY[dy][dx]
               for dy in range(3) for dx in range(3)):
            continue
        for dy in range(3):
            for dx in range(3):
                m.clear('object_upper', x0 + dx, y0 + dy)
        for dx in range(3):
            m.clear('object', x0 + dx, y)
        print(f'기본 스폰 칸 확보: ({x},{y}) 큰 나무 제거 (수관 좌상단 {x0},{y0})')
        return
    m.clear('object', x, y)
    print(f'기본 스폰 칸 확보: ({x},{y}) 단일 오브젝트 제거')


clear_object_at(W // 2, H // 2)

# ---------------------------------------------------------------- 오토타일(경계 정리)
# 잔디↔흙 / 잔디↔자갈 경계를 전환 타일로 바꾼다. gid는 gen_tiles.py가 town-32에 덧붙인 것.
DIRT_EDGE_BASE = 561    # mask 1..15 → 561..575, 대각 모서리 → 576..579
COBBLE_EDGE_BASE = 580  # mask 1..15 → 580..594, 대각 모서리 → 595..598
GRASSY = {GRASS, GRASS_ALT}

snapshot = list(m.L['ground'])


def ground_at(x, y):
    return snapshot[y * W + x] if 0 <= x < W and 0 <= y < H else None


def autotile(target_gid, base):
    """target_gid로 칠해진 칸의 잔디 경계를 전환 타일로 교체한다."""
    changed = 0
    for y in range(H):
        for x in range(W):
            if ground_at(x, y) != target_gid:
                continue
            mask = 0
            for bit, (dx, dy) in enumerate(((0, -1), (1, 0), (0, 1), (-1, 0))):
                n = ground_at(x + dx, y + dy)
                if n in GRASSY:
                    mask |= 1 << bit
            if mask:
                m.set('ground', x, y, base + (mask - 1))
                changed += 1
                continue
            # 변은 전부 같은 재질인데 대각선 하나만 잔디인 경우
            diags = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
            hit = [i for i, (dx, dy) in enumerate(diags) if ground_at(x + dx, y + dy) in GRASSY]
            if len(hit) == 1:
                m.set('ground', x, y, base + 15 + hit[0])
                changed += 1
    return changed


n_dirt = autotile(DIRT, DIRT_EDGE_BASE)
n_cob = autotile(COBBLE, COBBLE_EDGE_BASE)
print(f'오토타일: 흙 경계 {n_dirt}칸, 자갈 경계 {n_cob}칸')

# ---------------------------------------------------------------- 고립 칸 메우기
# 나무·바위를 흩뿌리다 보면 사방이 막힌 빈 칸이 남는다. 바닥은 멀쩡히 보이는데
# 영영 들어갈 수 없어 "안 가지는 구멍"으로 읽히므로, 눈에 보이는 바위로 덮어
# 막힌 이유를 드러낸다(반대로 뚫으면 나무 군집 한가운데가 열려 부자연스럽다).


def flood_from(start_cell):
    walls_now = {(i % W, i // W) for i, g in enumerate(m.L['object']) if g}
    reached = {start_cell}
    queue = deque([start_cell])
    while queue:
        x, y = queue.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if 0 <= n[0] < W and 0 <= n[1] < H and n not in reached and n not in walls_now:
                reached.add(n)
                queue.append(n)
    return walls_now, reached


walls, seen = flood_from((2, 10))
orphans = [(x, y) for y in range(H) for x in range(W)
           if (x, y) not in walls and (x, y) not in seen]
for x, y in orphans:
    m.set('object', x, y, ROCKS[(x + y) % 2])
if orphans:
    print(f'고립 칸 {len(orphans)}개를 바위로 메움: {orphans[:12]}')
    walls, seen = flood_from((2, 10))

# ---------------------------------------------------------------- 검증

CHECK = [('꿀꿀이-1', (7, 5)), ('말캉이-1', (13, 7)), ('꿀꿀이-2', (26, 5)),
         ('말캉이-2', (16, 16)), ('표지판', (45, 12)),
         ('귀환포탈', (0, 10)), ('귀환포탈2', (0, 11)),
         ('동굴포탈', (49, 10)), ('동굴포탈2', (49, 11)),
         ('맵중앙(기본스폰)', (W // 2, H // 2)),
         ('야영지앞', (27, 13)), ('오두막앞', (6, 24)), ('수정광맥앞', (31, 34))]
problems = []
for name, pt in CHECK:
    if pt in walls:
        problems.append(f'{name}{pt} 벽에 막힘')
    elif pt not in seen:
        problems.append(f'{name}{pt} 도달 불가')

print(f'벽 {len(walls)} / 도달가능 {len(seen)} / 전체 {W*H} '
      f'(고립 {W*H - len(walls) - len(seen)}칸)')
for name in LAYER_NAMES:
    print(f'  {name:14s} {sum(1 for g in m.L[name] if g):5d}')
if problems:
    print('!! 문제:')
    for p in problems:
        print('   -', p)
else:
    print('검증 통과: 몬스터/표지판/포탈/주요 지점 모두 도달 가능')

# ---------------------------------------------------------------- TMX 출력
# 현재 TMX에서 헤더(<map>/<tileset>)와 objectgroup 부분만 그대로 살리고 타일 레이어만 교체한다.
# 몇 번을 다시 돌려도 같은 결과가 나오도록(멱등) 레이어 id/nextlayerid를 매번 다시 쓴다.
src = open(SRC).read()
head = src[:src.index(' <layer ')]
tail = src[src.index(' <objectgroup '):]
head = re.sub(r'nextlayerid="\d+"',
              f'nextlayerid="{FIRST_LAYER_ID + len(LAYER_NAMES)}"', head)

parts = []
for i, name in enumerate(LAYER_NAMES, start=FIRST_LAYER_ID):
    rows = ',\n'.join(','.join(str(v) for v in m.L[name][y * W:(y + 1) * W]) for y in range(H))
    parts.append(f' <layer id="{i}" name="{name}" width="{W}" height="{H}">\n'
                 f'  <data encoding="csv">\n{rows}\n</data>\n </layer>\n')
open(SRC, 'w').write(head + ''.join(parts) + tail)
print('wrote', SRC)
