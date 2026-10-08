// 강화학습 환경: 시뮬레이터를 "보스가 기술을 고를 때마다 한 걸음"으로 자른다(docs/boss-rl-design.md 의 "RL Environment").
//   - 결정 순간: 보스가 자유롭고 쓸 수 있는 기술이 하나라도 있을 때. 그 사이는 시뮬레이터가 알아서 흘린다.
//   - 행동: 0 = 기술 안 씀(쫓아가서 근접 공격), 1~7 = 기술(목록 순서). 못 쓰는 기술은 마스크로 막는다.
//   - 보상: 싸움이 끝날 때 재미 점수(0~1), 그 전에는 0.
// 상대 봇의 실력은 판마다 뽑고 정책에게는 알려 주지 않는다 — 플레이어가 어떤지 관찰로 알아내야 한다.
import type { BossSkillKind } from '../bossSkills'
import {
  createFightState,
  createSeededRandom,
  getAvailableBossSkills,
  getFightOutcome,
  getFightResult,
  isPlayerRolling,
  beginFightStep,
  finishFightStep,
  type FightOutcome,
  type FightSetup,
  type FightState,
  type PlayerWeapon
} from './bossFightSim'
import {
  BOSS_POLICY_ACTIONS,
  buildBossObservation,
  createRecentDamageWindow,
  getBossActionMask,
  NONE_ACTION_HOLD_MILLISECONDS
} from './bossObservation'
import { scoreFightFun, type FunBreakdown } from './fightEvaluation'
import { createPlayerBot, PLAYER_BOT_SKILLS, type PlayerBot, type PlayerBotTier } from './playerBots'

export type BossEnvStep = {
  observation: number[]
  actionMask: boolean[]
  reward: number
  done: boolean
  info: {
    tier: PlayerBotTier
    weapon: PlayerWeapon
    decisions: number
    outcome?: FightOutcome
    fun?: FunBreakdown
    durationMilliseconds?: number
    playerHpRatio?: number
    skillUses?: Partial<Record<BossSkillKind, number>>
  }
}

export type BossEnvConfig = {
  setup: FightSetup
  // 판마다 이 중에서 고르게 상대를 뽑는다
  tiers: readonly PlayerBotTier[]
  // 상대 봇의 무기(reset 에서 판마다 바꿀 수 있다). 기본은 검.
  weapon?: PlayerWeapon
}

// 결정 순간의 관찰. 학습 환경과 시뮬레이터 화면(networkBossPolicy)이 같이 쓴다.
export const getFightObservation = (
  state: FightState,
  startingPotions: number,
  lastAction: number,
  recent: { player: number; boss: number }
): number[] => {
  const { player, boss, now } = state
  return buildBossObservation({
    boss,
    player,
    playerHp: player.hp,
    playerMaxHp: player.maxHp,
    bossHp: boss.hp,
    bossMaxHp: boss.maxHp,
    potionRatio: startingPotions > 0 ? player.potions / startingPotions : 0,
    playerRolling: isPlayerRolling(state),
    playerRollReady: player.rollReadyAt <= now,
    bossMeleeReady: boss.nextMeleeAt <= now,
    hazardCount: state.hazards.length,
    fightMilliseconds: now,
    recentPlayerDamage: recent.player,
    recentBossDamage: recent.boss,
    skillCooldownLeft: Object.fromEntries(
      Object.entries(boss.skillReadyAt).map(([kind, readyAt]) => [kind, (readyAt ?? 0) - now])
    ),
    lastAction
  })
}

export const getTotalPlayerDamage = (state: FightState): number =>
  Object.values(state.stats.damageTakenByKind).reduce((sum, value) => sum + value, 0)

export const createBossEnv = (config: BossEnvConfig) => {
  let state: FightState = createFightState(config.setup)
  let random = createSeededRandom(0)
  let bot: PlayerBot = createPlayerBot(PLAYER_BOT_SKILLS.normal, random)
  let tier: PlayerBotTier = 'normal'
  let weapon: PlayerWeapon = config.weapon ?? 'sword'
  let nextDecisionAt = 0
  let lastAction = 0
  let decisions = 0
  // 최근 피해를 재려고 결정 순간마다 누적 피해를 적어 둔다
  let recentDamage = createRecentDamageWindow()

  const getObservation = (): number[] => {
    const recent = recentDamage(state.now, getTotalPlayerDamage(state), state.boss.maxHp - state.boss.hp)
    return getFightObservation(state, config.setup.potions, lastAction, recent)
  }

  const getActionMask = (): boolean[] => getBossActionMask(getAvailableBossSkills(state))

  // 다음 결정 순간이나 싸움 끝까지 흘린다. 그 사이 보스는 기술을 쓰지 않는다(쫓아가서 근접 공격).
  // 결정 순간은 한 칸의 두 단계 사이(beginFightStep 뒤)라서, 돌아올 때 그 칸은 아직 끝나지 않았다.
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
          info: {
            tier,
            weapon,
            decisions,
            outcome,
            fun,
            durationMilliseconds: result.durationMilliseconds,
            playerHpRatio: result.playerHpRatio,
            skillUses: result.stats.skillUses
          }
        }
      }
      const bossCanChoose = beginFightStep(state, bot(state), random)
      if (bossCanChoose && state.now >= nextDecisionAt && getAvailableBossSkills(state).length > 0) {
        return { observation: getObservation(), actionMask: getActionMask(), reward: 0, done: false, info: { tier, weapon, decisions } }
      }
      finishFightStep(state, bossCanChoose, undefined, random)
    }
  }

  return {
    // seed 가 같으면 같은 상대·같은 싸움이다. tier 를 주면 그 실력으로, fixedWeapon 을 주면 그 무기로 고정한다.
    reset: (seed: number, fixedTier?: PlayerBotTier, fixedWeapon?: PlayerWeapon): BossEnvStep => {
      random = createSeededRandom(seed)
      tier = fixedTier ?? config.tiers[Math.floor(random() * config.tiers.length)]
      weapon = fixedWeapon ?? config.weapon ?? 'sword'
      const skill = PLAYER_BOT_SKILLS[tier]
      bot = createPlayerBot(skill, random, weapon)
      state = createFightState(config.setup)
      state.player.accuracy = skill.accuracy
      state.player.weapon = weapon
      nextDecisionAt = 0
      lastAction = 0
      decisions = 0
      recentDamage = createRecentDamageWindow()
      return advance()
    },
    // 결정 순간에서 행동 하나로 그 칸을 마치고 다음 결정 순간까지 간다. 막힌 행동은 "안 씀"으로 본다.
    step: (action: number): BossEnvStep => {
      const kind = getActionMask()[action] ? BOSS_POLICY_ACTIONS[action] : 'none'
      decisions += 1
      lastAction = BOSS_POLICY_ACTIONS.indexOf(kind)
      if (kind === 'none') {
        nextDecisionAt = state.now + NONE_ACTION_HOLD_MILLISECONDS
      }
      finishFightStep(state, true, kind === 'none' ? undefined : (kind as BossSkillKind), random)
      return advance()
    }
  }
}
