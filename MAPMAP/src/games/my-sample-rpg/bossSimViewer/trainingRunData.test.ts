import { describe, expect, it } from 'vitest'

import { createTrainingRun, parseEvaluation } from './trainingRunData'

const progress = [
  'time/time_elapsed,rollout/ep_len_mean,time/total_timesteps,rollout/ep_rew_mean,train/entropy_loss,train/explained_variance',
  '60,25,5632,0.80,,',
  '120,26,11264,0.82,-1.9,0.4'
].join('\n')

const evaluation = [
  'policy=model weapon=bow episodes/tier=500',
  '[novice] win 99% (target 30%-50% off) | 61.0s | hp left on win 42% | fun 0.954',
  '  skills/fight: charge 5.4, fan-shot 4.9',
  '[normal] win 100% (target 55%-75% off) | 50.8s | hp left on win 51% | fun 0.851',
  '  skills/fight: fan-shot 5.6'
].join('\n')

describe('training run data', () => {
  it('reads evaluate.py output per tier, with the opponent weapon', () => {
    const parsed = parseEvaluation(evaluation)
    expect(parsed.weapon).toBe('bow')
    expect(parsed.tiers.novice).toEqual({
      win: 0.99,
      seconds: 61,
      hpLeftOnWin: 0.42,
      fun: 0.954,
      skills: 'charge 5.4, fan-shot 4.9'
    })
    expect(parsed.tiers.expert).toBeUndefined()
  })

  it('builds a run from its files and skips runs without a training log', () => {
    const run = createTrainingRun('bow-20m', {
      'progress.csv': progress,
      'eval-model.txt': evaluation,
      // eval_checkpoints.py 는 줄 끝을 \r\n 으로 쓴다
      'checkpoint-eval.csv': 'steps,tier,win_rate,seconds,fun\r\n200000,novice,0.9,60,0.8\r\n200000,normal,1,50,0.7\r\n'
    })
    expect(run?.weapon).toBe('bow')
    expect(run?.progress).toHaveLength(2)
    expect(run?.progress[0]).toEqual({ steps: 5632, minutes: 1, reward: 0.8, entropy: null, explainedVariance: null })
    expect(run?.checkpoints?.novice).toEqual({ steps: [200000], winRate: [0.9], fun: [0.8] })
    expect(run?.checkpoints?.expert.steps).toEqual([])
    // 평가 파일이 없는 옛 run 은 검 상대로 본다
    expect(createTrainingRun('main-20m', { 'progress.csv': progress })?.weapon).toBe('sword')
    expect(createTrainingRun('empty', {})).toBeUndefined()
  })
})
