// 에디터 → 게임 시나리오 핸드오프(localStorage).
//
// pendingQuests 와 같은 패턴이되, 의도적으로 다른 점 하나: 게임이 부팅 시 이 키를 **지우지 않는다**.
// 시나리오 플래그는 인메모리(MVP)라, localStorage 의 시나리오 정의가 새로고침 간 유일한 지속층이다.
// (퀘스트의 clearPendingQuests 1회 소비는 두 번째 새로고침에 정의가 증발하는 지뢰였다 —
//  검토 보고서 §2.2. 같은 실수를 반복하지 않는다.)

import type { GeneratedScenarioJson } from '../games/my-sample-rpg/scenario/scenarioTypes'
import { readLocalStorage, writeLocalStorage } from './safeStorage'

export const PENDING_SCENARIOS_STORAGE_KEY = 'my-sample-rpg:pending-scenarios'

// 같은 트리거 NPC 의 옛 시나리오가 남으면 어느 것이 뜰지 모호하다 — 최신 것만 남긴다.
export const normalizePendingScenarios = (
  scenarios: GeneratedScenarioJson[]
): GeneratedScenarioJson[] => {
  const seenScenarioIds = new Set<string>()
  const seenTriggerNpcIds = new Set<string>()
  const normalized: GeneratedScenarioJson[] = []

  for (let index = scenarios.length - 1; index >= 0; index -= 1) {
    const scenario = scenarios[index]
    if (
      seenScenarioIds.has(scenario.scenario_id) ||
      seenTriggerNpcIds.has(scenario.trigger.npc_id)
    ) {
      continue
    }
    seenScenarioIds.add(scenario.scenario_id)
    seenTriggerNpcIds.add(scenario.trigger.npc_id)
    normalized.unshift(scenario)
  }

  return normalized
}

export const loadPendingScenarios = (): GeneratedScenarioJson[] => {
  const raw = readLocalStorage(PENDING_SCENARIOS_STORAGE_KEY)
  if (!raw) {
    return []
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as GeneratedScenarioJson[]) : []
  } catch {
    return []
  }
}

// 기존 목록에 더한다(같은 NPC/id 는 새 것으로 대체).
export const appendPendingScenario = (scenario: GeneratedScenarioJson): void => {
  const next = normalizePendingScenarios([...loadPendingScenarios(), scenario])
  writeLocalStorage(PENDING_SCENARIOS_STORAGE_KEY, JSON.stringify(next))
}

export const clearPendingScenarios = (): void => {
  writeLocalStorage(PENDING_SCENARIOS_STORAGE_KEY, JSON.stringify([]))
}
