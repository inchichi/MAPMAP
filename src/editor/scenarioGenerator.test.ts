import { describe, expect, it } from 'vitest'

import {
  generateScenarioWithLlm,
  ScenarioGenerationError,
  type ScenarioGenerateFn
} from './scenarioGenerator'
import { MY_SAMPLE_RPG_SCENARIO_REGISTRY } from './scenarioRegistry'
import type { ScenarioOutline } from './scenarioSchema'
import type { ScenarioScene } from '../games/my-sample-rpg/scenario/scenarioTypes'

const registry = MY_SAMPLE_RPG_SCENARIO_REGISTRY

const goodOutline: ScenarioOutline = {
  scenario_id: 'test_scenario',
  title: '테스트 시나리오',
  trigger: { type: 'talk', npc_id: 'wizard' },
  cast: ['wizard'],
  flags: ['done'],
  entry_scene: 'intro',
  scenes: [
    { id: 'intro', purpose: '인사하고 마무리로 이동', goes_to: ['finish'] },
    { id: 'finish', purpose: '마무리 인사 후 종료', goes_to: [] }
  ]
}

const goodScenes: Record<string, ScenarioScene> = {
  intro: {
    id: 'intro',
    steps: [
      { type: 'say', speaker: 'wizard', text: '어서 오게.' },
      { type: 'set_flag', flag: 'done', value: true },
      { type: 'goto', scene: 'finish' }
    ]
  },
  finish: {
    id: 'finish',
    steps: [{ type: 'say', speaker: 'wizard', text: '잘 가게.' }, { type: 'end' }]
  }
}

// schemaName 으로 단계를 구분하고, 단계·장면별 응답 큐를 소진하는 모의 LLM.
const createMockGenerate = ({
  outlines,
  scenesById
}: {
  outlines: ScenarioOutline[]
  scenesById: Record<string, ScenarioScene[]>
}) => {
  const calls: { schemaName: string; input: string }[] = []
  const outlineQueue = [...outlines]
  const sceneQueues = new Map(
    Object.entries(scenesById).map(([id, queue]) => [id, [...queue]])
  )

  const generate: ScenarioGenerateFn = async ({ schemaName, input }) => {
    calls.push({ schemaName, input })
    if (schemaName === 'scenario_outline') {
      const next = outlineQueue.shift()
      if (!next) throw new Error('outline 응답 소진')
      return next as never
    }
    const sceneId = schemaName.replace('scenario_scene_', '')
    const next = sceneQueues.get(sceneId)?.shift()
    if (!next) throw new Error(`scene 응답 소진: ${sceneId}`)
    return next as never
  }

  return { generate, calls }
}

describe('scenario generator (2-stage)', () => {
  it('assembles outline + scenes into a validated scenario', async () => {
    const mock = createMockGenerate({
      outlines: [goodOutline],
      scenesById: { intro: [goodScenes.intro], finish: [goodScenes.finish] }
    })

    const result = await generateScenarioWithLlm({
      request: '마법사가 인사하는 짧은 이벤트',
      registry,
      generate: mock.generate
    })

    expect(result.scenario.scenario_id).toBe('test_scenario')
    expect(result.scenario.scenes).toHaveLength(2)
    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([])
    expect(result.llmCalls).toBe(3) // outline 1 + scene 2
  })

  it('retries the outline once with validation feedback in the prompt', async () => {
    const brokenOutline: ScenarioOutline = {
      ...goodOutline,
      entry_scene: 'ghost_entry'
    }
    const mock = createMockGenerate({
      outlines: [brokenOutline, goodOutline],
      scenesById: { intro: [goodScenes.intro], finish: [goodScenes.finish] }
    })

    const result = await generateScenarioWithLlm({
      request: '짧은 이벤트',
      registry,
      generate: mock.generate
    })

    expect(result.llmCalls).toBe(4) // outline 2 + scene 2
    // 두 번째 outline 호출의 입력에 이전 문제가 되먹여졌는지
    const secondOutlineCall = mock.calls.filter(
      (call) => call.schemaName === 'scenario_outline'
    )[1]
    expect(secondOutlineCall.input).toContain('ghost_entry')
  })

  it('regenerates only the failing scene, feeding its issues back', async () => {
    const brokenIntro: ScenarioScene = {
      id: 'intro',
      steps: [
        { type: 'say', speaker: 'wizard', text: '어서 오게.' },
        { type: 'goto', scene: 'ghost_scene' }
      ]
    }
    const mock = createMockGenerate({
      outlines: [goodOutline],
      scenesById: {
        intro: [brokenIntro, goodScenes.intro],
        finish: [goodScenes.finish]
      }
    })

    const result = await generateScenarioWithLlm({
      request: '짧은 이벤트',
      registry,
      generate: mock.generate
    })

    expect(result.llmCalls).toBe(4) // outline 1 + scene 2 + intro 재시도 1
    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([])

    const introCalls = mock.calls.filter(
      (call) => call.schemaName === 'scenario_scene_intro'
    )
    expect(introCalls).toHaveLength(2)
    expect(introCalls[1].input).toContain('ghost_scene')
    // finish 는 재생성되지 않는다
    expect(
      mock.calls.filter((call) => call.schemaName === 'scenario_scene_finish')
    ).toHaveLength(1)
  })

  it('throws with the surviving issues after scene retries are exhausted', async () => {
    const brokenIntro: ScenarioScene = {
      id: 'intro',
      steps: [{ type: 'say', speaker: 'wizard', text: '어서 오게.' }, { type: 'goto', scene: 'ghost' }]
    }
    const mock = createMockGenerate({
      outlines: [goodOutline],
      scenesById: {
        intro: [brokenIntro, brokenIntro, brokenIntro],
        finish: [goodScenes.finish]
      }
    })

    await expect(
      generateScenarioWithLlm({
        request: '짧은 이벤트',
        registry,
        generate: mock.generate,
        maxSceneRetries: 2
      })
    ).rejects.toThrowError(ScenarioGenerationError)
  })

  it('throws on a global graph error scene retries cannot fix', async () => {
    // 두 장면이 서로 goto 만 한다 — end 가 없어 전역 오류('scenes')가 남는다.
    const loopingOutline: ScenarioOutline = {
      ...goodOutline,
      scenes: [
        { id: 'intro', purpose: '루프', goes_to: ['finish'] },
        { id: 'finish', purpose: '루프', goes_to: ['intro'] }
      ]
    }
    const loopIntro: ScenarioScene = { id: 'intro', steps: [{ type: 'goto', scene: 'finish' }] }
    const loopFinish: ScenarioScene = { id: 'finish', steps: [{ type: 'goto', scene: 'intro' }] }
    const mock = createMockGenerate({
      outlines: [loopingOutline],
      scenesById: { intro: [loopIntro], finish: [loopFinish] }
    })

    await expect(
      generateScenarioWithLlm({ request: '루프', registry, generate: mock.generate })
    ).rejects.toThrowError(ScenarioGenerationError)
  })
})
