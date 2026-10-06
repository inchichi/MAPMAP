import {
  isLuaQuestAcquirable,
  isLuaQuestEnemy,
  isLuaQuestNpc,
  isLuaQuestScene,
  type LuaQuestCatalog
} from './luaQuestCatalog'
import { validateQuestEnvelope, type QuestValidationIssue } from './questPipeline'

// legend-of-lua용 퀘스트의 구조화 출력. my-sample-rpg의 GeneratedQuestJson과 평행하지만, 목표 타깃이
// (카탈로그/프로필이 아니라) 열린 게임에 "배치된 엔티티 id" + mapId를 가리킨다.
export type LuaQuestObjectiveType = 'defeat' | 'talk' | 'acquire' | 'reach'

export const LUA_QUEST_OBJECTIVE_TYPES: LuaQuestObjectiveType[] = [
  'defeat',
  'talk',
  'acquire',
  'reach'
]

export type GeneratedLuaQuestObjective = {
  type: LuaQuestObjectiveType
  label: string
  required: number
  target: {
    entityId?: string
    mapId?: string
  }
}

export type GeneratedLuaQuestRewardItem = {
  label: string
  quantity: number
}

export type GeneratedLuaQuestJson = {
  quest_id: string
  title: string
  giver_npc_entity_id: string
  request_text: string
  guide_text: string
  start_dialogue_lines: string[]
  active_dialogue_lines: string[]
  completion_dialogue_lines: string[]
  objectives: GeneratedLuaQuestObjective[]
  rewards: {
    gold: number
    experience: number
    items: GeneratedLuaQuestRewardItem[]
  }
}

export type GeneratedLuaQuestValidationIssue = QuestValidationIssue

// legend 목표 타깃 실존 검증(적/NPC/획득대상/씬). 공통 골격(validateQuestEnvelope)이 id/title/대사/
// required/보상 숫자를 보고, 배치 엔티티 도메인 의존인 이 부분만 콜백으로 끼운다.
const validateLuaObjectiveTarget = (
  objective: GeneratedLuaQuestObjective,
  path: string,
  catalog: LuaQuestCatalog
): GeneratedLuaQuestValidationIssue[] => {
  const entityId = objective.target.entityId
  const mapId = objective.target.mapId
  switch (objective.type) {
    case 'defeat':
      if (!entityId || !isLuaQuestEnemy(catalog, entityId)) {
        return [
          { path: `${path}.target.entityId`, message: `이 게임의 적 엔티티가 아니다: ${entityId ?? '(없음)'}` }
        ]
      }
      break
    case 'talk':
      if (!entityId || !isLuaQuestNpc(catalog, entityId)) {
        return [
          { path: `${path}.target.entityId`, message: `이 게임의 NPC 엔티티가 아니다: ${entityId ?? '(없음)'}` }
        ]
      }
      break
    case 'acquire':
      if (!entityId || !isLuaQuestAcquirable(catalog, entityId)) {
        return [
          { path: `${path}.target.entityId`, message: `이 게임의 획득 대상이 아니다: ${entityId ?? '(없음)'}` }
        ]
      }
      break
    case 'reach':
      if (!mapId || !isLuaQuestScene(catalog, mapId)) {
        return [{ path: `${path}.target.mapId`, message: `이 게임의 맵이 아니다: ${mapId ?? '(없음)'}` }]
      }
      break
  }
  return []
}

// 목표 타깃이 열린 게임에 실재하는지 검증한다 — 없는 적/NPC/씬을 가리키면 게임이 추적할 수 없다.
export const createGeneratedLuaQuestValidationIssues = (
  quest: GeneratedLuaQuestJson,
  catalog: LuaQuestCatalog
): GeneratedLuaQuestValidationIssue[] =>
  validateQuestEnvelope(quest, {
    objectiveTypes: LUA_QUEST_OBJECTIVE_TYPES,
    validateGiver: () =>
      isLuaQuestNpc(catalog, quest.giver_npc_entity_id)
        ? []
        : [
            {
              path: 'giver_npc_entity_id',
              message: `이 게임의 NPC 엔티티가 아니다: ${quest.giver_npc_entity_id}`
            }
          ],
    validateObjectiveTarget: (objective, path) =>
      validateLuaObjectiveTarget(objective, path, catalog)
  })

export const isGeneratedLuaQuestValid = (
  quest: GeneratedLuaQuestJson,
  catalog: LuaQuestCatalog
): boolean => createGeneratedLuaQuestValidationIssues(quest, catalog).length === 0
