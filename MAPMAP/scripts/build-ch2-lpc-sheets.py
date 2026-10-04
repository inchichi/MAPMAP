"""2장 사람형 몬스터와 새 인물 시트 — Universal LPC 생성기 원본에서 합성한다(build-lpc-characters.py 의
레이어 합성·팔레트 함수를 그대로 쓴다). 그 스크립트는 돌리면 캐릭터 산출물을 모두 지우고 다시 만들므로,
그 뒤에는 add-npc-variants.py 와 이 스크립트를 다시 돌린다(멱등).

사용: python3 scripts/build-ch2-lpc-sheets.py /path/lpc   (원본 받는 법은 build-lpc-characters.py 참고)

몬스터(assets/monsters/lpc/, 칸 96x96 — 몸 프레임 64 를 가운데 아래에 두고 위·옆에 무기 자리):
  줄 0~3 걷기(위·왼·아래·오른, 9프레임), 4~7 공격, 8 피격(아래 방향 6프레임)
  skeleton-soldier.png  유적 해골병   — 해골 몸·머리 + 쇠 검, 베기(6)
  drowned.png           물에 빠진 자  — 좀비 몸·머리 + 젖은 옷, 맨손 베기(6)
  swamp-priest.png      늪의 사제     — 창백한 초록 피부, 검은 로브·두건, 주문(7)
인물(assets/characters/lpc/, 다른 NPC 와 같은 걷기 시트 + 초상화 칸):
  id:selin              유적 학자 셀린 — 안경, 올린 머리, 갈색 웃옷·남색 치마
"""
import csv
import importlib.util
import json
import os
import sys

from PIL import Image

spec = importlib.util.spec_from_file_location('lpc', os.path.join(os.path.dirname(__file__), 'build-lpc-characters.py'))
lpc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lpc)
if not os.path.isdir(lpc.SS):
    raise SystemExit('LPC 저장소 경로를 인자로 주세요 (docstring 참고)')
L, compose = lpc.L, lpc.compose
lpc.ANIMS['spellcast'] = {'cell': 128, 'frames': 7}

MONSTER_OUT = 'src/games/my-sample-rpg/assets/monsters/lpc'
CHAR_OUT = lpc.OUT
CELL = 96

SKELETON = [L('body/bodies/skeleton/{anim}.png'), L('head/heads/skeleton/adult/{anim}.png')]
DROWNED = [
    L('body/bodies/zombie/{anim}/zombie.png', 'hue', (0.36, 0.55)),
    L('head/heads/zombie/adult/{anim}.png', 'hue', (0.36, 0.55)),
    L('legs/pants/male/{anim}.png', 'cloth', 'charcoal'),
    L('torso/clothes/longsleeve/longsleeve/male/{anim}.png', 'cloth', 'bluegray'),
]
PRIEST = [
    L('body/bodies/female/{anim}.png', 'body', 'pale_green'),
    L('head/heads/human/female/{anim}.png', 'body', 'pale_green'),
    L('eyes/human/adult/default/{anim}.png', 'eye', 'red'),
    L('torso/clothes/robe/female/{anim}/black.png'),
    L('hat/cloth/hood/adult/{anim}.png', 'cloth', 'forest'),
]
SELIN = lpc.human('female') + [
    L('legs/skirts/plain/thin/{anim}.png', 'cloth', 'navy'),
    L('feet/boots/basic/thin/{anim}.png', 'cloth', 'brown'),
    L('torso/clothes/longsleeve/longsleeve/female/{anim}.png', 'cloth', 'walnut'),
    L('hair/bangs_bun/adult/{anim}.png', 'hair', 'dark_brown'),
    L('facial/glasses/round/adult/{anim}.png'),
]


def crop_cells(sheet, cell, frames, rows):
    """compose 결과(칸 cell)에서 몸 프레임 둘레 96x96 을 잘라 낸다. 발끝이 칸 바닥에서 2px 위."""
    off = (cell - lpc.BODY_FRAME) // 2
    out = []
    for r in rows:
        line = []
        for c in range(frames):
            x0 = c * cell + off + 32 - CELL // 2
            y0 = r * cell + off + lpc.BODY_FRAME - CELL
            line.append(sheet.crop((x0, y0, x0 + CELL, y0 + CELL)))
        out.append(line)
    return out


def monster_sheet(layers, attack, attack_extra=()):
    walk = compose(layers, 'walk')
    att = compose(list(layers) + list(attack_extra), attack)
    hurt = compose(layers, 'hurt')
    blocks = [crop_cells(walk, lpc.ANIMS['walk']['cell'], 9, range(4)),
              crop_cells(att, lpc.ANIMS[attack]['cell'], lpc.ANIMS[attack]['frames'], range(4)),
              crop_cells(hurt, lpc.ANIMS['hurt']['cell'], 6, [2])]
    lines = [line for block in blocks for line in block]
    sheet = Image.new('RGBA', (CELL * max(len(line) for line in lines), CELL * len(lines)), (0, 0, 0, 0))
    for r, line in enumerate(lines):
        for c, frame in enumerate(line):
            sheet.alpha_composite(frame, (c * CELL, r * CELL))
    return sheet


