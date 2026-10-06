// 화면 없이 도는 시험 보스 전투 시뮬레이터 — 강화학습용(docs/boss-rl-design.md).
// 보스 기술 규칙(범위·시간·피해)은 bossSkills.ts 를 그대로 쓰고, 맵 화면(frameUpdate·bossEncounter·combat)의
// 흐름을 고정 간격(SIM_STEP_MILLISECONDS)으로 흉내 낸다. 좌표는 칸 단위, 캐릭터는 가운데 점으로 본다.
// 어떤 기술을 쓸지는 BossPolicy 가, 플레이어가 무엇을 할지는 PlayerAction 이 정한다.
import {
  BOSS_FIRST_SKILL_DELAY_MILLISECONDS,
  CHARGE_DASH_MILLISECONDS,
  CHARGE_WINDUP_MILLISECONDS,
  CHARGED_BLAST_CHANNEL_MILLISECONDS,
  CHARGED_BLAST_STAGGER_MILLISECONDS,
  createChargedBlast,
  createChargeLane,
  createFanShot,
  createGroundSlam,
  createMeteorShower,
  createRingBurst,
  getBossHazardDamage,
  getBossSkillCooldown,
  getBossSkillGap,
  getBossSkills,
  getChargePath,
  getFanShotCount,
  getMeteorCount,
  getTonguePullVector,
  isBossEnraged,
  shouldInterruptChargedBlast,
  tickBossHazards,
  TONGUE_PULL_DURATION_MILLISECONDS,
  TONGUE_PULL_WINDUP_MILLISECONDS,
  type BossHazard,
  type BossHazardKind,
  type BossSkillKind
} from '../bossSkills'
import { createMonsterCombatState } from '../monsterCombat'
import { getBossDamageMultiplier, getBossHpMultiplier } from '../monsterTuning'
import {
  PLAYER_ROLL_COOLDOWN_MILLISECONDS,
  PLAYER_ROLL_DISTANCE_TILES,
  PLAYER_ROLL_DURATION_MILLISECONDS
} from '../playerRoll'

export const SIM_STEP_MILLISECONDS = 50
export const SIM_TIME_LIMIT_MILLISECONDS = 180_000
export const TRIAL_BOSS_KEY = 'boss_trial'

// 맵 화면에서 가져온 값. 게임 쪽 값이 바뀌면 여기도 맞춘다.
// characterState 기본 이동 속도
const PLAYER_MOVE_TILES_PER_SECOND = 8
// mapView/constants: 공격 동작 320ms + 쿨다운 300ms, 맞은 뒤 무적 600ms
const PLAYER_ATTACK_INTERVAL_MILLISECONDS = 620
const PLAYER_DAMAGE_INVULNERABILITY_MILLISECONDS = 600
// 공격 탐지 거리(1.2칸) + 보스 몸 반쯤
export const PLAYER_ATTACK_REACH_TILES = 1.6
// monsterCatalog 의 monster_troll_chief(시험 보스 외형)
const BOSS_CHASE_TILES_PER_SECOND = 2.2
export const BOSS_MELEE_RANGE_TILES = 1.8 + 0.14
const BOSS_MELEE_INTERVAL_MILLISECONDS = 3800
const BOSS_ATTACK_DURATION_MILLISECONDS = 820
const BOSS_HIT_REACTION_MILLISECONDS = 180
// 보스가 플레이어에게 이보다 더 붙지 않는다(몸끼리 겹치지 않게)
const BOSS_STOP_DISTANCE_TILES = 1.1
// playerConsumables: 체력 물약 하나에 10. 게임에는 쿨다운이 없지만 사람 손으로 누르는 간격을 둔다.
const POTION_HEAL = 10
const POTION_PRESS_INTERVAL_MILLISECONDS = 400

// bossEncounter 와 같다: 구르기·방어로 피할 수 있는 위험 지대
const DODGEABLE_HAZARD_KINDS = new Set<BossHazardKind>(['water-pillar', 'ring-burst', 'charge-lane', 'fan-shot', 'meteor'])

export type Vector = { x: number; y: number }

export type PlayerAction = {
  // 움직일 방향(길이는 무시). {0,0}이면 서 있는다.
  move: Vector
  attack: boolean
  // 구를 방향. 구르는 중이거나 쿨다운이면 무시된다.
  roll?: Vector
  drinkPotion?: boolean
}

export type SimPlayer = {
  x: number
  y: number
  hp: number
  maxHp: number
  attackPower: number
  attackReadyAt: number
  rollStartedAt: number
  rollReadyAt: number
  rollVector: Vector
  invulnerableUntil: number
  potions: number
  potionReadyAt: number
  // 손이 닿는 거리에서 휘둘렀을 때 맞을 확률(방향·타이밍 실수). 봇 실력이 정한다.
  accuracy: number
}

