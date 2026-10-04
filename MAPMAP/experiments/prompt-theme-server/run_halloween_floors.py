"""Resume preserved floor-0 outputs, then generate floor-1; no auto apply."""
import json,time,uuid
from run_town_halloween import main
from theme_pipeline import ROOT

folder=ROOT/('queue-'+uuid.uuid4().hex);folder.mkdir()
state={'created':time.time(),'status':'running','runs':[]}
def save(): (folder/'queue.json').write_text(json.dumps(state,indent=2),encoding='utf8')
save();print(folder,flush=True)
try:
    for source,map_id,reuse in [('439829ae8582448db82218a31a5878f6','floor-0-town','bfc245eff81b4d44bcf88054fe55917a'),
                               ('fc08ef59ccc44776ac6b3a3b019ffa17','floor-1-ruins',None)]:
        state['current_map']=map_id;save()
        result=main(source,map_id,reuse)
        state['runs'].append({'mapId':map_id,'id':result});save()
    state['status']='ready'
except Exception as error:
    state.update(status='failed',error=str(error));raise
finally: save()
