"""3장(얼어붙은 북쪽) 몬스터·인물 시트 — Universal LPC 생성기 합성(build-ch2-lpc-sheets.py 의 합성 함수를 쓴다)과
기존 몬스터 그림의 색 변형. 멱등(같은 키는 지우고 다시 붙인다). build-lpc-characters.py → add-npc-variants.py →
build-ch2-lpc-sheets.py → **이 스크립트** 순서로 돌린다.

사용: python3 scripts/build-ch3-lpc-sheets.py /path/lpc

몬스터(assets/monsters/lpc/, 생성기 합성은 칸 96 — 2장 사람형과 같은 줄 배치):
  goblin-raider.png    고블린 약탈자 — 초록 피부 고블린 머리, 가죽 갑옷, 단검(베기)
  frost-wolfman.png    서리 늑대인간 — 회색 털 근육 몸 + 늑대 머리, 맨손 할퀴기(베기)
  troll-chief.png      트롤 족장(중간 보스) — 푸른 피부 근육 몸 + 트롤 머리, 철퇴(베기)
  frost-witch.png      서리 마녀(최종 보스) — 흰 로브, 하늘빛 두건, 주문
  slime-snow.png       눈 말캉이 — 말캉이를 흰·하늘빛으로
  golem-ice-*.png      얼음 골렘 — 바위돌이를 얼음빛으로
  skeleton-frost.png   서리 해골 — 유적 해골병을 서리빛으로
인물(id:<키>, 걷기 시트 + 초상화): hagen(사냥꾼 대장), irma(약재상), volk(대장장이), nina(마을 아이)
"""
import colorsys
import csv
import importlib.util
import json
import os
import sys

from PIL import Image

spec = importlib.util.spec_from_file_location('ch2', os.path.join(os.path.dirname(__file__), 'build-ch2-lpc-sheets.py'))
ch2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ch2)       # build-lpc-characters 도 함께 불러 와 sys.argv[1] 의 원본을 쓴다
lpc = ch2.lpc
L, compose = lpc.L, lpc.compose
MONSTER_OUT, CHAR_OUT, CELL = ch2.MONSTER_OUT, ch2.CHAR_OUT, ch2.CELL

GOBLIN = [
    L('body/bodies/male/{anim}.png', 'body', 'green'),
    L('head/heads/goblin/adult/{anim}.png', 'body', 'green'),
    L('legs/pants/male/{anim}.png', 'cloth', 'brown'),
    L('torso/armour/leather/male/{anim}.png'),
]
WOLFMAN = [
    # 늑대 머리 원본이 갈색 털이라 몸도 갈색 털로 맞춘다(머리는 칠하지 않는다)
    L('body/bodies/muscular/{anim}.png', 'body', 'fur_brown'),
    L('head/heads/wolf/male/{anim}.png'),
    L('legs/pants/male/{anim}.png', 'cloth', 'charcoal'),
]
TROLL = [
    # 트롤 머리 원본이 초록이라 몸도 초록으로 맞춘다
    L('body/bodies/muscular/{anim}.png', 'body', 'green'),
    L('head/heads/troll/adult/{anim}.png'),
    L('legs/pants/male/{anim}.png', 'cloth', 'leather'),
]
WITCH = [
    L('body/bodies/female/{anim}.png', 'body', 'light'),
    L('head/heads/human/female/{anim}.png', 'body', 'light'),
    L('eyes/human/adult/default/{anim}.png', 'eye', 'blue'),
    L('torso/clothes/robe/female/{anim}/white.png'),
    L('hat/cloth/hood/adult/{anim}.png', 'cloth', 'sky'),
]
NPCS = {
    'id:hagen': lpc.human('male', 'amber') + [
        L('legs/pants/male/{anim}.png', 'cloth', 'charcoal'),
        L('feet/boots/fold/male/{anim}.png', 'cloth', 'leather'),
        L('torso/clothes/longsleeve/longsleeve/male/{anim}.png', 'cloth', 'maroon'),
        L('torso/armour/leather/male/{anim}.png'),
        L('hair/plain/adult/{anim}.png', 'hair', 'dark_brown'),
        L('beards/beard/basic/{anim}.png', 'hair', 'dark_brown'),
    ],
    'id:irma': [L('hair/ponytail/adult/bg/{anim}.png', 'hair', 'platinum')] + lpc.human('female') + [
        L('legs/skirts/plain/thin/{anim}.png', 'cloth', 'forest'),
        L('feet/boots/basic/thin/{anim}.png', 'cloth', 'brown'),
        L('torso/clothes/longsleeve/longsleeve/female/{anim}.png', 'cloth', 'sky'),
        L('hair/ponytail/adult/fg/{anim}.png', 'hair', 'platinum'),
    ],
    'id:volk': lpc.human('male', 'bronze') + [
        L('legs/pants/male/{anim}.png', 'cloth', 'charcoal'),
        L('feet/boots/basic/male/{anim}.png', 'cloth', 'black'),
        L('torso/clothes/shortsleeve/shortsleeve/male/{anim}.png', 'cloth', 'gray'),
        L('torso/aprons/apron/male/{anim}.png', 'cloth', 'leather'),
        L('hair/plain/adult/{anim}.png', 'hair', 'ginger'),
        L('beards/beard/winter/male/{anim}.png', 'hair', 'ginger'),
    ],
    'id:nina': [
        L('body/bodies/child/{anim}.png', 'body', 'light'),
        L('head/heads/human/child/{anim}.png', 'body', 'light'),
        L('eyes/human/child/{anim}.png', 'eye', 'blue'),
        L('legs/pants/child/{anim}/darkblue.png'),
        L('torso/clothes/shirt/child/{anim}/red.png'),
        L('hair/wavy/child/{anim}.png', 'hair', 'blonde'),
    ],
}


