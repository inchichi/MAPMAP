import { describe, expect, it } from 'vitest'

import { getDistanceToSegment, getFacingFromDirection, rotateDirection, scaleDamage } from './weaponSkill'

describe('weapon skill geometry', () => {
  it('measures distance to the nearest point of a segment', () => {
    const from = { x: 0, y: 0 }
    const to = { x: 10, y: 0 }

    expect(getDistanceToSegment({ x: 5, y: 3 }, from, to)).toBe(3)
    expect(getDistanceToSegment({ x: -4, y: 3 }, from, to)).toBe(5)
    expect(getDistanceToSegment({ x: 13, y: 4 }, from, to)).toBe(5)
  })

  it('rotates a facing direction and maps it back to a facing', () => {
    const up = rotateDirection({ x: 1, y: 0 }, -Math.PI / 2)

    expect(getFacingFromDirection(up)).toBe('up')
    expect(getFacingFromDirection({ x: -1, y: 0.2 })).toBe('left')
  })

  it('never scales damage below 1', () => {
    expect(scaleDamage(10, 0.5)).toBe(5)
    expect(scaleDamage(1, 0.1)).toBe(1)
  })
})