export type SimBoss = {
  x: number
  y: number
  hp: number
  maxHp: number
  meleeDamage: number
  attackUntil: number
  nextMeleeAt: number
  hitReactionUntil: number
  skillReadyAt: Partial<Record<BossSkillKind, number>>
  charge?: { startAt: number; lastAt: number; vector: Vector }
  channel?: { hazardId: string; startHp: number; until: number }
  tongue?: { startAt: number; lastAt: number; vector: Vector }
}

export type FightStats = {
  skillUses: Partial<Record<BossSkillKind, number>>
  meleeHits: number
  damageTakenByKind: Record<string, number>
  hitsTaken: number
  evades: number
  playerAttacks: number
  playerHits: number
  interrupts: number
  potionsUsed: number
}

export type FightState = {
  now: number
  player: SimPlayer
  boss: SimBoss
  hazards: BossHazard[]
  hazardSequence: number
  stats: FightStats
  isWall: (tileX: number, tileY: number) => boolean
}

export type FightOutcome = 'player-win' | 'boss-win' | 'timeout'

// 지금 쓸 수 있는 기술(쿨다운이 끝났고 거리가 맞는 것) 중 하나를 고르거나, 아무것도 쓰지 않는다(undefined).
// available 은 기술 목록 순서 그대로다.
export type BossPolicy = (state: FightState, available: readonly BossSkillKind[]) => BossSkillKind | undefined

// 지금 게임의 보스(pickBossSkill)와 같다: 쓸 수 있는 것 중 목록 맨 앞. 강화학습과 비교할 기준선.
export const ruleBasedBossPolicy: BossPolicy = (_state, available) => available[0]

// 0 이상 1 미만을 내는 재현 가능한 난수(mulberry32). 같은 seed 면 같은 싸움이 된다.
export const createSeededRandom = (seed: number): (() => number) => {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6d2b79f5) >>> 0
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type FightSetup = {
  isWall: (tileX: number, tileY: number) => boolean
  playerStart: Vector
  bossStart: Vector
  playerLevel: number
  bossLevel: number
  // 싸움에 가져오는 체력 물약 수 — 게임에서는 사서 들고 오는 만큼이라 가정값이다
  potions: number
}

// 레벨 L 플레이어: 체력 24 + 4(L-1), 힘 5 + 2(L-1) + 기본 무기 2 (scripts/estimate-playtime.ts 와 같은 가정)
export const createFightState = (setup: FightSetup): FightState => {
  const playerMaxHp = 24 + 4 * (setup.playerLevel - 1)
  const combat = createMonsterCombatState(setup.bossLevel, {
    hpMultiplier: getBossHpMultiplier(TRIAL_BOSS_KEY),
    damageMultiplier: getBossDamageMultiplier(TRIAL_BOSS_KEY)
  })
  return {
    now: 0,
    player: {
      ...setup.playerStart,
      hp: playerMaxHp,
      maxHp: playerMaxHp,
      attackPower: 5 + 2 * (setup.playerLevel - 1) + 2,
      attackReadyAt: 0,
      rollStartedAt: Number.NEGATIVE_INFINITY,
      rollReadyAt: 0,
      rollVector: { x: 0, y: 0 },
      invulnerableUntil: 0,
      potions: setup.potions,
      potionReadyAt: 0,
      accuracy: 1
    },
    boss: {
      ...setup.bossStart,
      hp: combat.maxHp,
      maxHp: combat.maxHp,
      // 근접 공격은 접촉 피해 + 1(frameUpdate)
      meleeDamage: Math.max(1, combat.contactDamage + 1),
      attackUntil: 0,
      nextMeleeAt: 0,
      hitReactionUntil: 0,
      skillReadyAt: Object.fromEntries(
        getBossSkills(TRIAL_BOSS_KEY).map((skill) => [skill.kind, BOSS_FIRST_SKILL_DELAY_MILLISECONDS])
      )
    },
    hazards: [],
    hazardSequence: 0,
    stats: {
      skillUses: {},
      meleeHits: 0,
      damageTakenByKind: {},
      hitsTaken: 0,
      evades: 0,
      playerAttacks: 0,
      playerHits: 0,
      interrupts: 0,
      potionsUsed: 0
    },
    isWall: setup.isWall
  }
}

export const getDistance = (a: Vector, b: Vector): number => Math.hypot(a.x - b.x, a.y - b.y)

