"""등급 방어구 아이콘 — 1등급 LPC 장비 아이콘(gear-icon-<id>.png)의 색만 바꿔 만든다.

2등급(신전) = 비취, 3등급(서리) = 얼음. 무기 쪽은 scripts/generate-weapon-icons.py 의 tinted 와 같은 규칙.
build-lpc-characters.py 가 gear-icons.png 를 다시 만들어도 지워지지 않게 따로 한 장으로 둔다.

  tier-gear-icons.png / tier-gear-icons.json   아이템 순서대로 이어 붙인 아틀라스(32px 칸)
  gear-icon-<id>.png                           땅에 떨어진 장비 그림용 낱장

python3 scripts/generate-tier-gear-icons.py (repo 루트에서)
"""
import colorsys
import json
import os

from PIL import Image, ImageDraw

OUT = 'src/games/my-sample-rpg/assets/characters/lpc/'
N = 32

TIER_TINTS = {
    'temple': (0.42, 0.55, 0.0),
    'frost': (0.55, 0.45, 0.12),
}

# 새 아이템 id: 색을 바꿀 1등급 아이콘
ICONS = {
    'temple-armor': 'Chain_Armor',
    'temple-helmet': 'Chain_Helmet',
    'temple-boots': 'leather-boots',
    'frost-armor': 'Iron_Armor',
    'frost-helmet': 'Iron_Helmet',
    'frost-boots': 'leather-boots',
}


def tinted(base_id, tier):
    hue, saturation, lift = TIER_TINTS[tier]
    image = Image.open(os.path.join(OUT, f'gear-icon-{base_id}.png')).convert('RGBA')
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            _, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if v < 0.2:
                continue
            nr, ng, nb = colorsys.hsv_to_rgb(hue, min(1, s * 0.5 + saturation), min(1, v * (1 - lift) + lift))
            pixels[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
    return image


# 부적(장신구)은 1등급 그림이 없어 직접 찍는다: 가는 끈에 매단 둥근 펜던트 + LPC 외곽선.
CHARMS = {'temple-charm': 'temple', 'frost-charm': 'frost'}


def charm(tier):
    hue, saturation, lift = TIER_TINTS[tier]

    def shade(value):
        r, g, b = colorsys.hsv_to_rgb(hue, saturation + 0.2, min(1, value * (1 - lift) + lift))
        return (int(r * 255), int(g * 255), int(b * 255), 255)

    image = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.arc([8, 2, 24, 18], 200, 340, fill=(29, 19, 30, 255), width=3)
    draw.arc([8, 2, 24, 18], 200, 340, fill=(200, 170, 110, 255), width=1)
    draw.ellipse([9, 12, 23, 26], fill=(29, 19, 30, 255))
    draw.ellipse([10, 13, 22, 25], fill=shade(0.45))
    draw.ellipse([11, 14, 20, 23], fill=shade(0.7))
    draw.ellipse([12, 15, 16, 19], fill=shade(1.0))
    return image


def main():
    icons = [(item, tinted(base, item.split('-')[0])) for item, base in ICONS.items()]
    icons += [(item, charm(tier)) for item, tier in CHARMS.items()]
    atlas = Image.new('RGBA', (N * len(icons), N), (0, 0, 0, 0))
    for index, (item, icon) in enumerate(icons):
        atlas.paste(icon, (index * N, 0), icon)
        icon.save(os.path.join(OUT, f'gear-icon-{item}.png'), optimize=True)
    atlas.save(os.path.join(OUT, 'tier-gear-icons.png'), optimize=True)
    with open(os.path.join(OUT, 'tier-gear-icons.json'), 'w', encoding='utf-8') as handle:
        json.dump({'size': N, 'items': [item for item, _ in icons]}, handle, indent=2)
        handle.write('\n')
    print('wrote', len(icons), 'icons to', OUT)


if __name__ == '__main__':
    main()
