// 시나리오 v2 의 레지스트리 — "이 게임에 실재하는 것"의 목록.
//
// 스키마는 값을 모른다. enum 으로 "레지스트리에 있는 것만"이라고만 말하고, 실제 값은 여기서 온다.
// 게임 교체 = 이 파일의 교체. (검토 보고서 §5.5 의 3층 구조 중 '레지스트리' 층)

import { QUEST_DEFINITIONS, type QuestStatus } from '../games/my-sample-rpg/questLog'
import { CURRENT_GAME_PROJECT_PROFILE } from './currentGameProjectSnapshot'
import type { GameStructureProfile } from './gameStructureProfile'
import type { ScenarioRegistry } from './scenarioSchema'

// QuestStatus 타입에 묶여 있어, 유니온이 바뀌면 여기서 컴파일이 깨진다.
export const QUEST_STATUSES: QuestStatus[] = [
  'not-started',
  'active',
  'ready-to-turn-in',
  'completed'
]

export const createScenarioRegistryFromProfile = (
  profile: GameStructureProfile,
  questIds: string[]
): ScenarioRegistry => ({
  speakers: profile.npcs.map((npc) => npc.id),
  items: profile.items.map((item) => item.id),
  questIds,
  questStatuses: QUEST_STATUSES
})

// my-sample-rpg 용 레지스트리. 정적 퀘스트만 담는다 — 동적(생성) 퀘스트는 시나리오를 만드는
// 시점에 아직 없을 수 있어 조건 참조 대상으로 삼지 않는다.
export const MY_SAMPLE_RPG_SCENARIO_REGISTRY: ScenarioRegistry =
  createScenarioRegistryFromProfile(
    CURRENT_GAME_PROJECT_PROFILE,
    QUEST_DEFINITIONS.map((definition) => definition.id)
  )
