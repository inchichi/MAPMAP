"""사냥터(hunting-ground.tmx) 생성기 — 2026-10-04 재설계판.

docs/game-design-30min.md "맵 판정"의 사냥터 설계를 50x50 맵에 구현한다.
(60x45 가로형이 목표였지만, 마을/동굴 TMX의 도착 칸(targetSpawnTile)이 이 맵 좌표
(2,10)/(43,10)으로 고정돼 있고 두 포탈 위치도 그대로 둬야 해서 50x50을 유지한다.)

구역 (서→동, 레벨이 오른쪽·위로 갈수록 오른다):
  - 서쪽 초원 (Lv1~2)    : 마을 관문(return_gate, 서쪽 끝) 바로 앞, 넓게 트인 풀밭. 말캉이 6.
  - 중앙 야영지 (안전지대): 모닥불·통나무 걸상·장작·상자·차양 좌판·표지판.
                           좌판 밑(상인 자리)과 동쪽 돌바닥(귀환 표지석 자리)은 비워 둔다.
  - 북쪽 버려진 돼지 농장 (Lv3~5): 부서진 울타리 우리 두 칸, 건초·여물통·허수아비. 꿀꿀이 5.
  - 남쪽 숲길 (Lv3~4)    : 나무 군락 사이로 굽이치는 좁은 길, 버섯돌이 2, 숨은 공터의 상자.
  - 북동 낭떠러지 동굴 입구 (Lv6): 바위 절벽 띠가 동굴 아치(cave_entrance 포탈)를 감싼다. 바위돌이 1.
  - 남동 무너진 광산 입구 (Lv5): 바위벽의 갱도 입구가 낙석에 막혀 있다. 수정·광석 상자. 바위돌이 1.
                           (q009 이후 열 지름길 포탈 자리 — 지금은 주석과 decorations 오브젝트만)

레이어 규약은 town.tmx와 같다:
  ground / shadow_lower / object / shadow_upper / object_upper / deco / roof
  - object = 충돌 레이어(createWallTileLookup)이자 캐릭터와 y-정렬되는 레이어
  - object_upper 이후는 캐릭터 위에 그려진다(나무 수관이 플레이어를 가림)
  - shadow_lower = 바닥 데칼(풀포기·꽃·키 큰 풀·돌 부스러기) — 충돌 없음

objectgroup(characters / portals / decorations)도 이 스크립트가 통째로 쓴다.
포탈 두 개(return_gate, cave_entrance)의 이름·위치·목적지는 바꾸지 않는다 — 마을/동굴 TMX가
이 맵의 도착 칸을 숫자로 들고 있기 때문이다.

실행: python3 scripts/generate-hunting-ground.py   (kong 저장소 루트에서)
"""
import json
import math
import random
from collections import deque

SRC = 'src/games/my-sample-rpg/assets/maps/hunting-ground.tmx'
W = H = 50

# ---------------------------------------------------------------- 타일 gid (town-32, 전부 눈으로 확인함)
GRASS = 517
GRASS_ALT = 457
DIRT = 507
COBBLE = 515
TUFTS = [458, 459, 460, 461, 462]
TALLGRASS_3x3 = [[470, 471, 472], [478, 479, 480], [486, 487, 488]]
TREE_CANOPY = [[326, 327, 328], [334, 335, 336], [342, 343, 344]]
TREE_TRUNK = [350, 351, 352]
# 나무 변형만(같은 파일의 저택 지붕 매핑은 제외)
TREE_VARIANTS = {k: v for k, v in json.load(open('scripts/tree-variant-gids.json', encoding='utf-8')).items() if 'trunk' in v}   # deep / autumn (town 나무 변형)
ROCKS = [527, 528]                 # 회색 / 황갈색 돌무더기 (1칸)
STUMPS = [463, 464]
TUB = 473                          # 나무 여물통
BARREL = 433
# 바위 언덕 3x3 (이끼 낀 바위 둔덕) — 가운데 열을 반복해 넓은 절벽 띠를 만든다
MOUND = [[532, 533, 534], [540, 541, 542], [548, 549, 550]]
# 바위벽(윗단에 풀 턱) 535/543/551, 갱도 입구 위·아래 544/552
CLIFF_TOP, CLIFF_MID, CLIFF_BOT = 535, 543, 551
SHAFT_TOP, SHAFT_BOT = 544, 552
LPC = json.load(open('scripts/lpc-cave-gids.json', encoding='utf-8'))   # 이름 → gid (아래에서 쓰는 것은 그림을 확인함)
BOULDER = LPC['cave_prop_boulder']                     # 1091 검은 큰 바위
CAMPFIRE = LPC['cave_prop_brazier_00']                 # 1092 장작불
OBELISK = (1114, 1115)                                 # 돌 오벨리스크 (위, 아래)
CRATE_FOOD = 1095                                      # 농산물 상자 (이름표는 crate_bones)
CRATE_CRYSTAL = 1097                                   # 수정 상자 (이름표는 crate_mush)
CRYSTALS = (LPC['cave_prop_crystal_a'], LPC['cave_prop_crystal_c'])   # 1098 / 1099
PEBBLES = (LPC['cave_prop_rubble_00'], LPC['cave_prop_rubble_02'])    # 1120 / 1122 — 투명 바탕 돌 부스러기
# (rubble 01/03/04/05 는 불투명 네모 바탕이라 쓰지 않는다)
LOG_SINGLE, LOG_STACK = 1189, 1190
CART = [[1153, 1154], [1155, 1156]]
BUSHES = [1150, 1151, 1152]
FLOWERS = [LPC[f'town_prop_flower_{k}'] for k in 'abcd']
FENCE_H = LPC['town_prop_fence_h_m']     # 1161 정면 피켓
FENCE_V = LPC['town_prop_fence_v']       # 1258 측면 세로 레일
FENCE_POST = LPC['town_prop_fence_post']  # 1163 부러진 기둥
HAYSTACK = [[1176, 1177], [1178, 1179]]  # 둥근 건초더미 2x2
HAY_BLOCKS = (1168, 1169)                # 네모 건초 (1칸짜리 두 종)
SCARECROW = (1192, 1193)                 # 허수아비 머리(위) / 기둥(아래)
AWNING = {'top': (393, 394, 395), 'valance': (401, 402, 403), 'posts': (409, 411), 'shade': 410}

LAYER_NAMES = ['ground', 'shadow_lower', 'object', 'shadow_upper',
               'object_upper', 'deco', 'roof']
FIRST_LAYER_ID = 10

rnd = random.Random(20261004)


