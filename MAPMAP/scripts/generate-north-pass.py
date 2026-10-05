"""3장 '북쪽 고갯길'(north-pass, 50x28) 생성기 — c3-01·c3-02 의 무대. 눈 바이옴(append-biome-tiles.py).

티르코네일 북쪽 들판 끝에서 오래 닫혀 있던 고갯길. 눈 쌓인 산길이 굽이쳐 북쪽 서리목 마을로 오르고, 가운데를
얼어붙은 개울이 가로지른다(나무다리). 서쪽 공터에 고블린 약탈자들이 야영하며 길을 막는다.

  남쪽 끝(티르코네일) ─ 산길 ─ 개울 나무다리 ─ 산길 ─ 북쪽 끝(서리목)
                      └─ 서쪽 공터: 고블린 야영지
"""
import sys

sys.path.insert(0, 'scripts')
import swamp_terrain as st  # noqa: E402
from swamp_mapkit import LPC, SwampMap, catmull, character, dist_to_path, monster, portal, sign, wobble  # noqa: E402

W, H = 50, 28
OUT = 'src/games/my-sample-rpg/assets/maps/north-pass.tmx'
SOUTH_EXIT = (23, 27, 3, 1)               # 티르코네일로(왼쪽 위, 너비, 높이)
ARRIVAL = (24, 25)
TOWN_SPAWN = (10, 1)                      # 티르코네일 북쪽 끝
NORTH_EXIT = (23, 0, 3, 1)                # 서리목으로
VILLAGE_ARRIVAL = (22, 33)                # 서리목 남쪽 입구
CAMP = (9, 9)                             # 고블린 야영지 모닥불
PATH = catmull([(24.5, 28.0), (23.5, 24.0), (19.5, 20.5), (20.5, 16.5), (27.5, 13.5), (28.5, 9.5), (24.5, 5.5),
                (24.5, -1.0)])
CAMP_PATH = catmull([(19.5, 18.5), (15.0, 13.5), (10.5, 10.5)])
CREEK = catmull([(-1.0, 17.0), (8.0, 16.0), (16.0, 17.5), (24.0, 17.0), (33.0, 18.5), (42.0, 17.5), (51.0, 18.0)])
BRIDGE = [(x, y) for x in (19, 20, 21) for y in range(15, 20)]
MONSTERS = [
    ('눈 말캉이-1', 'monster_snow_slime', 38, (26, 22)),
    ('눈 말캉이-2', 'monster_snow_slime', 38, (17, 22)),
    ('눈 말캉이-3', 'monster_snow_slime', 39, (29, 12)),
    ('눈 말캉이-4', 'monster_snow_slime', 39, (32, 9)),
    ('눈 말캉이-5', 'monster_snow_slime', 39, (21, 7)),
    ('고블린 약탈자-1', 'monster_goblin', 39, (8, 12)),
    ('고블린 약탈자-2', 'monster_goblin', 40, (12, 8)),
    ('고블린 약탈자-3', 'monster_goblin', 40, (6, 8)),
    ('고블린 약탈자-4', 'monster_goblin', 41, (13, 12)),
]

m = SwampMap(W, H, seed=20261012, biome='snow')


def vertex_material(x, y):
    if dist_to_path(CREEK, x, y) < 0.9 + wobble(x, y, 7) * 0.5:
        return st.WATER
    if dist_to_path(PATH, x, y) < 1.0 + wobble(x, y, 9) * 0.4 or dist_to_path(CAMP_PATH, x, y) < 0.8:
        return st.MUD
    return st.GRASS


m.make_vmat(vertex_material)
m.separate_mud_from_water()
m.paint_terrain()
m.lay_deck(BRIDGE, vertical_cells=BRIDGE)

for p in (PATH, CAMP_PATH):
    for px, py in p:
        m.walk.add((int(px), int(py)))
m.walk |= {(CAMP[0] + dx, CAMP[1] + dy) for dx in range(-4, 5) for dy in range(-3, 4)}
m.walk |= {(x, y) for x in range(22, 27) for y in range(24, 28)} | {(x, y) for x in range(22, 27) for y in range(0, 4)}
m.walk = {c for c in m.walk if c not in m.water_cells}
m.reserve_monster_room(MONSTERS)
m.reserved = set(m.walk)
m.keep_monsters_visible(MONSTERS)

