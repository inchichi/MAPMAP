// 시나리오 v2 노드 그래프의 공유 타입 — 게임(실행)과 에디터(생성·검증)가 함께 쓴다.
//
// questLog 의 QuestDefinition 과 같은 원칙으로 게임 쪽에 둔다: 에디터는 게임 모듈을 import 하지만
// 그 반대는 하지 않는다. JSON Schema 빌더(LLM 생성용)는 에디터 전용이라 src/editor/scenarioSchema.ts 에 있다.

export const SCENARIO_NODE_TYPES = [
  'say',
  'choice',
  'branch',
  'set_flag',
  'reward',
  'goto',
  'end'
] as const
export type ScenarioNodeType = (typeof SCENARIO_NODE_TYPES)[number]

// 조건은 branch 와 choice 옵션의 표시 여부에 쓴다. MVP 는 플래그와 퀘스트 상태 두 가지.
export type ScenarioCondition =
  | { kind: 'flag'; flag: string; equals: boolean }
  | { kind: 'quest_status'; quest_id: string; equals: string }

export type ScenarioChoiceOption = {
  label: string
  goto: string
  // 조건이 있으면 거짓일 때 이 선택지를 목록에서 감춘다.
  // 기획서의 "한번 받은 이후엔 선택지에서 사라진다"가 이 필드다.
  show_if?: ScenarioCondition
}

export type ScenarioRewardItem = {
  item_id: string
  quantity: number
}

export type ScenarioNode =
  | { type: 'say'; speaker: string; text: string }
  | { type: 'choice'; prompt: string; options: ScenarioChoiceOption[] }
  | { type: 'branch'; condition: ScenarioCondition; then_scene: string; else_scene: string }
  | { type: 'set_flag'; flag: string; value: boolean }
  | { type: 'reward'; gold: number; experience: number; items: ScenarioRewardItem[] }
  | { type: 'goto'; scene: string }
  | { type: 'end' }

export type ScenarioScene = {
  id: string
  steps: ScenarioNode[]
}

// MVP 트리거는 talk 하나. 문 상호작용은 오브젝트 레지스트리가 없어 연기했다.
export type ScenarioTrigger = {
  type: 'talk'
  npc_id: string
}

export type GeneratedScenarioJson = {
  scenario_id: string
  title: string
  trigger: ScenarioTrigger
  // 등장 화자 선언. Stage 2 생성에서 say.speaker 의 enum 을 이 값으로 좁히는 데 쓴다.
  cast: string[]
  // 이 시나리오가 쓰는 플래그 선언. 검증기가 읽기/쓰기를 이 목록과 대조한다.
  flags: string[]
  entry_scene: string
  scenes: ScenarioScene[]
}
