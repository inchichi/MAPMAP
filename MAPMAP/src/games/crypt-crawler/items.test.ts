import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  HEALTH_POTION,
  STARTING_WEAPON,
  WEAPONS,
  goldIconId,
  isBetterWeapon,
  weaponsAvailableAt
} from './items'

const assetExists = (relativePath: string): boolean =>
  existsSync(fileURLToPath(new URL(`./assets/items/${relativePath}`, import.meta.url)))

describe('WEAPONS', () => {
  it('names every weapon file that actually exists', () => {
    const missing = WEAPONS.flatMap((weapon) =>
      [`weapons/${weapon.id}.png`, `weapons/${weapon.id}_hand.png`].filter(
        (path) => !assetExists(path)
      )
    )

    expect(missing).toEqual([])
  })

  it('has no duplicate ids', () => {
    expect(new Set(WEAPONS.map((weapon) => weapon.id)).size).toBe(WEAPONS.length)
  })

  it('is ordered so that later entries are stronger and deeper', () => {
    WEAPONS.forEach((weapon, index) => {
      if (index === 0) {
        return
      }
      const previous = WEAPONS[index - 1]
      expect(weapon.attack).toBeGreaterThan(previous.attack)
      expect(weapon.minLevel).toBeGreaterThanOrEqual(previous.minLevel)
    })
  })

  it('starts the player on the weakest weapon', () => {
    expect(STARTING_WEAPON).toBe(WEAPONS[0])
    expect(STARTING_WEAPON.minLevel).toBe(1)
  })
})

describe('weaponsAvailableAt', () => {
  it('never returns an empty pool, even below level 1', () => {
    expect(weaponsAvailableAt(0).length).toBeGreaterThan(0)
    expect(weaponsAvailableAt(1).length).toBeGreaterThan(0)
  })

  it('widens with depth and never shrinks', () => {
    const shallow = weaponsAvailableAt(3)
    const deep = weaponsAvailableAt(30)

    expect(deep.length).toBe(WEAPONS.length)
    expect(deep.length).toBeGreaterThan(shallow.length)
    expect(shallow.every((weapon) => deep.includes(weapon))).toBe(true)
  })

  it('keeps endgame weapons out of the first zone', () => {
    const best = weaponsAvailableAt(3).at(-1)

    expect(best).toBeDefined()
    expect(best?.attack).toBeLessThan(WEAPONS[WEAPONS.length - 1].attack)
  })
})

describe('isBetterWeapon', () => {
  it('compares attack only, and a tie does not count as better', () => {
    const [weak, strong] = [WEAPONS[0], WEAPONS[5]]

    expect(isBetterWeapon(strong, weak)).toBe(true)
    expect(isBetterWeapon(weak, strong)).toBe(false)
    expect(isBetterWeapon(weak, weak)).toBe(false)
  })
})

describe('icons', () => {
  it('uses the silver coin for small piles and the gold coin for big ones', () => {
    expect(goldIconId(24)).toBe('silvercoin')
    expect(goldIconId(25)).toBe('goldcoin')
    expect(assetExists(`${goldIconId(1)}.png`)).toBe(true)
    expect(assetExists(`${goldIconId(999)}.png`)).toBe(true)
  })

  it('points the potion at a file that exists', () => {
    expect(assetExists(`${HEALTH_POTION.id}.png`)).toBe(true)
  })
})
