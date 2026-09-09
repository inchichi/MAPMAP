"""Restore the reviewed FLUX decorations as a new, explicitly reused trial."""
import hashlib
import json
import shutil
import time
import uuid
from PIL import Image
from theme_pipeline import REPO, ROOT, layers, parse_prompt, save_status

def restore():
    identity={'gain':[1,1,1],'bias':[0,0,0]}
    original,_,_,hashes=layers(identity)
    source=REPO/'public/experiments/flux-decorations-20260909'
    entries=[
        ('town_hall','town-hall-decorations.png',17,1,(512,480)),
        ('tree_1','tree_1-decorations.png',13,11.5,(160,160)),
        ('fountain_1','fountain_1-decorations.png',17,12,(160,160)),
        ('blacksmith_stall','blacksmith-stall-decorations-v3.png',10,12,(160,160))
    ]
    folder=ROOT/uuid.uuid4().hex;folder.mkdir()
    prompt='크리스마스 밤, 눈과 전구 반짝임. 원본 색 유지 — 최초 검수 FLUX 장식 복원'
    spec=parse_prompt(prompt);spec['color']=identity
    placements=[];references=[]
    preview=Image.alpha_composite(original,Image.new('RGBA',original.size,(7,19,46,148)))
    for name,filename,col,row,size in entries:
        path=source/filename
        image=Image.open(path).convert('RGBA')
        if image.size!=size:raise ValueError(filename+': reference size mismatch')
        destination=folder/(name+'-decoration.png')
        shutil.copy2(path,destination)
        references.append({'object':name,'source':str(path.relative_to(REPO)), 'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
        preview.alpha_composite(image,(int(col*32),int(row*32)))
        placements.append({'id':folder.name+'-'+name,'kind':'object','col':col,'row':row,'anchor':'top-left','displayScale':1,'imageUrl':'/theme-runs/'+folder.name+'/'+destination.name,'renderLayer':'decoration','sourceGroup':'prompt-theme','visible':True})
    Image.new('RGBA',(1,1)).save(folder/'settings.png')
    placements.insert(0,{'id':folder.name+'-settings','kind':'object','col':0,'row':0,'imageUrl':'/theme-runs/'+folder.name+'/settings.png','renderLayer':'decoration','sourceGroup':'prompt-theme','visible':True,'themeSettings':{'runId':folder.name,'night':.58,'twinkle':True,'color':identity}})
    original.save(folder/'original-map.png');preview.save(folder/'preview.png')
    manifest={'pipeline':'approved-reference-v1','generation_mode':'reuse-reviewed-flux-assets','references':references,'spec':spec,'source_hashes':hashes,'placements':placements,'geometry_preserved':True,'original_files_unchanged':True}
    (folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
    save_status(folder,{'id':folder.name,'pipeline':'approved-reference-v1','status':'ready','stage':7,'prompt':prompt,'created':time.time(),'spec':spec,'preview':'/theme-runs/'+folder.name+'/preview.png','original':'/theme-runs/'+folder.name+'/original-map.png','warnings':['새 생성이 아니라 최초 검수한 FLUX 장식 파일과 좌표를 그대로 복원한 결과입니다. 원본 색 보정은 해제했습니다.']})
    print(folder.name)

if __name__=='__main__':restore()
