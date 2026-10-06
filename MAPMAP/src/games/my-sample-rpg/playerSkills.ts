import { PLAYER_SMASH_SKILL_ID } from './playerSmashSkill'
import type { PlayerProfile } from './playerProfile'
import type { PlayerWeaponLine } from './playerEquipment'
import {
  PLAYER_WEAPON_LINE_LABEL,
  PLAYER_WEAPON_SKILL_DEFINITIONS,
  getPlayerWeaponSkillDefinition,
  getPlayerWeaponSkillRequiredLevel
} from './playerWeaponSkills'

export type PlayerSkillDisplayInfo = {
  label: string
  description: string
  iconUrl?: string
}

export const PLAYER_PROTECT_SKILL_ID = 'protect'
export const PLAYER_DASH_SKILL_ID = 'dash'
export const PLAYER_FOCUS_SKILL_ID = 'focus'
// 마법 스킬 — 마법 무기를 장착해야 쓸 수 있다(부가 효과 수치는 playerMagicSkills.ts).
export const PLAYER_ICE_BOLT_SKILL_ID = 'ice-bolt'
export const PLAYER_FIREBALL_SKILL_ID = 'fireball'
export const PLAYER_CHAIN_LIGHTNING_SKILL_ID = 'chain-lightning'
export const PLAYER_MAGIC_SKILL_IDS: readonly string[] = [
  PLAYER_ICE_BOLT_SKILL_ID,
  PLAYER_FIREBALL_SKILL_ID,
  PLAYER_CHAIN_LIGHTNING_SKILL_ID
]
// 활 스킬 — 활을 장착해야 쓸 수 있다(부가 규칙은 playerBowSkills.ts).
export const PLAYER_MULTI_SHOT_SKILL_ID = 'multi-shot'
export const PLAYER_PIERCING_ARROW_SKILL_ID = 'piercing-arrow'
export const PLAYER_POISON_ARROW_SKILL_ID = 'poison-arrow'
export const PLAYER_BOW_SKILL_IDS: readonly string[] = [
  PLAYER_MULTI_SHOT_SKILL_ID,
  PLAYER_PIERCING_ARROW_SKILL_ID,
  PLAYER_POISON_ARROW_SKILL_ID
]
export const PLAYER_SKILL_UNLOCK_LEVEL = 1

const PLAYER_SKILL_PROFILE_INDEX_BY_ID: Record<string, number> = {
  [PLAYER_SMASH_SKILL_ID]: 0,
  [PLAYER_PROTECT_SKILL_ID]: 1,
  [PLAYER_DASH_SKILL_ID]: 2,
  [PLAYER_FOCUS_SKILL_ID]: 3,
  [PLAYER_ICE_BOLT_SKILL_ID]: 4,
  [PLAYER_FIREBALL_SKILL_ID]: 5,
  [PLAYER_CHAIN_LIGHTNING_SKILL_ID]: 6,
  [PLAYER_MULTI_SHOT_SKILL_ID]: 7,
  [PLAYER_PIERCING_ARROW_SKILL_ID]: 8,
  [PLAYER_POISON_ARROW_SKILL_ID]: 9,
  // 무기 계열 스킬은 그 뒤에 정의 순서대로(10~)
  ...Object.fromEntries(
    PLAYER_WEAPON_SKILL_DEFINITIONS.map((definition, index) => [definition.id, 10 + index])
  )
}

// 무기 스킬(마법·활·무기 계열 스킬)의 레벨별 MP 와 자체 위력. 최종 데미지 = (마법·지팡이: 지력 마법 공격력 /
// 그 밖: 힘 물리 공격력) + 위력 + 그 무기 보너스.
// 5레벨 이후는 마지막 값에서 레벨당 (MP +1, 위력 +step) 씩 오른다.
const PLAYER_MAGIC_SKILL_TABLE: Record<
  string,
  { mana: readonly number[]; power: readonly number[]; powerStep: number }
