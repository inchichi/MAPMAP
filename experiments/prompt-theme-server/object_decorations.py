"""Per-object FLUX references, surface masks and decoration-only extraction."""
import json,time
import numpy as np
import requests
from PIL import Image

VERSION = 'object-surfaces-v2'


def object_kind(obj):
    if 'stall' in obj['id']:
        return 'stall'
    return obj['category']


def surface_masks(original, kind):
    a = np.array(original).astype(float)
    r, g, b, alpha = a.transpose(2, 0, 1)
    h, w = alpha.shape
    yy, xx = np.indices((h, w))
    opaque = alpha > 200
    if kind == 'tree':
        surface = opaque & (g > r * 1.05) & (g > b * 1.12)
        return surface, surface
    if kind == 'fountain':
        stone = opaque & (np.abs(r-g) < 22) & (np.abs(g-b) < 22) & (a[:, :, :3].min(2) > 80)
        # Basin ellipse and top cap in this game's TMX fountain bounding box.
        radius = ((xx-w*.5)/(w*.38))**2 + ((yy-h*.516)/(h*.302))**2
        rim = (radius > .78) & (radius < 1.13) & (yy > h*.22) & (yy < h*.85)
        cap = (yy < h*.3) & (xx > w*.35) & (xx < w*.65)
        light_rim = opaque & (radius > .78) & (radius < 1.65) & (yy > h*.22) & (yy < h*.87)
        return stone & (rim | cap), light_rim
    if kind == 'building':
        roof = opaque & (yy < h*.68) & (((b > r*1.2) & (b > g*1.04)) | ((r > g*1.3) & (r > b*1.2)))
        # Exclude isolated colored windows below the continuous roof segment.
        for x in range(w):
            ys=np.flatnonzero(roof[:,x])
            if not len(ys):continue
            if ys[0] > h*.38:
                roof[:,x]=False;continue
            gaps=np.flatnonzero(np.diff(ys)>8)
            if len(gaps):roof[int(ys[gaps[0]])+1:,x]=False
        # Find the lower roof edge per column, not the top silhouette.
        edge = np.zeros((h, w), dtype=bool)
        for x in range(w):
            ys = np.flatnonzero(roof[:, x])
            if len(ys) >= max(4, h//30):
                y = int(ys[-1])
                edge[max(0,y-3):min(h,y+8), x] = True
        return roof, edge & opaque
    raise ValueError('No surface profile for '+kind)


def request_image(folder, source, prompt, flux, alpha, pipeline=None):
    source.save(folder/'flux-input.png')
    (folder/'generation.json').write_text(json.dumps({
        'pipeline':pipeline or VERSION, 'model':'FLUX.1-Kontext-dev', 'prompt':prompt,
        'steps':28, 'alpha':alpha, 'geometry_lock':False,
        'seed':'service random; not exposed'
    }, indent=2))
    started=time.time();timer=time.perf_counter()
    try:
        with open(folder/'flux-input.png', 'rb') as f:
            response = requests.post(flux+'/style-transfer', files={'content':('input.png',f,'image/png')},
                data={'prompt':prompt,'steps':28,'alpha':alpha,'geometry_lock':'false'}, timeout=1800)
        response.raise_for_status()
        (folder/'flux-raw.png').write_bytes(response.content)
        return Image.open(folder/'flux-raw.png').convert('RGB')
    finally:
        (folder/'request-timing.json').write_text(json.dumps({'started_at':started,'finished_at':time.time(),'generation_seconds':time.perf_counter()-timer,'includes':'HTTP request, server processing, transfer and decode'}),encoding='utf8')


def extract_attached(original, generated, kind, decorations):
    rgb = np.array(generated.convert('RGB')).astype(float)
    ref = np.array(original).astype(float)
    snow_surface, light_surface = surface_masks(original, kind)
    r, g, b = rgb.transpose(2, 0, 1)
    changed = np.max(np.abs(rgb-ref[:,:,:3]), axis=2) > 30
    snow = (rgb.min(2) > 185) & ((rgb.max(2)-rgb.min(2)) < 40)
    bulbs = (r > 165) & (g > 90) & (b < 135) & (r > g*1.12)
    mask = np.zeros(r.shape, dtype=bool)
    if 'snow' in decorations:
        mask |= snow & snow_surface & changed
    if 'lights' in decorations and kind != 'building':
        mask |= bulbs & light_surface & changed
    # Only requested colored decorations on permitted surfaces, never whole RGB objects.
    if 'garland' in decorations or 'leaves' in decorations or 'pumpkins' in decorations:
        colorful = (rgb.max(2)-rgb.min(2)) > 60
        if 'garland' in decorations:
            mask |= colorful & ((g > r*1.15) | (r > g*1.5)) & light_surface & changed
        if 'leaves' in decorations or 'pumpkins' in decorations:
            mask |= colorful & (r > g*1.2) & (g > b*1.2) & light_surface & changed
    alpha = np.where(mask, ref[:,:,3], 0).astype('uint8')
    overlay = Image.fromarray(np.dstack((rgb.astype('uint8'), alpha)))
    if kind == 'building' and 'lights' in decorations:
        # Extract a complete generated bulb and anchor copies to original eaves.
        # Clipping bulbs to a thin edge mask would leave only yellow fragments.
        h,w = mask.shape
        candidate = bulbs & changed
        candidate[int(h*.65):] = False
        components = []
        remaining = set(zip(*np.nonzero(candidate)))
        while remaining:
            seed = remaining.pop(); stack = [seed]; points = [seed]
            while stack:
                y,x = stack.pop()
                for dy,dx in [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)]:
                    p = (y+dy,x+dx)
                    if p in remaining:
                        remaining.remove(p); stack.append(p); points.append(p)
            ys,xs = zip(*points)
            if 4 <= len(points) <= 150 and max(xs)-min(xs) <= 16 and max(ys)-min(ys) <= 18:
                components.append(points)
        if components:
            points = max(components,key=len)
            ys,xs = zip(*points)
            bulb_alpha = np.zeros(mask.shape,dtype='uint8')
            for y,x in points:bulb_alpha[y,x]=255
            bulb = Image.fromarray(np.dstack((rgb.astype('uint8'),bulb_alpha))).crop((min(xs),min(ys),max(xs)+1,max(ys)+1))
            bulb.thumbnail((8,10),Image.Resampling.LANCZOS)
            for x in range(8,w-8,24):
                roof_y = np.flatnonzero(snow_surface[:,x])
                if len(roof_y) >= max(4,h//30):
                    y = int(roof_y[-1])+3
                    overlay.alpha_composite(bulb,(x-bulb.width//2,y))
        a=np.array(overlay);a[:,:,3]=np.minimum(a[:,:,3],ref[:,:,3]).astype('uint8')
        overlay=Image.fromarray(a)
    return overlay


def generate_attached(folder, original, obj, spec, flux):
    kind = object_kind(obj)
    locations = {
        'building':'settled snow patches on roof planes; tiny bulbs following the sloped eaves, never a straight line across the facade',
        'tree':'small settled snow patches on individual leafy branches; tiny bulbs distributed around the foliage, preserve the trunk',
        'fountain':'settled snow on the basin stone rim and top cap; tiny bulbs following the curved stone basin rim, preserve water and central pillar'
    }
    names = {'snow':'settled snow', 'lights':'warm tiny bulb strings', 'garland':'evergreen garlands', 'pumpkins':'small pumpkin ornaments', 'leaves':'orange leaf ornaments'}
    requested = ', '.join(names[k] for k in spec['decorations'])
    prompt = (f'Pixel-art {kind}. Preserve exact shape, size, position, doors and windows. '
        f'For {spec["theme"]}, add only: {requested}. '
        f'Placement guide (only requested decorations): {locations[kind]}. '
        'Keep original colors and pixel density. Gray background unchanged. No redesign, scenery, shadows or text.')
    w, h = original.size
    side = 640 if max(w,h) > 256 else 384
    scale = min((side-32)/w, (side-32)/h)
    size = (round(w*scale), round(h*scale))
    offset = ((side-size[0])//2, (side-size[1])//2)
    source = Image.new('RGB', (side,side), (128,128,128))
    scaled = original.resize(size, Image.Resampling.NEAREST)
    source.paste(scaled, offset, scaled)
    raw = request_image(folder, source, prompt, flux, .5)
    # Inverse of the input letterbox, not an independent stretch of the object.
    raw = raw.resize((side,side), Image.Resampling.LANCZOS)
    generated = raw.crop((*offset, offset[0]+size[0], offset[1]+size[1])).resize((w,h), Image.Resampling.LANCZOS)
    generated.save(folder/'aligned-reference.png')
    snow, lights = surface_masks(original, kind)
    for label, mask in [('snow-surface',snow),('light-surface',lights)]:
        Image.fromarray((mask*255).astype('uint8')).save(folder/(label+'.png'))
    overlay = extract_attached(original, generated, kind, spec['decorations'])
    overlay.save(folder/'decoration.png')
    Image.alpha_composite(original,overlay).save(folder/'composite.png')
    count = np.count_nonzero(np.array(overlay)[:,:,3])
    if count < 4:
        raise ValueError(obj['id']+': no usable decoration pixels on original surfaces; raw result retained')
    if count > np.count_nonzero(np.array(original)[:,:,3])*.45:
        raise ValueError(obj['id']+': excessive surface coverage; review generated result')
    return overlay
