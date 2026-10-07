import { describe, expect, it } from 'vitest'

import { getPlayerEquipmentItemDefinitionById } from './playerEquipment'
import { PLAYER_MAX_LEVEL } from './playerProfile'
import { TESTER_WEAPON_ITEM_IDS, createTesterPlayer } from './testerPlayer'

describe('createTesterPlayer', () => {
  it('is max level with every stat point spent and every skill maxed', () => {
    const { profile } = createTesterPlayer()

    expect(profile.level).toBe(PLAYER_MAX_LEVEL)
    expect(profile.statPoints).toBe(0)
    expect(profile.stats.agility).toBe(16)
    expect(profile.stats.luck).toBe(21)
    expect(profile.skills.every((skill) => skill.level === skill.maxLevel)).toBe(true)
  })

  it('holds one weapon of every weapon line', () => {
    const { equipment, inventory } = createTesterPlayer()
    const itemIds = [
      ...equipment.slots.map((slot) => slot.item?.id),
      ...inventory.slots.map((slot) => slot?.id)
    ]
    const lines = TESTER_WEAPON_ITEM_IDS.map((id) => getPlayerEquipmentItemDefinitionById(id)?.weaponLine)

    expect(TESTER_WEAPON_ITEM_IDS.every((id) => itemIds.includes(id))).toBe(true)
    expect(new Set(lines)).toEqual(new Set(['sword', 'axe', 'bow', 'staff']))
  })
})
