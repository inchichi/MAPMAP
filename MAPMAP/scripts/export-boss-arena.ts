// 학습 서버로 보낼 시험장 데이터를 rl/dist/boss-arena.json 으로 쓴다(npm run rl:build 가 부른다).
import { mkdirSync, writeFileSync } from 'node:fs'

import { loadBossArenaData } from './lib/bossArena'

const outDir = new URL('../rl/dist/', import.meta.url)
mkdirSync(outDir, { recursive: true })
writeFileSync(new URL('boss-arena.json', outDir), JSON.stringify(loadBossArenaData()))
console.log('rl/dist/boss-arena.json')
