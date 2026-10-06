import { describe, expect, it } from 'vitest'

import { getMapLightAlpha, getMapLightKind, getMapLightScale, getMapLightStyle, isUndergroundScene } from './mapLights'

describe('mapLights', () => {
  it('lights braziers, glow plants, crystals and lit steles once per prop', () => {
    expect(getMapLightKind('cave_prop_brazier_01')).toBe('fire')
    expect(getMapLightKind('cave_prop_glow_plant_b')).toBe('glow-plant')
    expect(getMapLightKind('cave_prop_crystal_tall_r0c0')).toBe('crystal')
    // 장신 수정 아랫칸, 수정 상자, 비석 다른 칸은 빛을 겹쳐 달지 않는다
    expect(getMapLightKind('cave_prop_crystal_tall_r1c0')).toBeUndefined()
    expect(getMapLightKind('cave_prop_crate_crystal')).toBeUndefined()
    expect(getMapLightKind('ruins_stele_lit_r1c0')).toBe('stele')
    expect(getMapLightKind('ruins_stele_lit_r0c0')).toBeUndefined()
    expect(getMapLightKind('grass')).toBeUndefined()
    expect(getMapLightKind(undefined)).toBeUndefined()
  })

  it('keeps every light faint and moving around its base brightness', () => {
    for (const kind of ['fire', 'glow-plant', 'crystal', 'stele'] as const) {
      const { alpha } = getMapLightStyle(kind)
      const samples = Array.from({ length: 60 }, (_, index) => getMapLightAlpha(kind, index * 97, 0.3))
      expect(Math.max(...samples)).toBeLessThanOrEqual(alpha * 1.01)
      expect(Math.min(...samples)).toBeGreaterThan(alpha * 0.35)
      expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.01)
    }
    expect(getMapLightScale('crystal', 1234, 0)).toBe(1)
    expect(Math.abs(getMapLightScale('fire', 1234, 0) - 1)).toBeLessThanOrEqual(0.04)
  })

  it('darkens the screen edges only underground', () => {
    expect(isUndergroundScene('cave')).toBe(true)
    expect(isUndergroundScene('sunken-temple-2f')).toBe(true)
    expect(isUndergroundScene('town')).toBe(false)
    expect(isUndergroundScene('hunting-ground')).toBe(false)
  })
})
