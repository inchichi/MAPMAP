import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseTiledMap } from '../games/my-sample-rpg/tiled/parseTiledMap'
import { buildingPreviewTiles } from './buildBuildingHoverPreview'
import { extractTmxTileClusters } from './tmxTileEntities'

const map = parseTiledMap({
  mapXml: readFileSync('src/games/my-sample-rpg/assets/maps/town.tmx', 'utf8'),
  externalTilesets: { '../tilesets/town-32.tsx': readFileSync('src/games/my-sample-rpg/assets/tilesets/town-32.tsx', 'utf8') }
})
describe('building hover layers', () => {
  it('includes shared clock tiles in all four lower streetlamps', () => {
    for (const n of [7, 9, 10, 12]) {
      const lamp = map.eventLayers.flatMap(layer => layer.events).find(event => event.name === `lamp_${n}`)!
      const types = buildingPreviewTiles(map, lamp).map(({ tile, tileset }) => tileset.tileTypes[tile.localId])
      expect(types).toContain('clocktower_face_mid_02')
      expect(types).toContain('clocktower_face_lower_02')
      expect(types).toHaveLength(6)
    }
  })
  it('does not reintroduce canopy and clock fragments as automatic props or lamps', () => {
    const clusters = extractTmxTileClusters(readFileSync('src/games/my-sample-rpg/assets/maps/town.tmx', 'utf8'), {
      resolveTilesetText: () => readFileSync('src/games/my-sample-rpg/assets/tilesets/town-32.tsx', 'utf8'),
      excludeRects: map.eventLayers.flatMap(layer => layer.events).filter(e => e.width > 0).map(e => ({ ...e, kind: e.className }))
    })
    for (const [x, y] of [[14,12], [0,40], [26,32], [26,34]]) {
      expect(clusters.some(c => c.kind === 'prop' && c.tileX === x && c.tileY === y)).toBe(false)
    }
  })
  it('keeps walls under windows and excludes surrounding props', () => {
    const hall = map.eventLayers.flatMap(layer => layer.events).find(event => event.name === 'town_hall')!
    const cells = buildingPreviewTiles(map, hall)
    const types = cells.map(({ tile, tileset }) => tileset.tileTypes[tile.localId])
    expect(types.some(type => type.startsWith('wall_'))).toBe(true)
    expect(types.some(type => type.startsWith('window_'))).toBe(true)
    expect(types.some(type => /^(fountain|planter|barrel|tree)_/.test(type))).toBe(false)
    const window = cells.find(({ tile, tileset }) => tileset.tileTypes[tile.localId].startsWith('window_'))!
    expect(cells.some(({ tile, tileset }) => tile.x === window.tile.x && tile.y === window.tile.y && tileset.tileTypes[tile.localId].startsWith('wall_'))).toBe(true)
  })
  it('excludes the mislabeled barrel beside the southwest house', () => {
    const house = map.eventLayers.flatMap(layer => layer.events).find(event => event.name === 'southwest_house')!
    expect(buildingPreviewTiles(map, house).some(({ tile, tileset }) => tileset.tileTypes[tile.localId] === 'market_prop_411')).toBe(false)
  })
})
