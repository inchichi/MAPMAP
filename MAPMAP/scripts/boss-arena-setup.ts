// 시험장(boss-arena) 맵을 읽어 시뮬레이터 설정으로 만든다. 시뮬레이션·학습 스크립트가 같이 쓴다.
import { readFileSync } from 'node:fs'

import type { FightSetup } from '../src/games/my-sample-rpg/bossTraining/bossFightSim'
import { createWallTileLookup } from '../src/games/my-sample-rpg/tiled/createWallTileLookup'
import { parseTiledMap } from '../src/games/my-sample-rpg/tiled/parseTiledMap'

// 서버로 보낼 수 있게 순수 데이터로 둔다(벽은 'x,y' 칸 목록)
export type BossArenaData = {
  width: number
  height: number
  walls: string[]
  bossStart: { x: number; y: number }
  playerStart: { x: number; y: number }
}

const ASSETS = new URL('../src/games/my-sample-rpg/assets/', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, ASSETS), 'utf8')

export const loadBossArenaData = (): BossArenaData => {
  const map = parseTiledMap({
    mapXml: read('maps/boss-arena.tmx'),
    externalTilesets: {
      '../tilesets/town-32.tsx': read('tilesets/town-32.tsx'),
      '../tilesets/biome-snow.tsx': read('tilesets/biome-snow.tsx')
    }
  })
  return {
    width: map.width,
    height: map.height,
    walls: [...createWallTileLookup(map)],
    // 보스는 맵에 둔 자리(464,320 px = 14.5,10 칸)의 가운데, 플레이어는 남쪽에서 다가오는 자리
    bossStart: { x: 15, y: 10.5 },
    playerStart: { x: 14.5, y: 16.5 }
  }
}

// 레벨 10 플레이어가 물약 6개를 들고 레벨 10 시험 보스와 싸운다(docs/boss-rl-design.md 의 Balance)
export const createBossArenaSetup = (arena: BossArenaData, potions = 6): FightSetup => {
  const walls = new Set(arena.walls)
  return {
    isWall: (x, y) => x < 0 || y < 0 || x >= arena.width || y >= arena.height || walls.has(`${x},${y}`),
    bossStart: arena.bossStart,
    playerStart: arena.playerStart,
    playerLevel: 10,
    bossLevel: 10,
    potions
  }
}