# 고블린 야영지: 모닥불, 장작, 훔친 상자들
m.set('object', CAMP[0], CAMP[1], LPC['cave_prop_brazier_00'])
for (x, y) in [(CAMP[0] - 2, CAMP[1] - 2), (CAMP[0] - 3, CAMP[1] - 2), (CAMP[0] + 3, CAMP[1] - 2)]:
    m.set('object', x, y, LPC['cave_prop_crate_bones'])
m.set('object', CAMP[0] + 2, CAMP[1] + 1, 1189)
m.reserved |= {CAMP, (CAMP[0] - 2, CAMP[1] - 2), (CAMP[0] - 3, CAMP[1] - 2), (CAMP[0] + 3, CAMP[1] - 2),
               (CAMP[0] + 2, CAMP[1] + 1)}

# 산길 양쪽은 빽빽한 침엽수·고목(산비탈), 가운데 몇 덩이
GROVES = [(5, 4, 4.0), (40, 4, 5.0), (44, 12, 4.0), (5, 22, 4.0), (38, 23, 5.0), (14, 3, 3.0), (33, 26, 3.0),
          (13, 25, 3.0), (34, 14, 2.5)]
CLEARINGS = [(CAMP[0], CAMP[1], 4.0), (24, 26, 2.5), (24, 2, 2.5)]
cands = m.plant_forest(GROVES, CLEARINGS, dead_ratio=0.35)
print(f'나무 {len(m.trunk_centers)}그루')
bank = m.bank_cells()
m.decorate_banks(bank, cattail_chance=0.15)
m.place_props(rocks=[(30, 20), (16, 6), (36, 9), (11, 18)], stumps=[(27, 24), (18, 11)], logs=[(31, 16)])
m.scatter_tufts(bank)

south_cells = {(SOUTH_EXIT[0] + i, SOUTH_EXIT[1]) for i in range(SOUTH_EXIT[2])}
north_cells = {(NORTH_EXIT[0] + i, NORTH_EXIT[1]) for i in range(NORTH_EXIT[2])}
m.seal_border(south_cells | north_cells)
m.fill_orphans(ARRIVAL)
m.validate(ARRIVAL, [(n, p) for n, _k, _l, p in MONSTERS] + [('도착 칸', ARRIVAL), ('야영지', (CAMP[0], CAMP[1] + 1))] +
           [(f'남쪽 {p}', p) for p in south_cells] + [(f'북쪽 {p}', p) for p in north_cells],
           open_edge_cells=south_cells | north_cells)

chars = [monster(10 + i, name, x, y, kind, lvl) for i, (name, kind, lvl, (x, y)) in enumerate(MONSTERS)] + [
    sign(1, 'pass_south_sign', ARRIVAL[0] + 2, ARRIVAL[1] - 1, '서리목 ↑ · 티르코네일 ↓'),
    character(2, 'goblin_loot', CAMP[0] - 2, CAMP[1] - 2, [
        ('blocksMovement', 'bool', 'true'),
        ('controller.dialogueLines', 'list', ['고블린들이 훔쳐 온 상자다. 서리목 마을 낙인이 찍혀 있다.']),
        ('controller.scriptId', '', 'vn-dialogue'), ('displayText', '', '훔친 짐'), ('type', '', 'cave_prop_crate_bones')]),
]
portals = [
    portal(30, 'town_road', *SOUTH_EXIT, [
        ('appearanceType', '', 'stairs_stone_step_base_00'), ('targetFacing', '', 'down'),
        ('targetSceneId', '', 'town'),
        ('targetSpawnTileX', 'int', TOWN_SPAWN[0]), ('targetSpawnTileY', 'int', TOWN_SPAWN[1])]),
    portal(31, 'frost_village_road', *NORTH_EXIT, [
        ('appearanceType', '', 'stairs_stone_step_base_00'), ('targetFacing', '', 'up'),
        ('targetSceneId', '', 'frost-village'),
        ('targetSpawnTileX', 'int', VILLAGE_ARRIVAL[0]), ('targetSpawnTileY', 'int', VILLAGE_ARRIVAL[1])]),
]
m.write_tmx(OUT, 'scripts/generate-north-pass.py', chars,
            '표지판, 고블린이 훔친 짐 / 눈 말캉이 5(Lv38~39), 고블린 약탈자 4(Lv39~41, 서쪽 야영지)',
            portals, f'남쪽 → 티르코네일 {TOWN_SPAWN}, 북쪽 → 서리목 {VILLAGE_ARRIVAL}.', next_object_id=40)
