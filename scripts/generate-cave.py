"""동굴(cave.tmx) 보스 소굴 생성기 — LPC 타일 기반.

디자인: "The Sundered Foundry" 지형(심사 패널 우승안)은 그대로, 타일 어휘를
DCSS에서 LPC(OpenGameArt, town-32와 같은 부드러운 32px 계열)로 교체했다.
타일은 scripts/append-cave-tiles.py가 town-32 시트에 덧붙인 cave_* 타일을
쓴다(gid 매핑: scripts/lpc-cave-gids.json).

  서쪽 이끼 현관 → 협곡 핀치 → 문지기(말캉이) 굴 앞 제단 → 수정 골방(보상)
  → 전망대 허브 → 심연 호수 위 석회암 둑길 → 황금 기둥 관문 → 최종 아레나
  (꿀꿀이) — 황금 제단과 금화 더미가 그의 전리품이다.

자연스러운 경계가 핵심이다: 재질을 칸이 아니라 코너 격자(35x35)에 얹고,
각 칸은 네 코너의 재질 조합으로 LPC 전환 타일을 고른다(사냥터의 잔디↔흙
경계와 같은 유기적 디더 경계가 벽↔바닥을 포함한 모든 재질 경계에 생긴다).
벽은 ground 레이어에 평면 암반 덩어리로 그리고, 충돌은 object 레이어의
투명 블록(INVISIBLE_BLOCK)이 담당한다.

town.tmx 레이어 규약(ground/shadow_lower/object/shadow_upper/object_upper/
deco/roof)을 따른다. object = 충돌 + 캐릭터와 y-정렬.

이 씬은 sceneIntro '동굴' 문자열로 보스 씬 판정되어 몬스터가 2배 스케일로
렌더된다 — 모든 동선은 3폭 이상, 두 보스 주변 5x5는 완전 개방을 보장한다.
objectgroup은 보존하되 보스/포탈 좌표만 갱신한다(테스트는 x/y를 단언 안 함).
"""
import json
import random
import re
from collections import deque

SRC = 'src/games/my-sample-rpg/assets/maps/cave.tmx'
GIDS_PATH = 'scripts/lpc-cave-gids.json'
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

G = json.load(open(GIDS_PATH, encoding='utf-8'))   # cave_* 이름 → gid

# ---- 재질(=LPC 지형 이름). 코너 동률은 뒤쪽(높은 우선순위)이 이긴다 ----
DB, DT, GD, MB, GV = 'Dirt_Brown', 'Dirt_Tan', 'Grass_Dark', 'Mud_Brown', 'Gravel_1'
ST, SW, MBr, MG = 'Stone_Tan', 'Stone_White', 'Mudstone_Brown', 'Mudstone_Gray'
WT, WD, HB = 'Water', 'Water_Deep', 'Hole_Black'
RG, RD, RB = 'Rock_Gray', 'Rock_Dark', 'Rock_Black'
PRIORITY = [DB, DT, GD, MB, GV, ST, SW, MBr, MG, WT, WD, HB, RG, RD, RB]
PRI = {m: i for i, m in enumerate(PRIORITY)}
WALLS_M = {RG, RD, RB}
# 코너 조합이 벤더에 없을 때의 강등 사슬 — 끝은 어디와도 어울리는 DB/RB
FALLBACK = {SW: DT, ST: DT, MBr: MG, MG: DT, GD: DB, MB: DB, GV: DB,
            DT: DB, WD: WT, WT: DB, HB: RB, RG: RB, RD: RB}

INVISIBLE_BLOCK = 302   # 완전 투명 타일 — 보이지 않는 충돌만 남긴다
SHADE = 64              # town-32의 반투명 어둠
ROCK_PILE = [527, 528]  # town-32 기본 바위 더미 — 사냥터와 같은 소품
# (예전 CRYSTAL_TOWN=494 는 수정이 아니라 연파랑 꽃덤불 그림이었다 — LPC 수정 소품으로 바꿨다)
CRYSTALS = ('cave_prop_crystal_a', 'cave_prop_crystal_c')
# 잔해 데칼 중 01/03/04/05 는 불투명한 네모 바탕이 있어 바닥에 검은 사각 얼룩으로 보인다
RUBBLE_OK = ('cave_prop_rubble_00', 'cave_prop_rubble_02')

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


