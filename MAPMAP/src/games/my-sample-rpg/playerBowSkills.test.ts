import { describe, expect, it } from 'vitest'

import {
  getMultiShotArrowCount,
  getPoisonDamagePerTick,
  selectMultiShotTargets
} from './playerBowSkills'

describe('playerBowSkills', () => {
  it('fires more arrows and poisons harder as the skill levels up', () => {
    expect(getMultiShotArrowCount(1)).toBe(2)
    expect(getMultiShotArrowCount(5)).toBe(4)
    expect(getPoisonDamagePerTick(1)).toBe(1)
    expect(getPoisonDamagePerTick(5)).toBe(3)
  })

  it('aims multi-shot at the nearest monsters in range', () => {
    const targets = selectMultiShotTargets(
      { x: 0, y: 0 },
      [
        { id: 'far', x: 200, y: 0 },
        { id: 'near', x: 40, y: 0 },
        { id: 'mid', x: 0, y: 100 },
        { id: 'out', x: 500, y: 0 }
      ],
      2,
      224
    )

    expect(targets.map(({ id }) => id)).toEqual(['near', 'mid'])
  })
})
