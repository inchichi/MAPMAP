// 플레이어 발사체(화살·에너지볼·에너지볼트)의 순수 이동/판정 로직.
// 에너지볼트는 마법 공격(무기와 무관한 별도 키) — 가장 가까운 몬스터를 조준해 따라간다.
// playerSmashSkill.ts와 같은 원칙: 렌더러(createPixiTiledMapView)는 스폰·스프라이트·데미지
// 배선만 하고, 위치 적분·수명·히트 박스 계산은 여기서 좌표 숫자로만 다뤄 단위 테스트를 가능하게 한다.
// 좌표는 전부 월드 픽셀 단위(몬스터 히트 판정 계열과 동일) — 타일 단위 렉트와 섞지 말 것.

export type PlayerProjectileKind =
  | 'arrow'
  | 'energy-ball'
  | 'energy-bolt'
  | 'ice-bolt'
  | 'fireball'

export type PlayerProjectileDirection = {
  x: number
  y: number
}

export type PlayerProjectileState = {
  kind: PlayerProjectileKind
  x: number
  y: number
  direction: PlayerProjectileDirection
  traveledPixels: number
}

export type PlayerProjectileStepResult = {
  next: PlayerProjectileState
  // 최대 사거리에 도달해 이번 프레임으로 수명이 끝났는지. 벽/명중 소멸은 호출부 판단.
  expired: boolean
}

// 발사체 튜닝 — 속도는 픽셀/초, 사거리는 픽셀(32px 타일 기준 화살 7타일, 에너지볼 5.5타일).
export const PLAYER_PROJECTILE_SPEED_PIXELS_PER_SECOND: Record<
  PlayerProjectileKind,
  number
> = {
  arrow: 420,
  'energy-ball': 300,
  'energy-bolt': 340,
  'ice-bolt': 320,
  'fireball': 280
}

export const PLAYER_PROJECTILE_MAX_TRAVEL_PIXELS: Record<
  PlayerProjectileKind,
  number
> = {
  arrow: 224,
  'energy-ball': 176,
  // 유도탄이라 곡선으로 돌아가는 거리까지 감안해 조준 사거리보다 넉넉하다.
  'energy-bolt': 352,
  'ice-bolt': 352,
  'fireball': 352
}

// 몬스터 판정용 정사각 히트 박스 반너비 — 화살은 가늘어 작게, 에너지볼은 부피감 있게.
export const PLAYER_PROJECTILE_HIT_HALF_EXTENT_PIXELS: Record<
  PlayerProjectileKind,
  number
> = {
  arrow: 7,
  'energy-ball': 10,
  'energy-bolt': 9,
  'ice-bolt': 9,
  'fireball': 11
}

// ---- 마법 공격(에너지볼트) ----
// 조준 사거리 7타일. 이 안의 살아 있는 몬스터를 조준한다(없으면 기본 공격은 정면으로).
export const PLAYER_MAGIC_ATTACK_TARGET_RANGE_PIXELS = 224
export const PLAYER_MAGIC_ATTACK_COOLDOWN_MILLISECONDS = 650
// 에너지볼트 자체 위력 — 최종 데미지 = 지력 기반 마법 공격력 + 이 값 (+ 마법 무기 보너스).
export const PLAYER_ENERGY_BOLT_BASE_POWER = 4
// 유도 선회 속도(라디안/초). 아주 빠르게 꺾되 순간이동처럼 직각으로 꺾이지는 않게.
export const PLAYER_ENERGY_BOLT_TURN_RADIANS_PER_SECOND = 7

export type PlayerMagicTargetCandidate = {
  id: string
  x: number
  y: number
}

