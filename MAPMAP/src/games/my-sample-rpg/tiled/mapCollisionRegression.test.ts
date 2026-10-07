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
      '../tilesets/town-32.tsx': townTilesetXml,
      '../tilesets/biome-snow.tsx': readFileSync(new URL('../assets/tilesets/biome-snow.tsx', import.meta.url), 'utf8')
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

  it('opens the chapter 2 aqueduct arch above the sluice in both directions', () => {
    const village = portalNamed('harvest-village', 'upstream_gate')
    const villageWalls = wallsOf('harvest-village')
    for (let tileX = 11; tileX <= 13; tileX += 1) {
      expect(isWallTileAt(villageWalls, tileX, 4)).toBe(false)
      expect(tileX).toBeGreaterThanOrEqual(village.position.x)
      expect(tileX).toBeLessThan(village.position.x + village.collisionSize.width)
    }
    expect(village.targetSceneId).toBe('upstream-waterway')

    const upstream = portalNamed('upstream-waterway', 'aqueduct_gate')
    const upstreamWalls = wallsOf('upstream-waterway')
    for (let tileX = 4; tileX <= 6; tileX += 1) {
      expect(isWallTileAt(upstreamWalls, tileX, 23)).toBe(false)
    }
    expect(upstream.targetSceneId).toBe('harvest-village')
    // 서로의 도착 칸은 벽이 아니다
    expect(isWallTileAt(upstreamWalls, village.targetSpawn.x, village.targetSpawn.y)).toBe(false)
    expect(isWallTileAt(villageWalls, upstream.targetSpawn.x, upstream.targetSpawn.y)).toBe(false)
  })

  it('ferries between the upstream lookout and the reed village pier', () => {
    const ferry = portalNamed('upstream-waterway', 'reed_ferry')
    const dock = portalNamed('reed-village', 'ferry_dock')
    expect(ferry.targetSceneId).toBe('reed-village')
    expect(dock.targetSceneId).toBe('upstream-waterway')
    // 나룻배 칸과 서로의 도착 칸은 걸을 수 있는 칸(잔교·나루 데크)이다
    expect(isWallTileAt(wallsOf('upstream-waterway'), ferry.position.x, ferry.position.y)).toBe(false)
    expect(isWallTileAt(wallsOf('reed-village'), dock.position.x, dock.position.y)).toBe(false)
    expect(isWallTileAt(wallsOf('reed-village'), ferry.targetSpawn.x, ferry.targetSpawn.y)).toBe(false)
    expect(isWallTileAt(wallsOf('upstream-waterway'), dock.targetSpawn.x, dock.targetSpawn.y)).toBe(false)
  })

  it('opens the reed village forest gate onto the sunken forest entrance', () => {
    const gate = portalNamed('reed-village', 'forest_gate')
    const back = portalNamed('sunken-forest', 'reed_gate')
    expect(gate.targetSceneId).toBe('sunken-forest')
    expect(back.targetSceneId).toBe('reed-village')
    expect(isWallTileAt(wallsOf('sunken-forest'), gate.targetSpawn.x, gate.targetSpawn.y)).toBe(false)
    expect(isWallTileAt(wallsOf('reed-village'), back.targetSpawn.x, back.targetSpawn.y)).toBe(false)
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

  it('seals the hunting ground orphan pockets with visible props', () => {
    // 고립 칸은 투명 블록(gid 302)이 아니라 눈에 보이는 덤불로 메운다.
    // 고립 칸이 아예 없는지는 아래 'every open cell is reachable'이 확인한다.
    const objectLayer = loadMap('hunting-ground').layers.find(
      (layer) => layer.name === 'object'
    )

    expect(objectLayer?.tiles.filter((tile) => tile.gid === 302)).toEqual([])
  })

  // 바닥에 깔린 것처럼 보이는 작은 돌무더기·이끼·뼈·부스러기·풀은 길을 막지 않는다
  // (길가에서 걸리면 어디가 막혔는지 알 수 없다). 막힌 지대 안쪽에 있는 것만 남는다.
  it.each([
    ['hunting-ground', [2, 10]],
    ['cave', [2, 10]],
    ['crystal-mine', [29, 35]],
    ['upstream-waterway', [5, 21]],
    ['reed-village', [3, 17]],
    ['sunken-forest', [2, 22]],
    ['ruins-outskirts', [2, 19]],
    ['harvest-village', [2, 10]]
  ] as [string, [number, number]][])('keeps floor-looking props off the walkable area in %s', (name, start) => {
    const FLOOR_LOOKING_GIDS = new Set([527, 528, 1084, 1085, 1086, 1107, 1108, 1129, 1130, 1133, 1158])
    const map = loadMap(name)
    const walls = createWallTileLookup(map)
    const seen = new Set<string>([start.join(',')])
    const queue = [start]

    while (queue.length > 0) {
      const [x, y] = queue.shift() as [number, number]
      for (const [nextX, nextY] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        const key = `${nextX},${nextY}`
        if (nextX < 0 || nextY < 0 || nextX >= map.width || nextY >= map.height || seen.has(key) || isWallTileAt(walls, nextX, nextY)) {
          continue
        }
        seen.add(key)
        queue.push([nextX, nextY])
      }
    }

    const blockingFloorProps = (map.layers.find((layer) => layer.name === 'object')?.tiles ?? [])
      .filter((tile) => FLOOR_LOOKING_GIDS.has(tile.gid))
      .filter(({ x, y }) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some((cell) => seen.has(cell.join(','))))
      .map(({ x, y, gid }) => `${x},${y}:${gid}`)

    expect(blockingFloorProps).toEqual([])
  })
})

