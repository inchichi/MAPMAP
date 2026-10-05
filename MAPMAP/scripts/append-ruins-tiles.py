"""2장 신전 타일을 town-32 시트 맨 아래에 덧붙인다 (덧붙이기 사슬의 마지막 단계).

사슬 순서: generate-transition-tiles → append-cave-tiles → append-tree-variants → append-swamp-tiles → **이 스크립트**.
앞 단계를 다시 돌리면 시트가 잘리므로 이 스크립트도 다시 돌린다. 기준(BASE_SLOTS)보다 아래는 지우고
다시 붙이므로 몇 번 돌려도 결과가 같다(멱등).

  ruins_stele_lit_r{0,1}c{0,1}  빛나는 봉인 비석(2x2) — 늪 룬 비석(swamp_stele_*)의 새긴 글자를 푸르게 밝히고
                                둘레 판에 은은한 빛을 번지게 한다. 봉인을 밝힌 뒤(c2-06·c2-07) 이 그림으로 바꿔 놓는다.
  ruins_thorns_{0,1}            독 가시덩굴(c2-05 신전 길을 막는 것) — 마을 둥근 덤불을 독에 물든 검보랏빛으로 바꾸고
                                바깥쪽으로 뼛빛 가시를 세운다. 그냥 덤불로 보이면 "지나갈 수 없는 길"로 읽히지 않았다.

출력: town-32.png / town-32.tsx / rendering/townTilesetImageSize.ts / scripts/ruins-tile-gids.json
"""
import colorsys
import json
import math
import re
import sys

from PIL import Image

TSX = 'src/games/my-sample-rpg/assets/tilesets/town-32.tsx'
PNG = 'src/games/my-sample-rpg/assets/tilesets/town-32.png'
SIZE_TS = 'src/games/my-sample-rpg/rendering/townTilesetImageSize.ts'
OUT_GIDS = 'scripts/ruins-tile-gids.json'
COLUMNS, TILE = 8, 32
PREV_TILECOUNT = 1790          # append-swamp-tiles.py 가 끝낸 상태
BASE_SLOTS = 1792              # 그 시트의 칸 수(224행) — 새 타일은 다음 행부터
TYPE_PREFIX = 'ruins_'

RUNE = (126, 112, 104)         # 비석 판에 새긴 글자 색
FACE = (49, 49, 62)            # 글자가 새겨진 어두운 판
RUNE_LIT = (150, 240, 255)
GLOW = (64, 118, 140)


def lit_stele(stele):
    """2x2(64px) 비석 그림에서 글자를 밝히고, 글자 둘레 판 칸에 빛 번짐을 칠한다."""
    out = stele.copy()
    px = stele.load()
    op = out.load()
    runes = {(x, y) for y in range(stele.height) for x in range(stele.width) if px[x, y][:3] == RUNE}
    for (x, y) in runes:
        op[x, y] = RUNE_LIT + (255,)
    for y in range(stele.height):
        for x in range(stele.width):
            if px[x, y][:3] != FACE:
                continue
            near = sum((x + dx, y + dy) in runes for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2))
            if near:
                t = min(1.0, near / 6)
                op[x, y] = tuple(round(FACE[k] + (GLOW[k] - FACE[k]) * t) for k in range(3)) + (255,)
    return out


BUSH = 1150                    # town_prop_bush_round
THORN = (214, 200, 170)


