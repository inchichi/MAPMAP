import {
  PLAYER_MAX_LEVEL,
  type PlayerProfile,
  type PlayerSkillSlot,
  type PlayerStatId
} from './playerProfile'
import { getPlayerSkillRequiredLevelByProfileIndex } from './playerSkills'
import {
  PLAYER_BASE_INTELLIGENCE_STAT,
  PLAYER_INTELLIGENCE_MP_BONUS_PER_POINT,
  getPlayerStatMaxUsefulValue
} from './playerStatEffects'

// 성장 수치의 근거와 장별 기대치는 docs/game-balance.md 에 둔다.
export const PLAYER_LEVEL_UP_STAT_POINTS = 3
export const PLAYER_LEVEL_UP_HP_BONUS = 4
// 스킬 포인트는 레벨업으로만 얻는다 — 처치마다 주면 사냥량에 따라 모든 스킬이 금방 최대가 된다.
export const PLAYER_LEVEL_UP_SKILL_POINTS = 2
export const PLAYER_BASE_MAX_HEALTH = 24
export const PLAYER_BASE_MAX_MANA = 12
export const PLAYER_LEVEL_UP_MP_BONUS = 3

export const grantPlayerLevelUpRewards = (
  profile: PlayerProfile,
  levels = 1
): PlayerProfile => {
  const nextLevels = Math.max(0, Math.floor(levels))
  const appliedLevels = Math.min(
    nextLevels,
    Math.max(0, PLAYER_MAX_LEVEL - profile.level)
  )

  if (appliedLevels === 0) {
    return profile
  }

  const nextHpMax = profile.hp.max + appliedLevels * PLAYER_LEVEL_UP_HP_BONUS
  const nextMpMax = profile.mp.max + appliedLevels * PLAYER_LEVEL_UP_MP_BONUS
  const gainedSkillPoints = appliedLevels * PLAYER_LEVEL_UP_SKILL_POINTS

  return {
    ...profile,
    level: profile.level + appliedLevels,
    statPoints: profile.statPoints + appliedLevels * PLAYER_LEVEL_UP_STAT_POINTS,
    availableSkillPoints: profile.availableSkillPoints + gainedSkillPoints,
    totalSkillPointsEarned: profile.totalSkillPointsEarned + gainedSkillPoints,
    hp: {
      current: nextHpMax,
      max: nextHpMax
    },
    mp: {
      current: nextMpMax,
      max: nextMpMax
    }
  }
}

export const spendPlayerStatPoint = (
  profile: PlayerProfile,
  statId: PlayerStatId
): PlayerProfile | undefined => {
  if (profile.statPoints <= 0) {
    return undefined
  }

  // 효과가 상한에 닿은 스탯(민첩 이동 속도, 행운 회피율)에는 더 찍지 못한다.
  if (profile.stats[statId] >= getPlayerStatMaxUsefulValue(statId)) {
    return undefined
  }

  const nextProfile = {
    ...profile,
    stats: {
      ...profile.stats,
      [statId]: profile.stats[statId] + 1
    }
  }

  return {
    ...nextProfile,
    statPoints: profile.statPoints - 1,
    mp:
      statId === 'intelligence'
        ? syncPlayerManaFromStats(nextProfile).mp
        : profile.mp
  }
}

export const spendPlayerSkillPoint = (
  profile: PlayerProfile,
  skillIndex: number
): PlayerProfile | undefined => {
  const skill = profile.skills[skillIndex]

  if (!skill) {
    return undefined
  }

  const skillPointCost = getPlayerSkillPointCost(skill)

  if (skillPointCost <= 0 || profile.availableSkillPoints < skillPointCost) {
    return undefined
  }

  // 2·3장 무기 스킬은 그 장의 레벨대가 되어야 배운다.
  if (profile.level < getPlayerSkillRequiredLevelByProfileIndex(skillIndex)) {
    return undefined
  }

  const nextSkills = profile.skills.map((currentSkill, currentIndex) =>
    currentIndex === skillIndex
      ? {
          ...currentSkill,
          level: currentSkill.level + 1
        }
      : currentSkill
  )

  return {
    ...profile,
    availableSkillPoints: profile.availableSkillPoints - skillPointCost,
    skills: nextSkills
  }
}

