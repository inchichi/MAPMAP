import type { GameStructureProfile } from './gameStructureProfile'
import {
  buildFeedbackInstruction,
  type GameEntity,
  type GenerationFeedback
} from './gameAdapter'
import {
  QUEST_MONSTERS,
  QUEST_MONSTER_DROP_ITEMS,
  QUEST_MONSTER_SCENES,
  QUEST_SCENE_ENTER_SCENES,
  QUEST_SHOPS,
  buildQuestCatalogText
} from './questGenerationCatalog'
import type { GeneratedQuestJson } from './questJsonSchema'
import type { QuestCandidate } from './questCandidates'
import {
  createObjectiveSchema,
  createQuestEnvelopeSchema,
  createStringEnumSchema,
  generateQuestJsonViaCore,
  uniqueStrings,
  type JsonSchema
} from './questPipeline'

// my-sample-rpg 퀘스트 2단계: 자연어 후보를 실제 구조화 JSON으로. legend-of-lua와 같은 공통 코어
// (스키마 봉투·enum 그라운딩·생성 호출)를 쓰고, 여기선 my-rpg 도메인(몬스터/상점/씬 카탈로그 +
// profile)과 목표 타입·보상(item_id)만 끼운다.

const getProfileNpcIds = (profile: GameStructureProfile): string[] =>
  uniqueStrings(profile.npcs.map((npc) => npc.id))

const getQuestGiverNpcIds = (
  profile: GameStructureProfile,
  entity?: GameEntity
): string[] =>
  entity?.kind === 'npc' ? uniqueStrings([entity.id]) : getProfileNpcIds(profile)

const createQuestJsonSchema = (
  profile: GameStructureProfile,
  entity?: GameEntity
): JsonSchema => {
  const regionNames = uniqueStrings(profile.maps.map((map) => map.name))
  const profileNpcIds = getProfileNpcIds(profile)
  const profileItemIds = uniqueStrings(profile.items.map((item) => item.id))
  const questGiverNpcIds = getQuestGiverNpcIds(profile, entity)
  const monsterAppearanceTypes = uniqueStrings(
    QUEST_MONSTERS.map((monster) => monster.appearanceType)
  )
  const monsterSceneIds = uniqueStrings(QUEST_MONSTER_SCENES)
  const sceneEnterSceneIds = uniqueStrings(QUEST_SCENE_ENTER_SCENES)
  const shopIds = uniqueStrings(QUEST_SHOPS.map((shop) => shop.shopId))
  const monsterDropItemIds = uniqueStrings(
    QUEST_MONSTER_DROP_ITEMS.map((item) => item.itemId)
  )

  return createQuestEnvelopeSchema({
    giverFieldName: 'giver_npc_id',
    giverEnum: questGiverNpcIds,
    extraProperties: { region: createStringEnumSchema(regionNames) },
    extraRequired: ['region'],
    objectiveSchemas: [
      createObjectiveSchema(
        'monster-defeat',
        {
          sceneId: createStringEnumSchema(monsterSceneIds),
          appearanceType: createStringEnumSchema(monsterAppearanceTypes)
        },
        ['sceneId', 'appearanceType']
      ),
      createObjectiveSchema(
        'item-use',
        { itemId: createStringEnumSchema(profileItemIds) },
        ['itemId']
      ),
      createObjectiveSchema(
        'item-acquire',
        { itemId: createStringEnumSchema(monsterDropItemIds) },
        ['itemId']
      ),
      createObjectiveSchema(
        'shop-open',
        { shopId: createStringEnumSchema(shopIds) },
        ['shopId']
      ),
      createObjectiveSchema(
        'scene-enter',
        { sceneId: createStringEnumSchema(sceneEnterSceneIds) },
        ['sceneId']
      ),
      createObjectiveSchema(
        'talk',
        { npcId: createStringEnumSchema(profileNpcIds) },
        ['npcId']
      )
    ],
    rewardItemSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        item_id: createStringEnumSchema(profileItemIds),
        quantity: { type: 'integer', minimum: 1 }
      },
      required: ['item_id', 'quantity']
    }
  })
}

