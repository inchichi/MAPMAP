"""DCSS(Dungeon Crawl Stone Soup) 동굴 타일을 town-32 타일셋에 덧붙인다.

generate-transition-tiles.py가 세운 규약을 따른다: 기존 타일 id는 절대 건드리지
않고(다른 화면이 이 시트를 id로 자른다), PNG 아래에 행을 추가하고 tsx의
tilecount/이미지 높이만 늘린다.

원본: https://github.com/crawl/crawl (crawl-ref/source/rltiles/dngn 등)
라이선스: 퍼블릭 도메인 RLTiles 파생(assets/tilesets/dcss/LICENSE.txt 참고).
선별된 타일 PNG는 assets/tilesets/dcss/ 에 벤더링되어 있어 오프라인에서도
재실행 가능하다.

멱등: tsx tilecount가 기준(600)보다 크면 먼저 기준 상태로 되돌린 뒤 다시 붙인다.
실행 후 scripts/dcss-cave-gids.json 에 {type이름: gid} 매핑을 기록한다 —
generate-cave.py가 이 파일을 읽는다.
"""
import json
import os
import re
import struct
import zlib

TSX = 'src/games/my-sample-rpg/assets/tilesets/town-32.tsx'
PNG = 'src/games/my-sample-rpg/assets/tilesets/town-32.png'
VENDOR = 'src/games/my-sample-rpg/assets/tilesets/dcss'
OUT_GIDS = 'scripts/dcss-cave-gids.json'

BASE_TILECOUNT = 600     # 전환 타일까지 포함한 기준 상태
BASE_HEIGHT = 2400
COLUMNS = 8
TILE = 32

