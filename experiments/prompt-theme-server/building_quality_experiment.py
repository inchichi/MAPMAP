"""One-building quality study; never applies results to the live game."""
import json
import time
import uuid
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import requests
from theme_pipeline import ROOT, REPO, STATE, layers, catalog
from object_decorations import surface_masks, request_image

PATHS = [[(0,224),(72,160),(144,160)],[(160,256),(256,160),(352,256)],[(368,160),(440,160),(511,224)]]


def extract_snow(original, generated, allowed):
    rgb=np.array(generated.convert('RGB')).astype(float)
    ref=np.array(original).astype(float)
    low=rgb.min(2); high=rgb.max(2)
    delta=np.max(np.abs(rgb-ref[:,:,:3]),axis=2)
    seed=(low>185)&((high-low)<45)&allowed&(delta>20)
    candidate=(low>65)&((high-low)<85)&((high-low)/np.maximum(high,1)<.4)&allowed&(delta>15)
    mask=seed.copy()
    for _ in range(24):
        dilated=np.array(Image.fromarray((mask*255).astype('uint8')).filter(ImageFilter.MaxFilter(3)))>0
        grown=mask|(dilated&candidate)
        if np.array_equal(grown,mask):break
        mask=grown
    alpha=np.where(mask,ref[:,:,3],0).astype('uint8')
    # Preserve complete RGB shading within the connected snow region.
    overlay=Image.fromarray(np.dstack((rgb.astype('uint8'),alpha)))
    hard=Image.fromarray(np.dstack((rgb.astype('uint8'),np.where(seed,ref[:,:,3],0).astype('uint8'))))
    return overlay,hard,seed,mask


def place_wire(wire, size, paths):
    out=Image.new('RGBA',size)
    # Map each texture column to the eave path; hanging bulbs remain vertical.
    for path in paths:
        distance=0.0
        for (x0,y0),(x1,y1) in zip(path,path[1:]):
            length=float(np.hypot(x1-x0,y1-y0))
            for x in range(x0,min(x1,size[0]-1)+1):
                t=(x-x0)/max(1,x1-x0)
                column=int(distance+t*length)%wire.width
                strip=wire.crop((column,0,column+1,wire.height))
                out.alpha_composite(strip,(x,round(y0+t*(y1-y0))))
            distance+=length
    return out


def darken(image):
    a=np.array(image.convert('RGBA'))
    a[:,:,:3]=np.uint8(a[:,:,:3]*.42+np.array([7,19,46])*.58)
    return Image.fromarray(a)


def night_composite(day,lights):
    result=darken(day)
    a=np.array(lights)
    rgb=a[:,:,:3].astype(float)
    # Emission is separate from ambient lighting, including wire darkening.
    bulb=(rgb[:,:,0]>150)&(rgb[:,:,1]>80)&(rgb[:,:,2]<130)&(a[:,:,3]>0)
    a[:,:,3]=np.where(bulb,a[:,:,3],0)
    result.alpha_composite(Image.fromarray(a))
    return result


