"""스킬 아이콘(128px)을 만든다. 무기 계열 스킬(skills/weapon/)과 기본·마법·활 스킬(skills/*_skill.png) 모두.

그림은 game-icons.net(CC BY 3.0)의 실루엣 아이콘을 쓴다. 원본 SVG는 scripts/weapon-skill-icons/ 에 있고,
저작자 표시는 licenses/assets/game-icons/SOURCE.txt 에 있다(아이콘을 바꾸면 거기도 고치고 build-credits.py 를 다시 돌린다).
실루엣을 스킬 색 그라데이션으로 칠하고, 테두리는 Fireball_skill.png 것을 그대로 쓴다(안쪽만 덮어써서 다시 돌려도 같다).
무기 계열 스킬은 오른쪽 아래 점 개수가 해금 장(1~3)이다.

  pip install cairosvg  # SVG → PNG
  python3 scripts/generate-weapon-skill-icons.py
"""
import io
import os

import cairosvg
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = 'src/games/my-sample-rpg/assets'
BASE_OUT = os.path.join(ROOT, 'skills')
OUT = os.path.join(ROOT, 'skills/weapon')
SVG_DIR = 'scripts/weapon-skill-icons'
FRAME_SOURCE = os.path.join(ROOT, 'skills/Fireball_skill.png')
SIZE = 128
SCALE = 4
S = SIZE * SCALE
INNER = (8, 8, 120, 120)  # Fireball_skill.png 테두리 안쪽
ICON_SIZE = 84  # 128px 기준 실루엣 크기

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
    'lunge': ('spear-hook', 1, STEEL),
    'spear-sweep': ('thrown-spear', 2, STEEL),
    'thunder-javelin': ('sun-spear', 3, LIGHTNING),
    'whirlwind': ('axe-swing', 1, EMBER),
    'ground-splitter': ('groundbreaker', 2, EARTH),
    'execute': ('chopped-skull', 3, BLOOD),
    'ground-slam': ('hammer-drop', 1, ICE),
    'shockwave': ('impact-point', 2, EARTH),
    'earthquake': ('earth-crack', 3, EMBER),
    'vital-strike': ('knife-thrust', 1, BLOOD),
    'shadow-step': ('backstab', 2, SHADOW),
    'blade-flurry': ('spinning-blades', 3, POISON),
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


def vertical_gradient(size, top, bottom):
    image = Image.new('RGBA', (size, size))
    draw = ImageDraw.Draw(image)
    for y in range(size):
        draw.line([(0, y), (size, y)], fill=mix(top, bottom, y / (size - 1)) + (255,))
    return image


def make_icon(frame, icon_name, tint, chapter):
    canvas = Image.new('RGBA', (S, S), (22, 17, 20, 255))
    halo = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(halo).ellipse([S * 0.12, S * 0.12, S * 0.88, S * 0.88], fill=mix((22, 17, 20), tint, 0.55) + (255,))
    canvas = Image.alpha_composite(canvas, halo.filter(ImageFilter.GaussianBlur(S * 0.12)))

    size = ICON_SIZE * SCALE
    mask = Image.new('L', (S, S), 0)
    mask.paste(silhouette(icon_name, size), ((S - size) // 2, (S - size) // 2))
    # 뒤쪽 빛 → 어두운 외곽선 → 위는 밝고 아래는 스킬 색인 실루엣
    glow = Image.new('RGBA', (S, S), tint + (0,))
    glow.putalpha(mask.filter(ImageFilter.GaussianBlur(SCALE * 5)).point(lambda a: min(255, a * 2)))
    outline = Image.new('RGBA', (S, S), (16, 10, 12, 0))
    outline.putalpha(mask.filter(ImageFilter.MaxFilter(SCALE * 2 + 1)))
    body = vertical_gradient(S, mix(tint, (255, 255, 255), 0.75), mix(tint, (0, 0, 0), 0.1))
    body.putalpha(mask)
    for layer in (glow, outline, body):
        canvas = Image.alpha_composite(canvas, layer)
    small = canvas.resize((SIZE, SIZE), Image.LANCZOS)

    # 오른쪽 아래 점(해금 장)
    pips = ImageDraw.Draw(small)
    for index in range(chapter):
        x = 110 - index * 10
        pips.ellipse((x - 4, 105, x + 4, 113), fill=(255, 214, 90, 255), outline=(60, 36, 14, 255))

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