class Map:
    def __init__(self):
        self.L = {n: [0] * (W * H) for n in LAYER_NAMES}
        self.keep_clear = set()     # 오브젝트(충돌)를 놓지 않는 칸
        self.no_canopy = set()      # 나무 수관이 덮으면 안 되는 칸(몬스터·표지판·랜드마크)

    def inb(self, x, y):
        return 0 <= x < W and 0 <= y < H

    def set(self, layer, x, y, gid):
        if self.inb(x, y) and gid:
            self.L[layer][y * W + x] = gid

    def clear(self, layer, x, y):
        if self.inb(x, y):
            self.L[layer][y * W + x] = 0

    def get(self, layer, x, y):
        return self.L[layer][y * W + x] if self.inb(x, y) else 0

    def occupied(self, x, y):
        return bool(self.get('object', x, y) or self.get('object_upper', x, y))

    def free(self, x, y):
        return self.inb(x, y) and (x, y) not in self.keep_clear and not self.occupied(x, y)


m = Map()


def disc(cx, cy, r):
    return {(x, y) for y in range(int(cy - r) - 1, int(cy + r) + 2)
            for x in range(int(cx - r) - 1, int(cx + r) + 2)
            if m.inb(x, y) and (x - cx) ** 2 + (y - cy) ** 2 <= r * r}


def blob(circles):
    out = set()
    for c in circles:
        out |= disc(*c)
    return out


def curve(points, radius):
    """Catmull-Rom 곡선을 촘촘히 따라 원형 브러시로 칠한 칸 집합 (계단 없는 곡선 길)."""
    pts = [points[0]] + list(points) + [points[-1]]
    cells = set()
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        steps = max(4, int(math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 5))
        for st in range(steps + 1):
            t = st / steps
            t2, t3 = t * t, t * t * t
            cx = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
                        + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            cy = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
                        + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            cells |= disc(cx, cy, radius)
    return cells


def ring(cx, cy, r):
    """(cx,cy) 둘레 r칸 사각 영역."""
    return {(cx + dx, cy + dy) for dy in range(-r, r + 1) for dx in range(-r, r + 1) if m.inb(cx + dx, cy + dy)}


