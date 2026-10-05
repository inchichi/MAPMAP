"""1장 보스 하수인 — 말캉이-보스(동굴)와 꿀꿀이대장-보스(수정 광산)의 '<보스>-소환-N' 개체를 TMX 에 둔다.

하수인은 씬이 시작될 때 쓰러진 채이고 보스의 소환 기술로 일어난다(bossSkills.ts). 동굴·광산 생성기는
objectgroup 을 그대로 보존하므로 여기서 한 번 넣어 두면 지형을 다시 만들어도 남는다. 이미 있으면 건너뛴다.
"""
import re

MAPS = {
    'src/games/my-sample-rpg/assets/maps/cave.tmx': (
        '말캉이-보스', '작은 말캉이', 'monster_slime', 6, [(12, 6), (20, 6), (12, 10)]),
    'src/games/my-sample-rpg/assets/maps/crystal-mine.tmx': (
        '꿀꿀이대장-보스', '꿀꿀이 졸개', 'monster_pig', 12, [(10, 7), (28, 7), (19, 8)]),
}

for path, (boss, label, kind, level, tiles) in MAPS.items():
    src = open(path, encoding='utf-8').read()
    prefix = boss.replace('-보스', '-소환-')
    if prefix in src:
        print('건너뜀', path)
        continue
    next_id = int(re.search(r'nextobjectid="(\d+)"', src).group(1))
    objs = []
    for i, (tx, ty) in enumerate(tiles, start=1):
        objs.append(f'  <object id="{next_id}" name="{prefix}{i}" type="character" x="{tx * 32 + 16}" y="{ty * 32 + 32}" '
                    f'width="32" height="32">\n'
                    f'   <properties>\n'
                    f'    <property name="displayText" value="{label}"/>\n'
                    f'    <property name="blocksMovement" type="bool" value="true"/>\n'
                    f'    <property name="monster.level" type="int" value="{level}"/>\n'
                    f'    <property name="type" value="{kind}"/>\n'
                    f'   </properties>\n'
                    f'  </object>')
        next_id += 1
    m = re.search(r'<object id="\d+" name="%s" type="character".*?</object>\n' % boss, src, re.S)
    src = src[:m.end()] + '\n'.join(objs) + '\n' + src[m.end():]
    src = re.sub(r'nextobjectid="\d+"', f'nextobjectid="{next_id}"', src)
    open(path, 'w', encoding='utf-8', newline='\n').write(src)
    print('wrote', path, len(objs))
