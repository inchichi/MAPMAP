// 두 게임(my-sample-rpg / legend-of-lua)이 공유하는 "퀘스트 생성 4단계" 공통 구조.
//
// 두 흐름은 ① 자연어 후보 → ② 구조화 JSON 생성 → ③ 결정적 검증 → ④ 출력 렌더 의 동일한 골격을 쓴다.
// 게임마다 다른 건 (a) 그라운딩 도메인(어떤 id가 유효한가), (b) 목표 타입·타깃, (c) 보상 item 모양,
// (d) 출력 렌더러(출력 "언어": my-rpg=QuestDefinition 객체 / legend=Lua 모듈 문자열)뿐이다.
// 이 모듈은 그 외 동일한 부분(후보 오케스트레이션·JSON 스키마 봉투·검증 골격·생성 호출)을 한곳에 모은다.
//
// 게임별 파일(questJsonGenerator/luaQuestJsonGenerator, questJsonSchema/luaQuestSchema,
// questCandidates/luaQuestCandidates)은 이 코어 위에 "그라운딩/목표/보상/렌더만 끼우는" 얇은 어댑터다.

import { generateJson } from './llmProvider'

export type JsonSchema = Record<string, unknown>

// 1단계 후보(자연어). 사람이 읽고 고르는 용도라 JSON 스키마가 아니다. 두 게임 공통 모양.
export type QuestCandidate = {
  // 한 줄 제목(카드 헤더).
  title: string
  // 2~3문장 자연어 요약.
  summary: string
  // 이 퀘스트가 붙을 NPC id(있으면). 없으면 빈 문자열.
  target_hint: string
}

// 후보 개수 기본값. 두 게임 모두 3개를 쓴다.
export const DEFAULT_QUEST_CANDIDATE_COUNT = 3

export const uniqueStrings = (values: string[]): string[] => [...new Set(values)]

// ---------------------------------------------------------------------------
// 공통: 스키마 빌더(enum 그라운딩으로 LLM이 없는 id를 지어내지 못하게 한다)
// ---------------------------------------------------------------------------

export const createStringEnumSchema = (values: string[]): JsonSchema => ({
  type: 'string',
  enum: uniqueStrings(values)
})

// 목표 1개의 스키마. type은 const로 고정하고 target은 게임이 주는 필드로만 제한한다.
export const createObjectiveSchema = (
  type: string,
  targetProperties: Record<string, JsonSchema>,
  requiredTargetFields: string[]
): JsonSchema => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    type: { type: 'string', const: type },
    label: { type: 'string', minLength: 1 },
    required: { type: 'integer', minimum: 1 },
    target: {
      type: 'object',
      additionalProperties: false,
      properties: targetProperties,
      required: requiredTargetFields
    }
  },
  required: ['type', 'label', 'required', 'target']
})

// 후보 N개를 받는 스키마. target_hint는 주어진 enum(빈 문자열 + 기버 NPC id) 중 하나여야 한다.
export const createQuestCandidatesSchema = (targetHintEnum: string[]): JsonSchema => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          target_hint: { type: 'string', enum: uniqueStrings(targetHintEnum) }
        },
        required: ['title', 'summary', 'target_hint']
      }
    }
  },
  required: ['candidates']
})

// 퀘스트 JSON 봉투(공통 필드) 스키마. 게임은 giver 필드명/enum, 목표 스키마들, 보상 item 스키마,
// 그리고 추가 필드(my-rpg의 region 등)만 끼운다. 필드 순서는 기존 스키마와 동일하게 유지한다.
export const createQuestEnvelopeSchema = ({
  giverFieldName,
  giverEnum,
  objectiveSchemas,
  rewardItemSchema,
  extraProperties = {},
  extraRequired = []
}: {
  giverFieldName: string
  giverEnum: string[]
  objectiveSchemas: JsonSchema[]
  rewardItemSchema: JsonSchema
  extraProperties?: Record<string, JsonSchema>
  extraRequired?: string[]
}): JsonSchema => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    quest_id: { type: 'string', pattern: '^[a-z0-9_]+$' },
    title: { type: 'string', minLength: 1 },
    [giverFieldName]: createStringEnumSchema(giverEnum),
    ...extraProperties,
    request_text: { type: 'string', minLength: 1 },
    guide_text: { type: 'string', minLength: 1 },
    start_dialogue_lines: {
      type: 'array',
      minItems: 1,
      items: { type: 'string', minLength: 1 }
    },
    active_dialogue_lines: {
      type: 'array',
      minItems: 1,
      items: { type: 'string', minLength: 1 }
    },
    completion_dialogue_lines: {
      type: 'array',
      minItems: 1,
      items: { type: 'string', minLength: 1 }
    },
    objectives: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: { oneOf: objectiveSchemas }
    },
    rewards: {
      type: 'object',
      additionalProperties: false,
      properties: {
        gold: { type: 'integer', minimum: 0 },
        experience: { type: 'integer', minimum: 0 },
        items: { type: 'array', items: rewardItemSchema }
      },
      required: ['gold', 'experience', 'items']
    }
  },
  required: [
    'quest_id',
    'title',
    giverFieldName,
    ...extraRequired,
    'request_text',
    'guide_text',
    'start_dialogue_lines',
    'active_dialogue_lines',
    'completion_dialogue_lines',
    'objectives',
    'rewards'
  ]
})

// ---------------------------------------------------------------------------
// 공통: 생성 호출(1단계 후보 / 2단계 JSON)
// ---------------------------------------------------------------------------

