import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { createMapPortalsFromEventLayers } from './createMapPortalsFromEventLayers'
import { createWallTileLookup, isWallTileAt } from './createWallTileLookup'
import { parseTiledMap } from './parseTiledMap'

// 맵 생성기를 다시 돌리거나 시드를 바꿔도 "보이는데 못 가는 칸"과
// "길보다 좁은 포탈"이 조용히 되살아나지 않도록 고정한다.

const townTilesetXml = readFileSync(
  new URL('../assets/tilesets/town-32.tsx', import.meta.url),
  'utf8'
)

const loadMap = (name: string) =>
  parseTiledMap({
    mapXml: readFileSync(
      new URL(`../assets/maps/${name}.tmx`, import.meta.url),
      'utf8'
    ),
    externalTilesets: {
      '../tilesets/town-32.tsx': townTilesetXml
    }
  })

const wallsOf = (name: string) => createWallTileLookup(loadMap(name))

const portalNamed = (name: string, portalId: string) => {
  const portal = createMapPortalsFromEventLayers({ map: loadMap(name) }).find(
    (candidate) => candidate.id === portalId
  )

  if (!portal) {
    throw new Error(`Missing portal ${portalId} in ${name}`)
  }

  return portal
}

describe('portal footprints cover their whole approach corridor', () => {
  it('spans all four road columns at the harvest village north gate', () => {
    const portal = portalNamed('harvest-village', 'north_arch_gate')
    const walls = wallsOf('harvest-village')

    expect(portal.position.x).toBe(28)
    expect(portal.collisionSize.width).toBe(4)

    // 관문 통로 네 칸 전부 걸어갈 수 있고, 전부 포탈 범위 안이어야 한다.
    for (let tileX = 28; tileX <= 31; tileX += 1) {
      expect(isWallTileAt(walls, tileX, 2)).toBe(false)
      expect(tileX).toBeGreaterThanOrEqual(portal.position.x)
      expect(tileX).toBeLessThan(portal.position.x + portal.collisionSize.width)
    }
  })

  it('spans both walkable columns at the cave mine shaft', () => {
    const portal = portalNamed('cave', 'mine_shaft')

    expect(portal.position.x).toBe(29)
    expect(portal.collisionSize.width).toBe(2)
  })
})

describe('no invisible walls on visible floor', () => {
  it('keeps the crystal mine gravel room free of lone wall cells', () => {
    const walls = wallsOf('crystal-mine')

    expect(isWallTileAt(walls, 7, 24)).toBe(false)
    expect(isWallTileAt(walls, 7, 27)).toBe(false)
  })

  it('opens the cave crystal alcove approach and fills the sealed pocket', () => {
    const walls = wallsOf('cave')

    // 골방으로 드는 길이 두 갈래가 되어야 한다.
    expect(isWallTileAt(walls, 28, 5)).toBe(false)
    expect(isWallTileAt(walls, 29, 3)).toBe(false)
    expect(isWallTileAt(walls, 29, 4)).toBe(false)
    // 영영 닿을 수 없던 빈 칸은 오벨리스크로 메워 눈에 보이게 만든다.
    expect(isWallTileAt(walls, 26, 3)).toBe(true)
  })

  it('widens the harvest village pen gates to two tiles', () => {
    const walls = wallsOf('harvest-village')

    expect(isWallTileAt(walls, 14, 20)).toBe(false)
    expect(isWallTileAt(walls, 15, 20)).toBe(false)
    expect(isWallTileAt(walls, 21, 21)).toBe(false)
    expect(isWallTileAt(walls, 22, 21)).toBe(false)
  })

  it('seals the hunting ground orphan pockets with visible rock', () => {
    const walls = wallsOf('hunting-ground')

    expect(isWallTileAt(walls, 47, 14)).toBe(true)
  })
})

describe('every open cell is reachable', () => {
  const reachableFrom = (name: string, start: [number, number]) => {
    const map = loadMap(name)
    const walls = createWallTileLookup(map)
    const seen = new Set<string>([`${start[0]},${start[1]}`])
    const queue: [number, number][] = [start]

    while (queue.length > 0) {
      const [x, y] = queue.shift() as [number, number]

      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ]) {
        const nextX = x + dx
        const nextY = y + dy
        const key = `${nextX},${nextY}`

        if (
          nextX < 0 ||
          nextY < 0 ||
          nextX >= map.width ||
          nextY >= map.height ||
          seen.has(key) ||
          isWallTileAt(walls, nextX, nextY)
        ) {
          continue
        }

        seen.add(key)
        queue.push([nextX, nextY])
      }
    }

    const orphans: string[] = []

    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (!isWallTileAt(walls, x, y) && !seen.has(`${x},${y}`)) {
          orphans.push(`${x},${y}`)
        }
      }
    }

    return orphans
  }

  it.each([
    ['hunting-ground', [2, 10] as [number, number]],
    ['cave', [2, 10] as [number, number]],
    ['crystal-mine', [29, 35] as [number, number]]
  ])('leaves no unreachable floor in %s', (name, start) => {
    expect(reachableFrom(name, start)).toEqual([])
  })
})
