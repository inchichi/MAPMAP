import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { MONSTER_CATALOG, getMonsterCatalogEntry } from './monsterCatalog'

describe('monster catalog', () => {
  it('has one entry per appearance type, each with a label', () => {
    const types = MONSTER_CATALOG.map((entry) => entry.appearanceType)
    expect(new Set(types).size).toBe(types.length)
    for (const entry of MONSTER_CATALOG) {
      expect(entry.appearanceType).toMatch(/^monster_/)
      expect(entry.label.length).toBeGreaterThan(0)
    }
  })

  it('points every animation strip at an existing sheet with frames', () => {
    for (const entry of MONSTER_CATALOG) {
      for (const strip of Object.values(entry.spec)) {
        expect(strip.frames.length).toBeGreaterThan(0)
        expect(existsSync(fileURLToPath(strip.url))).toBe(true)
      }
    }
  })

  it('keeps stationary monsters from moving on their own', () => {
    const flower = getMonsterCatalogEntry('monster_flower')!
    expect(flower.behavior.stationary).toBe(true)
    expect(flower.behavior.chaseSpeedTilesPerSecond).toBe(0)
    expect(flower.behavior.patrolSpeedTilesPerSecond).toBe(0)
  })
})
