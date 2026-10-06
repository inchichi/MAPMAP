import { describe, expect, it } from 'vitest'

import {
  getPoisonFogDamage,
  getRemainingImmunitySeconds,
  isPoisonFogImmune,
  isPoisonFogTileType
} from './poisonFog'

describe('poison fog', () => {
  it('hurts only on fog tiles, not on the fog wall object', () => {
    expect(isPoisonFogTileType('swamp_fog_0')).toBe(true)
    expect(isPoisonFogTileType('swamp_fog_2')).toBe(true)
    expect(isPoisonFogTileType('swamp_fog_edge_w')).toBe(true)
    expect(isPoisonFogTileType('swamp_fog_wall')).toBe(false)
    expect(isPoisonFogTileType('swamp_grass')).toBe(false)
    expect(isPoisonFogTileType(undefined)).toBe(false)
  })

  it('takes a small share of max hp per tick', () => {
    expect(getPoisonFogDamage(200)).toBe(10)
    expect(getPoisonFogDamage(20)).toBe(2)
  })

  it('is blocked while the incense burns and counts down in whole seconds', () => {
    expect(isPoisonFogImmune(10_000, 9_999)).toBe(true)
    expect(isPoisonFogImmune(10_000, 10_000)).toBe(false)
    expect(getRemainingImmunitySeconds(10_000, 1_000)).toBe(9)
    expect(getRemainingImmunitySeconds(10_000, 9_500)).toBe(1)
    expect(getRemainingImmunitySeconds(10_000, 12_000)).toBe(0)
  })
})
