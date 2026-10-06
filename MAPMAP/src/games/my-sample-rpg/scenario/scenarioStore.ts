// 시나리오 등록소 + 플래그 저장소.
//
// questLog 의 동적 퀘스트 레지스트리(registerDynamicQuestDefinitions)와 같은 패턴의 모듈 전역이다.
// 플래그는 MVP 범위에서 인메모리다 — 새로고침하면 사라진다(영속은 이후 과제, 검토 보고서 §7 확장).
// 플래그 키는 시나리오 id 로 네임스페이스를 갈라, 서로 다른 시나리오의 같은 플래그 이름이
// 충돌하지 않게 한다.

import type { GeneratedScenarioJson } from './scenarioTypes'

const scenarioByNpcId = new Map<string, GeneratedScenarioJson>()
const priorityScenarioNpcIds = new Set<string>()

export type ScenarioRegistrationOptions = {
  // Scenarios explicitly applied from the editor may temporarily take priority over NPC quests.
  priorityNpcIds?: string[]
}

// 같은 NPC 에 다시 등록하면 마지막 것이 이긴다(에디터에서 갱신 적용을 단순하게).
export const registerScenarios = (
  scenarios: GeneratedScenarioJson[],
  options: ScenarioRegistrationOptions = {}
): void => {
  priorityScenarioNpcIds.clear()
  for (const npcId of options.priorityNpcIds ?? []) {
    priorityScenarioNpcIds.add(npcId)
  }

  for (const scenario of scenarios) {
    scenarioByNpcId.set(scenario.trigger.npc_id, scenario)
  }
}

export const getScenarioForNpc = (npcId: string): GeneratedScenarioJson | undefined =>
  scenarioByNpcId.get(npcId)

export const isPriorityScenarioForNpc = (npcId: string): boolean =>
  priorityScenarioNpcIds.has(npcId)

// 테스트 격리용.
export const clearScenarios = (): void => {
  scenarioByNpcId.clear()
  priorityScenarioNpcIds.clear()
}

// ---------------------------------------------------------------------------
// 플래그 저장소 (인메모리)
// ---------------------------------------------------------------------------

const flagValues = new Map<string, boolean>()

export type ScenarioFlagAccess = {
  get: (flag: string) => boolean
  set: (flag: string, value: boolean) => void
}

export const createScenarioFlagAccess = (scenarioId: string): ScenarioFlagAccess => ({
  get: (flag) => flagValues.get(`${scenarioId}:${flag}`) ?? false,
  set: (flag, value) => {
    flagValues.set(`${scenarioId}:${flag}`, value)
  }
})

// 테스트 격리용.
export const clearScenarioFlags = (): void => {
  flagValues.clear()
}
