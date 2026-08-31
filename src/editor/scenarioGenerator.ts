// 시나리오 v2 의 2단계 LLM 생성 파이프라인.
//
// Stage 1 이 그래프 골격을 소유한다: 장면 id·엣지·선언 플래그·캐스트를 먼저 생성해 동결한다.
// Stage 2 는 장면 단위로 채운다: 장면마다 별도 호출(토큰 한도 회피)하고, goto/화자/플래그 enum 을
// Stage 1 선언값으로 좁힌 스키마를 쓴다 — 없는 장면·없는 화자를 지어내는 것이 구조적으로 불가능하다.
//
// 실패 처리: 조립 결과를 결정적 검증기(scenarioValidator)에 걸고, 장면 단위 오류는 그 장면만
// 이슈를 프롬프트에 되먹여 재생성한다(장면당 제한 횟수). 봉투/전역 그래프 오류가 재시도 후에도
// 남으면 이슈와 함께 던진다 — "dry-run 통과 시에만 Apply" 게이트가 그대로 최후의 문이다.
//
// LLM 호출은 주입(generate)으로 받는다: 테스트는 네트워크 없이 모킹하고, 실사용은
// generateJsonWithLocalLlm(structuredOutput: true — json_schema 시도, 미지원 시 자동 폴백)을 쓴다.

import { generateJsonWithLocalLlm } from './localLlmGenerate'
import type { JsonSchema } from './questPipeline'
import { SHELL_GAME_SCENARIO } from './scenarioGoldExample'
import {
  createScenarioOutlineSchema,
  createScenarioSceneSchema,
  scenarioSceneIds,
  type ScenarioOutline,
  type ScenarioRegistry
} from './scenarioSchema'
import type {
  GeneratedScenarioJson,
  ScenarioScene
} from '../games/my-sample-rpg/scenario/scenarioTypes'
import {
  createScenarioValidationIssues,
  type ScenarioValidationIssue
} from './scenarioValidator'

export type ScenarioGenerateFn = <T>(args: {
  instructions: string
  input: string
  schemaName: string
  schema: JsonSchema
  maxTokens?: number
}) => Promise<T>

const defaultGenerate: ScenarioGenerateFn = (args) =>
  generateJsonWithLocalLlm({ ...args, structuredOutput: true })

export type GenerateScenarioResult = {
  scenario: GeneratedScenarioJson
  // 최종 검증 이슈. 성공 시 error 는 0이고 warning 만 남을 수 있다.
  issues: ScenarioValidationIssue[]
  // LLM 호출 총수(아웃라인 + 장면 + 재시도). 세션 지표·로깅용.
  llmCalls: number
}

export class ScenarioGenerationError extends Error {
  readonly issues: ScenarioValidationIssue[]

  constructor(message: string, issues: ScenarioValidationIssue[]) {
    super(
      issues.length === 0
        ? message
        : `${message}\n${issues.map((issue) => `- ${issue.path}: ${issue.message}`).join('\n')}`
    )
    this.name = 'ScenarioGenerationError'
    this.issues = issues
  }
}

// ---------------------------------------------------------------------------
// 프롬프트
// ---------------------------------------------------------------------------

// few-shot: 골드 예제에서 "say 묶음 + 선택지" 장면 하나를 그대로 보여준다(양식·밀도의 기준).
const FEW_SHOT_SCENE = JSON.stringify(
  SHELL_GAME_SCENARIO.scenes.find((scene) => scene.id === 'greet_first'),
  null,
  2
)

const OUTLINE_INSTRUCTIONS = [
  '너는 2D RPG 의 이벤트 시나리오 설계자다. 자연어 요청을 "장면 그래프의 골격"으로 바꾼다.',
  '골격만 만든다 — 대사는 쓰지 않는다. 각 장면의 purpose 에 그 장면에서 일어날 일을 1문장 한국어로 적는다.',
  '규칙:',
  '- 장면은 2~8개. entry_scene 은 반드시 scenes 안의 id 중 하나다.',
  '- goes_to 에는 그 장면에서 이동할 수 있는 장면 id 만 적는다(끝나는 장면이면 빈 배열).',
  '- 이야기가 상태를 가지려면 flags 를 선언한다(예: 클리어 여부, 보상 수령 여부 — snake_case).',
  '- 선택지로 갈라지는 지점과 플래그로 갈라지는 지점을 최소 1개씩 넣는다.',
  '- trigger.npc_id 와 cast 는 주어진 NPC 목록에서만 고른다.'
].join('\n')

