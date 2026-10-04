"""2장 거점 '갈대골'(reed-village, 44x36) 생성기.

이야기(docs/chapter2-sunken-forest.md, c2-02): 가라앉은 숲 가장자리, 불어나는 늪 위에 섬 몇 개를 나무
데크로 이어 사는 마을. 수로 상류길 전망 둑에서 사공 토빈의 나룻배를 타고 서쪽 나루에 닿는다.

  서쪽 나루(토빈) ─ 데크 ─ 가운데 섬(촌장 미렌의 집, 마을 마당) ─ 데크 ─ 북쪽 섬(약초꾼 오디의 오두막)
                                         └─ 데크 ─ 남동 섬: 가라앉은 숲으로 가는 문(문지기 하르, 아직 닫힘)

그림체는 2장 원칙(비교안 C): 바닥·나무는 늪 색 town 타일, 고목은 LPC, 집은 town 오두막을 짚 지붕·
흙벽으로 바꾼 것(append-swamp-tiles.py 의 house_thatch). 지형·나무·검증은 swamp_mapkit.
"""
import math
import re
import sys

sys.path.insert(0, 'scripts')
import swamp_terrain as st  # noqa: E402
from swamp_mapkit import (LPC, S, SwampMap, catmull, character, dist_to_path, npc, portal, sign,  # noqa: E402
                          wobble)

W, H = 44, 36
OUT = 'src/games/my-sample-rpg/assets/maps/reed-village.tmx'
TOWN_TMX = 'src/games/my-sample-rpg/assets/maps/town.tmx'
FENCE_GATE = LPC['town_prop_fence_gate']
FLOWERS = [LPC[f'town_prop_flower_{k}'] for k in 'abcd']
LOGPILE = [[LPC['town_prop_logpile_r0c0'], LPC['town_prop_logpile_r0c1']],
           [LPC['town_prop_logpile_r1c0'], LPC['town_prop_logpile_r1c1']]]

# ---------------------------------------------------------------- 자리(칸 좌표)
PIER = [(x, y) for x in range(0, 4) for y in (17, 18)]          # 서쪽 나루 데크(맵 끝까지)
FERRY = (0, 17, 1, 2)                                           # 나룻배 포탈(왼쪽 위, 너비, 높이)
ARRIVAL = (3, 17)                                               # 나룻배에서 내려서는 칸
UPSTREAM_LOOKOUT_SPAWN = (33, 14)                               # 돌아갈 때 수로 상류길 도착 칸(전망 둑)
CHIEF_HOUSE = (17, 12)                                          # 초가 5x8 의 왼쪽 위 칸
HOUSE_2 = (12, 18)
HERB_HUT = (29, 0)
EAST_GATE = [(43, 26), (43, 27)]                                # 가라앉은 숲으로 가는 문(q017 완료 후 열림)
FOREST_ARRIVAL = (2, 22)                                        # 가라앉은 숲 서쪽 입구 도착 칸
# 섬: 둥근 사각형(초타원 지수 2.6) — 집(5x8)과 마당을 앉힐 평평한 땅이 필요하다. (x0, y0, x1, y1) 꼭짓점 좌표
ISLANDS = [
    (1, 13, 7, 23),       # 서쪽 나루 섬
    (11, 12, 28, 29),     # 가운데 섬(촌장 집, 마당, 둘째 집)
    (24, -1, 38, 10),     # 북쪽 섬(약초 오두막·약초밭) — 위쪽은 맵 가장자리
    (34, 21, 45, 33),     # 남동 섬(가라앉은 숲 문)
]
ISLETS = [(7.5, 5.5, 2.4, 1.8), (36.5, 15.0, 2.2, 1.8), (6.0, 30.0, 2.6, 2.0), (31.0, 33.0, 2.4, 1.6),
          (41.0, 9.0, 2.0, 2.4)]


def house_door_front(origin):
    ox, oy = origin
    return (ox + 2, oy + 8)


m = SwampMap(W, H, seed=20261005)


