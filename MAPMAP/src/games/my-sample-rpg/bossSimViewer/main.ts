// 시험 보스 강화학습 시뮬레이터 화면(boss-sim.html). 게임·에디터와 따로 돈다.
// 학습에 쓰는 것과 같은 시뮬레이터·봇·정책으로 한 판을 눈으로 보여 주고(두 정책을 같은 seed 로 나란히 비교),
// 여러 판을 화면 없이 돌려 실력별 승률과 재미 점수를 낸다. 자세한 규칙은 docs/boss-rl-design.md.
import bossArenaMapXml from '../assets/maps/boss-arena.tmx?raw'
import town32TilesetXml from '../assets/tilesets/town-32.tsx?raw'
import biomeSnowTilesetXml from '../assets/tilesets/biome-snow.tsx?raw'
import trialBossPolicyJson from '../assets/boss/trial-boss-policy.json'
import { getBossSkillCooldown, getBossSkills, isBossEnraged, type BossSkillKind } from '../bossSkills'
import { createBossArenaSetup, parseBossArenaData } from '../bossTraining/bossArena'
import { BOSS_POLICY_ACTIONS } from '../bossTraining/bossObservation'
import { isBossPolicyCompatible, type BossPolicyNetwork } from '../bossTraining/bossPolicyNetwork'
import { runFight, summarizeFights, TARGET_PLAYER_WIN_RATE } from '../bossTraining/fightEvaluation'
import type { PlayerBotTier } from '../bossTraining/playerBots'
import {
  SIM_STEP_MILLISECONDS,
  TRIAL_BOSS_KEY,
  type FightResult,
  type PlayerWeapon
} from '../bossTraining/bossFightSim'
import { parseTiledMap } from '../tiled/parseTiledMap'
import { loadArenaTiles, loadCharacterSprites } from './arenaSprites'
import { createArenaView, drawFight } from './drawFight'
import { mountTrainingMetrics } from './trainingMetrics'
import { createTrainingRun, type TrainingRun } from './trainingRunData'
import {
  BOSS_POLICY_LABELS,
  createBossPolicy,
  createFightPlayback,
  SKILL_LABELS,
  type BossPolicyKind,
  type FightPlayback
} from './fightPlayback'
import './styles.css'

const arenaTilesets = {
  '../tilesets/town-32.tsx': town32TilesetXml,
  '../tilesets/biome-snow.tsx': biomeSnowTilesetXml
}
const arena = parseBossArenaData(bossArenaMapXml, arenaTilesets)
const setup = createBossArenaSetup(arena)
// 그림(타일맵·캐릭터 시트)을 다 불러온 뒤에 시작한다
const [arenaTiles] = await Promise.all([
  loadArenaTiles(parseTiledMap({ mapXml: bossArenaMapXml, externalTilesets: arenaTilesets })),
  loadCharacterSprites()
])
const view = createArenaView(arena, arenaTiles)
const SKILLS = getBossSkills(TRIAL_BOSS_KEY)
const TIER_LABELS: Record<PlayerBotTier, string> = { novice: '초보', normal: '보통', expert: '고수' }
const TIERS: PlayerBotTier[] = ['novice', 'normal', 'expert']
const WEAPON_LABELS: Record<PlayerWeapon, string> = { sword: '검', bow: '활', magic: '마법' }

const element = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!
const policySelect = element<HTMLSelectElement>('#policy')
const compareSelect = element<HTMLSelectElement>('#compare')
const tierSelect = element<HTMLSelectElement>('#tier')
const weaponSelect = element<HTMLSelectElement>('#weapon')
const seedInput = element<HTMLInputElement>('#seed')
const speedSelect = element<HTMLSelectElement>('#speed')
const playButton = element<HTMLButtonElement>('#play')
const autoNextInput = element<HTMLInputElement>('#auto-next')
const policyFileInput = element<HTMLInputElement>('#policy-file')
const policySourceSelect = element<HTMLSelectElement>('#policy-source')
const panelsElement = element<HTMLElement>('#panels')
const batchButton = element<HTMLButtonElement>('#batch-run')
const batchCountInput = element<HTMLInputElement>('#batch-count')
const batchOutput = element<HTMLElement>('#batch-output')

let network = trialBossPolicyJson as BossPolicyNetwork
let playing = true
let playbacks: FightPlayback[] = []
let panels: Array<{ canvas: HTMLCanvasElement; info: HTMLElement }> = []

