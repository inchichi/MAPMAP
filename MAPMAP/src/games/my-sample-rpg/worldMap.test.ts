import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  WORLD_MAP_COLUMNS,
  WORLD_MAP_REGIONS,
  WORLD_MAP_ROUTES,
  WORLD_MAP_ROWS,
  isWorldMapRouteVisible
} from './worldMap'

const mapsDirectory = join(dirname(fileURLToPath(import.meta.url)), 'assets/maps')

// TMX 의 portal 오브젝트가 가리키는 씬 쌍(시험장 제외)
const readPortalPairs = (): Set<string> => {
  const pairs = new Set<string>()

  for (const fileName of readdirSync(mapsDirectory).filter((name) => name.endsWith('.tmx'))) {
    const sceneId = fileName.replace(/\.tmx$/, '')
    const xml = readFileSync(join(mapsDirectory, fileName), 'utf8')

    for (const match of xml.matchAll(/type="portal"[\s\S]*?targetSceneId" value="([^"]+)"/g)) {
      const targetSceneId = match[1]

      if (sceneId !== 'boss-arena' && targetSceneId !== 'boss-arena' && sceneId !== targetSceneId) {
        pairs.add([sceneId, targetSceneId].sort().join('|'))
      }
    }
  }

  return pairs
}

describe('worldMap', () => {
  it('places every region in its own cell inside the grid', () => {
    const cells = WORLD_MAP_REGIONS.map((region) => `${region.column},${region.row}`)

    expect(new Set(cells).size).toBe(cells.length)
    expect(new Set(WORLD_MAP_REGIONS.map((region) => region.sceneId)).size).toBe(WORLD_MAP_REGIONS.length)

    for (const region of WORLD_MAP_REGIONS) {
      expect(region.column).toBeGreaterThanOrEqual(0)
      expect(region.column).toBeLessThan(WORLD_MAP_COLUMNS)
      expect(region.row).toBeGreaterThanOrEqual(0)
      expect(region.row).toBeLessThan(WORLD_MAP_ROWS)
    }
  })

  it('draws exactly the routes that map portals connect', () => {
    const routePairs = new Set(WORLD_MAP_ROUTES.map((route) => [...route].sort().join('|')))

    expect(routePairs).toEqual(readPortalPairs())
  })

  it('shows a route once either end has been visited', () => {
    expect(isWorldMapRouteVisible(['town', 'cave'], new Set(['town']))).toBe(true)
    expect(isWorldMapRouteVisible(['town', 'cave'], new Set(['north-pass']))).toBe(false)
  })
})
