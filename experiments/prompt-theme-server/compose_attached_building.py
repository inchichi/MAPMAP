"""Place a reviewed FLUX bulb on the recorded original eaves, as in the first demo."""
import json,sys
import numpy as np
from PIL import Image
from theme_pipeline import ROOT,save_status
from profile_decorations import profiles,rectangles

POINTS=[(8,222),(29,201),(50,180),(73,165),(103,165),(133,165),(164,259),(186,237),(208,215),(230,193),(253,171),(276,193),(298,215),(320,237),(342,259),(376,165),(406,165),(436,165),(460,183),(483,206),(504,228)]


def main(run_id,box):
    folder=ROOT/run_id;original=Image.open(folder/'building-original.png').convert('RGBA')
    generated=Image.open(folder/'flux-raw.png').convert('RGB')
    if generated.size!=original.size:raise ValueError('Unexpected output size; inspect alignment first')
    rgb=np.array(generated).astype(float);ref=np.array(original).astype(float);yy,xx=np.indices(rgb.shape[:2])
    snow=(rgb.min(2)>195)&((rgb.max(2)-rgb.min(2))<32)
    roof=(ref[:,:,2]>ref[:,:,0]*1.2)&(ref[:,:,2]>ref[:,:,1]*1.04)&(ref[:,:,3]>200)
    wreath=(xx>215)&(xx<290)&(yy>184)&(yy<252)
    green=(rgb[:,:,1]>rgb[:,:,0]*1.12)&(rgb[:,:,1]>rgb[:,:,2]*1.15)
    red=(rgb[:,:,0]>rgb[:,:,1]*1.5)&(rgb[:,:,0]>rgb[:,:,2]*1.5)
    mask=(snow&roof)|(wreath&(green|red))
    overlay=Image.fromarray(np.dstack((rgb.astype('uint8'),(mask*255).astype('uint8'))))
    crop=generated.crop(tuple(box));c=np.array(crop).astype(float)
    bulb_mask=(c[:,:,0]>150)&(c[:,:,1]>85)&(c[:,:,2]<100)&(c[:,:,0]>c[:,:,1]*1.08)
    if bulb_mask.sum()<4:raise ValueError('Selected bulb is empty')
    bulb=Image.fromarray(np.dstack((c.astype('uint8'),(bulb_mask*255).astype('uint8'))))
    bulb=bulb.crop(bulb.getbbox());bulb.save(folder/'selected-flux-bulb.png')
    bulb=bulb.resize((9,max(1,round(bulb.height*9/bulb.width))),Image.Resampling.LANCZOS)
    bulb.save(folder/'placed-flux-bulb.png')
    for x,y in POINTS:overlay.alpha_composite(bulb,(x-bulb.width//2,y-bulb.height//2))
    protected=rectangles(original.size,profiles()['town_hall']['protected_rects'])
    a=np.array(overlay);a[protected,3]=0;a[:,:,3]=np.minimum(a[:,:,3],np.array(original)[:,:,3]);overlay=Image.fromarray(a)
    assert not a[protected,3].any()
    composite=Image.alpha_composite(original,overlay)
    assert np.array_equal(np.array(composite)[:,:,3],np.array(original)[:,:,3])
    assert np.array_equal(np.array(composite)[a[:,:,3]==0],np.array(original)[a[:,:,3]==0])
    overlay.save(folder/'town_hall-decoration.png');composite.save(folder/'composite.png')
    source=json.loads((folder/'source.json').read_text(encoding='utf8'));state=json.loads((folder/'status.json').read_text(encoding='utf8'))
    spec={'theme':'christmas','decorations':['snow','lights','garland'],'night':True,'twinkle':True,'color':{'gain':[1,1,1],'bias':[0,0,0]},'warnings':['리스는 생성 결과에서 추출, 전구는 검수한 한 개를 원본 처마 21곳에 재배치했습니다.']}
    settings={'runId':run_id,'night':.58,'twinkle':True,'color':spec['color']}
    Image.new('RGBA',(1,1)).save(folder/'settings.png')
    placements=[{'id':run_id+'-settings','kind':'object','col':0,'row':0,'imageUrl':f'/theme-runs/{run_id}/settings.png','renderLayer':'decoration','sourceGroup':'prompt-theme','visible':True,'themeSettings':settings},
        {'id':run_id+'-town_hall','kind':'object','col':17,'row':1,'imageUrl':f'/theme-runs/{run_id}/town_hall-decoration.png','anchor':'top-left','renderLayer':'decoration','sourceGroup':'prompt-theme','visible':True}]
    manifest={'pipeline':state['pipeline'],'spec':spec,'source_hashes':source['source_hashes'],'objects':[{'id':'town_hall','category':'building','box':[544,32,512,480]}],
        'placements':placements,'geometry_preserved':True,'alpha_preserved':True,'reviewed_bulb_box':box,'placed_bulb_size':list(bulb.size),'reviewed_wreath_box':[215,184,290,252],'bulb_points':POINTS,'source_pixels_unchanged':True}
    (folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
    world=Image.open(folder/'original-map.png').convert('RGBA')
    world=Image.alpha_composite(world,Image.new('RGBA',world.size,(7,19,46,148)));world.alpha_composite(overlay,(544,32));world.save(folder/'preview.png')
    state.update(status='ready',stage=7,completed_objects=1,preview=f'/theme-runs/{run_id}/preview.png',original=f'/theme-runs/{run_id}/original-map.png',spec=spec,warnings=spec['warnings'])
    save_status(folder,state)
    cards=[('당시 FLUX 원본 출력','previous-flux.png'),('이번 FLUX 원본 출력','flux-raw.png'),('이번 원본 + 분리 데코','composite.png'),('원본 건물','building-original.png'),('투명 데코레이어','town_hall-decoration.png')]
    html='<!doctype html><meta charset="utf-8"><title>이전 방식 재실험</title><style>body{background:#19191c;color:#eee;font:16px/1.6 system-ui;padding:24px}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}section{background:#29292d;padding:16px;border-radius:12px}img{width:100%;image-rendering:pixelated;background:#808080}h2{font-size:16px}a{color:#dfbd82}@media(max-width:800px){main{grid-template-columns:1fr}}</style><h1>건물 단독 입력 · 이전 방식 재실험</h1><p>같은 프롬프트 / 28 steps / alpha 1.0 / FLUX · 무작위 시드. 눈·리스 추출 + 전구 1개를 원본 처마 21곳에 재배치. 게임에는 아직 적용하지 않았습니다.</p><a href="/editor.html?workspace=style">스타일 변환 → 실행 기록에서 승인·적용</a><main>'
    html+=''.join(f'<section><h2>{label}</h2><a href="{path}"><img src="{path}"></a></section>' for label,path in cards)+'</main>'
    (folder/'review.html').write_text(html,encoding='utf8');print(json.dumps({'ready':run_id,'bulbs':len(POINTS),'snow_pixels':int((snow&roof).sum()),'wreath_pixels':int((wreath&(green|red)).sum())}),flush=True)


if __name__=='__main__':main(sys.argv[1],[int(v) for v in sys.argv[2:6]])
