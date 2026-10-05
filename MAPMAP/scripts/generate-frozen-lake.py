"""3장 '얼어붙은 호수'(frozen-lake, 56x40) 생성기 — c3-03~c3-06 의 무대. 눈 바이옴.

호수는 얼음(지나갈 수 없음)이고, 물 위로 남은 눈 둑길로만 가운데 섬에 닿는다. 둑길과 섬은 눈보라에 덮였다(지붕
레이어의 안개 타일이 눈 판에서 눈보라가 된다 — 들어서면 피해·감속, 이르마의 생강차로 막는다). 둑길 들머리는
눈더미가 막고 있다가 c3-04(q036 생강차)를 마치면 치워진다. 섬 가운데 얼음 속에 옛 종탑(2장 신전의 종과 같은 문양).

  서쪽 기슭(서리목 길, 늑대인간 사냥터) ─┬─ 둑길(눈보라) ─ 가운데 섬(얼음 속 종탑) ─ 둑길 ─┐
                                        └─ 북쪽 호숫가 길(둘러 감) ─────────────────────────┴─ 동쪽 기슭: 얼음 동굴 입구
                                                                                                (트롤 족장, 고블린)
"""
import math
import sys

sys.path.insert(0, 'scripts')
import swamp_terrain as st  # noqa: E402
from swamp_mapkit import S, SwampMap, catmull, character, dist_to_path, monster, portal, sign, wobble  # noqa: E402

W, H = 56, 40
OUT = 'src/games/my-sample-rpg/assets/maps/frozen-lake.tmx'
WEST_EXIT = (0, 19, 1, 3)
ARRIVAL = (2, 20)
VILLAGE_SPAWN = (41, 16)                  # 서리목 동쪽 길 안쪽
CAVE_STAIRS = (52, 19, 2, 1)              # 얼음 동굴로 내려가는 계단(q038 후)
CAVE_SPAWN = (20, 36)                     # 얼음 동굴 1층 도착 칸
ISLAND = (29.0, 20.0, 5.0, 4.2)
BELL = (29, 18)                           # 얼음 속 종탑(대화 목표)
DRIFT_X = 15                              # 이 열의 걸을 수 있는 칸마다 눈더미(q036 후 치워짐) — 둑길·북쪽 길 모두
BLIZZARD_X = (16, 43)                     # 이 열 사이 호수 위는 눈보라
TROLL = (48, 19)
WOLF_DEN = (6, 33)                        # 늑대인간 굴(q035 조사 목표)

LAKE = (29.0, 20.0, 15.5, 13.0)
WEST_SHORE = [(x, y) for x in range(0, 13) for y in range(0, H)]
CAUSEWAYS = [
    (catmull([(12.0, 20.0), (17.0, 20.5), (22.0, 19.5), (25.0, 20.0)]), 1.4),
    (catmull([(33.0, 20.0), (37.0, 19.0), (41.0, 20.0), (46.0, 19.5)]), 1.4),
]
NORTH_PATH = catmull([(8.0, 14.0), (12.0, 7.5), (20.0, 4.5), (30.0, 3.5), (40.0, 4.5), (47.0, 8.0), (50.0, 15.0)])
MONSTERS = [
    ('서리 늑대인간-1', 'monster_frost_wolfman', 42, (6, 26)),
    ('서리 늑대인간-2', 'monster_frost_wolfman', 42, (9, 30)),
    ('서리 늑대인간-3', 'monster_frost_wolfman', 43, (4, 35)),
    ('서리 늑대인간-4', 'monster_frost_wolfman', 43, (16, 6)),
    ('서리 늑대인간-5', 'monster_frost_wolfman', 44, (34, 4)),
    ('서리 늑대인간-6', 'monster_frost_wolfman', 44, (9, 9)),
    ('눈 말캉이-1', 'monster_snow_slime', 41, (5, 15)),
    ('눈 말캉이-2', 'monster_snow_slime', 41, (11, 27)),
    ('눈 말캉이-3', 'monster_snow_slime', 42, (3, 6)),
    ('고블린 약탈자-1', 'monster_goblin', 43, (51, 14)),
    ('고블린 약탈자-2', 'monster_goblin', 43, (50, 25)),
    ('트롤 족장-보스', 'monster_troll_chief', 46, TROLL),
]
SUMMONS = [(46, 16), (46, 22), (51, 17), (51, 22)]

m = SwampMap(W, H, seed=20261014, biome='snow')


def in_ellipse(x, y, cx, cy, rx, ry, salt):
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 + wobble(x, y, salt) * 0.5


