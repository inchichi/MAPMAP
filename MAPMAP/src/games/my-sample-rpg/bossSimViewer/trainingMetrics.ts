// 시뮬레이터 화면의 "학습 지표" 칸: rl/runs/ 의 학습 결과를 그래프와 표로 보여 준다(docs/boss-rl-design.md 의 "Simulator Page").
// 고른 run 들을 겹쳐 그린다. 색은 run 마다 정해진 순서로 붙고(목록 순서), 다른 run 을 켜고 꺼도 바뀌지 않는다.
import type { PlayerBotTier } from '../bossTraining/playerBots'
import { TARGET_PLAYER_WIN_RATE } from '../bossTraining/fightEvaluation'
import { TRAINING_TIERS, type TrainingRun } from './trainingRunData'

// 어두운 바탕용 분류 색(파랑·주황·청록·노랑·분홍·초록·보라·빨강) — 이 순서로 써야 색약에도 이웃끼리 구별된다
const RUN_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
const TIER_LABELS: Record<PlayerBotTier, string> = { novice: '초보', normal: '보통', expert: '고수' }
const WEAPON_LABELS: Record<string, string> = { sword: '검', bow: '활', magic: '마법' }
// 보상 곡선을 매끄럽게 그릴 때 묶는 로그 줄 수, 그릴 점 수
const SMOOTH_WINDOW = 9
const MAX_POINTS = 300

type Series = { name: string; color: string; x: number[]; y: Array<number | null>; markers?: boolean }

const percent = (value: number) => `${Math.round(value * 100)}%`
const millions = (value: number) => `${+(value / 1e6).toFixed(value >= 1e7 ? 0 : 1)}M`
const svgNamespace = 'http://www.w3.org/2000/svg'

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

const svgElement = (tag: string, attributes: Record<string, string | number>, parent: Element) => {
  const node = document.createElementNS(svgNamespace, tag)
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value))
  parent.appendChild(node)
  return node
}

const smooth = (values: number[]) =>
  values.map((_, index) => {
    const window = values.slice(Math.max(0, index - SMOOTH_WINDOW + 1), index + 1)
    return window.reduce((sum, value) => sum + value, 0) / window.length
  })

const thin = <T>(items: T[]): T[] => {
  const step = Math.max(1, Math.floor(items.length / MAX_POINTS))
  return items.filter((_, index) => index % step === 0 || index === items.length - 1)
}

