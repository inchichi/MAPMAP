import type {
  ParsedTiledEvent,
  ParsedTiledMap
} from '../my-sample-rpg/tiled/parseTiledMap'

// 파싱된 TMX 를 게임이 실제로 쓰는 모양으로 줄인다. 384x384 맵이라 충돌은 레이어 하나를
// Uint8Array 로 굽고(147,456 바이트), 나머지는 objectgroup 에서 스폰 목록만 뽑는다.
// 렌더 레이어(ground/wall/prop 등)는 여기서 다루지 않는다 — 렌더러가 직접 읽는다.

export type DungeonZone = {
  zoneId: number
  name: string
  level: number
  x: number
  y: number
  width: number
  height: number
}

export type MonsterSpawn = {
  kind: string
  level: number
  pack: number
  tileX: number
  tileY: number
}

export type ChestSpawn = {
  tier: number
  tileX: number
  tileY: number
}

export type BossSpawn = {
  kind: string
  level: number
  tileX: number
  tileY: number
}

export type StairsDirection = 'down' | 'up'

export type StairsSpawn = {
  direction: StairsDirection
  /** 대상 층 TMX 의 파일명 stem. 예: `floor-2-mushroom`. */
  target: string
  /** 대상 층에서 내려설 타일. */
  targetTileX: number
  targetTileY: number
  tileX: number
  tileY: number
}

export type DungeonModel = {
  width: number
  height: number
  collision: Uint8Array
  playerSpawn: { tileX: number, tileY: number }
  zones: DungeonZone[]
  monsters: MonsterSpawn[]
  chests: ChestSpawn[]
  bosses: BossSpawn[]
  stairs: StairsSpawn[]
}

// 타일 경계에 딱 붙어 선 경우를 "겹쳤다"로 세지 않기 위한 여유값.
const OVERLAP_EPSILON = 1e-6

export const buildDungeonModel = (map: ParsedTiledMap): DungeonModel => {
  const collisionLayer = map.layers.find((layer) => layer.name === 'collision')

  if (!collisionLayer) {
    throw new Error('crypt TMX must have a "collision" tile layer')
  }

  const collision = new Uint8Array(map.width * map.height)

  // 파서는 gid 0(빈 칸)을 이미 빼고 주므로, 남은 타일은 전부 통행 불가다.
  for (const tile of collisionLayer.tiles) {
    collision[tile.y * map.width + tile.x] = 1
  }

  const spawnObject = objectsOf(map, 'spawns', 'player_spawn')[0]

  if (!spawnObject) {
    throw new Error('crypt TMX must have a player_spawn object in the "spawns" layer')
  }

  return {
    width: map.width,
    height: map.height,
    collision,
    playerSpawn: tilePosition(spawnObject, map),
    zones: objectsOf(map, 'zones', 'zone').map((object) => {
      const origin = tilePosition(object, map)

      return {
        zoneId: numberProperty(object, 'zoneId'),
        // 이름은 속성이 정본이지만, Tiled 에서 객체 name 에 적는 경우가 흔해 그쪽도 받아준다.
        name:
          typeof object.properties.name === 'string' ? object.properties.name : object.name,
        level: numberProperty(object, 'level'),
        x: origin.tileX,
        y: origin.tileY,
        width: Math.round(object.width / map.tileWidth),
        height: Math.round(object.height / map.tileHeight)
      }
    }),
    monsters: objectsOf(map, 'monsters', 'monster').map((object) => ({
      kind: stringProperty(object, 'kind'),
      level: numberProperty(object, 'level'),
      pack: numberProperty(object, 'pack'),
      ...tilePosition(object, map)
    })),
    chests: objectsOf(map, 'chests', 'chest').map((object) => ({
      tier: numberProperty(object, 'tier'),
      ...tilePosition(object, map)
    })),
    bosses: objectsOf(map, 'bosses', 'boss').map((object) => ({
      kind: stringProperty(object, 'kind'),
      level: numberProperty(object, 'level'),
      ...tilePosition(object, map)
    })),
    stairs: [
      ...objectsOf(map, 'stairs', 'stairs_down').map((object) => stairs(object, map, 'down')),
      ...objectsOf(map, 'stairs', 'stairs_up').map((object) => stairs(object, map, 'up'))
    ]
  }
}

export const isBlocked = (model: DungeonModel, tileX: number, tileY: number): boolean => {
  if (tileX < 0 || tileY < 0 || tileX >= model.width || tileY >= model.height) {
    return true
  }

  return model.collision[tileY * model.width + tileX] !== 0
}

export const moveWithCollision = (
  model: DungeonModel,
  x: number,
  y: number,
  dx: number,
  dy: number,
  radiusTiles: number
): { x: number, y: number } => {
  // 축을 나눠 따로 판정한다. 벽에 비스듬히 밀어붙이면 막힌 축만 버려지고 남은 축으로 미끄러진다.
  const nextX = overlapsBlocked(model, x + dx, y, radiusTiles) ? x : x + dx
  const nextY = overlapsBlocked(model, nextX, y + dy, radiusTiles) ? y : y + dy

  return { x: nextX, y: nextY }
}

const overlapsBlocked = (
  model: DungeonModel,
  x: number,
  y: number,
  radiusTiles: number
): boolean => {
  const minTileX = Math.floor(x - radiusTiles + OVERLAP_EPSILON)
  const maxTileX = Math.floor(x + radiusTiles - OVERLAP_EPSILON)
  const minTileY = Math.floor(y - radiusTiles + OVERLAP_EPSILON)
  const maxTileY = Math.floor(y + radiusTiles - OVERLAP_EPSILON)

  for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
    for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
      if (isBlocked(model, tileX, tileY)) {
        return true
      }
    }
  }

  return false
}

const objectsOf = (
  map: ParsedTiledMap,
  layerName: string,
  className: string
): ParsedTiledEvent[] => {
  const layer = map.eventLayers.find((eventLayer) => eventLayer.name === layerName)

  if (!layer) {
    return []
  }

  return layer.events.filter((event) => event.className === className)
}

const tilePosition = (
  object: ParsedTiledEvent,
  map: ParsedTiledMap
): { tileX: number, tileY: number } => ({
  tileX: Math.floor(object.x / map.tileWidth),
  tileY: Math.floor(object.y / map.tileHeight)
})

// targetX·targetY 는 픽셀이 아니라 타일이다(계약 1절). 그대로 받는다.
const stairs = (
  object: ParsedTiledEvent,
  map: ParsedTiledMap,
  direction: StairsDirection
): StairsSpawn => ({
  direction,
  target: stringProperty(object, 'target'),
  targetTileX: numberProperty(object, 'targetX'),
  targetTileY: numberProperty(object, 'targetY'),
  ...tilePosition(object, map)
})

const numberProperty = (object: ParsedTiledEvent, key: string): number => {
  const value = object.properties[key]

  if (typeof value !== 'number') {
    throw new Error(`${object.className} object ${object.id} needs a number "${key}" property`)
  }

  return value
}

const stringProperty = (object: ParsedTiledEvent, key: string): string => {
  const value = object.properties[key]

  if (typeof value !== 'string') {
    throw new Error(`${object.className} object ${object.id} needs a string "${key}" property`)
  }

  return value
}
