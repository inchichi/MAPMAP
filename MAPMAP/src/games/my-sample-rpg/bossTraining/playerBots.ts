// 시험 보스와 싸우는 규칙 기반 플레이어 봇. 실력(초보·보통·고수)은 반응 속도와 회피·구르기 성공 확률로만
// 다르다 — 보스가 한 봇의 버릇만 파고들지 않게, 학습 때는 여러 실력을 섞어 상대한다(docs/boss-rl-design.md).
//
// 봇이 하는 일:
//   1. 새 위험 지대를 보면 반응 시간이 지난 뒤에야 알아챈다. 알아챌 때 "피할지"를 한 번 정한다(기술 한 번 단위).
//   2. 피하기로 한 지대가 곧 터지는데 그 안에 있으면 가장 가까운 안전한 자리로 걷고, 늦었으면 구른다.
//   3. 혀 당기기를 알아채면 구른다. 기 모으기는 때려서 끊을지 도망칠지 정한다.
//   4. 근접 공격은 예고가 없어서, 리듬을 읽는 봇만 칠 때쯤 구르기(무적)로 받아넘긴다.
//   5. 위험이 없으면 보스에게 붙어서 때린다. 체력이 낮으면 물약을 마신다(다른 행동과 함께).
import { isPointInBossHazard, type BossHazard } from '../bossSkills'
import {
  BOSS_MELEE_RANGE_TILES,
  getDistance,
  isPlayerRolling,
  PLAYER_ATTACK_REACH_TILES,
  type FightState,
  type PlayerAction,
  type Vector
} from './bossFightSim'

export type PlayerBotTier = 'novice' | 'normal' | 'expert'

export type PlayerBotSkill = {
  // 새 위험을 알아채기까지 걸리는 시간
  reactionMilliseconds: number
  // 알아챈 위험을 피하려고 할 확률
  dodgeChance: number
  // 늦었을 때 구르기로 피할 확률(그리고 혀 당기기를 구르기로 빠져나갈 확률)
  rollChance: number
  // 기 모으기를 때려서 끊으려 할 확률(아니면 도망친다)
  interruptChance: number
  // 걷는 방향이 흔들리는 정도(라디안)
  moveJitter: number
  // 보스 근접 공격 리듬을 읽고 칠 때쯤 구를 확률
  meleeReadChance: number
  // 체력이 이 비율 아래면 물약을 마신다
  potionThreshold: number
  // 손이 닿는 거리에서 휘둘렀을 때 맞을 확률
  accuracy: number
}

export const PLAYER_BOT_SKILLS: Record<PlayerBotTier, PlayerBotSkill> = {
  novice: {
    reactionMilliseconds: 400,
    dodgeChance: 0.5,
    rollChance: 0.3,
    interruptChance: 0.2,
    moveJitter: 0.4,
    meleeReadChance: 0,
    potionThreshold: 0.35,
    accuracy: 0.6
  },
  normal: {
    reactionMilliseconds: 280,
    dodgeChance: 0.65,
    rollChance: 0.5,
    interruptChance: 0.5,
    moveJitter: 0.25,
    meleeReadChance: 0.3,
    potionThreshold: 0.4,
    accuracy: 0.75
  },
  expert: {
    reactionMilliseconds: 180,
    dodgeChance: 0.85,
    rollChance: 0.7,
    interruptChance: 0.8,
    moveJitter: 0.1,
    meleeReadChance: 0.5,
    potionThreshold: 0.45,
    accuracy: 0.85
  }
}

// 위험이 터지기 이만큼 전부터 피하기 시작한다
const DODGE_LOOKAHEAD_MILLISECONDS = 1200
// 이만큼 남았는데 아직 안이면 구른다
const ROLL_PANIC_MILLISECONDS = 220
// 보스 근접 공격이 이만큼 안으로 다가오면 구른다
const MELEE_READ_MILLISECONDS = 250
// 기 모으기를 끊으려다가도 이만큼 남으면 도망친다
const CHANNEL_GIVE_UP_MILLISECONDS = 500
const ESCAPE_DIRECTIONS = 16
const ESCAPE_DISTANCES = [0.75, 1.5, 2.5, 3.5, 5]

type CastMemory = { noticeAt: number; dodge: boolean; roll: boolean; interrupt: boolean }

// 같은 기술 한 번에서 나온 지대(돌진 길·유성·탄)는 id 앞부분이 같다 — 'boss:7:3' → 'boss:7'
const getCastId = (hazard: BossHazard): string => hazard.id.split(':').slice(0, 2).join(':')

export type PlayerBot = (state: FightState) => PlayerAction

