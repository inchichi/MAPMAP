import { describe, expect, it } from 'vitest'

import { getQuestDefinition, SLIME_BOSS_SHADOW_QUEST_ID, FIRST_SLIME_HUNT_QUEST_ID } from '../questLog'
import { describeQuestObjectiveTarget } from './questObjectiveTargetView'

describe('describeQuestObjectiveTarget', () => {
  it('names a specific boss target by the objective, and plain hunts by the monster kind', () => {
    expect(describeQuestObjectiveTarget(getQuestDefinition(SLIME_BOSS_SHADOW_QUEST_ID).objectives[0])?.label).toBe(
      '말캉이-보스'
    )
    expect(describeQuestObjectiveTarget(getQuestDefinition(FIRST_SLIME_HUNT_QUEST_ID).objectives[0])?.label).toBe('말캉이')
  })
})
