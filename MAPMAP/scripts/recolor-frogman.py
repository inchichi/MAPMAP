"""늪개구리 전사 그림 — LPC Frogman(Evert, Redshrike, Puffolotti; CC-BY 3.0 / OGA-BY 3.0)의 초록을
늪 개구리다운 청록으로 바꿔 assets/monsters/lpc/frogman.png 로 쓴다. 원작 초록은 다른 LPC 그림보다
쨍하고, 탁한 올리브로 바꾸면 늪 풀에 묻혀 안 보였다(notes/shots/ch2-style/frog-options.png). 삼지창의 금색·외곽선은 그대로 둔다.

원본: ../art-src/ch2/2-lpc-frogman/frogman_2.png (저장소 밖, art-src/ch2/SOURCES.txt). 시트는 칸 80x96,
줄 0~3 찌르기(위·왼·아래·오른, 4프레임), 4~7 뛰어 걷기(6프레임), 8 쓰러짐.

중간 보스 늪지기 거대개구리(c2-05)는 같은 묶음의 왕관 쓴 개구리(frogman_crown.png)를 어두운 기운에 물든
보랏빛으로 바꿔 frogman-king.png 로 쓴다(전사의 청록, 늪 풀의 올리브와 겹치지 않는다).
"""
import colorsys
import os
import sys

from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else '../art-src/ch2/2-lpc-frogman/frogman_2.png'
CROWN_SRC = sys.argv[2] if len(sys.argv) > 2 else '../art-src/ch2/2-lpc-frogman/frogman_crown.png'
OUT_DIR = 'src/games/my-sample-rpg/assets/monsters/lpc'


def recolor(src, out, hue_shift, sat, val):
    im = Image.open(src).convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if 0.18 <= h <= 0.48 and s >= 0.2:
                h, s, v = (h + hue_shift) % 1.0, s * sat, v * val
                nr, ng, nb = colorsys.hsv_to_rgb(h, s, v)
                px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    os.makedirs(OUT_DIR, exist_ok=True)
    im.save(os.path.join(OUT_DIR, out), optimize=True)
    print('저장', out, im.size)


recolor(SRC, 'frogman.png', 0.12, 0.6, 0.85)
recolor(CROWN_SRC, 'frogman-king.png', 0.45, 0.45, 0.7)
