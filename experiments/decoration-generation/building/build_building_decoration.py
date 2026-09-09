from pathlib import Path
import json
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'building-decoration';OUT.mkdir(exist_ok=True)
original=Image.open(ROOT/'original.png').convert('RGBA')
flux=Image.open(ROOT/'flux-attached.png').convert('RGB')
rgb=np.asarray(flux).astype(float);ref=np.asarray(original).astype(float)
yy,xx=np.indices(rgb.shape[:2])
snow=(rgb.min(2)>195)&((rgb.max(2)-rgb.min(2))<32)
roof=(ref[:,:,2]>ref[:,:,0]*1.2)&(ref[:,:,2]>ref[:,:,1]*1.04)&(ref[:,:,3]>200)
mask=snow&roof
wreath_region=(xx>205)&(xx<307)&(yy>184)&(yy<265)
green=(rgb[:,:,1]>rgb[:,:,0]*1.12)&(rgb[:,:,1]>rgb[:,:,2]*1.15)
red=(rgb[:,:,0]>rgb[:,:,1]*1.5)&(rgb[:,:,0]>rgb[:,:,2]*1.5)
mask|=wreath_region&(green|red)
overlay=Image.fromarray(np.dstack((rgb.astype('uint8'),(mask*255).astype('uint8'))),'RGBA')
# Reuse one generated bulb, positioning it on original eaves, not generated geometry.
crop=flux.crop((245,158,264,179));c=np.asarray(crop).astype(float)
bulb_mask=(c[:,:,0]>150)&(c[:,:,1]>85)&(c[:,:,2]<100)&(c[:,:,0]>c[:,:,1]*1.08)
bulb=Image.fromarray(np.dstack((c.astype('uint8'),(bulb_mask*255).astype('uint8'))),'RGBA')
points=[(8,222),(29,201),(50,180),(73,165),(103,165),(133,165),(164,259),(186,237),(208,215),(230,193),(253,171),(276,193),(298,215),(320,237),(342,259),(376,165),(406,165),(436,165),(460,183),(483,206),(504,228)]
for x,y in points:overlay.alpha_composite(bulb,(x-9,y-10))
overlay.save(OUT/'town-hall-decorations.png')
Image.alpha_composite(original,overlay).save(OUT/'composite.png')
sheet=Image.new('RGBA',(1536,510),(90,95,105,255))
for i,im in enumerate([original,overlay,Image.alpha_composite(original,overlay)]):sheet.alpha_composite(im,(i*512,30))
sheet.convert('RGB').save(OUT/'verification.png')
placement=dict(id='flux-decoration-20260909-town_hall',kind='object',col=17,row=1,label='FLUX building decorations only',imageUrl='/experiments/flux-decorations-20260909/town-hall-decorations.png?v=1',anchor='top-left',displayScale=1,renderLayer='decoration',sourceGroup='flux-decorations-20260909',visible=True)
(OUT/'building-placement.json').write_text(json.dumps(placement,indent=2),encoding='utf-8')
