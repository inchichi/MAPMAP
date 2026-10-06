import { describe, expect, it } from 'vitest'

import { isWithinSwingArc } from './swingArc'

describe('isWithinSwingArc', () => {
  it('hits what is in front and misses what is behind', () => {
    expect(isWithinSwingArc(5, 5, 'down', 5, 6, 1.5)).toBe(true)
    expect(isWithinSwingArc(5, 5, 'down', 5, 4, 1.5)).toBe(false)
    expect(isWithinSwingArc(5, 5, 'up', 5, 4, 1.5)).toBe(true)
    expect(isWithinSwingArc(5, 5, 'up', 5, 6, 1.5)).toBe(false)
    expect(isWithinSwingArc(5, 5, 'left', 3.8, 5, 1.5)).toBe(true)
    expect(isWithinSwingArc(5, 5, 'left', 6.2, 5, 1.5)).toBe(false)
    expect(isWithinSwingArc(5, 5, 'right', 6.2, 5, 1.5)).toBe(true)
    expect(isWithinSwingArc(5, 5, 'right', 3.8, 5, 1.5)).toBe(false)
  })

  it('misses a target beside the swing, and includes the 45 degree edge', () => {
    expect(isWithinSwingArc(5, 5, 'down', 6.4, 5, 1.5)).toBe(false)
    expect(isWithinSwingArc(5, 5, 'down', 5.7, 5.7, 1.5)).toBe(true)
    expect(isWithinSwingArc(5, 5, 'down', 5.7, 5.6, 1.5)).toBe(false)
  })

  it('respects reach', () => {
    expect(isWithinSwingArc(5, 5, 'down', 5, 6.4, 1.5)).toBe(true)
    expect(isWithinSwingArc(5, 5, 'down', 5, 6.6, 1.5)).toBe(false)
  })

  it('hits a target standing on top of the attacker', () => {
    expect(isWithinSwingArc(5, 5, 'left', 5, 5, 1.5)).toBe(true)
  })
})
