"""town-32 타일셋에 잔디↔흙 / 잔디↔자갈 전환(오토타일) 타일을 덧붙인다.

기존 타일(g517 잔디, g507 흙, g515 자갈)에서 파생시키므로 팔레트·픽셀 스케일이 원본과 완전히 같다.
PNG 뒤에 행을 추가하고 .tsx의 tilecount/이미지 높이만 올리므로 기존 타일 id는 밀리지 않는다
(대장간·장비창 등 타일 id로 슬라이싱하는 다른 화면에 영향 없음).

경계선은 타일 모서리에서 항상 같은 높이(BASE)를 갖도록 만들어, 이웃 타일과 이어붙여도 선이 끊기지 않는다.
"""
import math
import re
from PIL import Image

TSX = 'src/games/my-sample-rpg/assets/tilesets/town-32.tsx'
PNG = 'src/games/my-sample-rpg/assets/tilesets/town-32.png'
COLS = 8
T = 32

GRASS, DIRT, COBBLE = 517, 507, 515

BASE = 3      # 타일 모서리에서의 잔디 침범 깊이(px) — 이웃과 반드시 일치해야 하는 값
AMP = 4       # 변 가운데의 추가 깊이
SIDES = ['n', 'e', 's', 'w']


def h32(*vals):
    """결정적 의사난수 [0,1) — 같은 입력이면 항상 같은 값."""
    x = 2166136261
    for v in vals:
        x = ((x ^ (v & 0xFFFFFFFF)) * 16777619) & 0xFFFFFFFF
    return x / 0xFFFFFFFF


def depth(u, salt):
    """변을 따라 u∈[0,1] 위치에서의 잔디 침범 깊이. u=0,1에서 BASE로 수렴한다."""
    bump = math.sin(math.pi * min(max(u, 0.0), 1.0)) ** 1.4
    jitter = (h32(int(u * 31), salt) - 0.5) * 2.0
    return BASE + AMP * bump + jitter


def side_mask(side, salt):
    """해당 변에서 잔디가 덮는 픽셀 집합."""
    cells = set()
    for a in range(T):
        u = a / (T - 1)
        d = depth(u, salt)
        for b in range(T):
            if b < d:
                if side == 'n':
                    cells.add((a, b))
                elif side == 's':
                    cells.add((a, T - 1 - b))
                elif side == 'w':
                    cells.add((b, a))
                else:
                    cells.add((T - 1 - b, a))
    return cells


def corner_mask(cx, cy, salt):
    """대각선 방향에만 잔디가 있을 때 모서리에 얹는 작은 쐐기."""
    cells = set()
    r = BASE + 3
    for y in range(T):
        for x in range(T):
            px = x if cx == 0 else (T - 1 - x)
            py = y if cy == 0 else (T - 1 - y)
            if px * px + py * py <= r * r + (h32(x, y, salt) - 0.5) * 6:
                cells.add((x, y))
    return cells


def build(base_img, over_img, cells, salt):
    """base 위에 over(잔디)를 cells 모양으로 얹고, 경계 바깥 2px에 디더 픽셀을 뿌린다."""
    out = base_img.copy()
    op = over_img.load()
    op_out = out.load()
    for (x, y) in cells:
        op_out[x, y] = op[x, y]
    # 경계 바깥으로 튀는 풀 몇 픽셀 — 칼로 자른 듯한 선을 흐린다
    for y in range(T):
        for x in range(T):
            if (x, y) in cells:
                continue
            near = any((x + dx, y + dy) in cells
                       for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2))
            if near and h32(x, y, salt, 7) < 0.30:
                op_out[x, y] = op[x, y]
    return out


def main():
    sheet = Image.open(PNG).convert('RGBA')

    def tile(gid):
        i = gid - 1
        return sheet.crop(((i % COLS) * T, (i // COLS) * T,
                           (i % COLS) * T + T, (i // COLS) * T + T))

    grass = tile(GRASS)
    pairs = [('dirt', tile(DIRT)), ('cobble', tile(COBBLE))]

    generated = []   # (type_name, image)
    for pair_name, base in pairs:
        salt_base = 101 if pair_name == 'dirt' else 202
        # 4방향 비트마스크 1..15 (0 = 원본 그대로라 불필요)
        for mask in range(1, 16):
            cells = set()
            for bit, side in enumerate(SIDES):
                if mask & (1 << bit):
                    cells |= side_mask(side, salt_base + bit)
            generated.append((f'edge_{pair_name}_grass_{mask:02d}',
                              build(base, grass, cells, salt_base + mask)))
        # 대각 모서리 전용 4종
        for ci, (cx, cy) in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]):
            cells = corner_mask(cx, cy, salt_base + 50 + ci)
            generated.append((f'edge_{pair_name}_grass_corner_{ci}',
                              build(base, grass, cells, salt_base + 60 + ci)))

    old_count = 560
    assert sheet.size == (COLS * T, (old_count // COLS) * T), sheet.size

    new_rows = (len(generated) + COLS - 1) // COLS
    out = Image.new('RGBA', (COLS * T, sheet.size[1] + new_rows * T), (0, 0, 0, 0))
    out.paste(sheet, (0, 0))
    for n, (_, im) in enumerate(generated):
        idx = old_count + n
        out.paste(im, ((idx % COLS) * T, (idx // COLS) * T))
    out.save(PNG)

    # .tsx 갱신 — tilecount / 이미지 높이 / 새 tile 엔트리
    tsx = open(TSX).read()
    new_count = old_count + new_rows * COLS
    tsx = tsx.replace(f'tilecount="{old_count}"', f'tilecount="{new_count}"')
    tsx = re.sub(r'(<image source="town-32.png" width="256" height=")\d+(")',
                 rf'\g<1>{out.size[1]}\g<2>', tsx)
    entries = ''.join(f'  <tile id="{old_count + n}" type="{name}"/>\n'
                      for n, (name, _) in enumerate(generated))
    tsx = tsx.replace('</tileset>', entries + '</tileset>')
    open(TSX, 'w').write(tsx)

    print(f'타일 {len(generated)}개 추가 → tilecount {old_count} → {new_count}, '
          f'이미지 높이 {sheet.size[1]} → {out.size[1]}')
    first = old_count + 1
    print(f'  흙  가장자리 gid {first}..{first + 18}')
    print(f'  자갈 가장자리 gid {first + 19}..{first + 37}')


if __name__ == '__main__':
    main()
