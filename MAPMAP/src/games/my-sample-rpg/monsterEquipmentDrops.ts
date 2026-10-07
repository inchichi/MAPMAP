// 몬스터 처치 드롭: 장비 → (안 나오면) 포션 → (안 나오면) 골드. 레벨대에 맞는 등급만 나온다.
// 수치 근거와 장별 등급은 docs/game-balance.md.

export type MonsterEquipmentDropDefinition = {
  dropId: string
  itemId: string
  label: string
  kind: 'equipment' | 'potion'
  // 이 드롭이 나오기 시작하는 몬스터 레벨대(MONSTER_*_DROP_BAND_LEVELS 중 하나)
  level: number
}

// 0.9는 장비가 골드보다 흔한 '파이어호스'였다 — 장비 드롭을 귀하게, 골드를 기본으로.
export const MONSTER_EQUIPMENT_DROP_CHANCE = 0.2
// 장비가 안 나왔을 때 포션이 나올 몫(한 번 굴린 값이 [0.2, 0.45) 이면 포션).
export const MONSTER_POTION_DROP_CHANCE = 0.25
// 한 등급 아래가 나올 확률 — 새 지역에서도 지난 등급이 가끔 섞인다.
export const MONSTER_DROP_LOWER_BAND_CHANCE = 0.25
// 등급이 바뀌는 몬스터 레벨: 장비 1등급 / 2장 신전 / 3장 서리, 포션 기본 / 중급 / 상급.
export const MONSTER_EQUIPMENT_DROP_BAND_LEVELS: readonly number[] = [1, 18, 40]
export const MONSTER_POTION_DROP_BAND_LEVELS: readonly number[] = [1, 15, 38]

export const MONSTER_EQUIPMENT_DROP_DEFINITIONS: MonsterEquipmentDropDefinition[] = [
  { dropId: 'iron-sword_drop', itemId: 'iron-sword', label: '강철 검', kind: 'equipment', level: 1 },
  { dropId: 'battle-axe_drop', itemId: 'battle-axe', label: '전투 도끼', kind: 'equipment', level: 1 },
  { dropId: 'magic-staff_drop', itemId: 'magic-staff', label: '마법 지팡이', kind: 'equipment', level: 1 },
  { dropId: 'Leather_Armor_drop', itemId: 'Leather_Armor', label: '가죽 갑옷', kind: 'equipment', level: 1 },
  { dropId: 'Leather_Helmet_drop', itemId: 'Leather_Helmet', label: '가죽 투구', kind: 'equipment', level: 1 },
  { dropId: 'Chain_Armor_drop', itemId: 'Chain_Armor', label: '사슬 갑옷', kind: 'equipment', level: 1 },
  { dropId: 'Chain_Helmet_drop', itemId: 'Chain_Helmet', label: '사슬 투구', kind: 'equipment', level: 1 },
  { dropId: 'Iron_Armor_drop', itemId: 'Iron_Armor', label: '철 갑옷', kind: 'equipment', level: 1 },
  { dropId: 'Iron_Helmet_drop', itemId: 'Iron_Helmet', label: '철 투구', kind: 'equipment', level: 1 },
  { dropId: 'temple-sword_drop', itemId: 'temple-sword', label: '신전 기사의 검', kind: 'equipment', level: 18 },
  { dropId: 'temple-axe_drop', itemId: 'temple-axe', label: '늪지 전투 도끼', kind: 'equipment', level: 18 },
  { dropId: 'temple-bow_drop', itemId: 'temple-bow', label: '갈대 장궁', kind: 'equipment', level: 18 },
  { dropId: 'temple-staff_drop', itemId: 'temple-staff', label: '물안개 지팡이', kind: 'equipment', level: 18 },
  { dropId: 'temple-armor_drop', itemId: 'temple-armor', label: '신전 사슬 갑옷', kind: 'equipment', level: 18 },
  { dropId: 'temple-helmet_drop', itemId: 'temple-helmet', label: '신전 투구', kind: 'equipment', level: 18 },
  { dropId: 'temple-boots_drop', itemId: 'temple-boots', label: '신전 장화', kind: 'equipment', level: 18 },
  { dropId: 'temple-charm_drop', itemId: 'temple-charm', label: '신전 수호 부적', kind: 'equipment', level: 18 },
  { dropId: 'frost-sword_drop', itemId: 'frost-sword', label: '서리 검', kind: 'equipment', level: 40 },
  { dropId: 'frost-axe_drop', itemId: 'frost-axe', label: '서리 도끼', kind: 'equipment', level: 40 },
  { dropId: 'frost-bow_drop', itemId: 'frost-bow', label: '서리 활', kind: 'equipment', level: 40 },
  { dropId: 'frost-staff_drop', itemId: 'frost-staff', label: '서리 지팡이', kind: 'equipment', level: 40 },
  { dropId: 'frost-armor_drop', itemId: 'frost-armor', label: '서리 판금 갑옷', kind: 'equipment', level: 40 },
  { dropId: 'frost-helmet_drop', itemId: 'frost-helmet', label: '서리 투구', kind: 'equipment', level: 40 },
  { dropId: 'frost-boots_drop', itemId: 'frost-boots', label: '서리 장화', kind: 'equipment', level: 40 },
  { dropId: 'frost-charm_drop', itemId: 'frost-charm', label: '서리 목걸이', kind: 'equipment', level: 40 }
]

