"""2장 '가라앉은 숲'(sunken-forest, 60x45) 생성기 — c2-03 늪에 잠긴 길(q018), 이후 c2-04·c2-05 의 무대.

이야기(docs/chapter2-sunken-forest.md): 늪에 잠겨 가는 숲. 물 위로 남은 둔덕과 사냥꾼들이 놓은 낡은
판자길로만 다닐 수 있다. 삼지창을 든 늪개구리 전사들이 떼로 다니고, 동쪽 깊은 숲은 독안개에 덮였다.

  서쪽 입구 둔덕(갈대골 문) ─┬─ 북쪽 둑길 ─ 사냥꾼 야영지(버려짐, 사냥꾼 흔적 = q018 조사 목표)
                              └─ 남쪽 둑길 ─ 개구리 소굴 섬
        야영지·소굴 ─ 판자길 ─ 동쪽 둔덕 ─ (독안개 장막) ─ 깊은 숲(c2-04 에서 해독 향으로 들어간다)

독안개: roof 레이어(캐릭터 위)에 안개 타일을 깐다. 장막(fog_wall) 오브젝트가 둔덕 길을 막는다 — 지금은
지나갈 수 없고, c2-04 가 해독 향과 함께 장막을 걷는다(quest.hiddenWhenCompleted 를 그때 단다).
"""
import math
import sys

sys.path.insert(0, 'scripts')
import swamp_terrain as st  # noqa: E402
from swamp_mapkit import (LPC, S, SwampMap, catmull, character, dist_to_path, monster, portal,  # noqa: E402
                          sign, wobble)

W, H = 60, 45
OUT = 'src/games/my-sample-rpg/assets/maps/sunken-forest.tmx'
CAMPFIRE = LPC['cave_prop_brazier_00']
CRATE = 1095                               # 농산물 상자(이름표는 crate_bones — 1장 생성기 메모)

# ---------------------------------------------------------------- 자리(칸 좌표)
ENTRANCE = (0, 21, 1, 3)                   # 서쪽 끝 포탈(갈대골 문) — 왼쪽 위, 너비, 높이
ARRIVAL = (2, 22)
REED_GATE_SPAWN = (41, 26)                 # 돌아갈 때 갈대골 문 안쪽 칸
CAMP = (27, 9)                             # 사냥꾼 야영지 모닥불 칸
HUNTER_TRACE = (25, 10)                    # 사냥꾼 흔적(상자) — q018 조사 목표
LAIR = (25, 32)                            # 개구리 소굴 섬 가운데
FOG_X = 43                                 # 이 열부터 동쪽은 독안개(장막이 안개 가장자리에 박힌다)
FOG_WALLS = [(43, 20), (43, 21), (43, 22)]  # 안개 바로 앞에서 길을 막는 장막(동쪽 둔덕이 안개로 들어가는 목)

# 둔덕(풀): 물 위로 남은 땅. (꼭짓점 경로, 반폭) — 둑길은 좁게, 섬은 넓게.
RIDGES = [
    (catmull([(-1.0, 22.5), (4.0, 22.5), (9.0, 21.5), (12.0, 22.0)]), 2.4),          # 서쪽 입구 둔덕
    (catmull([(11.0, 21.0), (14.0, 17.0), (17.5, 13.5), (21.5, 11.0), (25.0, 10.0)]), 1.3),  # 북쪽 둑길
    (catmull([(11.5, 23.5), (14.5, 27.0), (18.0, 30.0), (22.0, 31.5)]), 1.3),       # 남쪽 둑길
    (catmull([(40.0, 8.0), (41.5, 14.0), (41.0, 21.5), (42.0, 28.0), (40.5, 36.0)]), 1.8),  # 동쪽 둔덕
    (catmull([(41.0, 21.5), (47.0, 21.5), (53.0, 19.0), (61.0, 18.0)]), 1.6),       # 안개 속으로 이어지는 길
]
ISLANDS = [(6.5, 22.0, 5.0, 4.6), (27.0, 9.5, 5.2, 4.0), (25.5, 32.0, 6.0, 4.8), (52.0, 14.0, 4.5, 4.0),
           (54.0, 30.0, 5.0, 4.5), (33.5, 20.5, 2.6, 2.0), (12.0, 40.5, 4.2, 2.6), (37.0, 41.5, 4.8, 2.4),
           (5.0, 33.5, 2.4, 1.8)]
