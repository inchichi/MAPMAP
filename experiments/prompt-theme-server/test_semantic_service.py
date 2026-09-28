"""Manual recorded service experiment, not an automatic unit test."""
import json, time, uuid, shutil
from pathlib import Path
import requests


def main():
    root=Path(__file__).resolve().parents[2]/'public/theme-runs'
    folder=root/uuid.uuid4().hex;folder.mkdir()
    source=root/'14108377af854127a990463f567719c0/object-00/flux-raw.png'
    shutil.copy2(source,folder/'input.png')
    settings={'labels':['pumpkin','cobweb'],'box_threshold':.2,'text_threshold':.2}
    (folder/'request.json').write_text(json.dumps(settings),encoding='utf8')
    start=time.time()
    try:
        with source.open('rb') as stream:
            response=requests.post('http://127.0.0.1:18770/segment',files={'image':('input.png',stream,'image/png')},
                                   data={**settings,'labels':json.dumps(settings['labels'])},timeout=300)
        (folder/'response.json').write_text(response.text,encoding='utf8')
        response.raise_for_status()
        print(json.dumps(response.json(),ensure_ascii=True))
    finally:
        (folder/'timing.json').write_text(json.dumps({'seconds':time.time()-start}),encoding='utf8')
        print(folder.name,flush=True)


if __name__=='__main__':main()
