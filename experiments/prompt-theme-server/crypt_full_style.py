"""Recorded whole-town decoration pass with high-resolution material extraction."""
import hashlib,json,shutil,time,uuid,sys
import xml.etree.ElementTree as ET
from pathlib import Path
import numpy as np
from PIL import Image,ImageFilter
from theme_pipeline import ROOT,REPO,FLUX,save_status
from object_decorations import request_image
from run_records import record_event

PILOT='0950597acc8648d180c6b0c24ecf3d62'

def tree_source(m,pattern):
    tsx=(REPO/'public/crypt-maps'/m.find('tileset').get('source')).resolve()
    ts=ET.parse(tsx).getroot();atlas=Image.open(tsx.parent/ts.find('image').get('source')).convert('RGBA')
    cols=int(ts.get('columns'));first=int(m.find('tileset').get('firstgid'))
    source=Image.new('RGBA',(pattern.shape[1]*16,pattern.shape[0]*16))
    for y in range(pattern.shape[0]):
        for x in range(pattern.shape[1]):
            raw=int(pattern[y,x]);tid=(raw&0x1fffffff)-first
            if not raw:continue
            tile=atlas.crop((tid%cols*16,tid//cols*16,(tid%cols+1)*16,(tid//cols+1)*16))
            if raw&0x20000000:tile=tile.transpose(Image.Transpose.TRANSPOSE)
            if raw&0x80000000:tile=tile.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            if raw&0x40000000:tile=tile.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
            source.alpha_composite(tile,(x*16,y*16))
    return source

def extract_material(source, aligned, kind):
    """Detect fine materials before downsampling; never overwrite doors/trunks."""
    ref=np.array(source.resize(aligned.size,Image.Resampling.NEAREST)).astype(float)
    rgb=np.array(aligned.convert('RGB')).astype(float);r,g,b=rgb.transpose(2,0,1)
    delta=np.abs(rgb-ref[:,:,:3]).max(2);hi=rgb.max(2);lo=rgb.min(2)
    snow=(lo>155)&(hi-lo<55)&(delta>24)
    lights=(r>210)&(g>145)&(b<155)&(r>g*1.05)&(delta>30)
    green=(g>r*1.2)&(g>b*1.15)&(hi-lo>35)&(delta>25)
    if kind=='tree':
        # A regenerated green canopy is not a garland. Keep the original leaves.
        bulb_near=np.array(Image.fromarray(np.where(lights,255,0).astype('uint8')).filter(ImageFilter.MaxFilter(max(1,round(aligned.width/source.width))*6+1)))>0
        green &= bulb_near&(r<90)&(g<150)
    # Retain dark cable/garland edges near generated colors, not just yellow dots.
    radius=max(1,round(aligned.width/source.width))
    near=np.array(Image.fromarray(np.where(lights|green,255,0).astype('uint8')).filter(ImageFilter.MaxFilter(radius*2+1)))>0
    cable=near&(hi<125)&(delta>25)
    opaque=ref[:,:,3]>200
    # Snow is a new decoration: permit a two-native-pixel cap around the source
    # silhouette, but never expand the canvas or allow grey background through.
    snow_margin=np.array(Image.fromarray(np.where(opaque,255,0).astype('uint8')).filter(ImageFilter.MaxFilter(radius*4+1)))>0
    mask=((snow|lights|green|cable)&opaque)|(snow&snow_margin)
    limit=.62 if kind=='house' else .8 if kind=='tree' else .45 if kind=='prop' else 1
    mask[int(mask.shape[0]*limit):]=False
    out=Image.fromarray(np.dstack((rgb.astype('uint8'),np.where(mask,255,0).astype('uint8')))).resize(source.size,Image.Resampling.LANCZOS)
    a=np.array(out)
    allowed=np.array(source.getchannel('A').filter(ImageFilter.MaxFilter(5)))
    a[:,:,3]=np.minimum(a[:,:,3],allowed)
    a[int(source.height*limit):,:,3]=0
    return Image.fromarray(a)

def prepare():
    folder=ROOT/uuid.uuid4().hex;folder.mkdir()
    parent=ROOT/PILOT
    sources=json.loads((parent/'sources.json').read_text(encoding='utf8')) if (parent/'sources.json').exists() else None
    if not sources or any(hashlib.sha256((REPO/name).read_bytes()).hexdigest()!=digest for name,digest in sources['hashes'].items()):
        from crypt_christmas import prepare as prepare_sources
        parent=ROOT/prepare_sources();sources=json.loads((parent/'sources.json').read_text(encoding='utf8'))
    original=Image.open(parent/'original-map.png').convert('RGBA');original.save(folder/'original-map.png')
    m=ET.parse(REPO/'public/crypt-maps/floor-0-town.tmx').getroot();mw=int(m.get('width'))
    grid=np.array([int(v) for v in m.find("layer[@name='prop']/data").text.split(',') if v.strip()]).reshape(-1,mw)
    variants=[];cache={};instances=[]
    for o in sources['objects']:
        src=Image.open(parent/(o['id']+'-original.png')).convert('RGBA');kind='house' if src.height>20 else 'fence'
        key=hashlib.sha256(src.tobytes()).hexdigest()
        if key not in cache:
            name=o['id'];cache[key]=name;src.save(folder/(name+'-original.png'))
            variants.append({'id':name,'kind':kind,'width':src.width,'height':src.height})
        instances.append({'asset':cache[key],'x':o['box'][0],'y':o['box'][1]})
    for x0,name in [(0,'tree-round'),(2,'tree-pine')]:
        pattern=grid[:2,x0:x0+2]
        src=tree_source(m,pattern);src.save(folder/(name+'-original.png'))
        variants.append({'id':name,'kind':'tree','width':32,'height':32})
        for y in range(0,grid.shape[0]-1,2):
            for x in range(0,grid.shape[1]-1,2):
                if np.array_equal(grid[y:y+2,x:x+2],pattern):instances.append({'asset':name,'x':x*16,'y':y*16})
    remaining=grid.copy()
    for p in instances:
        v=next(v for v in variants if v['id']==p['asset']);x,y=p['x']//16,p['y']//16
        remaining[y:y+v['height']//16,x:x+v['width']//16]=0
    pending=set(zip(*np.where(remaining!=0)))
    while pending:
        stack=[pending.pop()];points=[]
        while stack:
            y,x=stack.pop();points.append((y,x))
            for p in [(y-1,x),(y+1,x),(y,x-1),(y,x+1)]:
                if p in pending:pending.remove(p);stack.append(p)
        ys,xs=zip(*points);x,y=min(xs),min(ys);name=f'prop-{x}-{y}'
        source=tree_source(m,remaining[y:max(ys)+1,x:max(xs)+1]);source.save(folder/(name+'-original.png'))
        variants.append({'id':name,'kind':'prop','width':source.width,'height':source.height})
        instances.append({'asset':name,'x':x*16,'y':y*16})
    spec={'variants':variants,'instances':instances,'hashes':sources['hashes']}
    (folder/'sources.json').write_text(json.dumps(spec,indent=2),encoding='utf8')
    status={'id':folder.name,'mapId':'floor-0-town','pipeline':'crypt-full-style-v1','status':'queued','stage':2,'created':time.time(),'prompt':'크리스마스 밤 · 눈 · 따뜻한 전구 · 가랜드 · 반짝임','object_results':{v['id']:{'status':'pending'} for v in variants},'total_objects':len(variants),'instances':len(instances),'original':f'/theme-runs/{folder.name}/original-map.png'}
    save_status(folder,status)
    print(folder.name,json.dumps(variants),len(instances),flush=True)
    return folder.name

def run(run_id):
    folder=ROOT/run_id;spec=json.loads((folder/'sources.json').read_text(encoding='utf8'));status=json.loads((folder/'status.json').read_text(encoding='utf8'))
    lock=ROOT/'.batch.lock'
    with lock.open('x') as handle:handle.write(run_id)
    try:
        for v in spec['variants']:
            name=v['id'];target=folder/name;target.mkdir(exist_ok=True)
            source=Image.open(folder/(name+'-original.png')).convert('RGBA')
            timer=time.perf_counter();status.update(status='running',stage=4,current_object=name)
            status['object_results'][name]={'status':'running','started_at':time.time()};save_status(folder,status)
            rawpath=target/'flux-raw.png';scale=6;offset=32
            scaled=source.resize((source.width*scale,source.height*scale),Image.Resampling.NEAREST)
            canvas=Image.new('RGB',(scaled.width+64,scaled.height+64),'#808080');canvas.paste(scaled,(offset,offset),scaled)
            reused=(name=='object-00' and (ROOT/PILOT/'object-00/flux-raw.png').exists()
                    and Image.open(ROOT/PILOT/'object-00-original.png').convert('RGBA').tobytes()==source.tobytes())
            if reused:
                # Re-extract the original FLUX pilot without another GPU request.
                shutil.copy2(ROOT/PILOT/'object-00/flux-raw.png',rawpath)
                for filename in ['generation.json','request-timing.json','flux-input.png']:
                    shutil.copy2(ROOT/PILOT/'object-00'/filename,target/filename)
                scale=4;scaled=source.resize((source.width*scale,source.height*scale),Image.Resampling.NEAREST)
                canvas=Image.new('RGB',(scaled.width+64,scaled.height+64),'#808080')
                record_event(folder,'reuse',asset=name,parent_run_id=PILOT)
            elif not rawpath.exists():
                prompt=f'Add Christmas snow caps, warm golden bulbs on dark connected cables, and green garlands to this pixel-art {v["kind"]}. Preserve its exact silhouette, layout, doors, windows and supports. Keep decorations attached to upper surfaces. Gray background. No new architecture or cast shadows.'
                request_image(target,canvas,prompt,FLUX,1.0,pipeline='crypt-full-style-v1')
            raw=Image.open(rawpath).convert('RGB').resize(canvas.size,Image.Resampling.LANCZOS)
            aligned=raw.crop((32,32,32+scaled.width,32+scaled.height));aligned.save(target/'aligned-high.png')
            overlay=extract_material(source,aligned,v['kind']);overlay.save(target/'decoration.png')
            Image.alpha_composite(source,overlay).save(target/'composite.png')
            if not overlay.getbbox():raise ValueError('Empty decoration '+name)
            status['object_results'][name]={'status':'ready','source_available':True,'elapsed_seconds':time.perf_counter()-timer,'finished_at':time.time(),'reused_from':PILOT if reused else None}
            timing=target/'request-timing.json'
            if timing.exists():status['object_results'][name]['generation_seconds']=json.loads(timing.read_text())['generation_seconds']
            status['completed_objects']=sum(r['status']=='ready' for r in status['object_results'].values());save_status(folder,status)
            print('DONE',name,flush=True)
        finalize(folder,spec,status)
    except Exception as error:
        status.update(status='failed',error=str(error));save_status(folder,status);raise
    finally:lock.unlink(missing_ok=True)

def finalize(folder,spec,status):
    original=Image.open(folder/'original-map.png').convert('RGBA');overlay=Image.new('RGBA',original.size);bulbs=[]
    for p in spec['instances']:
        deco=Image.open(folder/p['asset']/'decoration.png').convert('RGBA');overlay.alpha_composite(deco,(p['x'],p['y']))
        a=np.array(deco);warm=(a[:,:,0]>205)&(a[:,:,1]>135)&(a[:,:,2]<170)&(a[:,:,3]>90)
        ys,xs=np.where(warm)
        for x,y in zip(xs[::4],ys[::4]):bulbs.append([int(p['x']+x),int(p['y']+y)])
    overlay.save(folder/'decoration-map.png')
    # Static bulbs remain in the image; animate a bounded, distributed subset.
    bulbs=bulbs[::max(1,(len(bulbs)+511)//512)]
    night=Image.alpha_composite(original,Image.new('RGBA',original.size,(12,23,58,130)))
    Image.alpha_composite(night,overlay).save(folder/'preview.png')
    manifest={'id':folder.name,'mapId':'floor-0-town','width':original.width,'height':original.height,'night':.51,'overlay':f'/theme-runs/{folder.name}/decoration-map.png','bulbs':bulbs,'source_hashes':{k.replace('\\','/'):v for k,v in spec['hashes'].items()},'instances':len(spec['instances']),'geometry_preserved':True,'collision_preserved':True}
    (folder/'crypt-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
    status.update(status='awaiting_review',stage=7,preview_revision=time.time(),preview=f'/theme-runs/{folder.name}/preview.png',warnings=['전체 맵 변환 완료 · Crypt 전용 검증 대기 · 미적용'])
    save_status(folder,status)

if __name__=='__main__':
    if len(sys.argv)==1:prepare()
    else:run(sys.argv[1])
