"""3장 '서리굴' 1층(ice-cave-1f, 40x40)·2층(ice-cave-2f, 30x30) 생성기 — c3-07·c3-08 의 무대.
신전 도구(temple_mapkit)를 눈 바이옴으로: 돌바닥은 푸른 회색 얼음돌, 물은 얼음, 물가 둑은 눈.

1층: 남쪽 입구 굴 ─ 얼음 골렘의 방(서) ─ 가운데 얼어붙은 물길 회랑 ─ 동쪽 굴: 얼어붙은 사냥꾼(구출, c3-07) ─ 북쪽:
     얼음 광맥(볼크의 부탁) 곁 2층 계단(q039 후).
2층: 서리 마녀의 얼음 제단 — 둥근 방, 서리 마녀-보스 + 소환 늑대인간(처음엔 쓰러진 채).

사용: python3 scripts/generate-ice-cave.py  (두 층을 함께 만든다)
"""
import math
import sys

sys.path.insert(0, 'scripts')
from swamp_mapkit import INVISIBLE_BLOCK, character, monster, portal  # noqa: E402
from temple_mapkit import TempleMap, lpc  # noqa: E402

LAKE_SPAWN = (52, 20)                 # 거울못 동굴 계단 앞

# ---------------------------------------------------------------- 1층
W1, H1 = 40, 40
ARRIVAL_1 = (20, 36)
EXIT_1 = (20, 38, 2, 1)
DOWN_1 = (19, 3, 2, 1)
SPAWN_2 = (14, 25)
FROZEN_HUNTER = (34, 18)
ICE_VEIN = (25, 5)
MONSTERS_1 = [
    ('얼음 골렘-1', 'monster_ice_golem', 45, (6, 18)),
    ('얼음 골렘-2', 'monster_ice_golem', 45, (10, 23)),
    ('얼음 골렘-3', 'monster_ice_golem', 46, (6, 26)),
    ('서리 해골-1', 'monster_frost_skeleton', 44, (19, 25)),
    ('서리 해골-2', 'monster_frost_skeleton', 44, (21, 16)),
    ('서리 해골-3', 'monster_frost_skeleton', 45, (31, 21)),
    ('서리 해골-4', 'monster_frost_skeleton', 45, (35, 14)),
    ('서리 해골-5', 'monster_frost_skeleton', 45, (16, 5)),
]

m = TempleMap(W1, H1, seed=20261015, biome='snow')
m.carve(15, 31, 25, 37)                 # 남쪽 입구 굴
m.carve(20, 37, 21, 38)
m.carve(18, 26, 22, 31)                 # 위로 오르는 굴
m.carve(13, 12, 27, 26)                 # 가운데 회랑(얼어붙은 물길)
for x0, x1 in ((16, 17), (23, 24)):
    m.carve(x0, 15, x1, 23, '~')
m.carve(2, 14, 11, 29)                  # 서쪽 얼음 골렘의 방
m.carve(11, 18, 13, 21)
m.carve(28, 12, 38, 24)                 # 동쪽 굴(얼어붙은 사냥꾼)
m.carve(27, 16, 28, 19)
m.carve(18, 6, 22, 12)                  # 북쪽으로
m.carve(12, 2, 28, 7)                   # 북쪽 광맥 방(2층 계단)
m.build()
m.reserved |= {(x, y) for y in range(H1) for x in range(W1) if m.at(x, y) == '#'}
m.reserved |= {(x, y) for x in range(18, 23) for y in range(2, 6)} | {(x, y) for x in range(18, 23) for y in range(34, 39)}
for (x, y) in [(15, 32), (25, 32), (13, 13), (27, 13), (13, 25), (27, 25)]:
    m.prop('crystal_tall', x, y, rows=2)
for (x, y) in [(3, 15), (11, 15), (29, 13), (38, 13), (12, 3), (28, 3)]:
    m.decal('cave_prop_glow_plant_b' if (x + y) % 2 else 'cave_prop_glow_plant_a', x, y)
for (x, y) in [(8, 20), (33, 22), (24, 33), (15, 5)]:
    m.decal('cave_prop_skull' if (x + y) % 2 else 'cave_prop_bone_scatter', x, y)
m.prop('crystal_a', ICE_VEIN[0] + 1, ICE_VEIN[1])
m.prop('crystal_c', ICE_VEIN[0] - 1, ICE_VEIN[1])
m.seal_unreachable(ARRIVAL_1)
m.validate(ARRIVAL_1, [(n, p) for n, _k, _l, p in MONSTERS_1] + [
    ('도착 칸', ARRIVAL_1), ('입구 계단', (EXIT_1[0], EXIT_1[1])), ('2층 계단', (DOWN_1[0], DOWN_1[1])),
    ('사냥꾼 앞', (FROZEN_HUNTER[0] - 1, FROZEN_HUNTER[1])), ('광맥 앞', (ICE_VEIN[0], ICE_VEIN[1] + 1))])
