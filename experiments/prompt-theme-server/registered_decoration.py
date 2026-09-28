"""Experimental registration and conservative, theme-independent difference mask.

Requires OpenCV. This is not semantic segmentation: ambiguous source edges are
discarded, including decorations that cannot be distinguished from those edges.
"""
import cv2
import numpy as np
from PIL import Image


def extract_registered(source, raw, margin=3):
    scale = max(1, min(6, 1024 // max(source.size)))
    size = (source.width * scale + 64, source.height * scale + 64)
    ref = Image.new('RGB', size, '#808080')
    enlarged = source.convert('RGBA').resize((source.width*scale, source.height*scale), Image.Resampling.NEAREST)
    ref.paste(enlarged, (32, 32), enlarged)
    ref = np.array(ref)
    generated = np.array(raw.convert('RGB').resize(size, Image.Resampling.LANCZOS))
    warp = np.eye(2, 3, dtype=np.float32)
    gray = lambda image: cv2.cvtColor(image, cv2.COLOR_RGB2GRAY).astype(np.float32)/255
    try:
        for blur in (21, 9, 3):
            score, warp = cv2.findTransformECC(gray(ref), gray(generated), warp, cv2.MOTION_AFFINE,
                                             (cv2.TERM_CRITERIA_COUNT | cv2.TERM_CRITERIA_EPS, 150, 1e-5), None, blur)
    except cv2.error as error:
        raise ValueError('Registration failed; regeneration or manual review required') from error
    singular = np.linalg.svd(warp[:, :2], compute_uv=False)
    if score < .9 or singular.min() < .92 or singular.max() > 1.08 or np.abs(warp[:, 2]).max() > scale*2:
        raise ValueError(f'Structural drift exceeds registration limits: score={score:.4f}, scale={singular.tolist()}, warp={warp.tolist()}')
    aligned = cv2.warpAffine(generated, warp, size, flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP,
                             borderMode=cv2.BORDER_CONSTANT, borderValue=(128, 128, 128))
    alpha = np.zeros(ref.shape[:2], np.uint8)
    alpha[32:32+enlarged.height, 32:32+enlarged.width] = np.array(enlarged.getchannel('A'))
    radius = scale
    # A shifted source edge still matches a nearby original color; do not extract it.
    nearest = np.full(alpha.shape, 255, np.float32)
    padded = np.pad(ref.astype(np.float32), ((radius,radius),(radius,radius),(0,0)), mode='edge')
    for dy in range(-radius, radius+1):
        for dx in range(-radius, radius+1):
            neighbor = padded[radius+dy:radius+dy+size[1], radius+dx:radius+dx+size[0]]
            nearest = np.minimum(nearest, np.abs(aligned.astype(np.float32)-neighbor).max(2))
    edges = cv2.Canny(ref, 45, 90)
    edge_band = cv2.dilate(edges, np.ones((scale+1,scale+1),np.uint8)) > 0
    interior = cv2.erode(alpha, np.ones((scale+1,scale+1),np.uint8)) > 0
    nearby = cv2.dilate(alpha, np.ones((margin*scale*2+1,)*2,np.uint8)) > 0
    delta = np.abs(aligned.astype(float)-ref).max(2)
    mask = (delta > 40) & (nearest > 32) & nearby & ~edge_band
    # Do not grow the original silhouette with a reinterpreted outline.
    mask &= interior
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    for index in range(1, count):
        if stats[index, cv2.CC_STAT_AREA] < 3:
            mask[labels == index] = False
    bounds = (32-margin*scale,32-margin*scale,32+(source.width+margin)*scale,32+(source.height+margin)*scale)
    decoration = Image.fromarray(np.dstack((aligned, mask.astype(np.uint8)*255))).crop(bounds)
    base = Image.new('RGBA', decoration.size)
    base.paste(enlarged, (margin*scale, margin*scale))
    placement = dict(x=-margin,y=-margin,margin=margin,texture_scale=scale,
                     display_width=source.width+2*margin,display_height=source.height+2*margin)
    report = dict(registration_score=float(score), warp=warp.tolist(), kept_pixels=int(mask.sum()),
                  difference_pixels=int(((delta>40)&nearby).sum()), exterior_pixels=0,
                  limitation='Conservative interior-only mask; crossing/exterior decorations are omitted. Not semantic segmentation.')
    return base, decoration, placement, report
