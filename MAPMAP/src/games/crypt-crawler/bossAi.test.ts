import { describe, expect, it } from 'vitest'

import { createBossAi, stepBossAi, DEFAULT_BOSS_CONFIG, type BossAiState } from './bossAi'

const CONFIG = DEFAULT_BOSS_CONFIG

// 보스를 (0,0)에 두고 플레이어 위치와 시각만 바꿔 가며 상태를 진행시킨다.
const step = (ai: BossAiState, playerX: number, playerY: number, nowMs: number, hpRatio = 1) =>
  stepBossAi(ai, 0, 0, playerX, playerY, hpRatio, nowMs, CONFIG)

describe('bossAi', () => {
  it('사거리 밖이면 쫓아온다', () => {
    const { ai, action } = step(createBossAi(), 30, 0, 0)

    expect(ai.phase).toBe('chase')
    expect(action.moveX).toBeCloseTo(CONFIG.chaseSpeedTiles)
    expect(action.moveY).toBeCloseTo(0)
    expect(action.slam).toBe(false)
  })

  it('가까우면 내려찍기를, 멀면 돌진을 예고한다', () => {
    const close = step(createBossAi(), 2, 0, 0)
    expect(close.ai.phase).toBe('telegraph')
    expect(close.ai.pendingPattern).toBe('slam')

    const far = step(createBossAi(), 8, 0, 0)
    expect(far.ai.phase).toBe('telegraph')
    expect(far.ai.pendingPattern).toBe('charge')
  })

  it('예고 중에는 멈춰 서고 진행도가 올라간다', () => {
    const started = step(createBossAi(), 2, 0, 0)
    const mid = step(started.ai, 2, 0, CONFIG.telegraphMs / 2)

    expect(mid.action.moveX).toBe(0)
    expect(mid.action.moveY).toBe(0)
    expect(mid.action.telegraph).toBeGreaterThan(0.4)
    expect(mid.action.telegraph).toBeLessThan(0.6)
  })

  it('내려찍기는 예고가 끝나는 프레임에 딱 한 번만 터진다', () => {
    const started = step(createBossAi(), 2, 0, 0)
    const fired = step(started.ai, 2, 0, CONFIG.telegraphMs)
    expect(fired.action.slam).toBe(true)
    expect(fired.ai.phase).toBe('slam')

    const after = step(fired.ai, 2, 0, CONFIG.telegraphMs + 1)
    expect(after.action.slam).toBe(false)
  })

  it('돌진 방향은 예고 시점에 고정되어 도중에 따라오지 않는다', () => {
    const started = step(createBossAi(), 8, 0, 0)
    expect(started.ai.chargeDirX).toBeCloseTo(1)
    expect(started.ai.chargeDirY).toBeCloseTo(0)

    // 예고가 끝나기 전에 플레이어가 위로 도망쳐도 방향은 그대로여야 한다.
    const moved = step(started.ai, 0, -8, CONFIG.telegraphMs / 2)
    expect(moved.ai.chargeDirX).toBeCloseTo(1)
    expect(moved.ai.chargeDirY).toBeCloseTo(0)

    const charging = step(moved.ai, 0, -8, CONFIG.telegraphMs)
    const running = step(charging.ai, 0, -8, CONFIG.telegraphMs + 10)
    expect(running.action.chargeHit).toBe(true)
    expect(running.action.moveX).toBeCloseTo(CONFIG.chargeSpeedTiles)
    expect(running.action.moveY).toBeCloseTo(0)
  })

  it('기술 뒤에는 경직이 있고 그동안 움직이지 않는다', () => {
    let state = step(createBossAi(), 2, 0, 0).ai
    state = step(state, 2, 0, CONFIG.telegraphMs).ai
    const recovering = step(state, 2, 0, CONFIG.telegraphMs + CONFIG.slamMs)

    expect(recovering.ai.phase).toBe('recover')
    expect(recovering.action.moveX).toBe(0)

    const stillRecovering = step(recovering.ai, 2, 0, CONFIG.telegraphMs + CONFIG.slamMs + 10)
    expect(stillRecovering.ai.phase).toBe('recover')
    expect(stillRecovering.action.moveX).toBe(0)
  })

  it('경직이 끝나면 추격으로 돌아간다', () => {
    let state = step(createBossAi(), 2, 0, 0).ai
    state = step(state, 2, 0, CONFIG.telegraphMs).ai
    state = step(state, 2, 0, CONFIG.telegraphMs + CONFIG.slamMs).ai
    const done = step(state, 2, 0, CONFIG.telegraphMs + CONFIG.slamMs + CONFIG.recoverMs)

    expect(done.ai.phase).toBe('chase')
  })

  it('쿨다운 전에는 사거리 안이어도 기술을 다시 쓰지 않는다', () => {
    let state = step(createBossAi(), 2, 0, 0).ai
    state = step(state, 2, 0, CONFIG.telegraphMs).ai
    const slamEnd = CONFIG.telegraphMs + CONFIG.slamMs
    state = step(state, 2, 0, slamEnd).ai
    state = step(state, 2, 0, slamEnd + CONFIG.recoverMs).ai
    expect(state.phase).toBe('chase')

    // 쿨다운(패턴 종료 시점 기준)이 아직 안 끝났으면 예고로 넘어가지 않는다.
    const tooSoon = step(state, 2, 0, slamEnd + CONFIG.recoverMs + 1)
    expect(tooSoon.ai.phase).toBe('chase')

    const ready = step(state, 2, 0, slamEnd + CONFIG.patternCooldownMs + 1)
    expect(ready.ai.phase).toBe('telegraph')
  })

  it('체력이 임계 아래로 내려가면 격노하고, 다시 회복해도 풀리지 않는다', () => {
    const calm = step(createBossAi(), 30, 0, 0, 1)
    expect(calm.ai.enraged).toBe(false)

    const enraged = step(calm.ai, 30, 0, 10, CONFIG.enrageHpRatio - 0.01)
    expect(enraged.ai.enraged).toBe(true)
    // 격노하면 추격 속도가 빨라진다.
    expect(enraged.action.moveX).toBeGreaterThan(calm.action.moveX)

    const stillEnraged = step(enraged.ai, 30, 0, 20, 1)
    expect(stillEnraged.ai.enraged).toBe(true)
  })

  it('플레이어가 정확히 겹쳐 있어도 방향 계산이 NaN 이 되지 않는다', () => {
    const { action } = step(createBossAi(), 0, 0, 0)

    expect(Number.isNaN(action.moveX)).toBe(false)
    expect(Number.isNaN(action.moveY)).toBe(false)
  })
})