// 선 그래프 하나. 십자선 + 툴팁(그 x 에서 모든 선의 값), 선 끝 이름표, 목표 띠.
const drawLineChart = (
  box: HTMLElement,
  tooltip: HTMLElement,
  chart: { series: Series[]; yMin: number; yMax: number; yFormat: (value: number) => string; band?: { min: number; max: number }; height: number }
) => {
  box.replaceChildren()
  const { series, yMin, yMax, yFormat, band, height } = chart
  const width = Math.max(260, box.clientWidth)
  const margin = { left: 44, right: 84, top: 8, bottom: 22 }
  const svg = svgElement('svg', { width, height, viewBox: `0 0 ${width} ${height}` }, box)
  const xMax = Math.max(1, ...series.flatMap((item) => item.x))
  const plotWidth = width - margin.left - margin.right
  const x = (value: number) => margin.left + (value / xMax) * plotWidth
  const y = (value: number) =>
    margin.top + (1 - (Math.min(yMax, Math.max(yMin, value)) - yMin) / (yMax - yMin)) * (height - margin.top - margin.bottom)

  if (band) {
    svgElement('rect', { x: margin.left, y: y(band.max), width: plotWidth, height: y(band.min) - y(band.max), class: 'metrics-band' }, svg)
  }
  for (let index = 0; index <= 4; index += 1) {
    const value = yMin + ((yMax - yMin) * index) / 4
    svgElement('line', { x1: margin.left, x2: width - margin.right, y1: y(value), y2: y(value), class: 'metrics-grid' }, svg)
    svgElement('text', { x: margin.left - 6, y: y(value) + 4, 'text-anchor': 'end' }, svg).textContent = yFormat(value)
    svgElement('text', { x: x((xMax * index) / 4), y: height - 5, 'text-anchor': 'middle' }, svg).textContent = millions((xMax * index) / 4)
  }

  const labels: Array<{ x: number; y: number; name: string }> = []
  for (const item of series) {
    const points = item.x.flatMap((value, index) => (item.y[index] === null ? [] : [[value, item.y[index] as number]]))
    if (points.length === 0) continue
    svgElement('path', {
      d: points.map(([px, py], index) => `${index ? 'L' : 'M'}${x(px).toFixed(1)},${y(py).toFixed(1)}`).join(''),
      fill: 'none',
      stroke: item.color,
      'stroke-width': 2,
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round'
    }, svg)
    if (item.markers) {
      for (const [px, py] of points) svgElement('circle', { cx: x(px), cy: y(py), r: 4, fill: item.color, class: 'metrics-marker' }, svg)
    }
    const [lastX, lastY] = points[points.length - 1]
    labels.push({ x: x(lastX), y: y(lastY), name: item.name })
  }
  // 선 끝 이름표가 겹치지 않게 아래로 민다
  labels.sort((a, b) => a.y - b.y)
  labels.forEach((label, index) => {
    const top = index > 0 ? labels[index - 1].y + 13 : label.y
    label.y = Math.max(label.y, top)
    svgElement('text', { x: label.x + 6, y: label.y + 4, class: 'metrics-label' }, svg).textContent = label.name
  })

  const hair = svgElement('line', { y1: margin.top, y2: height - margin.bottom, class: 'metrics-hair', visibility: 'hidden' }, svg)
  const hit = svgElement('rect', { x: margin.left, y: 0, width: plotWidth, height, fill: 'transparent' }, svg)
  hit.addEventListener('pointermove', (event) => {
    const pointer = event as PointerEvent
    const at = Math.max(0, Math.min(xMax, ((pointer.offsetX - margin.left) / plotWidth) * xMax))
    hair.setAttribute('x1', String(x(at)))
    hair.setAttribute('x2', String(x(at)))
    hair.setAttribute('visibility', 'visible')
    tooltip.replaceChildren(element('div', 'metrics-tooltip-x', `${(at / 1e6).toFixed(1)}M 스텝`))
    for (const item of series) {
      let best = -1
      item.x.forEach((value, index) => {
        if (item.y[index] !== null && (best < 0 || Math.abs(value - at) < Math.abs(item.x[best] - at))) best = index
      })
      if (best < 0) continue
      const row = element('div', 'metrics-tooltip-row')
      const key = element('i')
      key.style.borderColor = item.color
      row.append(key, element('b', undefined, yFormat(item.y[best] as number)), element('span', undefined, item.name))
      tooltip.append(row)
    }
    tooltip.style.display = 'block'
    tooltip.style.left = `${Math.min(window.innerWidth - tooltip.offsetWidth - 8, pointer.clientX + 14)}px`
    tooltip.style.top = `${pointer.clientY + 14}px`
  })
  hit.addEventListener('pointerleave', () => {
    hair.setAttribute('visibility', 'hidden')
    tooltip.style.display = 'none'
  })
}

const legend = (series: Series[], withBand: boolean) => {
  const node = element('div', 'metrics-legend')
  for (const item of series) {
    const span = element('span')
    const key = element('i')
    key.style.borderColor = item.color
    span.append(key, item.name)
    node.append(span)
  }
  if (withBand) {
    const span = element('span')
    span.append(element('i', 'band'), '목표')
    node.append(span)
  }
  return node
}

const table = (headers: string[], rows: Array<Array<{ text: string; className?: string }>>) => {
  const node = element('table')
  const head = node.createTHead().insertRow()
  for (const header of headers) head.append(element('th', undefined, header))
  const body = node.createTBody()
  for (const cells of rows) {
    const row = body.insertRow()
    for (const cell of cells) row.append(element('td', cell.className, cell.text))
  }
  return node
}

