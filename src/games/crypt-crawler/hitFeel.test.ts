import { describe, expect, it } from 'vitest'

import {
  DEATH_MS,
  HITSTOP_MS,
  NO_KNOCKBACK,
  NO_SHAKE,
  damageTextLook,
  deathLook,
  hitstopTimeScale,
  knockbackStepTiles,
  shakeOffset,
  startHitstop,
  startKnockback,
  startShake,
  stepHitstop,
  stepKnockback,
  stepShake
} from './hitFeel'

describe('히트스톱', () => {
  it('평소에는 시간이 그대로 흐른다', () => {
    expect(hitstopTimeScale(0)).toBe(1)
  })

  it('타격 중에는 늦추기만 하고 멈추지는 않는다', () => {
    const scale = hitstopTimeScale(startHitstop(0))

    expect(scale).toBeGreaterThan(0)
    expect(scale).toBeLessThan(0.5)
  })

  it('연타해도 길이가 쌓이지 않는다', () => {
    const first = startHitstop(0)

    expect(startHitstop(first)).toBe(first)
    expect(startHitstop(first - 10)).toBe(HITSTOP_MS)
  })

  it('실제 경과 시간만큼 줄고 0 아래로 내려가지 않는다', () => {
    expect(stepHitstop(HITSTOP_MS, 16)).toBe(HITSTOP_MS - 16)
    expect(stepHitstop(10, 500)).toBe(0)
  })

  it('16ms 프레임 네 번이면 끝난다 — 조작이 끊길 만큼 길지 않다', () => {
    let remaining = startHitstop(0)
    for (let frame = 0; frame < 4; frame += 1) {
      remaining = stepHitstop(remaining, 16)
    }

    expect(remaining).toBe(0)
    expect(hitstopTimeScale(remaining)).toBe(1)
  })
})

describe('화면 흔들림', () => {
  it('아무 일도 없으면 오프셋이 0이다', () => {
    expect(shakeOffset(NO_SHAKE)).toEqual({ x: 0, y: 0 })
    expect(shakeOffset(stepShake(NO_SHAKE, 16))).toEqual({ x: 0, y: 0 })
  })

  it('세기가 준 진폭을 넘지 않는다', () => {
    let shake = startShake(4, 150)
    for (let elapsed = 0; elapsed < 150; elapsed += 8) {
      const offset = shakeOffset(shake)
      expect(Math.abs(offset.x)).toBeLessThanOrEqual(4)
      expect(Math.abs(offset.y)).toBeLessThanOrEqual(4)
      shake = stepShake(shake, 8)
    }
  })

  it('시간이 갈수록 잦아든다', () => {
    const early = startShake(4, 150)
    const late = stepShake(early, 120)
    const strength = (shake: typeof early) => {
      const offset = shakeOffset(shake)
      return Math.hypot(offset.x, offset.y)
    }

    expect(strength(late)).toBeLessThan(strength(stepShake(early, 20)))
  })

  it('두 축이 같은 값으로 떨지 않는다 — 대각선으로만 흔들리면 티가 난다', () => {
    const offset = shakeOffset(stepShake(startShake(4, 150), 40))

    expect(offset.x).not.toBeCloseTo(offset.y, 3)
  })

  it('길이를 넘기면 정확히 0으로 멎는다', () => {
    const finished = stepShake(startShake(4, 150), 999)

    expect(finished.elapsedMs).toBe(150)
    expect(shakeOffset(finished)).toEqual({ x: 0, y: 0 })
  })
})

describe('넉백', () => {
  it('때린 쪽에서 맞은 쪽으로 밀린다', () => {
    const knock = startKnockback(10, 10, 12, 10)

    expect(knock.dirX).toBeCloseTo(1)
    expect(knock.dirY).toBeCloseTo(0)
    expect(knock.remainingMs).toBeGreaterThan(0)
  })

  it('방향 벡터는 길이가 1이다', () => {
    const knock = startKnockback(0, 0, -3, 4)

    expect(Math.hypot(knock.dirX, knock.dirY)).toBeCloseTo(1)
  })

  it('두 점이 겹치면 밀 방향이 없어 넉백도 없다', () => {
    expect(startKnockback(5, 5, 5, 5)).toEqual(NO_KNOCKBACK)
  })

  it('한 프레임 이동량이 남은 시간에 따라 줄어든다', () => {
    const fresh = startKnockback(0, 0, 1, 0)
    const worn = stepKnockback(fresh, 100)

    expect(knockbackStepTiles(worn, 16)).toBeLessThan(knockbackStepTiles(fresh, 16))
  })

  it('끝난 넉백은 더 밀지 않는다', () => {
    const finished = stepKnockback(startKnockback(0, 0, 1, 0), 999)

    expect(finished.remainingMs).toBe(0)
    expect(knockbackStepTiles(finished, 16)).toBe(0)
    expect(knockbackStepTiles(NO_KNOCKBACK, 16)).toBe(0)
  })

  it('총 이동 거리가 한 타일을 넘지 않는다 — 밀려서 방을 가로지르면 안 된다', () => {
    let knock = startKnockback(0, 0, 1, 0)
    let travelled = 0
    for (let frame = 0; frame < 40; frame += 1) {
      travelled += knockbackStepTiles(knock, 16)
      knock = stepKnockback(knock, 16)
    }

    expect(travelled).toBeGreaterThan(0.1)
    expect(travelled).toBeLessThan(1)
  })
})

describe('데미지 숫자', () => {
  it('크게 깎을수록 크고 밝다', () => {
    const small = damageTextLook(1, 100)
    const big = damageTextLook(90, 100)

    expect(big.fontSize).toBeGreaterThan(small.fontSize)
    expect(big.color).toBeGreaterThan(small.color)
  })

  it('한 방에 죽여도 최대 크기를 넘지 않는다', () => {
    const overkill = damageTextLook(500, 20)
    const exact = damageTextLook(20, 20)

    expect(overkill).toEqual(exact)
  })

  it('보스처럼 한 대에 조금만 깎여도 가장 작은 글자에 붙어 있지 않다', () => {
    const bossHit = damageTextLook(4, 130)
    const tinyHit = damageTextLook(1, 130)

    expect(bossHit.fontSize).toBeGreaterThan(tinyHit.fontSize)
  })

  it('최대 체력이 0이어도 터지지 않는다', () => {
    expect(Number.isFinite(damageTextLook(5, 0).fontSize)).toBe(true)
  })
})

describe('사망 연출', () => {
  it('시작 순간은 원래 크기에 완전히 보이고 가장 밝다', () => {
    const look = deathLook(0)

    expect(look.alpha).toBe(1)
    expect(look.scale).toBe(1)
    expect(look.flashAlpha).toBe(1)
    expect(look.done).toBe(false)
  })

  it('번쩍임은 연출 앞부분에서만 난다', () => {
    expect(deathLook(DEATH_MS * 0.2).flashAlpha).toBeGreaterThan(0)
    expect(deathLook(DEATH_MS * 0.5).flashAlpha).toBe(0)
  })

  it('줄어들며 사라지고 끝나면 done 이 선다', () => {
    const middle = deathLook(DEATH_MS / 2)
    const end = deathLook(DEATH_MS)

    expect(middle.scale).toBeLessThan(1)
    expect(end.scale).toBeLessThan(middle.scale)
    expect(end.alpha).toBe(0)
    expect(end.done).toBe(true)
  })

  it('길이를 넘겨도 값이 더 나가지 않는다', () => {
    expect(deathLook(DEATH_MS * 5)).toEqual(deathLook(DEATH_MS))
  })
})
