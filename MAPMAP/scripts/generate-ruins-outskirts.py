"""2장 '물밑 신전 외곽'(ruins-outskirts, 50x40) 생성기 — c2-06 비석의 글자(q022)의 무대.

이야기(docs/chapter2-sunken-forest.md): 잠긴숲 동쪽, 물이 빠져 드러난 옛 신전 들판. 무너진 기둥과
두건 쓴 석상이 늪풀에 묻혀 있고, 유적을 지키던 해골병들이 아직 돌아다닌다. 학자 셀린이 혼자 야영하며
비석의 옛 글자를 읽고 있다.

  서쪽 숲길(잠긴숲 동쪽 끝) ─ 진흙 길 ─┬─ 북서: 셀린의 야영지
                                           ├─ 남쪽: 첫 봉인 비석 광장(해골병 수호자) — q022 조사 목표
                                           └─ 북동: 신전 입구 광장(이끼 골렘, 돌계단) — q022 를 마치면 봉인이 풀린다

광장 바닥은 회색 돌(LPC Mudstone Gray)에 늪 풀 경계 덮개를 얹는다(진흙 꼭짓점 재질의 바닥만 돌로 바꾼다).
봉인 비석은 2x2 를 칸마다 오브젝트로 둔다 — 밝히기 전(swamp_stele_*)과 밝힌 뒤(ruins_stele_lit_*)를 퀘스트
속성으로 바꿔 끼운다. 아랫줄 충돌은 object 레이어의 투명 충돌이 맡는다.
"""
import json
import math
import sys

sys.path.insert(0, 'scripts')
import swamp_terrain as st  # noqa: E402
from swamp_mapkit import (INVISIBLE_BLOCK, LPC, S, SwampMap, catmull, character, dist_to_path,  # noqa: E402
                          monster, npc, portal, sign, waystone, wobble)

W, H = 50, 40
OUT = 'src/games/my-sample-rpg/assets/maps/ruins-outskirts.tmx'
RUINS = json.load(open('scripts/ruins-tile-gids.json', encoding='utf-8'))
STONE_FLOOR = [LPC[f'cave_fill_Mudstone_Gray_0{i}'] for i in range(4)]
CAMPFIRE = LPC['cave_prop_brazier_00']
CRATE = 1095
LOG_SEAT = 1189

# ---------------------------------------------------------------- 자리(칸 좌표)
ENTRANCE = (0, 18, 1, 3)                   # 서쪽 끝 포탈(잠긴숲) — 왼쪽 위, 너비, 높이
ARRIVAL = (2, 19)
FOREST_SPAWN = (57, 17)                    # 돌아갈 때 잠긴숲 동쪽 끝(덩굴이 있던 자리 안쪽)
CAMP = (11, 9)                             # 셀린 야영지 모닥불
SELIN = (13, 10)
STELE_AT = (23, 27)                        # 첫 봉인 비석 2x2 의 왼쪽 위 칸
STELE_PLAZA = (24.0, 29.0, 5.2, 4.4)       # 비석 광장(가운데, 반지름 x·y)
TEMPLE_PLAZA = (39.0, 10.0, 6.5, 5.0)      # 신전 입구 광장
STAIRS = (38, 6, 2, 1)                     # 신전으로 내려가는 돌계단 포탈(왼쪽 위, 너비, 높이)
TEMPLE_1F_SPAWN = (19, 36)                 # 신전 1층 도착 칸(sunken-temple-1f 의 입구 계단 앞)
DOOR_SEAL = [(38, 7), (39, 7)]             # 계단 앞 봉인된 돌문(q022 를 마치면 열린다)
POOLS = [(8.0, 31.0, 4.5, 3.2), (34.0, 25.0, 3.0, 2.4), (45.5, 33.0, 4.0, 3.5), (21.0, 4.0, 3.5, 2.0),
         (2.5, 4.5, 3.0, 2.5)]

# 진흙 길: 입구 → 갈림목 → 야영지 / 비석 광장 / 신전 광장
PATHS = [
    catmull([(-1.0, 19.5), (5.0, 19.5), (11.0, 19.0), (17.0, 19.5), (21.0, 20.0)]),
    catmull([(9.0, 19.0), (10.0, 15.5), (11.5, 12.5)]),
    catmull([(21.0, 20.0), (23.0, 23.0), (24.0, 25.5)]),
    catmull([(21.0, 20.0), (26.0, 18.0), (31.0, 15.5), (35.0, 13.0)]),
]

