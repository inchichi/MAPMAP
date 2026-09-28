"""Town-only, crop-only VLM planning with explicit visual approval."""
import base64
import hashlib
import io
import json
import os
import re
import time
import uuid
from pathlib import Path
import numpy as np
import requests
from PIL import Image
from pydantic import BaseModel, Field
from typing import Literal

PIPELINE='town-vision-v1'
KINDS=['building','tree','fountain','stall','lamp','flower','container','fence','column','prop','unknown']


class Recognition(BaseModel):
    kind: Literal['building','tree','fountain','stall','lamp','flower','container','fence','column','prop','unknown']
    label: str = Field(min_length=1,max_length=120)
    features: list[str] = Field(max_length=8)
    composition: Literal['single','multiple','fragment','uncertain']


class Direction(BaseModel):
    theme: str = Field(min_length=1,max_length=100)
    palette: list[str] = Field(min_length=3,max_length=6)
    recolor_strength: float = Field(ge=0,le=.7)
    brightness: float = Field(ge=.55,le=1.2)
    night: bool
    twinkle: bool
    decorations: list[str] = Field(max_length=6)


def save(folder,name,data):
    (folder/name).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')


def read(folder,name):
    return json.loads((folder/name).read_text(encoding='utf8'))


def infer(prompt, image=None):
    body={'prompt':prompt,'max_tokens':700}
    if image is not None:
        buffer=io.BytesIO();image.save(buffer,format='PNG');body['image']=base64.b64encode(buffer.getvalue()).decode()
    response=requests.post(os.environ.get('THEME_VISION_URL','http://127.0.0.1:18776')+'/generate',json=body,timeout=180)
    response.raise_for_status();raw=response.json()['text'];value=raw.strip()
    if value.startswith('```'):value=value.split('\n',1)[1].rsplit('```',1)[0]
    return json.loads(value),raw


def palette_color(source,direction):
    """Luminance-ranked palette blend; RGB only, exact source alpha and size."""
    a=np.array(source.convert('RGBA'));rgb=a[:,:,:3].astype(float)/255
    colors=np.array([[int(s[i:i+2],16)/255 for i in (1,3,5)] for s in direction['palette']])
    colors=colors[np.argsort(colors@np.array([.2126,.7152,.0722]))]
    lum=rgb@np.array([.2126,.7152,.0722]);position=lum*(len(colors)-1)
    lo=np.floor(position).astype(int);hi=np.minimum(lo+1,len(colors)-1);mix=(position-lo)[:,:,None]
    mapped=colors[lo]*(1-mix)+colors[hi]*mix
    strength=direction['recolor_strength']
    a[:,:,:3]=np.uint8(np.clip((rgb*(1-strength)+mapped*strength)*direction['brightness'],0,1)*255)
    return Image.fromarray(a)


