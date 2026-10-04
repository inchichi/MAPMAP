"""Conservative offline placement experiments. No runtime/collision mutation."""
from collections import deque
import math
import xml.etree.ElementTree as ET
import numpy as np


def reachable(blocked,start):
    h,w=blocked.shape
    if blocked[start[1],start[0]]:return set()
    seen={start};queue=deque([start])
    while queue:
        x,y=queue.popleft()
        for p in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
            if 0<=p[0]<w and 0<=p[1]<h and not blocked[p[1],p[0]] and p not in seen:
                seen.add(p);queue.append(p)
    return seen


def load_constraints(path):
    root=ET.parse(path).getroot();tw=int(root.get('tilewidth'));th=int(root.get('tileheight'))
    w=int(root.get('width'));h=int(root.get('height'));blocked=np.zeros((h,w),bool)
    for layer in root.findall('layer'):
        if layer.get('name','').lower()=='object':
            values=[int(v) for v in layer.find('data').text.replace('\n','').split(',') if v.strip()]
            blocked|=np.array(values).reshape(h,w)!=0
    reserved=np.zeros_like(blocked);buildings=[]
    def reserve(x,y,bw,bh,pad):
        left=max(0,math.floor(x/tw)-pad);top=max(0,math.floor(y/th)-pad)
        right=min(w,math.ceil((x+bw)/tw)+pad);bottom=min(h,math.ceil((y+bh)/th)+pad)
        reserved[top:bottom,left:right]=True
    for obj in root.findall('.//object'):
        x,y,bw,bh=[float(obj.get(k,'0')) for k in ['x','y','width','height']]
        kind=obj.get('type');props={p.get('name'):p.get('value') for p in obj.findall('properties/property')}
        if kind=='building':
            buildings.append({'id':obj.get('name'),'box':[int(x),int(y),int(bw),int(bh)]})
            # Protect a conservative central approach; not a semantic door detector.
            reserve(x+bw*.35,y+bh,bw*.3,th*3,1)
        elif kind=='character':
            reserve(x,y,max(bw,tw),max(bh,th),int(props.get('controller.radiusInTiles') or 0)+2)
        elif kind=='portal':reserve(x,y,max(bw,tw),max(bh,th),2)
        elif bw>0 and bh>0:reserve(x,y,bw,bh,0)
    free=[(x,y) for y in range(h) for x in range(w) if not blocked[y,x]]
    start=min(free,key=lambda p:abs(p[0]-w//2)+abs(p[1]-h//2))
    return tw,th,blocked,reserved,buildings,start


def ground_placements(path,per_building=2):
    tw,th,blocked,reserved,buildings,start=load_constraints(path)
    baseline=reachable(blocked,start);working=blocked.copy();chosen=[];rejected=0
    for building in buildings:
        x,y,bw,bh=building['box'];cx=(x+bw*.5)/tw;base=(y+bh)/th
        candidates=[]
        for ty in range(max(0,int(base)),min(blocked.shape[0],math.ceil(base)+4)):
            for tx in range(max(0,int(x/tw)-1),min(blocked.shape[1],math.ceil((x+bw)/tw)+1)):
                candidates.append((abs(ty-base)*2+abs(abs(tx-cx)-bw/tw*.38),(tx,ty)))
        count=0
        for _,(tx,ty) in sorted(candidates):
            if working[ty,tx] or reserved[ty,tx] or (tx,ty) not in baseline:continue
            if any(abs(tx-p['col'])+abs(ty-p['row'])<3 for p in chosen):continue
            candidate=working.copy();candidate[ty,tx]=True
            remaining=reachable(candidate,start)
            removed={(p['col'],p['row']) for p in chosen}|{(tx,ty)}
            if remaining!=baseline-removed:rejected+=1;continue
            working=candidate
            chosen.append({'building':building['id'],'col':tx,'row':ty,'x':tx*tw,'y':ty*th,
                           'width':tw,'height':th,'kind':'ground'})
            count+=1
            if count==per_building:break
    return {'placements':chosen,'building_count':len(buildings),'requested':len(buildings)*per_building,
            'connectivity_rejections':rejected,'baseline_reachable_tiles':len(baseline),
            'final_reachable_tiles':len(reachable(working,start)),'game_applied':False,
            'limitations':['Offline tile-level check; not a runtime navigation test.',
                          'Central approach reserve is a heuristic, not detected door geometry.',
                          'NPC protection uses TMX homes and configured wander radius; dynamic paths need runtime review.']}


def wall_anchors(source,size=32,count=2):
    a=np.array(source.convert('RGBA'));rgb=a[:,:,:3].astype(float)
    neutral=(rgb.max(2)-rgb.min(2)<24)&(rgb.mean(2)>115)&(a[:,:,3]>250)
    anchors=[]
    for y in range(int(source.height*.5),int(source.height*.82)-size,8):
        for x in range(8,source.width-size,8):
            patch=neutral[y:y+size,x:x+size]
            if patch.mean()<.98:continue
            if any(abs(x-p['x'])<size*3 and abs(y-p['y'])<size*3 for p in anchors):continue
            anchors.append({'x':x,'y':y,'width':size,'height':size,'kind':'wall'})
            if len(anchors)==count:return anchors
    return anchors