# 무너진 유적 소품(왼쪽 위 기준). 기둥 3단, 석상·오벨리스크 2단, 가고일 2x2.
PILLAR = [LPC[f'cave_prop_pillar_gold_r{r}c0'] for r in range(3)]
STATUE = [LPC['cave_prop_statue_hood_r0c0'], LPC['cave_prop_statue_hood_r1c0']]
OBELISK = [LPC['cave_prop_obelisk_r0c0'], LPC['cave_prop_obelisk_r1c0']]
GARGOYLE = [[LPC['cave_prop_gargoyle_r0c0'], LPC['cave_prop_gargoyle_r0c1']],
            [LPC['cave_prop_gargoyle_r1c0'], LPC['cave_prop_gargoyle_r1c1']]]
# 무너진 돌덩이: 동굴 잔해 타일은 바탕이 어두워 풀밭에서 검은 네모로 보인다 — 마을 돌무더기를 쓴다
RUBBLE = [527, 528]
SKULL = LPC['cave_prop_skull']
BONES = LPC['cave_prop_bone_scatter']
# 비석 광장 둘레의 기둥(밑동 칸) — 반은 부러져 밑동만 남았다
STELE_PILLARS = [((19, 27), True), ((29, 27), False), ((19, 32), False), ((29, 32), True), ((24, 34), False)]
TEMPLE_PILLARS = [((34, 9), True), ((44, 9), True), ((34, 13), False), ((44, 13), True)]
STATUES = [(36, 7), (41, 7), (16, 23), (31, 21), (6, 13)]
OBELISKS = [(35, 11), (43, 11), (27, 16)]
GARGOYLES = [(33, 6), (44, 6)]
RUBBLE_AT = [(18, 21), (26, 21), (30, 18), (14, 25), (32, 29), (40, 16), (46, 12), (12, 22), (37, 15),
             (20, 33), (28, 35), (5, 22)]
SKULLS = [(22, 31), (27, 30), (40, 14), (17, 17), (9, 24)]
MONSTERS = [
    # 유적 해골병 — 길목 셋, 비석 광장 수호자 넷
    ('유적 해골병-1', 'monster_skeleton', 24, (15, 18)),
    ('유적 해골병-2', 'monster_skeleton', 24, (28, 17)),
    ('유적 해골병-3', 'monster_skeleton', 25, (8, 24)),
    ('유적 해골병-4', 'monster_skeleton', 25, (20, 29)),
    ('유적 해골병-5', 'monster_skeleton', 25, (28, 29)),
    ('유적 해골병-6', 'monster_skeleton', 26, (21, 33)),
    ('유적 해골병-7', 'monster_skeleton', 26, (27, 33)),
    # 이끼 골렘 — 신전 입구 광장
    ('이끼 골렘-1', 'monster_moss_golem', 26, (37, 11)),
    ('이끼 골렘-2', 'monster_moss_golem', 26, (42, 12)),
    ('이끼 골렘-3', 'monster_moss_golem', 27, (40, 14)),
]

m = SwampMap(W, H, seed=20261008)


def in_ellipse(x, y, cx, cy, rx, ry, salt):
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 + wobble(x, y, salt) * 0.6


def is_plaza(x, y):
    return in_ellipse(x, y, *STELE_PLAZA, 31) or in_ellipse(x, y, *TEMPLE_PLAZA, 37)


def vertex_material(x, y):
    if is_plaza(x, y):
        return st.MUD
    for cx, cy, rx, ry in POOLS:
        if in_ellipse(x, y, cx, cy, rx, ry, 41):
            return st.WATER
    if any(dist_to_path(p, x, y) < 0.8 + wobble(x, y, 19) * 0.5 for p in PATHS):
        return st.MUD
    return st.GRASS


m.make_vmat(vertex_material)
m.separate_mud_from_water()
m.paint_terrain()
# 광장의 진흙 바닥은 돌로(경계 덮개는 그대로 — 풀이 돌 가장자리를 덮는다)
plaza_cells = set()
for (x, y) in list(m.mud_cells):
    # 꼭짓점 하나라도 광장이면 광장 칸(가장자리 칸도 돌 위에 풀 덮개가 얹혀야 진흙 테두리가 남지 않는다)
    if any(is_plaza(x + dx, y + dy) for dx in (0, 1) for dy in (0, 1)):
        m.set('ground', x, y, STONE_FLOOR[int(st.h32(x, y, 5) * 4)])
        plaza_cells.add((x, y))

# ---------------------------------------------------------------- 지켜야 할 길·자리
for p in PATHS:
    for px, py in p:
        m.walk.add((int(px), int(py)))
