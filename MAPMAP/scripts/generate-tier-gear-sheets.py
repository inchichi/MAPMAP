"""등급 장비(2등급 신전 = 비취, 3등급 서리 = 얼음)의 몸 그림 — 1등급 LPC 몸 시트의 색만 바꿔 만든다.

아이콘(generate-tier-gear-icons.py · generate-weapon-icons.py)과 같은 색 규칙이라 가방 아이콘과 입은 모습의 색이 맞는다.
build-lpc-characters.py 가 1등급 시트를 다시 만들면 이 스크립트도 다시 돌린다.

  player-<슬롯>-<아이템>-<동작>.png            갑옷·투구·신발
  player-weapon-<아이템>-<back|front>-<동작>.png 무기
  manifest.json 의 player.gear / player.weapons 에 아이템 항목을 더한다(1등급 항목을 본뜬다).

python3 scripts/generate-tier-gear-sheets.py (repo 루트에서)
"""
import colorsys
import json
import os

from PIL import Image

OUT = 'src/games/my-sample-rpg/assets/characters/lpc/'

# generate-tier-gear-icons.py 와 같은 값
TIER_TINTS = {
    'temple': (0.42, 0.55, 0.0),
    'frost': (0.55, 0.45, 0.12),
}

# 새 아이템 id: 색을 바꿀 1등급 몸 그림(playerEquipment.ts 의 appearanceId 와 같다)
GEAR = {
    'temple-armor': 'Chain_Armor',
    'temple-helmet': 'Chain_Helmet',
    'temple-boots': 'leather-boots',
    'frost-armor': 'Iron_Armor',
    'frost-helmet': 'Iron_Helmet',
    'frost-boots': 'leather-boots',
}
WEAPONS = {
    f'{tier}-{line}': base
    for tier in TIER_TINTS
    for line, base in (('sword', 'iron-sword'), ('axe', 'battle-axe'), ('bow', 'hunting-bow'), ('staff', 'magic-staff'))
}


def tint_sheet(source, target, tier):
    """외곽선처럼 아주 어두운 칸은 그대로 두고, 나머지는 밝기를 살린 채 색상·채도를 옮긴다(아이콘과 같은 규칙)."""
    hue, saturation, lift = TIER_TINTS[tier]
    image = Image.open(os.path.join(OUT, source)).convert('RGBA')
    mapping = {}

    def recolor(pixel):
        r, g, b, a = pixel
        if a == 0:
            return pixel
        _, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if v < 0.2:
            return pixel
        nr, ng, nb = colorsys.hsv_to_rgb(hue, min(1, s * 0.5 + saturation), min(1, v * (1 - lift) + lift))
        return (int(nr * 255), int(ng * 255), int(nb * 255), a)

    # 시트 안 색 가짓수는 적다 — 색마다 한 번만 계산한다.
    image.putdata([mapping.setdefault(pixel, recolor(pixel)) for pixel in image.get_flattened_data()])
    image.save(os.path.join(OUT, target), optimize=True)


def renamed(file_name, base_id, item_id):
    return file_name.replace(f'-{base_id}-', f'-{item_id}-')


def main():
    manifest_path = os.path.join(OUT, 'manifest.json')
    manifest = json.load(open(manifest_path, encoding='utf-8'))
    player = manifest['player']

    for item_id, base_id in GEAR.items():
        base = player['gear'][base_id]
        sheets = {}
        for animation, file_name in base['sheets'].items():
            sheets[animation] = renamed(file_name, base_id, item_id)
            tint_sheet(file_name, sheets[animation], item_id.split('-')[0])
        player['gear'][item_id] = {**base, 'sheets': sheets}
        print('gear', item_id, len(sheets))

    for item_id, base_id in WEAPONS.items():
        base = player['weapons'][base_id]
        entry = {'attack': base['attack'], 'back': {}, 'front': {}}
        for side in ('back', 'front'):
            for animation, file_name in base[side].items():
                entry[side][animation] = renamed(file_name, base_id, item_id)
                tint_sheet(file_name, entry[side][animation], item_id.split('-')[0])
        player['weapons'][item_id] = entry
        print('weapon', item_id)

    with open(manifest_path, 'w', encoding='utf-8') as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=2)
        handle.write('\n')


if __name__ == '__main__':
    main()
