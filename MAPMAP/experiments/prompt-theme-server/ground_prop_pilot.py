"""Independent sprite pilot. Never edits the source building or applies game changes."""
import re
import time
import uuid
import cv2
import numpy as np
from PIL import Image,ImageOps
from pixel_style import native_sprite,pixel_prompt,VERSION


def extract_sprite(raw):
    rgb=np.array(raw.convert('RGB'))
    edges=np.concatenate((rgb[0],rgb[-1],rgb[:,0],rgb[:,-1]))
    background=np.median(edges,axis=0)
    distance=np.abs(rgb.astype(float)-background).max(2)
    if np.mean(np.abs(edges.astype(float)-background).max(1)<24)<.97:
        raise ValueError('Background is not flat; refuse automatic sprite extraction')
    candidate=(distance<32).astype('uint8')
    _,labels=cv2.connectedComponents(candidate,connectivity=4)
    outside=np.unique(np.concatenate((labels[0],labels[-1],labels[:,0],labels[:,-1])))
    outside=outside[outside!=0]
    mask=~np.isin(labels,outside)
    mask[[0,-1],:]=False;mask[:,[0,-1]]=False
    count,components,stats,_=cv2.connectedComponentsWithStats(mask.astype('uint8'),8)
    if count<2:raise ValueError('No foreground sprite')
    areas=stats[1:,cv2.CC_STAT_AREA];largest=int(np.argmax(areas))+1
    if sum(areas)-areas[largest-1]>max(16,areas[largest-1]*.03):
        raise ValueError('Multiple disconnected foreground objects; review required')
    mask=components==largest
    if mask.mean()>.65 or mask.mean()<.005:raise ValueError('Invalid sprite coverage')
    rgba=Image.fromarray(np.dstack((rgb,mask.astype('uint8')*255)))
    crop=rgba.crop(rgba.getbbox())
    sprite=ImageOps.contain(crop,(28,28),Image.Resampling.NEAREST)
    canvas=Image.new('RGBA',(32,32));canvas.alpha_composite(sprite,((32-sprite.width)//2,30-sprite.height))
    result,report=native_sprite(canvas)
    report.update(background_rgb=background.tolist(),anchor='bottom-center',game_applied=False)
    return result,report


def prepare(plan_id,asset,prompt):
    from theme_pipeline import ROOT,sources,save_status
    from town_vision_pipeline import read,save
    if not re.fullmatch('[a-f0-9]{32}',plan_id):raise ValueError('Invalid reference plan')
    parent=ROOT/plan_id
    objects=read(parent,'objects.json')
    if asset not in {o['id'] for o in objects}:raise ValueError('Unknown reference asset')
    if read(parent,'source-hashes.json')!=sources()[3]:raise ValueError('Source changed; plan again')
    folder=ROOT/uuid.uuid4().hex;folder.mkdir()
    source=Image.open(parent/f'{asset}-original.png').convert('RGBA')
    if source.size!=(32,32):raise ValueError('Pilot requires a 32x32 style reference')
    source.save(folder/'reference.png')
    source.save(folder/'original.png')
    effective=pixel_prompt('Use the supplied image only as a pixel-style reference, not as the requested object. '
        'Replace it with one isolated '+prompt+'. Make a single 32x32 game inventory/world sprite enlarged with nearest-neighbor pixels. '
        'Keep one object centered on a perfectly flat gray #808080 background. '
        'No ground, grass, floor, scene, building, text, drop shadow or extra objects. Use dark pixel outlines and flat shading.')
    save(folder,'prompt.json',{'prompt':effective,'source_plan':plan_id,'source_asset':asset,'pixel_policy':VERSION})
    save(folder,'source-hashes.json',sources()[3])
    save_status(folder,{'id':folder.name,'pipeline':'pixel-prop-v1','mapId':'town','status':'queued','stage':3,
        'created':time.time(),'prompt':effective,'completed_objects':0,'total_objects':1})
    return folder.name


def run(run_id):
    from theme_pipeline import ROOT,FLUX,save_status,sources
    from town_vision_pipeline import read,save
    from object_decorations import request_image
    folder=ROOT/run_id;status=read(folder,'status.json')
    try:
        status.update(status='running',stage=4);save_status(folder,status)
        ref=Image.open(folder/'reference.png').convert('RGBA').resize((384,384),Image.Resampling.NEAREST)
        canvas=Image.new('RGB',(512,512),'#808080');canvas.paste(ref,(64,64),ref)
        raw=request_image(folder,canvas,read(folder,'prompt.json')['prompt'],FLUX,1.0,pipeline='pixel-prop-v1')
        sprite,report=extract_sprite(raw)
        report['source_hashes_unchanged']=sources()[3]==read(folder,'source-hashes.json')
        save(folder,'pixel-validation.json',report)
        if not report['source_hashes_unchanged']:raise ValueError('Source changed')
        sprite.save(folder/'sprite.png')
        sprite.resize((256,256),Image.Resampling.NEAREST).save(folder/'preview.png')
        status.update(status='review_required',stage=7,completed_objects=1,
            original=f'/theme-runs/{run_id}/original.png',preview=f'/theme-runs/{run_id}/preview.png',
            warnings=['Independent 32x32 sprite; palette/grid checks passed. Visual style and map placement still require review. No game application.'])
    except Exception as error:
        status.update(status='failed',error=str(error))
    save_status(folder,status)