export const isPlayerRolling = (state: FightState): boolean =>
  state.now < state.player.rollStartedAt + PLAYER_ROLL_DURATION_MILLISECONDS

// 보스가 기술을 고를 수 있는 순간인가(묶여 있거나 휘청이거나 공격 중이 아님)
export const isBossFree = (state: FightState): boolean =>
  !state.boss.charge &&
  !state.boss.channel &&
  state.boss.hitReactionUntil <= state.now &&
  state.boss.attackUntil <= state.now

export const getAvailableBossSkills = (state: FightState): BossSkillKind[] => {
  const distance = getDistance(state.boss, state.player)
  return getBossSkills(TRIAL_BOSS_KEY)
    .filter(
      (skill) =>
        (state.boss.skillReadyAt[skill.kind] ?? 0) <= state.now &&
        distance >= skill.minRangeTiles &&
        distance <= skill.maxRangeTiles
    )
    .map((skill) => skill.kind)
}

export const getFightOutcome = (state: FightState): FightOutcome | undefined => {
  if (state.player.hp <= 0) {
    return 'boss-win'
  }
  if (state.boss.hp <= 0) {
    return 'player-win'
  }
  return state.now >= SIM_TIME_LIMIT_MILLISECONDS ? 'timeout' : undefined
}

// 벽이면 축마다 따로 시도한다(벽을 따라 미끄러진다).
const tryMove = (state: FightState, body: Vector, dx: number, dy: number): void => {
  const blocked = (x: number, y: number) => state.isWall(Math.floor(x), Math.floor(y))
  if (!blocked(body.x + dx, body.y + dy)) {
    body.x += dx
    body.y += dy
    return
  }
  if (!blocked(body.x + dx, body.y)) {
    body.x += dx
  } else if (!blocked(body.x, body.y + dy)) {
    body.y += dy
  }
}

const normalize = (vector: Vector): Vector => {
  const length = Math.hypot(vector.x, vector.y)
  return length === 0 ? { x: 0, y: 0 } : { x: vector.x / length, y: vector.y / length }
}

const damagePlayer = (state: FightState, damage: number, kind: string, dodgeable: boolean): void => {
  const { player, stats } = state
  if (player.invulnerableUntil > state.now) {
    return
  }
  if (dodgeable && isPlayerRolling(state)) {
    stats.evades += 1
    return
  }
  player.hp = Math.max(0, player.hp - damage)
  player.invulnerableUntil = state.now + PLAYER_DAMAGE_INVULNERABILITY_MILLISECONDS
  stats.hitsTaken += 1
  stats.damageTakenByKind[kind] = (stats.damageTakenByKind[kind] ?? 0) + damage
}

const stepPlayer = (state: FightState, action: PlayerAction, random: () => number): void => {
  const { player, boss } = state
  const seconds = SIM_STEP_MILLISECONDS / 1000
  if (action.drinkPotion && player.potions > 0 && player.potionReadyAt <= state.now && player.hp > 0) {
    player.potions -= 1
    player.potionReadyAt = state.now + POTION_PRESS_INTERVAL_MILLISECONDS
    player.hp = Math.min(player.maxHp, player.hp + POTION_HEAL)
    state.stats.potionsUsed += 1
  }
  if (action.roll && !isPlayerRolling(state) && player.rollReadyAt <= state.now) {
    const vector = normalize(action.roll)
    if (vector.x !== 0 || vector.y !== 0) {
      player.rollStartedAt = state.now
      player.rollReadyAt = state.now + PLAYER_ROLL_DURATION_MILLISECONDS + PLAYER_ROLL_COOLDOWN_MILLISECONDS
      player.rollVector = vector
    }
  }
  if (isPlayerRolling(state)) {
    const step = (PLAYER_ROLL_DISTANCE_TILES * SIM_STEP_MILLISECONDS) / PLAYER_ROLL_DURATION_MILLISECONDS
    tryMove(state, player, player.rollVector.x * step, player.rollVector.y * step)
    return
  }
  // 혀에 끌려가는 동안은 걷지 못한다
  const pulling = boss.tongue && state.now >= boss.tongue.startAt
  if (!pulling) {
    const move = normalize(action.move)
    tryMove(state, player, move.x * PLAYER_MOVE_TILES_PER_SECOND * seconds, move.y * PLAYER_MOVE_TILES_PER_SECOND * seconds)
  }
  if (action.attack && player.attackReadyAt <= state.now) {
    player.attackReadyAt = state.now + PLAYER_ATTACK_INTERVAL_MILLISECONDS
    state.stats.playerAttacks += 1
    if (getDistance(player, boss) <= PLAYER_ATTACK_REACH_TILES && random() < player.accuracy) {
      boss.hp = Math.max(0, boss.hp - player.attackPower)
      boss.hitReactionUntil = Math.max(boss.hitReactionUntil, state.now + BOSS_HIT_REACTION_MILLISECONDS)
      state.stats.playerHits += 1
    }
  }
}

