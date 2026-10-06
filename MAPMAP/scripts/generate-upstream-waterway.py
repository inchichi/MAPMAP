"""2장 첫 맵 '윗물길'(upstream-waterway, 40x24) 생성기.

이야기(docs/chapter2-sunken-forest.md, c2-01 "사라지는 물"): 물레골 수문 위 아치를 지나
개울을 거슬러 오르면, 북동쪽에서 내려오던 물이 한가운데의 구멍으로 빨려 들어 사라진다. 구멍
아래쪽 옛 물길은 말라 진흙 바닥만 남았다(마을 물이 줄어든 까닭). 구멍 곁에는 반쯤 잠긴 룬
비석이 있고(봉인 떡밥), 동쪽 끝은 물에 잠긴 숲 — 갈대골로 가는 길은 아직 건널 수 없다.

  남서 아치(물레골) ─ 마른 물길을 따라 북동 ─ 물이 빨려 드는 구멍 + 룬 비석 ─ 동쪽 전망 둑

지형은 꼭짓점 재질 격자(GRASS/WATER/MUD/HOLE)로 정하고 경계는 scripts/swamp_terrain.py 의
규칙(꼭짓점 16가지 + 변별 경계 위치)으로 깐다. 물은 바닥 레이어의 cave_fill_Water(흐르는 물
렌더링 대상), 풀 경계는 shadow_lower 의 투명 덮개다. 그림체는 비교안 C(늪 색 town 타일 +
LPC 고목) — docs/chapter2-art-candidates.md.

규칙(1장 생성기와 같음): 손으로 TMX 를 고치지 않는다. object 레이어의 0 이 아닌 칸이 벽이다.
투명 충돌(302)은 물 위에만 쓰고, 땅 위의 막힘은 눈에 보이는 것(나무·덤불·비석)으로만 만든다.
"""
import math
import sys

sys.path.insert(0, 'scripts')
import swamp_terrain as st  # noqa: E402
from swamp_mapkit import (HOLE, S, SwampMap, catmull, character, dist_to_path, monster, portal,  # noqa: E402
                          sign, wobble)

W, H = 40, 24
OUT = 'src/games/my-sample-rpg/assets/maps/upstream-waterway.tmx'
STELE = S['stele']   # 2x2 룬 비석(append-swamp-tiles.py 가 잘린 LPC 비석을 대칭으로 복원)

# 이야기 지점(칸 좌표)
ARRIVAL = (5, 21)                 # 물레골에서 올라와 서는 칸
GATE = (4, 23, 3, 1)              # 아치(포탈) x, y, w, h — 남쪽 가장자리
VILLAGE_SPAWN = (12, 5)           # 돌아갈 때 물레골 도착 칸(수문 아치 아래)
SINK = (21, 10)                   # 구멍 칸(2x2 꼭짓점 구멍의 가운데 칸)
STELE_AT = (23, 13)               # 비석 2x2 의 왼쪽 위 칸 — 상호작용 오브젝트는 왼쪽 아래 칸
LOOKOUT = (34, 13)                # 동쪽 전망 둑 끝(표지판 칸)
FERRY = (36, 14)                  # 전망 둑 끝 잔교 위 나룻배(갈대골행, q016 완료 후)
FERRY_PIER = [(35, 14), (36, 14)]  # 둑 끝에서 물로 내민 두 칸짜리 잔교
REED_VILLAGE_ARRIVAL = (3, 17)    # 갈대골 서쪽 나루 도착 칸
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


m = SwampMap(W, H, seed=20261004)

# ---------------------------------------------------------------- 꼭짓점 재질
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



vmat = m.make_vmat(vertex_material)

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

m.separate_mud_from_water()
m.ring_holes_with_water()
m.paint_terrain()
m.lay_deck(FERRY_PIER)

# ---------------------------------------------------------------- 지켜야 할 길·자리
for px, py in catmull([(ARRIVAL[0] + 0.5, ARRIVAL[1] + 0.5), (8.0, 17.0), (13.0, 16.6), (18.0, 15.4),
                       (22.0, 15.0), (27.0, 16.4), (LOOKOUT[0] - 1.0, LOOKOUT[1] + 0.5)]):
    for dx in range(-1, 2):
        for dy in range(-1, 2):
            m.walk.add((int(px) + dx, int(py) + dy))
for x in range(GATE[0] - 1, GATE[0] + GATE[2] + 1):
    for y in range(GATE[1] - 2, H):
        m.walk.add((x, y))
for dx in range(-1, 3):
    m.walk.add((STELE_AT[0] + dx, STELE_AT[1] + 2))
    m.walk.add((STELE_AT[0] + dx, STELE_AT[1] + 3))
for dx in range(-3, 4):
    for dy in range(-3, 3):
        if math.hypot(dx, dy) < 3.2:
            m.walk.add((SINK[0] + dx, SINK[1] + 3 + dy))
m.walk = {c for c in m.walk if c not in m.water_cells}
m.reserve_monster_room(MONSTERS)
m.reserved = set(m.walk)
m.keep_monsters_visible(MONSTERS)

# 비석 2x2: 윗줄 object_upper, 아랫줄은 충돌. 왼쪽 아래 칸은 상호작용 오브젝트(sunken_stele)가 그린다.
sx, sy = STELE_AT
for c in range(2):
    m.set('object_upper', sx + c, sy, STELE[0][c])
m.set('object', sx + 1, sy + 1, STELE[1][1])
for c in range(2):
    m.reserved.add((sx + c, sy))
    m.reserved.add((sx + c, sy + 1))

# ---------------------------------------------------------------- 나무
GROVES = [(9, 4, 4.5), (15, 2, 3.5), (3, 9, 3.5), (10, 20, 3.0), (17, 20, 3.5), (28, 21, 3.5),
          (27, 1, 2.5), (36, 1, 3.0), (2, 17, 3.0)]
