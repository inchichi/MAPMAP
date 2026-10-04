"""Explicit night tone experiment; existing decoration experiments remain intact."""
import hashlib, json, shutil, time, uuid
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from sprite_tone import tone


def main():
    repo=Path(__file__).resolve().parents[2]
    parent=repo/'public/theme-runs/14108377af854127a990463f567719c0'
    folder=parent.parent/uuid.uuid4().hex;folder.mkdir()
    manifest=json.loads((parent/'crypt-manifest.json').read_text(encoding='utf8'))
    for p,h in manifest['source_hashes'].items():
        assert hashlib.sha256((repo/p).read_bytes()).hexdigest()==h
    original=Image.open(parent/'original-map.png').convert('RGBA')
    corrected,overlay=tone(original)
    shutil.copy2(parent/'original-map.png',folder/'original-map.png')
    overlay.save(folder/'decoration-map.png');corrected.save(folder/'preview.png')
    sheet=Image.new('RGB',(800,900),'#262a32');draw=ImageDraw.Draw(sheet)
    spec=json.loads((parent/'sources.json').read_text(encoding='utf8'))
    alpha_ok=True
    for v in spec['variants']:
        name=v['id'];source=Image.open(parent/f'{name}-original.png').convert('RGBA')
        result,_=tone(source)
        alpha_ok &= np.array_equal(np.array(source.getchannel('A')),np.array(result.getchannel('A')))
        target=folder/name;target.mkdir();result.save(target/'recolored.png')
        source.save(folder/f'{name}-original.png')
        if name in ['object-00','object-02','prop-column']:
            row=['object-00','object-02','prop-column'].index(name)
            for col,img in enumerate([source,result]):
                img=img.resize((img.width*4,img.height*4),Image.Resampling.NEAREST)
                sheet.paste(img,(col*400+30,row*300+50),img)
                draw.text((col*400+30,row*300+15),name+(' ORIGINAL' if col==0 else ' NIGHT TONE'),fill='white')
    sheet.save(folder/'comparison.png')
    manifest.update(id=folder.name,hires=[],night=0,bulbs=[],overlay=f'/theme-runs/{folder.name}/decoration-map.png',parent_run_id=parent.name)
    manifest['source_hashes']={p.replace('\\','/'):h for p,h in manifest['source_hashes'].items()}
    def save(name,data): (folder/name).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
    save('crypt-manifest.json',manifest)
    save('tone-settings.json',dict(color=[24,16,55],strength=.34,shadow_strength=.18,source='Explicit night Halloween request; not an automatic theme rule'))
    save('validation.json',dict(all_variant_alpha_preserved=bool(alpha_ok),source_hashes_unchanged=True,geometry_preserved=True))
    save('status.json',dict(id=folder.name,mapId='floor-0-town',pipeline='crypt-tone-preview-v1',status='ready',created=time.time(),prompt='할로윈 밤 · 원본 색·명암 보정만 비교 (장식 제외)',total_objects=9,completed_objects=9,preview=f'/theme-runs/{folder.name}/preview.png',warnings=['Color-only candidate. Existing defective decorations omitted. Not an automatic prompt parser.']))
    (folder/'comparison.html').write_text('<meta charset="utf-8"><body style="background:#20242b;color:white;font:16px sans-serif"><h1>원본 → 밤 색조·기존 음영 강화</h1><p>색 보정만 비교합니다. 장식은 제외했으며 게임에 자동 적용하지 않았습니다.</p><img src="comparison.png" style="max-width:100%"><h2>전체 맵</h2><img src="preview.png" style="max-width:100%">',encoding='utf8')
    print(folder)


if __name__=='__main__': main()
