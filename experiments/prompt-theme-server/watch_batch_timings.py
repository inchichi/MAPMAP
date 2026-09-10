"""Non-invasive timing estimates for a worker started before timing instrumentation."""
import json,sys,time
from pathlib import Path

def snapshot(folder,state):
    entries=state.get('object_results',{});rows={}
    for name,r in entries.items():
        target=folder/name;start=target/'profile.json';request=target/'generation.json';raw=target/'flux-raw.png';composite=target/'composite.png'
        row={'status':r['status'],'estimated':True}
        if start.exists():row['started_at']=start.stat().st_mtime
        if request.exists():row['generation_started_at']=request.stat().st_mtime
        if raw.exists() and request.exists():row['generation_seconds']=max(0,raw.stat().st_mtime-request.stat().st_mtime)
        if r['status'] in ['ready','reused'] and composite.exists() and start.exists():row['elapsed_seconds']=max(0,composite.stat().st_mtime-start.stat().st_mtime)
        if r['status']=='reused':row.update(reused_from=r.get('reused_from'),generation_seconds=None)
        rows[name]=row
    return {'updated_at':time.time(),'objects':rows,'method':'artifact modification times; estimated, not exact inference timing'}

def main(folder):
    while True:
        state=json.loads((folder/'status.json').read_text(encoding='utf8'))
        data=snapshot(folder,state)
        tmp=folder/'timings.tmp';tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8');tmp.replace(folder/'timings.json')
        if state['status'] not in ['running','queued']:break
        time.sleep(5)

if __name__=='__main__':main(Path(sys.argv[1]))