const percent = (value: number) => `${Math.round(value * 100)}%`
const seconds = (milliseconds: number) => `${(milliseconds / 1000).toFixed(1)}초`

const getPolicyKinds = (): BossPolicyKind[] =>
  [policySelect.value, compareSelect.value].filter((value) => value !== 'none') as BossPolicyKind[]

// 같은 seed·같은 봇으로 판을 새로 만든다. 봇의 주사위가 같으니 차이는 보스 정책에서만 난다.
const restart = () => {
  const seed = Number(seedInput.value) || 0
  const tier = tierSelect.value as PlayerBotTier
  const weapon = weaponSelect.value as PlayerWeapon
  playbacks = getPolicyKinds().map((policyKind) =>
    createFightPlayback({ setup, policyKind, network, tier, weapon, seed })
  )
  panelsElement.innerHTML = ''
  panels = playbacks.map((playback) => {
    const panel = document.createElement('section')
    panel.className = 'panel'
    panel.innerHTML = `<h2>${BOSS_POLICY_LABELS[playback.policyKind]}</h2>`
    const canvas = document.createElement('canvas')
    canvas.width = view.columns * view.tilePixels
    canvas.height = view.rows * view.tilePixels
    const info = document.createElement('div')
    info.className = 'info'
    panel.append(canvas, info)
    panelsElement.append(panel)
    return { canvas, info }
  })
  render()
}

const bar = (ratio: number, color: string, label: string) =>
  `<div class="bar"><div class="fill" style="width:${Math.max(0, Math.min(1, ratio)) * 100}%;background:${color}"></div><span>${label}</span></div>`

const renderInfo = (playback: FightPlayback): string => {
  const { state, lastDecision, outcome, fun } = playback
  const { player, boss, now } = state
  const enraged = isBossEnraged(boss.hp, boss.maxHp)
  const status = outcome
    ? `<b class="outcome ${outcome}">${outcome === 'player-win' ? '플레이어 승리' : outcome === 'boss-win' ? '보스 승리' : '시간 초과'}</b>`
    : ''
  const skills = SKILLS.map((skill) => {
    const left = Math.max(0, (boss.skillReadyAt[skill.kind] ?? 0) - now)
    const cooldown = getBossSkillCooldown(skill, enraged)
    const chosen = playback.lastSkill?.kind === skill.kind && now - playback.lastSkill.at < 1200
    const uses = state.stats.skillUses[skill.kind] ?? 0
    return `<div class="skill ${chosen ? 'chosen' : ''}"><span class="name">${SKILL_LABELS[skill.kind] ?? skill.kind}</span>${bar(
      1 - left / cooldown,
      left === 0 ? '#4caf50' : '#607d8b',
      left === 0 ? '준비' : seconds(left)
    )}<span class="uses">${uses}회</span></div>`
  }).join('')
  const decision = lastDecision
    ? BOSS_POLICY_ACTIONS.map((action, index) => {
        const allowed = lastDecision.actionMask[index]
        const probability = lastDecision.probabilities?.[index]
        const label = action === 'none' ? '안 씀(근접)' : (SKILL_LABELS[action as BossSkillKind] ?? action)
        const ratio = probability ?? (index === lastDecision.action ? 1 : 0)
        return `<div class="action ${index === lastDecision.action ? 'picked' : ''} ${allowed ? '' : 'masked'}"><span class="name">${label}</span>${bar(
          ratio,
          index === lastDecision.action ? '#ff9800' : '#90a4ae',
          allowed ? (probability === undefined ? (index === lastDecision.action ? '선택' : '') : percent(probability)) : '막힘'
        )}</div>`
      }).join('')
    : '<p class="muted">아직 결정 없음 (첫 기술은 3초 뒤)</p>'
  const log = playback.log
    .slice(-14)
    .reverse()
    .map((entry) => `<li class="${entry.kind}"><span>${seconds(entry.at)}</span> ${entry.text}</li>`)
    .join('')
  const funText = fun
    ? `<div class="fun">재미 점수 <b>${fun.total.toFixed(2)}</b> — 아슬아슬 ${fun.closeness.toFixed(2)}, 길이 ${fun.duration.toFixed(2)}, 다양성 ${fun.variety.toFixed(2)}</div>`
    : ''
  return `
    <div class="meta">${TIER_LABELS[playback.tier]} ${WEAPON_LABELS[playback.weapon]} 봇 · seed ${playback.seed} · ${seconds(now)} ${status}</div>
    ${funText}
    <div class="hp">플레이어 ${bar(player.hp / player.maxHp, '#2e7dd7', `${player.hp} / ${player.maxHp} · 물약 ${player.potions}`)}</div>
    <div class="hp">보스 ${bar(boss.hp / boss.maxHp, enraged ? '#e53935' : '#7b1fa2', `${boss.hp} / ${boss.maxHp}${enraged ? ' · 분노' : ''}${boss.channel ? ' · 기 모으는 중' : ''}`)}</div>
    <div class="columns">
      <div><h3>기술 쿨다운</h3>${skills}</div>
      <div><h3>마지막 결정${lastDecision ? ` (${seconds(lastDecision.at)})` : ''}</h3>${decision}</div>
    </div>
    <h3>기록</h3><ul class="log">${log}</ul>`
}

