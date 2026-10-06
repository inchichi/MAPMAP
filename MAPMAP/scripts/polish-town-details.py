"""느티골(town.tmx) 디테일 살리기 2차 — polish-town.py 다음에 한 번 돌린다.

1장 시작 마을인데 건물이 시청·남서쪽 집 둘뿐이고 잔디밭·광장이 휑했다. 기존 NPC·포탈·주석은 그대로 두고:

  - 집 3채: 남서쪽 집과 같은 5x8 템플릿(서쪽 집은 파란 지붕). 문 앞에서 광장·동문 거리로 자갈길을 잇는다.
      서쪽 집(1,13) — 약초상 앞 / 북서쪽 집(8,4) — 시청 서쪽 / 동문 집(43,9) — 동문 거리
  - 동쪽 잔디밭: 울타리 두른 밀밭(밭고랑·밀 줄)과 허수아비, 곁에 건초 더미.
  - 광장 서쪽: 지붕 우물. 광장 동쪽: 벤치 한 쌍. 대장간 좌판 곁: 장작더미·짐수레.

이미 적용됐으면(west_house 주석이 있으면) 아무것도 하지 않는다.
"""
import json
import re
import sys
from collections import deque

SRC = 'src/games/my-sample-rpg/assets/maps/town.tmx'
W = H = 50
AQUEDUCT_Y = 44
LPC = json.load(open('scripts/lpc-cave-gids.json', encoding='utf-8'))
GRASS, GRASS_ALT, COBBLE = 517, 457, 515
COBBLE_EDGE_BASE = 580
HOUSE_BOX = (13, 30)                      # 남서쪽 집 5x8 템플릿의 왼쪽 위
HOUSE_PROPS = {412, 419, 420}             # 남서쪽 집 옆 술통(템플릿에서 뺀다)
RED_ROOF = set(range(173, 177)) | set(range(181, 185)) | set(range(189, 193)) | set(range(197, 201)) | \
    set(range(205, 209))

src = open(SRC, encoding='utf-8').read()
if 'name="west_house"' in src:
    print('이미 적용됨 — 건너뜀')
    sys.exit(0)

layer_re = re.compile(r'(<layer id="\d+" name="([^"]+)"[^>]*>\s*<data encoding="csv">\s*)([\d,\s]+?)(</data>)')
L = {m.group(2): [int(v) for v in m.group(3).replace('\n', ',').split(',') if v.strip()]
     for m in layer_re.finditer(src)}


def get(layer, x, y):
    return L[layer][y * W + x] if 0 <= x < W and 0 <= y < H else 0


def put(layer, x, y, gid):
    if 0 <= x < W and 0 <= y < H:
        L[layer][y * W + x] = gid


def is_paved(g):
    return g == COBBLE or COBBLE_EDGE_BASE <= g <= COBBLE_EDGE_BASE + 18


