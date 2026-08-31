import { describe, expect, it } from 'vitest'

import { SHELL_GAME_SCENARIO } from '../../../editor/scenarioGoldExample'
import {
  startScenarioRun,
  type ScenarioDialogueRequest,
  type ScenarioHost,
  type ScenarioRewardGrant
} from './scenarioRuntime'
import type { GeneratedScenarioJson } from './scenarioTypes'

// 대화를 큐에 쌓아두고 테스트가 한 걸음씩 응답하는 각본 호스트.
const createScriptedHost = () => {
  const dialogues: ScenarioDialogueRequest[] = []
  const rewards: ScenarioRewardGrant[] = []
  const flags = new Map<string, boolean>()
  const questStatusById = new Map<string, string>()
  let pendingRespond: ((choiceIndex?: number) => void) | undefined

  const host: ScenarioHost = {
    presentDialogue: (request, respond) => {
      dialogues.push(request)
      pendingRespond = respond
    },
    grantReward: (reward) => {
      rewards.push(reward)
    },
    getQuestStatus: (questId) => questStatusById.get(questId) ?? 'not-started',
    getFlag: (flag) => flags.get(flag) ?? false,
    setFlag: (flag, value) => {
      flags.set(flag, value)
    }
  }

  return {
    host,
    dialogues,
    rewards,
    flags,
    questStatusById,
    // 열려 있는 대화를 닫는다(선택지가 있으면 choiceIndex 로 응답).
    respond: (choiceIndex?: number) => {
      const respond = pendingRespond
      pendingRespond = undefined
      respond?.(choiceIndex)
    },
    lastDialogue: () => dialogues.at(-1)
  }
}

