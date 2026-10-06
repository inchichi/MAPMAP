import { describe, expect, it } from 'vitest'

import { WAYSTONES, getWaystoneIdFromCharacterId, getWaystoneMenuPage } from './waystones'

describe('waystones', () => {
  it('reads the waystone id from its map object name', () => {
    expect(getWaystoneIdFromCharacterId('waystone_reed-village')).toBe('reed-village')
    expect(getWaystoneIdFromCharacterId('waystone_nowhere')).toBeUndefined()
    expect(getWaystoneIdFromCharacterId('miren')).toBeUndefined()
  })

  it('lists discovered destinations except the current one, with a way out', () => {
    const page = getWaystoneMenuPage(['tir-chonail', 'reed-village'], 'reed-village', 0)
    expect(page.choices).toEqual(['느티골', '그만두기'])
    expect(page.targets[0]).toMatchObject({ kind: 'travel', waystone: { sceneId: 'town' } })
    expect(page.targets[1]).toEqual({ kind: 'stay' })
  })

  it('pages long lists three at a time and wraps around', () => {
    const all = WAYSTONES.map((waystone) => waystone.id)
    const first = getWaystoneMenuPage(all, 'tir-chonail', 0)
    expect(first.choices).toEqual(['물레골', '갈대골', '신전 외곽 야영지', '다음…'])
    expect(getWaystoneMenuPage(all, 'tir-chonail', 1).choices).toEqual(['서리목', '다음…'])
    const extended = [...all, 'missing']
    expect(getWaystoneMenuPage(extended, 'reed-village', 0).choices).toHaveLength(4)
  })
})
