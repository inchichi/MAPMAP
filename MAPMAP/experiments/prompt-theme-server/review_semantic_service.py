"""Inspect saved semantic masks on original geometry; never auto-apply."""
import json, re, time
from pathlib import Path
import cv2
import numpy as np
import requests
from PIL import Image
from compare_palette_decorations import recolor
from registered_decoration import extract_registered


def main():
    root=Path(__file__).resolve().parents[2]/'public/theme-runs'
    folder=root/'1a8967fde9194d3aa55421af7885e8ba'
    parent=root/'14108377af854127a990463f567719c0'
    data=json.loads((folder/'response.json').read_text(encoding='utf8'))['data']
    layer=Image.new('RGBA',(data['width'],data['height']))
    for item in data['objects']:
        url=item['assetUrl']
        if not re.fullmatch(r'/jobs/[a-f0-9]+/object-\d+\.png',url): raise ValueError('Invalid artifact URL')
        response=requests.get('http://127.0.0.1:18770'+url,timeout=30);response.raise_for_status()
        path=folder/(item['id']+'.png');path.write_bytes(response.content)
        asset=Image.open(path).convert('RGBA')
        if asset.size!=(item['width'],item['height']): raise ValueError('Invalid crop size')
        layer.alpha_composite(asset,tuple(item['box'][:2]))
    source=Image.open(parent/'object-00-original.png').convert('RGBA')
    raw=Image.open(folder/'input.png')
    base,_,placement,registration=extract_registered(source,raw)
    warp=np.array(registration['warp'],np.float32)
    aligned=cv2.warpAffine(np.array(layer),warp,layer.size,flags=cv2.INTER_NEAREST|cv2.WARP_INVERSE_MAP)
    scale=placement['texture_scale'];margin=placement['margin']*scale
    deco=Image.fromarray(aligned).crop((32-margin,32-margin,32+(source.width+3)*scale,32+(source.height+3)*scale))
    base=recolor(base);base.save(folder/'base.png');deco.save(folder/'decoration.png')
    Image.alpha_composite(base,deco).save(folder/'composite.png')
    old=root/'92c74d5b208e404b9762c7870b017ada/object-00/composite.png'
    Image.open(old).save(folder/'previous.png')
    missing=sorted(set(data['labels'])-{o['label'] for o in data['objects']})
    (folder/'validation.json').write_text(json.dumps({'missing_labels':missing,'detected_objects':len(data['objects']),'registration':registration,'auto_apply':False},indent=2),encoding='utf8')
    (folder/'status.json').write_text(json.dumps(dict(id=folder.name,mapId='floor-0-town',pipeline='semantic-decoration-pilot-v1',status='awaiting_review',created=time.time(),prompt='할로윈 호박·거미줄 의미 분할 비교',total_objects=1,completed_objects=1,warnings=['거미줄 미검출: 부분 성공, 게임 미적용'],preview=f'/theme-runs/{folder.name}/composite.png'),ensure_ascii=False),encoding='utf8')
    (folder/'comparison.html').write_text('<meta charset="utf-8"><style>body{background:#202633;color:white;font:16px sans-serif}.grid{display:flex;gap:20px}img{width:420px;image-rendering:pixelated}figure{margin:12px}</style><h1>의미 분할 실험: 호박 4개 검출 · 거미줄 미검출</h1><p>기존 FLUX 원본 재사용 / GroundingDINO + SAM / 게임 미적용</p><div class="grid">'+''.join(f'<figure><img src="{f}.png"><figcaption>{label}</figcaption></figure>' for f,label in [('previous','이전 차영상'),('composite','의미 분할 합성'),('decoration','분리한 호박')])+'</div>',encoding='utf8')
    print(folder.name,missing)


if __name__=='__main__':main()
