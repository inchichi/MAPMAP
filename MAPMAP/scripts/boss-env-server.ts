// 강화학습 환경 서버 — 파이썬(rl/boss_env.py)이 자식 프로세스로 띄우고 한 줄에 JSON 하나씩 주고받는다.
// npm run rl:build 가 이 파일을 rl/dist/boss-env-server.mjs 하나로 묶는다(서버에는 저장소 없이 이것만 보낸다).
//
//   받기: {"cmd":"reset","seed":123,"tier":"normal"}   tier 는 빼면 판마다 무작위
//         {"cmd":"step","action":3}
//         {"cmd":"spec"}                                관찰·행동 이름
//   보내기: {"observation":[...],"actionMask":[...],"reward":0,"done":false,"info":{...}}
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

import { BOSS_ENV_ACTIONS, BOSS_ENV_OBSERVATION_NAMES, createBossEnv } from '../src/games/my-sample-rpg/bossTraining/bossEnv'
import type { PlayerBotTier } from '../src/games/my-sample-rpg/bossTraining/playerBots'
import { createBossArenaSetup, type BossArenaData } from './boss-arena-setup'

const arenaPath = process.argv[2] ?? new URL('./boss-arena.json', import.meta.url)
const arena = JSON.parse(readFileSync(arenaPath, 'utf8')) as BossArenaData
const env = createBossEnv({
  setup: createBossArenaSetup(arena, Number(process.env.POTIONS ?? 6)),
  tiers: ['novice', 'normal', 'expert']
})

const send = (value: unknown) => process.stdout.write(`${JSON.stringify(value)}\n`)

createInterface({ input: process.stdin }).on('line', (line) => {
  const message = JSON.parse(line) as { cmd: string; seed?: number; tier?: PlayerBotTier; action?: number }
  if (message.cmd === 'reset') {
    send(env.reset(message.seed ?? 0, message.tier))
  } else if (message.cmd === 'step') {
    send(env.step(message.action ?? 0))
  } else if (message.cmd === 'spec') {
    send({ observationNames: BOSS_ENV_OBSERVATION_NAMES, actions: BOSS_ENV_ACTIONS })
  } else {
    send({ error: `unknown cmd ${message.cmd}` })
  }
})
