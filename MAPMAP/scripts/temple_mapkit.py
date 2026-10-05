"""잠긴 신전(1층·2층) 맵 생성기 공용 도구 — 방·복도를 칸 격자에 파고, 칸 재질 → 꼭짓점 다수결 → LPC 전환
타일로 바닥을 깐다(generate-crystal-mine.py 와 같은 엔진). 출력·검증은 swamp_mapkit.SwampMap 을 그대로 쓴다.

칸 문자: '#' 벽  '.' 돌바닥  '~' 물  'W' 깊은 물. 물가 한 칸은 자동으로 흙 둑(돌바닥과 물 사이에 맞는 전환
타일이 없어 둑을 거친다). 벽은 바닥에서 두 칸까지 어두운 바위, 그 너머는 검은 바위.
"""
import json
import math
from collections import deque

from swamp_mapkit import INVISIBLE_BLOCK, SwampMap

G = json.load(open('scripts/lpc-cave-gids.json', encoding='utf-8'))
FLOOR, BANK, WATER, DEEP, WALL, VOID = 'Mudstone_Gray', 'Dirt_Tan', 'Water', 'Water_Deep', 'Rock_Dark', 'Rock_Black'
PRIORITY = [BANK, WATER, DEEP, FLOOR, WALL, VOID]   # 전환 타일 이름(cave_edge_<앞>__<뒤>)의 앞뒤 순서
PRI = {m: i for i, m in enumerate(PRIORITY)}
FALLBACK = {DEEP: WATER, WATER: BANK, FLOOR: BANK, WALL: VOID}
SOLID = {WATER, DEEP, WALL, VOID}


def lpc(name):
    return G[name]


