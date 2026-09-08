// 시나리오 스키마 v2 — 노드 그래프 DSL.
//
// 기존 생성물(이벤트 JSON / 퀘스트 JSON)은 전부 "평면 대사 배열"이라 선택지·분기·상태를 담을 자리가
// 없었다. 이 스키마는 그 자리를 만든다. LLM(생성 범위)·검증기(검사 기준)·게임(실행 형식) 셋이
// 공유하는 계약이다.
//
// 설계 제약(왜 이 모양인가):
//  - scenes 는 동적 키 맵이 아니라 배열이다. vLLM 의 문법 강제(xgrammar)가 동적 키를 못 받는다.
//  - 노드 유니온은 oneOf 가 아니라 anyOf + { type: const } 판별자다. 같은 이유.
//  - 모든 id 참조(화자·아이템·맵·씬)는 enum 으로 좁힌다. 환각 참조를 문법 수준에서 차단한다.
//  - MVP 어휘는 7종뿐이다. 노드 타입 하나가 스키마·검증·런타임·프롬프트 4층의 비용을 곱한다.
//    연출(cue/move)·minigame·wait 는 의도적으로 뺐다.

import { createStringEnumSchema, uniqueStrings, type JsonSchema } from './questPipeline'
export type {
  GeneratedScenarioJson,
  ScenarioChoiceOption,
  ScenarioCondition,
  ScenarioNode,
  ScenarioNodeType,
  ScenarioRewardItem,
  ScenarioScene,
  ScenarioTrigger
} from '../games/my-sample-rpg/scenario/scenarioTypes'
export { SCENARIO_NODE_TYPES } from '../games/my-sample-rpg/scenario/scenarioTypes'
import type { ScenarioTrigger } from '../games/my-sample-rpg/scenario/scenarioTypes'

// ---------------------------------------------------------------------------
// 레지스트리 — "이 게임에 실재하는 것"의 목록. 스키마는 enum 으로만 말하고, 값은 게임이 준다.
// 게임 교체 = 레지스트리 교체.
// ---------------------------------------------------------------------------

export type ScenarioRegistry = {
  // 화자로 쓸 수 있는 NPC id
  speakers: string[]
  // 보상으로 줄 수 있는 아이템 id
  items: string[]
  // 조건에서 참조할 수 있는 퀘스트 id
  questIds: string[]
  // 퀘스트 상태 표기(QuestStatus)
  questStatuses: string[]
}

// ---------------------------------------------------------------------------
// JSON Schema 빌더 — 생성 시점에 레지스트리로 특수화한다.
// sceneIds/flags 를 넘기면 goto·branch·set_flag 까지 좁혀진다(Stage 2 에서 Stage 1 의 선언값을 주입).
// ---------------------------------------------------------------------------

const conditionSchema = (registry: ScenarioRegistry, flags: string[]): JsonSchema => ({
  anyOf: [
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        kind: { type: 'string', const: 'flag' },
        flag: flags.length > 0 ? createStringEnumSchema(flags) : { type: 'string' },
        equals: { type: 'boolean' }
      },
      required: ['kind', 'flag', 'equals']
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        kind: { type: 'string', const: 'quest_status' },
        quest_id: createStringEnumSchema(registry.questIds),
        equals: createStringEnumSchema(registry.questStatuses)
      },
      required: ['kind', 'quest_id', 'equals']
    }
  ]
})

const nodeSchemas = (
  registry: ScenarioRegistry,
  { sceneIds, flags, cast }: { sceneIds: string[]; flags: string[]; cast: string[] }
): JsonSchema[] => {
  const sceneRef = sceneIds.length > 0 ? createStringEnumSchema(sceneIds) : { type: 'string' }
  const speakerRef = createStringEnumSchema(cast.length > 0 ? cast : registry.speakers)
  const flagRef = flags.length > 0 ? createStringEnumSchema(flags) : { type: 'string' }
  const condition = conditionSchema(registry, flags)

  return [
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: { type: 'string', const: 'say' },
        speaker: speakerRef,
        text: { type: 'string', minLength: 1 }
      },
      required: ['type', 'speaker', 'text']
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: { type: 'string', const: 'choice' },
        prompt: { type: 'string' },
        options: {
          type: 'array',
          minItems: 2,
          maxItems: 4,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              label: { type: 'string', minLength: 1 },
              goto: sceneRef,
              show_if: condition
            },
            required: ['label', 'goto']
          }
        }
      },
      required: ['type', 'prompt', 'options']
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: { type: 'string', const: 'branch' },
        condition,
        then_scene: sceneRef,
        else_scene: sceneRef
      },
      required: ['type', 'condition', 'then_scene', 'else_scene']
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: { type: 'string', const: 'set_flag' },
        flag: flagRef,
        value: { type: 'boolean' }
      },
      required: ['type', 'flag', 'value']
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: { type: 'string', const: 'reward' },
        gold: { type: 'integer', minimum: 0 },
        experience: { type: 'integer', minimum: 0 },
        items: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              item_id: createStringEnumSchema(registry.items),
              quantity: { type: 'integer', minimum: 1 }
            },
            required: ['item_id', 'quantity']
          }
        }
      },
      required: ['type', 'gold', 'experience', 'items']
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: { type: 'string', const: 'goto' },
        scene: sceneRef
      },
      required: ['type', 'scene']
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: { type: 'string', const: 'end' }
      },
      required: ['type']
    }
  ]
}

