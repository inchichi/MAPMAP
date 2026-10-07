import { describe, expect, it } from 'vitest'

import { createInitialPlayerEquipment } from './playerEquipment'
import { createInitialPlayerInventory } from './playerInventory'
import { createInitialPlayerProfile } from './playerProfile'
import { createInitialPlayerSkillSlots } from './playerSkillSlots'
import {
  alignPlayerSkillsToCurrentList,
  removeRetiredItems,
  removeUnknownSkillSlotAssignments
} from './playerSaveMigration'

describe('alignPlayerSkillsToCurrentList', () => {
  it('moves levels by skill name and drops skills that left the game', () => {
    const current = createInitialPlayerProfile().skills
    // 예전 순서: 섬광 일섬 뒤에 창 스킬 3개가 있었다
    const oldSave = [
      ...current.slice(0, 12),
      { hotkey: '', label: '돌진 찌르기', description: '', level: 5, maxLevel: 5 },
      { hotkey: '', label: '회전 창술', description: '', level: 5, maxLevel: 5 },
      { hotkey: '', label: '뇌창', description: '', level: 5, maxLevel: 5 },
      ...current.slice(12).map((skill) => (skill.label === '회오리 베기' ? { ...skill, level: 3 } : skill))
    ]

    const aligned = alignPlayerSkillsToCurrentList(oldSave)

    expect(aligned.map((skill) => skill.label)).toEqual(current.map((skill) => skill.label))
    expect(aligned.find((skill) => skill.label === '회오리 베기')?.level).toBe(3)
    expect(aligned.some((skill) => skill.label === '돌진 찌르기')).toBe(false)
  })
})

describe('removeRetiredItems', () => {
  it('clears spear and mace from equipment and bag', () => {
    const equipment = createInitialPlayerEquipment()
    equipment.slots = equipment.slots.map((slot) =>
      slot.id === 'weapon' ? { ...slot, item: { id: 'long-spear', label: '장창', level: 2, description: '' } } : slot
    )
    const inventory = createInitialPlayerInventory()
    inventory.slots[3] = { id: 'spiked-mace', label: '철퇴', quantity: 1 }

    const result = removeRetiredItems({ equipment, inventory })

    expect(result.equipment.slots.find((slot) => slot.id === 'weapon')?.item).toBeUndefined()
    expect(result.inventory.slots[3]).toBeUndefined()
    expect(result.inventory.slots[0]?.id).toBe('health-potion')
  })
})

describe('removeUnknownSkillSlotAssignments', () => {
  it('empties Q/W/E/R slots that point at removed skills', () => {
    const skillSlots = createInitialPlayerSkillSlots()
    skillSlots.slots[0] = { skillId: 'lunge' }

    expect(removeUnknownSkillSlotAssignments(skillSlots).slots[0]).toBeUndefined()
  })
})
