"""2장 '물밑 신전 1층'(sunken-temple-1f, 40x40) 생성기 — c2-07 남은 두 봉인(q023)의 무대.

이야기(docs/chapter2-sunken-forest.md): 땅속으로 가라앉은 신전. 물이 스며든 회랑 양쪽으로 봉인의 방이 하나씩
있고, 물에 빠져 죽은 자들과 이끼 골렘이 비석을 지킨다. 북쪽 계단은 2층 봉인의 방으로 이어지지만 두 비석을
밝히기 전까지 옛 글자의 돌문이 막는다.

            북쪽 전실(2층 계단, 돌문 — q023 후 열림)
                       │
  서쪽 봉인의 방 ── 물이 찬 회랑 ── 동쪽 봉인의 방
  (두 번째 비석)         │          (세 번째 비석)
                    남쪽 입구 전실(신전 외곽으로 올라가는 계단)
"""
import sys

sys.path.insert(0, 'scripts')
from swamp_mapkit import INVISIBLE_BLOCK, character, monster, portal  # noqa: E402
from temple_mapkit import TempleMap, lpc, stele_objects  # noqa: E402

W, H = 40, 40
OUT = 'src/games/my-sample-rpg/assets/maps/sunken-temple-1f.tmx'
ARRIVAL = (19, 35)                       # 신전 외곽 계단에서 내려와 서는 칸
EXIT_STAIRS = (19, 37, 2, 1)             # 신전 외곽으로 올라가는 계단(왼쪽 위, 너비, 높이)
OUTSKIRTS_SPAWN = (38, 8)                # 신전 외곽 계단 앞
UP_STAIRS = (19, 3, 2, 1)                # 2층 봉인의 방으로(q023 후)
TEMPLE_2F_SPAWN = (14, 25)
DOOR_SEAL = [(19, 4), (20, 4)]
STELE_2 = (5, 10)                        # 서쪽 봉인의 방 비석 2x2 왼쪽 위
STELE_3 = (33, 10)                       # 동쪽 봉인의 방 비석 2x2 왼쪽 위
MONSTERS = [
    # 물에 빠진 자 — 회랑과 서쪽 방
    ('물에 빠진 자-1', 'monster_drowned', 27, (19, 21)),
    ('물에 빠진 자-2', 'monster_drowned', 27, (20, 15)),
    ('물에 빠진 자-3', 'monster_drowned', 28, (4, 15)),
    ('물에 빠진 자-4', 'monster_drowned', 28, (8, 17)),
    ('물에 빠진 자-5', 'monster_drowned', 28, (7, 13)),
    ('물에 빠진 자-6', 'monster_drowned', 28, (36, 16)),
    # 이끼 골렘 — 동쪽 방 비석 수호자
    ('이끼 골렘-1', 'monster_moss_golem', 28, (32, 14)),
    ('이끼 골렘-2', 'monster_moss_golem', 29, (36, 13)),
    # 유적 해골병 — 입구 전실
    ('유적 해골병-1', 'monster_skeleton', 27, (15, 32)),
    ('유적 해골병-2', 'monster_skeleton', 27, (24, 33)),
]

m = TempleMap(W, H, seed=20261009)
# ---------------------------------------------------------------- 방 · 복도
m.carve(14, 29, 25, 36)                  # 남쪽 입구 전실
m.carve(19, 37, 20, 37)                  # 올라가는 계단 자리
m.carve(18, 25, 21, 29)                  # 회랑으로 가는 복도
m.carve(11, 11, 28, 25)                  # 물이 찬 회랑
# 회랑 양쪽 물길(기둥 사이로 물이 찬다). 둑과 벽 사이에 돌바닥을 두 칸 이상 둔다 — 한 칸이면 꼭짓점에서
# 흙과 벽이 맞닿아 벽 둘레 전체가 흙띠로 강등된다(temple_mapkit 이 검사한다).
for x0, x1 in ((14, 15), (24, 25)):
    m.carve(x0, 14, x1, 22, '~')
m.carve(2, 8, 10, 20)                    # 서쪽 봉인의 방
m.carve(8, 16, 11, 18)                   # 서쪽 방 ↔ 회랑
m.carve(5, 16, 6, 17, '~')               # 서쪽 방 웅덩이
m.carve(29, 8, 37, 20)                   # 동쪽 봉인의 방
m.carve(28, 16, 31, 18)                  # 회랑 ↔ 동쪽 방
m.carve(33, 16, 34, 17, '~')             # 동쪽 방 웅덩이
m.carve(18, 9, 21, 11)                   # 회랑 → 북쪽 전실
m.carve(14, 3, 25, 9)                    # 북쪽 전실
m.build()

# ---------------------------------------------------------------- 소품
m.reserved |= {(x, y) for y in range(H) for x in range(W) if m.at(x, y) == '#'}
m.reserved |= {(x, y) for x in range(18, 22) for y in range(3, 8)}       # 2층 계단 앞
m.reserved |= {(x, y) for x in range(18, 22) for y in range(33, 38)}     # 입구 계단 앞
for (x, y) in [(15, 30), (24, 30), (15, 35), (24, 35)]:                   # 입구 전실 네 귀 기둥
    m.prop('pillar_gold', x, y, rows=3)
for (x, y) in [(16, 5), (23, 5)]:                                         # 2층 계단을 지키는 가고일
    m.prop('gargoyle', x, y, cols=2, rows=2)
for (x, y) in [(15, 8), (24, 8)]:
    m.prop('statue_hood', x, y, rows=2)