const delayAllSkills = (boss: SimBoss, until: number): void => {
  for (const kind of Object.keys(boss.skillReadyAt) as BossSkillKind[]) {
    boss.skillReadyAt[kind] = Math.max(boss.skillReadyAt[kind] ?? 0, until)
  }
}

const useBossSkill = (state: FightState, kind: BossSkillKind, random: () => number): void => {
  const { boss, player, now } = state
  const enraged = isBossEnraged(boss.hp, boss.maxHp)
  const skill = getBossSkills(TRIAL_BOSS_KEY).find((candidate) => candidate.kind === kind)
  if (!skill) {
    return
  }
  boss.skillReadyAt[kind] = now + getBossSkillCooldown(skill, enraged)
  const busyUntil =
    now +
    (kind === 'charge'
      ? CHARGE_WINDUP_MILLISECONDS + CHARGE_DASH_MILLISECONDS
      : kind === 'charged-blast'
        ? CHARGED_BLAST_CHANNEL_MILLISECONDS
        : 0)
  delayAllSkills(boss, busyUntil + getBossSkillGap(TRIAL_BOSS_KEY))
  boss.attackUntil = now + BOSS_ATTACK_DURATION_MILLISECONDS
  state.stats.skillUses[kind] = (state.stats.skillUses[kind] ?? 0) + 1
  const id = `boss:${++state.hazardSequence}`
  const bossCenter = { x: boss.x, y: boss.y }
  const playerCenter = { x: player.x, y: player.y }
  const isBlocked = (x: number, y: number) => state.isWall(Math.floor(x), Math.floor(y))
  switch (kind) {
    case 'ground-slam':
      state.hazards.push(createGroundSlam(id, boss.x, boss.y, now))
      return
    case 'ring-burst':
      state.hazards.push(createRingBurst(id, boss.x, boss.y, now))
      return
    case 'fan-shot':
      state.hazards.push(...createFanShot(id, bossCenter, playerCenter, getFanShotCount(enraged), now))
      return
    case 'meteor-shower':
      state.hazards.push(...createMeteorShower(id, playerCenter, getMeteorCount(enraged), now, random))
      return
    case 'charge': {
      const path = getChargePath(bossCenter, playerCenter, isBlocked)
      state.hazards.push(...createChargeLane(id, bossCenter, path, now))
      const start = now + CHARGE_WINDUP_MILLISECONDS
      boss.charge = {
        startAt: start,
        lastAt: start,
        vector: { x: path.direction.x * path.distanceTiles, y: path.direction.y * path.distanceTiles }
      }
      return
    }
    case 'charged-blast': {
      const blast = createChargedBlast(id, boss.x, boss.y, now)
      state.hazards.push(blast)
      boss.channel = { hazardId: blast.id, startHp: boss.hp, until: blast.armedAt }
      return
    }
    case 'tongue-pull': {
      const start = now + TONGUE_PULL_WINDUP_MILLISECONDS
      boss.tongue = { startAt: start, lastAt: start, vector: getTonguePullVector(bossCenter, playerCenter) }
      return
    }
    // 시험 보스는 하수인이 없다. 다른 보스용 기술은 쓰지 않는다.
    default:
      return
  }
}

