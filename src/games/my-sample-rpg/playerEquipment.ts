export type PlayerEquipmentSlotId =
  | 'weapon'
  | 'armor'
  | 'hat'
  | 'boots'
  | 'accessory'

export type PlayerEquipmentIconKey =
  | 'tiny-dungeon-weapon'
  | 'tiny-knight-gray-helmet'
  | 'tiny-knight-open-helmet'
  | 'town-crate-sword-right'
  | 'weapon-sword'
  | 'weapon-axe'
  | 'weapon-spear'
  | 'weapon-dagger'
  | 'weapon-mace'
  | 'weapon-staff'
  | 'ui-circle-beige'
  | 'ui-check-beige'

export type PlayerEquipmentIcon = {
  key: PlayerEquipmentIconKey
  scale: number
}

export type PlayerEquipmentItem = {
  id: string
  label: string
  level: number
  description: string
}

export type PlayerEquipmentItemDefinition = PlayerEquipmentItem & {
  slotId: PlayerEquipmentSlotId
  icon: PlayerEquipmentIcon
  price: number
  // 전투 보정 — 무기는 공격력, 방어구/장신구는 피해 감소. 없으면 0으로 본다.
  attackBonus?: number
  defense?: number
}

export type PlayerEquipmentSlot = {
  id: PlayerEquipmentSlotId
  label: string
  item: PlayerEquipmentItem | undefined
}

export type PlayerEquipment = {
  setName: string
  level: number
  slots: PlayerEquipmentSlot[]
}

export const EQUIPMENT_SLOT_LABEL_BY_ID: Record<PlayerEquipmentSlotId, string> = {
  weapon: '무기',
  armor: '옷',
  hat: '모자',
  boots: '신발',
  accessory: '장신구'
}

export const EQUIPMENT_SLOT_IDS: PlayerEquipmentSlotId[] = [
  'weapon',
  'armor',
  'hat',
  'boots',
  'accessory'
]