# ---------------------------------------------------------------- 칸 재질 결정
MAT = [[None] * W for _ in range(H)]
for y in range(H):
    for x in range(W):
        ch = at(x, y)
        z = zone(x, y)
        if ch in '#%':
            m = RB   # 아레나 벽은 아래서 바닥 근처 두 겹만 잿빛(RD)으로 바꾼다
        elif ch == '~':
            m = WT                      # 깊이는 아래서 다시 나눈다
        elif ch in 's1':
            m = SW if y >= 20 else ST   # 둑길 스판은 흰 석회암, 제단은 황갈 석판
        elif ch == 'b':
            m = DB if y <= 24 else MG   # 호숫가 문턱은 흙, 아레나 앞마당은 잿빛 돌
        elif ch == 'g':
            m = MG
        elif ch in 'm2':
            m = MBr
        elif ch == ',':
            m = DT   # 현관/제단 둘레: 예전 짙은 이끼(GD)는 초록 웅덩이처럼 보였다
        elif z == 'arena':
            m = MG
        elif z == 'grotto':
            m = GV
        else:
            m = DB
        MAT[y][x] = m

# 관문 좌우 벽(x14-20, y24-27)은 아레나 존이라도 검은 암반으로 — 통로 바닥(MG)과
# 잿빛 벽(RD)이 코너에서 섞이는 것을 줄여 관문이 어두운 목구멍처럼 읽힌다
for y in range(24, 28):
    for x in range(14, 21):
        if is_wall(x, y):
            MAT[y][x] = RB

# 아레나 벽은 바닥에 면한 두 겹만 잿빛 암반 — 예전엔 아레나 존의 벽 전체가 잿빛이라
# 맵 바깥 빈 암반이 보라빛 큰 석판처럼 떠 보였다.
# (그로토 벽을 밝은 회색으로 바꾸던 처리는 뺐다 — 어둠 속에 회색 바위 띠가 떠 보였다)
# 잿빛 테두리도 RD↔RB 경계가 어둠 속 선으로 떠 보여 끈다 — 아레나 벽도 검은 암반.
USE_ARENA_RIM = False
arena_floor = [(x, y) for y in range(H) for x in range(W)
               if zone(x, y) == 'arena' and is_floor(x, y)]
for y in range(H):
    for x in range(W):
        if USE_ARENA_RIM and MAT[y][x] == RB and zone(x, y) == 'arena' \
                and not (14 <= x <= 20 and 24 <= y <= 27) \
                and any(abs(x - fx) <= 2 and abs(y - fy) <= 2 for fx, fy in arena_floor):
            MAT[y][x] = RD

# 말캉이 서식 고리 — 제단 석판 둘레 두 겹은 늪으로(슬라임이 헤집은 땅).
# 중앙 회랑의 이끼(,)가 통째로 초록 슬래브로 읽히는 것도 이 늪이 끊어준다
for y in range(5, 12):
    for x in range(13, 20):
        if not (15 <= x <= 17 and 7 <= y <= 9) and is_floor(x, y):
            MAT[y][x] = MB

# 굴 아가리: 벽 속의 검은 구멍(HB↔RB 유기 전환). 그로토 쪽 굴은 주변 벽을
# 검은 암반으로 바꿔 HB와 어울리게 한다
MAT[2][16] = HB
for yy in range(1, 4):
    for xx in range(28, 31):
        MAT[yy][xx] = RB
MAT[2][29] = HB

