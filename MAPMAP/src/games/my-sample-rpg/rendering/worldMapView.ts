// 세계 지도(M) 그리기 — 메이플 세계 지도처럼 한 장의 그림 지도.
// 바다 위 대륙을 작은 픽셀 그림으로 그리고(지역마다 땅 덩어리 + 길 따라 이어진 땅, 가까운 지역의 지형 색),
// 지형 장식(나무·눈 덮인 소나무·바위산·집·기둥·갈대), 점선 길, 지역 아이콘(마을·필드·던전)을 찍는다.
// 안 가 본 지역은 픽셀 구름(안개)으로 덮는다. 마을 이름은 지도에 쓰고, 나머지는 마우스를 올리면 툴팁으로 보인다.
// 배치·길·지형은 worldMap.ts, 이름은 sceneIntro.ts, 툴팁 그림은 assets/world-map/<sceneId>.png
// (scripts/capture-world-map-thumbnails.mjs 로 만든다).
import { getSceneIntroMessage } from '../sceneIntro'
import {
  WORLD_MAP_COLUMNS,
  WORLD_MAP_REGIONS,
  WORLD_MAP_ROUTES,
  WORLD_MAP_ROWS,
  getWorldMapRegion,
  type WorldMapBiome,
  type WorldMapRegion
} from '../worldMap'

type WorldMapViewState = {
  currentSceneId: string
  visitedSceneIds: ReadonlySet<string>
}

// 지도 픽셀 그림 크기: 지역 칸 하나 = CELL_PIXELS × CELL_PIXELS 픽셀
const CELL_PIXELS = 32
// 대륙 둘레 바다 여백
const ART_MARGIN = 14
const ART_WIDTH = WORLD_MAP_COLUMNS * CELL_PIXELS + ART_MARGIN * 2
const ART_HEIGHT = WORLD_MAP_ROWS * CELL_PIXELS + ART_MARGIN * 2

// 세계 지도 가로세로 비율을 맞추려고 펼친 지도 크기 계산에 쓴다.
export const WORLD_MAP_ART_SIZE = { width: ART_WIDTH, height: ART_HEIGHT }