export const PLAYER_EQUIPMENT_ITEM_DEFINITIONS: PlayerEquipmentItemDefinition[] = [
  {
    id: 'basic-sword',
    attackBonus: 2,
    slotId: 'weapon',
    label: '기본 무기',
    level: 1,
    description: '초보용 근접 무기',
    price: 120,
    icon: {
      key: 'tiny-dungeon-weapon',
      scale: 1.6
    }
  },
  {
    id: 'basic-armor',
    defense: 1,
    slotId: 'armor',
    label: '기본 옷',
    level: 1,
    description: '초보용 옷',
    price: 100,
    icon: {
      key: 'tiny-knight-gray-helmet',
      scale: 1.4
    }
  },
  {
    id: 'basic-boots',
    defense: 1,
    slotId: 'boots',
    label: '기본 신발',
    level: 1,
    description: '초보용 신발',
    price: 80,
    icon: {
      key: 'ui-circle-beige',
      scale: 1.2
    }
  },
  {
    id: 'basic-charm',
    defense: 1,
    slotId: 'accessory',
    label: '기본 장신구',
    level: 1,
    description: '초보용 장신구',
    price: 60,
    icon: {
      key: 'ui-check-beige',
      scale: 1.2
    }
  },
  {
    id: 'bronze-sword',
    attackBonus: 4,
    slotId: 'weapon',
    label: '청동 검',
    level: 2,
    description: '대장장이가 만든 단단한 검',
    price: 320,
    icon: {
      key: 'town-crate-sword-right',
      scale: 1.5
    }
  },
  {
    id: 'iron-sword',
    attackBonus: 6,
    slotId: 'weapon',
    label: '강철 검',
    level: 2,
    description: '균형이 좋은 근접 무기',
    price: 240,
    icon: {
      key: 'weapon-sword',
      scale: 0.08
    }
  },
  {
    id: 'pickaxe',
    attackBonus: 2,
    slotId: 'weapon',
    label: '곡괭이',
    level: 1,
    description: '광맥에서 광석을 캐는 채굴 도구',
    price: 150,
    icon: {
      key: 'weapon-axe',
      scale: 0.08
    }
  },
  {
    id: 'battle-axe',
    attackBonus: 7,
    slotId: 'weapon',
    label: '전투 도끼',
    level: 2,
    description: '무거운 한손 도끼',
    price: 260,
    icon: {
      key: 'weapon-axe',
      scale: 0.08
    }
  },
  {
    id: 'long-spear',
    attackBonus: 6,
    slotId: 'weapon',
    label: '장창',
    level: 2,
    description: '거리감을 유지하기 좋은 창',
    price: 280,
    icon: {
      key: 'weapon-spear',
      scale: 0.08
    }
  },
  {
    id: 'quick-dagger',
    attackBonus: 4,
    slotId: 'weapon',
    label: '단검',
    level: 1,
    description: '빠른 연속 공격용 무기',
    price: 180,
    icon: {
      key: 'weapon-dagger',
      scale: 0.08
    }
  },
  {
    id: 'spiked-mace',
    attackBonus: 7,
    slotId: 'weapon',
    label: '철퇴',
    level: 3,
    description: '강한 타격을 주는 둔기',
    price: 340,
    icon: {
      key: 'weapon-mace',
      scale: 0.08
    }
  },
  {
    id: 'magic-staff',
    attackBonus: 5,
    slotId: 'weapon',
    label: '마법 지팡이',
    level: 3,
    description: '마력을 머금은 지팡이',
    price: 360,
    icon: {
      key: 'weapon-staff',
      scale: 0.08
    }
  },
  {
    id: 'iron-armor',
    defense: 3,
    slotId: 'armor',
    label: '철 옷',
    level: 2,
    description: '초보용을 넘어선 철제 옷',
    price: 260,
    icon: {
      key: 'tiny-knight-open-helmet',
      scale: 1.4
    }
  },
  {
    id: 'Leather_Armor',
    defense: 2,
    slotId: 'armor',
    label: '가죽 갑옷',
    level: 2,
    description: '몬스터에게서 얻은 가죽 갑옷',
    price: 220,
    icon: {
      key: 'tiny-knight-gray-helmet',
      scale: 1.4
    }
  },
  {
    id: 'Leather_Helmet',
    defense: 1,
    slotId: 'hat',
    label: '가죽 투구',
    level: 2,
    description: '몬스터에게서 얻은 가죽 투구',
    price: 180,
    icon: {
      key: 'tiny-knight-gray-helmet',
      scale: 1.4
    }
  },
  {
    id: 'Chain_Armor',
    defense: 3,
    slotId: 'armor',
    label: '사슬 갑옷',
    level: 2,
    description: '몬스터에게서 얻은 사슬 갑옷',
    price: 300,
    icon: {
      key: 'tiny-knight-open-helmet',
      scale: 1.4
    }
  },
  {
    id: 'Chain_Helmet',
    defense: 2,
    slotId: 'hat',
    label: '사슬 투구',
    level: 2,
    description: '몬스터에게서 얻은 사슬 투구',
    price: 240,
    icon: {
      key: 'tiny-knight-open-helmet',
      scale: 1.4
    }
  },
  {
    id: 'Iron_Armor',
    defense: 4,
    slotId: 'armor',
    label: '철 갑옷',
    level: 3,
    description: '몬스터에게서 얻은 철 갑옷',
    price: 360,
    icon: {
      key: 'tiny-knight-open-helmet',
      scale: 1.4
    }
  },
  {
    id: 'Iron_Helmet',
    defense: 3,
    slotId: 'hat',
    label: '철 투구',
    level: 3,
    description: '몬스터에게서 얻은 철 투구',
    price: 300,
    icon: {
      key: 'tiny-knight-open-helmet',
      scale: 1.4
    }
  },
  {
    id: 'leather-boots',
    defense: 2,
    slotId: 'boots',
    label: '가죽 신발',
    level: 2,
    description: '가볍고 단단한 가죽 신발',
    price: 180,
    icon: {
      key: 'ui-circle-beige',
      scale: 1.2
    }
  },
  {
    id: 'smith-charm',
    defense: 2,
    slotId: 'accessory',
    label: '수호 부적',
    level: 2,
    description: '대장장이가 준 작은 보호 부적',
    price: 140,
    icon: {
      key: 'ui-check-beige',
      scale: 1.2
    }
  }
]

const PLAYER_EQUIPMENT_ITEM_DEFINITION_BY_ID = new Map(
  PLAYER_EQUIPMENT_ITEM_DEFINITIONS.map((definition) => [
    definition.id,
    definition
  ])
)
const PLAYER_EQUIPMENT_ITEM_DEFINITION_BY_SLOT_ID = new Map<
  PlayerEquipmentSlotId,
  PlayerEquipmentItemDefinition
>()

for (const definition of PLAYER_EQUIPMENT_ITEM_DEFINITIONS) {
  if (!PLAYER_EQUIPMENT_ITEM_DEFINITION_BY_SLOT_ID.has(definition.slotId)) {
    PLAYER_EQUIPMENT_ITEM_DEFINITION_BY_SLOT_ID.set(definition.slotId, definition)
  }
}

