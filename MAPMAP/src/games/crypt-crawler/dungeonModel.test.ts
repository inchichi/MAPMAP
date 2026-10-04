import { describe, expect, it } from 'vitest'

import type {
  ParsedTiledEvent,
  ParsedTiledEventLayer,
  ParsedTiledMap,
  ParsedTiledPropertyValue,
  ParsedTiledTile
} from '../my-sample-rpg/tiled/parseTiledMap'
import { buildDungeonModel, isBlocked, moveWithCollision } from './dungeonModel'

// 8x8 축소 던전. 테두리 한 겹이 벽이고, 안쪽 (4,3) 에 기둥이 하나 서 있다.
//   . . . . . . . .
//   . _ _ _ _ _ _ .
//   . _ _ _ _ _ _ .
//   . _ _ _ # _ _ .
//   . _ _ _ _ _ _ .
const MAP_SIZE = 8
const TILE_SIZE = 16
const PILLAR_TILE = { x: 4, y: 3 }

const collisionTiles = (): ParsedTiledTile[] => {
  const tiles: ParsedTiledTile[] = []

  for (let y = 0; y < MAP_SIZE; y += 1) {
    for (let x = 0; x < MAP_SIZE; x += 1) {
      const border = x === 0 || y === 0 || x === MAP_SIZE - 1 || y === MAP_SIZE - 1
      const pillar = x === PILLAR_TILE.x && y === PILLAR_TILE.y

      if (border || pillar) {
        tiles.push({
          x,
          y,
          gid: 1,
          localId: 0,
          flipHorizontally: false,
          flipVertically: false,
          flipDiagonally: false
        })
      }
    }
  }

  return tiles
}

const tiledObject = (
  id: number,
  className: string,
  x: number,
  y: number,
  width: number,
  height: number,
  properties: Record<string, ParsedTiledPropertyValue>
): ParsedTiledEvent => ({
  id,
  name: '',
  className,
  x,
  y,
  width,
  height,
  visible: true,
  properties
})

const eventLayer = (
  id: number,
  name: string,
  events: ParsedTiledEvent[]
): ParsedTiledEventLayer => ({ id, name, opacity: 1, visible: true, events })

const testMap = (): ParsedTiledMap => ({
  width: MAP_SIZE,
  height: MAP_SIZE,
  tileWidth: TILE_SIZE,
  tileHeight: TILE_SIZE,
  pixelWidth: MAP_SIZE * TILE_SIZE,
  pixelHeight: MAP_SIZE * TILE_SIZE,
  layers: [
    { id: 1, name: 'ground', width: MAP_SIZE, height: MAP_SIZE, opacity: 1, visible: true, tiles: [] },
    {
      id: 2,
      name: 'collision',
      width: MAP_SIZE,
      height: MAP_SIZE,
      opacity: 1,
      visible: false,
      tiles: collisionTiles()
    }
  ],
  eventLayers: [
    eventLayer(3, 'spawns', [tiledObject(1, 'player_spawn', 32, 48, 16, 16, {})]),
    eventLayer(4, 'monsters', [
      tiledObject(2, 'monster', 48, 16, 16, 16, { kind: 'skull', level: 3, pack: 1 }),
      tiledObject(3, 'monster', 64, 16, 16, 16, { kind: 'skull', level: 3, pack: 1 }),
      tiledObject(4, 'monster', 80, 96, 16, 16, { kind: 'beast', level: 9, pack: 2 })
    ]),
    eventLayer(5, 'chests', [tiledObject(5, 'chest', 96, 96, 16, 16, { tier: 2 })]),
    eventLayer(6, 'bosses', [
      tiledObject(6, 'boss', 96, 16, 16, 16, { kind: 'demoncyclop', level: 32 })
    ]),
    eventLayer(7, 'zones', [
      tiledObject(7, 'zone', 0, 0, 64, 128, { zoneId: 0, name: '무너진 관문', level: 1 }),
      tiledObject(8, 'zone', 64, 0, 64, 128, { zoneId: 1, name: '납골당', level: 5 })
    ]),
    eventLayer(8, 'stairs', [
      tiledObject(10, 'stairs_down', 32, 32, 16, 16, {
        target: 'floor-2-mushroom',
        targetX: 40,
        targetY: 12
      }),
      tiledObject(11, 'stairs_up', 80, 32, 16, 16, {
        target: 'floor-1-ruins',
        targetX: 5,
        targetY: 6
      })
    ])
  ],
  tilesets: []
})

const model = buildDungeonModel(testMap())

