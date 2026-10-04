// 마법 스킬(아이스 볼트·파이어볼·체인 라이트닝)과 마법 시전의 순수 수치/판정 로직.
// 마나·기본 위력·해금은 playerSkills.ts(+ Lua 미러)가 맡고, 여기는 각 마법의 부가 효과
// (빙결 시간, 폭발 범위, 화상, 전이 대상)만 다룬다. 좌표는 월드 픽셀 단위.
// 마법 공격과 마법 스킬은 모두 마법 무기(attackKind === 'magic')를 장착해야 쓸 수 있다.

export type PlayerMagicPoint = {
  id: string
  x: number
  y: number
}

// 시전 준비 시간 — 지팡이를 들어 올려 마력을 모으는 동안. 끝나는 순간 마법이 나간다.
export const PLAYER_MAGIC_CAST_WINDUP_MILLISECONDS = 220
// 시전 후 지팡이를 내리는 여운(마법진이 사그라드는 시간).
export const PLAYER_MAGIC_CAST_RECOVERY_MILLISECONDS = 180

// ---- 아이스 볼트: 맞은 적을 얼린다(이동·공격 정지) ----
export const getIceBoltFreezeDurationMilliseconds = (skillLevel: number): number =>
  1400 + (Math.max(1, Math.floor(skillLevel)) - 1) * 300

// ---- 파이어볼: 맞은 자리에서 폭발(주변 적에게 절반 피해) + 화상 ----
export const FIREBALL_SPLASH_RADIUS_PIXELS = 52
export const FIREBALL_SPLASH_DAMAGE_RATIO = 0.5
export const FIREBALL_BURN_TICK_COUNT = 3
export const FIREBALL_BURN_TICK_INTERVAL_MILLISECONDS = 700

export const getFireballBurnDamagePerTick = (skillLevel: number): number =>
  1 + Math.floor(Math.max(1, Math.floor(skillLevel)) / 2)

// 폭발 중심에서 반경 안에 있는 대상(직격 대상 제외).
export const selectFireballSplashTargets = (
  center: { x: number; y: number },
  directHitId: string,
  candidates: readonly PlayerMagicPoint[],
  radiusPixels = FIREBALL_SPLASH_RADIUS_PIXELS
): PlayerMagicPoint[] =>
  candidates.filter(
    (candidate) =>
      candidate.id !== directHitId &&
      Math.hypot(candidate.x - center.x, candidate.y - center.y) <= radiusPixels
  )

// ---- 체인 라이트닝: 첫 대상에서 가까운 적에게 차례로 튄다 ----
export const CHAIN_LIGHTNING_JUMP_RANGE_PIXELS = 112
export const CHAIN_LIGHTNING_JUMP_DAMAGE_RATIO = 0.75

export const getChainLightningJumpCount = (skillLevel: number): number =>
  2 + Math.floor(Math.max(1, Math.floor(skillLevel)) / 2)

// 첫 대상부터 시작해, 직전에 맞은 대상에서 가장 가까운 아직 안 맞은 대상으로 jumpCount 번
// 튄다. 사거리 안에 남은 대상이 없으면 거기서 멈춘다. 반환은 첫 대상을 포함한 명중 순서.
export const selectChainLightningTargets = ({
  first,
  candidates,
  jumpCount,
  jumpRangePixels = CHAIN_LIGHTNING_JUMP_RANGE_PIXELS
}: {
  first: PlayerMagicPoint
  candidates: readonly PlayerMagicPoint[]
  jumpCount: number
  jumpRangePixels?: number
}): PlayerMagicPoint[] => {
  const chain = [first]
  const hit = new Set([first.id])

  for (let jump = 0; jump < jumpCount; jump += 1) {
    const last = chain[chain.length - 1]
    let next: PlayerMagicPoint | undefined
    let nextDistance = Infinity

    for (const candidate of candidates) {
      if (hit.has(candidate.id)) {
        continue
      }

      const distance = Math.hypot(candidate.x - last.x, candidate.y - last.y)

      if (
        distance <= jumpRangePixels &&
        (distance < nextDistance || (distance === nextDistance && next && candidate.id < next.id))
      ) {
        next = candidate
        nextDistance = distance
      }
    }

    if (!next) {
      break
    }

    chain.push(next)
    hit.add(next.id)
  }

  return chain
}

// n 번째(0 = 첫 대상) 명중의 데미지 — 튈수록 줄어들지만 최소 1.
export const getChainLightningHitDamage = (baseDamage: number, hitIndex: number): number =>
  Math.max(1, Math.round(baseDamage * CHAIN_LIGHTNING_JUMP_DAMAGE_RATIO ** hitIndex))
