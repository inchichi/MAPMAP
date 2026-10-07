"""스킬 아이콘(128px)을 만든다. 무기 계열 스킬(skills/weapon/)과 기본·마법·활 스킬(skills/*_skill.png) 모두.

그림은 game-icons.net(CC BY 3.0)의 실루엣 아이콘을 쓴다. 원본 SVG는 scripts/weapon-skill-icons/ 에 있고,
저작자 표시는 licenses/assets/game-icons/SOURCE.txt 에 있다(아이콘을 바꾸면 거기도 고치고 build-credits.py 를 다시 돌린다).
실루엣을 32x32 도트로 줄여 게임 장비 아이콘처럼(같은 계열 외곽선, 왼쪽 위 빛, hue shift 명암) 칠하고, 테두리는 Fireball_skill.png 것을 그대로 쓴다(안쪽만 덮어써서 다시 돌려도 같다).
무기 계열 스킬은 오른쪽 아래 점 개수가 해금 장(1~3)이다.

  pip install cairosvg  # SVG → PNG
  python3 scripts/generate-weapon-skill-icons.py
"""
import colorsys
import io
import os

import cairosvg
from PIL import Image, ImageDraw

ROOT = 'src/games/my-sample-rpg/assets'
BASE_OUT = os.path.join(ROOT, 'skills')
OUT = os.path.join(ROOT, 'skills/weapon')
SVG_DIR = 'scripts/weapon-skill-icons'
FRAME_SOURCE = os.path.join(ROOT, 'skills/Fireball_skill.png')
SIZE = 128
GRID = 32  # 도트 칸 수(칸 하나 = 4px)
INNER = (8, 8, 120, 120)  # Fireball_skill.png 테두리 안쪽
ICON_CELLS = 24  # 실루엣 크기(칸)

STEEL = (190, 215, 245)
GOLD = (255, 205, 80)
EMBER = (255, 150, 60)
FIRE = (255, 96, 40)
EARTH = (205, 160, 105)
ICE = (140, 210, 255)
SHADOW = (175, 125, 255)
POISON = (140, 225, 90)
BLOOD = (235, 60, 55)
LIGHTNING = (255, 235, 110)
ARCANE = (110, 165, 255)
WOOD = (230, 195, 140)

# 파일 이름: (game-icons 이름, 색)
BASE_SKILLS = {
    'Slash_skill': ('piercing-sword', GOLD),
    'Protect_skill': ('checked-shield', ARCANE),
    'Dash_skill': ('sprint', EMBER),
    'Focus_skill': ('meditation', ARCANE),
    'Energy_bolt_skill': ('energy-arrow', SHADOW),
    'Ice_bolt_skill': ('frozen-arrow', ICE),
    'Fireball_skill': ('fire-ray', FIRE),
    'Chain_lightning_skill': ('lightning-branches', LIGHTNING),
    'Multi_shot_skill': ('split-arrows', WOOD),
    'Piercing_arrow_skill': ('supersonic-arrow', STEEL),
    'Poison_arrow_skill': ('chemical-arrow', POISON),
}

# id: (game-icons 이름, 장, 색)
SKILLS = {
    'cross-slash': ('crossed-swords', 2, STEEL),
    'flash-strike': ('saber-slash', 3, GOLD),
    'whirlwind': ('axe-swing', 1, EMBER),
    'ground-splitter': ('groundbreaker', 2, EARTH),
    'execute': ('chopped-skull', 3, BLOOD),
    'arrow-rain': ('smash-arrows', 2, GOLD),
    'storm-arrows': ('striking-arrows', 3, GOLD),
    'blizzard': ('snowing', 2, ICE),
    'meteor': ('meteor-impact', 3, FIRE),
}


def mix(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def silhouette(name, size):
    """SVG 실루엣의 알파 마스크. 원본의 검은 바탕 사각형은 뺀다."""
    svg = open(os.path.join(SVG_DIR, f'{name}.svg'), encoding='utf-8').read().replace('<path d="M0 0h512v512H0z"/>', '')
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=size, output_height=size)
    return Image.open(io.BytesIO(png)).convert('RGBA').getchannel('A')