# 마을 길(진흙): 서쪽 다리 → 촌장 집 앞 마당 → 동쪽 다리, 마당 → 북쪽 다리. 물가 쪽 끝은
# separate_mud_from_water 가 풀로 돌려 다리와 길 사이에 풀 턱이 한 칸 남는다.
VILLAGE_PATHS = [
    catmull([(11.5, 18.0), (14.5, 20.5), (18.0, 21.2), (21.5, 21.5), (24.5, 23.0), (27.0, 25.0)]),
    catmull([(20.5, 21.0), (22.5, 18.0), (24.5, 15.5), (26.0, 13.5)]),
    catmull([(14.5, 20.5), (14.5, 24.0), (14.8, 26.5)]),
]


def vertex_material(x, y):
    for x0, y0, x1, y1 in ISLANDS:
        cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
        if abs((x - cx) / rx) ** 2.6 + abs((y - cy) / ry) ** 2.6 < 1 + wobble(x, y, 13):
            if any(dist_to_path(p, x, y) < 0.72 + wobble(x, y, 19) * 0.4 for p in VILLAGE_PATHS):
                return st.MUD
            return st.GRASS
    for cx, cy, rx, ry in ISLETS:
        if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 + wobble(x, y, 17):
            return st.GRASS
    return st.WATER


vmat = m.make_vmat(vertex_material)
m.separate_mud_from_water()
m.paint_terrain()

# ---------------------------------------------------------------- 데크(섬 사이 다리 · 나루)
# 다리는 양쪽 섬의 땅에 한 칸씩 걸치게 잡는다(물 칸만 데크가 되면 끝이 떠 보인다).
west_bridge = [(x, y) for x in range(6, 12) for y in (17, 18)]
north_bridge = [(x, y) for x in (25, 26) for y in range(9, 14)]
east_bridge = [(x, y) for x in range(27, 35) for y in (24, 25)]
m.lay_deck(PIER + west_bridge + east_bridge + north_bridge, vertical_cells=north_bridge)