# 판자길(사냥꾼들이 놓은 데크): 야영지 섬 → 동쪽 둔덕, 소굴 섬 → 동쪽 둔덕
BOARDWALKS = [
    [(x, y) for x in range(32, 40) for y in (10, 11)],
    [(x, y) for x in range(31, 41) for y in (31, 32)],
]
MONSTERS = [
    # 늪개구리 전사 — 소굴 섬에 무리(4), 북쪽 둑길 둘
    ('늪개구리 전사-1', 'monster_frog', 21, (23, 31)),
    ('늪개구리 전사-2', 'monster_frog', 21, (27, 33)),
    ('늪개구리 전사-3', 'monster_frog', 20, (25, 30)),
    ('늪개구리 전사-4', 'monster_frog', 20, (28, 31)),
    ('늪개구리 전사-5', 'monster_frog', 20, (17, 14)),
    ('늪개구리 전사-6', 'monster_frog', 20, (40, 16)),
    ('늪뱀-1', 'monster_snake', 19, (14, 27)),
    ('늪뱀-2', 'monster_snake', 19, (41, 27)),
    ('늪뱀-3', 'monster_snake', 19, (14, 17)),
    ('식인 꽃-1', 'monster_flower', 20, (20, 12)),
    ('식인 꽃-2', 'monster_flower', 20, (40, 33)),
    ('식인 꽃-3', 'monster_flower', 20, (29, 7)),
]

m = SwampMap(W, H, seed=20261006)


def vertex_material(x, y):
    for path, half in RIDGES:
        if dist_to_path(path, x, y) < half + wobble(x, y, 23) * 0.8:
            return st.GRASS
    for cx, cy, rx, ry in ISLANDS:
        if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 + wobble(x, y, 29):
            return st.GRASS
    return st.WATER


m.make_vmat(vertex_material)
m.paint_terrain()
boardwalk_cells = [c for walk in BOARDWALKS for c in walk]
m.lay_deck(boardwalk_cells)

# ---------------------------------------------------------------- 지켜야 할 길·자리
for path, _half in RIDGES[:4]:
    for px, py in path:
        m.walk.add((int(px), int(py)))
m.walk |= {(x, y) for x in range(0, 4) for y in range(20, 25)}
for (x, y) in [(CAMP[0] + dx, CAMP[1] + dy) for dx in range(-3, 4) for dy in range(-2, 3)]:
    m.walk.add((x, y))
for (x, y) in FOG_WALLS:
    for dx in range(-3, 1):
        m.walk.add((x + dx, y))
m.walk = {c for c in m.walk if c not in m.water_cells}
m.reserve_monster_room(MONSTERS)
m.reserved = set(m.walk)
m.keep_monsters_visible(MONSTERS)
m.no_canopy |= {(HUNTER_TRACE[0] + dx, HUNTER_TRACE[1] + dy) for dx in (-1, 0, 1) for dy in (-2, -1, 0)}

# 사냥꾼 야영지: 꺼진 모닥불, 장작, 상자(흔적 오브젝트가 그린다)
m.set('object', CAMP[0], CAMP[1], CAMPFIRE)
for (x, y) in [(CAMP[0] + 2, CAMP[1] + 1), (CAMP[0] - 1, CAMP[1] + 2)]:
    m.set('object', x, y, 1189)          # 통나무 걸상
m.set('object', HUNTER_TRACE[0] - 1, HUNTER_TRACE[1], CRATE)
m.reserved |= {CAMP, (CAMP[0] + 2, CAMP[1] + 1), (CAMP[0] - 1, CAMP[1] + 2), HUNTER_TRACE,
               (HUNTER_TRACE[0] - 1, HUNTER_TRACE[1])}

# ---------------------------------------------------------------- 나무 · 물가
# 숲 덩이는 둔덕 위(길 가장자리)에 둔다 — 길 한가운데는 walk 로 막혀 있어 나무가 길을 막지 않는다.
GROVES = [(4, 18.5, 2.5), (9, 25.5, 2.5), (13, 15, 2.0), (19, 10, 2.2), (31, 7, 2.5), (23, 13, 2.0),
          (16, 30, 2.2), (21, 35, 2.5), (30, 35, 2.5), (43, 10, 2.5), (39, 25, 2.0), (43, 34, 2.5),
          (50, 11, 3.0), (57, 31, 3.0), (52, 25, 2.5), (12, 40, 3.0), (37, 41, 3.0)]
CLEARINGS = [(6, 22, 3.0), (27, 9.5, 2.6), (25, 32, 3.4)]
cands = m.plant_forest(GROVES, CLEARINGS, dead_ratio=0.8)
drowned = m.plant_drowned_trees(cands, lambda x, y: True, limit=52, chance=0.24)
print(f'나무 {len(m.trunk_centers)}그루 (물속 고목 {drowned})')
bank = m.bank_cells()
m.decorate_banks(bank, cattail_chance=0.3)
m.place_props(logs=[(10, 25), (21, 30), (37, 12)], rocks=[(13, 19), (29, 34), (42, 34)],
              stumps=[(9, 24), (24, 8), (39, 22)])