export const MONSTER_POTION_DROP_DEFINITIONS: MonsterEquipmentDropDefinition[] = [
  { dropId: 'health-potion_drop', itemId: 'health-potion', label: '체력 회복 포션', kind: 'potion', level: 1 },
  { dropId: 'mana-potion_drop', itemId: 'mana-potion', label: '마나 회복 포션', kind: 'potion', level: 1 },
  { dropId: 'health-potion-medium_drop', itemId: 'health-potion-medium', label: '중급 체력 포션', kind: 'potion', level: 15 },
  { dropId: 'mana-potion-medium_drop', itemId: 'mana-potion-medium', label: '중급 마나 포션', kind: 'potion', level: 15 },
  { dropId: 'health-potion-large_drop', itemId: 'health-potion-large', label: '상급 체력 포션', kind: 'potion', level: 38 },
  { dropId: 'mana-potion-large_drop', itemId: 'mana-potion-large', label: '상급 마나 포션', kind: 'potion', level: 38 }
]

// 퀘스트 "아이템 획득" 목표가 특정 장비를 요구할 때, 드롭 품목을 그 장비로 바꾸기 위한 조회.
export const findMonsterEquipmentDropByItemId = (
  itemId: string
): MonsterEquipmentDropDefinition | undefined =>
  MONSTER_EQUIPMENT_DROP_DEFINITIONS.find(
    (definition) => definition.itemId === itemId
  )

// [0, 1) 난수를 후보 개수 안의 인덱스로. Lua 미러(monster-equipment-drops.lua)가 같은 계산을 한다.
export const getMonsterDropIndex = (indexRoll: number, count: number): number =>
  Math.min(count - 1, Math.floor(indexRoll * count))

// 몬스터 레벨에 맞는 등급의 레벨(그 레벨 이하에서 가장 높은 등급). lower 면 한 등급 아래(가장 낮으면 그대로).
export const getMonsterDropBandLevel = (
  bandLevels: readonly number[],
  monsterLevel: number,
  lower = false
): number => {
  const bandIndex = Math.max(
    0,
    bandLevels.filter((bandLevel) => bandLevel <= monsterLevel).length - 1
  )

  return bandLevels[Math.max(0, bandIndex - (lower ? 1 : 0))]
}

type RollMonsterDropInput = {
  monsterLevel: number
  // 보스는 장비를 꼭 떨어뜨린다.
  isBoss?: boolean
  random?: () => number
  // 인덱스 계산(Lua 래퍼가 Lua 함수로 바꿔 끼운다)
  pickIndex?: (indexRoll: number, count: number) => number
}

// 난수는 항상 같은 순서로 쓴다: 종류(장비/포션/없음) → 한 등급 아래 여부 → 후보 인덱스.
export const rollMonsterDrop = ({
  monsterLevel,
  isBoss = false,
  random = Math.random,
  pickIndex = getMonsterDropIndex
}: RollMonsterDropInput): MonsterEquipmentDropDefinition | undefined => {
  const kindRoll = random()
  const isEquipment = isBoss || kindRoll < MONSTER_EQUIPMENT_DROP_CHANCE
  const isPotion =
    !isEquipment && kindRoll < MONSTER_EQUIPMENT_DROP_CHANCE + MONSTER_POTION_DROP_CHANCE

  if (!isEquipment && !isPotion) {
    return undefined
  }

  const [definitions, bandLevels] = isEquipment
    ? [MONSTER_EQUIPMENT_DROP_DEFINITIONS, MONSTER_EQUIPMENT_DROP_BAND_LEVELS]
    : [MONSTER_POTION_DROP_DEFINITIONS, MONSTER_POTION_DROP_BAND_LEVELS]
  // 보스는 언제나 제 등급을 준다.
  const lower = !isBoss && random() < MONSTER_DROP_LOWER_BAND_CHANCE
  const bandLevel = getMonsterDropBandLevel(bandLevels, monsterLevel, lower)
  const candidates = definitions.filter((definition) => definition.level === bandLevel)

  return candidates[pickIndex(random(), candidates.length)]
}
