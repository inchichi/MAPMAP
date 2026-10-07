import type { ParsedTiledMap } from '../../tiled/parseTiledMap'
import { resolveTilesetForTile, type TilesetRenderResources } from '../tiledMapRenderResources'

// 미니맵 그림: 맵을 불러올 때 타일 데이터로 작은 2D 캔버스에 한 번만 그린다.
// 게임 화면(WebGL)을 읽거나 렌더러로 다시 찍지 않는다 — 매 프레임 화면을 읽으면 그래픽 카드가 멈춰 기다려 버벅였고,
// @pixi/tilemap 바닥은 따로 찍으면 화면에서 사라졌다. 캐릭터는 넣지 않는다(미니맵은 내 위치 표시만 따로 그린다).
// createPixiTiledMapView 가 만들고 createMapOverlay 가 그린다.

export const createMiniMapSnapshot = (
  map: ParsedTiledMap,
  tilesetResources: ReadonlyMap<string, TilesetRenderResources>,
  scale = 0.5
): HTMLCanvasElement | undefined => {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(map.pixelWidth * scale))
  canvas.height = Math.max(1, Math.round(map.pixelHeight * scale))
  const context = canvas.getContext('2d')

  if (!context) {
    return undefined
  }

  context.imageSmoothingEnabled = false
  const tileWidth = map.tileWidth * scale
  const tileHeight = map.tileHeight * scale

  for (const layer of map.layers) {
    if (!layer.visible) {
      continue
    }

    context.globalAlpha = layer.opacity

    for (const tile of layer.tiles) {
      const resources = tilesetResources.get(resolveTilesetForTile(tile, map.tilesets).source)
      const texture = resources?.tileTextures[tile.localId]
      const image = texture?.source.resource as CanvasImageSource | undefined

      if (!texture || !image) {
        continue
      }

      const { x, y, width, height } = texture.frame
      // 큰 타일(나무 등)은 발밑 칸 기준으로 위로 솟게(Tiled 규칙: 타일 아래쪽이 칸 아래쪽에 맞춘다)
      const drawWidth = width * scale
      const drawHeight = height * scale
      context.drawImage(
        image,
        x,
        y,
        width,
        height,
        tile.x * tileWidth,
        (tile.y + 1) * tileHeight - drawHeight,
        drawWidth,
        drawHeight
      )
    }
  }

  context.globalAlpha = 1
  return canvas
}