> = {
  [PLAYER_ICE_BOLT_SKILL_ID]: { mana: [4, 4, 5, 5, 6], power: [3, 5, 7, 9, 11], powerStep: 2 },
  [PLAYER_FIREBALL_SKILL_ID]: { mana: [6, 7, 8, 9, 10], power: [8, 11, 14, 18, 22], powerStep: 4 },
  [PLAYER_CHAIN_LIGHTNING_SKILL_ID]: {
    mana: [7, 8, 9, 10, 11],
    power: [6, 8, 10, 13, 16],
    powerStep: 3
  },
  [PLAYER_MULTI_SHOT_SKILL_ID]: { mana: [3, 3, 4, 4, 5], power: [2, 3, 4, 5, 6], powerStep: 1 },
  [PLAYER_PIERCING_ARROW_SKILL_ID]: { mana: [4, 5, 5, 6, 7], power: [6, 9, 12, 15, 18], powerStep: 3 },
  [PLAYER_POISON_ARROW_SKILL_ID]: { mana: [3, 4, 4, 5, 5], power: [2, 3, 4, 5, 6], powerStep: 1 },
  ...Object.fromEntries(
    PLAYER_WEAPON_SKILL_DEFINITIONS.map((definition) => [definition.id, definition.table])
  )
}

