import { Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js'

import { isDiscovered, type ExplorationState } from '../exploration'
import { isBlocked, type DungeonModel } from '../dungeonModel'

// 지도는 타일 하나를 픽셀 하나로 그린 256x256 캔버스 한 장이 원본이다. 접힌 미니맵은
// 그 원본의 일부를 잘라 확대하고, 펼친 지도는 전체를 확대한다 — 원본이 하나라 탐색으로
// 드러난 내용이 두 모드에 저절로 같이 반영된다.
const MINIMAP_WINDOW_TILES = 72
const MINIMAP_SIZE = 168
const MINIMAP_MARGIN = 14
const EXPANDED_MAX_SIZE = 460

// 층 색. 층마다 존이 하나이므로 존 색이 곧 층 색이다. zoneId 는 1..5 라 -1 해서 쓴다
// (0-based 로 그대로 색인하면 다섯 층 전부 이웃 층 색을 쓰고 5층은 범위를 벗어난다).
// 각 층 통행 가능 바닥의 실제 색에 맞춘다 — 3층은 물이 아니라 둑길이 걸어다니는 곳이다.
const FLOOR_COLOURS = [
  [196, 166, 120],
  [124, 168, 72],
  [232, 214, 180],
  [140, 116, 104],
  [222, 186, 110]
]
const WALL_COLOUR = [58, 50, 66]
const UNKNOWN_COLOUR = [26, 22, 32]

export type MapOverlay = {
  /** 새로 드러난 칸이 있을 때만 호출한다 — 매 프레임 전체를 다시 칠하지 않는다. */
  repaintAround: (tileX: number, tileY: number, radiusTiles: number) => void
  update: (playerTileX: number, playerTileY: number) => void
  toggleExpanded: () => void
  destroy: () => void
}

const buildZoneIndex = (model: DungeonModel): Int8Array => {
  const index = new Int8Array(model.width * model.height).fill(-1)
  // 좁은 존이 이기도록 넓은 것부터 칠한다(층마다 존이 하나인 지금은 무의미하지만,
  // 한 층 안을 여러 구역으로 나누게 되면 다시 필요하다).
  const ordered = [...model.zones].sort((a, b) => b.width * b.height - a.width * a.height)
  for (const zone of ordered) {
    for (let y = zone.y; y < zone.y + zone.height && y < model.height; y += 1) {
      for (let x = zone.x; x < zone.x + zone.width && x < model.width; x += 1) {
        index[y * model.width + x] = zone.zoneId - 1
      }
    }
  }
  return index
}

export const createMapOverlay = (
  stage: Container,
  model: DungeonModel,
  exploration: ExplorationState,
  viewWidth: number,
  viewHeight: number
): MapOverlay => {
  const canvas = document.createElement('canvas')
  canvas.width = model.width
  canvas.height = model.height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('지도 캔버스를 만들 수 없습니다.')
  }
  context.fillStyle = `rgb(${UNKNOWN_COLOUR.join(',')})`
  context.fillRect(0, 0, canvas.width, canvas.height)

  const zoneIndex = buildZoneIndex(model)
  const texture = Texture.from(canvas)

  const root = new Container()
  stage.addChild(root)

  // ---- 접힌 미니맵: 원본의 일부만 잘라 보여준다.
  const minimapFrame = new Rectangle(0, 0, MINIMAP_WINDOW_TILES, MINIMAP_WINDOW_TILES)
  const minimapTexture = new Texture({ source: texture.source, frame: minimapFrame })
  const minimap = new Sprite(minimapTexture)
  minimap.width = MINIMAP_SIZE
  minimap.height = MINIMAP_SIZE
  minimap.position.set(viewWidth - MINIMAP_SIZE - MINIMAP_MARGIN, MINIMAP_MARGIN)

  const minimapBorder = new Graphics()
    .rect(minimap.x - 2, minimap.y - 2, MINIMAP_SIZE + 4, MINIMAP_SIZE + 4)
    .fill({ color: 0x1a1620, alpha: 0.9 })
  const minimapMarker = new Graphics().circle(0, 0, 2.5).fill({ color: 0xffe066 })

  root.addChild(minimapBorder, minimap, minimapMarker)

  // ---- 펼친 전체 지도.
  const expanded = new Container()
  expanded.visible = false
  const expandedScale = EXPANDED_MAX_SIZE / Math.max(model.width, model.height)
  const expandedWidth = model.width * expandedScale
  const expandedHeight = model.height * expandedScale
  const expandedX = Math.round((viewWidth - expandedWidth) / 2)
  const expandedY = Math.round((viewHeight - expandedHeight) / 2) + 8

  const dim = new Graphics()
    .rect(0, 0, viewWidth, viewHeight)
    .fill({ color: 0x0d0b10, alpha: 0.82 })
  const expandedMap = new Sprite(texture)
  expandedMap.width = expandedWidth
  expandedMap.height = expandedHeight
  expandedMap.position.set(expandedX, expandedY)
  const expandedBorder = new Graphics()
    .rect(expandedX - 2, expandedY - 2, expandedWidth + 4, expandedHeight + 4)
    .stroke({ color: 0x6b5f76, width: 2 })
  const expandedMarker = new Graphics().circle(0, 0, 3.5).fill({ color: 0xffe066 })

  const title = new Text({
    text: '지도  —  M 키로 닫기',
    style: { fontFamily: 'monospace', fontSize: 13, fill: 0xf2e9e4 }
  })
  title.anchor.set(0.5, 1)
  title.position.set(viewWidth / 2, expandedY - 10)

  // 보스와 계단은 그 칸을 이미 밟아 본 뒤에만 표시한다 — 안 그러면 지도가 목적지를 미리 알려준다.
  // 다만 계단은 384x384 에서 찾는 것 자체가 일이라, 한 번 본 뒤에는 확실히 눈에 띄어야 한다.
  const bossMarkers = new Graphics()

  expanded.addChild(dim, expandedBorder, expandedMap, bossMarkers, expandedMarker, title)
  root.addChild(expanded)

  const paintPixel = (x: number, y: number) => {
    const colour = !isDiscovered(exploration, x, y)
      ? UNKNOWN_COLOUR
      : isBlocked(model, x, y)
        ? WALL_COLOUR
        : FLOOR_COLOURS[zoneIndex[y * model.width + x]] ?? FLOOR_COLOURS[0]
    context.fillStyle = `rgb(${colour.join(',')})`
    context.fillRect(x, y, 1, 1)
  }

  const repaintAround = (tileX: number, tileY: number, radiusTiles: number) => {
    const radius = Math.ceil(radiusTiles) + 1
    const minX = Math.max(0, Math.floor(tileX) - radius)
    const maxX = Math.min(model.width - 1, Math.floor(tileX) + radius)
    const minY = Math.max(0, Math.floor(tileY) - radius)
    const maxY = Math.min(model.height - 1, Math.floor(tileY) + radius)
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        paintPixel(x, y)
      }
    }
    texture.source.update()
  }

  const update = (playerTileX: number, playerTileY: number) => {
    // 미니맵 창은 플레이어를 가운데 두되 맵 밖으로 나가지 않게 잡아 둔다.
    const half = MINIMAP_WINDOW_TILES / 2
    const left = Math.min(Math.max(playerTileX - half, 0), model.width - MINIMAP_WINDOW_TILES)
    const top = Math.min(Math.max(playerTileY - half, 0), model.height - MINIMAP_WINDOW_TILES)
    minimapFrame.x = Math.round(left)
    minimapFrame.y = Math.round(top)
    minimapTexture.updateUvs()

    const scale = MINIMAP_SIZE / MINIMAP_WINDOW_TILES
    minimapMarker.position.set(
      minimap.x + (playerTileX - minimapFrame.x) * scale,
      minimap.y + (playerTileY - minimapFrame.y) * scale
    )

    if (!expanded.visible) {
      return
    }
    expandedMarker.position.set(
      expandedX + playerTileX * expandedScale,
      expandedY + playerTileY * expandedScale
    )
    bossMarkers.clear()
    for (const boss of model.bosses) {
      if (!isDiscovered(exploration, boss.tileX, boss.tileY)) {
        continue
      }
      bossMarkers
        .circle(expandedX + boss.tileX * expandedScale, expandedY + boss.tileY * expandedScale, 3)
        .fill({ color: 0xd7263d })
    }
    for (const stairs of model.stairs) {
      if (!isDiscovered(exploration, stairs.tileX, stairs.tileY)) {
        continue
      }
      const x = expandedX + stairs.tileX * expandedScale
      const y = expandedY + stairs.tileY * expandedScale
      const colour = stairs.direction === 'down' ? 0xffd166 : 0x8ecae6
      // 아래층은 아래를 가리키는 삼각형, 위층은 위를 가리키는 삼각형.
      const tip = stairs.direction === 'down' ? y + 4 : y - 4
      bossMarkers
        .moveTo(x - 4, stairs.direction === 'down' ? y - 3 : y + 3)
        .lineTo(x + 4, stairs.direction === 'down' ? y - 3 : y + 3)
        .lineTo(x, tip)
        .fill({ color: colour })
    }
  }

  return {
    repaintAround,
    update,
    toggleExpanded: () => {
      expanded.visible = !expanded.visible
      // 같은 정보를 두 번 띄울 이유가 없다.
      minimap.visible = !expanded.visible
      minimapBorder.visible = !expanded.visible
      minimapMarker.visible = !expanded.visible
    },
    destroy: () => {
      root.destroy({ children: true })
    }
  }
}
