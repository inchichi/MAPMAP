import { describe, expect, it } from 'vitest'

import exported from '../assets/boss/trial-boss-policy.json'
import {
  getBossPolicyScores,
  isBossPolicyCompatible,
  pickBossPolicyAction,
  type BossPolicyNetwork
} from './bossPolicyNetwork'

// 내보낸 JSON 에는 파이썬(torch)이 같은 관찰에서 낸 점수와 고른 행동이 함께 들어 있다
const network = exported as BossPolicyNetwork & {
  samples: Array<{ observation: number[]; actionMask: boolean[]; scores: number[]; action: number }>
}

describe('boss policy network', () => {
  it('matches the observation and action order of the current code', () => {
    expect(isBossPolicyCompatible(network)).toBe(true)
  })

  it('computes the same scores and picks the same actions as the trained model', () => {
    expect(network.samples.length).toBeGreaterThan(0)
    for (const sample of network.samples) {
      const scores = getBossPolicyScores(network, sample.observation)
      scores.forEach((score, index) => expect(score).toBeCloseTo(sample.scores[index], 4))
      expect(pickBossPolicyAction(network, sample.observation, sample.actionMask)).toBe(sample.action)
    }
  })

  it('never picks a blocked action', () => {
    const tiny: BossPolicyNetwork = {
      observationNames: [],
      actions: [],
      layers: [{ weight: [[0], [5], [1]], bias: [0, 0, 0], activation: 'linear' }]
    }
    // 1번이 점수가 가장 높지만 막혀 있으면 다음으로 높은 2번
    expect(pickBossPolicyAction(tiny, [1], [true, false, true])).toBe(2)
    expect(pickBossPolicyAction(tiny, [1], [true, false, false])).toBe(0)
  })
})