m.walk |= {(x, y) for x in range(0, 4) for y in range(17, 22)}
m.walk |= plaza_cells
m.walk |= {(CAMP[0] + dx, CAMP[1] + dy) for dx in range(-3, 4) for dy in range(-2, 4)}
m.walk |= {(x, y) for x in range(STAIRS[0] - 1, STAIRS[0] + STAIRS[2] + 1) for y in range(STAIRS[1], STAIRS[1] + 4)}
m.walk = {c for c in m.walk if c not in m.water_cells}
m.reserve_monster_room(MONSTERS)
m.reserved = set(m.walk)
m.keep_monsters_visible(MONSTERS)
m.keep_monsters_visible([('selin', '', 0, SELIN)])


def stamp_column(x, y, column, walls=True):
    """세로 소품(위 칸들은 object_upper, 맨 아래 칸은 충돌). (x, y) = 맨 아래 칸."""
    for i, gid in enumerate(column):
        cy = y - (len(column) - 1) + i
        m.set('object' if i == len(column) - 1 and walls else 'object_upper', x, cy, gid)
        m.reserved.add((x, cy))


def stamp_block(x, y, grid):
    """2x2 같은 블록. (x, y) = 왼쪽 위 칸. 윗줄 object_upper, 아랫줄 충돌."""
    for r, row in enumerate(grid):
        for c, gid in enumerate(row):
            m.set('object_upper' if r < len(grid) - 1 else 'object', x + c, y + r, gid)
            m.reserved.add((x + c, y + r))


# ---------------------------------------------------------------- 유적 소품
for (x, y), whole in STELE_PILLARS + TEMPLE_PILLARS:
    stamp_column(x, y, PILLAR if whole else PILLAR[2:])
for (x, y) in STATUES:
    stamp_column(x, y, STATUE)
for (x, y) in OBELISKS:
    stamp_column(x, y, OBELISK)
for (x, y) in GARGOYLES:
    stamp_block(x, y, GARGOYLE)
for i, (x, y) in enumerate(RUBBLE_AT):
    if m.free(x, y):
        m.set('object', x, y, RUBBLE[i % len(RUBBLE)])
for (x, y) in SKULLS:
    if (x, y) not in m.water_cells and not m.get('shadow_lower', x, y):
        m.set('shadow_lower', x, y, SKULL if (x + y) % 2 else BONES)
# 첫 봉인 비석: 아랫줄 두 칸은 투명 충돌, 그림은 오브젝트가 그린다
sx, sy = STELE_AT
for c in range(2):
    m.set('object', sx + c, sy + 1, INVISIBLE_BLOCK)
    m.reserved |= {(sx + c, sy), (sx + c, sy + 1)}
# 신전 계단 자리: 돌계단 그림은 포탈이 그린다. 계단 뒤(위)는 무너진 벽처럼 막는다.
for x in range(STAIRS[0] - 1, STAIRS[0] + STAIRS[2] + 1):
    m.set('object', x, STAIRS[1] - 1, RUBBLE[(x * 3) % len(RUBBLE)])
    m.reserved.add((x, STAIRS[1] - 1))

# 셀린의 야영지: 모닥불, 통나무 걸상, 짐 상자, 수레
m.set('object', CAMP[0], CAMP[1], CAMPFIRE)
for (x, y) in [(CAMP[0] - 1, CAMP[1] + 1), (CAMP[0] + 1, CAMP[1] - 1)]:
    m.set('object', x, y, LOG_SEAT)
for (x, y) in [(CAMP[0] - 2, CAMP[1] - 1), (CAMP[0] - 3, CAMP[1] - 1)]:
    m.set('object', x, y, CRATE)
cart = [[LPC['town_prop_cart_r0c0'], LPC['town_prop_cart_r0c1']], [LPC['town_prop_cart_r1c0'], LPC['town_prop_cart_r1c1']]]
stamp_block(CAMP[0] + 3, CAMP[1] - 2, cart)
m.reserved |= {CAMP, (CAMP[0] - 1, CAMP[1] + 1), (CAMP[0] + 1, CAMP[1] - 1), (CAMP[0] - 2, CAMP[1] - 1),
               (CAMP[0] - 3, CAMP[1] - 1), SELIN}

# ---------------------------------------------------------------- 나무 · 물가
GROVES = [(3, 9, 3.0), (6, 36, 3.0), (16, 37, 2.5), (33, 37, 3.0), (47, 22, 3.0), (47, 4, 2.5), (28, 3, 3.0),
          (14, 3, 2.5), (40, 28, 2.5), (3, 28, 2.5)]
CLEARINGS = [(STELE_PLAZA[0], STELE_PLAZA[1], 6.0), (TEMPLE_PLAZA[0], TEMPLE_PLAZA[1], 7.0), (CAMP[0], CAMP[1], 3.5),
             (3, 19, 3.0)]
