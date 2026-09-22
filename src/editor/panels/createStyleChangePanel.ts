// Change List (Generate) + Asset Details (Review) for style runs.
// Read-only view of `GET /runs/{id}/changes`: plan.json rows, or rows derived from older run records.
// It never applies or edits a run; the applied run is only read from /crypt-style/active*.json.

export const CHANGE_ACTIONS = ['decorate', 'recolor', 'add', 'cover', 'skip'] as const
export type ChangeAction = (typeof CHANGE_ACTIONS)[number]

export type ChangeRow = {
  asset: string
  kind: string
  action: ChangeAction
  instances: number | null
  prompt: string
  seed: number | null
  model?: string | null
  steps?: number | null
  generation?: string | null
  shared_request?: string | null
  generation_seconds?: number | null
  frost_only?: boolean
  size?: [number, number] | null
  images: { before: string | null; after: string | null; decoration: string | null }
}

export type RunChanges = {
  id: string
  mapId: string
  pipeline: string | null
  prompt: string
  status: string | null
  source: 'plan.json' | 'derived'
  counts: Record<ChangeAction, number>
  rows: ChangeRow[]
  validation: Record<string, unknown> | null
  review: string | null
}

type RunSummary = { id: string; mapId?: string; pipeline?: string; status?: string; prompt?: string }

const API = '/api/prompt-theme'

export const ACTION_LABELS: Record<ChangeAction, string> = {
  decorate: '장식',
  recolor: '재색칠',
  add: '추가',
  cover: '가림',
  skip: '건너뜀'
}

const ACTION_BADGE: Record<ChangeAction, string> = {
  decorate: 'bg-[#3a2f1e] text-[#f0c987] border-[#8a6a3a]',
  recolor: 'bg-[#1d2a3a] text-[#9cc4f0] border-[#3f5f86]',
  add: 'bg-[#1e3322] text-[#93d69a] border-[#3f7a48]',
  cover: 'bg-[#2e2238] text-[#c9a4ef] border-[#65498a]',
  skip: 'bg-[#26262a] text-[#9d9d9d] border-[#48484e]'
}

const KIND_LABELS: Record<string, string> = {
  prop: '소품',
  wall: '벽',
  ground: '바닥',
  ground_deco: '바닥 장식',
  wall_deco: '벽 장식',
  ice: '얼음 식물',
  snow: '눈 바닥',
  house: '집',
  tree: '나무',
  fence: '울타리',
  roof: '지붕',
  building: '건물',
  fountain: '분수',
  lamp: '가로등',
  flower: '꽃'
}

const VALIDATION_LABELS: Record<string, string> = {
  source_hashes_unchanged: '원본 TMX/TSX 불변',
  all_variant_alpha_preserved: '원본 알파 보존',
  plant_alpha_preserved: '식물 알파 보존',
  ground_does_not_cover_props: '바닥이 소품을 가리지 않음',
  soil_path_preserved: '흙길 유지',
  alpha_preserved: '알파 보존',
  tiles_covered: '타일 전부 처리'
}

export const kindLabel = (kind: string): string => KIND_LABELS[kind] ? `${KIND_LABELS[kind]} (${kind})` : kind

/** Crypt keeps one applied selection per floor: floor-0-town uses the legacy active.json name. */
export const activeSelectionPath = (mapId: string): string =>
  mapId === 'floor-0-town' ? '/crypt-style/active.json' : `/crypt-style/active-${mapId}.json`

/** Boolean checks from validation.json, in file order. Non-boolean metrics are left for the Evaluation card. */
export const validationChecks = (validation: Record<string, unknown> | null): Array<{ label: string; ok: boolean }> =>
  Object.entries(validation ?? {})
    .filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')
    .map(([key, ok]) => ({ label: VALIDATION_LABELS[key] ?? key, ok }))

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

const CHECKER = 'background-color:#2b2b30;background-image:linear-gradient(45deg,#232327 25%,transparent 25%,transparent 75%,#232327 75%),linear-gradient(45deg,#232327 25%,transparent 25%,transparent 75%,#232327 75%);background-size:8px 8px;background-position:0 0,4px 4px'

const pixelImage = (src: string | null, alt: string, size: string): HTMLElement => {
  const box = el('div', `${size} shrink-0 rounded border border-[#48484e] flex items-center justify-center overflow-hidden`)
  box.style.cssText = CHECKER
  if (!src) {
    box.append(el('span', 'text-[10px] text-[#777777]', '없음'))
    return box
  }
  const image = el('img', 'w-full h-full object-contain')
  image.src = src
  image.alt = alt
  image.style.imageRendering = 'pixelated'
  box.append(image)
  return box
}

