import { describe, expect, it } from 'vitest'

import { SHELL_GAME_SCENARIO } from './scenarioGoldExample'
import { MY_SAMPLE_RPG_SCENARIO_REGISTRY } from './scenarioRegistry'
import {
  createScenarioValidationIssues,
  isGeneratedScenarioValid,
  scenarioValidationErrors
} from './scenarioValidator'
import type { GeneratedScenarioJson } from './scenarioSchema'

const registry = MY_SAMPLE_RPG_SCENARIO_REGISTRY

// 골드 예제를 깊은 복사해 한 군데만 깨뜨린다(원본 오염 방지).
const broken = (mutate: (scenario: GeneratedScenarioJson) => void): GeneratedScenarioJson => {
  const copy = structuredClone(SHELL_GAME_SCENARIO)
  mutate(copy)
  return copy
}

const errorPaths = (scenario: GeneratedScenarioJson): string[] =>
  scenarioValidationErrors(scenario, registry).map((issue) => issue.path)

const messages = (scenario: GeneratedScenarioJson): string =>
  createScenarioValidationIssues(scenario, registry)
    .map((issue) => `${issue.severity} ${issue.path}: ${issue.message}`)
    .join('\n')

describe('scenario validator', () => {
  it('accepts the hand-written gold example', () => {
    const issues = createScenarioValidationIssues(SHELL_GAME_SCENARIO, registry)
    const errors = issues.filter((issue) => issue.severity === 'error')

    expect(errors, messages(SHELL_GAME_SCENARIO)).toEqual([])
    expect(isGeneratedScenarioValid(SHELL_GAME_SCENARIO, registry)).toBe(true)
  })

  it('exercises every node type in the gold example', () => {
    const seen = new Set(
      SHELL_GAME_SCENARIO.scenes.flatMap((scene) => scene.steps.map((step) => step.type))
    )

    expect([...seen].sort()).toEqual(
      ['branch', 'choice', 'end', 'goto', 'reward', 'say', 'set_flag'].sort()
    )
  })

  it('rejects a goto to a scene that does not exist', () => {
    const scenario = broken((s) => {
      const play = s.scenes.find((scene) => scene.id === 'play_first')
      const step = play?.steps.at(-1)
      if (step?.type === 'goto') step.scene = 'no_such_scene'
    })

    expect(errorPaths(scenario)).toContain('scenes[3].steps[4].scene')
  })

  it('rejects a choice option pointing at a missing scene', () => {
    const scenario = broken((s) => {
      const greet = s.scenes.find((scene) => scene.id === 'greet_first')
      const step = greet?.steps.at(-1)
      if (step?.type === 'choice') step.options[0].goto = 'ghost_scene'
    })

    expect(errorPaths(scenario)).toContain('scenes[1].steps[2].options[0].goto')
  })

  it('rejects an entry scene that does not exist', () => {
    const scenario = broken((s) => {
      s.entry_scene = 'nowhere'
    })

    expect(errorPaths(scenario)).toContain('entry_scene')
  })

  it('rejects a speaker that is not in the cast', () => {
    const scenario = broken((s) => {
      const leave = s.scenes.find((scene) => scene.id === 'leave')
      const step = leave?.steps[0]
      if (step?.type === 'say') step.speaker = 'blacksmith'
    })

    expect(errorPaths(scenario)).toContain('scenes[6].steps[0].speaker')
  })

  it('rejects writing a flag that was never declared', () => {
    const scenario = broken((s) => {
      const play = s.scenes.find((scene) => scene.id === 'play_first')
      const step = play?.steps[3]
      if (step?.type === 'set_flag') step.flag = 'undeclared_flag'
    })

    expect(errorPaths(scenario)).toContain('scenes[3].steps[3].flag')
  })

  it('rejects reading a flag that was never declared', () => {
    const scenario = broken((s) => {
      const greet = s.scenes.find((scene) => scene.id === 'greet')
      const step = greet?.steps[0]
      if (step?.type === 'branch') step.condition = { kind: 'flag', flag: 'ghost', equals: true }
    })

    expect(errorPaths(scenario)).toContain('scenes[0].steps[0].condition.flag')
  })

  it('rejects an item that is not in the registry', () => {
    const scenario = broken((s) => {
      const prize = s.scenes.find((scene) => scene.id === 'claim_prize')
      const step = prize?.steps[1]
      if (step?.type === 'reward') step.items[0].item_id = 'legendary-cake'
    })

    expect(errorPaths(scenario)).toContain('scenes[4].steps[1].items[0].item_id')
  })

  it('rejects a scene that falls off the end without a transfer node', () => {
    const scenario = broken((s) => {
      const leave = s.scenes.find((scene) => scene.id === 'leave')
      if (leave) leave.steps = [{ type: 'say', speaker: 'wizard', text: '끝나지 않는 장면' }]
    })

    expect(errorPaths(scenario)).toContain('scenes[6].steps')
  })

  // 무한 루프 — end 에 절대 도달 못 하면 플레이어가 갇힌다.
  it('rejects a graph where a reachable scene can never reach end', () => {
    const scenario = broken((s) => {
      const leave = s.scenes.find((scene) => scene.id === 'leave')
      if (leave) {
        leave.steps = [
          { type: 'say', speaker: 'wizard', text: '돌고 도는 대사' },
          { type: 'goto', scene: 'leave' }
        ]
      }
    })

    const errors = scenarioValidationErrors(scenario, registry)
    expect(errors.some((issue) => issue.message.includes('end에 도달할 수 없다'))).toBe(true)
  })

  it('rejects a scenario with no end node at all', () => {
    const scenario: GeneratedScenarioJson = {
      scenario_id: 'loop_only',
      title: '끝없는 시나리오',
      trigger: { type: 'talk', npc_id: 'wizard' },
      cast: ['wizard'],
      flags: [],
      entry_scene: 'a',
      scenes: [
        { id: 'a', steps: [{ type: 'goto', scene: 'b' }] },
        { id: 'b', steps: [{ type: 'goto', scene: 'a' }] }
      ]
    }

    const errors = scenarioValidationErrors(scenario, registry)
    expect(errors.some((issue) => issue.message.includes('end 노드가 하나도 없다'))).toBe(true)
  })

  // 아래 둘은 차단하지 않는다(warning) — 생성물이 조금 지저분해도 실행은 된다.
  it('warns about steps placed after a transfer node', () => {
    const scenario = broken((s) => {
      const leave = s.scenes.find((scene) => scene.id === 'leave')
      leave?.steps.push({ type: 'say', speaker: 'wizard', text: '실행되지 않는 줄' })
    })

    const issues = createScenarioValidationIssues(scenario, registry)
    expect(issues.some((i) => i.severity === 'warning' && i.message.includes('실행되지 않는다'))).toBe(true)
    expect(scenarioValidationErrors(scenario, registry)).toEqual([])
  })

  it('warns about a scene unreachable from the entry scene', () => {
    const scenario = broken((s) => {
      s.scenes.push({
        id: 'orphan',
        steps: [{ type: 'say', speaker: 'wizard', text: '아무도 오지 않는 장면' }, { type: 'end' }]
      })
    })

    const issues = createScenarioValidationIssues(scenario, registry)
    expect(issues.some((i) => i.severity === 'warning' && i.message.includes('도달할 수 없는 장면'))).toBe(true)
    expect(scenarioValidationErrors(scenario, registry)).toEqual([])
  })

  it('warns about a declared flag nobody writes', () => {
    const scenario = broken((s) => {
      s.flags.push('never_written')
      const greet = s.scenes.find((scene) => scene.id === 'greet')
      const step = greet?.steps[0]
      if (step?.type === 'branch') {
        step.condition = { kind: 'flag', flag: 'never_written', equals: true }
      }
    })

    const issues = createScenarioValidationIssues(scenario, registry)
    expect(issues.some((i) => i.message.includes('항상 false다'))).toBe(true)
  })
})