cands = m.plant_forest(GROVES, CLEARINGS, dead_ratio=0.85)
drowned = m.plant_drowned_trees(cands, lambda x, y: True, limit=8)
print(f'나무 {len(m.trunk_centers)}그루 (물속 고목 {drowned})')
bank = m.bank_cells()
m.decorate_banks(bank, cattail_chance=0.3)
m.place_props(logs=[(17, 13), (33, 31)], rocks=[(12, 28), (30, 23), (46, 17)], stumps=[(7, 16), (25, 12)])
m.scatter_tufts(bank)

# ---------------------------------------------------------------- 가장자리 / 검증
entrance_cells = {(ENTRANCE[0], ENTRANCE[1] + i) for i in range(ENTRANCE[3])}
m.seal_border(entrance_cells)
m.fill_orphans(ARRIVAL)
if '--ascii' in sys.argv:
    for y in range(H):
        print(f'{y:2} ' + ''.join('o' if (x, y) in plaza_cells and not m.get('object', x, y) else
                                  '~' if (x, y) in m.water_cells else '#' if m.get('object', x, y) else
                                  '^' if m.get('object_upper', x, y) else '.' for x in range(W)))
# 곁가지(c2-s1·s4·s5) 자리 — 지형을 다 깐 뒤라 기존 배치는 그대로다
RAFT = (6, 4)                    # 갈대골로 돌아가는 지름길 나룻배(북서 연못가)
REED_RAFT_SPAWN = (3, 18)        # 갈대골 서쪽 나루 데크
BANNER = (12, 27)                # 쓰러진 신전 수비대 깃발(c2-s4)
ALTAR = (2, 1)                   # 북쪽 나무숲 뒤 숨은 제단(c2-s5) — 북서 구석의 좁은 틈으로 들어간다
ALTAR_GUARDIAN = (7, 1)
m.validate(ARRIVAL, [(n, p) for n, _k, _l, p in MONSTERS] + [
    ('나룻배', RAFT), ('깃발', BANNER), ('제단 앞', (ALTAR[0] + 1, ALTAR[1])), ('제단 수호자', ALTAR_GUARDIAN)] + [
    ('도착 칸', ARRIVAL), ('셀린', SELIN), ('비석 앞', (sx, sy + 2)), ('계단', (STAIRS[0], STAIRS[1] + 1)),
    ('돌문 앞', (DOOR_SEAL[0][0], DOOR_SEAL[0][1] + 1))] + [(f'입구 {p}', p) for p in entrance_cells],
    open_edge_cells=entrance_cells)

# ---------------------------------------------------------------- TMX 출력
STELE_UNLIT = [[f'swamp_stele_r{r}c{c}' for c in range(2)] for r in range(2)]
STELE_LIT = [[f'ruins_stele_lit_r{r}c{c}' for c in range(2)] for r in range(2)]
stele_objects = []
for r in range(2):
    for c in range(2):
        for lit, gate in ((False, 'quest.hiddenWhenCompleted'), (True, 'quest.requiresCompleted')):
            name = ('seal_stele_1' if (r, c) == (1, 0) else f'seal_stele_1_r{r}c{c}') + ('_lit' if lit else '')
            props = [('blocksMovement', 'bool', 'true' if r == 1 else 'false'), (gate, '', 'q022-stele-script'),
                     ('type', '', (STELE_LIT if lit else STELE_UNLIT)[r][c])]
            if (r, c) == (1, 0):
                lines = (['푸르게 빛나는 옛 글자: "봉인 셋이 물을 붙든다. 하나가 깨지면 물이 새고, 셋이 깨지면 잠든 이가 깬다."']
                         if lit else ['이끼 낀 돌 비석이다. 낯선 글자가 빼곡히 새겨져 있다.',
                                      '손을 대자 글자 몇 개가 희미하게 빛났다가 꺼진다.'])
                props += [('controller.dialogueLines', 'list', lines), ('controller.scriptId', '', 'vn-dialogue'),
                          ('displayText', '', '봉인 비석')]
            stele_objects.append((name, sx + c, sy + r, props))

