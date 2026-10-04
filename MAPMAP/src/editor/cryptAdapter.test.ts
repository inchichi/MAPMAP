import { describe, expect, it } from 'vitest'
import { cryptAdapter, detectAdapter } from './gameAdapter'

describe('Crypt editor adapter', () => {
  it('detects Crypt maps without selecting the town adapter', () => {
    expect(detectAdapter(['floor-1-ruins.tmx', 'ninja-dungeon-16.tsx']).id).toBe('crypt-crawler')
    expect(cryptAdapter.applyMode).toBe('none')
  })
  it('uses 16 pixel coordinates and retains stair destinations', () => {
    const [entity] = cryptAdapter.extractEntities('floor-1-ruins', [{
      id: '1', name: 'stairs_up', type: 'stairs_up', group: 'stairs',
      x: 48, y: 80, width: 16, height: 16, properties: { target: 'floor-0-town' }
    }])
    expect(entity).toMatchObject({ kind: 'portal', tileX: 3, tileY: 5, target: 'floor-0-town' })
  })
})
