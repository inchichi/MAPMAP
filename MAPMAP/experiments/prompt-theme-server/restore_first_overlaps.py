"""Restore only four first-demo objects; never replace other browser placements."""
import json, shutil, time, uuid
from PIL import Image
from theme_pipeline import ROOT, REPO, get_folder, sources, save_status
from run_records import record_event


def create_revision(parent_id):
    parent=get_folder(parent_id)
    baseline=json.loads((parent/'manifest.json').read_text(encoding='utf8'))
    if baseline['source_hashes']!=sources()[3]:raise ValueError('Source map changed')
    demo=REPO/'public/experiments/flux-decorations-20260909'
    items=json.loads((demo/'placements.json').read_text(encoding='utf8'))
    folder=ROOT/uuid.uuid4().hex;folder.mkdir()
    objects={o['id']:o for o in baseline['objects']}
    replacements=[];selected=[];provenance=[]
    for item in items:
        name=item['id'].removeprefix('flux-decoration-20260909-')
        if name not in objects:continue
        source=REPO/'public'/item['imageUrl'].split('?')[0].lstrip('/')
        dest=folder/(name+'-first.png');shutil.copy2(source,dest)
        with Image.open(dest) as image:image.verify()
        replacements.append({**item,'id':folder.name+'-'+name,'sourceAssetId':name,'sourceGroup':'prompt-theme','imageUrl':f'/theme-runs/{folder.name}/{dest.name}'})
        selected.append(objects[name]);provenance.append({'object':name,'source':str(source.relative_to(REPO)),'method':'original-demo-bytes-and-original-placement'})
    if len(replacements)!=4:raise ValueError('Expected four overlapping objects')
    shutil.copy2(parent/'original-map.png',folder/'original-map.png')
    original=Image.open(folder/'original-map.png').convert('RGBA')
    preview=Image.alpha_composite(original,Image.new('RGBA',original.size,(7,19,46,148)))
    targets={o['id'] for o in selected}
    retained=[p for p in baseline['placements'] if not p.get('themeSettings') and not any(p['id'].endswith('-'+n) for n in targets)]
    for p in retained:
        path=REPO/'public'/p['imageUrl'].lstrip('/')
        preview.alpha_composite(Image.open(path).convert('RGBA'),(round(p['col']*32),round(p['row']*32)))
    for p in replacements:
        preview.alpha_composite(Image.open(folder/p['imageUrl'].split('/')[-1]).convert('RGBA'),(round(p['col']*32),round(p['row']*32)))
    preview.save(folder/'preview.png')
    manifest={'pipeline':'first-demo-partial-restore-v1','parent_run_id':parent_id,'source_hashes':baseline['source_hashes'],'objects':selected,'placements':replacements,'provenance':provenance,'preview_context_run':parent_id}
    (folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
    save_status(folder,{'id':folder.name,'parent_run_id':parent_id,'created':time.time(),'status':'ready','stage':7,'pipeline':manifest['pipeline'],'prompt':'첫 결과 겹치는 4개만 복원: 큰 건물, 천막, 왼쪽 분수, 위쪽 나무','completed_objects':4,'total_objects':4,'original':f'/theme-runs/{folder.name}/original-map.png','preview':f'/theme-runs/{folder.name}/preview.png','warnings':['4개만 교체합니다. 다른 화분·나무·분수·가로등·밤 설정은 브라우저의 현재 상태를 유지합니다. 미리보기의 나머지 오브젝트는 부모 실행 기준입니다.']})
    record_event(folder,'partial_restore_created',targets=sorted(targets),provenance=provenance)
    return folder.name


if __name__=='__main__':
    import sys
    print(create_revision(sys.argv[1]))
