// 무기 계열 스킬(2~3장 확장분과 근접 무기 1장 스킬). 직업이 없는 게임이라 장착한 무기 계열이 쓸 수 있는 스킬을 정한다.
// 장(chapter)마다 무기 계열당 하나씩 열리고, 늦게 열리는 스킬일수록 강하다(위력·MP·재사용 대기 모두 큼).
// 1장 기존 스킬(스매시·마법 3종·활 3종)은 playerSkills.ts 에 그대로 있다. 맵 화면 동작은 rendering/mapView/playerWeaponSkills.ts.
import type { PlayerWeaponLine } from './playerEquipment'

export type PlayerSkillChapter = 1 | 2 | 3

// 장별 해금 레벨: 각 장에 들어서는 레벨대(1장 Lv1~, 2장 Lv15~, 3장 Lv38~).
export const PLAYER_SKILL_REQUIRED_LEVEL_BY_CHAPTER: Record<PlayerSkillChapter, number> = {
  1: 1,
  2: 15,
  3: 38
}

export type PlayerSkillPowerTable = {
  mana: readonly number[]
  power: readonly number[]
  powerStep: number
}

// 장별 기준 표(스킬 레벨 1~5). 5레벨 이후는 레벨당 MP +1, 위력 +powerStep.
const CHAPTER_1_TABLE: PlayerSkillPowerTable = { mana: [4, 5, 6, 7, 8], power: [10, 14, 18, 23, 28], powerStep: 5 }
const CHAPTER_2_TABLE: PlayerSkillPowerTable = { mana: [9, 10, 11, 12, 13], power: [24, 30, 37, 45, 54], powerStep: 9 }
const CHAPTER_3_TABLE: PlayerSkillPowerTable = { mana: [15, 16, 18, 20, 22], power: [48, 60, 74, 90, 108], powerStep: 18 }

export type PlayerWeaponSkillDefinition = {
  id: string
  weaponLine: PlayerWeaponLine
  chapter: PlayerSkillChapter
  label: string
  description: string
  iconFileName: string
  cooldownMilliseconds: number
  table: PlayerSkillPowerTable
}

// 순서 = 스킬 창 표시 순서이자 profile.skills 뒤에 붙는 순서(바꾸면 저장본 인덱스가 어긋난다. 새 스킬은 맨 뒤에).
export const PLAYER_WEAPON_SKILL_DEFINITIONS: readonly PlayerWeaponSkillDefinition[] = [
  {
    id: 'cross-slash', weaponLine: 'sword', chapter: 2, label: '십자 베기',
    description: '네 방향으로 검기를 날려 둘러싼 적을 모두 벤다',
    iconFileName: 'cross-slash', cooldownMilliseconds: 6000, table: CHAPTER_2_TABLE
  },
  {
    id: 'flash-strike', weaponLine: 'sword', chapter: 3, label: '섬광 일섬',
    description: '빛처럼 4칸을 꿰뚫고 지나가며 길 위의 적을 두 번 벤다. 지나가는 동안 피해를 받지 않는다',
    iconFileName: 'flash-strike', cooldownMilliseconds: 10000, table: CHAPTER_3_TABLE
  },
  {
    id: 'whirlwind', weaponLine: 'axe', chapter: 1, label: '회오리 베기',
    description: '도끼를 휘감아 둘레의 적을 세 번 벤다. 둘러싸였을 때 가장 강하다',
    iconFileName: 'whirlwind', cooldownMilliseconds: 4500, table: CHAPTER_1_TABLE
  },
  {
    id: 'ground-splitter', weaponLine: 'axe', chapter: 2, label: '대지 가르기',
    description: '땅을 내리찍어 5칸 앞까지 갈라지는 충격으로 줄지은 적을 베고 밀어낸다',
    iconFileName: 'ground-splitter', cooldownMilliseconds: 6500, table: CHAPTER_2_TABLE
  },
  {
    id: 'execute', weaponLine: 'axe', chapter: 3, label: '처형',
    description: '앞의 적들을 크게 내리찍는다. 체력이 30% 아래인 적에게는 두 배 피해',
    iconFileName: 'execute', cooldownMilliseconds: 10000, table: CHAPTER_3_TABLE
  },
  {
    id: 'arrow-rain', weaponLine: 'bow', chapter: 2, label: '화살비',
    description: '가장 가까운 적 둘레에 화살비를 네 번 쏟아붓는다',
    iconFileName: 'arrow-rain', cooldownMilliseconds: 7000, table: CHAPTER_2_TABLE
  },
  {
    id: 'storm-arrows', weaponLine: 'bow', chapter: 3, label: '폭풍 화살',
    description: '부채꼴로 화살 다섯 발을 쏘아 8칸 안 줄지은 적들을 모두 꿰뚫는다',
    iconFileName: 'storm-arrows', cooldownMilliseconds: 11000, table: CHAPTER_3_TABLE
  },
  {
    id: 'blizzard', weaponLine: 'staff', chapter: 2, label: '눈보라',
    description: '가장 가까운 적 둘레에 눈보라를 일으켜 네 번 때리고 얼린다',
    iconFileName: 'blizzard', cooldownMilliseconds: 8000, table: CHAPTER_2_TABLE
  },
  {
    id: 'meteor', weaponLine: 'staff', chapter: 3, label: '메테오',
    description: '잠시 뒤 거대한 운석을 떨어뜨려 넓은 범위를 불태운다',
    iconFileName: 'meteor', cooldownMilliseconds: 12000, table: CHAPTER_3_TABLE
  }
]

const PLAYER_WEAPON_SKILL_DEFINITION_BY_ID: ReadonlyMap<string, PlayerWeaponSkillDefinition> = new Map(
  PLAYER_WEAPON_SKILL_DEFINITIONS.map((definition) => [definition.id, definition])
)

export const getPlayerWeaponSkillDefinition = (
  skillId: string
): PlayerWeaponSkillDefinition | undefined => PLAYER_WEAPON_SKILL_DEFINITION_BY_ID.get(skillId)

export const getPlayerWeaponSkillRequiredLevel = (definition: PlayerWeaponSkillDefinition): number =>
  PLAYER_SKILL_REQUIRED_LEVEL_BY_CHAPTER[definition.chapter]

export const PLAYER_WEAPON_LINE_LABEL: Record<PlayerWeaponLine, string> = {
  sword: '검',
  axe: '도끼',
  bow: '활',
  staff: '지팡이'
}
