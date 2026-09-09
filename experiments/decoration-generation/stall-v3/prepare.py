from pathlib import Path
from PIL import Image
import numpy as np
p=Path(__file__).resolve().parent
im=Image.open(p/'flux-raw.png').convert('RGBA')
a=np.array(im)
magenta=(a[:,:,0]>140)&(a[:,:,2]>90)&(a[:,:,1]<100)
a[magenta]=0
im=Image.fromarray(a)
overlay=Image.new('RGBA',(160,160))
snow=im.crop((47,151,275,220)).resize((96,8),Image.Resampling.NEAREST)
wire=im.crop((40,221,279,289)).resize((96,19),Image.Resampling.NEAREST)
overlay.alpha_composite(snow,(32,29))
overlay.alpha_composite(wire,(32,77))
overlay.save(p/'blacksmith-stall-decorations-v3.png')
base=Image.new('RGBA',(160,160),(90,100,105,255))
base.alpha_composite(Image.open(p.parent/'objects/blacksmith_stall-original.png').convert('RGBA'),(32,32))
base.alpha_composite(overlay)
base.resize((640,640),Image.Resampling.NEAREST).save(p/'preview.png')
