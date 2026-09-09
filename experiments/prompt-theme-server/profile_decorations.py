"""Explicit source-object profiles; generated pixels are located anew per run."""
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from object_decorations import request_image

PROFILE_PATH=Path(__file__).with_name('decoration_profiles.json')
VERSION='object-profiles-v1'


def profiles():
    return json.loads(PROFILE_PATH.read_text(encoding='utf8'))['objects']


def get_profile(obj):
    p=profiles().get(obj['id'])
    if not p:raise ValueError(obj['id']+': 맞춤 설정이 없습니다. 먼저 영역·좌표를 등록해주세요.')
    if p['box']!=obj['box']:raise ValueError(obj['id']+': TMX 위치/크기가 변경됐습니다. 맞춤 설정을 다시 검수해주세요.')
    return p


def rectangles(size, boxes):
    image=Image.new('L',size);draw=ImageDraw.Draw(image)
    for x0,y0,x1,y1 in boxes:draw.rectangle((x0,y0,x1-1,y1-1),fill=255)
    return np.array(image)>0


def profile_masks(original,p):
    if list(original.size)!=p['box'][2:]:raise ValueError('Profile source size mismatch')
    a=np.array(original).astype(float);r,g,b,alpha=a.transpose(2,0,1)
    opaque=alpha>200;size=original.size;w,h=size
    protected=rectangles(size,p['protected_rects'])
    if p['kind']=='building':
        area=Image.new('L',size);draw=ImageDraw.Draw(area)
        for polygon in p['snow_polygons']:draw.polygon([tuple(v) for v in polygon],fill=255)
        snow=(np.array(area)>0)&opaque&(b>r*1.15)&(b>g*1.02)
        line=Image.new('L',size);draw=ImageDraw.Draw(line)
        for path in p['eaves']:draw.line([tuple(v) for v in path],fill=255,width=p['light_band'])
        lights=(np.array(line)>0)&opaque
        ornaments=rectangles(size,[p['ornament_rect']])&opaque
    elif p['kind']=='tree':
        snow=opaque&(g>r*1.05)&(g>b*1.12)&rectangles(size,[p['foliage_rect']])
        lights=np.array(Image.fromarray((snow*255).astype('uint8')).filter(ImageFilter.MaxFilter(5)))>0
        lights&=opaque;ornaments=lights
    elif p['kind']=='fountain':
        yy,xx=np.indices((h,w));cx,cy,rx,ry=p['rim']
        distance=((xx-cx)/rx)**2+((yy-cy)/ry)**2
        rim=(distance>p['rim_range'][0])&(distance<p['rim_range'][1])
        stone=opaque&(np.abs(r-g)<22)&(np.abs(g-b)<22)&(a[:,:,:3].min(2)>70)
        snow=stone&(rim|rectangles(size,[p['cap']]))
        lights=opaque&(distance>.78)&(distance<1.65)&(yy>h*.22)&(yy<h*.87)
        ornaments=lights
    else:
        snow=rectangles(size,[p['snow_rect']]);lights=rectangles(size,[p['wire_rect']]);ornaments=lights
    return {k:v&~protected for k,v in {'snow':snow,'lights':lights,'garland':ornaments}.items()},protected


def grow(seed,candidate,steps):
    mask=seed.copy()
    for _ in range(steps):
        expanded=np.array(Image.fromarray((mask*255).astype('uint8')).filter(ImageFilter.MaxFilter(3)))>0
        next_mask=mask|(expanded&candidate)
        if np.array_equal(next_mask,mask):break
        mask=next_mask
    return mask


def extract_profile(original,generated,p,names):
    regions,protected=profile_masks(original,p)
    rgb=np.array(generated.convert('RGB')).astype(float);ref=np.array(original).astype(float)
    r,g,b=rgb.transpose(2,0,1);low=rgb.min(2);high=rgb.max(2)
    delta=np.max(np.abs(rgb-ref[:,:,:3]),axis=2)
    mask=np.zeros(low.shape,bool);counts={}
    for name in names:
        region=regions[name]
        if name=='snow':
            seed=(low>185)&((high-low)<45)&(delta>24)&region
            candidate=(low>65)&((high-low)/np.maximum(high,1)<.4)&(delta>15)&region
        elif name=='lights':
            seed=(r>165)&(g>85)&(b<135)&(r>g*1.12)&(delta>24)&region
            nearby=grow(seed,region,2)
            # Retain sockets/cables connected to bulbs, rather than yellow pixels only.
            seed=nearby&((high<100)|seed)
            candidate=region&(delta>18)&((high<100)|((r>150)&(g>75)&(b<140)))
        else:
            seed=region&(delta>24)&((g>r*1.15)|(r>g*1.5))&((high-low)>60)
            candidate=region&(delta>18)&((high-low)>30)
        selected=grow(seed,candidate,32)&region&~protected
        counts[name]=int(selected.sum());mask|=selected
    a=np.where(mask,ref[:,:,3],0).astype('uint8')
    return Image.fromarray(np.dstack((rgb.astype('uint8'),a))),regions,protected,counts


