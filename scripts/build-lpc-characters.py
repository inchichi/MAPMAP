"""LPC 캐릭터 시트 빌더 — 플레이어(은빛 기사)와 NPC 를 같은 LPC 그림체로 합성한다.

원본: Universal LPC Spritesheet Character Generator
  https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator
레이어별 저자·라이선스(CC-BY-SA 3.0 / GPL 3.0 / OGA-BY 3.0 / CC-BY 4.0 등)는 빌드 때
src/games/my-sample-rpg/assets/characters/lpc/CREDITS.csv 에 사용한 파일 기준으로 모아 적는다.

사용:
  git clone --depth 1 --filter=blob:none --sparse <위 저장소> /path/lpc
  (cd /path/lpc && git sparse-checkout set /spritesheets/ /palette_definitions/ /CREDITS.csv)
  python3 scripts/build-lpc-characters.py /path/lpc

출력(assets/characters/lpc/):
  player-base-<동작>.png              — 몸·얼굴·바지·신발·속옷(장비 없는 기본 모습)
  player-hair-<동작>.png              — 머리카락(투구가 덮으면 숨긴다)
  player-<슬롯>-<아이템>-<동작>.png    — 갑옷·투구·신발 레이어
  player-weapon-<아이템>-<back|front>-<동작>.png — 무기(몸 뒤/앞)
  npc-<외형>-walk.png                 — NPC 걷기(정지 시 0번 프레임)
  manifest.json                       — 칸 크기·프레임 수·아이템별 레이어 파일

장비를 바꾸면 겉모습이 바뀌도록, 플레이어는 미리 한 장으로 굳히지 않고 위 레이어를
게임에서 쌓는다(뒤 무기 → 기본 → 신발 → 갑옷 → 머리카락 → 투구 → 앞 무기).

모든 시트는 같은 규칙: 4행(위·왼·아래·오른) x N열, 칸(cell) 한가운데에 64px 몸 프레임이
놓인다(무기가 커서 칸이 128/192px 인 동작도 있다). 발끝은 몸 프레임 y=62, 가운데 x=32.
"""
import colorsys
import csv
import json
import os
import sys

from PIL import Image

LPC = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('LPC_ROOT', '')
SS = os.path.join(LPC, 'spritesheets')
OUT = 'src/games/my-sample-rpg/assets/characters/lpc'
BODY_FRAME = 64

# 동작별 칸 크기·프레임 수(LPC 표준 시트 기준). hurt 는 아래 방향 1행뿐이라 4행으로 복제한다.
ANIMS = {
    'walk': {'cell': 128, 'frames': 9},
    'slash': {'cell': 192, 'frames': 6},
    'thrust': {'cell': 192, 'frames': 8},
    'shoot': {'cell': 128, 'frames': 13},
    'hurt': {'cell': 128, 'frames': 6},
}

used_files = set()


# ---------------------------------------------------------------- 팔레트
def _palette(material, name):
    base_dir = os.path.join(LPC, 'palette_definitions', material)
    data = json.load(open(os.path.join(base_dir, f'{material}_ulpc.json'), encoding='utf-8'))
    meta = json.load(open(os.path.join(base_dir, f'meta_{material}.json'), encoding='utf-8'))
    return data[meta['base']], data[name]


def _rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def recolor(img, material, name):
    if not material:
        return img
    px = img.load()
    if material == 'hue':   # 팔레트 없는 고정색 레이어: 색조만 바꾼다(명도 유지)
        hue, sat = name
        for y in range(img.height):
            for x in range(img.width):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if s < 0.15:
                    continue
                nr, ng, nb = colorsys.hsv_to_rgb(hue, min(1, s * sat), v)
                px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
        return img
    base, target = _palette(material, name)
    mapping = [(_rgb(b), _rgb(t)) for b, t in zip(base, target)]
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            for (br, bg, bb), t in mapping:
                if abs(r - br) <= 1 and abs(g - bg) <= 1 and abs(b - bb) <= 1:
                    px[x, y] = t + (a,)
                    break
    return img


