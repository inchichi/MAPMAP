import { describe, expect, it } from 'vitest'

import {
  getChainLightningHitDamage,
  getChainLightningJumpCount,
  getFireballBurnDamagePerTick,
  getIceBoltFreezeDurationMilliseconds,
  selectChainLightningTargets,
  selectFireballSplashTargets
} from './playerMagicSkills'

describe('playerMagicSkills', () => {
  it('freezes longer and burns harder as the skill levels up', () => {
    expect(getIceBoltFreezeDurationMilliseconds(1)).toBe(1400)
    expect(getIceBoltFreezeDurationMilliseconds(5)).toBe(2600)
    expect(getFireballBurnDamagePerTick(1)).toBe(1)
    expect(getFireballBurnDamagePerTick(4)).toBe(3)
    expect(getChainLightningJumpCount(1)).toBe(2)
    expect(getChainLightningJumpCount(5)).toBe(4)
  })

  it('splashes fireball damage only around the impact, excluding the direct hit', () => {
    const targets = selectFireballSplashTargets({ x: 0, y: 0 }, 'direct', [
      { id: 'direct', x: 0, y: 0 },
      { id: 'near', x: 30, y: 30 },
      { id: 'far', x: 80, y: 0 }
    ])

    expect(targets.map(({ id }) => id)).toEqual(['near'])
  })

  it('chains lightning to the nearest unhit monster each jump and stops when out of range', () => {
    const chain = selectChainLightningTargets({
      first: { id: 'a', x: 0, y: 0 },
      candidates: [
        { id: 'a', x: 0, y: 0 },
        { id: 'c', x: 150, y: 0 },
        { id: 'b', x: 80, y: 0 },
        { id: 'lonely', x: 600, y: 0 }
      ],
      jumpCount: 4
    })

    expect(chain.map(({ id }) => id)).toEqual(['a', 'b', 'c'])
  })

  it('weakens each lightning jump but never below one', () => {
    expect(getChainLightningHitDamage(20, 0)).toBe(20)
    expect(getChainLightningHitDamage(20, 1)).toBe(15)
    expect(getChainLightningHitDamage(1, 3)).toBe(1)
  })
})
