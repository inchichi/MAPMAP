import { describe, expect, it } from 'vitest'

import { SHELL_GAME_SCENARIO } from './scenarioGoldExample'
import { formatScenarioAsText } from './scenarioTextFormat'

describe('formatScenarioAsText', () => {
  it('renders the gold example as a readable script', () => {
    const text = formatScenarioAsText(SHELL_GAME_SCENARIO)

    // 머리말: 제목·트리거·플래그 선언이 들어간다.
    expect(text).toContain(SHELL_GAME_SCENARIO.title)
    expect(text).toContain(`트리거: ${SHELL_GAME_SCENARIO.trigger.npc_id} 에게 말 걸기`)
    for (const flag of SHELL_GAME_SCENARIO.flags) {
      expect(text).toContain(flag)
    }

    // 모든 장면이 등장하고 진입 장면이 표시된다.
    for (const scene of SHELL_GAME_SCENARIO.scenes) {
      expect(text).toContain(`■ 장면 ${scene.id}`)
    }
    expect(text).toContain(`■ 장면 ${SHELL_GAME_SCENARIO.entry_scene} (진입)`)

    // 대사·선택지가 대본 형태로 나온다.
    const firstSay = SHELL_GAME_SCENARIO.scenes
      .flatMap((scene) => scene.steps)
      .find((step) => step.type === 'say')
    if (firstSay && firstSay.type === 'say') {
      expect(text).toContain(`${firstSay.speaker}: "${firstSay.text}"`)
    }
    const firstChoice = SHELL_GAME_SCENARIO.scenes
      .flatMap((scene) => scene.steps)
      .find((step) => step.type === 'choice')
    if (firstChoice && firstChoice.type === 'choice') {
      for (const option of firstChoice.options) {
        expect(text).toContain(`${option.label} → ${option.goto}`)
      }
    }
  })
})
