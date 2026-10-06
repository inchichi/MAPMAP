import { Texture } from 'pixi.js'
import type { CharacterMoveDirection, CharacterState } from '../../characterState'
import { type PlayerRollVector } from '../../playerRoll'
import { type MapPortal } from '../../tiled/createMapPortalsFromEventLayers'
import { type CollisionRect } from '../characterCollision'
import type { ParsedTiledMap, ParsedTiledTileset } from '../../tiled/parseTiledMap'
import { resolveTilesetForTile, type TilesetRenderResources } from '../tiledMapRenderResources'
import { CAMERA_MAX_ZOOM, CAMERA_MIN_ZOOM, GRASS_TILE_TYPES, GROUND_LAYER_NAME } from './constants'
import { type ResolvedCharacterAppearanceTexture } from './types'

export const clampScrollOffset = (value: number, max: number): number =>
  Math.max(0, Math.min(Math.round(value), Math.max(0, max)))

export const clampCameraZoom = (value: number): number =>
  Math.max(CAMERA_MIN_ZOOM, Math.min(value, CAMERA_MAX_ZOOM))


export const createGrassTileLookup = (map: ParsedTiledMap): Set<string> => {
  const groundLayer = map.layers.find(
    (layer) => layer.name.toLowerCase() === GROUND_LAYER_NAME
  )
  const grassTileKeys = new Set<string>()

  if (!groundLayer) {
    return grassTileKeys
  }

  for (const tile of groundLayer.tiles) {
    const tileset = resolveTilesetForTile(tile, map.tilesets)
    const tileType = tileset.tileTypes[tile.localId]

    if (tileType && GRASS_TILE_TYPES.has(tileType)) {
      grassTileKeys.add(createTileLookupKey(tile.x, tile.y))
    }
  }

  return grassTileKeys
}

// roof 레이어의 독안개 타일(swamp_fog_*) 칸 — 판정은 isCharacterOnGrass 와 같은 발밑 칸.
// 빛 원 그림: 가운데가 밝고 가장자리로 사라지는 흰 원(색은 tint 로). 한 번 만들어 모든 빛이 같이 쓴다.
export let mapLightTexture: Texture | undefined
export const getMapLightTexture = (): Texture => {
  if (!mapLightTexture) {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (context) {
      const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
      gradient.addColorStop(0, 'rgba(255,255,255,1)')
      gradient.addColorStop(0.45, 'rgba(255,255,255,0.45)')
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      context.fillStyle = gradient
      context.fillRect(0, 0, size, size)
    }
    mapLightTexture = Texture.from(canvas)
  }
  return mapLightTexture
}

export const createRoofTileLookup = (
  map: ParsedTiledMap,
  matchesTileType: (tileType: string | undefined) => boolean
): Set<string> => {
  const keys = new Set<string>()
  for (const layer of map.layers) {
    if (layer.name.toLowerCase() !== 'roof') {
      continue
    }
    for (const tile of layer.tiles) {
      const tileset = resolveTilesetForTile(tile, map.tilesets)
      if (matchesTileType(tileset.tileTypes[tile.localId])) {
        keys.add(createTileLookupKey(tile.x, tile.y))
      }
    }
  }
  return keys
}

export const isCharacterOnGrass = (
  character: CharacterState,
  grassTiles: Set<string>
): boolean => {
  const tileX = Math.floor(
    character.position.x + character.collisionSize.width / 2
  )
  const tileY = Math.floor(
    character.position.y + character.collisionSize.height / 2
  )

  return grassTiles.has(createTileLookupKey(tileX, tileY))
}

export const createTileLookupKey = (tileX: number, tileY: number): string =>
  `${tileX},${tileY}`

export const createCollisionRectFromCharacter = (
  character: CharacterState
): CollisionRect => ({
  x: character.position.x,
  y: character.position.y,
  width: character.collisionSize.width,
  height: character.collisionSize.height
})

export const createCollisionRectFromPortal = (portal: MapPortal): CollisionRect => ({
  x: portal.position.x,
  y: portal.position.y,
  width: portal.collisionSize.width,
  height: portal.collisionSize.height
})

export const getTileDepthSortValue = (tileY: number, tileHeight: number): number =>
  (tileY + 1) * tileHeight

export const getCharacterDepthSortValue = (
  characterY: number,
  characterPixelHeight: number,
  tileHeight: number
): number => characterY * tileHeight + characterPixelHeight

export const isPlayerRollModifierCode = (code: string): boolean =>
  code === 'ShiftLeft' || code === 'ShiftRight'

export const getFacingFromRollVector = (
  vector: PlayerRollVector,
  fallbackFacing: CharacterMoveDirection
): CharacterMoveDirection => {
  if (Math.abs(vector.x) >= Math.abs(vector.y) && vector.x !== 0) {
    return vector.x > 0 ? 'right' : 'left'
  }

  if (vector.y !== 0) {
    return vector.y > 0 ? 'down' : 'up'
  }

  return fallbackFacing
}

export const resolveCharacterTexture = (
  appearanceType: string,
  tileTextures: Texture[],
  tileset: ParsedTiledTileset,
  fallbackTilesets: ParsedTiledTileset[],
  fallbackTileTextureResources: Map<string, TilesetRenderResources>,
  mapTileWidth: number
): ResolvedCharacterAppearanceTexture => {
  const characterTexture = resolveTextureByAppearanceType(
    appearanceType,
    tileTextures,
    tileset
  )

  if (characterTexture) {
    return {
      texture: characterTexture,
      renderScale: mapTileWidth / tileset.tileWidth
    }
  }

  for (const fallbackTileset of fallbackTilesets) {
    const fallbackTileTextureResource = fallbackTileTextureResources.get(
      fallbackTileset.source
    )

    if (!fallbackTileTextureResource) {
      throw new Error(
        `Missing render resources for tileset ${fallbackTileset.source}`
      )
    }

    const fallbackTexture = resolveTextureByAppearanceType(
      appearanceType,
      fallbackTileTextureResource.tileTextures,
      fallbackTileset
    )

    if (fallbackTexture) {
      return {
        texture: fallbackTexture,
        renderScale: mapTileWidth / fallbackTileset.tileWidth
      }
    }
  }

  throw new Error(`Could not resolve tileset tile type ${appearanceType}`)
}

export const resolveTextureByAppearanceType = (
  appearanceType: string,
  tileTextures: Texture[],
  tileset: ParsedTiledTileset
): Texture | undefined => {
  try {
    const localId = resolveTilesetLocalIdByType(tileset, appearanceType)

    return tileTextures[localId]
  } catch {
    return undefined
  }
}

export const resolveTilesetLocalIdByType = (
  tileset: ParsedTiledTileset,
  tileType: string
): number => {
  const entry = Object.entries(tileset.tileTypes).find(
    ([, candidateType]) => candidateType === tileType
  )

  if (!entry) {
    throw new Error(`Could not resolve tileset tile type ${tileType}`)
  }

  return Number(entry[0])
}
