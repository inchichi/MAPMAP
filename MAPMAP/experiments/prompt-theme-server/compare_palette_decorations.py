"""Explicit Halloween palette experiment; reuse FLUX, never overwrite/apply runs."""
import json, hashlib, shutil, time, uuid
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from registered_decoration import extract_registered

PALETTE = {'warm': [[25,19,49],[89,56,139],[167,140,196]],
           'green': [[13,25,39],[34,73,81],[111,148,149]],
           'neutral': [[17,20,39],[61,67,103],[139,150,186]]}


def recolor(source):
    a=np.array(source.convert('RGBA'));rgb=a[:,:,:3].astype(float)
    lum=rgb @ np.array([.2126,.7152,.0722])/255
    r,g,b=rgb.transpose(2,0,1)
    green=(g>r*1.06)&(g>b*1.12)
    warm=(r>b*1.2)&~green
    out=a.copy()
    for name,mask in [('green',green),('warm',warm),('neutral',~(green|warm))]:
        dark,mid,light=np.array(PALETTE[name])
        t=lum[:,:,None]
        mapped=np.where(t<.5,dark+(mid-dark)*t*2,mid+(light-mid)*(t-.5)*2)
        out[:,:,:3][mask]=np.round(mapped[mask]).astype('uint8')
    out[a[:,:,3]==0]=a[a[:,:,3]==0]
    return Image.fromarray(out)


def main():
    repo=Path(__file__).resolve().parents[2]
    parent=repo/'public/theme-runs/14108377af854127a990463f567719c0'
    folder=parent.parent/uuid.uuid4().hex;folder.mkdir()
    spec=json.loads((parent/'sources.json').read_text(encoding='utf8'))
    for p,h in spec['hashes'].items():
        assert hashlib.sha256((repo/p).read_bytes()).hexdigest()==h
    original=Image.open(parent/'original-map.png').convert('RGBA')
    colored=recolor(original);final=colored.copy()
    original.save(folder/'original-map.png');colored.save(folder/'palette-map.png')
    sheet=Image.new('RGB',(1200,300*len(spec['variants'])),'#222735');draw=ImageDraw.Draw(sheet)
    reports={};cards=[]
    for row,v in enumerate(spec['variants']):
        name=v['id'];target=folder/name;target.mkdir()
        source=Image.open(parent/f'{name}-original.png').convert('RGBA');tinted=recolor(source)
        source.save(target/'original.png');tinted.save(target/'palette.png')
        for f in ['flux-input.png','flux-raw.png','generation.json','request-timing.json']:
            shutil.copy2(parent/name/f,target/f)
        assert np.array_equal(np.array(source.getchannel('A')),np.array(tinted.getchannel('A')))
        try:
            base,deco,placement,report=extract_registered(source,Image.open(target/'flux-raw.png'))
            display_source=base.copy()
            base=recolor(base);display_tinted=base.copy();combined=Image.alpha_composite(base,deco)
            deco.save(target/'decoration.png')
            (target/'placement.json').write_text(json.dumps(placement),encoding='utf8')
            small=deco.resize((placement['display_width'],placement['display_height']),Image.Resampling.LANCZOS)
            for inst in spec['instances']:
                if inst['asset']==name: final.alpha_composite(small,(inst['x']+placement['x'],inst['y']+placement['y']))
            report['decoration_applied']=report['kept_pixels']>0
        except ValueError as error:
            combined=tinted.copy();report={'decoration_applied':False,'rejected':str(error)}
            display_source=source;display_tinted=tinted
        display_source.save(target/'display-original.png');display_tinted.save(target/'display-palette.png')
        combined.save(target/'composite.png');reports[name]=report
        for col,(label,img) in enumerate([('ORIGINAL',display_source),('PALETTE',display_tinted),('FINAL',combined)]):
            img=img.copy();factor=min(4*source.width/img.width,360/img.width,240/img.height)
            img=img.resize((int(img.width*factor),int(img.height*factor)),Image.Resampling.NEAREST)
            sheet.paste(img,(col*400+20,row*300+40),img)
            draw.text((col*400+20,row*300+12),name+' / '+label,fill='white')
        note='장식 합성 (보수적 추출로 일부 잘릴 수 있음)' if report['decoration_applied'] else '장식 제외: 정렬 불안정 또는 추출 없음'
        cards.append(f'<h3>{name} · {note}</h3><div class="grid">'+''.join(f'<figure><img src="{name}/{file}.png"><figcaption>{label}</figcaption></figure>' for file,label in [('display-original','원본'),('display-palette','팔레트 변경'),('composite','장식 포함 비교 결과')])+'</div>')
    final.save(folder/'preview.png');sheet.save(folder/'comparison.png')
    def save(name,data): (folder/name).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
    save('palette.json',PALETTE);save('validation.json',dict(source_hashes_unchanged=True,original_alpha_preserved=True,assets=reports))
    count=sum(r['decoration_applied'] for r in reports.values())
    save('status.json',dict(id=folder.name,mapId='floor-0-town',pipeline='palette-decoration-comparison-v1',status='awaiting_review',created=time.time(),parent_run_id=parent.name,total_objects=len(reports),completed_objects=len(reports),prompt='할로윈 보라·청록 팔레트 + 기존 FLUX 장식 재추출 비교',decorated_objects=count))
    html=f'<meta charset="utf-8"><title>할로윈 최종 합성 비교</title><style>body{{background:#151b29;color:#e3e8ff;font:16px sans-serif;padding:24px}}.grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}}figure{{margin:0;background:#262e40;padding:16px}}img{{max-width:100%;image-rendering:pixelated}}h3{{margin-top:36px}}</style><h1>원본 → 팔레트 변경 → 장식 합성</h1><p>9종 중 {count}종 장식 합성. 검증 실패 장식은 제외했습니다. 기존 FLUX 결과 재사용 / 게임 미적용 / 외곽 장식 손실 문제는 남아 있습니다.</p><h2>전체 맵</h2><div class="grid">'+''.join(f'<figure><a href="{f}.png"><img src="{f}.png"></a><figcaption>{label}</figcaption></figure>' for f,label in [('original-map','원본'),('palette-map','팔레트 변경'),('preview','장식 합성')])+'</div>'+''.join(cards)
    (folder/'comparison.html').write_text(html,encoding='utf8')
    print(json.dumps({'run':folder.name,'decorated':count,'total':len(reports)}))


if __name__=='__main__':main()
