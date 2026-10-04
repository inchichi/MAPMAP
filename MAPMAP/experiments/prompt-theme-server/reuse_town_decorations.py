"""Create a preserved revision: match basket tiles and repair complete TMX trees."""
import json, shutil, sys, time, uuid
from pathlib import Path
import numpy as np
from PIL import Image
from theme_pipeline import ROOT, catalog, sources, save_status, get_folder
from town_attached_materials import isolate
from run_records import record_event


def flower_basket_positions():
    m,ts,_,_=sources()
    first=int(m.find('tileset').get('firstgid'));mw=int(m.get('width'))
    tw=int(m.get('tilewidth'));th=int(m.get('tileheight'))
    ids={int(t.get('id'))+first for t in ts.findall('tile') if t.get('type')=='basket_flowers'}
    positions=set()
    for layer in m.findall('layer'):
        if layer.get('visible','1')=='0':continue
        for i,raw in enumerate(int(v) for v in layer.find('data').text.replace('\n','').split(',') if v.strip()):
            if (raw&0x1fffffff) in ids:
                if raw&0xe0000000:raise ValueError('Review flipped basket before reusing its overlay')
                positions.add((i%mw*tw,i//mw*th))
    return sorted(positions)


def revise(parent_id):
    parent=get_folder(parent_id)
    manifest=json.loads((parent/'manifest.json').read_text(encoding='utf8'))
    if manifest['source_hashes']!=sources()[3]:raise ValueError('Source map changed; review before reuse')
    previous=json.loads((parent/'status.json').read_text(encoding='utf8'))
    if previous['status']!='ready':raise ValueError('A completed run is required')
    folder=ROOT/uuid.uuid4().hex
    shutil.copytree(parent,folder,ignore=shutil.ignore_patterns('events.jsonl','apply.html','status.tmp'))
    data=json.loads(json.dumps(previous).replace(parent_id,folder.name))
    manifest=json.loads(json.dumps(manifest).replace(parent_id,folder.name))
    data.update(parent_run_id=parent_id,id=folder.name,created=time.time(),pipeline='town-reviewed-reuse-v1',status='running')
    save_status(folder,data)
    try:
        objects={o['id']:o for o in catalog()}
        original=Image.open(folder/'original-map.png').convert('RGBA')
        pot_source=Image.open(parent/'prop_5-original.png').convert('RGBA')
        pot=Image.open(parent/'prop_5-decoration.png').convert('RGBA')
        tree=Image.open(parent/'tree_3-decoration.png').convert('RGBA')
        additions={};provenance={}
        positions=flower_basket_positions()
        pot_objects=[objects[n] for n in ['prop_2','prop_3','prop_4','prop_5','prop_8']]
        for x,y in positions:
            if not any(o['box'][0]<=x<o['box'][0]+o['box'][2] and o['box'][1]<=y<o['box'][1]+o['box'][3] for o in pot_objects):
                pot_objects.append({'id':f'pot_{x}_{y}','category':'prop','box':[x,y,32,32]})
        for o in pot_objects:
            x,y,w,h=o['box'];overlay=Image.new('RGBA',(w,h));source=isolate(o)
            for px,py in positions:
                if x<=px<x+w and y<=py<y+h:
                    tile=source.crop((px-x,py-y,px-x+32,py-y+32))
                    if tile.tobytes()!=pot_source.tobytes():raise ValueError('Basket pixels differ at '+str((px,py)))
                    # Do not paint decorations over tiles hiding a basket in higher layers.
                    a=np.array(pot);visible=np.all(np.array(original.crop((px,py,px+32,py+32)))[:,:,:3]==np.array(pot_source)[:,:,:3],axis=2)
                    a[~visible,3]=0
                    overlay.alpha_composite(Image.fromarray(a),(px-x,py-y))
            additions[o['id']]=(o,source,overlay)
            provenance[o['id']]={'run':parent_id,'object':'prop_5','method':'exact-basket-tile-reuse','generation_seconds':0}
        for name in ['tree_1','tree_2','tree_3']:
            o=objects[name];source=isolate(o)
            # Complete original sprite covers the misplaced window drawn above the lower tree.
            # Apply the run's night shade to the base, leaving actual FLUX decoration pixels intact.
            a=np.array(source);night=.58 if data['spec']['night'] else 0
            a[:,:,:3]=(a[:,:,:3]*(1-night)+np.array([7,19,46])*night).astype('uint8')
            overlay=Image.alpha_composite(Image.fromarray(a),tree)
            additions[name]=(o,source,overlay)
            provenance[name]={'run':parent_id,'object':'tree_3','method':'complete-tmx-tree-and-existing-flux-decoration','generation_seconds':0}
        changed=set(additions)
        manifest['placements']=[p for p in manifest['placements'] if not any(p['id'].endswith('-'+n) for n in changed)]
        manifest['objects']=[o for o in manifest['objects'] if o['id'] not in changed]
        for name,(obj,source,overlay) in additions.items():
            target=folder/name;target.mkdir(exist_ok=True)
            source.save(folder/(name+'-original.png'));overlay.save(folder/(name+'-decoration.png'))
            overlay.save(target/'decoration.png');Image.alpha_composite(source,overlay).save(target/'composite.png')
            (target/'reuse.json').write_text(json.dumps(provenance[name],indent=2),encoding='utf8')
            x,y,_,_=obj['box']
            manifest['objects'].append(obj)
            manifest['placements'].append({'id':folder.name+'-'+name,'sourceAssetId':name,'kind':'object','col':x/32,'row':y/32,'anchor':'top-left','imageUrl':f'/theme-runs/{folder.name}/{name}-decoration.png','renderLayer':'decoration','sourceGroup':'prompt-theme','visible':True})
            data['object_results'][name]={'status':'reused','source_available':True,'reused_from':provenance[name]['object'],'generation_seconds':0,'elapsed_seconds':0,'warning':'새 생성 아님 · 검증된 FLUX 결과 재사용'}
        for n in changed:
            manifest.get('failed_objects',{}).pop(n,None)
        manifest.update(parent_run_id=parent_id,pipeline=data['pipeline'],reuse_provenance=provenance,basket_positions=positions)
        deco=Image.new('RGBA',original.size)
        for p in manifest['placements']:
            if p.get('themeSettings'):
                p['themeSettings']['runId']=folder.name
                continue
            deco.alpha_composite(Image.open(folder/p['imageUrl'].split('/')[-1]).convert('RGBA'),(round(p['col']*32),round(p['row']*32)))
        deco.save(folder/'decoration-map.png')
        base=Image.alpha_composite(original,Image.new('RGBA',original.size,(7,19,46,148 if data['spec']['night'] else 0)))
        Image.alpha_composite(base,deco).save(folder/'preview.png')
        (folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
        data.update(status='ready',stage=7,completed_objects=len(manifest['objects']),processed_objects=len(data['object_results']),total_objects=len(data['object_results']),failed_objects=manifest.get('failed_objects',{}),warnings=['동일 화분 13개와 나무 3개 재사용·정렬 보정. 이전 생성본은 부모 실행에 보존. 창틀 화분 등 다른 모양은 변경하지 않았습니다.'])
        record_event(folder,'revision_created',parent_run_id=parent_id,reuse=provenance,basket_positions=positions)
        save_status(folder,data)
        return folder.name
    except Exception as error:
        data.update(status='failed',error=str(error));save_status(folder,data)
        raise


if __name__=='__main__':print(revise(sys.argv[1]))
