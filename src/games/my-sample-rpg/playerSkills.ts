import { PLAYER_SMASH_SKILL_ID } from './playerSmashSkill'
import type { PlayerProfile } from './playerProfile'

export type PlayerSkillDisplayInfo = {
  label: string
  description: string
  iconUrl?: string
}

export const PLAYER_PROTECT_SKILL_ID = 'protect'
export const PLAYER_DASH_SKILL_ID = 'dash'
export const PLAYER_FOCUS_SKILL_ID = 'focus'
export const PLAYER_SKILL_UNLOCK_LEVEL = 1

const PLAYER_SKILL_PROFILE_INDEX_BY_ID: Record<string, number> = {
  [PLAYER_SMASH_SKILL_ID]: 0,
  [PLAYER_PROTECT_SKILL_ID]: 1,
  [PLAYER_DASH_SKILL_ID]: 2,
  [PLAYER_FOCUS_SKILL_ID]: 3
}

const PLAYER_SMASH_SKILL_MANA_COST_BY_LEVEL: Record<number, number> = {
  1: 4,
  2: 5,
  3: 6,
  4: 7,
  5: 8
}

const PLAYER_SMASH_SKILL_DAMAGE_BY_LEVEL: Record<number, number> = {
  1: 10,
  2: 14,
  3: 18,
  4: 23,
  5: 28
}

const PLAYER_PROTECT_SKILL_DURATION_BY_LEVEL: Record<number, number> = {
  1: 1800,
  2: 2200,
  3: 2600,
  4: 3000,
  5: 3400
}

const PLAYER_SMASH_SKILL_ICON_URL = new URL(
  './assets/skills/Slash_skill.png',
  import.meta.url
).href
const PLAYER_PROTECT_SKILL_ICON_URL = new URL(
  './assets/skills/Protect_skill.png',
  import.meta.url
).href

// 집중: 레벨당 회복량 증가. 돌진: 구르기 돌격 + 도착 즉시 공격.
export const getPlayerFocusSkillManaRestoreByLevel = (
  skillLevel: number
): number => 4 + Math.max(1, Math.floor(skillLevel)) * 2

const PLAYER_SKILL_DISPLAY_INFO_BY_ID: Record<string, PlayerSkillDisplayInfo> = {
  [PLAYER_SMASH_SKILL_ID]: {
    label: '스매시',
    description: '직선으로 뻗는 검 잔상 스킬',
    iconUrl: PLAYER_SMASH_SKILL_ICON_URL
  },
  [PLAYER_PROTECT_SKILL_ID]: {
    label: '방어 자세',
    description: '레벨이 오를수록 더 오래 유지되는 방어 스킬',
    iconUrl: PLAYER_PROTECT_SKILL_ICON_URL
  },
  [PLAYER_DASH_SKILL_ID]: {
    label: '돌진',
    description: '앞으로 굴러 돌격하고, 도착하자마자 베어낸다',
    iconUrl: PLAYER_SMASH_SKILL_ICON_URL
  },
  [PLAYER_FOCUS_SKILL_ID]: {
    label: '집중',
    description: '호흡을 가다듬어 마나를 회복한다 (레벨당 회복량 증가)',
    iconUrl: PLAYER_PROTECT_SKILL_ICON_URL
  }
}

export const getPlayerSkillDisplayInfoById = (
  skillId: string
): PlayerSkillDisplayInfo => {
  const displayInfo = PLAYER_SKILL_DISPLAY_INFO_BY_ID[skillId]

  return (
    displayInfo ?? {
      label: skillId,
      description: '',
      iconUrl: undefined
    }
  )
}

export const isPlayerSkillUnlockedInProfile = (
  profile: Pick<PlayerProfile, 'skills'>,
  skillId: string
): boolean => {
  const profileSkillIndex = PLAYER_SKILL_PROFILE_INDEX_BY_ID[skillId]

  if (profileSkillIndex === undefined) {
    return false
  }

  const profileSkill = profile.skills[profileSkillIndex]

  return Boolean(
    profileSkill && profileSkill.level >= PLAYER_SKILL_UNLOCK_LEVEL
  )
}

export const getPlayerSkillDamageById = (
  profile: Pick<PlayerProfile, 'skills'>,
  skillId: string
): number => {
  const skillLevel = getPlayerSkillLevelById(profile, skillId)

  if (skillLevel === undefined) {
    return 0
  }

  if (skillId !== PLAYER_SMASH_SKILL_ID) {
    return 0
  }

  return getPlayerSmashSkillDamageByLevel(skillLevel)
}

export const getPlayerSkillDamageBonusById = (
  profile: Pick<PlayerProfile, 'skills'>,
  skillId: string
): number => getPlayerSkillDamageById(profile, skillId)

export const getPlayerSkillManaCostById = (
  profile: Pick<PlayerProfile, 'skills'>,
  skillId: string
): number => {
  const skillLevel = getPlayerSkillLevelById(profile, skillId)

  if (skillLevel === undefined) {
    return 0
  }

  if (skillId === PLAYER_SMASH_SKILL_ID) {
    return getPlayerSmashSkillManaCostByLevel(skillLevel)
  }

  if (skillId === PLAYER_PROTECT_SKILL_ID) {
    return 2
  }

  if (skillId === PLAYER_DASH_SKILL_ID) {
    return 3
  }

  return 0
}

export const getPlayerSkillLevelById = (
  profile: Pick<PlayerProfile, 'skills'>,
  skillId: string
): number | undefined => {
  const profileSkillIndex = PLAYER_SKILL_PROFILE_INDEX_BY_ID[skillId]

  if (profileSkillIndex === undefined) {
    return undefined
  }

  const profileSkill = profile.skills[profileSkillIndex]

  return profileSkill ? Math.min(profileSkill.level, profileSkill.maxLevel) : undefined
}

export const getPlayerProtectSkillDurationByLevel = (
  skillLevel: number
): number => {
  const normalizedLevel = Math.max(1, Math.floor(skillLevel))

  return (
    PLAYER_PROTECT_SKILL_DURATION_BY_LEVEL[normalizedLevel] ??
    PLAYER_PROTECT_SKILL_DURATION_BY_LEVEL[5] +
      (normalizedLevel - 5) * 400
  )
}

const getPlayerSmashSkillManaCostByLevel = (skillLevel: number): number => {
  const normalizedLevel = Math.max(1, Math.floor(skillLevel))

  return (
    PLAYER_SMASH_SKILL_MANA_COST_BY_LEVEL[normalizedLevel] ??
    PLAYER_SMASH_SKILL_MANA_COST_BY_LEVEL[5] +
      (normalizedLevel - 5)
  )
}

const getPlayerSmashSkillDamageByLevel = (skillLevel: number): number => {
  const normalizedLevel = Math.max(1, Math.floor(skillLevel))

  return (
    PLAYER_SMASH_SKILL_DAMAGE_BY_LEVEL[normalizedLevel] ??
    PLAYER_SMASH_SKILL_DAMAGE_BY_LEVEL[5] +
      (normalizedLevel - 5) * 5
  )
}