const thumbnailUrlByPath = import.meta.glob('../assets/world-map/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>

export const getWorldMapThumbnailUrl = (sceneId: string): string | undefined =>
  thumbnailUrlByPath[`../assets/world-map/${sceneId}.png`]

const getRegionCenter = (region: WorldMapRegion) => ({
  x: ART_MARGIN + (region.column + 0.5) * CELL_PIXELS,
  y: ART_MARGIN + (region.row + 0.5) * CELL_PIXELS
})

// ── 지형 ──────────────────────────────────────────────────────────────

const BIOME_GROUND: Record<WorldMapBiome, readonly [string, string]> = {
  village: ['#86b84e', '#97c75c'],
  forest: ['#4c8a3a', '#3f7832'],
  cave: ['#8c7c6a', '#7d6e5e'],
  water: ['#5e9c78', '#6aab84'],
  ruins: ['#a29c7c', '#948e70'],
  snow: ['#eef3f8', '#d9e4ee']
}
const SAND = '#e6d29a'
const SHALLOW = '#5e9fd0'
const SEA = ['#3a6aa6', '#3f71ad'] as const
const WAVE = '#7fb0dc'

// 0~1 결정적 잡음(같은 칸은 늘 같은 값)
const hash = (x: number, y: number): number => {
  let value = Math.imul(x * 374761393 + y * 668265263, 1274126177)
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295
}

const smoothNoise = (x: number, y: number, scale: number): number => {
  const gx = x / scale
  const gy = y / scale
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const tx = gx - x0
  const ty = gy - y0
  const top = hash(x0, y0) * (1 - tx) + hash(x0 + 1, y0) * tx
  const bottom = hash(x0, y0 + 1) * (1 - tx) + hash(x0 + 1, y0 + 1) * tx
  return top * (1 - ty) + bottom * ty
}

const distanceToSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

// 땅 값: 0 보다 크면 땅. 지역 둘레 덩어리와 길을 따라 이어진 띠, 가장자리는 잡음으로 들쭉날쭉.
const getLandValue = (x: number, y: number): number => {
  let value = -Infinity

  for (const region of WORLD_MAP_REGIONS) {
    const center = getRegionCenter(region)
    value = Math.max(value, 15 - Math.hypot(x - center.x, y - center.y))
  }

  for (const [fromId, toId] of WORLD_MAP_ROUTES) {
    const from = getWorldMapRegion(fromId)
    const to = getWorldMapRegion(toId)

    if (from && to) {
      const a = getRegionCenter(from)
      const b = getRegionCenter(to)
      value = Math.max(value, 9 - distanceToSegment(x, y, a.x, a.y, b.x, b.y))
    }
  }

  return value + (smoothNoise(x, y, 6) - 0.5) * 9
}

const getNearestRegion = (x: number, y: number): WorldMapRegion => {
  let nearest = WORLD_MAP_REGIONS[0]
  let nearestDistance = Infinity

  for (const region of WORLD_MAP_REGIONS) {
    const center = getRegionCenter(region)
    // 경계를 조금 흔들어 지형 사이가 자연스럽게 섞이게 한다.
    const distance = Math.hypot(x - center.x, y - center.y) + (smoothNoise(x + 99, y, 5) - 0.5) * 8

    if (distance < nearestDistance) {
      nearestDistance = distance
      nearest = region
    }
  }

  return nearest
}

// ── 픽셀 그림 조각 ────────────────────────────────────────────────────

type Sprite = { rows: readonly string[]; palette: Record<string, string> }

const TREE: Sprite = {
  rows: ['..g..', '.gGg.', 'gGggg', '.ggg.', '..t..'],
  palette: { g: '#2f6526', G: '#5a9a46', t: '#6d4b27' }
}
const SNOW_PINE: Sprite = {
  rows: ['..w..', '.wgw.', '.ggg.', 'wgggw', 'ggggg', '..t..'],
  palette: { w: '#ffffff', g: '#2f5a3a', t: '#6d4b27' }
}
const MOUNTAIN: Sprite = {
  rows: ['....w....', '...wRw...', '..rRRRr..', '.rrRRRrr.', 'rrrrRrrrr'],
  palette: { w: '#ffffff', r: '#6e6052', R: '#9a8a7a' }
}
const CAVE_MOUNTAIN: Sprite = {
  rows: ['....R....', '...RRr...', '..rRRRr..', '.rrkkkrr.', 'rrrkkkrrr'],
  palette: { r: '#5e5146', R: '#8a7a6a', k: '#1e1714' }
}
const HOUSE: Sprite = {
  rows: ['.rrr.', 'rrrrr', 'wwwww', 'wkwdw', 'wwwdw'],
  palette: { r: '#b5452f', w: '#fff1d2', k: '#4a3218', d: '#6d4b27' }
}
const PILLAR: Sprite = {
  rows: ['sss', '.s.', '.s.', '.S.', 'SSS'],
  palette: { s: '#e2dcc6', S: '#a69f86' }
}
const REEDS: Sprite = {
  rows: ['.b..b', 'b.b.b', 'bbbbb'],
  palette: { b: '#2e5e48' }
}

const BIOME_DECOR: Record<WorldMapBiome, readonly Sprite[]> = {
  village: [HOUSE, TREE, HOUSE, TREE],
  forest: [TREE, TREE, TREE, TREE, TREE],
  cave: [CAVE_MOUNTAIN, MOUNTAIN, MOUNTAIN],
  water: [REEDS, TREE, REEDS, REEDS],
  ruins: [PILLAR, PILLAR, TREE, PILLAR],
  snow: [SNOW_PINE, MOUNTAIN, SNOW_PINE, SNOW_PINE]
}

// 지역 둘레 장식 자리(아이콘이 놓일 가운데는 비운다)
const DECOR_OFFSETS = [
  [-11, -9],
  [7, -11],
  [10, 4],
  [-12, 5],
  [-2, 9]
] as const

const drawSprite = (target: CanvasRenderingContext2D, sprite: Sprite, left: number, top: number) => {
  sprite.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const color = sprite.palette[row[x]]

      if (color) {
        target.fillStyle = color
        target.fillRect(left + x, top + y, 1, 1)
      }
    }
  })
}

