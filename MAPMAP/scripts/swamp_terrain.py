"""늪 지형 배치 공용 규칙 — 맵 생성기와 미리보기가 같이 쓴다.

재질은 칸이 아니라 꼭짓점((W+1)x(H+1))마다 정한다: GRASS / WATER / MUD.
한 칸의 바닥과 경계 덮개는 네 꼭짓점으로 정해진다(scripts/append-swamp-tiles.py 설명 참고).
"""
import json

GRASS, WATER, MUD = 0, 1, 2

_G = None


def gids():
    global _G
    if _G is None:
        _G = json.load(open('scripts/swamp-tile-gids.json', encoding='utf-8'))
    return _G


def h32(*vals):
    x = 2166136261
    for v in vals:
        x = ((x ^ (v & 0xFFFFFFFF)) * 16777619) & 0xFFFFFFFF
    return x / 0xFFFFFFFF


def cell_corners(vmat, x, y):
    return vmat[y][x], vmat[y][x + 1], vmat[y + 1][x], vmat[y + 1][x + 1]


def grass_mask(corners):
    return sum(bit for bit, m in zip((1, 2, 4, 8), corners) if m == GRASS)


def _is_diagonal(vmat, x, y):
    if x < 0 or y < 0 or y + 1 >= len(vmat) or x + 1 >= len(vmat[0]):
        return False
    return grass_mask(cell_corners(vmat, x, y)) in (6, 9)


def side_shift(vmat, kind, x, y, seed):
    """변 하나의 경계 위치(-1/0/+1). kind 'h' = (x,y)-(x+1,y), 'v' = (x,y)-(x,y+1).
    대각선 칸(마스크 6·9)에 붙은 변은 0 — 그 덮개는 가운데 하나뿐이다."""
    if kind == 'h':
        if _is_diagonal(vmat, x, y - 1) or _is_diagonal(vmat, x, y):
            return 0
    else:
        if _is_diagonal(vmat, x - 1, y) or _is_diagonal(vmat, x, y):
            return 0
    return int(h32(1 if kind == 'h' else 2, x, y, seed) * 3) - 1


def cell_tiles(vmat, x, y, seed=0):
    """(바닥 gid, 덮개 gid 또는 0). 풀만인 칸은 (풀 gid, 0) — 풀 변형은 생성기가 고른다."""
    G = gids()
    c = cell_corners(vmat, x, y)
    mats = set(c)
    if mats == {GRASS}:
        return None, 0
    under = WATER if WATER in mats else MUD
    base = G['water_fill'] if under == WATER else G['mud']
    mask = grass_mask(c)
    if mask == 0:
        return base, 0
    shifts = {
        'n': side_shift(vmat, 'h', x, y, seed),
        'e': side_shift(vmat, 'v', x + 1, y, seed),
        's': side_shift(vmat, 'h', x, y + 1, seed),
        'w': side_shift(vmat, 'v', x, y, seed),
    }
    tl, tr, bl, br = [m == GRASS for m in c]
    crossing = {'n': tl != tr, 'e': tr != br, 's': bl != br, 'w': tl != bl}
    key = ''.join(str((shifts[k] if crossing[k] else 0) + 1) for k in 'nesw')
    kind = 'water' if under == WATER else 'mud'
    return base, G[f'bank_{kind}'][f'{mask}:{key}']
