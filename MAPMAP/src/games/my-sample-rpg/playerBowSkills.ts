// 활 스킬(멀티샷·관통 화살·독화살)의 순수 수치/판정 로직. MP·위력·해금은 playerSkills.ts
// (+ Lua 미러)가 맡고, 여기는 각 스킬의 부가 규칙만. 좌표는 월드 픽셀 단위.
// 활 스킬은 활(attackKind === 'bow')을 장착해야 쓸 수 있다.

export type PlayerBowTargetPoint = {
  id: string
  x: number
  y: number
}

// ---- 멀티샷: 사거리 안 가까운 적 여러 마리에게 동시에 조준 화살 ----
export const getMultiShotArrowCount = (skillLevel: number): number =>
  2 + Math.floor(Math.max(1, Math.floor(skillLevel)) / 2)

// 한 발당 피해 비율 — 여러 발이라 한 발은 기본보다 약하다.
export const MULTI_SHOT_DAMAGE_RATIO = 0.8

// 가까운 순으로 count 마리. 같은 거리면 id 순.
export const selectMultiShotTargets = (
  origin: { x: number; y: number },
  candidates: readonly PlayerBowTargetPoint[],
  count: number,
  rangePixels: number
): PlayerBowTargetPoint[] =>
  candidates
    .map((candidate) => ({
      candidate,
      distance: Math.hypot(candidate.x - origin.x, candidate.y - origin.y)
    }))
    .filter(({ distance }) => distance <= rangePixels)
    .sort((left, right) =>
      left.distance !== right.distance
        ? left.distance - right.distance
        : left.candidate.id.localeCompare(right.candidate.id)
    )
    .slice(0, Math.max(0, count))
    .map(({ candidate }) => candidate)

// ---- 관통 화살: 곧게 날아가며 맞는 적을 모두 꿰뚫는다(유도 없음) ----
export const PIERCING_ARROW_MAX_HITS = 6

// ---- 독화살: 맞은 적을 중독(주기 피해) ----
export const POISON_TICK_COUNT = 4
export const POISON_TICK_INTERVAL_MILLISECONDS = 800

export const getPoisonDamagePerTick = (skillLevel: number): number =>
  1 + Math.floor(Math.max(1, Math.floor(skillLevel)) / 2)