const drawDottedPath = (target: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number) => {
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay))

  for (let step = 0; step <= steps; step += 1) {
    if (step % 3 === 2) {
      continue
    }

    const x = Math.round(ax + ((bx - ax) * step) / steps)
    const y = Math.round(ay + ((by - ay) * step) / steps)
    target.fillStyle = '#6d4b27'
    target.fillRect(x, y + 1, 1, 1)
    target.fillStyle = '#f6e4b4'
    target.fillRect(x, y, 1, 1)
  }
}

// 바다·땅·장식·길 — 가 본 곳과 상관없으니 한 번만 그려 둔다.
let baseArtCanvas: HTMLCanvasElement | undefined

const getBaseArt = (): HTMLCanvasElement | undefined => {
  if (baseArtCanvas) {
    return baseArtCanvas
  }

  const canvas = document.createElement('canvas')
  canvas.width = ART_WIDTH
  canvas.height = ART_HEIGHT
  const context = canvas.getContext('2d')

  if (!context) {
    return undefined
  }

  const image = context.createImageData(ART_WIDTH, ART_HEIGHT)
  const setPixel = (x: number, y: number, color: string) => {
    const index = (y * ART_WIDTH + x) * 4
    image.data[index] = parseInt(color.slice(1, 3), 16)
    image.data[index + 1] = parseInt(color.slice(3, 5), 16)
    image.data[index + 2] = parseInt(color.slice(5, 7), 16)
    image.data[index + 3] = 255
  }

  for (let y = 0; y < ART_HEIGHT; y += 1) {
    for (let x = 0; x < ART_WIDTH; x += 1) {
      const land = getLandValue(x, y)

      if (land > 1.5) {
        const shades = BIOME_GROUND[getNearestRegion(x, y).biome]
        setPixel(x, y, shades[hash(x, y) < 0.3 ? 1 : 0])
      } else if (land > 0) {
        setPixel(x, y, SAND)
      } else if (land > -3) {
        setPixel(x, y, SHALLOW)
      } else {
        // 짧은 가로 물결 + 잡음으로 짙고 옅은 물빛
        const isWave = hash(Math.floor(x / 3), y) < 0.03 && y % 2 === 0
        setPixel(x, y, isWave ? WAVE : SEA[smoothNoise(x, y, 9) > 0.55 ? 1 : 0])
      }
    }
  }

  context.putImageData(image, 0, 0)

  for (const [fromId, toId] of WORLD_MAP_ROUTES) {
    const from = getWorldMapRegion(fromId)
    const to = getWorldMapRegion(toId)

    if (from && to) {
      const a = getRegionCenter(from)
      const b = getRegionCenter(to)
      drawDottedPath(context, Math.round(a.x), Math.round(a.y), Math.round(b.x), Math.round(b.y))
    }
  }

  for (const region of WORLD_MAP_REGIONS) {
    const center = getRegionCenter(region)
    BIOME_DECOR[region.biome].forEach((sprite, index) => {
      const [dx, dy] = DECOR_OFFSETS[index % DECOR_OFFSETS.length]
      const width = sprite.rows[0].length
      const height = sprite.rows.length
      drawSprite(context, sprite, Math.round(center.x + dx - width / 2), Math.round(center.y + dy - height / 2))
    })
  }

  baseArtCanvas = canvas
  return canvas
}

// ── 지역 아이콘·안개 ──────────────────────────────────────────────────

type MarkerKind = 'town' | 'field' | 'dungeon'

const getMarkerKind = (biome: WorldMapBiome): MarkerKind =>
  biome === 'village' ? 'town' : biome === 'cave' || biome === 'ruins' ? 'dungeon' : 'field'

const MARKER: Sprite = {
  rows: ['..ooo..', '.oxxxo.', 'oxxXxxo', 'oxXXXxo', 'oxxXxxo', '.oxxxo.', '..ooo..'],
  palette: { o: '#3a2410', x: '#000000', X: '#ffffff' }
}
const MARKER_COLORS: Record<MarkerKind, string> = {
  town: '#f2b632',
  field: '#5cb85c',
  dungeon: '#c0503c'
}

