"""잊힌 수정 광산(crystal-mine.tmx) 생성기 — LPC 타일 기반.

디자인: "잊힌 수정 광산"(4안 심사 패널 우승안 + 이식). 동굴(The Sundered
Foundry) NE 수정 골방의 옆굴(29,2)이 이 폐광 남쪽 갱도로 이어진다 — 광부들이
수정맥을 좇아 산을 파 내려가다 심장부의 마그마 단조장을 깨웠고, 그날 이후
버려졌다. 동굴 이름의 유래(주조소=Foundry)를 이 맵의 단조장이 설명한다.

  남쪽 포탈 방 → 동서 갱도(해골 광부의 골방) → 서쪽 수정맥 대공동(바위 틈새
  뒤 수정 밀실) → 중앙 허브 → 동쪽 반딧불 버섯 못(슬라임 서식지, 심연으로
  빠지는 싱크홀) / NE 거미줄 뒤 숨은 성소 → 북쪽 마그마 단조장(가고일이
  지키는 룬 비석과 황금 알코브, 꿀꿀이의 부하들) — 금화 부스러기가 포탈에서
  단조장까지 점점이 이어진다.

generate-cave.py와 같은 코너 격자 오토타일 엔진을 쓴다(칸 재질 → 코너 다수결
→ 4코너 조합으로 LPC 전환 타일, 불법 조합은 FALLBACK 강등). 벽은 ground에
평면 암반, 충돌은 object 레이어 투명 블록. 몬스터/포탈은 objectgroup에
정적으로 두고 건드리지 않는다(전부 1배 렌더 — 인트로가 '동굴'이 아니라
보스 씬 판정 없음).
"""
import json
import random
import re
from collections import deque

SRC = 'src/games/my-sample-rpg/assets/maps/crystal-mine.tmx'
GIDS_PATH = 'scripts/lpc-cave-gids.json'
W = H = 40

# ---------------------------------------------------------------- 지형 원본
# 범례: # 벽  g 자갈(단조장/수정공동)  L 용암  . 흙바닥  ~ 물  W 깊은 물
#   % 굴 아가리/싱크홀(막힘)  S 진입 스폰  C 에디터 스폰  P 귀환 포탈 트리거
ASCII_MAP = '\n'.join([
    '#' * 40,
    '#' * 40,
    '########' + 'g' * 23 + '#.....###',
    '########' + 'g' * 23 + '#.....###',
    '########gggLLLLLgggggggLLLLLggg#.....###',
    '########gggLLLLLgggggggLLLLLggg#.....###',
    '########gggLLLLLgggggggLLLLLggg#.....###',
    '########' + 'g' * 23 + '#.....###',
    '########' + 'g' * 23 + '#.....###',
    '#' * 18 + '...' + '#' * 12 + '...####',
    '#' * 18 + '...' + '#' * 12 + '...####',
    '#' * 18 + '...' + '#' * 12 + '...####',
    '#' * 10 + '.' * 26 + '####',
    '###' + 'g' * 10 + '.' * 23 + '####',
    '###' + 'g' * 10 + '.' * 23 + '####',
    '###' + 'g' * 10 + '.' * 23 + '####',
    '###' + 'g' * 10 + '.' * 23 + '####',
    '###' + 'g' * 10 + '.' * 23 + '####',
    '###' + 'g' * 10 + '#' * 6 + '...' + '#' * 4 + '.' * 10 + '####',
    '###' + 'g' * 10 + '#' * 6 + '...' + '#' * 4 + '..~~~~~~..' + '####',
    '###' + 'g' * 10 + '#' * 6 + '...' + '#' * 4 + '..~WW~~~..' + '####',
    '###' + 'g' * 10 + '#' * 6 + '...' + '#' * 4 + '..~WW~~~..' + '####',
    '###' + 'g' * 10 + '#' * 6 + '.C.' + '#' * 4 + '..~WW%~~..' + '####',
    '###' + 'g' * 10 + '#' * 6 + '...' + '#' * 4 + '..~~~~~~..' + '####',
    '###' + 'g' * 10 + '#' * 6 + '...' + '#' * 4 + '.' * 10 + '####',
    '###' + 'g' * 10 + '#' * 6 + '...' + '#' * 4 + '.' * 10 + '####',
    '###' + 'g' * 10 + '#' * 6 + '...' + '#' * 4 + '.' * 10 + '####',
    '###' + 'g' * 10 + '#' * 6 + '...' + '#' * 4 + '.' * 10 + '####',
    '###' + 'g' * 10 + '#' * 6 + '...' + '#' * 4 + '.' * 10 + '####',
    '####...' + '#' * 12 + '...' + '#' * 4 + '.' * 10 + '####',
    '####...' + '#' * 12 + '...' + '#' * 4 + '#.....' + '#' * 8,
    '###' + '.' * 29 + '########',
    '###' + '.' * 29 + '########',
    '###' + '.' * 29 + '########',
    '#' * 27 + '.....' + '#' * 8,
    '#' * 27 + '..S..' + '#' * 8,
    '#' * 27 + '..P..' + '#' * 8,
    '#' * 29 + '%' + '#' * 10,
    '#' * 40,
    '#' * 40,
])

