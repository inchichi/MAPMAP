// 강화학습 환경: 시뮬레이터를 "보스가 기술을 고를 때마다 한 걸음"으로 자른다(docs/boss-rl-design.md 의 "RL Environment").
//   - 결정 순간: 보스가 자유롭고 쓸 수 있는 기술이 하나라도 있을 때. 그 사이는 시뮬레이터가 알아서 흘린다.
//   - 행동: 0 = 기술 안 씀(쫓아가서 근접 공격), 1~7 = 기술(목록 순서). 못 쓰는 기술은 마스크로 막는다.
//   - 보상: 싸움이 끝날 때 재미 점수(0~1), 그 전에는 0.
// 상대 봇의 실력은 판마다 뽑고 정책에게는 알려 주지 않는다 — 플레이어가 어떤지 관찰로 알아내야 한다.
import { getBossSkills, isBossEnraged } from '../bossSkills'
import {
  createFightState,
  createSeededRandom,
  getAvailableBossSkills,
  getDistance,
  getFightOutcome,
  getFightResult,
  isBossFree,
  isPlayerRolling,
  SIM_TIME_LIMIT_MILLISECONDS,
  stepFight,
  TRIAL_BOSS_KEY,
  type FightOutcome,
  type FightSetup,
  type FightState
} from './bossFightSim'
import { scoreFightFun, type FunBreakdown } from './fightEvaluation'
import { createPlayerBot, PLAYER_BOT_SKILLS, type PlayerBot, type PlayerBotTier } from './playerBots'

const SKILLS = getBossSkills(TRIAL_BOSS_KEY)
export const BOSS_ENV_ACTIONS: readonly string[] = ['none', ...SKILLS.map((skill) => skill.kind)]
// "안 씀"을 고르면 이만큼은 다시 묻지 않는다(50ms마다 묻지 않게)
export const NONE_ACTION_HOLD_MILLISECONDS = 500
const RECENT_WINDOW_MILLISECONDS = 10_000
const LONGEST_COOLDOWN_MILLISECONDS = Math.max(...SKILLS.map((skill) => skill.cooldownMilliseconds))

// 관찰 벡터의 칸 이름(순서가 곧 계약이다 — 바꾸면 학습한 정책을 다시 학습해야 한다)
export const BOSS_ENV_OBSERVATION_NAMES: readonly string[] = [
  'player_dx',
  'player_dy',
  'player_distance',
  'player_hp',
  'boss_hp',
  'boss_enraged',
  'player_potions',
  'player_rolling',
  'player_roll_ready',
  'boss_melee_ready',
  'hazard_count',
  'fight_time',
  'player_damage_taken_recent',
  'boss_damage_taken_recent',
  ...SKILLS.flatMap((skill) => [`${skill.kind}_cooldown`, `${skill.kind}_in_range`]),
  ...BOSS_ENV_ACTIONS.map((action) => `last_action_${action}`)
]

export type BossEnvStep = {
  observation: number[]
  actionMask: boolean[]
  reward: number
  done: boolean
  info: {
    tier: PlayerBotTier
    decisions: number
    outcome?: FightOutcome
    fun?: FunBreakdown
    durationMilliseconds?: number
  }
}

export type BossEnvConfig = {
  setup: FightSetup
  // 판마다 이 중에서 고르게 상대를 뽑는다
  tiers: readonly PlayerBotTier[]
}

const getTotalPlayerDamage = (state: FightState): number =>
  Object.values(state.stats.damageTakenByKind).reduce((sum, value) => sum + value, 0)