# ---------------------------------------------------------------- 레이어
def L(path, material=None, color=None):
    """path 의 {anim} 은 동작 이름으로 바뀐다. 동작에 해당 파일이 없으면 그 동작에서 빠진다."""
    return {'path': path, 'material': material, 'color': color}


def load_layer(layer, anim):
    path = layer['path'].format(anim=anim)
    full = os.path.join(SS, path)
    if not os.path.exists(full):
        return None
    used_files.add(path)
    return recolor(Image.open(full).convert('RGBA'), layer['material'], layer['color'])


def compose(layers, anim):
    spec = ANIMS[anim]
    cell, frames = spec['cell'], spec['frames']
    sheet = Image.new('RGBA', (cell * frames, cell * 4), (0, 0, 0, 0))
    any_layer = False
    for layer in layers:
        img = load_layer(layer, anim)
        if img is None:
            continue
        any_layer = True
        # 프레임 크기 판별: LPC 표준 64/128/192 중 시트 높이가 정확히 1행(hurt)이나 4행이 되는 값
        src = next(size for size in (192, 128, 64) if img.height in (size, size * 4))
        rows = img.height // src
        for r in range(4):
            sr = 0 if rows == 1 else r
            for c in range(frames):
                if (c + 1) * src > img.width:
                    break
                frame = img.crop((c * src, sr * src, (c + 1) * src, (sr + 1) * src))
                off = (cell - src) // 2
                sheet.alpha_composite(frame, (c * cell + off, r * cell + off))
    return sheet if any_layer else None


# ---------------------------------------------------------------- 외형 정의
def human(sex='male', skin='light'):
    return [
        L(f'body/bodies/{sex}/{{anim}}.png', 'body', skin),
        L(f'head/heads/human/{sex}/{{anim}}.png', 'body', skin),
        L('eyes/human/adult/default/{anim}.png', 'eye', 'blue'),
    ]


# ---------------------------------------------------------------- 플레이어 레이어
PLAYER_BASE = human() + [
    L('legs/pants/male/{anim}.png', 'cloth', 'slate'),
    L('feet/shoes/basic/male/{anim}.png', 'cloth', 'black'),
    L('torso/clothes/longsleeve/longsleeve/male/{anim}.png', 'cloth', 'white'),
]
PLAYER_BASE[2] = L('eyes/human/adult/default/{anim}.png', 'eye', 'gray')
PLAYER_HAIR = [L('hair/spiked/adult/{anim}.png', 'hair', 'blonde')]

# 갑옷·투구·신발: 아이템 id → (슬롯, 레이어, 머리카락 숨김 여부)
GEAR = {
    'basic-armor': ('armor', [L('torso/clothes/longsleeve/longsleeve/male/{anim}.png', 'cloth', 'blue')], False),
    'Leather_Armor': ('armor', [L('torso/armour/leather/male/{anim}.png')], False),
    'Chain_Armor': ('armor', [L('torso/chainmail/male/{anim}.png', 'metal', 'steel')], False),
    'iron-armor': ('armor', [L('torso/armour/plate/male/{anim}.png', 'metal', 'steel')], False),
    'Iron_Armor': ('armor', [L('torso/armour/plate/male/{anim}.png', 'metal', 'silver')], False),
    'Leather_Helmet': ('hat', [L('hat/cloth/leather_cap/adult/{anim}.png', 'cloth', 'leather')], False),
    'Chain_Helmet': ('hat', [L('hat/helmet/mail/adult/{anim}.png', 'metal', 'steel')], True),
    'Iron_Helmet': ('hat', [L('hat/helmet/armet/adult/{anim}.png', 'metal', 'silver')], True),
    'basic-boots': ('boots', [L('feet/boots/basic/male/{anim}.png', 'cloth', 'brown')], False),
    'leather-boots': ('boots', [L('feet/boots/fold/male/{anim}.png', 'cloth', 'leather')], False),
}