def thorns(bush, salt):
    """덤불을 검보랏빛으로 물들이고 테두리 바깥으로 짧은 가시를 세운다."""
    out = bush.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            nr, ng, nb = colorsys.hsv_to_rgb(0.83, min(1.0, s * 0.55 + 0.12), v * 0.62)
            px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    src = bush.load()
    edge = [(x, y) for y in range(1, bush.height - 1) for x in range(1, bush.width - 1)
            if src[x, y][3] and any(src[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    cx = sum(x for x, _ in edge) / len(edge)
    cy = sum(y for _, y in edge) / len(edge)
    for i, (x, y) in enumerate(edge):
        if (i * 7 + salt) % 9:
            continue
        dx, dy = x - cx, y - cy
        n = math.hypot(dx, dy) or 1
        for step in (1, 2, 3):
            tx, ty = round(x + dx / n * step), round(y + dy / n * step)
            if 0 <= tx < out.width and 0 <= ty < out.height and px[tx, ty][3] == 0:
                px[tx, ty] = THORN + (255,) if step < 3 else (150, 132, 110, 255)
    return out


def main():
    sheet = Image.open(PNG).convert('RGBA')
    tsx = open(TSX, encoding='utf-8').read()
    count = int(re.search(r'tilecount="(\d+)"', tsx).group(1))
    if count < PREV_TILECOUNT:
        sys.exit(f'tilecount {count} < {PREV_TILECOUNT}: append-swamp-tiles.py 를 먼저 돌린다')
    sheet = sheet.crop((0, 0, COLUMNS * TILE, (BASE_SLOTS // COLUMNS) * TILE))

    def tile_of(gid):
        t = gid - 1
        return sheet.crop(((t % COLUMNS) * TILE, (t // COLUMNS) * TILE,
                           (t % COLUMNS) * TILE + TILE, (t // COLUMNS) * TILE + TILE))

    new_tiles = []

    def add(name, img):
        new_tiles.append((name, img))
        return BASE_SLOTS + len(new_tiles)

    swamp = json.load(open('scripts/swamp-tile-gids.json', encoding='utf-8'))
    stele = Image.new('RGBA', (TILE * 2, TILE * 2), (0, 0, 0, 0))
    for r in range(2):
        for c in range(2):
            stele.alpha_composite(tile_of(swamp['stele'][r][c]), (c * TILE, r * TILE))
    lit = lit_stele(stele)
    gids = {'stele_lit': [[add(f'ruins_stele_lit_r{r}c{c}', lit.crop((c * TILE, r * TILE, (c + 1) * TILE, (r + 1) * TILE)))
                           for c in range(2)] for r in range(2)]}
    bush = tile_of(BUSH)
    gids['thorns'] = [add(f'ruins_thorns_{i}', thorns(bush if i == 0 else bush.transpose(Image.FLIP_LEFT_RIGHT), i * 4))
                      for i in range(2)]

    total_slots = BASE_SLOTS + len(new_tiles)
    rows_total = -(-total_slots // COLUMNS)
    out = Image.new('RGBA', (COLUMNS * TILE, rows_total * TILE), (0, 0, 0, 0))
    out.paste(sheet, (0, 0))
    for i, (_name, img) in enumerate(new_tiles):
        t = BASE_SLOTS + i
        out.paste(img, ((t % COLUMNS) * TILE, (t // COLUMNS) * TILE))
    out.save(PNG)

    tsx = re.sub(r'\s*<tile id="\d+" type="' + TYPE_PREFIX + r'[^"]*"/>', '', tsx)
    tsx = re.sub(r'tilecount="\d+"', f'tilecount="{total_slots}"', tsx)
    tsx = re.sub(r'(<image source="town-32.png" width="\d+" height=")\d+(")', rf'\g<1>{out.height}\2', tsx)
    lines = [f'  <tile id="{BASE_SLOTS + i}" type="{name}"/>' for i, (name, _img) in enumerate(new_tiles)]
    tsx = tsx.replace('</tileset>', '\n'.join(lines) + '\n</tileset>')
    open(TSX, 'w', encoding='utf-8', newline='\n').write(tsx)

    size_ts = open(SIZE_TS, encoding='utf-8').read()
    size_ts = re.sub(r'TOWN_TILESET_IMAGE_HEIGHT = \d+', f'TOWN_TILESET_IMAGE_HEIGHT = {out.height}', size_ts)
    open(SIZE_TS, 'w', encoding='utf-8', newline='\n').write(size_ts)

    json.dump(gids, open(OUT_GIDS, 'w', encoding='utf-8', newline='\n'), indent=1)
    print(f'ruins tiles {len(new_tiles)} (gid {BASE_SLOTS + 1}..{total_slots}), sheet height {out.height}')


if __name__ == '__main__':
    main()
