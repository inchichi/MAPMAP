import { describe, expect, it } from 'vitest'

import {
  CORNER_ASSIST_MAX_MISALIGNMENT_TILES,
  isCharacterPositionBlocked,
  resolveCornerAssistNudge
} from './characterCollision'

const wallsAt = (...tiles: [number, number][]): Set<string> =>
  new Set(tiles.map(([x, y]) => `${x},${y}`))

describe('isCharacterPositionBlocked', () => {
  it('lets a full-tile character through a one-tile corridor only when aligned', () => {
    const walls = wallsAt([4, 5], [6, 5])

    expect(isCharacterPositionBlocked(walls, [], 5, 5, 1, 1)).toBe(false)
    expect(isCharacterPositionBlocked(walls, [], 5.01, 5, 1, 1)).toBe(true)
  })

  it('treats touching edges of a blocking rect as free', () => {
    const blocker = { x: 6, y: 5, width: 1, height: 1 }

    expect(isCharacterPositionBlocked(new Set(), [blocker], 5, 5, 1, 1)).toBe(false)
    expect(isCharacterPositionBlocked(new Set(), [blocker], 5.5, 5, 1, 1)).toBe(true)
  })
})

describe('resolveCornerAssistNudge', () => {
  const baseInput = {
    wallTiles: new Set<string>(),
    blockingRects: [],
    width: 1,
    height: 1,
    deltaX: 0,
    deltaY: 0
  }

  it('nudges down toward the open row when walking right into a blocked corner', () => {
    // (11,4)는 벽, (11,5)는 통로. 캐릭터는 y=4.7이라 두 줄에 걸쳐 있다.
    const nudge = resolveCornerAssistNudge({
      ...baseInput,
      wallTiles: wallsAt([11, 4]),
      x: 10,
      y: 4.7,
      deltaX: 0.13
    })

    expect(nudge).toEqual({ axis: 'y', amount: 0.13 })
  })

  it('caps the nudge at the remaining misalignment', () => {
    const nudge = resolveCornerAssistNudge({
      ...baseInput,
      wallTiles: wallsAt([11, 4]),
      x: 10,
      y: 4.95,
      deltaX: 0.13
    })

    expect(nudge?.axis).toBe('y')
    expect(nudge?.amount).toBeCloseTo(0.05, 6)
  })

  it('nudges up when the open row is above', () => {
    const nudge = resolveCornerAssistNudge({
      ...baseInput,
      wallTiles: wallsAt([11, 5]),
      x: 10,
      y: 4.3,
      deltaX: 0.13
    })

    expect(nudge?.axis).toBe('y')
    expect(nudge?.amount).toBeCloseTo(-0.13, 6)
  })

  it('does not assist when the misalignment is beyond the threshold', () => {
    const nudge = resolveCornerAssistNudge({
      ...baseInput,
      wallTiles: wallsAt([11, 4]),
      x: 10,
      y: 4 + CORNER_ASSIST_MAX_MISALIGNMENT_TILES + 0.05,
      deltaX: 0.13
    })

    expect(nudge).toBeUndefined()
  })

  it('does not assist into a wall on both candidate rows', () => {
    const nudge = resolveCornerAssistNudge({
      ...baseInput,
      wallTiles: wallsAt([11, 4], [11, 5]),
      x: 10,
      y: 4.7,
      deltaX: 0.13
    })

    expect(nudge).toBeUndefined()
  })

  it('does not push through a character standing on the aligned row', () => {
    const nudge = resolveCornerAssistNudge({
      ...baseInput,
      wallTiles: wallsAt([11, 4]),
      blockingRects: [{ x: 10, y: 5, width: 1, height: 1 }],
      x: 10,
      y: 4.7,
      deltaX: 0.13
    })

    expect(nudge).toBeUndefined()
  })

  it('nudges sideways when walking down into a blocked column', () => {
    const nudge = resolveCornerAssistNudge({
      ...baseInput,
      wallTiles: wallsAt([4, 11]),
      x: 4.7,
      y: 10,
      deltaY: 0.13
    })

    expect(nudge).toEqual({ axis: 'x', amount: 0.13 })
  })

  it('leaves diagonal input to the existing axis sliding', () => {
    const nudge = resolveCornerAssistNudge({
      ...baseInput,
      wallTiles: wallsAt([11, 4]),
      x: 10,
      y: 4.7,
      deltaX: 0.13,
      deltaY: 0.13
    })

    expect(nudge).toBeUndefined()
  })

  it('does not assist a character that is already row-aligned', () => {
    const nudge = resolveCornerAssistNudge({
      ...baseInput,
      wallTiles: wallsAt([11, 4]),
      x: 10,
      y: 4,
      deltaX: 0.13
    })

    expect(nudge).toBeUndefined()
  })

  it('does not assist characters larger than one tile', () => {
    const nudge = resolveCornerAssistNudge({
      ...baseInput,
      wallTiles: wallsAt([11, 4]),
      x: 10,
      y: 4.7,
      width: 2,
      height: 2,
      deltaX: 0.13
    })

    expect(nudge).toBeUndefined()
  })
})