GRID = ASCII_MAP.split('\n')
assert len(GRID) == H and all(len(r) == W for r in GRID), \
    [(i, len(r)) for i, r in enumerate(GRID) if len(r) != W]

G = json.load(open(GIDS_PATH))   # cave_* 이름 → gid

# ---- 재질. 정준 순서(코너 동률 우선순위)는 벤더 시트의 상대 순서와 일치해야 한다 ----
DB, DR, GD, GV = 'Dirt_Brown', 'Dirt_Roots', 'Grass_Dark', 'Gravel_1'
WT, WD, LV, HB = 'Water', 'Water_Deep', 'Lava', 'Hole_Black'
RG, RB = 'Rock_Gray', 'Rock_Black'
PRIORITY = [DB, DR, GD, GV, WT, WD, LV, HB, RG, RB]
PRI = {m: i for i, m in enumerate(PRIORITY)}
WALLS_M = {RG, RB}
FALLBACK = {DR: DB, GD: DB, GV: DB, WD: WT, WT: DB, LV: GV, HB: RB, RG: RB}

INVISIBLE_BLOCK = 302   # 완전 투명 타일 — 보이지 않는 충돌만 남긴다
SHADE = 64              # town-32의 반투명 어둠
ROCK_PILE = [527, 528]  # town-32 기본 바위 더미
CRYSTAL_TOWN = 494      # town-32 파란 수정 덤불

LAYER_NAMES = ['ground', 'shadow_lower', 'object', 'shadow_upper',
               'object_upper', 'deco', 'roof']
FIRST_LAYER_ID = 10   # TMX는 layer/objectgroup이 id 공간을 공유 — 기존 2,3을 피한다

L = {n: [0] * (W * H) for n in LAYER_NAMES}
rnd = random.Random(20260906)


def at(x, y):
    return GRID[y][x] if 0 <= x < W and 0 <= y < H else '#'


def put(layer, x, y, gid):
    if 0 <= x < W and 0 <= y < H and gid:
        L[layer][y * W + x] = gid


OPEN_CHARS = set('.gSCP')
BLOCKED_CHARS = set('~WL%')


def is_floor(x, y):
    return at(x, y) in OPEN_CHARS


def is_wall(x, y):
    return at(x, y) == '#'


# ---------------------------------------------------------------- 칸 재질 결정
CHAR_MAT = {'#': RB, 'g': GV, 'L': LV, '~': WT, 'W': WD, '%': HB,
            '.': DB, 'S': DB, 'C': DB, 'P': DB}
MAT = [[CHAR_MAT[at(x, y)] for x in range(W)] for y in range(H)]

# 수정 공동(서쪽 x<=13, y13-28) 둘레 두 겹 벽은 밝은 회색 암반 — 동굴 수정
# 골방과 같은 문법으로 '수정이 자라는 바위'를 읽게 한다
cavern_floor = [(x, y) for y in range(13, 29) for x in range(3, 14)
                if at(x, y) == 'g']
