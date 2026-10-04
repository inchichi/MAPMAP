"""Reprocess three saved examples without overwriting or applying any run."""
import json, shutil, time, uuid
from pathlib import Path
from PIL import Image, ImageDraw
from registered_decoration import extract_registered

ROOT = Path(__file__).resolve().parents[2]/'public/theme-runs'


def main():
    parent = ROOT/'14108377af854127a990463f567719c0'
    folder = ROOT/uuid.uuid4().hex
    folder.mkdir()
    names = ['object-00','object-02','prop-column']
    sheet = Image.new('RGB',(1200,960),'#30343b')
    draw = ImageDraw.Draw(sheet)
    reports = {}
    for row,name in enumerate(names):
        target = folder/name
        target.mkdir()
        for file in ['flux-input.png','flux-raw.png','generation.json','request-timing.json']:
            shutil.copy2(parent/name/file,target/file)
        shutil.copy2(parent/f'{name}-original.png',folder/f'{name}-original.png')
        source = Image.open(parent/f'{name}-original.png').convert('RGBA')
        try:
            base,deco,placement,report = extract_registered(source,Image.open(target/'flux-raw.png'))
        except ValueError as error:
            reports[name] = {'rejected':str(error)}
            for col,file in enumerate([target/'flux-input.png',target/'flux-raw.png']):
                img=Image.open(file).convert('RGB');img.thumbnail((290,275),Image.Resampling.NEAREST)
                sheet.paste(img,(col*300+(300-img.width)//2,row*320+35))
            draw.text((10,row*320+10),f'{name} / INPUT',fill='white')
            draw.text((310,row*320+10),'GENERATED',fill='white')
            draw.text((610,row*320+10),'REJECTED: structural drift',fill='white')
            continue
        deco.save(target/'decoration.png')
        composite = Image.alpha_composite(base,deco)
        composite.save(target/'composite.png')
        (target/'placement.json').write_text(json.dumps(placement),encoding='utf8')
        reports[name] = report
        for col,(label,img) in enumerate([('ORIGINAL',base),('OLD',Image.open(parent/name/'composite.png')),('CANDIDATE',composite),('MASK',deco)]):
            img=img.convert('RGBA');img.thumbnail((290,275),Image.Resampling.NEAREST)
            x=col*300+(300-img.width)//2;y=row*320+35+(275-img.height)//2
            sheet.paste(img,(x,y),img)
            draw.text((col*300+10,row*320+10),f'{name} / {label}',fill='white')
    sheet.save(folder/'comparison.png')
    (folder/'validation.json').write_text(json.dumps(reports,indent=2),encoding='utf8')
    (folder/'status.json').write_text(json.dumps(dict(id=folder.name,mapId='floor-0-town',pipeline='registered-decoration-review-v1',status='awaiting_review',created=time.time(),parent_run_id=parent.name,total_objects=3,completed_objects=3,rejected_objects=sum('rejected' in r for r in reports.values()),prompt='Registration and conservative extraction review; not applied')),encoding='utf8')
    (folder/'comparison.html').write_text('<meta charset="utf-8"><title>장식 추출 비교</title><body style="background:#20242b;color:white;font:16px sans-serif"><h1>원본 / 기존 / 개선 후보 / 장식만</h1><p>3종 재추출 실험. 외곽 장식은 보수적으로 제외. 게임 미적용.</p><img src="comparison.png" style="max-width:100%">',encoding='utf8')
    print(folder)


if __name__ == '__main__': main()
