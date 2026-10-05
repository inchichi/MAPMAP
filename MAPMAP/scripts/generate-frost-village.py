"""3장 거점 '서리목'(frost-village, 44x36) 생성기 — 눈 바이옴(append-biome-tiles.py).

이야기(docs/chapter3-frozen-north.md): 고갯길 끝 눈 덮인 산골 마을. 석 달째 눈이 그치지 않고 늑대인간이 가축을
물어 간다. 사냥꾼 대장 하겐이 마을을 이끈다. 집은 갈대골과 같은 오두막 템플릿(눈 판에서는 눈 지붕·돌벽).

  남쪽 입구(고갯길) ─ 마당(광장, 귀환 표지석) ─┬─ 북쪽: 하겐의 오두막
                                                ├─ 서쪽: 볼크의 대장간, 얼어붙은 연못
                                                ├─ 동쪽: 이르마의 약재상
                                                └─ 동쪽 끝 길 → 얼어붙은 호수
"""
import math
import re
import sys

sys.path.insert(0, 'scripts')
import swamp_terrain as st  # noqa: E402
from swamp_mapkit import (LPC, S, SwampMap, catmull, character, dist_to_path, npc, portal, sign,  # noqa: E402
                          waystone, wobble)

W, H = 44, 36
OUT = 'src/games/my-sample-rpg/assets/maps/frost-village.tmx'
TOWN_TMX = 'src/games/my-sample-rpg/assets/maps/town.tmx'
LOGPILE = [[LPC['town_prop_logpile_r0c0'], LPC['town_prop_logpile_r0c1']],
           [LPC['town_prop_logpile_r1c0'], LPC['town_prop_logpile_r1c1']]]
FENCE = [LPC['town_prop_fence_h_l'], LPC['town_prop_fence_h_m'], LPC['town_prop_fence_h_r']]

SOUTH_EXIT = (21, 35, 3, 1)
ARRIVAL = (22, 33)
PASS_SPAWN = (24, 2)                       # 고갯길 북쪽 끝
EAST_EXIT = (43, 15, 1, 3)
LAKE_ARRIVAL = (2, 20)                     # 얼어붙은 호수 서쪽 입구
HAGEN_HOUSE = (19, 3)                      # 오두막 5x8 의 왼쪽 위 칸
SMITHY = (5, 10)
APOTHECARY = (31, 9)
HOUSE_4 = (8, 21)
HOUSE_5 = (31, 22)
PLAZA = (22, 20, 4.2)
WAYSTONE = (24, 17)                        # 표지석 밑동(도착 칸은 waystones.ts 의 (24, 18))
POND = (6.5, 31.0, 3.6, 2.4)
PATHS = [
    catmull([(22.5, 36.0), (22.5, 29.0), (22.5, 24.0), (22.0, 20.0)]),
    catmull([(22.0, 20.0), (21.5, 14.0), (21.5, 11.5)]),
    catmull([(22.0, 20.0), (15.0, 19.5), (8.0, 18.5)]),
    catmull([(22.0, 20.0), (29.0, 19.0), (34.0, 17.5), (40.0, 16.5), (44.5, 16.5)]),
]


def house_door_front(origin):
    ox, oy = origin
    return (ox + 2, oy + 8)


m = SwampMap(W, H, seed=20261013, biome='snow')


def vertex_material(x, y):
    if ((x - POND[0]) / POND[2]) ** 2 + ((y - POND[1]) / POND[3]) ** 2 < 1 + wobble(x, y, 3) * 0.5:
        return st.WATER
    if any(dist_to_path(p, x, y) < 0.85 + wobble(x, y, 19) * 0.4 for p in PATHS):
        return st.MUD
    if math.hypot(x - PLAZA[0], y - PLAZA[1]) < PLAZA[2] + wobble(x, y, 23):
        return st.MUD
    return st.GRASS


m.make_vmat(vertex_material)
m.separate_mud_from_water()
m.paint_terrain()


def load_house_template():
    house = S['house_thatch']
    x0, y0, x1, y1 = house['box']
    props = set(house['props'])
    mapping = {int(k): v for k, v in house['map'].items()}
    src = open(TOWN_TMX, encoding='utf-8').read()
    tpl = {}
    for mm in re.finditer(r'<layer id="\d+" name="([^"]+)"[^>]*>\s*<data encoding="csv">\s*([\d,\s]+?)</data>', src):
        if mm.group(1) == 'ground':
            continue
        vals = [int(v) for v in mm.group(2).replace(chr(10), ',').split(',') if v.strip()]
        tpl[mm.group(1)] = [[mapping.get(vals[y * 50 + x], vals[y * 50 + x]) if vals[y * 50 + x] not in props else 0
                             for x in range(x0 + 1, x0 + 6)] for y in range(y0, y0 + 8)]
    return tpl