// 이어지는 기술(혀 당기기·돌진·기 모으기)을 흘린다. 이번 칸에 보스가 무엇을 고를 수 있으면 true.
const updateBossOngoingSkills = (state: FightState): boolean => {
  const { boss, player, now } = state

  // 혀 당기기: 입을 벌린 뒤 짧게 끌어온다(구르는 중이면 빠져나간다)
  if (boss.tongue) {
    const tongue = boss.tongue
    const end = tongue.startAt + TONGUE_PULL_DURATION_MILLISECONDS
    if (now >= tongue.startAt) {
      const step = (Math.min(now, end) - tongue.lastAt) / TONGUE_PULL_DURATION_MILLISECONDS
      if (step > 0 && !isPlayerRolling(state)) {
        tryMove(state, player, tongue.vector.x * step, tongue.vector.y * step)
      }
      tongue.lastAt = Math.min(now, end)
    }
    if (now >= end) {
      boss.tongue = undefined
    }
  }

  if (boss.charge) {
    const charge = boss.charge
    const end = charge.startAt + CHARGE_DASH_MILLISECONDS
    if (now >= charge.startAt) {
      const step = (Math.min(now, end) - charge.lastAt) / CHARGE_DASH_MILLISECONDS
      if (step > 0) {
        tryMove(state, boss, charge.vector.x * step, charge.vector.y * step)
      }
      charge.lastAt = Math.min(now, end)
    }
    if (now >= end + 150) {
      boss.charge = undefined
    }
    return false
  }

  if (boss.channel) {
    const channel = boss.channel
    if (shouldInterruptChargedBlast(channel.startHp, boss.hp, boss.maxHp)) {
      state.hazards = state.hazards.filter((hazard) => hazard.id !== channel.hazardId)
      boss.channel = undefined
      boss.attackUntil = 0
      boss.hitReactionUntil = now + CHARGED_BLAST_STAGGER_MILLISECONDS
      delayAllSkills(boss, now + CHARGED_BLAST_STAGGER_MILLISECONDS)
      state.stats.interrupts += 1
      return false
    }
    if (now < channel.until) {
      return false
    }
    boss.channel = undefined
  }
  return isBossFree(state)
}

// 고른 기술을 쓰고, 고르지 않았으면 근접 공격하거나 쫓아간다.
const actBoss = (state: FightState, choice: BossSkillKind | undefined, random: () => number): void => {
  const { boss, player, now } = state
  const seconds = SIM_STEP_MILLISECONDS / 1000
  if (choice) {
    useBossSkill(state, choice, random)
    return
  }
  const distance = getDistance(boss, player)
  if (boss.nextMeleeAt <= now && distance <= BOSS_MELEE_RANGE_TILES) {
    boss.attackUntil = now + BOSS_ATTACK_DURATION_MILLISECONDS
    boss.nextMeleeAt = now + BOSS_MELEE_INTERVAL_MILLISECONDS
    state.stats.meleeHits += 1
    damagePlayer(state, boss.meleeDamage, 'melee', true)
    return
  }
  if (distance > BOSS_STOP_DISTANCE_TILES) {
    const step = Math.min(BOSS_CHASE_TILES_PER_SECOND * seconds, distance - BOSS_STOP_DISTANCE_TILES)
    tryMove(state, boss, ((player.x - boss.x) / distance) * step, ((player.y - boss.y) / distance) * step)
  }
}

// 한 칸(SIM_STEP_MILLISECONDS)은 두 단계다. 순서는 맵 화면과 같다: 플레이어 → 보스 → 위험 지대.
// 강화학습 환경(bossEnv)은 두 단계 사이에서 멈춰 정책에게 묻는다 — 보스가 고르는 바로 그 순간이다.
// 앞 단계: 시간을 흘리고 플레이어를 움직이고 이어지는 기술을 흘린다. 보스가 고를 수 있으면 true.
export const beginFightStep = (state: FightState, action: PlayerAction, random: () => number): boolean => {
  state.now += SIM_STEP_MILLISECONDS
  stepPlayer(state, action, random)
  return updateBossOngoingSkills(state)
}

// 뒤 단계: 보스가 고를 수 있었으면 choice 대로 움직이고, 위험 지대 피해를 준다.
export const finishFightStep = (
  state: FightState,
  bossCanChoose: boolean,
  choice: BossSkillKind | undefined,
  random: () => number
): void => {
  if (bossCanChoose) {
    actBoss(state, choice, random)
  }
  const tick = tickBossHazards(state.hazards, state.player.x, state.player.y, state.now, (x, y) =>
    state.isWall(Math.floor(x), Math.floor(y))
  )
  state.hazards = tick.hazards
  for (const kind of tick.damageKinds) {
    damagePlayer(state, getBossHazardDamage(kind, state.player.maxHp), kind, DODGEABLE_HAZARD_KINDS.has(kind))
  }
}

export const stepFight = (
  state: FightState,
  action: PlayerAction,
  policy: BossPolicy,
  random: () => number
): void => {
  const bossCanChoose = beginFightStep(state, action, random)
  finishFightStep(state, bossCanChoose, bossCanChoose ? policy(state, getAvailableBossSkills(state)) : undefined, random)
}

export type FightResult = {
  outcome: FightOutcome
  durationMilliseconds: number
  playerHpRatio: number
  bossHpRatio: number
  stats: FightStats
}

export const getFightResult = (state: FightState, outcome: FightOutcome): FightResult => ({
  outcome,
  durationMilliseconds: state.now,
  playerHpRatio: state.player.hp / state.player.maxHp,
  bossHpRatio: state.boss.hp / state.boss.maxHp,
  stats: state.stats
})
