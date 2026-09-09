import { describe, expect, it } from 'vitest'

import { SHELL_GAME_SCENARIO } from './scenarioGoldExample'
import {
  createScenarioDemoReport,
  formatScenarioDemoReport
} from './scenarioDemo'
import { createScenarioValidationIssues } from './scenarioValidator'
import { MY_SAMPLE_RPG_SCENARIO_REGISTRY } from './scenarioRegistry'

describe('scenario demo report', () => {
  it('describes a fixed demo as ready to apply', () => {
    const issues = createScenarioValidationIssues(
      SHELL_GAME_SCENARIO,
      MY_SAMPLE_RPG_SCENARIO_REGISTRY
    )
    const report = createScenarioDemoReport({
      scenario: SHELL_GAME_SCENARIO,
      source: 'fixed',
      llmCalls: 0,
      issues
    })

    expect(report.stages.map((stage) => stage.status)).toEqual([
      'passed',
      'passed',
      'passed',
      'passed',
      'pending'
    ])
    expect(formatScenarioDemoReport(report)).toContain('경로: 고정 데모')
    expect(formatScenarioDemoReport(report)).toContain('적용 버튼 대기')
  })

  it('shows validation errors instead of presenting a broken scenario as ready', () => {
    const brokenScenario = {
      ...SHELL_GAME_SCENARIO,
      entry_scene: 'missing_scene'
    }
    const issues = createScenarioValidationIssues(
      brokenScenario,
      MY_SAMPLE_RPG_SCENARIO_REGISTRY
    )
    const report = createScenarioDemoReport({
      scenario: brokenScenario,
      source: 'generated',
      llmCalls: 3,
      issues
    })

    expect(report.stages.find((stage) => stage.id === 'validate')?.status).toBe('failed')
    expect(formatScenarioDemoReport(report)).toContain('오류 1건')
  })
})