# 무기: 아이템 id → (LPC 시트 정의, 색 변형, 공격 동작). 정의 파일의 레이어 zPos 로
# 몸(10)보다 뒤/앞을 가른다.
WEAPON_ITEMS = {
    'basic-sword': ('weapons/sword/weapon_sword_arming.json', 'iron', 'slash'),
    'bronze-sword': ('weapons/sword/weapon_sword_arming.json', 'bronze', 'slash'),
    'iron-sword': ('weapons/sword/weapon_sword_arming.json', 'steel', 'slash'),
    'battle-axe': ('weapons/blunt/weapon_blunt_waraxe.json', 'waraxe', 'slash'),
    'spiked-mace': ('weapons/blunt/weapon_blunt_mace.json', 'mace', 'slash'),
    'quick-dagger': ('weapons/sword/weapon_sword_dagger.json', 'dagger', 'slash'),
    'long-spear': ('weapons/polearm/weapon_polearm_spear.json', 'iron', 'thrust'),
    # 아이템 아이콘(파란 보주 지팡이)과 맞게 파란 수정 지팡이
    'magic-staff': ('weapons/magic/weapon_magic_crystal.json', 'blue', 'thrust'),
    'hunting-bow': ('weapons/ranged/bow/weapon_ranged_bow_normal.json', 'medium', 'shoot'),
}
CUSTOM_ANIM_BASE = {'slash_128': 'slash', 'slash_oversize': 'slash', 'thrust_oversize': 'thrust',
                    'thrust_128': 'thrust', 'walk_128': 'walk'}
BODY_Z = 10


def weapon_layers(definition, variant, anim):
    """정의 파일의 레이어 중 이 동작에 쓰이는 파일을 (뒤, 앞) 목록으로 고른다."""
    data = json.load(open(os.path.join(LPC, 'sheet_definitions', definition), encoding='utf-8'))
    back, front = [], []
    for key, layer in sorted(((k, v) for k, v in data.items() if k.startswith('layer_')),
                             key=lambda kv: kv[1].get('zPos', 0)):
        prefix = layer.get('male')
        if not prefix:
            continue
        custom = layer.get('custom_animation')
        if custom:
            if CUSTOM_ANIM_BASE.get(custom) != anim:
                continue
            candidates = [f'{prefix}{variant}.png', prefix.rstrip('/') + '.png']
        else:
            candidates = [f'{prefix}{anim}/{variant}.png', f'{prefix}{anim}.png']
        path = next((c for c in candidates if os.path.exists(os.path.join(SS, c))), None)
        if path:
            (back if layer.get('zPos', 0) < BODY_Z else front).append(L(path))
    return back, front