HOUSE = load_house_template()


def stamp_house(origin):
    ox, oy = origin
    for layer, grid in HOUSE.items():
        for dy, row in enumerate(grid):
            for dx, gid in enumerate(row):
                if gid:
                    m.set(layer, ox + dx, oy + dy, gid)
    for dy in range(8):
        for dx in range(5):
            m.reserved.add((ox + dx, oy + dy))
    fx, fy = house_door_front(origin)
    for dx in (-1, 0, 1, 2):
        m.walk.add((fx + dx, fy))
        m.walk.add((fx + dx, fy + 1))


for h in (HAGEN_HOUSE, SMITHY, APOTHECARY, HOUSE_4, HOUSE_5):
    stamp_house(h)

for p in PATHS:
    for px, py in p:
        m.walk.add((int(px), int(py)))
for y in range(H):
    for x in range(W):
        if math.hypot(x - PLAZA[0], y - PLAZA[1]) < PLAZA[2] + 1:
            m.walk.add((x, y))
m.walk |= {(x, y) for x in range(20, 25) for y in range(31, 36)} | {(x, y) for x in range(39, 44) for y in range(14, 19)}
m.walk = {c for c in m.walk if c not in m.water_cells}
m.reserved |= m.walk

# 대장간 앞 장작더미·울타리, 약재상 앞 약초 상자
lx, ly = SMITHY[0] + 5, SMITHY[1] + 6
for r in range(2):
    for c in range(2):
        m.set('object' if r == 1 else 'object_upper', lx + c, ly + r, LOGPILE[r][c])
        m.reserved.add((lx + c, ly + r))
for i, x in enumerate(range(APOTHECARY[0] + 5, APOTHECARY[0] + 8)):
    m.set('object', x, APOTHECARY[1] + 7, FENCE[min(i, 2)])
    m.reserved.add((x, APOTHECARY[1] + 7))

NPCS = [
    ('hagen', (house_door_front(HAGEN_HOUSE)[0] + 2, house_door_front(HAGEN_HOUSE)[1]), '사냥꾼 대장 하겐',
     'character_adventurer_brown_hair',
     ['서리목은 늘 추웠지만 이렇게 눈이 그치지 않은 적은 없었다.', '늑대인간 녀석들이 밤마다 우리를 맴돈다. 조심해라.']),
    ('irma', (house_door_front(APOTHECARY)[0] + 2, house_door_front(APOTHECARY)[1]), '약재상 이르마',
     'character_villager_flower_dress',
     ['생강차 한 잔이면 눈보라 속에서도 한동안은 버틸 수 있어요.', '필요한 게 있으면 골라 보세요.']),
    ('volk', (house_door_front(SMITHY)[0] + 2, house_door_front(SMITHY)[1]), '대장장이 볼크',
     'character_bearded_apron_man',
     ['쇠가 얼어서 망치질이 영 시원찮아.', '얼음 동굴 근처에 좋은 광맥이 있었는데… 트롤 놈들이 차지해 버렸지.']),
    ('nina', (PLAZA[0] - 2, PLAZA[1] + 2), '마을 아이 니나', 'character_villager_flower_dress',
     ['눈사람 만들어 본 적 있어요? 근데 요즘은 밖에 못 나가게 해요.', '늑대가 무섭대요. 난 안 무서운데.']),
    ('frost_villager_1', (house_door_front(HOUSE_4)[0] + 2, house_door_front(HOUSE_4)[1]), '나무꾼 테오도르',
     'character_commoner_tan_tunic',
     ['장작이 금세 바닥나. 눈이 그쳐야 숲에 들어가지.', '호수 쪽에서 밤마다 종소리 같은 게 들려.']),
    ('frost_villager_2', (house_door_front(HOUSE_5)[0] + 2, house_door_front(HOUSE_5)[1]), '양치기 마르타',
     'character_elder_gray_hair',
     ['양이 또 한 마리 사라졌어. 늑대인간 짓이야.', '하겐이 어떻게든 해 주겠지.']),
]
for _n, (x, y), *_ in NPCS:
    m.walk.add((x, y))
    m.reserved.add((x, y))