def main():
    os.makedirs(MONSTER_OUT, exist_ok=True)
    back, front = lpc.weapon_layers('weapons/sword/weapon_sword_arming.json', 'iron', 'slash')
    walk_back, walk_front = lpc.weapon_layers('weapons/sword/weapon_sword_arming.json', 'iron', 'walk')
    skeleton = monster_sheet(walk_back + SKELETON + walk_front, 'slash')
    # 공격 동작은 베기용 무기 레이어로 다시(걷기용 칼집 무기 대신)
    skeleton_attack = compose(back + SKELETON + front, 'slash')
    rows = crop_cells(skeleton_attack, lpc.ANIMS['slash']['cell'], 6, range(4))
    for r, line in enumerate(rows):
        for c, frame in enumerate(line):
            box = (c * CELL, (4 + r) * CELL, (c + 1) * CELL, (5 + r) * CELL)
            skeleton.paste(Image.new('RGBA', (CELL, CELL)), box)
            skeleton.alpha_composite(frame, box[:2])
    for name, sheet in (('skeleton-soldier.png', skeleton),
                        ('drowned.png', monster_sheet(DROWNED, 'slash')),
                        ('swamp-priest.png', monster_sheet(PRIEST, 'spellcast'))):
        sheet.save(os.path.join(MONSTER_OUT, name), optimize=True)
        print('저장', name, sheet.size)

    # 셀린: 걷기 시트 + 대화창용 전신 + 초상화 칸(add-npc-variants.py 와 같은 방식)
    manifest_path = os.path.join(CHAR_OUT, 'manifest.json')
    manifest = json.load(open(manifest_path, encoding='utf-8'))
    walk_cell = manifest['anims']['walk']['cell']
    offset = (walk_cell - manifest['bodyFrame']) // 2
    key, file = 'id:selin', 'npc-id-selin-walk.png'
    sheet = compose(SELIN, 'walk')
    sheet.save(os.path.join(CHAR_OUT, file), optimize=True)
    manifest['npcs'][key] = file
    sheet.crop((offset + 16, 2 * walk_cell + offset + 7, offset + 48, 2 * walk_cell + offset + 63)).save(
        os.path.join(CHAR_OUT, 'npc-full-id-selin.png'), optimize=True)
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
    json.dump(manifest, open(manifest_path, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)
    print('저장', file, '초상화', len(keys))
    # 저작자 표시: 쓴 원본 파일의 생성기 CREDITS.csv 행 중 아직 없는 것만 덧붙인다(빌드 스크립트와 같은 파일).
    # CREDITS.csv 에 없는 파일(좀비 몸·로브·무기 등)은 시트 정의 파일의 credits 항목으로 채운다(빌드 스크립트와 같다).
    credits_path = os.path.join(CHAR_OUT, 'CREDITS.csv')
    have = {row[0] for row in csv.reader(open(credits_path, encoding='utf-8'))}
    source = list(csv.reader(open(os.path.join(lpc.LPC, 'CREDITS.csv'), encoding='utf-8')))[1:]
    covered = lambda u, rows: any(u.startswith(r[0].rstrip('/')) for r in rows)  # noqa: E731
    add = [r for r in source if r[0] not in have and any(u.startswith(r[0].rstrip('/')) for u in lpc.used_files)]
    def_credits = []
    for root, _dirs, files in os.walk(os.path.join(lpc.LPC, 'sheet_definitions')):
        for name in files:
            if name.endswith('.json') and not name.startswith('meta'):
                data = json.load(open(os.path.join(root, name), encoding='utf-8'))
                def_credits += data.get('credits', []) if isinstance(data, dict) else []
    missing = []
    for u in sorted(lpc.used_files):
        if covered(u, source):
            continue
        match = max((c for c in def_credits if u.startswith(c.get('file', '').rstrip('/'))),
                    key=lambda c: len(c.get('file', '')), default=None)
        if match is None:
            if not u.startswith('eyes/human'):      # 눈은 빌드 스크립트가 넣은 'eyes/human' 행이 있다
                missing.append(u)
            continue
        if match['file'] not in have and all(r[0] != match['file'] for r in add):
            add.append([match['file'], match.get('notes', ''), ','.join(match.get('authors', [])),
                        ','.join(match.get('licenses', [])), ' '.join(match.get('urls', []))])
    with open(credits_path, 'a', newline='', encoding='utf-8') as fh:
        csv.writer(fh, lineterminator='\n').writerows(add)
    print('저작자 행 추가', len(add), '/ 원본', len(lpc.used_files), '/ 출처 못 찾음', missing)

if __name__ == '__main__':
    main()
