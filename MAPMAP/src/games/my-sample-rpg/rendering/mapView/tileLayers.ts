// 맵 타일 층 생성: CompositeTilemap 굽기, 뒤집힌 타일, 줍는 코인 더미, 흐르는 물, 깊이 정렬 층.
// 부팅 때 한 번 실행한다. 맵 화면의 상태는 ctx 로 받는다.
import { CompositeTilemap } from '@pixi/tilemap'
import { Container, Sprite, type Texture } from 'pixi.js'
import type { ParsedTiledMap, ParsedTiledTileset } from '../../tiled/parseTiledMap'
import { createCoinPileTileKey, getCoinPileGoldAmount } from '../../coinPiles'
import {
  createFlowingWaterSurface,
  createWaterRipplePatternTextures,
  parseWaterFillTileType,
  type FlowingWaterSurface,
  type FlowingWaterSurfaceCell
} from '../flowingWaterSurface'
import { resolveTilesetForTile, type TilesetRenderResources } from '../tiledMapRenderResources'
import { hasTileTransform } from '../tiledSpriteTransform'
import { DEPTH_SORTED_LAYER_NAME } from './constants'
import { createDepthSortedTileSprite, createTransformedTileSprite } from './tileSprites'
import { getTileDepthSortValue } from './tiles'

export type MapTileLayersContext = {
  map: ParsedTiledMap
  world: Container
  tilesetResources: Map<string, TilesetRenderResources>
  coinPileSprites: Map<string, { sprite: Sprite; goldAmount: number; tileX: number; tileY: number }>
  collectedCoinTileKeySet: Set<string>
  // 테마 색 필터를 받을 층을 여기에 모은다.
  themeColorTargets: Container[]
}