def weapon_monster(body, definition, variant, attack):
    """무기를 든 사람형 몬스터: 걷기·피격은 걷기용 무기 레이어, 공격은 공격용 무기 레이어."""
    walk_back, walk_front = lpc.weapon_layers(definition, variant, 'walk')
    sheet = ch2.monster_sheet(walk_back + body + walk_front, attack)
    back, front = lpc.weapon_layers(definition, variant, attack)
    attack_sheet = compose(back + body + front, attack)
    frames = lpc.ANIMS[attack]['frames']
    for r, line in enumerate(ch2.crop_cells(attack_sheet, lpc.ANIMS[attack]['cell'], frames, range(4))):
        for c, frame in enumerate(line):
            box = (c * CELL, (4 + r) * CELL, (c + 1) * CELL, (5 + r) * CELL)
            sheet.paste(Image.new('RGBA', (CELL, CELL)), box)
            sheet.alpha_composite(frame, box[:2])
    return sheet


def tint(img, hue, sat, val_mul, keep_dark=0.12):
    """색조 바꾸기(밝기 무늬는 살린다)."""
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if v < keep_dark:
                continue
            nr, ng, nb = colorsys.hsv_to_rgb(hue, max(0.0, min(1.0, s * sat + 0.05)), min(1.0, v * val_mul))
            px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    return out


def add_npc(manifest, key, layers):
    walk_cell = manifest['anims']['walk']['cell']
    offset = (walk_cell - manifest['bodyFrame']) // 2
    file = f"npc-{key.replace(':', '-')}-walk.png"
    sheet = compose(layers, 'walk')
    sheet.save(os.path.join(CHAR_OUT, file), optimize=True)
    manifest['npcs'][key] = file
    sheet.crop((offset + 16, 2 * walk_cell + offset + 7, offset + 48, 2 * walk_cell + offset + 63)).save(
        os.path.join(CHAR_OUT, f"npc-full-{key.replace(':', '-')}.png"), optimize=True)
    portraits = manifest['portraits']
    atlas_old = Image.open(os.path.join(CHAR_OUT, portraits['file'])).convert('RGBA')
    busts = {k: atlas_old.crop((i * 32, 0, i * 32 + 32, 32)) for i, k in enumerate(portraits['keys'])}
    busts[key] = sheet.crop((offset + 16, 2 * walk_cell + offset + 10, offset + 48, 2 * walk_cell + offset + 42))
    keys = [k for k in portraits['keys'] if k != key] + [key]
    atlas = Image.new('RGBA', (32 * len(keys), 32), (0, 0, 0, 0))
    for i, k in enumerate(keys):
        atlas.paste(busts[k], (i * 32, 0))
    atlas.save(os.path.join(CHAR_OUT, portraits['file']), optimize=True)
    portraits['keys'] = keys


