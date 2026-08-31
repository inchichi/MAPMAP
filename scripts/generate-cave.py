"""동굴(cave.tmx) 보스 소굴 생성기 — DCSS 타일 기반.

디자인: "The Sundered Foundry" 지형(심사 패널 우승안) + DCSS(Dungeon Crawl
Stone Soup, 퍼블릭 도메인) 동굴 어휘. 타일은 scripts/append-dcss-cave-tiles.py가
town-32 시트에 덧붙인 cave_* 타일을 쓴다(gid 매핑: scripts/dcss-cave-gids.json).

  서쪽 이끼 현관 → 협곡 핀치 → 문지기(말캉이) 굴 앞 제단 → 수정 골방(보상)
  → 전망대 허브 → 탁한 심연 호수 위 석회암 둑길 → 부서진 관문 → 해골 벽과
  혈흔 바닥의 최종 아레나(꿀꿀이) — 금화 더미와 황금 우상이 그의 전리품이다.

town.tmx 레이어 규약(ground/shadow_lower/object/shadow_upper/object_upper/
deco/roof)을 따른다. object = 충돌 + 캐릭터와 y-정렬. DCSS 벽 그림자
(cave_shadow_*)를 shadow_lower에 깔아 벽이 바닥 위로 솟은 입체로 읽히게 한다.

이 씬은 sceneIntro '동굴' 문자열로 보스 씬 판정되어 몬스터가 2배 스케일로
렌더된다 — 모든 동선은 3폭 이상, 두 보스 주변 5x5는 완전 개방을 보장한다.
objectgroup은 보존하되 보스/포탈 좌표만 갱신한다(테스트는 x/y를 단언 안 함).
"""
import json
import random
import re
from collections import deque

SRC = 'src/games/my-sample-rpg/assets/maps/cave.tmx'
GIDS_PATH = 'scripts/dcss-cave-gids.json'
W = H = 34

# ---------------------------------------------------------------- 지형 원본
# 범례: # 벽  . 일반 바닥  , 현관/링 바닥  s 석회암 석판  b 문턱  g 관문 통로
#   m 혈흔 무대  ~ 심연 호수  % 굴 아가리(벽 소속)  P 포탈  S 진입 스폰
#   C 에디터 스폰  1 말캉이 앵커  2 꿀꿀이 앵커  L 화로  B 기둥 잔해  c 발광 이끼
#   r 잔해(기둥/이끼)  u (예비)
ASCII_MAP = """\
##################################
##################################
################%#################
##########..............##..c..###
##########............r.##.....###
##########...L,,,,,L..........c###
##########...,,,,,,,...........###
##########...,,sss,,...........###
#L......##...,,s1s,,....##rc...###
#,,,,...##...,,sss,,....##########
P,S,,........,,,,,,,....##########
P,,,,......B.,,,,,,L....##########
#,,,,...##..B........r..##########
#L......##..............##########
##############.......#############
##############.......#############
##############..,,,..#############
##############..,C,..#############
##############..,,,..#############
##############L......#############
##~~~~~~~~~~~~~~sss~~~~~~~~~~~~~##
##~~~~~~~~~~~~~~sss~~~~~~~~~~~~~##
##~~~~~~~~~~~~~~sss~~~~~~~~~~~~~##
##~~~~~~~~~~~~~~sss~~~~~~~~~~~~~##
###########bbbbbbbbbbbbbbbbb######
################ggg###############
################ggg###############
###########...bbbbbbb..........###
###########.......mmmmmmm......###
###########.......mmm2mmm......###
###########.c.....mmmmmmm.....c###
###########..r....mmmmmmm...r..###
###########....................###
##################################"""

GRID = ASCII_MAP.split('\n')
assert len(GRID) == H and all(len(r) == W for r in GRID)

G = json.load(open(GIDS_PATH))   # cave_* 이름 → gid

# ---- 팔레트(전부 DCSS, 시각 검증 완료) ----
FLOOR_PEBBLE = [G[f'cave_floor_pebble_{i:02d}'] for i in range(9)]
FLOOR_MOSS = [G[f'cave_floor_moss_{i:02d}'] for i in range(4)]
FLOOR_BOG = [G[f'cave_floor_bog_{i:02d}'] for i in range(4)]
FLOOR_LIME = [G[f'cave_floor_limestone_{i:02d}'] for i in range(6)]
FLOOR_BLOOD_CLEAN = [G[f'cave_floor_blood_{i:02d}'] for i in range(8)]    # 옅은 얼룩
FLOOR_BLOOD_HEAVY = [G[f'cave_floor_blood_{i:02d}'] for i in range(8, 12)]  # 짙은 혈흔
FLOOR_CRYSTAL = [G[f'cave_floor_crystal_{i:02d}'] for i in range(3)]

