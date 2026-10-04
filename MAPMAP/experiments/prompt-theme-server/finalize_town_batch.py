"""Re-extract strip decorations from saved FLUX pixels after a batch finishes."""
import json, shutil, sys, time
import numpy as np
from PIL import Image
from profile_decorations import profiles, profile_masks, find_strip
from theme_pipeline import ROOT, key_strip, save_status


def main(run_id):
    folder=ROOT/run_id
    if len(run_id)!=32 or not folder.is_dir():raise ValueError('Unknown run')
    while True:
        state=json.loads((folder/'status.json').read_text(encoding='utf8'))
        if state['status'] not in ['queued','running']:break
        time.sleep(10)
    if state['status']!='ready':return
    manifest=json.loads((folder/'manifest.json').read_text(encoding='utf8'));changed=[]
    for obj in manifest['objects']:
        name=obj['id'];p=profiles()[name]
        if p['mode']!='strips':continue
        paths=sorted((folder/name).glob('attempt-*/flux-raw.png'))
        original=Image.open(folder/(name+'-original.png')).convert('RGBA')
        raw=Image.open(paths[-1]);out=Image.new('RGBA',original.size)
        for kind in manifest['spec']['decorations']:
            strip=find_strip(raw,kind,key_strip);strip.save(folder/name/(kind+'-reviewed-strip.png'))
            x0,y0,x1,y1=p['snow_rect'] if kind=='snow' else p['wire_rect']
            if kind=='snow':tile=strip.resize((x1-x0,y1-y0),Image.Resampling.NEAREST)
            else:
                tile=strip.copy();tile.thumbnail((x1-x0,y1-y0),Image.Resampling.LANCZOS)
            for x in range(x0,x1,tile.width):out.alpha_composite(tile.crop((0,0,min(tile.width,x1-x),tile.height)),(x,y0))
        _,protected=profile_masks(original,p);a=np.array(out);a[protected,3]=0;out=Image.fromarray(a)
        path=folder/(name+'-decoration.png');shutil.copy2(path,folder/(name+'-before-strip-review.png'))
        out.save(path)
        shutil.copy2(folder/name/'composite.png',folder/name/'composite-before-strip-review.png')
        Image.alpha_composite(original,out).save(folder/name/'composite.png');changed.append(name)
    original=Image.open(folder/'original-map.png').convert('RGBA')
    decoration=Image.new('RGBA',original.size)
    for obj in manifest['objects']:
        decoration.alpha_composite(Image.open(folder/(obj['id']+'-decoration.png')).convert('RGBA'),tuple(obj['box'][:2]))
    shutil.copy2(folder/'preview.png',folder/'preview-before-strip-review.png')
    base=Image.alpha_composite(original,Image.new('RGBA',original.size,(7,19,46,148)))
    Image.alpha_composite(base,decoration).save(folder/'preview.png');decoration.save(folder/'decoration-map.png')
    state['strip_reviewed_objects']=changed
    state['warnings'].append('눈/전구 순서 혼동을 보정했습니다. 보정 전 결과도 별도 보존했습니다.')
    save_status(folder,state);print(json.dumps({'id':run_id,'strip_reviewed':changed,'failed':state.get('failed_objects',{})}),flush=True)


if __name__=='__main__':main(sys.argv[1])