M, F = 'male', 'female'
NPCS = {
    'character_adventurer_brown_hair': human() + [
        L('legs/pants/male/{anim}.png', 'cloth', 'walnut'),
        L('feet/boots/basic/male/{anim}.png', 'cloth', 'brown'),
        L('torso/clothes/longsleeve/longsleeve/male/{anim}.png', 'cloth', 'white'),
        L('torso/armour/leather/male/{anim}.png'),
        L('hair/plain/adult/{anim}.png', 'hair', 'chestnut'),
    ],
    'character_bearded_apron_man': human(skin='amber') + [
        L('legs/pants/male/{anim}.png', 'cloth', 'charcoal'),
        L('feet/boots/basic/male/{anim}.png', 'cloth', 'black'),
        L('torso/clothes/shortsleeve/shortsleeve/male/{anim}.png', 'cloth', 'tan'),
        L('torso/aprons/apron/male/{anim}.png', 'cloth', 'leather'),
        L('hair/plain/adult/{anim}.png', 'hair', 'dark_brown'),
        L('beards/beard/basic/{anim}.png', 'hair', 'dark_brown'),
    ],
    'character_commoner_tan_tunic': human(skin='olive') + [
        L('legs/pants/male/{anim}.png', 'cloth', 'brown'),
        L('feet/shoes/basic/male/{anim}.png', 'cloth', 'brown'),
        L('torso/clothes/shortsleeve/shortsleeve/male/{anim}.png', 'cloth', 'tan'),
        L('hair/messy1/adult/{anim}.png', 'hair', 'light_brown'),
    ],
    'character_villager_brown_tunic': human() + [
        L('legs/pants/male/{anim}.png', 'cloth', 'tan'),
        L('feet/shoes/basic/male/{anim}.png', 'cloth', 'brown'),
        L('torso/clothes/longsleeve/longsleeve/male/{anim}.png', 'cloth', 'brown'),
        L('hair/bangs/adult/{anim}.png', 'hair', 'chestnut'),
    ],
    # 여성 몸 옷은 LPC 의 'thin' 체형 레이어를 쓴다. 포니테일은 뒤(bg)/앞(fg) 두 장.
    'character_villager_flower_dress': [L('hair/ponytail/adult/bg/{anim}.png', 'hair', 'gold')] + human(F) + [
        L('legs/skirts/plain/thin/{anim}.png', 'cloth', 'rose'),
        L('feet/boots/basic/thin/{anim}.png', 'cloth', 'brown'),
        L('torso/clothes/longsleeve/longsleeve/female/{anim}.png', 'cloth', 'white'),
        L('hair/ponytail/adult/fg/{anim}.png', 'hair', 'gold'),
    ],
    'character_elder_gray_hair': human() + [
        L('legs/pants/male/{anim}.png', 'cloth', 'gray'),
        L('feet/shoes/basic/male/{anim}.png', 'cloth', 'brown'),
        L('torso/clothes/longsleeve/longsleeve/male/{anim}.png', 'cloth', 'forest'),
        L('hair/plain/adult/{anim}.png', 'hair', 'gray'),
        L('beards/beard/winter/male/{anim}.png', 'hair', 'gray'),
    ],
    'character_wizard_purple': human() + [
        L('legs/pants/male/{anim}.png', 'cloth', 'purple'),
        L('feet/shoes/basic/male/{anim}.png', 'cloth', 'charcoal'),
        L('torso/clothes/longsleeve/longsleeve/male/{anim}.png', 'cloth', 'purple'),
        L('hair/long/adult/{anim}.png', 'hair', 'white'),
        L('beards/beard/medium/{anim}.png', 'hair', 'white'),
        L('hat/magic/wizard/base/adult/{anim}.png', 'hue', (0.78, 1.0)),
        L('hat/magic/wizard/belt/adult/{anim}.png'),
    ],
    'character_ranger_green': human(skin='amber') + [
        L('legs/pants/male/{anim}.png', 'cloth', 'tan'),
        L('feet/boots/fold/male/{anim}.png', 'cloth', 'leather'),
        L('torso/clothes/shortsleeve/shortsleeve/male/{anim}.png', 'cloth', 'forest'),
        L('torso/armour/leather/male/{anim}.png'),
        L('hair/messy1/adult/{anim}.png', 'hair', 'dark_brown'),
        L('hat/cloth/hood/adult/{anim}.png', 'cloth', 'green'),
    ],
    'character_knight_gray_helmet': human() + [
        L('legs/pants/male/{anim}.png', 'cloth', 'slate'),
        L('feet/boots/rimmed/male/{anim}.png', 'cloth', 'black'),
        L('torso/clothes/longsleeve/longsleeve/male/{anim}.png', 'cloth', 'navy'),
        L('torso/armour/plate/male/{anim}.png', 'metal', 'iron'),
        L('hat/helmet/nasal/adult/{anim}.png', 'metal', 'iron'),
    ],
    'character_knight_open_helmet': human() + [
        L('legs/pants/male/{anim}.png', 'cloth', 'charcoal'),
        L('feet/boots/rimmed/male/{anim}.png', 'cloth', 'black'),
        L('torso/clothes/longsleeve/longsleeve/male/{anim}.png', 'cloth', 'red'),
        L('torso/armour/plate/male/{anim}.png', 'metal', 'steel'),
        L('hair/plain/adult/{anim}.png', 'hair', 'black'),
        L('hat/helmet/barbuta/male/{anim}.png', 'metal', 'steel'),
    ],
    'character_knight_closed_helmet': human() + [
        L('legs/pants/male/{anim}.png', 'cloth', 'charcoal'),
        L('feet/boots/rimmed/male/{anim}.png', 'cloth', 'black'),
        L('torso/clothes/longsleeve/longsleeve/male/{anim}.png', 'cloth', 'blue'),
        L('torso/armour/plate/male/{anim}.png', 'metal', 'steel'),
        L('hat/helmet/greathelm/male/{anim}.png', 'metal', 'steel'),
    ],
}