describe('hunting ground layout', () => {
  // 사냥터는 scripts/generate-hunting-ground.py 가 만든다. 다시 생성해도
  // 포탈 도착 칸·몬스터 자리·예약 자리가 막히지 않는지 고정한다.
  const map = loadMap('hunting-ground')
  const walls = createWallTileLookup(map)
  const characters = map.eventLayers.find((layer) => layer.name === 'characters')?.events ?? []
  const monsters = characters.filter((event) =>
    String(event.appearanceType).startsWith('monster_')
  )
  const tileOf = (event: { x: number; y: number }) => [event.x / 32, event.y / 32] as const

  it('keeps both portals and their arrival tiles where other maps expect them', () => {
    expect(portalNamed('hunting-ground', 'return_gate').position).toEqual({ x: 0, y: 10 })
    expect(portalNamed('hunting-ground', 'cave_entrance').position).toEqual({ x: 49, y: 10 })

    // town.tmx east_gate → (2,10), cave.tmx return_gate → (43,10), 포탈 없이 열면 맵 중앙
    for (const [x, y] of [
      [0, 10],
      [0, 11],
      [49, 10],
      [49, 11],
      [2, 10],
      [43, 10],
      [25, 25]
    ]) {
      expect(isWallTileAt(walls, x, y)).toBe(false)
    }
  })

  it('has enough quest monsters with open ground around each spawn', () => {
    const countOf = (type: string) =>
      monsters.filter((event) => event.appearanceType === type).length

    // q001 은 말캉이, q003 은 꿀꿀이를 이 씬에서 센다.
    expect(countOf('monster_slime')).toBeGreaterThanOrEqual(6)
    expect(countOf('monster_pig')).toBeGreaterThanOrEqual(5)
    expect(monsters.length).toBeGreaterThanOrEqual(13)

    for (const monster of monsters) {
      const [x, y] = tileOf(monster)

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          expect(isWallTileAt(walls, x + dx, y + dy)).toBe(false)
        }
      }
    }
  })

  it('places the camp merchant, return stone and mine shortcut on open ground', () => {
    const portals = map.eventLayers.find((layer) => layer.name === 'portals')?.events ?? []

    expect(characters.some((event) => event.name === 'camp_merchant')).toBe(true)
    expect(characters.some((event) => event.name === 'hidden_cache')).toBe(true)

    for (const name of ['return_stone', 'mine_shortcut']) {
      const portal = portals.find((event) => event.name === name)

      expect(portal).toBeDefined()
      expect(isWallTileAt(walls, portal!.x / 32, portal!.y / 32)).toBe(false)
    }

    // 지름길은 q009 를 마쳐야 열리고, 그 칸의 낙석은 q009 를 마치면 사라진다.
    expect(portals.find((event) => event.name === 'mine_shortcut')?.properties['quest.requiresCompleted']).toBe(
      'q009-mine-ore-rush'
    )
    expect(
      characters.find((event) => event.name === 'gated_boulder')?.properties['quest.hiddenWhenCompleted']
    ).toBe('q009-mine-ore-rush')
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
    ['crystal-mine', [29, 35] as [number, number]],
    ['upstream-waterway', [5, 21] as [number, number]],
    ['reed-village', [3, 17] as [number, number]],
    ['sunken-forest', [2, 22] as [number, number]],
    ['ruins-outskirts', [2, 19] as [number, number]],
    ['sunken-temple-1f', [19, 35] as [number, number]],
    ['sunken-temple-2f', [14, 25] as [number, number]],
    ['reed-well', [10, 16] as [number, number]],
    ['north-pass', [24, 25] as [number, number]],
    ['frost-village', [22, 33] as [number, number]],
    ['frozen-lake', [2, 20] as [number, number]],
    ['ice-cave-1f', [20, 36] as [number, number]],
    ['ice-cave-2f', [14, 25] as [number, number]]
  ])('leaves no unreachable floor in %s', (name, start) => {
    expect(reachableFrom(name, start)).toEqual([])
  })
})
