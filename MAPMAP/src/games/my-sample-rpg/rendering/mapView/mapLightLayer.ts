// 맵 빛 층: 빛을 내는 타일(mapLights.ts 의 종류 판정) 둘레에 가산 혼합 빛 원을 깔고 매 프레임 일렁이게 한다.
import { Container, Sprite } from 'pixi.js'
import type { ParsedTiledMap } from '../../tiled/parseTiledMap'
import { resolveTilesetForTile } from '../tiledMapRenderResources'
import {
  getMapLightAlpha,
  getMapLightKind,
  getMapLightScale,
  getMapLightStyle,
  type MapLightKind
} from '../mapLights'
import { getMapLightTexture } from './tiles'

export type MapLightLayerContext = {
  map: ParsedTiledMap
  world: Container
}

export const createMapLightLayer = (ctx: MapLightLayerContext) => {
  const { map, world } = ctx

  // ---------------------------------------------------------------- 빛(mapLights.ts)
  // 화로·모닥불·발광 식물·수정·밝힌 비석 둘레의 가산 혼합 빛 원. 모든 타일 층 위에 얹어 캐릭터도 비춘다.
  const mapLightLayer = new Container()
  mapLightLayer.label = 'layer:lights'
  const mapLights: { sprite: Sprite; kind: MapLightKind; phase: number }[] = []
  for (const layer of map.layers) {
    for (const tile of layer.tiles) {
      const kind = getMapLightKind(resolveTilesetForTile(tile, map.tilesets).tileTypes[tile.localId])
      if (!kind) {
        continue
      }
      const style = getMapLightStyle(kind)
      const sprite = new Sprite(getMapLightTexture())
      sprite.anchor.set(0.5)
      sprite.tint = style.color
      sprite.blendMode = 'add'
      sprite.width = style.radiusTiles * 2 * map.tileWidth
      sprite.height = style.radiusTiles * 2 * map.tileHeight
      sprite.position.set((tile.x + style.offsetX) * map.tileWidth, (tile.y + style.offsetY) * map.tileHeight)
      mapLightLayer.addChild(sprite)
      mapLights.push({ sprite, kind, phase: (tile.x * 7.3 + tile.y * 3.1) % 6.28 })
    }
  }
  world.addChild(mapLightLayer)

  function updateMapLights(now: number): void {
    for (const light of mapLights) {
      light.sprite.alpha = getMapLightAlpha(light.kind, now, light.phase)
      const style = getMapLightStyle(light.kind)
      const scale = getMapLightScale(light.kind, now, light.phase)
      light.sprite.width = style.radiusTiles * 2 * map.tileWidth * scale
      light.sprite.height = style.radiusTiles * 2 * map.tileHeight * scale
    }
  }

  return { updateMapLights }
}