WALL_LAIR = [G['cave_wall_lair_00'], G['cave_wall_lair_01'], G['cave_wall_lair_02']]
WALL_LAIR_VINE = G['cave_wall_lair_vine']
WALL_SLIME = [G[f'cave_wall_slime_{i:02d}'] for i in range(3)]
WALL_CATA = [G[f'cave_wall_catacombs_{i:02d}'] for i in range(5)]
WALL_CATA_SKULL = [G['cave_wall_catacombs_skull_00'], G['cave_wall_catacombs_skull_01']]
WALL_CRYPT = G['cave_wall_crypt_00']
WALL_CANDLE = [G['cave_wall_crypt_candle_00'], G['cave_wall_crypt_candle_01']]
WALL_CRYSTAL = [G['cave_wall_crystal_00'], G['cave_wall_crystal_01']]
WALL_CRYSTAL_GLOW = [G['cave_wall_crystal_lightblue'], G['cave_wall_crystal_lightgreen']]

SHADOW_N, SHADOW_W, SHADOW_NW, SHADOW_NE = (
    G['cave_shadow_n'], G['cave_shadow_w'], G['cave_shadow_nw'], G['cave_shadow_ne'])

WATER = [G['cave_water_deep_00'], G['cave_water_deep_01']]  # 파란 깊은 물 — 이끼 바닥과 확실히 구분
BORD = {d: G[f'cave_water_bord_{d}'] for d in ('top', 'btm', 'lft', 'rgt', 'tl', 'tr', 'bl', 'br')}

GATE_BROKEN = [G['cave_gate_broken_left'], G['cave_gate_broken_middle'], G['cave_gate_broken_right']]
ARCH_HELL = G['cave_arch_hell']
BURROW = G['cave_burrow']

BRAZIER = [G['cave_brazier_00'], G['cave_brazier_01']]
ALTAR_SLIME = G['cave_altar_slime']
ALTAR_SKULLS = G['cave_altar_skulls']
STATUE_BUST = G['cave_statue_bust']
IDOL_GOLD = G['cave_idol_gold']
COLUMNS_ = [G['cave_column_00'], G['cave_column_01'], G['cave_column_02']]
MOULD = [G['cave_mould_00'], G['cave_mould_01']]
GOLD = [G[f'cave_gold_{i:02d}'] for i in range(4)]
WEB = {d: G[f'cave_web_{d}'] for d in ('ne', 'nw', 'se', 'sw')}
SLIME_OV = {d: G[f'cave_slime_overlay_{d}'] for d in ('e', 'n', 'ne', 'nw', 's', 'se', 'sw', 'w')}

SHADE = 64          # town-32의 반투명 어둠 — 아치 문턱/남단 그라데이션에 계속 쓴다
VIGNETTE = 503

LAYER_NAMES = ['ground', 'shadow_lower', 'object', 'shadow_upper',
               'object_upper', 'deco', 'roof']
FIRST_LAYER_ID = 10   # TMX는 layer/objectgroup이 id 공간을 공유 — 기존 2,3을 피한다

L = {n: [0] * (W * H) for n in LAYER_NAMES}
rnd = random.Random(20260831)


def at(x, y):
    return GRID[y][x] if 0 <= x < W and 0 <= y < H else '#'


def put(layer, x, y, gid):
    if 0 <= x < W and 0 <= y < H and gid:
        L[layer][y * W + x] = gid


OPEN_CHARS = set('.,sbgmPSC12LuBcr')
VOID_CHARS = set('~')


def is_floor(x, y):
    return at(x, y) in OPEN_CHARS


def is_wall(x, y):
    return at(x, y) in '#%'


def zone(x, y):
    """구역별 재질 결정. 지형 문자보다 우선순위 낮은 힌트."""
    if y >= 24:
        return 'arena'
    if x >= 24 and y <= 9:
        return 'grotto'
    if x <= 9 and 7 <= y <= 14:
        return 'foyer'
    return 'cave'


