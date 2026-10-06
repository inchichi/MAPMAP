// 시뮬레이터 화면에서 한 판을 한 칸(50ms)씩 돌린다. 학습 때와 같은 시뮬레이터·봇·정책을 쓰고,
// 화면에 보여 줄 것(사건 기록, 마지막 결정, 지나온 자리)만 따로 모은다.
import type { BossSkillKind } from '../bossSkills'
import {
  createFightState,
  createSeededRandom,
  getFightOutcome,
  getFightResult,
  ruleBasedBossPolicy,
  stepFight,
  type BossPolicy,
  type FightOutcome,
  type FightSetup,
  type FightState,
  type Vector
} from '../bossTraining/bossFightSim'
import { BOSS_POLICY_ACTIONS, getBossActionMask } from '../bossTraining/bossObservation'
import type { BossPolicyNetwork } from '../bossTraining/bossPolicyNetwork'
import { scoreFightFun, type FunBreakdown } from '../bossTraining/fightEvaluation'
import { createNetworkBossPolicy } from '../bossTraining/networkBossPolicy'
import { createPlayerBot, PLAYER_BOT_SKILLS, type PlayerBotTier } from '../bossTraining/playerBots'

export type BossPolicyKind = 'model' | 'rule' | 'random'

export const BOSS_POLICY_LABELS: Record<BossPolicyKind, string> = {
  model: '강화학습 정책',
  rule: '규칙 기반',
  random: '무작위'
}

export const SKILL_LABELS: Partial<Record<BossSkillKind, string>> = {
  'charged-blast': '기 모으기',
  'tongue-pull': '혀 당기기',
  charge: '돌진',
  'ring-burst': '고리 폭발',
  'meteor-shower': '유성우',
  'fan-shot': '부채꼴 탄',
  'ground-slam': '내려찍기'
}

const DAMAGE_LABELS: Record<string, string> = {
  melee: '근접 공격',
  'charge-lane': '돌진',
  meteor: '유성',
  'fan-shot': '탄',
  'ring-burst': '고리 폭발',
  'ground-slam': '내려찍기',
  'charged-blast': '기 모으기'
}

export type FightLogKind = 'skill' | 'damage' | 'evade' | 'interrupt' | 'potion' | 'end'
export type FightLogEntry = { at: number; kind: FightLogKind; text: string }

// 한 결정 순간: 고를 수 있던 행동과 각 행동의 확률(정책 신경망만 확률이 있다)
export type ShownDecision = { at: number; actionMask: boolean[]; action: number; probabilities?: number[] }

export type FightPlayback = {
  readonly policyKind: BossPolicyKind
  readonly tier: PlayerBotTier
  readonly seed: number
  readonly state: FightState
  readonly log: readonly FightLogEntry[]
  readonly trail: readonly Vector[]
  readonly lastDecision?: ShownDecision
  readonly lastSkill?: { kind: BossSkillKind; at: number }
  readonly outcome?: FightOutcome
  readonly fun?: FunBreakdown
  // 그림을 고르는 데 쓰는 움직임 기록
  readonly motion: FightMotion
  // 위험 지대가 처음 생긴 시각(예고가 얼마나 찼는지 그리려고)
  getHazardStartedAt: (hazardId: string) => number
  step: () => void
}

export type FightMotion = {
  playerAttackAt?: number
  bossAttack?: { startedAt: number; until: number }
  bossMoving: boolean
}

const TRAIL_LENGTH = 40

// 고를 수 있는 행동만 남긴 softmax
const toProbabilities = (scores: readonly number[], mask: readonly boolean[]): number[] => {
  const top = Math.max(...scores.filter((_, index) => mask[index]))
  const weights = scores.map((score, index) => (mask[index] ? Math.exp(score - top) : 0))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  return weights.map((weight) => weight / total)
}

