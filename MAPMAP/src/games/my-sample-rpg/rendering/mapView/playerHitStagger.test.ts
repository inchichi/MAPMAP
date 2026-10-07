import { describe, expect, it } from 'vitest'

import {
  PLAYER_HIT_STAGGER_MILLISECONDS,
  getPlayerHitKnockbackProgress,
  getPlayerInvulnerableBlinkAlpha
} from './playerHitStagger'

describe('playerHitStagger', () => {
  it('pushes fast at first and settles smoothly by the end of the stagger', () => {
    expect(getPlayerHitKnockbackProgress(0)).toBe(0)
    expect(getPlayerHitKnockbackProgress(PLAYER_HIT_STAGGER_MILLISECONDS / 3)).toBeGreaterThan(0.6)
    expect(getPlayerHitKnockbackProgress(PLAYER_HIT_STAGGER_MILLISECONDS)).toBe(1)
    expect(getPlayerHitKnockbackProgress(PLAYER_HIT_STAGGER_MILLISECONDS * 2)).toBe(1)
  })

  it('blinks only while invulnerable', () => {
    const alphas = [0, 90, 180, 270].map((now) => getPlayerInvulnerableBlinkAlpha(now, 600))

    expect(new Set(alphas).size).toBe(2)
    expect(getPlayerInvulnerableBlinkAlpha(700, 600)).toBe(1)
  })
})