chars = [monster(10 + i, name, x, y, kind, lvl) for i, (name, kind, lvl, (x, y)) in enumerate(MONSTERS_1)] + [
    character(1, 'frozen_hunter', *FROZEN_HUNTER, [
        ('blocksMovement', 'bool', 'true'),
        ('controller.dialogueLines', 'list', ['얼음 속에 사람이 갇혀 있다! 아직 숨결이 희미하게 남아 있다.']),
        ('controller.scriptId', '', 'vn-dialogue'), ('displayText', '', '얼어붙은 사냥꾼'),
        ('quest.hiddenWhenCompleted', '', 'q039-ice-cave'), ('type', '', 'snow_drift_wall')]),
    character(2, 'ice_vein', *ICE_VEIN, [
        ('blocksMovement', 'bool', 'true'),
        ('controller.dialogueLines', 'list', ['푸르게 빛나는 얼음 광맥이다. 볼크가 말하던 바로 그 광석이다.']),
        ('controller.scriptId', '', 'vn-dialogue'), ('displayText', '', '얼음 광맥'),
        ('type', '', 'cave_prop_crystal_tall_r1c0')]),
]
portals = [
    portal(30, 'lake_stairs', *EXIT_1, [
        ('appearanceType', '', 'stairs_stone_step_base_00'), ('targetFacing', '', 'down'),
        ('targetSceneId', '', 'frozen-lake'),
        ('targetSpawnTileX', 'int', LAKE_SPAWN[0]), ('targetSpawnTileY', 'int', LAKE_SPAWN[1])]),
    portal(31, 'altar_stairs', *DOWN_1, [
        ('appearanceType', '', 'stairs_stone_step_base_00'), ('quest.requiresCompleted', '', 'q039-ice-cave'),
        ('targetFacing', '', 'up'), ('targetSceneId', '', 'ice-cave-2f'),
        ('targetSpawnTileX', 'int', SPAWN_2[0]), ('targetSpawnTileY', 'int', SPAWN_2[1])]),
]
m.write_tmx('src/games/my-sample-rpg/assets/maps/ice-cave-1f.tmx', 'scripts/generate-ice-cave.py', chars,
            '얼어붙은 사냥꾼(frozen_hunter, q039 — 구출 뒤 사라짐), 얼음 광맥(ice_vein, q039) / 얼음 골렘 3(Lv45~46), '
            '서리 해골 5(Lv44~45)',
            portals, f'남쪽 계단 → 거울못 {LAKE_SPAWN}. 북쪽 계단 → 2층 {SPAWN_2}(q039 후).', next_object_id=40)

# ---------------------------------------------------------------- 2층
W2, H2 = 30, 30
UP_2 = (14, 27, 2, 1)
BACK_SPAWN_1 = (19, 5)
WITCH = (14, 9)
ALTAR = (13, 6)
SUMMONS = [(11, 9), (18, 9), (10, 12), (19, 12)]
m2 = TempleMap(W2, H2, seed=20261016, biome='snow')
m2.carve(14, 26, 15, 27)
m2.carve_ellipse(15.0, 15.0, 11.5, 11.0)
for cx, cy in ((9.0, 15.5), (21.0, 15.5)):
    m2.carve_ellipse(cx, cy, 1.6, 1.6, '~')
m2.build()
m2.reserved |= {(x, y) for y in range(H2) for x in range(W2) if m2.at(x, y) == '#'}
m2.reserved |= {(x, y) for x in range(12, 18) for y in range(8, 24)}
for i in range(10):
    a = math.pi * 2 * i / 10 + math.pi / 10
    x, y = round(15 + math.cos(a) * 8.6), round(15.5 + math.sin(a) * 8.0)
    if (abs(x - 14.5) < 3 and y > 18) or (abs(x - 14.5) < 4 and y < 10):
        continue
    if m2.at(x, y) == '.' and m2.at(x, y - 1) == '.':
        m2.prop('crystal_tall', x, y, rows=2)
m2.prop('altar_gold', ALTAR[0], ALTAR[1], cols=3, rows=2)
for (x, y) in [(11, 6), (17, 6)]:
    m2.prop('brazier_00', x, y)
for (x, y) in [(13, 13), (16, 13), (14, 16)]:
    m2.decal('cave_prop_pentagram', x, y)
for (x, y) in [(9, 18), (21, 17), (12, 21), (18, 20)]:
    m2.decal('cave_prop_skull' if (x + y) % 2 else 'cave_prop_bone_scatter', x, y)
m2.set('deco', 7, 5, lpc('cave_prop_web_nw'))
m2.set('deco', 23, 5, lpc('cave_prop_web_ne'))
m2.seal_unreachable((14, 25))
m2.validate((14, 25), [('계단', (UP_2[0], UP_2[1])), ('서리 마녀', WITCH)] + [(f'소환 {i}', p) for i, p in enumerate(SUMMONS)])
chars2 = [monster(1, '서리 마녀-보스', WITCH[0], WITCH[1], 'monster_frost_witch', 49)] + [
    character(2 + i, f'서리 마녀-소환-{i + 1}', x, y, [
        ('blocksMovement', 'bool', 'true'), ('displayText', '', '서리 늑대인간'), ('monster.level', 'int', 46),
        ('type', '', 'monster_frost_wolfman')])
    for i, (x, y) in enumerate(SUMMONS)
]
portals2 = [
    portal(20, 'cave_up_stairs', *UP_2, [
        ('appearanceType', '', 'stairs_stone_step_base_00'), ('targetFacing', '', 'down'),
        ('targetSceneId', '', 'ice-cave-1f'),
        ('targetSpawnTileX', 'int', BACK_SPAWN_1[0]), ('targetSpawnTileY', 'int', BACK_SPAWN_1[1])]),
]
m2.write_tmx('src/games/my-sample-rpg/assets/maps/ice-cave-2f.tmx', 'scripts/generate-ice-cave.py', chars2,
             '서리 마녀-보스(Lv49, 3장 최종 보스) / 소환 서리 늑대인간 4(Lv46, 처음엔 쓰러진 채)',
             portals2, f'남쪽 계단 → 1층 {BACK_SPAWN_1}.', next_object_id=30)
