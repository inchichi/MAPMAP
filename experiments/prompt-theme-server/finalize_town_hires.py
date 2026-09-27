"""Build a high-resolution runtime manifest only after all source assets finish."""
import hashlib,json,sys
from PIL import Image
from theme_pipeline import ROOT,REPO,save_status

def finalize(run_id):
    folder=ROOT/run_id
    status=json.loads((folder/'status.json').read_text(encoding='utf8'))
    if status['pipeline']!='crypt-halloween-hires-v1' or status['completed_objects']!=status['total_objects']:
        raise ValueError('Generation is not complete')
    spec=json.loads((folder/'sources.json').read_text(encoding='utf8'))
    for path,digest in spec['hashes'].items():
        if hashlib.sha256((REPO/path).read_bytes()).hexdigest()!=digest: raise ValueError('Source changed')
    original=Image.open(folder/'original-map.png').convert('RGBA')
    preview=original.copy();items=[]
    for v in spec['variants']:
        name=v['id'];p=json.loads((folder/name/'placement.json').read_text())
        deco=Image.open(folder/name/'decoration.png')
        w,h=p['display_width'],p['display_height'];scale=p['texture_scale']
        if deco.mode!='RGBA' or deco.size!=(w*scale,h*scale): raise ValueError('Invalid high-resolution asset')
        positions=[[i['x']+p['x'],i['y']+p['y']] for i in spec['instances'] if i['asset']==name]
        items.append(dict(asset=name,url=f'/theme-runs/{run_id}/{name}/decoration.png',textureScale=scale,width=w,height=h,positions=positions))
        for x,y in positions: preview.alpha_composite(deco.resize((w,h),Image.Resampling.LANCZOS),(x,y))
    Image.new('RGBA',original.size).save(folder/'decoration-map.png')
    preview.save(folder/'preview.png')
    manifest=dict(id=run_id,mapId=status['mapId'],width=original.width,height=original.height,night=0,bulbs=[],
                  overlay=f'/theme-runs/{run_id}/decoration-map.png',hires=items,source_hashes=spec['hashes'],instances=len(spec['instances']))
    (folder/'crypt-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
    status.update(status='ready',preview=f'/theme-runs/{run_id}/preview.png',warnings=['Preview is downsampled; runtime uses high-resolution textures. Visual QA required.'])
    save_status(folder,status)

if __name__=='__main__': finalize(sys.argv[1])
