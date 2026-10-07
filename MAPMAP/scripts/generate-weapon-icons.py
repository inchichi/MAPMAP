"""무기 아이콘 생성기 — LPC 장비 아이콘(gear-icons.png)과 같은 32x32 픽셀 아트.

손에 든 LPC 무기 레이어는 얇고 일부가 몸에 가려 아이콘으로 쓰기 어렵다. 그래서 같은 무기의
LPC 팔레트(scripts/build-lpc-characters.py 가 고른 색 변형에서 뽑은 색)로, 손잡이가 왼쪽 아래·
끝이 오른쪽 위를 향한 전형적인 인벤토리 자세를 직접 찍고 LPC 처럼 어두운 1px 외곽선을 두른다.

  weapon-icons.png        아이템 순서대로 이어 붙인 아틀라스(32px 칸)
  weapon-icon-<id>.png    땅에 떨어진 무기 그림용 낱장

python3 scripts/generate-weapon-icons.py (repo 루트에서)
"""
import colorsys
import json
import os

from PIL import Image, ImageDraw

OUT = 'src/games/my-sample-rpg/assets/weapons/lpc/'
N = 32
OUTLINE = (29, 19, 30, 255)   # LPC 외곽선 색(#1d131e)


def rgb(hex_color):
    return tuple(int(hex_color[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def canvas():
    image = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    return image, ImageDraw.Draw(image)


def outlined(image):
    """보이는 픽셀 둘레(상하좌우)에 외곽선을 두른다."""
    out = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    src = image.load()
    dst = out.load()
    for y in range(N):
        for x in range(N):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < N and 0 <= ny < N and src[nx, ny][3]:
                    dst[x, y] = OUTLINE
                    break
    out.alpha_composite(image)
    return out


def diagonal(draw, start, length, color, offset=0):
    """(x, y) 에서 오른쪽 위로 한 칸씩 올라가는 대각선(offset 은 수직 이동량)."""
    x, y = start
    for i in range(length):
        draw.point((x + i, y - i + offset), fill=color)


def grip(draw, start, length, wood='#723e2a', light='#b19998'):
    diagonal(draw, start, length, rgb(wood))
    diagonal(draw, (start[0], start[1] - 1), length, rgb(wood))
    for i in range(0, length, 2):   # 감은 가죽 끈 무늬
        draw.point((start[0] + i, start[1] - i - 1), fill=rgb(light))


def sword(blade_dark, blade, blade_light, guard, length=17):
    image, draw = canvas()
    # 칼날: 가운데 줄 + 양옆(밝은 쪽이 위)
    diagonal(draw, (11, 21), length, rgb(blade))
    diagonal(draw, (11, 20), length, rgb(blade_light))
    diagonal(draw, (12, 21), length - 1, rgb(blade_dark))
    draw.point((11 + length, 21 - length), fill=rgb(blade_light))
    # 가드(칼날과 직각)
    for i in range(-3, 4):
        draw.point((9 + i, 19 + i), fill=rgb(guard))
        draw.point((10 + i, 19 + i), fill=rgb(guard))
    grip(draw, (5, 25), 4)
    draw.rectangle([3, 26, 4, 27], fill=rgb(guard))   # 폼멜
    return outlined(image)


def battle_axe():
    image, draw = canvas()
    grip(draw, (4, 28), 19, wood='#62351c', light='#411e05')
    # 양날 도끼머리(자루 위쪽 끝을 감싸는 초승달 두 개)
    cx, cy = 20, 12
    draw.pieslice([cx - 10, cy - 3, cx + 2, cy + 9], 100, 260, fill=rgb('#4a5057'))
    draw.pieslice([cx - 9, cy - 2, cx + 1, cy + 8], 100, 260, fill=rgb('#8aaaab'))
    draw.pieslice([cx - 2, cy - 9, cx + 10, cy + 3], 280, 80, fill=rgb('#4a5057'))
    draw.pieslice([cx - 1, cy - 8, cx + 9, cy + 2], 280, 80, fill=rgb('#a9c9ca'))
    draw.rectangle([cx - 2, cy - 2, cx + 1, cy + 1], fill=rgb('#4a5057'))
    return outlined(image)


def pickaxe():
    image, draw = canvas()
    grip(draw, (5, 27), 17, wood='#62351c', light='#411e05')
    # 자루 끝을 가로지르는 휜 곡괭이 머리
    draw.arc([9, 8, 31, 30], 200, 340, fill=rgb('#4d4a5d'), width=3)
    draw.arc([10, 9, 30, 29], 205, 335, fill=rgb('#867e7f'), width=1)
    return outlined(image)


def magic_staff():
    image, draw = canvas()
    grip(draw, (4, 28), 18, wood='#2f1c40', light='#4a2f63')
    # 파란 수정(인게임 LPC 수정 지팡이와 같은 색)
    draw.polygon([(26, 1), (30, 6), (25, 12), (20, 7)], fill=rgb('#156c99'))
    draw.polygon([(26, 2), (29, 6), (25, 9), (22, 6)], fill=rgb('#0098b2'))
    draw.polygon([(26, 3), (27, 6), (24, 7)], fill=rgb('#00cfdf'))
    draw.point((25, 4), fill=(225, 255, 255, 255))
    # 수정을 쥔 갈퀴
    draw.point((20, 9), fill=rgb('#4a2f63'))
    draw.point((23, 12), fill=rgb('#4a2f63'))
    return outlined(image)


def hunting_bow():
    image, draw = canvas()
    # 활대: 왼쪽 위→오른쪽 아래로 휜 나무, 시위는 곧게
    draw.arc([1, 1, 37, 37], 180, 270, fill=rgb('#8f5030'), width=3)
    draw.arc([2, 2, 36, 36], 185, 265, fill=rgb('#c39753'), width=1)
    draw.line([(3, 19), (19, 3)], fill=rgb('#e5e6c7'), width=1)
    draw.rectangle([5, 9, 7, 11], fill=rgb('#3e2613'))   # 손잡이 감개
    # 시위에 건 화살
    diagonal(draw, (10, 22), 14, rgb('#ae764b'))
    draw.polygon([(26, 6), (22, 7), (25, 10)], fill=rgb('#d2cdc6'))
    draw.point((9, 22), fill=rgb('#e5e6c7'))
    draw.point((10, 23), fill=rgb('#e5e6c7'))
    return outlined(image)


# 등급 장비(2등급 신전 = 비취, 3등급 서리 = 얼음)는 1등급 대표 무기 그림의 색만 바꾼다.
# 외곽선처럼 아주 어두운 칸은 그대로 두고, 나머지는 밝기를 살린 채 색상·채도를 옮긴다.
TIER_TINTS = {
    'temple': (0.42, 0.55, 0.0),
    'frost': (0.55, 0.45, 0.12),
}


def tinted(make, tier):
    hue, saturation, lift = TIER_TINTS[tier]

    def build():
        image = make().copy()
        pixels = image.load()
        for y in range(N):
            for x in range(N):
                r, g, b, a = pixels[x, y]
                if a == 0:
                    continue
                _, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if v < 0.2:
                    continue
                nr, ng, nb = colorsys.hsv_to_rgb(hue, min(1, s * 0.5 + saturation), min(1, v * (1 - lift) + lift))
                pixels[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
        return image

    return build


ICONS = {
    'basic-sword': lambda: sword('#29253a', '#484152', '#726b7e', '#343043', length=16),
    'bronze-sword': lambda: sword('#966600', '#bf8200', '#fbe3b0', '#6d4a00'),
    'iron-sword': lambda: sword('#867e7f', '#c4b59f', '#ffffff', '#4d4a5d'),
    'battle-axe': battle_axe,
    'pickaxe': pickaxe,
    'magic-staff': magic_staff,
    'hunting-bow': hunting_bow,
}

TIER_BASE_WEAPONS = {
    'sword': lambda: sword('#867e7f', '#c4b59f', '#ffffff', '#4d4a5d'),
    'axe': battle_axe,
    'bow': hunting_bow,
    'staff': magic_staff,
}
for tier_name in TIER_TINTS:
    for line, make_base in TIER_BASE_WEAPONS.items():
        ICONS[f'{tier_name}-{line}'] = tinted(make_base, tier_name)


def main():
    os.makedirs(OUT, exist_ok=True)
    icons = [(item, make()) for item, make in ICONS.items()]
    atlas = Image.new('RGBA', (N * len(icons), N), (0, 0, 0, 0))
    for index, (item, icon) in enumerate(icons):
        atlas.paste(icon, (index * N, 0), icon)
        icon.save(os.path.join(OUT, f'weapon-icon-{item}.png'), optimize=True)
    atlas.save(os.path.join(OUT, 'weapon-icons.png'), optimize=True)
    with open(os.path.join(OUT, 'weapon-icons.json'), 'w', encoding='utf-8') as handle:
        json.dump({'size': N, 'items': [item for item, _ in icons]}, handle, indent=2)
        handle.write('\n')
    print('wrote', len(icons), 'icons to', OUT)


if __name__ == '__main__':
    main()
