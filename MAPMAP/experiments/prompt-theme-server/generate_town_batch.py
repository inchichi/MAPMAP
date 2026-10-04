"""Generate a reviewable town batch; preserve every attempt and never auto-apply."""
import hashlib, json, time, uuid
from PIL import Image, ImageDraw
from theme_pipeline import ROOT, FLUX, VERSION, catalog, layers, parse_prompt, save_status, key_strip
from profile_decorations import profiles, generate_profile
from town_profiles import PARTS


def main():
    prompt='크리스마스 밤 마을. 눈과 따뜻한 전구를 추가하고 은은하게 반짝이게. 원본 색 유지'
    spec=parse_prompt(prompt);configured=profiles()
    selected=[o for o in catalog() if o['id'] in configured]
    folder=ROOT/uuid.uuid4().hex;folder.mkdir()
    data={'id':folder.name,'status':'running','stage':4,'prompt':prompt,'created':time.time(),
          'pipeline':VERSION,'spec':spec,'total_objects':len(selected),'completed_objects':0,'batch':True}
    save_status(folder,data);print('BATCH '+folder.name,flush=True)
    original,tinted,objects,hashes=layers(spec['color']);original.save(folder/'original-map.png')
    sheet=Image.new('RGB',(800,((len(selected)+4)//5)*180),'#303038');draw=ImageDraw.Draw(sheet)
    for i,o in enumerate(selected):
        x,y,w,h=o['box'];crop=objects.crop((x,y,x+w,y+h));tile=crop.copy();tile.thumbnail((145,145),Image.Resampling.NEAREST)
        sheet.paste(tile,((i%5)*160,(i//5)*180+25),tile);draw.text(((i%5)*160+4,(i//5)*180+4),o['id'],fill='white')
    sheet.save(folder/'sources-contact.png')
    overlays={};failed={};reused={};cache={}
    for index,o in enumerate(selected):
        data.update(current_object=o['id'],completed_objects=index);save_status(folder,data)
        x,y,w,h=o['box'];crop=objects.crop((x,y,x+w,y+h));crop.save(folder/(o['id']+'-original.png'))
        p=configured[o['id']];key=hashlib.sha256(crop.tobytes()+json.dumps({k:v for k,v in p.items() if k not in ['box','label']},sort_keys=True).encode()).hexdigest()
        target=folder/o['id'];target.mkdir()
        if key in cache:
            owner=cache[key];overlay=overlays[owner].copy();reused[o['id']]=owner
            (target/'reuse.json').write_text(json.dumps({'from_object':owner,'source_and_profile_sha256':key}),encoding='utf8')
        else:
            overlay=None
            for attempt in range(1,3):
                dest=target/f'attempt-{attempt}';dest.mkdir()
                try:
                    overlay=generate_profile(dest,crop,o,spec,FLUX,key_strip);break
                except Exception as e:
                    failed[o['id']]=str(e);print('ATTEMPT FAILED '+o['id']+' '+str(e),flush=True)
            if overlay is None:
                print('FAILED '+o['id'],flush=True);continue
            cache[key]=o['id'];failed.pop(o['id'],None)
        overlays[o['id']]=overlay;overlay.save(folder/(o['id']+'-decoration.png'))
        Image.alpha_composite(crop,overlay).save(target/'composite.png')
        print('DONE '+o['id']+(' reused '+reused[o['id']] if o['id'] in reused else ''),flush=True)
    decoration=Image.new('RGBA',original.size);placements=[];successful=[]
    for o in selected:
        if o['id'] not in overlays:continue
        successful.append(o);x,y,w,h=o['box'];decoration.alpha_composite(overlays[o['id']],(x,y))
        placements.append({'id':folder.name+'-'+o['id'],'kind':'object','col':x/32,'row':y/32,
            'imageUrl':'/theme-runs/'+folder.name+'/'+o['id']+'-decoration.png','anchor':'top-left',
            'renderLayer':'decoration','sourceGroup':'prompt-theme','visible':True})
    Image.new('RGBA',(1,1)).save(folder/'settings.png')
    placements.insert(0,{'id':folder.name+'-settings','kind':'object','col':0,'row':0,
        'imageUrl':'/theme-runs/'+folder.name+'/settings.png','renderLayer':'decoration','sourceGroup':'prompt-theme','visible':True,
        'themeSettings':{'runId':folder.name,'night':.58,'twinkle':True,'color':spec['color']}})
    decoration.save(folder/'decoration-map.png')
    tinted=Image.alpha_composite(tinted,Image.new('RGBA',tinted.size,(7,19,46,148)))
    Image.alpha_composite(tinted,decoration).save(folder/'preview.png')
    (folder/'manifest.json').write_text(json.dumps({'pipeline':VERSION,'spec':spec,'source_hashes':hashes,
        'objects':successful,'placements':placements,'geometry_preserved':True,'alpha_preserved':True,
        'failed_objects':failed,'reused_objects':reused,'covered_parts':PARTS},ensure_ascii=False,indent=2),encoding='utf8')
    data.update(status='ready' if successful else 'failed',stage=7,completed_objects=len(overlays),
        preview='/theme-runs/'+folder.name+'/preview.png',original='/theme-runs/'+folder.name+'/original-map.png',
        failed_objects=failed,warnings=spec['warnings']+['자동 검수 전 실험 결과. 게임에는 아직 적용하지 않았습니다.']+
        ([f'생성 실패 {len(failed)}개: '+', '.join(failed)] if failed else []))
    save_status(folder,data);print(json.dumps(data,ensure_ascii=False),flush=True)


if __name__=='__main__':main()
