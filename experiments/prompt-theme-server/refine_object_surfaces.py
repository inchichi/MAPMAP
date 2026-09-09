"""Re-extract saved FLUX references into a new trial; never overwrite source runs."""
import json
import shutil
import sys
import time
import uuid
from PIL import Image
from theme_pipeline import ROOT, get_folder, save_status, sources, align, key_strip
from object_decorations import extract_attached, object_kind, VERSION


def refine(run_id):
    source = get_folder(run_id)
    old = json.loads((source/'status.json').read_text())
    if old['status'] != 'ready':
        raise ValueError('Only completed object-surface runs can be refined')
    manifest = json.loads((source/'manifest.json').read_text())
    if manifest.get('pipeline') != VERSION or manifest['source_hashes'] != sources()[3]:
        raise ValueError('Pipeline or original source mismatch')
    folder = ROOT/uuid.uuid4().hex
    shutil.copytree(source,folder)
    status = dict(old,id=folder.name,status='running',created=time.time(),source_run=run_id)
    status.pop('applied_at',None)
    save_status(folder,status)
    try:
        preview = Image.open(folder/'color-map.png').convert('RGBA')
        if manifest['spec']['night']:
            preview=Image.alpha_composite(preview,Image.new('RGBA',preview.size,(7,19,46,148)))
        for obj in manifest['objects']:
            original=Image.open(folder/(obj['id']+'-original.png')).convert('RGBA')
            target=folder/obj['id']
            if object_kind(obj) != 'stall' and manifest['spec']['decorations']:
                generated=Image.open(target/'aligned-reference.png')
                overlay=extract_attached(original,generated,object_kind(obj),manifest['spec']['decorations'])
                overlay.save(folder/(obj['id']+'-decoration.png'))
                overlay.save(target/'decoration.png')
                Image.alpha_composite(original,overlay).save(target/'composite.png')
            elif object_kind(obj) == 'stall' and manifest['spec']['decorations']:
                raw=Image.open(target/'flux-raw.png').convert('RGBA')
                names=manifest['spec']['decorations'];n=len(names)
                strips={k:key_strip(raw.crop((0,i*raw.height//n,raw.width,(i+1)*raw.height//n)),k) for i,k in enumerate(names)}
                for k,strip in strips.items():strip.save(target/(k+'-strip.png'))
                overlay=align(original,strips)
                overlay.save(folder/(obj['id']+'-decoration.png'))
                Image.alpha_composite(original,overlay).save(target/'composite.png')
            else:
                overlay=Image.open(folder/(obj['id']+'-decoration.png')).convert('RGBA')
            preview.alpha_composite(overlay,tuple(obj['box'][:2]))
        preview.save(folder/'preview.png')
        manifest=json.loads(json.dumps(manifest).replace(run_id,folder.name))
        manifest['source_run']=run_id
        (folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
        status.update(status='ready',stage=7,preview='/theme-runs/'+folder.name+'/preview.png',original='/theme-runs/'+folder.name+'/original-map.png')
    except Exception as e:
        status.update(status='failed',error=str(e))
        raise
    finally:
        save_status(folder,status)
    return folder.name


if __name__ == '__main__':
    print(refine(sys.argv[1]))
