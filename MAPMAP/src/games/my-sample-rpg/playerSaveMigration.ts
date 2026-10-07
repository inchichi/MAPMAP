import type { PlayerEquipment } from './playerEquipment'
import { getPlayerEquipmentItemDefinitionById } from './playerEquipment'
import type { PlayerInventory } from './playerInventory'
import { createInitialPlayerProfile, type PlayerSkillSlot } from './playerProfile'
import { getPlayerSkillProfileIndex } from './playerSkills'
import type { PlayerSkillSlots } from './playerSkillSlots'

// 예전 저장본을 지금 게임에 맞춘다(main.ts 가 불러올 때 한 번 부른다).
// - 스킬: profile.skills 는 id 없이 순서로만 저장된다. 스킬이 빠지거나 늘면 순서가 밀리므로
//   지금 스킬 목록을 기준으로 이름(label)이 같은 저장 칸의 레벨을 옮긴다. 없어진 스킬은 버리고,
//   새 스킬은 0레벨로 둔다(쓴 포인트는 뒤이어 reconcilePlayerProfileWithProgressionRules 가 다시 계산해 돌려준다).
// - 아이템: 게임에서 빠진 장비(2026-10-07 창·철퇴·단검 계열)를 장비 칸과 가방에서 지운다.
// - 스킬 슬롯(Q/W/E/R): 없는 스킬을 가리키면 비운다.

export const RETIRED_ITEM_IDS: ReadonlySet<string> = new Set([
  'long-spear',
  'spiked-mace',
  'temple-spear',
  'temple-mace',
  'frost-spear',
  'frost-mace',
  'quick-dagger',
  'temple-dagger',
  'frost-dagger'
])

export const alignPlayerSkillsToCurrentList = (savedSkills: readonly PlayerSkillSlot[]): PlayerSkillSlot[] =>
  createInitialPlayerProfile().skills.map((skill) => {
    const saved = savedSkills.find((candidate) => candidate.label === skill.label)
    return saved ? { ...skill, level: Math.min(saved.level, skill.maxLevel) } : skill
  })

export const removeRetiredItems = ({
  equipment,
  inventory
}: {
  equipment: PlayerEquipment
  inventory: PlayerInventory
}): { equipment: PlayerEquipment; inventory: PlayerInventory } => ({
  equipment: {
    ...equipment,
    slots: equipment.slots.map((slot) =>
      slot.item && !getPlayerEquipmentItemDefinitionById(slot.item.id) ? { ...slot, item: undefined } : slot
    )
  },
  inventory: {
    ...inventory,
    slots: inventory.slots.map((item) => (item && RETIRED_ITEM_IDS.has(item.id) ? undefined : item))
  }
})

export const removeUnknownSkillSlotAssignments = (skillSlots: PlayerSkillSlots): PlayerSkillSlots => ({
  ...skillSlots,
  slots: skillSlots.slots.map((slot) =>
    slot && getPlayerSkillProfileIndex(slot.skillId) === undefined ? undefined : slot
  )
})
