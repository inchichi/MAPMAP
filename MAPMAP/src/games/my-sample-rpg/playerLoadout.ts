import {
  clearPlayerEquipmentSlot,
  createPlayerEquipmentItemFromDefinition,
  getPlayerEquipmentItemDefinitionById,
  setPlayerEquipmentSlot,
  type PlayerEquipment,
  type PlayerEquipmentItem,
  type PlayerEquipmentSlotId
} from './playerEquipment'
import {
  clearPlayerInventorySlot,
  findFirstEmptyPlayerInventorySlotIndex,
  setPlayerInventorySlot,
  type PlayerInventory,
  type PlayerInventoryItem
} from './playerInventory'

export type PlayerLoadoutState = {
  equipment: PlayerEquipment
  inventory: PlayerInventory
}

type UnequipPlayerEquipmentSlotInput = PlayerLoadoutState & {
  slotId: PlayerEquipmentSlotId
}

type EquipPlayerInventorySlotInput = PlayerLoadoutState & {
  slotIndex: number
}

const createPlayerInventoryItemFromEquipmentItem = (
  item: PlayerEquipmentItem
): PlayerInventoryItem => ({
  id: item.id,
  label: item.label,
  quantity: 1
})

// 채굴 테스트 편의: 곡괭이를 기본 보유 상태로 보장한다. 인벤토리에도, 장비(보조 장비 슬롯)에도
// 없으면 첫 빈 인벤토리 칸에 1개를 지급한다 — 구버전 세이브(시작 아이템 미포함)를 로드해도
// 곡괭이가 항상 존재하게 된다. 빈 칸이 없으면 그대로 둔다.
export const ensurePlayerLoadoutPickaxe = (
  state: PlayerLoadoutState
): PlayerLoadoutState => ensurePlayerLoadoutItem(state, 'pickaxe')

// 인벤토리에도 장비에도 없는 장비 아이템이면 첫 빈 칸에 1개를 넣는다. 빈 칸이 없거나
// 알 수 없는 아이템이면 그대로 둔다.
export const ensurePlayerLoadoutItem = (
  { equipment, inventory }: PlayerLoadoutState,
  itemId: string
): PlayerLoadoutState => {
  const hasInInventory = inventory.slots.some((slot) => slot?.id === itemId)
  const hasEquipped = equipment.slots.some((slot) => slot.item?.id === itemId)
  const definition = getPlayerEquipmentItemDefinitionById(itemId)

  if (hasInInventory || hasEquipped || !definition) {
    return { equipment, inventory }
  }

  const emptySlotIndex = findFirstEmptyPlayerInventorySlotIndex(inventory)

  if (emptySlotIndex === undefined) {
    return { equipment, inventory }
  }

  return {
    equipment,
    inventory: setPlayerInventorySlot({
      inventory,
      slotIndex: emptySlotIndex,
      item: { id: itemId, label: definition.label, quantity: 1 }
    })
  }
}

// 테스트용 지급(임시): 무기 종류마다 가장 기초 무기 하나와, 착용하면 겉모습이 바뀌는 기초 방어구.
// 무기 전환·외형 확인이 끝나면 main.ts 의 호출과 함께 지운다.
export const PLAYER_TEST_GEAR_ITEM_IDS = [
  'basic-sword', // 검
  'battle-axe', // 도끼
  'magic-staff', // 지팡이(마법)
  'hunting-bow', // 활
  'basic-armor',
  'basic-boots',
  'Leather_Armor',
  'Leather_Helmet',
  'leather-boots'
] as const

export const ensurePlayerLoadoutTestGear = (
  state: PlayerLoadoutState
): PlayerLoadoutState =>
  PLAYER_TEST_GEAR_ITEM_IDS.reduce(ensurePlayerLoadoutItem, state)

export const unequipPlayerEquipmentSlot = ({
  equipment,
  inventory,
  slotId
}: UnequipPlayerEquipmentSlotInput): PlayerLoadoutState | undefined => {
  const equipmentSlot = equipment.slots.find((slot) => slot.id === slotId)

  if (!equipmentSlot?.item) {
    return undefined
  }

  const emptySlotIndex = findFirstEmptyPlayerInventorySlotIndex(inventory)

  if (emptySlotIndex === undefined) {
    return undefined
  }

  const nextInventory = setPlayerInventorySlot({
    inventory,
    slotIndex: emptySlotIndex,
    item: createPlayerInventoryItemFromEquipmentItem(equipmentSlot.item)
  })

  return {
    equipment: clearPlayerEquipmentSlot({ equipment, slotId }),
    inventory: nextInventory
  }
}

export const equipPlayerInventorySlot = ({
  equipment,
  inventory,
  slotIndex
}: EquipPlayerInventorySlotInput): PlayerLoadoutState | undefined => {
  const item = inventory.slots[slotIndex]

  if (!item) {
    return undefined
  }

  const definition = getPlayerEquipmentItemDefinitionById(item.id)

  if (!definition) {
    return undefined
  }

  const equipmentSlot = equipment.slots.find(
    (slot) => slot.id === definition.slotId
  )

  if (!equipmentSlot) {
    return undefined
  }

  const equippedItem = equipmentSlot.item
  const nextEquipment = setPlayerEquipmentSlot({
    equipment,
    slotId: definition.slotId,
    item: createPlayerEquipmentItemFromDefinition(definition)
  })
  let nextInventory = clearPlayerInventorySlot({
    inventory,
    slotIndex
  })

  if (equippedItem) {
    nextInventory = setPlayerInventorySlot({
      inventory: nextInventory,
      slotIndex,
      item: createPlayerInventoryItemFromEquipmentItem(equippedItem)
    })
  }

  return {
    equipment: nextEquipment,
    inventory: nextInventory
  }
}
