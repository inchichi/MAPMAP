import type { GeneratedScenarioJson } from '../games/my-sample-rpg/scenario/scenarioTypes'
import type { ScenarioValidationIssue } from './scenarioValidator'

export type ScenarioDemoSource = 'generated' | 'fixed'

export type ScenarioDemoStage = {
  id: 'request' | 'outline' | 'scenes' | 'validate' | 'apply'
  label: string
  status: 'passed' | 'failed' | 'pending'
  detail: string
}

export type ScenarioDemoReport = {
  scenarioId: string
  source: ScenarioDemoSource
  llmCalls: number
  stages: ScenarioDemoStage[]
}

export const SCENARIO_DEMO_PROMPT =
  '마법사가 수상한 내기를 제안하는 시나리오를 만들어줘. 참가 여부를 선택할 수 있고, 이기면 보상을 주고, 다시 말 걸면 다른 대사가 나와야 해'

export const createScenarioDemoReport = ({
  scenario,
  source,
  llmCalls,
  issues
}: {
  scenario: GeneratedScenarioJson
  source: ScenarioDemoSource
  llmCalls: number
  issues: ScenarioValidationIssue[]
}): ScenarioDemoReport => {
  const errors = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity === 'warning')

  return {
    scenarioId: scenario.scenario_id,
    source,
    llmCalls,
    stages: [
      {
        id: 'request',
        label: '자연어 요청',
        status: 'passed',
        detail: source === 'fixed' ? '고정 데모 요청으로 시작' : '사용자 요청 수신'
      },
      {
        id: 'outline',
        label: '시나리오 골격',
        status: 'passed',
        detail: source === 'fixed' ? '검증된 골드 예제 로드' : '장면 ID·분기 구조 생성'
      },
      {
        id: 'scenes',
        label: '장면 상세화',
        status: 'passed',
        detail:
          source === 'fixed'
            ? `${scenario.scenes.length}개 장면 준비`
            : `${scenario.scenes.length}개 장면 생성 · LLM ${llmCalls}회`
      },
      {
        id: 'validate',
        label: '결정적 검증',
        status: errors.length === 0 ? 'passed' : 'failed',
        detail:
          errors.length === 0
            ? warnings.length === 0
              ? '오류 0건'
              : `오류 0건 · 경고 ${warnings.length}건`
            : `오류 ${errors.length}건`
      },
      {
        id: 'apply',
        label: '게임 반영',
        status: 'pending',
        detail: '적용 버튼 대기'
      }
    ]
  }
}

export const formatScenarioDemoReport = (report: ScenarioDemoReport): string =>
  [
    `데모 파이프라인 · ${report.scenarioId}`,
    `경로: ${report.source === 'fixed' ? '고정 데모' : 'LLM 생성'}`,
    ...report.stages.map((stage, index) => {
      const status =
        stage.status === 'passed' ? '통과' : stage.status === 'failed' ? '실패' : '대기'
      return `${index + 1}. ${stage.label} — ${status} · ${stage.detail}`
    })
  ].join('\n')