m.scatter_tufts(bank)

# ---------------------------------------------------------------- 독안개(캐릭터 위 roof 레이어)
for y in range(H):
    for x in range(FOG_X, W):
        n = st.h32(x, y, 71)
        m.set('roof', x, y, S['fog_edge_w'] if x == FOG_X else S['fog'][int(n * 3)])

# ---------------------------------------------------------------- 가장자리 / 검증
entrance_cells = {(ENTRANCE[0], ENTRANCE[1] + i) for i in range(ENTRANCE[3])}
m.seal_border(entrance_cells)
m.fill_orphans(ARRIVAL)
# 장막 말고 다른 길로 안개 속에 들어갈 수 없어야 한다(장막을 벽으로 치고 다시 채워 본다).
walls, seen = m.flood(ARRIVAL)
blocked = set(FOG_WALLS)
reach = {ARRIVAL}
stack = [ARRIVAL]
while stack:
    cx, cy = stack.pop()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        n = (cx + dx, cy + dy)
        if m.inb(*n) and n not in reach and n not in walls and n not in blocked:
            reach.add(n)
            stack.append(n)
leaks = sorted(c for c in reach if c[0] > FOG_X)
if leaks:
    raise SystemExit(f'!! 장막을 돌아 안개 속으로 들어가는 칸: {leaks[:8]}')
if '--ascii' in sys.argv:
    for y in range(14, 30):
        print(f'{y:2} ' + ''.join('W' if (x, y) in blocked else '=' if (x, y) in m.deck_cells else
                                  '~' if (x, y) in m.water_cells else '#' if m.get('object', x, y) else '.'
                                  for x in range(34, 52)))

m.validate(ARRIVAL, [(n, p) for n, _k, _l, p in MONSTERS] + [
    ('도착 칸', ARRIVAL), ('사냥꾼 흔적 앞', (HUNTER_TRACE[0], HUNTER_TRACE[1] + 1)),
    ('소굴', LAIR), ('장막 앞', (FOG_WALLS[1][0] - 1, FOG_WALLS[1][1]))] +
    [(f'입구 {p}', p) for p in entrance_cells], open_edge_cells=entrance_cells)

# ---------------------------------------------------------------- TMX 출력
chars = [monster(20 + i, name, x, y, kind, lvl) for i, (name, kind, lvl, (x, y)) in enumerate(MONSTERS)] + [
    character(1, 'hunter_trace', HUNTER_TRACE[0], HUNTER_TRACE[1], [
        ('blocksMovement', 'bool', 'true'),
        ('controller.dialogueLines', 'list', ['버려진 사냥꾼 야영지다. 모닥불은 오래전에 꺼졌다.']),
        ('controller.scriptId', '', 'vn-dialogue'),
        ('displayText', '', '사냥꾼의 짐'),
        ('type', '', 'cave_prop_crate_bones')]),
    sign(2, 'forest_entrance_sign', ARRIVAL[0] + 2, ARRIVAL[1] - 2, '갈대골 ←'),
] + [
    character(4 + i, f'fog_wall_{i}', x, y, [
        ('blocksMovement', 'bool', 'true'),
        ('controller.dialogueLines', 'list', ['독안개가 벽처럼 짙게 깔려 있다.',
                                               '한 걸음만 들어서도 숨이 막혀 온다. 이대로는 지나갈 수 없다.']),
        ('controller.scriptId', '', 'vn-dialogue'),
        ('type', '', 'swamp_fog_wall')])
    for i, (x, y) in enumerate(FOG_WALLS)
]
portals = [
    portal(10, 'reed_gate', ENTRANCE[0], ENTRANCE[1], ENTRANCE[2], ENTRANCE[3], [
        ('appearanceType', '', 'swamp_deck_v'), ('targetFacing', '', 'left'),
        ('targetSceneId', '', 'reed-village'),
        ('targetSpawnTileX', 'int', REED_GATE_SPAWN[0]), ('targetSpawnTileY', 'int', REED_GATE_SPAWN[1])]),
]
m.write_tmx(OUT, 'scripts/generate-sunken-forest.py', chars,
            '사냥꾼 흔적(hunter_trace, q018 조사 목표), 독안개 장막(fog_wall, c2-04 까지 닫힘) / 늪개구리 전사 6(Lv20~21), '
            '늪뱀 3, 식인 꽃 3',
            portals, f'서쪽 끝 → 갈대골 문 안쪽 {REED_GATE_SPAWN}. 갈대골 쪽 포탈(forest_gate)은 이 맵의 도착 칸 {ARRIVAL} 을 들고 있다.',
            next_object_id=60)
