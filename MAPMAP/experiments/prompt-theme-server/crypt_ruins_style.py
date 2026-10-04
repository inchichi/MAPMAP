"""Recorded FLUX winter materials for the ruins; source tiles stay untouched."""
import hashlib
import json
import shutil
import sys
import time
import uuid
import xml.etree.ElementTree as ET
from collections import Counter

import numpy as np
from PIL import Image

from theme_pipeline import REPO, ROOT, FLUX, save_status
from object_decorations import request_image
from crypt_full_style import extract_material
from run_records import record_event

MAP_ID = 'floor-1-ruins'


def load_map():
    path = REPO / f'public/crypt-maps/{MAP_ID}.tmx'
    m = ET.parse(path).getroot()
    tsx = (path.parent / m.find('tileset').get('source')).resolve()
    ts = ET.parse(tsx).getroot()
    png = tsx.parent / ts.find('image').get('source')
    atlas = Image.open(png).convert('RGBA')
    size = int(m.get('tilewidth'))
    width, height = int(m.get('width')), int(m.get('height'))
    columns = int(ts.get('columns'))
    first = int(m.find('tileset').get('firstgid'))
    layers = {l.get('name'): [int(v) for v in l.find('data').text.split(',') if v.strip()] for l in m.findall('layer')}

    def tile(raw):
        tid = (raw & 0x1fffffff) - first
        x, y = tid % columns * size, tid // columns * size
        image = atlas.crop((x, y, x + size, y + size))
        if raw & 0x20000000: image = image.transpose(Image.Transpose.TRANSPOSE)
        if raw & 0x80000000: image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        if raw & 0x40000000: image = image.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        return image

    hashes = {p.relative_to(REPO).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in [path, tsx, png]}
    opacity = {l.get('name'): float(l.get('opacity',1)) for l in m.findall('layer')}
    return width, height, size, layers, tile, hashes, opacity


def layer_tile(image, opacity):
    result=image.copy()
    result.putalpha(result.getchannel('A').point(lambda a: round(a*opacity)))
    return result