const render = () => {
  playbacks.forEach((playback, index) => {
    drawFight(panels[index].canvas.getContext('2d')!, view, playback)
    panels[index].info.innerHTML = renderInfo(playback)
  })
}

const stepAll = () => playbacks.forEach((playback) => playback.step())
const isFinished = () => playbacks.every((playback) => playback.outcome)

// 진짜 시간에 맞춰 흘린다(1배 = 한 칸 50ms)
let carried = 0
let lastFrameAt = performance.now()
let finishedAt: number | undefined
const frame = (frameAt: number) => {
  const elapsed = Math.min(250, frameAt - lastFrameAt)
  lastFrameAt = frameAt
  if (playing && !isFinished()) {
    carried += elapsed * Number(speedSelect.value)
    while (carried >= SIM_STEP_MILLISECONDS && !isFinished()) {
      carried -= SIM_STEP_MILLISECONDS
      stepAll()
    }
    render()
    finishedAt = undefined
  } else if (playing && autoNextInput.checked) {
    // 끝난 판을 잠깐 보여 주고 다음 seed 로 넘어간다
    finishedAt ??= frameAt
    if (frameAt - finishedAt > 1500) {
      seedInput.value = String(Number(seedInput.value) + 1)
      restart()
    }
  }
  requestAnimationFrame(frame)
}

const setPlaying = (value: boolean) => {
  playing = value
  playButton.textContent = playing ? '⏸ 멈춤' : '▶ 재생'
}

playButton.addEventListener('click', () => setPlaying(!playing))
element('#step').addEventListener('click', () => {
  setPlaying(false)
  stepAll()
  render()
})
element('#restart').addEventListener('click', restart)
element('#next').addEventListener('click', () => {
  seedInput.value = String(Number(seedInput.value) + 1)
  restart()
})
element('#random-seed').addEventListener('click', () => {
  seedInput.value = String(Math.floor(Math.random() * 1_000_000))
  restart()
})
for (const input of [policySelect, compareSelect, tierSelect, weaponSelect, seedInput]) {
  input.addEventListener('change', restart)
}
document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
    return
  }
  if (event.code === 'Space') {
    event.preventDefault()
    setPlaying(!playing)
  } else if (event.code === 'ArrowRight') {
    setPlaying(false)
    stepAll()
    render()
  }
})

// 서버에서 가져온 학습 결과(npm run rl:pull -- <run> → rl/runs/<run>/trial-boss-policy.json). 새 run 을 가져오면 목록이 새로 뜬다.
const RUN_POLICIES = import.meta.glob<BossPolicyNetwork>('../../../../rl/runs/*/trial-boss-policy.json', {
  import: 'default'
})
const GAME_POLICY = 'game'
const getRunName = (path: string) => path.split('/').at(-2)!

policySourceSelect.innerHTML = [
  `<option value="${GAME_POLICY}">게임에 들어간 정책</option>`,
  ...Object.keys(RUN_POLICIES)
    .sort()
    .map((path) => `<option value="${path}">${getRunName(path)}</option>`)
].join('')

const usePolicy = (loaded: BossPolicyNetwork): boolean => {
  if (!isBossPolicyCompatible(loaded)) {
    alert('이 정책은 지금 코드의 관찰·행동 순서와 맞지 않습니다. 다시 학습·내보내기 해야 합니다.')
    return false
  }
  network = loaded
  restart()
  return true
}

