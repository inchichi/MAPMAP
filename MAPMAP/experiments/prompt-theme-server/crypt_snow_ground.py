"""Add snow/ice ground materials while retaining prior Crypt decorations."""
import json,hashlib,shutil,sys,time,uuid
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image
from theme_pipeline import REPO,ROOT,FLUX,save_status
from object_decorations import request_image
from run_records import record_event

def prepare():
    parent=json.loads((REPO/'public/crypt-style/active.json').read_text(encoding='utf8'))
    for name,digest in parent['source_hashes'].items():
        assert hashlib.sha256((REPO/name).read_bytes()).hexdigest()==digest
    folder=ROOT/uuid.uuid4().hex;folder.mkdir()
    m=ET.parse(REPO/'public/crypt-maps/floor-0-town.tmx').getroot();w=int(m.get('width'));h=int(m.get('height'))
    tsx=(REPO/'public/crypt-maps'/m.find('tileset').get('source')).resolve();ts=ET.parse(tsx).getroot()
    atlas=Image.open(tsx.parent/ts.find('image').get('source')).convert('RGBA');cols=int(ts.get('columns'));first=int(m.find('tileset').get('firstgid'))
    def tile(raw):
        tid=(raw&0x1fffffff)-first
        img=atlas.crop((tid%cols*16,tid//cols*16,(tid%cols+1)*16,(tid//cols+1)*16))
        if raw&0x20000000:img=img.transpose(Image.Transpose.TRANSPOSE)
        if raw&0x80000000:img=img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        if raw&0x40000000:img=img.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        return img
    layers={}
    for l in m.findall('layer'):
        if l.get('name') not in ['ground','ground_deco','prop']:continue
        ids=[int(v) for v in l.find('data').text.split(',') if v.strip()];layers[l.get('name')]=ids
        image=Image.new('RGBA',(w*16,h*16))
        for i,raw in enumerate(ids):
            if raw:image.alpha_composite(tile(raw),(i%w*16,i//w*16))
        image.save(folder/(l.get('name')+'-source.png'))
    ids=[1204]+sorted(set(layers['ground_deco'])-{0});sheet=Image.new('RGB',(512,512),'#808080');variants=[]
    for i,raw in enumerate(ids):
        name='snow-ground' if i==0 else f'ice-{raw}';source=tile(raw);source.save(folder/(name+'-original.png'))
        x=i%4*128+16;y=i//4*128+16;big=source.resize((96,96),Image.Resampling.NEAREST);sheet.paste(big,(x,y),big)
        variants.append({'id':name,'gid':raw,'x':x,'y':y})
    sheet.save(folder/'flux-input.png')
    shutil.copy2(ROOT/parent['id']/'original-map.png',folder/'original-map.png')
    shutil.copy2(ROOT/parent['id']/'preview.png',folder/'previous-preview.png')
    shutil.copy2(ROOT/parent['id']/'decoration-map.png',folder/'inherited-decoration.png')
    spec={'parent':parent,'variants':variants,'ground_deco':layers['ground_deco'],'width':w,'height':h}
    (folder/'sources.json').write_text(json.dumps(spec),encoding='utf8')
    status={'id':folder.name,'mapId':'floor-0-town','pipeline':'crypt-snow-ground-v1','parent_run_id':parent['id'],'status':'queued','total_objects':len(variants),'completed_objects':0,'instances':sum(bool(v) for v in layers['ground_deco']),'prompt':'하얗게 눈 쌓인 잔디 바닥 · 꽃과 풀은 서리와 얼음 결정 질감 · 흙길 및 기존 장식 유지'}
    save_status(folder,status);print(folder.name,flush=True)

def run(run_id):
    folder=ROOT/run_id;spec=json.loads((folder/'sources.json').read_text(encoding='utf8'));status=json.loads((folder/'status.json').read_text(encoding='utf8'))
    lock=ROOT/'.batch.lock'
    with lock.open('x') as handle:handle.write(run_id)
    try:
        status.update(status='running');save_status(folder,status)
        target=folder/'snow-ice-sheet';target.mkdir(exist_ok=True)
        if not (target/'flux-raw.png').exists():
            request_image(target,Image.open(folder/'flux-input.png'),'Turn grass squares into white powder snow. Transform flowers and grass tufts into pale cyan ice sculptures with crystalline facets and white frost highlights. Preserve every sprite silhouette, position and size in this sprite sheet. Keep the solid gray background unchanged. Pixel art. No extra objects or text.',FLUX,1.0,pipeline='crypt-snow-ground-v1')
        compose(folder,spec,status)
    except Exception as error:
        status.update(status='failed',error=str(error));save_status(folder,status);raise
    finally:lock.unlink(missing_ok=True)

def compose(folder,spec,status):
    raw=Image.open(folder/'snow-ice-sheet/flux-raw.png').convert('RGB').resize((512,512),Image.Resampling.LANCZOS)
    tiles={}
    for v in spec['variants']:
        source=Image.open(folder/(v['id']+'-original.png')).convert('RGBA');s=np.array(source).astype(float)
        patch=raw.crop((v['x'],v['y'],v['x']+96,v['y']+96)).resize((16,16),Image.Resampling.LANCZOS)
        a=np.array(patch).astype(float);lum=a.mean(2)/255;original=s[:,:,:3].mean(2)/255
        if v['id']=='snow-ground':
            lum=np.clip((lum-lum.mean())*.04+.90,.87,.94)
            rgb=np.stack((lum*237,lum*246,lum*255),axis=2)
        else:
            # Original alpha/outlines preserve tiny petals; generated luminance supplies frost facets.
            lum=np.clip(lum*.6+original*.4,0,1)
            rgb=np.stack((35+lum*185,115+lum*140,180+lum*75),axis=2)
            highlights=np.clip((lum-.82)/.18,0,1)[:,:,None]
            rgb=rgb*(1-highlights)+np.array([245,252,255])*highlights
            outline=original<.16;rgb[outline]*=.55
        out=Image.fromarray(np.dstack((np.clip(rgb,0,255).astype('uint8'),s[:,:,3].astype('uint8'))));tiles[v['gid']]=out
        target=folder/v['id'];target.mkdir(exist_ok=True);out.save(target/'composite.png')
    ground=np.array(Image.open(folder/'ground-source.png').convert('RGBA')).astype(float)
    props=np.array(Image.open(folder/'prop-source.png').convert('RGBA'))[:,:,3]
    deco=np.array(Image.open(folder/'ground_deco-source.png').convert('RGBA'))[:,:,3]
    r,g,b=ground[:,:,:3].transpose(2,0,1);grass=(g>r*1.05)&(g>b*1.2)
    snow=np.tile(np.array(tiles[1204]),(spec['height'],spec['width'],1))
    # Bright snow with cool evening shadows; leave soil paths and all prop pixels untouched.
    snow[:,:,:3]=(snow[:,:,:3].astype(float)*np.array([.88,.91,.96])).astype('uint8')
    snow[:,:,3]=np.where(grass,255,0).astype('uint8')
    snow[:,:,3]=np.minimum(snow[:,:,3],255-props);snow[:,:,3]=np.minimum(snow[:,:,3],255-deco)
    surface=Image.fromarray(snow);surface.save(folder/'snow-surface.png')
    frozen=Image.new('RGBA',surface.size)
    for i,gid in enumerate(spec['ground_deco']):
        if gid:frozen.alpha_composite(tiles[gid],(i%spec['width']*16,i//spec['width']*16))
    # Ground-level decorations cannot cover foreground props.
    fa=np.array(frozen);fa[:,:,3]=np.minimum(fa[:,:,3],255-props);frozen=Image.fromarray(fa);frozen.save(folder/'frozen-plants.png')
    overlay=Image.alpha_composite(surface,frozen);overlay=Image.alpha_composite(overlay,Image.open(folder/'inherited-decoration.png').convert('RGBA'));overlay.save(folder/'decoration-map.png')
    parent=spec['parent'];original=Image.open(folder/'original-map.png').convert('RGBA')
    preview=Image.alpha_composite(original,Image.new('RGBA',original.size,(12,23,58,round(parent['night']*255))))
    Image.alpha_composite(preview,overlay).save(folder/'preview.png')
    manifest={**parent,'id':folder.name,'overlay':f'/theme-runs/{folder.name}/decoration-map.png','parent_run_id':parent['id'],'frozen_plant_instances':sum(bool(v) for v in spec['ground_deco'])}
    (folder/'crypt-manifest.json').write_text(json.dumps(manifest),encoding='utf8')
    validation={'source_hashes_unchanged':all(hashlib.sha256((REPO/k).read_bytes()).hexdigest()==v for k,v in parent['source_hashes'].items()),'ground_does_not_cover_props':bool(np.all(snow[:,:,3][props==255]==0)),'soil_path_preserved':bool(np.all(snow[:,:,3][~grass]==0)),'plant_alpha_preserved':True,'snow_pixels':int((snow[:,:,3]>0).sum())}
    for v in spec['variants']:
        assert np.array_equal(np.array(tiles[v['gid']])[:,:,3],np.array(Image.open(folder/(v['id']+'-original.png')))[:,:,3])
    assert all(validation[k] for k in ['source_hashes_unchanged','ground_does_not_cover_props','soil_path_preserved'])
    (folder/'validation.json').write_text(json.dumps(validation,indent=2),encoding='utf8')
    status.update(status='awaiting_review',completed_objects=len(spec['variants']),preview=f'/theme-runs/{folder.name}/preview.png')
    save_status(folder,status);record_event(folder,'snow_ground_composed',**validation)
    write_review(folder,spec)
    print('COMPLETED',folder.name,flush=True)

def write_review(folder,spec):
    cards=''.join(f'<article><h3>{v["id"]}</h3><img src="{v["id"]}-original.png" alt="원본"><img src="{v["id"]}/composite.png" alt="눈 또는 얼음 질감"></article>' for v in spec['variants'])
    html='''<!doctype html><html lang="ko"><meta charset="utf-8"><title>Crypt · 눈 바닥과 얼음 식물</title><style>body{background:#182231;color:#edf4fc;font:16px system-ui;margin:24px}a{color:#f5ce8a}.maps{display:grid;grid-template-columns:1fr 1fr;gap:20px}.maps img{width:100%;image-rendering:pixelated}article{background:#2a374a;padding:18px;border-radius:10px}article img{width:45%;height:120px;object-fit:contain;image-rendering:pixelated}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}h1{font-size:28px}@media(max-width:700px){.maps{grid-template-columns:1fr}}</style><h1>눈 쌓인 잔디 · 얼어붙은 꽃과 풀</h1><p>FLUX 질감 생성 → 원본 타일 크기·윤곽에 맞춤 → 기존 크리스마스 장식 보존. 흙길·충돌은 그대로 유지합니다.</p><p><a href="snow-ice-sheet/generation.json">생성 프롬프트·설정</a> · <a href="snow-ice-sheet/request-timing.json">생성 시간</a> · <a href="validation.json">검증 기록</a></p><div class="maps"><section><h2>이전 적용 결과</h2><img src="previous-preview.png" alt="이전"></section><section><h2>눈 바닥과 얼음 식물 추가</h2><img src="preview.png" alt="최종"></section></div><h2>원본 / 변환 타일</h2><div class="cards">'''+cards+'''</div><h2>생성 입력 / FLUX 원본 출력</h2><div class="maps"><img src="flux-input.png" alt="생성 입력"><img src="snow-ice-sheet/flux-raw.png" alt="FLUX 출력"></div></html>'''
    (folder/'review.html').write_text(html,encoding='utf8')

if __name__=='__main__':
    if len(sys.argv)==1:prepare()
    else:run(sys.argv[1])
