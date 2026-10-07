import { type PlayerInventory, type PlayerInventoryItem } from '../../playerInventory'
import { type QuestItemReward } from '../../questLog'

export const STACKABLE_QUEST_REWARD_ITEM_IDS = new Set([
  'health-potion',
  'mana-potion',
  'health-potion-medium',
  'mana-potion-medium',
  'health-potion-large',
  'mana-potion-large',
  'antidote-incense',
  'warming-tea',
  'crystal-ore'
])

// 장비/포션 카탈로그에 없는 재료 아이템의 표시 이름.
export const MATERIAL_ITEM_LABEL_BY_ID: Record<string, string> = {
  'crystal-ore': '수정 광석'
}

export const addQuestItemRewardsToInventory = (
  inventory: PlayerInventory,
  itemRewards: QuestItemReward[]
): PlayerInventory => {
  let nextInventory = inventory

  for (const itemReward of itemRewards) {
    nextInventory = addQuestItemRewardToInventory(nextInventory, itemReward)
  }

  return nextInventory
}

export const addQuestItemRewardToInventory = (
  inventory: PlayerInventory,
  itemReward: QuestItemReward
): PlayerInventory => {
  if (STACKABLE_QUEST_REWARD_ITEM_IDS.has(itemReward.id)) {
    const stackSlotIndex = inventory.slots.findIndex(
      (item) => item?.id === itemReward.id
    )

    if (stackSlotIndex >= 0) {
      const slots = [...inventory.slots]
      const stack = slots[stackSlotIndex] as PlayerInventoryItem

      slots[stackSlotIndex] = {
        ...stack,
        quantity: stack.quantity + itemReward.quantity
      }

      return {
        ...inventory,
        slots
      }
    }

    return addQuestRewardAsNewInventorySlot(inventory, itemReward)
  }

  return addQuestRewardAsNewInventorySlots(inventory, itemReward)
}

export const addQuestRewardAsNewInventorySlot = (
  inventory: PlayerInventory,
  itemReward: QuestItemReward
): PlayerInventory => {
  const emptySlotIndex = inventory.slots.findIndex((item) => item === undefined)

  if (emptySlotIndex < 0) {
    return inventory
  }

  const slots = [...inventory.slots]

  slots[emptySlotIndex] = {
    id: itemReward.id,
    label: itemReward.label,
    quantity: itemReward.quantity
  }

  return {
    ...inventory,
    slots
  }
}

export const addQuestRewardAsNewInventorySlots = (
  inventory: PlayerInventory,
  itemReward: QuestItemReward
): PlayerInventory => {
  let nextInventory = inventory

  for (let quantity = 0; quantity < itemReward.quantity; quantity += 1) {
    const emptySlotIndex = nextInventory.slots.findIndex(
      (item) => item === undefined
    )

    if (emptySlotIndex < 0) {
      return nextInventory
    }

    const slots = [...nextInventory.slots]

    slots[emptySlotIndex] = {
      id: itemReward.id,
      label: itemReward.label,
      quantity: 1
    }
    nextInventory = {
      ...nextInventory,
      slots
    }
  }

  return nextInventory
}