def save(sheet, name, _unused=None):
    """시트를 저장하고 파일 이름을 돌려준다."""
    sheet.save(os.path.join(OUT, name), optimize=True)
    return name


# 초상화가 있는 NPC 는 외형 공유 대신 NPC id 로 따로 맞춘다(대화창 초상화와 같은 사람으로 보이게).
NPC_BY_ID = {
    'blacksmith': human(skin='light') + [
        L('legs/pants/male/{anim}.png', 'cloth', 'charcoal'),
        L('feet/boots/basic/male/{anim}.png', 'cloth', 'black'),
        L('torso/clothes/shortsleeve/shortsleeve/male/{anim}.png', 'cloth', 'white'),
        L('torso/aprons/apron/male/{anim}.png', 'cloth', 'leather'),
        L('hair/plain/adult/{anim}.png', 'hair', 'white'),
        L('beards/beard/winter/male/{anim}.png', 'hair', 'white'),
    ],
    'potion_merchant': human(F) + [
        L('torso/clothes/robe/female/{anim}/purple.png'),
        L('hair/long/adult/{anim}.png', 'hair', 'chestnut'),
    ],
    # 딴따라마을 퀘스트 의뢰인 — 외형을 공유하는 다른 주민과 구별되게
    'lady': human(F) + [
        L('torso/clothes/robe/female/{anim}/blue.png'),
        L('hair/long/adult/{anim}.png', 'hair', 'platinum'),
    ],
    'farmer': human(skin='bronze') + [
        L('legs/pants/male/{anim}.png', 'cloth', 'tan'),
        L('feet/boots/basic/male/{anim}.png', 'cloth', 'brown'),
        L('torso/clothes/shortsleeve/shortsleeve/male/{anim}.png', 'cloth', 'white'),
        L('torso/aprons/overalls/male/{anim}.png', 'cloth', 'blue'),
        L('hair/messy1/adult/{anim}.png', 'hair', 'ginger'),
    ],
    'mage': human() + [
        L('legs/pants/male/{anim}.png', 'cloth', 'navy'),
        L('feet/shoes/basic/male/{anim}.png', 'cloth', 'charcoal'),
        L('torso/clothes/longsleeve/longsleeve/male/{anim}.png', 'cloth', 'teal'),
        L('hair/plain/adult/{anim}.png', 'hair', 'gray'),
        L('beards/beard/medium/{anim}.png', 'hair', 'gray'),
        L('hat/magic/wizard/base/adult/{anim}.png', 'hue', (0.5, 0.9)),
    ],
    'santa': human() + [
        L('legs/pants/male/{anim}.png', 'cloth', 'red'),
        L('feet/boots/basic/male/{anim}.png', 'cloth', 'black'),
        L('torso/clothes/longsleeve/longsleeve/male/{anim}.png', 'cloth', 'red'),
        L('hair/plain/adult/{anim}.png', 'hair', 'white'),
        L('beards/beard/winter/male/{anim}.png', 'hair', 'white'),
        L('hat/holiday/santa/adult/{anim}.png'),
    ],
}