def main():
    sheets = {
        'goblin-raider.png': weapon_monster(GOBLIN, 'weapons/sword/weapon_sword_dagger.json', 'dagger', 'slash'),
        'frost-wolfman.png': ch2.monster_sheet(WOLFMAN, 'slash'),
        'troll-chief.png': weapon_monster(TROLL, 'weapons/blunt/weapon_blunt_mace.json', 'mace', 'slash'),
        'frost-witch.png': ch2.monster_sheet(WITCH, 'spellcast'),
    }
    for name, sheet in sheets.items():
        sheet.save(os.path.join(MONSTER_OUT, name), optimize=True)
        print('저장', name, sheet.size)
    # 색 변형
    recolors = [('slime.png', 'slime-snow.png', 0.56, 0.35, 1.25),
                ('golem-walk.png', 'golem-ice-walk.png', 0.55, 0.9, 1.15),
                ('golem-attack.png', 'golem-ice-attack.png', 0.55, 0.9, 1.15),
                ('golem-die.png', 'golem-ice-die.png', 0.55, 0.9, 1.15),
                ('skeleton-soldier.png', 'skeleton-frost.png', 0.55, 1.6, 1.0)]
    for src, dst, hue, sat, val in recolors:
        tint(Image.open(os.path.join(MONSTER_OUT, src)).convert('RGBA'), hue, sat, val).save(
            os.path.join(MONSTER_OUT, dst), optimize=True)
        print('저장', dst)

    manifest_path = os.path.join(CHAR_OUT, 'manifest.json')
    manifest = json.load(open(manifest_path, encoding='utf-8'))
    for key, layers in NPCS.items():
        add_npc(manifest, key, layers)
    json.dump(manifest, open(manifest_path, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)
    print('인물', list(NPCS), '초상화', len(manifest['portraits']['keys']))

    # 저작자 표시(빌드 스크립트와 같은 방식 — 쓴 원본 파일의 행만, 없는 것만 덧붙인다)
    credits_path = os.path.join(CHAR_OUT, 'CREDITS.csv')
    have = {row[0] for row in csv.reader(open(credits_path, encoding='utf-8'))}
    source = list(csv.reader(open(os.path.join(lpc.LPC, 'CREDITS.csv'), encoding='utf-8')))[1:]
    add = [r for r in source if r[0] not in have and any(u.startswith(r[0].rstrip('/')) for u in lpc.used_files)]
    def_credits = []
    for root, _dirs, files in os.walk(os.path.join(lpc.LPC, 'sheet_definitions')):
        for name in files:
            if name.endswith('.json') and not name.startswith('meta'):
                data = json.load(open(os.path.join(root, name), encoding='utf-8'))
                def_credits += data.get('credits', []) if isinstance(data, dict) else []
    missing = []
    for u in sorted(lpc.used_files):
        if any(u.startswith(r[0].rstrip('/')) for r in source):
            continue
        match = max((c for c in def_credits if u.startswith(c.get('file', '').rstrip('/'))),
                    key=lambda c: len(c.get('file', '')), default=None)
        if match is None:
            if not u.startswith('eyes/human'):
                missing.append(u)
            continue
        if match['file'] not in have and all(r[0] != match['file'] for r in add):
            add.append([match['file'], match.get('notes', ''), ','.join(match.get('authors', [])),
                        ','.join(match.get('licenses', [])), ' '.join(match.get('urls', []))])
    with open(credits_path, 'a', newline='', encoding='utf-8') as fh:
        csv.writer(fh, lineterminator='\n').writerows(add)
    print('저작자 행 추가', len(add), '/ 출처 못 찾음', missing)


if __name__ == '__main__':
    main()