CLEARINGS = [(14, 9, 3.0), (25, 16, 3.5)]
cands = m.plant_forest(GROVES, CLEARINGS)
drowned = m.plant_drowned_trees(cands, lambda x, y: x >= LOOKOUT[0])      # 동쪽 잠긴 숲 물속
print(f'나무 {len(m.trunk_centers)}그루 (물속 고목 {drowned})')

# ---------------------------------------------------------------- 물가 갈대 · 덤불 · 통나무 · 돌
bank = m.bank_cells()
m.decorate_banks(bank)
m.place_props(logs=[(3, 13), (13, 20), (26, 19), (17, 6), (9, 9)], rocks=[(28, 12), (11, 11), (19, 19), (6, 6)],
              stumps=[(15, 9), (30, 21), (2, 17)])
m.scatter_tufts(bank)

# ---------------------------------------------------------------- 가장자리 / 검증
gate_cells = {(x, GATE[1]) for x in range(GATE[0], GATE[0] + GATE[2])}
m.seal_border(gate_cells)
m.fill_orphans(ARRIVAL)
STELE_FRONT = (STELE_AT[0], STELE_AT[1] + 2)
m.validate(ARRIVAL, [(n, p) for n, _k, _l, p in MONSTERS] + [
    ('도착 칸', ARRIVAL), ('비석 앞', STELE_FRONT), ('전망 둑', (LOOKOUT[0], LOOKOUT[1] + 1)), ('나룻배', FERRY),
    ('구멍 남쪽 물가', next((SINK[0], y) for y in range(SINK[1], H) if (SINK[0], y) not in m.water_cells))] +
    [(f'아치 {x}', (x, GATE[1])) for x in range(GATE[0], GATE[0] + GATE[2])], open_edge_cells=gate_cells)

# ---------------------------------------------------------------- TMX 출력
chars = [monster(20 + i, name, x, y, kind, lvl) for i, (name, kind, lvl, (x, y)) in enumerate(MONSTERS)] + [
    character(1, 'sunken_stele', STELE_AT[0], STELE_AT[1] + 1, [
        ('blocksMovement', 'bool', 'true'),
        ('controller.dialogueLines', 'list', ['물가에 반쯤 잠긴 돌 비석이다.',
                                               '이끼 사이로 낯선 글자가 희미하게 빛나고 있다.']),
        ('controller.scriptId', '', 'vn-dialogue'),
        ('type', '', 'swamp_stele_r1c0')]),
    sign(2, 'reed_valley_sign', LOOKOUT[0], LOOKOUT[1], '갈대골 나루 →'),
    sign(3, 'aqueduct_sign', GATE[0] + GATE[2], GATE[1] - 2, '물레골 ↓'),
] + [
    # 늪의 사제를 쓰러뜨리면(q025, c2-08) 봉인이 온전해져 물을 빨아들이던 구멍이 메워진다 — 구멍 칸을 물로 덮는다
    character(4 + i, f'sink_refilled_{i}', SINK[0] + dx, SINK[1] + dy, [
        ('blocksMovement', 'bool', 'false'), ('quest.requiresCompleted', '', 'q025-swamp-priest'),
        ('type', '', 'cave_fill_Water_00')])
    for i, (dx, dy) in enumerate([(0, 0), (1, 0), (0, 1), (1, 1)])
] + [
    # 곁가지 c2-s2(오디의 약초 바구니) — 상류길 숲가의 약초
    character(8, 'herb_patch_3', 12, 5, [
        ('blocksMovement', 'bool', 'true'),
        ('controller.dialogueLines', 'list', ['개울가 그늘에 하얀 꽃을 단 약초가 몇 포기 자라 있다.']),
        ('controller.scriptId', '', 'vn-dialogue'),
        ('displayText', '', '개울 약초'),
        ('type', '', 'cave_prop_glow_plant_a')]),
]
portals = [
    portal(10, 'aqueduct_gate', GATE[0], GATE[1], GATE[2], GATE[3], [
        ('appearanceType', '', 'stairs_stone_step_base_00'), ('targetFacing', '', 'down'),
        ('targetSceneId', '', 'harvest-village'),
        ('targetSpawnTileX', 'int', VILLAGE_SPAWN[0]), ('targetSpawnTileY', 'int', VILLAGE_SPAWN[1])]),
    # 갈대골 사공 토빈의 나룻배 — q016(사라지는 물)을 마친 뒤 이멜이 소식을 전하면 둑에 닿아 있다.
    portal(11, 'reed_ferry', FERRY[0], FERRY[1], 1, 1, [
        ('appearanceType', '', 'swamp_raft'), ('quest.requiresCompleted', '', 'q016-vanishing-water'),
        ('targetFacing', '', 'right'), ('targetSceneId', '', 'reed-village'),
        ('targetSpawnTileX', 'int', REED_VILLAGE_ARRIVAL[0]), ('targetSpawnTileY', 'int', REED_VILLAGE_ARRIVAL[1])]),
]
m.write_tmx(OUT, 'scripts/generate-upstream-waterway.py', chars,
            '룬 비석(sunken_stele, c2-01 조사 목표), 갈대골 표지판, 아치 표지판, 메워진 구멍(sink_refilled, q025 후) / '
            '늪뱀 4(Lv16~17), 식인 꽃 3(Lv17~18, 제자리)',
            portals, f'아치 → 물레골 수문 아래 {VILLAGE_SPAWN}. 물레골 쪽 포탈(upstream_gate)은 이 맵의 도착 칸 {ARRIVAL} 을 들고 있다.',
            next_object_id=40)
