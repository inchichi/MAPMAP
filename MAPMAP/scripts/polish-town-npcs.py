"""티르코네일(town.tmx) 주민 다듬기 — 이름 없던 주민 넷에게 이름·대사를 주고, 대장장이의 밈 대사를 바꾼다.

NPC id·위치·외형은 그대로 둔다(퀘스트·에디터가 id 로 찾는다). 산타는 에디터 이벤트 생성 데모 대상이라 손대지 않는다.
여러 번 돌려도 결과가 같다(대상 NPC 의 <properties> 를 통째로 다시 쓴다).
"""
import re
from xml.sax.saxutils import quoteattr

SRC = 'src/games/my-sample-rpg/assets/maps/town.tmx'


def dialogue(name, appearance, lines, extra=()):
    props = [('controller.dialogueLines', 'list', lines),
             ('controller.messageDurationSeconds', 'float', '2.8'),
             ('controller.scriptId', '', 'vn-dialogue'),
             ('displayText', '', name), *extra, ('type', '', appearance)]
    return props


def wander(name, appearance, line, radius=2, speed=1.5):
    return [('controller.interactionLine', '', line),
            ('controller.moveSpeedTilesPerSecond', 'float', str(speed)),
            ('controller.radiusInTiles', 'int', str(radius)),
            ('controller.scriptId', '', 'wander-near-home'),
            ('displayText', '', name), ('type', '', appearance)]


NPCS = {
    'blacksmith': dialogue('대장장이', 'character_bearded_apron_man', [
        '어서 오게. 티르코네일 대장간 화덕은 불 꺼진 날이 없지.',
        '칼날은 숫돌에서, 사람은 사냥터에서 벼려지는 법이야.',
        '장비 상점에 청동 검이며 철 옷이며 갖춰 놨다. 돈이 모이면 들르게.']),
    # 마법사는 손대지 않는다 — 맡길 퀘스트가 없을 때는 '컵 속 별조각' 미니게임이 붙어 있다.
    # 남서쪽 집에 사는 목수 — 집 앞 잔디밭을 서성인다.
    'villager_1': wander('목수 토렌', 'character_villager_brown_tunic',
                         '새 집 세 채 지붕을 올리느라 허리가 남아나질 않아. 그래도 보기 좋지?'),
    # 시청 분수 곁 — 시청 앞 화분을 가꾸는 정원사
    'villager_2': dialogue('정원사 에일린', 'character_villager_flower_dress', [
        '시청 앞 화분은 전부 제가 가꿔요. 분수 물을 길어다 주거든요.',
        '요즘 사냥터 쪽 바람이 이상해요. 꽃잎 끝이 자꾸 누렇게 말려요.',
        '딴따라마을 들꽃은 여기보다 훨씬 크대요. 언젠가 꼭 가 볼 거예요.']),
    # 시계탑 곁 노인 — 마을 옛이야기
    'villager_3': dialogue('시계탑지기 노인', 'character_elder_gray_hair', [
        '이 시계탑은 내 할아버지의 할아버지 때부터 한 번도 멈춘 적이 없다네.',
        '남쪽 수교는 옛날 사람들이 딴따라마을 들녘까지 물을 대려고 쌓은 게야.',
        '광산이 문을 닫은 뒤로 마을이 많이 조용해졌지. 그래도 동쪽 밀밭은 아직 살아 있어.']),
    # 남문(수교 중앙 아치) 앞 — 딴따라마을로 가는 길 안내
    'villager_4': dialogue('다리지기 오웬', 'character_commoner_tan_tunic', [
        '이 아치 밑 계단으로 내려가면 딴따라마을이오. 물보라에 계단이 미끄러우니 조심하시오.',
        '수교 위로는 사람이 못 다니오. 물길이 마을 생명줄이라 내가 지키는 게요.']),
}


def render(props):
    out = ['   <properties>']
    for name, typ, value in props:
        t = f' type="{typ}"' if typ else ''
        if typ == 'list':
            out.append(f'    <property name="{name}" type="list">')
            out += [f'     <item value={quoteattr(v)}/>' for v in value]
            out.append('    </property>')
        else:
            out.append(f'    <property name="{name}"{t} value={quoteattr(value)}/>')
    out.append('   </properties>')
    return '\n'.join(out)


src = open(SRC, encoding='utf-8').read()
# 다리지기 오웬은 남문 포탈(26~28열, 42~43행) 계단 그림 속에 묻혀 있었다 — 동쪽 가로등 곁(31,42)으로.
src = re.sub(r'(name="villager_4" type="character") x="[\d.]+" y="[\d.]+"', r'\1 x="1008" y="1372"', src)
for npc_id, props in NPCS.items():
    # 퀘스트 뒤 대사로 갈리는 복제 개체(add-ch1-reactive-npcs.py, quest.requiresCompleted)는 건드리지 않고,
    # 원래 개체의 quest.hiddenWhenCompleted 는 지키며 나머지 속성만 다시 쓴다.
    pat = re.compile(r'(<object id="\d+" name="%s" type="character"[^>]*>\n)(   <properties>.*?</properties>)' % npc_id,
                     re.S)
    targets = [m for m in pat.finditer(src) if 'quest.requiresCompleted' not in m.group(2)]
    assert len(targets) == 1, npc_id
    m = targets[0]
    hidden = re.search(r'name="quest.hiddenWhenCompleted" value="([^"]+)"', m.group(2))
    full = props + ([('quest.hiddenWhenCompleted', '', hidden.group(1))] if hidden else [])
    src = src[:m.start()] + m.group(1) + render(full) + src[m.end():]
open(SRC, 'w', encoding='utf-8', newline='\n').write(src)
print('wrote', SRC, '—', ', '.join(NPCS))