export const createMapTileLayers = (ctx: MapTileLayersContext) => {
  const {
    map,
    world,
    tilesetResources,
    coinPileSprites,
    collectedCoinTileKeySet,
    themeColorTargets
  } = ctx
  let depthSortedLayer: Container | undefined

  // 물 채움 타일(cave_fill_Water_*)은 무늬 없는 바탕(_00)만 CompositeTilemap 에 굽고,
  // 물결은 flowingWaterSurface 가 물 영역 전체에 이어지는 반복 무늬 두 겹으로 흘려 보낸다.
  // 물길은 하류 방향으로 흐르고 넓은 못은 잔잔하게 일렁인다(타일 경계 이음새 없음).
  const flowingWaterSurfaces: FlowingWaterSurface[] = []
  const waterRippleTexturesByKey = new Map<string, Texture[]>()
  const waterPlainTexturesByKey = new Map<string, Texture | null>()
  const resolveWaterPlainTexture = (
    tileset: ParsedTiledTileset,
    renderResources: TilesetRenderResources,
    family: string
  ): { patternKey: string; plainTexture: Texture } | undefined => {
    const patternKey = `${tileset.source}|${family}`
    let plainTexture = waterPlainTexturesByKey.get(patternKey)

    if (plainTexture === undefined) {
      let plainLocalId: number | undefined
      const rippleLocalIds: number[] = []

      for (const [localId, tileType] of Object.entries(tileset.tileTypes)) {
        const waterFillTile = parseWaterFillTileType(tileType)

        if (waterFillTile?.family !== family) {
          continue
        }
        if (waterFillTile.variant === 0) {
          plainLocalId = Number(localId)
        } else {
          rippleLocalIds.push(Number(localId))
        }
      }

      const rippleTextures =
        plainLocalId === undefined
          ? undefined
          : createWaterRipplePatternTextures(
              renderResources.imageTexture,
              renderResources.tileTextures[plainLocalId].frame,
              rippleLocalIds
                .sort((left, right) => left - right)
                .map((localId) => renderResources.tileTextures[localId].frame),
              `water:${family}`
            )

      plainTexture =
        plainLocalId !== undefined && rippleTextures
          ? renderResources.tileTextures[plainLocalId]
          : null
      waterPlainTexturesByKey.set(patternKey, plainTexture)
      if (rippleTextures) {
        waterRippleTexturesByKey.set(patternKey, rippleTextures)
      }
    }

    return plainTexture ? { patternKey, plainTexture } : undefined
  }
  for (const layer of map.layers) {
    if (layer.name.toLowerCase() === DEPTH_SORTED_LAYER_NAME) {
      const nextDepthSortedLayer = new Container()

      nextDepthSortedLayer.label = `layer:${layer.name}:depth`
      nextDepthSortedLayer.sortableChildren = true

      for (const tile of layer.tiles) {
        const tileset = resolveTilesetForTile(tile, map.tilesets)
        const renderResources = tilesetResources.get(tileset.source)

        if (!renderResources) {
          throw new Error(`Missing render resources for tileset ${tileset.source}`)
        }

        const sprite = createDepthSortedTileSprite(
          renderResources.tileTextures[tile.localId],
          tile,
          map.tileWidth,
          map.tileHeight
        )

        sprite.alpha = layer.opacity
        sprite.visible = layer.visible
        sprite.zIndex = getTileDepthSortValue(tile.y, map.tileHeight)
        nextDepthSortedLayer.addChild(sprite)
      }

      themeColorTargets.push(...nextDepthSortedLayer.children)
      depthSortedLayer = nextDepthSortedLayer
      world.addChild(nextDepthSortedLayer)
      continue
    }

    const tilemap = new CompositeTilemap()
    const transformedTileLayer = new Container()
    const coinPileLayer = new Container()
    const layerWaterCells: FlowingWaterSurfaceCell[] = []

    tilemap.label = `layer:${layer.name}`
    tilemap.alpha = layer.opacity
    tilemap.visible = layer.visible
    transformedTileLayer.label = `layer:${layer.name}:transforms`
    transformedTileLayer.alpha = layer.opacity
    transformedTileLayer.visible = layer.visible
    coinPileLayer.label = `layer:${layer.name}:coin-piles`

    for (const tile of layer.tiles) {
      const tileset = resolveTilesetForTile(tile, map.tilesets)
      const renderResources = tilesetResources.get(tileset.source)

      if (!renderResources) {
        throw new Error(`Missing render resources for tileset ${tileset.source}`)
      }

      // 획득 가능한 코인 타일은 CompositeTilemap 에 굽지 않고 개별 스프라이트로
      // 분리해, 획득 시 그 타일만 제거할 수 있게 한다.
      const coinGoldAmount = getCoinPileGoldAmount(tileset.tileTypes[tile.localId])

      if (coinGoldAmount !== undefined) {
        const tileKey = createCoinPileTileKey(tile.x, tile.y)

        if (collectedCoinTileKeySet.has(tileKey)) {
          continue
        }

        // 뒤집힌 타일은 기존 transform 스프라이트 경로로 방향을 보존한다
        // (anchor 가 달라지므로 픽업 판정은 스프라이트가 아닌 타일 좌표로 계산).
        const coinSprite = hasTileTransform(tile)
          ? createTransformedTileSprite(
              renderResources.tileTextures[tile.localId],
              tile,
              map.tileWidth,
              map.tileHeight
            )
          : new Sprite(renderResources.tileTextures[tile.localId])

        if (!hasTileTransform(tile)) {
          coinSprite.position.set(tile.x * map.tileWidth, tile.y * map.tileHeight)
        }
        coinSprite.alpha = layer.opacity
        coinSprite.visible = layer.visible
        coinPileLayer.addChild(coinSprite)
        coinPileSprites.set(tileKey, {
          sprite: coinSprite,
          goldAmount: coinGoldAmount,
          tileX: tile.x,
          tileY: tile.y
        })
        continue
      }

      // 물 채움 타일은 뒤집힘과 무관하게 바탕만 굽고 칸 좌표를 물결 레이어로 넘긴다.
      const waterFillTile = parseWaterFillTileType(tileset.tileTypes[tile.localId])
      const waterPlain = waterFillTile
        ? resolveWaterPlainTexture(tileset, renderResources, waterFillTile.family)
        : undefined

      if (waterPlain) {
        tilemap.tile(
          waterPlain.plainTexture,
          tile.x * map.tileWidth,
          tile.y * map.tileHeight
        )
        layerWaterCells.push({
          x: tile.x,
          y: tile.y,
          patternKey: waterPlain.patternKey
        })
        continue
      }

      if (hasTileTransform(tile)) {
        transformedTileLayer.addChild(
          createTransformedTileSprite(
            renderResources.tileTextures[tile.localId],
            tile,
            map.tileWidth,
            map.tileHeight
          )
        )
        continue
      }

      tilemap.tile(
        renderResources.tileTextures[tile.localId],
        tile.x * map.tileWidth,
        tile.y * map.tileHeight
      )
    }

    const flowingWaterSurface =
      layerWaterCells.length > 0
        ? createFlowingWaterSurface({
            cells: layerWaterCells,
            rippleTexturesByKey: waterRippleTexturesByKey,
            tileWidth: map.tileWidth,
            tileHeight: map.tileHeight,
            label: `layer:${layer.name}:flowing-water`
          })
        : undefined

    world.addChild(tilemap)
    if (flowingWaterSurface) {
      // 바탕 바로 위, 같은 레이어의 다른 타일/상위 레이어(둑, 소품)보다 아래에 그린다.
      flowingWaterSurface.container.alpha = layer.opacity
      flowingWaterSurface.container.visible = layer.visible
      flowingWaterSurfaces.push(flowingWaterSurface)
      world.addChild(flowingWaterSurface.container)
    }
    world.addChild(transformedTileLayer)
    world.addChild(coinPileLayer)
    if (!['ground', 'shadow_lower', 'shadow_upper'].includes(layer.name)) {
      themeColorTargets.push(tilemap, transformedTileLayer)
      if (flowingWaterSurface) {
        themeColorTargets.push(flowingWaterSurface.container)
      }
    }
  }

  if (!depthSortedLayer) {
    depthSortedLayer = new Container()
    depthSortedLayer.label = 'layer:characters:depth'
    depthSortedLayer.sortableChildren = true
    world.addChild(depthSortedLayer)
  }

  return { depthSortedLayer, flowingWaterSurfaces, waterRippleTexturesByKey }
}