policySourceSelect.addEventListener('change', async () => {
  const path = policySourceSelect.value
  usePolicy(path === GAME_POLICY ? (trialBossPolicyJson as BossPolicyNetwork) : await RUN_POLICIES[path]())
})

// 학습 지표: rl/runs/<run>/ 의 학습 로그·평가 파일(npm run rl:pull 이 가져온다)
const RUN_FILES = import.meta.glob<string>(
  [
    '../../../../rl/runs/*/progress.csv',
    '../../../../rl/runs/*/checkpoint-eval.csv',
    '../../../../rl/runs/*/eval-*.txt'
  ],
  { query: '?raw', import: 'default' }
)
const loadTrainingRuns = async (): Promise<TrainingRun[]> => {
  const loaded = await Promise.all(
    Object.entries(RUN_FILES).map(async ([path, load]) => ({ path, text: await load() }))
  )
  const filesByRun = new Map<string, Record<string, string>>()
  for (const { path, text } of loaded) {
    filesByRun.set(getRunName(path), { ...filesByRun.get(getRunName(path)), [path.split('/').at(-1)!]: text })
  }
  return [...filesByRun.keys()]
    .sort()
    .map((name) => createTrainingRun(name, filesByRun.get(name)!))
    .filter((run): run is TrainingRun => run !== undefined)
}
void loadTrainingRuns().then((runs) => {
  const body = element<HTMLElement>('#metrics-body')
  body.replaceChildren()
  body.classList.remove('muted')
  if (runs.length === 0) {
    body.textContent = 'rl/runs 에 학습 로그(progress.csv)가 없습니다. npm run rl:pull -- <run> 으로 가져오세요.'
    return
  }
  mountTrainingMetrics(body, runs)
})

// 다른 곳에 있는 정책 JSON 을 직접 고른다
policyFileInput.addEventListener('change', async () => {
  const file = policyFileInput.files?.[0]
  if (file) {
    usePolicy(JSON.parse(await file.text()) as BossPolicyNetwork)
  }
})

// 화면 없이 여러 판을 돌린다. 브라우저가 멈추지 않게 조금씩 나눠 돌린다.
batchButton.addEventListener('click', async () => {
  const count = Math.max(1, Number(batchCountInput.value) || 100)
  const kinds = getPolicyKinds()
  const baseSeed = Number(seedInput.value) || 0
  const weapon = weaponSelect.value as PlayerWeapon
  batchButton.disabled = true
  const rows: string[] = []
  for (const kind of kinds) {
    for (const tier of TIERS) {
      const results: FightResult[] = []
      for (let index = 0; index < count; index += 1) {
        const seed = baseSeed + index
        results.push(runFight(setup, createBossPolicy(kind, network, setup, seed), tier, seed, weapon))
        if (index % 10 === 9) {
          batchOutput.textContent = `${BOSS_POLICY_LABELS[kind]} / ${TIER_LABELS[tier]}: ${index + 1} / ${count}판`
          await new Promise((resolve) => setTimeout(resolve))
        }
      }
      const summary = summarizeFights(tier, results)
      const target = TARGET_PLAYER_WIN_RATE[tier]
      const topSkills = Object.entries(summary.skillUses)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([skill, uses]) => `${SKILL_LABELS[skill as BossSkillKind] ?? skill} ${uses.toFixed(1)}`)
        .join(', ')
      rows.push(`<tr>
        <td>${BOSS_POLICY_LABELS[kind]}</td><td>${TIER_LABELS[tier]}</td>
        <td class="${summary.winRateInTarget ? 'good' : 'bad'}">${percent(summary.playerWinRate)}</td>
        <td>${percent(target.min)}~${percent(target.max)}</td>
        <td>${summary.averageSeconds.toFixed(0)}초</td>
        <td>${percent(summary.averagePlayerHpLeftOnWin)}</td>
        <td><b>${summary.averageFun.toFixed(2)}</b></td>
        <td>${topSkills}</td></tr>`)
    }
  }
  batchOutput.innerHTML = `<table>
    <thead><tr><th>보스</th><th>봇</th><th>플레이어 승률</th><th>목표</th><th>평균 길이</th><th>이겼을 때 남은 체력</th><th>재미</th><th>기술 사용/판</th></tr></thead>
    <tbody>${rows.join('')}</tbody></table>
    <p class="muted">실력마다 ${count}판, seed ${baseSeed}~${baseSeed + count - 1}</p>`
  batchButton.disabled = false
})

restart()
requestAnimationFrame(frame)