for y in range(H):
    for x in range(W):
        if MAT[y][x] == RB and any(abs(x - fx) <= 2 and abs(y - fy) <= 2
                                   for fx, fy in cavern_floor):
            MAT[y][x] = RG

# 반딧불 버섯 못의 이끼 얼룩 — 물가에서 번진다(벽 앞치마가 가장자리를 정리)
for cx, cy, r in ((29, 16, 2), (33, 25, 1), (27, 24, 1), (34, 17, 1), (28, 27, 1)):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if at(x, y) == '.' and MAT[y][x] == DB and rnd.random() < 0.85:
                MAT[y][x] = GD

# 갱도의 뿌리 얼룩 — 낡은 갱도 천장에서 뿌리가 내려온 바닥
for cx, cy in ((10, 32), (17, 32), (24, 32), (13, 31)):
    for y in range(cy - 1, cy + 2):
        for x in range(cx - 1, cx + 2):
            if at(x, y) == '.' and MAT[y][x] == DB and rnd.random() < 0.8:
                MAT[y][x] = DR

# 벽 앞치마: 벽과 전환 타일이 없는 재질이 벽에 닿으면 흙으로
VENDORED_WALL_PAIRS = {(RB, DB), (RB, GV), (RB, HB), (RB, RG), (RB, LV),
                       (RG, DB), (RG, GV)}
for y in range(H):
    for x in range(W):
        m = MAT[y][x]
        if m in WALLS_M or m == HB:
            continue
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nm = MAT[y + dy][x + dx] if 0 <= x + dx < W and 0 <= y + dy < H else RB
                if nm in WALLS_M and (nm, m) not in VENDORED_WALL_PAIRS:
                    MAT[y][x] = DB
                    break
            else:
                continue
            break

# ---------------------------------------------------------------- 코너 격자
def corner_mat(cx, cy):
    votes = {}
    for dx, dy in ((-1, -1), (0, -1), (-1, 0), (0, 0)):
        x, y = cx + dx, cy + dy
        m = MAT[y][x] if 0 <= x < W and 0 <= y < H else RB
        votes[m] = votes.get(m, 0) + 1
    return max(votes, key=lambda m: (votes[m], PRI[m]))


LAT = [[corner_mat(cx, cy) for cx in range(W + 1)] for cy in range(H + 1)]


def combo_legal(tl, tr, bl, br):
    mats = {tl, tr, bl, br}
    if len(mats) == 1:
        return f'cave_fill_{tl}_00' in G
    if len(mats) == 2:
        a, b = sorted(mats, key=lambda m: PRI[m])
        mask = sum(1 << i for i, c in enumerate((tl, tr, bl, br)) if c == b)
        return f'cave_edge_{a}__{b}_m{mask:02d}' in G
    return False


def combo_name(tl, tr, bl, br):
    mats = {tl, tr, bl, br}
    if len(mats) == 1:
        # 변형 1은 큰 싱크홀 무늬라 얼룩처럼 보인다 — 밋밋한 0과 잔무늬 2,3만
        variants = [k for k in (f'cave_fill_{tl}_{i:02d}' for i in (0, 2, 3)) if k in G]
        weights = [8] + [1] * (len(variants) - 1)
        return rnd.choices(variants, weights=weights)[0]
    a, b = sorted(mats, key=lambda m: PRI[m])
    mask = sum(1 << i for i, c in enumerate((tl, tr, bl, br)) if c == b)
    base = f'cave_edge_{a}__{b}_m{mask:02d}'
    if f'{base}_v1' in G and rnd.random() < 0.5:
        return f'{base}_v1'
    return base


for _sweep in range(40):
    changed = 0
    for y in range(H):
        for x in range(W):
            if combo_legal(LAT[y][x], LAT[y][x + 1], LAT[y + 1][x], LAT[y + 1][x + 1]):
                continue
            corners = [(y, x), (y, x + 1), (y + 1, x), (y + 1, x + 1)]
            movable = [c for c in corners if LAT[c[0]][c[1]] in FALLBACK]
            assert movable, f'({x},{y}) 강등 불가: ' + str([LAT[cy_][cx_] for cy_, cx_ in corners])
            cy_, cx_ = max(movable, key=lambda c: PRI[LAT[c[0]][c[1]]])
            LAT[cy_][cx_] = FALLBACK[LAT[cy_][cx_]]
            changed += 1
    if not changed:
        break
