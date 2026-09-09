// 생성된 시나리오를 사람이 읽는 대본 텍스트로 렌더링한다.
// 결과 보드·복사에서 JSON 과 함께 제공하는 검토용 형식이다 — 실행·적용은 JSON 이 원본.

import type {
  GeneratedScenarioJson,
  ScenarioCondition,
  ScenarioNode
} from '../games/my-sample-rpg/scenario/scenarioTypes'

const formatCondition = (condition: ScenarioCondition): string =>
  condition.kind === 'flag'
    ? `플래그 ${condition.flag} = ${condition.equals ? '참' : '거짓'}`
    : `퀘스트 ${condition.quest_id} 상태 = ${condition.equals}`

const formatStep = (step: ScenarioNode): string[] => {
  switch (step.type) {
    case 'say':
      return [`${step.speaker}: "${step.text}"`]
    case 'choice':
      return [
        `[선택] ${step.prompt}`,
        ...step.options.map(
          (option) =>
            `  · ${option.label} → ${option.goto}` +
            (option.show_if ? ` (표시 조건: ${formatCondition(option.show_if)})` : '')
        )
      ]
    case 'branch':
      return [`[분기] ${formatCondition(step.condition)} → 참: ${step.then_scene} / 거짓: ${step.else_scene}`]
    case 'set_flag':
      return [`[플래그] ${step.flag} ← ${step.value ? '참' : '거짓'}`]
    case 'reward': {
      const parts = [
        ...(step.gold > 0 ? [`골드 ${step.gold}`] : []),
        ...(step.experience > 0 ? [`경험치 ${step.experience}`] : []),
        ...step.items.map((item) => `${item.item_id} x${item.quantity}`)
      ]
      return [`[보상] ${parts.length > 0 ? parts.join(' · ') : '(없음)'}`]
    }
    case 'goto':
      return [`[이동] → ${step.scene}`]
    case 'end':
      return ['[종료]']
  }
}

export const formatScenarioAsText = (scenario: GeneratedScenarioJson): string => {
  const lines: string[] = [
    `${scenario.title} (${scenario.scenario_id})`,
    `트리거: ${scenario.trigger.npc_id} 에게 말 걸기`,
    `등장: ${scenario.cast.join(', ')}`,
    `플래그: ${scenario.flags.join(', ') || '(없음)'}`
  ]
  for (const scene of scenario.scenes) {
    lines.push('', `■ 장면 ${scene.id}${scene.id === scenario.entry_scene ? ' (진입)' : ''}`)
    for (const step of scene.steps) {
      lines.push(...formatStep(step).map((line) => `  ${line}`))
    }
  }
  return lines.join('\n')
}
