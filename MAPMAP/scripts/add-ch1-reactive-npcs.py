"""1장 주민 대사가 이야기에 반응하게 — 퀘스트를 끝내면 같은 자리의 같은 NPC 가 다른 말을 한다.

갈대골 사냥꾼 렌과 같은 방식: 원래 개체에 `quest.hiddenWhenCompleted`, 같은 id·자리·외형의 복제 개체에
`quest.requiresCompleted` 와 새 대사를 단다(퀘스트 대화는 여전히 NPC id 로 찾으므로 영향 없다).
마을·물레골 생성기는 objectgroup 을 보존하므로 TMX 에 직접 넣는다. 이미 나뉘어 있으면 건너뛴다.
"""
import re
from xml.sax.saxutils import quoteattr

MAPS = 'src/games/my-sample-rpg/assets/maps/'
Q_PIG_BOSS = 'q008-pig-boss-threat'
CHANGES = {
    'town.tmx': [
        ('potion_merchant', Q_PIG_BOSS, ['살아 돌아왔구나! 다친 데는 없지?',
                                         '쓰고 남은 빈 병은 버리지 말고 가져와. 다시 채워 줄게.']),
        ('blacksmith', 'q014-weapon-path', ['광산의 불이 잠잠해졌다더군. 백 년 묵은 수정 광석이 이제 마음껏 나오겠어.',
                                            '무기 다루는 솜씨가 제법이야. 이제 대장장이 눈에도 차는구나.']),
        ('villager_1', Q_PIG_BOSS, '자네 덕에 마을이 조용해졌어. 이제 지붕 일에만 매달리면 되겠군.'),
        ('villager_2', Q_PIG_BOSS, ['꽃잎이 다시 반듯하게 펴졌어요! 사냥터 바람이 잠잠해졌나 봐요.',
                                    '동굴의 꿀꿀이-보스를 쓰러뜨린 게 당신이라면서요? 이 꽃 한 송이는 공짜예요.']),
        ('villager_3', Q_PIG_BOSS, ['자네가 동굴 깊은 곳의 그 녀석을 잠재웠다지?',
                                    '오늘 밤엔 시계탑 종을 한 번 더 쳐야겠군. 마을이 무사하다는 뜻으로 말이야.']),
        ('villager_4', 'q010-harvest-village-visit', [
            '물레골에 다녀왔구려. 마리네 촌장님은 여전히 우물가에 계시오?',
            '수교 물이 줄면 내가 제일 먼저 안다오. 요즘은… 아치 밑 물소리가 조금 가늘어졌소.']),
    ],
    'harvest-village.tmx': [
        ('farmer', 'q011-field-pigs', ['꿀꿀이가 안 내려오니 밀이 쑥쑥 자라는구먼.',
                                       '올가을 첫 밀가루로 구운 빵은 자네 몫이야.']),
        ('rona', 'q012-sluice-keeper', ['이멜 아저씨가 다시 빨래터에 내려오셨어요. 수위표 얘기만 하시지만요.',
                                        '수로 물이 예전만 못하대요… 별일 아니겠죠?']),
        ('lady', 'q013-manor-spores', ['장미가 다시 피었어요. 향기 맡아 보시겠어요?',
                                       '울타리 틈으로 다니는 기사님들만 없으면 완벽할 텐데요.']),
        ('teo', 'q014-weapon-path', ['광산의 불이 꺼졌대요! 이제 마음 놓고 캐러 갈 수 있겠어요.',
                                     '그래도 못가 벤치 자리는 양보 못 해요. 여기가 제일 편하거든요.']),
    ],
}


def set_prop(body, name, value, typ=''):
    """<properties> 안의 단일 값 속성을 바꾸거나 더한다."""
    t = f' type="{typ}"' if typ else ''
    line = f'    <property name="{name}"{t} value={quoteattr(value)}/>'
    pat = re.compile(r'    <property name="%s"[^>]*/>' % re.escape(name))
    if pat.search(body):
        return pat.sub(lambda _m: line, body)
    return body.replace('   </properties>', line + '\n   </properties>')


def set_lines(body, lines):
    items = '\n'.join(f'     <item value={quoteattr(v)}/>' for v in lines)
    block = f'    <property name="controller.dialogueLines" type="list">\n{items}\n    </property>'
    return re.sub(r'    <property name="controller.dialogueLines" type="list">.*?</property>', lambda _m: block, body,
                  flags=re.S)


for map_name, changes in CHANGES.items():
    path = MAPS + map_name
    src = open(path, encoding='utf-8').read()
    next_id = int(re.search(r'nextobjectid="(\d+)"', src).group(1))
    done = []
    for npc_id, quest, lines in changes:
        pat = re.compile(r'  <object id="(\d+)" name="%s" type="character".*?</object>\n' % re.escape(npc_id), re.S)
        found = pat.findall(src)
        if len(found) != 1:
            print(f'건너뜀 {map_name}:{npc_id} (개체 {len(found)}개 — 이미 나뉘었거나 없음)')
            continue
        m = pat.search(src)
        before = set_prop(m.group(0), 'quest.hiddenWhenCompleted', quest)
        after = re.sub(r'<object id="\d+"', f'<object id="{next_id}"', m.group(0), count=1)
        next_id += 1
        after = set_prop(after, 'quest.requiresCompleted', quest)
        if isinstance(lines, str):
            assert 'controller.interactionLine' in after, npc_id
            after = set_prop(after, 'controller.interactionLine', lines)
        else:
            assert 'controller.dialogueLines' in after, npc_id
            after = set_lines(after, lines)
        src = src[:m.start()] + before + after + src[m.end():]
        done.append(npc_id)
    src = re.sub(r'nextobjectid="\d+"', f'nextobjectid="{next_id}"', src)
    open(path, 'w', encoding='utf-8', newline='\n').write(src)
    print('wrote', path, done)