def shift(color, hue, value, saturation):
    """도트 명암용 색. 그림자는 푸른 쪽, 밝은 면은 노란 쪽으로 색상을 옮긴다(hue shift)."""
    h, sat, v = colorsys.rgb_to_hsv(*(c / 255 for c in color))
    target = 240 / 360 if hue < 0 else 60 / 360
    distance = (target - h + 0.5) % 1 - 0.5
    h = (h + max(-abs(hue), min(abs(hue), distance))) % 1
    r, g, b = colorsys.hsv_to_rgb(h, max(0, min(1, sat + saturation)), max(0, min(1, v + value)))
    return (int(r * 255), int(g * 255), int(b * 255))


def make_icon(frame, icon_name, tint, chapter):
    """게임의 32x32 장비 아이콘처럼 그린다: 같은 계열의 어두운 외곽선, 왼쪽 위 빛, 4단 명암."""
    bg = (22, 17, 20)
    grid = Image.new('RGB', (GRID, GRID), bg)
    draw = ImageDraw.Draw(grid)
    draw.ellipse((5, 5, GRID - 6, GRID - 6), fill=mix(bg, tint, 0.12))

    # 실루엣을 칸 단위 0/1 마스크로 줄인다
    alpha = silhouette(icon_name, ICON_CELLS * 8).resize((ICON_CELLS, ICON_CELLS), Image.BOX)
    offset = (GRID - ICON_CELLS) // 2
    mask = [[False] * GRID for _ in range(GRID)]
    for y in range(ICON_CELLS):
        for x in range(ICON_CELLS):
            mask[y + offset][x + offset] = alpha.getpixel((x, y)) >= 100

    def inside(x, y):
        return 0 <= x < GRID and 0 <= y < GRID and mask[y][x]

    # 사방이 막힌 1칸 구멍은 메운다
    mask = [[mask[y][x] or all(inside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
             for x in range(GRID)] for y in range(GRID)]

    outline = shift(tint, -0.08, -0.62, 0.15)
    shadow = shift(tint, -0.05, -0.28, 0.1)
    base = tint
    light = shift(tint, 0.05, 0.15, -0.3)
    for y in range(GRID):
        for x in range(GRID):
            if mask[y][x]:
                lit = not inside(x, y - 1) or not inside(x - 1, y)
                dim = not inside(x, y + 1) or not inside(x + 1, y)
                color = light if lit and not dim else shadow if dim and not lit else base
            elif any(inside(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                color = outline
            else:
                continue
            grid.putpixel((x, y), color)

    # 오른쪽 아래 점(해금 장)
    for index in range(chapter):
        x = 27 - index * 3
        draw.rectangle((x - 1, 26, x + 1, 28), fill=(60, 36, 14))
        draw.rectangle((x, 27, x + 1, 28), fill=(200, 150, 50))
        draw.rectangle((x - 1, 26, x, 27), fill=(255, 214, 90))

    small = grid.resize((SIZE, SIZE), Image.NEAREST).convert('RGBA')
    icon = frame.copy()
    inner = Image.new('L', (SIZE, SIZE), 0)
    ImageDraw.Draw(inner).rectangle((INNER[0], INNER[1], INNER[2] - 1, INNER[3] - 1), fill=255)
    icon.paste(small, (0, 0), inner)
    return icon


def main():
    os.makedirs(OUT, exist_ok=True)
    frame = Image.open(FRAME_SOURCE).convert('RGBA')
    for file_name, (icon_name, tint) in BASE_SKILLS.items():
        make_icon(frame, icon_name, tint, 0).save(os.path.join(BASE_OUT, f'{file_name}.png'))
    for skill_id, (icon_name, chapter, tint) in SKILLS.items():
        make_icon(frame, icon_name, tint, chapter).save(os.path.join(OUT, f'{skill_id}.png'))
    print(f'{len(BASE_SKILLS)} icons -> {BASE_OUT}, {len(SKILLS)} icons -> {OUT}')


if __name__ == '__main__':
    main()