# ================================================================ 고정 좌표
# 포탈·도착 칸은 다른 TMX가 숫자로 들고 있다 — 바꾸지 말 것.
RETURN_GATE = (0, 10)          # 1x2 (0,10)~(0,11), 마을 동문으로
TOWN_ARRIVAL = (2, 10)         # town.tmx east_gate.targetSpawnTile
CAVE_GATE = (49, 10)           # 1x2 (49,10)~(49,11), 동굴로. 아치 그림은 (48~50, 10~12)에 걸린다
CAVE_ARRIVAL = (43, 10)        # cave.tmx return_gate.targetSpawnTile
MAP_CENTER = (W // 2, H // 2)  # 포탈 없이 씬을 열면(에디터 맵 전환) 여기 선다

# ---------------------------------------------------------------- 몬스터 (이름, 종류, 레벨, 칸)
# 이름 끝 '-n'은 표시 이름에서 잘린다(monsterDisplayName). q001/q003은 씬+종류로 센다.
MONSTERS = [
    # 서쪽 초원 — 말캉이 Lv1~2 (q001). 관문 도착 칸에서 5칸 이상, 서로 5칸 안팎 떨어뜨린다.
    ('말캉이-1', 'monster_slime', 1, (7, 5)),
    ('말캉이-2', 'monster_slime', 1, (14, 7)),
    ('말캉이-3', 'monster_slime', 1, (6, 15)),
    ('말캉이-4', 'monster_slime', 2, (10, 20)),
    ('말캉이-5', 'monster_slime', 2, (5, 25)),
    ('말캉이-6', 'monster_slime', 2, (13, 27)),
    # 북쪽 버려진 돼지 농장 — 꿀꿀이 Lv3~5 (q003)
    ('꿀꿀이-1', 'monster_pig', 3, (20, 8)),
    ('꿀꿀이-2', 'monster_pig', 3, (22, 11)),
    ('꿀꿀이-3', 'monster_pig', 4, (29, 8)),
    ('꿀꿀이-4', 'monster_pig', 4, (31, 11)),
    ('꿀꿀이-5', 'monster_pig', 5, (37, 4)),
    # 남쪽 숲길 — 버섯돌이 Lv3~4
    ('버섯돌이-1', 'monster_mushroom', 3, (17, 37)),
    ('버섯돌이-2', 'monster_mushroom', 4, (27, 44)),
    # 동쪽 — 바위돌이 (남동 광산 Lv5, 북동 동굴 앞 Lv6)
    ('바위돌이-1', 'monster_rock', 5, (38, 39)),
    ('바위돌이-2', 'monster_rock', 6, (39, 13)),
]
# 예전 TMX 오브젝트 id를 이어 쓴다(에디터·저장 상태가 id로 기억하는 경우 대비)
LEGACY_IDS = {'꿀꿀이-1': 5, '말캉이-1': 6, '꿀꿀이-2': 8, '말캉이-2': 9}

SIGNS = [
    # (이름, 표시 문구, 칸) — 'sign_inn'은 렌더러가 기둥+이름판으로 그리는 표지판 타입
    ('cave_entrance_sign', '어스름 굴 입구', (45, 12)),     # 기존 오브젝트(id 11) 그대로
    ('camp_sign', '사냥꾼 야영지', (17, 24)),        # 서쪽 길 어귀(상인 이름표와 겹치지 않게)
    ('farm_sign', '버려진 돼지 농장', (26, 16)),
    ('mine_sign', '무너진 광산', (34, 37)),
]

# ---------------------------------------------------------------- 야영지 / 예약 자리
CAMP = (25, 24)                # 모닥불 공터 중심(맵 중앙 (25,25) 바로 위)
CAMPFIRE_AT = (25, 23)
STALL_AT = (19, 19)            # 차양 좌판 좌상단 (3x3)
# 상인 NPC 자리: 좌판 바로 앞(차양 밑에 세우면 머리가 차양 천에 가려 얼굴이 안 보인다).
MERCHANT_SPOT = (STALL_AT[0] + 1, STALL_AT[1] + 3)
# 미래 귀환 표지석 자리: 야영지 동남쪽 둥근 돌바닥 한가운데. 지금은 비워 둔다.
RETURN_STONE_SPOT = (33, 27)
# 남동 광산: 절벽 띠(MINE_CLIFF) 가운데 갱도 입구, 그 앞 칸이 지름길 포탈 자리(지금은 낙석 바위).
MINE_CLIFF = (34, 32, 12)      # (x0, y0, 폭) — 3칸 높이
MINE_SHAFT_X = 40
MINE_PORTAL_SPOT = (MINE_SHAFT_X, MINE_CLIFF[1] + 3)
# 북동 절벽: 동굴 아치 바로 위를 지나는 벼랑 띠, 아치 남쪽의 낮은 둔덕
CAVE_CLIFF = (39, 7, 11)
# 숨은 공터(사이드 퀘스트용 상자)
NOOK = (9, 41)

# ================================================================ 지형 영역
# 길은 대각선 구간을 짧게 두고 완만한 곡선으로 잇는다(타일 대각선은 계단처럼 보인다).
TRAIL_WEST = [(-1, 10.5), (5, 10.5), (9, 11), (12, 12.5), (14, 15), (15, 18),
              (16.5, 20.5), (19, 22.2), (23, 23.2)]
TRAIL_EAST = [(26, 23.5), (30, 23.2), (33.5, 22), (35.5, 19.5), (36.5, 16.5), (38, 13.5),
              (40.5, 11.6), (44, 11), (50, 11)]
FARM_LANE = [(28.5, 23), (28.5, 19.5), (28.3, 16.5), (28, 13)]
FOREST_PATH = [(24.5, 26), (24.3, 29), (22.5, 31.5), (19.5, 33), (17.3, 35), (16.5, 38),
               (17.5, 41), (20.5, 43), (24.5, 44.2), (29, 43.6), (32, 41.6), (34.5, 40), (38, 39.5)]
trail = curve(TRAIL_WEST, 1.5) | curve(TRAIL_EAST, 1.5) | curve(FARM_LANE, 1.3)
forest_path = curve(FOREST_PATH, 1.1)
camp_dirt = blob([(25, 24, 3.7), (22.5, 23, 2.6), (27.5, 24.5, 2.5), (20.5, 21.8, 2.1)])
# 농장 우리 안 진흙 웅덩이
farm_mud = blob([(21, 9.5, 2.0), (23, 10.8, 1.5), (29.5, 9, 1.9), (31, 10.8, 1.5), (19.5, 11.5, 1.2)])
# 바위 지대(자갈 바닥)
rock_ne = blob([(44, 11, 3.2), (41.5, 11.5, 2.6), (47.5, 11, 2.2), (39.5, 13, 2.0)])
rock_se = blob([(39.5, 37.5, 3.0), (42.5, 37, 2.6), (37, 38.5, 2.2), (40, 39.8, 2.4), (44, 38.5, 1.8)])
stone_pad = disc(RETURN_STONE_SPOT[0], RETURN_STONE_SPOT[1], 2.5)

# ---------------------------------------------------------------- ground
for y in range(H):
    for x in range(W):
        m.set('ground', x, y, GRASS)
# 잔디 얼룩: 성긴 값 노이즈로 큰 덩어리만(점점이 흩뿌리면 지저분하다)
NOISE_STEP = 5
_nz = [[rnd.random() for _ in range(W // NOISE_STEP + 5)] for _ in range(H // NOISE_STEP + 5)]


def noise(x, y, step=NOISE_STEP, grid=_nz):
    gx, gy = x / step, y / step
    x0, y0 = int(gx), int(gy)
    tx, ty = gx - x0, gy - y0
    tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    a = grid[y0][x0] * (1 - tx) + grid[y0][x0 + 1] * tx
    b = grid[y0 + 1][x0] * (1 - tx) + grid[y0 + 1][x0 + 1] * tx
    return a * (1 - ty) + b * ty


for y in range(H):
    for x in range(W):
        if noise(x, y) > 0.62:
            m.set('ground', x, y, GRASS_ALT)
m.set('ground', 0, 0, GRASS_ALT)


def band_cells(x0, y0, width):
    return {(x0 + c, y0 + r) for r in range(3) for c in range(width)}


cliff_cells = band_cells(*CAVE_CLIFF) | band_cells(*MINE_CLIFF)
cobble_cells = (rock_ne | rock_se | stone_pad) - cliff_cells
dirt_cells = (trail | forest_path | camp_dirt | farm_mud) - cobble_cells - cliff_cells


def smooth(cells, rounds=4):
    """오토타일이 못 그리는 모양(1칸 목, 홈)을 없앤다: 잔디에 3면이 둘러싸인 칸은 지우고,
    재질에 3면이 둘러싸인 잔디 칸은 채운다."""
    cells = set(cells)
    for _ in range(rounds):
        changed = False
        for y in range(H):
            for x in range(W):
                n = sum((x + dx, y + dy) in cells or not m.inb(x + dx, y + dy)
                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if (x, y) in cells:
                    ns = ((x, y - 1) in cells or y == 0) or ((x, y + 1) in cells or y == H - 1)
                    ew = ((x - 1, y) in cells or x == 0) or ((x + 1, y) in cells or x == W - 1)
                    if n <= 1 or not ns or not ew:
                        cells.discard((x, y))
                        changed = True
                elif n >= 3 and (x, y) not in cliff_cells:
                    cells.add((x, y))
                    changed = True
        if not changed:
            break
    return cells


cobble_cells = smooth(cobble_cells)
dirt_cells = smooth(dirt_cells - cobble_cells) - cobble_cells
for (x, y) in dirt_cells:
    m.set('ground', x, y, DIRT)
for (x, y) in cobble_cells:
    m.set('ground', x, y, COBBLE)

walk_cells = dirt_cells | cobble_cells
m.keep_clear |= trail | forest_path

# ---------------------------------------------------------------- 보호 구역
for name, kind, lvl, (x, y) in MONSTERS:
    m.keep_clear |= ring(x, y, 2)      # 싸울 자리: 5x5 비움
    m.no_canopy |= ring(x, y, 1)
for name, text, (x, y) in SIGNS:
    m.keep_clear |= ring(x, y, 1)
    m.no_canopy |= {(x, y), (x, y - 1), (x, y - 2)}
for p in (TOWN_ARRIVAL, CAVE_ARRIVAL, MAP_CENTER):
    m.keep_clear |= ring(p[0], p[1], 1)
# 관문 앞 통로(세로 2칸 포탈 전체가 길 위에 오도록)
for y in range(8, 14):
    for x in range(0, 4):
        m.keep_clear.add((x, y))
# 동굴 아치 앞마당과 아치 자체(아치 그림이 덮는 칸에는 아무것도 놓지 않는다)
for y in range(10, 13):
    for x in range(42, 50):
        m.keep_clear.add((x, y))
for y in range(9, 14):
    for x in range(46, 50):
        m.no_canopy.add((x, y))
m.keep_clear |= ring(CAMP[0], CAMP[1], 4) - {(STALL_AT[0] + dx, STALL_AT[1] + dy) for dx in range(3) for dy in range(3)}
m.no_canopy |= ring(CAMP[0], CAMP[1], 5)
m.keep_clear |= ring(*RETURN_STONE_SPOT, 2)
m.no_canopy |= ring(*RETURN_STONE_SPOT, 2)
m.keep_clear |= ring(*MINE_PORTAL_SPOT, 1) - {MINE_PORTAL_SPOT}
# 광산 벼랑 위 턱(3행)은 양 끝으로 이어지는 빈 띠로 남긴다 — 나무 밑동이 막으면 갇힌 칸이 생긴다
for y in range(MINE_CLIFF[1] - 3, MINE_CLIFF[1]):
    for x in range(MINE_CLIFF[0] - 2, MINE_CLIFF[0] + MINE_CLIFF[2] + 2):
        m.keep_clear.add((x, y))


# ================================================================ 배치 헬퍼
def put(x, y, gid, layer='object', force=False):
    if not force and not m.free(x, y):
        return False
    m.set(layer, x, y, gid)
    return True


def put_block(x, y, rows, solid_from=0, upper_layer='object_upper', force=False):
    """멀티타일 소품. solid_from 행부터는 object(충돌), 그 위는 upper_layer."""
    cells = [(x + c, y + r) for r in range(len(rows)) for c in range(len(rows[0])) if rows[r][c]]
    if not force and any(not m.free(cx, cy) for cx, cy in cells):
        return False
    for r, row in enumerate(rows):
        for c, g in enumerate(row):
            if g:
                m.set('object' if r >= solid_from else upper_layer, x + c, y + r, g)
    return True


def decal(x, y, gid):
    if m.inb(x, y) and not m.get('shadow_lower', x, y):
        m.set('shadow_lower', x, y, gid)


def cliff_band(x0, y0, width, shaft_x=None):
    """바위 둔덕 타일(3x3)의 가운데 열을 늘린 벼랑 띠. 윗면이 곧은 절벽 얼굴이라 띠 위쪽(북쪽)은
    높은 지대로 읽힌다 — 그 지대는 띠 양 끝으로 돌아 올라갈 수 있게 열어 둔다(고립 칸 방지)."""
    for r in range(3):
        for c in range(width):
            col = 0 if c == 0 else 2 if c == width - 1 else 1
            m.set('object', x0 + c, y0 + r, MOUND[r][col])
    if shaft_x is not None:
        m.set('object', shaft_x, y0 + 1, SHAFT_TOP)
        m.set('object', shaft_x, y0 + 2, SHAFT_BOT)


# ================================================================ 북동: 낭떠러지 동굴 입구
# 동굴 아치(cave_entrance 포탈 그림, 48~50열 10~12행)가 벼랑 띠 바로 밑에 붙고,
# 남쪽은 큰 바위 무더기가 막아 아치 앞이 3칸 폭 바위 골목이 된다. 바닥은 자갈.
cliff_band(*CAVE_CLIFF)
for (x, y, g) in [
        # 아치 남쪽 바위 무더기
        (46, 13, BOULDER), (47, 13, ROCKS[0]), (48, 13, BOULDER), (49, 13, ROCKS[1]),
        (47, 14, BOULDER), (49, 14, BOULDER), (45, 14, ROCKS[1]), (48, 15, ROCKS[0]),
        # 벼랑 서쪽 끝을 무너진 돌로 흐린다
        (38, 9, BOULDER), (38, 8, ROCKS[1]), (37, 9, ROCKS[0]),
        # 벼랑 위 가장자리(고지대)
        (41, 6, ROCKS[0]), (44, 6, BOULDER), (48, 6, ROCKS[1]),
        # 골목 어귀
        (42, 14, ROCKS[0]), (36, 12, BOULDER)]:
    put(x, y, g)
for (x, y) in [(41, 10), (46, 12), (40, 12), (43, 12), (47, 10)]:
    decal(x, y, PEBBLES[(x * 3 + y) % 2])

# ================================================================ 남동: 무너진 광산 입구
mx0, my0, mw = MINE_CLIFF
cliff_band(mx0, my0, mw, shaft_x=MINE_SHAFT_X)
# 갱도 앞 낙석: 큰 바위가 입구를 막고 있다.
# 광산 지름길: 갱도 앞 큰 바위는 타일이 아니라 오브젝트(gated_boulder)다. q009(수정 광산)를 마치면
# 바위가 사라지고 같은 칸의 crystal-mine 행 포탈이 열린다(tiled/applyQuestGatedEvents.ts).
put(MINE_SHAFT_X - 1, my0 + 3, ROCKS[0], force=True)
for (x, y) in [(MINE_SHAFT_X + 1, my0 + 3), (MINE_SHAFT_X - 1, my0 + 4), (MINE_SHAFT_X + 1, my0 + 4),
               (MINE_SHAFT_X, my0 + 4), (MINE_SHAFT_X - 2, my0 + 3)]:
    decal(x, y, PEBBLES[(x + y) % 2])
# 수정 노두와 광석 상자, 버려진 수레
for i, (x, y) in enumerate([(36, 35), (44, 35), (45, 37), (42, 40), (35, 40)]):
    put(x, y, CRYSTALS[i % 2])
put(43, 35, CRATE_CRYSTAL)
put(37, 35, CRATE_CRYSTAL)
put_block(44, 39, CART, solid_from=0)
put(41, 41, ROCKS[1])
# 벼랑 위 가장자리(고지대)에 돌과 덤불 — 곧은 윗선을 흐린다
for (x, y, g) in [(35, 31, ROCKS[0]), (39, 31, BUSHES[0]), (43, 31, ROCKS[1]), (45, 30, BUSHES[2])]:
    put(x, y, g, force=True)

# ================================================================ 중앙 야영지
fx, fy = CAMPFIRE_AT
put(fx, fy, CAMPFIRE, force=True)                 # 모닥불(랜드마크)
for (x, y) in [(fx - 1, fy), (fx + 1, fy)]:      # 불가 돌 부스러기
    decal(x, y, PEBBLES[0])
put(fx - 2, fy, LOG_SINGLE, force=True)           # 통나무 걸상 좌/우/뒤
put(fx + 2, fy, LOG_SINGLE, force=True)
put(fx, fy - 2, LOG_SINGLE, force=True)
put(fx + 3, fy - 2, LOG_STACK, force=True)        # 장작더미
put(fx + 4, fy - 2, CRATE_FOOD, force=True)
put(fx + 4, fy + 2, CRATE_FOOD, force=True)       # 보급 상자
put(fx + 3, fy + 3, BARREL, force=True)
# 차양 좌판(상인 자리). 3x3: 윗행 차양(충돌) / 가운데 처마(위층, 통과) / 아랫행 기둥 둘 + 그늘
sx, sy = STALL_AT
for c, g in enumerate(AWNING['top']):
    m.set('object', sx + c, sy, g)
for c, g in enumerate(AWNING['valance']):
    m.set('object_upper', sx + c, sy + 1, g)
m.set('object', sx, sy + 2, AWNING['posts'][0])
m.set('object', sx + 2, sy + 2, AWNING['posts'][1])
# 기둥 사이 그늘(AWNING['shade'])은 두지 않는다 — 앞에 선 상인의 머리를 덮는다.
# NOTE(상인/귀환 표지석): MERCHANT_SPOT(차양 밑)과 RETURN_STONE_SPOT(동남쪽 돌바닥)은 일부러 비워 둔다.
#   상인 NPC와 귀환 표지석이 들어오면 characters 오브젝트로 그 칸에 세운다. decorations 오브젝트 참고.
put(sx - 1, sy + 2, CRATE_FOOD, force=True)       # 좌판 옆 상자
# 귀환 표지석: 돌바닥 가운데 오벨리스크(2칸), 그 앞 칸의 마법진이 마을 광장행 포탈
rx, ry = RETURN_STONE_SPOT
put(rx, ry, OBELISK[1], force=True)
m.set('object_upper', rx, ry - 1, OBELISK[0])
put(sx + 3, sy, BARREL, force=True)
m.keep_clear |= {MERCHANT_SPOT, (MERCHANT_SPOT[0], MERCHANT_SPOT[1] + 1)}

# ================================================================ 북쪽: 버려진 돼지 농장
FARM = (17, 4, 33, 14)        # 울타리 사각형 (x0, y0, x1, y1)
DIVIDER_X = 25
fx0, fy0, fx1, fy1 = FARM
gaps = set()
gaps |= {(x, fy1) for x in (27, 28, 29)}           # 남문(야영지 길)
gaps |= {(fx0, y) for y in (10, 11)}                # 서쪽 무너진 틈(초원에서)
gaps |= {(fx1, y) for y in (6, 7)}                  # 동쪽 무너진 틈(동굴 쪽)
gaps |= {(DIVIDER_X, y) for y in (8, 9)}            # 칸막이 통로
gaps |= {(20, fy0), (21, fy0), (31, fy0)}           # 북쪽 울타리 빠진 데
gaps |= {(21, fy1), (fx1, 12)}
broken = {(19, fy1), (fx0, 6), (24, fy0), (fx1, 10), (DIVIDER_X, 12)}   # 기둥만 남은 칸
fence = []
for x in range(fx0, fx1 + 1):
    fence += [(x, fy0, FENCE_H), (x, fy1, FENCE_H)]
for y in range(fy0 + 1, fy1):
    fence += [(fx0, y, FENCE_V), (fx1, y, FENCE_V)]
for y in range(fy0 + 1, fy1):
    fence.append((DIVIDER_X, y, FENCE_V))
for (x, y, g) in fence:
    if (x, y) in gaps:
        continue
    m.set('object', x, y, FENCE_POST if (x, y) in broken else g)
# 우리 안 소품: 여물통, 건초, 허수아비, 건초더미. 몬스터 칸에서 2칸(체비셰프) 이상 떨어뜨린다.
monster_near = set()
for _n, _k, _l, (mx_, my_) in MONSTERS:
    monster_near |= ring(mx_, my_, 1)


def put_prop(x, y, rows):
    cells = [(x + c, y + r) for r in range(len(rows)) for c in range(len(rows[0]))]
    assert not any(c in monster_near or m.occupied(*c) for c in cells), (x, y)
    put_block(x, y, rows, solid_from=len(rows) - 1, force=True)


put_prop(18, 5, [[SCARECROW[0]], [SCARECROW[1]]])
put_prop(23, 5, [[TUB]])
put_prop(18, 12, HAYSTACK)
put_prop(24, 13, [[TUB]])
put_prop(26, 11, HAYSTACK)
put_prop(32, 5, [[HAY_BLOCKS[0]]])
put_prop(32, 13, [[HAY_BLOCKS[1]]])
put_prop(27, 5, [[LOG_SINGLE]])
# 농장 밖 서쪽 낡은 수레와 장작
put_block(14, 2, CART, solid_from=0)
put(16, 3, LOG_STACK)

# ================================================================ 숨은 공터 (남서 숲속)
# 숲길 서쪽 굽이에서 나무 사이 한 칸짜리 틈으로 들어가는 작은 빈터. 사이드 퀘스트용 상자.
nx, ny = NOOK
nook_cells = disc(nx, ny, 1.6)
nook_gap = curve([(15, 39.5), (12.5, 40.5), (10, 41)], 0.6)
m.keep_clear |= nook_cells | nook_gap
m.no_canopy |= {(nx - 1, ny - 1), (nx, ny - 1)}
# 숨은 상자는 오브젝트(hidden_cache, q015 대화 목표). 옆 통만 타일.
put(nx, ny - 1, BARREL, force=True)
for (x, y) in [(nx + 1, ny), (nx - 1, ny + 1)]:
    decal(x, y, FLOWERS[(x + y) % 4])

# ================================================================ 나무
# 밀도 = 가장자리 숲 띠 + 숲 덩이(원) + 남쪽 깊은 숲, 공터(원)에선 0.
# 나무는 town 나무와 수관 색만 바꾼 변형(deep/autumn)만 쓴다(LPC 나무는 그림체가 달라 금지).
# 수관은 겹칠 수 있다: 뒤 나무는 object_upper, 그 앞에서 겹치는 나무는 deco 레이어에 그려
# 앞 나무가 위에 오게 한다. 한 칸에 수관 둘까지만 — 셋째로 겹치면 심지 않는다.
GROVES = [
    # 서쪽 초원: 사냥 동선 사이의 작은 숲 덩이
    (10, 1, 4.0), (2, 20, 3.5), (9, 31, 3.5), (17.5, 13.5, 2.4), (2, 3, 3.0), (20, 16.5, 2.0),
    # 농장 북쪽·동쪽, 북동 고지대
    (27, 1, 3.5), (36, 9, 2.5), (41, 3, 3.2), (47, 3, 3.5), (35, 14, 2.4), (46, 17, 3.0),
    # 야영지 동쪽 풀밭
    (34, 26, 3.6), (41, 21, 4.0), (47, 19, 3.5), (30, 31, 2.8),
    # 남쪽 깊은 숲
    (6, 37, 6.5), (12, 47, 6.5), (13, 33, 3.5), (12.5, 38, 2.6), (6, 44, 3.0), (22, 38, 5.0), (29, 38, 3.8), (23, 49, 5.5), (35, 47, 5.0),
    (47, 28, 4.5), (47, 46, 4.5), (19, 28, 2.5), (40, 29, 2.6),
]
CLEARINGS = [
    (8, 8, 6.5), (8, 21, 6.0), (11, 26, 3.5), (25, 9, 7.0), (25, 24, 6.0),
    (44, 11, 5.0), (40, 38, 5.0), (31, 27, 3.0),
]
canopy_layer = {}   # (x, y) → [layer, ...] 이 칸에 수관을 그린 레이어들
tree_rows = {}      # (x, y) 수관 칸 → 그 나무의 밑동 행(앞뒤 판정)


def tree_density(x, y):
    """(x,y) = 밑동 가운데 칸."""
    if (x, y) in walk_cells:
        return 0.0
    d = min(x, y - 2, W - 1 - x, H - 1 - y)
    base = 0.95 if d <= 1 else 0.55 if d <= 2 else 0.15 if d <= 3 else 0.0
    for gx, gy, r in GROVES:
        dist = math.hypot(x - gx, y - gy)
        if dist < r:
            base = max(base, 0.95 * (1 - dist / r) + 0.35)
    for cx, cy, r in CLEARINGS:
        if math.hypot(x - cx, y - cy) < r:
            base *= 0.1 if d > 1 else 0.7
    return min(1.0, base * (0.65 + 0.7 * noise(x + 7, y + 3)))


def put_tree(x, y, kind='town'):
    """(x,y) = 3x4 발자국의 좌상단. 위 3행 수관, 맨 아래 행 밑동(object)."""
    if x < 0 or y < -1 or x + 3 > W or y + 4 > H:
        return False
    trunk_row = y + 3
    for dx in range(3):
        if not m.free(x + dx, trunk_row) or (x + dx, trunk_row) in canopy_layer:
            return False
    need_front = False
    for r in range(3):
        for c in range(3):
            cell = (x + c, y + r)
            if cell[1] < 0:
                continue
            if cell in m.no_canopy:
                return False
            if m.get('object', *cell) and m.get('object', *cell) not in TRUNK_GIDS:
                return False        # 소품(울타리·바위 등) 위에는 수관을 걸지 않는다
            if m.get('object_upper', *cell) and cell not in canopy_layer:
                return False        # 차양·허수아비 머리 등
            layers = canopy_layer.get(cell, [])
            if len(layers) >= 2:
                return False
            if layers:
                if tree_rows[cell] >= trunk_row:
                    return False    # 겹치는 쪽은 항상 앞(아래) 나무여야 한다
                need_front = True
    # 너무 가깝게 포개지면(밑동 간격 2칸 미만) 덩어리져 보인다
    for (ox, oy) in trunk_centers:
        if abs(ox - (x + 1)) < 2 and abs(oy - trunk_row) < 2:
            return False
    layer = 'deco' if need_front else 'object_upper'
    if need_front:
        for r in range(3):
            for c in range(3):
                cell = (x + c, y + r)
                if cell in canopy_layer and 'deco' in canopy_layer[cell]:
                    return False
    canopy, trunk = ((TREE_CANOPY, TREE_TRUNK) if kind == 'town'
                     else (TREE_VARIANTS[kind]['canopy'], TREE_VARIANTS[kind]['trunk']))
    for r in range(3):
        for c in range(3):
            cell = (x + c, y + r)
            if not m.inb(*cell):
                continue
            m.set(layer, *cell, canopy[r][c])
            canopy_layer.setdefault(cell, []).append(layer)
            tree_rows[cell] = trunk_row
    for c in range(3):
        m.set('object', x + c, trunk_row, trunk[c])
    trunk_centers.append((x + 1, trunk_row))
    return True


TRUNK_GIDS = set(TREE_TRUNK) | {g for v in TREE_VARIANTS.values() for g in v['trunk']}
trunk_centers = []
# 앞뒤 판정이 쉬우려면 뒤(위) 나무부터 심어야 한다 → 후보를 밀도로 고른 뒤 행 순서로 심는다.
cands = []
for y in range(2, H):
    for x in range(W):
        if rnd.random() < tree_density(x, y):
            cands.append((y, rnd.random(), x))
cands.sort()
trees = 0
for ty, _r, tx in cands:
    kind = 'town' if rnd.random() < 0.55 else 'deep'
    if put_tree(tx - 1, ty - 3, kind):
        trees += 1
print(f'나무 {trees}그루')
# 가을 나무 — 숲길 굽이와 야영지 둘레의 눈요기(정해진 자리, 빈자리일 때만)
for ax, ay in ((12, 33), (30, 33), (21, 15), (37, 24), (5, 6)):
    put_tree(ax, ay, 'autumn')

# ---------------------------------------------------------------- 덤불·그루터기·바위
trunks = [(i % W, i // W) for i, g in enumerate(m.L['object']) if g in TRUNK_GIDS]
for (x, y) in trunks:
    if rnd.random() < 0.16:
        bx, by = x + rnd.choice((-2, 2)), y + rnd.choice((0, 1))
        if (bx, by) not in walk_cells and (bx, by) not in canopy_layer:
            put(bx, by, BUSHES[rnd.randrange(3)])
for (x, y) in [(10, 14), (3, 29), (31, 17), (23, 34), (36, 29), (12, 4), (44, 21)]:
    put(x, y, STUMPS[(x + y) % 2])
for (x, y) in [(15, 23), (3, 13), (19, 3), (32, 21), (20, 30), (9, 17)]:
    put(x, y, ROCKS[(x + y) % 2])

# ---------------------------------------------------------------- 풀포기·꽃 (바닥 데칼)
near_tree = set()
for (x, y) in trunks:
    for dy in range(-2, 3):
        for dx in range(-3, 4):
            near_tree.add((x + dx, y + dy))
for y in range(H):
    for x in range(W):
        if (x, y) in walk_cells or m.get('shadow_lower', x, y) or m.get('object', x, y):
            continue
        if rnd.random() < 0.025 + (0.16 if (x, y) in near_tree else 0):
            m.set('shadow_lower', x, y, TUFTS[rnd.randrange(5)])
for (x, y) in dirt_cells:
    edge = any((x + dx, y + dy) not in dirt_cells for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    if edge and rnd.random() < 0.18 and not m.get('object', x, y):
        decal(x, y, TUFTS[rnd.randrange(5)])
for fx_, fy_ in ((4, 12), (11, 24), (8, 2), (34, 29), (21, 29), (41, 18), (36, 2), (13, 16)):
    for _ in range(6):
        x, y = fx_ + rnd.randint(-2, 2), fy_ + rnd.randint(-1, 1)
        if (x, y) not in walk_cells and not m.occupied(x, y) and not m.get('shadow_lower', x, y) \
                and (x, y) not in canopy_layer:
            m.set('shadow_lower', x, y, FLOWERS[rnd.randrange(4)])

# ================================================================ 오토타일 (잔디↔흙, 잔디↔자갈)
DIRT_EDGE_BASE = 561    # mask 1..15 → 561..575, 대각 모서리 → 576..579
COBBLE_EDGE_BASE = 580  # mask 1..15 → 580..594, 대각 모서리 → 595..598
GRASSY = {GRASS, GRASS_ALT}
snapshot = list(m.L['ground'])


def ground_at(x, y):
    return snapshot[y * W + x] if m.inb(x, y) else None


def autotile(target, base):
    n = 0
    for y in range(H):
        for x in range(W):
            if ground_at(x, y) != target:
                continue
            mask = 0
            for bit, (dx, dy) in enumerate(((0, -1), (1, 0), (0, 1), (-1, 0))):
                if ground_at(x + dx, y + dy) in GRASSY:
                    mask |= 1 << bit
            if mask:
                m.set('ground', x, y, base + mask - 1)
                n += 1
                continue
            diags = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
            hit = [i for i, (dx, dy) in enumerate(diags) if ground_at(x + dx, y + dy) in GRASSY]
            if hit:
                m.set('ground', x, y, base + 15 + hit[0])
                n += 1
    return n


print(f'오토타일: 흙 {autotile(DIRT, DIRT_EDGE_BASE)}칸, 자갈 {autotile(COBBLE, COBBLE_EDGE_BASE)}칸')


# ================================================================ 고립 칸 메우기 / 검증
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


walls, seen = flood(TOWN_ARRIVAL)
orphans = [(x, y) for y in range(H) for x in range(W) if (x, y) not in walls and (x, y) not in seen]
# 나무 사이에 갇힌 빈 칸은 덤불로 메운다(눈에 보이는 막힘 — 투명 충돌 금지).
for (x, y) in orphans:
    m.set('object', x, y, BUSHES[(x + y) % 3])
if orphans:
    print(f'고립 칸 {len(orphans)}개를 덤불로 메움: {orphans}')
walls, seen = flood(TOWN_ARRIVAL)

problems = []
checks = [(n, p) for n, _k, _l, p in MONSTERS] + [(n, p) for n, _t, p in SIGNS] + [
    ('귀환포탈', (0, 10)), ('귀환포탈2', (0, 11)), ('동굴포탈', (49, 10)), ('동굴포탈2', (49, 11)),
    ('마을 도착칸', TOWN_ARRIVAL), ('동굴 도착칸', CAVE_ARRIVAL), ('맵 중앙', MAP_CENTER),
    ('상인 앞', (MERCHANT_SPOT[0], MERCHANT_SPOT[1] + 1)), ('귀환 마법진', (RETURN_STONE_SPOT[0], RETURN_STONE_SPOT[1] + 1)),
    ('숨은 상자 앞', (nx, ny)),
    ('광산 지름길 앞', (MINE_PORTAL_SPOT[0], MINE_PORTAL_SPOT[1] + 1)),
]
for name, p in checks:
    if p in walls:
        problems.append(f'{name}{p} 벽')
    elif p not in seen:
        problems.append(f'{name}{p} 도달 불가')
for name, _k, _l, (x, y) in MONSTERS:
    open_n = sum((x + dx, y + dy) not in walls for dx in range(-1, 2) for dy in range(-1, 2))
    if open_n < 9:
        problems.append(f'{name} 주변 3x3에 막힌 칸 {9 - open_n}')
print(f'벽 {len(walls)} / 도달 {len(seen)} / 전체 {W * H}')
if problems:
    print('!! 문제:')
    for p in problems:
        print('   -', p)
    raise SystemExit(1)
print('검증 통과')


# ================================================================ TMX 출력
def xml_escape(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def obj(oid, name, otype, x, y, w, h, props):
    lines = [f'  <object id="{oid}" name="{xml_escape(name)}" type="{otype}" x="{x}" y="{y}" width="{w}" height="{h}">',
             '   <properties>']
    for pname, ptype, pval in props:
        t = f' type="{ptype}"' if ptype else ''
        lines.append(f'    <property name="{pname}"{t} value="{xml_escape(str(pval))}"/>')
    lines += ['   </properties>', '  </object>']
    return '\n'.join(lines)


next_id = 12
chars = []
for name, kind, lvl, (x, y) in MONSTERS:
    oid = LEGACY_IDS.get(name)
    if oid is None:
        oid, next_id = next_id, next_id + 1
    chars.append((oid, obj(oid, name, 'character', x * 32, y * 32, 32, 32, [
        ('blocksMovement', 'bool', 'true'), ('monster.level', 'int', lvl), ('type', '', kind)])))
for name, text, (x, y) in SIGNS:
    if name == 'cave_entrance_sign':
        oid = 11
    else:
        oid, next_id = next_id, next_id + 1
    chars.append((oid, obj(oid, name, 'character', x * 32, y * 32, 32, 32, [
        ('type', '', 'sign_inn'), ('blocksMovement', 'bool', 'false'), ('displayText', '', text)])))


def list_prop(name, items):
    rows = [f'    <property name="{name}" type="list">']
    rows += [f'     <item value="{xml_escape(v)}"/>' for v in items]
    rows.append('    </property>')
    return rows


def obj_with_lines(oid, name, tx, ty, props, lines):
    # 칸 (tx, ty) 에 정확히 서는 캐릭터(x = 칸 중심, y = 칸 바닥) + vn-dialogue 대사
    out_lines = [f'  <object id="{oid}" name="{name}" type="character" x="{tx * 32 + 16}" y="{ty * 32 + 32}" width="32" height="32">',
                 '   <properties>']
    if lines:
        out_lines += list_prop('controller.dialogueLines', lines)
        out_lines.append('    <property name="controller.scriptId" value="vn-dialogue"/>')
    for pname, ptype, pval in props:
        t = f' type="{ptype}"' if ptype else ''
        out_lines.append(f'    <property name="{pname}"{t} value="{xml_escape(str(pval))}"/>')
    out_lines += ['   </properties>', '  </object>']
    return '\n'.join(out_lines)


# 야영지 떠돌이 상인(물약 상점 + q015), 숨은 상자, 갱도 낙석
for name, (tx, ty), props, lines in [
    ('camp_merchant', MERCHANT_SPOT,
     [('blocksMovement', 'bool', 'true'), ('displayText', '', '떠돌이 상인 바렌'), ('type', '', 'character_ranger_green')],
     ['사냥터에서 물약 떨어지면 낭패지.', '마을까지 갈 것 없이 여기서 사 가.']),
    ('hidden_cache', (nx - 1, ny - 1),
     [('blocksMovement', 'bool', 'true'), ('type', '', 'cave_prop_crate_bones')],
     ['낡은 보급 상자다. 녹슨 걸쇠가 달려 있다.']),
    ('gated_boulder', MINE_PORTAL_SPOT,
     [('blocksMovement', 'bool', 'true'), ('quest.hiddenWhenCompleted', '', 'q009-mine-ore-rush'),
      ('type', '', 'cave_prop_boulder')],
     ['무너진 바위가 갱도를 막고 있다.', '수정 광산 쪽 일이 정리되면 길이 열릴지도 모른다.']),
    # 모닥불 곁에서 쉬는 사냥꾼 둘(야영지가 상인 혼자라 비어 보였다) — 초보 사냥 요령
    ('camp_hunter_bram', (CAMPFIRE_AT[0] - 3, CAMPFIRE_AT[1]),
     [('blocksMovement', 'bool', 'true'), ('displayText', '', '사냥꾼 브람'),
      ('type', '', 'character_adventurer_brown_hair')],
     ['꿀꿀이 떼한테 한꺼번에 덤비지 마. 하나씩 끌어내서 잡는 거야.',
      '바위돌이는 느려도 단단해. 칼이 안 들면 대장간부터 들르라고.']),
    ('camp_hunter_lise', (CAMPFIRE_AT[0] + 3, CAMPFIRE_AT[1]),
     [('blocksMovement', 'bool', 'true'), ('displayText', '', '사냥꾼 리세'),
      ('type', '', 'character_villager_flower_dress')],
     ['말캉이는 혼자 다닐 땐 순해. 떼로 몰려오면 얘기가 다르지만.',
      '남쪽 숲길 버섯돌이 근처에선 오래 서 있지 마. 포자가 독하거든.']),
]:
    oid, next_id = next_id, next_id + 1
    chars.append((oid, obj_with_lines(oid, name, tx, ty, props, lines)))
oid, next_id = next_id, next_id + 1
# 이름판이 오벨리스크를 가리지 않게 세 칸 옆에
chars.append((oid, obj(oid, 'return_stone_sign', 'character', (RETURN_STONE_SPOT[0] + 3) * 32 + 16,
                       RETURN_STONE_SPOT[1] * 32 + 32, 32, 32, [
    ('type', '', 'sign_inn'), ('blocksMovement', 'bool', 'false'), ('displayText', '', '귀환석 · 마을 광장')])))
chars.sort(key=lambda c: c[0])

portals = [
    obj(4, 'return_gate', 'portal', 0, 320, 32, 64, [
        ('appearanceType', '', 'stairs_stone_step_base_00'), ('targetFacing', '', 'right'),
        ('targetSceneId', '', 'town'), ('targetSpawnTileX', 'int', 46), ('targetSpawnTileY', 'int', 17)]),
    obj(10, 'cave_entrance', 'portal', 1568, 320, 32, 64, [
        ('appearanceType', '', 'cave_entrance'), ('targetFacing', '', 'left'),
        ('targetSceneId', '', 'cave'), ('targetSpawnTileX', 'int', 2), ('targetSpawnTileY', 'int', 10)]),
]
pid = 100
for name, (tx, ty), props in [
    # 귀환 표지석 앞 마법진 → 마을 광장(시청 앞)
    ('return_stone', (RETURN_STONE_SPOT[0], RETURN_STONE_SPOT[1] + 1), [
        ('appearanceType', '', 'cave_prop_pentagram'), ('targetFacing', '', 'down'),
        ('targetSceneId', '', 'town'), ('targetSpawnTileX', 'int', 27), ('targetSpawnTileY', 'int', 19)]),
    # 무너진 광산 지름길 → 수정 광산 입구(동굴에서 내려오는 곳). q009 완료 후에만 있다.
    ('mine_shortcut', MINE_PORTAL_SPOT, [
        ('appearanceType', '', 'stairs_stone_step_base_00'), ('quest.requiresCompleted', '', 'q009-mine-ore-rush'),
        ('targetFacing', '', 'up'), ('targetSceneId', '', 'crystal-mine'),
        ('targetSpawnTileX', 'int', 29), ('targetSpawnTileY', 'int', 35)]),
]:
    pid += 1
    portals.append(obj(pid, name, 'portal', tx * 32, ty * 32, 32, 32, props))


# decorations: 지금은 비어 있지만 나중에 채울 자리 표시(에디터 주석용, 게임 로직은 읽지 않는다)
decos = []
for name, text, (x, y, w, h) in [
    ('hunter_camp', '사냥꾼 야영지 (모닥불)', (CAMPFIRE_AT[0] - 2, CAMPFIRE_AT[1] - 2, 5, 4)),
]:
    oid, next_id = next_id, next_id + 1
    decos.append(obj(oid, name, 'reserved', x * 32, y * 32, w * 32, h * 32, [('displayText', '', text)]))

out = ['<?xml version="1.0" encoding="UTF-8"?>',
       f'<map version="1.10" tiledversion="1.12.1" orientation="orthogonal" renderorder="right-down" '
       f'width="{W}" height="{H}" tilewidth="32" tileheight="32" infinite="0" '
       f'nextlayerid="{FIRST_LAYER_ID + len(LAYER_NAMES)}" nextobjectid="{next_id}">',
       '<!-- scripts/generate-hunting-ground.py 가 생성한다. 손으로 고치지 말고 스크립트를 고친 뒤 다시 돌릴 것. -->',
       ' <tileset firstgid="1" source="../tilesets/town-32.tsx"/>']
for i, name in enumerate(LAYER_NAMES, start=FIRST_LAYER_ID):
    rows = ',\n'.join(','.join(str(v) for v in m.L[name][y * W:(y + 1) * W]) for y in range(H))
    out.append(f' <layer id="{i}" name="{name}" width="{W}" height="{H}">\n  <data encoding="csv">\n{rows}\n</data>\n </layer>')
out.append(' <objectgroup id="2" name="characters">')
out.append('  <!-- 몬스터 15: 말캉이 6(서쪽 초원 Lv1~2, q001) / 꿀꿀이 5(북쪽 농장 Lv3~5, q003) / '
           '버섯돌이 2(남쪽 숲길 Lv3~4) / 바위돌이 2(남동 광산 Lv5, 북동 동굴 앞 Lv6) -->')
out.append('  <!-- 야영지 상인(camp_merchant, 물약 상점·q015), 숨은 상자(hidden_cache, q015), '
           '갱도 낙석(gated_boulder, q009 완료 시 사라짐) -->')
out += [c[1] for c in chars]
out.append(' </objectgroup>')
out.append(' <objectgroup id="3" name="portals">')
out.append(f'  <!-- 이름·위치·목적지 고정: town.tmx/cave.tmx 가 도착 칸 {TOWN_ARRIVAL}/{CAVE_ARRIVAL} 을 들고 있다. '
           f'귀환 마법진(return_stone)은 마을 광장행, 광산 지름길(mine_shortcut)은 q009 완료 후에만 있다. -->')
out += portals
out.append(' </objectgroup>')
out.append(' <objectgroup id="4" name="decorations">')
out += decos
out.append(' </objectgroup>')
out.append('</map>')
open(SRC, 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')
print('wrote', SRC)
