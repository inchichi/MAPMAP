// 무기별 기본 공격 발사체(화살·에너지볼)의 순수 이동/판정 로직.
// playerSmashSkill.ts와 같은 원칙: 렌더러(createPixiTiledMapView)는 스폰·스프라이트·데미지
// 배선만 하고, 위치 적분·수명·히트 박스 계산은 여기서 좌표 숫자로만 다뤄 단위 테스트를 가능하게 한다.
// 좌표는 전부 월드 픽셀 단위(몬스터 히트 판정 계열과 동일) — 타일 단위 렉트와 섞지 말 것.

export type PlayerProjectileKind = 'arrow' | 'energy-ball'

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
  'energy-ball': 300
}

export const PLAYER_PROJECTILE_MAX_TRAVEL_PIXELS: Record<
  PlayerProjectileKind,
  number
> = {
  arrow: 224,
  'energy-ball': 176
}

// 몬스터 판정용 정사각 히트 박스 반너비 — 화살은 가늘어 작게, 에너지볼은 부피감 있게.
export const PLAYER_PROJECTILE_HIT_HALF_EXTENT_PIXELS: Record<
  PlayerProjectileKind,
  number
> = {
  arrow: 7,
  'energy-ball': 10
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
