// 드랍 판정. 난수는 호출부가 넘긴 roll() 만 쓴다(시드 재현과 테스트를 위해 Math.random 을
// 직접 부르지 않는다). rollMonsterLoot 과 rollChestLoot 은 금화 → 물약 → 무기 여부 순으로
// 3번 소비하고, 무기가 나왔을 때만 어느 무기인지 고르느라 한 번 더 쓴다(최대 4번).

import { weaponsAvailableAt, type Weapon } from './items'

export type LootDrop = {
  gold: number
  potions: number
  /** 대부분의 판정에서는 나오지 않는다. */
  weapon?: Weapon
}

const MONSTER_GOLD_BASE = 3
const MONSTER_GOLD_PER_LEVEL = 2
const MONSTER_POTION_CHANCE = 0.12
const MONSTER_WEAPON_CHANCE = 0.08
const CHEST_GOLD_BASE = 12
const CHEST_GOLD_PER_LEVEL = 6
const CHEST_WEAPON_CHANCE_BASE = 0.5
const CHEST_WEAPON_CHANCE_PER_TIER = 0.2
// 상자는 같은 레벨의 잡몹보다 한 구간 앞선 무기를 낸다. 등급이 높을수록 더 앞선다.
const CHEST_WEAPON_DEPTH_PER_TIER = 2

/**
 * 이 깊이에서 나올 무기 하나. 후보 뒤쪽(강한 것)으로 치우치게 고른다 — 균등하게 고르면
 * 30레벨에서도 나뭇가지가 5%로 나와 내려온 보람이 없다.
 */
const pickWeapon = (level: number, roll: () => number): Weapon => {
  const available = weaponsAvailableAt(level)
  const index = Math.min(
    available.length - 1,
    Math.floor(Math.sqrt(roll()) * available.length)
  )

  return available[index]
}

export const rollMonsterLoot = (level: number, roll: () => number): LootDrop => {
  // 기대값의 60~140%. 잡몹 한 마리의 금화는 작지만 무리 단위로 모이면 체감된다.
  const gold = Math.round(
    (MONSTER_GOLD_BASE + level * MONSTER_GOLD_PER_LEVEL) * (0.6 + roll() * 0.8)
  )
  const potions = roll() < MONSTER_POTION_CHANCE ? 1 : 0
  const dropsWeapon = roll() < MONSTER_WEAPON_CHANCE

  return {
    gold,
    potions,
    weapon: dropsWeapon ? pickWeapon(level, roll) : undefined
  }
}

export const rollChestLoot = (tier: number, level: number, roll: () => number): LootDrop => {
  const gold = Math.round(
    (CHEST_GOLD_BASE + level * CHEST_GOLD_PER_LEVEL) * tier * (0.7 + roll() * 0.6)
  )

  // 상자는 빈손으로 열리지 않는다. 등급만큼은 물약이 보장되고, 무기도 등급이 높을수록
  // 확실하게 나온다(3등급은 항상).
  const potions = tier + (roll() < 0.5 ? 1 : 0)
  const dropsWeapon = roll() < CHEST_WEAPON_CHANCE_BASE + tier * CHEST_WEAPON_CHANCE_PER_TIER

  return {
    gold,
    potions,
    weapon: dropsWeapon
      ? pickWeapon(level + tier * CHEST_WEAPON_DEPTH_PER_TIER, roll)
      : undefined
  }
}
