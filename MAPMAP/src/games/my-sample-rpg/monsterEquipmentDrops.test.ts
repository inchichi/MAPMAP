import { describe, expect, it } from 'vitest'

import {
  MONSTER_EQUIPMENT_DROP_BAND_LEVELS,
  MONSTER_EQUIPMENT_DROP_DEFINITIONS,
  MONSTER_POTION_DROP_BAND_LEVELS,
  MONSTER_POTION_DROP_DEFINITIONS,
  getMonsterDropBandLevel,
  rollMonsterDrop
} from './monsterEquipmentDrops'
import { getPlayerEquipmentItemDefinitionById } from './playerEquipment'
import { getPotionShopItemDefinitionById } from './potionShop'

const sequence = (...values: number[]) => () => values.shift() ?? 0

describe('getMonsterDropBandLevel', () => {
  it('picks the highest band at or below the monster level', () => {
    expect(getMonsterDropBandLevel(MONSTER_EQUIPMENT_DROP_BAND_LEVELS, 1)).toBe(1)
    expect(getMonsterDropBandLevel(MONSTER_EQUIPMENT_DROP_BAND_LEVELS, 17)).toBe(1)
    expect(getMonsterDropBandLevel(MONSTER_EQUIPMENT_DROP_BAND_LEVELS, 18)).toBe(18)
    expect(getMonsterDropBandLevel(MONSTER_EQUIPMENT_DROP_BAND_LEVELS, 49)).toBe(40)
  })

  it('steps one band down when asked, but never below the first band', () => {
    expect(getMonsterDropBandLevel(MONSTER_EQUIPMENT_DROP_BAND_LEVELS, 45, true)).toBe(18)
    expect(getMonsterDropBandLevel(MONSTER_EQUIPMENT_DROP_BAND_LEVELS, 5, true)).toBe(1)
  })
})

describe('rollMonsterDrop', () => {
  it('drops equipment from the monster level band', () => {
    // 종류 0.0(장비) → 등급 0.9(제 등급) → 인덱스 0
    expect(rollMonsterDrop({ monsterLevel: 42, random: sequence(0, 0.9, 0) })).toMatchObject({
      kind: 'equipment',
      level: 40,
      itemId: 'frost-sword'
    })
  })

  it('sometimes drops equipment one band lower', () => {
    expect(rollMonsterDrop({ monsterLevel: 42, random: sequence(0, 0.1, 0) })).toMatchObject({
      level: 18,
      itemId: 'temple-sword'
    })
  })

  it('drops a potion of the level band when no equipment drops', () => {
    expect(rollMonsterDrop({ monsterLevel: 20, random: sequence(0.3, 0.9, 0) })).toMatchObject({
      kind: 'potion',
      itemId: 'health-potion-medium'
    })
  })

  it('drops nothing (gold) on a high roll', () => {
    expect(rollMonsterDrop({ monsterLevel: 20, random: sequence(0.45) })).toBeUndefined()
  })

  it('always gives a boss equipment of its own band', () => {
    expect(rollMonsterDrop({ monsterLevel: 49, isBoss: true, random: sequence(0.99, 0.999) })).toMatchObject({
      kind: 'equipment',
      level: 40
    })
  })

  it('never drops an item above the monster level', () => {
    for (let monsterLevel = 1; monsterLevel <= 60; monsterLevel += 1) {
      for (const roll of [0, 0.1, 0.3, 0.5, 0.99]) {
        const drop = rollMonsterDrop({ monsterLevel, random: sequence(roll * 0.44, roll, roll) })

        expect(drop === undefined || drop.level <= monsterLevel).toBe(true)
      }
    }
  })
})

describe('drop definitions', () => {
  it('point at real equipment and potions of the same level band', () => {
    for (const drop of MONSTER_EQUIPMENT_DROP_DEFINITIONS) {
      const item = getPlayerEquipmentItemDefinitionById(drop.itemId)

      expect(item?.label).toBe(drop.label)
      expect(MONSTER_EQUIPMENT_DROP_BAND_LEVELS).toContain(drop.level)
      expect(getMonsterDropBandLevel(MONSTER_EQUIPMENT_DROP_BAND_LEVELS, item?.level ?? 0)).toBe(drop.level)
    }

    for (const drop of MONSTER_POTION_DROP_DEFINITIONS) {
      expect(getPotionShopItemDefinitionById(drop.itemId)?.label).toBe(drop.label)
      expect(MONSTER_POTION_DROP_BAND_LEVELS).toContain(drop.level)
    }
  })

  it('cover every weapon line and armor slot in each higher band', () => {
    for (const band of [18, 40]) {
      const slots = MONSTER_EQUIPMENT_DROP_DEFINITIONS.filter((drop) => drop.level === band).map((drop) => {
        const item = getPlayerEquipmentItemDefinitionById(drop.itemId)
        return item?.weaponLine ?? item?.slotId
      })

      expect(slots.sort()).toEqual(
        ['accessory', 'armor', 'axe', 'boots', 'bow', 'hat', 'staff', 'sword'].sort()
      )
    }
  })
})
