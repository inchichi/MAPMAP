// 서버에서 가져온 학습 결과 파일(rl/runs/<run>/)을 시뮬레이터 화면의 지표로 읽는다(docs/boss-rl-design.md).
//   progress.csv          학습 로그(stable-baselines3) — 보상·엔트로피·설명된 분산
//   checkpoint-eval.csv   학습 도중 정책을 실력마다 다시 돌린 결과(rl/eval_checkpoints.py)
//   eval-*.txt            마지막 정책의 평가(rl/evaluate.py 출력)
import type { PlayerWeapon } from '../bossTraining/bossFightSim'
import type { PlayerBotTier } from '../bossTraining/playerBots'

export const TRAINING_TIERS: readonly PlayerBotTier[] = ['novice', 'normal', 'expert']

// 학습 로그 한 줄. train/* 값은 첫 업데이트 전 줄에는 없다(null).
export type TrainingProgressPoint = {
  steps: number
  minutes: number
  reward: number
  entropy: number | null
  explainedVariance: number | null
}

export type CheckpointTierCurve = { steps: number[]; winRate: number[]; fun: number[] }

export type TierEvaluation = {
  win: number
  seconds: number
  hpLeftOnWin: number
  fun: number
  skills: string
}

export type TrainingRun = {
  name: string
  // 상대 봇의 무기. 평가 파일에 적혀 있고, 없으면(옛 run) 검이다.
  weapon: PlayerWeapon
  progress: TrainingProgressPoint[]
  checkpoints?: Record<PlayerBotTier, CheckpointTierCurve>
  rule?: Partial<Record<PlayerBotTier, TierEvaluation>>
  model?: Partial<Record<PlayerBotTier, TierEvaluation>>
  modelVsSword?: Partial<Record<PlayerBotTier, TierEvaluation>>
}

const parseCsv = (text: string): Array<Record<string, string>> => {
  // 파이썬 csv 모듈은 줄 끝을 \r\n 으로 쓴다
  const [header, ...lines] = text.trim().split(/\r?\n/)
  const keys = header.split(',')
  return lines.map((line) => {
    const values = line.split(',')
    return Object.fromEntries(keys.map((key, index) => [key, values[index] ?? '']))
  })
}

const toNumberOrNull = (value: string): number | null => (value === '' ? null : Number(value))

export const parseTrainingProgress = (text: string): TrainingProgressPoint[] =>
  parseCsv(text)
    .filter((row) => row['rollout/ep_rew_mean'] !== '')
    .map((row) => ({
      steps: Number(row['time/total_timesteps']),
      minutes: Number(row['time/time_elapsed']) / 60,
      reward: Number(row['rollout/ep_rew_mean']),
      entropy: toNumberOrNull(row['train/entropy_loss']),
      explainedVariance: toNumberOrNull(row['train/explained_variance'])
    }))

export const parseCheckpointEvaluation = (text: string): Record<PlayerBotTier, CheckpointTierCurve> => {
  const rows = parseCsv(text)
  const curve = (tier: PlayerBotTier): CheckpointTierCurve => {
    const picked = rows.filter((row) => row.tier === tier)
    return {
      steps: picked.map((row) => Number(row.steps)),
      winRate: picked.map((row) => Number(row.win_rate)),
      fun: picked.map((row) => Number(row.fun))
    }
  }
  return { novice: curve('novice'), normal: curve('normal'), expert: curve('expert') }
}

// evaluate.py 출력:
//   policy=model weapon=bow episodes/tier=500
//   [novice] win 99% (target 30%-50% off) | 61.0s | hp left on win 42% | fun 0.954
//     skills/fight: charge 5.4, fan-shot 4.9, ...
const EVALUATION_LINE =
  /^\[(\w+)\] win (\d+)% \(target [^)]*\) \| ([\d.]+)s \| hp left on win (\d+)% \| fun ([\d.]+)/

export const parseEvaluation = (text: string): { weapon?: PlayerWeapon; tiers: Partial<Record<PlayerBotTier, TierEvaluation>> } => {
  const lines = text.split('\n')
  const tiers: Partial<Record<PlayerBotTier, TierEvaluation>> = {}
  lines.forEach((line, index) => {
    const match = EVALUATION_LINE.exec(line)
    if (match) {
      tiers[match[1] as PlayerBotTier] = {
        win: Number(match[2]) / 100,
        seconds: Number(match[3]),
        hpLeftOnWin: Number(match[4]) / 100,
        fun: Number(match[5]),
        skills: lines[index + 1]?.split('skills/fight:')[1]?.trim() ?? ''
      }
    }
  })
  const weapon = /weapon=(\w+)/.exec(lines[0])?.[1] as PlayerWeapon | undefined
  return { weapon, tiers }
}

// 한 run 의 파일들(이름 → 내용)로 TrainingRun 을 만든다. progress.csv 가 없으면 지표가 없는 run 이다.
export const createTrainingRun = (name: string, files: Partial<Record<string, string>>): TrainingRun | undefined => {
  const progressText = files['progress.csv']
  if (!progressText) {
    return undefined
  }
  const rule = files['eval-rule.txt'] ? parseEvaluation(files['eval-rule.txt']) : undefined
  const model = files['eval-model.txt'] ? parseEvaluation(files['eval-model.txt']) : undefined
  const vsSword = files['eval-model-vs-sword.txt'] ? parseEvaluation(files['eval-model-vs-sword.txt']) : undefined
  const checkpointText = files['checkpoint-eval.csv']
  return {
    name,
    weapon: model?.weapon ?? rule?.weapon ?? 'sword',
    progress: parseTrainingProgress(progressText),
    checkpoints: checkpointText ? parseCheckpointEvaluation(checkpointText) : undefined,
    rule: rule?.tiers,
    model: model?.tiers,
    modelVsSword: vsSword?.tiers
  }
}