def plan(prompt):
    from theme_pipeline import ROOT,catalog,layers,sources,save_status
    from profile_decorations import profiles
    from town_attached_materials import isolate
    folder=ROOT/uuid.uuid4().hex;folder.mkdir()
    status={'id':folder.name,'mapId':'town','pipeline':PIPELINE,'prompt':prompt,'status':'planning','stage':1,'created':time.time()}
    save_status(folder,status)
    try:
        direction,raw=infer('Convert the user theme into JSON ONLY with theme (English), palette (3-6 #RRGGBB colors), '
            'recolor_strength (0-0.7; 0 if no recolor requested), brightness (0.55-1.2), night (boolean), '
            'twinkle (boolean, only for requested blinking lights), decorations (English names of requested additions). '
            'Honor negations. Do not default to Christmas. User request: '+prompt)
        save(folder,'direction-response.json',{'raw':raw})
        direction=Direction.model_validate(direction).model_dump()
        if not all(re.fullmatch('#[a-fA-F0-9]{6}',s) for s in direction['palette']):raise ValueError('Invalid palette')
        original,_,_,hashes=layers({'gain':[1,1,1],'bias':[0,0,0]});original.save(folder/'original-map.png')
        cache=ROOT/'recognition-cache-v1';cache.mkdir(exist_ok=True)
        rows=[];objects=[];configured=profiles()
        selected=[o for o in catalog() if o['id'] in configured]
        for index,obj in enumerate(selected):
            status.update(current_object=obj['id'],completed_objects=index,total_objects=len(selected));save_status(folder,status)
            source=isolate(obj);source.save(folder/f'{obj["id"]}-original.png')
            source_hash=hashlib.sha256(source.tobytes()+str(source.size).encode()).hexdigest()
            key=cache/f'{source_hash}.json'
            if key.exists():record=read(cache,key.name);label=Recognition.model_validate(record['label']).model_dump()
            else:
                enlarged=source.copy();scale=max(1,min(8,512//max(source.size)))
                enlarged=enlarged.resize((source.width*scale,source.height*scale),Image.Resampling.NEAREST)
                canvas=Image.new('RGB',enlarged.size,'#808080');canvas.paste(enlarged,(0,0),enlarged)
                label,raw=infer('Classify only this isolated pixel-art object. No map context. Return JSON ONLY: '
                    'kind (one of '+','.join(KINDS)+'), label (short English), features (up to 6 visible facts), '
                    'composition (single, multiple, fragment, uncertain). Tree means a woody tree; flower includes pots of flowers. '
                    'Do not invent function. Use unknown when unclear. Multiple touching objects must be multiple.',canvas)
                record={'label':Recognition.model_validate(label).model_dump(),'raw':raw,'model':'Qwen3-VL-8B-Instruct',
                        'source_hash':source_hash,'created':time.time(),'reviewed':False}
                save(cache,key.name,record);label=record['label']
            safe=label['composition']=='single' and label['kind']!='unknown'
            edit_prompt='';action='skip'
            if safe:
                value,raw=infer('Write a single English FLUX image-editing instruction as JSON {"prompt":"..."}. '
                    'Add only requested attached decorations appropriate to the object. Preserve exact silhouette, scale, position, '
                    'doors, windows, openings, supports and original colors; recoloring is done separately. '
                    'Keep plain gray background. No text or cast shadows. No unrequested theme. '
                    'Decoration theme: '+direction['theme']+'\nRequested additions ONLY: '+json.dumps(direction['decorations'])+
                    '\nDo NOT recolor, darken, relight or change contrast of the object. '
                    'Night and palette changes are separate renderer operations. Object evidence: '+json.dumps(label))
                edit_prompt=value.get('prompt','')
                if not isinstance(edit_prompt,str) or not 10<len(edit_prompt)<2500:raise ValueError('Invalid object prompt')
                edit_prompt+=' Final constraints: preserve all original object colors, lighting, geometry and framing. Add decorations only; do not recolor or darken the original object.'
                save(folder,f'{obj["id"]}-prompt-response.json',{'raw':raw})
                action='decorate' if direction['decorations'] else 'recolor'
            rows.append({'asset':obj['id'],'kind':label['kind'],'action':action,'prompt':edit_prompt,'candidates':1,
                         'instances':1,'reason':label['label'],'recognition':label,'source_hash':source_hash})
            objects.append(dict(obj,profile_label=f'{obj["id"]} · {label["label"]} · {label["composition"]}',eligible=safe,
                                image=f'/theme-runs/{folder.name}/{obj["id"]}-original.png',recognition=label))
        save(folder,'plan.json',rows);save(folder,'objects.json',objects)
        save(folder,'labels.json',{r['source_hash']:{'kind':r['kind'],'by':'model:Qwen3-VL-8B-Instruct',
             'at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())} for r in rows})
        dsl=dict(direction,parser='llm:Qwen3-VL-8B-Instruct',source_text=prompt,target_maps=['town'],
                 color={'gain':[1,1,1],'bias':[0,0,0]},warnings=['분류·프롬프트를 확인하고 대상을 선택하세요. 복합·미확인 대상은 제외됩니다.'])
        save(folder,'dsl.json',dsl);save(folder,'source-hashes.json',hashes)
        status.update(status='planned',stage=2,completed_objects=len(rows),spec=dsl);save_status(folder,status)
        return {'id':folder.name,'spec':dsl,'objects':objects,'plan':rows}
    except Exception as exc:
        status.update(status='failed',error=str(exc));save_status(folder,status);raise


def prepare(plan_id,targets):
    from theme_pipeline import ROOT,sources,save_status
    import shutil
    if not re.fullmatch('[a-f0-9]{32}',plan_id):raise ValueError('Invalid plan id')
    parent=ROOT/plan_id
    if read(parent,'status.json')['status']!='planned':raise ValueError('Not a reviewed plan candidate')
    if read(parent,'source-hashes.json')!=sources()[3]:raise ValueError('TMX changed; plan again')
    rows=[r for r in read(parent,'plan.json') if r['asset'] in targets]
    if not targets or len(set(targets))!=len(targets) or len(rows)!=len(targets) or any(r['action']=='skip' for r in rows):
        raise ValueError('Select only recognized single objects')
    folder=ROOT/uuid.uuid4().hex;folder.mkdir()
    for name in ['dsl.json','source-hashes.json','objects.json','labels.json','original-map.png']:
        shutil.copy2(parent/name,folder/name)
    for row in rows:shutil.copy2(parent/f'{row["asset"]}-original.png',folder/f'{row["asset"]}-original.png')
    save(folder,'plan.json',rows)
    save_status(folder,{'id':folder.name,'mapId':'town','pipeline':PIPELINE,'status':'queued','stage':3,
        'created':time.time(),'parent_run_id':plan_id,'prompt':read(parent,'dsl.json')['source_text'],
        'spec':read(parent,'dsl.json'),'completed_objects':0,'total_objects':len(rows)})
    return folder.name


def run(run_id):
    from theme_pipeline import ROOT,FLUX,save_status,sources
    from object_decorations import request_image
    from registered_decoration import extract_registered
    from profile_decorations import get_profile,extract_profile
    folder=ROOT/run_id;status=read(folder,'status.json');dsl=read(folder,'dsl.json');rows=read(folder,'plan.json')
    original=Image.open(folder/'original-map.png').convert('RGBA')
    colors=Image.new('RGBA',original.size);decorations=Image.new('RGBA',original.size)
    objects={o['id']:o for o in read(folder,'objects.json')};errors=[];results={}
    try:
        for row in rows:
            name=row['asset'];target=folder/name;target.mkdir();obj=objects[name];x,y,w,h=obj['box']
            status.update(status='running',current_object=name,stage=4);save_status(folder,status)
            source=Image.open(folder/f'{name}-original.png').convert('RGBA');corrected=palette_color(source,dsl)
            if source.size!=corrected.size or source.getchannel('A').tobytes()!=corrected.getchannel('A').tobytes():raise ValueError('Source alpha changed')
            corrected.save(target/'recolor.png');overlay=Image.new('RGBA',source.size)
            result={'status':'ready'}
            try:
                if row['action']=='decorate':
                    scale=max(1,min(6,1024//max(source.size)));large=source.resize((w*scale,h*scale),Image.Resampling.NEAREST)
                    canvas=Image.new('RGB',(large.width+64,large.height+64),'#808080');canvas.paste(large,(32,32),large)
                    raw=request_image(target,canvas,row['prompt'],FLUX,1.0,pipeline=PIPELINE)
                    # Existing surface profiles improve familiar materials; other additions remain experimental.
                    names=dsl['decorations']
                    known={'snow','lights','garland'}
                    if set(names)<=known:
                        aligned=raw.resize(canvas.size,Image.Resampling.LANCZOS).crop((32,32,32+large.width,32+large.height)).resize(source.size,Image.Resampling.LANCZOS)
                        overlay,_,_,counts=extract_profile(source,aligned,get_profile(obj),names)
                        save(target,'extraction.json',{'method':'surface-material','counts':counts,'requires_review':True})
                    else:
                        _,high,offset,report=extract_registered(source,raw)
                        native=high.resize((w+6,h+6),Image.Resampling.LANCZOS);overlay=native.crop((3,3,w+3,h+3))
                        save(target,'extraction.json',report)
                    # Do not let resampling introduce pixels outside the original silhouette.
                    a=np.array(overlay);a[:,:,3]=np.minimum(a[:,:,3],np.array(source.getchannel('A')));overlay=Image.fromarray(a)
                    if not overlay.getbbox():raise ValueError('No decoration extracted')
                colors.alpha_composite(corrected,(x,y));decorations.alpha_composite(overlay,(x,y))
            except Exception as exc:
                result={'status':'failed','error':str(exc)};errors.append(name+': '+str(exc))
            overlay.save(target/'decoration.png');Image.alpha_composite(corrected,overlay).save(target/'composite.png')
            results[name]=result;status.update(completed_objects=len(results),object_results=results);save_status(folder,status)
        colors.save(folder/'recolor-map.png');decorations.save(folder/'decoration-map.png')
        preview=Image.alpha_composite(original,colors)
        shade=(7,19,46,92)
        if dsl['night']:preview=Image.alpha_composite(preview,Image.new('RGBA',preview.size,shade))
        Image.alpha_composite(preview,decorations).save(folder/'preview.png')
        runtime=colors.copy()
        if dsl['night']:
            runtime=Image.alpha_composite(runtime,Image.new('RGBA',runtime.size,shade));runtime.putalpha(colors.getchannel('A'))
        runtime.save(folder/'recolor-runtime.png');Image.new('RGBA',(1,1)).save(folder/'settings.png')
        def placement(name,file):return dict(id=run_id+'-'+name,kind='object',col=0,row=0,imageUrl=f'/theme-runs/{run_id}/{file}',anchor='top-left',renderLayer='decoration',sourceGroup='prompt-theme',visible=True,sourceAssetId=name)
        settings=dict(runId=run_id,night=92/255 if dsl['night'] else 0,twinkle=dsl['twinkle'],color={'gain':[1,1,1],'bias':[0,0,0]})
        placements=[dict(placement('settings','settings.png'),themeSettings=settings),placement('recolor-map','recolor-runtime.png'),placement('decoration-map','decoration-map.png')]
        hashes=read(folder,'source-hashes.json');unchanged=hashes==sources()[3]
        save(folder,'manifest.json',dict(pipeline=PIPELINE,spec=dsl,source_hashes=hashes,objects=[objects[r['asset']] for r in rows],placements=placements,geometry_preserved=True,alpha_preserved=True))
        save(folder,'validation.json',dict(source_hashes_unchanged=unchanged,alpha_preserved=True,failed_objects=errors,visual_review_required=True))
        if not unchanged:raise ValueError('Source changed during generation')
        status.update(status='review_required',stage=7,current_object=None,preview=f'/theme-runs/{run_id}/preview.png',
                      original=f'/theme-runs/{run_id}/original-map.png',warnings=errors+['추출 결과는 실험적입니다. 원본·색보정·장식·합성을 검수 후 승인하세요.'])
        save_status(folder,status)
    except Exception as exc:status.update(status='failed',error=str(exc));save_status(folder,status)


def accept(folder):
    from theme_pipeline import sources,save_status
    status=read(folder,'status.json');validation=read(folder,'validation.json')
    if status.get('pipeline')!=PIPELINE or status['status']!='review_required':raise ValueError('Not awaiting review')
    if validation['failed_objects']:raise ValueError('Failed objects must be regenerated; cannot approve')
    if sources()[3]!=read(folder,'source-hashes.json'):raise ValueError('Source changed')
    status.update(status='ready',reviewed_at=time.time());save_status(folder,status)
