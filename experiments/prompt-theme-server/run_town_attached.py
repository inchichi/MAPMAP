"""Run every registered static town object; failures never stop the remaining queue."""
import hashlib,json,shutil,time,uuid
from pathlib import Path
from PIL import Image
from theme_pipeline import ROOT,FLUX,catalog,layers,parse_prompt,save_status
from profile_decorations import profiles
from town_profiles import PARTS
from town_attached_materials import isolate,generate

def main():
    lock=ROOT/'.batch.lock'
    with lock.open('x',encoding='utf8') as f:f.write('town-attached-materials-v2')
    folder=ROOT/uuid.uuid4().hex;folder.mkdir()
    p=profiles();objects=[o for o in catalog() if o['id'] in p]
    prompt='크리스마스 밤. 쌓인 눈, 따뜻한 전구줄, 리스와 가랜드. 원본 색 유지. 반짝임'
    spec=parse_prompt(prompt)
    data={'id':folder.name,'pipeline':'town-attached-materials-v2','status':'running','stage':4,'created':time.time(),
        'prompt':prompt,'spec':spec,'total_objects':len(objects),'completed_objects':0,'processed_objects':0,
        'object_results':{o['id']:{'status':'pending'} for o in objects}}
    save_status(folder,data);print('RUN '+folder.name,flush=True)
    try:
        original,_,_,hashes=layers(spec['color']);original.save(folder/'original-map.png')
        for o in objects:
            try:isolate(o).save(folder/(o['id']+'-original.png'))
            except Exception as e:data['object_results'][o['id']]={'status':'failed','error':str(e)}
        html='''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>마을 전체 FLUX 데코</title><style>body{background:#19191c;color:#eee;font:15px/1.6 system-ui;margin:24px}a{color:#e8bb70}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px}article{background:#28282d;border:1px solid #78613c;border-radius:12px;padding:16px}h2{font-size:16px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}.slot{height:220px;display:grid;place-items:center;background:#37373c;color:#bbb}img{width:100%;height:220px;object-fit:contain;image-rendering:pixelated}#status{padding:16px;border:1px solid #bc954e;margin:16px 0}.error{color:#eeb393;font-size:12px}</style><h1>마을 전체 · 크리스마스 FLUX 데코</h1><p>건물 단독 / 오브젝트 종류별 TMX 추출 → FLUX 생성 → 장식 추출·재배치. 원본·실패 결과 보존. 게임에는 자동 적용하지 않습니다.</p><a href="/editor.html?workspace=style">스타일 변환으로 돌아가기</a><div id="status">불러오는 중</div><a id="preview" hidden href="preview.png">전체 맵 합성 결과 보기</a><main></main><script>
const run=location.pathname.split('/')[2];const cards=new Map();
function pic(slot,path,label){if(slot.dataset.path===path)return;const img=new Image();img.alt=label;img.onload=()=>{slot.replaceChildren(img);slot.dataset.path=path};img.onerror=()=>{slot.textContent='이미지 읽기 실패'};img.src=path;}
async function poll(){try{const s=await(await fetch('/api/prompt-theme/runs/'+run,{cache:'no-store'})).json();const rows=Object.entries(s.object_results||{});const failed=rows.filter(([,r])=>r.status==='failed').length;document.querySelector('#status').textContent=`${s.status==='running'?'생성 중':s.status==='ready'?'전체 시도 완료':s.status} · 처리 ${s.processed_objects||0}/${s.total_objects} · 결과 ${s.completed_objects||0} · 실패 ${failed}`;for(const [name,r] of rows){if(!cards.has(name)){const c=document.createElement('article');const h=document.createElement('h2');h.textContent=name;const t=document.createElement('p');const pair=document.createElement('div');pair.className='pair';const a=document.createElement('div');a.className='slot';a.textContent='원본 준비 중';const b=a.cloneNode(true);b.textContent='생성 대기';pair.append(a,b);const e=document.createElement('div');e.className='error';c.append(h,t,pair,e);document.querySelector('main').append(c);cards.set(name,{t,a,b,e})}const c=cards.get(name);c.t.textContent=({pending:'대기',running:'FLUX 생성 중',ready:'생성 결과 · 시각 검수 필요',reused:'동일 원본 결과 재사용',failed:'실패 · 다음 대상 계속 진행'})[r.status]||r.status;c.e.textContent=r.error||r.warning||'';if(r.source_available)pic(c.a,name+'-original.png','원본');if(['ready','reused'].includes(r.status))pic(c.b,name+'/composite.png','원본 + FLUX 장식');else c.b.textContent=r.status==='failed'?'생성 실패':r.status==='running'?'생성 중…':'생성 대기';}if(s.preview)document.querySelector('#preview').hidden=false;if(s.status==='running')setTimeout(poll,10000);}catch(e){document.querySelector('#status').textContent='연결 재시도 중';setTimeout(poll,10000)}}poll();</script><script src="timing-ui.js"></script></html>'''
        (folder/'review.html').write_text(html,encoding='utf8')
        shutil.copy2(Path(__file__).parent/'client/timing-ui.js',folder/'timing-ui.js')
        overlays={};cache={};failed={};reused={}
        for index,o in enumerate(objects):
            name=o['id'];target=folder/name;target.mkdir()
            record=data['object_results'][name];record['source_available']=(folder/(name+'-original.png')).exists()
            timer=time.perf_counter();record.update(status='running',started_at=time.time(),estimated=False)
            data['current_object']=name;save_status(folder,data)
            try:
                source=Image.open(folder/(name+'-original.png')).convert('RGBA')
                profile=p[name];key=hashlib.sha256(source.tobytes()+json.dumps({k:v for k,v in profile.items() if k not in ['box','label']},sort_keys=True).encode()).hexdigest()
                (target/'profile.json').write_text(json.dumps(profile,ensure_ascii=False,indent=2),encoding='utf8')
                if key in cache:
                    owner=cache[key];overlay=overlays[owner].copy();reused[name]=owner
                    record.update(status='reused',reused_from=owner)
                    (target/'reuse.json').write_text(json.dumps({'from':owner,'hash':key}),encoding='utf8')
                else:
                    overlay,counts=generate(target,source,o,profile,FLUX);record.update(status='ready',counts=counts)
                    missing=[k for k in ['snow','garland'] if counts[k]<4]
                    if counts['lights']<4 and not counts['relocated_bulbs']:missing.append('lights')
                    if missing:record['warning']='장식 일부 부족: '+', '.join(missing)
                    cache[key]=name
                overlay.save(folder/(name+'-decoration.png'));overlay.save(target/'decoration.png')
                Image.alpha_composite(source,overlay).save(target/'composite.png');overlays[name]=overlay
                assert Image.alpha_composite(source,overlay).getchannel('A').tobytes()==source.getchannel('A').tobytes()
                print('DONE '+name+' '+record['status'],flush=True)
            except Exception as e:
                record.update(status='failed',error=str(e));failed[name]=str(e);print('FAILED '+name+' '+str(e),flush=True)
            record.update(finished_at=time.time(),elapsed_seconds=time.perf_counter()-timer)
            timing=target/'request-timing.json'
            if timing.exists():record['generation_seconds']=json.loads(timing.read_text(encoding='utf8'))['generation_seconds']
            data.update(processed_objects=index+1,completed_objects=len(overlays),failed_objects=failed)
            save_status(folder,data)
        deco=Image.new('RGBA',original.size);placements=[];successful=[]
        for o in objects:
            name=o['id']
            if name not in overlays:continue
            successful.append(o);x,y,w,h=o['box'];deco.alpha_composite(overlays[name],(x,y))
            placements.append({'id':folder.name+'-'+name,'kind':'object','col':x/32,'row':y/32,'imageUrl':f'/theme-runs/{folder.name}/{name}-decoration.png','anchor':'top-left','renderLayer':'decoration','sourceGroup':'prompt-theme','visible':True})
        Image.new('RGBA',(1,1)).save(folder/'settings.png')
        placements.insert(0,{'id':folder.name+'-settings','kind':'object','col':0,'row':0,'imageUrl':f'/theme-runs/{folder.name}/settings.png','renderLayer':'decoration','sourceGroup':'prompt-theme','visible':True,'themeSettings':{'runId':folder.name,'night':.58,'twinkle':True,'color':spec['color']}})
        base=Image.alpha_composite(original,Image.new('RGBA',original.size,(7,19,46,148)))
        Image.alpha_composite(base,deco).save(folder/'preview.png');deco.save(folder/'decoration-map.png')
        (folder/'manifest.json').write_text(json.dumps({'pipeline':data['pipeline'],'spec':spec,'source_hashes':hashes,'objects':successful,'placements':placements,'failed_objects':failed,'reused_objects':reused,'covered_parts':PARTS,'geometry_preserved':True,'alpha_preserved':True},ensure_ascii=False,indent=2),encoding='utf8')
        data.update(status='ready' if successful else 'failed',stage=7,preview=f'/theme-runs/{folder.name}/preview.png',original=f'/theme-runs/{folder.name}/original-map.png',warnings=['전체 대상 시도 완료. 부분 누락·실패는 카드에서 확인하세요. 시각 검수 및 게임 적용 전입니다.'])
    except Exception as e:data.update(status='failed',error=str(e))
    finally:save_status(folder,data);lock.unlink(missing_ok=True)
    print(json.dumps(data,ensure_ascii=False),flush=True)

if __name__=='__main__':main()
