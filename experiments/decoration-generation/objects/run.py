from pathlib import Path
import requests,time,json,traceback
ROOT=Path(__file__).resolve().parent
cases={
 'tree_1':'Keep this tree at exactly the same position, size and shape. Add Christmas bulb strings and thin patches of settled snow resting on its branches. Preserve the trunk. Pixel art, solid gray background, no new objects, no cast shadows.',
 'fountain_1':'Keep this fountain at exactly the same position, size and shape. Add Christmas bulb strings around the basin and thin settled snow on its rim. Preserve the water and central pillar. Pixel art, solid gray background, no new objects, no cast shadows.',
 'blacksmith_stall':'Keep this market stall at exactly the same position, size and shape. Add Christmas bulbs along the awning and thin settled snow resting on top. Preserve all poles and the open entrance. Pixel art, solid gray background, no new objects, no cast shadows.'
}
results=[]
for name,prompt in cases.items():
 for model,port in [('qwen',8766),('flux',8765)]:
  record=dict(object=name,model=model,prompt=prompt,steps=28,alpha=0.5,geometry_lock=False,seed='random, not exposed')
  start=time.time()
  try:
   record['health']=requests.get(f'http://127.0.0.1:{port}/health',timeout=20).json()
   with open(ROOT/f'{name}-input.png','rb') as f:
    r=requests.post(f'http://127.0.0.1:{port}/style-transfer',files={'content':('input.png',f,'image/png')},data={'prompt':prompt,'steps':28,'alpha':0.5,'geometry_lock':'false'},timeout=2400)
   record['http_status']=r.status_code;r.raise_for_status()
   (ROOT/f'{name}-{model}.png').write_bytes(r.content);record['status']='success'
  except Exception as e:
   record.update(status='failed',error=str(e));traceback.print_exc()
  record['seconds']=round(time.time()-start,2);results.append(record)
  (ROOT/'results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
  print(json.dumps(record),flush=True)
