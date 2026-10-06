// 학습한 정책(내보낸 가중치)을 시뮬레이터의 BossPolicy 로 감싼다. 결정 규칙은 학습 환경(bossEnv)과 같다:
// 쓸 수 있는 기술이 있고 "안 씀" 대기가 끝났을 때만 묻고, 관찰은 getFightObservation 으로 만든다.
// 싸움마다 기억(지난 행동, 대기, 최근 피해)이 있으므로 한 싸움에 하나씩 만든다.
import type { BossSkillKind } from '../bossSkills'
import type { BossPolicy } from './bossFightSim'
import { getFightObservation, getTotalPlayerDamage } from './bossEnv'
import {
  BOSS_POLICY_ACTIONS,
  createRecentDamageWindow,
  getBossActionMask,
  NONE_ACTION_HOLD_MILLISECONDS
} from './bossObservation'
import { getBossPolicyScores, pickBossPolicyAction, type BossPolicyNetwork } from './bossPolicyNetwork'

export type BossPolicyDecision = {
  at: number
  observation: number[]
  actionMask: boolean[]
  scores: number[]
  action: number
}

export const createNetworkBossPolicy = (
  network: BossPolicyNetwork,
  startingPotions: number,
  onDecision?: (decision: BossPolicyDecision) => void
): BossPolicy => {
  let lastAction = 0
  let holdUntil = 0
  const recentDamage = createRecentDamageWindow()
  return (state, available) => {
    if (available.length === 0 || state.now < holdUntil) {
      return undefined
    }
    const recent = recentDamage(state.now, getTotalPlayerDamage(state), state.boss.maxHp - state.boss.hp)
    const observation = getFightObservation(state, startingPotions, lastAction, recent)
    const actionMask = getBossActionMask(available)
    const action = pickBossPolicyAction(network, observation, actionMask)
    onDecision?.({ at: state.now, observation, actionMask, scores: getBossPolicyScores(network, observation), action })
    lastAction = action
    if (action === 0) {
      holdUntil = state.now + NONE_ACTION_HOLD_MILLISECONDS
      return undefined
    }
    return BOSS_POLICY_ACTIONS[action] as BossSkillKind
  }
}