const sceneInstructions = (outline: ScenarioOutline): string =>
  [
    '너는 2D RPG 의 이벤트 시나리오 작가다. 이미 확정된 골격의 장면 하나를 노드 시퀀스로 채운다.',
    '노드 어휘(7종): say(화자 대사) / choice(선택지) / branch(조건 분기) / set_flag(플래그 기록) /',
    'reward(보상 지급) / goto(장면 이동) / end(시나리오 종료).',
    '규칙:',
    '- 대사는 한국어로, 캐릭터의 말투를 살려 짧고 게임에 어울리게 쓴다.',
    '- 장면의 마지막은 반드시 goto / end / branch / choice 중 하나다(그냥 끝나면 안 된다).',
    '- goto·branch·choice 의 이동 대상은 골격의 goes_to 와 일치시켜라.',
    '- 조건·1회성은 선언된 플래그로 표현한다. 선언 밖의 플래그는 쓸 수 없다.',
    '- choice 옵션의 show_if 는 "조건이 참일 때만 보이는 선택지"다(예: 아직 안 받은 보상 받기).',
    '',
    `골격 전체: ${JSON.stringify(outline)}`,
    '',
    '장면 작성 예시(양식·밀도의 기준):',
    FEW_SHOT_SCENE
  ].join('\n')

const registryInput = (registry: ScenarioRegistry): string =>
  [
    `사용 가능한 NPC id: ${registry.speakers.join(', ')}`,
    `보상으로 줄 수 있는 아이템 id: ${registry.items.join(', ')}`,
    `조건에서 참조 가능한 퀘스트 id: ${registry.questIds.join(', ')}`
  ].join('\n')

// ---------------------------------------------------------------------------
// Stage 1 — 골격
// ---------------------------------------------------------------------------

// 골격의 결정적 사전 검증. 여기서 걸리면 Stage 2 비용을 쓰기 전에 한 번만 재시도한다.
export const createOutlineIssues = (
  outline: ScenarioOutline,
  registry: ScenarioRegistry
): ScenarioValidationIssue[] => {
  const issues: ScenarioValidationIssue[] = []
  const sceneIds = new Set(outline.scenes.map((scene) => scene.id))

  if (!/^[a-z0-9_]+$/u.test(outline.scenario_id)) {
    issues.push({ path: 'scenario_id', message: 'snake_case 여야 한다.', severity: 'error' })
  }
  if (!registry.speakers.includes(outline.trigger.npc_id)) {
    issues.push({
      path: 'trigger.npc_id',
      message: `이 게임의 NPC 가 아니다: ${outline.trigger.npc_id}`,
      severity: 'error'
    })
  }
  for (const speaker of outline.cast) {
    if (!registry.speakers.includes(speaker)) {
      issues.push({ path: 'cast', message: `이 게임의 NPC 가 아니다: ${speaker}`, severity: 'error' })
    }
  }
  if (!sceneIds.has(outline.entry_scene)) {
    issues.push({
      path: 'entry_scene',
      message: `scenes 에 없는 장면이다: ${outline.entry_scene}`,
      severity: 'error'
    })
  }
  if (sceneIds.size !== outline.scenes.length) {
    issues.push({ path: 'scenes', message: '장면 id 가 중복이다.', severity: 'error' })
  }
  for (const [index, scene] of outline.scenes.entries()) {
    for (const target of scene.goes_to) {
      if (!sceneIds.has(target)) {
        issues.push({
          path: `scenes[${index}].goes_to`,
          message: `scenes 에 없는 장면으로 이어진다: ${target}`,
          severity: 'error'
        })
      }
    }
  }
  return issues
}

// ---------------------------------------------------------------------------
// 파이프라인
// ---------------------------------------------------------------------------