export const createPlayerBot = (skill: PlayerBotSkill, random: () => number): PlayerBot => {
  const casts = new Map<string, CastMemory>()
  let tongueMemory: { startAt: number; roll: boolean } | undefined
  let meleeMemory: { at: number; read: boolean } | undefined

  const remember = (castId: string, now: number): CastMemory => {
    const known = casts.get(castId)
    if (known) {
      return known
    }
    const memory = {
      noticeAt: now + skill.reactionMilliseconds,
      dodge: random() < skill.dodgeChance,
      roll: random() < skill.rollChance,
      interrupt: random() < skill.interruptChance
    }
    casts.set(castId, memory)
    return memory
  }

  // 이 자리가 곧(지금부터 lookahead 안에) 맞을 자리인가. 탄은 앞으로 날아올 자리까지 본다.
  const isThreatened = (threats: readonly BossHazard[], point: Vector, now: number): boolean =>
    threats.some((hazard) => {
      if (hazard.velocity) {
        return [0, 150, 300, 450].some((ahead) =>
          isPointInBossHazard(hazard, point.x, point.y, Math.max(now, hazard.armedAt) + ahead)
        )
      }
      return isPointInBossHazard(hazard, point.x, point.y, now)
    })

  const findEscape = (state: FightState, threats: readonly BossHazard[]): Vector | undefined => {
    const { player, boss } = state
    let best: { point: Vector; score: number } | undefined
    for (let index = 0; index < ESCAPE_DIRECTIONS; index += 1) {
      const angle = (index / ESCAPE_DIRECTIONS) * Math.PI * 2
      for (const distance of ESCAPE_DISTANCES) {
        const point = { x: player.x + Math.cos(angle) * distance, y: player.y + Math.sin(angle) * distance }
        if (state.isWall(Math.floor(point.x), Math.floor(point.y)) || isThreatened(threats, point, state.now)) {
          continue
        }
        // 가까운 안전한 곳, 그중에서도 보스 곁(다시 때리러 가기 쉬운 곳)
        const score = distance + getDistance(point, boss) * 0.15
        if (!best || score < best.score) {
          best = { point, score }
        }
        break
      }
    }
    return best?.point
  }

  const jitter = (direction: Vector): Vector => {
    const angle = Math.atan2(direction.y, direction.x) + (random() * 2 - 1) * skill.moveJitter
    return { x: Math.cos(angle), y: Math.sin(angle) }
  }

  return (state) => {
    const action = decide(state)
    return state.player.hp / state.player.maxHp < skill.potionThreshold ? { ...action, drinkPotion: true } : action
  }

  function decide(state: FightState): PlayerAction {
    const { player, boss, now } = state
    const toBoss = { x: boss.x - player.x, y: boss.y - player.y }
    const distanceToBoss = getDistance(player, boss)

    // 혀 당기기: 입을 벌리는 동안 알아채면 옆으로 구른다
    if (boss.tongue && now < boss.tongue.startAt) {
      if (tongueMemory?.startAt !== boss.tongue.startAt) {
        tongueMemory = { startAt: boss.tongue.startAt, roll: random() < skill.rollChance }
      }
      const noticed = boss.tongue.startAt - now <= Math.max(0, 450 - skill.reactionMilliseconds)
      if (tongueMemory.roll && noticed) {
        return { move: { x: 0, y: 0 }, attack: false, roll: { x: -toBoss.y, y: toBoss.x } }
      }
    }

    const threats = state.hazards.filter((hazard) => {
      const memory = remember(getCastId(hazard), now)
      if (now < memory.noticeAt || !memory.dodge) {
        return false
      }
      const untilArmed = hazard.armedAt - now
      if (hazard.kind === 'charged-blast' && memory.interrupt && untilArmed > CHANNEL_GIVE_UP_MILLISECONDS) {
        return false
      }
      return hazard.velocity ? true : untilArmed <= DODGE_LOOKAHEAD_MILLISECONDS
    })

    if (threats.length > 0 && isThreatened(threats, player, now)) {
      const escape = findEscape(state, threats)
      if (escape) {
        const direction = { x: escape.x - player.x, y: escape.y - player.y }
        const soonest = Math.min(...threats.map((hazard) => hazard.armedAt - now))
        const memory = remember(getCastId(threats[0]), now)
        if (soonest <= ROLL_PANIC_MILLISECONDS && memory.roll && !isPlayerRolling(state)) {
          return { move: direction, attack: false, roll: direction }
        }
        // 피하면서도 손이 닿으면 때린다
        return { move: jitter(direction), attack: distanceToBoss <= PLAYER_ATTACK_REACH_TILES }
      }
    }

    // 근접 공격 리듬 읽기: 칠 때가 되었고 곧 사거리 안이면 보스 쪽으로 굴러 그 한 방을 무적으로 받아넘긴다.
    // 보스는 사거리에 들어오는 순간 치므로, 옆으로 비키면 다시 다가갈 때 맞는다 — 뚫고 들어가야 한다.
    if (
      boss.nextMeleeAt - now <= MELEE_READ_MILLISECONDS &&
      distanceToBoss <= BOSS_MELEE_RANGE_TILES + 1 &&
      !isPlayerRolling(state) &&
      player.rollReadyAt <= now
    ) {
      if (meleeMemory?.at !== boss.nextMeleeAt) {
        meleeMemory = { at: boss.nextMeleeAt, read: random() < skill.meleeReadChance }
      }
      if (meleeMemory.read) {
        meleeMemory.read = false
        return { move: toBoss, attack: false, roll: toBoss }
      }
    }

    // 보스에게 붙어서 때린다
    const inReach = distanceToBoss <= PLAYER_ATTACK_REACH_TILES - 0.2
    return {
      move: inReach ? { x: 0, y: 0 } : jitter(toBoss),
      attack: distanceToBoss <= PLAYER_ATTACK_REACH_TILES
    }
  }
}
