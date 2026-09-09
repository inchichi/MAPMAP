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
export const ensurePlayerLoadoutPickaxe = ({
  equipment,
  inventory
}: PlayerLoadoutState): PlayerLoadoutState => {
  const hasInInventory = inventory.slots.some((slot) => slot?.id === 'pickaxe')
  const hasEquipped = equipment.slots.some((slot) => slot.item?.id === 'pickaxe')

  if (hasInInventory || hasEquipped) {
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
      item: { id: 'pickaxe', label: '곡괭이', quantity: 1 }
    })
  }
}

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
