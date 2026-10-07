import { describe, expect, it } from 'vitest'

import { createSkillCooldownTracker, formatSkillCooldownSeconds } from './skillCooldowns'

describe('skillCooldowns', () => {
  it('reports remaining time and progress until the cooldown ends', () => {
    const tracker = createSkillCooldownTracker()
    tracker.start('smash', 1000, 4000)

    expect(tracker.get('smash', 1000)).toEqual({ remainingMilliseconds: 4000, progress: 0 })
    expect(tracker.get('smash', 3000)).toEqual({ remainingMilliseconds: 2000, progress: 0.5 })
    expect(tracker.get('smash', 5000)).toBeUndefined()
    expect(tracker.get('protect', 3000)).toBeUndefined()
  })

  it('restarts when the skill is used again', () => {
    const tracker = createSkillCooldownTracker()
    tracker.start('focus', 0, 5000)
    tracker.start('focus', 6000, 5000)

    expect(tracker.get('focus', 7000)?.remainingMilliseconds).toBe(4000)
  })

  it('shows whole seconds, then tenths under one second', () => {
    expect(formatSkillCooldownSeconds(4200)).toBe('5')
    expect(formatSkillCooldownSeconds(1000)).toBe('1')
    expect(formatSkillCooldownSeconds(640)).toBe('0.7')
  })
})
