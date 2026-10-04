"""이끼 골렘(2장 신전) — 1장 바위돌이의 LPC Golem 시트(golem-walk/attack/die.png)에 이끼를 입힌다.

몸 위쪽(어깨·머리·팔 윗면, 밝은 돌)은 이끼 초록, 아래쪽·그늘은 축축한 청회색 돌로 바꾼다.
외곽선(아주 어두운 칸)은 그대로. 결과: golem-moss-walk/attack/die.png (칸·줄은 원본과 같다).
"""
import colorsys
import os

from PIL import Image

DIR = 'src/games/my-sample-rpg/assets/monsters/lpc'

for part in ('walk', 'attack', 'die'):
    im = Image.open(os.path.join(DIR, f'golem-{part}.png')).convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if v < 0.16:
                continue
            if v > 0.55:      # 빛 받는 윗면 — 이끼
                nh, ns, nv = 0.24, 0.45, v * 0.82
            else:             # 그늘 — 젖은 청회색 돌
                nh, ns, nv = 0.52, 0.18, v * 0.9
            nr, ng, nb = colorsys.hsv_to_rgb(nh, ns, nv)
            px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    im.save(os.path.join(DIR, f'golem-moss-{part}.png'), optimize=True)
    print('저장', f'golem-moss-{part}.png', im.size)
