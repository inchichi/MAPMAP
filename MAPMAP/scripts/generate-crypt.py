"""crypt-crawler 층별 던전 생성기 — 384x384 TMX 다섯 장.

계약: notes/crypt-crawler-contract.md (1절이 2026-09-09에 맵 5장 구조로 개정됐다).
세계관: docs/crypt-crawler-world.md (자장가 다섯 소절이 층 다섯 개의 생김새를 정한다).

  1 폐허 마을  돌을 베고      사각 마당 + 담장 + 직선 길
  2 버섯굴     흙을 덮고      유기적 덩어리 + 좁은 터널
  3 물웅덩이   물은 발치에    물이 벽이다. 좁은 둑길
  4 용암굴     불은 머리맡에  갈라진 자연 동굴 + 낭떠러지
  5 구덩이의 눈 목소리를 세어라 통로 없는 단일 거대 홀

**층마다 방 생성 알고리즘 자체가 다르다.** 팔레트만 갈아끼우면 존이 다섯 개인 척하는
한 개짜리 맵이 된다(256² 시절에 실제로 그렇게 나왔다). 그래서 층마다 다른 것을 쓴다:

  1층 격자 가로망 + 사각 마당 배치      (사람이 지었으므로 직교한다)
  2층 셀룰러 오토마타 덩어리 겹쳐 뿌리기 (방이 방을 먹는다)
  3층 물로 시작해 둑길만 깎아내기        (벽이 아니라 물이 나눈다)
  4층 전역 셀룰러 오토마타 + 여유공간 원반으로 방 검출 (갈라진 동굴)
  5층 열주 격자가 나누는 베이 하나짜리 홀 (통로도 분기도 없다)

바닥 시트도 층마다 다른 계열을 쓴다. 검증이 층 간 상위 12종 겹침을 0으로 강제한다.

손으로 그린 맵만큼의 밀도를 내려고 지키는 규칙(256² 생성기에서 검증된 것들):

- **방 모양을 섞는다.** 사각형만 뿌리면 아무리 넓어도 벽지로 읽힌다.
- **장식은 뿌리지 않고 뭉친다.** 균일 난수 스프링클은 노이즈로 보인다.
- **그림자 레이어가 깊이를 만든다.** 이 타일셋은 테두리 벽만 제공해서 벽 덩어리 내부를
  칠할 수 없다. 대신 벽/물/용암에 접한 바닥에 근검정 타일을 불투명도 0.35로 깐다.
- **벽 덩어리 내부는 그리지 않는다.** 맵 배경색(#2a2431)이 그대로 통행 불가로 읽힌다.

패스마다 별도 시드 RNG를 쓴다. 공유 RNG면 앞 패스를 한 줄만 고쳐도 뒤 패스가 전부
뒤바뀐다(이 저장소가 사냥터에서 이미 겪은 함정이다).

실행: python3 scripts/generate-crypt.py
"""
import json
import math
import os
import random
from collections import Counter, deque

MANIFEST_PATH = 'scripts/ninja-dungeon-atlas.json'
OUT_DIR = 'public/crypt-maps'
# TMX 가 public/crypt-maps/ 로 옮겨졌으므로 타일셋 상대경로도 따라 바뀐다.
# TSX/PNG 는 계약대로 assets/ 에 남는다(작아서 번들해도 된다).
TILESET_REF = '../../src/games/crypt-crawler/assets/tilesets/ninja-dungeon-16.tsx'
BACKGROUND = '#2a2431'

W = H = 384
TILE = 16
BORDER = 3

# 플레이어 스폰 둘레에서 몬스터를 비우는 반경(체비쇼프 거리, 타일).
# createCryptView 의 잡몹 인지 반경 aggroTiles=7 과 맞춘다.
SPAWN_SAFE_RADIUS = 7

MANIFEST = json.load(open(MANIFEST_PATH, encoding='utf-8'))
SHEETS = MANIFEST['sheets']
TILECOUNT = MANIFEST['tilecount']


def gid(sheet, row, column):
  """시트 내 (row, column) → TMX gid. gid = 아틀라스 인덱스 + 1."""
  spec = SHEETS[sheet]
  if not (0 <= row < spec['rows'] and 0 <= column < spec['columns']):
    raise ValueError(f'{sheet} ({row},{column}) 가 시트 범위를 벗어납니다.')
  index = spec['start'] + row * spec['columns'] + column
  if index >= TILECOUNT:
    raise ValueError(f'{sheet} ({row},{column}) → 인덱스 {index} 가 아틀라스를 벗어납니다.')
  return index + 1


def fill_set(sheet, rows, columns):
  return [gid(sheet, r, c) for r in rows for c in columns]


# ------------------------------------------------------------------ 타일 어휘
# 바닥 채움. 각 블록의 바깥 열은 모르타르 틀이라 반복하면 격자 이음매가 드러난다 —
# 이음매 없는 안쪽 열만 쓴다. 층 간 gid 가 하나도 겹치지 않게 계열을 나눴다.
GRAVEL_FLOOR = fill_set('interior_floor', range(12, 16), range(4, 10))    # 1층 모래 자갈
BRICK_FLOOR = fill_set('interior_floor', range(6, 10), range(4, 10))      # 1층 주황 벽돌 마당
EARTH_ROAD = fill_set('floor', range(1, 3), (5, 6, 8))                    # 1층 흙길
MOSS_FLOOR = fill_set('floor', (12,), range(0, 5))                        # 2층 연두 이끼
DEEP_MOSS_FLOOR = fill_set('floor', (12,), range(11, 16))                 # 2층 진초록
MUD_FLOOR = fill_set('floor', range(15, 17), range(16, 20))               # 2층 진흙 터널
STONE_FLOOR = fill_set('interior_floor', range(0, 4), range(4, 10))       # 3층 크림 석조
WET_FLOOR = fill_set('interior_floor', range(6, 10), range(15, 21))       # 3층 녹회색 젖은 판석
BASALT_FLOOR = fill_set('interior_floor', range(12, 16), range(15, 21))   # 4층 검은 자갈
BASALT_PATCH = fill_set('interior_floor', range(12, 16), range(11, 14))   # 4층 검은 자갈 변주
GOLD_FLOOR = fill_set('interior_floor', range(1, 4), range(16, 19))       # 5층 황금 문양
PALE_GOLD_FLOOR = fill_set('interior_floor', range(1, 3), range(12, 14))  # 5층 크림 격자

# 4x4 문양 융단. 배치 순서를 그대로 지켜 찍어야 문양이 맞는다.
JADE_RUG = [[gid('interior_floor', r, c) for c in range(15, 19)] for r in range(6, 10)]
GOLD_RUG = [[gid('interior_floor', r, c) for c in range(15, 19)] for r in range(0, 4)]

# 용암은 채움만 쓴다. 이 팩의 용암 오토타일은 가장자리가 눈밭(흰색)이라
# 검은 자갈 위에 얹으면 흰 테두리가 생긴다. 대신 그림자 레이어가 가장자리를 만든다.
# 평평한 타일을 넷, 물보라 섞인 타일을 넷 — 목록에 겹쳐 넣어 가중치를 준다.
LAVA_FILL = fill_set('floor', (22,), (12,)) * 4 + fill_set('floor', range(22, 24), range(16, 18))

# 물은 오토타일을 쓴다. 3층에서는 물이 지형의 절반이라 잘라낸 파란 융단으로 보이면 안 된다.
# `water` 시트 좌상단 블록은 모래 물가라 크림 석조 둑길과 이어진다(흰 눈밭 물가가 아니다).
WATER_FACES = {
  'C': gid('water', 1, 1),
  'N': gid('water', 0, 1), 'S': gid('water', 2, 1),
  'W': gid('water', 1, 0), 'E': gid('water', 1, 2),
  'NW': gid('water', 0, 0), 'NE': gid('water', 0, 2),
  'SW': gid('water', 2, 0), 'SE': gid('water', 2, 2),
  'H_W': gid('water', 3, 0), 'H_C': gid('water', 3, 1), 'H_E': gid('water', 3, 2),
  'V_N': gid('water', 0, 3), 'V_C': gid('water', 1, 3), 'V_S': gid('water', 2, 3),
  'DOT': gid('water', 3, 3),
}
# 깊은 물 잔물결 — 넓은 수면이 한 타일 반복으로만 채워지면 벽지가 된다.
WATER_RIPPLE = [gid('water', r, c) for r in (1, 2) for c in (5, 6)]

# 낭떠러지. 3x3 블록이라 구멍을 폭·높이 3 이상 사각형의 합집합으로만 만든다.
HOLE_FACES = {
  'NW': gid('hole', 0, 0), 'N': gid('hole', 0, 1), 'NE': gid('hole', 0, 3),
  'W': gid('hole', 1, 0), 'C': gid('hole', 1, 1), 'E': gid('hole', 1, 3),
  'SW': gid('hole', 2, 0), 'S': gid('hole', 2, 1), 'SE': gid('hole', 2, 3),
}

# 바닥 데칼.
RUBBLE_DECAL = [gid('floor_detail', 0, c) for c in (5, 6, 7, 8, 15)] + [gid('floor_detail', 1, 0)]
BONE_DECAL = [gid('floor_detail', 0, c) for c in (13, 14)]
BLOOD_DECAL = [gid('floor_detail', 0, c) for c in (0, 1, 4)]
DUST_DECAL = [gid('floor_detail', 0, c) for c in (2, 3, 9, 10)]
GRASS_DECAL = [gid('floor_detail', 2, c) for c in (0, 1, 2, 3, 4)]
FUNGUS_DECAL = [gid('floor_detail', 2, c) for c in (5, 6, 7)]
PALE_DECAL = [gid('floor_detail', 3, c) for c in range(0, 8)]

# 그림자 — 근검정 단색 타일. shadow 레이어의 불투명도 0.35가 이걸 그늘로 만든다.
SHADOW_TILE = gid('interior', 0, 0)

# 소품.
RUIN_ROCKS = [gid('ruins', 4, 3), gid('ruins', 5, 3), gid('ruins', 3, 7),
              gid('ruins', 4, 7), gid('ruins', 4, 8), gid('ruins', 3, 10), gid('ruins', 4, 10)]
RUIN_BUSHES = [gid('ruins', 5, 4), gid('ruins', 5, 5), gid('ruins', 11, 4), gid('ruins', 11, 5)]
RUIN_STUMPS = [gid('ruins', 8, 6), gid('ruins', 11, 6), gid('ruins', 8, 4), gid('ruins', 8, 5)]
RUIN_POTS = [gid('ruins', 4, 4), gid('ruins', 4, 5)]
RUIN_TREES = [
  [[gid('ruins', r, c) for c in range(0, 2)] for r in range(6, 9)],
  [[gid('ruins', r, c) for c in range(2, 4)] for r in range(6, 9)],
]
POT_PROPS = [gid('element', 0, 0), gid('element', 0, 1), gid('element', 1, 4),
             gid('element', 1, 5), gid('dungeon', 1, 0)]
