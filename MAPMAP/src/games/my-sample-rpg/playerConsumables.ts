import {
  clearPlayerInventorySlot,
  setPlayerInventorySlot,
  type PlayerInventory,
  type PlayerInventoryItem
} from './playerInventory'
import {
  getPlayerQuickslotAssignment,
  type PlayerQuickslots
} from './playerQuickslots'
import type { PlayerProfile } from './playerProfile'

export type UsePlayerInventoryConsumableResult = {
  profile: PlayerProfile
  inventory: PlayerInventory
}

export type UsePlayerQuickslotConsumableResult = UsePlayerInventoryConsumableResult
type UsePlayerInventoryConsumableInput = {
  profile: PlayerProfile
  inventory: PlayerInventory
  slotIndex: number
}

type UsePlayerQuickslotConsumableInput = {
  profile: PlayerProfile
  inventory: PlayerInventory
  quickslots: PlayerQuickslots
  quickslotIndex: number
}
// 포션별 회복량. 등급 포션(중급 Lv15~, 상급 Lv38~)은 그 장의 최대 체력·마나에 맞춘 값(docs/game-balance.md).
// assets/lua/player-consumables.lua 의 POTION_RESTORE 와 같아야 한다.
export const PLAYER_POTION_RESTORE: Record<string, { resource: 'hp' | 'mp'; amount: number }> = {
  'health-potion': { resource: 'hp', amount: 10 },
  'mana-potion': { resource: 'mp', amount: 10 },
  'health-potion-medium': { resource: 'hp', amount: 60 },
  'mana-potion-medium': { resource: 'mp', amount: 40 },
  'health-potion-large': { resource: 'hp', amount: 150 },
  'mana-potion-large': { resource: 'mp', amount: 80 }
}

export const usePlayerInventoryConsumable = ({
  profile,
  inventory,
  slotIndex
}: UsePlayerInventoryConsumableInput): UsePlayerInventoryConsumableResult | undefined => {
  const item = inventory.slots[slotIndex]

  if (!item) {
    return undefined
  }

  const restore = PLAYER_POTION_RESTORE[item.id]

  if (restore) {
    const resource = profile[restore.resource]

    return {
      profile: {
        ...profile,
        [restore.resource]: {
          ...resource,
          current: Math.min(resource.max, resource.current + restore.amount)
        }
      },
      inventory: consumeInventorySlot({
        inventory,
        slotIndex,
        item
      })
    }
  }

  switch (item.id) {
    case 'antidote-incense':
    case 'warming-tea':
      // 해독 향·생강차는 능력치를 바꾸지 않는다 — 하나를 쓰고, 독안개·눈보라 면역 시간은 화면(poisonFog)이 잰다.
      return {
        profile,
        inventory: consumeInventorySlot({
          inventory,
          slotIndex,
          item
        })
      }
    default:
      return undefined
  }
}

export const usePlayerQuickslotConsumable = ({
  profile,
  inventory,
  quickslots,
  quickslotIndex
}: UsePlayerQuickslotConsumableInput): UsePlayerQuickslotConsumableResult | undefined => {
  const quickslot = getPlayerQuickslotAssignment(quickslots, quickslotIndex)

  if (!quickslot) {
    return undefined
  }

  return usePlayerInventoryConsumable({
    profile,
    inventory,
    slotIndex: quickslot.inventorySlotIndex
  })
}
const consumeInventorySlot = ({
  inventory,
  slotIndex,
  item
}: {
  inventory: PlayerInventory
  slotIndex: number
  item: PlayerInventoryItem
}): PlayerInventory =>
  item.quantity > 1
    ? setPlayerInventorySlot({
        inventory,
        slotIndex,
        item: {
          ...item,
          quantity: item.quantity - 1
        }
      })
    : clearPlayerInventorySlot({
        inventory,
        slotIndex
      })
