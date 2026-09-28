import { buildMapPreviewInputs } from './buildMapPreviewInputs'
import type { GameFile } from './loadGame'
import type { ParsedTiledMap, ParsedTiledEvent } from '../games/my-sample-rpg/tiled/parseTiledMap'
import { getSpriteTransformForTile } from '../games/my-sample-rpg/rendering/tiledSpriteTransform'

export const buildingPreviewTiles = (map: ParsedTiledMap, object: ParsedTiledEvent) => {
  const families = new Set(({ building: ['roof', 'chimney', 'gable', 'window', 'wall', 'market', 'clocktower', 'stairs', 'door', 'ladder'], tree: ['tree', 'stump', 'bush'], fountain: ['fountain'], lamp: ['streetlamp'], flower: ['flower', 'planter'], prop: ['barrel', 'basket', 'bucket', 'planter', 'flower', 'crate'] } as Record<string, string[]>)[object.className] ?? [])
  return map.layers.flatMap(layer => {
    if (!layer.visible || ['ground', 'shadow_lower', 'shadow_upper'].includes(layer.name)) return []
    return layer.tiles.flatMap(tile => {
      const x = tile.x * map.tileWidth
      const y = tile.y * map.tileHeight
      if (x < object.x || y < object.y || x >= object.x + object.width || y >= object.y + object.height) return []
      const tileset = map.tilesets.find(set => tile.gid >= set.firstGid && tile.gid < set.firstGid + set.tileCount)
      if (!tileset) return []
      const type = tileset.tileTypes[tile.localId] ?? ''
      if (type === 'wall_cobble_fill' || (object.className === 'building' && ['chimney_double_shadow', 'chimney_single_shadow', 'market_prop_411'].includes(type))) return []
      const included = families.has(type.split('_')[0]) || (object.className === 'building' && type.startsWith('flower_box')) ||
        (object.className === 'lamp' && ['clocktower_face_mid_02', 'clocktower_face_lower_02'].includes(type)) ||
        (object.name === 'town_hall' && type.startsWith('ground_pit_large_bottom')) ||
        (object.className === 'tree' && ['town_prop_325', 'streetlamp_unlit_top_02'].includes(type)) ||
        (object.name === 'clock_tower' && ['town_prop_371', 'town_prop_387', 'streetlamp_lit_mid_right_cluster_00', 'streetlamp_lit_mid_right_cluster_01'].includes(type)) ||
        (object.className === 'fountain' && ['chimney_double_shadow', 'chimney_single_shadow'].includes(type))
      return included ? [{ tile, tileset, opacity: layer.opacity }] : []
    })
  })
}

export const buildLayeredObjectHoverPreview = async (files: GameFile[], mapPath: string, id: string): Promise<HTMLElement | undefined> => {
  const result = buildMapPreviewInputs(files, mapPath)
  if (!result.ok) return undefined
  const { map, imageUrls } = result.inputs
  const object = map.eventLayers.flatMap(layer => layer.events).find(event => event.name === id)
  if (!object || !object.width || !object.height) return undefined
  const cells = buildingPreviewTiles(map, object)
  const images = new Map<string, HTMLImageElement>()
  for (const source of new Set(cells.map(cell => cell.tileset.image.source))) {
    const image = new Image()
    image.src = imageUrls[source]
    try { await image.decode() } catch { return undefined }
    images.set(source, image)
  }
  const canvas = document.createElement('canvas')
  canvas.width = object.width
  canvas.height = object.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined
  ctx.imageSmoothingEnabled = false
  for (const { tile, tileset, opacity } of cells) {
    const image = images.get(tileset.image.source)!
    const transform = getSpriteTransformForTile(tile)
    ctx.save()
    ctx.globalAlpha = opacity
    ctx.translate(tile.x * map.tileWidth - object.x + map.tileWidth / 2, tile.y * map.tileHeight - object.y + map.tileHeight / 2)
    ctx.rotate(transform.rotation)
    ctx.scale(transform.scaleX, transform.scaleY)
    ctx.drawImage(image,
      tileset.margin + tile.localId % tileset.columns * (tileset.tileWidth + tileset.spacing),
      tileset.margin + Math.floor(tile.localId / tileset.columns) * (tileset.tileHeight + tileset.spacing),
      tileset.tileWidth, tileset.tileHeight, -map.tileWidth / 2, -map.tileHeight / 2, map.tileWidth, map.tileHeight)
    ctx.restore()
  }
  const scale = 220 / Math.max(canvas.width, canvas.height)
  canvas.style.cssText = `display:block;image-rendering:pixelated;width:${Math.round(canvas.width * scale)}px;height:${Math.round(canvas.height * scale)}px`
  return canvas
}