else:
    raise SystemExit('코너 조합 합법화가 수렴하지 않음')

# ---------------------------------------------------------------- ground / 충돌
for y in range(H):
    for x in range(W):
        put('ground', x, y, G[combo_name(LAT[y][x], LAT[y][x + 1],
                                         LAT[y + 1][x], LAT[y + 1][x + 1])])
        if is_wall(x, y) or at(x, y) in BLOCKED_CHARS:
            put('object', x, y, INVISIBLE_BLOCK)

# ---------------------------------------------------------------- 소품
def stamp(name_prefix, x, y, cols, rows_, solid_rows=1):
    """멀티타일 소품. 바닥 solid_rows 행은 object(충돌+y정렬), 위는 object_upper."""
    for r in range(rows_):
        for c in range(cols):
            key = f'cave_prop_{name_prefix}_r{r}c{c}'
            gid = G.get(key if rows_ * cols > 1 else f'cave_prop_{name_prefix}')
            if not gid:
                continue
            ty = y - (rows_ - 1) + r
            layer = 'object' if r >= rows_ - solid_rows else 'object_upper'
            put(layer, x + c, ty, gid)


# 마그마 단조장 — 가고일 한 쌍이 룬 비석을 지키고, 그 곁에 금화가 쌓여 있다
stamp('stele_rune', 18, 3, 3, 2, solid_rows=2)
stamp('gargoyle', 13, 3, 2, 2)
stamp('gargoyle', 24, 3, 2, 2)
for x, y, i in ((16, 2, 0), (17, 3, 1), (21, 3, 2), (22, 2, 3), (16, 3, 2), (22, 3, 0)):
    put('shadow_lower', x, y, G[f'cave_prop_gold_{i:02d}'])
for i, (x, y) in enumerate(((10, 2), (28, 2), (16, 8), (22, 8))):
    put('object', x, y, G[f'cave_prop_brazier_{i % 2:02d}'])

# 단조장 관문 — 동굴 관문과 같은 황금 기둥(같은 자들이 세웠다)
for gx in (17, 21):
    put('object', gx, 11, G['cave_prop_pillar_gold_r2c0'])
    put('object_upper', gx, 10, G['cave_prop_pillar_gold_r1c0'])
    put('object_upper', gx, 9, G['cave_prop_pillar_gold_r0c0'])
for x in (18, 19, 20):
    put('shadow_lower', x, 12, SHADE)
    put('shadow_upper', x, 9, SHADE)

# 금화 부스러기 — 포탈에서 단조장까지 점점이(꿀꿀이 부하들이 흘린 흔적)
for i, (x, y) in enumerate(((29, 34), (29, 32), (25, 32), (20, 29), (20, 25),
                            (20, 21), (20, 17), (19, 12), (19, 8))):
    if not L['shadow_lower'][y * W + x]:
        put('shadow_lower', x, y, G[f'cave_prop_gold_{i % 4:02d}'])

# 숨은 성소 — 광부들이 산의 심장을 달래던 곳(동굴 아레나와 같은 두건 석상)
put('shadow_lower', 34, 4, G['cave_prop_pentagram'])
stamp('statue_hood', 34, 3, 1, 2)
put('object', 32, 5, G['cave_prop_brazier_00'])
put('object', 36, 5, G['cave_prop_brazier_01'])
put('deco', 33, 9, G['cave_prop_web_nw'])
put('deco', 35, 9, G['cave_prop_web_ne'])

# 수정맥 대공동 — 큰 수정 군집은 전부 '캘 수 있는 광맥'(TMX objectgroup의
# mine-ore 캐릭터)이라 여기선 배치하지 않는다. 장식은 town 수정 덤불과
# 장신 수정 기둥만 — 광맥과 장식이 한눈에 구분되게.
for x, y in ((6, 14), (10, 25), (3, 18), (12, 15)):
    put('object', x, y, CRYSTAL_TOWN)
