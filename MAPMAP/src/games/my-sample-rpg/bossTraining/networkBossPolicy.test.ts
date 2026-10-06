import { describe, expect, it } from 'vitest'

import exported from '../assets/boss/trial-boss-policy.json'
import type { FightSetup } from './bossFightSim'
import { createBossEnv } from './bossEnv'
import { pickBossPolicyAction, type BossPolicyNetwork } from './bossPolicyNetwork'
import { runFight, scoreFightFun } from './fightEvaluation'
import { createNetworkBossPolicy } from './networkBossPolicy'

const network = exported as BossPolicyNetwork

const setup: FightSetup = {
  isWall: (x, y) => x < 0 || y < 0 || x >= 30 || y >= 30,
  bossStart: { x: 15, y: 10 },
  playerStart: { x: 15, y: 16 },
  playerLevel: 10,
  bossLevel: 10,
  potions: 6
}

describe('network boss policy', () => {
  it('plays the same fight as the RL environment driven by the same network', () => {
    for (const tier of ['novice', 'normal', 'expert'] as const) {
      const env = createBossEnv({ setup, tiers: [tier] })
      let step = env.reset(21, tier)
      while (!step.done) {
        step = env.step(pickBossPolicyAction(network, step.observation, step.actionMask))
      }
      const result = runFight(setup, createNetworkBossPolicy(network, setup.potions), tier, 21)
      expect(result.outcome).toBe(step.info.outcome)
      expect(result.durationMilliseconds).toBe(step.info.durationMilliseconds)
      expect(scoreFightFun(result).total).toBeCloseTo(step.reward)
    }
  })
})
