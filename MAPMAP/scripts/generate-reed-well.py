"""2장 곁가지 '마을의 우물'(reed-well, 24x20) 생성기 — c2-s6(q032)의 무대.

갈대골 마당 우물 아래 옛 물길. 늪 물이 불어 거꾸로 차오르며 뱀과 개구리가 숨어들었고, 안쪽 물길 입구가 쓰레기
더미로 막혀 우물물이 썩어 간다. 내려온 방 → 북쪽 굴 → 막힌 물길 방(웅덩이), 동쪽 곁방.
"""
import sys

sys.path.insert(0, 'scripts')
from swamp_mapkit import character, monster, portal  # noqa: E402
from temple_mapkit import TempleMap  # noqa: E402

W, H = 24, 20
OUT = 'src/games/my-sample-rpg/assets/maps/reed-well.tmx'
ARRIVAL = (10, 16)
EXIT = (10, 17, 2, 1)                     # 우물 밧줄(갈대골로 올라간다)
VILLAGE_SPAWN = (19, 27)                  # 갈대골 우물 앞
CLOG = (11, 3)                            # 막힌 물길(q032 대화 목표)
MONSTERS = [
    ('늪뱀-1', 'monster_snake', 21, (10, 9)),
    ('늪뱀-2', 'monster_snake', 21, (16, 11)),
    ('늪뱀-3', 'monster_snake', 22, (19, 12)),
    ('늪뱀-4', 'monster_snake', 22, (4, 3)),
    ('늪개구리 전사-1', 'monster_frog', 22, (17, 5)),
    ('늪개구리 전사-2', 'monster_frog', 22, (18, 10)),
]

m = TempleMap(W, H, seed=20261011)
m.carve(7, 13, 14, 18)                   # 내려온 방
m.carve(9, 7, 12, 13)                    # 북쪽 굴
m.carve(3, 1, 19, 8)                     # 막힌 물길 방(웅덩이 둑과 벽 사이 두 칸)
m.carve(14, 8, 21, 14)                   # 동쪽 곁방
m.carve(12, 10, 14, 12)                  # 굴 ↔ 곁방
m.carve(6, 4, 7, 5, '~')                 # 물길 방 웅덩이(벽에서 두 칸 넘게 뗀다)
m.carve(14, 4, 15, 5, '~')
m.build()
m.reserved |= {(x, y) for y in range(H) for x in range(W) if m.at(x, y) == '#'}
for (x, y) in [(8, 17), (13, 14), (20, 9), (4, 6), (18, 3)]:
    m.decal('cave_prop_goo_puddle' if (x + y) % 2 else 'cave_prop_bone_scatter', x, y)
m.decal('cave_prop_glow_plant_a', 9, 2)
m.decal('cave_prop_glow_plant_b', 21, 13)
m.prop('crate_bones', 15, 13)
m.seal_unreachable(ARRIVAL)
m.validate(ARRIVAL, [(n, p) for n, _k, _l, p in MONSTERS] + [
    ('도착 칸', ARRIVAL), ('밧줄', (EXIT[0], EXIT[1])), ('막힌 물길 앞', (CLOG[0], CLOG[1] + 1))])

chars = [monster(10 + i, name, x, y, kind, lvl) for i, (name, kind, lvl, (x, y)) in enumerate(MONSTERS)] + [
    character(1, 'well_clog', CLOG[0], CLOG[1], [
        ('blocksMovement', 'bool', 'true'),
        ('controller.dialogueLines', 'list', ['썩은 갈대와 진흙이 엉겨 물길 입구를 틀어막고 있다.']),
        ('controller.scriptId', '', 'vn-dialogue'),
        ('displayText', '', '막힌 물길'),
        ('type', '', 'cave_prop_crate_crystal')]),
]
portals = [
    portal(30, 'well_rope', *EXIT, [
        ('appearanceType', '', 'stairs_stone_step_base_00'), ('targetFacing', '', 'down'),
        ('targetSceneId', '', 'reed-village'),
        ('targetSpawnTileX', 'int', VILLAGE_SPAWN[0]), ('targetSpawnTileY', 'int', VILLAGE_SPAWN[1])]),
]
m.write_tmx(OUT, 'scripts/generate-reed-well.py', chars,
            '막힌 물길(well_clog, q032 대화 목표) / 늪뱀 4(Lv21~22), 늪개구리 전사 2(Lv22)',
            portals, f'남쪽 밧줄 → 갈대골 우물 앞 {VILLAGE_SPAWN}.', next_object_id=40)