stamp('crystal_tall', 4, 26, 1, 2)
put('object', 3, 27, G['cave_prop_crate_crystal'])
for x, y, i in ((5, 25, 1), (4, 24, 3)):
    put('shadow_lower', x, y, G[f'cave_prop_gold_{i:02d}'])
put('object', 6, 21, G['cave_prop_boulder'])
for i, (x, y) in enumerate(((11, 16), (4, 22), (9, 27))):
    put('object', x, y, ROCK_PILE[i % 2])

# 반딧불 버섯 못 — 슬라임 서식지. 못 속 싱크홀이 동굴 심연 호수로 빠진다
for x, y, k in ((27, 17, 'a'), (34, 16, 'b'), (27, 26, 'b'), (34, 24, 'a'), (30, 26, 'a')):
    put('object', x, y, G[f'cave_prop_glow_plant_{k}'])
put('object', 33, 27, G['cave_prop_crate_mush'])
put('object', 26, 15, G['cave_prop_boulder'])
for x, y in ((28, 26), (32, 24), (30, 28)):
    if not L['shadow_lower'][y * W + x]:
        put('shadow_lower', x, y, G['cave_prop_goo_puddle'])

# 갱도 — 해골 광부의 골방(서쪽 끝, 잔해 프레임 뒤)과 낡은 잔해들
stamp('skeleton', 4, 32, 1, 2)
put('object', 3, 33, G['cave_prop_crate_bones'])
put('shadow_lower', 5, 32, G['cave_prop_gold_01'])
for x, y in ((7, 31), (7, 32), (7, 33)):
    put('shadow_lower', x, y, G[f'cave_prop_rubble_{(x + y) % 6:02d}'])
put('object', 15, 32, G['cave_prop_boulder'])
put('object', 23, 33, G['cave_prop_boulder'])
for i, (x, y) in enumerate(((12, 33), (20, 31), (26, 32))):
    put('object', x, y, ROCK_PILE[i % 2])
put('shadow_lower', 27, 35, G['cave_prop_filth_spot'])

# ---------------------------------------------------------------- shadow_lower
for y in range(H):
    for x in range(W):
        if not is_floor(x, y):
            continue
        n, w_ = is_wall(x, y - 1), is_wall(x - 1, y)
        if n and w_:
            put('shadow_lower', x, y, G['cave_shadow_nw'])
        elif n:
            put('shadow_lower', x, y, G['cave_shadow_ne'] if is_wall(x + 1, y) else G['cave_shadow_n'])
        elif w_:
            put('shadow_lower', x, y, G['cave_shadow_w'])

# 잔해 링 데칼 — 흙/자갈 바닥에 드문드문
for y in range(H):
    for x in range(W):
        if not is_floor(x, y) or at(x, y) not in '.g':
            continue
        m = MAT[y][x]
        if (m == DB and rnd.random() < 0.04) or (m == GV and rnd.random() < 0.06):
            if not L['shadow_lower'][y * W + x]:
                put('shadow_lower', x, y, G[f'cave_prop_rubble_{rnd.randrange(6):02d}'])

# 거미줄 — 구석과 성소 어귀
for x, y, d in ((3, 31, 'nw'), (35, 14, 'ne'), (8, 13, 'nw'), (31, 31, 'se')):
    if is_floor(x, y):
        put('deco', x, y, G[f'cave_prop_web_{d}'])

