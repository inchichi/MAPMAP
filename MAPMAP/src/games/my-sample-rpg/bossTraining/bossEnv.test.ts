import { describe, expect, it } from 'vitest'

import { ruleBasedBossPolicy, type FightSetup } from './bossFightSim'
import { createBossEnv } from './bossEnv'
import { BOSS_OBSERVATION_NAMES, BOSS_POLICY_ACTIONS } from './bossObservation'
import { runFight, scoreFightFun } from './fightEvaluation'

const setup: FightSetup = {
  isWall: (x, y) => x < 0 || y < 0 || x >= 30 || y >= 30,
  bossStart: { x: 15, y: 10 },
  playerStart: { x: 15, y: 16 },
  playerLevel: 10,
  bossLevel: 10,
  potions: 6
}

// 쓸 수 있는 기술 중 맨 앞(= 지금 게임의 보스)
const firstAllowedSkill = (mask: readonly boolean[]): number => {
  const index = mask.findIndex((allowed, action) => action > 0 && allowed)
  return index === -1 ? 0 : index
}

describe('boss RL environment', () => {
  it('describes every observation slot and masks only real skills', () => {
    const env = createBossEnv({ setup, tiers: ['normal'] })
    const first = env.reset(1)
    expect(first.observation).toHaveLength(BOSS_OBSERVATION_NAMES.length)
    expect(first.actionMask).toHaveLength(BOSS_POLICY_ACTIONS.length)
    // "안 씀"은 언제나 고를 수 있고, 첫 결정 순간에는 기술도 하나 이상 열려 있다
    expect(first.actionMask[0]).toBe(true)
    expect(first.actionMask.slice(1).some(Boolean)).toBe(true)
    expect(first.done).toBe(false)
  })

  it('replays the rule-based fight exactly when it always picks the first allowed skill', () => {
    for (const tier of ['novice', 'normal', 'expert'] as const) {
      const env = createBossEnv({ setup, tiers: [tier] })
      let step = env.reset(11, tier)
      while (!step.done) {
        step = env.step(firstAllowedSkill(step.actionMask))
      }
      const expected = runFight(setup, ruleBasedBossPolicy, tier, 11)
      expect(step.info.outcome).toBe(expected.outcome)
      expect(step.info.durationMilliseconds).toBe(expected.durationMilliseconds)
      expect(step.reward).toBeCloseTo(scoreFightFun(expected).total)
    }
  })

  it('treats a masked action as no skill', () => {
    const env = createBossEnv({ setup, tiers: ['normal'] })
    env.reset(2)
    // 기술 하나를 쓰면 다음 결정에서 그 기술은 쿨다운으로 막힌다
    const blocked = env.step(1).actionMask.findIndex((allowed) => !allowed)
    expect(blocked).toBeGreaterThan(0)
    const next = env.step(blocked)
    expect(next.observation[BOSS_OBSERVATION_NAMES.indexOf('last_action_none')]).toBe(1)
  })
})
