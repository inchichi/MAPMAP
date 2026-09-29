"""Project-wide pixel-art generation contract; original sprites are never quantized."""
import numpy as np
from PIL import Image

VERSION='native-pixel-v1'
STYLE=('Render only native-resolution 2D pixel-game sprite art. '
       'Match the reference sprite pixel grid, top-down RPG perspective and outline thickness. '
       'Use crisp square pixels, a small palette and two or three flat shading tones per material. '
       'Do not use photorealism, 3D rendering, smooth gradients, antialiasing, blur, glossy surfaces or fine realistic texture.')


def pixel_prompt(prompt):
    return prompt if STYLE in prompt else prompt+'\nMandatory pixel-game style:\n'+STYLE


def native_sprite(image,size=None,colors=24):
    rgba=image.convert('RGBA')
    if size is not None:rgba=rgba.resize(size,Image.Resampling.NEAREST)
    a=np.array(rgba);mask=a[:,:,3]>=128
    a[~mask,:3]=0
    rgb=Image.fromarray(a[:,:,:3]).quantize(colors=colors,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).convert('RGB')
    result=np.dstack((np.array(rgb),mask.astype('uint8')*255))
    result[~mask,:3]=0
    report={'policy':VERSION,'native_size':list(rgba.size),'palette_limit':colors,
            'opaque_colors':len(np.unique(result[:,:,:3][mask],axis=0)),
            'binary_alpha':True,'resize':'nearest','visual_style_review_required':True}
    return Image.fromarray(result),report
