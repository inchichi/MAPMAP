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
const PLAYER_POTION_RESTORE_AMOUNT = 10

export const usePlayerInventoryConsumable = ({
  profile,
  inventory,
  slotIndex
}: UsePlayerInventoryConsumableInput): UsePlayerInventoryConsumableResult | undefined => {
  const item = inventory.slots[slotIndex]

  if (!item) {
    return undefined
  }

  switch (item.id) {
    case 'health-potion':
      return {
        profile: {
          ...profile,
          hp: {
            ...profile.hp,
            current: Math.min(
              profile.hp.max,
              profile.hp.current + PLAYER_POTION_RESTORE_AMOUNT
            )
          }
        },
        inventory: consumeInventorySlot({
          inventory,
          slotIndex,
          item
        })
      }
    case 'mana-potion':
      return {
        profile: {
          ...profile,
          mp: {
            ...profile.mp,
            current: Math.min(
              profile.mp.max,
              profile.mp.current + PLAYER_POTION_RESTORE_AMOUNT
            )
          }
        },
        inventory: consumeInventorySlot({
          inventory,
          slotIndex,
          item
        })
      }
    case 'antidote-incense':
      // 해독 향은 능력치를 바꾸지 않는다 — 하나를 태우고, 독안개 면역 시간은 화면(poisonFog)이 잰다.
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