def main():
    if not os.path.isdir(SS):
        raise SystemExit('LPC 저장소 경로를 인자로 주세요 (docstring 참고)')
    os.makedirs(OUT, exist_ok=True)
    for old in os.listdir(OUT):   # 예전 빌드 산출물 정리(이름 체계가 바뀌면 남지 않게)
        if old.endswith('.png'):
            os.remove(os.path.join(OUT, old))
    manifest = {'bodyFrame': BODY_FRAME, 'footY': 62, 'centerX': 32, 'rows': ['up', 'left', 'down', 'right'],
                'anims': ANIMS, 'player': {'base': {}, 'hair': {}, 'gear': {}, 'weapons': {}}, 'npcs': {}}
    player = manifest['player']
    for anim in ANIMS:
        player['base'][anim] = save(compose(PLAYER_BASE, anim), f'player-base-{anim}.png', None)
        player['hair'][anim] = save(compose(PLAYER_HAIR, anim), f'player-hair-{anim}.png', None)
    for item, (slot, layers, hides_hair) in GEAR.items():
        entry = {'slot': slot, 'hidesHair': hides_hair, 'sheets': {}}
        for anim in ANIMS:
            sheet = compose(layers, anim)
            if sheet is not None:
                entry['sheets'][anim] = save(sheet, f'player-{slot}-{item}-{anim}.png', None)
        player['gear'][item] = entry
        print('gear', item, list(entry['sheets']))
    for item, (definition, variant, attack) in WEAPON_ITEMS.items():
        entry = {'attack': attack, 'back': {}, 'front': {}}
        for anim in ('walk', 'hurt', attack):
            back, front = weapon_layers(definition, variant, anim)
            if item == 'hunting-bow' and anim == 'shoot':
                front.append(L('weapon/ranged/bow/arrow/shoot/arrow.png'))
            for side, layers in (('back', back), ('front', front)):
                sheet = compose(layers, anim) if layers else None
                if sheet is not None:
                    entry[side][anim] = save(sheet, f'player-weapon-{item}-{side}-{anim}.png', None)
        player['weapons'][item] = entry
        print('weapon', item, {k: list(v) for k, v in entry.items() if isinstance(v, dict)})
    # 장비 아이콘(방어구·투구·신발): 그 장비 레이어의 정면 정지 프레임을 잘라 32x32 칸 가운데에.
    # 인벤토리 아이콘이 입었을 때 모습과 똑같이 보이게 한다.
    icon_items = []
    for item, entry in player['gear'].items():
        sheet = Image.open(os.path.join(OUT, entry['sheets']['walk'])).convert('RGBA')
        cell = ANIMS['walk']['cell']
        frame = sheet.crop((0, 2 * cell, cell, 3 * cell))
        if entry['slot'] == 'boots':
            frame = frame.crop((0, cell // 2 + 16, cell, cell))   # 발 부분만
        box = frame.getbbox()
        part = frame.crop(box) if box else frame
        part.thumbnail((30, 30), Image.NEAREST)
        icon = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
        icon.paste(part, ((32 - part.width) // 2, (32 - part.height) // 2), part)
        icon_items.append((item, icon))
    icon_atlas = Image.new('RGBA', (32 * len(icon_items), 32), (0, 0, 0, 0))
    for index, (_item, icon) in enumerate(icon_items):
        icon_atlas.paste(icon, (index * 32, 0), icon)
    icon_atlas.save(os.path.join(OUT, 'gear-icons.png'), optimize=True)
    for item, icon in icon_items:   # 땅에 떨어진 장비 그림용 낱장
        icon.save(os.path.join(OUT, f'gear-icon-{item}.png'), optimize=True)
    manifest['gearIcons'] = {'file': 'gear-icons.png', 'size': 32, 'items': [item for item, _ in icon_items]}

    # 화살 발사체: 쏘기 동작에서 시위에 걸린 화살(오른쪽 행 8번 프레임)을 잘라 쓴다.
    arrow = load_layer(L('weapon/ranged/bow/arrow/shoot/arrow.png'), 'shoot')
    arrow_frame = arrow.crop((8 * 64, 3 * 64, 9 * 64, 4 * 64))
    arrow_frame.crop(arrow_frame.getbbox()).save(os.path.join(OUT, 'projectile-arrow.png'))
    manifest['projectiles'] = {'arrow': 'projectile-arrow.png'}
    for npc, layers in NPCS.items():
        name = save(compose(layers, 'walk'), f'npc-{npc}-walk.png', None)
        manifest['npcs'][npc] = name
    for npc_id, layers in NPC_BY_ID.items():
        name = save(compose(layers, 'walk'), f'npc-id-{npc_id}-walk.png', None)
        manifest['npcs'][f'id:{npc_id}'] = name
    print('npcs', len(NPCS), '+ by id', len(NPC_BY_ID))

    # 퀘스트 로그 초상화: 각 NPC 시트의 정면(아래 행) 0번 프레임에서 머리·어깨(32x32)를 잘라 한 장에.
    keys = list(manifest['npcs'])
    atlas = Image.new('RGBA', (32 * len(keys), 32), (0, 0, 0, 0))
    walk_cell = ANIMS['walk']['cell']
    offset = (walk_cell - BODY_FRAME) // 2
    for index, key in enumerate(keys):
        sheet = Image.open(os.path.join(OUT, manifest['npcs'][key]))
        bust = sheet.crop((offset + 16, 2 * walk_cell + offset + 10, offset + 48, 2 * walk_cell + offset + 42))
        atlas.paste(bust, (index * 32, 0))
    atlas.save(os.path.join(OUT, 'npc-portraits.png'), optimize=True)
    # 대화창 초상화(일러스트가 없는 NPC): 정면 0번 프레임의 전신(32x56)을 따로 저장 — 크게 키워 쓴다.
    for key in keys:
        sheet = Image.open(os.path.join(OUT, manifest['npcs'][key]))
        body = sheet.crop((offset + 16, 2 * walk_cell + offset + 7, offset + 48, 2 * walk_cell + offset + 63))
        body.save(os.path.join(OUT, f"npc-full-{key.replace(':', '-')}.png"), optimize=True)
    manifest['portraits'] = {'file': 'npc-portraits.png', 'size': 32, 'keys': keys}
    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)

    # 저작자 표시: 쓴 파일이 속한 CREDITS.csv 행만 모은다.
    rows = list(csv.reader(open(os.path.join(LPC, 'CREDITS.csv'), encoding='utf-8')))
    header, body = rows[0], rows[1:]
    # 행은 파일 단위 또는 폴더 단위로 적혀 있다 — 쓴 파일이 그 행 경로로 시작하면 해당.
    keep = [r for r in body if any(u.startswith(r[0].rstrip('/')) for u in used_files)]
    with open(os.path.join(OUT, 'CREDITS.csv'), 'w', newline='', encoding='utf-8') as fh:
        w = csv.writer(fh)
        w.writerow(header)
        w.writerows(keep)
    covered = {u for u in used_files if any(u.startswith(r[0].rstrip('/')) for r in body)}
    # CREDITS.csv 에 없는 파일(무기 등)은 시트 정의 파일의 credits 항목으로 채운다.
    def_credits = []
    for root, _dirs, files in os.walk(os.path.join(LPC, 'sheet_definitions')):
        for name in files:
            if not name.endswith('.json') or name.startswith('meta'):
                continue
            data = json.load(open(os.path.join(root, name), encoding='utf-8'))
            for credit in data.get('credits', []) if isinstance(data, dict) else []:
                def_credits.append(credit)
    # 사람 눈(eyes/human)은 시트 정의가 따로 없다 — 얼굴(head/faces) 정의의 원작자 표기를 따른다.
    def_credits.append({
        'file': 'eyes/human',
        'notes': 'Original by Redshrike, eyes by ElizaWy, mapped to all frames by JaidynReiman '
                 '(same source as head/faces)',
        'authors': ['JaidynReiman', 'ElizaWy', 'Stephen Challener (Redshrike)'],
        'licenses': ['OGA-BY 3.0', 'CC-BY-SA 3.0', 'GPL 3.0'],
        'urls': ['https://github.com/ElizaWy/LPC/tree/main/Characters/Head',
                 'https://opengameart.org/content/ulpc-expanded-expressions'],
    })
    extra_rows = {}
    for u in sorted(used_files - covered):
        match = max((c for c in def_credits if u.startswith(c.get('file', '').rstrip('/'))),
                    key=lambda c: len(c.get('file', '')), default=None)
        if match:
            extra_rows[match['file']] = [match['file'], match.get('notes', ''), ','.join(match.get('authors', [])),
                                         ','.join(match.get('licenses', [])), ' '.join(match.get('urls', []))]
            covered.add(u)
    if extra_rows:
        with open(os.path.join(OUT, 'CREDITS.csv'), 'a', newline='', encoding='utf-8') as fh:
            csv.writer(fh).writerows(extra_rows.values())
    uncovered = sorted(used_files - covered)
    print(f'credits rows {len(keep)} for {len(used_files)} files, uncovered {len(uncovered)}')
    for u in uncovered:
        print('  NO CREDIT:', u)


if __name__ == '__main__':
    main()
