"""Isolate TMX families, generate attached decorations, retain connected material shading."""
import json
import numpy as np
from PIL import Image,ImageFilter
from theme_pipeline import sources
from profile_decorations import profile_masks,grow
from object_decorations import request_image


def isolate(obj):
    m,ts,atlas,_=sources();tw=int(m.get('tilewidth'));th=int(m.get('tileheight'));mw=int(m.get('width'))
    cols=int(ts.get('columns'));first=int(m.find('tileset').get('firstgid'));x,y,w,h=obj['box']
    out=Image.new('RGBA',(w,h));types={int(t.get('id')):t.get('type','') for t in ts.findall('tile')}
    family={'building':{'roof','chimney','gable','window','wall','market','clocktower','stairs','door','ladder'},
            'tree':{'tree','stump','bush'},'fountain':{'fountain'},'lamp':{'streetlamp','clocktower'},
            'flower':{'planter','flower'},'prop':{'barrel','basket','bucket','planter','flower','crate'}}[obj['category']]
    for layer in m.findall('layer'):
        if layer.get('visible','1')=='0' or layer.get('name') in ['ground','shadow_lower','shadow_upper']:continue
        gids=[int(v) for v in layer.find('data').text.replace('\n','').split(',') if v.strip()]
        for i,raw in enumerate(gids):
            px=(i%mw)*tw;py=(i//mw)*th
            if not raw or px<x or py<y or px>=x+w or py>=y+h:continue
            tid=(raw&0x1fffffff)-first;name=types.get(tid,'')
            fountain_edges={'chimney_double_shadow','chimney_single_shadow'}
            included=name.split('_')[0] in family
            # These two canopy tiles have prop/lamp labels in the current TSX.
            if obj['category']=='tree' and name in {'town_prop_325','streetlamp_unlit_top_02'}:included=True
            if obj['category']=='building':included=(included and name not in fountain_edges) or name.startswith('flower_box')
            if obj['id']=='town_hall' and name.startswith('ground_pit_large_bottom'):included=True
            if obj['category']=='fountain' and name in fountain_edges:included=True
            if not included or name=='wall_cobble_fill':continue
            tile=atlas.crop(((tid%cols)*tw,(tid//cols)*th,(tid%cols+1)*tw,(tid//cols+1)*th))
            if raw&0x20000000:tile=tile.transpose(Image.Transpose.TRANSPOSE)
            if raw&0x80000000:tile=tile.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            if raw&0x40000000:tile=tile.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
            out.alpha_composite(tile,(px-x,py-y))
    if not out.getbbox():raise ValueError('No isolated source tiles: '+obj['id'])
    return out


def generate(folder,original,obj,p,flux):
    source=Image.new('RGB',tuple(p['canvas']),'#808080');scale=p['scale'];ox,oy=p['offset']
    scaled=original.resize((original.width*scale,original.height*scale),Image.Resampling.NEAREST);source.paste(scaled,(ox,oy),scaled)
    label='market stall' if p['kind']=='stall' else p['kind']
    prompt=f'Add Christmas decorations to this {label}: thick soft snow caps with shaded edges, warm round bulbs on connected cables, evergreen garlands and a red ribbon. Attach decorations to its surfaces, not the background. Keep its shape, doors, windows and supports unchanged. Pixel art, gray background, no cast shadows.'
    if obj['id']=='town_hall':
        from replay_attached_building import PROMPT
        prompt=PROMPT
    raw=request_image(folder,source,prompt,flux,1.0,pipeline='town-attached-materials-v2')
    raw=raw.resize(source.size,Image.Resampling.LANCZOS)
    aligned=raw.crop((ox,oy,ox+scaled.width,oy+scaled.height)).resize(original.size,Image.Resampling.LANCZOS)
    aligned.save(folder/'aligned-reference.png')
    rgb=np.array(aligned).astype(float);ref=np.array(original).astype(float);r,g,b=rgb.transpose(2,0,1)
    regions,protected=profile_masks(original,p);opaque=ref[:,:,3]>200
    delta=np.max(np.abs(rgb-ref[:,:,:3]),2);lo=rgb.min(2);hi=rgb.max(2)
    snow=grow((lo>185)&(hi-lo<45)&regions['snow']&(delta>20),regions['snow']&(delta>12)&(lo>65)&((hi-lo)/np.maximum(hi,1)<.45),32)
    warm=(r>155)&(g>80)&(b<145)&(r>g*1.08)&(delta>20)
    lights=grow(warm&regions['lights'],regions['lights']&(delta>14)&((hi<120)|warm),20)
    ornaments=grow(regions['garland']&(delta>25)&((g>r*1.18)|(r>g*1.55))&(hi-lo>55),regions['garland']&(delta>15)&(hi-lo>30),16)
    overlay=Image.fromarray(np.dstack((rgb.astype('uint8'),np.where((snow|lights|ornaments)&opaque&~protected,ref[:,:,3],0).astype('uint8'))))
    relocated=0
    if lights.sum()<8:
        # Reuse actual FLUX bulb pixels where the generated strand missed the source surface.
        material=warm&~protected;visited=np.zeros(material.shape,bool);components=[]
        for yy,xx in zip(*np.where(material)):
            if visited[yy,xx]:continue
            stack=[(yy,xx)];visited[yy,xx]=True;points=[]
            while stack:
                cy,cx=stack.pop();points.append((cy,cx))
                for ny,nx in [(cy-1,cx),(cy+1,cx),(cy,cx-1),(cy,cx+1)]:
                    if 0<=ny<material.shape[0] and 0<=nx<material.shape[1] and material[ny,nx] and not visited[ny,nx]:visited[ny,nx]=True;stack.append((ny,nx))
            if 4<=len(points)<=120:components.append(points)
        if components:
            points=max(components,key=len);ys,xs=zip(*points);x0,x1=min(xs),max(xs)+1;y0,y1=min(ys),max(ys)+1
            a=np.zeros((y1-y0,x1-x0),dtype='uint8')
            for yy,xx in points:a[yy-y0,xx-x0]=255
            bulb=Image.fromarray(np.dstack((rgb[y0:y1,x0:x1].astype('uint8'),a)));bulb.save(folder/'relocated-bulb.png')
            region=regions['lights']&opaque&~protected
            for x in range(6,original.width-3,24 if original.width>128 else 16):
                ys=np.flatnonzero(region[:,x])
                if len(ys):
                    y=int(ys[len(ys)//2]);overlay.alpha_composite(bulb,(x-bulb.width//2,y-bulb.height//2));relocated+=1
    a=np.array(overlay);a[:,:,3]=np.minimum(a[:,:,3],ref[:,:,3].astype('uint8'));a[protected,3]=0;overlay=Image.fromarray(a)
    overlay.save(folder/'decoration.png');Image.alpha_composite(original,overlay).save(folder/'composite.png')
    counts={'snow':int(snow.sum()),'lights':int(lights.sum()),'garland':int(ornaments.sum()),'relocated_bulbs':relocated}
    (folder/'extraction.json').write_text(json.dumps(counts,indent=2),encoding='utf8')
    if (a[:,:,3]>0).sum()<4:raise ValueError('No usable decoration pixels')
    if (a[:,:,3]>0).sum()>opaque.sum()*.65:raise ValueError('Excessive overlay coverage')
    return overlay,counts
