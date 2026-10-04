// 시나리오 v2 인터프리터 — TS 호스트 실행기.
//
// 왜 TS 호스트인가는 docs/scenario-interpreter-decision.md 참고(Lua 컨트롤러는 자기 자신만 발화
// 가능하고 선택 결과를 받을 재진입 훅이 없다). 이 모듈은 순수하다: DOM/Pixi 를 모르고,
// 대화 표시·보상 지급·퀘스트 상태 읽기는 전부 host 콜백으로 위임한다. 그래서 단위 테스트가 쉽고,
// 렌더러는 얇은 host 구현만 붙이면 된다.
//
// 실행 모델:
//  - 장면의 스텝을 순서대로 실행한다. set_flag/reward 는 동기, say/choice 는 host 가 응답할 때까지 대기.
//  - 연속된 같은 화자의 say 는 한 번의 presentDialogue 로 묶는다(대화창이 줄 단위로 깜빡이지 않게).
//    say 묶음 바로 뒤가 choice 면 그 대화창의 마지막 줄에 선택지를 함께 띄운다.
//  - goto/branch/choice 는 장면을 넘기고, end 는 실행을 끝낸다.
//  - 검증기(scenarioValidator)가 그래프를 미리 걸러주지만, 런타임도 스텝 예산으로 무한 동기 루프를
//    한 번 더 방어한다(검증을 우회해 주입된 데이터가 탭을 얼리지 않게).

import type {
  GeneratedScenarioJson,
  ScenarioCondition,
  ScenarioNode,
  ScenarioRewardItem,
  ScenarioScene
} from './scenarioTypes'

export type ScenarioDialogueRequest = {
  speaker: string
  lines: string[]
  // 있으면 마지막 줄에서 선택지를 띄운다. respond 는 고른 선택지 index 로 불린다.
  choices?: string[]
}

export type ScenarioRewardGrant = {
  gold: number
  experience: number
  items: ScenarioRewardItem[]
}

// 인터프리터가 게임에게 요구하는 능력 전부. 렌더러가 클로저로 구현한다.
export type ScenarioHost = {
  // 대화(+선택지)를 띄우고, 닫히면 respond 를 부른다. 선택지가 있으면 choiceIndex 가 온다.
  presentDialogue: (
    request: ScenarioDialogueRequest,
    respond: (choiceIndex?: number) => void
  ) => void
  grantReward: (reward: ScenarioRewardGrant) => void
  getQuestStatus: (questId: string) => string
  getFlag: (flag: string) => boolean
  setFlag: (flag: string, value: boolean) => void
}

export type ScenarioRun = {
  isRunning: () => boolean
  // 실행을 즉시 끝낸다. 이미 띄운 대화창의 응답 콜백은 무시된다.
  abort: () => void
}

// 대화 없이 동기 노드만으로 돌 수 있는 최대 스텝 수. 정상 시나리오가 닿을 수 없는 크기다.
const SYNC_STEP_BUDGET = 1000

export const startScenarioRun = (
  scenario: GeneratedScenarioJson,
  host: ScenarioHost,
  onFinish?: () => void
): ScenarioRun => {
  const sceneById = new Map<string, ScenarioScene>(
    scenario.scenes.map((scene) => [scene.id, scene])
  )

  let running = true
  // abort 뒤 늦게 도착하는 대화 응답을 무시하기 위한 세대 표식.
  let generation = 0

  const finish = () => {
    if (!running) return
    running = false
    onFinish?.()
  }

  const evaluate = (condition: ScenarioCondition): boolean =>
    condition.kind === 'flag'
      ? host.getFlag(condition.flag) === condition.equals
      : host.getQuestStatus(condition.quest_id) === condition.equals

  const runScene = (sceneId: string, budget: number) => {
    const scene = sceneById.get(sceneId)
    if (!scene) {
      // 검증기가 막아주는 경우지만, 방어적으로 조용히 끝낸다(플레이어를 가두는 것보다 낫다).
      finish()
      return
    }
    runSteps(scene.steps, 0, budget)
  }

  const runSteps = (steps: ScenarioNode[], startIndex: number, budget: number) => {
    let index = startIndex
    let remaining = budget

    while (running) {
      if (remaining <= 0) {
        finish()
        return
      }
      remaining -= 1

      const node = steps[index]
      if (!node) {
        // 장면이 제어 이동 없이 끝났다 — 검증기가 error 로 잡는 형태. 안전하게 종료한다.
        finish()
        return
      }

      switch (node.type) {
        case 'set_flag':
          host.setFlag(node.flag, node.value)
          index += 1
          continue

        case 'reward':
          host.grantReward({
            gold: node.gold,
            experience: node.experience,
            items: node.items
          })
          index += 1
          continue

        case 'goto':
          runScene(node.scene, remaining)
          return

        case 'branch':
          runScene(evaluate(node.condition) ? node.then_scene : node.else_scene, remaining)
          return

        case 'end':
          finish()
          return

        case 'say': {
          // 같은 화자의 연속 say 를 묶는다.
          const lines = [node.text]
          let next = index + 1
          while (true) {
            const following = steps[next]
            if (following?.type === 'say' && following.speaker === node.speaker) {
              lines.push(following.text)
              next += 1
              continue
            }
            break
          }

          // 묶음 바로 뒤가 choice 면 같은 대화창에 선택지를 얹는다.
          const following = steps[next]
          if (following?.type === 'choice') {
            presentChoice(node.speaker, lines, following, remaining)
            return
          }

          const respondGeneration = generation
          host.presentDialogue({ speaker: node.speaker, lines }, () => {
            if (!running || respondGeneration !== generation) return
            runSteps(steps, next, remaining)
          })
          return
        }

        case 'choice':
          // 앞에 say 가 없는 choice — prompt 를 그 자리의 대사로 쓴다. 화자는 트리거 NPC.
          presentChoice(scenario.trigger.npc_id, [], node, remaining)
          return
      }
    }
  }

  const presentChoice = (
    speaker: string,
    lines: string[],
    node: Extract<ScenarioNode, { type: 'choice' }>,
    budget: number
  ) => {
    // 조건이 거짓인 선택지는 감춘다.
    const visibleOptions = node.options.filter(
      (option) => !option.show_if || evaluate(option.show_if)
    )

    // 전부 숨겨졌다면 진행할 길이 없다 — 가두지 말고 끝낸다(검증기가 warning 으로 예고하는 상황).
    if (visibleOptions.length === 0) {
      finish()
      return
    }

    const respondGeneration = generation
    host.presentDialogue(
      {
        speaker,
        lines: [...lines, node.prompt],
        choices: visibleOptions.map((option) => option.label)
      },
      (choiceIndex) => {
        if (!running || respondGeneration !== generation) return
        const picked = visibleOptions[choiceIndex ?? 0]
        if (!picked) {
          finish()
          return
        }
        runScene(picked.goto, budget)
      }
    )
  }

  runScene(scenario.entry_scene, SYNC_STEP_BUDGET)

  return {
    isRunning: () => running,
    abort: () => {
      generation += 1
      running = false
    }
  }
}