NPC_TILES = [(int(float(a) // 32), int(float(b) // 32))
             for a, b in re.findall(r'type="character" x="([\d.]+)" y="([\d.]+)"', src)]


def assert_free(x0, y0, w, h, what):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            for layer in ('object', 'object_upper', 'roof'):
                if get(layer, x, y):
                    raise SystemExit(f'!! {what}: ({x},{y}) {layer} 칸이 이미 차 있다 ({get(layer, x, y)})')
            if (x, y) in NPC_TILES:
                raise SystemExit(f'!! {what}: ({x},{y}) 에 NPC')


# ---------------------------------------------------------------- 집 템플릿
TEMPLATE = {}
for layer in ('object', 'shadow_upper', 'object_upper', 'deco', 'roof'):
    TEMPLATE[layer] = [[0 if get(layer, HOUSE_BOX[0] + dx, HOUSE_BOX[1] + dy) in HOUSE_PROPS
                        else get(layer, HOUSE_BOX[0] + dx, HOUSE_BOX[1] + dy) for dx in range(5)] for dy in range(8)]
# 옆 그림자(술통 칸)는 집 옆벽 그림자이므로 남긴다 — 단 술통 기둥 위 그림자만 있었으므로 지운다
TEMPLATE['shadow_upper'] = [[0] * 5 for _ in range(8)]


def blue(g):
    # 파란 지붕은 같은 줄 왼쪽 네 칸(-4). 맨 윗줄 왼쪽 칸(169)은 사다리 조각이라 비운다.
    if g in RED_ROOF:
        return 0 if g == 173 else g - 4
    return g


def stamp_house(ox, oy, roof='red', what='집'):
    assert_free(ox, oy, 5, 8, what)
    for layer, grid in TEMPLATE.items():
        for dy, row in enumerate(grid):
            for dx, g in enumerate(row):
                if g:
                    put(layer, ox + dx, oy + dy, blue(g) if roof == 'blue' else g)
    for dy in range(8):
        for dx in range(5):
            put('shadow_lower', ox + dx, oy + dy, 0)            # 밑에 깔린 들꽃 데칼
            if is_paved(get('ground', ox + dx, oy + dy)):
                put('ground', ox + dx, oy + dy, GRASS)
    return (ox + 2, oy + 8)                                       # 문 앞 칸


def pave(cells):
    for x, y in cells:
        if get('ground', x, y) in (GRASS, GRASS_ALT):
            put('ground', x, y, COBBLE)


houses = {'west_house': (1, 13, 'blue'), 'northwest_house': (8, 4, 'red'), 'gate_house': (43, 9, 'red')}
fronts = {}
for name, (ox, oy, roof) in houses.items():
    fronts[name] = stamp_house(ox, oy, roof, name)

# 문 앞 길: 서쪽 집 → 광장(7열), 북서쪽 집은 문 앞이 곧 광장, 동문 집은 동문 거리 위
fx, fy = fronts['west_house']
pave([(x, y) for x in range(fx - 1, 7) for y in (fy, fy + 1)])
fx, fy = fronts['northwest_house']
pave([(x, fy) for x in range(fx - 1, fx + 2)])
fx, fy = fronts['gate_house']
pave([(x, fy) for x in range(fx - 1, fx + 2)])

# ---------------------------------------------------------------- 동쪽 밀밭
FX0, FY0, FX1, FY1 = 32, 23, 38, 28          # 울타리 바깥 테두리
assert_free(FX0, FY0, FX1 - FX0 + 1, FY1 - FY0 + 1, '밀밭')
for y in range(FY0, FY1 + 1):
    for x in range(FX0, FX1 + 1):
        put('shadow_lower', x, y, 0)
for x in range(FX0, FX1 + 1):
    for y in (FY0, FY1):
        if y == FY1 and x == (FX0 + FX1) // 2:
            put('object', x, y, LPC['town_prop_fence_gate'])
            continue
        # 끝 조각(h_l/h_r)은 기둥이 칸 가장자리에 떨어져 보여 가운데 조각으로 통일
        put('object', x, y, LPC['town_prop_fence_h_m'])
for y in range(FY0 + 1, FY1):
    for x in (FX0, FX1):
        put('object', x, y, LPC['town_prop_fence_v'])
for y in range(FY0 + 1, FY1):
    for x in range(FX0 + 1, FX1):
        put('ground', x, y, LPC['town_prop_plowed_tile'])
        if y % 2 == 0:
            put('shadow_lower', x, y, LPC['town_prop_wheat_tile'])
SX, SY = FX1 - 2, FY0 + 1                    # 허수아비(1x2)
put('shadow_lower', SX, SY + 1, 0)
put('object_upper', SX, SY, LPC['town_prop_scarecrow_r0c0'])
put('object', SX, SY + 1, LPC['town_prop_scarecrow_r1c0'])


def put_2x2(key, x, y, what):
    assert_free(x, y, 2, 2, what)
    for r in range(2):
        for c in range(2):
            put('object' if r == 1 else 'object_upper', x + c, y + r, LPC[f'town_prop_{key}_r{r}c{c}'])


put_2x2('haybale', 39, 25, '건초 더미')

# ---------------------------------------------------------------- 광장·대장간 소품
put_2x2('well_roof', 13, 19, '우물')
assert_free(34, 20, 2, 1, '벤치')
put('object', 34, 20, LPC['town_prop_bench_r0c0'])
put('object', 35, 20, LPC['town_prop_bench_r0c1'])
# 장작더미: 타일 이름(logpile_r?c?)과 실제 그림 조각이 어긋나 있어 그림 기준으로 놓는다.
assert_free(8, 12, 2, 2, '장작더미')
put('object_upper', 8, 12, LPC['town_prop_logpile_r0c1'])
put('object', 8, 13, LPC['town_prop_logpile_r1c1'])
put('object', 9, 13, LPC['town_prop_logpile_r0c0'])
put_2x2('cart', 15, 12, '짐수레')

# ---------------------------------------------------------------- 잔디↔자갈 경계 다시 맞추기
snap = list(L['ground'])


def ground_at(x, y):
    return snap[y * W + x] if 0 <= x < W and 0 <= y < H else None


for y in range(AQUEDUCT_Y):
    for x in range(W):
        if not is_paved(ground_at(x, y)):
            continue
        mask = 0
        for bit, (dx, dy) in enumerate(((0, -1), (1, 0), (0, 1), (-1, 0))):
            if ground_at(x + dx, y + dy) in (GRASS, GRASS_ALT):
                mask |= 1 << bit
        if mask:
            put('ground', x, y, COBBLE_EDGE_BASE + mask - 1)
            continue
        hit = [i for i, (dx, dy) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1)))
               if ground_at(x + dx, y + dy) in (GRASS, GRASS_ALT)]
        put('ground', x, y, COBBLE_EDGE_BASE + 15 + hit[0] if len(hit) == 1 else COBBLE)