const drawFogCloud = (target: CanvasRenderingContext2D, centerX: number, centerY: number) => {
  // 둥근 덩어리 여럿을 겹친 픽셀 구름 — 그림자·몸통·밝은 결 세 겹
  const puffs = [
    [-9, 2, 8],
    [-3, -5, 9],
    [6, -4, 8],
    [10, 3, 7],
    [1, 5, 9]
  ] as const

  for (const [color, offsetY, grow] of [
    ['#a9a39a', 2, 1],
    ['#e9e6e0', 0, 0],
    ['#ffffff', -2, -4]
  ] as const) {
    target.fillStyle = color
    for (const [dx, dy, radius] of puffs) {
      const r = radius + grow

      for (let y = -r; y <= r; y += 1) {
        const halfWidth = Math.floor(Math.sqrt(r * r - y * y))
        target.fillRect(
          Math.round(centerX + dx - halfWidth - (color === '#ffffff' ? 2 : 0)),
          Math.round(centerY + dy + y + offsetY),
          halfWidth * 2 + 1,
          1
        )
      }
    }
  }
}

export const drawWorldMap = (
  target: CanvasRenderingContext2D,
  width: number,
  height: number,
  { currentSceneId, visitedSceneIds }: WorldMapViewState
): void => {
  const baseArt = getBaseArt()

  if (!baseArt) {
    return
  }

  // 픽셀 그림 위에 아이콘·안개를 얹은 뒤 통째로 늘린다(뭉개지지 않게).
  const art = document.createElement('canvas')
  art.width = ART_WIDTH
  art.height = ART_HEIGHT
  const artContext = art.getContext('2d')

  if (!artContext) {
    return
  }

  artContext.drawImage(baseArt, 0, 0)

  for (const region of WORLD_MAP_REGIONS) {
    const center = getRegionCenter(region)

    if (!visitedSceneIds.has(region.sceneId)) {
      drawFogCloud(artContext, center.x, center.y)
      continue
    }

    drawSprite(
      artContext,
      { ...MARKER, palette: { ...MARKER.palette, x: MARKER_COLORS[getMarkerKind(region.biome)] } },
      Math.round(center.x - 3),
      Math.round(center.y - 3)
    )
  }

  target.save()
  target.imageSmoothingEnabled = false
  target.drawImage(art, 0, 0, width, height)

  // 마을 이름과 지금 있는 곳 이름만 지도에 쓴다(나머지는 마우스를 올리면 툴팁).
  const scale = width / ART_WIDTH
  const fontSize = Math.max(11, Math.round(scale * 5.5))
  target.font = `${fontSize}px NeoDunggeunmo, monospace`
  target.textAlign = 'center'
  target.textBaseline = 'top'
  target.lineJoin = 'round'

  for (const region of WORLD_MAP_REGIONS) {
    const isCurrent = region.sceneId === currentSceneId

    if (!visitedSceneIds.has(region.sceneId) || (getMarkerKind(region.biome) !== 'town' && !isCurrent)) {
      continue
    }

    const center = getRegionCenter(region)
    const x = center.x * scale
    const y = (center.y + 5) * scale
    target.lineWidth = Math.max(3, scale * 1.4)
    target.strokeStyle = '#3a2410'
    target.strokeText(getSceneIntroMessage(region.sceneId), x, y)
    target.fillStyle = isCurrent ? '#ffd75e' : '#fff1d2'
    target.fillText(getSceneIntroMessage(region.sceneId), x, y)
  }

  target.restore()
}

// 플레이어 표시 위치(세계 지도 전체에 대한 0~1) — 캐릭터 발이 지금 지역 원 아이콘(7칸) 위쪽에 살짝 걸치는 곳
export const getWorldMapMarkerRatio = (sceneId: string): { x: number; y: number } | undefined => {
  const region = getWorldMapRegion(sceneId)

  if (!region) {
    return undefined
  }

  const center = getRegionCenter(region)
  return { x: center.x / ART_WIDTH, y: (center.y - 1) / ART_HEIGHT }
}

// 마우스가 올라간 지역(가 본 곳만) — 툴팁용. ratio 는 세계 지도 전체에 대한 0~1.
export const getWorldMapRegionAt = (
  ratio: { x: number; y: number },
  visitedSceneIds: ReadonlySet<string>
): WorldMapRegion | undefined => {
  const x = ratio.x * ART_WIDTH
  const y = ratio.y * ART_HEIGHT

  return WORLD_MAP_REGIONS.find((region) => {
    const center = getRegionCenter(region)
    return visitedSceneIds.has(region.sceneId) && Math.hypot(x - center.x, y - center.y) <= 6
  })
}