const STARTER_WEAPON_ITEM_DEFINITION = PLAYER_EQUIPMENT_ITEM_DEFINITION_BY_ID.get(
  'basic-sword'
)

if (!STARTER_WEAPON_ITEM_DEFINITION) {
  throw new Error('Missing starter weapon definition')
}

export const PLAYER_EQUIPMENT_STARTER_WEAPON_ITEM_DEFINITION: PlayerEquipmentItemDefinition =
  STARTER_WEAPON_ITEM_DEFINITION

export const createInitialPlayerEquipment = (): PlayerEquipment => ({
  setName: '기본 장비',
  level: 1,
  slots: EQUIPMENT_SLOT_IDS.map((slotId) => {
    return {
      id: slotId,
      label: EQUIPMENT_SLOT_LABEL_BY_ID[slotId],
      item: slotId === 'weapon'
        ? createPlayerEquipmentItemFromDefinition(STARTER_WEAPON_ITEM_DEFINITION)
        : undefined
    }
  })
})

export const getPlayerEquipmentSlotLabelById = (
  slotId: PlayerEquipmentSlotId
): string => EQUIPMENT_SLOT_LABEL_BY_ID[slotId]

export const createPlayerEquipmentItemFromDefinition = (
  definition: PlayerEquipmentItemDefinition
): PlayerEquipmentItem => ({
  id: definition.id,
  label: definition.label,
  level: definition.level,
  description: definition.description
})

// 장착 중인 장비의 전투 보정 합계 — 렌더러의 공격/피격 계산에 더해진다.
export const getEquippedPlayerAttackBonus = (
  equipment: Pick<PlayerEquipment, 'slots'>
): number =>
  equipment.slots.reduce((total, slot) => {
    const definition = slot.item
      ? getPlayerEquipmentItemDefinitionById(slot.item.id)
      : undefined
    return total + (definition?.attackBonus ?? 0)
  }, 0)

export const getEquippedPlayerDefense = (
  equipment: Pick<PlayerEquipment, 'slots'>
): number =>
  equipment.slots.reduce((total, slot) => {
    const definition = slot.item
      ? getPlayerEquipmentItemDefinitionById(slot.item.id)
      : undefined
    return total + (definition?.defense ?? 0)
  }, 0)

export const getPlayerEquipmentItemDefinitionById = (
  itemId: string
): PlayerEquipmentItemDefinition | undefined =>
  PLAYER_EQUIPMENT_ITEM_DEFINITION_BY_ID.get(itemId)

export const getPlayerEquipmentItemDefinitionBySlotId = (
  slotId: PlayerEquipmentSlotId
): PlayerEquipmentItemDefinition | undefined =>
  PLAYER_EQUIPMENT_ITEM_DEFINITION_BY_SLOT_ID.get(slotId)

export const getPlayerEquipmentSlotById = (
  equipment: PlayerEquipment,
  slotId: PlayerEquipmentSlotId
): PlayerEquipmentSlot | undefined =>
  equipment.slots.find((slot) => slot.id === slotId)

export const findPlayerEquipmentSlotIndexById = (
  equipment: PlayerEquipment,
  slotId: PlayerEquipmentSlotId
): number => equipment.slots.findIndex((slot) => slot.id === slotId)

export const setPlayerEquipmentSlot = ({
  equipment,
  slotId,
  item
}: {
  equipment: PlayerEquipment
  slotId: PlayerEquipmentSlotId
  item: PlayerEquipmentItem
}): PlayerEquipment => {
  const slotIndex = findPlayerEquipmentSlotIndexById(equipment, slotId)

  if (slotIndex < 0) {
    throw new Error(`Invalid equipment slot id ${slotId}`)
  }

  const slots = [...equipment.slots]
  const slot = slots[slotIndex]

  slots[slotIndex] = {
    ...slot,
    item
  }

  return {
    ...equipment,
    slots
  }
}

export const clearPlayerEquipmentSlot = ({
  equipment,
  slotId
}: {
  equipment: PlayerEquipment
  slotId: PlayerEquipmentSlotId
}): PlayerEquipment => {
  const slotIndex = findPlayerEquipmentSlotIndexById(equipment, slotId)

  if (slotIndex < 0) {
    throw new Error(`Invalid equipment slot id ${slotId}`)
  }

  const slots = [...equipment.slots]
  const slot = slots[slotIndex]

  slots[slotIndex] = {
    ...slot,
    item: undefined
  }

  return {
    ...equipment,
    slots
  }
}