for x in (16, 23):                                                        # 회랑 물길 사이 기둥
    for y in (13, 18, 23):
        m.prop('pillar_gold', x, y, rows=3)
# 봉인 비석 자리(아랫줄 충돌) 둘레 장식
for sx, sy in (STELE_2, STELE_3):
    for c in range(2):
        m.set('object', sx + c, sy + 1, INVISIBLE_BLOCK)
        m.reserved |= {(sx + c, sy), (sx + c, sy + 1)}
    m.prop('brazier_00', sx - 1, sy + 1)
    m.prop('brazier_00', sx + 2, sy + 1)
    m.decal('cave_prop_pentagram', sx, sy + 3)
for (x, y, name) in [(2, 8, 'web_nw'), (10, 8, 'web_ne'), (29, 8, 'web_nw'), (37, 8, 'web_ne'), (14, 3, 'web_nw'),
                     (25, 3, 'web_ne')]:              # 방 위쪽 모서리 거미줄
    m.set('deco', x, y, lpc(f'cave_prop_{name}'))
for (x, y) in [(9, 12), (30, 19), (17, 34), (22, 31), (12, 24), (27, 12)]:
    m.decal('cave_prop_skull' if (x + y) % 2 else 'cave_prop_bone_scatter', x, y)
for (x, y) in [(21, 27), (19, 12), (6, 18), (31, 12)]:
    m.decal('cave_prop_goo_puddle', x, y)
for (x, y) in [(5, 19), (34, 19), (11, 12), (28, 24)]:   # 물가의 빛나는 풀
    m.decal('cave_prop_glow_plant_a', x, y)

# ---------------------------------------------------------------- 검증
m.seal_unreachable(ARRIVAL)
if '--ascii' in sys.argv:
    m.ascii()
m.validate(ARRIVAL, [(n, p) for n, _k, _l, p in MONSTERS] + [
    ('도착 칸', ARRIVAL), ('입구 계단', (EXIT_STAIRS[0], EXIT_STAIRS[1])), ('2층 계단', (UP_STAIRS[0], UP_STAIRS[1])),
    ('두 번째 비석 앞', (STELE_2[0], STELE_2[1] + 2)), ('세 번째 비석 앞', (STELE_3[0], STELE_3[1] + 2)),
    ('돌문 앞', (DOOR_SEAL[0][0], DOOR_SEAL[0][1] + 1))])

# ---------------------------------------------------------------- TMX 출력
UNLIT = ['물기에 젖은 돌 비석이다. 신전 외곽의 비석과 같은 글자가 새겨져 있다.', '글자 몇 개가 희미하게 빛났다가 꺼진다.']
chars = [monster(40 + i, name, x, y, kind, lvl) for i, (name, kind, lvl, (x, y)) in enumerate(MONSTERS)]
chars += stele_objects('seal_stele_2', *STELE_2, 'q023-remaining-seals', UNLIT,
                       ['푸르게 빛나는 옛 글자: "물을 붙드는 둘째 봉인. 깨어나려는 이의 이름을 부르지 말라."'], 1)
chars += stele_objects('seal_stele_3', *STELE_3, 'q023-remaining-seals', UNLIT,
                       ['푸르게 빛나는 옛 글자: "물을 붙드는 셋째 봉인. 종이 울리면 사제가 먼저 깬다."'], 9)
chars += [
    character(20 + i, f'upper_door_seal_{i}', x, y, [
        ('blocksMovement', 'bool', 'true'),
        ('controller.dialogueLines', 'list', ['옛 글자가 새겨진 돌문이 위층 계단을 막고 있다.',
                                               '문의 글자가 두 갈래로 나뉘어 동쪽과 서쪽을 가리킨다.']),
        ('controller.scriptId', '', 'vn-dialogue'),
        ('quest.hiddenWhenCompleted', '', 'q023-remaining-seals'),
        ('type', '', 'cave_prop_boulder')])
    for i, (x, y) in enumerate(DOOR_SEAL)
]
portals = [
    portal(60, 'outskirts_stairs', *EXIT_STAIRS, [
        ('appearanceType', '', 'stairs_stone_step_base_00'), ('targetFacing', '', 'down'),
        ('targetSceneId', '', 'ruins-outskirts'),
        ('targetSpawnTileX', 'int', OUTSKIRTS_SPAWN[0]), ('targetSpawnTileY', 'int', OUTSKIRTS_SPAWN[1])]),
    portal(61, 'upper_stairs', *UP_STAIRS, [
        ('appearanceType', '', 'stairs_stone_step_base_00'), ('quest.requiresCompleted', '', 'q023-remaining-seals'),
        ('targetFacing', '', 'up'), ('targetSceneId', '', 'sunken-temple-2f'),
        ('targetSpawnTileX', 'int', TEMPLE_2F_SPAWN[0]), ('targetSpawnTileY', 'int', TEMPLE_2F_SPAWN[1])]),
]
m.write_tmx(OUT, 'scripts/generate-sunken-temple-1f.py', chars,
            '두 번째·세 번째 봉인 비석(seal_stele_2·3, q023 조사 목표 — 밝힌 뒤 _lit), 2층 돌문(q023 후 열림) / '
            '물에 빠진 자 6(Lv27~28), 이끼 골렘 2(Lv28~29), 유적 해골병 2(Lv27)',
            portals, f'남쪽 계단 → 신전 외곽 {OUTSKIRTS_SPAWN}. 북쪽 계단 → 2층 {TEMPLE_2F_SPAWN}(q023 후).',
            next_object_id=70)
