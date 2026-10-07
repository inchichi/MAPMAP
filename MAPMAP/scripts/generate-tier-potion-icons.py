"""등급 포션 아이콘 — tiny-dungeon 의 빨강·파랑 둥근 병(기본 포션 그림)에 금빛 표시를 더해 만든다.

중급 = 오른쪽 위 금빛 별, 상급 = 금테 + 별. 16px 칸.

  tier-potion-icons.png / tier-potion-icons.json   아이템 순서대로 이어 붙인 아틀라스(16px 칸)
  potion-icon-<id>.png                             땅에 떨어진 포션 그림용 낱장

python3 scripts/generate-tier-potion-icons.py (repo 루트에서)
"""
import json
import os

from PIL import Image

ROOT = 'src/games/my-sample-rpg/assets'
OUT = os.path.join(ROOT, 'items')
N = 16
GOLD = (255, 214, 90, 255)
GOLD_DARK = (150, 100, 30, 255)
# 기본 포션 그림의 tiny-dungeon 좌표(createPlayerInventoryOverlay 와 같다)
BASE_FRAMES = {'health': (112, 144), 'mana': (128, 144)}
ICONS = {
    'health-potion-medium': ('health', 'medium'),
    'mana-potion-medium': ('mana', 'medium'),
    'health-potion-large': ('health', 'large'),
    'mana-potion-large': ('mana', 'large'),
}


def star(image):
    pixels = image.load()
    for x, y in ((12, 1), (11, 2), (12, 2), (13, 2), (12, 3)):
        pixels[x, y] = GOLD
    for x, y in ((11, 1), (13, 1), (11, 3), (13, 3)):
        if pixels[x, y][3] == 0:
            pixels[x, y] = GOLD_DARK


def gold_rim(image):
    # 병의 가장 어두운 외곽선을 짙은 금색으로
    pixels = image.load()
    for y in range(N):
        for x in range(N):
            r, g, b, a = pixels[x, y]
            if a and r + g + b < 220:
                pixels[x, y] = GOLD_DARK


def make(kind, grade, tileset):
    x, y = BASE_FRAMES[kind]
    image = tileset.crop((x, y, x + N, y + N))
    if grade == 'large':
        gold_rim(image)
    star(image)
    return image


def main():
    os.makedirs(OUT, exist_ok=True)
    tileset = Image.open(os.path.join(ROOT, 'tilesets/tiny-dungeon-16.png')).convert('RGBA')
    icons = [(item, make(kind, grade, tileset)) for item, (kind, grade) in ICONS.items()]
    atlas = Image.new('RGBA', (N * len(icons), N), (0, 0, 0, 0))
    for index, (item, icon) in enumerate(icons):
        atlas.paste(icon, (index * N, 0), icon)
        icon.save(os.path.join(OUT, f'potion-icon-{item}.png'), optimize=True)
    atlas.save(os.path.join(OUT, 'tier-potion-icons.png'), optimize=True)
    # 기본 포션은 UI 가 tiny-dungeon 칸을 바로 쓰지만, 땅에 떨어진 그림용 낱장은 따로 둔다.
    for item, kind in (('health-potion', 'health'), ('mana-potion', 'mana')):
        x, y = BASE_FRAMES[kind]
        tileset.crop((x, y, x + N, y + N)).save(os.path.join(OUT, f'potion-icon-{item}.png'), optimize=True)
    with open(os.path.join(OUT, 'tier-potion-icons.json'), 'w', encoding='utf-8') as handle:
        json.dump({'size': N, 'items': [item for item, _ in icons]}, handle, indent=2)
        handle.write('\n')
    print('wrote', len(icons), 'icons to', OUT)


if __name__ == '__main__':
    main()
