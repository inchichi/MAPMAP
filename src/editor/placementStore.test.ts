import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  addPlacement,
  clearPlacementsForMap,
  loadPlacementsForMap,
  removePlacement
} from './placementStore'
import { installDecorationDemo, installPromptTheme, setDecorationLayerVisible, type PromptThemeApproval } from './placementStore'

// placementStore는 window.localStorage(safeStorage 경유)를 쓴다. 테스트는 node 환경이라
// 인메모리 localStorage를 window에 stub한다(테스트마다 새 저장소).
const makeStorage = (): Storage => {
  const map = new Map<string, string>()
  return {
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, String(value))
    },
    removeItem: (key) => {
      map.delete(key)
    },
    clear: () => map.clear(),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size
    }
  } as Storage
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: makeStorage() })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('placementStore', () => {
  const runId = 'a'.repeat(32)
  const approval: PromptThemeApproval = {
    id: runId, mapId: 'town', targets: ['tree_1'], placements: [{
      id: `${runId}-tree_1`, kind: 'object', col: 14, row: 12,
      imageUrl: `/theme-runs/${runId}/tree_1-decoration.png`,
      renderLayer: 'decoration', sourceGroup: 'prompt-theme', visible: true
    }]
  }
  it('applies one generated object without deleting other decorations or maps', () => {
    const ordinary = addPlacement('town', { kind: 'tile', tileId: 1 }, 0, 0)
    addPlacement('cave', { kind: 'tile', tileId: 2 }, 1, 1)
    const tree = { id: 'demo-tree_1', kind: 'object' as const, col: 13, row: 11.5, sourceGroup: 'flux-decorations-20260909', renderLayer: 'decoration' as const }
    const building = { ...tree, id: 'demo-town_hall' }
    installDecorationDemo([tree, building])
    installPromptTheme(approval)
    installPromptTheme(approval)
    expect(loadPlacementsForMap('town')).toEqual([ordinary, building, ...approval.placements])
    expect(loadPlacementsForMap('cave')).toHaveLength(1)
    setDecorationLayerVisible('town', false)
    expect(loadPlacementsForMap('town').filter(i => i.renderLayer === 'decoration').every(i => i.visible === false)).toBe(true)
  })
  it('rejects invalid generated artifact paths before changing storage', () => {
    expect(() => installPromptTheme({ ...approval, placements: [{ ...approval.placements[0], imageUrl: 'https://example.com/x.png' }] })).toThrow()
    expect(loadPlacementsForMap('town')).toEqual([])
  })
  it('replaces a complete town theme without accumulating maps or touching other placements', () => {
    const ordinary = addPlacement('town', { kind: 'tile', tileId: 1 }, 0, 0)
    const crypt = addPlacement('floor-1-ruins', { kind: 'tile', tileId: 2 }, 0, 0)
    addPlacement('town', { kind: 'object', sourceGroup: 'prompt-theme', sourceAssetId: 'decoration-map' }, 0, 0)
    installPromptTheme({ ...approval, replaceTheme: true })
    installPromptTheme({ ...approval, replaceTheme: true })
    expect(loadPlacementsForMap('town')).toEqual([ordinary, ...approval.placements])
    expect(loadPlacementsForMap('floor-1-ruins')).toEqual([crypt])
  })
  it('preserves night settings when a partial restore has no new settings', () => {
    const settings = addPlacement('town', {
      kind: 'object', sourceGroup: 'prompt-theme', renderLayer: 'decoration',
      themeSettings: { runId: 'old', night: 0.58, twinkle: true, color: { gain: [1, 1, 1], bias: [0, 0, 0] } }
    }, 0, 0)
    installPromptTheme(approval)
    expect(loadPlacementsForMap('town')).toContainEqual(settings)
  })
  it('does not apply if the previous state cannot be backed up', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(() => installPromptTheme(approval)).toThrow('백업')
    expect(loadPlacementsForMap('town')).toEqual([])
  })
  it('toggles only decorations and keeps ordinary placements unchanged', () => {
    const original = addPlacement('town', { kind: 'tile', tileId: 1 }, 0, 0)
    addPlacement('town', { kind: 'object', renderLayer: 'decoration', imageUrl: '/snow.png' }, 1, 1)
    setDecorationLayerVisible('town', false)
    expect(loadPlacementsForMap('town')[0]).toEqual(original)
    expect(loadPlacementsForMap('town')[1].visible).toBe(false)
    setDecorationLayerVisible('town', true)
    expect(loadPlacementsForMap('town')[1].visible).toBe(true)
  })
  it('installs the demo idempotently without removing user placements', () => {
    const original = addPlacement('town', { kind: 'tile', tileId: 1 }, 0, 0)
    const demo = { id: 'demo', kind: 'object' as const, col: 1, row: 1, sourceGroup: 'flux-decorations-20260909', renderLayer: 'decoration' as const }
    installDecorationDemo([demo])
    installDecorationDemo([demo])
    expect(loadPlacementsForMap('town')).toEqual([original, demo])
  })
  it('adds a placement and reads it back for the same map', () => {
    const item = addPlacement(
      'town',
      { kind: 'tile', tilesetSource: '../tilesets/town-32.tsx', tileId: 40, label: '지붕' },
      5,
      7
    )

    expect(item.id).toMatch(/^p_/)
    expect(loadPlacementsForMap('town')).toEqual([
      {
        id: item.id,
        kind: 'tile',
        tilesetSource: '../tilesets/town-32.tsx',
        tileId: 40,
        label: '지붕',
        col: 5,
        row: 7
      }
    ])
  })

  it('keeps placements separate per map', () => {
    addPlacement('town', { kind: 'object', imageUrl: '/a.png' }, 1, 1)
    addPlacement('cave', { kind: 'object', imageUrl: '/b.png' }, 2, 2)

    expect(loadPlacementsForMap('town')).toHaveLength(1)
    expect(loadPlacementsForMap('cave')).toHaveLength(1)
    expect(loadPlacementsForMap('town')[0].imageUrl).toBe('/a.png')
    expect(loadPlacementsForMap('cave')[0].imageUrl).toBe('/b.png')
  })

  it('removes a single placement by id without touching others', () => {
    const first = addPlacement('town', { kind: 'tile', tileId: 1 }, 0, 0)
    const second = addPlacement('town', { kind: 'tile', tileId: 2 }, 1, 0)

    const remaining = removePlacement('town', first.id)

    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(second.id)
    expect(loadPlacementsForMap('town')).toHaveLength(1)
  })

  it('clears all placements for a map only', () => {
    addPlacement('town', { kind: 'tile', tileId: 1 }, 0, 0)
    addPlacement('cave', { kind: 'tile', tileId: 9 }, 0, 0)

    clearPlacementsForMap('town')

    expect(loadPlacementsForMap('town')).toEqual([])
    expect(loadPlacementsForMap('cave')).toHaveLength(1)
  })

  it('returns [] for an unknown map or corrupt storage', () => {
    expect(loadPlacementsForMap('nope')).toEqual([])
    window.localStorage.setItem('my-sample-rpg:pending-placements', 'not json{')
    expect(loadPlacementsForMap('town')).toEqual([])
  })
})