// 발사 지점에서 사거리 안의 가장 가까운 후보를 고른다. 같은 거리면 바라보는 방향 앞쪽,
// 그다음 id 순 — 같은 상황에서 항상 같은 대상을 고르도록.
export const selectPlayerMagicTarget = ({
  originX,
  originY,
  facing,
  candidates,
  rangePixels = PLAYER_MAGIC_ATTACK_TARGET_RANGE_PIXELS
}: {
  originX: number
  originY: number
  facing: string
  candidates: readonly PlayerMagicTargetCandidate[]
  rangePixels?: number
}): PlayerMagicTargetCandidate | undefined => {
  const facingDirection = getPlayerProjectileDirectionFromFacing(facing)
  let best: { candidate: PlayerMagicTargetCandidate; distance: number; ahead: number } | undefined

  for (const candidate of candidates) {
    const dx = candidate.x - originX
    const dy = candidate.y - originY
    const distance = Math.hypot(dx, dy)

    if (distance > rangePixels) {
      continue
    }

    const ahead = dx * facingDirection.x + dy * facingDirection.y

    if (
      !best ||
      distance < best.distance ||
      (distance === best.distance &&
        (ahead > best.ahead ||
          (ahead === best.ahead && candidate.id < best.candidate.id)))
    ) {
      best = { candidate, distance, ahead }
    }
  }

  return best?.candidate
}

// 진행 방향을 목표 쪽으로 최대 turnRadiansPerSecond 만큼만 돌린다(유도). 목표와 거의 겹치면
// 방향을 그대로 둔다.
export const steerPlayerProjectileToward = (
  state: PlayerProjectileState,
  targetX: number,
  targetY: number,
  deltaMilliseconds: number,
  turnRadiansPerSecond = PLAYER_ENERGY_BOLT_TURN_RADIANS_PER_SECOND
): PlayerProjectileState => {
  const dx = targetX - state.x
  const dy = targetY - state.y

  if (Math.hypot(dx, dy) < 1e-6) {
    return state
  }

  const current = Math.atan2(state.direction.y, state.direction.x)
  const desired = Math.atan2(dy, dx)
  let delta = desired - current

  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2

  const maxTurn = (turnRadiansPerSecond * Math.max(deltaMilliseconds, 0)) / 1000
  const angle = current + Math.max(-maxTurn, Math.min(maxTurn, delta))

  return {
    ...state,
    direction: { x: Math.cos(angle), y: Math.sin(angle) }
  }
}

const FACING_DIRECTION: Record<string, PlayerProjectileDirection> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
}

// 캐릭터 facing 문자열 → 단위 방향 벡터. 알 수 없는 값은 아래(down)로 폴백.
export const getPlayerProjectileDirectionFromFacing = (
  facing: string
): PlayerProjectileDirection => FACING_DIRECTION[facing] ?? FACING_DIRECTION.down

export const createPlayerProjectile = ({
  kind,
  originX,
  originY,
  direction
}: {
  kind: PlayerProjectileKind
  originX: number
  originY: number
  direction: PlayerProjectileDirection
}): PlayerProjectileState => ({
  kind,
  x: originX,
  y: originY,
  direction,
  traveledPixels: 0
})

export const stepPlayerProjectile = (
  state: PlayerProjectileState,
  deltaMilliseconds: number
): PlayerProjectileStepResult => {
  const speed = PLAYER_PROJECTILE_SPEED_PIXELS_PER_SECOND[state.kind]
  const maxTravel = PLAYER_PROJECTILE_MAX_TRAVEL_PIXELS[state.kind]
  // 남은 사거리를 넘지 않게 이동량을 자른다 — 마지막 프레임에 사거리 밖 지점에서 명중하는 일이 없다.
  const stepPixels = Math.min(
    (speed * Math.max(deltaMilliseconds, 0)) / 1000,
    maxTravel - state.traveledPixels
  )
  const traveledPixels = state.traveledPixels + stepPixels

  return {
    next: {
      ...state,
      x: state.x + state.direction.x * stepPixels,
      y: state.y + state.direction.y * stepPixels,
      traveledPixels
    },
    expired: traveledPixels >= maxTravel
  }
}

export const getPlayerProjectileHitRect = (
  state: PlayerProjectileState
): { x: number; y: number; width: number; height: number } => {
  const halfExtent = PLAYER_PROJECTILE_HIT_HALF_EXTENT_PIXELS[state.kind]

  return {
    x: state.x - halfExtent,
    y: state.y - halfExtent,
    width: halfExtent * 2,
    height: halfExtent * 2
  }
}

// 발사체의 시각 회전(라디안). 화살처럼 방향성이 있는 그림에 쓴다.
export const getPlayerProjectileRotation = (
  direction: PlayerProjectileDirection
): number => Math.atan2(direction.y, direction.x)
