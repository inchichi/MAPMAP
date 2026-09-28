"""Screenshot-based target architecture; clearly separate plans from implementation."""
from pathlib import Path
from PIL import Image
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

ROOT=Path(__file__).resolve().parents[1]
SHOTS=ROOT/'docs/screenshots/operator-guide-20260928'
RUN=ROOT/'public/theme-runs/recognition-pilot-20260928-01'
OUT=ROOT/'output/pdf/style-pipeline-single-object-guide-20260928.pdf'
pdfmetrics.registerFont(TTFont('KR','C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('KRB','C:/Windows/Fonts/malgunbd.ttf'))
c=canvas.Canvas(str(OUT),pagesize=(842,595))
c.setTitle('원본 구조 보존형 스타일 변환 - 단독 오브젝트 인식 파이프라인')

def text(x,y,s,size=11,bold=False,color='#dce5f2'):
    c.setFillColor(color);c.setFont('KRB' if bold else 'KR',size);c.drawString(x,y,s)

def wrap(x,y,s,width=245,size=11):
    line=''
    for ch in s:
        if pdfmetrics.stringWidth(line+ch,'KR',size)>width:
            text(x,y,line,size);y-=18;line=''
        line+=ch
    if line:text(x,y,line,size)
    return y-18

def page(n,title,subtitle):
    c.setFillColor('#101827');c.rect(0,0,842,595,fill=1,stroke=0)
    text(30,568,'CRYPT / STYLE PIPELINE / 2026-09-28',9,color='#9ebfff')
    text(30,538,title,22,True);text(30,514,subtitle,10,color='#a9b9cf')
    text(30,20,'기존 에디터 캡처 기반 설계 설명 | 예정 기능은 구현 완료를 의미하지 않음 | 원본·실험 보존',8,color='#9cacbf')
    text(780,20,f'{n} / 6',8)

def image(path,x,y,w,h):
    im=Image.open(path).convert('RGB');s=min(w/im.width,h/im.height)
    c.drawImage(ImageReader(im),x+(w-im.width*s)/2,y+(h-im.height*s)/2,width=im.width*s,height=im.height*s)

def points(items,x=557,y=461):
    for title,body in items:
        text(x,y,title,13,True,color='#a8c8ff')
        y=wrap(x,y-23,body)-26

page(1,'최종 방향: 원본은 유지하고 테마만 바꾼다','분류 입력은 TMX에서 추출한 단독 오브젝트 확대본만 사용합니다. 주변 맵은 입력하지 않습니다.')
image(SHOTS/'editor.png',30,145,510,350)
points([('사용자가 입력하는 것','예: “할로윈 밤, 보라색 계열, 호박등과 거미줄을 추가해줘.”'),
        ('변경하는 것','원본의 색·명암, 새 장식, 밤 연출과 전구 반짝임입니다.'),
        ('유지하는 것','형태·크기·문·창문 위치·원본 알파·배치 좌표·충돌 구조입니다.')])
text(30,112,'최종 화면 = 색·명암 보정 원본 + 투명 장식 레이어 + 시간대·반짝임 효과',15,True)
text(30,80,'캡처는 기존 에디터입니다. 단독 인식 → LLM 맞춤 지시 → 생성의 자동 연결은 앞으로 구현할 목표입니다.',10,color='#ffd59d')
c.showPage()

page(2,'01  테마 입력 → TMX 추출 → 단독 인식','TMX는 구조·좌표의 근거, Qwen3-VL은 오브젝트의 의미를 설명하는 역할입니다.')
image(SHOTS/'style.png',30,163,510,330)
points([('테마 입력','스타일 변환 화면에서 테마·색감·시간대·장식을 입력합니다.'),
        ('TMX 원본 추출','타일을 합쳐 원본 RGBA와 좌표·크기를 저장합니다. 같은 모양은 대표 이미지로 한 번만 처리합니다.'),
        ('단독 이미지 분류','최근접 보간으로 확대한 원본만 Qwen3-VL에 전달합니다. 종류·보이는 특징·모호함을 구조화합니다.')])
text(30,118,'기존 이름·타입은 참고 정보로 보존합니다. 모델이 보는 시각 입력은 단독 추출 이미지뿐입니다.',11)
text(30,88,'추출본이 여러 물체를 포함하거나 잘린 조각이면 검수 대상으로 보냅니다. 파일명과 좌표는 바꾸지 않습니다.',10)
c.showPage()

page(3,'02  종류·특징 저장 → LLM의 개별 프롬프트','인식은 원본이 바뀔 때, 테마별 프롬프트 생성은 테마가 바뀔 때 수행하는 설계입니다.')
for x,case,label,kind in [(30,'00','건물','building'),(294,'01','울타리','fence'),(558,'04','기둥','column')]:
    c.setFillColor('#1c293b');c.roundRect(x,290,250,204,8,fill=1,stroke=0)
    image(RUN/f'case-{case}-crop.png',x+16,329,218,150)
    text(x+16,307,f'단독 분류 실험: {label} / {kind}',11,True)
text(30,263,'아래는 연결될 LLM 지시의 설계 예시이며, 실제 생성 결과가 아닙니다.',10,color='#ffd59d')
for x,title,body in [(30,'건물에 맞춘 지시','처마에 거미줄, 입구 옆 호박등. 문·창문·지붕 형태는 유지.'),
                     (294,'울타리에 맞춘 지시','상단을 따라 작은 장식 배치. 기둥 간격과 울타리 윤곽 유지.'),
                     (558,'기둥에 맞춘 지시','기둥 몸체에 작은 장식 부착. 높이·폭·받침과 위치 유지.')]:
    text(x,232,title,13,True,color='#a8c8ff');wrap(x,208,body,244)
text(30,126,'LLM 입력 = 전체 테마 + 검수된 종류·특징 + 원본 크기 + 공통 보존 규칙',13,True)
text(30,98,'LLM 출력 = 오브젝트별 FLUX 프롬프트 + 팔레트·명암 설정 + 장식·효과 계획',12)
text(30,70,'라벨은 원본 해시와 함께 저장합니다. 애매한 분류를 확정된 사실처럼 프롬프트에 넣지 않습니다.',10)
c.showPage()

page(4,'03  원본 보정과 장식 생성을 분리한다','생성형 모델이 다시 그린 건물·나무 전체를 원본 대신 덮어쓰지 않습니다.')
for x,title,lines in [(30,'A. 원본 색·명암 보정',[
    '입력: 원본 RGBA + 팔레트·명암 계획',
    '픽셀 색과 밝기만 변경',
    '형태·크기·문·창문·원본 알파는 유지',
    '출력: 보정된 원본 스프라이트']),
    (430,'B. FLUX 장식 생성·추출',[
    '입력: 원본 이미지 + 개별 장식 프롬프트',
    '장식이 포함된 전체 이미지를 생성',
    '원본에 정렬한 뒤 새 장식만 RGBA로 추출',
    '출력: 원본 구조를 제외한 장식 레이어'])]:
    c.setFillColor('#1c293b');c.roundRect(x,292,382,198,8,fill=1,stroke=0)
    text(x+18,460,title,16,True,color='#a8c8ff')
    for i,line in enumerate(lines):text(x+18,425-i*33,line,11)
text(30,253,'두 결과를 원래 좌표에서 합성 → 밤·반짝임 → 미리보기',17,True)
for i,(title,body) in enumerate([
    ('색감은 원본 쪽에서','할로윈의 보라·청록 팔레트와 명암은 원본 보정에 반영합니다. 단순한 어둡게 처리와 구분합니다.'),
    ('장식은 별도 레이어에서','눈·전구·거미줄 등 새 요소와 밤·반짝임 효과를 데코레이션 그룹으로 관리하고 켜고 끕니다.'),
    ('추출이 핵심 품질 관문','색 차이만으로 장식을 고르면 원본 윤곽이 섞일 수 있습니다. 정렬·유형별 마스크와 검수가 필요합니다.')]):
    y=211-i*57;text(30,y,title,12,True,color='#a8c8ff');text(30,y-23,body,10)
text(30,47,'현재 추출 방식은 개선 중입니다. Qwen-Image-Layered의 기존 실패 결과는 채택하지 않습니다.',10,color='#ffd59d')
c.showPage()

page(5,'04  미리보기 → 검수 → 선택 적용·저장','결과를 고르는 것과 게임에 적용하는 것은 별도 동작입니다.')
image(SHOTS/'selection.png',30,145,510,350)
points([('미리보기·검수','원본 / 색·명암 보정 / 장식 / 최종 합성을 비교합니다. 위치·윤곽 중복·장식 잘림을 확인합니다.'),
        ('선택 적용','기존 ready 결과는 [결과 선택] 후 [선택한 결과 적용]으로 반영합니다. 새 검수 대기 경로의 승인 UI는 미완성입니다.'),
        ('기록과 재현','원본 해시·라벨·프롬프트·모델 설정·생성 시간·원본 결과·추출 마스크·배치 정보를 함께 저장합니다.')])
text(30,111,'사용자가 검수한 결과만 적용합니다. 원본·이전 실험은 남겨두고 다른 결과를 선택해 비교합니다.',11)
text(30,79,'이 문서 제작 과정에서는 새 FLUX 생성, 게임 적용 또는 기존 결과 변경을 하지 않았습니다.',10,color='#ffd59d')
c.showPage()

page(6,'전체 파이프라인과 현재 구현 상태','단독 오브젝트 인식 방식으로 합의한 목표 설계 / 2026-09-28 기준')
stages=[
('1. 테마 입력','테마·팔레트·명암·장식·시간대 요청','입력 UI 있음 / 의미 기반 계획 연결 필요'),
('2. TMX 추출','원본 이미지·크기·좌표·중복 관계 확보','구현됨 / 복합·조각 추출 보완 필요'),
('3. 단독 오브젝트 인식','Qwen3-VL → 종류·특징 → 라벨 검수·저장','단독 분류 실험 완료 / 운영 연결 필요'),
('4. LLM 개별 계획','라벨 + 테마 → 개별 프롬프트·색·효과 설정','현재 Crypt 경로에는 연결되지 않음'),
('5. 원본 보정 + FLUX','원본은 색·명암만 / 장식 포함 이미지 생성','보정·생성 경로 있음 / 자동 계획 연결 필요'),
('6. 장식 추출·정렬','RGBA 장식만 분리 → 원본 좌표에 합성','실험 중 / 윤곽 혼입·잘림 개선 필요'),
('7. 효과·검수·적용·저장','밤·반짝임 / 미리보기 / 명시적 적용·로그','기존 적용 있음 / 새 경로 승인 UI 보완 필요')]
for i,(a,b,d) in enumerate(stages):
    y=441-i*53
    c.setFillColor('#1c293b');c.roundRect(30,y,782,46,5,fill=1,stroke=0)
    text(42,y+27,a,11,True,color='#a8c8ff');text(223,y+27,b,10);text(223,y+10,d,9,color='#ffd59d')
text(30,85,'핵심 원칙: 원본 구조는 결정적으로 보존하고, 생성 모델의 자유도는 색감 계획과 장식에 한정합니다.',11,True)
text(30,54,'다음 구현: 단독 분류 라벨 검수·저장 → Crypt LLM Planner 연결 → 추출 품질 검증 → 승인·적용 연결',10)
c.showPage();c.save();print(OUT)
