"""Non-destructive postprocessing experiment using an existing FLUX run."""
import hashlib, json, re, shutil, sys, time, uuid
from pathlib import Path
import numpy as np
from PIL import Image
from ruins_decoration_margin import extract
from run_records import record_event

ROOT = Path(__file__).resolve().parents[2] / 'public/theme-runs'


def replay(source_id):
    if not re.fullmatch('[a-f0-9]{32}',source_id): raise ValueError('Invalid run id')
    previous = ROOT/source_id
    status = json.loads((previous/'status.json').read_text(encoding='utf8'))
    if status['status']!='ready' or status['pipeline']!='crypt-ruins-plan-v1': raise ValueError('Expected completed ruins plan run')
    parent = json.loads((previous/'parent-manifest.json').read_text(encoding='utf8'))
    spec = json.loads((previous/'sources.json').read_text(encoding='utf8'))
    for name,digest in spec['hashes'].items():
        if hashlib.sha256((ROOT.parents[1]/name).read_bytes()).hexdigest()!=digest: raise ValueError('Source changed')
    folder = ROOT/uuid.uuid4().hex
    shutil.copytree(previous,folder)
    # Copied logs are retained separately, not represented as this run's events.
    (folder/'events.jsonl').rename(folder/'source-events.jsonl')
    if (folder/'visual-review.json').exists(): (folder/'visual-review.json').rename(folder/'source-visual-review.json')
    status.update(id=folder.name,status='running',created=time.time(),source_run_id=source_id,
                  original=f'/theme-runs/{folder.name}/original-map.png',preview=None,completed_objects=0)
    write = lambda name,value: (folder/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    write('status.json',status)
    record_event(folder,'postprocessing_started',source_run_id=source_id,model_called=False)
    overlay = Image.open(ROOT/parent['id']/'decoration-map.png').convert('RGBA')
    bulbs = parent['bulbs'].copy()
    report = {}
    try:
        for name,result in status['object_results'].items():
            source = Image.open(folder/f'{name}-original.png').convert('RGBA')
            base,deco,offset = extract(source,Image.open(folder/name/'flux-raw.png'))
            base.save(folder/name/'base-padded.png'); deco.save(folder/name/'decoration.png')
            composite = Image.alpha_composite(base,deco); composite.save(folder/name/'composite.png')
            write(name+'/placement.json',offset)
            a = np.array(deco); base_a=np.array(base.getchannel('A'))
            report[name]={'base_pixels_unchanged':base.crop((3,3,3+source.width,3+source.height)).tobytes()==source.tobytes(),
                          'outside_source_decoration_pixels':int(((a[:,:,3]>0)&(base_a==0)).sum()),'offset':offset}
            pixels=np.array(composite);pixels[:,:,:3]=(pixels[:,:,:3].astype(float)*.9).astype('uint8')
            for p in spec['instances']:
                if p['asset']!=name: continue
                x,y=p['x']+offset['x'],p['y']+offset['y']
                overlay.alpha_composite(Image.fromarray(pixels),(x,y))
                bulbs=[[bx,by] for bx,by in bulbs if not(x<=bx<x+base.width and y<=by<y+base.height)]
                ys,xs=np.where((a[:,:,0]>210)&(a[:,:,1]>160)&(a[:,:,2]<165)&(a[:,:,3]>90))
                bulbs += [[int(x+bx),int(y+by)] for bx,by in zip(xs[::3],ys[::3]) if 0<=x+bx<overlay.width and 0<=y+by<overlay.height]
            result['reused_from']=source_id
            result['postprocess_profile']='padded-margin-3-v1'
            status['completed_objects']+=1
        overlay.save(folder/'decoration-map.png')
        original=Image.open(folder/'original-map.png').convert('RGBA')
        preview=Image.alpha_composite(original,Image.new('RGBA',original.size,(12,23,58,round(parent['night']*255))))
        Image.alpha_composite(preview,overlay).save(folder/'preview.png')
        write('crypt-manifest.json',dict(parent,id=folder.name,parent_run_id=parent['id'],bulbs=bulbs,overlay=f'/theme-runs/{folder.name}/decoration-map.png'))
        write('margin-validation.json',report)
        write('validation.json',{'source_hashes_unchanged':True,'all_variant_alpha_preserved':True,
                                'alpha_scope':'unmodified base sprite only; decoration has independent padded alpha'})
        # Requires visual review: never silently classify the replay as approved.
        status.update(status='awaiting_review',preview=f'/theme-runs/{folder.name}/preview.png')
        write('status.json',status)
        record_event(folder,'postprocessing_completed',source_run_id=source_id,model_called=False)
        print(folder.name)
    except Exception as error:
        status.update(status='failed',error=str(error));write('status.json',status)
        record_event(folder,'postprocessing_error',error=str(error));raise


if __name__=='__main__': replay(sys.argv[1])