export const mountTrainingMetrics = (container: HTMLElement, runs: readonly TrainingRun[]) => {
  const colors = new Map(runs.map((run, index) => [run.name, RUN_COLORS[index % RUN_COLORS.length]]))
  // 처음에는 평가 파일까지 있는 run(이번 학습들)을 켜 둔다. 없으면 전부.
  const evaluated = runs.filter((run) => run.model)
  const shown = new Set((evaluated.length > 0 ? evaluated : runs).map((run) => run.name))
  const tooltip = element('div', 'metrics-tooltip')
  document.body.append(tooltip)
  const picker = element('div', 'metrics-picker')
  const content = element('div')
  container.append(picker, content)

  for (const run of runs) {
    const label = element('label')
    const checkbox = element('input')
    checkbox.type = 'checkbox'
    checkbox.checked = shown.has(run.name)
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) shown.add(run.name)
      else shown.delete(run.name)
      render()
    })
    const key = element('i')
    key.style.borderColor = colors.get(run.name)!
    label.append(checkbox, key, `${run.name} (${WEAPON_LABELS[run.weapon]} 봇, ${Math.round(run.progress.at(-1)!.minutes)}분)`)
    picker.append(label)
  }

  // 그래프는 카드 배치가 끝난 뒤의 실제 폭으로 그리고, 창 크기가 바뀌면 다시 그린다
  let draws: Array<() => void> = []
  const chartCard = (parent: HTMLElement, title: string, note: string | undefined, series: Series[], options: Omit<Parameters<typeof drawLineChart>[2], 'series'>) => {
    const card = element('div', 'metrics-card')
    card.append(element('div', 'metrics-card-title', title))
    if (note) card.append(element('div', 'muted', note))
    card.append(legend(series, options.band !== undefined))
    const box = element('div')
    card.append(box)
    parent.append(card)
    draws.push(() => drawLineChart(box, tooltip, { series, ...options }))
  }
  const heading = (text: string, note?: string) => {
    content.append(element('h3', undefined, text))
    if (note) content.append(element('p', 'muted', note))
  }
  const grid = () => {
    const node = element('div', 'metrics-grid-cards')
    content.append(node)
    return node
  }

  const render = () => {
    content.replaceChildren()
    draws = []
    const picked = runs.filter((run) => shown.has(run.name))
    if (picked.length === 0) {
      content.append(element('p', 'muted', '위에서 run 을 하나 이상 고르세요.'))
      return
    }
    const runName = (run: TrainingRun) => run.name

    heading('최종 결과 (실력마다 500판, 같은 seed)', '규칙 보스 = 쓸 수 있는 기술 중 목록 맨 앞(기준선). 목표 승률 안이면 ✓.')
    const resultRows = picked.filter((run) => run.model).flatMap((run) =>
      TRAINING_TIERS.map((tier) => {
        const target = TARGET_PLAYER_WIN_RATE[tier]
        const win = (value?: number) =>
          value === undefined
            ? { text: '-' }
            : { text: percent(value), className: value >= target.min && value <= target.max ? 'good' : 'bad' }
        const rule = run.rule?.[tier]
        const model = run.model?.[tier]
        return [
          { text: run.name },
          { text: TIER_LABELS[tier] },
          { text: `${percent(target.min)}~${percent(target.max)}` },
          win(rule?.win),
          win(model?.win),
          { text: rule ? rule.fun.toFixed(2) : '-' },
          { text: model ? model.fun.toFixed(2) : '-' },
          { text: model ? `${model.seconds.toFixed(0)}초` : '-' },
          { text: model ? percent(model.hpLeftOnWin) : '-' },
          win(run.modelVsSword?.[tier]?.win)
        ]
      })
    )
    content.append(
      resultRows.length > 0
        ? table(['run', '실력', '목표 승률', '규칙 보스 승률', '학습 보스 승률', '규칙 재미', '학습 재미', '학습 길이', '이겼을 때 남은 체력', '검 봇 상대 승률'], resultRows)
        : element('p', 'muted', '고른 run 에 평가 파일(eval-*.txt)이 없습니다.')
    )

    heading('학습 곡선: 재미 점수(보상)', '한 판이 끝날 때 받는 재미 점수(0~1)의 최근 100판 평균을 매끄럽게 그렸다. 평평해지면 더 배울 게 적다.')
    chartCard(grid(), '재미 점수', undefined, picked.map((run) => {
      const points = thin(run.progress)
      return { name: runName(run), color: colors.get(run.name)!, x: points.map((point) => point.steps), y: smooth(points.map((point) => point.reward)) }
    }), { yMin: 0.5, yMax: 1, yFormat: (value) => value.toFixed(2), height: 220 })

    const withCheckpoints = picked.filter((run) => run.checkpoints)
    if (withCheckpoints.length > 0) {
      heading('실력별 플레이어 승률 변화', '학습 도중 저장한 정책을 실력마다 200판씩 다시 돌린 결과(rl/eval_checkpoints.py). 회색 띠가 목표 승률이다.')
      const winGrid = grid()
      for (const tier of TRAINING_TIERS) {
        chartCard(winGrid, `${TIER_LABELS[tier]} 봇`, undefined, withCheckpoints.map((run) => ({
          name: runName(run), color: colors.get(run.name)!, markers: true, x: run.checkpoints![tier].steps, y: run.checkpoints![tier].winRate
        })), { yMin: 0, yMax: 1, yFormat: percent, band: TARGET_PLAYER_WIN_RATE[tier], height: 190 })
      }
      heading('실력별 재미 점수 변화')
      const funGrid = grid()
      for (const tier of TRAINING_TIERS) {
        chartCard(funGrid, `${TIER_LABELS[tier]} 봇`, undefined, withCheckpoints.map((run) => ({
          name: runName(run), color: colors.get(run.name)!, markers: true, x: run.checkpoints![tier].steps, y: run.checkpoints![tier].fun
        })), { yMin: 0.4, yMax: 1, yFormat: (value) => value.toFixed(2), height: 190 })
      }
    }

    heading('학습 상태', '학습이 건강하게 진행되었는지 보는 보조 지표.')
    const healthGrid = grid()
    chartCard(healthGrid, '정책 엔트로피 (entropy loss)', '위로 갈수록 보스가 확신 있게 고른다. 너무 빨리 0이 되면 탐험을 멈춘 것이다.', picked.map((run) => {
      const points = thin(run.progress)
      return { name: runName(run), color: colors.get(run.name)!, x: points.map((point) => point.steps), y: points.map((point) => point.entropy) }
    }), { yMin: -2.2, yMax: 0, yFormat: (value) => value.toFixed(2), height: 190 })
    chartCard(healthGrid, '설명된 분산', '1에 가까울수록 가치 함수가 보상을 잘 맞춘다. 0 근처면 예측을 못 한다.', picked.map((run) => {
      const points = thin(run.progress)
      return { name: runName(run), color: colors.get(run.name)!, x: points.map((point) => point.steps), y: points.map((point) => point.explainedVariance) }
    }), { yMin: 0, yMax: 1, yFormat: (value) => value.toFixed(2), height: 190 })

    const skillRows = picked.filter((run) => run.model).flatMap((run) =>
      TRAINING_TIERS.map((tier) => [
        { text: run.name },
        { text: TIER_LABELS[tier] },
        { text: run.rule?.[tier]?.skills ?? '-', className: 'skills' },
        { text: run.model?.[tier]?.skills ?? '-', className: 'skills' }
      ])
    )
    if (skillRows.length > 0) {
      heading('보스가 쓴 기술 (한 판 평균)')
      content.append(table(['run', '실력', '규칙 보스', '학습 보스'], skillRows))
    }

    requestAnimationFrame(() => draws.forEach((draw) => draw()))
  }

  let resizeTimer: ReturnType<typeof setTimeout> | undefined
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => draws.forEach((draw) => draw()), 150)
  })
  render()
}
