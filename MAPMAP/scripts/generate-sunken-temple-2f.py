"""2장 '물밑 신전 2층 — 봉인의 방'(sunken-temple-2f, 30x30) 생성기 — c2-08 봉인의 방(q024)·늪의 사제(q025).

이야기(docs/chapter2-sunken-forest.md): 신전 맨 위 봉인의 방. 황금 제단 앞에서 어두운 기운에 삼켜진 늪의 사제가
종을 울려 봉인을 깨 왔다. 방 네 귀퉁이에는 물이 고였고, 기둥이 둥글게 제단을 두른다.

  남쪽 계단(1층) ─ 기둥 고리 ─ 제단 앞 늪의 사제(최종 보스)

보스 하수인(물에 빠진 자)은 '늪의 사제-소환-N' 으로 제단 곁에 두지만 씬이 시작될 때는 쓰러진 상태다 —
사제가 소환 기술로 곁에 불러낸다(bossSkills.ts). 보스방 한가운데는 넓게 비워 물기둥을 피할 자리를 둔다.
"""
import math
import sys

sys.path.insert(0, 'scripts')
from swamp_mapkit import character, monster, portal  # noqa: E402
from temple_mapkit import TempleMap, lpc  # noqa: E402

W, H = 30, 30
OUT = 'src/games/my-sample-rpg/assets/maps/sunken-temple-2f.tmx'
ARRIVAL = (14, 25)                       # 1층 계단에서 올라와 서는 칸
DOWN_STAIRS = (14, 27, 2, 1)             # 1층으로 내려가는 계단
TEMPLE_1F_SPAWN = (19, 5)                # 1층 위층 계단 앞(돌문이 있던 자리 아래)
PRIEST = (14, 10)
ALTAR = (13, 7)                          # 황금 제단 3x2 의 왼쪽 아래 칸
MINIONS = [(11, 9), (18, 9), (10, 12), (19, 12)]

m = TempleMap(W, H, seed=20261010)
# ---------------------------------------------------------------- 방
m.carve(14, 26, 15, 27)                  # 계단참
m.carve_ellipse(15.0, 15.0, 11.5, 11.0)  # 봉인의 방(둥근 방)
# 방 양옆 물웅덩이 — 방이 가장 넓은 높이에 둔다. 둑과 벽 사이에 돌바닥을 두 칸 넘게 두어야 한다
# (둥근 방의 계단 모양 벽에 가까우면 꼭짓점 강등이 벽 둘레로 번진다 — temple_mapkit 이 검사).
for cx, cy in ((9.0, 15.5), (21.0, 15.5)):
    m.carve_ellipse(cx, cy, 1.6, 1.6, '~')
m.build()

m.reserved |= {(x, y) for y in range(H) for x in range(W) if m.at(x, y) == '#'}
m.reserved |= {(x, y) for x in range(12, 18) for y in range(8, 24)}      # 가운데 싸움터와 계단 길
# 기둥 고리(제단을 두른다), 남쪽은 계단 길을 비운다
for i in range(10):
    a = math.pi * 2 * i / 10 + math.pi / 10
    x, y = round(15 + math.cos(a) * 8.6), round(15.5 + math.sin(a) * 8.0)
    if (abs(x - 14.5) < 3 and y > 18) or (abs(x - 14.5) < 4 and y < 10):   # 계단 길·제단 자리는 비운다
        continue
    if m.at(x, y) == '.' and m.at(x, y - 1) == '.' and m.at(x, y - 2) == '.':
        m.prop('pillar_gold', x, y, rows=3)
m.prop('altar_gold', ALTAR[0], ALTAR[1], cols=3, rows=2)
for (x, y) in [(11, 7), (17, 7)]:
    m.prop('brazier_00', x, y)
for (x, y) in [(13, 13), (16, 13), (14, 16), (15, 10)]:
    m.decal('cave_prop_pentagram', x, y)
for (x, y) in [(9, 17), (21, 16), (12, 21), (18, 20), (8, 11), (22, 11)]:
    m.decal('cave_prop_skull' if (x + y) % 2 else 'cave_prop_bone_scatter', x, y)
for (x, y) in [(10, 19), (20, 19), (15, 21)]:
    m.decal('cave_prop_goo_puddle', x, y)
for (x, y) in [(4, 10), (26, 10)]:
    m.decal('cave_prop_glow_plant_b', x, y)
m.set('deco', 7, 5, lpc('cave_prop_web_nw'))
m.set('deco', 23, 5, lpc('cave_prop_web_ne'))

m.seal_unreachable(ARRIVAL)
if '--ascii' in sys.argv:
    m.ascii()
m.validate(ARRIVAL, [('도착 칸', ARRIVAL), ('계단', (DOWN_STAIRS[0], DOWN_STAIRS[1])), ('늪의 사제', PRIEST)] +
           [(f'하수인 {i}', p) for i, p in enumerate(MINIONS)])

# ---------------------------------------------------------------- TMX 출력
chars = [monster(1, '늪의 사제-보스', PRIEST[0], PRIEST[1], 'monster_swamp_priest', 30)] + [
    character(2 + i, f'늪의 사제-소환-{i + 1}', x, y, [
        ('blocksMovement', 'bool', 'true'), ('displayText', '', '물에 빠진 자'), ('monster.level', 'int', 28),
        ('type', '', 'monster_drowned')])
    for i, (x, y) in enumerate(MINIONS)
]
portals = [
    portal(20, 'lower_stairs', *DOWN_STAIRS, [
        ('appearanceType', '', 'stairs_stone_step_base_00'), ('targetFacing', '', 'down'),
        ('targetSceneId', '', 'sunken-temple-1f'),
        ('targetSpawnTileX', 'int', TEMPLE_1F_SPAWN[0]), ('targetSpawnTileY', 'int', TEMPLE_1F_SPAWN[1])]),
]
m.write_tmx(OUT, 'scripts/generate-sunken-temple-2f.py', chars,
            '늪의 사제-보스(Lv30, 2장 최종 보스) / 소환 하수인 물에 빠진 자 4(Lv28, 처음엔 쓰러진 채 — 사제가 불러낸다)',
            portals, f'남쪽 계단 → 1층 {TEMPLE_1F_SPAWN}.', next_object_id=30)
