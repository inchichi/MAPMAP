// 시험 보스 정책이 보는 것(관찰 36칸)과 고를 수 있는 것(행동 8개). 학습 환경(bossEnv)과 게임 속 보스
// (rendering/mapView/trialBossPolicy)가 이 한 곳을 같이 쓴다 — 둘이 다르게 계산하면 학습한 정책이 게임에서 엉뚱하게 군다.
// 칸 순서가 곧 계약이다. 바꾸면 정책을 다시 학습해야 한다(docs/boss-rl-design.md 의 "RL Environment").
import { getBossSkills, isBossEnraged, type BossSkillKind } from '../bossSkills'

export const TRIAL_BOSS_POLICY_KEY = 'boss_trial'
const SKILLS = getBossSkills(TRIAL_BOSS_POLICY_KEY)

// 0 = 기술 안 씀(쫓아가서 근접 공격), 1~7 = 기술(목록 순서)
export const BOSS_POLICY_ACTIONS: readonly string[] = ['none', ...SKILLS.map((skill) => skill.kind)]
// "안 씀"을 고르면 이만큼은 다시 묻지 않는다(매 프레임 묻지 않게)
export const NONE_ACTION_HOLD_MILLISECONDS = 500
const RECENT_WINDOW_MILLISECONDS = 10_000
// 시뮬레이터의 싸움 시간 제한 — 싸움 시간 칸을 0~1로 맞추는 데만 쓴다
const FIGHT_TIME_SCALE_MILLISECONDS = 180_000
const LONGEST_COOLDOWN_MILLISECONDS = Math.max(...SKILLS.map((skill) => skill.cooldownMilliseconds))

export const BOSS_OBSERVATION_NAMES: readonly string[] = [
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
  ...BOSS_POLICY_ACTIONS.map((action) => `last_action_${action}`)
]

// 좌표·거리는 칸 단위, 시각은 밀리초. 피해는 싸움 시작부터 쌓인 양.
export type BossObservationInput = {
  boss: { x: number; y: number }
  player: { x: number; y: number }
  playerHp: number
  playerMaxHp: number
  bossHp: number
  bossMaxHp: number
  // 처음 들고 온 물약 대비 남은 비율(0~1)
  potionRatio: number
  playerRolling: boolean
  playerRollReady: boolean
  bossMeleeReady: boolean
  hazardCount: number
  fightMilliseconds: number
  recentPlayerDamage: number
  recentBossDamage: number
  // 기술마다 다시 쓸 수 있을 때까지 남은 시간
  skillCooldownLeft: Partial<Record<BossSkillKind, number>>
  lastAction: number
}

export const buildBossObservation = (input: BossObservationInput): number[] => {
  const distance = Math.hypot(input.player.x - input.boss.x, input.player.y - input.boss.y)
  return [
    (input.player.x - input.boss.x) / 10,
    (input.player.y - input.boss.y) / 10,
    distance / 10,
    input.playerHp / input.playerMaxHp,
    input.bossHp / input.bossMaxHp,
    isBossEnraged(input.bossHp, input.bossMaxHp) ? 1 : 0,
    input.potionRatio,
    input.playerRolling ? 1 : 0,
    input.playerRollReady ? 1 : 0,
    input.bossMeleeReady ? 1 : 0,
    Math.min(1, input.hazardCount / 20),
    input.fightMilliseconds / FIGHT_TIME_SCALE_MILLISECONDS,
    input.recentPlayerDamage / input.playerMaxHp,
    input.recentBossDamage / input.bossMaxHp,
    ...SKILLS.flatMap((skill) => [
      Math.min(1, Math.max(0, input.skillCooldownLeft[skill.kind] ?? 0) / LONGEST_COOLDOWN_MILLISECONDS),
      distance >= skill.minRangeTiles && distance <= skill.maxRangeTiles ? 1 : 0
    ]),
    ...BOSS_POLICY_ACTIONS.map((_, index) => (index === input.lastAction ? 1 : 0))
  ]
}

// "안 씀"은 언제나, 기술은 지금 쓸 수 있을 때만 고를 수 있다.
export const getBossActionMask = (available: readonly BossSkillKind[]): boolean[] =>
  BOSS_POLICY_ACTIONS.map((action, index) => index === 0 || available.includes(action as BossSkillKind))

// 최근 10초 동안 받은 피해. 결정 순간마다 그때까지 쌓인 피해를 넣으면 창 안의 차이를 돌려준다.
export const createRecentDamageWindow = () => {
  let samples: Array<{ at: number; playerDamage: number; bossDamage: number }> = []
  return (now: number, playerDamage: number, bossDamage: number) => {
    samples = [...samples.filter((sample) => now - sample.at <= RECENT_WINDOW_MILLISECONDS), { at: now, playerDamage, bossDamage }]
    return { player: playerDamage - samples[0].playerDamage, boss: bossDamage - samples[0].bossDamage }
  }
}
