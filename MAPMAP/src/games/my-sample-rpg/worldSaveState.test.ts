import { describe, expect, it } from 'vitest'

import { createInitialQuestLog } from './questLog'
import {
  WORLD_SAVE_STATE_VERSION,
  parseStoredWorldSaveState,
  serializeWorldSaveState
} from './worldSaveState'

describe('serializeWorldSaveState / parseStoredWorldSaveState', () => {
  it('round-trips collected coin tile keys per scene', () => {
    const raw = serializeWorldSaveState({
      sceneId: 'crystal-mine',
      questLog: createInitialQuestLog(),
      collectedCoinTileKeysBySceneId: {
        cave: ['24,30'],
        'crystal-mine': ['19,8', '17,3']
      }
    })

    const parsed = parseStoredWorldSaveState(raw)

    expect(parsed?.sceneId).toBe('crystal-mine')
    expect(parsed?.collectedCoinTileKeysBySceneId).toEqual({
      cave: ['24,30'],
      'crystal-mine': ['19,8', '17,3']
    })
  })

  it('keeps legacy saves without coin data loadable', () => {
    const legacyRaw = JSON.stringify({
      version: WORLD_SAVE_STATE_VERSION,
      sceneId: 'cave',
      questProgressByQuestId: {
        'quest-1': {
          status: 'active',
          objectives: { 'kill-slime': 2 },
          trackerVisible: true
        }
      }
    })

    const parsed = parseStoredWorldSaveState(legacyRaw)

    expect(parsed?.sceneId).toBe('cave')
    expect(parsed?.questProgressByQuestId['quest-1']?.status).toBe('active')
    expect(parsed?.collectedCoinTileKeysBySceneId).toEqual({})
  })

  it('filters malformed coin data without discarding the save', () => {
    const raw = JSON.stringify({
      version: WORLD_SAVE_STATE_VERSION,
      sceneId: 'cave',
      questProgressByQuestId: {},
      collectedCoinTileKeysBySceneId: {
        cave: ['24,30', 7, '24,30'],
        'crystal-mine': 'not-an-array'
      }
    })

    const parsed = parseStoredWorldSaveState(raw)

    expect(parsed?.collectedCoinTileKeysBySceneId).toEqual({
      cave: ['24,30']
    })
  })

  it('rejects saves with a different version', () => {
    const raw = JSON.stringify({
      version: WORLD_SAVE_STATE_VERSION + 1,
      sceneId: 'cave',
      questProgressByQuestId: {}
    })

    expect(parseStoredWorldSaveState(raw)).toBeUndefined()
  })

  it('rejects empty storage', () => {
    expect(parseStoredWorldSaveState(null)).toBeUndefined()
  })

  it('round-trips defeated bosses and loads older saves without them', () => {
    const raw = serializeWorldSaveState({
      sceneId: 'cave',
      questLog: createInitialQuestLog(),
      collectedCoinTileKeysBySceneId: {},
      defeatedBossIdsBySceneId: { cave: ['말캉이-보스'] }
    })

    expect(parseStoredWorldSaveState(raw)?.defeatedBossIdsBySceneId).toEqual({
      cave: ['말캉이-보스']
    })

    const legacy = JSON.parse(raw)
    delete legacy.defeatedBossIdsBySceneId
    expect(parseStoredWorldSaveState(JSON.stringify(legacy))?.defeatedBossIdsBySceneId).toEqual({})
  })

  it('round-trips visited scenes and loads older saves without them', () => {
    const raw = serializeWorldSaveState({
      sceneId: 'town',
      questLog: createInitialQuestLog(),
      collectedCoinTileKeysBySceneId: {},
      visitedSceneIds: ['town', 'cave']
    })

    expect(parseStoredWorldSaveState(raw)?.visitedSceneIds).toEqual(['town', 'cave'])

    const malformed = JSON.parse(raw)
    malformed.visitedSceneIds = ['town', 3, 'town']
    expect(parseStoredWorldSaveState(JSON.stringify(malformed))?.visitedSceneIds).toEqual(['town'])

    delete malformed.visitedSceneIds
    expect(parseStoredWorldSaveState(JSON.stringify(malformed))?.visitedSceneIds).toEqual([])
  })
})
