import json, time, traceback
from pathlib import Path
import requests
from PIL import Image

ROOT = Path(__file__).resolve().parent
source = Image.open(ROOT / 'original.png').convert('RGBA')
canvas = Image.new('RGB', source.size, '#808080')
canvas.paste(source, mask=source.getchannel('A'))
canvas.save(ROOT / 'input.png')
cases = {
 'atlas': 'Replace the building with separate pixel-art Christmas decorations: one string of glowing bulbs, one wreath, one garland, and three snow caps. Solid gray background, spaced apart, no building, no cast shadows.',
 'attached': 'Add Christmas bulb strings along roof edges, a wreath above the door, and snow caps on roof and window ledges. Keep every door, window, building shape and position unchanged. Pixel art, gray background, no cast shadows.'
}
results = []
for model, port in [('qwen',8766),('flux',8765)]:
 for case, prompt in cases.items():
  record = dict(model=model, case=case, prompt=prompt, steps=28, alpha=1.0,
                seed='service-generated random seed; not exposed', geometry_lock=False)
  started = time.time()
  try:
   record['health'] = requests.get(f'http://127.0.0.1:{port}/health',timeout=15).json()
   with open(ROOT/'input.png','rb') as handle:
    response = requests.post(f'http://127.0.0.1:{port}/style-transfer',files={'content':('input.png',handle,'image/png')},data={'prompt':prompt,'steps':28,'alpha':1.0,'geometry_lock':'false'},timeout=2400)
   record['http_status'] = response.status_code
   response.raise_for_status()
   (ROOT/f'{model}-{case}.png').write_bytes(response.content)
   record['status']='success'
  except Exception as exc:
   record['status']='failed'
   record['error']=str(exc)
   traceback.print_exc()
  record['seconds']=round(time.time()-started,2)
  results.append(record)
  (ROOT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
  print(json.dumps(record,ensure_ascii=False),flush=True)