def generate_profile(folder,original,obj,spec,flux,key_strip):
    p=get_profile(obj)
    unsupported=set(spec['decorations'])-set(p['supported'])
    if unsupported:raise ValueError(obj['id']+': 장식 설정 없음: '+', '.join(sorted(unsupported)))
    source=Image.new('RGB',tuple(p['canvas']),(128,128,128))
    scaled=original.resize((original.width*p['scale'],original.height*p['scale']),Image.Resampling.NEAREST)
    source.paste(scaled,tuple(p['offset']),scaled)
    labels={'snow':'thin settled snow caps with shaded edges','lights':'Christmas bulb strings with their connecting cables','garland':'evergreen wreaths and garlands'}
    names=spec['decorations']
    if p['mode']=='attached':
        prompt=f'Keep this {p["kind"]} at exactly the same position, size and shape. Add only '+', '.join(labels[k] for k in names)+f'. Placement guide for requested decorations: {p["placement_prompt"]}. Theme: {spec["theme"]}. Pixel art, solid gray background, no new objects, no cast shadows.'
    else:
        source=Image.new('RGB',tuple(p['canvas']),'magenta');source.paste(scaled,tuple(p['offset']),scaled)
        prompt=f'Replace the stall with {len(names)} separate horizontal pixel-art decoration strips: '+ '; '.join(labels[k] for k in names)+'. Solid magenta background. No stall, no cloth, no shadows, no text.'
    snapshot=dict(p,profile_version=VERSION,source_rgba_sha256=hashlib.sha256(original.tobytes()).hexdigest())
    (folder/'profile.json').write_text(json.dumps(snapshot,ensure_ascii=False,indent=2),encoding='utf8')
    raw=request_image(folder,source,prompt,flux,p['strength'],pipeline=VERSION)
    if p['mode']=='attached':
        canvas=raw.resize(tuple(p['canvas']),Image.Resampling.LANCZOS)
        ox,oy=p['offset'];sw,sh=scaled.size
        aligned=canvas.crop((ox,oy,ox+sw,oy+sh)).resize(original.size,Image.Resampling.LANCZOS)
        aligned.save(folder/'aligned-reference.png')
        overlay,regions,protected,counts=extract_profile(original,aligned,p,names)
    else:
        overlay=Image.new('RGBA',original.size);regions,protected=profile_masks(original,p);counts={}
        for i,name in enumerate(names):
            strip=key_strip(raw.crop((0,i*raw.height//len(names),raw.width,(i+1)*raw.height//len(names))),name)
            strip.save(folder/(name+'-strip.png'))
            x0,y0,x1,y1=p['snow_rect'] if name=='snow' else p['wire_rect']
            # Preserve the material's aspect ratio; repeat rather than stretch wires.
            if name=='snow':tile=strip.resize((x1-x0,y1-y0),Image.Resampling.NEAREST)
            else:
                tile=strip.copy();tile.thumbnail((x1-x0,y1-y0),Image.Resampling.LANCZOS)
            for x in range(x0,x1,tile.width):
                piece=tile.crop((0,0,min(tile.width,x1-x),tile.height))
                overlay.alpha_composite(piece,(x,y0))
            counts[name]=int(np.count_nonzero(np.array(tile)[:,:,3]))
        a=np.array(overlay);a[protected,3]=0;overlay=Image.fromarray(a)
    for name,region in regions.items():Image.fromarray((region*255).astype('uint8')).save(folder/(name+'-region.png'))
    Image.fromarray((protected*255).astype('uint8')).save(folder/'protected-region.png')
    overlay.save(folder/'decoration.png');Image.alpha_composite(original,overlay).save(folder/'composite.png')
    (folder/'extraction.json').write_text(json.dumps({'counts':counts,'profile':obj['id'],'automatic_quality_approved':False},indent=2))
    missing=[name for name,count in counts.items() if count<4]
    if missing:raise ValueError(obj['id']+': 추출 부족 ('+', '.join(missing)+'). 원본 생성·마스크를 확인하세요.')
    if np.count_nonzero(np.array(overlay)[:,:,3])>original.width*original.height*.5:
        raise ValueError(obj['id']+': 과도한 장식 면적. 검수 후 설정을 조정하세요.')
    return overlay