def vertex_material(x, y):
    if in_ellipse(x, y, *ISLAND, 11):
        return st.GRASS
    for path, half in CAUSEWAYS:
        if dist_to_path(path, x, y) < half + wobble(x, y, 13) * 0.6:
            return st.GRASS
    if in_ellipse(x, y, *LAKE, 17):
        return st.WATER
    if dist_to_path(NORTH_PATH, x, y) < 0.9 + wobble(x, y, 19) * 0.4:
        return st.MUD
    return st.GRASS


m.make_vmat(vertex_material)
m.separate_mud_from_water()
m.paint_terrain()

for path, _half in CAUSEWAYS:
    for px, py in path:
        m.walk.add((int(px), int(py)))
for px, py in NORTH_PATH:
    m.walk.add((int(px), int(py)))
for y in range(H):
    for x in range(W):
        if in_ellipse(x, y, ISLAND[0], ISLAND[1], ISLAND[2] - 1.5, ISLAND[3] - 1.5, 0):
            m.walk.add((x, y))
m.walk |= {(x, y) for x in range(0, 4) for y in range(18, 23)}
m.walk |= {(x, y) for x in range(44, 55) for y in range(15, 24)}            # 동굴 앞 마당(보스전)
m.walk |= {(WOLF_DEN[0] + dx, WOLF_DEN[1] + dy) for dx in (-1, 0, 1) for dy in (0, 1)}
m.walk = {c for c in m.walk if c not in m.water_cells}
m.reserve_monster_room(MONSTERS)
m.reserved = set(m.walk)
m.keep_monsters_visible(MONSTERS)
m.no_canopy |= {(BELL[0] + dx, BELL[1] + dy) for dx in (-1, 0, 1, 2) for dy in (-3, -2, -1, 0)}

# 동굴 입구: 계단 뒤를 바위로 막아 굴 입구처럼
for x in range(CAVE_STAIRS[0] - 1, CAVE_STAIRS[0] + CAVE_STAIRS[2] + 1):
    m.set('object', x, CAVE_STAIRS[1] - 1, 527 + (x % 2))
    m.reserved.add((x, CAVE_STAIRS[1] - 1))
m.reserved |= {(x, CAVE_STAIRS[1]) for x in range(CAVE_STAIRS[0], CAVE_STAIRS[0] + 2)}

GROVES = [(4, 3, 3.5), (52, 3, 3.5), (4, 38, 3.0), (52, 37, 3.5), (22, 37, 3.0), (38, 37, 3.0), (11, 22, 2.0),
          (52, 30, 2.5), (14, 14, 2.0)]
CLEARINGS = [(48, 19, 5.0), (ARRIVAL[0], ARRIVAL[1], 3.0), (6, 30, 4.0)]
cands = m.plant_forest(GROVES, CLEARINGS, dead_ratio=0.4)
drowned = m.plant_drowned_trees(cands, lambda x, y: True, limit=10, chance=0.4)
print(f'나무 {len(m.trunk_centers)}그루 (얼음 속 고목 {drowned})')
bank = m.bank_cells()
m.decorate_banks(bank, cattail_chance=0.18)
m.place_props(rocks=[(10, 18), (45, 26), (38, 8), (27, 33)], stumps=[(3, 12), (47, 12)], logs=[(7, 22)])
m.scatter_tufts(bank)

# 눈보라: 호수 가운데 열들(둑길·섬)을 지붕 레이어 안개 타일로 덮는다(눈 판에서 눈보라)
for y in range(H):
    for x in range(BLIZZARD_X[0], BLIZZARD_X[1]):
        n = st.h32(x, y, 71)
        m.set('roof', x, y, S['fog_edge_w'] if x == BLIZZARD_X[0] else S['fog'][int(n * 3)])

west_cells = {(WEST_EXIT[0], WEST_EXIT[1] + i) for i in range(WEST_EXIT[3])}
m.seal_border(west_cells)
m.fill_orphans(ARRIVAL)
# 눈더미: 눈보라 경계 열의 걸을 수 있는 칸 전부. 눈더미를 벽으로 치고 동쪽으로 새는 칸이 없는지 본다.
walls, seen = m.flood(ARRIVAL)
DRIFTS = sorted((DRIFT_X, y) for y in range(H) if (DRIFT_X, y) in seen)
reach, stack = {ARRIVAL}, [ARRIVAL]
while stack:
    cx, cy = stack.pop()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nb = (cx + dx, cy + dy)
        if m.inb(*nb) and nb not in reach and nb not in walls and nb not in DRIFTS:
            reach.add(nb)
            stack.append(nb)
leaks = sorted(c for c in reach if c[0] > DRIFT_X)
if leaks:
    raise SystemExit(f'!! 눈더미를 돌아 동쪽으로 가는 칸: {leaks[:8]}')
