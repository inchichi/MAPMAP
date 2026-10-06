// 학습한 보스 정책(작은 신경망)을 게임에서 돌린다. 가중치는 rl/export_policy.py 가 JSON 으로 내보낸다.
// 관찰 → tanh(선형) → tanh(선형) → 선형 → 행동 점수. 고를 수 없는 행동은 빼고 점수가 가장 높은 것을 고른다
// (학습 때 평가에서 쓴 deterministic 선택과 같다).
import { BOSS_OBSERVATION_NAMES, BOSS_POLICY_ACTIONS } from './bossObservation'

export type BossPolicyNetwork = {
  observationNames: readonly string[]
  actions: readonly string[]
  layers: ReadonlyArray<{
    // [출력][입력]
    weight: readonly (readonly number[])[]
    bias: readonly number[]
    activation: 'tanh' | 'linear'
  }>
}

// 내보낸 정책이 지금 코드의 관찰·행동과 같은 순서인지 — 다르면 정책을 다시 학습·내보내기 해야 한다.
export const isBossPolicyCompatible = (network: BossPolicyNetwork): boolean =>
  network.observationNames.join() === BOSS_OBSERVATION_NAMES.join() &&
  network.actions.join() === BOSS_POLICY_ACTIONS.join()

export const getBossPolicyScores = (network: BossPolicyNetwork, observation: readonly number[]): number[] =>
  network.layers.reduce<number[]>(
    (input, layer) =>
      layer.weight.map((row, index) => {
        const sum = row.reduce((total, weight, column) => total + weight * input[column], layer.bias[index])
        return layer.activation === 'tanh' ? Math.tanh(sum) : sum
      }),
    [...observation]
  )

export const pickBossPolicyAction = (
  network: BossPolicyNetwork,
  observation: readonly number[],
  actionMask: readonly boolean[]
): number => {
  const scores = getBossPolicyScores(network, observation)
  let best = 0
  for (let index = 1; index < scores.length; index += 1) {
    if (actionMask[index] && (!actionMask[best] || scores[index] > scores[best])) {
      best = index
    }
  }
  return best
}
