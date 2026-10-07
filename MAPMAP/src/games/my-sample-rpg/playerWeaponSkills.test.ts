import { describe, expect, it } from 'vitest'

import { createInitialPlayerProfile } from './playerProfile'
import { spendPlayerSkillPoint } from './playerProgression'
import {
  PLAYER_BOW_SKILL_IDS,
  PLAYER_MAGIC_SKILL_IDS,
  PLAYER_SKILL_IDS_IN_DISPLAY_ORDER,
  getPlayerSkillProfileIndex,
  getPlayerSkillRequiredLevel,
  getPlayerSkillWeaponLine
} from './playerSkills'
import { PLAYER_SMASH_SKILL_ID } from './playerSmashSkill'
import { PLAYER_WEAPON_SKILL_DEFINITIONS, type PlayerSkillChapter } from './playerWeaponSkills'

const getChapter = (skillId: string): PlayerSkillChapter =>
  PLAYER_WEAPON_SKILL_DEFINITIONS.find((definition) => definition.id === skillId)?.chapter ?? 1

describe('weapon skills through chapter 3', () => {
  it('gives every weapon line at least one skill per chapter', () => {
    const skillIds = [
      PLAYER_SMASH_SKILL_ID,
      ...PLAYER_MAGIC_SKILL_IDS,
      ...PLAYER_BOW_SKILL_IDS,
      ...PLAYER_WEAPON_SKILL_DEFINITIONS.map((definition) => definition.id)
    ]

    for (const weaponLine of ['sword', 'axe', 'bow', 'staff']) {
      const chapters = new Set(
        skillIds.filter((skillId) => getPlayerSkillWeaponLine(skillId) === weaponLine).map(getChapter)
      )
      expect([...chapters].sort(), weaponLine).toEqual([1, 2, 3])
    }
  })

  it('makes later chapter skills stronger and more expensive at every skill level', () => {
    const byChapter = (chapter: PlayerSkillChapter) =>
      PLAYER_WEAPON_SKILL_DEFINITIONS.filter((definition) => definition.chapter === chapter)

    for (const [weaker, stronger] of [[1, 2], [2, 3]] as const) {
      for (const low of byChapter(weaker)) {
        for (const high of byChapter(stronger)) {
          low.table.power.forEach((power, index) => {
            expect(high.table.power[index]).toBeGreaterThan(power)
            expect(high.table.mana[index]).toBeGreaterThan(low.table.mana[index])
          })
          expect(high.cooldownMilliseconds).toBeGreaterThanOrEqual(low.cooldownMilliseconds)
        }
      }
    }
  })

  it('unlocks chapter 2 skills at level 15 and chapter 3 skills at level 38', () => {
    expect(getPlayerSkillRequiredLevel('whirlwind')).toBe(1)
    expect(getPlayerSkillRequiredLevel('ground-splitter')).toBe(15)
    expect(getPlayerSkillRequiredLevel('execute')).toBe(38)
    expect(getPlayerSkillRequiredLevel(PLAYER_SMASH_SKILL_ID)).toBe(1)
  })

  it('refuses to spend a skill point below the unlock level', () => {
    const skillIndex = getPlayerSkillProfileIndex('ground-splitter') ?? -1
    const profile = { ...createInitialPlayerProfile(), availableSkillPoints: 3 }

    expect(spendPlayerSkillPoint({ ...profile, level: 14 }, skillIndex)).toBeUndefined()
    expect(spendPlayerSkillPoint({ ...profile, level: 15 }, skillIndex)?.skills[skillIndex].level).toBe(1)
  })

  it('lists every profile skill once in the skill window order', () => {
    expect(PLAYER_SKILL_IDS_IN_DISPLAY_ORDER).toHaveLength(createInitialPlayerProfile().skills.length)
    expect(new Set(PLAYER_SKILL_IDS_IN_DISPLAY_ORDER).size).toBe(PLAYER_SKILL_IDS_IN_DISPLAY_ORDER.length)
  })

  it('keeps smash as the sword chapter 1 skill', () => {
    expect(getPlayerSkillWeaponLine(PLAYER_SMASH_SKILL_ID)).toBe('sword')
    expect(getPlayerSkillWeaponLine('protect')).toBeUndefined()
  })
})
