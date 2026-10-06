"""마을(town.tmx) 다듬기 — 건물·NPC·포탈·오브젝트 주석 좌표는 그대로 두고 손본다.

  - 바닥: 맵 전체가 회색 자갈이던 것을 잔디 바탕 + 쓰임새 있는 포장 구역(시청 앞 광장,
    동문 거리, 남쪽 시장 거리·광장, 수교 앞 산책로, 서쪽 골목)으로 나눈다. 수교(44행 이하)는
    건드리지 않는다.
  - 건물에 박힌 소품: 남서쪽 집 앞벽의 나무·꽃바구니, 대장간 좌판 옆에 끼인 나무를 뺀다.
  - 문: 시청의 어두운 굴 같은 문(544/552)과 문 없던 남서쪽 집에 돌 아치 나무문을 단다.
  - 가로등: 수교 앞 9개 일렬을 남문 좌우 대칭 4개로 줄인다.
  - 잔디밭: 나무 무리·덤불·들꽃 화단. 새 나무는 type="tree" 주석도 함께 단다.

여러 번 돌려도 결과가 같다(바닥은 매번 다시 계산하고, 지우기·놓기는 같은 칸에 같은 값).
기존 스타일 변환 실험은 원본 해시가 바뀌므로 승인 게이트에서 막힌다 — 새 계획을 만든다.
"""
import json
import re
from collections import deque

SRC = 'src/games/my-sample-rpg/assets/maps/town.tmx'
W = H = 50
LPC = json.load(open('scripts/lpc-cave-gids.json', encoding='utf-8'))

GRASS, GRASS_ALT, COBBLE = 517, 457, 515
COBBLE_EDGE_BASE = 580          # 잔디↔자갈 전환: mask 1..15 → 580..594, 대각 → 595..598
OLD_PAVING = {44, 55, 515}      # 기존 바닥(자갈 판석·밝은 자갈 조각)
AQUEDUCT_Y = 44                 # 이 행부터는 수교 — 손대지 않는다
TREE_CANOPY = [[326, 327, 328], [334, 335, 336], [342, 343, 344]]
TREE_TRUNK = [350, 351, 352]
FLOWER_BASKET = 493
BUSHES = [1150, 1151, 1152]
FLOWERS = [LPC[f'town_prop_flower_{k}'] for k in 'abcd']
DOOR = ((6, 7, 8), (14, 15, 16))   # 돌 아치 나무문 2x3 (6/14 는 왼쪽 문틀 끝)

src = open(SRC, encoding='utf-8').read()
layer_re = re.compile(r'(<layer id="\d+" name="([^"]+)"[^>]*>\s*<data encoding="csv">\s*)([\d,\s]+?)(</data>)')
L = {m.group(2): [int(v) for v in m.group(3).replace('\n', ',').split(',') if v.strip()]
     for m in layer_re.finditer(src)}


def get(layer, x, y):
    return L[layer][y * W + x] if 0 <= x < W and 0 <= y < H else 0


def put(layer, x, y, gid):
    if 0 <= x < W and 0 <= y < H:
        L[layer][y * W + x] = gid


def objects_by_name():
    return {m.group(1): tuple(float(v) for v in m.groups()[1:5])
            for m in re.finditer(r'<object id="\d+" name="([^"]+)" type="[^"]+" x="([\d.]+)" y="([\d.]+)" '
                                 r'width="([\d.]+)" height="([\d.]+)"', src)}


