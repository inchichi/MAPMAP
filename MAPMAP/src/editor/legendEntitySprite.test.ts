import { describe, expect, it } from 'vitest'

import { resolveLegendEntitySpriteUrl } from './legendEntitySprite'

describe('resolveLegendEntitySpriteUrl', () => {
  it('maps an NPC appearance to its bundled sprite', () => {
    expect(resolveLegendEntitySpriteUrl('npc', 'character_wizard_purple')).toBe(
      '/legend-sprites/npc/character_wizard_purple.png'
    )
  })

  it('maps a known enemy name to a representative sprite', () => {
    expect(resolveLegendEntitySpriteUrl('enemy', 'bat')).toBe('/legend-sprites/enemies/bat.png')
  })

  it('uses a fixed chest sprite regardless of key', () => {
    expect(resolveLegendEntitySpriteUrl('chest', 'small')).toBe(
      '/legend-sprites/environment/chestClosed.png'
    )
  })

  it('maps known loot types and falls back to a coin for unknown loot', () => {
    expect(resolveLegendEntitySpriteUrl('loot', 'key')).toBe('/legend-sprites/items/key.png')
    expect(resolveLegendEntitySpriteUrl('loot', 'mystery')).toBe('/legend-sprites/items/coin.png')
  })

  it('returns null when it cannot resolve a sprite (UI falls back to an icon)', () => {
    expect(resolveLegendEntitySpriteUrl('npc', '')).toBeNull()
    expect(resolveLegendEntitySpriteUrl('enemy', 'dragon')).toBeNull()
    expect(resolveLegendEntitySpriteUrl('portal', 'whatever')).toBeNull()
  })
})