describe('scenario runtime', () => {
  it('runs the gold example first-play path: choice → play → reward → end', () => {
    const script = createScriptedHost()
    const run = startScenarioRun(SHELL_GAME_SCENARIO, script.host)

    // greet(branch, 동기) → greet_first 의 say 2줄 + choice 가 한 대화창으로 묶인다.
    const greeting = script.lastDialogue()
    expect(greeting?.speaker).toBe('wizard')
    expect(greeting?.lines).toHaveLength(3) // say 2줄 + prompt
    expect(greeting?.choices).toEqual(['참가한다', '돌아간다'])

    script.respond(0) // 참가한다 → play_first: say 3줄 묶음
    expect(script.lastDialogue()?.lines).toEqual([
      '자, 시작한다!',
      '정답은… 세 번째!',
      '성공이야! 제법인데?'
    ])

    script.respond() // set_flag → goto claim_prize → say 1줄
    expect(script.flags.get('shell_game_cleared')).toBe(true)
    expect(script.lastDialogue()?.lines).toEqual(['여기, 약속했던 선물!'])

    script.respond() // reward + set_flag 는 동기 실행 → 마지막 say
    expect(script.rewards).toEqual([
      { gold: 50, experience: 20, items: [{ item_id: 'health-potion', quantity: 1 }] }
    ])
    expect(script.flags.get('shell_game_prize_taken')).toBe(true)
    expect(script.lastDialogue()?.lines).toEqual(['즐거운 하루 보내!'])

    script.respond() // end
    expect(run.isRunning()).toBe(false)
    expect(script.rewards).toHaveLength(1)
  })

  it('branches to the cleared greeting on the second run and hides the taken prize option', () => {
    const script = createScriptedHost()
    script.host.setFlag('shell_game_cleared', true)
    script.host.setFlag('shell_game_prize_taken', true)

    startScenarioRun(SHELL_GAME_SCENARIO, script.host)

    const greeting = script.lastDialogue()
    expect(greeting?.lines).toContain('상품은 없지만, 놀이는 몇 번이든 해도 좋아!')
    // '약속한 선물을 받는다'는 prize_taken=true 라 숨는다.
    expect(greeting?.choices).toEqual(['한 번 더 한다', '돌아간다'])
  })

  it('shows the prize option while the prize is unclaimed', () => {
    const script = createScriptedHost()
    script.host.setFlag('shell_game_cleared', true)

    startScenarioRun(SHELL_GAME_SCENARIO, script.host)

    expect(script.lastDialogue()?.choices).toEqual([
      '한 번 더 한다',
      '약속한 선물을 받는다',
      '돌아간다'
    ])

    // 숨은 선택지를 걸러낸 뒤의 index 로 응답한다 — 1 = 선물 받기.
    script.respond(1)
    expect(script.lastDialogue()?.lines).toEqual(['여기, 약속했던 선물!'])
  })

  it('walks the decline path without granting anything', () => {
    const script = createScriptedHost()
    const run = startScenarioRun(SHELL_GAME_SCENARIO, script.host)

    script.respond(1) // 돌아간다
    expect(script.lastDialogue()?.lines).toEqual(['마음이 바뀌면 언제든 다시 오게.'])

    script.respond()
    expect(run.isRunning()).toBe(false)
    expect(script.rewards).toEqual([])
    expect(script.flags.get('shell_game_cleared')).toBeUndefined()
  })

  it('evaluates quest_status conditions through the host', () => {
    const scenario: GeneratedScenarioJson = {
      scenario_id: 'quest_gate',
      title: '퀘스트 게이트',
      trigger: { type: 'talk', npc_id: 'wizard' },
      cast: ['wizard'],
      flags: [],
      entry_scene: 'gate',
      scenes: [
        {
          id: 'gate',
          steps: [
            {
              type: 'branch',
              condition: { kind: 'quest_status', quest_id: 'q1', equals: 'completed' },
              then_scene: 'after',
              else_scene: 'before'
            }
          ]
        },
        { id: 'after', steps: [{ type: 'say', speaker: 'wizard', text: '끝냈군' }, { type: 'end' }] },
        { id: 'before', steps: [{ type: 'say', speaker: 'wizard', text: '아직이군' }, { type: 'end' }] }
      ]
    }

    const script = createScriptedHost()
    script.questStatusById.set('q1', 'completed')
    startScenarioRun(scenario, script.host)
    expect(script.lastDialogue()?.lines).toEqual(['끝냈군'])
  })

  it('uses the trigger npc as the speaker for a bare choice node', () => {
    const scenario: GeneratedScenarioJson = {
      scenario_id: 'bare_choice',
      title: '맨 선택지',
      trigger: { type: 'talk', npc_id: 'santa' },
      cast: ['santa'],
      flags: [],
      entry_scene: 'ask',
      scenes: [
        {
          id: 'ask',
          steps: [
            {
              type: 'choice',
              prompt: '갈래?',
              options: [
                { label: '응', goto: 'done' },
                { label: '아니', goto: 'done' }
              ]
            }
          ]
        },
        { id: 'done', steps: [{ type: 'end' }] }
      ]
    }

    const script = createScriptedHost()
    startScenarioRun(scenario, script.host)
    expect(script.lastDialogue()).toMatchObject({ speaker: 'santa', lines: ['갈래?'] })
  })

  it('finishes safely when every choice option is hidden', () => {
    const scenario: GeneratedScenarioJson = {
      scenario_id: 'all_hidden',
      title: '전부 숨은 선택지',
      trigger: { type: 'talk', npc_id: 'wizard' },
      cast: ['wizard'],
      flags: ['gate'],
      entry_scene: 'ask',
      scenes: [
        {
          id: 'ask',
          steps: [
            {
              type: 'choice',
              prompt: '보이니?',
              options: [
                { label: '안 보임', goto: 'done', show_if: { kind: 'flag', flag: 'gate', equals: true } },
                { label: '이것도', goto: 'done', show_if: { kind: 'flag', flag: 'gate', equals: true } }
              ]
            }
          ]
        },
        { id: 'done', steps: [{ type: 'end' }] }
      ]
    }

    const script = createScriptedHost()
    const run = startScenarioRun(scenario, script.host)

    expect(run.isRunning()).toBe(false)
    expect(script.dialogues).toEqual([])
  })

  it('survives a synchronous goto loop via the step budget instead of hanging', () => {
    const scenario: GeneratedScenarioJson = {
      scenario_id: 'sync_loop',
      title: '동기 루프',
      trigger: { type: 'talk', npc_id: 'wizard' },
      cast: ['wizard'],
      flags: [],
      entry_scene: 'a',
      scenes: [
        { id: 'a', steps: [{ type: 'goto', scene: 'b' }] },
        { id: 'b', steps: [{ type: 'goto', scene: 'a' }] }
      ]
    }

    const script = createScriptedHost()
    const run = startScenarioRun(scenario, script.host)

    expect(run.isRunning()).toBe(false)
  })

  it('ignores dialogue responses that arrive after abort', () => {
    const script = createScriptedHost()
    const run = startScenarioRun(SHELL_GAME_SCENARIO, script.host)

    run.abort()
    expect(run.isRunning()).toBe(false)

    const dialogueCount = script.dialogues.length
    script.respond(0) // 늦게 도착한 선택 응답
    expect(script.dialogues).toHaveLength(dialogueCount)
    expect(script.rewards).toEqual([])
  })
})
