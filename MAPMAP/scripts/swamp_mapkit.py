"""2장 늪 지역 맵 생성기 공용 도구 — 지형 깔기, 나무 심기, 물가 장식, 가장자리 막기, 검증, TMX 저장.

윗물길(generate-upstream-waterway.py)과 갈대골(generate-reed-village.py)이 같이 쓴다.
지형 규칙은 swamp_terrain.py(꼭짓점 재질 → 바닥·경계 덮개). 원칙(1장 생성기와 같음):
  * object 레이어의 0 이 아닌 칸이 벽이다.
  * 투명 충돌(302)은 물 위와, 나무·수관으로 덮인 맵 가장자리에만 쓴다. 빈 땅을 막을 땐 덤불처럼
    눈에 보이는 것을 둔다.
  * 나무는 위(뒤) 행부터 심고, 겹치는 앞 나무는 deco 레이어에 그려 위에 오게 한다.
"""
import json
import math
import re
from collections import deque

import swamp_terrain as st

LAYER_NAMES = ['ground', 'shadow_lower', 'object', 'shadow_upper', 'object_upper', 'deco', 'roof']
FIRST_LAYER_ID = 10
TSX = 'src/games/my-sample-rpg/assets/tilesets/town-32.tsx'

S = st.gids()
LPC = json.load(open('scripts/lpc-cave-gids.json', encoding='utf-8'))
INVISIBLE_BLOCK = 302
BUSHES = [1150, 1151, 1152]
ROCKS = [527, 528]
STUMPS = [463, 464]
CATTAIL = (LPC['town_prop_cattail_r0c0'], LPC['town_prop_cattail_r1c0'])
LOG_SINGLE = 1189
HOLE = 3   # 꼭짓점 재질(물 속 구멍)
HOLE_FILL = LPC['cave_fill_Hole_Black_00']
DEAD_ORDER = [0, 3, 4, 5, 6, 2, 1]


def catmull(points, steps_per_unit=6):
    """Catmull-Rom 곡선 위 점들(계단 없는 굽은 길·물길)."""
    pts = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        steps = max(4, int(math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * steps_per_unit))
        for s in range(steps + 1):
            t = s / steps
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2
                                    + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3) for k in (0, 1)))
    return out


def dist_to_path(path, x, y):
    return min(math.hypot(x - px, y - py) for px, py in path)


def wobble(x, y, salt):
    return (st.h32(int(x * 3), int(y * 3), salt) - 0.5) * 0.5


