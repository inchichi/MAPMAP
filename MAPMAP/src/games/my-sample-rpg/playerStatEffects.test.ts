import { describe, expect, it } from 'vitest'

import { createInitialPlayerProfile } from './playerProfile'
import {
  getPlayerEvadeChance,
  getPlayerMagicAttackPower,
  getPlayerMovementSpeedTilesPerSecond,
  getPlayerPhysicalAttackPower,
  shouldPlayerEvadeDamage
} from './playerStatEffects'

describe('getPlayerPhysicalAttackPower', () => {
  it('uses strength as the physical damage base', () => {
    expect(getPlayerPhysicalAttackPower(createInitialPlayerProfile())).toBe(5)
  })
})

describe('getPlayerMagicAttackPower', () => {
  it('uses intelligence as the magic damage base', () => {
    expect(getPlayerMagicAttackPower(createInitialPlayerProfile())).toBe(3)
  })

  it('goes up as intelligence goes up, independent of strength', () => {
    const profile = createInitialPlayerProfile()
    const smarterProfile = {
      ...profile,
      stats: { ...profile.stats, intelligence: profile.stats.intelligence + 4 }
    }
    const strongerProfile = {
      ...profile,
      stats: { ...profile.stats, strength: profile.stats.strength + 4 }
    }

    expect(getPlayerMagicAttackPower(smarterProfile)).toBe(
      getPlayerMagicAttackPower(profile) + 4
    )
    expect(getPlayerMagicAttackPower(strongerProfile)).toBe(
      getPlayerMagicAttackPower(profile)
    )
  })
})

describe('getPlayerMovementSpeedTilesPerSecond', () => {
  it('gets faster when agility goes up', () => {
    const profile = createInitialPlayerProfile()
    const fasterProfile = {
      ...profile,
      stats: {
        ...profile.stats,
        agility: profile.stats.agility + 2
      }
    }

    expect(getPlayerMovementSpeedTilesPerSecond(fasterProfile)).toBeGreaterThan(
      getPlayerMovementSpeedTilesPerSecond(profile)
    )
  })
})

describe('getPlayerEvadeChance', () => {
  it('gets higher when luck goes up', () => {
    const profile = createInitialPlayerProfile()
    const luckierProfile = {
      ...profile,
      stats: {
        ...profile.stats,
        luck: profile.stats.luck + 5
      }
    }

    expect(getPlayerEvadeChance(luckierProfile)).toBeGreaterThan(
      getPlayerEvadeChance(profile)
    )
  })
})

describe('shouldPlayerEvadeDamage', () => {
  it('uses the provided random value', () => {
    const profile = createInitialPlayerProfile()

    expect(shouldPlayerEvadeDamage(profile, 0)).toBe(true)
    expect(shouldPlayerEvadeDamage(profile, 1)).toBe(false)
  })
})
