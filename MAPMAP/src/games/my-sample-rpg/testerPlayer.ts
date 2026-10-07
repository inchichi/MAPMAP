import {
  createInitialPlayerEquipment,
  createPlayerEquipmentItemFromDefinition,
  getPlayerEquipmentItemDefinitionById,
  type PlayerEquipment
} from './playerEquipment'
import { createInitialPlayerInventory, type PlayerInventory } from './playerInventory'
import { PLAYER_MAX_LEVEL, createInitialPlayerProfile, type PlayerProfile } from './playerProfile'
import { grantPlayerLevelUpRewards, spendPlayerStatPoint } from './playerProgression'

// 확인용 테스터 플레이어(주소 뒤에 ?tester). 최고 레벨, 무기 계열마다 최고 등급 무기 하나,
// 3등급 방어구 착용, 등급 포션, 모든 스킬 최대 레벨.
// main.ts 는 이 모드에서 저장하지 않는다 — 원래 진행 저장을 덮어쓰지 않게.

export const TESTER_WEAPON_ITEM_IDS = [
  'frost-sword',
  'frost-axe',
  'frost-bow',
  'frost-staff'
] as const

const TESTER_WORN_ITEM_IDS = ['frost-armor', 'frost-helmet', 'frost-boots', 'frost-charm'] as const

const TESTER_POTIONS = [
  { id: 'health-potion-large', label: '상급 체력 포션', quantity: 30 },
  { id: 'mana-potion-large', label: '상급 마나 포션', quantity: 30 }
]

// 민첩·행운은 효과 상한까지, 나머지는 힘과 지력에 반씩 — 근접 무기와 지팡이를 둘 다 시험할 수 있게.
const allocateTesterStats = (profile: PlayerProfile): PlayerProfile => {
  let next = profile
  for (const statId of ['agility', 'luck'] as const) {
    for (let spent = spendPlayerStatPoint(next, statId); spent; spent = spendPlayerStatPoint(next, statId)) {
      next = spent
    }
  }
  for (let index = 0; next.statPoints > 0; index += 1) {
    next = spendPlayerStatPoint(next, index % 2 === 0 ? 'strength' : 'intelligence') ?? next
  }
  return next
}

export const createTesterPlayer = (): {
  profile: PlayerProfile
  equipment: PlayerEquipment
  inventory: PlayerInventory
} => {
  const leveled = allocateTesterStats(
    grantPlayerLevelUpRewards(createInitialPlayerProfile(), PLAYER_MAX_LEVEL - 1)
  )
  // 스킬은 포인트로 사지 않고 바로 최대로 — 전부 배우려면 레벨업 포인트(198)보다 많은 420 이 든다.
  const profile: PlayerProfile = {
    ...leveled,
    availableSkillPoints: 0,
    skills: leveled.skills.map((skill) => ({ ...skill, level: skill.maxLevel }))
  }
  const toItem = (itemId: string) => {
    const definition = getPlayerEquipmentItemDefinitionById(itemId)
    if (!definition) {
      throw new Error(`unknown tester item ${itemId}`)
    }
    return { definition, item: createPlayerEquipmentItemFromDefinition(definition) }
  }

  const initialEquipment = createInitialPlayerEquipment()
  const worn = [TESTER_WEAPON_ITEM_IDS[0], ...TESTER_WORN_ITEM_IDS].map(toItem)
  const equipment: PlayerEquipment = {
    ...initialEquipment,
    slots: initialEquipment.slots.map((slot) => ({
      ...slot,
      item: worn.find(({ definition }) => definition.slotId === slot.id)?.item ?? slot.item
    }))
  }

  const initialInventory = createInitialPlayerInventory()
  const carried = [
    ...TESTER_WEAPON_ITEM_IDS.slice(1).map((itemId) => ({
      id: itemId,
      label: toItem(itemId).definition.label,
      quantity: 1
    })),
    ...TESTER_POTIONS
  ]
  const inventory: PlayerInventory = {
    ...initialInventory,
    gold: 1_000_000,
    slots: initialInventory.slots.map((_, index) => carried[index])
  }

  return { profile, equipment, inventory }
}
