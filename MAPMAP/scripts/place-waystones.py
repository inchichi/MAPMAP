"""손으로 다듬은 맵(1장 느티골·물레골)에 귀환 표지석 오브젝트를 넣는다. 생성기로 만드는 맵은 생성기가
직접 넣는다(swamp_mapkit.waystone). 타일은 건드리지 않고 characters 오브젝트 묶음에만 더한다. 멱등: 이미 있는
waystone_* 오브젝트는 지우고 다시 넣는다. 도착 칸(waystones.ts)은 밑동 바로 아래 칸이다."""
import re
import sys

sys.path.insert(0, 'scripts')
from swamp_mapkit import waystone  # noqa: E402

PLACES = [
    ('src/games/my-sample-rpg/assets/maps/town.tmx', 'tir-chonail', (30, 20)),
    ('src/games/my-sample-rpg/assets/maps/harvest-village.tmx', 'harvest-village', (17, 6)),
]

for path, waystone_id, (x, y) in PLACES:
    s = open(path, encoding='utf-8').read()
    existing = re.search(rf'<object id="(\d+)" name="waystone_{re.escape(waystone_id)}"', s)
    s = re.sub(r'\n  <object id="\d+" name="waystone_[^"]*" type="character".*?</object>', '', s, flags=re.S)
    next_id = int(re.search(r'nextobjectid="(\d+)"', s).group(1))
    oid = int(existing.group(1)) if existing else next_id      # 다시 돌려도 같은 번호
    block = waystone(oid, waystone_id, x, y)
    # characters 묶음의 맨 뒤에 넣는다(기존 오브젝트 순서를 그대로 둔다)
    s = re.sub(r'(<objectgroup id="\d+" name="characters">.*?)(\n </objectgroup>)',
               lambda m: m.group(1) + '\n' + block + m.group(2), s, count=1, flags=re.S)
    if not existing:
        s = re.sub(r'nextobjectid="\d+"', f'nextobjectid="{next_id + 2}"', s, count=1)
    open(path, 'w', encoding='utf-8', newline='\n').write(s)
    print('표지석', waystone_id, path, (x, y), 'id', next_id)