# (type 이름, 벤더 파일) — 순서가 곧 id 순서. 여기에 추가만 하고 재배열하지 말 것.
MANIFEST = [
    # ---- 벽 채움 ----
    ('cave_wall_lair_00', 'wall__lair0.png'),
    ('cave_wall_lair_01', 'wall__lair2.png'),
    ('cave_wall_lair_02', 'wall__lair3.png'),
    ('cave_wall_lair_vine', 'wall__lair5.png'),
    ('cave_wall_slime_00', 'wall__slime1.png'),
    ('cave_wall_slime_01', 'wall__slime3.png'),
    ('cave_wall_slime_02', 'wall__slime4.png'),
    ('cave_wall_catacombs_00', 'wall__catacombs0.png'),
    ('cave_wall_catacombs_01', 'wall__catacombs3.png'),
    ('cave_wall_catacombs_02', 'wall__catacombs5.png'),
    ('cave_wall_catacombs_03', 'wall__catacombs6.png'),
    ('cave_wall_catacombs_04', 'wall__catacombs7.png'),
    ('cave_wall_catacombs_skull_00', 'wall__catacombs13.png'),
    ('cave_wall_catacombs_skull_01', 'wall__catacombs14.png'),
    ('cave_wall_crypt_00', 'wall__crypt0.png'),
    ('cave_wall_crypt_candle_00', 'wall__crypt3.png'),
    ('cave_wall_crypt_candle_01', 'wall__crypt7.png'),
    ('cave_wall_crystal_00', 'wall__crystal_wall06.png'),
    ('cave_wall_crystal_01', 'wall__crystal_wall07.png'),
    ('cave_wall_crystal_lightblue', 'wall__crystal_wall_lightblue.png'),
    ('cave_wall_crystal_lightgreen', 'wall__crystal_wall_lightgreen.png'),
    # ---- 벽 그림자 오버레이(바닥 위에 깐다) ----
    ('cave_shadow_n', 'wall__shadow_n.png'),
    ('cave_shadow_n_dark', 'wall__shadow_n_darker.png'),
    ('cave_shadow_w', 'wall__shadow_w.png'),
    ('cave_shadow_e', 'wall__shadow_e.png'),
    ('cave_shadow_nw', 'wall__shadow_nw.png'),
    ('cave_shadow_ne', 'wall__shadow_ne.png'),
    # ---- 바닥 ----
    *[(f'cave_floor_pebble_{i:02d}', f'floor__pebble_brown{i}.png') for i in range(9)],
    *[(f'cave_floor_moss_{i:02d}', f'floor__moss{i}.png') for i in range(4)],
    *[(f'cave_floor_bog_{i:02d}', f'floor__bog_green{i}.png') for i in range(4)],
    *[(f'cave_floor_blood_{i:02d}', f'floor__cobble_blood{i + 1}.png') for i in range(12)],
    *[(f'cave_floor_limestone_{i:02d}', f'floor__limestone{i}.png') for i in range(6)],
    ('cave_floor_crystal_00', 'floor__crystal_floor0.png'),
    ('cave_floor_crystal_01', 'floor__crystal_floor2.png'),
    ('cave_floor_crystal_02', 'floor__crystal_floor4.png'),
    *[(f'cave_slime_overlay_{d}', f'floor__slime_overlay_{d.upper()}.png')
      for d in ('e', 'n', 'ne', 'nw', 's', 'se', 'sw', 'w')],
    # ---- 물(심연 호수) ----
    ('cave_water_00', 'water__deep_water_murky.png'),
    ('cave_water_01', 'water__deep_water_murky2.png'),
    ('cave_water_deep_00', 'water__deep_water.png'),
    ('cave_water_deep_01', 'water__deep_water2.png'),
    ('cave_water_shallow_00', 'water__shallow_water_murky.png'),
    ('cave_water_shallow_01', 'water__shallow_water_murky2.png'),
    *[(f'cave_water_bord_{d}', f'water__murky_bord_{d}.png')
      for d in ('top', 'btm', 'lft', 'rgt', 'tl', 'tr', 'bl', 'br')],
    # ---- 관문/굴 ----
    ('cave_gate_broken_left', 'doors__gate_broken_left.png'),
    ('cave_gate_broken_middle', 'doors__gate_broken_middle.png'),
    ('cave_gate_broken_right', 'doors__gate_broken_right.png'),
    ('cave_arch_stone', 'gateways__stone_arch.png'),
    ('cave_arch_hell', 'gateways__stone_arch_hell.png'),
    ('cave_burrow', 'gateways__enter_lair.png'),
    # ---- 소품 ----
    ('cave_brazier_00', 'altars__makhleb_flame2.png'),
    ('cave_brazier_01', 'altars__makhleb_flame5.png'),
    ('cave_altar_slime', 'altars__jiyva02.png'),
    ('cave_altar_skulls', 'altars__kikubaaqudgha.png'),
    ('cave_statue_bust', 'statues__statue_demonic_bust.png'),
    ('cave_idol_gold', 'statues__orcish_idol.png'),
    ('cave_column_00', 'statues__crumbled_column_1.png'),
    ('cave_column_01', 'statues__crumbled_column_2.png'),
    ('cave_column_02', 'statues__crumbled_column_5.png'),
    ('cave_mould_00', 'root__mould_patch0.png'),
    ('cave_mould_01', 'root__mould_patch1.png'),
    ('cave_gold_00', 'item__gold_04.png'),
    ('cave_gold_01', 'item__gold_07.png'),
    ('cave_gold_02', 'item__gold_16.png'),
    ('cave_gold_03', 'item__gold_25.png'),
    # ---- 거미줄(deco 레이어용) ----
    ('cave_web_ne', 'traps__cobweb_NE.png'),
    ('cave_web_nw', 'traps__cobweb_NW.png'),
    ('cave_web_se', 'traps__cobweb_ES.png'),
    ('cave_web_sw', 'traps__cobweb_SW.png'),
]


