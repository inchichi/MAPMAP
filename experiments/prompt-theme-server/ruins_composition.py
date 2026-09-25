"""Rebuild selected prop revisions from a stable base; never stack old margins."""
import json, re
import numpy as np
from PIL import Image


def compose(root, parent, spec, revisions):
    base_id=parent.get('composition_base_id',parent['id'])
    if not re.fullmatch('[a-f0-9]{32}',base_id): raise ValueError('Invalid composition base')
    base_manifest=json.loads((root/base_id/'crypt-manifest.json').read_text(encoding='utf8'))
    overlay=Image.open(root/base_id/'decoration-map.png').convert('RGBA')
    bulbs=base_manifest['bulbs'].copy()
    for name,run_id in revisions.items():
        if not re.fullmatch('[a-f0-9]{32}',run_id) or not re.fullmatch(r'prop-\d+',name): raise ValueError('Invalid revision path')
        folder=root/run_id/name
        output=Image.open(folder/'composite.png').convert('RGBA')
        offset=json.loads((folder/'placement.json').read_text(encoding='utf8'))
        pixels=np.array(output);pixels[:,:,:3]=(pixels[:,:,:3].astype(float)*.9).astype('uint8')
        lights=[]
        if offset.get('twinkle'):
            a=np.array(Image.open(folder/'decoration.png').convert('RGBA'))
            ys,xs=np.where((a[:,:,0]>205)&(a[:,:,1]>135)&(a[:,:,2]<170)&(a[:,:,3]>90))
            lights=list(zip(xs[::3],ys[::3]))
        for p in spec['instances']:
            if p['asset']!=name:continue
            x,y=p['x']+offset['x'],p['y']+offset['y']
            overlay.alpha_composite(Image.fromarray(pixels),(x,y))
            bulbs=[[bx,by] for bx,by in bulbs if not(x<=bx<x+output.width and y<=by<y+output.height)]
            bulbs += [[int(x+bx),int(y+by)] for bx,by in lights if 0<=x+bx<overlay.width and 0<=y+by<overlay.height]
    return overlay,bulbs,base_id
