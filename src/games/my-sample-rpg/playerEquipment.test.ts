import { describe, expect, it } from 'vitest'

import {
  createInitialPlayerEquipment,
  getPlayerEquipmentItemDefinitionById,
  getPlayerEquipmentItemDefinitionBySlotId
} from './playerEquipment'

describe('createInitialPlayerEquipment', () => {
  it('creates a level 1 starter gear set', () => {
    expect(createInitialPlayerEquipment()).toEqual({
      setName: '기본 장비',
      level: 1,
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
        {
          id: 'armor',
          label: '옷',
          item: undefined
        },
        {
          id: 'hat',
          label: '모자',
          item: undefined
        },
        {
          id: 'boots',
          label: '신발',
          item: undefined
        },
        {
          id: 'accessory',
          label: '장신구',
          item: undefined
        },
        {
          id: 'tool',
          label: '보조 장비',
          item: undefined
        }
      ]
    })
  })

  it('uses the LPC weapon icon for the starter weapon', () => {
    expect(getPlayerEquipmentItemDefinitionBySlotId('weapon')).toMatchObject({
      price: 120,
      icon: {
        key: 'lpc-weapon:basic-sword',
        scale: 1
      }
    })
  })

  it('exposes blacksmith shop gear definitions', () => {
    expect(getPlayerEquipmentItemDefinitionById('bronze-sword')).toMatchObject({
      label: '청동 검',
      price: 320,
      icon: {
        key: 'lpc-weapon:bronze-sword'
      }
    })

    expect(getPlayerEquipmentItemDefinitionById('iron-sword')).toMatchObject({
      slotId: 'weapon',
      label: '강철 검',
      icon: {
        key: 'lpc-weapon:iron-sword',
        scale: 1
      }
    })

    expect(getPlayerEquipmentItemDefinitionById('iron-armor')).toMatchObject({
      label: '철 옷',
      price: 260,
      icon: {
        key: 'lpc-gear:iron-armor'
      }
    })

    expect(getPlayerEquipmentItemDefinitionById('Chain_Armor')).toMatchObject({
      slotId: 'armor',
      label: '사슬 갑옷',
      icon: {
        key: 'lpc-gear:Chain_Armor'
      }
    })

    expect(
      [
        'iron-sword',
        'battle-axe',
        'long-spear',
        'quick-dagger',
        'spiked-mace',
        'magic-staff',
        'Leather_Armor',
        'Leather_Helmet',
        'Chain_Armor',
        'Chain_Helmet',
        'Iron_Armor',
        'Iron_Helmet'
      ].map((itemId) => getPlayerEquipmentItemDefinitionById(itemId)?.slotId)
    ).toEqual([
      'weapon',
      'weapon',
      'weapon',
      'weapon',
      'weapon',
      'weapon',
      'armor',
      'hat',
      'armor',
      'hat',
      'armor',
      'hat'
    ])
  })
})