ROCK_PROPS = [gid('dungeon', 2, 3), gid('dungeon', 3, 7)]
BRAZIER_PROPS = [gid('dungeon', 3, 3), gid('dungeon', 3, 5)]
GRAVE_PROPS = [gid('element', 2, 3), gid('element', 2, 4), gid('element', 2, 5)]
GREEN_CRYSTALS = [gid('dungeon', 2, 3), gid('dungeon', 2, 2)]
BLUE_CRYSTALS = [gid('dungeon', 2, 4), gid('dungeon', 2, 5)]
EMBER_CRYSTALS = [gid('dungeon', 2, 6), gid('dungeon', 2, 7)]
EYE_CRYSTALS = [gid('dungeon', 2, c) for c in (2, 4, 5, 6, 7)]
ALTAR_PROPS = [gid('element', 2, 4), gid('element', 2, 5), gid('dungeon', 0, 0),
               gid('dungeon', 0, 1)]

BANNER_DECO = gid('element', 0, 14)


def interior_wall_faces(green):
  """`interior` 시트의 테두리 벽. 갈색 블록 기준 좌표, 녹회색은 같은 행의 열 +8."""
  shift = 8 if green else 0
  place = {'S': (10, 4), 'N': (19, 4), 'W': (13, 1), 'E': (13, 6),
           'CORNER_TL': (10, 1), 'CORNER_TR': (10, 6),
           'CORNER_BL': (19, 1), 'CORNER_BR': (19, 6)}
  faces = {key: gid('interior', row, column + shift) for key, (row, column) in place.items()}
  faces['PILLAR'] = gid('interior', 15, 10 if green else 2)
  return faces


def relief_wall_faces():
  """`relief` 시트의 주황 대지 — 벽이 아니라 못 오르는 절벽이다. 4층 전용."""
  place = {'S': (7, 2), 'N': (5, 2), 'W': (6, 1), 'E': (6, 3),
           'CORNER_TL': (5, 1), 'CORNER_TR': (5, 3),
           'CORNER_BL': (7, 1), 'CORNER_BR': (7, 3)}
  faces = {key: gid('relief', row, column) for key, (row, column) in place.items()}
  faces['PILLAR'] = gid('relief', 8, 4)
  return faces


def ring_wall_faces():
  """`wall` 시트의 크림 고리 벽. 5층 전용 — 구덩이의 눈만 다른 손으로 지어진 것처럼 보인다."""
  place = {'S': (0, 2), 'N': (4, 2), 'E': (2, 0), 'W': (2, 4),
           'CORNER_TL': (0, 0), 'CORNER_TR': (0, 4),
           'CORNER_BL': (4, 0), 'CORNER_BR': (4, 4)}
  faces = {key: gid('wall', row, column) for key, (row, column) in place.items()}
  faces['PILLAR'] = gid('interior', 15, 2)
  return faces


PILLAR_BROWN = gid('interior', 15, 2)
PILLAR_GREEN = gid('interior', 15, 10)


# ------------------------------------------------------------------- 방 모양
def shape_rect(box):
  left, top, right, bottom = box
  return {(x, y) for y in range(top, bottom) for x in range(left, right)}


def shape_oval(box):
  left, top, right, bottom = box
  rx, ry = (right - left) / 2, (bottom - top) / 2
  cx, cy = left + rx, top + ry
  return {
    (x, y)
    for y in range(top, bottom) for x in range(left, right)
    if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.0
  }


def shape_merged(rng, box):
  """사각형 둘의 합집합 — L자/T자. 겹치므로 항상 한 덩어리다."""
  left, top, right, bottom = box
  cut_x = rng.randint(left + 3, right - 4)
  cut_y = rng.randint(top + 3, bottom - 4)
  column = (left, top, cut_x, bottom) if rng.random() < 0.5 else (cut_x, top, right, bottom)
  band = (left, top, right, cut_y) if rng.random() < 0.5 else (left, cut_y, right, bottom)
  return shape_rect(column) | shape_rect(band)


def shape_cave(rng, box):
  """셀룰러 오토마타. 중앙에 이어진 덩어리만 남긴다 — 떨어진 조각은 도달 불가 바닥이 된다.

  경계 밖을 '열림'으로 세는 것이 핵심이다. 밖을 벽으로 세면 네 세대만에 방이 안쪽으로
  갉여 사라져(14x11 방이 평균 15%만 남았다) 동굴 방이 한 개도 안 생긴다.
  """
  left, top, right, bottom = box
  width, height = right - left, bottom - top
  local = [[1 if rng.random() < 0.56 else 0 for _ in range(width)] for _ in range(height)]
  for _ in range(4):
    nxt = [row[:] for row in local]
    for y in range(height):
      for x in range(width):
        neighbours = sum(
          local[y + dy][x + dx] if 0 <= y + dy < height and 0 <= x + dx < width else 1
          for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy or dx)
        )
        nxt[y][x] = 1 if neighbours >= 5 else 0
    local = nxt

  cx, cy = width // 2, height // 2
  for dy in range(-1, 2):
    for dx in range(-1, 2):
      local[cy + dy][cx + dx] = 1

  cells = {(left + cx, top + cy)}
  seen = {(cx, cy)}
  queue = deque(seen)
  while queue:
    x, y = queue.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
      nx, ny = x + dx, y + dy
      if 0 <= nx < width and 0 <= ny < height and local[ny][nx] and (nx, ny) not in seen:
        seen.add((nx, ny))
        cells.add((left + nx, top + ny))
        queue.append((nx, ny))
  return cells


def make_room(rng, kind, box):
  if kind == 'oval':
    return shape_oval(box)
  # L자는 두 사각형이 각각 3칸 이상 남아야 성립한다. 그보다 작으면 그냥 사각형이다.
  if kind == 'merged' and min(box[2] - box[0], box[3] - box[1]) >= 8:
    return shape_merged(rng, box)
  if kind == 'cave':
    return shape_cave(rng, box)
  return shape_rect(box)


def room_anchor(box, cells):
  """복도가 물릴 지점. 방 중심이 모양 밖일 수 있어(동굴/L자) 가장 가까운 칸으로 당긴다."""
  cx, cy = (box[0] + box[2]) // 2, (box[1] + box[3]) // 2
  if (cx, cy) in cells:
    return cx, cy
  return min(cells, key=lambda c: abs(c[0] - cx) + abs(c[1] - cy))


def make_room_record(kind, size, box, cells):
  return {'kind': kind, 'size': size, 'box': box, 'cells': cells,
          'anchor': room_anchor(box, cells)}


