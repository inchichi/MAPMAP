import { describe, expect, it } from 'vitest'
import { activeSelectionPath, kindLabel, validationChecks } from './createStyleChangePanel'

describe('style change panel helpers', () => {
  it('reads the per-floor applied selection file', () => {
    expect(activeSelectionPath('floor-0-town')).toBe('/crypt-style/active.json')
    expect(activeSelectionPath('floor-1-ruins')).toBe('/crypt-style/active-floor-1-ruins.json')
  })

  it('keeps only boolean validation checks, labelled in Korean when known', () => {
    expect(validationChecks({ source_hashes_unchanged: true, changed_pixels: 10, custom_check: false })).toEqual([
      { label: '원본 TMX/TSX 불변', ok: true },
      { label: 'custom_check', ok: false }
    ])
    expect(validationChecks(null)).toEqual([])
  })

  it('shows known kinds with the raw name', () => {
    expect(kindLabel('wall_deco')).toBe('벽 장식 (wall_deco)')
    expect(kindLabel('roof_blue_large')).toBe('roof_blue_large')
  })
})