print(f'눈더미 {len(DRIFTS)}개')
m.validate(ARRIVAL, [(n, p) for n, _k, _l, p in MONSTERS] + [
    ('도착 칸', ARRIVAL), ('종탑 앞', (BELL[0], BELL[1] + 1)), ('동굴 계단', (CAVE_STAIRS[0], CAVE_STAIRS[1])),
    ('늑대 굴 앞', (WOLF_DEN[0], WOLF_DEN[1] + 1)), ('눈더미 앞', (DRIFT_X - 1, 20))] +
    [(f'소환 {p}', p) for p in SUMMONS] + [(f'서쪽 {p}', p) for p in west_cells], open_edge_cells=west_cells)

chars = [monster(20 + i, name, x, y, kind, lvl) for i, (name, kind, lvl, (x, y)) in enumerate(MONSTERS)] + [
    character(40 + i, f'트롤 족장-소환-{i + 1}', x, y, [
        ('blocksMovement', 'bool', 'true'), ('displayText', '', '고블린 약탈자'), ('monster.level', 'int', 43),
        ('type', '', 'monster_goblin')])
    for i, (x, y) in enumerate(SUMMONS)
] + [
    character(1, 'frozen_bell', BELL[0], BELL[1], [
        ('blocksMovement', 'bool', 'true'),
        ('controller.dialogueLines', 'list', ['두꺼운 얼음 속에 종이 갇혀 있다. 얼음 너머로 물결 세 줄 문양이 비친다.']),
        ('controller.scriptId', '', 'vn-dialogue'), ('displayText', '', '얼음 속 종탑'),
        ('type', '', 'ruins_stele_lit_r1c0')]),
    character(2, 'frozen_bell_top', BELL[0], BELL[1] - 1, [
        ('blocksMovement', 'bool', 'false'), ('type', '', 'ruins_stele_lit_r0c0')]),
    character(3, 'wolf_den', WOLF_DEN[0], WOLF_DEN[1], [
        ('blocksMovement', 'bool', 'true'),
        ('controller.dialogueLines', 'list', ['눈 덮인 바위 틈에 늑대인간의 굴이 있다. 양털이 흩어져 있다.']),
        ('controller.scriptId', '', 'vn-dialogue'), ('displayText', '', '늑대인간의 굴'),
        ('type', '', 'cave_prop_skull_pile_r0c0')]),
    sign(4, 'lake_sign', ARRIVAL[0] + 2, ARRIVAL[1] - 2, '서리목 ←'),
] + [
    character(5 + i, f'snow_drift_{i}', x, y, [
        ('blocksMovement', 'bool', 'true'),
        ('controller.dialogueLines', 'list', ['허리까지 쌓인 눈더미가 둑길을 막고 있다.',
                                               '그 너머는 앞이 보이지 않는 눈보라다. 맨몸으로는 갈 수 없다.']),
        ('controller.scriptId', '', 'vn-dialogue'),
        ('quest.hiddenWhenCompleted', '', 'q036-warming-tea'),
        ('type', '', 'snow_drift_wall')])
    for i, (x, y) in enumerate(DRIFTS)
]
portals = [
    portal(60, 'village_road', *WEST_EXIT, [
        ('appearanceType', '', 'swamp_deck_h'), ('targetFacing', '', 'left'),
        ('targetSceneId', '', 'frost-village'),
        ('targetSpawnTileX', 'int', VILLAGE_SPAWN[0]), ('targetSpawnTileY', 'int', VILLAGE_SPAWN[1])]),
    portal(61, 'ice_cave_stairs', *CAVE_STAIRS, [
        ('appearanceType', '', 'stairs_stone_step_base_00'), ('quest.requiresCompleted', '', 'q038-cave-guardian'),
        ('targetFacing', '', 'up'), ('targetSceneId', '', 'ice-cave-1f'),
        ('targetSpawnTileX', 'int', CAVE_SPAWN[0]), ('targetSpawnTileY', 'int', CAVE_SPAWN[1])]),
]
m.write_tmx(OUT, 'scripts/generate-frozen-lake.py', chars,
            '얼음 속 종탑(frozen_bell, q037), 늑대인간의 굴(wolf_den, q035), 둑길 눈더미(q036 후 치워짐) / '
            '서리 늑대인간 6(Lv42~44), 눈 말캉이 3, 고블린 2, 트롤 족장-보스(Lv46) + 소환 고블린 4',
            portals, f'서쪽 → 서리목 {VILLAGE_SPAWN}. 동쪽 동굴 계단 → 얼음 동굴 1층 {CAVE_SPAWN}(q038 후).',
            next_object_id=70)