def run(guided=False):
    folder=ROOT/('building-quality-'+uuid.uuid4().hex[:12]);folder.mkdir()
    print(str(folder),flush=True)
    metadata={'state':'running','created':time.time(),'applied':False,'scope':'town_hall only','model':'FLUX.1-Kontext-dev'}
    def save(): (folder/'experiment.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2))
    save()
    try:
        before=requests.get(STATE,timeout=20);before.raise_for_status()
        (folder/'state-before.json').write_text(json.dumps(before.json()))
        identity={'gain':[1,1,1],'bias':[0,0,0]}
        _,_,objects,hashes=layers(identity)
        obj=next(o for o in catalog() if o['id']=='town_hall')
        x,y,w,h=obj['box'];original=objects.crop((x,y,x+w,y+h));original.save(folder/'original.png')
        roof,_=surface_masks(original,'building')
        protected=(np.array(original)[:,:,3]>0)&~roof
        Image.fromarray((roof*255).astype('uint8')).save(folder/'roof-mask.png')
        Image.fromarray((protected*255).astype('uint8')).save(folder/'protected-mask.png')
        guide=original.copy();draw=ImageDraw.Draw(guide)
        for points in PATHS:draw.line(points,fill=(255,80,0,255),width=2)
        guide.save(folder/'eave-guide.png')
        source=Image.new('RGB',original.size,(128,128,128));source.paste(original,(0,0),original)
        prompt=('Keep this exact pixel-art building, geometry, doors, windows and roof tiles. Add ONLY thin settled snow patches on upper roof surfaces and eaves, with pale blue-gray shaded edges and irregular soft mounds. Leave most roof tiles visible. No lights, wreaths, new objects or cast shadows. Gray background unchanged.')
        guided_mask=None
        if guided:
            approved=Image.open(REPO/'public/experiments/flux-decorations-20260909/town-hall-decorations.png').convert('RGBA')
            a=np.array(approved).astype(float)
            guided_mask=(a[:,:,3]>0)&(a[:,:,:3].min(2)>145)&((a[:,:,:3].max(2)-a[:,:,:3].min(2))<100)&roof
            layout=Image.fromarray((guided_mask*255).astype('uint8'))
            layout.save(folder/'reviewed-snow-layout.png')
            # Reuse only coverage, not the reviewed result's texture or shading.
            source.paste((220,231,242),(0,0,w,h),layout)
            prompt=('Refine ONLY the pale snow mounds already placed on this building. Give these snow mounds rounded volume, soft white highlights and blue-gray underside shading. Keep their exact boundary and coverage. The blue roof remains blue and uncovered everywhere else. Preserve all doors, windows and building geometry. Pixel art matching the source. No new decorations or scenery.')
        metadata.update(stage='snow generation',source_hashes=hashes,roof_mask_conditioning='post-processing only; service has no mask input',light_mode='reuse reviewed FLUX wire, mapped to manually specified eaves')
        metadata['snow_layout_mode']='reviewed shape painted into input; RGB regenerated' if guided else 'text-only snow generation'
        save()
        raw=request_image(folder,source,prompt,'http://127.0.0.1:8765',.5)
        generated=raw.resize(original.size,Image.Resampling.LANCZOS)
        generated.save(folder/'aligned-snow-reference.png')
        snow,hard,seed,mask=extract_snow(original,generated,roof)
        if guided_mask is not None:
            # Region ownership supplies alpha, so dark shading is not discarded by RGB tests.
            rgb=np.array(generated.convert('RGB'))
            snow=Image.fromarray(np.dstack((rgb,(guided_mask*255).astype('uint8'))))
            mask=guided_mask
        snow.save(folder/'snow-rgb-grown.png');hard.save(folder/'snow-hard-threshold.png')
        reviewed=Image.open(REPO/'public/experiments/flux-decorations-20260909/blacksmith-stall-decorations-v3.png').convert('RGBA')
        wire=reviewed.crop((32,77,128,96))
        if guided:wire=wire.resize((192,12),Image.Resampling.NEAREST)
        wire.save(folder/'reviewed-wire.png')
        lights=place_wire(wire,original.size,PATHS);lights.save(folder/'lights-with-wire.png')
        # Doors/windows stay protected: all paths are above them in this profile.
        day=Image.alpha_composite(Image.alpha_composite(original,snow),lights)
        day.save(folder/'candidate-day.png')
        night_composite(day,lights).save(folder/'candidate-night.png')
        first=Image.open(REPO/'public/experiments/flux-decorations-20260909/town-hall-decorations.png').convert('RGBA')
        Image.alpha_composite(original,first).save(folder/'first-day.png')
        previous=Image.open(ROOT/'caf15f2c7c0c4ee2b5667b0966c9ec45/town_hall-decoration.png').convert('RGBA')
        Image.alpha_composite(original,previous).save(folder/'previous-day.png')
        after=requests.get(STATE,timeout=20);after.raise_for_status()
        metadata.update(state='review',stage='comparison complete',metrics={'seed_pixels':int(seed.sum()),'snow_pixels_with_shading':int(mask.sum()),'added_shading_pixels':int((mask&~seed).sum()),'snow_outside_roof':int((mask&~roof).sum()),'original_size':list(original.size),'live_state_unchanged':before.json()==after.json()},limitations=['Roof/eave profile is specific to this building.','No native masked generation; source geometry is protected during compositing.','This trial reuses a reviewed wire rather than generating new lights.','Static night comparison; no runtime twinkle.'])
        cards=[('Original','original.png'),('First reviewed result','first-day.png'),('Previous automatic result','previous-day.png'),('New candidate — day','candidate-day.png'),('New candidate — night','candidate-night.png'),('Snow including shading','snow-rgb-grown.png'),('Eave guide','eave-guide.png'),('Protected source regions','protected-mask.png')]
        html='<html lang="en"><meta charset="utf-8"><title>Building quality comparison</title><style>body{background:#18202b;color:#eee;font:16px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}img{width:100%;image-rendering:pixelated;background:#66707c}figure{margin:0}a{color:#bde}</style><h1>Building quality comparison</h1><p>Experiment only — live game unchanged. Snow: new FLUX generation. Wire: reviewed FLUX asset reuse.</p><main>'
        for title,url in cards:html+=f'<figure><h2>{title}</h2><a href="{url}"><img src="{url}"></a></figure>'
        html+='</main><p><a href="experiment.json">Metrics and limitations</a></p></html>'
        (folder/'index.html').write_text(html,encoding='utf8')
    except Exception as e:
        metadata.update(state='failed',error=str(e));raise
    finally:save()

if __name__=='__main__':run('--guided' in sys.argv)