def tile_rect(name):
    x, y, w, h = OBJ[name]
    return int(x // 32), int(y // 32), int(w // 32), int(h // 32)


OBJ = objects_by_name()

# ---------------------------------------------------------------- 지울 소품
# 남서쪽 집 앞벽의 나무(tree_2)와 모서리 꽃바구니(prop_8), 대장간 좌판과 시청 화분 사이에
# 끼인 나무(tree_1). 가로등은 남문(26~28열) 좌우 대칭으로 7·9·10·12만 남긴다.
REMOVE = ['tree_1', 'tree_2', 'prop_8', 'lamp_5', 'lamp_6', 'lamp_8', 'lamp_11', 'lamp_13']
for name in REMOVE:
    if name not in OBJ:
        continue
    tx, ty, tw, th = tile_rect(name)
    for y in range(ty, ty + th):
        for x in range(tx, tx + tw):
            for layer in ('object', 'object_upper'):
                if name.startswith('tree') and get(layer, x, y) not in sum(TREE_CANOPY, []) + TREE_TRUNK:
                    continue
                if name.startswith('prop') and get(layer, x, y) != FLOWER_BASKET:
                    continue
                put(layer, x, y, 0)
src = re.sub(r'\s*<object id="\d+" name="(' + '|'.join(REMOVE) + r')" type="[^"]+"[^>]*?(/>|>.*?</object>)',
             '', src, flags=re.S)

# ---------------------------------------------------------------- 문
# 시청: 굴 입구 같은 어두운 문을 벽으로 메우고 나무문(가운데 칸 7 이 24열 — 정면 중앙).
for (x, y), wall in (((24, 14), 82), ((24, 15), 90)):
    if get('object', x, y) in (544, 552):
        put('object', x, y, wall)
for r in range(2):
    for c in range(3):
        put('deco', 23 + c, 14 + r, DOOR[r][c])
# 남서쪽 집: 앞벽(좌상단 81 기준 4x4) 오른쪽에 문, 왼쪽에 꽃창 — 물레골 오두막과 같은 짜임
WX, WY = 13, 34
assert get('object', WX, WY) == 81
for dy in range(4):
    for dx in range(4):
        put('deco', WX + dx, WY + dy, 0)
for r in range(2):
    for c in range(3):
        put('deco', WX + 1 + c, WY + 2 + r, DOOR[r][c])
put('deco', WX + 1, WY, 5)
put('deco', WX + 1, WY + 1, 29)

# ---------------------------------------------------------------- 바닥 구역
paved = set()


def rect(x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            paved.add((x, y))


# 시청 앞 광장 — 직사각형 + 모서리를 둥글린 원들
rect(7, 12, 37, 22)
# 동문 거리(광장 → 동문 포탈 49열 17~18행)
rect(37, 16, 49, 19)
# 남쪽 시장 거리(광장 → 시계탑·천막 광장)
rect(24, 22, 30, 31)
# 시장 광장: 가로등(20~21)·시계탑(26~28)·천막(31~36)을 품는다
rect(18, 30, 38, 38)   # 18열부터 — 집 옆에 한 칸짜리 잔디 띠가 남지 않게
# 수교 앞 산책로(남문 26~28열 앞, 가로등 줄) — 서쪽 끝 나무(tree_3)는 잔디에 남긴다
rect(4, 39, 47, 43)
# 서쪽 골목: 광장 → 남서쪽 집 앞 → 산책로
rect(9, 22, 10, 39)
rect(11, 38, 17, 39)
# 건물·분수·화분 주석 칸은 전부 포장(지붕 모서리·분수 뜰 밑이 잔디로 비치지 않게)
for name, (x, y, w, h) in OBJ.items():
    # (시청·남서쪽 집 사각형은 빼야 한다 — 지붕 모서리 투명 칸에 회색 자갈이 비친다)
    if name.startswith(('blacksmith_stall', 'clock_tower', 'market_tent', 'fountain', 'prop_')):
        tx, ty, tw, th = int(x // 32), int(y // 32), int(w // 32), int(h // 32)
        rect(tx, ty, tx + tw - 1, ty + th - 1)

# 잔디 바탕(살짝 섞인 잔디 변형) + 포장
for y in range(AQUEDUCT_Y):
    for x in range(W):
        if get('ground', x, y) not in OLD_PAVING and not (580 <= get('ground', x, y) <= 598) \
                and get('ground', x, y) not in (GRASS, GRASS_ALT):
            continue   # 물·기타 특수 바닥은 그대로
        if (x, y) in paved:
            put('ground', x, y, COBBLE)
        else:
            put('ground', x, y, GRASS_ALT if (x * 7 + y * 13) % 11 == 0 else GRASS)

# 잔디↔자갈 경계 오토타일(사냥터·물레골과 같은 전환 타일)
snap = list(L['ground'])


def ground_at(x, y):
    return snap[y * W + x] if 0 <= x < W and 0 <= y < H else None


for y in range(AQUEDUCT_Y):
    for x in range(W):
        if ground_at(x, y) != COBBLE:
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
        if len(hit) == 1:
            put('ground', x, y, COBBLE_EDGE_BASE + 15 + hit[0])

# ---------------------------------------------------------------- 잔디밭 나무·덤불·꽃
NPC_TILES = []
for m in re.finditer(r'type="character" x="([\d.]+)" y="([\d.]+)"', src):
    NPC_TILES.append((int(float(m.group(1)) // 32), int(float(m.group(2)) // 32)))


def near_npc(x, y, r=1):
    return any(abs(x - nx) <= r and abs(y - ny) <= r + 1 for nx, ny in NPC_TILES)


def can_place(x, y, w, h):
    for dy in range(h):
        for dx in range(w):
            cx, cy = x + dx, y + dy
            if not (0 <= cx < W and 0 <= cy < AQUEDUCT_Y):
                return False
            if (cx, cy) in paved or get('object', cx, cy) or get('object_upper', cx, cy) or near_npc(cx, cy):
                return False
    return True


def can_place_paved(x, y):
    return not get('object', x, y) and not get('object_upper', x, y) and not get('object_upper', x, y - 1) \
        and not near_npc(x, y)


# 나무는 town 나무 한 그림체로 통일 — 수관 색만 바꾼 변형(deep/autumn, append-tree-variants.py)을
# 섞는다. LPC 나무는 외곽선·명암이 달라 town 타일과 섞이면 이질적이었다.
# 나무 변형만(같은 파일의 저택 지붕 매핑은 제외)
TREE_VARIANTS = {k: v for k, v in json.load(open('scripts/tree-variant-gids.json', encoding='utf-8')).items() if 'trunk' in v}
TREE_SETS = {'town': (TREE_CANOPY, TREE_TRUNK),
             **{k: (v['canopy'], v['trunk']) for k, v in TREE_VARIANTS.items()}}


def put_tree(kind, x, y):
    """(x,y) = 3x4 좌상단. 맨 아랫줄 밑동만 충돌."""
    if not can_place(x, y, 3, 4):
        return None
    canopy, trunk = TREE_SETS[kind]
    for r in range(4):
        for c in range(3):
            put('object' if r == 3 else 'object_upper', x + c, y + r, trunk[c] if r == 3 else canopy[r][c])
    return (x, y, 3, 4)


# 모서리·가장자리 잔디밭에 몇 그루씩 어긋나게 모은 숲덩이(격자·일렬 금지)
TREES = [
    ('town', 0, 0), ('deep', 4, 1), ('town', 1, 5), ('deep', 11, 0),                 # 북서
    ('deep', 38, 0), ('town', 43, 1), ('deep', 46, 5), ('town', 40, 6),              # 북동
    ('deep', 0, 24), ('town', 3, 29), ('deep', 1, 33),                               # 서쪽
    ('town', 40, 21), ('deep', 45, 24), ('autumn', 41, 28), ('town', 44, 31),        # 남동
    ('autumn', 20, 24),                                                              # 시장 거리 곁
]
placed_trees = [t for t in (put_tree(*spec) for spec in TREES) if t]

# 덤불: 숲덩이 가장자리와 집 옆 — 잔디밭 결
for x, y in ((3, 4), (8, 3), (46, 8), (36, 4), (5, 27), (12, 30), (39, 33), (47, 29), (18, 27), (2, 37)):
    if can_place(x, y, 1, 1):
        put('object', x, y, BUSHES[(x + y) % 3])

# 시장 거리 입구(24~30열) 양옆 돌 화분 한 쌍 — 넓은 회색 광장에서 남쪽 길목을 표시한다.
URN_BASE, URN_BUSH = 9, 1
for x in (23, 31):
    if can_place_paved(x, 21):
        put('object', x, 21, URN_BASE)
        put('object_upper', x, 20, URN_BUSH)

# 들꽃 화단(밟고 지나가는 데칼): 광장 가장자리 잔디, 시장 거리 양옆
for x0, y0, x1, y1 in ((12, 24, 17, 25), (31, 24, 36, 25), (39, 11, 44, 12), (2, 18, 6, 19)):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if (x, y) not in paved and not get('object', x, y) and not get('object_upper', x, y) \
                    and (x + y) % 2 == 0:
                put('shadow_lower', x, y, FLOWERS[(x * 3 + y) % 4])

# ---------------------------------------------------------------- 새 나무 주석
existing = {m.group(1) for m in re.finditer(r'name="([^"]+)"', src)}
next_id = int(re.search(r'nextobjectid="(\d+)"', src).group(1))
new_objs = []
for i, (x, y, w, h) in enumerate(placed_trees, start=1):
    name = f'tree_g{i}'
    if name in existing:
        continue
    new_objs.append(f'  <object id="{next_id}" name="{name}" type="tree" x="{x * 32}" y="{y * 32}" '
                    f'width="{w * 32}" height="{h * 32}"/>')
    next_id += 1
if new_objs:
    m = re.search(r'(<objectgroup id="\d+" name="decorations"[^>]*>)', src)
    src = src[:m.end()] + '\n' + '\n'.join(new_objs) + src[m.end():]
    src = re.sub(r'nextobjectid="\d+"', f'nextobjectid="{next_id}"', src)

# ---------------------------------------------------------------- 검증: NPC·포탈 도달
walls = {(i % W, i // W) for i, g in enumerate(L['object']) if g}
start = (47, 17)   # 동문 안쪽
seen, q = {start}, deque([start])
while q:
    x, y = q.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        n = (x + dx, y + dy)
        if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and n not in walls:
            seen.add(n)
            q.append(n)
problems = [f'NPC {p} 도달 불가' for p in NPC_TILES if p not in seen and (p[0], p[1] - 1) not in seen]
for nm in ('south_arch_gate',):
    tx, ty, tw, th = tile_rect(nm)
    if not any((x, ty - 1) in seen for x in range(tx, tx + tw)):
        problems.append(f'{nm} 앞 도달 불가')
print(f'나무 {len(placed_trees)}그루 / 포장 {len(paved)}칸 / 도달 {len(seen)}칸')
if problems:
    raise SystemExit('!! ' + '; '.join(problems))

# ---------------------------------------------------------------- 쓰기
def write_layer(m):
    name = m.group(2)
    rows = ',\n'.join(','.join(str(v) for v in L[name][y * W:(y + 1) * W]) for y in range(H))
    return f'{m.group(1)}{rows}\n{m.group(4)}'


src = layer_re.sub(write_layer, src)
open(SRC, 'w', encoding='utf-8', newline='\n').write(src)
print('wrote', SRC)
