import {
  buildFeedbackInstruction,
  type GameEntity,
  type GenerationFeedback
} from './gameAdapter'
import {
  buildLuaQuestCatalogText,
  type LuaQuestCatalog
} from './luaQuestCatalog'
import {
  generateQuestCandidatesViaCore,
  uniqueStrings,
  type QuestCandidate
} from './questPipeline'

// legend-of-lua 퀘스트 1단계 후보 생성. questCandidates(my-sample-rpg)와 같은 공통 코어를 쓰고,
// 여기선 legend 도메인(배치 엔티티 카탈로그 그라운딩)만 끼운다.

export type GenerateLuaQuestCandidatesInput = {
  apiKey: string
  userPrompt: string
  catalog: LuaQuestCatalog
  entity?: GameEntity
  gameContext?: string
  feedback?: GenerationFeedback
}

export const LUA_QUEST_CANDIDATE_COUNT = 3

const getQuestGiverNpcIds = (
  catalog: LuaQuestCatalog,
  entity?: GameEntity
): string[] =>
  entity?.kind === 'npc'
    ? uniqueStrings([entity.id])
    : uniqueStrings(catalog.npcs.map((npc) => npc.id))

const buildGroundingContext = (catalog: LuaQuestCatalog): string =>
  `\n\nAvailable NPCs: ${catalog.npcs.map((npc) => `${npc.id}(${npc.name}, map=${npc.mapId})`).join(', ') || '(none)'}\n` +
  `Available enemies: ${catalog.enemies.map((enemy) => `${enemy.id}(${enemy.name}, map=${enemy.mapId})`).join(', ') || '(none)'}\n` +
  `Available acquirables: ${catalog.acquirables.map((item) => `${item.id}(${item.name}, map=${item.mapId})`).join(', ') || '(none)'}\n` +
  `Available scenes: ${catalog.scenes.join(', ') || '(none)'}`

const createLuaQuestCandidatePrompt = (
  catalog: LuaQuestCatalog,
  entity?: GameEntity
): string => {
  const selectedNpcLine =
    entity?.kind === 'npc'
      ? `Selected NPC giver: ${entity.id} (${entity.name}). Use this id exactly as target_hint when relevant.`
      : undefined

  return [
    `You are writing quest candidate ideas for a Legend of Lua game.`,
    'Use only exact ids from the provided catalog.',
    'Do not invent new NPC ids, enemy ids, acquirable ids, or scene ids.',
    `Candidate count: ${LUA_QUEST_CANDIDATE_COUNT}.`,
    'Each candidate must be a short natural-language summary, not structured JSON.',
    'target_hint should be an NPC id when the idea clearly belongs to a specific giver; otherwise leave it blank.',
    ...(selectedNpcLine ? [selectedNpcLine] : []),
    buildLuaQuestCatalogText(catalog)
  ].join('\n')
}

export const generateLuaQuestCandidates = ({
  apiKey,
  userPrompt,
  catalog,
  entity,
  gameContext,
  feedback
}: GenerateLuaQuestCandidatesInput): Promise<QuestCandidate[]> => {
  const targetLine = entity
    ? `\n\nSelected entity: ${entity.id} (${entity.name}) on map ${entity.mapId}.`
    : ''
  const contextLine = gameContext ? `\n\nGame context: ${gameContext}` : ''
  const feedbackLine = feedback ? buildFeedbackInstruction(feedback) : ''

  return generateQuestCandidatesViaCore({
    apiKey,
    instructions: createLuaQuestCandidatePrompt(catalog, entity),
    input: `${userPrompt}${targetLine}${contextLine}${buildGroundingContext(catalog)}${feedbackLine}`,
    targetHintEnum: ['', ...getQuestGiverNpcIds(catalog, entity)],
    schemaName: 'lua_quest_candidates'
  })
}
