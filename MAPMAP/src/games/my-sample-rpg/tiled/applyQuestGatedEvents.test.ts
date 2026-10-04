import { describe, expect, it } from 'vitest'

import type { QuestLogState } from '../questLog'
import { applyQuestGatedEvents } from './applyQuestGatedEvents'
import type { ParsedTiledEvent, ParsedTiledMap } from './parseTiledMap'

const event = (name: string, properties: ParsedTiledEvent['properties']): ParsedTiledEvent => ({
  id: 1,
  name,
  className: 'character',
  x: 0,
  y: 0,
  width: 32,
  height: 32,
  visible: true,
  properties
})

const map = {
  eventLayers: [
    {
      id: 1,
      name: 'characters',
      opacity: 1,
      visible: true,
      events: [
        event('always', {}),
        event('shortcut', { 'quest.requiresCompleted': 'q009' }),
        event('boulder', { 'quest.hiddenWhenCompleted': 'q009' })
      ]
    }
  ]
} as unknown as ParsedTiledMap

const questLogWith = (status: 'active' | 'completed'): QuestLogState => ({
  progressByQuestId: {
    q009: { id: 'q009', status, objectives: {}, trackerVisible: true }
  }
})

const namesOf = (gated: ParsedTiledMap) => gated.eventLayers[0].events.map((item) => item.name)

describe('applyQuestGatedEvents', () => {
  it('keeps the boulder and hides the shortcut until the quest is completed', () => {
    expect(namesOf(applyQuestGatedEvents(map, questLogWith('active')))).toEqual([
      'always',
      'boulder'
    ])
  })

  it('opens the shortcut and removes the boulder once the quest is completed', () => {
    expect(namesOf(applyQuestGatedEvents(map, questLogWith('completed')))).toEqual([
      'always',
      'shortcut'
    ])
  })
})
