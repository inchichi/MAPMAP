"""Pointwise tone overlay: no resampling, geometry edits or invented shadows."""
import numpy as np
from PIL import Image


def tone(source, color=(24, 16, 55), strength=.34, shadow_strength=.18):
    if not 0 <= strength <= 1 or not 0 <= shadow_strength <= 1 or strength+shadow_strength > .8:
        raise ValueError('Tone strength out of range')
    rgba = np.array(source.convert('RGBA'))
    luminance = (rgba[:,:,:3] @ np.array([.2126,.7152,.0722])) / 255
    opacity = strength + shadow_strength*(1-luminance)
    overlay = np.zeros_like(rgba)
    overlay[:,:,:3] = color
    overlay[:,:,3] = np.round(opacity*255).astype('uint8')
    overlay[rgba[:,:,3] == 0,3] = 0
    corrected = rgba.copy()
    corrected[:,:,:3] = np.round(rgba[:,:,:3]*(1-opacity[:,:,None])+np.array(color)*opacity[:,:,None]).astype('uint8')
    corrected[rgba[:,:,3] == 0] = rgba[rgba[:,:,3] == 0]
    return Image.fromarray(corrected), Image.fromarray(overlay)
