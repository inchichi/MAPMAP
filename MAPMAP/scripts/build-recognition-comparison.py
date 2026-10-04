"""Compact, evidence-backed PDF of the paired object recognition pilot."""
import json
from pathlib import Path

from PIL import Image
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT/'public/theme-runs/recognition-pilot-20260928-01'
OUT = ROOT/'output/pdf/object-recognition-comparison-20260928.pdf'
pdfmetrics.registerFont(TTFont('KR', 'C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('KRB', 'C:/Windows/Fonts/malgunbd.ttf'))
c = canvas.Canvas(str(OUT), pagesize=(842,595))
c.setTitle('TMX 오브젝트 인식 비교 - 확대본 단독 vs 주변 맵 병행')
manifest = json.loads((RUN/'manifest.json').read_text(encoding='utf8'))
results = {case['id']: [json.loads((RUN/f'{case["id"]}-{mode}.json').read_text(encoding='utf8'))
           for mode in ['crop_only','crop_and_context']] for case in manifest['cases']}
reviews = [
 ('건물', '양쪽 모두 건물로 분류. 주변 입력의 초가지붕·굴뚝 설명은 확정하기 어려움.'),
 ('울타리', '양쪽 모두 울타리. 이 대상에서는 주변 맵의 추가 이점이 작음.'),
 ('둥근 나무', '양쪽 모두 수풀로 응답. 기존 tree 라벨과 다르며 주변 맵도 해결하지 못함.'),
 ('뾰족한 나무', '양쪽 모두 설명은 tree인데 분류값은 plant. 세부 분류 일관성이 부족함.'),
 ('기둥', '양쪽 모두 돌기둥. 색·형태 설명도 대체로 이미지와 부합함.'),
 ('마을 소품', '수납장 → 상자로 변경. 외형만으로 용도를 확정하기 어려워 검수 필요.'),
 ('폐허 소품', '용기 → 난방기로 변경. 구체화됐지만 난방기라는 근거는 부족함.'),
 ('폐허 잔해', '식물 → 기타 물체. 단정은 줄었지만 정확한 정체는 여전히 불명확함.'),
 ('작은 원형 소품', '식물 → 버섯. 버섯으로 확정할 근거가 부족하며 오인 가능성이 있음.'),
 ('둥근 판형 소품', '잎 → 돌판. 맥락상 돌·잔해 해석이 더 그럴듯하나 정답 확정은 아님.'),
 ('붙어 있는 용기', '박스에 용기 두 개가 보이지만 양쪽 모두 하나의 용기처럼 설명함.'),
 ('복합 소품', '캐릭터 → 가구. 여러 소품·조각이 붙은 입력으로 보이며 둘 다 부정확해 보임.')]


def text(x,y,s,size=11,bold=False,color='#dce5f2'):
    c.setFillColor(color);c.setFont('KRB' if bold else 'KR',size);c.drawString(x,y,s)


def wrap(x,y,s,width,size=10,leading=15):
    line=''
    for ch in s:
        if pdfmetrics.stringWidth(line+ch,'KR',size)>width:
            text(x,y,line,size);y-=leading;line=''
        line+=ch
    if line:text(x,y,line,size)
    return y-leading


def page(n,title,sub):
    c.setFillColor('#101827');c.rect(0,0,842,595,fill=1,stroke=0)
    text(30,568,'CRYPT / VISION EXPERIMENT / 2026-09-28',9,color='#9ebfff')
    text(30,538,title,22,True);text(30,516,sub,10,color='#a9b9cf')
    text(30,20,'실험: recognition-pilot-20260928-01 | 모델 출력과 육안 해석을 구분 | 게임 미적용',8,color='#9cacbf')
    text(779,20,f'{n} / 5',8,color='#9cacbf')


def picture(path,x,y,w,h):
    im=Image.open(path).convert('RGB');scale=min(w/im.width,h/im.height)
    c.drawImage(ImageReader(im),x+(w-im.width*scale)/2,y+(h-im.height*scale)/2,
                width=im.width*scale,height=im.height*scale)


page(1,'오브젝트 인식: 주변 맵이 정말 도움이 될까?','Qwen3-VL-8B-Instruct | 마을 6종 + 폐허마을 6종 | 각 2방식, 총 24회')
text(30,475,'결론: 맥락은 보조 정보다. 먼저 “한 개의 오브젝트인가”를 확인해야 한다.',16,True)
for x,big,label in [(30,'24 / 24','JSON 형식 검증 통과'),(296,'7 / 12','두 방식의 분류값 동일'),(562,'39초','분류 합계 / 회당 평균 1.63초')]:
    c.setFillColor('#1d2b41');c.roundRect(x,372,250,75,8,fill=1,stroke=0)
    text(x+16,412,big,24,True,color='#a8c8ff');text(x+16,388,label,11)
text(30,348,'※ 형식 통과와 분류값 일치는 정확도가 아닙니다. 정답 라벨은 아직 확정하지 않았습니다.',10,color='#ffd59d')
picture(RUN/'case-00-crop.png',30,145,200,180)
picture(RUN/'case-00-context.png',252,145,200,180)
text(53,130,'A. 추출 확대본만 입력',11,True);text(252,130,'B. 확대본 + 주변 맵 입력',11,True)
y=311
for line in ['동일한 원본에 최근접 확대를 적용했습니다.',
             '주변 맵의 빨간 박스는 분류 대상입니다.',
             '파일명·기존 라벨은 모델에 전달하지 않았습니다.',
             'BF16 / 샘플링 없음 / 최대 출력 256토큰',
             '다운로드·모델 로딩 포함 전체 약 3분 18초',
             '아래 평가는 AI의 이미지 대조이며 인간 정답 검수는 아닙니다.']:
    y=wrap(483,y,line,326,11,17)-12
text(30,83,'관찰: 건물·울타리·기둥은 안정적. 작은 소품은 해석이 흔들리고 복합 입력은 단일 물체로 오인.',11)
c.showPage()

for group in range(3):
    page(group+2,f'실제 결과 비교 {group+1} / 3','원본 확대본과 주변 맵을 대조한 해석입니다. 영문 label/category는 실제 모델 응답입니다.')
    for slot in range(4):
        index=group*4+slot;case=manifest['cases'][index];pair=results[case['id']]
        y=397-slot*112
        c.setFillColor('#1c293b');c.roundRect(30,y,782,105,6,fill=1,stroke=0)
        text(42,y+88,f'{case["asset"]} · {reviews[index][0]}',10,True)
        picture(RUN/f'{case["id"]}-crop.png',42,y+23,81,59)
        picture(RUN/f'{case["id"]}-context.png',133,y+23,81,59)
        for col,record in enumerate(pair):
            x=234+col*280;p=record['parsed']
            text(x,y+87,'확대본 단독' if col==0 else '주변 맵 병행',10,True,color='#9ebfff')
            text(x,y+68,'분류: '+p['category'],10)
            wrap(x,y+52,'설명: '+p['label'],265,10,14)
        text(42,y+8,reviews[index][1],9,color='#ffd59d')
    c.showPage()

page(5,'개선 방향: 인식 모델보다 입력 단위를 먼저 정리','현재 실험의 한계와 다음 파이프라인 제안')
picture(RUN/'case-10-context.png',30,310,185,180)
picture(RUN/'case-11-context.png',229,310,185,180)
text(30,295,'prop-20: 용기 두 개가 한 박스에 포함',10)
text(229,295,'prop-29: 여러 소품·조각이 함께 포함',10)
y=475
for title,body in [('1. 추출 단위 확인','연결된 타일 덩어리와 의미상 오브젝트는 다릅니다. 단일 / 복합 / 잘린 조각부터 판별해야 합니다.'),
                   ('2. 잘못된 확신 차단','24개 응답 중 22개는 ambiguity가 빈칸입니다. 빈칸을 정답·고신뢰 신호로 쓰면 안 됩니다.'),
                   ('3. 분류 체계 정리','tree와 plant처럼 겹치는 범주를 명확히 정의하고 설명과 category의 일관성을 검사합니다.')]:
    text(443,y,title,13,True,color='#a8c8ff');y=wrap(443,y-22,body,366,11,17)-22
text(30,245,'권장 처리 흐름',15,True)
flow=['TMX 추출','단일·복합 판별','종류·특징 인식','검수·라벨 저장','LLM → FLUX']
for i,label in enumerate(flow):
    x=30+i*159
    c.setFillColor('#254367');c.roundRect(x,188,145,39,5,fill=1,stroke=0)
    text(x+10,203,label,11,True)
    if i<4:text(x+147,202,'>',12)
for j,line in enumerate([
 '기존 TMX 이름·타입을 우선 사용하고, 정보가 없는 대상만 비전 모델로 분류합니다.',
 '복합·잘린 입력은 재분리하거나 검수 대상으로 보냅니다. 단독/주변 결과가 다르면 확인합니다.',
 '검수된 라벨을 원본 해시와 함께 저장한 뒤 오브젝트별 프롬프트에 사용합니다.',
 '이번 12종은 소규모 표본이며 입력 순서·영역 크기를 통제한 반복 실험은 하지 않았습니다.'
]):text(30,157-j*24,line,11)
text(30,46,'원본·응답·시간·모델 설정 보존: public/theme-runs/recognition-pilot-20260928-01/',9,color='#9cacbf')
c.showPage();c.save()
print(OUT)
