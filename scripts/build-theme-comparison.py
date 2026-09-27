"""Compact, image-first report of the completed nine-edit experiment."""
import json
from pathlib import Path
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from reportlab.lib.colors import HexColor

root=Path(__file__).resolve().parents[1]
runs=root/'public/theme-runs'
record=json.loads((runs/'benchmark-405044eb34ce47739d9b057d7605ac9d/experiment.json').read_text())
assert record['status']=='ready'
out=root/'output/pdf/general-theme-comparison.pdf'
pdfmetrics.registerFont(TTFont('K','C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('B','C:/Windows/Fonts/malgunbd.ttf'))
c=canvas.Canvas(str(out),pagesize=(842,595))
c.setTitle('일반 테마 생성 실험 비교')
labels=['크리스마스','할로윈','심해']
def text(x,y,s,size=11,bold=False):
    c.setFillColor(HexColor('#203148'));c.setFont('B' if bold else 'K',size);c.drawString(x,y,s)
def header(n,title):
    text(32,553,title,22,True)
    text(32,530,'FLUX.1-Kontext-dev / Crypt 1층 폐허마을 / 2026-09-26',10)
    text(32,20,'원본과 모든 실험 기록 보존 · 게임 자동 적용 없음',9)
    text(775,20,f'{n} / 4',9)
def image(path,x,y,w,h):
    im=Image.open(path).convert('RGBA')
    im.thumbnail((int(w),int(h)),Image.Resampling.NEAREST)
    scale=min(w/im.width,h/im.height)
    im=im.resize((max(1,int(im.width*scale)),max(1,int(im.height*scale))),Image.Resampling.NEAREST)
    c.setFillColor(HexColor('#343944'));c.rect(x,y,w,h,fill=1,stroke=0)
    c.drawImage(ImageReader(im),x+(w-im.width)/2,y+(h-im.height)/2,im.width,im.height,mask='auto')
header(1,'일반 테마 실험: 3개 원본 × 3개 테마')
text(32,490,'실험 조건',14,True)
for i,s in enumerate(['동일 원본 prop-00 / prop-15 / prop-24, 테마별 각 1회 생성 (총 9회).',
    '28 steps / guidance 2.5 / 동일 차영상 추출 / 장식 허용 여백 3px.',
    '프롬프트: 눈·전구 / 호박·거미줄 / 보라 산호·파란 따개비. 원본 색·구조 유지 요청.',
    '시드는 서비스가 공개하지 않음. 동일 시드 비교나 반복 통계 실험은 아님.']): text(32,465-i*22,s)
text(32,352,'실측 시간',14,True)
text(32,325,'테마',11,True)
for j,a in enumerate(record['assets']): text(200+j*135,325,a,11,True)
text(655,325,'총 실행 시간',11,True)
for i,r in enumerate(record['runs']):
    text(32,298-i*29,labels[i])
    for j,a in enumerate(record['assets']):
        t=json.loads((runs/r['id']/a/'request-timing.json').read_text())['generation_seconds']
        text(200+j*135,298-i*29,f'{t:.1f}초')
    text(655,298-i*29,f"{r['seconds']/60:.2f}분")
text(32,190,'판단 범위',14,True)
for i,s in enumerate(['관찰: 크리스마스는 눈 표현이 명확. 할로윈은 prop-24의 테마 표현이 약하고 재합성에 원본 무늬가 섞임.',
    '심해 3종은 배경색 변경이 장식으로 추출돼 파란 테두리가 남음. 차영상만으로 장식 분리는 불충분.',
    '원본 알파 보존은 시각적 구조 보존과 다름. 테마 전달은 가능하나 일반 품질 개선은 입증되지 않음.',
    '다음 단계: 배경 변화 배제·정렬 검증을 개선하고, 같은 raw의 추출기 비교 및 반복 실험 진행.']):text(32,164-i*23,s,10)
c.showPage()
for n,a in enumerate(record['assets'],2):
    header(n,f'{a} · 모델 출력과 장식 추출 비교')
    text(32,496,'원본',12,True)
    image(runs/record['runs'][0]['id']/(a+'-original.png'),32,365,140,115)
    text(32,343,'같은 원본으로 3회',10)
    text(32,322,'이미지 비율 유지 확대',9)
    for j,r in enumerate(record['runs']):
        x=198+j*208
        text(x,496,labels[j],13,True)
        for name,y,label in [('flux-raw.png',357,'모델 원본'),('decoration.png',207,'추출 장식'),('composite.png',57,'원본 + 장식')]:
            image(runs/r['id']/a/name,x,y,190,115)
            text(x,y+120,label,10)
        text(x,40,r['id'][:8],8)
    c.showPage()
c.save()
print(out)