# ---------------------------------------------------------------- 초가(town 오두막 → 짚 지붕·흙벽)
def load_house_template():
    house = S['house_thatch']
    x0, y0, x1, y1 = house['box']
    props = set(house['props'])
    mapping = {int(k): v for k, v in house['map'].items()}
    src = open(TOWN_TMX, encoding='utf-8').read()
    tpl = {}
    for mm in re.finditer(r'<layer id="\d+" name="([^"]+)"[^>]*>\s*<data encoding="csv">\s*([\d,\s]+?)</data>', src):
        if mm.group(1) == 'ground':
            continue        # 집 둘레의 마을 자갈 바닥은 가져오지 않는다
        vals = [int(v) for v in mm.group(2).replace(chr(10), ',').split(',') if v.strip()]
        # 오두막은 템플릿 상자의 1~5열, 0~7행(지붕·벽·옆 그림자·문)
        tpl[mm.group(1)] = [[mapping.get(vals[y * 50 + x], vals[y * 50 + x])
                             if vals[y * 50 + x] not in props else 0
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


for h in (CHIEF_HOUSE, HOUSE_2, HERB_HUT):
    stamp_house(h)

# ---------------------------------------------------------------- 마당·길(나무를 심지 않는 곳)
for cx, cy, r in [(20, 22, 3.6), (4, 17.5, 2.2), (30, 9.0, 2.2), (38, 26, 2.6)]:
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            if math.hypot(x - cx, y - cy) < r and (x, y) not in m.water_cells:
                m.walk.add((x, y))
for (x, y) in EAST_GATE:
    for dx in range(-4, 1):
        m.walk.add((x + dx, y))
m.reserved |= m.walk

# 약초밭: 오두막 동쪽 꽃(약초) 데칼, 장작더미
herb_cells = [(x, y) for x in range(34, 37) for y in range(3, 7) if (x, y) not in m.water_cells]
for i, (x, y) in enumerate(herb_cells):
    if not m.get('shadow_lower', x, y):
        m.set('shadow_lower', x, y, FLOWERS[i % 4])
    m.reserved.add((x, y))
lx, ly = CHIEF_HOUSE[0] + 5, CHIEF_HOUSE[1] + 6
for r in range(2):
    for c in range(2):
        m.set('object' if r == 1 else 'object_upper', lx + c, ly + r, LOGPILE[r][c])
        m.reserved.add((lx + c, ly + r))

NPCS = [
    # (이름, 칸, 화면 이름, 외형, 평소 대사)
    ('tobin', (3, 19), '사공 토빈', 'character_commoner_tan_tunic',
     ['물길이 이렇게 불어난 건 처음이야. 노를 젓는 팔이 다 아프다니까.',
      '상류길 전망 둑으로 돌아가고 싶으면 나룻배에 타.']),
    ('miren', (house_door_front(CHIEF_HOUSE)[0] + 2, house_door_front(CHIEF_HOUSE)[1]), '촌장 미렌',
     'character_elder_gray_hair',
     ['갈대골은 가난해도 서로 돕고 사는 마을이라네.', '숲 쪽 일이라면 언제든 내게 묻게.']),
    ('odi', (house_door_front(HERB_HUT)[0] + 2, house_door_front(HERB_HUT)[1]), '약초꾼 오디',
     'character_villager_flower_dress',
     ['늪 약초는 독이 되기도 하고 약이 되기도 해요. 필요한 게 있으면 골라 보세요.', '독안개 냄새가 요즘 부쩍 짙어졌어요.']),
    ('reed_guard', (40, 25), '문지기 하르', 'character_villager_brown_tunic',
     ['저 문 너머가 가라앉은 숲이다. 숲길은 위험하다.', '촌장님 말씀을 듣고 가라. 개구리 녀석들이 떼로 다닌다.']),
    ('reed_weaver', (24, 22), '갈대 엮는 네아', 'character_villager_flower_dress',
     ['갈대로 지붕을 이고, 갈대로 바구니를 엮지.', '물이 불어나서 갈대밭이 반이나 잠겼어.']),
    ('reed_fisher', (6, 16), '낚시꾼 베른', 'character_bearded_apron_man',
     ['요즘은 물고기도 숲 쪽으로 안 가.', '숲에서 종소리가 울리던 밤부터 다들 숨어 버렸지.']),
]
# 사람이 나무 윗부분에 가려 서 있지 않게 — 몬스터와 같은 규칙(칸 둘레, 위로 두 줄까지 수관 금지)
for _n, (x, y), *_ in NPCS:
    m.walk.add((x, y))
    m.reserved.add((x, y))
m.keep_monsters_visible([(n, '', 0, p) for n, p, *_ in NPCS])

# ---------------------------------------------------------------- 나무 · 물가
GROVES = [(3, 14, 2.5), (3, 22, 2.5), (14, 27, 3.0), (25, 27, 3.0), (26, 2, 2.5), (37, 30, 3.0),
          (12, 13, 2.5), (43, 23, 2.5)]
CLEARINGS = [(20, 22, 4.0), (30, 9, 2.5), (4, 17, 2.5), (38, 26, 2.5)]
cands = m.plant_forest(GROVES, CLEARINGS, dead_ratio=0.6)
drowned = m.plant_drowned_trees(cands, lambda x, y: True, limit=10)
print(f'나무 {len(m.trunk_centers)}그루 (물속 고목 {drowned})')
bank = m.bank_cells()
m.decorate_banks(bank, cattail_chance=0.32)
m.place_props(logs=[(15, 27), (26, 18), (5, 21)], rocks=[(24, 26), (3, 15), (37, 31)], stumps=[(13, 14), (40, 22)])
m.scatter_tufts(bank)

# ---------------------------------------------------------------- 가장자리 / 검증
ferry_cells = {(FERRY[0], FERRY[1] + i) for i in range(FERRY[3])}
m.seal_border(ferry_cells | set(EAST_GATE))
m.fill_orphans(ARRIVAL)

if '--ascii' in sys.argv:
    for y in range(H):
        print(f'{y:2} ' + ''.join('=' if (x, y) in m.deck_cells else '~' if (x, y) in m.water_cells else
                                  '#' if m.get('object', x, y) else '^' if m.get('object_upper', x, y) else '.'
                                  for x in range(W)))
m.validate(ARRIVAL, [('도착 칸', ARRIVAL)] + [(n, p) for n, p, *_ in NPCS] +
           [('문 앞', (EAST_GATE[0][0] - 1, EAST_GATE[0][1]))] +
           [(f'{name} 문 앞', house_door_front(h)) for name, h in
            (('촌장 집', CHIEF_HOUSE), ('둘째 집', HOUSE_2), ('약초 오두막', HERB_HUT))],
           open_edge_cells=ferry_cells | set(EAST_GATE))

# ---------------------------------------------------------------- TMX 출력
chars = [npc(i + 1, name, x, y, display, appearance, lines)
         for i, (name, (x, y), display, appearance, lines) in enumerate(NPCS)]
chars += [
    sign(20, 'reed_village_sign', ARRIVAL[0] + 1, ARRIVAL[1] - 2, '갈대골'),
    sign(21, 'herb_hut_sign', HERB_HUT[0] + 5, HERB_HUT[1] + 7, '약초 오두막'),
    sign(22, 'forest_gate_sign', EAST_GATE[0][0] - 2, EAST_GATE[0][1] - 2, '가라앉은 숲 →'),
] + [
    # 안개에서 돌아온 사냥꾼 렌(q020 보고 뒤) — 촌장 집 옆에서 쉬고 있다
    character(25, 'ren', house_door_front(CHIEF_HOUSE)[0] - 2, house_door_front(CHIEF_HOUSE)[1], [
        ('blocksMovement', 'bool', 'true'),
        ('controller.dialogueLines', 'list', ['살려 줘서 고마워. 이 은혜는 꼭 갚을게.',
                                               '동쪽 유적에서 울리던 종소리… 아직도 귀에 맴돌아.']),
        ('controller.scriptId', '', 'vn-dialogue'),
        ('displayText', '', '사냥꾼 렌'),
        ('quest.requiresCompleted', '', 'q020-beyond-the-fog'),
        ('type', '', 'character_ranger_green')]),
] + [
    character(30 + i, f'forest_gate_{i}', x, y, [
        ('blocksMovement', 'bool', 'true'),
        ('controller.dialogueLines', 'list', ['굵은 밧줄로 단단히 묶인 나무 문이다.', '문지기 하르가 지키고 있다.']),
        ('controller.scriptId', '', 'vn-dialogue'),
        # 촌장 미렌에게 보고(q017)하면 하르가 밧줄을 푼다
        ('quest.hiddenWhenCompleted', '', 'q017-reed-village'),
        ('type', '', 'town_prop_fence_gate')])
    for i, (x, y) in enumerate(EAST_GATE)
]
portals = [
    portal(40, 'ferry_dock', FERRY[0], FERRY[1], FERRY[2], FERRY[3], [
        ('appearanceType', '', 'swamp_raft'), ('targetFacing', '', 'left'),
        ('targetSceneId', '', 'upstream-waterway'),
        ('targetSpawnTileX', 'int', UPSTREAM_LOOKOUT_SPAWN[0]), ('targetSpawnTileY', 'int', UPSTREAM_LOOKOUT_SPAWN[1])]),
    portal(41, 'forest_gate', EAST_GATE[0][0], EAST_GATE[0][1], 1, len(EAST_GATE), [
        ('appearanceType', '', 'swamp_deck_h'), ('quest.requiresCompleted', '', 'q017-reed-village'),
        ('targetFacing', '', 'right'), ('targetSceneId', '', 'sunken-forest'),
        ('targetSpawnTileX', 'int', FOREST_ARRIVAL[0]), ('targetSpawnTileY', 'int', FOREST_ARRIVAL[1])]),
]
m.write_tmx(OUT, 'scripts/generate-reed-village.py', chars,
            '사공 토빈, 촌장 미렌(c2-02 보고), 약초꾼 오디, 문지기 하르, 주민 둘 / 표지판 / 가라앉은 숲 문(닫힘)',
            portals, f'서쪽 나루 → 수로 상류길 전망 둑 {UPSTREAM_LOOKOUT_SPAWN}. 상류길의 나룻배(reed_ferry)는 '
            f'이 맵의 도착 칸 {ARRIVAL} 을 들고 있다.', next_object_id=50)
