// 시나리오 v2 결정적 검증기 — LLM 을 쓰지 않는다.
//
// 기존 dry-run 은 "참조가 실재하는가"만 봤다(맵/NPC/아이템 존재). 노드 그래프는 그것만으로 부족하다:
// 없는 장면으로 goto 하거나, end 에 절대 도달 못 하거나, 선언 안 한 플래그를 읽으면 게임이 멈춘다.
// 이 검증기는 그래프 자체를 본다. 전부 결정적이라 "통과 시에만 Apply" 게이트에 그대로 걸 수 있다.

import type {
  GeneratedScenarioJson,
  ScenarioCondition,
  ScenarioNode,
  ScenarioRegistry,
  ScenarioScene
} from './scenarioSchema'

export type ScenarioValidationIssue = {
  path: string
  message: string
  // error 는 Apply 를 막는다. warning 은 표시만 한다(예: 선언했지만 안 쓰는 플래그).
  severity: 'error' | 'warning'
}

// 장면 안에서 제어를 넘기거나 끝내는 노드. 이 뒤의 스텝은 실행되지 않는다.
const isTransferNode = (node: ScenarioNode): boolean =>
  node.type === 'goto' || node.type === 'end' || node.type === 'branch' || node.type === 'choice'

// 한 장면이 실제로 실행하는 스텝(첫 제어 이동 노드까지). 그 뒤는 죽은 코드다.
const liveSteps = (scene: ScenarioScene): ScenarioNode[] => {
  const index = scene.steps.findIndex(isTransferNode)
  return index < 0 ? scene.steps : scene.steps.slice(0, index + 1)
}

const successorsOf = (scene: ScenarioScene): string[] => {
  const last = liveSteps(scene).at(-1)
  if (!last) return []
  if (last.type === 'goto') return [last.scene]
  if (last.type === 'branch') return [last.then_scene, last.else_scene]
  if (last.type === 'choice') return last.options.map((option) => option.goto)
  return []
}

const endsHere = (scene: ScenarioScene): boolean => liveSteps(scene).at(-1)?.type === 'end'