def xml_escape(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def props_xml(props):
    out = []
    for pname, ptype, pval in props:
        if ptype == 'list':
            out.append(f'    <property name="{pname}" type="list">')
            out += [f'     <item value="{xml_escape(v)}"/>' for v in pval]
            out.append('    </property>')
            continue
        t = f' type="{ptype}"' if ptype else ''
        out.append(f'    <property name="{pname}"{t} value="{xml_escape(str(pval))}"/>')
    return out


def character(oid, name, tx, ty, props):
    """칸 (tx, ty)에 서는 캐릭터·소품(x = 칸 중심, y = 칸 바닥)."""
    return '\n'.join([f'  <object id="{oid}" name="{name}" type="character" x="{tx * 32 + 16}" y="{ty * 32 + 32}" '
                      f'width="32" height="32">', '   <properties>'] + props_xml(props) +
                     ['   </properties>', '  </object>'])


def portal(oid, name, x, y, w, h, props):
    """포탈은 왼쪽 위 기준."""
    return '\n'.join([f'  <object id="{oid}" name="{name}" type="portal" x="{x * 32}" y="{y * 32}" '
                      f'width="{w * 32}" height="{h * 32}">', '   <properties>'] + props_xml(props) +
                     ['   </properties>', '  </object>'])


def npc(oid, name, tx, ty, display, appearance, lines, extra=()):
    """대화(vn-dialogue)하는 사람."""
    return character(oid, name, tx, ty, [
        ('blocksMovement', 'bool', 'true'),
        ('controller.dialogueLines', 'list', lines),
        ('controller.scriptId', '', 'vn-dialogue'),
        ('displayText', '', display),
        ('type', '', appearance)] + list(extra))


def monster(oid, name, tx, ty, kind, level):
    return character(oid, name, tx, ty, [('blocksMovement', 'bool', 'true'), ('monster.level', 'int', level),
                                         ('type', '', kind)])


def waystone(oid, waystone_id, tx, ty):
    """귀환 표지석(waystones.ts) — (tx, ty) 가 오벨리스크 밑동 칸, 윗칸은 그림만. 도착 칸은 밑동 바로 아래.
    오브젝트 id 를 둘(oid, oid + 1) 쓴다."""
    return '\n'.join([
        character(oid, f'waystone_{waystone_id}', tx, ty, [
            ('blocksMovement', 'bool', 'true'), ('displayText', '', '귀환 표지석'),
            ('type', '', 'cave_prop_obelisk_r1c0')]),
        character(oid + 1, f'waystone_{waystone_id}_top', tx, ty - 1, [
            ('blocksMovement', 'bool', 'false'), ('type', '', 'cave_prop_obelisk_r0c0')]),
    ])


def sign(oid, name, tx, ty, text):
    return character(oid, name, tx, ty, [('type', '', 'sign_inn'), ('blocksMovement', 'bool', 'false'),
                                         ('displayText', '', text)])


def load_biome_remap(biome):
    """바이옴(append-biome-tiles.py)의 gid 치환표. None 이면 늪 그대로."""
    if not biome:
        return {}
    data = json.load(open('scripts/biome-gids.json', encoding='utf-8'))
    return {int(k): v for k, v in data[biome]['remap'].items()}


class SwampMap:
    def __init__(self, w, h, seed, biome=None):
        """biome: None(늪) 또는 'snow' 등 — 같은 지형 규칙으로 맵을 만들고 TMX 를 쓸 때 타일 번호만 바이옴 판으로 바꾼다."""
        import random
        self.W, self.H = w, h
        self.biome_remap = load_biome_remap(biome)
        self.biome = biome
        self.rnd = random.Random(seed)
        self.L = {n: [0] * (w * h) for n in LAYER_NAMES}
        self.vmat = None
        self.water_cells = set()
        self.mud_cells = set()
        self.walk = set()
        self.reserved = set()
        self.no_canopy = set()
        self.canopy_cells = set()
        self.trunk_centers = []
        self.deck_cells = set()

    # ---------------------------------------------------------- 레이어
    def inb(self, x, y):
        return 0 <= x < self.W and 0 <= y < self.H

    def set(self, layer, x, y, gid):
        if self.inb(x, y) and gid:
            self.L[layer][y * self.W + x] = gid

    def clear(self, layer, x, y):
        if self.inb(x, y):
            self.L[layer][y * self.W + x] = 0

    def get(self, layer, x, y):
        return self.L[layer][y * self.W + x] if self.inb(x, y) else 0

    def edge_distance(self, x, y):
        return min(x, y, self.W - 1 - x, self.H - 1 - y)

    # ---------------------------------------------------------- 지형
    def make_vmat(self, material_at):
        self.vmat = [[material_at(x, y) for x in range(self.W + 1)] for y in range(self.H + 1)]
        return self.vmat

    def separate_mud_from_water(self):
        """경계 덮개는 풀↔한 재질만 그린다: 물 곁의 진흙 꼭짓점은 풀로."""
        v = self.vmat
        for y in range(self.H + 1):
            for x in range(self.W + 1):
                if v[y][x] == st.MUD and any(
                        0 <= x + dx <= self.W and 0 <= y + dy <= self.H and v[y + dy][x + dx] in (st.WATER, HOLE)
                        for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                    v[y][x] = st.GRASS

    def ring_holes_with_water(self):
        v = self.vmat
        for y in range(self.H + 1):
            for x in range(self.W + 1):
                if v[y][x] == HOLE:
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            if v[y + dy][x + dx] == st.GRASS:
                                v[y + dy][x + dx] = st.WATER

    def paint_terrain(self):
        """바닥·경계 덮개를 깔고 물 칸(물 꼭짓점이 둘 이상)에 투명 충돌을 둔다."""
        for y in range(self.H):
            for x in range(self.W):
                c = st.cell_corners(self.vmat, x, y)
                if HOLE in c:
                    mask = sum(bit for bit, v in zip((1, 2, 4, 8), c) if v == HOLE)
                    self.set('ground', x, y, HOLE_FILL if mask == 15 else LPC[f'cave_edge_Water__Hole_Black_m{mask:02d}'])
                    self.water_cells.add((x, y))
                    continue
                base, over = st.cell_tiles(self.vmat, x, y)
                if base is None:
                    self.set('ground', x, y, S['grass'] if st.h32(x, y, 3) > 0.3 else S['grass_alt'])
                    continue
                self.set('ground', x, y, base)
                if over:
                    self.set('shadow_lower', x, y, over)
                if sum(v == st.WATER for v in c) >= 2:
                    self.water_cells.add((x, y))
                if base == S['mud']:
                    self.mud_cells.add((x, y))
        for (x, y) in self.water_cells:
            self.set('object', x, y, INVISIBLE_BLOCK)

    def lay_deck(self, cells, vertical_cells=()):
        """늪 위 나무 데크(걸을 수 있다). 물 칸이면 충돌을 걷고, 데크 바로 남쪽 물 칸에 그림자 띠를 깐다.
        가로 판자가 기본, vertical_cells 는 세로 판자(남북으로 뻗은 다리)."""
        vertical = set(vertical_cells)
        for (x, y) in cells:
            self.set('shadow_lower', x, y, S['deck_v'] if (x, y) in vertical else S['deck_h'])
            self.clear('object', x, y)
            self.deck_cells.add((x, y))
        for (x, y) in cells:
            below = (x, y + 1)
            if below in self.water_cells and below not in self.deck_cells and not self.get('shadow_lower', *below):
                self.set('shadow_lower', *below, S['deck_shadow'])
        self.walk |= set(cells)
        self.reserved |= set(cells)

    # ---------------------------------------------------------- 놓을 자리
    def free(self, x, y):
        return self.inb(x, y) and (x, y) not in self.reserved and (x, y) not in self.water_cells \
            and not self.get('object', x, y) and not self.get('object_upper', x, y)

    def keep_monsters_visible(self, monsters):
        """몬스터가 나무 윗부분에 가려 생기지 않게: 몬스터 칸 둘레(위로 두 줄까지)에는 수관을 걸지 않는다."""
        self.no_canopy |= {(mx + dx, my + dy) for _n, _k, _l, (mx, my) in monsters
                           for dx in (-1, 0, 1) for dy in (-2, -1, 0)}

    def reserve_monster_room(self, monsters):
        for _n, kind, _l, (mx, my) in monsters:
            r = 0 if kind == 'monster_flower' else 1      # 돌아다니는 몬스터는 둘레 3x3 을 비운다
            for dx in range(-r, r + 1):
                for dy in range(-r, r + 1):
                    self.walk.add((mx + dx, my + dy))

    # ---------------------------------------------------------- 나무
    def upper_layer_for(self, cell):
        """나무 윗부분을 그릴 레이어. 뒤(먼저 심은) 나무가 object_upper 를 쓰고 있으면 앞 나무는
        deco 에 그려 위에 오게 한다. 둘 다 차 있으면 None(세 겹은 덩어리져 보여 심지 않는다)."""
        if cell in self.no_canopy:
            return None
        if not self.get('object_upper', *cell):
            return 'object_upper'
        if not self.get('deco', *cell):
            return 'deco'
        return None

    def put_swamp_tree(self, cx, foot_y):
        """늪 색 town 나무: 3x4, 밑동 행이 foot_y, 가운데 열이 cx."""
        x0 = cx - 1
        trunk = [(x0 + c, foot_y) for c in range(3)]
        canopy = [(x0 + c, foot_y - 3 + r) for r in range(3) for c in range(3)]
        if any(not self.inb(*t) or not self.free(*t) for t in trunk):
            return False
        if any(c in self.walk and c[1] >= foot_y - 1 for c in canopy):
            return False
        layers = {c: self.upper_layer_for(c) for c in canopy if self.inb(*c)}
        if any(v is None for v in layers.values()):
            return False
        for r in range(3):
            for c in range(3):
                cell = (x0 + c, foot_y - 3 + r)
                if cell in layers:
                    self.set(layers[cell], *cell, S['tree']['canopy'][r][c])
                    self.canopy_cells.add(cell)
        for c in range(3):
            self.set('object', x0 + c, foot_y, S['tree']['trunk'][c])
        self.trunk_centers.append((cx, foot_y))
        return True

    def put_dead_tree(self, i, fx, fy, in_water=False):
        """LPC 고목: 밑동 칸만 충돌, 아랫줄 나머지는 바닥 데칼(뿌리·그림자), 윗줄은 나무 레이어.
        in_water: 물에 잠긴 고목 — 밑동이 물 칸이어야 한다."""
        t = S['dead_trees'][i]
        grid, foot = t['grid'], t['foot_col']
        rows = len(grid)
        cells = {}
        for r, row in enumerate(grid):
            for c, g in enumerate(row):
                cells[(fx - foot + c, fy - rows + 1 + r)] = g
        if any(not self.inb(*p) for p in cells):
            return False
        if in_water:
            if (fx, fy) not in self.water_cells or self.get('shadow_lower', fx, fy) or (fx, fy) in self.deck_cells:
                return False
        elif not self.free(fx, fy):
            return False
        layers = {}
        for (x, y), g in cells.items():
            if (x, y) == (fx, fy):
                continue
            if y == fy:
                if self.get('shadow_lower', x, y) or ((x, y) in self.water_cells) != in_water and g:
                    return False
                continue
            if (x, y) in self.deck_cells:
                return False        # 데크(다리·잔교) 위로 가지가 걸리면 길과 나룻배가 가려진다
            layers[(x, y)] = self.upper_layer_for((x, y))
            if layers[(x, y)] is None:
                return False
        for (x, y), g in cells.items():
            if (x, y) == (fx, fy):
                self.set('object', x, y, g)
                if in_water:
                    self.clear('shadow_lower', x, y)
            elif y == fy:
                self.set('shadow_lower', x, y, g)
            else:
                self.set(layers[(x, y)], x, y, g)
                self.canopy_cells.add((x, y))
        self.trunk_centers.append((fx, fy))
        return True

    def plant_forest(self, groves, clearings, dead_ratio=0.55):
        """가장자리 띠 + 숲 덩이(원), 빈터·길에서는 0. 위(뒤) 행부터, 행 안에서는 섞어 심는다."""
        def density(x, y):
            if (x, y) in self.walk or (x, y) in self.water_cells:
                return 0.0
            d = self.edge_distance(x, y)
            p = 0.95 if d <= 1 else 0.6 if d <= 2 else 0.05
            for gx, gy, r in groves:
                g = math.hypot(x - gx, y - gy)
                if g < r:
                    p = max(p, 0.85 * (1 - g / r) + 0.25)
            for cx, cy, r in clearings:
                if math.hypot(x - cx, y - cy) < r:
                    p *= 0.05
            return p

        cands = [(y, self.rnd.random(), x) for y in range(1, self.H) for x in range(self.W)]
        cands.sort()
        for y, _r, x in cands:
            if self.rnd.random() >= density(x, y):
                continue
            gap = 2 if self.edge_distance(x, y) <= 1 else 3
            if any(abs(ox - x) < gap and abs(oy - y) < 2 for ox, oy in self.trunk_centers):
                continue
            pick = DEAD_ORDER[len(self.trunk_centers) % len(DEAD_ORDER)]
            if self.rnd.random() < dead_ratio:
                self.put_dead_tree(pick, x, y)
            else:
                self.put_swamp_tree(x, y) or self.put_dead_tree(pick, x, y)
        return cands

    def plant_drowned_trees(self, cands, accept, limit=6, chance=1.0):
        """물속에 선 고목(잠긴숲): 둘레 3x3 이 모두 물인 칸, 서로 3칸 이상.
        chance < 1 이면 위(뒤) 행부터 심되 칸마다 그 확률로만 골라, 맵 위쪽에 몰리지 않고 고르게 흩어진다."""
        drowned = 0
        for y, r, x in cands:
            if drowned >= limit or not accept(x, y) or (x, y) not in self.water_cells:
                continue
            if chance < 1.0 and st.h32(x, y, 67) >= chance:
                continue
            if not all((x + dx, y + dy) in self.water_cells for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                continue
            if any(abs(ox - x) < 3 and abs(oy - y) < 3 for ox, oy in self.trunk_centers):
                continue
            if self.put_dead_tree(DEAD_ORDER[drowned % len(DEAD_ORDER)], x, y, in_water=True):
                drowned += 1
        return drowned

    # ---------------------------------------------------------- 장식
    def bank_cells(self):
        return [(x, y) for y in range(1, self.H) for x in range(self.W)
                if (x, y) not in self.water_cells and (x, y) not in self.deck_cells and any(
                    (x + dx, y + dy) in self.water_cells for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]

    def decorate_banks(self, bank, cattail_chance=0.28):
        for (x, y) in bank:
            if self.rnd.random() < cattail_chance and self.free(x, y) and self.free(x, y - 1) \
                    and (x, y - 1) not in self.canopy_cells:
                self.set('object', x, y, CATTAIL[1])
                self.set('object_upper', x, y - 1, CATTAIL[0])

    def place_props(self, logs=(), rocks=(), stumps=()):
        for (x, y) in logs:
            if self.free(x, y):
                self.set('object', x, y, LOG_SINGLE)
        for (x, y) in rocks:
            if self.free(x, y):
                self.set('object', x, y, ROCKS[(x + y) % 2])
        for (x, y) in stumps:
            if self.free(x, y):
                self.set('object', x, y, STUMPS[(x + y) % 2])

    def scatter_tufts(self, bank, bank_chance=0.35, field_chance=0.05):
        for (x, y) in bank:
            if (x, y) not in self.walk and not self.get('shadow_lower', x, y) and self.rnd.random() < bank_chance:
                self.set('shadow_lower', x, y, S['tufts'][self.rnd.randrange(5)])
        for y in range(self.H):
            for x in range(self.W):
                if self.get('ground', x, y) in (S['grass'], S['grass_alt']) and not self.get('shadow_lower', x, y) \
                        and (x, y) not in self.walk and self.rnd.random() < field_chance:
                    self.set('shadow_lower', x, y, S['tufts'][self.rnd.randrange(5)])

    # ---------------------------------------------------------- 가장자리 · 검증
    def seal_border(self, open_cells=()):
        """맵 가장자리 한 줄을 막는다. 수관·물로 덮인 칸은 투명 충돌, 빈 땅은 고목 → 덤불·돌·그루터기."""
        open_cells = set(open_cells)
        for y in range(self.H):
            for x in range(self.W):
                if self.edge_distance(x, y) != 0 or (x, y) in open_cells or self.get('object', x, y):
                    continue
                covered = (x, y) in self.water_cells or self.get('object_upper', x, y) or self.get('deco', x, y)
                if not covered and self.put_dead_tree(DEAD_ORDER[(x * 3 + y) % len(DEAD_ORDER)], x, y):
                    continue
                if covered:
                    self.set('object', x, y, INVISIBLE_BLOCK)
                    continue
                k = st.h32(x, y, 41)
                self.set('object', x, y, BUSHES[int(k * 3)] if k < 0.72 else ROCKS[(x + y) % 2] if k < 0.86
                         else STUMPS[(x + y) % 2])
                ix = x + (1 if x == 0 else -1 if x == self.W - 1 else 0)
                iy = y + (1 if y == 0 else -1 if y == self.H - 1 else 0)
                if st.h32(x, y, 43) < 0.35 and self.free(ix, iy):
                    self.set('object', ix, iy, BUSHES[int(st.h32(x, y, 47) * 3)])

    def flood(self, start):
        walls = {(i % self.W, i // self.W) for i, g in enumerate(self.L['object']) if g}
        seen = {start}
        q = deque([start])
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (x + dx, y + dy)
                if self.inb(*n) and n not in seen and n not in walls:
                    seen.add(n)
                    q.append(n)
        return walls, seen

    def fill_orphans(self, start):
        """걸어서 못 가는 빈 땅을 막는다. 플레이어가 맞닿을 수 있는 칸(갈 수 있는 칸 바로 옆)은 덤불처럼
        눈에 보이는 것으로, 물 건너 닿지 못하는 섬은 갈대·덤불을 듬성듬성 두고 나머지는 투명 충돌로
        막는다(그 섬에 부딪힐 일이 없으니 투명 벽이 아니다 — 덤불로 다 메우면 생울타리 덩어리로 보인다)."""
        walls, seen = self.flood(start)
        orphans = [(x, y) for y in range(self.H) for x in range(self.W) if (x, y) not in walls and (x, y) not in seen]
        for (x, y) in orphans:
            touchable = any((x + dx, y + dy) in seen for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if touchable:
                self.set('object', x, y, BUSHES[(x + y) % 3])
                continue
            k = st.h32(x, y, 53)
            if k < 0.16 and not self.get('object_upper', x, y - 1) and (x, y - 1) not in self.water_cells:
                self.set('object', x, y, CATTAIL[1])
                self.set('object_upper', x, y - 1, CATTAIL[0])
            elif k < 0.30:
                self.set('object', x, y, BUSHES[int(st.h32(x, y, 59) * 3)])
            else:
                self.set('object', x, y, INVISIBLE_BLOCK)
                if k > 0.85 and not self.get('shadow_lower', x, y):
                    self.set('shadow_lower', x, y, S['tufts'][int(st.h32(x, y, 61) * 5)])
        if orphans:
            print(f'갈 수 없는 칸 {len(orphans)}개를 막음')
        return self.flood(start)

    def validate(self, start, checks, open_edge_cells=()):
        walls, seen = self.flood(start)
        problems = []
        for name, p in checks:
            if p in walls:
                problems.append(f'{name}{p} 벽')
            elif p not in seen:
                problems.append(f'{name}{p} 도달 불가')
        open_edge_cells = set(open_edge_cells)
        for y in range(self.H):
            for x in range(self.W):
                if self.edge_distance(x, y) == 0 and (x, y) in seen and (x, y) not in open_edge_cells:
                    problems.append(f'가장자리 열림 {(x, y)}')
        max_gid = max(max(v) for v in self.L.values())
        tilecount = int(re.search(r'tilecount="(\d+)"', open(TSX, encoding='utf-8').read()).group(1))
        if max_gid > tilecount:
            problems.append(f'gid {max_gid} 가 타일셋 범위 밖')
        print(f'벽 {len(walls)} / 도달 {len(seen)} / 전체 {self.W * self.H} / 물 {len(self.water_cells)} / '
              f'진흙 {len(self.mud_cells)}')
        if problems:
            print('!! 문제:')
            for p in problems:
                print('   -', p)
            raise SystemExit(1)
        print('검증 통과')

    # ---------------------------------------------------------- 출력
    def write_tmx(self, path, generator, chars, char_comment, portals, portal_comment, next_object_id):
        out = ['<?xml version="1.0" encoding="UTF-8"?>',
               f'<map version="1.10" tiledversion="1.12.1" orientation="orthogonal" renderorder="right-down" '
               f'width="{self.W}" height="{self.H}" tilewidth="32" tileheight="32" infinite="0" '
               f'nextlayerid="{FIRST_LAYER_ID + len(LAYER_NAMES)}" nextobjectid="{next_object_id}">',
               f'<!-- {generator} 가 생성한다. 손으로 고치지 말고 스크립트를 고친 뒤 다시 돌릴 것. -->',
               ' <tileset firstgid="1" source="../tilesets/town-32.tsx"/>']
        if self.biome_remap:   # 바이옴 타일셋(append-biome-tiles.py): town-32 다음 칸부터
            out.append(f' <tileset firstgid="{min(self.biome_remap.values())}" source="../tilesets/biome-{self.biome}.tsx"/>')
        remap = self.biome_remap
        for i, name in enumerate(LAYER_NAMES, start=FIRST_LAYER_ID):
            rows = ',\n'.join(','.join(str(remap.get(v, v)) for v in self.L[name][y * self.W:(y + 1) * self.W])
                               for y in range(self.H))
            out.append(f' <layer id="{i}" name="{name}" width="{self.W}" height="{self.H}">\n'
                       f'  <data encoding="csv">\n{rows}\n</data>\n </layer>')
        out.append(' <objectgroup id="2" name="characters">')
        out.append(f'  <!-- {char_comment} -->')
        out += chars
        out.append(' </objectgroup>')
        out.append(' <objectgroup id="3" name="portals">')
        out.append(f'  <!-- {portal_comment} -->')
        out += portals
        out.append(' </objectgroup>')
        out.append('</map>')
        open(path, 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')
        print(f'저장: {path}')
