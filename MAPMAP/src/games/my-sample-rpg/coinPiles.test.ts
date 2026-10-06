import { describe, expect, it } from 'vitest'

import { createCoinPileTileKey, getCoinPileGoldAmount } from './coinPiles'

describe('getCoinPileGoldAmount', () => {
  it('returns increasing gold amounts for larger coin pile tiles', () => {
    expect(getCoinPileGoldAmount('cave_prop_gold_00')).toBe(10)
    expect(getCoinPileGoldAmount('cave_prop_gold_01')).toBe(15)
    expect(getCoinPileGoldAmount('cave_prop_gold_02')).toBe(20)
    expect(getCoinPileGoldAmount('cave_prop_gold_03')).toBe(30)
  })

  it('returns undefined for non-coin cave prop tiles', () => {
    expect(getCoinPileGoldAmount('cave_prop_rubble_00')).toBeUndefined()
    expect(getCoinPileGoldAmount('cave_shadow_00')).toBeUndefined()
    expect(getCoinPileGoldAmount('cave_prop_altar_gold_r0c0')).toBeUndefined()
  })

  it('returns undefined for tiles without a type', () => {
    expect(getCoinPileGoldAmount(undefined)).toBeUndefined()
  })
})

describe('createCoinPileTileKey', () => {
  it('joins tile coordinates into a lookup key', () => {
    expect(createCoinPileTileKey(24, 30)).toBe('24,30')
  })
})
