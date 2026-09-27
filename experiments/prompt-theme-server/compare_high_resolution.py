"""Reprocess saved model output without generation or changing active game selection."""
import html,json,uuid
from pathlib import Path
from PIL import Image
from ruins_decoration_margin import extract

root=Path(__file__).resolve().parents[2]/'public/theme-runs'
experiment=json.loads((root/'benchmark-405044eb34ce47739d9b057d7605ac9d/experiment.json').read_text())
out=root/('resolution-'+uuid.uuid4().hex);out.mkdir()
cards=[];records=[]
for run in experiment['runs']:
    for asset in experiment['assets']:
        source=Image.open(root/run['id']/(asset+'-original.png')).convert('RGBA')
        raw=Image.open(root/run['id']/asset/'flux-raw.png')
        base,deco,placement=extract(source,raw,generic=True,high_resolution=True)
        name=run['theme']+'-'+asset
        deco.save(out/(name+'-decoration.png'))
        Image.alpha_composite(base,deco).save(out/(name+'-composite.png'))
        records.append(dict(source_run=run['id'],asset=asset,texture_size=list(deco.size),**placement))
        w,h=placement['display_width'],placement['display_height']
        low=f'../{run["id"]}/{asset}/composite.png'
        high=name+'-composite.png'
        cards.append(f'<article><h2>{html.escape(name)}</h2><div class="pair"><figure><img width="{w*5}" height="{h*5}" src="{low}"><figcaption>기존: 저해상도 후 확대</figcaption></figure><figure><img width="{w*5}" height="{h*5}" src="{high}"><figcaption>고해상도 유지 · 같은 표시 크기</figcaption></figure></div><p>게임 좌표 크기 {w}×{h}, 텍스처 {deco.width}×{deco.height}</p></article>')
(out/'metadata.json').write_text(json.dumps(records,indent=2),encoding='utf8')
(out/'review.html').write_text('<!doctype html><meta charset="utf-8"><title>해상도 비교</title><style>body{background:#141b27;color:#eee;font:16px sans-serif;padding:24px}main{display:flex;flex-wrap:wrap;gap:18px}article{background:#253044;padding:18px;border-radius:12px}.pair{display:flex}figure{margin:8px}img{object-fit:contain;image-rendering:pixelated;background:#343944}figcaption{font-size:13px;margin-top:10px}</style><h1>동일 생성 원본: 장식 해상도 비교</h1><p>재생성 없음 · 게임 미적용 · 비교 이미지는 논리 크기의 5배로 표시. 배경 혼입과 구조 오인식은 별개의 미해결 문제.</p><main>'+''.join(cards)+'</main>',encoding='utf8')
print(out)
