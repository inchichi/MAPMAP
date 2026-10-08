// 싸움을 끝까지 돌리고 "재미있는 보스였나"를 점수로 매긴다. 점수 정의와 목표 구간의 이유는
// docs/boss-rl-design.md 의 "Fun score" 에 있다. 강화학습 보상도 이 점수를 바탕으로 만든다.
import { getBossSkills } from '../bossSkills'
import {
  createFightState,
  createSeededRandom,
  getFightOutcome,
  getFightResult,
  stepFight,
  TRIAL_BOSS_KEY,
  type BossPolicy,
  type FightResult,
  type FightSetup,
  type PlayerWeapon
} from './bossFightSim'
import { createPlayerBot, PLAYER_BOT_SKILLS, type PlayerBotTier } from './playerBots'

export const runFight = (
  setup: FightSetup,
  policy: BossPolicy,
  tier: PlayerBotTier,
  seed: number,
  weapon: PlayerWeapon = 'sword'
): FightResult => {
  const random = createSeededRandom(seed)
  const skill = PLAYER_BOT_SKILLS[tier]
  const bot = createPlayerBot(skill, random, weapon)
  const state = createFightState(setup)
  state.player.accuracy = skill.accuracy
  state.player.weapon = weapon
  for (;;) {
    stepFight(state, bot(state), policy, random)
    const outcome = getFightOutcome(state)
    if (outcome) {
      return getFightResult(state, outcome)
    }
  }
}

// 실력별로 플레이어가 이기는 비율의 목표 — 초보는 질 때가 더 많고, 고수는 거의 이기되 가끔 진다.
export const TARGET_PLAYER_WIN_RATE: Record<PlayerBotTier, { min: number; max: number }> = {
  novice: { min: 0.3, max: 0.5 },
  normal: { min: 0.55, max: 0.75 },
  expert: { min: 0.85, max: 0.97 }
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

// 구간 [min, max] 안이면 1, 밖이면 zeroAtLow / zeroAtHigh 까지 곧게 줄어든다.
const bandScore = (value: number, zeroAtLow: number, min: number, max: number, zeroAtHigh: number): number => {
  if (value < min) {
    return clamp01((value - zeroAtLow) / (min - zeroAtLow))
  }
  if (value > max) {
    return clamp01((zeroAtHigh - value) / (zeroAtHigh - max))
  }
  return 1
}

export type FunBreakdown = {
  // 아슬아슬했나: 이겼다면 체력이 조금 남았을 때, 졌다면 보스가 거의 쓰러졌을 때 높다
  closeness: number
  // 1~2분 싸움이 가장 좋다
  duration: number
  // 기술을 고르게 썼나(기술 사용 횟수의 정규화 엔트로피)
  variety: number
  total: number
}

export const FUN_WEIGHTS = { closeness: 0.4, duration: 0.25, variety: 0.35 }

export const scoreFightFun = (result: FightResult): FunBreakdown => {
  const closeness =
    result.outcome === 'player-win'
      ? result.playerHpRatio < 0.1
        ? 0.8
        : bandScore(result.playerHpRatio, 0, 0.1, 0.4, 1)
      : result.outcome === 'boss-win'
        ? clamp01(1 - result.bossHpRatio / 0.5)
        : 0
  const duration = bandScore(result.durationMilliseconds / 1000, 20, 60, 120, 180)
  const counts = getBossSkills(TRIAL_BOSS_KEY).map((skill) => result.stats.skillUses[skill.kind] ?? 0)
  const totalUses = counts.reduce((sum, count) => sum + count, 0)
  const entropy =
    totalUses === 0
      ? 0
      : -counts
          .filter((count) => count > 0)
          .reduce((sum, count) => sum + (count / totalUses) * Math.log(count / totalUses), 0)
  const variety = entropy / Math.log(counts.length)
  return {
    closeness,
    duration,
    variety,
    total:
      FUN_WEIGHTS.closeness * closeness + FUN_WEIGHTS.duration * duration + FUN_WEIGHTS.variety * variety
  }
}

export type TierSummary = {
  tier: PlayerBotTier
  fights: number
  playerWinRate: number
  timeoutRate: number
  winRateInTarget: boolean
  averageSeconds: number
  averagePlayerHpLeftOnWin: number
  averageFun: number
  skillUses: Record<string, number>
  damageTakenByKind: Record<string, number>
  interruptsPerFight: number
  potionsPerFight: number
}

export const summarizeFights = (tier: PlayerBotTier, results: readonly FightResult[]): TierSummary => {
  const wins = results.filter((result) => result.outcome === 'player-win')
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
  const average = (values: number[]) => (values.length === 0 ? 0 : sum(values) / values.length)
  const merge = (records: Array<Partial<Record<string, number>>>) => {
    const merged: Record<string, number> = {}
    for (const record of records) {
      for (const [key, value] of Object.entries(record)) {
        merged[key] = (merged[key] ?? 0) + (value ?? 0) / results.length
      }
    }
    return merged
  }
  const playerWinRate = wins.length / results.length
  const target = TARGET_PLAYER_WIN_RATE[tier]
  return {
    tier,
    fights: results.length,
    playerWinRate,
    timeoutRate: results.filter((result) => result.outcome === 'timeout').length / results.length,
    winRateInTarget: playerWinRate >= target.min && playerWinRate <= target.max,
    averageSeconds: average(results.map((result) => result.durationMilliseconds / 1000)),
    averagePlayerHpLeftOnWin: average(wins.map((result) => result.playerHpRatio)),
    averageFun: average(results.map((result) => scoreFightFun(result).total)),
    skillUses: merge(results.map((result) => result.stats.skillUses)),
    damageTakenByKind: merge(results.map((result) => result.stats.damageTakenByKind)),
    interruptsPerFight: average(results.map((result) => result.stats.interrupts)),
    potionsPerFight: average(results.map((result) => result.stats.potionsUsed))
  }
}