# ---------------------------------------------------------------- 주석
next_id = int(re.search(r'nextobjectid="(\d+)"', src).group(1))
notes = []
for name, (ox, oy, _r) in houses.items():
    notes.append(f'  <object id="{next_id}" name="{name}" type="building" x="{ox * 32}" y="{oy * 32}" '
                 f'width="160" height="256"/>')
    next_id += 1
notes.append(f'  <object id="{next_id}" name="wheat_field" type="prop" x="{FX0 * 32}" y="{FY0 * 32}" '
             f'width="{(FX1 - FX0 + 1) * 32}" height="{(FY1 - FY0 + 1) * 32}"/>')
next_id += 1
m = re.search(r'(<objectgroup id="\d+" name="buildings"[^>]*>)', src) or \
    re.search(r'(<objectgroup id="\d+" name="decorations"[^>]*>)', src)
src = src[:m.end()] + '\n' + '\n'.join(notes) + src[m.end():]
src = re.sub(r'nextobjectid="\d+"', f'nextobjectid="{next_id}"', src)

# ---------------------------------------------------------------- 검증: NPC·포탈·문 앞 도달
walls = {(i % W, i // W) for i, g in enumerate(L['object']) if g}
start = (47, 17)
seen, q = {start}, deque([start])
while q:
    x, y = q.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        n = (x + dx, y + dy)
        if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and n not in walls:
            seen.add(n)
            q.append(n)
problems = [f'NPC {p} 도달 불가' for p in NPC_TILES if p not in seen and (p[0], p[1] + 1) not in seen
            and (p[0], p[1] - 1) not in seen]
problems += [f'{n} 문 앞 {p} 도달 불가' for n, p in fronts.items() if p not in seen]
if (27, 41) not in seen:
    problems.append('남문 앞 도달 불가')
print(f'집 {len(houses)}채 / 도달 {len(seen)}칸')
if problems:
    raise SystemExit('!! ' + '; '.join(problems))


def write_layer(mm):
    rows = ',\n'.join(','.join(str(v) for v in L[mm.group(2)][y * W:(y + 1) * W]) for y in range(H))
    return f'{mm.group(1)}{rows}\n{mm.group(4)}'


src = layer_re.sub(write_layer, src)
open(SRC, 'w', encoding='utf-8', newline='\n').write(src)
print('wrote', SRC)