m.keep_monsters_visible([(n, '', 0, p) for n, p, *_ in NPCS])
m.no_canopy |= {(WAYSTONE[0] + dx, WAYSTONE[1] + dy) for dx in (-1, 0, 1) for dy in (-2, -1, 0)}
m.reserved |= {WAYSTONE, (WAYSTONE[0], WAYSTONE[1] - 1)}

GROVES = [(3, 3, 3.0), (40, 4, 3.0), (3, 26, 2.5), (40, 29, 3.0), (14, 30, 2.5), (31, 32, 2.5), (14, 2, 2.0),
          (30, 2, 2.5)]
CLEARINGS = [(PLAZA[0], PLAZA[1], 5.5), (22, 33, 2.5), (41, 16, 2.5)]
cands = m.plant_forest(GROVES, CLEARINGS, dead_ratio=0.3)
print(f'나무 {len(m.trunk_centers)}그루')
bank = m.bank_cells()
m.decorate_banks(bank, cattail_chance=0.25)
m.place_props(rocks=[(27, 28), (14, 14), (36, 26)], stumps=[(17, 27), (28, 13)], logs=[(12, 15)])
m.scatter_tufts(bank)

south_cells = {(SOUTH_EXIT[0] + i, SOUTH_EXIT[1]) for i in range(SOUTH_EXIT[2])}
east_cells = {(EAST_EXIT[0], EAST_EXIT[1] + i) for i in range(EAST_EXIT[3])}
m.seal_border(south_cells | east_cells)
m.fill_orphans(ARRIVAL)
m.validate(ARRIVAL, [('도착 칸', ARRIVAL), ('표지석 앞', (WAYSTONE[0], WAYSTONE[1] + 1))] +
           [(n, p) for n, p, *_ in NPCS] +
           [(f'{name} 문 앞', house_door_front(h)) for name, h in
            (('하겐', HAGEN_HOUSE), ('대장간', SMITHY), ('약재상', APOTHECARY), ('넷째 집', HOUSE_4), ('다섯째 집', HOUSE_5))] +
           [(f'남쪽 {p}', p) for p in south_cells] + [(f'동쪽 {p}', p) for p in east_cells],
           open_edge_cells=south_cells | east_cells)

chars = [npc(i + 1, name, x, y, display, appearance, lines) for i, (name, (x, y), display, appearance, lines) in
         enumerate(NPCS)] + [
    waystone(20, 'frost-village', *WAYSTONE),
    sign(22, 'frost_village_sign', ARRIVAL[0] + 2, ARRIVAL[1] - 1, '서리목'),
    sign(23, 'lake_road_sign', 39, 14, '얼어붙은 호수 →'),
    sign(24, 'smithy_sign', SMITHY[0] + 5, SMITHY[1] + 9, '대장간'),
    sign(25, 'apothecary_sign', APOTHECARY[0] - 1, APOTHECARY[1] + 9, '약재상'),
]
portals = [
    portal(30, 'pass_road', *SOUTH_EXIT, [
        ('appearanceType', '', 'stairs_stone_step_base_00'), ('targetFacing', '', 'down'),
        ('targetSceneId', '', 'north-pass'),
        ('targetSpawnTileX', 'int', PASS_SPAWN[0]), ('targetSpawnTileY', 'int', PASS_SPAWN[1])]),
    portal(31, 'lake_road', *EAST_EXIT, [
        ('appearanceType', '', 'swamp_deck_h'), ('quest.requiresCompleted', '', 'q034-snowbound-village'),
        ('targetFacing', '', 'right'), ('targetSceneId', '', 'frozen-lake'),
        ('targetSpawnTileX', 'int', LAKE_ARRIVAL[0]), ('targetSpawnTileY', 'int', LAKE_ARRIVAL[1])]),
]
m.write_tmx(OUT, 'scripts/generate-frost-village.py', chars,
            '하겐(사냥꾼 대장), 이르마(약재상), 볼크(대장장이), 니나, 주민 둘 / 귀환 표지석, 표지판',
            portals, f'남쪽 → 고갯길 {PASS_SPAWN}. 동쪽 → 얼어붙은 호수 {LAKE_ARRIVAL}(q034 후).', next_object_id=40)
