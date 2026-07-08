import {
  buildFeedbackInstruction,
  type GameEntity,
  type GenerationFeedback
} from './gameAdapter'
import type { QuestCandidate } from './questCandidates'
import {
  buildLuaQuestCatalogText,
  type LuaQuestCatalog
} from './luaQuestCatalog'
import type { GeneratedLuaQuestJson } from './luaQuestSchema'
import {
  createObjectiveSchema,
  createQuestEnvelopeSchema,
  createStringEnumSchema,
  generateQuestJsonViaCore,
  uniqueStrings,
  type JsonSchema
} from './questPipeline'

// legend-of-lua 퀘스트 2단계: 자연어(후보) → 구조화 JSON. questJsonGenerator(my-rpg)와 같은 공통 코어
// (스키마 봉투·enum 그라운딩·생성 호출)를 쓰고, 여기선 legend 도메인(배치 엔티티 카탈로그)과
// 목표 타입(defeat/talk/acquire/reach)·보상(자유 label)만 끼운다.

const getQuestGiverNpcIds = (
  catalog: LuaQuestCatalog,
  entity?: GameEntity
): string[] =>
  entity?.kind === 'npc'
    ? uniqueStrings([entity.id])
    : uniqueStrings(catalog.npcs.map((npc) => npc.id))

const createLuaQuestJsonSchema = (
  catalog: LuaQuestCatalog,
  entity?: GameEntity
): JsonSchema => {
  const questGiverNpcIds = getQuestGiverNpcIds(catalog, entity)
  const enemyIds = uniqueStrings(catalog.enemies.map((enemy) => enemy.id))
  const npcIds = uniqueStrings(catalog.npcs.map((npc) => npc.id))
  const acquirableIds = uniqueStrings(catalog.acquirables.map((item) => item.id))
  const sceneIds = uniqueStrings(catalog.scenes)

  return createQuestEnvelopeSchema({
    giverFieldName: 'giver_npc_entity_id',
    giverEnum: questGiverNpcIds,
    objectiveSchemas: [
      createObjectiveSchema(
        'defeat',
        { entityId: createStringEnumSchema(enemyIds) },
        ['entityId']
      ),
      createObjectiveSchema(
        'talk',
        { entityId: createStringEnumSchema(npcIds) },
        ['entityId']
      ),
      createObjectiveSchema(
        'acquire',
        { entityId: createStringEnumSchema(acquirableIds) },
        ['entityId']
      ),
      createObjectiveSchema(
        'reach',
        { mapId: createStringEnumSchema(sceneIds) },
        ['mapId']
      )
    ],
    rewardItemSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        label: { type: 'string', minLength: 1 },
        quantity: { type: 'integer', minimum: 1 }
      },
      required: ['label', 'quantity']
    }
  })
}

const createLuaQuestSystemPrompt = (
  catalog: LuaQuestCatalog,
  entity?: GameEntity
): string => {
  const questGiverNpcIds = getQuestGiverNpcIds(catalog, entity)
  const enemyIds = uniqueStrings(catalog.enemies.map((enemy) => enemy.id))
  const npcIds = uniqueStrings(catalog.npcs.map((npc) => npc.id))
  const acquirableIds = uniqueStrings(catalog.acquirables.map((item) => item.id))
  const sceneIds = uniqueStrings(catalog.scenes)

  const selectedNpcLine =
    entity?.kind === 'npc'
      ? `Selected NPC giver: ${entity.id} (${entity.name}). Use this id exactly as giver_npc_entity_id.`
      : undefined

  return [
    'You are writing quest JSON for a Legend of Lua game.',
    'Use only the exact ids from the provided catalog.',
    'Do not invent new giver NPC ids, enemy ids, acquirable ids, or scene ids.',
    'Return JSON only. The editor will render the Lua module after validation.',
    `Quest giver NPC ids: ${questGiverNpcIds.join(', ') || '(none)'}`,
    `Enemy ids for defeat: ${enemyIds.join(', ') || '(none)'}`,
    `NPC ids for talk: ${npcIds.join(', ') || '(none)'}`,
    `Acquirable ids for acquire: ${acquirableIds.join(', ') || '(none)'}`,
    `Scene ids for reach: ${sceneIds.join(', ') || '(none)'}`,
    'Use 1 to 3 objectives only.',
    'Reward items use free-form labels, not ids.',
    // 게임 내 비트맵 폰트가 영문만 렌더한다 — 한글은 깨진다. 화면에 뜨는 모든 텍스트를 영어로 쓰게 한다.
    'The in-game font renders English (ASCII) only. Write all in-game text — title, request_text, guide_text, every dialogue line, objective labels, and reward labels — in English even if the user prompt is in Korean. Korean text shows as broken glyphs in-game.',
    ...(selectedNpcLine ? [selectedNpcLine] : []),
    buildLuaQuestCatalogText(catalog)
  ].join('\n')
}

const createQuestTargetHint = (
  candidate?: QuestCandidate,
  entity?: GameEntity
): string => {
  const parts: string[] = []

  if (candidate) {
    parts.push(
      `Selected candidate:\n- title: ${candidate.title}\n- summary: ${candidate.summary}` +
        (candidate.target_hint ? `\n- target npc hint: ${candidate.target_hint}` : '')
    )
  }

  if (entity) {
    parts.push(`Selected entity: ${entity.id} (${entity.name}) on map ${entity.mapId}.`)
  }

  return parts.length > 0 ? `\n\n${parts.join('\n\n')}` : ''
}

export const generateLuaQuestJson = ({
  apiKey,
  userPrompt,
  catalog,
  candidate,
  feedback,
  entity
}: {
  apiKey: string
  userPrompt: string
  catalog: LuaQuestCatalog
  candidate?: QuestCandidate
  feedback?: GenerationFeedback
  entity?: GameEntity
}): Promise<GeneratedLuaQuestJson> => {
  const feedbackHint = feedback ? buildFeedbackInstruction(feedback) : ''

  return generateQuestJsonViaCore<GeneratedLuaQuestJson>({
    apiKey,
    instructions: createLuaQuestSystemPrompt(catalog, entity),
    input: `${userPrompt}${createQuestTargetHint(candidate, entity)}${feedbackHint}`,
    schemaName: 'generated_lua_quest_json',
    schema: createLuaQuestJsonSchema(catalog, entity)
  })
}