const badge = (action: ChangeAction, withName = false): HTMLElement => {
  const node = el('span', `justify-self-start rounded border px-1.5 py-px text-[10px] leading-[14px] ${ACTION_BADGE[action]}`, withName ? `${ACTION_LABELS[action]} · ${action}` : ACTION_LABELS[action])
  node.title = action
  return node
}

// Rows are separate grids, so every column needs a fixed or fractional width to stay aligned.
const ROW_GRID = 'grid grid-cols-[36px_minmax(90px,1.1fr)_minmax(70px,0.9fr)_52px_52px_minmax(0,2fr)]'

export type StyleChangePanel = {
  changeList: HTMLElement
  assetDetails: HTMLElement
  /** Crypt editor: follow the game map and open the run applied to it. */
  showMap: (mapId: string) => void
  /** Style workspace: open one run directly. */
  showRun: (runId: string) => void
}

export const createStyleChangePanel = (): StyleChangePanel => {
  // ---------- Change List ----------
  const changeList = el('section', 'flex flex-col gap-1.5 min-h-0')
  const head = el('div', 'flex flex-wrap items-center gap-2')
  const title = el('span', 'text-[15px] font-semibold text-[#e6e6e6]', '변경 목록')
  const titleHint = el('span', 'text-[11px] text-[#777777]', 'Change List')
  const runSelect = el('select', 'h-[26px] max-w-[320px] rounded-md border border-[#48484e] bg-[#1a1a1c] px-1.5 text-[11px] text-[#d4d4d4]') as HTMLSelectElement
  runSelect.setAttribute('aria-label', '결과 선택')
  const refresh = el('button', 'h-[26px] rounded-md border border-[#48484e] bg-[#1a1a1c] px-2 text-[11px] text-[#b6bac1] hover:bg-[#242427]', '새로고침') as HTMLButtonElement
  refresh.type = 'button'
  const reviewLink = el('a', 'text-[11px] text-[#e2bd8c] underline-offset-2 hover:underline', '결과 페이지')
  reviewLink.target = '_blank'
  reviewLink.rel = 'noopener'
  reviewLink.hidden = true
  head.append(title, titleHint, runSelect, refresh, reviewLink)
  const meta = el('div', 'truncate text-[11px] leading-[1.5] text-[#9d9d9d]')
  // Filter chips and validation checks share one row so more list rows fit under the game view.
  const chips = el('div', 'flex flex-wrap gap-1')
  const checks = el('div', 'flex flex-wrap gap-1')
  const toolbar = el('div', 'flex flex-wrap items-center justify-between gap-1.5')
  toolbar.append(chips, checks)
  // The table scrolls by itself (min-h-0) so the sticky header stays put inside a height-capped parent.
  const table = el('div', 'min-h-0 overflow-y-auto flex flex-col rounded-lg border border-[#b6bac1]/20')
  changeList.append(head, meta, toolbar, table)

  // ---------- Asset Details ----------
  const assetDetails = el('section', 'flex flex-col gap-2 rounded-lg border border-[#b6bac1]/25 bg-[#0a0a0a]/60 p-2.5')
  const detailTitle = el('div', 'flex items-baseline gap-2')
  detailTitle.append(el('span', 'text-[14px] font-semibold text-[#e6e6e6]', '에셋 상세'), el('span', 'text-[11px] text-[#777777]', 'Asset Details'))
  const detailBody = el('div', 'flex flex-col gap-2')
  assetDetails.append(detailTitle, detailBody)

  let mapId = ''
  let current: RunChanges | undefined
  let filter: ChangeAction | 'all' = 'all'
  let selected = ''
  let loadToken = 0

  const message = (text: string): void => {
    meta.textContent = text
    checks.replaceChildren()
    chips.replaceChildren()
    table.replaceChildren()
    table.hidden = true
    reviewLink.hidden = true
    detailBody.replaceChildren(el('p', 'text-[11px] text-[#777777]', '변경 목록에서 에셋을 고르면 원본·결과·장식을 비교합니다.'))
  }

  const renderDetails = (): void => {
    const row = current?.rows.find((candidate) => candidate.asset === selected)
    if (!current || !row) {
      detailBody.replaceChildren(el('p', 'text-[11px] text-[#777777]', '변경 목록에서 에셋을 고르면 원본·결과·장식을 비교합니다.'))
      return
    }
    const figures = el('div', 'grid grid-cols-3 gap-1.5')
    for (const [label, src] of [['원본', row.images.before], ['결과', row.images.after], ['장식만', row.images.decoration]] as const) {
      const figure = el('figure', 'flex flex-col items-center gap-1 m-0')
      figure.append(pixelImage(src, `${row.asset} ${label}`, 'w-full aspect-square'), el('figcaption', 'text-[10px] text-[#9d9d9d]', label))
      figures.append(figure)
    }
    const facts = el('dl', 'grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px] m-0')
    const fact = (label: string, value: string | HTMLElement): void => {
      const dd = el('dd', 'm-0 min-w-0 text-[#d4d4d4] break-words')
      dd.append(value)
      facts.append(el('dt', 'text-[#777777]', label), dd)
    }
    fact('에셋', row.asset)
    fact('종류', kindLabel(row.kind))
    fact('동작', badge(row.action, true))
    if (row.size) fact('크기', `${row.size[0]}×${row.size[1]}px`)
    fact('배치', row.instances === null ? '기록 없음' : `${row.instances}곳`)
    if (row.model) fact('모델', row.steps ? `${row.model} · ${row.steps} steps` : row.model)
    fact('seed', row.seed === null ? '기록 없음 (서비스가 seed를 노출하지 않음)' : String(row.seed))
    if (typeof row.generation_seconds === 'number') {
      const seconds = `${Math.round(row.generation_seconds)}초`
      fact('생성', row.shared_request ? `공유 시트 '${row.shared_request}' 요청 ${seconds} (에셋별 시간 아님)` : seconds)
    }
    detailBody.replaceChildren(figures, facts)
    if (row.frost_only) detailBody.append(el('p', 'text-[11px] text-[#9cc4f0]', '눈 장식 미검출 · 원본 윤곽을 유지한 서리 색 보정만 적용'))
    if (row.prompt) {
      const prompt = el('details', 'text-[11px] text-[#b6bac1]')
      prompt.append(el('summary', 'cursor-pointer text-[#9d9d9d]', '생성 프롬프트'), el('p', 'mt-1 leading-[1.5] break-words', row.prompt))
      detailBody.append(prompt)
    }
    if (row.generation) {
      const link = el('a', 'text-[11px] text-[#e2bd8c] underline-offset-2 hover:underline', '생성 설정 (generation.json)')
      link.href = `/theme-runs/${current.id}/${row.generation}`
      link.target = '_blank'
      link.rel = 'noopener'
      detailBody.append(link)
    }
  }

  const renderList = (): void => {
    if (!current) return
    const run = current
    chips.replaceChildren()
    const chip = (key: ChangeAction | 'all', label: string, count: number): void => {
      const active = filter === key
      const button = el('button', `h-[24px] rounded-full border px-2.5 text-[11px] transition ${active ? 'bg-[#52555b] border-[#9296a0] text-[#f0f1f3]' : 'bg-[#1a1a1c] border-[#3c3c3c] text-[#9d9d9d] hover:bg-[#242427]'} ${count === 0 && key !== 'all' ? 'opacity-45' : ''}`, `${label} ${count}`) as HTMLButtonElement
      button.type = 'button'
      button.setAttribute('aria-pressed', String(active))
      button.addEventListener('click', () => {
        filter = key
        renderList()
      })
      chips.append(button)
    }
    chip('all', '전체', run.rows.length)
    for (const action of CHANGE_ACTIONS) chip(action, ACTION_LABELS[action], run.counts[action] ?? 0)

    const rows = run.rows.filter((row) => filter === 'all' || row.action === filter)
    const header = el('div', `${ROW_GRID} sticky top-0 z-[1] shrink-0 items-center gap-2 px-2 py-1 bg-[#1a1a1c] text-[10px] text-[#777777]`)
    for (const label of ['', '에셋', '종류', '동작', '배치', '프롬프트']) header.append(el('span', '', label))
    table.replaceChildren(header)
    table.hidden = false
    if (!rows.length) table.append(el('div', 'px-2 py-2 text-[11px] text-[#777777]', '이 동작의 에셋이 없습니다.'))
    for (const row of rows) {
      const isSelected = row.asset === selected
      const item = el('button', `${ROW_GRID} items-center shrink-0 gap-2 px-2 py-0.5 text-left border-t border-[#b6bac1]/10 transition ${isSelected ? 'bg-[#34363a]' : 'bg-transparent hover:bg-[#242427]'}`) as HTMLButtonElement
      item.type = 'button'
      item.setAttribute('aria-pressed', String(isSelected))
      item.append(
        pixelImage(row.images.before, `${row.asset} 원본`, 'w-7 h-7'),
        el('span', 'truncate text-[12px] text-[#d4d4d4]', row.asset),
        el('span', 'truncate text-[11px] text-[#9d9d9d]', KIND_LABELS[row.kind] ?? row.kind),
        badge(row.action),
        el('span', 'text-[11px] tabular-nums text-[#b6bac1]', row.instances === null ? '—' : `${row.instances}곳`),
        el('span', 'truncate text-[11px] text-[#777777]', row.prompt || '—')
      )
      item.title = row.prompt
      item.addEventListener('click', () => {
        selected = row.asset
        renderList()
        renderDetails()
      })
      table.append(item)
    }
  }

  const showRun = async (runId: string): Promise<void> => {
    const token = ++loadToken
    meta.textContent = '변경 목록을 불러오는 중…'
    try {
      const response = await fetch(`${API}/runs/${runId}/changes`, { cache: 'no-store' })
      if (!response.ok) throw new Error(`${response.status} ${await response.text()}`)
      const run = await response.json() as RunChanges
      if (token !== loadToken) return
      current = run
      filter = 'all'
      selected = run.rows[0]?.asset ?? ''
      meta.textContent = `${run.prompt || '(프롬프트 기록 없음)'} · ${run.pipeline ?? '파이프라인 기록 없음'} · ${run.rows.length}종 · ${run.source === 'plan.json' ? '출처 plan.json' : '출처: 기존 실행 기록에서 추정 (plan.json 없음)'}`
      meta.title = meta.textContent
      checks.replaceChildren(...validationChecks(run.validation).map(({ label, ok }) =>
        el('span', `rounded border px-1.5 py-px text-[10px] ${ok ? 'border-[#3f7a48] text-[#93d69a]' : 'border-[#8a3a3a] text-[#f09c9c]'}`, `${ok ? '✓' : '✗'} ${label}`)
      ))
      reviewLink.hidden = !run.review
      if (run.review) reviewLink.href = run.review
      renderList()
      renderDetails()
    } catch (error) {
      if (token === loadToken) message(`변경 목록을 불러오지 못했습니다 (테마 API 8773): ${String(error)}`)
    }
  }

  const loadMap = async (): Promise<void> => {
    const token = ++loadToken
    current = undefined
    message(`${mapId} · 적용된 스타일 결과를 찾는 중…`)
    const [runs, activeId] = await Promise.all([
      fetch(`${API}/runs`, { cache: 'no-store' }).then(async (r) => r.ok ? await r.json() as RunSummary[] : []).catch(() => [] as RunSummary[]),
      fetch(activeSelectionPath(mapId), { cache: 'no-store' }).then(async (r) => r.ok ? (await r.json() as { id?: string }).id ?? '' : '').catch(() => '')
    ])
    if (token !== loadToken) return
    const mapRuns = runs.filter((run) => run.mapId === mapId && run.status === 'ready')
    runSelect.replaceChildren(...mapRuns.map((run) => {
      const option = el('option', '', `${run.id.slice(0, 8)} · ${run.pipeline ?? ''}${run.id === activeId ? ' · 적용 중' : ''}`)
      option.value = run.id
      return option
    }))
    runSelect.hidden = mapRuns.length === 0
    const initial = mapRuns.some((run) => run.id === activeId) ? activeId : mapRuns[0]?.id
    if (!initial) {
      message(`${mapId}: 완료된 스타일 결과가 없습니다.`)
      return
    }
    runSelect.value = initial
    await showRun(initial)
  }

  runSelect.addEventListener('change', () => { void showRun(runSelect.value) })
  refresh.addEventListener('click', () => { if (mapId) void loadMap() })
  message('게임 맵을 불러오면 이 맵에 적용된 스타일 결과의 변경 목록을 보여줍니다.')
  runSelect.hidden = true

  return {
    changeList,
    assetDetails,
    showMap: (nextMapId: string) => {
      mapId = nextMapId
      void loadMap()
    },
    showRun: (runId: string) => {
      if (current?.id === runId) return
      mapId = ''
      runSelect.hidden = true
      void showRun(runId)
    }
  }
}
