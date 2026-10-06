import { describe, expect, it } from 'vitest'

import {
  clearScenarios,
  getScenarioForNpc,
  isPriorityScenarioForNpc,
  registerScenarios
} from './scenarioStore'
import type { GeneratedScenarioJson } from './scenarioTypes'

const scenario: GeneratedScenarioJson = {
  scenario_id: 'demo',
  title: 'Demo',
  trigger: { type: 'talk', npc_id: 'wizard' },
  cast: ['wizard'],
  flags: [],
  entry_scene: 'start',
  scenes: [{ id: 'start', steps: [{ type: 'end' }] }]
}

describe('scenario store priority', () => {
  it('marks editor-applied scenarios as priority for their NPC', () => {
    registerScenarios([scenario], { priorityNpcIds: ['wizard'] })

    expect(getScenarioForNpc('wizard')).toBe(scenario)
    expect(isPriorityScenarioForNpc('wizard')).toBe(true)

    clearScenarios()
    expect(getScenarioForNpc('wizard')).toBeUndefined()
    expect(isPriorityScenarioForNpc('wizard')).toBe(false)
  })

  it('does not prioritize the built-in demo scenario by default', () => {
    registerScenarios([scenario])

    expect(getScenarioForNpc('wizard')).toBe(scenario)
    expect(isPriorityScenarioForNpc('wizard')).toBe(false)

    clearScenarios()
  })
})