export const createScenarioValidationIssues = (
  scenario: GeneratedScenarioJson,
  registry: ScenarioRegistry
): ScenarioValidationIssue[] => {
  const issues: ScenarioValidationIssue[] = []
  const error = (path: string, message: string) =>
    issues.push({ path, message, severity: 'error' })
  const warn = (path: string, message: string) =>
    issues.push({ path, message, severity: 'warning' })

  // ---- 봉투 ----
  if (!/^[a-z0-9_]+$/u.test(scenario.scenario_id)) {
    error('scenario_id', 'scenario_id는 영문 소문자·숫자·밑줄이어야 한다.')
  }
  if (scenario.title.trim().length === 0) {
    error('title', 'title은 비어 있을 수 없다.')
  }
  if (!registry.speakers.includes(scenario.trigger.npc_id)) {
    error('trigger.npc_id', `이 게임의 NPC가 아니다: ${scenario.trigger.npc_id}`)
  }
  for (const [index, speaker] of scenario.cast.entries()) {
    if (!registry.speakers.includes(speaker)) {
      error(`cast[${index}]`, `이 게임의 NPC가 아니다: ${speaker}`)
    }
  }
  if (scenario.cast.length === 0) {
    error('cast', 'cast는 최소 1명이 필요하다.')
  }

  // ---- 장면 id ----
  const sceneById = new Map<string, ScenarioScene>()
  for (const [index, scene] of scenario.scenes.entries()) {
    if (sceneById.has(scene.id)) {
      error(`scenes[${index}].id`, `장면 id가 중복이다: ${scene.id}`)
      continue
    }
    sceneById.set(scene.id, scene)
  }
  if (!sceneById.has(scenario.entry_scene)) {
    error('entry_scene', `존재하지 않는 장면이다: ${scenario.entry_scene}`)
  }

  // ---- 노드별 검사 + 플래그 사용 수집 ----
  const declaredFlags = new Set(scenario.flags)
  const writtenFlags = new Set<string>()
  const readFlags = new Set<string>()

  const checkCondition = (condition: ScenarioCondition, path: string) => {
    if (condition.kind === 'flag') {
      readFlags.add(condition.flag)
      if (!declaredFlags.has(condition.flag)) {
        error(`${path}.flag`, `flags에 선언되지 않은 플래그를 읽는다: ${condition.flag}`)
      }
      return
    }
    if (!registry.questIds.includes(condition.quest_id)) {
      error(`${path}.quest_id`, `이 게임의 퀘스트가 아니다: ${condition.quest_id}`)
    }
    if (!registry.questStatuses.includes(condition.equals)) {
      error(`${path}.equals`, `알 수 없는 퀘스트 상태다: ${condition.equals}`)
    }
  }

  const checkSceneRef = (sceneId: string, path: string) => {
    if (!sceneById.has(sceneId)) {
      error(path, `존재하지 않는 장면으로 이동한다: ${sceneId}`)
    }
  }

  for (const [sceneIndex, scene] of scenario.scenes.entries()) {
    const scenePath = `scenes[${sceneIndex}]`

    if (scene.steps.length === 0) {
      error(`${scenePath}.steps`, '장면에 스텝이 최소 1개 필요하다.')
      continue
    }

    const live = liveSteps(scene)
    if (live.length < scene.steps.length) {
      warn(
        `${scenePath}.steps[${live.length}]`,
        `제어 이동 노드(${live.at(-1)?.type}) 뒤의 스텝 ${scene.steps.length - live.length}개는 실행되지 않는다.`
      )
    }
    if (!isTransferNode(live.at(-1) as ScenarioNode)) {
      error(
        `${scenePath}.steps`,
        `장면 '${scene.id}'이 goto/end/branch/choice 없이 끝난다 — 다음에 무엇을 할지 정의되지 않았다.`
      )
    }

    for (const [stepIndex, node] of live.entries()) {
      const path = `${scenePath}.steps[${stepIndex}]`

      switch (node.type) {
        case 'say':
          if (!scenario.cast.includes(node.speaker)) {
            error(`${path}.speaker`, `cast에 없는 화자다: ${node.speaker}`)
          }
          if (node.text.trim().length === 0) {
            error(`${path}.text`, '대사가 비어 있다.')
          }
          break

        case 'choice':
          if (node.options.length < 2) {
            error(`${path}.options`, '선택지는 최소 2개가 필요하다.')
          }
          for (const [optionIndex, option] of node.options.entries()) {
            const optionPath = `${path}.options[${optionIndex}]`
            if (option.label.trim().length === 0) {
              error(`${optionPath}.label`, '선택지 라벨이 비어 있다.')
            }
            checkSceneRef(option.goto, `${optionPath}.goto`)
            if (option.show_if) {
              checkCondition(option.show_if, `${optionPath}.show_if`)
            }
          }
          // 조건 없는 선택지가 하나도 없으면 전부 숨겨져 막힐 수 있다.
          if (node.options.length > 0 && node.options.every((option) => option.show_if)) {
            warn(
              `${path}.options`,
              '모든 선택지에 조건이 걸려 있다 — 전부 거짓이면 플레이어가 진행할 수 없다.'
            )
          }
          break

        case 'branch':
          checkCondition(node.condition, `${path}.condition`)
          checkSceneRef(node.then_scene, `${path}.then_scene`)
          checkSceneRef(node.else_scene, `${path}.else_scene`)
          break

        case 'set_flag':
          writtenFlags.add(node.flag)
          if (!declaredFlags.has(node.flag)) {
            error(`${path}.flag`, `flags에 선언되지 않은 플래그에 쓴다: ${node.flag}`)
          }
          break

        case 'reward':
          if (!Number.isInteger(node.gold) || node.gold < 0) {
            error(`${path}.gold`, 'gold는 0 이상의 정수여야 한다.')
          }
          if (!Number.isInteger(node.experience) || node.experience < 0) {
            error(`${path}.experience`, 'experience는 0 이상의 정수여야 한다.')
          }
          for (const [itemIndex, item] of node.items.entries()) {
            if (!registry.items.includes(item.item_id)) {
              error(`${path}.items[${itemIndex}].item_id`, `이 게임의 아이템이 아니다: ${item.item_id}`)
            }
            if (!Number.isInteger(item.quantity) || item.quantity < 1) {
              error(`${path}.items[${itemIndex}].quantity`, 'quantity는 1 이상의 정수여야 한다.')
            }
          }
          if (node.gold === 0 && node.experience === 0 && node.items.length === 0) {
            warn(`${path}`, '아무것도 지급하지 않는 reward 노드다.')
          }
          break

        case 'goto':
          checkSceneRef(node.scene, `${path}.scene`)
          break

        case 'end':
          break
      }
    }
  }

  // ---- 플래그 일관성 ----
  for (const flag of declaredFlags) {
    if (!writtenFlags.has(flag) && !readFlags.has(flag)) {
      warn('flags', `선언했지만 쓰지도 읽지도 않는 플래그다: ${flag}`)
    } else if (!writtenFlags.has(flag)) {
      warn('flags', `읽기만 하고 아무도 쓰지 않는 플래그다 — 항상 false다: ${flag}`)
    }
  }

  // ---- 도달성 ----
  const reachable = new Set<string>()
  if (sceneById.has(scenario.entry_scene)) {
    const queue = [scenario.entry_scene]
    while (queue.length > 0) {
      const id = queue.shift() as string
      if (reachable.has(id)) continue
      reachable.add(id)
      const scene = sceneById.get(id)
      if (!scene) continue
      for (const next of successorsOf(scene)) {
        if (sceneById.has(next)) queue.push(next)
      }
    }
  }

  for (const [index, scene] of scenario.scenes.entries()) {
    if (!reachable.has(scene.id)) {
      warn(`scenes[${index}].id`, `entry_scene에서 도달할 수 없는 장면이다: ${scene.id}`)
    }
  }

  // ---- 종료성(무한 루프 검출) ----
  // end 로 끝나는 장면에서 역방향으로 전파해, 도달 가능한 모든 장면이 end 에 닿는지 본다.
  const canReachEnd = new Set<string>()
  for (const scene of sceneById.values()) {
    if (endsHere(scene)) canReachEnd.add(scene.id)
  }
  let grew = true
  while (grew) {
    grew = false
    for (const scene of sceneById.values()) {
      if (canReachEnd.has(scene.id)) continue
      if (successorsOf(scene).some((next) => canReachEnd.has(next))) {
        canReachEnd.add(scene.id)
        grew = true
      }
    }
  }

  if (canReachEnd.size === 0 && sceneById.size > 0) {
    error('scenes', 'end 노드가 하나도 없다 — 시나리오가 끝날 수 없다.')
  }
  for (const [index, scene] of scenario.scenes.entries()) {
    if (reachable.has(scene.id) && !canReachEnd.has(scene.id)) {
      error(
        `scenes[${index}].id`,
        `장면 '${scene.id}'에서 end에 도달할 수 없다 — 플레이어가 갇힌다.`
      )
    }
  }

  return issues
}

export const scenarioValidationErrors = (
  scenario: GeneratedScenarioJson,
  registry: ScenarioRegistry
): ScenarioValidationIssue[] =>
  createScenarioValidationIssues(scenario, registry).filter(
    (issue) => issue.severity === 'error'
  )

export const isGeneratedScenarioValid = (
  scenario: GeneratedScenarioJson,
  registry: ScenarioRegistry
): boolean => scenarioValidationErrors(scenario, registry).length === 0