export const generateScenarioWithLlm = async ({
  request,
  registry,
  generate = defaultGenerate,
  maxSceneRetries = 2,
  onProgress
}: {
  // 자연어 요청(예: "마법사가 야바위를 하는 할로윈 이벤트")
  request: string
  registry: ScenarioRegistry
  generate?: ScenarioGenerateFn
  maxSceneRetries?: number
  // 단계별 상태 문구(에디터 상태줄 표시용)
  onProgress?: (message: string) => void
}): Promise<GenerateScenarioResult> => {
  let llmCalls = 0

  const callOutline = async (feedback?: ScenarioValidationIssue[]) => {
    llmCalls += 1
    return generate<ScenarioOutline>({
      instructions: OUTLINE_INSTRUCTIONS,
      input: [
        registryInput(registry),
        '',
        `요청: ${request}`,
        ...(feedback && feedback.length > 0
          ? [
              '',
              '이전 시도의 문제(반드시 고쳐라):',
              ...feedback.map((issue) => `- ${issue.path}: ${issue.message}`)
            ]
          : [])
      ].join('\n'),
      schemaName: 'scenario_outline',
      schema: createScenarioOutlineSchema(registry),
      maxTokens: 2048
    })
  }

  // Stage 1: 골격 생성(+1회 재시도)
  onProgress?.('1/2단계 — 장면 골격을 생성하는 중…')
  let outline = await callOutline()
  let outlineIssues = createOutlineIssues(outline, registry)
  if (outlineIssues.length > 0) {
    outline = await callOutline(outlineIssues)
    outlineIssues = createOutlineIssues(outline, registry)
    if (outlineIssues.length > 0) {
      throw new ScenarioGenerationError('골격 생성이 검증을 통과하지 못했다.', outlineIssues)
    }
  }

  const sceneIds = scenarioSceneIds(outline)
  const frozen = { sceneIds, flags: outline.flags, cast: outline.cast }

  const callScene = async (
    sceneId: string,
    feedback?: ScenarioValidationIssue[]
  ): Promise<ScenarioScene> => {
    llmCalls += 1
    const outlineScene = outline.scenes.find((scene) => scene.id === sceneId)
    return generate<ScenarioScene>({
      instructions: sceneInstructions(outline),
      input: [
        registryInput(registry),
        '',
        `채울 장면: ${sceneId}`,
        `이 장면의 목적: ${outlineScene?.purpose ?? ''}`,
        `이 장면에서 이동 가능한 장면: ${
          outlineScene && outlineScene.goes_to.length > 0
            ? outlineScene.goes_to.join(', ')
            : '(없음 — end 로 끝나야 한다)'
        }`,
        ...(feedback && feedback.length > 0
          ? [
              '',
              '이전 시도의 문제(반드시 고쳐라):',
              ...feedback.map((issue) => `- ${issue.path}: ${issue.message}`)
            ]
          : [])
      ].join('\n'),
      schemaName: `scenario_scene_${sceneId}`,
      schema: createScenarioSceneSchema(registry, { sceneId, ...frozen }),
      maxTokens: 4096
    })
  }

  // Stage 2: 장면 채움(순차 — vLLM prefix cache 를 살리고 재시도 흐름을 단순하게 유지)
  const scenes: ScenarioScene[] = []
  for (const [index, sceneId] of sceneIds.entries()) {
    onProgress?.(`2/2단계 — 장면 채우는 중 (${index + 1}/${sceneIds.length}: ${sceneId})…`)
    scenes.push(await callScene(sceneId))
  }

  const assemble = (): GeneratedScenarioJson => ({
    scenario_id: outline.scenario_id,
    title: outline.title,
    trigger: outline.trigger,
    cast: outline.cast,
    flags: outline.flags,
    entry_scene: outline.entry_scene,
    scenes
  })

  // 검증 → 장면 단위 오류만 되먹여 재생성 → 재검증
  let issues = createScenarioValidationIssues(assemble(), registry)
  const retriesBySceneId = new Map<string, number>()

  const sceneIndexFromPath = (path: string): number | undefined => {
    const match = path.match(/^scenes\[(\d+)\]/u)
    return match ? Number(match[1]) : undefined
  }

  while (issues.some((issue) => issue.severity === 'error')) {
    const errorsByScene = new Map<number, ScenarioValidationIssue[]>()
    let hasEnvelopeError = false

    for (const issue of issues) {
      if (issue.severity !== 'error') continue
      const index = sceneIndexFromPath(issue.path)
      if (index === undefined || !scenes[index]) {
        hasEnvelopeError = true
        continue
      }
      errorsByScene.set(index, [...(errorsByScene.get(index) ?? []), issue])
    }

    // 봉투 오류는 장면 재생성으로 못 고친다 — 골격 자체가 틀렸다.
    if (hasEnvelopeError || errorsByScene.size === 0) {
      throw new ScenarioGenerationError(
        '생성된 시나리오가 검증을 통과하지 못했다.',
        issues.filter((issue) => issue.severity === 'error')
      )
    }

    for (const [index, sceneIssues] of errorsByScene) {
      const sceneId = scenes[index].id
      const attempted = retriesBySceneId.get(sceneId) ?? 0
      if (attempted >= maxSceneRetries) {
        throw new ScenarioGenerationError(
          `장면 '${sceneId}' 가 ${maxSceneRetries}회 재시도 후에도 검증을 통과하지 못했다.`,
          sceneIssues
        )
      }
      retriesBySceneId.set(sceneId, attempted + 1)
      onProgress?.(`검증 실패 장면 재생성 중 (${sceneId}, ${attempted + 1}/${maxSceneRetries})…`)
      scenes[index] = await callScene(sceneId, sceneIssues)
    }

    issues = createScenarioValidationIssues(assemble(), registry)
  }

  return { scenario: assemble(), issues, llmCalls }
}
