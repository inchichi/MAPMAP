// 골드 예제 — 손으로 쓴 시나리오 v2 한 편. 용도 세 가지:
//  1) few-shot 예시: LLM 에게 "이 양식으로 이 정도 밀도로 써라"를 보여준다
//  2) 런타임 테스트 픽스처: 인터프리터가 7종 노드를 전부 실행하는지 검증한다
//  3) 데모 폴백: 라이브 생성이 실패해도 즉시 로드해 시연을 이어간다
//
// 소재는 할로윈 기획서의 '야바위'를 이 게임의 캐스트로 옮긴 것이다. 미니게임 본체는 이 저장소에
// 없으므로(엔진 템플릿이 제공할 몫), 판정은 스텁이고 시나리오는 그 위의 캐스팅·대사·분기·보상만 담는다.
//
// 7종 노드를 전부 쓴다: say / choice / branch / set_flag / reward / goto / end

import type { GeneratedScenarioJson } from './scenarioSchema'

export const SHELL_GAME_SCENARIO: GeneratedScenarioJson = {
  scenario_id: 'wizard_shell_game',
  title: '마법사의 야바위',
  trigger: { type: 'talk', npc_id: 'wizard' },
  cast: ['wizard'],
  flags: ['shell_game_cleared', 'shell_game_prize_taken'],
  entry_scene: 'greet',
  scenes: [
    // 진입점. 이미 클리어했는지로 갈린다 — 기획서의 "이후 ○○에게 말걸면(이미 클리어 후)".
    {
      id: 'greet',
      steps: [
        {
          type: 'branch',
          condition: { kind: 'flag', flag: 'shell_game_cleared', equals: true },
          then_scene: 'greet_again',
          else_scene: 'greet_first'
        }
      ]
    },
    {
      id: 'greet_first',
      steps: [
        { type: 'say', speaker: 'wizard', text: '자, 어느 컵에 별조각이 들어 있을까?' },
        { type: 'say', speaker: 'wizard', text: '맞추는 사람한테 선물도 있으니까, 꼭 한 번 해 봐!' },
        {
          type: 'choice',
          prompt: '어떻게 할까?',
          options: [
            { label: '참가한다', goto: 'play_first' },
            { label: '돌아간다', goto: 'leave' }
          ]
        }
      ]
    },
    {
      id: 'greet_again',
      steps: [
        { type: 'say', speaker: 'wizard', text: '자, 어느 컵에 별조각이 들어 있을까?' },
        { type: 'say', speaker: 'wizard', text: '상품은 없지만, 놀이는 몇 번이든 해도 좋아!' },
        {
          type: 'choice',
          prompt: '어떻게 할까?',
          options: [
            { label: '한 번 더 한다', goto: 'play_again' },
            // 상품을 아직 안 받았을 때만 뜬다 — 기획서의 "한번 받은 이후엔 선택지에서 사라진다".
            {
              label: '약속한 선물을 받는다',
              goto: 'claim_prize',
              show_if: { kind: 'flag', flag: 'shell_game_prize_taken', equals: false }
            },
            { label: '돌아간다', goto: 'leave' }
          ]
        }
      ]
    },
    // 최초 성공. 미니게임 판정은 스텁이라 항상 성공으로 둔다.
    {
      id: 'play_first',
      steps: [
        { type: 'say', speaker: 'wizard', text: '자, 시작한다!' },
        { type: 'say', speaker: 'wizard', text: '정답은… 세 번째!' },
        { type: 'say', speaker: 'wizard', text: '성공이야! 제법인데?' },
        { type: 'set_flag', flag: 'shell_game_cleared', value: true },
        { type: 'goto', scene: 'claim_prize' }
      ]
    },
    {
      id: 'claim_prize',
      steps: [
        { type: 'say', speaker: 'wizard', text: '여기, 약속했던 선물!' },
        { type: 'reward', gold: 50, experience: 20, items: [{ item_id: 'health-potion', quantity: 1 }] },
        { type: 'set_flag', flag: 'shell_game_prize_taken', value: true },
        { type: 'say', speaker: 'wizard', text: '즐거운 하루 보내!' },
        { type: 'end' }
      ]
    },
    // 재도전. 보상 없이 대사만.
    {
      id: 'play_again',
      steps: [
        { type: 'say', speaker: 'wizard', text: '자, 시작한다!' },
        { type: 'say', speaker: 'wizard', text: '정답은… 두 번째!' },
        { type: 'say', speaker: 'wizard', text: '성공이야! 여전히 잘하는군.' },
        { type: 'end' }
      ]
    },
    {
      id: 'leave',
      steps: [
        { type: 'say', speaker: 'wizard', text: '마음이 바뀌면 언제든 다시 오게.' },
        { type: 'end' }
      ]
    }
  ]
}
