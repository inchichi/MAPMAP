import { describe, expect, it } from 'vitest'

import {
  createInitialPlayerEquipment,
  setPlayerEquipmentSlot
} from './playerEquipment'
import {
  createInitialPlayerInventory,
  setPlayerInventorySlot
} from './playerInventory'
import {
  ensurePlayerLoadoutPickaxe,
  equipPlayerInventorySlot,
  unequipPlayerEquipmentSlot
} from './playerLoadout'

describe('ensurePlayerLoadoutPickaxe', () => {
  it('adds a pickaxe to the first empty slot when the loadout has none', () => {
    const equipment = createInitialPlayerEquipment()
    const inventory = createInitialPlayerInventory({ slotCount: 3 })

    const nextState = ensurePlayerLoadoutPickaxe({ equipment, inventory })

    expect(nextState.inventory.slots[0]).toEqual({
      id: 'pickaxe',
      label: '곡괭이',
      quantity: 1
    })
  })

  it('keeps the loadout unchanged when the pickaxe is already in the inventory', () => {
    const equipment = createInitialPlayerEquipment()
    // 기본 시작 아이템에 곡괭이가 포함된 인벤토리.
    const inventory = createInitialPlayerInventory()

    expect(ensurePlayerLoadoutPickaxe({ equipment, inventory })).toEqual({
      equipment,
      inventory
    })
  })

  it('keeps the loadout unchanged when the pickaxe is equipped in the tool slot', () => {
    const equipment = setPlayerEquipmentSlot({
      equipment: createInitialPlayerEquipment(),
      slotId: 'tool',
      item: {
        id: 'pickaxe',
        label: '곡괭이',
        level: 1,
        description: '광맥에서 광석을 캐는 채굴 도구'
      }
    })
    const inventory = createInitialPlayerInventory({ slotCount: 3 })

    expect(ensurePlayerLoadoutPickaxe({ equipment, inventory })).toEqual({
      equipment,
      inventory
    })
  })
})

describe('unequipPlayerEquipmentSlot', () => {
  it('moves the equipped item into the first empty inventory slot', () => {
    const equipment = createInitialPlayerEquipment()
    const inventory = createInitialPlayerInventory({ slotCount: 3 })

    const nextState = unequipPlayerEquipmentSlot({
      equipment,
      inventory,
      slotId: 'weapon'
    })

    expect(nextState).toEqual({
      equipment: {
        ...equipment,
        slots: [
          {
            id: 'weapon',
            label: '무기',
            item: undefined
          },
          equipment.slots[1],
          equipment.slots[2],
          equipment.slots[3],
          equipment.slots[4],
          equipment.slots[5]
        ]
      },
      inventory: {
        gold: 150,
        slots: [
          {
            id: 'basic-sword',
            label: '기본 무기',
            quantity: 1
          },
          undefined,
          undefined
        ]
      }
    })
  })
})

describe('equipPlayerInventorySlot', () => {
  it('equips a matching item and swaps back the previous equipment', () => {
    const equipment = setPlayerEquipmentSlot({
      equipment: createInitialPlayerEquipment(),
      slotId: 'weapon',
      item: {
        id: 'basic-armor',
        label: '기본 옷',
        level: 1,
        description: '초보용 옷'
      }
    })
    const inventory = setPlayerInventorySlot({
      inventory: createInitialPlayerInventory({ slotCount: 2 }),
      slotIndex: 0,
      item: {
        id: 'basic-sword',
        label: '기본 무기',
        quantity: 1
      }
    })

    const nextState = equipPlayerInventorySlot({
      equipment,
      inventory,
      slotIndex: 0
    })

    expect(nextState).toEqual({
      equipment: {
        ...equipment,
        slots: [
          {
            id: 'weapon',
            label: '무기',
            item: {
              id: 'basic-sword',
              label: '기본 무기',
              level: 1,
              description: '초보용 근접 무기'
            }
          },
          equipment.slots[1],
          equipment.slots[2],
          equipment.slots[3],
          equipment.slots[4],
          equipment.slots[5]
        ]
      },
      inventory: {
        gold: 150,
        slots: [
          {
            id: 'basic-armor',
            label: '기본 옷',
            quantity: 1
          },
          undefined
        ]
      }
    })
  })
})