const createQuestSystemPrompt = (
  profile: GameStructureProfile,
  entity?: GameEntity
): string => {
  const regionNames = uniqueStrings(profile.maps.map((map) => map.name))
  const profileNpcIds = getProfileNpcIds(profile)
  const profileItemIds = uniqueStrings(profile.items.map((item) => item.id))
  const questGiverNpcIds = getQuestGiverNpcIds(profile, entity)
  const monsterAppearanceTypes = uniqueStrings(
    QUEST_MONSTERS.map((monster) => monster.appearanceType)
  )
  const monsterSceneIds = uniqueStrings(QUEST_MONSTER_SCENES)
  const sceneEnterSceneIds = uniqueStrings(QUEST_SCENE_ENTER_SCENES)
  const shopIds = uniqueStrings(QUEST_SHOPS.map((shop) => shop.shopId))
  const monsterDropItemIds = uniqueStrings(
    QUEST_MONSTER_DROP_ITEMS.map((item) => item.itemId)
  )

  const selectedNpcLine =
    entity?.kind === 'npc'
      ? `Selected NPC giver: ${entity.id} (${entity.name}). Use this id exactly as giver_npc_id.`
      : undefined

  return [
    `You are writing quest JSON for "${profile.game_title}".`,
    'Use only the exact ids from the provided profile and catalog.',
    'Do not invent new giver_npc_id, region, sceneId, appearanceType, shopId, npcId, or itemId values.',
    `Quest giver NPC ids: ${questGiverNpcIds.join(', ')}`,
    `Region names: ${regionNames.join(', ')}`,
    `Monster appearance types: ${monsterAppearanceTypes.join(', ')}`,
    `Monster scenes: ${monsterSceneIds.join(', ')}`,
    `Scene-enter scenes: ${sceneEnterSceneIds.join(', ')}`,
    `Shop ids: ${shopIds.join(', ')}`,
    `Profile NPC ids: ${profileNpcIds.join(', ')}`,
    `Profile item ids: ${profileItemIds.join(', ')}`,
    `Monster-drop item ids for item-acquire: ${monsterDropItemIds.join(', ')}`,
    'Use profile item ids for item-use objectives and reward items.',
    'Use monster-drop item ids for item-acquire objectives.',
    ...(selectedNpcLine ? [selectedNpcLine] : []),
    'Write 1 to 3 objectives only.',
    'Use snake_case for quest_id.',
    buildQuestCatalogText()
  ].join('\n')
}

export const generateQuestJson = ({
  apiKey,
  userPrompt,
  profile,
  candidate,
  feedback,
  entity
}: {
  apiKey: string
  userPrompt: string
  profile: GameStructureProfile
  candidate?: QuestCandidate
  feedback?: GenerationFeedback
  entity?: GameEntity
}): Promise<GeneratedQuestJson> => {
  const candidateHint = candidate
    ? `\n\nSelected candidate:\n- title: ${candidate.title}\n- summary: ${candidate.summary}` +
      (candidate.target_hint ? `\n- target npc hint: ${candidate.target_hint}` : '')
    : ''
  const feedbackHint = feedback ? buildFeedbackInstruction(feedback) : ''
  const entityHint =
    entity && entity.kind === 'npc'
      ? `\n\nSelected NPC: ${entity.id} (${entity.name}) on map ${entity.mapId}.`
      : entity
        ? `\n\nSelected entity: ${entity.id} (${entity.name}) on map ${entity.mapId}.`
        : ''

  return generateQuestJsonViaCore<GeneratedQuestJson>({
    apiKey,
    instructions: createQuestSystemPrompt(profile, entity),
    input: `${userPrompt}${candidateHint}${entityHint}${feedbackHint}`,
    schemaName: 'generated_quest_json',
    schema: createQuestJsonSchema(profile, entity)
  })
}
