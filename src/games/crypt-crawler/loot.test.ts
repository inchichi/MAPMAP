import { describe, expect, it } from 'vitest'

import { rollChestLoot, rollMonsterLoot } from './loot'

// 정해진 난수열을 순서대로 돌려준다. 열이 다 떨어지면 예외로 알려 준다 — 소비 횟수가
// 계약(무기가 안 나오면 3회, 나오면 4회)에서 벗어나면 테스트가 조용히 통과하지 않게 하려는 것이다.
const rollsOf = (values: number[]): (() => number) => {
  let index = 0

  return () => {
    if (index >= values.length) {
      throw new Error('roll() was called more times than the test expected')
    }

    const value = values[index]
    index += 1

    return value
  }
}

describe('rollMonsterLoot', () => {
  it('spends exactly three rolls when no weapon drops', () => {
    const roll = rollsOf([0.5, 0.99, 0.99])
    const drop = rollMonsterLoot(5, roll)

    expect(drop).toEqual({ gold: 13, potions: 0, weapon: undefined })
    expect(() => roll()).toThrow()
  })

  it('spends a fourth roll only to choose which weapon dropped', () => {
    const roll = rollsOf([0.5, 0.99, 0.01, 0.99])
    const drop = rollMonsterLoot(5, roll)

    expect(drop.weapon?.id).toBe('pickaxe')
    expect(() => roll()).toThrow()
  })

  it('varies gold around the level average', () => {
    expect(rollMonsterLoot(5, rollsOf([0, 1, 1])).gold).toBe(8)
    expect(rollMonsterLoot(5, rollsOf([1, 1, 1])).gold).toBe(18)
    expect(rollMonsterLoot(20, rollsOf([0.5, 1, 1])).gold).toBeGreaterThan(
      rollMonsterLoot(5, rollsOf([0.5, 1, 1])).gold
    )
  })

  it('drops potions rarely', () => {
    expect(rollMonsterLoot(5, rollsOf([0.5, 0.11, 1])).potions).toBe(1)
    expect(rollMonsterLoot(5, rollsOf([0.5, 0.13, 1])).potions).toBe(0)
  })

  it('drops weapons rarely', () => {
    expect(rollMonsterLoot(5, rollsOf([0.5, 1, 0.07, 0.5])).weapon).toBeDefined()
    expect(rollMonsterLoot(5, rollsOf([0.5, 1, 0.09])).weapon).toBeUndefined()
  })

  it('keeps early zones from handing out endgame weapons', () => {
    const luckiestAtThree = rollMonsterLoot(3, rollsOf([0.5, 1, 0, 1])).weapon
    const luckiestAtThirty = rollMonsterLoot(30, rollsOf([0.5, 1, 0, 1])).weapon

    expect(luckiestAtThree?.name).toBe('몽둥이')
    expect(luckiestAtThirty?.name).toBe('대검')
  })

  it('leans toward the strong end of the pool', () => {
    const low = rollMonsterLoot(30, rollsOf([0.5, 1, 0, 0.5])).weapon
    const high = rollMonsterLoot(30, rollsOf([0.5, 1, 0, 0.9])).weapon

    // 0.5 는 균등 추첨이라면 표의 절반(10번째)인데, 치우침 덕에 14번째가 나온다.
    expect(low?.id).toBe('rapier')
    expect(high?.id).toBe('lance')
  })
})

describe('rollChestLoot', () => {
  it('spends exactly three rolls and always pays out', () => {
    const roll = rollsOf([0.5, 0.9, 0.9])
    const drop = rollChestLoot(2, 10, roll)

    expect(drop).toEqual({ gold: 144, potions: 2, weapon: undefined })
    expect(() => roll()).toThrow()
  })

  it('always yields a weapon at tier 3', () => {
    expect(rollChestLoot(3, 10, rollsOf([0.5, 0.9, 0.999, 0.5])).weapon).toBeDefined()
  })

  it('beats anything a same-level monster can drop', () => {
    const luckiestMonster = rollMonsterLoot(10, rollsOf([1, 0, 0, 1]))
    const unluckiestChest = rollChestLoot(1, 10, rollsOf([0, 1, 1]))

    expect(unluckiestChest.gold).toBeGreaterThan(luckiestMonster.gold)
    expect(unluckiestChest.potions).toBeGreaterThanOrEqual(luckiestMonster.potions)

    const luckiestChest = rollChestLoot(1, 10, rollsOf([0, 1, 0, 1]))
    expect(luckiestChest.weapon?.attack).toBeGreaterThan(luckiestMonster.weapon?.attack ?? 0)
  })

  it('scales with tier', () => {
    const small = rollChestLoot(1, 12, rollsOf([0.5, 0.9, 0.9]))
    const large = rollChestLoot(3, 12, rollsOf([0.5, 0.9, 0.9, 0.5]))

    expect(large.gold).toBe(small.gold * 3)
    expect(large.potions).toBeGreaterThan(small.potions)
    expect(small.weapon).toBeUndefined()
    expect(large.weapon).toBeDefined()
  })
})