const getMagicSkillTableValue = (
  values: readonly number[],
  skillLevel: number,
  step: number
): number => {
  const normalizedLevel = Math.max(1, Math.floor(skillLevel))

  return normalizedLevel <= values.length
    ? values[normalizedLevel - 1]
    : values[values.length - 1] + (normalizedLevel - values.length) * step
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
export const PLAYER_ENERGY_BOLT_ICON_URL = new URL(
  './assets/skills/Energy_bolt_skill.png',
  import.meta.url
).href
const PLAYER_DASH_SKILL_ICON_URL = new URL('./assets/skills/Dash_skill.png', import.meta.url).href
const PLAYER_FOCUS_SKILL_ICON_URL = new URL('./assets/skills/Focus_skill.png', import.meta.url).href
const PLAYER_ICE_BOLT_SKILL_ICON_URL = new URL(
  './assets/skills/Ice_bolt_skill.png',
  import.meta.url
).href
const PLAYER_FIREBALL_SKILL_ICON_URL = new URL(
  './assets/skills/Fireball_skill.png',
  import.meta.url
).href
const PLAYER_CHAIN_LIGHTNING_SKILL_ICON_URL = new URL(
  './assets/skills/Chain_lightning_skill.png',
  import.meta.url
).href
const PLAYER_MULTI_SHOT_SKILL_ICON_URL = new URL(
  './assets/skills/Multi_shot_skill.png',
  import.meta.url
).href
const PLAYER_PIERCING_ARROW_SKILL_ICON_URL = new URL(
  './assets/skills/Piercing_arrow_skill.png',
  import.meta.url
).href
const PLAYER_POISON_ARROW_SKILL_ICON_URL = new URL(
  './assets/skills/Poison_arrow_skill.png',
  import.meta.url
).href

// 집중: 레벨당 회복량 증가. 돌진: 구르기 돌격 + 도착 즉시 공격.
export const getPlayerFocusSkillManaRestoreByLevel = (
  skillLevel: number
): number => 4 + Math.max(1, Math.floor(skillLevel)) * 2

const PLAYER_SKILL_DISPLAY_INFO_BY_ID: Record<string, PlayerSkillDisplayInfo> = {
  [PLAYER_SMASH_SKILL_ID]: {
    label: '스매시',
    description: '[검 · Lv1] 직선으로 뻗는 검 잔상 스킬',
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
    iconUrl: PLAYER_DASH_SKILL_ICON_URL
  },
  [PLAYER_FOCUS_SKILL_ID]: {
    label: '집중',
    description: '호흡을 가다듬어 마나를 회복한다 (레벨당 회복량 증가)',
    iconUrl: PLAYER_FOCUS_SKILL_ICON_URL
  },
  [PLAYER_ICE_BOLT_SKILL_ID]: {
    label: '아이스 볼트',
    description: '[지팡이 · Lv1] 가장 가까운 적을 쫓는 얼음 화살. 맞은 적을 얼려 움직이지 못하게 한다',
    iconUrl: PLAYER_ICE_BOLT_SKILL_ICON_URL
  },
  [PLAYER_FIREBALL_SKILL_ID]: {
    label: '파이어볼',
    description: '[지팡이 · Lv1] 적에게 날아가 터지는 불덩이. 주변 적에게도 피해를 주고 불태운다',
    iconUrl: PLAYER_FIREBALL_SKILL_ICON_URL
  },
  [PLAYER_CHAIN_LIGHTNING_SKILL_ID]: {
    label: '체인 라이트닝',
    description: '[지팡이 · Lv1] 적을 내리친 번개가 가까운 적들에게 차례로 옮겨붙는다',
    iconUrl: PLAYER_CHAIN_LIGHTNING_SKILL_ICON_URL
  },
  [PLAYER_MULTI_SHOT_SKILL_ID]: {
    label: '멀티샷',
    description: '[활 · Lv1] 가까운 적 여러 마리에게 동시에 화살을 날린다',
    iconUrl: PLAYER_MULTI_SHOT_SKILL_ICON_URL
  },
  [PLAYER_PIERCING_ARROW_SKILL_ID]: {
    label: '관통 화살',
    description: '[활 · Lv1] 곧게 날아가며 앞을 막은 적들을 모두 꿰뚫는 강한 화살',
    iconUrl: PLAYER_PIERCING_ARROW_SKILL_ICON_URL
  },
  [PLAYER_POISON_ARROW_SKILL_ID]: {
    label: '독화살',
    description: '[활 · Lv1] 맞은 적을 중독시켜 몇 초 동안 계속 피해를 준다',
    iconUrl: PLAYER_POISON_ARROW_SKILL_ICON_URL
  }
}

// 무기 계열 스킬 아이콘(scripts/generate-weapon-skill-icons.py 가 만든다)
const getPlayerWeaponSkillIconUrl = (iconFileName: string): string =>
  new URL(`./assets/skills/weapon/${iconFileName}.png`, import.meta.url).href

for (const definition of PLAYER_WEAPON_SKILL_DEFINITIONS) {
  PLAYER_SKILL_DISPLAY_INFO_BY_ID[definition.id] = {
    label: definition.label,
    description: `[${PLAYER_WEAPON_LINE_LABEL[definition.weaponLine]} · Lv${getPlayerWeaponSkillRequiredLevel(definition)}] ${definition.description}`,
    iconUrl: getPlayerWeaponSkillIconUrl(definition.iconFileName)
  }
}

// 스킬을 쓰려면 들어야 하는 무기 계열. 방어 자세·돌진·집중은 무기를 가리지 않는다(undefined).
export const getPlayerSkillWeaponLine = (skillId: string): PlayerWeaponLine | undefined => {
  if (skillId === PLAYER_SMASH_SKILL_ID) {
    return 'sword'
  }
  if (PLAYER_MAGIC_SKILL_IDS.includes(skillId)) {
    return 'staff'
  }
  if (PLAYER_BOW_SKILL_IDS.includes(skillId)) {
    return 'bow'
  }
  return getPlayerWeaponSkillDefinition(skillId)?.weaponLine
}

// 스킬을 배울 수 있는 플레이어 레벨. 1장 스킬과 공통 스킬은 1.
export const getPlayerSkillRequiredLevel = (skillId: string): number => {
  const definition = getPlayerWeaponSkillDefinition(skillId)
  return definition ? getPlayerWeaponSkillRequiredLevel(definition) : 1
}

export const getPlayerSkillRequiredLevelByProfileIndex = (profileSkillIndex: number): number => {
  const skillId = Object.keys(PLAYER_SKILL_PROFILE_INDEX_BY_ID).find(
    (id) => PLAYER_SKILL_PROFILE_INDEX_BY_ID[id] === profileSkillIndex
  )
  return skillId ? getPlayerSkillRequiredLevel(skillId) : 1
}

export const getPlayerSkillProfileIndex = (skillId: string): number | undefined =>
  PLAYER_SKILL_PROFILE_INDEX_BY_ID[skillId]

// 스킬 창 표시 순서: 공통 스킬, 그다음 무기 계열마다 해금 레벨 순.
const PLAYER_WEAPON_LINE_DISPLAY_ORDER: readonly PlayerWeaponLine[] = ['sword', 'spear', 'axe', 'mace', 'dagger', 'bow', 'staff']
export const PLAYER_SKILL_IDS_IN_DISPLAY_ORDER: readonly string[] = [
  PLAYER_PROTECT_SKILL_ID,
  PLAYER_DASH_SKILL_ID,
  PLAYER_FOCUS_SKILL_ID,
  ...PLAYER_WEAPON_LINE_DISPLAY_ORDER.flatMap((weaponLine) =>
    Object.keys(PLAYER_SKILL_PROFILE_INDEX_BY_ID)
      .filter((skillId) => getPlayerSkillWeaponLine(skillId) === weaponLine)
      .sort((left, right) => getPlayerSkillRequiredLevel(left) - getPlayerSkillRequiredLevel(right))
  )
]

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

  const magicSkill = PLAYER_MAGIC_SKILL_TABLE[skillId]

  if (magicSkill) {
    return getMagicSkillTableValue(magicSkill.power, skillLevel, magicSkill.powerStep)
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

  const magicSkill = PLAYER_MAGIC_SKILL_TABLE[skillId]

  if (magicSkill) {
    return getMagicSkillTableValue(magicSkill.mana, skillLevel, 1)
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
