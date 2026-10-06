// 시험장(boss-arena) 맵 파일을 읽어 시뮬레이터 설정으로 만든다. 시뮬레이션·학습 스크립트가 같이 쓴다.
import { readFileSync } from 'node:fs'

import { parseBossArenaData, type BossArenaData } from '../src/games/my-sample-rpg/bossTraining/bossArena'

export { createBossArenaSetup, type BossArenaData } from '../src/games/my-sample-rpg/bossTraining/bossArena'

const ASSETS = new URL('../src/games/my-sample-rpg/assets/', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, ASSETS), 'utf8')

export const loadBossArenaData = (): BossArenaData =>
  parseBossArenaData(read('maps/boss-arena.tmx'), {
    '../tilesets/town-32.tsx': read('tilesets/town-32.tsx'),
    '../tilesets/biome-snow.tsx': read('tilesets/biome-snow.tsx')
  })
