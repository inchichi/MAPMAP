// 타격감 계산만 모은 순수 모듈. 렌더러는 여기서 나온 수치를 스프라이트에 바르기만 한다.
// 흔들림이 정말 잦아드는지, 넉백이 정말 멎는지를 화면 없이 확인할 수 있어야 값을 조율할 수 있다.
//
// 이 게임의 그림은 밝고 귀여운 픽셀아트다. 그래서 모든 기본값이 작다 — 화면이 크게
// 흔들리거나 시간이 완전히 멎으면 그림과 싸운다.

// ------------------------------------------------------------------ 히트스톱

/** 타격이 들어간 뒤 시간을 늦추는 길이. 이보다 길면 조작이 끊긴 것처럼 느껴진다. */
export const HITSTOP_MS = 60

// 0으로 멈추면 애니메이션이 굳어 버그로 보인다. 늦추기만 한다.
const HITSTOP_TIME_SCALE = 0.15

/** 연타로 히트스톱이 쌓여 게임이 느려지지 않게, 겹치면 긴 쪽만 남긴다. */
export const startHitstop = (remainingMs: number): number =>
  Math.max(remainingMs, HITSTOP_MS)

/** 히트스톱은 실제 경과 시간으로 줄인다. 늦춘 시간으로 줄이면 스스로 늘어난다. */
export const stepHitstop = (remainingMs: number, realDeltaMs: number): number =>
  Math.max(0, remainingMs - realDeltaMs)

/** 이번 프레임의 게임 시간 배율. */
export const hitstopTimeScale = (remainingMs: number): number =>
  remainingMs > 0 ? HITSTOP_TIME_SCALE : 1

// -------------------------------------------------------------- 화면 흔들림

export type ScreenShake = {
  magnitudePx: number
  durationMs: number
  elapsedMs: number
}

/** 다 끝난 흔들림. 진행도가 이미 1이라 오프셋이 0이다(분기 없이 꺼진다). */
export const NO_SHAKE: ScreenShake = { magnitudePx: 0, durationMs: 1, elapsedMs: 1 }

export const startShake = (magnitudePx: number, durationMs: number): ScreenShake => ({
  magnitudePx,
  durationMs,
  elapsedMs: 0
})

export const stepShake = (shake: ScreenShake, deltaMs: number): ScreenShake => ({
  ...shake,
  elapsedMs: Math.min(shake.durationMs, shake.elapsedMs + deltaMs)
})

/**
 * 감쇠하는 흔들림 오프셋(화면 픽셀). 난수 대신 경과 시간의 사인이라 결과가 결정적이고,
 * 두 축의 주기를 어긋나게 두어 대각선으로만 떠는 느낌을 없앤다.
 */
export const shakeOffset = (shake: ScreenShake): { x: number, y: number } => {
  const progress = shake.elapsedMs / shake.durationMs
  if (progress >= 1) {
    return { x: 0, y: 0 }
  }

  const strength = shake.magnitudePx * (1 - progress) ** 2
  return {
    x: Math.sin(shake.elapsedMs * 0.085) * strength,
    y: Math.cos(shake.elapsedMs * 0.062) * strength
  }
}

// -------------------------------------------------------------------- 넉백

export type Knockback = {
  dirX: number
  dirY: number
  remainingMs: number
}

const KNOCKBACK_MS = 140
const KNOCKBACK_SPEED_TILES = 5

export const NO_KNOCKBACK: Knockback = { dirX: 0, dirY: 0, remainingMs: 0 }

/** 때린 쪽 → 맞은 쪽 단위 벡터. 두 점이 겹치면 밀 방향이 없으므로 넉백도 없다. */
export const startKnockback = (
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): Knockback => {
  const dx = toX - fromX
  const dy = toY - fromY
  const length = Math.hypot(dx, dy)
  if (length === 0) {
    return NO_KNOCKBACK
  }

  return { dirX: dx / length, dirY: dy / length, remainingMs: KNOCKBACK_MS }
}

/** 이번 프레임에 밀려날 거리(타일). 남은 시간에 비례해 줄어 매끄럽게 멎는다. */
export const knockbackStepTiles = (knock: Knockback, deltaMs: number): number => {
  const applied = Math.min(knock.remainingMs, deltaMs)
  if (applied <= 0) {
    return 0
  }

  return KNOCKBACK_SPEED_TILES * (knock.remainingMs / KNOCKBACK_MS) * (applied / 1000)
}

export const stepKnockback = (knock: Knockback, deltaMs: number): Knockback => ({
  ...knock,
  remainingMs: Math.max(0, knock.remainingMs - deltaMs)
})

// -------------------------------------------------------------- 데미지 숫자

export type DamageTextLook = {
  fontSize: number
  color: number
}

const SMALL_HIT: DamageTextLook = { fontSize: 8, color: 0xffcf5c }
const BIG_HIT: DamageTextLook = { fontSize: 13, color: 0xfff6dd }

const mix = (from: number, to: number, weight: number): number =>
  from + (to - from) * weight

const mixColour = (from: number, to: number, weight: number): number => {
  const channel = (shift: number) =>
    Math.round(mix((from >> shift) & 0xff, (to >> shift) & 0xff, weight))
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

/**
 * 한 대에 상대 최대 체력의 얼마를 깎았는지로 크기와 밝기를 정한다. 치명타 개념이 없어도
 * "이번 건 크게 들어갔다"가 눈에 보인다. 제곱근을 쓰는 이유는 보스가 한 대에 3%만
 * 깎이기 때문이다 — 선형이면 보스전 내내 가장 작은 글자만 뜬다.
 */
export const damageTextLook = (damage: number, targetMaxHp: number): DamageTextLook => {
  const ratio = Math.min(1, Math.max(0, damage / Math.max(1, targetMaxHp)))
  const weight = Math.sqrt(ratio)

  return {
    fontSize: Math.round(mix(SMALL_HIT.fontSize, BIG_HIT.fontSize, weight)),
    color: mixColour(SMALL_HIT.color, BIG_HIT.color, weight)
  }
}

// ---------------------------------------------------------------- 사망 연출

/** 사망 연출 길이. 잡몹이 수십 마리씩 죽는 게임이라 길면 시체가 화면에 쌓인다. */
export const DEATH_MS = 260

export type DeathLook = {
  alpha: number
  scale: number
  /** 위에 겹쳐 더할 흰 실루엣의 불투명도. 곱셈 tint 로는 밝게 만들 수 없다. */
  flashAlpha: number
  done: boolean
}

/** scale 은 원래 크기에 곱할 배율이다(보스는 2배로 그려지고 있다). */
export const deathLook = (elapsedMs: number): DeathLook => {
  const progress = Math.min(1, Math.max(0, elapsedMs / DEATH_MS))

  return {
    alpha: 1 - progress ** 2,
    scale: 1 - progress * 0.45,
    // 번쩍임은 앞 40% 안에서만. 사라지는 내내 빛나면 유령처럼 보인다.
    flashAlpha: Math.max(0, 1 - progress / 0.4),
    done: progress >= 1
  }
}
