import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { QuestDefinition } from '../games/my-sample-rpg/questLog'

vi.mock('./safeStorage', () => {
  const storage = new Map<string, string>()

  return {
    readLocalStorage: (key: string) => storage.get(key) ?? null,
    writeLocalStorage: (key: string, value: string) => {
      storage.set(key, value)
      return true
    }
  }
})

import {
  clearPendingQuests,
  loadPendingQuests,
  replacePendingQuests,
  savePendingQuest
} from './pendingQuests'

const makeQuest = (
  id: string,
  title: string,
  giverNpcId = 'wizard'
): QuestDefinition => ({
  id,
  regionName: 'town',
  giverNpcId,
  giverName: 'Wizard',
  title,
  trackerLabel: title,
  prerequisiteQuestIds: [],
  requestText: 'Request',
  guideText: 'Guide',
  startDialogueLines: ['Start'],
  activeDialogueLines: ['Active'],
  completionDialogueLines: ['Complete'],
  objectives: [
    {
      id: `${id}_objective_1`,
      label: 'Talk',
      required: 1,
      type: 'talk',
      target: {
        npcId: 'wizard'
      }
    }
  ],
  rewards: {
    gold: 0,
    experience: 0,
    items: []
  }
})

beforeEach(() => {
  replacePendingQuests([])
})

describe('pendingQuests', () => {
  it('replaces the pending quest list with the latest quest', () => {
    const questA = makeQuest('quest-a', 'Quest A')
    const questB = makeQuest('quest-b', 'Quest B')

    savePendingQuest(questA)
    replacePendingQuests([questB])

    expect(loadPendingQuests()).toEqual([questB])
  })

  it('keeps only the latest quest for the same giver npc', () => {
    const wizardQuestA = makeQuest('quest-a', 'Quest A', 'wizard')
    const potionQuest = makeQuest(
      'quest-b',
      'Quest B',
      'potion_merchant'
    )
    const wizardQuestB = makeQuest('quest-c', 'Quest C', 'wizard')

    savePendingQuest(wizardQuestA)
    savePendingQuest(potionQuest)
    savePendingQuest(wizardQuestB)

    expect(loadPendingQuests()).toEqual([potionQuest, wizardQuestB])
  })

  it('normalizes quest lists when replacing the snapshot directly', () => {
    const wizardQuestA = makeQuest('quest-a', 'Quest A', 'wizard')
    const potionQuest = makeQuest(
      'quest-b',
      'Quest B',
      'potion_merchant'
    )
    const wizardQuestB = makeQuest('quest-c', 'Quest C', 'wizard')

    replacePendingQuests([wizardQuestA, potionQuest, wizardQuestB])

    expect(loadPendingQuests()).toEqual([potionQuest, wizardQuestB])
  })

  it('can clear pending quests entirely', () => {
    savePendingQuest(makeQuest('quest-a', 'Quest A'))

    clearPendingQuests()

    expect(loadPendingQuests()).toEqual([])
  })
})