// Stage 2 용: 장면 하나의 스키마. id 는 const 로 고정하고, goto/화자/플래그 enum 은
// Stage 1 이 동결한 선언값으로 좁힌다 — 장면 단위 분할 호출(토큰 한도 회피)의 단위.
export const createScenarioSceneSchema = (
  registry: ScenarioRegistry,
  {
    sceneId,
    sceneIds,
    flags,
    cast,
    goesTo
  }: { sceneId: string; sceneIds: string[]; flags: string[]; cast: string[]; goesTo?: string[] }
): JsonSchema => {
  // 이동 노드(goto/choice/branch)의 대상은 이 장면의 goes_to 로만 좁힌다 — 골격 밖 엣지와
  // 자기 자신 goto(무한 루프)가 구조적으로 불가능해진다. goes_to 가 빈 말단 장면이면
  // 이동 노드 자체를 스키마에서 뺀다: end 로만 끝날 수 있다.
  const targetIds = goesTo ?? sceneIds
  const nodes = nodeSchemas(registry, { sceneIds: targetIds, flags, cast }).filter((node) => {
    if (targetIds.length > 0) {
      return true
    }
    const stepType = (node as { properties?: { type?: { const?: string } } }).properties?.type
      ?.const
    return stepType !== 'choice' && stepType !== 'branch' && stepType !== 'goto'
  })
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      id: { type: 'string', const: sceneId },
      steps: {
        type: 'array',
        minItems: 1,
        items: { anyOf: nodes }
      }
    },
    required: ['id', 'steps']
  }
}

// 전체 시나리오 스키마. sceneIds/flags/cast 를 주면 Stage 2 용으로 좁혀진 스키마가 나온다.
export const createScenarioSchema = (
  registry: ScenarioRegistry,
  {
    sceneIds = [],
    flags = [],
    cast = []
  }: { sceneIds?: string[]; flags?: string[]; cast?: string[] } = {}
): JsonSchema => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    scenario_id: { type: 'string', pattern: '^[a-z0-9_]+$' },
    title: { type: 'string', minLength: 1 },
    trigger: {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: { type: 'string', const: 'talk' },
        npc_id: createStringEnumSchema(registry.speakers)
      },
      required: ['type', 'npc_id']
    },
    cast: {
      type: 'array',
      minItems: 1,
      items: createStringEnumSchema(cast.length > 0 ? cast : registry.speakers)
    },
    flags: { type: 'array', items: flags.length > 0 ? createStringEnumSchema(flags) : { type: 'string' } },
    entry_scene: sceneIds.length > 0 ? createStringEnumSchema(sceneIds) : { type: 'string' },
    scenes: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: sceneIds.length > 0 ? createStringEnumSchema(sceneIds) : { type: 'string' },
          steps: {
            type: 'array',
            minItems: 1,
            items: { anyOf: nodeSchemas(registry, { sceneIds, flags, cast }) }
          }
        },
        required: ['id', 'steps']
      }
    }
  },
  required: ['scenario_id', 'title', 'trigger', 'cast', 'flags', 'entry_scene', 'scenes']
})

// Stage 1 이 만드는 골격 — 장면 id·엣지·플래그 선언·캐스트만. 대사는 아직 없다.
// 이걸 동결한 뒤 Stage 2 에서 장면별로 채우면, goto/화자/플래그 enum 이 선언값으로 좁혀져
// 환각이 구조적으로 불가능해진다.
export type ScenarioOutline = {
  scenario_id: string
  title: string
  trigger: ScenarioTrigger
  cast: string[]
  flags: string[]
  entry_scene: string
  scenes: { id: string; purpose: string; goes_to: string[] }[]
}

export const createScenarioOutlineSchema = (registry: ScenarioRegistry): JsonSchema => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    scenario_id: { type: 'string', pattern: '^[a-z0-9_]+$' },
    title: { type: 'string', minLength: 1 },
    trigger: {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: { type: 'string', const: 'talk' },
        npc_id: createStringEnumSchema(registry.speakers)
      },
      required: ['type', 'npc_id']
    },
    cast: { type: 'array', minItems: 1, items: createStringEnumSchema(registry.speakers) },
    flags: { type: 'array', items: { type: 'string', pattern: '^[a-z0-9_]+$' } },
    entry_scene: { type: 'string' },
    scenes: {
      type: 'array',
      minItems: 2,
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', pattern: '^[a-z0-9_]+$' },
          purpose: { type: 'string', minLength: 1 },
          goes_to: { type: 'array', items: { type: 'string' } }
        },
        required: ['id', 'purpose', 'goes_to']
      }
    }
  },
  required: ['scenario_id', 'title', 'trigger', 'cast', 'flags', 'entry_scene', 'scenes']
})

export const scenarioSceneIds = (outline: ScenarioOutline): string[] =>
  uniqueStrings(outline.scenes.map((scene) => scene.id))