chars = [monster(30 + i, name, x, y, kind, lvl) for i, (name, kind, lvl, (x, y)) in enumerate(MONSTERS)] + [
    npc(1, 'selin', SELIN[0], SELIN[1], '학자 셀린', 'character_villager_flower_dress',
        ['비석의 글자는 이 근방 어느 기록에도 없는 옛 문자예요. 그래도 조금씩 읽히기 시작했어요.',
         '유적을 지키던 해골병들이 아직도 순찰을 돌아요. 조심하세요.']),
    sign(2, 'ruins_entrance_sign', ARRIVAL[0] + 1, ARRIVAL[1] - 2, '잠긴숲 ←'),
] + [character(10 + i, name, x, y, props) for i, (name, x, y, props) in enumerate(stele_objects)] + [
    character(20 + i, f'temple_door_seal_{i}', x, y, [
        ('blocksMovement', 'bool', 'true'),
        ('controller.dialogueLines', 'list', ['옛 글자가 새겨진 돌문이 계단을 막고 있다.',
                                               '문 한가운데 비석과 같은 글자가 희미하게 빛난다. 비석부터 읽어야 할 것 같다.']),
        ('controller.scriptId', '', 'vn-dialogue'),
        ('quest.hiddenWhenCompleted', '', 'q022-stele-script'),
        ('type', '', 'cave_prop_boulder')])
    for i, (x, y) in enumerate(DOOR_SEAL)
]
chars += [
    # 귀환 표지석(셀린 야영지) — 도착 칸은 waystones.ts 의 (9, 13)
    waystone(54, 'ruins-camp', 9, 12),
    monster(29, '이끼 골렘-제단', ALTAR_GUARDIAN[0], ALTAR_GUARDIAN[1], 'monster_moss_golem', 28),
    character(26, 'fallen_banner', BANNER[0], BANNER[1], [
        ('blocksMovement', 'bool', 'true'),
        ('controller.dialogueLines', 'list', ['흙에 반쯤 묻힌 깃발이다. 물결 세 줄을 수놓은 문장이 바래 있다.']),
        ('controller.scriptId', '', 'vn-dialogue'), ('displayText', '', '쓰러진 깃발'), ('type', '', 'town_prop_fence_post')]),
    character(27, 'hidden_altar', ALTAR[0], ALTAR[1], [
        ('blocksMovement', 'bool', 'true'),
        ('controller.dialogueLines', 'list', ['이끼에 덮인 작은 황금 제단이다. 아무도 이곳을 모르는 듯하다.']),
        ('controller.scriptId', '', 'vn-dialogue'), ('displayText', '', '숨은 제단'), ('type', '', 'cave_prop_altar_gold_r1c1')]),
]
portals = [
    portal(52, 'reed_raft', RAFT[0], RAFT[1], 1, 1, [
        ('appearanceType', '', 'swamp_raft'), ('quest.requiresCompleted', '', 'q027-ferry-shortcut'),
        ('targetFacing', '', 'left'), ('targetSceneId', '', 'reed-village'),
        ('targetSpawnTileX', 'int', REED_RAFT_SPAWN[0]), ('targetSpawnTileY', 'int', REED_RAFT_SPAWN[1])]),
    portal(50, 'forest_road', ENTRANCE[0], ENTRANCE[1], ENTRANCE[2], ENTRANCE[3], [
        ('appearanceType', '', 'swamp_deck_h'), ('targetFacing', '', 'left'),
        ('targetSceneId', '', 'sunken-forest'),
        ('targetSpawnTileX', 'int', FOREST_SPAWN[0]), ('targetSpawnTileY', 'int', FOREST_SPAWN[1])]),
    portal(51, 'temple_stairs', STAIRS[0], STAIRS[1], STAIRS[2], STAIRS[3], [
        ('appearanceType', '', 'stairs_stone_step_base_00'), ('quest.requiresCompleted', '', 'q022-stele-script'),
        ('targetFacing', '', 'up'), ('targetSceneId', '', 'sunken-temple-1f'),
        ('targetSpawnTileX', 'int', TEMPLE_1F_SPAWN[0]), ('targetSpawnTileY', 'int', TEMPLE_1F_SPAWN[1])]),
]
m.write_tmx(OUT, 'scripts/generate-ruins-outskirts.py', chars,
            '학자 셀린, 첫 봉인 비석(seal_stele_1, q022 조사 목표 — 밝힌 뒤 _lit 로 바뀜), 봉인된 돌문(q022 후 열림) / '
            '유적 해골병 7(Lv24~26, 비석 수호자 4), 이끼 골렘 3(Lv26~27)',
            portals, f'서쪽 끝 → 잠긴숲 동쪽 끝 {FOREST_SPAWN}. 숲의 신전 길 포탈(temple_road)은 이 맵의 도착 칸 '
            f'{ARRIVAL} 을 들고 있다. 북동 돌계단 → 물밑 신전 1층 {TEMPLE_1F_SPAWN}(q022 후).',
            next_object_id=60)