// 후보 생성 공통 오케스트레이션. 게임별 wrapper는 instructions/input/targetHintEnum/schemaName만 만든다.
// 정규화(trim)·빈 후보 제거·개수 미준수 허용(throw 안 함)은 두 게임 공통이라 여기서 처리한다.
export const generateQuestCandidatesViaCore = async ({
  apiKey,
  instructions,
  input,
  targetHintEnum,
  schemaName
}: {
  apiKey: string
  instructions: string
  input: string
  targetHintEnum: string[]
  schemaName: string
}): Promise<QuestCandidate[]> => {
  const generated = await generateJson<{ candidates: QuestCandidate[] }>({
    apiKey,
    instructions,
    input,
    schemaName,
    schema: createQuestCandidatesSchema(targetHintEnum)
  })

  return (generated.candidates ?? [])
    .map((candidate) => ({
      title: (candidate.title ?? '').trim(),
      summary: (candidate.summary ?? '').trim(),
      target_hint: (candidate.target_hint ?? '').trim()
    }))
    .filter((candidate) => candidate.title.length > 0 || candidate.summary.length > 0)
}

// 2단계 구조화 JSON 생성 공통 호출. 게임별 wrapper가 system prompt(instructions)·input·schema를 만든다.
export const generateQuestJsonViaCore = <T>({
  apiKey,
  instructions,
  input,
  schema,
  schemaName
}: {
  apiKey: string
  instructions: string
  input: string
  schema: JsonSchema
  schemaName: string
}): Promise<T> => generateJson<T>({ apiKey, instructions, input, schemaName, schema })

// ---------------------------------------------------------------------------
// 공통: 검증 골격(결정적 Validator). 게임은 giver/목표-타깃 검사만 끼운다.
// ---------------------------------------------------------------------------

export type QuestValidationIssue = { path: string; message: string }

// 검증이 보는 공통 필드. 목표 타입 O는 게임별(GeneratedQuestObjective / GeneratedLuaQuestObjective)이라
// 제네릭으로 받아, 타깃 검사 콜백이 게임의 실제 목표 타입을 그대로 다루게 한다. 각 게임의
// GeneratedQuestJson은 추가 필드(region 등, item_id/label 등)가 있어도 이 구조를 만족한다.
export type QuestEnvelopeLike<O extends { type: string; required: number }> = {
  quest_id: string
  title: string
  start_dialogue_lines: string[]
  active_dialogue_lines: string[]
  completion_dialogue_lines: string[]
  objectives: O[]
  rewards: { gold: number; experience: number; items: { quantity: number }[] }
}

const isSnakeCase = (value: string): boolean => /^[a-z0-9_]+$/u.test(value)

// 공통 검증: quest_id(snake_case)·title·시작/완료 대사·목표(타입/required)·보상(숫자/수량).
// giver 실존과 목표 타깃 실존은 게임마다 도메인이 달라, 콜백으로 위임한다.
export const validateQuestEnvelope = <O extends { type: string; required: number }>(
  quest: QuestEnvelopeLike<O>,
  {
    objectiveTypes,
    validateGiver,
    validateObjectiveTarget
  }: {
    objectiveTypes: readonly string[]
    // giver 필드명/규칙(선택 NPC 일치 등)은 게임별이라 통째로 위임한다.
    validateGiver: () => QuestValidationIssue[]
    // 목표 타입별 타깃(적/NPC/아이템/씬 실존) 검사를 위임한다.
    validateObjectiveTarget: (objective: O, path: string) => QuestValidationIssue[]
  }
): QuestValidationIssue[] => {
  const issues: QuestValidationIssue[] = []

  if (!isSnakeCase(quest.quest_id)) {
    issues.push({
      path: 'quest_id',
      message: 'quest_id는 영문 소문자·숫자·밑줄(snake_case)이어야 한다.'
    })
  }
  if (quest.title.trim().length === 0) {
    issues.push({ path: 'title', message: 'title은 비어 있을 수 없다.' })
  }

  issues.push(...validateGiver())

  if (quest.start_dialogue_lines.length === 0) {
    issues.push({
      path: 'start_dialogue_lines',
      message: '시작 대사가 최소 1줄 필요하다.'
    })
  }
  if (quest.completion_dialogue_lines.length === 0) {
    issues.push({
      path: 'completion_dialogue_lines',
      message: '완료 대사가 최소 1줄 필요하다.'
    })
  }
  if (quest.objectives.length === 0) {
    issues.push({ path: 'objectives', message: '목표가 최소 1개 필요하다.' })
  }

  quest.objectives.forEach((objective, index) => {
    const path = `objectives[${index}]`
    if (!objectiveTypes.includes(objective.type)) {
      issues.push({ path: `${path}.type`, message: `지원하지 않는 목표 타입이다: ${objective.type}` })
      return
    }
    if (!Number.isInteger(objective.required) || objective.required < 1) {
      issues.push({ path: `${path}.required`, message: 'required는 1 이상의 정수여야 한다.' })
    }
    issues.push(...validateObjectiveTarget(objective, path))
  })

  quest.rewards.items.forEach((item, index) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      issues.push({
        path: `rewards.items[${index}].quantity`,
        message: 'quantity는 1 이상의 정수여야 한다.'
      })
    }
  })
  if (!Number.isFinite(quest.rewards.gold) || quest.rewards.gold < 0) {
    issues.push({ path: 'rewards.gold', message: 'gold는 0 이상의 숫자여야 한다.' })
  }
  if (!Number.isFinite(quest.rewards.experience) || quest.rewards.experience < 0) {
    issues.push({
      path: 'rewards.experience',
      message: 'experience는 0 이상의 숫자여야 한다.'
    })
  }

  return issues
}
