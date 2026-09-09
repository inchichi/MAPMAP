import { Container, Rectangle, Texture } from 'pixi.js'
import { CompositeTilemap, settings } from '@pixi/tilemap'

import type { ParsedTiledMap } from '../../my-sample-rpg/tiled/parseTiledMap'

// @pixi/tilemap 기본값은 16비트 인덱스라 Tilemap 하나에 16,384 쿼드가 상한이고, 넘으면
// 예외 없이 기하가 조용히 깨진다. CompositeTilemap 은 texture source 로 자식을 묶으므로
// 아틀라스가 하나면 레이어 전체가 자식 하나로 뭉쳐 상한에 걸린다. 첫 렌더 전에 켠다.
settings.use32bitIndex = true

// 청크 한 변(타일). 이 격자는 컬링 단위이자 스타일 전이 청크 단위와 같다
// (타일 16px * 2배 렌더 * 32타일 = 1024px).
export const CHUNK_TILES = 32

export type ChunkedTilemap = {
  container: Container
  /** 카메라가 보는 월드 사각형을 받아 보이는 청크만 켠다. */
  cull: (viewLeft: number, viewTop: number, viewWidth: number, viewHeight: number) => void
  chunksX: number
  chunksY: number
  visibleChunkCount: () => number
}

/** 아틀라스 한 장에서 gid 로 타일 텍스처를 잘라 주는 조회기. 청크 렌더러와 소품 스프라이트가 같이 쓴다. */
export const createTileTextureLookup = (map: ParsedTiledMap, atlas: Texture) => {
  const tileset = map.tilesets[0]
  const cache = new Map<number, Texture>()
  return (gid: number): Texture => {
    const cached = cache.get(gid)
    if (cached) {
      return cached
    }
    const localId = gid - tileset.firstGid
    const column = localId % tileset.columns
    const row = Math.floor(localId / tileset.columns)
    const texture = new Texture({
      source: atlas.source,
      frame: new Rectangle(
        column * tileset.tileWidth,
        row * tileset.tileHeight,
        tileset.tileWidth,
        tileset.tileHeight
      )
    })
    cache.set(gid, texture)
    return texture
  }
}

/**
 * 렌더 대상 레이어들을 청크 격자로 쪼개 그린다.
 *
 * 맵 전체를 한 덩어리로 그리면 256x256 맵에서 레이어당 65,536 쿼드가 되어 인덱스 상한과
 * 컬링 양쪽에서 무너진다. 청크로 쪼개면 화면에 걸친 몇 개만 그리면 된다.
 */
export const createChunkedTilemap = (
  map: ParsedTiledMap,
  atlas: Texture,
  renderedLayerNames: readonly string[]
): ChunkedTilemap => {
  const textureFor = createTileTextureLookup(map, atlas)
  const chunksX = Math.ceil(map.width / CHUNK_TILES)
  const chunksY = Math.ceil(map.height / CHUNK_TILES)
  const chunkPixels = CHUNK_TILES * map.tileWidth

  // 레이어를 이름으로 찾되, 계약에 없는 레이어(collision)는 애초에 넘어오지 않는다.
  const layers = renderedLayerNames
    .map((name) => map.layers.find((layer) => layer.name === name))
    .filter((layer) => layer !== undefined)

  const container = new Container()
  const chunks: CompositeTilemap[] = []

  for (let chunkY = 0; chunkY < chunksY; chunkY += 1) {
    for (let chunkX = 0; chunkX < chunksX; chunkX += 1) {
      const tilemap = new CompositeTilemap()
      tilemap.position.set(chunkX * chunkPixels, chunkY * chunkPixels)

      const minTileX = chunkX * CHUNK_TILES
      const minTileY = chunkY * CHUNK_TILES
      const maxTileX = Math.min(minTileX + CHUNK_TILES, map.width)
      const maxTileY = Math.min(minTileY + CHUNK_TILES, map.height)

      for (const layer of layers) {
        for (const tile of layer.tiles) {
          if (
            tile.x < minTileX || tile.x >= maxTileX ||
            tile.y < minTileY || tile.y >= maxTileY
          ) {
            continue
          }
          // 레이어 불투명도는 타일별 alpha 로 넘긴다. 청크 하나가 여러 레이어를 한
          // CompositeTilemap 에 합치므로 컨테이너 alpha 로는 레이어를 구분할 수 없다.
          tilemap.tile(
            textureFor(tile.gid),
            (tile.x - minTileX) * map.tileWidth,
            (tile.y - minTileY) * map.tileHeight,
            layer.opacity < 1 ? { alpha: layer.opacity } : undefined
          )
        }
      }

      tilemap.visible = false
      chunks.push(tilemap)
      container.addChild(tilemap)
    }
  }

  let visible = 0

  const cull = (
    viewLeft: number,
    viewTop: number,
    viewWidth: number,
    viewHeight: number
  ) => {
    // 한 청크만큼 여유를 둬 경계에서 팝인이 보이지 않게 한다.
    const firstX = Math.max(0, Math.floor(viewLeft / chunkPixels) - 1)
    const lastX = Math.min(chunksX - 1, Math.floor((viewLeft + viewWidth) / chunkPixels) + 1)
    const firstY = Math.max(0, Math.floor(viewTop / chunkPixels) - 1)
    const lastY = Math.min(chunksY - 1, Math.floor((viewTop + viewHeight) / chunkPixels) + 1)

    visible = 0
    for (let index = 0; index < chunks.length; index += 1) {
      const chunkX = index % chunksX
      const chunkY = Math.floor(index / chunksX)
      const shown =
        chunkX >= firstX && chunkX <= lastX && chunkY >= firstY && chunkY <= lastY
      chunks[index].visible = shown
      if (shown) {
        visible += 1
      }
    }
  }

  return { container, cull, chunksX, chunksY, visibleChunkCount: () => visible }
}
