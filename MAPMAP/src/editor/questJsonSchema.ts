import type { GameStructureProfile } from './gameStructureProfile'
import {
  QUEST_OBJECTIVE_TYPES,
  isQuestGiverNpc,
  isQuestMonsterAppearance,
  isQuestMonsterDropItem,
  isQuestMonsterScene,
  isQuestSceneEnterScene,
  isQuestShop,
  type QuestObjectiveType
} from './questGenerationCatalog'
import { validateQuestEnvelope, type QuestValidationIssue } from './questPipeline'

export type GeneratedQuestObjective = {
  type: QuestObjectiveType
  label: string
  required: number
  target: {
    sceneId?: string
    appearanceType?: string
    itemId?: string
    shopId?: string
    npcId?: string
  }
}

export type GeneratedQuestRewardItem = {
  item_id: string
  quantity: number
}

export type GeneratedQuestJson = {
  quest_id: string
  title: string
  giver_npc_id: string
  region: string
  request_text: string
  guide_text: string
  start_dialogue_lines: string[]
  active_dialogue_lines: string[]
  completion_dialogue_lines: string[]
  objectives: GeneratedQuestObjective[]
  rewards: {
    gold: number
    experience: number
    items: GeneratedQuestRewardItem[]
  }
}

export type GeneratedQuestValidationIssue = QuestValidationIssue

export type GeneratedQuestValidationContext = {
  selectedEntityId?: string
}

// my-sample-rpg 목표 타깃 실존 검증(몬스터/아이템/상점/씬/NPC). 공통 골격(validateQuestEnvelope)이
// id/title/대사/required/보상 숫자를 보고, 도메인 의존인 이 부분만 콜백으로 끼운다.
const validateMyRpgObjectiveTarget = (
  objective: GeneratedQuestObjective,
  path: string,
  itemIds: Set<string>,
  npcIds: Set<string>
): GeneratedQuestValidationIssue[] => {
  const issues: GeneratedQuestValidationIssue[] = []
  const target = objective.target
  switch (objective.type) {
    case 'monster-defeat':
      if (!target.appearanceType || !isQuestMonsterAppearance(target.appearanceType)) {
        issues.push({
          path: `${path}.target.appearanceType`,
          message: `처치 가능한 몬스터가 아닙니다: ${target.appearanceType ?? '(없음)'}`
        })
      }
      if (!target.sceneId || !isQuestMonsterScene(target.sceneId)) {
        issues.push({
          path: `${path}.target.sceneId`,
          message: `몬스터가 등장하지 않는 씬입니다: ${target.sceneId ?? '(없음)'}`
        })
      }
      break
    case 'item-use':
      if (!target.itemId || !itemIds.has(target.itemId)) {
        issues.push({
          path: `${path}.target.itemId`,
          message: `존재하는 아이템이 아닙니다: ${target.itemId ?? '(없음)'}`
        })
      }
      break
    case 'item-acquire':
      if (!target.itemId || !isQuestMonsterDropItem(target.itemId)) {
        issues.push({
          path: `${path}.target.itemId`,
          message: `몬스터 드롭으로 획득 가능한 아이템이 아닙니다: ${target.itemId ?? '(없음)'}`
        })
      }
      break
    case 'shop-open':
      if (!target.shopId || !isQuestShop(target.shopId)) {
        issues.push({
          path: `${path}.target.shopId`,
          message: `존재하는 상점이 아닙니다: ${target.shopId ?? '(없음)'}`
        })
      }
      break
    case 'scene-enter':
      if (!target.sceneId || !isQuestSceneEnterScene(target.sceneId)) {
        issues.push({
          path: `${path}.target.sceneId`,
          message: `이동 목표로 쓸 수 없는 씬입니다(town 제외): ${target.sceneId ?? '(없음)'}`
        })
      }
      break
    case 'talk':
      if (!target.npcId || !npcIds.has(target.npcId)) {
        issues.push({
          path: `${path}.target.npcId`,
          message: `존재하는 NPC가 아닙니다: ${target.npcId ?? '(없음)'}`
        })
      }
      break
  }
  return issues
}

export const createGeneratedQuestValidationIssues = (
  quest: GeneratedQuestJson,
  profile: GameStructureProfile,
  context: GeneratedQuestValidationContext = {}
): GeneratedQuestValidationIssue[] => {
  const npcIds = new Set(profile.npcs.map((npc) => npc.id))
  const itemIds = new Set(profile.items.map((item) => item.id))

  return validateQuestEnvelope(quest, {
    objectiveTypes: QUEST_OBJECTIVE_TYPES,
    // giver: 선택 NPC가 있으면 그 id와 일치해야 하고, 없으면 카탈로그의 기버 NPC여야 한다.
    validateGiver: () => {
      const mismatch =
        !!context.selectedEntityId && quest.giver_npc_id !== context.selectedEntityId
      if (mismatch || !isQuestGiverNpc(quest.giver_npc_id)) {
        return [
          {
            path: 'giver_npc_id',
            message: mismatch
              ? `선택한 NPC가 아닌 giver_npc_id입니다: ${quest.giver_npc_id}`
              : `존재하는 NPC가 아닙니다: ${quest.giver_npc_id}`
          }
        ]
      }
      return []
    },
    validateObjectiveTarget: (objective, path) =>
      validateMyRpgObjectiveTarget(objective, path, itemIds, npcIds)
  })
}

export const isGeneratedQuestValid = (
  quest: GeneratedQuestJson,
  profile: GameStructureProfile,
  context?: GeneratedQuestValidationContext
): boolean => createGeneratedQuestValidationIssues(quest, profile, context).length === 0