# ---------------------------------------------------------------- PNG 입출력
# 의존성 없이 돌아가도록 zlib/struct로 직접 다룬다(RGBA 8비트만).
def read_png(path):
    raw = open(path, 'rb').read()
    assert raw[:8] == b'\x89PNG\r\n\x1a\n', path
    pos, w, h, data = 8, 0, 0, b''
    palette = trns = None
    color_type = bit_depth = None
    while pos < len(raw):
        (ln,) = struct.unpack('>I', raw[pos:pos + 4])
        typ = raw[pos + 4:pos + 8]
        chunk = raw[pos + 8:pos + 8 + ln]
        if typ == b'IHDR':
            w, h, bit_depth, color_type = struct.unpack('>IIBB', chunk[:10])
        elif typ == b'PLTE':
            palette = chunk
        elif typ == b'tRNS':
            trns = chunk
        elif typ == b'IDAT':
            data += chunk
        pos += 12 + ln
    pix = zlib.decompress(data)
    bpp = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[color_type]
    assert bit_depth == 8, f'{path}: bit depth {bit_depth}'
    stride = w * bpp
    out = bytearray(w * h * 4)
    prev = bytearray(stride)
    pos = 0
    for y in range(h):
        f = pix[pos]
        row = bytearray(pix[pos + 1:pos + 1 + stride])
        pos += 1 + stride
        if f == 1:
            for i in range(bpp, stride):
                row[i] = (row[i] + row[i - bpp]) & 255
        elif f == 2:
            for i in range(stride):
                row[i] = (row[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                a = row[i - bpp] if i >= bpp else 0
                row[i] = (row[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = row[i - bpp] if i >= bpp else 0
                b = prev[i]
                c = prev[i - bpp] if i >= bpp else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pred = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                row[i] = (row[i] + pred) & 255
        prev = row
        for x in range(w):
            o = (y * w + x) * 4
            if color_type == 6:
                out[o:o + 4] = row[x * 4:x * 4 + 4]
            elif color_type == 2:
                out[o:o + 3] = row[x * 3:x * 3 + 3]
                out[o + 3] = 255
            elif color_type == 3:
                idx = row[x]
                out[o:o + 3] = palette[idx * 3:idx * 3 + 3]
                out[o + 3] = trns[idx] if trns and idx < len(trns) else 255
            elif color_type == 0:
                out[o] = out[o + 1] = out[o + 2] = row[x]
                out[o + 3] = 255
            elif color_type == 4:
                out[o] = out[o + 1] = out[o + 2] = row[x * 2]
                out[o + 3] = row[x * 2 + 1]
    return w, h, out


def write_png(path, w, h, rgba):
    def chunk(typ, data):
        c = struct.pack('>I', len(data)) + typ + data
        return c + struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff)
    raw = b''.join(b'\x00' + bytes(rgba[y * w * 4:(y + 1) * w * 4]) for y in range(h))
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    open(path, 'wb').write(png)


def blit(dst, dw, src, sw, sh, dx, dy):
    for y in range(sh):
        do = ((dy + y) * dw + dx) * 4
        so = y * sw * 4
        dst[do:do + sw * 4] = src[so:so + sw * 4]


# ---------------------------------------------------------------- 기준 상태 복원
w, h, sheet = read_png(PNG)
assert w == COLUMNS * TILE
if h > BASE_HEIGHT:
    sheet = sheet[:w * BASE_HEIGHT * 4]
    h = BASE_HEIGHT
    print(f'PNG를 기준 높이 {BASE_HEIGHT}px로 되돌림')

tsx = open(TSX).read()
tsx = re.sub(r'\n  <tile id="(\d+)"[^/]*/>',
             lambda m: '' if int(m.group(1)) >= BASE_TILECOUNT else m.group(0), tsx)

# ---------------------------------------------------------------- 타일 덧붙이기
rows = (len(MANIFEST) + COLUMNS - 1) // COLUMNS
new_h = BASE_HEIGHT + rows * TILE
new_count = BASE_TILECOUNT + rows * COLUMNS   # 부분 행도 슬롯은 채워진 것으로 센다
new_sheet = bytearray(w * new_h * 4)
new_sheet[:len(sheet)] = sheet

gids = {}
entries = []
for i, (name, fname) in enumerate(MANIFEST):
    path = os.path.join(VENDOR, fname)
    tw, th, tp = read_png(path)
    assert (tw, th) == (TILE, TILE), f'{fname}: {tw}x{th}'
    tile_id = BASE_TILECOUNT + i
    r, c = divmod(i, COLUMNS)
    blit(new_sheet, w, tp, TILE, TILE, c * TILE, BASE_HEIGHT + r * TILE)
    gids[name] = tile_id + 1   # firstgid=1
    entries.append(f'  <tile id="{tile_id}" type="{name}"/>')

write_png(PNG, w, new_h, new_sheet)

tsx = re.sub(r'tilecount="\d+"', f'tilecount="{new_count}"', tsx)
tsx = re.sub(r'(<image source="town-32.png" width="\d+" height=")\d+(")',
             rf'\g<1>{new_h}\g<2>', tsx)
tsx = tsx.replace('</tileset>', '\n'.join(entries) + '\n</tileset>')
open(TSX, 'w').write(tsx)

json.dump(gids, open(OUT_GIDS, 'w'), indent=1, ensure_ascii=False)
print(f'{len(MANIFEST)}개 타일 추가: id {BASE_TILECOUNT}..{BASE_TILECOUNT + len(MANIFEST) - 1} '
      f'(tilecount {new_count}, 이미지 {w}x{new_h})')
print('wrote', PNG, TSX, OUT_GIDS)