# ---------------------------------------------------------------- ground
for y in range(H):
    for x in range(W):
        ch = at(x, y)
        if ch in VOID_CHARS:
            put('ground', x, y, WATER[0] if rnd.random() < 0.7 else WATER[1])
            continue
        z = zone(x, y)
        # 벽 밑에도 바닥을 깔아 둔다(타일 가장자리 틈 방지)
        if ch in 's1':
            gid = FLOOR_LIME[rnd.randrange(4)]          # 제단/둑길 — 밝은 석회암
        elif ch in 'bg':
            gid = FLOOR_LIME[3 + rnd.randrange(3)]      # 관문 앞 — 낡은 석회암
        elif ch == 'm':
            gid = FLOOR_BLOOD_CLEAN[rnd.randrange(8)]   # 혈흔 무대(짙은 얼룩은 아래서)
        elif ch == '2':
            gid = FLOOR_BLOOD_HEAVY[1]                  # 보스 앵커 — 가장 짙은 자국
        elif z == 'arena':
            gid = FLOOR_BLOOD_CLEAN[rnd.randrange(4)]   # 아레나 전체가 자갈 포장
        elif z == 'foyer':
            gid = FLOOR_MOSS[rnd.randrange(4)]          # 바깥 숲의 이끼가 스며든 현관
        else:
            gid = FLOOR_PEBBLE[rnd.randrange(9)]
        put('ground', x, y, gid)

# 말캉이 서식 고리 — 제단 석회암 둘레 한 겹은 늪으로(슬라임이 헤집은 땅)
for y in range(6, 11):
    for x in range(14, 19):
        if not (15 <= x <= 17 and 7 <= y <= 9):
            put('ground', x, y, FLOOR_BOG[rnd.randrange(4)])

# 현관 이끼가 통로 쪽으로 번지다 끊긴다 — 재질 경계를 흐리는 소량의 침식
for y in range(9, 13):
    for x in range(10, 14):
        if is_floor(x, y) and rnd.random() < 0.35:
            put('ground', x, y, FLOOR_MOSS[rnd.randrange(4)])

# 짙은 혈흔은 보스 주변에 집중 — '여기서 수없이 싸웠다'
for y in range(H):
    for x in range(W):
        if at(x, y) != 'm':
            continue
        if abs(x - 21) <= 1 and abs(y - 29) <= 1:
            if rnd.random() < 0.7:
                put('ground', x, y, FLOOR_BLOOD_HEAVY[rnd.randrange(4)])
        elif rnd.random() < 0.15:
            put('ground', x, y, FLOOR_BLOOD_HEAVY[rnd.randrange(4)])

# 수정 골방 바닥 — 발광 수정 무늬가 군데군데
for x, y in ((27, 4), (29, 5), (28, 7), (26, 5), (30, 3)):
    if is_floor(x, y):
        put('ground', x, y, FLOOR_CRYSTAL[rnd.randrange(3)])

# ---------------------------------------------------------------- object: 벽
grotto_floor = [(x, y) for y in range(H) for x in range(W)
                if zone(x, y) == 'grotto' and is_floor(x, y)]


def near_grotto(x, y):
    return any(abs(x - fx) <= 1 and abs(y - fy) <= 1 for fx, fy in grotto_floor)


for y in range(H):
    for x in range(W):
        if not is_wall(x, y):
            continue
        if y >= 24:
            # 관문 성벽/아레나 — 해골 납골당 석벽
            r = rnd.random()
            gid = WALL_CRYPT if r < 0.08 else WALL_CATA[rnd.randrange(5)]
        elif zone(x, y) == 'grotto' and near_grotto(x, y):
            # 골방에 면한 벽에 수정이 '박혀' 있다 — 전면 크리스탈은 얼음궁전처럼 보여
            # 암벽 사이 광맥처럼 드문드문만
            r = rnd.random()
            gid = (WALL_CRYSTAL_GLOW[rnd.randrange(2)] if r < 0.1
                   else WALL_CRYSTAL[rnd.randrange(2)] if r < 0.32
                   else WALL_LAIR[rnd.randrange(3)])
        elif 13 <= x <= 19 and y <= 2:
            # 굴 아가리 둘레 — 슬라임이 삭힌 바위
            gid = WALL_SLIME[rnd.randrange(3)]
        else:
            r = rnd.random()
            gid = WALL_LAIR_VINE if r < 0.06 else WALL_LAIR[rnd.randrange(3)]
        put('object', x, y, gid)

# 아레나 북벽의 해골 상감 — 보스 등 뒤로 해골들이 박혀 있다
# (x16-18은 관문 통로라 절대 밟지 않는다)
for x, wx in ((15, 0), (22, 1), (27, 0), (29, 1)):
    put('object', x, 26, WALL_CATA_SKULL[wx])