# 심연 호수 깊이: 물가에서 두 칸 이상 떨어진 물은 짙은 심연.
# 벽에 붙은 물가는 흙 비탈로 — 암반↔물 직접 전환 타일이 없기도 하지만,
# 가파른 흙 둔덕이 호숫가답기도 하다(충돌은 그대로 물이다).
for y in range(H):
    for x in range(W):
        if at(x, y) != '~':
            continue
        if any(is_wall(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
            MAT[y][x] = DB
        elif all(at(x + dx, y + dy) == '~' and MAT[y + dy][x + dx] != DB
                 for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx, dy) != (0, 0)):
            MAT[y][x] = WD

# (본굴 바닥 이끼 얼룩은 뺐다 — 짙은 초록 덩어리가 물웅덩이처럼 읽혔다)

# 벽 앞치마: 벽 재질과 전환 타일이 없는 바닥 재질이 벽에 닿으면 그 존의
# 기본 흙/돌로 바꾼다 — 암반은 맨땅과 만나는 게 자연스럽기도 하다
VENDORED_WALL_PAIRS = {(RB, DB), (RB, DT), (RB, GV), (RB, HB), (RB, RD), (RB, RG),
                       (RD, DB), (RD, MG), (RD, RG), (RG, DB), (RG, GV)}
for y in range(H):
    for x in range(W):
        m = MAT[y][x]
        if m in WALLS_M or m == HB:
            continue
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nm = MAT[y + dy][x + dx] if 0 <= x + dx < W and 0 <= y + dy < H else RB
                if nm in WALLS_M and (nm, m) not in VENDORED_WALL_PAIRS:
                    MAT[y][x] = MG if zone(x, y) == 'arena' else DB
                    break
            else:
                continue
            break

# ---------------------------------------------------------------- 코너 격자
def corner_mat(cx, cy):
    """코너 (cx,cy)에 닿는 최대 4칸의 다수결 재질(동률은 우선순위)."""
    votes = {}
    for dx, dy in ((-1, -1), (0, -1), (-1, 0), (0, 0)):
        x, y = cx + dx, cy + dy
        m = MAT[y][x] if 0 <= x < W and 0 <= y < H else RB
        votes[m] = votes.get(m, 0) + 1
    return max(votes, key=lambda m: (votes[m], PRI[m]))


LAT = [[corner_mat(cx, cy) for cx in range(W + 1)] for cy in range(H + 1)]


def combo_legal(tl, tr, bl, br):
    """네 코너 재질 조합에 벤더 타일이 있는가(난수 없음 — 합법화 판정용)."""
    mats = {tl, tr, bl, br}
    if len(mats) == 1:
        return f'cave_fill_{tl}_00' in G
    if len(mats) == 2:
        a, b = sorted(mats, key=lambda m: PRI[m])
        mask = sum(1 << i for i, c in enumerate((tl, tr, bl, br)) if c == b)
        return f'cave_edge_{a}__{b}_m{mask:02d}' in G
    return False


def combo_name(tl, tr, bl, br):
    """네 코너 재질 → 벤더 타일 이름(변형은 난수로 선택)."""
    mats = {tl, tr, bl, br}
    if len(mats) == 1:
        # 변형 1은 큰 싱크홀 무늬라 얼룩처럼 보인다 — 밋밋한 0과 잔무늬 2,3만 쓴다
        variants = [k for k in (f'cave_fill_{tl}_{i:02d}' for i in (0, 2, 3)) if k in G]
        weights = [8] + [1] * (len(variants) - 1)
        return rnd.choices(variants, weights=weights)[0]
    a, b = sorted(mats, key=lambda m: PRI[m])
    mask = sum(1 << i for i, c in enumerate((tl, tr, bl, br)) if c == b)
    base = f'cave_edge_{a}__{b}_m{mask:02d}'
    if f'{base}_v1' in G and rnd.random() < 0.5:
        return f'{base}_v1'
    return base


# 합법화: 조합이 벤더에 없으면 폴백 가능한 최고 우선순위 코너를 강등한다.
# 코너는 이웃 타일과 공유되므로 전역 고정점까지 반복한다.
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

# ---------------------------------------------------------------- ground
for y in range(H):
    for x in range(W):
        name = combo_name(LAT[y][x], LAT[y][x + 1], LAT[y + 1][x], LAT[y + 1][x + 1])
        put('ground', x, y, G[name])

# ---------------------------------------------------------------- object: 충돌
# 벽은 ground에 그렸으므로 충돌은 전부 투명 블록. 물도 빠질 수 없는 심연이다 —
# 이걸 막지 않으면 석회암 둑길도, 그 끝의 관문도 의미가 없어진다.
# 단, 물 칸이라도 전환 타일 그림이 거의 흙(네 코너 중 물/암반이 1개 이하)이면 막지
# 않는다 — 흙으로 보이는데 못 지나가는 '투명 벽'이 생기지 않게.
SOLID_M = WALLS_M | {WT, WD, HB}
for y in range(H):
    for x in range(W):
        if is_wall(x, y):
            put('object', x, y, INVISIBLE_BLOCK)
        elif at(x, y) in VOID_CHARS:
            solid = sum(LAT[cy][cx] in SOLID_M for cy, cx in ((y, x), (y, x + 1), (y + 1, x), (y + 1, x + 1)))
            # 바닥에 닿지 않는 흙 칸(호수 양끝 등)은 갈 수 없는 고립 칸이 되므로 그대로 막는다
            touches_floor = any(is_floor(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if solid >= 2 or not touches_floor:
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


put('object', 16, 5, G['cave_prop_cauldron_goo'])    # 문지기의 점액 솥
stamp('altar_gold', 25, 30, 3, 2, solid_rows=2)      # 꿀꿀이의 황금 제단(전리품)
stamp('statue_hood', 12, 29, 1, 2)                   # 잊힌 수도승 석상
# 오벨리스크는 (26,3)으로 — 원래 자리(28,5)는 골방으로 드는 유일한 한 칸 길목을
# 막아 진입이 픽셀 단위로 빡빡했고, (26,3)은 영영 닿을 수 없던 빈 칸이라
# 소품으로 메우면 유령 공간도 같이 사라진다.
stamp('obelisk', 26, 3, 1, 2)                        # 수정 골방의 오벨리스크
stamp('skull_pile', 26, 28, 2, 1)                    # 최종 아레나의 해골 무더기
stamp('crystal_tall', 27, 3, 1, 2)                   # 골방 어귀의 장신 수정 기둥

# 수정 군집 — 골방(그로토)에 town 수정과 LPC 수정을 섞어 광맥처럼
for x, y, g in ((26, 4, G[CRYSTALS[1]]), (30, 4, G['cave_prop_crystal_a']),
                (29, 6, G[CRYSTALS[0]]), (26, 7, G['cave_prop_crystal_c'])):
    if is_floor(x, y):
        put('object', x, y, g)

# 금화 더미 — 황금 제단 둘레(밟고 지나갈 수 있는 데칼)
for x, y, i in ((24, 30, 0), (27, 31, 1), (24, 31, 2), (28, 30, 3)):
    put('shadow_lower', x, y, G[f'cave_prop_gold_{i:02d}'])

col_i = 0
for y in range(H):
    for x in range(W):
        ch = at(x, y)
        if ch == 'B':                         # 무너진 바위 — 돌진 회피 엄폐물
            put('object', x, y, G['cave_prop_boulder'])
        elif ch == 'r':                       # 잔해 — 사냥터와 같은 바위 더미
            put('object', x, y, ROCK_PILE[col_i % 2])
            col_i += 1
        elif ch == 'c':                       # 발광 식물(그로토는 수정)
            if zone(x, y) == 'grotto':
                put('object', x, y, G[CRYSTALS[(x + y) % 2]])
            else:
                put('object', x, y, G['cave_prop_glow_plant_a' if (x + y) % 2 else 'cave_prop_glow_plant_b'])

# 화로 — 조명이 남하할수록 잦아들고, 아레나엔 관문 쪽 한 쌍뿐.
for i, (x, y) in enumerate(((1, 8), (1, 13), (13, 5), (19, 5), (19, 11),
                            (14, 19), (14, 27), (24, 27))):
    put('object', x, y, G[f'cave_prop_brazier_{i % 2:02d}'])

# 관문 — 황금 기둥 한 쌍이 통로를 지킨다(벽 위에 3단 기둥, 위 두 단은
# 캐릭터 위에 그려져 문틀처럼 읽힌다)
for gx in (15, 19):
    put('object', gx, 26, G['cave_prop_pillar_gold_r2c0'])
    put('object_upper', gx, 25, G['cave_prop_pillar_gold_r1c0'])
    put('object_upper', gx, 24, G['cave_prop_pillar_gold_r0c0'])

# ---------------------------------------------------------------- shadow_lower
# 벽 그림자: 북/서에 벽이 있는 바닥에 부드러운 그림자 — 벽이 즉시 입체로 읽힌다
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

# 잔해 링 데칼 — 흙바닥/자갈밭에 드문드문(길과 무대는 피한다)
for y in range(H):
    for x in range(W):
        if not is_floor(x, y) or at(x, y) not in '.c':
            continue
        m = MAT[y][x]
        if m == DB and rnd.random() < 0.05 or m == GV and rnd.random() < 0.08:
            if not L['shadow_lower'][y * W + x]:
                put('shadow_lower', x, y, G[rnd.choice(RUBBLE_OK)])

# 점액 자국 — 굴에서 솥까지 기어 내려온 흔적
for x, y in ((16, 3), (16, 4), (15, 6), (17, 10)):
    if is_floor(x, y) and not L['shadow_lower'][y * W + x]:
        put('shadow_lower', x, y, G['cave_prop_goo_puddle'])

# 아레나의 유골 — 수없이 쓰러진 도전자들
for x, y, k in ((13, 28, 'skull'), (23, 31, 'bone_scatter'), (28, 28, 'bone_scatter'),
                (17, 30, 'skull'), (12, 31, 'bone_scatter')):
    if is_floor(x, y) and not L['shadow_lower'][y * W + x]:
        put('shadow_lower', x, y, G[f'cave_prop_{k}'])

# (관문 문턱에 반투명 검은 칸을 깔던 처리는 뺐다 — 네모 덮개처럼 보였다)

# 최종 아레나 남단이 어둠에 잠긴다
for x in range(11, 31):
    if is_floor(x, 32) and not L['shadow_lower'][32 * W + x]:
        put('shadow_lower', x, 32, SHADE)

# ---------------------------------------------------------------- deco: 거미줄
# 벽 모서리에 걸린 거미줄 — 플레이어 위로 드리운다
for x, y, d in ((11, 27, 'nw'), (30, 27, 'ne'), (10, 3, 'nw'), (23, 3, 'ne'),
                (11, 32, 'sw'), (30, 32, 'se')):
    if is_floor(x, y):
        put('deco', x, y, G[f'cave_prop_web_{d}'])

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
         ('둑길중앙', (17, 21)), ('관문통로', (17, 25)), ('관문통로2', (17, 26)),
         ('앞마당서', (13, 24)), ('앞마당동', (26, 24)),
         ('수정골방', (28, 4)), ('현관', (1, 9)),
         ('수정골방-포탈앞', (29, 3)), ('수정골방-어귀', (28, 5))]
problems = []
for name, pt in CHECK:
    if pt in walls:
        problems.append(f'{name}{pt} 벽/오브젝트에 막힘')
    elif pt not in seen:
        problems.append(f'{name}{pt} 도달 불가')

# 둑길을 치우면 아레나가 끊겨야 한다 — 호수가 실제로 길을 막는지 반증으로 확인
detour = {(x, y) for y in range(H) for x in range(W)
          if at(x, y) not in VOID_CHARS and (x, y) not in walls
          and not (16 <= x <= 18 and 20 <= y <= 23)}
reach = {(2, 10)} & detour
dq = deque(reach)
while dq:
    x, y = dq.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nb = (x + dx, y + dy)
        if nb in detour and nb not in reach:
            reach.add(nb)
            dq.append(nb)
if (21, 29) in reach:
    problems.append('둑길 없이도 최종 아레나에 도달 — 호수가 길을 막지 못한다')

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

MAX_GID = max(max(G.values()), SHADE, INVISIBLE_BLOCK, *ROCK_PILE)
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
print('검증 통과: 스폰/포탈/두 보스/둑길/관문 모두 도달 가능, 보스 5x5 개방, 외곽 밀폐')

# ---------------------------------------------------------------- TMX 출력
src = open(SRC, encoding='utf-8').read()
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
open(SRC, 'w', encoding='utf-8', newline='\n').write(head + ''.join(parts) + tail)
print('wrote', SRC)
