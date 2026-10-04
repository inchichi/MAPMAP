from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from PIL import Image

root=Path(__file__).resolve().parents[1]
shots=root/'docs/screenshots/operator-guide-20260928'
out=root/'output/pdf/editor-step-by-step-20260928.pdf';out.parent.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('KR','C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('KRB','C:/Windows/Fonts/malgunbd.ttf'))
c=canvas.Canvas(str(out),pagesize=(842,595));c.setTitle('Crypt 스타일 에디터 - 실제 화면 단계별 사용법')
pages=[
('01  에디터 열기 · 맵 선택','editor.png',[
'상단 맵 탭에서 마을 또는 1층 폐허 마을을 선택합니다. 왼쪽은 현재 맵 에셋 목록입니다.',
'오른쪽 위 [스타일 변환]은 생성 화면, [장식 켜기/끄기]는 원본과 적용 결과 비교입니다.',
'캡처는 현재 0층 적용 상태입니다. 품질 검수 완료를 의미하지 않습니다.']),
('02  저장된 결과 선택 · 적용','selection.png',[
'게임 아래 [변경 목록]의 결과 선택 상자에서 해당 맵의 저장 결과를 고릅니다.',
'목록 선택은 미리보기만 바꿉니다. 오른쪽 상세에서 원본·결과·장식만을 확인하세요.',
'[선택한 결과 적용]을 눌러야 게임이 바뀝니다. 다른 결과를 선택하면 이전 결과로 복귀할 수 있습니다.']),
('03  새 테마 입력','style.png',[
'1층에서 [스타일 변환]을 열고 테마·시간대·원하는 장식을 구체적으로 적습니다.',
'예: 할로윈 밤, 호박과 거미줄. 문과 창문 위치는 유지. 입력 후 [대상 확인]을 누릅니다.',
'현재 자동 Planner는 1층 경로입니다. 자동 팔레트 해석은 미완성이고 별도 팔레트 실험과 다릅니다.']),
('04  대상 확인 · 생성','plan.png',[
'생성할 오브젝트를 체크합니다. 처음에는 1~2종만 선택해 품질과 시간을 확인하세요.',
'[스타일 생성하기]는 실제 FLUX 작업을 시작합니다. 이번 안내서 캡처에서는 누르지 않았습니다.',
'생성 중 서버를 재시작하지 마세요. 새 유형별 추출은 검수 대기로 끝나며 아직 승인 UI가 없습니다.']),
('05  결과 검수 · 현재 제한','comparison.png',[
'전체 맵과 오브젝트별 원본 → 팔레트 → 장식 합성을 비교합니다. 문·윤곽·장식 잘림을 확인하세요.',
'이 화면은 별도 실험 비교 페이지입니다. 보기만 해서는 게임에 적용되지 않습니다.',
'ready 결과만 에디터에서 적용 가능합니다. Qwen 4레이어 실험은 노이즈 실패로 적용 대상이 아닙니다.'])]
for i,(title,file,lines) in enumerate(pages,1):
    c.setFillColorRGB(.065,.09,.15);c.rect(0,0,842,595,fill=1,stroke=0)
    c.setFillColorRGB(.65,.78,1);c.setFont('KR',9);c.drawString(30,570,'CRYPT / OPERATOR GUIDE / 2026-09-28')
    c.setFillColorRGB(1,1,1);c.setFont('KRB',19);c.drawString(30,540,title)
    im=Image.open(shots/file);w,h=im.size;factor=min(782/w,398/h)
    c.drawImage(ImageReader(im),30+(782-w*factor)/2,129+(398-h*factor)/2,width=w*factor,height=h*factor)
    c.setFont('KR',10);c.setFillColorRGB(.89,.92,.98)
    for j,line in enumerate(lines): c.drawString(30,104-j*20,f'{j+1}. {line}')
    c.setFont('KR',8);c.setFillColorRGB(.65,.72,.82);c.drawString(30,24,'실제 로컬 에디터 캡처 | 원본·기존 실험 보존 | 생성·적용 버튼은 신중히 사용')
    c.drawRightString(812,24,f'{i} / {len(pages)+1}');c.showPage()
c.setFillColorRGB(.065,.09,.15);c.rect(0,0,842,595,fill=1,stroke=0)
c.setFillColorRGB(.65,.78,1);c.setFont('KR',9);c.drawString(30,570,'CRYPT / PIPELINE / 원본 구조 보존형 스타일 변환')
c.setFillColorRGB(1,1,1);c.setFont('KRB',19);c.drawString(30,540,'06  작동 원리 · 생성과 합성을 분리')
steps=[
('01  프롬프트 → 계획', '테마·장식 유형을 규칙으로 분류하고', '대상 오브젝트와 추출 방식을 정합니다.'),
('02  TMX → 원본 추출', '타일을 합쳐 오브젝트를 구성하고', '원본 좌표·크기·투명도를 기준으로 저장합니다.'),
('03  원본 색·명암 보정', '원본 픽셀의 색과 밝기만 조절합니다.', '형태·문·창문·알파는 유지합니다.'),
('04  FLUX → 장식 포함 이미지', '오브젝트 원본과 장식 지시를 입력합니다.', '현재 방식은 장식 단독이 아닌 전체 이미지 생성입니다.'),
('05  장식 추출 → 정렬', '생성본을 원본에 정렬하고 장식 영역을 추출합니다.', '눈·전구는 재질 규칙, 호박 등은 의미 마스크를 실험합니다.'),
('06  레이어 합성 → 검수·저장', '보정된 원본 위에 RGBA 장식을 원래 좌표로 합성합니다.', '크기·겹침·잘림을 검수한 뒤 명시적으로 적용합니다.')]
for j,(heading,a,b) in enumerate(steps):
    y=463-j*57
    c.setFillColorRGB(.105,.145,.22);c.roundRect(30,y,782,50,6,fill=1,stroke=0)
    c.setFillColorRGB(.65,.78,1);c.setFont('KRB',11);c.drawString(43,y+29,heading)
    c.setFillColorRGB(.89,.92,.98);c.setFont('KR',10)
    c.drawString(290,y+30,a);c.drawString(290,y+12,b)
c.setFillColorRGB(.65,.78,1);c.setFont('KRB',11);c.drawString(30,148,'핵심: 최종 화면 = 색·명암 보정 원본 + 투명 장식 레이어 + 시간대·반짝임 효과')
c.setFillColorRGB(.89,.92,.98);c.setFont('KR',10)
for j,line in enumerate([
'차영상은 원본과 생성본의 차이를 장식 후보로 봅니다. FLUX가 원본을 다시 그리면 윤곽까지 섞일 수 있습니다.',
'그래서 좌표 정렬과 유형별 마스크가 필요합니다. 생성 해상도가 높아도 추출 마스크가 틀리면 장식이 깨집니다.',
'현재 한계: 팔레트는 별도 실험, 의미 마스크는 파일럿, 새 추출 결과 승인 UI는 미완성입니다.',
'Qwen 레이어 분해도 시험했지만 현재 결과는 노이즈 실패입니다. 이 페이지는 완성된 자동화 전체를 뜻하지 않습니다.'
]): c.drawString(30,125-j*21,line)
c.setFont('KR',8);c.setFillColorRGB(.65,.72,.82);c.drawString(30,24,'설계 원리와 현재 실험 경로 | 원본 데이터·충돌 좌표 보존 | 생성 품질과 추출 품질을 별도로 검수')
c.drawRightString(812,24,'6 / 6');c.showPage()
c.save()
print(out)
import fitz
qa=root/'tmp/pdfs/operator-guide';qa.mkdir(parents=True,exist_ok=True)
doc=fitz.open(out)
for i,p in enumerate(doc): p.get_pixmap(matrix=fitz.Matrix(1,1)).save(qa/f'page-{i+1}.png')
