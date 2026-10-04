"""LPC 동굴 타일(벤더링된 assets/tilesets/lpc/)을 town-32 타일셋에 덧붙인다.

generate-transition-tiles.py가 세운 규약을 따른다: 기존 타일 id는 절대 건드리지
않고(다른 화면이 이 시트를 id로 자른다), PNG 아래에 행을 추가하고 tsx의
tilecount/이미지 높이만 늘린다.

원본: OpenGameArt LPC 계열 팩(자세한 출처/라이선스는 assets/tilesets/lpc/LICENSE.txt).
선별·재배열된 시트와 매니페스트는 assets/tilesets/lpc/ 에 벤더링되어 있어
오프라인에서도 재실행 가능하다.

  sheet__terrain.png : 전환(코너 재질 조합)·채움 타일. 이름 규칙:
      cave_fill_{재질}_{i}                — 채움 변형
      cave_edge_{A}__{B}_m{mask}[_vK]    — 코너 마스크 전환(A=낮은 우선순위,
                                           mask 비트: 1=좌상 2=우상 4=좌하 8=우하 → B)
  sheet__props.png   : 소품/데칼/그림자 (cave_prop_*, cave_shadow_*)

멱등: tsx tilecount가 기준(600)보다 크면 먼저 기준 상태로 되돌린 뒤 다시 붙인다.
실행 후 scripts/lpc-cave-gids.json 에 {type이름: gid} 매핑을 기록한다 —
generate-cave.py가 이 파일을 읽는다.
"""
import json
import os
import re
import struct
import zlib

TSX = 'src/games/my-sample-rpg/assets/tilesets/town-32.tsx'
PNG = 'src/games/my-sample-rpg/assets/tilesets/town-32.png'
VENDOR = 'src/games/my-sample-rpg/assets/tilesets/lpc'
OUT_GIDS = 'scripts/lpc-cave-gids.json'
SIZE_TS = 'src/games/my-sample-rpg/rendering/townTilesetImageSize.ts'

BASE_TILECOUNT = 600     # 전환 타일까지 포함한 기준 상태
BASE_HEIGHT = 2400
COLUMNS = 8
TILE = 32


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
            w, h, bit_depth, color_type, _comp, _filt, interlace = struct.unpack(
                '>IIBBBBB', chunk[:13])
            # Adam7 인터레이스는 스캔라인 순서가 달라 이 디코더로는 쓰레기가 나온다.
            assert interlace == 0, f'{path}: 인터레이스 PNG는 지원하지 않는다'
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


def blit(dst, dw, src, sw, sx, sy, dx, dy):
    for y in range(TILE):
        do = ((dy + y) * dw + dx) * 4
        so = ((sy + y) * sw + sx) * 4
        dst[do:do + TILE * 4] = src[so:so + TILE * 4]


# ---------------------------------------------------------------- 기준 상태 복원
w, h, sheet = read_png(PNG)
assert w == COLUMNS * TILE
if h > BASE_HEIGHT:
    sheet = sheet[:w * BASE_HEIGHT * 4]
    h = BASE_HEIGHT
    print(f'PNG를 기준 높이 {BASE_HEIGHT}px로 되돌림')
assert h == BASE_HEIGHT, (
    f'시트 높이가 {h}px다. 먼저 scripts/generate-transition-tiles.py를 실행해 '
    f'{BASE_HEIGHT}px 기준 상태를 만들 것')

tsx = open(TSX, encoding='utf-8').read()
tsx_count = int(re.search(r'tilecount="(\d+)"', tsx).group(1))
assert tsx_count >= BASE_TILECOUNT, (
    f'tsx tilecount={tsx_count} < {BASE_TILECOUNT}: 전환 타일이 빠진 상태다')
tsx = re.sub(r'\n  <tile id="(\d+)"[^/]*/>',
             lambda m: '' if int(m.group(1)) >= BASE_TILECOUNT else m.group(0), tsx)

# ---------------------------------------------------------------- 타일 덧붙이기
manifest = json.load(open(os.path.join(VENDOR, 'manifest.json'), encoding='utf-8'))
sheets = {}
for entry in manifest:
    if entry['sheet'] not in sheets:
        sheets[entry['sheet']] = read_png(os.path.join(VENDOR, entry['sheet']))

rows = (len(manifest) + COLUMNS - 1) // COLUMNS
new_h = BASE_HEIGHT + rows * TILE
new_count = BASE_TILECOUNT + rows * COLUMNS   # 부분 행도 슬롯은 채워진 것으로 센다
new_sheet = bytearray(w * new_h * 4)
new_sheet[:len(sheet)] = sheet

gids = {}
entries = []
for i, entry in enumerate(manifest):
    sw_, sh_, spx = sheets[entry['sheet']]
    scols = sw_ // TILE
    sx = (entry['index'] % scols) * TILE
    sy = (entry['index'] // scols) * TILE
    assert sy + TILE <= sh_, entry
    tile_id = BASE_TILECOUNT + i
    r, c = divmod(i, COLUMNS)
    blit(new_sheet, w, spx, sw_, sx, sy, c * TILE, BASE_HEIGHT + r * TILE)
    name = entry['name']
    assert name not in gids, f'이름 중복: {name}'
    gids[name] = tile_id + 1   # firstgid=1
    entries.append(f'  <tile id="{tile_id}" type="{name}"/>')

write_png(PNG, w, new_h, new_sheet)

tsx = re.sub(r'tilecount="\d+"', f'tilecount="{new_count}"', tsx)
tsx = re.sub(r'(<image source="town-32.png" width="\d+" height=")\d+(")',
             rf'\g<1>{new_h}\g<2>', tsx)
tsx = tsx.replace('</tileset>', '\n'.join(entries) + '\n</tileset>')
open(TSX, 'w', encoding='utf-8', newline='\n').write(tsx)

# 런타임 UI(인벤토리/장비/상점 아이콘)는 시트 전체를 CSS로 스케일해 잘라 쓰므로
# 높이가 틀리면 아이콘이 눌린 채 엉뚱한 타일을 가리킨다. 여기서 같이 갱신한다.
size_ts = open(SIZE_TS, encoding='utf-8').read()
size_ts = re.sub(r'(TOWN_TILESET_IMAGE_WIDTH = )\d+', rf'\g<1>{w}', size_ts)
size_ts = re.sub(r'(TOWN_TILESET_IMAGE_HEIGHT = )\d+', rf'\g<1>{new_h}', size_ts)
open(SIZE_TS, 'w', encoding='utf-8', newline='\n').write(size_ts)

json.dump(gids, open(OUT_GIDS, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)
print(f'{len(manifest)}개 타일 추가: id {BASE_TILECOUNT}..{BASE_TILECOUNT + len(manifest) - 1} '
      f'(tilecount {new_count}, 이미지 {w}x{new_h})')
print('wrote', PNG, TSX, SIZE_TS, OUT_GIDS)
