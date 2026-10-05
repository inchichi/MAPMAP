"""딴따라마을(harvest-village.tmx) 주민 다듬기 — 순찰 기사 갈렌 경은 배회 대사가 없어 기본값 "비켜"만 했다.

세라핀 부인이 "기사님들이 울타리 틈으로 다닌다"고 투덜대는 것과 이어지게 한 마디를 준다. 생성기는 objectgroup 을
보존하므로 TMX 에 직접 쓴다. 여러 번 돌려도 같다.
"""
import re
from xml.sax.saxutils import quoteattr

SRC = 'src/games/my-sample-rpg/assets/maps/harvest-village.tmx'
LINE = '순찰 중이오. …울타리 틈으로 지름길을 다닌 건 세라핀 부인께 비밀로 해 주시오.'

src = open(SRC, encoding='utf-8').read()
pat = re.compile(r'<object id="\d+" name="patrol" type="character".*?</object>', re.S)
assert len(pat.findall(src)) == 1


def fix(m):
    body = re.sub(r'\n    <property name="controller.interactionLine"[^>]*/>', '', m.group(0))
    return body.replace('   </properties>',
                        f'    <property name="controller.interactionLine" value={quoteattr(LINE)}/>\n   </properties>')


src = pat.sub(fix, src)
open(SRC, 'w', encoding='utf-8', newline='\n').write(src)
print('wrote', SRC)