describe('buildDungeonModel', () => {
  it('bakes the collision layer into a flat grid', () => {
    expect(model.width).toBe(8)
    expect(model.height).toBe(8)
    expect(model.collision.length).toBe(64)
    expect(model.collision[PILLAR_TILE.y * MAP_SIZE + PILLAR_TILE.x]).toBe(1)
    expect(model.collision[3 * MAP_SIZE + 3]).toBe(0)
  })

  it('reads the spawn points in tile coordinates', () => {
    expect(model.playerSpawn).toEqual({ tileX: 2, tileY: 3 })
    expect(model.monsters).toHaveLength(3)
    expect(model.monsters[2]).toEqual({
      kind: 'beast',
      level: 9,
      pack: 2,
      tileX: 5,
      tileY: 6
    })
    expect(model.chests).toEqual([{ tier: 2, tileX: 6, tileY: 6 }])
    expect(model.bosses).toEqual([
      { kind: 'demoncyclop', level: 32, tileX: 6, tileY: 1 }
    ])
  })

  it('converts zone rectangles to tiles', () => {
    expect(model.zones[0]).toEqual({
      zoneId: 0,
      name: '무너진 관문',
      level: 1,
      x: 0,
      y: 0,
      width: 4,
      height: 8
    })
    expect(model.zones[1].x).toBe(4)
  })

  it('reads stairs with their destination floor and arrival tile', () => {
    // 목적지 타일은 픽셀이 아니라 타일이다 — 그대로 넘어와야 한다.
    expect(model.stairs).toEqual([
      {
        direction: 'down',
        target: 'floor-2-mushroom',
        targetTileX: 40,
        targetTileY: 12,
        tileX: 2,
        tileY: 2
      },
      {
        direction: 'up',
        target: 'floor-1-ruins',
        targetTileX: 5,
        targetTileY: 6,
        tileX: 5,
        tileY: 2
      }
    ])
  })

  it('refuses stairs without a destination', () => {
    const broken = testMap()

    expect(() =>
      buildDungeonModel({
        ...broken,
        eventLayers: broken.eventLayers.map((layer) =>
          layer.name === 'stairs'
            ? eventLayer(8, 'stairs', [
                tiledObject(12, 'stairs_down', 32, 32, 16, 16, { targetX: 1, targetY: 1 })
              ])
            : layer
        )
      })
    ).toThrow(/target/)
  })

  it('tolerates a map with no chests or bosses', () => {
    const bare = testMap()
    const trimmed = buildDungeonModel({
      ...bare,
      eventLayers: bare.eventLayers.filter(
        (layer) => layer.name !== 'chests' && layer.name !== 'bosses'
      )
    })

    expect(trimmed.chests).toEqual([])
    expect(trimmed.bosses).toEqual([])
  })

  it('refuses a map that cannot be played', () => {
    expect(() => buildDungeonModel({ ...testMap(), layers: [] })).toThrow(/collision/)

    const noSpawn = testMap()

    expect(() =>
      buildDungeonModel({
        ...noSpawn,
        eventLayers: noSpawn.eventLayers.filter((layer) => layer.name !== 'spawns')
      })
    ).toThrow(/player_spawn/)

    const badMonster = testMap()

    expect(() =>
      buildDungeonModel({
        ...badMonster,
        eventLayers: badMonster.eventLayers.map((layer) =>
          layer.name === 'monsters'
            ? eventLayer(4, 'monsters', [
                tiledObject(9, 'monster', 48, 16, 16, 16, { kind: 'skull', pack: 1 })
              ])
            : layer
        )
      })
    ).toThrow(/level/)
  })
})

describe('isBlocked', () => {
  it('reports walls, floors and everything outside the map', () => {
    expect(isBlocked(model, 4, 3)).toBe(true)
    expect(isBlocked(model, 3, 3)).toBe(false)
    expect(isBlocked(model, 0, 0)).toBe(true)
    expect(isBlocked(model, -1, 3)).toBe(true)
    expect(isBlocked(model, 3, -1)).toBe(true)
    expect(isBlocked(model, MAP_SIZE, 3)).toBe(true)
    expect(isBlocked(model, 3, MAP_SIZE)).toBe(true)
  })
})

describe('moveWithCollision', () => {
  const radius = 0.4

  it('moves freely in the open', () => {
    expect(moveWithCollision(model, 1.5, 3.5, 0.25, 0, radius)).toEqual({
      x: 1.75,
      y: 3.5
    })
  })

  it('stops dead against a wall it walks straight into', () => {
    expect(moveWithCollision(model, 1.5, 6.5, 0, 0.5, radius)).toEqual({
      x: 1.5,
      y: 6.5
    })
  })

  it('slides along the wall instead of sticking to it', () => {
    expect(moveWithCollision(model, 1.5, 6.5, 0.5, 0.5, radius)).toEqual({
      x: 2,
      y: 6.5
    })
  })

  it('slides along a pillar face', () => {
    const slid = moveWithCollision(model, 3.4, 3.5, 0.3, 0.3, radius)

    expect(slid.x).toBe(3.4)
    expect(slid.y).toBeCloseTo(3.8)
  })

  it('keeps the whole body inside the map', () => {
    expect(moveWithCollision(model, 1.5, 1.5, -1, 0, radius)).toEqual({ x: 1.5, y: 1.5 })
  })

  it('lets a body end up exactly flush against a wall face', () => {
    // 반지름 0.5 로 x=3.5 에 서면 오른쪽 끝이 기둥(4,3) 의 왼쪽 면에 정확히 닿는다.
    // 경계에 닿은 것을 겹침으로 세면 벽에 붙지 못하고 한 칸 앞에서 멈춘다.
    expect(moveWithCollision(model, 3, 3.5, 0.5, 0, 0.5)).toEqual({ x: 3.5, y: 3.5 })
  })
})
