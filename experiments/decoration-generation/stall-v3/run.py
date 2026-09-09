from pathlib import Path
import requests,json,time
ROOT=Path(__file__).resolve().parent
prompt='Replace the stall with two separate pixel-art decoration strips. Top: thin uneven settled snow with tiny overhangs. Bottom: a sagging dark cable connecting eight warm golden bulbs. Solid magenta background. No stall, no cloth, no shadows, no text.'
start=time.time()
with open(ROOT/'input.png','rb') as f:
 r=requests.post('http://127.0.0.1:8765/style-transfer',files={'content':('input.png',f,'image/png')},data={'prompt':prompt,'steps':28,'alpha':1.0,'geometry_lock':'false'},timeout=1800)
r.raise_for_status();(ROOT/'flux-raw.png').write_bytes(r.content)
(ROOT/'run.json').write_text(json.dumps(dict(prompt=prompt,steps=28,alpha=1.0,seconds=time.time()-start,backend='FLUX.1-Kontext-dev',seed='service random'),indent=2))
print('Saved FLUX raw output',flush=True)