export const createFightPlayback = (options: {
  setup: FightSetup
  policyKind: BossPolicyKind
  network: BossPolicyNetwork
  tier: PlayerBotTier
  seed: number
}): FightPlayback => {
  const { setup, policyKind, network, tier, seed } = options
  const random = createSeededRandom(seed)
  const skill = PLAYER_BOT_SKILLS[tier]
  const bot = createPlayerBot(skill, random)
  const state = createFightState(setup)
  state.player.accuracy = skill.accuracy
  const log: FightLogEntry[] = []
  const trail: Vector[] = []
  const hazardStartedAt = new Map<string, number>()
  const motion: FightMotion = { bossMoving: false }
  let lastDecision: ShownDecision | undefined
  let lastSkill: { kind: BossSkillKind; at: number } | undefined
  let outcome: FightOutcome | undefined
  let fun: FunBreakdown | undefined

  const policy = createBossPolicy(policyKind, network, setup, seed, (decision) => {
    lastDecision = decision
  })

  const write = (kind: FightLogKind, text: string) => log.push({ at: state.now, kind, text })

  // 한 칸 전후의 기록을 비교해 무슨 일이 있었는지 적는다(시뮬레이터는 건드리지 않는다)
  const step = () => {
    if (outcome) {
      return
    }
    const before = structuredClone({ ...state.stats, hp: state.player.hp })
    const bossBefore = { x: state.boss.x, y: state.boss.y, attackUntil: state.boss.attackUntil }
    stepFight(state, bot(state), policy, random)
    const { stats } = state
    motion.bossMoving = state.boss.x !== bossBefore.x || state.boss.y !== bossBefore.y
    if (state.boss.attackUntil > bossBefore.attackUntil) {
      motion.bossAttack = { startedAt: state.now, until: state.boss.attackUntil }
    }
    if (stats.playerAttacks > before.playerAttacks) {
      motion.playerAttackAt = state.now
    }
    for (const [kind, uses] of Object.entries(stats.skillUses) as Array<[BossSkillKind, number]>) {
      if (uses > (before.skillUses[kind] ?? 0)) {
        lastSkill = { kind, at: state.now }
        write('skill', `보스: ${SKILL_LABELS[kind] ?? kind}`)
      }
    }
    for (const [kind, total] of Object.entries(stats.damageTakenByKind)) {
      const damage = total - (before.damageTakenByKind[kind] ?? 0)
      if (damage > 0) {
        write('damage', `플레이어 피격 (${DAMAGE_LABELS[kind] ?? kind}) -${damage}`)
      }
    }
    if (stats.evades > before.evades) {
      write('evade', '구르기로 회피')
    }
    if (stats.interrupts > before.interrupts) {
      write('interrupt', '기 모으기를 끊었다! 보스 휘청')
    }
    if (stats.potionsUsed > before.potionsUsed) {
      write('potion', `물약 (+${state.player.hp - before.hp})`)
    }
    for (const hazard of state.hazards) {
      if (!hazardStartedAt.has(hazard.id)) {
        hazardStartedAt.set(hazard.id, state.now)
      }
    }
    trail.push({ x: state.player.x, y: state.player.y })
    if (trail.length > TRAIL_LENGTH) {
      trail.shift()
    }
    outcome = getFightOutcome(state)
    if (outcome) {
      fun = scoreFightFun(getFightResult(state, outcome))
      write('end', outcome === 'player-win' ? '플레이어 승리' : outcome === 'boss-win' ? '보스 승리' : '시간 초과')
    }
  }

  return {
    policyKind,
    tier,
    seed,
    state,
    log,
    trail,
    motion,
    get lastDecision() {
      return lastDecision
    },
    get lastSkill() {
      return lastSkill
    },
    get outcome() {
      return outcome
    },
    get fun() {
      return fun
    },
    getHazardStartedAt: (hazardId) => hazardStartedAt.get(hazardId) ?? state.now,
    step
  }
}

// 한 판에 하나씩 만든다(강화학습 정책은 싸움마다 기억이 있다). onDecision 은 보스가 고를 때마다 불린다.
// 무작위 정책은 싸움과 다른 난수를 써서, 같은 seed 면 봇이 같은 주사위를 굴리게 한다.
export const createBossPolicy = (
  kind: BossPolicyKind,
  network: BossPolicyNetwork,
  setup: FightSetup,
  seed: number,
  onDecision?: (decision: ShownDecision) => void
): BossPolicy => {
  if (kind === 'model') {
    return createNetworkBossPolicy(network, setup.potions, (decision) =>
      onDecision?.({
        at: decision.at,
        actionMask: decision.actionMask,
        action: decision.action,
        probabilities: toProbabilities(decision.scores, decision.actionMask)
      })
    )
  }
  const policyRandom = createSeededRandom(seed ^ 0x5bd1e995)
  const pick: BossPolicy =
    kind === 'rule' ? ruleBasedBossPolicy : (_fight, available) => available[Math.floor(policyRandom() * available.length)]
  return (fight, available) => {
    const choice = pick(fight, available)
    onDecision?.({
      at: fight.now,
      actionMask: getBossActionMask(available),
      action: choice ? BOSS_POLICY_ACTIONS.indexOf(choice) : 0
    })
    return choice
  }
}
