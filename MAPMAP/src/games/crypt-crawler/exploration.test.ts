import { describe, expect, it } from 'vitest'

import {
  createExploration,
  discoveredRatio,
  isDiscovered,
  revealAround
} from './exploration'

describe('exploration', () => {
  it('시작 시 아무것도 드러나 있지 않다', () => {
    const state = createExploration(8, 8)

    expect(isDiscovered(state, 0, 0)).toBe(false)
    expect(discoveredRatio(state)).toBe(0)
  })

  it('반경 안은 드러나고 밖은 그대로다', () => {
    const state = createExploration(16, 16)
    revealAround(state, 8, 8, 2)

    expect(isDiscovered(state, 8, 8)).toBe(true)
    expect(isDiscovered(state, 8, 10)).toBe(true)
    // 대각으로 2,2 는 거리 제곱 8 > 4 이므로 원 밖이다.
    expect(isDiscovered(state, 10, 10)).toBe(false)
    expect(isDiscovered(state, 8, 11)).toBe(false)
  })

  it('새로 드러난 칸 수만 센다 — 같은 자리를 다시 밝히면 0이다', () => {
    const state = createExploration(16, 16)
    const first = revealAround(state, 8, 8, 1)
    const second = revealAround(state, 8, 8, 1)

    expect(first).toBeGreaterThan(0)
    expect(second).toBe(0)
  })

  it('맵 경계를 넘어가도 잘리기만 하고 터지지 않는다', () => {
    const state = createExploration(8, 8)
    const revealed = revealAround(state, 0, 0, 3)

    expect(revealed).toBeGreaterThan(0)
    expect(isDiscovered(state, 0, 0)).toBe(true)
    // 경계 밖 조회는 언제나 false.
    expect(isDiscovered(state, -1, 0)).toBe(false)
    expect(isDiscovered(state, 8, 0)).toBe(false)
  })

  it('반경 0 이면 선 자리 한 칸만 드러난다', () => {
    const state = createExploration(8, 8)

    expect(revealAround(state, 4, 4, 0)).toBe(1)
    expect(isDiscovered(state, 4, 4)).toBe(true)
    expect(isDiscovered(state, 5, 4)).toBe(false)
  })

  it('소수 좌표는 서 있는 칸으로 내림 처리한다', () => {
    const state = createExploration(8, 8)
    revealAround(state, 3.9, 2.1, 0)

    expect(isDiscovered(state, 3, 2)).toBe(true)
  })

  it('전부 드러나면 비율이 1이다', () => {
    const state = createExploration(4, 4)
    revealAround(state, 1, 1, 99)

    expect(discoveredRatio(state)).toBe(1)
  })
})
