import { Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js'

import { createHudPanel, layoutHudPanel, HUD_FONT, type HudArt } from './createCryptHud'
import { isDiscovered, type ExplorationState } from '../exploration'
import { isBlocked, type DungeonModel } from '../dungeonModel'

// 지도는 타일 하나를 픽셀 하나로 그린 256x256 캔버스 한 장이 원본이다. 접힌 미니맵은
// 그 원본의 일부를 잘라 확대하고, 펼친 지도는 전체를 확대한다 — 원본이 하나라 탐색으로
// 드러난 내용이 두 모드에 저절로 같이 반영된다.
const MINIMAP_WINDOW_TILES = 72
const MINIMAP_SIZE = 168
const MINIMAP_MARGIN = 24
const EXPANDED_MAX_SIZE = 400
/** 팩 받침의 테두리 두께(화면 px). 지도는 그 안쪽에 딱 맞게 앉는다. */
const FRAME = 10
const FONT_SIZE = 16
const TITLE_HEIGHT = FRAME * 2 + 20

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

// 표식 색은 팩 팔레트에서 뽑았다. 계단은 위/아래가 삼각형 방향으로 갈리고 밝기로 한 번 더 갈린다.
const OUTLINE = 0x141b1b
const PLAYER_COLOUR = 0xf2eaf1
const BOSS_COLOUR = 0xe0394c
const STAIRS_DOWN_COLOUR = 0xffad5d
const STAIRS_UP_COLOUR = 0xd3865f

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

/** 표식도 픽셀로 그린다 — 원을 그리면 지도만 벡터가 되어 겉돈다. */
const createMarker = (size: number, colour: number): Graphics =>
  new Graphics()
    .rect(-size / 2 - 1, -size / 2 - 1, size + 2, size + 2)
    .fill(OUTLINE)
    .rect(-size / 2, -size / 2, size, size)
    .fill(colour)

const drawTriangle = (
  target: Graphics,
  x: number,
  y: number,
  pointsDown: boolean,
  colour: number
) => {
  for (let step = 0; step < 3; step += 1) {
    const width = 6 - step * 2
    const rowY = pointsDown ? y - 3 + step * 2 : y + 1 - step * 2
    target.rect(x - width / 2, rowY, width, 2).fill(colour)
  }
}

export const createMapOverlay = (
  stage: Container,
  art: HudArt,
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

  const minimapPanel = createHudPanel(art.panel)
  layoutHudPanel(
    minimapPanel, minimap.x - FRAME, minimap.y - FRAME,
    MINIMAP_SIZE + FRAME * 2, MINIMAP_SIZE + FRAME * 2
  )
  const minimapMarker = createMarker(6, PLAYER_COLOUR)

  root.addChild(minimapPanel, minimap, minimapMarker)

  // ---- 펼친 전체 지도.
  const expanded = new Container()
  expanded.visible = false
  const expandedScale = EXPANDED_MAX_SIZE / Math.max(model.width, model.height)
  const expandedWidth = model.width * expandedScale
  const expandedHeight = model.height * expandedScale
  const expandedX = Math.round((viewWidth - expandedWidth) / 2)
  // 제목 받침이 위에 한 줄 들어가므로 지도를 그만큼 내린다. 아래로는 하단 정보 줄을 덮지 않는다.
  const expandedY = Math.round((viewHeight - expandedHeight) / 2) + 8

  const dim = new Graphics()
    .rect(0, 0, viewWidth, viewHeight)
    .fill({ color: OUTLINE, alpha: 0.82 })
  const expandedMap = new Sprite(texture)
  expandedMap.width = expandedWidth
  expandedMap.height = expandedHeight
  expandedMap.position.set(expandedX, expandedY)
  const expandedPanel = createHudPanel(art.panel)
  layoutHudPanel(
    expandedPanel, expandedX - FRAME, expandedY - FRAME,
    expandedWidth + FRAME * 2, expandedHeight + FRAME * 2
  )
  const expandedMarker = createMarker(8, PLAYER_COLOUR)

  const title = new Text({
    text: '지도  —  M 키로 닫기',
    style: { fontFamily: HUD_FONT, fontSize: FONT_SIZE, fill: OUTLINE }
  })
  title.anchor.set(0.5, 0)
  const titleWidth = Math.round(title.width) + FRAME * 4
  const titleY = expandedY - FRAME - 12 - TITLE_HEIGHT
  title.position.set(Math.round(viewWidth / 2), titleY + FRAME + 2)
  const titlePanel = createHudPanel(art.panel)
  layoutHudPanel(
    titlePanel, Math.round((viewWidth - titleWidth) / 2), titleY, titleWidth, TITLE_HEIGHT
  )

  // 보스와 계단은 그 칸을 이미 밟아 본 뒤에만 표시한다 — 안 그러면 지도가 목적지를 미리 알려준다.
  // 다만 계단은 384x384 에서 찾는 것 자체가 일이라, 한 번 본 뒤에는 확실히 눈에 띄어야 한다.
  const bossMarkers = new Graphics()

  expanded.addChild(
    dim, expandedPanel, expandedMap, bossMarkers, expandedMarker, titlePanel, title
  )
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
      Math.round(minimap.x + (playerTileX - minimapFrame.x) * scale),
      Math.round(minimap.y + (playerTileY - minimapFrame.y) * scale)
    )

    if (!expanded.visible) {
      return
    }
    expandedMarker.position.set(
      Math.round(expandedX + playerTileX * expandedScale),
      Math.round(expandedY + playerTileY * expandedScale)
    )
    bossMarkers.clear()
    for (const boss of model.bosses) {
      if (!isDiscovered(exploration, boss.tileX, boss.tileY)) {
        continue
      }
      const x = Math.round(expandedX + boss.tileX * expandedScale)
      const y = Math.round(expandedY + boss.tileY * expandedScale)
      bossMarkers.rect(x - 4, y - 4, 8, 8).fill(OUTLINE).rect(x - 3, y - 3, 6, 6).fill(BOSS_COLOUR)
    }
    for (const stairs of model.stairs) {
      if (!isDiscovered(exploration, stairs.tileX, stairs.tileY)) {
        continue
      }
      const x = Math.round(expandedX + stairs.tileX * expandedScale)
      const y = Math.round(expandedY + stairs.tileY * expandedScale)
      const down = stairs.direction === 'down'
      bossMarkers.rect(x - 4, y - 4, 8, 8).fill(OUTLINE)
      drawTriangle(bossMarkers, x, y, down, down ? STAIRS_DOWN_COLOUR : STAIRS_UP_COLOUR)
    }
  }

  return {
    repaintAround,
    update,
    toggleExpanded: () => {
      expanded.visible = !expanded.visible
      // 같은 정보를 두 번 띄울 이유가 없다.
      minimap.visible = !expanded.visible
      minimapPanel.visible = !expanded.visible
      minimapMarker.visible = !expanded.visible
    },
    destroy: () => {
      root.destroy({ children: true })
    }
  }
}
