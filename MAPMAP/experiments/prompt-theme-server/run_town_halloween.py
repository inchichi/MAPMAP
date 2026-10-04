"""Saved-source floor-0 Halloween experiment; high-res outputs, no auto apply."""
import hashlib,json,shutil,time,uuid
from PIL import Image
from theme_pipeline import ROOT,REPO,FLUX,save_status
from object_decorations import request_image
from ruins_decoration_margin import extract

def main(source_run='439829ae8582448db82218a31a5878f6', map_id='floor-0-town', reuse_run=None):
    parent=ROOT/source_run
    spec=json.loads((parent/'sources.json').read_text(encoding='utf8'))
    if map_id=='floor-1-ruins':
        spec['variants']=[v for v in spec['variants'] if v['kind']=='prop']
    for path,digest in spec['hashes'].items():
        if hashlib.sha256((REPO/path).read_bytes()).hexdigest()!=digest: raise ValueError('Source changed: '+path)
    folder=ROOT/uuid.uuid4().hex
    lock=ROOT/'.batch.lock'
    with lock.open('x') as f:f.write(folder.name)
    folder.mkdir()
    status={'id':folder.name,'mapId':map_id,'pipeline':'crypt-halloween-hires-v1',
            'status':'running','created':time.time(),'completed_objects':0,'total_objects':len(spec['variants']),
            'prompt':'할로윈 호박 장식과 거미줄 · 원본 색/구조 유지 · 고해상도 장식','object_results':{}}
    print(folder.name,flush=True)
    try:
        (folder/'sources.json').write_text(json.dumps(spec),encoding='utf8')
        shutil.copy2(parent/'original-map.png',folder/'original-map.png')
        for v in spec['variants']:
            name=v['id'];target=folder/name;target.mkdir()
            shutil.copy2(parent/(name+'-original.png'),folder/(name+'-original.png'))
            source=Image.open(folder/(name+'-original.png')).convert('RGBA')
            scale=max(1,min(6,1024//max(source.size)))
            scaled=source.resize((source.width*scale,source.height*scale),Image.Resampling.NEAREST)
            canvas=Image.new('RGB',(scaled.width+64,scaled.height+64),'#808080');canvas.paste(scaled,(32,32),scaled)
            status['current_object']=name;save_status(folder,status)
            prompt=f"Add small attached Halloween pumpkin ornaments and fine cobwebs to this pixel-art {v['kind']}. Preserve exact original colors, silhouette, doors, windows, supports and position. Keep all decorations within three original pixels of the silhouette. Keep the gray background unchanged. No cast shadows, no snow, no new architecture."
            old=ROOT/reuse_run/name if reuse_run else None
            if old and (old/'flux-raw.png').exists():
                previous=json.loads((old/'generation.json').read_text())
                if previous['prompt']!=prompt: raise ValueError('Reuse prompt mismatch')
                if Image.open(ROOT/reuse_run/(name+'-original.png')).convert('RGBA').tobytes()!=source.tobytes(): raise ValueError('Reuse source mismatch')
                with Image.open(old/'flux-raw.png') as im: im.verify()
                for filename in ['flux-raw.png','flux-input.png','generation.json','request-timing.json']:
                    shutil.copy2(old/filename,target/filename)
            else:
                request_image(target,canvas,prompt,FLUX,1.0,pipeline=status['pipeline'],backend='flux')
            base,deco,placement=extract(source,Image.open(target/'flux-raw.png'),generic=True,high_resolution=True)
            deco.save(target/'decoration.png');Image.alpha_composite(base,deco).save(target/'composite.png')
            (target/'placement.json').write_text(json.dumps(placement),encoding='utf8')
            status['object_results'][name]={'status':'ready','reused_from':reuse_run if old and (old/'flux-raw.png').exists() else None,**placement}
            status['completed_objects']+=1;save_status(folder,status)
        status.update(status='awaiting_review',current_object=None,warnings=['High-resolution assets only; renderer not connected; no auto apply'])
    except Exception as error:
        status.update(status='failed',error=str(error));raise
    finally:
        save_status(folder,status);lock.unlink(missing_ok=True)
    from finalize_town_hires import finalize
    finalize(folder.name)
    return folder.name

if __name__=='__main__':main()