# ------------------------------------------------------------------ 공용 배치
class SiteGrid:
  """중심점 간 최소 거리를 상수 시간에 검사하는 버킷 격자.

  384² 에서 방이 300개를 넘으면 거절 샘플링의 전수 비교가 O(n²)로 불어난다.
  """

  def __init__(self, spacing):
    self.spacing = spacing
    self.buckets = {}

  def far_enough(self, x, y, distance):
    key_x, key_y = x // self.spacing, y // self.spacing
    span = distance // self.spacing + 1
    for by in range(key_y - span, key_y + span + 1):
      for bx in range(key_x - span, key_x + span + 1):
        for (ox, oy) in self.buckets.get((bx, by), ()):
          if abs(ox - x) < distance and abs(oy - y) < distance:
            return False
    return True

  def add(self, x, y):
    self.buckets.setdefault((x // self.spacing, y // self.spacing), []).append((x, y))


def connect_rooms(rng, anchors, neighbours=4, loop_ratio=0.15):
  """kNN 그래프 위의 최소 신장 트리 + 고리 간선.

  순수 트리는 막다른 길만 남아 ARPG로 굴러가지 않는다 — 고리가 있어야 돌아다니는 맛이
  난다. 반대로 물웅덩이(3층)는 고리를 거의 주지 않아 도망칠 곳을 없앤다.
  """
  if len(anchors) < 2:
    return []
  cell = 24
  buckets = {}
  for index, (x, y) in enumerate(anchors):
    buckets.setdefault((x // cell, y // cell), []).append(index)

  edges = []
  for i, (ax, ay) in enumerate(anchors):
    key_x, key_y = ax // cell, ay // cell
    span = 1
    near = []
    while len(near) <= neighbours and span < 12:
      near = [j for by in range(key_y - span, key_y + span + 1)
              for bx in range(key_x - span, key_x + span + 1)
              for j in buckets.get((bx, by), ()) if j != i]
      span += 1
    near.sort(key=lambda j: abs(anchors[j][0] - ax) + abs(anchors[j][1] - ay))
    for j in near[:neighbours]:
      edges.append((abs(anchors[j][0] - ax) + abs(anchors[j][1] - ay), i, j))
  edges.sort()

  parent = list(range(len(anchors)))

  def find(node):
    while parent[node] != node:
      parent[node] = parent[parent[node]]
      node = parent[node]
    return node

  chosen = []
  spare = []
  for _distance, i, j in edges:
    root_i, root_j = find(i), find(j)
    if root_i == root_j:
      spare.append((i, j))
      continue
    parent[root_i] = root_j
    chosen.append((i, j))

  # kNN 그래프가 끊긴 성분을 남길 수 있다 — 남은 성분은 가장 가까운 것끼리 강제로 잇는다.
  roots = {}
  for index in range(len(anchors)):
    roots.setdefault(find(index), index)
  members = list(roots.values())
  for a, b in zip(members, members[1:]):
    if find(a) != find(b):
      parent[find(a)] = find(b)
      chosen.append((a, b))

  rng.shuffle(spare)
  chosen.extend(spare[:int(len(chosen) * loop_ratio)])
  return chosen


def carve_line(floor, start, end, width):
  """L자 통로. 굽는 방향을 좌표로 정해 결정적으로 만들고, 새로 판 칸을 돌려준다."""
  (x0, y0), (x1, y1) = start, end
  half = width // 2
  corner = (x1, y0) if (x0 + y0) % 2 == 0 else (x0, y1)
  carved = set()
  for a, b in ((start, corner), (corner, end)):
    if a[0] == b[0]:
      for y in range(min(a[1], b[1]), max(a[1], b[1]) + 1):
        for offset in range(-half, width - half):
          x = a[0] + offset
          if BORDER <= x < W - BORDER and BORDER <= y < H - BORDER:
            carved.add((x, y))
    else:
      for x in range(min(a[0], b[0]), max(a[0], b[0]) + 1):
        for offset in range(-half, width - half):
          y = a[1] + offset
          if BORDER <= x < W - BORDER and BORDER <= y < H - BORDER:
            carved.add((x, y))
  carved -= floor
  floor |= carved
  return carved


def carve_alcoves(rng, floor, origin, count):
  """통로에서 벽 속으로 파고든 막다른 골방. 보물을 놓을 자리를 돌려준다.

  origin 은 골방이 뻗어 나가는 출발 칸 집합이다. 용암굴에서는 여기서 용암·낭떠러지를
  빼야 한다 — 용암 한복판에서 뻗은 골방은 아무도 못 가는 보물방이 된다.
  """
  candidates = [c for c in origin if all(
    BORDER + 12 <= c[axis] < (W if axis == 0 else H) - BORDER - 12 for axis in (0, 1)
  )]
  rng.shuffle(candidates)
  pockets = []
  for x, y in candidates:
    if len(pockets) >= count:
      break
    dx, dy = rng.choice(((1, 0), (-1, 0), (0, 1), (0, -1)))
    depth = rng.randint(4, 7)
    stub = [(x + dx * step, y + dy * step) for step in range(1, depth + 1)]
    end = stub[-1]
    pocket = shape_rect((end[0] - 1, end[1] - 1, end[0] + 2, end[1] + 2))
    # 벽 덩어리 속으로만 판다 — 이미 바닥이면 골방이 아니라 지름길이 된다.
    if any(cell in floor for cell in stub) or any(cell in floor for cell in pocket):
      continue
    floor.update(stub)
    floor |= pocket
    pockets.append(end)
  return pockets


def blob(rng, center, radius, spread):
  """원 몇 개를 겹쳐 만든 유기적 얼룩 — 칸별 난수로는 얼룩이 생기지 않는다."""
  cells = set()
  for _ in range(spread):
    cx = center[0] + rng.randint(-radius, radius)
    cy = center[1] + rng.randint(-radius, radius)
    r = rng.randint(2, radius)
    for y in range(cy - r, cy + r + 1):
      for x in range(cx - r, cx + r + 1):
        if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
          cells.add((x, y))
  return cells


# ------------------------------------------------------------- 1층 폐허 마을
STREET_STEP = 27


def layout_ruins():
  """격자 가로망 + 사각 마당. 사람이 지은 것이므로 직교하고 줄이 맞는다.

  가로는 폭 3~4의 직선이 맵을 통째로 가로지른다(연결성이 구조적으로 보장된다).
  가로가 나눈 블록 안에 마당을 1~4개 넣고, 마당마다 가로로 나가는 3칸 대문을 뚫는다.
  """
  rng_town = random.Random(20260909)
  rng_house = random.Random(1101)
  floor = set()
  rooms = []
  streets = set()

  lines = [BORDER + i * STREET_STEP for i in range(14)] + [W - BORDER - 3]
  widths = [rng_town.choice((3, 3, 4)) for _ in lines]
  for line, width in zip(lines, widths):
    for offset in range(width):
      for other in range(BORDER, H - BORDER):
        streets.add((line + offset, other))
        streets.add((other, line + offset))
  floor |= streets

  def courtyard(block, box, size):
    left, top, right, bottom = box
    if right - left < 5 or bottom - top < 5:
      return
    kind = 'merged' if rng_house.random() < 0.25 and min(right - left, bottom - top) >= 9 \
        else 'rect'
    cells = make_room(rng_house, kind, box)
    floor.update(cells)
    rooms.append(make_room_record(kind, size, box, cells))
    # 대문 — 가장 가까운 가로까지 곧게 뚫는다. 가로가 블록을 사방으로 두르므로 반드시 닿는다.
    anchor = ((left + right) // 2, (top + bottom) // 2)
    gaps = ((anchor[0] - block[0], (-1, 0)), (block[2] - anchor[0], (1, 0)),
            (anchor[1] - block[1], (0, -1)), (block[3] - anchor[1], (0, 1)))
    _distance, (dx, dy) = min(gaps, key=lambda item: item[0])
    x, y = anchor
    while BORDER <= x < W - BORDER and BORDER <= y < H - BORDER and (x, y) not in streets:
      for offset in (-1, 0, 1):
        floor.add((x + offset * abs(dy), y + offset * abs(dx)))
      x, y = x + dx, y + dy

  for column, (line_x, width_x) in enumerate(zip(lines, widths)):
    if column + 1 >= len(lines):
      break
    for row, (line_y, width_y) in enumerate(zip(lines, widths)):
      if row + 1 >= len(lines):
        break
      block = (line_x + width_x, line_y + width_y, lines[column + 1], lines[row + 1])
      span_x, span_y = block[2] - block[0], block[3] - block[1]
      plan = rng_town.choices(('collapsed', 'plaza', 'one', 'two_h', 'two_v', 'four'),
                              weights=(10, 8, 18, 16, 16, 32))[0]
      if plan == 'collapsed':
        continue
      if plan == 'plaza':
        courtyard(block, (block[0] + 1, block[1] + 1, block[2] - 1, block[3] - 1), 'landmark')
        continue
      cuts_x = 1 if plan in ('one', 'two_v') else 2
      cuts_y = 1 if plan in ('one', 'two_h') else 2
      step_x, step_y = span_x // cuts_x, span_y // cuts_y
      size = 'large' if cuts_x * cuts_y == 1 else ('medium' if cuts_x * cuts_y == 2 else 'small')
      for iy in range(cuts_y):
        for ix in range(cuts_x):
          left = block[0] + ix * step_x + 2
          top = block[1] + iy * step_y + 2
          right = block[0] + (ix + 1) * step_x - 2 if ix + 1 < cuts_x else block[2] - 2
          bottom = block[1] + (iy + 1) * step_y - 2 if iy + 1 < cuts_y else block[3] - 2
          courtyard(block, (left, top, right, bottom), size)

  # 무너진 집 — 마당 안에 남은 사각 잔해. 안쪽에만 놓아 둘레 고리가 끊기지 않는다.
  rng_ruin = random.Random(3355)
  for room in rooms:
    left, top, right, bottom = room['box']
    if right - left < 11 or bottom - top < 11 or rng_ruin.random() < 0.45:
      continue
    width = rng_ruin.randint(3, min(6, right - left - 6))
    height = rng_ruin.randint(3, min(5, bottom - top - 6))
    x = rng_ruin.randint(left + 3, right - width - 3)
    y = rng_ruin.randint(top + 3, bottom - height - 3)
    rubble = shape_rect((x, y, x + width, y + height))
    if rubble <= room['cells']:
      floor -= rubble
      room['cells'] -= rubble

  pockets = carve_alcoves(random.Random(8899), floor, floor, count=60)
  floor = {c for c in floor if BORDER <= c[0] < W - BORDER and BORDER <= c[1] < H - BORDER}
  for room in rooms:
    room['cells'] &= floor
  rooms = [room for room in rooms if len(room['cells']) >= 9]
  for room in rooms:
    room['anchor'] = room_anchor(room['box'], room['cells'])
  return {'floor': floor, 'rooms': rooms, 'pockets': pockets,
          'hazard': {}, 'lanes': streets & floor}


# --------------------------------------------------------------- 2층 버섯굴
def layout_mushroom():
  """겹쳐 뿌린 셀룰러 오토마타 덩어리 + 폭 1~2의 굽은 터널.

  덩어리끼리 겹치는 것을 막지 않는 게 요점이다 — 방이 방을 먹어 윤곽이 하나로 뭉개진
  형태가 나온다. 1층의 직교 격자와는 정반대다.
  """
  rng_site = random.Random(20260910)
  rng_shape = random.Random(4242)
  rng_link = random.Random(6161)
  floor = set()
  rooms = []
  sites = SiteGrid(16)

  targets = (('landmark', (26, 34), 8), ('large', (18, 25), 40),
             ('medium', (12, 17), 130), ('small', (8, 11), 190))
  for size, span, count in targets:
    placed = 0
    attempts = 0
    while placed < count and attempts < count * 60:
      attempts += 1
      width = rng_site.randint(*span)
      height = rng_site.randint(*span)
      x = rng_site.randint(BORDER + 2, W - BORDER - width - 2)
      y = rng_site.randint(BORDER + 2, H - BORDER - height - 2)
      center = (x + width // 2, y + height // 2)
      if not sites.far_enough(center[0], center[1], max(7, width // 2)):
        continue
      cells = shape_cave(rng_shape, (x, y, x + width, y + height))
      if len(cells) < width * height * 0.3:
        continue
      sites.add(*center)
      floor |= cells
      rooms.append(make_room_record('cave', size, (x, y, x + width, y + height), cells))
      placed += 1

  tunnels = set()
  anchors = [room['anchor'] for room in rooms]
  for i, j in connect_rooms(rng_link, anchors, neighbours=4, loop_ratio=0.18):
    start, end = anchors[i], anchors[j]
    # 굽은 터널 — 중간에 흔든 경유점 하나를 넣어 L자가 아니게 만든다.
    mid = (max(BORDER + 2, min(W - BORDER - 3, (start[0] + end[0]) // 2 + rng_link.randint(-9, 9))),
           max(BORDER + 2, min(H - BORDER - 3, (start[1] + end[1]) // 2 + rng_link.randint(-9, 9))))
    width = rng_link.choice((1, 2, 2, 3))
    tunnels |= carve_line(floor, start, mid, width)
    tunnels |= carve_line(floor, mid, end, width)

  pockets = carve_alcoves(random.Random(7788), floor, floor, count=48)
  floor = {c for c in floor if BORDER <= c[0] < W - BORDER and BORDER <= c[1] < H - BORDER}
  for room in rooms:
    room['cells'] &= floor
  return {'floor': floor, 'rooms': rooms, 'pockets': pockets,
          'hazard': {}, 'lanes': tunnels & floor}


# ------------------------------------------------------------- 3층 물웅덩이
def layout_water():
  """물로 시작해서 둑길만 깎아낸다. 벽이 아니라 물이 방을 나눈다.

  고리 간선을 3%만 주므로 갈림길이 거의 없다 — 몰리면 물러설 데가 없다는 뜻이고,
  그게 이 층의 설계 의도다.
  """
  rng_site = random.Random(20260911)
  rng_shape = random.Random(909)
  rng_link = random.Random(1212)
  water = {(x, y) for y in range(BORDER, H - BORDER) for x in range(BORDER, W - BORDER)}
  walk = set()
  rooms = []
  sites = SiteGrid(16)

  targets = (('landmark', (22, 30), 6), ('large', (15, 21), 34),
             ('medium', (10, 14), 120), ('small', (6, 9), 180))
  for size, span, count in targets:
    placed = 0
    attempts = 0
    while placed < count and attempts < count * 60:
      attempts += 1
      width = rng_site.randint(*span)
      height = rng_site.randint(*span)
      x = rng_site.randint(BORDER + 4, W - BORDER - width - 4)
      y = rng_site.randint(BORDER + 4, H - BORDER - height - 4)
      center = (x + width // 2, y + height // 2)
      if not sites.far_enough(center[0], center[1], width // 2 + 9):
        continue
      kind = rng_site.choice(('oval', 'oval', 'rect', 'merged'))
      cells = make_room(rng_shape, kind, (x, y, x + width, y + height))
      sites.add(*center)
      walk |= cells
      rooms.append(make_room_record(kind, size, (x, y, x + width, y + height), cells))
      placed += 1

  causeways = set()
  anchors = [room['anchor'] for room in rooms]
  for i, j in connect_rooms(rng_link, anchors, neighbours=3, loop_ratio=0.03):
    causeways |= carve_line(walk, anchors[i], anchors[j], rng_link.choice((2, 2, 3)))

  walk = {c for c in walk if BORDER + 1 <= c[0] < W - BORDER - 1
          and BORDER + 1 <= c[1] < H - BORDER - 1}
  for room in rooms:
    room['cells'] &= walk
  rooms = [room for room in rooms if room['cells']]
  hazard = {cell: 'water' for cell in water - walk}
  return {'floor': water, 'rooms': rooms, 'pockets': [],
          'hazard': hazard, 'lanes': causeways & walk}


# --------------------------------------------------------------- 4층 용암굴
def cellular_step(grid):
  """전역 셀룰러 오토마타 한 세대(4-5 규칙). 행 누적합으로 3x3 이웃 세기를 O(1)로 만든다.

  칸마다 이웃 여덟을 직접 세면 384²x8x세대라 파이썬에서 분 단위가 된다.

  이웃 벽이 5 이상이면 벽, 4면 그대로, 3 이하면 바닥이다. **4에서 유지하는 항을 빼면
  안 된다** — 빼고 돌렸더니 네 세대만에 열림 비율이 0.53에서 0.93으로 발산해서
  동굴이 아니라 그냥 빈 들판이 나왔다.
  """
  prefix = []
  for row in grid:
    running = [0] * (W + 1)
    total = 0
    for x in range(W):
      total += row[x]
      running[x + 1] = total
    prefix.append(running)

  nxt = [bytearray(W) for _ in range(H)]
  for y in range(H):
    out = nxt[y]
    rows = [prefix[y + dy] for dy in (-1, 0, 1) if 0 <= y + dy < H]
    outside_rows = 3 - len(rows)
    row = grid[y]
    for x in range(W):
      x0, x1 = max(0, x - 1), min(W, x + 2)
      walls = sum(line[x1] - line[x0] for line in rows)
      walls += (3 - (x1 - x0)) * len(rows) + outside_rows * 3 - row[x]
      out[x] = 1 if walls >= 5 else (row[x] if walls == 4 else 0)
  return nxt


def clearance_map(open_cells):
  """벽까지의 체비쇼프 거리. 두 번 훑는 체임퍼 변환이라 BFS보다 훨씬 싸다."""
  far = W + H
  dist = [[0 if (x, y) not in open_cells else far for x in range(W)] for y in range(H)]
  for y in range(H):
    row = dist[y]
    above = dist[y - 1] if y else None
    for x in range(W):
      if not row[x]:
        continue
      best = row[x - 1] if x else 0
      if above:
        best = min(best, above[x], above[x - 1] if x else 0,
                   above[x + 1] if x + 1 < W else 0)
      else:
        best = 0
      row[x] = best + 1
  for y in range(H - 1, -1, -1):
    row = dist[y]
    below = dist[y + 1] if y + 1 < H else None
    for x in range(W - 1, -1, -1):
      if not row[x]:
        continue
      best = row[x + 1] if x + 1 < W else 0
      if below:
        best = min(best, below[x], below[x + 1] if x + 1 < W else 0,
                   below[x - 1] if x else 0)
      row[x] = min(row[x], best + 1)
  return dist


def keeps_connected(walkable, region):
  """region 을 막아도 그 둘레가 국소적으로 다시 이어지는가.

  둘레 칸들이 region 바깥 30칸 창 안에서 서로 이어지면, region 을 지나던 어떤 경로든
  그 창 안에서 우회할 수 있으므로 전역 연결성은 그대로다. 지형을 놓을 때마다 맵
  전체를 BFS 하면 147k x 수백 번이라 못 쓴다.
  """
  edge = {(x + dx, y + dy) for (x, y) in region for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))}
  border = (edge & walkable) - region
  if len(border) < 2:
    return True
  left = min(x for x, _ in region) - 30
  top = min(y for _, y in region) - 30
  right = max(x for x, _ in region) + 30
  bottom = max(y for _, y in region) + 30
  start = next(iter(border))
  seen = {start}
  queue = deque([start])
  while queue:
    x, y = queue.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
      step = (x + dx, y + dy)
      if (left <= step[0] <= right and top <= step[1] <= bottom
          and step in walkable and step not in region and step not in seen):
        seen.add(step)
        queue.append(step)
  return border <= seen


def thicken_only(cells):
  """가로나 세로 어느 한 축으로 이웃이 하나도 없는 칸을 사라질 때까지 깎는다.

  남은 집합은 어느 칸에서 봐도 좌우 중 하나, 위아래 중 하나에 이웃이 있다 —
  hole 시트의 3x3 오토타일이 항상 그릴 타일을 갖는다는 뜻이다.
  """
  kept = set(cells)
  while True:
    thin = {(x, y) for (x, y) in kept
            if ((x - 1, y) not in kept and (x + 1, y) not in kept)
            or ((x, y - 1) not in kept and (x, y + 1) not in kept)}
    if not thin:
      return kept
    kept -= thin


def layout_lava():
  """맵 전체에 셀룰러 오토마타를 한 번 돌려 만든 이어진 동굴 — 덩어리를 뿌리지 않는다.

  방은 뿌린 게 아니라 **찾은 것**이다. 벽까지의 여유공간이 큰 자리부터 원반을 앉혀
  넓은 방(챔버)을 검출한다. 그래서 방 윤곽이 동굴 윤곽과 같은 손으로 그려진다.
  """
  rng_seed = random.Random(20260912)
  rng_carve = random.Random(5757)
  rng_hazard = random.Random(8080)

  grid = [bytearray(W) for _ in range(H)]
  for y in range(H):
    row = grid[y]
    for x in range(W):
      if not (BORDER <= x < W - BORDER and BORDER <= y < H - BORDER):
        row[x] = 1
      else:
        row[x] = 1 if rng_seed.random() < 0.50 else 0
  for _ in range(6):
    grid = cellular_step(grid)
    for y in range(H):
      row = grid[y]
      for x in range(W):
        if not (BORDER <= x < W - BORDER and BORDER <= y < H - BORDER):
          row[x] = 1

  floor = {(x, y) for y in range(H) for x in range(W) if not grid[y][x]}
  # 낱개 암반은 메운다. 계약대로 벽 덩어리 내부를 안 그리므로, 두세 칸짜리 조각이
  # 남으면 바닥에 검은 점이 흩뿌려진 것처럼 보인다(실제로 그렇게 나왔다).
  # relief 절벽면도 덩어리가 커야 절벽으로 읽힌다.
  interior = {(x, y) for y in range(BORDER, H - BORDER) for x in range(BORDER, W - BORDER)}
  for speck in components(interior - floor):
    if len(speck) < 24:
      floor |= set(speck)
  floor = reconnect(floor, rng_carve)

  # 갈라진 틈 — 동굴을 가로지르는 긴 균열이 큰 방들을 이어 "넓게 트인" 느낌을 만든다.
  # 양 끝을 기존 동굴 칸에서 고르므로 균열이 뜬 섬을 만들지 않는다.
  anchors = sorted(floor)
  for _ in range(18):
    carve_line(floor, rng_carve.choice(anchors), rng_carve.choice(anchors),
               rng_carve.choice((5, 6, 7, 9)))

  dist = clearance_map(floor)
  order = sorted(floor, key=lambda c: -dist[c[1]][c[0]])
  taken = set()
  rooms = []
  for (x, y) in order:
    if len(rooms) >= 340:
      break
    radius = min(dist[y][x] - 1, 9)
    if radius < 2 or (x, y) in taken:
      continue
    box = (x - radius, y - radius, x + radius + 1, y + radius + 1)
    cells = shape_oval(box) & floor
    if len(cells) < 12:
      continue
    taken |= shape_oval((x - radius - 1, y - radius - 1, x + radius + 2, y + radius + 2))
    size = 'landmark' if radius >= 8 else ('large' if radius >= 6 else
                                           ('medium' if radius >= 4 else 'small'))
    rooms.append(make_room_record('cave', size, box, cells))

  # 용암 줄기 — 좁은 자리를 따라 흐르되 중간중간 건널목을 낸다. 용암이 동굴을 통째로
  # 가로지르면 그 너머가 통째로 도달 불가가 된다.
  hazard = {}
  narrow = order[len(order) // 2:]
  for _ in range(110):
    start = rng_hazard.choice(narrow)
    end = rng_hazard.choice(narrow)
    if abs(start[0] - end[0]) + abs(start[1] - end[1]) > 170:
      continue
    # 경유점 셋을 흔들어 꺾는다 — L자 한 번이면 용암이 곧은 파이프로 보인다.
    width = rng_hazard.choice((2, 3, 4, 5))
    stream = set()
    cursor = start
    for step in range(1, 4):
      via = (start[0] + (end[0] - start[0]) * step // 3 + rng_hazard.randint(-12, 12),
             start[1] + (end[1] - start[1]) * step // 3 + rng_hazard.randint(-12, 12))
      via = (max(BORDER + 2, min(W - BORDER - 3, via[0])),
             max(BORDER + 2, min(H - BORDER - 3, via[1])))
      stream |= carve_line(stream, cursor, via, width)
      cursor = via
    # 건널목 — 용암이 동굴을 통째로 가로지르면 그 너머가 전부 도달 불가가 된다.
    for _ in range(3):
      gap = rng_hazard.choice(sorted(stream))
      stream -= shape_rect((gap[0] - 3, gap[1] - 3, gap[0] + 4, gap[1] + 4))
    # 가장자리를 갉아 직사각형 티를 없앤다.
    stream = {cell for cell in stream
              if rng_hazard.random() > 0.2
              or all((cell[0] + dx, cell[1] + dy) in stream
                     for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))}
    # 줄기를 10칸 격자로 토막 내 토막마다 판정한다. 통째로 판정하면 좁은 목 한 곳
    # 때문에 강 전체가 버려지고(실측: 110개 중 거의 전부), 그렇다고 그냥 놓으면
    # 강 너머가 통째로 도달 불가가 된다. 토막이면 막히는 곳만 건널목으로 남는다.
    blocks = {}
    for cell in (stream & floor) - set(hazard):
      blocks.setdefault((cell[0] // 10, cell[1] // 10), set()).add(cell)
    for piece in blocks.values():
      if keeps_connected(floor - set(hazard), piece):
        for cell in piece:
          hazard[cell] = 'lava'

  # 낭떠러지 — 사각형 합집합을 동굴 안쪽으로 자른 뒤, 가로·세로 어느 쪽으로도 이웃이
  # 없는 칸을 깎아낸다. hole 시트가 3x3 오토타일이라 폭 1짜리 조각엔 그릴 타일이 없다.
  inner = {cell for cell in floor if dist[cell[1]][cell[0]] >= 2}
  for _ in range(420):
    x = rng_hazard.randint(BORDER + 6, W - BORDER - 20)
    y = rng_hazard.randint(BORDER + 6, H - BORDER - 20)
    pit = set()
    for _ in range(rng_hazard.randint(2, 5)):
      width = rng_hazard.randint(4, 10)
      height = rng_hazard.randint(4, 9)
      ox = x + rng_hazard.randint(-5, 5)
      oy = y + rng_hazard.randint(-5, 5)
      pit |= shape_rect((ox, oy, ox + width, oy + height))
    # 벽에서 한 칸 이상 떨어진 자리로 잘라낸다. 벽에 닿는 구덩이는 좁은 목을 그대로
    # 틀어막는다. 반대로 통째로 들어갈 자리만 찾으면 이 동굴에선 한 개도 못 놓는다
    # (실측: 420번 시도해 1개).
    pit = thicken_only(pit & inner)
    if len(pit) < 12 or pit & set(hazard):
      continue
    if not keeps_connected(floor - set(hazard), pit):
      continue
    for cell in pit:
      hazard[cell] = 'hole'

  pockets = carve_alcoves(random.Random(4949), floor, floor - set(hazard), count=40)
  floor = {c for c in floor if BORDER <= c[0] < W - BORDER and BORDER <= c[1] < H - BORDER}
  hazard = {cell: kind for cell, kind in hazard.items() if cell in floor}
  for room in rooms:
    room['cells'] &= floor
  return {'floor': floor, 'rooms': rooms, 'pockets': pockets,
          'hazard': hazard, 'lanes': set()}


def components(cells):
  """4-이웃으로 이어진 덩어리들. 큰 것부터 돌려준다."""
  seen = set()
  found = []
  for cell in cells:
    if cell in seen:
      continue
    queue = deque([cell])
    seen.add(cell)
    group = [cell]
    while queue:
      x, y = queue.popleft()
      for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        step = (x + dx, y + dy)
        if step in cells and step not in seen:
          seen.add(step)
          group.append(step)
          queue.append(step)
    found.append(group)
  found.sort(key=len, reverse=True)
  return found


def reconnect(floor, rng):
  """떨어진 동굴 조각을 가장 큰 조각으로 파서 잇는다.

  가장 큰 성분에서 벽을 통과하는 다중 시작 BFS를 한 번 돌려 부모 사슬을 만들고,
  나머지 성분마다 그 사슬을 따라 되짚어 굴을 뚫는다. 성분마다 따로 탐색하면
  성분 수 x 147k 가 되어 못 쓴다.
  """
  groups = components(floor)
  if len(groups) < 2:
    return floor

  parent = {}
  queue = deque(groups[0])
  reached = set(groups[0])
  while queue:
    x, y = queue.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
      step = (x + dx, y + dy)
      if (BORDER <= step[0] < W - BORDER and BORDER <= step[1] < H - BORDER
          and step not in reached):
        reached.add(step)
        parent[step] = (x, y)
        queue.append(step)

  for group in groups[1:]:
    if len(group) < 20:
      floor -= set(group)
      continue
    cursor = rng.choice(group)
    tunnel = set()
    while cursor in parent:
      tunnel.add(cursor)
      cursor = parent[cursor]
    for (x, y) in tunnel:
      for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
          if BORDER <= x + dx < W - BORDER and BORDER <= y + dy < H - BORDER:
            floor.add((x + dx, y + dy))
  return floor


# ---------------------------------------------------------- 5층 구덩이의 눈
HALL_MARGIN = 14
BAY_STEP = 16
PILLAR_STEP = 8


def layout_deep():
  """통로도 분기도 없는 홀 하나. 방은 판 것이 아니라 열주가 나눈 베이다.

  거대한 타원 하나를 트고 8칸 간격 열주를 세운다. 베이는 서로 완전히 열려 있어
  구조상 '방 하나'지만, 몬스터·장식·전투가 벌어지는 단위로는 300개가 넘는다.

  바닥 무늬가 곧 이 층의 이름이다 — 한복판의 동공, 그 둘레 홍채 고리 넷, 사방으로
  뻗은 살 열둘. 이걸 안 깔면 356지름짜리 원반이 아무 무늬 없는 살구색 벌판이 된다
  (실제로 그렇게 나왔다).
  """
  rng_bay = random.Random(20260913)
  hall = shape_oval((HALL_MARGIN, HALL_MARGIN, W - HALL_MARGIN, H - HALL_MARGIN))
  floor = set(hall)
  center = (W // 2, H // 2)

  def disc(radius):
    return shape_oval((center[0] - radius, center[1] - radius,
                       center[0] + radius, center[1] + radius))

  pupil = disc(16)
  pattern = set(pupil)
  for radius, width in ((40, 5), (78, 4), (116, 4), (150, 6)):
    pattern |= disc(radius) - disc(radius - width)
  # 살은 홍채 안에서만 뻗는다. 테두리까지 그으면 눈이 아니라 수레바퀴로 읽힌다.
  for index in range(12):
    angle = math.pi * index / 6
    step_x, step_y = math.cos(angle), math.sin(angle)
    for distance in range(22, 148):
      x = center[0] + int(round(step_x * distance))
      y = center[1] + int(round(step_y * distance))
      pattern |= {(x + dx, y + dy) for dy in (-1, 0, 1) for dx in (-1, 0, 1)}
  pattern &= hall

  pillars = set()
  for py in range(HALL_MARGIN + PILLAR_STEP // 2, W - HALL_MARGIN, PILLAR_STEP):
    for px in range(HALL_MARGIN + PILLAR_STEP // 2, W - HALL_MARGIN, PILLAR_STEP):
      # 열주는 사방이 완전히 트인 자리에만 세운다 — 홀 가장자리에서 통행을 자르지 않게.
      if all((px + dx, py + dy) in hall
             for dy in (-2, -1, 0, 1, 2) for dx in (-2, -1, 0, 1, 2)):
        pillars.add((px, py))
  pillars -= disc(21)
  # 동공을 두르는 열주 고리 — 마지막 방이 열린 벌판이 아니라 신전으로 읽히게.
  pillars |= {cell for cell in disc(21) - disc(19) if (cell[0] + cell[1]) % 3 == 0}

  rooms = []
  origin = HALL_MARGIN + BAY_STEP // 2
  for py in range(origin, W - HALL_MARGIN, BAY_STEP):
    for px in range(origin, W - HALL_MARGIN, BAY_STEP):
      box = (px, py, px + BAY_STEP, py + BAY_STEP)
      cells = shape_rect(box) & hall
      if len(cells) < BAY_STEP ** 2 * 0.75:
        continue
      size = 'medium' if len(cells) == BAY_STEP ** 2 else 'small'
      rooms.append(make_room_record('rect', size, box, cells))

  rooms.append(make_room_record('hall', 'landmark',
                                (center[0] - 16, center[1] - 16,
                                 center[0] + 16, center[1] + 16), pupil))
  rng_bay.shuffle(rooms)
  return {'floor': floor, 'rooms': rooms, 'pockets': [], 'hazard': {},
          'lanes': set(), 'pillars': pillars, 'altar': pattern}


# --------------------------------------------------------------------- 층 정의
FLOORS = [
  {
    'index': 1, 'stem': 'floor-1-ruins', 'name': '폐허 마을', 'verse': '돌을 베고 자거라',
    'gate': (BORDER, BORDER), 'level': 3, 'layout': layout_ruins,
    'walls': interior_wall_faces(green=False),
    'wallDeco': [BANNER_DECO, gid('wall', 7, 1)],
    'ground': GRAVEL_FLOOR, 'patch': BRICK_FLOOR, 'lane': EARTH_ROAD, 'rug': None,
    'decals': ((RUBBLE_DECAL, 5), (GRASS_DECAL, 4), (DUST_DECAL, 3)), 'decalDensity': 1.0,
    'propsWall': RUIN_POTS + POT_PROPS, 'propsCluster': RUIN_ROCKS,
    'propsScatter': RUIN_BUSHES + RUIN_STUMPS, 'blockProps': RUIN_TREES,
    'monsters': ['slime', 'mushroom', 'larva', 'mole'], 'boss': 'giantspirit',
    'bossLevel': 6, 'chestTier': (1, 2),
  },
  {
    'index': 2, 'stem': 'floor-2-mushroom', 'name': '버섯굴', 'verse': '흙을 덮고 자거라',
    'gate': (W - BORDER, BORDER), 'level': 9, 'layout': layout_mushroom,
    'walls': interior_wall_faces(green=True),
    'wallDeco': [gid('wall', 7, 6)],
    'ground': MOSS_FLOOR, 'patch': DEEP_MOSS_FLOOR, 'lane': MUD_FLOOR, 'rug': None,
    'decals': ((GRASS_DECAL, 5), (FUNGUS_DECAL, 5), (RUBBLE_DECAL, 2)), 'decalDensity': 1.0,
    'propsWall': POT_PROPS, 'propsCluster': GREEN_CRYSTALS,
    'propsScatter': ROCK_PROPS + RUIN_BUSHES, 'blockProps': [],
    'monsters': ['mushroom', 'mushroom2', 'bamboo', 'mollusc', 'mollusc2', 'larva', 'larva2'],
    'boss': 'giantracoon', 'bossLevel': 13, 'chestTier': (1, 2),
  },
  {
    'index': 3, 'stem': 'floor-3-water', 'name': '물웅덩이', 'verse': '물은 발치에 두고',
    'gate': (BORDER, H - BORDER), 'level': 16, 'layout': layout_water,
    'walls': interior_wall_faces(green=True),
    'wallDeco': [gid('wall', 7, 6)],
    'ground': STONE_FLOOR, 'patch': WET_FLOOR, 'lane': WET_FLOOR, 'rug': JADE_RUG,
    'decals': ((PALE_DECAL, 5), (GRASS_DECAL, 3), (RUBBLE_DECAL, 2)), 'decalDensity': 0.9,
    'propsWall': POT_PROPS, 'propsCluster': BLUE_CRYSTALS,
    'propsScatter': ROCK_PROPS, 'blockProps': [],
    'monsters': ['octopus', 'octopus2', 'snake', 'snake2', 'snake3', 'snake4',
                 'reptile', 'reptile2', 'lizard', 'lizard2'],
    'boss': 'giantfrog', 'bossLevel': 20, 'chestTier': (2, 3),
  },
  {
    'index': 4, 'stem': 'floor-4-lava', 'name': '용암굴', 'verse': '불은 머리맡에 두고',
    'gate': (W - BORDER, H - BORDER), 'level': 23, 'layout': layout_lava,
    'walls': relief_wall_faces(), 'wallDeco': [],
    'ground': BASALT_FLOOR, 'patch': BASALT_PATCH, 'lane': BASALT_PATCH, 'rug': None,
    'decals': ((BLOOD_DECAL, 5), (RUBBLE_DECAL, 3), (DUST_DECAL, 2)), 'decalDensity': 0.5,
    'propsWall': POT_PROPS, 'propsCluster': EMBER_CRYSTALS,
    'propsScatter': ROCK_PROPS + BRAZIER_PROPS, 'blockProps': [],
    'monsters': ['flam', 'flam2', 'spirit', 'spirit2', 'eye', 'eye2',
                 'beast', 'beast2', 'dragon', 'dragonyellow'],
    'boss': 'giantflam', 'bossLevel': 28, 'chestTier': (2, 3),
  },
  {
    'index': 5, 'stem': 'floor-5-deep', 'name': '구덩이의 눈',
    'verse': '무섭거든 내 목소리를 세어라', 'gate': (W // 2, BORDER), 'level': 30,
    'layout': layout_deep, 'walls': ring_wall_faces(), 'wallDeco': [],
    'ground': GOLD_FLOOR, 'patch': PALE_GOLD_FLOOR, 'lane': PALE_GOLD_FLOOR, 'rug': GOLD_RUG,
    'decals': ((DUST_DECAL, 5), (PALE_DECAL, 3), (BONE_DECAL, 1)), 'decalDensity': 0.45,
    'propsWall': ALTAR_PROPS, 'propsCluster': EYE_CRYSTALS,
    'propsScatter': GRAVE_PROPS, 'blockProps': [],
    'monsters': ['cyclope', 'cyclope2', 'skull', 'skullblue'],
    'boss': 'demoncyclop', 'bossLevel': 35, 'chestTier': (3, 3),
  },
]


# ------------------------------------------------------------- 막는 것 배치
def place_props(rng, spec, rooms, walkable, blocked):
  """항아리·바위·수정. 벽에 붙이거나 덩어리로 뭉치되, 좁은 목은 절대 막지 않는다."""
  props = {}

  def free(cell):
    """여덟 이웃이 전부 빈 바닥인 칸에만 놓는다.

    그러면 소품이 서로 붙지 못하고 둘레 여덟 칸이 끊기지 않은 고리로 남아, 한 칸을
    막아도 통행이 절대 끊기지 않는다(느슨한 판정으로 놓았더니 수정 광맥 한 덩이가
    방 하나를 통째로 봉해 맵의 85%가 도달 불가가 됐다).
    """
    x, y = cell
    if cell in blocked or cell in props:
      return False
    return all(
      (x + dx, y + dy) in walkable
      and (x + dx, y + dy) not in blocked and (x + dx, y + dy) not in props
      for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dx or dy)
    )

  for room in rooms:
    cells = sorted(room['cells'])
    if not cells:
      continue
    for cell in cells:
      x, y = cell
      touches_wall = any((x + dx, y + dy) not in walkable
                         for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)))
      if touches_wall and rng.random() < 0.09 and free(cell):
        props[cell] = rng.choice(spec['propsWall'])
    for _ in range(len(cells) // 240 + 1):
      seed = rng.choice(cells)
      for cell in blob(rng, seed, 3, 2):
        if cell in room['cells'] and rng.random() < 0.32 and free(cell):
          props[cell] = rng.choice(spec['propsCluster'])
    for cell in cells:
      if rng.random() < 0.02 and free(cell):
        props[cell] = rng.choice(spec['propsScatter'])
  return props


def place_block_props(rng, spec, rooms, walkable, blocked, props):
  """여러 칸짜리 소품(1층의 나무). 블록과 그 둘레 한 칸이 전부 빈 바닥일 때만 세운다."""
  stamps = {}
  for room in rooms:
    if not spec['blockProps'] or len(room['cells']) < 60 or rng.random() < 0.55:
      continue
    grid = rng.choice(spec['blockProps'])
    height, width = len(grid), len(grid[0])
    left, top, right, bottom = room['box']
    for _ in range(6):
      x = rng.randint(left + 1, max(left + 1, right - width - 1))
      y = rng.randint(top + 1, max(top + 1, bottom - height - 1))
      block = shape_rect((x, y, x + width, y + height))
      ring = {(cx + dx, cy + dy) for (cx, cy) in block
              for dy in (-1, 0, 1) for dx in (-1, 0, 1)}
      if not ring <= walkable or ring & blocked or ring & set(props) or ring & set(stamps):
        continue
      for row in range(height):
        for column in range(width):
          stamps[(x + column, y + row)] = grid[row][column]
      break
  return stamps


# -------------------------------------------------------------------- 페인팅
def paint_ground(spec, floor, rooms, hazard, lanes, altar):
  rng_floor = random.Random(4242 + spec['index'])
  rng_patch = random.Random(1717 + spec['index'])
  rng_stage = random.Random(55501 + spec['index'])
  ground = [[0] * W for _ in range(H)]

  patch = set()
  for _ in range((W - 2 * BORDER) * (H - 2 * BORDER) // 1400):
    center = (rng_patch.randint(BORDER, W - BORDER - 1), rng_patch.randint(BORDER, H - BORDER - 1))
    patch |= blob(rng_patch, center, 5, 3)

  for (x, y) in floor:
    palette = spec['patch'] if (x, y) in patch else spec['ground']
    ground[y][x] = rng_floor.choice(palette)

  # 길/터널/둑길은 다른 재질이다 — 이동 구간이 방과 같은 바닥이면 지도가 평평해진다.
  for (x, y) in lanes:
    ground[y][x] = rng_floor.choice(spec['lane'])

  # 큰 방마다 다른 무대를 깐다. 늘 십자 융단이면 그 십자 자체가 "생성됨" 표식이 된다.
  for room in rooms:
    if room['size'] not in ('medium', 'large', 'landmark') or not room['cells']:
      continue
    plan = rng_stage.choices(('none', 'east_west', 'north_south', 'cross', 'ring'),
                             weights=(5, 3, 3, 2, 2))[0]
    left, top, right, bottom = room['box']
    anchor_x, anchor_y = room['anchor']
    lane_cells = []
    if plan in ('east_west', 'cross'):
      lane_cells += [(x, y) for x in range(left, right) for y in (anchor_y, anchor_y + 1)]
    if plan in ('north_south', 'cross'):
      lane_cells += [(x, y) for y in range(top, bottom) for x in (anchor_x, anchor_x + 1)]
    if plan == 'ring':
      lane_cells += [(x, y) for x in range(left + 2, right - 2) for y in (top + 2, bottom - 3)]
      lane_cells += [(x, y) for y in range(top + 2, bottom - 2) for x in (left + 2, right - 3)]
    for (x, y) in lane_cells:
      if (x, y) in room['cells']:
        ground[y][x] = rng_floor.choice(spec['patch'])
    if spec['rug'] and room['size'] in ('large', 'landmark') and rng_stage.random() < 0.5:
      stamp_rug(ground, spec['rug'], room['anchor'], room['cells'])

  # 구덩이의 눈 — 동공·홍채 고리·살. 바닥 무늬만으로 홀에 방향과 중심을 준다.
  for (x, y) in altar:
    ground[y][x] = rng_floor.choice(spec['patch'])
  if altar and spec['rug']:
    center = (W // 2, H // 2)
    for offset in (-4, 0, 4):
      stamp_rug(ground, spec['rug'], (center[0] + offset, center[1]), altar)
      stamp_rug(ground, spec['rug'], (center[0], center[1] + offset), altar)

  paint_hazard(ground, hazard, rng_floor)
  return ground


def stamp_rug(ground, rug, center, cells):
  """4x4 문양 융단. 시트의 배치 순서를 그대로 찍어야 문양이 이어진다."""
  origin_x, origin_y = center[0] - 2, center[1] - 2
  block = [(origin_x + c, origin_y + r) for r in range(4) for c in range(4)]
  if not all(cell in cells for cell in block):
    return
  for r in range(4):
    for c in range(4):
      ground[origin_y + r][origin_x + c] = rug[r][c]


def paint_hazard(ground, hazard, rng):
  water = {cell for cell, kind in hazard.items() if kind == 'water'}
  hole = {cell for cell, kind in hazard.items() if kind == 'hole'}
  for cell, kind in hazard.items():
    if kind == 'lava':
      ground[cell[1]][cell[0]] = rng.choice(LAVA_FILL)
  for (x, y) in water:
    ground[y][x] = water_gid(water, x, y, rng)
  for (x, y) in hole:
    ground[y][x] = hole_gid(hole, x, y)


def water_gid(water, x, y, rng):
  north, south = (x, y - 1) in water, (x, y + 1) in water
  west, east = (x - 1, y) in water, (x + 1, y) in water
  if not north and not south:
    return WATER_FACES['H_W'] if not west else (WATER_FACES['H_E'] if not east
                                                else WATER_FACES['H_C'])
  if not west and not east:
    return WATER_FACES['V_N'] if not north else (WATER_FACES['V_S'] if not south
                                                 else WATER_FACES['V_C'])
  if not north:
    return WATER_FACES['NW'] if not west else (WATER_FACES['NE'] if not east
                                               else WATER_FACES['N'])
  if not south:
    return WATER_FACES['SW'] if not west else (WATER_FACES['SE'] if not east
                                               else WATER_FACES['S'])
  if not west:
    return WATER_FACES['W']
  if not east:
    return WATER_FACES['E']
  return rng.choice(WATER_RIPPLE) if rng.random() < 0.06 else WATER_FACES['C']


def hole_gid(hole, x, y):
  north, south = (x, y - 1) in hole, (x, y + 1) in hole
  west, east = (x - 1, y) in hole, (x + 1, y) in hole
  vertical = 'N' if not north else ('S' if not south else '')
  horizontal = 'W' if not west else ('E' if not east else '')
  return HOLE_FACES.get(vertical + horizontal) or HOLE_FACES[vertical or horizontal or 'C']


def paint_decals(spec, rooms, walkable, blocked):
  """장식은 뭉쳐 찍는다 — 균일 스프링클은 노이즈로, 덩어리는 연출로 읽힌다."""
  rng = random.Random(9111 + spec['index'])
  deco = [[0] * W for _ in range(H)]
  families = [family for family, _ in spec['decals']]
  weights = [weight for _, weight in spec['decals']]
  scale = spec['decalDensity']

  def sprinkle(cells, primary, secondary, density):
    # 덩어리 안에서도 4분의 1은 다른 계열로 — 한 계열만 쓰면 같은 타일 두 장이
    # 줄지어 반복돼 해골 카펫처럼 보인다.
    for (x, y) in cells:
      if (x, y) in walkable and (x, y) not in blocked and rng.random() < density:
        deco[y][x] = rng.choice(secondary if rng.random() < 0.25 else primary)

  for room in rooms:
    cells = sorted(room['cells'])
    if not cells:
      continue
    for _ in range(max(1, int(len(cells) // 62 * scale))):
      center = rng.choice(cells)
      primary, secondary = rng.choices(families, weights=weights, k=2)
      sprinkle(blob(rng, center, 3, 2) & room['cells'], primary, secondary, 0.6 * scale)

  # 통로에도 부스러기를 흘린다 — 방만 꾸미면 이동 구간이 텅 빈 실로 남는다.
  in_room = set()
  for room in rooms:
    in_room |= room['cells']
  corridor = sorted(walkable - in_room)
  for _ in range(int(len(corridor) // 70 * scale)):
    center = rng.choice(corridor)
    primary, secondary = rng.choices(families, weights=weights, k=2)
    sprinkle(blob(rng, center, 2, 2) & walkable, primary, secondary, 0.5 * scale)
  return deco


def paint_shadow(walkable, blocked_props, engraved):
  """벽·물·용암·낭떠러지에 접한 바닥의 그늘. 레이어 불투명도 0.35가 이걸 그림자로 만든다.

  engraved 는 바닥에 새긴 홈이다(5층의 눈 무늬). 이 팔레트 안에서 황금 장식 바닥과
  대비가 나는 바닥 타일이 없어서 — 같은 블록 안 밝기가 172~180으로 다 붙어 있다 —
  무늬를 바닥 재질로 그리면 아무것도 안 보인다. 0.35 그늘이면 확실히 읽힌다.
  """
  shadow = [[0] * W for _ in range(H)]
  for (x, y) in walkable:
    if (x, y - 1) not in walkable or (x - 1, y) not in walkable:
      shadow[y][x] = SHADOW_TILE
  for (x, y) in engraved:
    shadow[y][x] = SHADOW_TILE
  for (x, y) in blocked_props:
    shadow[y][x] = SHADOW_TILE
  return shadow


def paint_walls(floor, faces):
  """바닥에 접한 벽 셀만 면/모서리 타일을 얹는다. 덩어리 내부는 배경색 그대로 둔다."""
  wall = [[0] * W for _ in range(H)]
  for y in range(H):
    row = wall[y]
    for x in range(W):
      if (x, y) in floor:
        continue

      def at(dx, dy):
        return (x + dx, y + dy) in floor

      south, north, west, east = at(0, 1), at(0, -1), at(-1, 0), at(1, 0)
      # 세 면 이상이 바닥이면 벽면을 그릴 방향이 없다 — 낱개 블록으로 노두처럼 세운다.
      if south + north + west + east >= 3:
        row[x] = faces['PILLAR']
        continue
      # 두 면이 바닥이면 덩어리가 대각으로 물러나 있다. 방 바깥 모서리와 같은 타일을 쓴다 —
      # 한 면만 보고 고르면 암반 조각이 위아래 뒤집힌 벽면으로 그려진다.
      if south and east:
        key = 'CORNER_TL'
      elif south and west:
        key = 'CORNER_TR'
      elif north and east:
        key = 'CORNER_BL'
      elif north and west:
        key = 'CORNER_BR'
      elif south:
        key = 'S'
      elif north:
        key = 'N'
      elif west:
        key = 'W'
      elif east:
        key = 'E'
      elif at(1, 1):
        key = 'CORNER_TL'
      elif at(-1, 1):
        key = 'CORNER_TR'
      elif at(1, -1):
        key = 'CORNER_BL'
      elif at(-1, -1):
        key = 'CORNER_BR'
      else:
        continue
      row[x] = faces[key]
  return wall


def paint_wall_deco(spec, floor):
  """벽면(남쪽이 바닥인 벽)에 일정 간격으로 창살·현수막을 건다."""
  if not spec['wallDeco']:
    return [[0] * W for _ in range(H)]
  rng = random.Random(2468 + spec['index'])
  deco = [[0] * W for _ in range(H)]
  gap = 0
  for y in range(H):
    for x in range(W):
      if (x, y) in floor or (x, y + 1) not in floor:
        continue
      gap += 1
      if gap < rng.randint(13, 26):
        continue
      gap = 0
      deco[y][x] = rng.choice(spec['wallDeco'])
  return deco


# ------------------------------------------------------------------ 스폰 배치
def reachable_from(walk, start):
  seen = [[False] * W for _ in range(H)]
  queue = deque([start])
  seen[start[1]][start[0]] = True
  count = 1
  while queue:
    x, y = queue.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
      nx, ny = x + dx, y + dy
      if 0 <= nx < W and 0 <= ny < H and walk[ny][nx] and not seen[ny][nx]:
        seen[ny][nx] = True
        count += 1
        queue.append((nx, ny))
  return seen, count


def place_spawns(spec, rooms, walkable, pockets, entrance, boss_room):
  rng = random.Random(5150 + spec['index'])
  monsters, chests = [], []
  pack_id = 0
  low, high = spec['chestTier']

  for room in rooms:
    cells = sorted(room['cells'] & walkable)
    if len(cells) < 12 or rng.random() < 0.28:
      continue
    pack_id += 1
    kind = rng.choice(spec['monsters'])
    size = rng.randint(3, 8) if room['size'] in ('large', 'landmark') else rng.randint(2, 5)
    for cell in rng.sample(cells, min(size, len(cells))):
      monsters.append({'kind': kind, 'level': max(1, spec['level'] + rng.randint(-2, 2)),
                       'pack': pack_id, 'x': cell[0], 'y': cell[1]})
    if rng.random() < 0.22:
      cell = rng.choice(cells)
      chests.append({'tier': rng.randint(low, high), 'x': cell[0], 'y': cell[1]})

  # 막다른 골방은 전부 보물방이다 — 그게 골방을 파는 이유다.
  for cell in pockets:
    if cell in walkable:
      chests.append({'tier': high, 'x': cell[0], 'y': cell[1]})

  boss_cell = min(boss_room['cells'] & walkable,
                  key=lambda c: abs(c[0] - boss_room['anchor'][0])
                  + abs(c[1] - boss_room['anchor'][1]))
  bosses = [{'kind': spec['boss'], 'level': spec['bossLevel'],
             'x': boss_cell[0], 'y': boss_cell[1]}]

  # 스폰은 몬스터 배치와 무관하게 고르므로, 입구 방이 무리를 받으면 플레이어가 무리
  # 한가운데에 떨어진다. 잡몹 인지 반경만큼은 비워 첫 프레임부터 전투가 되지 않게 한다.
  monsters = [monster for monster in monsters
              if max(abs(monster['x'] - entrance[0]), abs(monster['y'] - entrance[1]))
              > SPAWN_SAFE_RADIUS
              and max(abs(monster['x'] - boss_cell[0]), abs(monster['y'] - boss_cell[1])) > 4]
  return monsters, chests, bosses


def pick_far_room(rooms, origin):
  return max(rooms, key=lambda room: abs(room['anchor'][0] - origin[0])
             + abs(room['anchor'][1] - origin[1]) + len(room['cells']) * 0.02)


def adjacent_walkable(cell, walkable):
  for dx, dy in ((0, 1), (1, 0), (0, -1), (-1, 0)):
    step = (cell[0] + dx, cell[1] + dy)
    if step in walkable:
      return step
  return cell


# ---------------------------------------------------------------------- 검증
def validate(spec, walk, floor, layers, spawn, monsters, chests, bosses):
  walkable = sum(sum(row) for row in walk)
  seen, reached = reachable_from(walk, spawn)
  unreachable = walkable - reached
  if unreachable:
    raise SystemExit(f'{spec["stem"]}: 도달 불가 바닥 {unreachable} 칸')

  for label, items in (('몬스터', monsters), ('상자', chests), ('보스', bosses)):
    bad = [item for item in items if not seen[item['y']][item['x']]]
    if bad:
      raise SystemExit(f'{spec["stem"]}: 도달 불가 {label} {len(bad)}개 (예: {bad[0]})')

  for x in range(W):
    if (x, 0) in floor or (x, H - 1) in floor:
      raise SystemExit(f'{spec["stem"]}: 외곽이 열려 있습니다.')
  for y in range(H):
    if (0, y) in floor or (W - 1, y) in floor:
      raise SystemExit(f'{spec["stem"]}: 외곽이 열려 있습니다.')

  for name, layer in layers:
    for y in range(H):
      for value in layer[y]:
        if value and not (1 <= value <= TILECOUNT):
          raise SystemExit(f'{spec["stem"]}: {name} gid {value} 가 아틀라스를 벗어납니다.')

  collision = dict(layers)['collision']
  for y in range(H):
    for x in range(W):
      if bool(collision[y][x]) == bool(walk[y][x]):
        raise SystemExit(f'{spec["stem"]}: ({x},{y}) 충돌 레이어와 통행 가능 집합이 어긋납니다.')
  return walkable, reached


def validate_stairs(results):
  """왕복이 성립하는지 — 하행의 도착점이 대상 층 상행 옆이고, 그 반대도 성립해야 한다."""
  by_stem = {result['spec']['stem']: result for result in results}
  for result in results:
    for stair in result['stairs']:
      target = by_stem.get(stair['target'])
      if not target:
        raise SystemExit(f'{result["spec"]["stem"]}: 계단 대상 {stair["target"]} 이 없습니다.')
      if not target['walk'][stair['targetY']][stair['targetX']]:
        raise SystemExit(f'{result["spec"]["stem"]}: 계단 도착점이 통행 불가입니다.')
      mirror = 'stairs_up' if stair['class'] == 'stairs_down' else 'stairs_down'
      partner = next((s for s in target['stairs'] if s['class'] == mirror
                      and s['target'] == result['spec']['stem']), None)
      if not partner:
        raise SystemExit(f'{result["spec"]["stem"]}: {stair["target"]} 에 짝 계단이 없습니다.')
      if max(abs(partner['x'] - stair['targetX']), abs(partner['y'] - stair['targetY'])) > 1:
        raise SystemExit(f'{result["spec"]["stem"]}: 도착점이 짝 계단 옆이 아닙니다.')
      if max(abs(partner['targetX'] - stair['x']), abs(partner['targetY'] - stair['y'])) > 1:
        raise SystemExit(f'{result["spec"]["stem"]}: 되돌아오는 도착점이 어긋납니다.')


# ------------------------------------------------------------------ TMX 출력
def csv_layer(layer):
  return ',\n'.join(','.join(map(str, row)) for row in layer)


def layer_xml(layer_id, name, data, opacity, visible):
  attributes = f'id="{layer_id}" name="{name}" width="{W}" height="{H}"'
  if opacity != 1.0:
    attributes += f' opacity="{opacity}"'
  if not visible:
    attributes += ' visible="0"'
  return (
    f' <layer {attributes}>\n'
    f'  <data encoding="csv">\n{csv_layer(data)}\n</data>\n'
    f' </layer>\n'
  )


def object_xml(object_id, name, class_name, x, y, properties, width=TILE, height=TILE):
  lines = [
    f'  <object id="{object_id}" name="{name}" class="{class_name}"'
    f' x="{x * TILE}" y="{y * TILE}" width="{width}" height="{height}">'
  ]
  if properties:
    lines.append('   <properties>')
    for key, value in properties.items():
      kind = 'int' if isinstance(value, int) else 'string'
      lines.append(f'    <property name="{key}" type="{kind}" value="{value}"/>')
    lines.append('   </properties>')
  lines.append('  </object>')
  return '\n'.join(lines) + '\n'


def write_tmx(result):
  spec = result['spec']
  path = os.path.join(OUT_DIR, f'{spec["stem"]}.tmx')
  os.makedirs(OUT_DIR, exist_ok=True)
  parts = [
    '<?xml version="1.0" encoding="UTF-8"?>\n',
    f'<map version="1.10" tiledversion="1.12.1" orientation="orthogonal"'
    f' renderorder="right-down" width="{W}" height="{H}"'
    f' tilewidth="{TILE}" tileheight="{TILE}" infinite="0"'
    f' nextlayerid="20" nextobjectid="90000" backgroundcolor="{BACKGROUND}">\n',
    f' <tileset firstgid="1" source="{TILESET_REF}"/>\n',
  ]
  for index, (name, data) in enumerate(result['layers']):
    parts.append(layer_xml(10 + index, name, data,
                           opacity=0.35 if name == 'shadow' else 1.0,
                           visible=name != 'collision'))

  next_id = 1
  spawn = result['spawn']
  parts.append(' <objectgroup id="2" name="spawns">\n')
  parts.append(object_xml(next_id, 'player_spawn', 'player_spawn', spawn[0], spawn[1], {}))
  next_id += 1
  parts.append(' </objectgroup>\n')

  parts.append(' <objectgroup id="3" name="zones">\n')
  parts.append(object_xml(
    next_id, spec['name'], 'zone', BORDER, BORDER,
    {'zoneId': spec['index'], 'name': spec['name'], 'level': spec['level']},
    width=(W - 2 * BORDER) * TILE, height=(H - 2 * BORDER) * TILE,
  ))
  next_id += 1
  parts.append(' </objectgroup>\n')

  parts.append(' <objectgroup id="4" name="monsters">\n')
  for monster in result['monsters']:
    parts.append(object_xml(
      next_id, monster['kind'], 'monster', monster['x'], monster['y'],
      {'kind': monster['kind'], 'level': monster['level'], 'pack': monster['pack']},
    ))
    next_id += 1
  parts.append(' </objectgroup>\n')

  parts.append(' <objectgroup id="5" name="chests">\n')
  for chest in result['chests']:
    parts.append(object_xml(next_id, 'chest', 'chest', chest['x'], chest['y'],
                            {'tier': chest['tier']}))
    next_id += 1
  parts.append(' </objectgroup>\n')

  parts.append(' <objectgroup id="6" name="bosses">\n')
  for boss in result['bosses']:
    parts.append(object_xml(next_id, boss['kind'], 'boss', boss['x'], boss['y'],
                            {'kind': boss['kind'], 'level': boss['level']}))
    next_id += 1
  parts.append(' </objectgroup>\n')

  parts.append(' <objectgroup id="7" name="stairs">\n')
  for stair in result['stairs']:
    parts.append(object_xml(
      next_id, stair['class'], stair['class'], stair['x'], stair['y'],
      {'target': stair['target'], 'targetX': stair['targetX'], 'targetY': stair['targetY']},
    ))
    next_id += 1
  parts.append(' </objectgroup>\n')

  parts.append('</map>\n')
  open(path, 'w', encoding='utf-8', newline='\n').write(''.join(parts))
  return path


# ---------------------------------------------------------------------- 조립
def build_floor(spec):
  layout = spec['layout']()
  floor = layout['floor']
  rooms = [room for room in layout['rooms'] if room['cells']]
  hazard = layout['hazard']

  walkable = floor - set(hazard)
  pillars = layout.get('pillars', set()) & walkable
  blocked = set(hazard) | pillars
  props = place_props(random.Random(7373 + spec['index']), spec, rooms, walkable, blocked)
  blocked |= set(props)
  stamps = place_block_props(random.Random(2020 + spec['index']), spec, rooms,
                             walkable, blocked, props)
  blocked |= set(stamps)
  walkable = floor - blocked

  rooms = [room for room in rooms if room['cells'] & walkable]
  # 입구 모서리를 층마다 돌린다. 늘 좌상단이면 보스 방이 다섯 층 내내 우하단에 놓인다.
  gate = spec['gate']
  entrance_room = min(rooms, key=lambda room: abs(room['anchor'][0] - gate[0])
                      + abs(room['anchor'][1] - gate[1]))
  entrance = min(entrance_room['cells'] & walkable,
                 key=lambda c: abs(c[0] - gate[0]) + abs(c[1] - gate[1]))
  # 도달 불가로 남은 조각은 지형으로 되돌린다. 남는 게 많으면 배치가 잘못된 것이므로
  # 아래 표에 칸 수를 찍어 눈에 띄게 한다.
  sealed = seal_unreachable(floor, walkable, hazard, entrance, spec)
  walkable -= sealed
  for room in rooms:
    room['cells'] &= floor
  rooms = [room for room in rooms if room['cells'] & walkable]
  props = {cell: tile for cell, tile in props.items() if cell in floor}
  stamps = {cell: tile for cell, tile in stamps.items() if cell in floor}
  pillars &= floor

  wide = [room for room in rooms if len(room['cells'] & walkable) >= 30]
  boss_room = pick_far_room(wide or rooms, entrance)
  monsters, chests, bosses = place_spawns(spec, rooms, walkable, layout['pockets'],
                                          entrance, boss_room)

  ground = paint_ground(spec, floor, rooms, hazard, layout['lanes'] & walkable,
                        layout.get('altar', set()) & walkable)
  ground_deco = paint_decals(spec, rooms, walkable, blocked)
  shadow = paint_shadow(walkable, set(props) | pillars | set(stamps),
                        layout.get('altar', set()) & walkable)
  wall = paint_walls(floor, spec['walls'])
  wall_deco = paint_wall_deco(spec, floor)

  prop = [[0] * W for _ in range(H)]
  pillar_gid = PILLAR_GREEN if spec['index'] in (2, 3) else PILLAR_BROWN
  for (x, y) in pillars:
    prop[y][x] = pillar_gid
  for (x, y), tile in props.items():
    prop[y][x] = tile
  for (x, y), tile in stamps.items():
    prop[y][x] = tile

  walk = [[0] * W for _ in range(H)]
  for (x, y) in walkable:
    walk[y][x] = 1
  collision = [[0 if walk[y][x] else 1 for x in range(W)] for y in range(H)]

  layers = [
    ('ground', ground), ('ground_deco', ground_deco), ('shadow', shadow),
    ('wall', wall), ('wall_deco', wall_deco), ('prop', prop), ('collision', collision),
  ]
  return {
    'spec': spec, 'floor': floor, 'rooms': rooms, 'walkable': walkable, 'walk': walk,
    'layers': layers, 'spawn': entrance, 'entranceRoom': entrance_room,
    'bossRoom': boss_room, 'monsters': monsters, 'chests': chests, 'bosses': bosses,
    'props': props, 'pillars': pillars, 'stamps': stamps, 'hazard': hazard,
    'sealed': len(sealed), 'stairs': [],
  }


def seal_unreachable(floor, walkable, hazard, start, spec):
  """스폰에서 못 닿는 통행 칸을 지형으로 되돌린다(물웅덩이는 물로, 나머지는 벽으로)."""
  seen = {start}
  queue = deque([start])
  while queue:
    x, y = queue.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
      step = (x + dx, y + dy)
      if step in walkable and step not in seen:
        seen.add(step)
        queue.append(step)
  sealed = walkable - seen
  if spec['index'] == 3:
    for cell in sealed:
      hazard[cell] = 'water'
  else:
    floor -= sealed
  return sealed


def place_stairs(results):
  """1~4층 하행 / 2~5층 상행. 하행은 보스 방에, 상행은 층 입구에 둔다."""
  for result in results:
    walkable = result['walkable']
    boss_cell = (result['bosses'][0]['x'], result['bosses'][0]['y'])

    def far_enough(cells):
      return [cell for cell in cells
              if max(abs(cell[0] - boss_cell[0]), abs(cell[1] - boss_cell[1])) >= 5]

    # 보스 방 안에서 보스와 5칸 이상 떨어진 칸을 고른다. 방이 좁아 그런 칸이 없으면
    # 층 전체로 넓힌다 — 예전엔 보스 칸으로 떨어져서 보스가 계단을 깔고 앉았다
    # (1층·4층에서 실제로 그렇게 나왔고, 보스 스프라이트가 계단을 완전히 가렸다).
    candidates = far_enough(result['bossRoom']['cells'] & walkable) or far_enough(walkable)
    if not candidates:
      raise SystemExit(f"{result['spec']['stem']}: 보스와 떨어진 하행 계단 자리를 못 찾았습니다.")
    down = min(candidates,
               key=lambda c: abs(c[0] - boss_cell[0]) + abs(c[1] - boss_cell[1]))
    result['downStair'] = down
    result['downArrival'] = adjacent_walkable(down, walkable)
    up = result['spawn']
    result['upStair'] = up
    result['upArrival'] = adjacent_walkable(up, walkable)

  for index, result in enumerate(results):
    if index + 1 < len(results):
      below = results[index + 1]
      result['stairs'].append({
        'class': 'stairs_down', 'x': result['downStair'][0], 'y': result['downStair'][1],
        'target': below['spec']['stem'],
        'targetX': below['upArrival'][0], 'targetY': below['upArrival'][1],
      })
    if index:
      above = results[index - 1]
      result['stairs'].append({
        'class': 'stairs_up', 'x': result['upStair'][0], 'y': result['upStair'][1],
        'target': above['spec']['stem'],
        'targetX': above['downArrival'][0], 'targetY': above['downArrival'][1],
      })


def ground_profile(result):
  counter = Counter()
  ground = dict(result['layers'])['ground']
  for row in ground:
    counter.update(value for value in row if value)
  return counter


def report(results):
  print()
  print(f'  {"층":<14}{"방":>6}{"통행":>9}{"물/용암":>9}{"몬스터":>8}{"보스":>6}'
        f'{"상자":>6}{"계단":>6}{"봉인":>7}')
  for result in results:
    spec = result['spec']
    hazard = len(result['hazard'])
    print(f'  {spec["stem"]:<14}{len(result["rooms"]):>6}{len(result["walkable"]):>9}'
          f'{hazard:>9}{len(result["monsters"]):>8}{len(result["bosses"]):>6}'
          f'{len(result["chests"]):>6}{len(result["stairs"]):>6}{result["sealed"]:>7}')

  print()
  print(f'  {"층":<14}' + ''.join(f'{name:>13}' for name, _ in results[0]['layers']))
  for result in results:
    counts = [sum(1 for row in layer for value in row if value)
              for _, layer in result['layers']]
    print(f'  {result["spec"]["stem"]:<14}' + ''.join(f'{count:>13}' for count in counts))

  print()
  print('  층 간 바닥 타일 겹침 (상위 12종 기준)')
  tops = [set(tile for tile, _ in ground_profile(result).most_common(12)) for result in results]
  print('  ' + ' ' * 14 + ''.join(f'{result["spec"]["index"]:>4}' for result in results))
  for i, result in enumerate(results):
    row = ''.join(f'{len(tops[i] & tops[j]) if i != j else 0:>4}' for j in range(len(results)))
    print(f'  {result["spec"]["stem"]:<14}{row}')


def check_ground_overlap(results):
  tops = [set(tile for tile, _ in ground_profile(result).most_common(12)) for result in results]
  overlap = max(len(tops[i] & tops[j])
                for i in range(len(tops)) for j in range(len(tops)) if i != j)
  if overlap:
    raise SystemExit(f'검증 실패: 층 간 바닥 타일이 {overlap}종 겹칩니다.')


def main():
  results = []
  for spec in FLOORS:
    print(f'{spec["index"]}층 {spec["name"]} — {spec["verse"]}')
    results.append(build_floor(spec))

  place_stairs(results)
  validate_stairs(results)
  check_ground_overlap(results)
  checked = [validate(result['spec'], result['walk'], result['floor'], result['layers'],
                      result['spawn'], result['monsters'], result['chests'], result['bosses'])
             for result in results]

  print()
  for result, (walkable, reached) in zip(results, checked):
    path = write_tmx(result)
    print(f'  {path} ({os.path.getsize(path) / 1024:.0f} KB) '
          f'통행 {walkable} 칸, 도달 {reached} 칸')

  report(results)


if __name__ == '__main__':
  main()
