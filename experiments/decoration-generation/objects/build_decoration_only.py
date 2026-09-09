from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'decoration-only';OUT.mkdir(exist_ok=True)
placements=[];previews=[]
for source in json.loads((ROOT/'sources.json').read_text()):
 name=source['name'];image=Image.open(ROOT/f'{name}-flux.png').convert('RGB')
 # Align only the decoration reference; never resample the original asset.
 if name=='fountain_1':
  image=image.resize((288,288),Image.Resampling.LANCZOS)
  aligned=Image.new('RGB',(320,320),(128,128,128));aligned.paste(image,(16,16));image=aligned
 rgb=np.asarray(image).astype(float)
 maximum=rgb.max(2);minimum=rgb.min(2)
 saturation=(maximum-minimum)/np.maximum(maximum,1)
 yy,xx=np.indices((320,320))
 x,y,w,h=source['map_box'];ox,oy=source['offset']
 reference=Image.new('RGBA',(320,320))
 reference.alpha_composite(Image.open(ROOT/f'{name}-original.png').convert('RGBA').resize((w*2,h*2),Image.Resampling.NEAREST),(ox,oy))
 ref=np.asarray(reference).astype(float)
 snow=(minimum>185)&(saturation<0.16)
 bulbs=(rgb[:,:,0]>165)&(rgb[:,:,1]>85)&(rgb[:,:,2]<110)&(rgb[:,:,0]>rgb[:,:,1]*1.2)
 if name=='tree_1':
  # Keep decorations on actual original foliage, not generated empty space.
  region=(ref[:,:,3]>200)&(ref[:,:,1]>ref[:,:,0]*1.05)&(ref[:,:,1]>ref[:,:,2]*1.12)
 elif name=='fountain_1':
  # Only the cap and rim, not the water highlights or stone body.
  radius=((xx-160)/73)**2+((yy-163)/58)**2
  region=((yy<109)&(yy>69)&(xx>134)&(xx<187))|((radius>.78)&(radius<1.13)&(yy>106)&(yy<227))
  stone=(ref[:,:,3]>200)&(np.abs(ref[:,:,0]-ref[:,:,1])<18)&(np.abs(ref[:,:,1]-ref[:,:,2])<18)&(ref[:,:,:3].min(2)>100)
  region=region&stone
 else:
  # A shallow snow strip only: never cover the original striped cloth.
  snow=snow&(yy>=oy)&(yy<oy+14)&(xx>=ox)&(xx<ox+w*2)
  # Shift extracted bulbs to the original awning's lower edge.
  bulb_rgba=Image.fromarray(np.dstack((rgb.astype('uint8'),(bulbs*255).astype('uint8'))),'RGBA')
  shifted=Image.new('RGBA',(320,320));shifted.alpha_composite(bulb_rgba,(0,-14))
  shifted_array=np.asarray(shifted)
  bulbs=(shifted_array[:,:,3]>0)&(yy>=oy+88)&(yy<oy+106)&(xx>=ox)&(xx<ox+w*2)
  rgb[bulbs]=shifted_array[:,:,:3][bulbs]
  region=(ref[:,:,3]>0)|(bulbs)
 mask=(snow|bulbs)&region
 overlay=Image.fromarray(np.dstack((rgb.astype('uint8'),(mask*255).astype('uint8'))),'RGBA')
 overlay=overlay.resize((160,160),Image.Resampling.LANCZOS)
 overlay.save(OUT/f'{name}-decorations.png')
 x,y,w,h=source['map_box'];ox,oy=source['offset']
 placements.append(dict(id=f'flux-decoration-20260909-{name}',kind='object',col=(x-ox/2)/32,row=(y-oy/2)/32,
  label=f'FLUX decorations only {name}',imageUrl=f'/experiments/flux-decorations-20260909/{name}-decorations.png?v=aligned2',
  anchor='top-left',displayScale=1,renderLayer='decoration',sourceGroup='flux-decorations-20260909',visible=True))
 original=Image.new('RGBA',(160,160),(128,128,128,255))
 original.alpha_composite(Image.open(ROOT/f'{name}-original.png').convert('RGBA'),(ox//2,oy//2))
 composite=Image.alpha_composite(original,overlay)
 previews.append((original,overlay,composite))
sheet=Image.new('RGB',(960,1000),'#edf1f5');draw=ImageDraw.Draw(sheet)
for i,t in enumerate(['ORIGINAL (UNCHANGED)','DECORATION LAYER ONLY','COMPOSITE']):draw.text((i*320+12,10),t,fill='black')
for row,triplet in enumerate(previews):
 for col,im in enumerate(triplet):
  bg=Image.new('RGBA',im.size,(70,80,95,255));bg.alpha_composite(im)
  sheet.paste(bg.convert('RGB').resize((320,320),Image.Resampling.NEAREST),(col*320,30+row*320))
sheet.save(OUT/'verification.png')
(OUT/'placements.json').write_text(json.dumps(placements,indent=2),encoding='utf-8')