# 촛불 벽감 — 관문 좌우와 옥좌벽
for x, wx in ((14, 0), (20, 1), (26, 0)):
    put('object', x, 26, WALL_CANDLE[wx])

# 굴 아가리(말캉이의 굴 · 골방의 옆굴) — 이끼 낀 통나무 굴 입구
put('object', 16, 2, BURROW)
put('object', 29, 2, BURROW)

# ---------------------------------------------------------------- 관문(y25-26)
# 부서진 나무 관문이 통로 위에 걸려 있다 — 개구부는 위 레이어(deco), 통행 가능
for i, x in enumerate((16, 17, 18)):
    put('deco', x, 25, GATE_BROKEN[i])
# 지옥 아치 표석 — 둑길 축 정면, 관문 앞(위 레이어라 그 밑을 지나간다)
put('deco', 17, 24, ARCH_HELL)

# ---------------------------------------------------------------- 소품
put('object', 16, 5, ALTAR_SLIME)     # 문지기의 점액 제단 — 굴과 무대 사이
put('object', 25, 28, ALTAR_SKULLS)   # 최종 아레나의 해골 무더기
put('object', 12, 29, STATUE_BUST)    # 잊힌 악마 흉상
put('object', 26, 30, IDOL_GOLD)      # 꿀꿀이의 황금 우상(전리품 더미의 중심)
put('object', 25, 30, GOLD[2])
put('object', 27, 31, GOLD[1])
put('object', 24, 31, GOLD[0])
put('object', 28, 30, GOLD[3])

col_i = 0
for y in range(H):
    for x in range(W):
        ch = at(x, y)
        if ch == 'B':                         # 무너진 기둥 — 돌진 회피 엄폐물
            put('object', x, y, COLUMNS_[col_i % 3])
            col_i += 1
        elif ch == 'r':
            put('object', x, y, COLUMNS_[col_i % 3])
            col_i += 1
        elif ch == 'c':                       # 발광 이끼 무더기
            put('object', x, y, MOULD[(x + y) % 2])

# 화로 — 조명이 남하할수록 잦아들고, 아레나엔 관문 쪽 한 쌍뿐(안쪽은 촛불 벽감뿐).
# (20,27)은 꿀꿀이 5x5 개방 구역이라 동쪽 화로는 (24,27)로 물린다.
for i, (x, y) in enumerate(((1, 8), (1, 13), (13, 5), (19, 5), (19, 11),
                            (14, 19), (14, 27), (24, 27))):
    put('object', x, y, BRAZIER[i % 2])

# ---------------------------------------------------------------- shadow_lower
# DCSS 벽 그림자: 북/서에 벽이 있는 바닥에 그림자 — 벽이 즉시 입체로 읽힌다
for y in range(H):
    for x in range(W):
        if not is_floor(x, y):
            continue
        n, w_ = is_wall(x, y - 1), is_wall(x - 1, y)
        if n and w_:
            put('shadow_lower', x, y, SHADOW_NW)
        elif n:
            put('shadow_lower', x, y, SHADOW_NE if is_wall(x + 1, y) else SHADOW_N)
        elif w_:
            put('shadow_lower', x, y, SHADOW_W)

# 호수 물가 — 바닥과 닿는 면에 탁한 물결 가장자리
for y in range(H):
    for x in range(W):
        if at(x, y) not in VOID_CHARS:
            continue
        n, s = is_floor(x, y - 1), is_floor(x, y + 1)
        w_, e = is_floor(x - 1, y), is_floor(x + 1, y)
        gid = 0
        if n and w_:
            gid = BORD['tl']
        elif n and e:
            gid = BORD['tr']
        elif s and w_:
            gid = BORD['bl']
        elif s and e:
            gid = BORD['br']
        elif n:
            gid = BORD['top']
        elif s:
            gid = BORD['btm']
        elif w_:
            gid = BORD['lft']
        elif e:
            gid = BORD['rgt']
        if gid:
            put('shadow_lower', x, y, gid)

# 슬라임 자국 — 굴에서 제단까지 기어 내려온 흔적
for x, y, d in ((16, 3, 's'), (16, 4, 's'), (15, 4, 'e'), (17, 4, 'w'),
                (14, 6, 'ne'), (18, 6, 'nw'), (14, 10, 'se'), (18, 10, 'sw')):
    if is_floor(x, y):
        put('shadow_lower', x, y, SLIME_OV[d])

# 아치 문턱 어둠(문턱 앞칸 바닥) + 통과하는 순간 플레이어까지 어두워지는 한 줄
for x in (16, 17, 18):
    put('shadow_lower', x, 24, SHADE)
    put('shadow_upper', x, 26, SHADE)
