import { describe, expect, it } from 'vitest'

import {
  BOSS_DAMAGE_MULTIPLIER,
  BOSS_HP_MULTIPLIER,
  spendPlayerStatPoints
} from './balance'
import { createMonsterCombatState } from '../my-sample-rpg/monsterCombat'
import { createInitialPlayerProfile } from '../my-sample-rpg/playerProfile'
import { grantPlayerLevelUpRewards } from '../my-sample-rpg/playerProgression'
import { getPlayerPhysicalAttackPower } from '../my-sample-rpg/playerStatEffects'

const playerAtLevel = (level: number) =>
  spendPlayerStatPoints(grantPlayerLevelUpRewards(createInitialPlayerProfile(), level - 1))

describe('spendPlayerStatPoints', () => {
  it('spends every point and shares them out evenly', () => {
    const profile = playerAtLevel(2)

    expect(profile.statPoints).toBe(0)
    expect(profile.stats).toEqual({
      strength: 6,
      agility: 5,
      intelligence: 3,
      luck: 3
    })
  })

  it('leaves a profile with nothing to spend untouched', () => {
    const profile = createInitialPlayerProfile()

    expect(spendPlayerStatPoints(profile)).toBe(profile)
  })
})

describe('crypt-crawler difficulty curve', () => {
  it('kills same-level trash in three swings at every level', () => {
    for (let level = 1; level <= 30; level += 1) {
      const monster = createMonsterCombatState(level)
      const swings = Math.ceil(monster.maxHp / getPlayerPhysicalAttackPower(playerAtLevel(level)))

      expect(swings).toBe(3)
    }
  })

  it('makes a pack a real threat but a single monster survivable', () => {
    for (let level = 5; level <= 30; level += 1) {
      const player = playerAtLevel(level)
      const { contactDamage } = createMonsterCombatState(level)

      expect((contactDamage * 5) / player.hp.max).toBeGreaterThan(0.3)
      expect(contactDamage / player.hp.max).toBeLessThan(0.15)
    }
  })

  it('gives the boss a fight length trash never reaches', () => {
    const player = playerAtLevel(30)
    const boss = createMonsterCombatState(32, {
      hpMultiplier: BOSS_HP_MULTIPLIER,
      damageMultiplier: BOSS_DAMAGE_MULTIPLIER
    })

    expect(Math.ceil(boss.maxHp / getPlayerPhysicalAttackPower(player))).toBeGreaterThan(20)
    expect(Math.ceil(player.hp.max / boss.contactDamage)).toBeLessThanOrEqual(5)
  })
})