# ---------------------------------------------------------------- 검증
walls = {(i % W, i // W) for i, g in enumerate(L['object']) if g}
start = (29, 35)
seen = {start}
q = deque([start])
while q:
    x, y = q.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nb = (x + dx, y + dy)
        if 0 <= nb[0] < W and 0 <= nb[1] < H and nb not in seen and nb not in walls:
            seen.add(nb)
            q.append(nb)

CHECK = [('진입스폰', (29, 35)), ('포탈트리거', (29, 36)), ('에디터스폰(맵중앙)', (20, 20)),
         ('비석앞', (19, 4)), ('단조장서편', (9, 5)), ('단조장동편', (29, 5)),
         ('관문통로', (19, 10)), ('성소', (34, 4)), ('성소통로', (34, 10)),
         ('수정밀실', (5, 26)), ('수정공동', (8, 16)), ('버섯못가', (27, 20)),
         ('갱도서단-해골골방', (5, 32)), ('갱도중앙', (16, 32)), ('회랑동단', (29, 31))]
problems = []
for name, pt in CHECK:
    if pt in walls:
        problems.append(f'{name}{pt} 벽/오브젝트에 막힘')
    elif pt not in seen:
        problems.append(f'{name}{pt} 도달 불가')

# 몬스터 자리(objectgroup과 일치해야 함)가 열려 있고 도달 가능한지
MONSTER_TILES = [('말캉이', (28, 25)), ('말캉이', (33, 25)), ('말캉이', (27, 21)),
                 ('말캉이', (34, 20)), ('말캉이', (31, 27)),
                 ('꿀꿀이', (9, 5)), ('꿀꿀이', (29, 5)), ('꿀꿀이대장', (19, 5)),
                 # 광맥(objectgroup의 mine-ore 캐릭터)도 열린 바닥에 있어야 한다
                 ('수정광맥', (7, 15)), ('수정광맥', (10, 19)), ('수정광맥', (5, 22)),
                 ('수정광맥', (11, 24)), ('수정광맥', (6, 26)), ('수정광맥', (9, 32)),
                 ('수정광맥', (26, 7)),
                 ('바위돌이', (9, 15)), ('바위돌이', (23, 7)), ('바위돌이', (14, 32)),
                 ('버섯돌이', (32, 17)), ('버섯돌이', (28, 16))]
for name, pt in MONSTER_TILES:
    if pt in walls:
        problems.append(f'{name}{pt} 벽/오브젝트에 막힘')
    elif pt not in seen:
        problems.append(f'{name}{pt} 도달 불가')

for x in range(W):
    for y in (0, H - 1):
        if (x, y) not in walls:
            problems.append(f'외곽 개방: ({x},{y})')
for y in range(H):
    for x in (0, W - 1):
        if (x, y) not in walls:
            problems.append(f'외곽 개방: ({x},{y})')

MAX_GID = max(max(G.values()), SHADE, INVISIBLE_BLOCK, CRYSTAL_TOWN, *ROCK_PILE)
for name in LAYER_NAMES:
    bad = [g for g in L[name] if g and not (1 <= g <= MAX_GID)]
    if bad:
        problems.append(f'{name}: gid 범위 밖 {sorted(set(bad))}')

print(f'벽/오브젝트 {len(walls)} / 도달가능 {len(seen)} / 전체 {W * H} '
      f'(고립 {W * H - len(walls) - len(seen)}칸)')
for name in LAYER_NAMES:
    print(f'  {name:14s} {sum(1 for g in L[name] if g):5d}')
if problems:
    print('!! 문제:')
    for p in problems:
        print('   -', p)
    raise SystemExit(1)
print('검증 통과: 스폰/포탈/성소/밀실/골방/비석/몬스터 자리 모두 도달 가능, 외곽 밀폐')

# ---------------------------------------------------------------- TMX 출력
src = open(SRC).read()
head = src[:src.index(' <layer ')]
tail = src[src.index(' <objectgroup '):]
head = re.sub(r'nextlayerid="\d+"',
              f'nextlayerid="{FIRST_LAYER_ID + len(LAYER_NAMES)}"', head)

parts = []
for i, name in enumerate(LAYER_NAMES, start=FIRST_LAYER_ID):
    rows = ',\n'.join(','.join(str(v) for v in L[name][y * W:(y + 1) * W]) for y in range(H))
    parts.append(f' <layer id="{i}" name="{name}" width="{W}" height="{H}">\n'
                 f'  <data encoding="csv">\n{rows}\n</data>\n </layer>\n')
open(SRC, 'w').write(head + ''.join(parts) + tail)
print('wrote', SRC)