put('shadow_lower', 16, 3, VIGNETTE)   # 굴 아가리 밑 비네트

# 최종 아레나 남단이 어둠에 잠긴다
for x in range(11, 31):
    if is_floor(x, 32) and not L['shadow_lower'][32 * W + x]:
        put('shadow_lower', x, 32, SHADE)

# ---------------------------------------------------------------- deco: 거미줄
# 벽 모서리에 걸린 거미줄 — 플레이어 위로 드리운다
for x, y, d in ((11, 27, 'nw'), (30, 27, 'ne'), (10, 3, 'nw'), (23, 3, 'ne'),
                (11, 32, 'sw'), (30, 32, 'se')):
    if is_floor(x, y):
        put('deco', x, y, WEB[d])

# ---------------------------------------------------------------- 검증
walls = {(i % W, i // W) for i, g in enumerate(L['object']) if g}
start = (2, 10)
seen = {start}
q = deque([start])
while q:
    x, y = q.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nb = (x + dx, y + dy)
        if 0 <= nb[0] < W and 0 <= nb[1] < H and nb not in seen and nb not in walls:
            seen.add(nb)
            q.append(nb)

CHECK = [('진입스폰', (2, 10)), ('에디터스폰(맵중앙)', (17, 17)),
         ('귀환포탈상', (0, 10)), ('귀환포탈하', (0, 11)),
         ('말캉이-보스', (16, 8)), ('꿀꿀이-보스', (21, 29)),
         ('둑길중앙', (17, 21)), ('아치통로', (17, 25)), ('아치통로2', (17, 26)),
         ('앞마당서', (13, 24)), ('앞마당동', (26, 24)),
         ('수정골방', (28, 4)), ('현관', (1, 9))]
problems = []
for name, pt in CHECK:
    if pt in walls:
        problems.append(f'{name}{pt} 벽/오브젝트에 막힘')
    elif pt not in seen:
        problems.append(f'{name}{pt} 도달 불가')

for name, (bx, by) in (('말캉이', (16, 8)), ('꿀꿀이', (21, 29))):
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            if (bx + dx, by + dy) in walls:
                problems.append(f'{name} 5x5 개방 위반: ({bx + dx},{by + dy})')

for x in range(W):
    for y in (0, H - 1):
        if (x, y) not in walls:
            problems.append(f'외곽 개방: ({x},{y})')
for y in range(H):
    for x in (0, W - 1):
        if (x, y) not in walls and (x, y) not in ((0, 10), (0, 11)):
            problems.append(f'외곽 개방: ({x},{y})')

MAX_GID = 712
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
print('검증 통과: 스폰/포탈/두 보스/둑길/아치 모두 도달 가능, 보스 5x5 개방, 외곽 밀폐')

# ---------------------------------------------------------------- TMX 출력
src = open(SRC).read()
head = src[:src.index(' <layer ')]
tail = src[src.index(' <objectgroup '):]
head = re.sub(r'nextlayerid="\d+"',
              f'nextlayerid="{FIRST_LAYER_ID + len(LAYER_NAMES)}"', head)

# 보스/포탈 좌표 — 캐릭터는 x=칸중심(tx*32+16), y=바닥선(ty*32+32)
MOVES = {
    '꿀꿀이-보스': (21 * 32 + 16, 29 * 32 + 32),   # 혈흔 무대 정중앙
    '말캉이-보스': (16 * 32 + 16, 8 * 32 + 32),    # 석회암 제단 위
}
for nm, (px, py) in MOVES.items():
    tail = re.sub(rf'(<object id="\d+" name="{nm}" type="character") x="[\d.]+" y="[\d.]+"',
                  rf'\1 x="{px}" y="{py}"', tail)
tail = re.sub(r'(<object id="\d+" name="return_gate" type="portal") x="[\d.]+" y="[\d.]+"',
              r'\1 x="0" y="320"', tail)

parts = []
for i, name in enumerate(LAYER_NAMES, start=FIRST_LAYER_ID):
    rows = ',\n'.join(','.join(str(v) for v in L[name][y * W:(y + 1) * W]) for y in range(H))
    parts.append(f' <layer id="{i}" name="{name}" width="{W}" height="{H}">\n'
                 f'  <data encoding="csv">\n{rows}\n</data>\n </layer>\n')
open(SRC, 'w').write(head + ''.join(parts) + tail)
print('wrote', SRC)
