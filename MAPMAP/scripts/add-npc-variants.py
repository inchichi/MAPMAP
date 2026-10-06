"""2장 주요 인물의 전용 외형 — 기존 LPC NPC 시트의 옷 색만 바꿔 'id:<npc>' 외형으로 덧붙인다.

build-lpc-characters.py 는 Universal LPC 생성기 원본(저장소 밖)이 있어야 돌고, 돌리면 manifest 를
새로 쓴다. 그 뒤에 이 스크립트를 다시 돌린다(멱등: 같은 키는 지우고 다시 붙인다).

색 바꾸기는 옷 자리(몸 프레임의 줄)만, 피부·외곽선은 빼고 한다. 결과는
notes/shots/ch2-style/npc-variants.png 로 확인한다.

  id:miren      갈대골 촌장 미렌   — 노인(elder_gray_hair) 웃옷 → 자줏빛
  id:odi        약초꾼 오디        — 흰 블라우스 → 쑥색
  id:tobin      나룻배 사공 토빈   — 황갈색 튜닉 → 물빛 회청
  id:reed_guard 갈대골 문지기 하르 — 갈색 튜닉 → 짙은 갈대 초록
"""
import colorsys
import json
import os

from PIL import Image

OUT = 'src/games/my-sample-rpg/assets/characters/lpc'
MANIFEST = os.path.join(OUT, 'manifest.json')

# 옷은 위치로 고른다: LPC 몸 프레임(64px)에서 웃옷은 y 30~45 줄, 바지·치마는 44~58 줄이다(모든 프레임
# 같은 자리). 그 줄에서 피부색(손)만 빼고 새 색을 입힌다(밝기 무늬는 살리고 색상·채도만 바꾼다).
# (키, 바탕 시트 키, [(줄 시작, 줄 끝, 새 색상, 채도, 밝기 배율, 최소 채도)], 피부 판정(색상 상한, 채도 하한·상한, 밝기 하한))
# 피부 판정은 인물마다 다르다 — 황갈색·갈색 옷이 피부색 범위와 겹쳐 얼룩이 남지 않게 좁힌다.
# 최소 채도: 그 아래(흰 수염·회색)는 건드리지 않는다. 흰 블라우스를 물들일 땐 0.
VARIANTS = [
    ('id:miren', 'character_elder_gray_hair', [(30, 44, 0.83, 0.38, 0.85, 0.2)], (0.11, 0.18, 0.62, 0.55)),
    ('id:odi', 'character_villager_flower_dress', [(32, 43, 0.24, 0.32, 0.92, 0.0)], (0.11, 0.18, 0.62, 0.55)),
    ('id:tobin', 'character_commoner_tan_tunic', [(30, 45, 0.58, 0.40, 0.85, 0.0)], (0.085, 0.30, 0.60, 0.45)),
    ('id:reed_guard', 'character_villager_brown_tunic', [(30, 45, 0.26, 0.55, 0.70, 0.0)], (0.11, 0.18, 0.50, 0.72)),
    # 사냥꾼 렌: 사냥꾼 차림(ranger_green)의 초록 웃옷 → 갈대골 사냥꾼의 흙갈색
    ('id:ren', 'character_ranger_green', [(30, 45, 0.07, 0.50, 0.78, 0.15)], (0.11, 0.18, 0.62, 0.55)),
    # 안개 속에 쓰러진 렌(잠긴숲 오브젝트 이름이 lost_hunter_ren) — 같은 외형
    ('id:lost_hunter_ren', 'character_ranger_green', [(30, 45, 0.07, 0.50, 0.78, 0.15)], (0.11, 0.18, 0.62, 0.55)),
]


def recolor(img, rules, skin, cell, offset):
    hmax, smin, smax, vmin = skin
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        local_y = (y % cell) - offset
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if (h <= hmax and smin <= s <= smax and v >= vmin) or v < 0.12:
                continue    # 손(피부)·외곽선은 그대로
            for y0, y1, nh, ns, vmul, min_sat in rules:
                if y0 <= local_y <= y1 and s >= min_sat:
                    nr, ng, nb = colorsys.hsv_to_rgb(nh, ns, min(1.0, v * vmul))
                    px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
                    break
    return out


def main():
    manifest = json.load(open(MANIFEST, encoding='utf-8'))
    walk_cell = manifest['anims']['walk']['cell']
    body_frame = manifest['bodyFrame']
    offset = (walk_cell - body_frame) // 2
    keys = [k for k in manifest['portraits']['keys'] if k not in {v[0] for v in VARIANTS}]
    atlas_old = Image.open(os.path.join(OUT, manifest['portraits']['file'])).convert('RGBA')
    old_keys = manifest['portraits']['keys']
    busts = {k: atlas_old.crop((i * 32, 0, i * 32 + 32, 32)) for i, k in enumerate(old_keys)}

    preview = []
    for key, base, rules, skin in VARIANTS:
        sheet = recolor(Image.open(os.path.join(OUT, manifest['npcs'][base])).convert('RGBA'), rules, skin, walk_cell, offset)
        file = f"npc-{key.replace(':', '-')}-walk.png"
        sheet.save(os.path.join(OUT, file), optimize=True)
        manifest['npcs'][key] = file
        body = sheet.crop((offset + 16, 2 * walk_cell + offset + 7, offset + 48, 2 * walk_cell + offset + 63))
        body.save(os.path.join(OUT, f"npc-full-{key.replace(':', '-')}.png"), optimize=True)
        busts[key] = sheet.crop((offset + 16, 2 * walk_cell + offset + 10, offset + 48, 2 * walk_cell + offset + 42))
        keys.append(key)
        preview.append((Image.open(os.path.join(OUT, f"npc-full-{base}.png")).convert('RGBA'), body))

    atlas = Image.new('RGBA', (32 * len(keys), 32), (0, 0, 0, 0))
    for i, k in enumerate(keys):
        atlas.paste(busts[k], (i * 32, 0))
    atlas.save(os.path.join(OUT, manifest['portraits']['file']), optimize=True)
    manifest['portraits']['keys'] = keys
    json.dump(manifest, open(MANIFEST, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)

    sheet = Image.new('RGBA', (len(preview) * 80, 64), (96, 112, 74, 255))
    for i, (before, after) in enumerate(preview):
        sheet.alpha_composite(before, (i * 80 + 4, 4))
        sheet.alpha_composite(after, (i * 80 + 40, 4))
    os.makedirs('notes/shots/ch2-style', exist_ok=True)
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save('notes/shots/ch2-style/npc-variants.png')
    print('variants', [v[0] for v in VARIANTS], 'portraits', len(keys))


if __name__ == '__main__':
    main()
