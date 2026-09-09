// 보스는 잡몹과 같은 "다가가서 때린다"로는 보스가 되지 않는다. 예고 → 기술 → 경직의
// 주기를 두어 플레이어가 읽고 피할 틈을 만든다. 이 팩의 demoncyclop 은 공격 애니가 없어서
// (idle/walk/hit 뿐) 기술은 프레임이 아니라 이동과 예고 연출로 표현한다.
//
// 순수 함수다. 실제 이동·충돌·데미지 적용은 렌더러가 action 을 받아 처리한다.

export type BossPhase = 'chase' | 'telegraph' | 'slam' | 'charge' | 'recover'

export type BossAiState = {
  phase: BossPhase
  phaseEndsAtMs: number
  nextPatternAtMs: number
  // 돌진은 예고 시점의 방향으로 고정된다 — 도중에 따라오면 피할 수 없다.
  chargeDirX: number
  chargeDirY: number
  pendingPattern: 'slam' | 'charge'
  enraged: boolean
}

export type BossAction = {
  moveX: number
  moveY: number
  /** 내려찍기가 터진 프레임에만 true — 호출부가 반경 안에 한 번만 피해를 준다. */
  slam: boolean
  /** 돌진 중 접촉 판정을 볼 프레임 */
  chargeHit: boolean
  /** 예고 진행도 0~1. 1에 가까울수록 임박했다는 뜻이라 연출 강도를 올린다. */
  telegraph: number
}

export type BossAiConfig = {
  chaseSpeedTiles: number
  chargeSpeedTiles: number
  patternRangeTiles: number
  slamRangeTiles: number
  telegraphMs: number
  slamMs: number
  chargeMs: number
  recoverMs: number
  patternCooldownMs: number
  enrageHpRatio: number
  enrageSpeedBonus: number
  enrageCooldownScale: number
}

export const DEFAULT_BOSS_CONFIG: BossAiConfig = {
  chaseSpeedTiles: 2.4,
  chargeSpeedTiles: 9,
  patternRangeTiles: 11,
  // 이보다 가까우면 내려찍기, 멀면 돌진. 붙어 있는데 돌진하면 스쳐 지나가 버린다.
  slamRangeTiles: 3.4,
  telegraphMs: 620,
  slamMs: 180,
  chargeMs: 520,
  recoverMs: 700,
  patternCooldownMs: 2100,
  enrageHpRatio: 0.4,
  enrageSpeedBonus: 1.35,
  enrageCooldownScale: 0.6
}

const IDLE: BossAction = { moveX: 0, moveY: 0, slam: false, chargeHit: false, telegraph: 0 }

const towards = (fromX: number, fromY: number, toX: number, toY: number) => {
  const dx = toX - fromX
  const dy = toY - fromY
  const length = Math.hypot(dx, dy)
  return length === 0 ? { x: 0, y: 0 } : { x: dx / length, y: dy / length }
}

export const createBossAi = (): BossAiState => ({
  phase: 'chase',
  phaseEndsAtMs: 0,
  nextPatternAtMs: 0,
  chargeDirX: 0,
  chargeDirY: 1,
  pendingPattern: 'slam',
  enraged: false
})

export const stepBossAi = (
  ai: BossAiState,
  bossX: number,
  bossY: number,
  playerX: number,
  playerY: number,
  hpRatio: number,
  nowMs: number,
  config: BossAiConfig = DEFAULT_BOSS_CONFIG
): { ai: BossAiState, action: BossAction } => {
  // 격노는 한 번 켜지면 유지된다. 체력이 회복돼도 꺼지지 않는다(보스는 회복하지 않는다).
  const enraged = ai.enraged || hpRatio <= config.enrageHpRatio
  const speedScale = enraged ? config.enrageSpeedBonus : 1
  const cooldownScale = enraged ? config.enrageCooldownScale : 1
  const distance = Math.hypot(playerX - bossX, playerY - bossY)

  if (ai.phase === 'chase') {
    if (distance <= config.patternRangeTiles && nowMs >= ai.nextPatternAtMs) {
      const pattern = distance <= config.slamRangeTiles ? 'slam' : 'charge'
      const direction = towards(bossX, bossY, playerX, playerY)
      return {
        ai: {
          ...ai,
          enraged,
          phase: 'telegraph',
          pendingPattern: pattern,
          phaseEndsAtMs: nowMs + config.telegraphMs,
          chargeDirX: direction.x,
          chargeDirY: direction.y
        },
        action: IDLE
      }
    }
    const direction = towards(bossX, bossY, playerX, playerY)
    return {
      ai: { ...ai, enraged },
      action: {
        moveX: direction.x * config.chaseSpeedTiles * speedScale,
        moveY: direction.y * config.chaseSpeedTiles * speedScale,
        slam: false,
        chargeHit: false,
        telegraph: 0
      }
    }
  }

  if (ai.phase === 'telegraph') {
    if (nowMs < ai.phaseEndsAtMs) {
      const remaining = ai.phaseEndsAtMs - nowMs
      return {
        ai: { ...ai, enraged },
        action: {
          ...IDLE,
          telegraph: 1 - Math.min(1, remaining / config.telegraphMs)
        }
      }
    }
    // 예고가 끝나는 프레임에 기술이 시작된다.
    const isSlam = ai.pendingPattern === 'slam'
    return {
      ai: {
        ...ai,
        enraged,
        phase: isSlam ? 'slam' : 'charge',
        phaseEndsAtMs: nowMs + (isSlam ? config.slamMs : config.chargeMs)
      },
      action: { ...IDLE, slam: isSlam, telegraph: 1 }
    }
  }

  if (ai.phase === 'slam') {
    if (nowMs < ai.phaseEndsAtMs) {
      return { ai: { ...ai, enraged }, action: IDLE }
    }
    return {
      ai: {
        ...ai,
        enraged,
        phase: 'recover',
        phaseEndsAtMs: nowMs + config.recoverMs,
        nextPatternAtMs: nowMs + config.patternCooldownMs * cooldownScale
      },
      action: IDLE
    }
  }

  if (ai.phase === 'charge') {
    if (nowMs < ai.phaseEndsAtMs) {
      return {
        ai: { ...ai, enraged },
        action: {
          moveX: ai.chargeDirX * config.chargeSpeedTiles * speedScale,
          moveY: ai.chargeDirY * config.chargeSpeedTiles * speedScale,
          slam: false,
          chargeHit: true,
          telegraph: 0
        }
      }
    }
    return {
      ai: {
        ...ai,
        enraged,
        phase: 'recover',
        phaseEndsAtMs: nowMs + config.recoverMs,
        nextPatternAtMs: nowMs + config.patternCooldownMs * cooldownScale
      },
      action: IDLE
    }
  }

  // recover — 기술 뒤 경직. 여기서 때리라고 만든 틈이다.
  if (nowMs < ai.phaseEndsAtMs) {
    return { ai: { ...ai, enraged }, action: IDLE }
  }
  return { ai: { ...ai, enraged, phase: 'chase' }, action: IDLE }
}
