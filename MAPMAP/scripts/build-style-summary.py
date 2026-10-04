"""Three-page illustrated summary; retains the longer guide separately."""
from pathlib import Path
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor

root = Path(__file__).resolve().parents[1]
assets = root / 'docs/screenshots/style-guide'
out = root / 'output/pdf/style-editor-summary.pdf'
pdfmetrics.registerFont(TTFont('K', 'C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('KB', 'C:/Windows/Fonts/malgunbd.ttf'))
style = ParagraphStyle('body', fontName='K', fontSize=10, leading=16, wordWrap='CJK', textColor=HexColor('#34445a'))
c = canvas.Canvas(str(out), pagesize=(595,842))
c.setTitle('스타일 에디터 핵심 가이드')

def page(n, title, sub):
    c.setFillColor(HexColor('#111b2c')); c.rect(0,728,595,114,fill=1,stroke=0)
    c.setFillColor(HexColor('#a8c5ff'));c.setFont('K',10);c.drawString(40,810,'KONG / STYLE EDITOR')
    c.setFillColor(HexColor('#ffffff'));c.setFont('KB',23);c.drawString(40,775,title)
    c.setFont('K',10);c.drawString(40,748,sub)
    c.setFillColor(HexColor('#8290a4'));c.setFont('K',9);c.drawString(40,26,'2026-09-26 · Crypt 1층 폐허마을 · yc0153/kong / style');c.drawRightString(555,26,f'{n} / 3')

def text(y, title, content):
    c.setFillColor(HexColor('#182c4b'));c.setFont('KB',12);c.drawString(40,y,title)
    p=Paragraph(content,style);_,h=p.wrap(515,600);p.drawOn(c,40,y-12-h)
    return y-12-h-20

def picture(name, x, top, w, h, pixels=False):
    im=Image.open(assets/name).convert('RGBA')
    if pixels: im=im.resize((im.width*8,im.height*8),Image.Resampling.NEAREST)
    scale=min(w/im.width,h/im.height); iw,ih=im.width*scale,im.height*scale
    c.drawImage(ImageReader(im),x+(w-iw)/2,top-ih,iw,ih,mask='auto')
    return top-ih

page(1,'기능과 원리','원본은 유지하고, 색감과 장식으로 분위기를 바꿉니다')
y=text(697,'핵심 기능','프롬프트 해석 · 대상 선택 · FLUX 장식 생성 · 원본/결과 비교 · 게임 적용 · 원본 보기 · 실험 기록')
y=text(y,'변환 흐름','TMX 원본·좌표 → 규칙 기반 DSL·Planner → 색·명암 보정 또는 FLUX 생성 → 장식 RGBA 추출 → 원래 좌표에 합성 → 검수 후 적용')
for i,(file,label) in enumerate([('prop-original.png','원본'),('prop-decoration.png','장식만'),('prop-composite.png','합성 결과')]):
    x=40+175*i
    c.setFillColor(HexColor('#182334'));c.roundRect(x,338,165,165,10,fill=1,stroke=0)
    picture(file,x+20,483,125,125,True)
    c.setFillColor(HexColor('#34445a'));c.setFont('K',10);c.drawString(x+12,320,label)
y=text(285,'구조는 보존, 장식은 별도','형태·문·창문·베이스 알파·충돌 좌표를 유지합니다. 장식에만 3px 여백을 허용하고 좌표를 보정합니다. 같은 소품은 한 번 생성해 여러 위치에 재사용합니다. 위 이미지는 실제 prop-00 저장 결과의 확대본입니다.')
text(y,'현재 지원 범위','FLUX.1-Kontext-dev를 사용하며, 현재 자동 경로는 크리스마스/겨울의 눈·전구·고정 색 보정입니다. 소품 그룹은 TMX 기반이며 SAM 의미 분류가 아닙니다. 다양한 테마와 집·나무 자동 분류는 아직 미지원입니다.')
c.showPage()
page(2,'실제 화면과 사용법','화면 캡처 · 완료된 2종 실행 기준')
bottom=picture('style-workspace.png',40,702,515,300)
y=text(bottom-25,'01  입력·생성','스타일 변환 → 프롬프트 입력 → 대상 확인 → 오브젝트 선택 → 스타일 생성하기.<br/>예: “크리스마스 밤. 원본 색은 그대로 두고 눈과 전구를 추가하고 반짝이게 해줘.”')
y=text(y,'02  검수·적용','진행률과 변경 목록을 확인하고 원본·결과·장식을 비교한 뒤 게임에 적용하기를 누릅니다. 승인 전에는 게임이 바뀌지 않습니다. 장식 스위치로 원본과 비교하고 이전 실험 기록에서 과거 결과를 엽니다.')
text(y,'실행 준비','git lfs pull → npm ci → Python 의존성 설치 → 보관된 1층 결과 복원.<br/>FLUX 주소 설정 후 npm run theme:dev, 별도 터미널에서 npm run dev -- --port 15174를 실행합니다. 상세 명령은 README를 참고하세요. 생성 중에는 Python 서버를 재시작하지 마세요.')
c.showPage()
page(3,'게임 적용 결과와 현재 상태','실제 게임 에디터 캡처 · 신규 45종 완료 결과가 아닙니다')
bottom=picture('editor.png',40,702,515,405)
y=text(bottom-25,'완료한 것','개선된 장식 2종·126곳 적용, 원본 보기·새로고침 유지 확인. Python 78개·배치 저장 12개 테스트와 빌드 통과. 자동 검사에서 추출 오브젝트/선택 장식 겹침·맵 경계 잘림 0건.')
y=text(y,'남은 것','신규 45종·1,193곳 배치는 마지막 기록 13/45이며 재개·완료 미확인입니다. 완료 후 전체 품질 검수·게임 적용·백업이 필요합니다. 벽·캐릭터 가림과 미적 품질은 자동 검사 범위 밖입니다.')
text(y,'결과 보존','입력·프롬프트·이미지·시간·로그를 실행별로 보존하고 재처리는 새 ID를 만듭니다. 신규 실행 폴더는 Git 제외입니다. 사용자 지정 실패만 별도 보관 대상이며, 서버 자동 축소 보관은 아직 미구현입니다.')
c.save()
print(out)