export const getPlayerSkillPointCost = (
  skill: PlayerSkillSlot
): number => {
  if (skill.level >= skill.maxLevel) {
    return 0
  }

  if (skill.level <= 1) {
    return 2
  }

  if (skill.level === 2) {
    return 3
  }

  return 4
}

export const getPlayerSkillLevelLabel = (skill: PlayerSkillSlot): string =>
  skill.level >= skill.maxLevel ? 'MAX' : `${skill.level} / ${skill.maxLevel}`

export const getPlayerSkillUserLevel = (
  totalSkillPointsEarned: number
): number => Math.max(1, Math.floor(totalSkillPointsEarned) + 1)

// 최대 마나 = 기본 + 레벨당 + 지력 보너스. 레벨업(grantPlayerLevelUpRewards)도 같은 값을 쌓는다.
export const getPlayerMaxManaForProfile = (
  profile: Pick<PlayerProfile, 'level' | 'stats'>
): number =>
  PLAYER_BASE_MAX_MANA +
  (Math.max(1, Math.floor(profile.level)) - 1) * PLAYER_LEVEL_UP_MP_BONUS +
  Math.max(0, profile.stats.intelligence - PLAYER_BASE_INTELLIGENCE_STAT) *
    PLAYER_INTELLIGENCE_MP_BONUS_PER_POINT

// 최대 체력 = 시작 체력 + 레벨당. 체력을 올리는 스탯·장비는 없다.
export const getPlayerMaxHealthForLevel = (level: number): number =>
  PLAYER_BASE_MAX_HEALTH +
  (Math.max(1, Math.floor(level)) - 1) * PLAYER_LEVEL_UP_HP_BONUS

const syncPlayerManaFromStats = (
  profile: PlayerProfile
): PlayerProfile => {
  const nextMpMax = getPlayerMaxManaForProfile(profile)

  if (nextMpMax === profile.mp.max) {
    return profile
  }

  const nextMpCurrent = Math.min(
    nextMpMax,
    profile.mp.current + Math.max(0, nextMpMax - profile.mp.max)
  )

  return {
    ...profile,
    mp: {
      current: nextMpCurrent,
      max: nextMpMax
    }
  }
}

// 스킬 0레벨에서 지금 레벨까지 올리는 데 쓴 포인트.
const getPlayerSkillPointsSpent = (skill: PlayerSkillSlot): number => {
  let spent = 0

  for (let level = 0; level < Math.min(skill.level, skill.maxLevel); level += 1) {
    spent += getPlayerSkillPointCost({ ...skill, level })
  }

  return spent
}

// 저장을 불러올 때 성장 규칙이 바뀌기 전의 값(처치마다 받은 스킬 포인트, 그 포인트로 늘어난 최대 마나,
// 옛 레벨당 체력)을 지금 공식으로 맞춘다. 이미 올린 스킬 레벨은 그대로 두고, 남은 포인트만 줄인다.
export const reconcilePlayerProfileWithProgressionRules = (
  profile: PlayerProfile
): PlayerProfile => {
  const hpMax = getPlayerMaxHealthForLevel(profile.level)
  const mpMax = getPlayerMaxManaForProfile(profile)
  const earnedSkillPoints = (Math.max(1, Math.floor(profile.level)) - 1) * PLAYER_LEVEL_UP_SKILL_POINTS
  const spentSkillPoints = profile.skills.reduce(
    (total, skill) => total + getPlayerSkillPointsSpent(skill),
    0
  )

  return {
    ...profile,
    availableSkillPoints: Math.max(0, earnedSkillPoints - spentSkillPoints),
    totalSkillPointsEarned: earnedSkillPoints,
    hp: { current: Math.min(profile.hp.current, hpMax), max: hpMax },
    mp: { current: Math.min(profile.mp.current, mpMax), max: mpMax }
  }
}
