"""Extract attached snow/lights into a padded layer, never into source alpha."""
import numpy as np
from PIL import Image, ImageFilter


def extract(source, raw, margin=3, generic=False, high_resolution=False):
    scale = max(1, min(6, 1024 // max(source.size)))
    size = (source.width * scale + 64, source.height * scale + 64)
    reference = Image.new('RGB', size, '#808080')
    reference.paste(source.resize((source.width*scale, source.height*scale), Image.Resampling.NEAREST),
                    (32, 32), source.getchannel('A').resize((source.width*scale, source.height*scale), Image.Resampling.NEAREST))
    rgb = np.array(raw.convert('RGB').resize(size, Image.Resampling.LANCZOS)).astype(float)
    ref = np.array(reference).astype(float)
    alpha = Image.new('L', size)
    alpha.paste(source.getchannel('A').resize((source.width*scale, source.height*scale), Image.Resampling.NEAREST), (32,32))
    nearby = np.array(alpha.filter(ImageFilter.MaxFilter(margin*scale*2+1))) > 0
    r,g,b = rgb.transpose(2,0,1)
    delta = np.abs(rgb-ref).max(2)
    snow = (rgb.min(2)>170)&(rgb.max(2)-rgb.min(2)<55)&(delta>28)
    # Avoid detecting the existing orange sprite as a new bulb.
    lights = (r>210)&(g>160)&(b<165)&(g-ref[:,:,1]>35)&(delta>35)
    near_light = np.array(Image.fromarray(np.uint8(lights)*255).filter(ImageFilter.MaxFilter(scale*2+1)))>0
    cable = near_light&(rgb.max(2)<90)&(delta>35)
    mask = (snow|lights|cable)&nearby
    if generic:
        # Color-independent difference; this is a conservative heuristic, not semantic matting.
        mask = (delta > 40)&nearby
    pixels = np.dstack((rgb.astype('uint8'),np.uint8(mask)*255))
    high = Image.fromarray(pixels).crop((32-margin*scale,32-margin*scale,
                                       32+(source.width+margin)*scale,32+(source.height+margin)*scale))
    if high_resolution:
        base = Image.new('RGBA', high.size)
        base.paste(source.resize((source.width*scale,source.height*scale),Image.Resampling.NEAREST),
                   (margin*scale,margin*scale))
        return base, high, {'x':-margin,'y':-margin,'margin':margin,'texture_scale':scale,
                            'display_width':source.width+margin*2,'display_height':source.height+margin*2}
    decoration = high.resize((source.width+margin*2,source.height+margin*2),Image.Resampling.LANCZOS)
    base = Image.new('RGBA', decoration.size)
    base.paste(source,(margin,margin))
    # Constrain resampling halos to the explicitly allowed decoration margin.
    d = np.array(decoration)
    allowed = np.array(base.getchannel('A').filter(ImageFilter.MaxFilter(margin*2+1)))>0
    d[:,:,3] = np.where(allowed & (d[:,:,3]>=24),d[:,:,3],0)
    return base, Image.fromarray(d), {'x':-margin,'y':-margin,'margin':margin}
