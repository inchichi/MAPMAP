"""검 반베기(halfslash) 시트의 휘두름 궤적 색을 은빛으로 바꾼다.

LPC 검 시트에는 휘두를 때의 궤적이 이미 그려져 있고, 그 색은 금속 팔레트를 따른다.
철 검은 흐린 베이지, 기본 검은 짙은 회색이라 궤적이 그림자처럼 보여서, 궤적의 바탕색 한 가지만 은빛으로 바꾼다.
모양·프레임은 그대로라 동작과 어긋나지 않는다. 청동 검(금빛)은 그대로 둔다.

순서: build-lpc-characters.py → 이 스크립트 → generate-tier-gear-sheets.py(비취·서리 검이 철 검 궤적을 물들인다)

python3 scripts/recolor-sword-swing-trail.py (repo 루트에서)
"""
import os

from PIL import Image

OUT = 'src/games/my-sample-rpg/assets/characters/lpc/'
SILVER = (197, 208, 224)  # Pixel Art Sword Slash Effect(tbbk, CC0)의 은빛과 같은 값

# 검: 궤적 바탕색(LPC 금속 팔레트)
SWORD_TRAIL_COLORS = {
    'iron-sword': (196, 181, 159),
    'basic-sword': (72, 65, 82),
}


def main():
    for sword, trail in SWORD_TRAIL_COLORS.items():
        for side in ('back', 'front'):
            path = os.path.join(OUT, f'player-weapon-{sword}-{side}-halfslash.png')
            image = Image.open(path).convert('RGBA')
            image.putdata([
                (*SILVER, pixel[3]) if pixel[3] and pixel[:3] == trail else pixel
                for pixel in image.get_flattened_data()
            ])
            image.save(path, optimize=True)
    print('sword trails recolored')


if __name__ == '__main__':
    main()
