// 시험 보스 전투를 화면 없이 여러 번 돌려 실력별 봇의 결과와 "재미" 점수를 본다(docs/boss-rl-design.md).
//
//   npx vite-node scripts/simulate-boss-fight.ts              (실력마다 200판)
//   FIGHTS=1000 SEED=7 npx vite-node scripts/simulate-boss-fight.ts
//   JSON=1 npx vite-node scripts/simulate-boss-fight.ts      (요약을 JSON 으로)
//
// 보스는 지금 게임과 같은 규칙 기반(쓸 수 있는 기술 중 목록 맨 앞)이다 — 강화학습 보스와 비교할 기준선.
import { ruleBasedBossPolicy } from '../src/games/my-sample-rpg/bossTraining/bossFightSim'
import { runFight, summarizeFights, TARGET_PLAYER_WIN_RATE } from '../src/games/my-sample-rpg/bossTraining/fightEvaluation'
import type { PlayerBotTier } from '../src/games/my-sample-rpg/bossTraining/playerBots'
import { createBossArenaSetup, loadBossArenaData } from './boss-arena-setup'

const setup = createBossArenaSetup(loadBossArenaData(), Number(process.env.POTIONS ?? 6))

const fights = Number(process.env.FIGHTS ?? 200)
const seed = Number(process.env.SEED ?? 1)
const tiers: PlayerBotTier[] = ['novice', 'normal', 'expert']

const summaries = tiers.map((tier) =>
  summarizeFights(
    tier,
    Array.from({ length: fights }, (_, index) => runFight(setup, ruleBasedBossPolicy, tier, seed * 100_000 + index))
  )
)

if (process.env.JSON) {
  console.log(JSON.stringify(summaries, null, 2))
} else {
  const percent = (value: number) => `${Math.round(value * 100)}%`
  console.log(`시험 보스(규칙 기반) vs 봇 — 실력마다 ${fights}판, seed ${seed}`)
  for (const summary of summaries) {
    const target = TARGET_PLAYER_WIN_RATE[summary.tier]
    console.log(
      `\n[${summary.tier}] 플레이어 승률 ${percent(summary.playerWinRate)} (목표 ${percent(target.min)}~${percent(target.max)}` +
        `${summary.winRateInTarget ? ' ✓' : ' ✗'}), 시간초과 ${percent(summary.timeoutRate)}`
    )
    console.log(
      `  평균 ${summary.averageSeconds.toFixed(1)}초, 이겼을 때 남은 체력 ${percent(summary.averagePlayerHpLeftOnWin)},` +
        ` 재미 점수 ${summary.averageFun.toFixed(2)}, 기 모으기 끊기 ${summary.interruptsPerFight.toFixed(2)}회/판,` +
        ` 물약 ${summary.potionsPerFight.toFixed(1)}개/판`
    )
    const format = (record: Record<string, number>) =>
      Object.entries(record)
        .sort((a, b) => b[1] - a[1])
        .map(([key, value]) => `${key} ${value.toFixed(1)}`)
        .join(', ')
    console.log(`  기술 사용/판: ${format(summary.skillUses)}`)
    console.log(`  받은 피해/판: ${format(summary.damageTakenByKind)}`)
  }
}