def prepare():
    width, height, size, layers, tile, hashes, opacity = load_map()
    folder = ROOT / uuid.uuid4().hex
    folder.mkdir()
    original = Image.new('RGBA', (width * size, height * size))
    for name, grid in layers.items():
        if name == 'collision': continue
        cache = {gid: layer_tile(tile(gid),opacity[name]) for gid in set(grid) - {0}}
        for i, gid in enumerate(grid):
            if gid: original.alpha_composite(cache[gid], (i % width * size, i // width * size))
    original.save(folder / 'original-map.png')
    variants, instances = [], []
    # Connected props are extracted as complete objects, not arbitrary rectangles.
    grid = layers['prop']
    occupied = {i for i, gid in enumerate(grid) if gid}
    cache = {}
    while occupied:
        stack = [min(occupied)]
        occupied.remove(stack[0])
        points = []
        while stack:
            i = stack.pop()
            points.append(i)
            x, y = i % width, i // width
            for xx, yy in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                j = yy * width + xx
                if 0 <= xx < width and 0 <= yy < height and j in occupied:
                    occupied.remove(j)
                    stack.append(j)
        x0, y0 = min(i % width for i in points), min(i // width for i in points)
        x1, y1 = max(i % width for i in points), max(i // width for i in points)
        source = Image.new('RGBA', ((x1-x0+1)*size, (y1-y0+1)*size))
        for i in points: source.alpha_composite(tile(grid[i]), ((i%width-x0)*size,(i//width-y0)*size))
        key = (source.size, hashlib.sha256(source.tobytes()).hexdigest())
        if key not in cache:
            name = f'prop-{len(cache):02d}'
            cache[key] = name
            source.save(folder / f'{name}-original.png')
            variants.append({'id': name, 'kind': 'prop', 'width': source.width, 'height': source.height})
        instances.append({'asset': cache[key], 'x': x0*size, 'y': y0*size, 'tiles': len(points)})
    for layer in ['ground', 'ground_deco', 'wall', 'wall_deco']:
        for gid, count in sorted(Counter(layers[layer]).items()):
            if not gid: continue
            name = f'{layer}-{gid}'
            tile(gid).save(folder / f'{name}-original.png')
            variants.append({'id':name,'kind':layer,'gid':gid,'width':size,'height':size,'count':count})
    spec = {'mapId': MAP_ID, 'width':width,'height':height,'tile_size':size,'hashes':hashes,'variants':variants,'instances':instances}
    (folder/'sources.json').write_text(json.dumps(spec,indent=2),encoding='utf8')
    status = {'id':folder.name,'mapId':MAP_ID,'pipeline':'crypt-ruins-winter-v1','status':'queued','stage':2,'created':time.time(),'prompt':'크리스마스 밤 · 눈 쌓인 폐허 · 얼음 식물 · 따뜻한 전구','total_objects':len(variants),'completed_objects':0,'instances':len(instances),'object_results':{},'original':f'/theme-runs/{folder.name}/original-map.png'}
    save_status(folder,status)
    print(folder.name, len(variants), Counter(v['kind'] for v in variants), 'prop instances',len(instances),flush=True)
    return folder.name


def generate(run_id):
    folder = ROOT / run_id
    spec = json.loads((folder/'sources.json').read_text(encoding='utf8'))
    status = json.loads((folder/'status.json').read_text(encoding='utf8'))
    lock = ROOT/'.batch.lock'
    with lock.open('x') as handle: handle.write(run_id)
    try:
        for kind in ['objects', 'surfaces']:
            variants = [v for v in spec['variants'] if (v['kind']=='prop') == (kind=='objects')]
            sheet = Image.new('RGB',(1024,1024),'#808080')
            slots = []
            for i,v in enumerate(variants):
                source = Image.open(folder/f'{v["id"]}-original.png').convert('RGBA')
                scale = min(6,96/max(source.size))
                big = source.resize((round(source.width*scale),round(source.height*scale)),Image.Resampling.NEAREST)
                x,y = i%8*128+(128-big.width)//2,i//8*128+(128-big.height)//2
                sheet.paste(big,(x,y),big)
                slots.append({'id':v['id'],'box':[x,y,x+big.width,y+big.height]})
            target = folder/kind
            target.mkdir(exist_ok=True)
            (target/'slots.json').write_text(json.dumps(slots),encoding='utf8')
            sheet.save(target/'flux-input.png')
            status.update(status='running',stage=4,current_object=kind)
            save_status(folder,status)
            prompt = ('Edit every pixel-art sprite in this sheet in place. Add small soft shaded white snow caps and tiny warm golden Christmas bulbs attached to the objects. Preserve the exact original objects, silhouette, proportions, supports and positions. '
                      if kind=='objects' else
                      'Winter material edit of this pixel-art tile sheet. Pale white snow dusting on stone floors, frosty blue stone walls, ice-crystal flowers and grass, small warm golden lights on wall fixtures. Retain the original masonry cracks and tile patterns. ')
            prompt += 'Each sprite stays in its original cell. Keep empty gray background unchanged. No extra sprites, no architecture changes, no cast shadows, no text.'
            if not (target/'flux-raw.png').exists():
                request_image(target,sheet,prompt,FLUX,1.0,pipeline='crypt-ruins-winter-v1')
            timing = json.loads((target/'request-timing.json').read_text())
            record_event(folder,'sheet_generated',sheet=kind,**timing)
            print('GENERATED',kind,timing['generation_seconds'],flush=True)
        status.update(status='awaiting_review',stage=5)
        save_status(folder,status)
    except Exception as error:
        status.update(status='failed',error=str(error));save_status(folder,status)
        raise
    finally:
        lock.unlink(missing_ok=True)


def winter_surface(source, generated, kind):
    """Borrow generated microtexture, retaining original alpha and masonry shading."""
    s = np.array(source).astype(float)
    g = np.array(generated.resize(source.size,Image.Resampling.LANCZOS).convert('RGB')).astype(float)
    lum = s[:,:,:3].mean(2)/255
    detail = (g.mean(2)-g.mean())/255
    if kind == 'ground':
        light = np.clip(.62+lum*.34+detail*.05,.58,.98)
        rgb = light[:,:,None]*np.array([217,235,250])
    elif kind == 'wall':
        light = np.clip(lum*.85+detail*.04,0,1)
        rgb = np.stack((20+light*145,29+light*158,45+light*180),axis=2)
    else:
        light = np.clip(lum*.65+g.mean(2)/255*.35,0,1)
        rgb = np.stack((38+light*175,105+light*140,165+light*85),axis=2)
        rgb[lum<.15] *= .5
    return Image.fromarray(np.dstack((np.clip(rgb,0,255).astype('uint8'),s[:,:,3].astype('uint8'))))


def generate_fixture(run_id):
    folder=ROOT/run_id
    source=Image.open(folder/'wall_deco-1775-original.png').convert('RGBA')
    canvas=Image.new('RGB',(512,512),'#808080')
    big=source.resize((384,384),Image.Resampling.NEAREST)
    canvas.paste(big,(64,64),big)
    target=folder/'festive-banner';target.mkdir(exist_ok=True)
    lock=ROOT/'.batch.lock'
    with lock.open('x') as handle:handle.write(run_id)
    status=json.loads((folder/'status.json').read_text(encoding='utf8'))
    try:
        status.update(status='running',current_object='festive-banner');save_status(folder,status)
        if not (target/'flux-raw.png').exists():
            request_image(target,canvas,'Keep this exact red hanging banner and its support posts unchanged. Add a connected strand of six glowing warm golden Christmas bulbs and a small green garland across the upper edge of the red fabric, with a thin soft snow cap. The bulbs must be clearly visible, golden round lights joined by a dark cable, attached to the banner. Pixel art. Same silhouette, same size, same position. Gray background stays empty. No text or extra objects.',FLUX,1.0,pipeline='crypt-ruins-winter-fixture-v1')
        timing=json.loads((target/'request-timing.json').read_text())
        record_event(folder,'fixture_generated',**timing)
        print('GENERATED festive-banner',timing['generation_seconds'],flush=True)
        status.update(status='awaiting_review');save_status(folder,status)
    except Exception as error:
        status.update(status='failed',error=str(error));save_status(folder,status)
        raise
    finally:lock.unlink(missing_ok=True)


def compose(run_id):
    folder = ROOT/run_id
    spec = json.loads((folder/'sources.json').read_text(encoding='utf8'))
    status = json.loads((folder/'status.json').read_text(encoding='utf8'))
    width,height,size,layers,tile,hashes,opacity = load_map()
    if hashes != spec['hashes']: raise ValueError('Source map changed during generation')
    variants = {v['id']:v for v in spec['variants']}
    outputs, decorations = {}, {}
    empty = []
    for kind in ['objects','surfaces']:
        target = folder/kind
        raw = Image.open(target/'flux-raw.png').convert('RGB').resize((1024,1024),Image.Resampling.LANCZOS)
        timing = json.loads((target/'request-timing.json').read_text())
        for slot in json.loads((target/'slots.json').read_text()):
            name = slot['id'];v = variants[name]
            source = Image.open(folder/f'{name}-original.png').convert('RGBA')
            aligned = raw.crop(slot['box'])
            dest = folder/name;dest.mkdir(exist_ok=True)
            aligned.save(dest/'aligned-high.png')
            if kind == 'objects':
                decoration = extract_material(source,aligned,'fence')
                a = np.array(decoration)
                a[:,:,3] = np.minimum(a[:,:,3],np.array(source)[:,:,3])
                decoration = Image.fromarray(a)
                if not decoration.getbbox():
                    empty.append(name)
                    # Bare twigs may get no new snow from FLUX. Explicit frost
                    # recoloring preserves them instead of inventing decorations.
                    decoration = winter_surface(source,aligned,'ground_deco')
                decoration.save(dest/'decoration.png')
                decorations[name] = decoration
                result = Image.alpha_composite(source,decoration)
            else:
                result = winter_surface(source,aligned,v['kind'])
            if not np.array_equal(np.array(result)[:,:,3],np.array(source)[:,:,3]):
                raise ValueError('Alpha mismatch: '+name)
            outputs[name] = result
            result.save(dest/'composite.png')
            status['object_results'][name] = {'status':'ready','generation_seconds':timing['generation_seconds'],'shared_request':kind,'source_available':True,'frost_only':name in empty}
    fixture=folder/'festive-banner/flux-raw.png'
    if fixture.exists():
        name='wall_deco-1775'
        source=Image.open(folder/f'{name}-original.png').convert('RGBA')
        aligned=Image.open(fixture).convert('RGB').resize((512,512),Image.Resampling.LANCZOS).crop((64,64,448,448))
        deco=extract_material(source,aligned,'fence')
        a=np.array(deco);a[:,:,3]=np.minimum(a[:,:,3],np.array(source)[:,:,3]);deco=Image.fromarray(a)
        decorations[name]=deco
        outputs[name]=Image.alpha_composite(source,deco)
        outputs[name].save(folder/name/'composite.png')
        deco.save(folder/name/'decoration.png')
        timing=json.loads((folder/'festive-banner/request-timing.json').read_text())
        status['object_results'][name].update(shared_request='festive-banner',generation_seconds=timing['generation_seconds'])
    styled = Image.new('RGBA',(width*size,height*size))
    original = Image.new('RGBA',styled.size)
    for layer,grid in layers.items():
        if layer == 'collision': continue
        originals = {gid:layer_tile(tile(gid),opacity[layer]) for gid in set(grid)-{0}}
        cache = {gid: layer_tile(outputs.get(f'{layer}-{gid}',tile(gid)),opacity[layer]) for gid in set(grid)-{0}}
        for i,gid in enumerate(grid):
            if gid:
                at=(i%width*size,i//width*size)
                styled.alpha_composite(cache[gid],at)
                original.alpha_composite(originals[gid],at)
    original.save(folder/'original-map.png')
    bulbs = []
    if 'wall_deco-1775' in decorations:
        a=np.array(decorations['wall_deco-1775'])
        ys,xs=np.where((a[:,:,0]>205)&(a[:,:,1]>135)&(a[:,:,2]<170)&(a[:,:,3]>90))
        for i,gid in enumerate(layers['wall_deco']):
            if gid==1775:
                for x,y in zip(xs[::2],ys[::2]):bulbs.append([int(i%width*size+x),int(i//width*size+y)])
    for p in spec['instances']:
        deco = decorations[p['asset']]
        styled.alpha_composite(deco,(p['x'],p['y']))
        a = np.array(deco)
        warm = (a[:,:,0]>205)&(a[:,:,1]>135)&(a[:,:,2]<170)&(a[:,:,3]>90)
        ys,xs = np.where(warm)
        for x,y in zip(xs[::3],ys[::3]): bulbs.append([int(p['x']+x),int(p['y']+y)])
    bulbs = bulbs[::max(1,(len(bulbs)+511)//512)]
    # Work in strips: a float array of this 6144-square map would exceed 1 GB.
    overlay = Image.new('RGBA',original.size)
    preview = Image.new('RGBA',original.size)
    changed = 0
    for y in range(0,original.height,128):
        box=(0,y,original.width,min(y+128,original.height))
        src=np.array(original.crop(box));dst=np.array(styled.crop(box))
        different=np.any(src[:,:,:3]!=dst[:,:,:3],axis=2)&(dst[:,:,3]>0)
        changed+=int(different.sum())
        # Match runtime night shading; generated snow and bulbs remain readable.
        base=Image.alpha_composite(Image.fromarray(src),Image.new('RGBA',(box[2],box[3]-y),(12,23,58,92)))
        dst[:,:,:3]=np.clip(dst[:,:,:3].astype(float)*.9,0,255).astype('uint8')
        dst[:,:,3]=np.where(different,dst[:,:,3],0)
        strip=Image.fromarray(dst)
        overlay.paste(strip,(0,y))
        preview.paste(Image.alpha_composite(base,strip),(0,y))
    overlay.save(folder/'decoration-map.png')
    preview.save(folder/'preview.png')
    preview.crop((0,0,768,768)).save(folder/'detail-preview.png')
    manifest={'id':run_id,'mapId':MAP_ID,'width':original.width,'height':original.height,'night':92/255,'overlay':f'/theme-runs/{run_id}/decoration-map.png','bulbs':bulbs,'source_hashes':hashes,'instances':len(spec['instances']),'geometry_preserved':True,'collision_preserved':True}
    (folder/'crypt-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
    validation={'source_hashes_unchanged':True,'all_variant_alpha_preserved':True,'layer_opacity':opacity,'prop_tiles_covered':sum(p['tiles'] for p in spec['instances']),'source_prop_tiles':sum(bool(v) for v in layers['prop']),'changed_pixels':changed,'no_decoration_variants':empty,'map_size':list(original.size)}
    assert validation['prop_tiles_covered']==validation['source_prop_tiles']
    (folder/'validation.json').write_text(json.dumps(validation,indent=2),encoding='utf8')
    status.update(status='awaiting_review',stage=7,completed_objects=len(variants),preview=f'/theme-runs/{run_id}/preview.png',preview_revision=time.time(),warnings=[f'눈 장식 미검출 · 원본 윤곽 유지한 서리 색 보정만 적용: {name}' for name in empty])
    save_status(folder,status)
    record_event(folder,'ruins_composed',**validation)
    (folder/'review.html').write_text('<!doctype html><html lang="ko"><meta charset="utf-8"><body><script type="module" src="/src/editor/cryptResultGallery.ts"></script></body></html>',encoding='utf8')
    print('COMPOSED',validation,flush=True)


def fork_run(run_id):
    folder=ROOT/uuid.uuid4().hex
    shutil.copytree(ROOT/run_id,folder)
    status=json.loads((folder/'status.json').read_text(encoding='utf8'))
    status.update(id=folder.name,parent_run_id=run_id,status='awaiting_review',original=f'/theme-runs/{folder.name}/original-map.png')
    status.pop('game_preview',None)
    save_status(folder,status)
    record_event(folder,'revision',parent_run_id=run_id,reason='Respect TMX shadow layer opacity')
    compose(folder.name)
    print('REVISION',folder.name,flush=True)


if __name__ == '__main__':
    if len(sys.argv)==1: prepare()
    elif len(sys.argv)>2 and sys.argv[2]=='compose': compose(sys.argv[1])
    elif len(sys.argv)>2 and sys.argv[2]=='fixture': generate_fixture(sys.argv[1])
    elif len(sys.argv)>2 and sys.argv[2]=='revise': fork_run(sys.argv[1])
    else: generate(sys.argv[1])
