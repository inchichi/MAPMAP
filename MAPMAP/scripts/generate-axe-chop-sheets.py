"""도끼 일반 공격의 내려찍기(chop) 시트 — 머리 위로 들어 올렸다가 땅까지 내려찍는다.

LPC 제너레이터의 tool_hammer 동작(머리 위에서 세로로 내려친다)과 같은 방식으로 만든다.
  몸·머리·갑옷·투구·신발: 이미 있는 베기(slash, 192칸) 시트의 프레임을 거꾸로(5, 4, 4, 1, 0, 0) 늘어놓는다.
  도끼: LPC 원본 tools/axe 의 fg/bg(128칸, 열 = 베기 프레임 번호)를 192칸 가운데에 놓고, 전투 도끼 색으로 바꾼다.
    도구 도끼의 1번 프레임은 나무를 옆으로 패는 궤적이라, 내려치는 칸은 망치(tools/hammer) 1번 프레임의 세로 궤적만 떼어
    도끼 0번 프레임(앞쪽 낮게 내린 도끼)에 얹는다. 새로 그린 픽셀은 없다.
  manifest.json: anims.chop 을 더하고, 전투 도끼의 공격 동작을 chop 으로 바꾼다.

순서: build-lpc-characters.py → 이 스크립트 → generate-tier-gear-sheets.py(비취·서리 도끼와 등급 장비의 chop 시트를 물들인다)

python3 scripts/generate-axe-chop-sheets.py <LPC 제너레이터 폴더> (repo 루트에서, 없으면 LPC_ROOT)
"""
import json
import os
import sys

from PIL import Image, ImageChops, ImageFilter

OUT = 'src/games/my-sample-rpg/assets/characters/lpc/'
LPC = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('LPC_ROOT', '')

CELL = 192
TOOL_CELL = 128
# 들어 올림 → 머리 위 → 세로로 내려침 → 땅에 닿음(5번째부터 판정, cleave.ts) → 멈춤
CHOP_FRAMES = (5, 4, 4, 1, 0, 0)
SWING_FRAME = 1
AXE_ID = 'battle-axe'

# 원본 도구 도끼 색 → 전투 도끼 색(player-weapon-battle-axe-*-slash.png)
TOOL_AXE_TO_BATTLE_AXE = {
    (43, 28, 29): (29, 19, 30),      # 외곽선
    (77, 74, 93): (74, 80, 87),      # 날 어두운 면
    (114, 107, 126): (138, 170, 171),
    (134, 126, 127): (138, 170, 171),
    (255, 255, 255): (169, 201, 202),  # 날 밝은 면
    (196, 181, 159): (169, 201, 202),  # 휘두른 자국
    (174, 118, 75): (98, 53, 28),    # 자루
    (105, 71, 51): (65, 30, 5),
}


def reorder_slash(file_name):
    source = Image.open(os.path.join(OUT, file_name)).convert('RGBA')
    sheet = Image.new('RGBA', (CELL * len(CHOP_FRAMES), CELL * 4))
    for row in range(4):
        for column, frame in enumerate(CHOP_FRAMES):
            cell = source.crop((frame * CELL, row * CELL, (frame + 1) * CELL, (row + 1) * CELL))
            sheet.paste(cell, (column * CELL, row * CELL))
    target = file_name.replace('-slash.png', '-chop.png')
    sheet.save(os.path.join(OUT, target), optimize=True)
    return target


def nearest_color(rgb):
    return min(TOOL_AXE_TO_BATTLE_AXE, key=lambda key: sum((a - b) ** 2 for a, b in zip(key, rgb)))


def load_tool(tool, layer):
    source = Image.open(os.path.join(LPC, 'spritesheets/tools', tool, f'{layer}.png')).convert('RGBA')
    source.putdata([
        pixel if pixel[3] == 0 else (*TOOL_AXE_TO_BATTLE_AXE[nearest_color(pixel[:3])], pixel[3])
        for pixel in source.get_flattened_data()
    ])
    return source


def tool_cell(source, frame, row):
    return source.crop((frame * TOOL_CELL, row * TOOL_CELL, (frame + 1) * TOOL_CELL, (row + 1) * TOOL_CELL))


def hammer_swing_trail(layer, row):
    """망치 1번 프레임에서 망치 몸(외곽선·자루 색이 있는 곳 둘레 3px)을 뺀 나머지 = 휘두른 궤적"""
    trail = tool_cell(load_tool('hammer', layer), SWING_FRAME, row)
    body_colors = {TOOL_AXE_TO_BATTLE_AXE[key] for key in ((43, 28, 29), (174, 118, 75), (105, 71, 51))}
    body = Image.new('L', trail.size)
    body.putdata([255 if pixel[3] and pixel[:3] in body_colors else 0 for pixel in trail.get_flattened_data()])
    trail.putalpha(ImageChops.subtract(trail.getchannel('A'), body.filter(ImageFilter.MaxFilter(7))))
    return trail


def tool_axe_sheet(layer, target):
    axe = load_tool('axe', layer)
    offset = (CELL - TOOL_CELL) // 2
    sheet = Image.new('RGBA', (CELL * len(CHOP_FRAMES), CELL * 4))
    for row in range(4):
        for column, frame in enumerate(CHOP_FRAMES):
            if frame == SWING_FRAME:
                cell = hammer_swing_trail(layer, row)
                cell.alpha_composite(tool_cell(axe, 0, row))
            else:
                cell = tool_cell(axe, frame, row)
            sheet.paste(cell, (column * CELL + offset, row * CELL + offset))
    sheet.save(os.path.join(OUT, target), optimize=True)
    return target


def main():
    if not os.path.isdir(os.path.join(LPC, 'spritesheets/tools/axe')):
        sys.exit('LPC 제너레이터 폴더를 넘겨 주세요(spritesheets/tools/axe 가 있어야 한다)')

    manifest_path = os.path.join(OUT, 'manifest.json')
    manifest = json.load(open(manifest_path, encoding='utf-8'))
    player = manifest['player']
    manifest['anims']['chop'] = {'cell': CELL, 'frames': len(CHOP_FRAMES)}

    for group in (player['base'], player['hair']):
        group['chop'] = reorder_slash(group['slash'])
    for entry in player['gear'].values():
        if 'slash' in entry['sheets']:
            entry['sheets']['chop'] = reorder_slash(entry['sheets']['slash'])

    axe = player['weapons'][AXE_ID]
    axe['attack'] = 'chop'
    axe['back']['chop'] = tool_axe_sheet('bg', f'player-weapon-{AXE_ID}-back-chop.png')
    axe['front']['chop'] = tool_axe_sheet('fg', f'player-weapon-{AXE_ID}-front-chop.png')

    with open(manifest_path, 'w', encoding='utf-8') as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=2)
        handle.write('\n')

    # 도구 도끼 그림의 저작자 줄을 CREDITS.csv 에 더한다(build-lpc-characters.py 가 다시 만들면 빠진다)
    credits_path = os.path.join(OUT, 'CREDITS.csv')
    credits = open(credits_path, encoding='utf-8', newline='').read()
    for line in open(os.path.join(LPC, 'CREDITS.csv'), encoding='utf-8'):
        if line.startswith(('"tools/axe/bg.png"', '"tools/axe/fg.png"')) and line.split(',')[0] not in credits:
            credits = credits.rstrip('\n') + '\n' + line.rstrip('\n') + '\n'
    with open(credits_path, 'w', encoding='utf-8', newline='') as handle:
        handle.write(credits)
    print('chop sheets done')


if __name__ == '__main__':
    main()
