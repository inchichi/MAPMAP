"""Crypt 16px source extraction and recorded FLUX pilot; no town approval reuse."""
import json, sys, uuid, time, hashlib
import xml.etree.ElementTree as ET
from pathlib import Path
import numpy as np
from PIL import Image
from theme_pipeline import ROOT, REPO, save_status, FLUX
from object_decorations import request_image, extract_attached


def prepare():
    folder=ROOT/uuid.uuid4().hex;folder.mkdir()
    path=REPO/'public/crypt-maps/floor-0-town.tmx';m=ET.parse(path).getroot()
    tsx=(path.parent/m.find('tileset').get('source')).resolve();ts=ET.parse(tsx).getroot()
    png=tsx.parent/ts.find('image').get('source');atlas=Image.open(png).convert('RGBA')
    tw=int(m.get('tilewidth'));mw=int(m.get('width'));mh=int(m.get('height'));cols=int(ts.get('columns'));first=int(m.find('tileset').get('firstgid'))
    original=Image.new('RGBA',(mw*tw,mh*tw));props=Image.new('RGBA',original.size);occupied=set()
    for layer in m.findall('layer'):
        if layer.get('name')=='collision':continue
        for i,raw in enumerate(int(v) for v in layer.find('data').text.split(',') if v.strip()):
            if not raw:continue
            tid=(raw&0x1fffffff)-first;x=i%mw;y=i//mw
            tile=atlas.crop((tid%cols*tw,tid//cols*tw,(tid%cols+1)*tw,(tid//cols+1)*tw))
            if raw&0x20000000:tile=tile.transpose(Image.Transpose.TRANSPOSE)
            if raw&0x80000000:tile=tile.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            if raw&0x40000000:tile=tile.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
            original.alpha_composite(tile,(x*tw,y*tw))
            if layer.get('name')=='prop':props.alpha_composite(tile,(x*tw,y*tw));occupied.add((x,y))
    original.save(folder/'original-map.png');objects=[]
    while occupied:
        stack=[occupied.pop()];points=[]
        while stack:
            x,y=stack.pop();points.append((x,y))
            for p in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                if p in occupied:occupied.remove(p);stack.append(p)
        xs,ys=zip(*points);box=[min(xs)*tw,min(ys)*tw,(max(xs)+1)*tw,(max(ys)+1)*tw]
        w,h=box[2]-box[0],box[3]-box[1]
        if len(points)<4 or max(w,h)>384:continue
        objects.append({'box':box,'tiles':len(points)})
    objects.sort(key=lambda o:(o['box'][1],o['box'][0]))
    for i,o in enumerate(objects):
        o['id']=f'object-{i:02d}';props.crop(tuple(o['box'])).save(folder/(o['id']+'-original.png'))
    (folder/'sources.json').write_text(json.dumps({'objects':objects,'hashes':{str(p.relative_to(REPO)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [path,tsx,png]}},indent=2),encoding='utf8')
    save_status(folder,{'id':folder.name,'mapId':'floor-0-town','pipeline':'crypt-christmas-pilot','status':'awaiting_review','stage':2,'created':time.time(),'prompt':'크리스마스 밤, 눈, 따뜻한 전구, 반짝임','original':f'/theme-runs/{folder.name}/original-map.png','warnings':['Crypt 전용 추출 검수 단계. 게임 미적용.']})
    print(folder.name,json.dumps(objects),flush=True)
    return folder.name


def generate(run_id, object_id):
    folder=ROOT/run_id;target=folder/object_id;target.mkdir(exist_ok=True)
    status=json.loads((folder/'status.json').read_text(encoding='utf8'))
    status.update(status='running',stage=4,current_object=object_id);save_status(folder,status)
    try:
        source=Image.open(folder/(object_id+'-original.png')).convert('RGBA')
        scale=min(4,640//max(source.size));scaled=source.resize((source.width*scale,source.height*scale),Image.Resampling.NEAREST)
        canvas=Image.new('RGB',(scaled.width+64,scaled.height+64),'#808080');canvas.paste(scaled,(32,32),scaled)
        prompt='Add Christmas decorations attached to this pixel-art object: soft thick snow caps with shaded edges, warm round golden bulbs on connected dark cables, small evergreen garlands and red ribbon. Keep exact silhouette, roof shape, doors, windows, supports, proportions and layout unchanged. No new architecture, no background decorations, no cast shadows. Gray background.'
        raw=request_image(target,canvas,prompt,FLUX,1.0,pipeline='crypt-christmas-pilot')
        aligned=raw.resize(canvas.size,Image.Resampling.LANCZOS).crop((32,32,32+scaled.width,32+scaled.height)).resize(source.size,Image.Resampling.LANCZOS)
        aligned.save(target/'aligned.png')
        overlay=extract_attached(source,aligned,'building',['snow','lights','garland'])
        overlay.save(target/'decoration.png');Image.alpha_composite(source,overlay).save(folder/'preview.png')
        status.update(status='awaiting_review',stage=5,preview=f'/theme-runs/{run_id}/preview.png',original=f'/theme-runs/{run_id}/{object_id}-original.png',warnings=['대표 오브젝트 FLUX 생성 완료. 구조·장식 추출 검수 필요. 게임 미적용.'])
    except Exception as error:
        status.update(status='failed',error=str(error))
        raise
    finally:save_status(folder,status)


if __name__=='__main__':
    if len(sys.argv)==1:prepare()
    else:generate(sys.argv[1],sys.argv[2])