class TempleMap(SwampMap):
    def __init__(self, w, h, seed, biome=None):
        super().__init__(w, h, seed, biome)
        self.cell = [['#'] * w for _ in range(h)]

    # ---------------------------------------------------------- 파기
    def carve(self, x0, y0, x1, y1, ch='.'):
        """사각형(양 끝 포함)."""
        for y in range(max(0, y0), min(self.H, y1 + 1)):
            for x in range(max(0, x0), min(self.W, x1 + 1)):
                self.cell[y][x] = ch

    def carve_ellipse(self, cx, cy, rx, ry, ch='.'):
        for y in range(self.H):
            for x in range(self.W):
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1:
                    self.cell[y][x] = ch

    def at(self, x, y):
        return self.cell[y][x] if self.inb(x, y) else '#'

    def is_open(self, x, y):
        return self.at(x, y) != '#'

    # ---------------------------------------------------------- 바닥
    def build(self):
        W, H = self.W, self.H
        mat = [[FLOOR] * W for _ in range(H)]
        for y in range(H):
            for x in range(W):
                c = self.cell[y][x]
                if c == '#':
                    near = any(self.at(x + dx, y + dy) != '#' for dx in range(-2, 3) for dy in range(-2, 3))
                    mat[y][x] = WALL if near else VOID
                elif c == '~':
                    mat[y][x] = WATER
                elif c == 'W':
                    mat[y][x] = DEEP
        # 물가 둑: 물에 닿은 돌바닥 칸은 흙
        for y in range(H):
            for x in range(W):
                if mat[y][x] == FLOOR and any(
                        0 <= x + dx < W and 0 <= y + dy < H and mat[y + dy][x + dx] in (WATER, DEEP)
                        for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                    mat[y][x] = BANK
        self.mat = mat

        def corner(cx, cy):
            votes = {}
            for dx, dy in ((-1, -1), (0, -1), (-1, 0), (0, 0)):
                x, y = cx + dx, cy + dy
                m = mat[y][x] if 0 <= x < W and 0 <= y < H else VOID
                votes[m] = votes.get(m, 0) + 1
            return max(votes, key=lambda m: (votes[m], PRI[m]))

        lat = [[corner(cx, cy) for cx in range(W + 1)] for cy in range(H + 1)]

        def legal(tl, tr, bl, br):
            mats = {tl, tr, bl, br}
            if len(mats) == 1:
                return f'cave_fill_{tl}_00' in G
            if len(mats) == 2:
                a, b = sorted(mats, key=lambda m: PRI[m])
                mask = sum(1 << i for i, c in enumerate((tl, tr, bl, br)) if c == b)
                return f'cave_edge_{a}__{b}_m{mask:02d}' in G
            return False

        for _sweep in range(60):
            changed = 0
            for y in range(H):
                for x in range(W):
                    corners = [(y, x), (y, x + 1), (y + 1, x), (y + 1, x + 1)]
                    if legal(*(lat[cy][cx] for cy, cx in corners)):
                        continue
                    movable = [c for c in corners if lat[c[0]][c[1]] in FALLBACK]
                    cy, cx = max(movable, key=lambda c: PRI[lat[c[0]][c[1]]])
                    lat[cy][cx] = FALLBACK[lat[cy][cx]]
                    changed += 1
            if not changed:
                break
        else:
            raise SystemExit('꼭짓점 조합 합법화가 수렴하지 않음')

        # 물가 흙둑이 벽에 닿으면(흙↔어두운 바위 전환 타일이 없다) 합법화가 벽을 검은 바위로, 다시 돌바닥을 흙으로
        # 강등하며 벽 둘레 전체에 흙띠가 번진다. 물은 벽에서 한 칸 이상 떼어 둔다 — 번졌으면 알린다.
        wet = {(x, y) for y in range(H) for x in range(W) if mat[y][x] in (WATER, DEEP)}
        spread = [(cx, cy) for cy in range(H + 1) for cx in range(W + 1) if lat[cy][cx] in (BANK, VOID)
                  and lat[cy][cx] != corner(cx, cy)
                  and not any((cx + dx, cy + dy) in wet for dx in range(-3, 3) for dy in range(-3, 3))]
        if spread:
            raise SystemExit(f'!! 물가 흙이 벽 둘레로 번졌다(꼭짓점 {len(spread)}개, 예: {spread[:4]}) — 물을 벽에서 한 칸 더 떼라')
        for y in range(H):
            for x in range(W):
                tl, tr, bl, br = lat[y][x], lat[y][x + 1], lat[y + 1][x], lat[y + 1][x + 1]
                mats = {tl, tr, bl, br}
                if len(mats) == 1:
                    variants = [k for k in (f'cave_fill_{tl}_{i:02d}' for i in (0, 2, 3)) if k in G]
                    name = self.rnd.choices(variants, weights=[8] + [1] * (len(variants) - 1))[0]
                else:
                    a, b = sorted(mats, key=lambda m: PRI[m])
                    mask = sum(1 << i for i, c in enumerate((tl, tr, bl, br)) if c == b)
                    name = f'cave_edge_{a}__{b}_m{mask:02d}'
                self.set('ground', x, y, G[name])
                c = self.cell[y][x]
                if c == '#':
                    self.set('object', x, y, INVISIBLE_BLOCK)
                elif c in '~W':
                    self.water_cells.add((x, y))
                    # 그림이 거의 둑(물 꼭짓점이 하나 이하)이고 바닥에 닿아 있으면 막지 않는다(투명 벽 방지)
                    touches_floor = any(self.at(x + dx, y + dy) == '.' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                    if sum(m in SOLID for m in (tl, tr, bl, br)) >= 2 or not touches_floor:
                        self.set('object', x, y, INVISIBLE_BLOCK)

    # ---------------------------------------------------------- 소품
    def prop(self, name, x, y, cols=1, rows=1, solid_rows=1, layer_override=None):
        """LPC 소품(cave_prop_<name>_r<r>c<c>). (x, y) = 왼쪽 아래 칸. 아랫줄 solid_rows 는 충돌."""
        for r in range(rows):
            for c in range(cols):
                key = f'cave_prop_{name}_r{r}c{c}' if rows * cols > 1 else f'cave_prop_{name}'
                ty = y - (rows - 1) + r
                layer = layer_override or ('object' if r >= rows - solid_rows else 'object_upper')
                self.set(layer, x + c, ty, G[key])
                self.reserved.add((x + c, ty))

    def decal(self, name, x, y):
        """바닥 무늬(충돌 없음)."""
        if not self.get('shadow_lower', x, y):
            self.set('shadow_lower', x, y, G[name])

    # ---------------------------------------------------------- 검증 보조
    def seal_unreachable(self, start):
        """걸어서 못 가는 열린 칸(물 건너 둑 등)은 투명 충돌로 막는다 — 닿을 수 없으니 투명 벽이 아니다."""
        walls, seen = self.flood(start)
        sealed = 0
        for y in range(self.H):
            for x in range(self.W):
                if (x, y) not in walls and (x, y) not in seen:
                    self.set('object', x, y, INVISIBLE_BLOCK)
                    sealed += 1
        if sealed:
            print(f'갈 수 없는 칸 {sealed}개를 막음')

    def ascii(self, marks=()):
        marks = dict(marks)
        for y in range(self.H):
            print(f'{y:2} ' + ''.join(marks.get((x, y)) or ('#' if self.get('object', x, y) else
                                                             '^' if self.get('object_upper', x, y) else
                                                             '~' if (x, y) in self.water_cells else '.')
                                      for x in range(self.W)))


def stele_objects(prefix, x, y, quest_id, unlit_lines, lit_lines, first_id):
    """2x2 봉인 비석을 칸마다 오브젝트로(밝히기 전·후를 퀘스트로 바꿔 낀다). (x, y) = 왼쪽 위 칸.
    상호작용(대화 목표)은 왼쪽 아래 칸의 '<prefix>' 이다. 아랫줄 충돌은 object 레이어가 맡는다."""
    from swamp_mapkit import character
    out = []
    oid = first_id
    for r in range(2):
        for c in range(2):
            for lit, gate in ((False, 'quest.hiddenWhenCompleted'), (True, 'quest.requiresCompleted')):
                name = (prefix if (r, c) == (1, 0) else f'{prefix}_r{r}c{c}') + ('_lit' if lit else '')
                kind = f'ruins_stele_lit_r{r}c{c}' if lit else f'swamp_stele_r{r}c{c}'
                props = [('blocksMovement', 'bool', 'true' if r == 1 else 'false'), (gate, '', quest_id),
                         ('type', '', kind)]
                if (r, c) == (1, 0):
                    props += [('controller.dialogueLines', 'list', lit_lines if lit else unlit_lines),
                              ('controller.scriptId', '', 'vn-dialogue'), ('displayText', '', '봉인 비석')]
                out.append(character(oid, name, x + c, y + r, props))
                oid += 1
    return out


def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


__all__ = ['TempleMap', 'stele_objects', 'lpc', 'deque', 'dist']
