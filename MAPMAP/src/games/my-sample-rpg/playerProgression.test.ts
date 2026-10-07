import { describe, expect, it } from 'vitest'

import { createInitialPlayerProfile } from './playerProfile'
import {
  getPlayerMaxHealthForLevel,
  getPlayerMaxManaForProfile,
  getPlayerSkillLevelLabel,
  getPlayerSkillPointCost,
  getPlayerSkillUserLevel,
  grantPlayerLevelUpRewards,
  reconcilePlayerProfileWithProgressionRules,
  spendPlayerSkillPoint,
  spendPlayerStatPoint
} from './playerProgression'

describe('grantPlayerLevelUpRewards', () => {
  it('adds level-up rewards for the requested levels', () => {
    expect(grantPlayerLevelUpRewards(createInitialPlayerProfile())).toEqual({
      ...createInitialPlayerProfile(),
      level: 2,
      statPoints: 3,
      availableSkillPoints: 2,
      totalSkillPointsEarned: 2,
      hp: {
        current: 28,
        max: 28
      },
      mp: {
        current: 15,
        max: 15
      }
    })
  })

  it('keeps max hp and mp on the level formulas', () => {
    const profile = grantPlayerLevelUpRewards(createInitialPlayerProfile(), 35)

    expect(profile.hp.max).toBe(getPlayerMaxHealthForLevel(36))
    expect(profile.mp.max).toBe(getPlayerMaxManaForProfile(profile))
  })

  it('does not advance beyond level 100', () => {
    const profile = {
      ...grantPlayerLevelUpRewards(createInitialPlayerProfile(), 99),
      experience: {
        current: 0
      }
    }

    expect(grantPlayerLevelUpRewards(profile, 5)).toEqual(profile)
  })
})

describe('spendPlayerStatPoint', () => {
  it('spends one point and increases the selected stat', () => {
    const profile = grantPlayerLevelUpRewards(createInitialPlayerProfile())

    expect(spendPlayerStatPoint(profile, 'strength')).toEqual({
      ...profile,
      statPoints: 2,
      stats: {
        strength: profile.stats.strength + 1,
        agility: profile.stats.agility,
        intelligence: profile.stats.intelligence,
        luck: profile.stats.luck
      }
    })
  })

  it('returns undefined when no stat points remain', () => {
    expect(
      spendPlayerStatPoint(createInitialPlayerProfile(), 'strength')
    ).toBeUndefined()
  })

  it('refuses agility and luck once their effect is capped', () => {
    const profile = {
      ...grantPlayerLevelUpRewards(createInitialPlayerProfile()),
      stats: { strength: 5, agility: 16, intelligence: 3, luck: 21 }
    }

    expect(spendPlayerStatPoint(profile, 'agility')).toBeUndefined()
    expect(spendPlayerStatPoint(profile, 'luck')).toBeUndefined()
    expect(spendPlayerStatPoint(profile, 'strength')).toBeDefined()
    expect(
      spendPlayerStatPoint({ ...profile, stats: { ...profile.stats, agility: 15 } }, 'agility')
    ).toBeDefined()
  })

  it('increases max mana when intelligence goes up', () => {
    const profile = grantPlayerLevelUpRewards(createInitialPlayerProfile())

    expect(spendPlayerStatPoint(profile, 'intelligence')).toEqual({
      ...profile,
      statPoints: 2,
      stats: {
        strength: profile.stats.strength,
        agility: profile.stats.agility,
        intelligence: profile.stats.intelligence + 1,
        luck: profile.stats.luck
      },
      mp: {
        current: profile.mp.current + 2,
        max: profile.mp.max + 2
      }
    })
  })
})

describe('spendPlayerSkillPoint', () => {
  it('spends the required points and increases the selected skill level', () => {
    const profile = grantPlayerLevelUpRewards(createInitialPlayerProfile())

    expect(spendPlayerSkillPoint(profile, 0)).toEqual({
      ...profile,
      availableSkillPoints: 0,
      skills: [
        {
          ...profile.skills[0],
          level: 1
        },
        ...profile.skills.slice(1)
      ]
    })
  })

  it('returns undefined when the skill is already maxed', () => {
    const profile = grantPlayerLevelUpRewards(createInitialPlayerProfile())
    const maxedProfile = {
      ...profile,
      skills: profile.skills.map((skill, index) =>
        index === 0
          ? {
              ...skill,
              level: skill.maxLevel
            }
          : skill
      )
    }

    expect(spendPlayerSkillPoint(maxedProfile, 0)).toBeUndefined()
  })
})

describe('getPlayerSkillPointCost', () => {
  it('increases the required points as the skill levels up', () => {
    const profile = createInitialPlayerProfile()

    expect(getPlayerSkillPointCost(profile.skills[0])).toBe(2)
    expect(
      getPlayerSkillPointCost({
        ...profile.skills[0],
        level: 2
      })
    ).toBe(3)
    expect(
      getPlayerSkillPointCost({
        ...profile.skills[0],
        level: 3
      })
    ).toBe(4)
    expect(
      getPlayerSkillPointCost({
        ...profile.skills[0],
        level: 4
      })
    ).toBe(4)
    expect(
      getPlayerSkillPointCost({
        ...profile.skills[0],
        level: 5
      })
    ).toBe(0)
  })
})

describe('getPlayerSkillUserLevel', () => {
  it('maps total skill points to the user level without spending penalties', () => {
    expect(getPlayerSkillUserLevel(0)).toBe(1)
    expect(getPlayerSkillUserLevel(1)).toBe(2)
    expect(getPlayerSkillUserLevel(3)).toBe(4)
  })
})

describe('getPlayerMaxManaForProfile', () => {
  it('grows with level and intelligence, not with skill points', () => {
    const profile = createInitialPlayerProfile()

    expect(getPlayerMaxManaForProfile(profile)).toBe(12)
    expect(getPlayerMaxManaForProfile({ ...profile, level: 36 })).toBe(117)
    expect(
      getPlayerMaxManaForProfile({
        ...profile,
        level: 36,
        stats: { ...profile.stats, intelligence: 13 }
      })
    ).toBe(137)
  })
})

describe('getPlayerSkillLevelLabel', () => {
  it('shows MAX when a skill reaches its limit', () => {
    expect(
      getPlayerSkillLevelLabel({
        hotkey: '1',
        label: '베기',
        description: '재빠른 근거리 공격',
        level: 5,
        maxLevel: 5
      })
    ).toBe('MAX')
  })
})

describe('reconcilePlayerProfileWithProgressionRules', () => {
  it('leaves a fresh profile unchanged', () => {
    const profile = createInitialPlayerProfile()

    expect(reconcilePlayerProfileWithProgressionRules(profile)).toEqual(profile)
  })

  it('pulls an old save back to the level formulas and keeps learned skills', () => {
    const fresh = createInitialPlayerProfile()
    const oldSave = {
      ...fresh,
      level: 36,
      availableSkillPoints: 600,
      totalSkillPointsEarned: 640,
      hp: { current: 150, max: 164 },
      mp: { current: 2600, max: 2636 },
      skills: fresh.skills.map((skill, index) => (index === 0 ? { ...skill, level: 5 } : skill))
    }

    expect(reconcilePlayerProfileWithProgressionRules(oldSave)).toEqual({
      ...oldSave,
      availableSkillPoints: 70 - 15,
      totalSkillPointsEarned: 70,
      hp: { current: 150, max: 164 },
      mp: { current: 117, max: 117 }
    })
  })
})