export const createBossEnv = (config: BossEnvConfig) => {
  let state: FightState = createFightState(config.setup)
  let random = createSeededRandom(0)
  let bot: PlayerBot = createPlayerBot(PLAYER_BOT_SKILLS.normal, random)
  let tier: PlayerBotTier = 'normal'
  let nextDecisionAt = 0
  let lastAction = 0
  let decisions = 0
  // 최근 피해를 재려고 결정 순간마다 누적 피해를 적어 둔다
  let samples: Array<{ at: number; playerDamage: number; bossDamage: number }> = []

  const isDecisionPoint = (): boolean =>
    isBossFree(state) && state.now >= nextDecisionAt && getAvailableBossSkills(state).length > 0

  const getObservation = (): number[] => {
    const { player, boss, now } = state
    const playerDamage = getTotalPlayerDamage(state)
    const bossDamage = boss.maxHp - boss.hp
    samples = [...samples.filter((sample) => now - sample.at <= RECENT_WINDOW_MILLISECONDS), { at: now, playerDamage, bossDamage }]
    const oldest = samples[0]
    const distance = getDistance(boss, player)
    return [
      (player.x - boss.x) / 10,
      (player.y - boss.y) / 10,
      distance / 10,
      player.hp / player.maxHp,
      boss.hp / boss.maxHp,
      isBossEnraged(boss.hp, boss.maxHp) ? 1 : 0,
      config.setup.potions > 0 ? player.potions / config.setup.potions : 0,
      isPlayerRolling(state) ? 1 : 0,
      player.rollReadyAt <= now ? 1 : 0,
      boss.nextMeleeAt <= now ? 1 : 0,
      Math.min(1, state.hazards.length / 20),
      now / SIM_TIME_LIMIT_MILLISECONDS,
      (playerDamage - oldest.playerDamage) / player.maxHp,
      (bossDamage - oldest.bossDamage) / boss.maxHp,
      ...SKILLS.flatMap((skill) => [
        Math.min(1, Math.max(0, (boss.skillReadyAt[skill.kind] ?? 0) - now) / LONGEST_COOLDOWN_MILLISECONDS),
        distance >= skill.minRangeTiles && distance <= skill.maxRangeTiles ? 1 : 0
      ]),
      ...BOSS_ENV_ACTIONS.map((_, index) => (index === lastAction ? 1 : 0))
    ]
  }

  const getActionMask = (): boolean[] => {
    const available = new Set<string>(getAvailableBossSkills(state))
    return BOSS_ENV_ACTIONS.map((action, index) => index === 0 || available.has(action))
  }

  // 다음 결정 순간이나 싸움 끝까지 흘린다. 그 사이 보스는 기술을 쓰지 않는다(쫓아가서 근접 공격).
  const advance = (): BossEnvStep => {
    for (;;) {
      const outcome = getFightOutcome(state)
      if (outcome) {
        const result = getFightResult(state, outcome)
        const fun = scoreFightFun(result)
        return {
          observation: getObservation(),
          actionMask: getActionMask(),
          reward: fun.total,
          done: true,
          info: { tier, decisions, outcome, fun, durationMilliseconds: result.durationMilliseconds }
        }
      }
      if (isDecisionPoint()) {
        return { observation: getObservation(), actionMask: getActionMask(), reward: 0, done: false, info: { tier, decisions } }
      }
      stepFight(state, bot(state), () => undefined, random)
    }
  }

  return {
    // seed 가 같으면 같은 상대·같은 싸움이다. tier 를 주면 그 실력으로 고정한다.
    reset: (seed: number, fixedTier?: PlayerBotTier): BossEnvStep => {
      random = createSeededRandom(seed)
      tier = fixedTier ?? config.tiers[Math.floor(random() * config.tiers.length)]
      const skill = PLAYER_BOT_SKILLS[tier]
      bot = createPlayerBot(skill, random)
      state = createFightState(config.setup)
      state.player.accuracy = skill.accuracy
      nextDecisionAt = 0
      lastAction = 0
      decisions = 0
      samples = []
      return advance()
    },
    // 결정 순간에서 행동 하나를 적용하고 다음 결정 순간까지 간다. 막힌 행동은 "안 씀"으로 본다.
    step: (action: number): BossEnvStep => {
      const kind = getActionMask()[action] ? BOSS_ENV_ACTIONS[action] : 'none'
      decisions += 1
      lastAction = BOSS_ENV_ACTIONS.indexOf(kind)
      if (kind === 'none') {
        nextDecisionAt = state.now + NONE_ACTION_HOLD_MILLISECONDS
        stepFight(state, bot(state), () => undefined, random)
      } else {
        stepFight(state, bot(state), (_state, available) => available.find((candidate) => candidate === kind), random)
      }
      return advance()
    }
  }
}
