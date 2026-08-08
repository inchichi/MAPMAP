// SpecDriven Asset Restyling 파이프라인 패널 (디벨롭 방향 8/6).
// 흐름: 시나리오 → StyleSpec 생성(LLM, Stage 1) → 스펙 저장 → 앵커 생성·승인(Stage 2)
//       → 대상 선택(Stage 0 인벤토리) → 실행(Stage 3~5: 라우팅→변환→규격 스냅→QA)
// 기존 스타일 변환 모달과 별개의 상위 흐름 — 낱개 변환이 아니라 "시나리오 단위" 일괄 변환.

import { readLocalStorage } from './safeStorage'
import { generateStyleSpec } from './styleSpecGenerator'
import { normalizeStyleSpec, type StyleSpec } from './styleSpec'

const API_KEY_STORAGE_KEY = 'my-sample-rpg:anthropic-api-key'

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) {
    node.textContent = text
  }
  return node
}

type InventoryAsset = {
  path: string
  category: string
  width: number
  height: number
  hasAlpha: boolean
  tileset?: { tileWidth: number; tileHeight: number; columns: number }
}

type QaAxis = { score: number; passed: boolean; metric?: string }
type PipelineResult = {
  path: string
  category?: string
  qa?: { passed: boolean; axes: Record<string, QaAxis> }
  applied: boolean
  error?: string
  preview_png?: string
}

export interface StylePipelinePanel {
  openButton: HTMLButtonElement
  backdrop: HTMLDivElement
}

export type CreateStylePipelinePanelInput = {
  // 파이프라인 적용으로 게임 에셋이 바뀐 뒤 호출(게임 리로드용).
  onAssetChanged?: () => void
}

const CATEGORY_LABEL: Record<string, string> = {
  terrain_tile: '지형 타일',
  object: '오브젝트',
  character_sprite: '캐릭터',
  ui: 'UI(기본 제외)'
}

const AXIS_LABEL: Record<string, string> = {
  silhouette_iou: '실루엣 IoU',
  palette_compliance: '팔레트 준수',
  seam: '이음새'
}

const BUTTON =
  'rounded-lg px-3 py-1.5 text-sm bg-white/[0.06] border border-white/10 text-zinc-200 transition hover:bg-white/[0.12] disabled:opacity-40 disabled:cursor-not-allowed'
const BUTTON_PRIMARY =
  'rounded-lg px-3 py-1.5 text-sm bg-amber-500/20 border border-amber-400/40 text-amber-200 transition hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed'
const SECTION = 'rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-3'
const SECTION_TITLE = 'text-[13px] font-semibold text-zinc-200'
const HINT = 'text-[11px] leading-relaxed text-zinc-500'
const INPUT =
  'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-amber-400/50'

export const createStylePipelinePanel = (
  input: CreateStylePipelinePanelInput = {}
): StylePipelinePanel => {
  const { onAssetChanged } = input

  const openButton = el(
    'button',
    'rounded-lg px-2.5 py-1 text-sm bg-white/[0.04] border border-white/10 text-zinc-300 transition hover:bg-white/[0.08] hover:text-zinc-100',
    '🧭 스타일 파이프라인'
  )
  openButton.type = 'button'
  openButton.title = '시나리오 → StyleSpec → 앵커 승인 → 일괄 변환+QA 파이프라인'

  const backdrop = el(
    'div',
    'fixed inset-0 z-[60] hidden items-start justify-center overflow-y-auto bg-black/70 p-6'
  )
  const modal = el(
    'div',
    'w-full max-w-4xl rounded-2xl border border-white/10 bg-[#161618] p-5 flex flex-col gap-4 shadow-2xl'
  )
  backdrop.append(modal)

  // ── 헤더 ──
  const header = el('div', 'flex items-center justify-between')
  const title = el('h2', 'text-base font-semibold text-zinc-100', '🧭 스타일 파이프라인 — 시나리오 단위 일괄 변환')
  const closeButton = el('button', 'text-zinc-500 hover:text-zinc-200 text-xl leading-none', '×')
  closeButton.type = 'button'
  header.append(title, closeButton)

  const statusLine = el('p', 'text-[12px] text-zinc-400 min-h-[18px]')
  const setStatus = (message: string, isError = false): void => {
    statusLine.textContent = message
    statusLine.className = `text-[12px] min-h-[18px] ${isError ? 'text-red-400' : 'text-zinc-400'}`
  }

  // ── Stage 1: 시나리오 → StyleSpec ──
  const specSection = el('section', SECTION)
  specSection.append(
    el('h3', SECTION_TITLE, '1 · 시나리오 → StyleSpec (자유도는 여기까지)'),
    el(
      'p',
      HINT,
      '시나리오를 읽은 LLM이 팔레트·재질·조명·모티프를 정한다. 실루엣·타일 격자·충돌은 스펙이 건드릴 수 없다(immutable 강제).'
    )
  )
  const scenarioInput = el('textarea', `${INPUT} min-h-[72px] resize-y`) as HTMLTextAreaElement
  scenarioInput.placeholder = '예: 화산재에 덮인 폐허가 된 왕국. 잿빛 하늘 아래 그을린 석재와 붉은 잉걸불…'
  const apiKeyInput = el('input', INPUT) as HTMLInputElement
  apiKeyInput.type = 'password'
  apiKeyInput.placeholder = 'API 키 (sk-ant-… 또는 sk-…) — 에디터 설정 키 자동 사용'
  apiKeyInput.autocomplete = 'off'
  const generateSpecButton = el('button', BUTTON_PRIMARY, 'StyleSpec 생성') as HTMLButtonElement
  generateSpecButton.type = 'button'
  const specEditor = el('textarea', `${INPUT} min-h-[160px] resize-y font-mono text-[12px] hidden`) as HTMLTextAreaElement
  specEditor.spellcheck = false
  const paletteRow = el('div', 'flex flex-wrap items-center gap-1.5')
  const saveSpecButton = el('button', BUTTON, '스펙 저장(서버 검증)') as HTMLButtonElement
  saveSpecButton.type = 'button'
  saveSpecButton.disabled = true
  const specButtonRow = el('div', 'flex items-center gap-2')
  specButtonRow.append(generateSpecButton, saveSpecButton)
  specSection.append(scenarioInput, apiKeyInput, specButtonRow, specEditor, paletteRow)

  // ── Stage 2: 앵커 승인 게이트 ──
  const anchorSection = el('section', SECTION)
  anchorSection.append(
    el('h3', SECTION_TITLE, '2 · 스타일 앵커 (스타일당 1회, 승인 게이트)'),
    el(
      'p',
      HINT,
      '스펙으로 앵커 3~5장을 먼저 생성해 사람이 승인한다. 승인된 앵커가 이후 모든 변환의 고정 참조 — 타일 200장을 변환해도 드리프트가 없다.'
    )
  )
  const anchorButtonRow = el('div', 'flex items-center gap-2')
  const generateAnchorsButton = el('button', BUTTON_PRIMARY, '앵커 생성') as HTMLButtonElement
  generateAnchorsButton.type = 'button'
  generateAnchorsButton.disabled = true
  const regenerateAnchorsButton = el('button', BUTTON, '재생성') as HTMLButtonElement
  regenerateAnchorsButton.type = 'button'
  regenerateAnchorsButton.disabled = true
  const approveButton = el('button', BUTTON, '✅ 승인') as HTMLButtonElement
  approveButton.type = 'button'
  approveButton.disabled = true
  const rejectButton = el('button', BUTTON, '⛔ 반려') as HTMLButtonElement
  rejectButton.type = 'button'
  rejectButton.disabled = true
  const approvalBadge = el('span', 'text-[12px] text-zinc-500')
  anchorButtonRow.append(generateAnchorsButton, regenerateAnchorsButton, approveButton, rejectButton, approvalBadge)
  const anchorGrid = el('div', 'grid grid-cols-4 gap-2')
  anchorSection.append(anchorButtonRow, anchorGrid)

  // ── Stage 3~5: 대상 선택 + 실행 + QA 리포트 ──
  const runSection = el('section', SECTION)
  runSection.append(
    el('h3', SECTION_TITLE, '3 · 실행 — 카테고리 라우팅 → 변환 → 규격 스냅 → 자동 QA'),
    el(
      'p',
      HINT,
      '지형은 낮은 강도+circular padding(이음새), 캐릭터는 실루엣 하드 제약, 전부 팔레트 스냅 후 QA(실루엣 IoU·팔레트 준수·이음새)를 통과한 것만 적용된다.'
    )
  )
  const targetList = el('div', 'flex flex-col gap-1 max-h-[220px] overflow-y-auto pr-1')
  const runButtonRow = el('div', 'flex items-center gap-3')
  const applyCheckboxLabel = el('label', 'flex items-center gap-1.5 text-[12px] text-zinc-300')
  const applyCheckbox = el('input', '') as HTMLInputElement
  applyCheckbox.type = 'checkbox'
  applyCheckboxLabel.append(applyCheckbox, document.createTextNode('QA 통과분을 게임에 즉시 적용'))
  const runButton = el('button', BUTTON_PRIMARY, '파이프라인 실행') as HTMLButtonElement
  runButton.type = 'button'
  runButton.disabled = true
  runButtonRow.append(runButton, applyCheckboxLabel)
  const reportArea = el('div', 'flex flex-col gap-2')
  runSection.append(targetList, runButtonRow, reportArea)

  modal.append(header, statusLine, specSection, anchorSection, runSection)

  // ── 상태 ──
  let currentSpec: StyleSpec | undefined
  let savedStyleId: string | undefined
  let anchorsApproved = false
  let inventoryAssets: InventoryAsset[] = []
  const selectedPaths = new Set<string>()

  const syncGates = (): void => {
    saveSpecButton.disabled = currentSpec === undefined
    generateAnchorsButton.disabled = savedStyleId === undefined
    regenerateAnchorsButton.disabled = savedStyleId === undefined
    approveButton.disabled = savedStyleId === undefined
    rejectButton.disabled = savedStyleId === undefined
    approvalBadge.textContent = savedStyleId
      ? anchorsApproved
        ? `승인됨 — ${savedStyleId} 실행 가능`
        : '미승인 — 승인 전에는 실행이 차단된다'
      : ''
    runButton.disabled = !anchorsApproved || selectedPaths.size === 0
  }

  const renderPalette = (): void => {
    paletteRow.textContent = ''
    if (!currentSpec) {
      return
    }
    paletteRow.append(el('span', 'text-[11px] text-zinc-500', `팔레트 ${currentSpec.palette.n_colors}색 · 앵커:`))
    for (const color of currentSpec.palette.anchors) {
      const swatch = el('span', 'inline-block h-5 w-5 rounded border border-white/20')
      swatch.style.backgroundColor = color
      swatch.title = color
      paletteRow.append(swatch)
    }
    paletteRow.append(
      el('span', 'text-[11px] text-zinc-500', `강도 ${currentSpec.style_strength} · immutable: ${currentSpec.immutable.join(', ')}`)
    )
  }

  const readSpecFromEditor = (): StyleSpec | undefined => {
    try {
      const parsed = JSON.parse(specEditor.value) as unknown
      const { spec, issues } = normalizeStyleSpec(parsed)
      if (!spec) {
        setStatus(`스펙 검증 실패: ${issues.map((issue) => `${issue.field} — ${issue.message}`).join(', ')}`, true)
        return undefined
      }
      return spec
    } catch {
      setStatus('스펙 JSON을 해석할 수 없습니다.', true)
      return undefined
    }
  }

  const showSpec = (spec: StyleSpec): void => {
    currentSpec = spec
    specEditor.value = JSON.stringify(spec, null, 2)
    specEditor.classList.remove('hidden')
    renderPalette()
    syncGates()
  }

  // ── Stage 1 핸들러 ──
  generateSpecButton.addEventListener('click', () => {
    const scenario = scenarioInput.value.trim()
    if (!scenario) {
      setStatus('시나리오를 입력하세요.', true)
      return
    }
    const apiKey = apiKeyInput.value.trim() || (readLocalStorage(API_KEY_STORAGE_KEY) ?? '')
    if (!apiKey) {
      setStatus('API 키가 필요합니다(에디터 설정 또는 위 입력칸).', true)
      return
    }
    generateSpecButton.disabled = true
    setStatus('LLM이 StyleSpec을 생성하는 중…')
    void generateStyleSpec({ apiKey, scenario })
      .then((spec) => {
        showSpec(spec)
        savedStyleId = undefined
        anchorsApproved = false
        setStatus(`StyleSpec 생성 완료 — ${spec.style_id}. 검토 후 저장하세요.`)
      })
      .catch((error: unknown) => {
        setStatus(`생성 실패: ${error instanceof Error ? error.message : String(error)}`, true)
      })
      .finally(() => {
        generateSpecButton.disabled = false
        syncGates()
      })
  })

  specEditor.addEventListener('change', () => {
    const spec = readSpecFromEditor()
    if (spec) {
      currentSpec = spec
      renderPalette()
      setStatus('스펙 수정 반영됨 — 저장해야 서버에 적용된다.')
    }
    syncGates()
  })

  saveSpecButton.addEventListener('click', () => {
    const spec = readSpecFromEditor()
    if (!spec) {
      return
    }
    saveSpecButton.disabled = true
    setStatus('스펙 저장 중…')
    void fetch('/api/style/pipeline/spec', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(spec)
    })
      .then(async (response) => {
        const payload = (await response.json()) as { error?: string; spec?: { style_id: string } }
        if (!response.ok || !payload.spec) {
          throw new Error(payload.error ?? `저장 실패 (HTTP ${response.status})`)
        }
        currentSpec = spec
        savedStyleId = payload.spec.style_id
        anchorsApproved = false
        anchorGrid.textContent = ''
        setStatus(`스펙 저장됨 — ${savedStyleId}. 앵커를 생성하세요(저장 시 승인 리셋).`)
      })
      .catch((error: unknown) => {
        setStatus(`저장 실패: ${error instanceof Error ? error.message : String(error)}`, true)
      })
      .finally(() => {
        saveSpecButton.disabled = false
        syncGates()
      })
  })

  // ── Stage 2 핸들러 ──
  const loadAnchors = async (styleId: string): Promise<void> => {
    const response = await fetch(`/api/style/pipeline/anchors/${styleId}`)
    const payload = (await response.json()) as { anchors?: string[] }
    anchorGrid.textContent = ''
    for (const name of payload.anchors ?? []) {
      const image = el('img', 'w-full rounded-lg border border-white/10') as HTMLImageElement
      image.src = `/api/style/pipeline/anchors/${styleId}/${name}?t=${Date.now()}`
      image.alt = name
      anchorGrid.append(image)
    }
  }

  const generateAnchors = (force: boolean): void => {
    if (!savedStyleId) {
      return
    }
    const styleId = savedStyleId
    generateAnchorsButton.disabled = true
    regenerateAnchorsButton.disabled = true
    setStatus(force ? '앵커 재생성 중… (GPU 작업, 수 분 걸릴 수 있음)' : '앵커 생성 중… (GPU 작업, 수 분 걸릴 수 있음)')
    void fetch(`/api/style/pipeline/anchors/${styleId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ force })
    })
      .then(async (response) => {
        const payload = (await response.json()) as { error?: string; anchors?: string[]; cached?: boolean }
        if (!response.ok) {
          throw new Error(payload.error ?? `앵커 생성 실패 (HTTP ${response.status})`)
        }
        anchorsApproved = false
        await loadAnchors(styleId)
        setStatus(
          payload.cached
            ? '캐시된 앵커를 불러왔다. 확인 후 승인하세요.'
            : '앵커 생성 완료 — 스타일 세트를 확인하고 승인/반려하세요.'
        )
      })
      .catch((error: unknown) => {
        setStatus(`앵커 실패: ${error instanceof Error ? error.message : String(error)}`, true)
      })
      .finally(() => {
        generateAnchorsButton.disabled = false
        regenerateAnchorsButton.disabled = false
        syncGates()
      })
  }
  generateAnchorsButton.addEventListener('click', () => generateAnchors(false))
  regenerateAnchorsButton.addEventListener('click', () => generateAnchors(true))

  const setApproval = (approved: boolean): void => {
    if (!savedStyleId) {
      return
    }
    void fetch(`/api/style/pipeline/anchors/${savedStyleId}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ approved })
    })
      .then(async (response) => {
        const payload = (await response.json()) as { error?: string; anchors_approved?: boolean }
        if (!response.ok) {
          throw new Error(payload.error ?? `승인 변경 실패 (HTTP ${response.status})`)
        }
        anchorsApproved = Boolean(payload.anchors_approved)
        setStatus(anchorsApproved ? '앵커 승인됨 — 파이프라인 실행이 열렸다.' : '앵커 반려됨 — 재생성 후 다시 승인하세요.')
      })
      .catch((error: unknown) => {
        setStatus(`승인 변경 실패: ${error instanceof Error ? error.message : String(error)}`, true)
      })
      .finally(syncGates)
  }
  approveButton.addEventListener('click', () => setApproval(true))
  rejectButton.addEventListener('click', () => setApproval(false))

  // ── Stage 0/3 대상 목록 ──
  const renderTargets = (): void => {
    targetList.textContent = ''
    const byCategory = new Map<string, InventoryAsset[]>()
    for (const asset of inventoryAssets) {
      const bucket = byCategory.get(asset.category) ?? []
      bucket.push(asset)
      byCategory.set(asset.category, bucket)
    }
    for (const [category, assets] of byCategory) {
      const groupHeader = el('div', 'flex items-center gap-2 mt-1')
      const groupToggle = el('input', '') as HTMLInputElement
      groupToggle.type = 'checkbox'
      groupToggle.addEventListener('change', () => {
        for (const asset of assets) {
          if (groupToggle.checked) {
            selectedPaths.add(asset.path)
          } else {
            selectedPaths.delete(asset.path)
          }
        }
        renderTargets()
        syncGates()
      })
      groupToggle.checked = assets.every((asset) => selectedPaths.has(asset.path))
      groupHeader.append(
        groupToggle,
        el('span', 'text-[12px] font-semibold text-zinc-300', `${CATEGORY_LABEL[category] ?? category} (${assets.length})`)
      )
      targetList.append(groupHeader)
      for (const asset of assets) {
        const row = el('label', 'flex items-center gap-2 pl-5 text-[12px] text-zinc-400 hover:text-zinc-200 cursor-pointer')
        const checkbox = el('input', '') as HTMLInputElement
        checkbox.type = 'checkbox'
        checkbox.checked = selectedPaths.has(asset.path)
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            selectedPaths.add(asset.path)
          } else {
            selectedPaths.delete(asset.path)
          }
          syncGates()
        })
        const shortName = asset.path.split('/').slice(-2).join('/')
        row.append(checkbox, document.createTextNode(`${shortName} · ${asset.width}×${asset.height}`))
        targetList.append(row)
      }
    }
  }

  const loadInventory = (): void => {
    void fetch('/api/style/pipeline/inventory')
      .then(async (response) => (await response.json()) as { assets?: InventoryAsset[] })
      .then((payload) => {
        inventoryAssets = (payload.assets ?? []).filter((asset) => asset.category !== 'ui')
        renderTargets()
      })
      .catch(() => {
        setStatus('인벤토리를 불러오지 못했습니다 — 스타일 서비스가 실행 중인지 확인하세요.', true)
      })
  }

  // ── Stage 3~5 실행 + QA 리포트 ──
  // ── 결과 확대 비교 오버레이 ──
  // 픽셀아트는 48px 썸네일로는 변환 품질을 판단할 수 없다. 카드를 클릭하면 변환 전/후를
  // 정수배 확대(NEAREST 렌더링)로 나란히 놓아 실루엣·팔레트 변화가 눈으로 확인되게 한다.
  // '전' 이미지는 /pipeline/original에서 받는다 — 이미 적용된 에셋이라도 최초 원본이 나온다.
  const ZOOM_STEPS = [1, 2, 4, 8]
  const CHECKERBOARD =
    'repeating-conic-gradient(#2a2a2d 0% 25%, #1b1b1e 0% 50%) 50% / 16px 16px'

  const detailBackdrop = el(
    'div',
    'fixed inset-0 z-[70] hidden items-center justify-center bg-black/85 p-6'
  )
  const detailPanel = el(
    'div',
    'flex max-h-full w-full max-w-5xl flex-col gap-3 rounded-2xl border border-white/10 bg-[#161618] p-4'
  )
  detailBackdrop.append(detailPanel)

  const detailHeader = el('div', 'flex items-center justify-between gap-3')
  const detailTitle = el('h3', 'text-[13px] font-semibold text-zinc-200 truncate')
  const detailClose = el('button', 'text-zinc-500 hover:text-zinc-200 text-xl leading-none', '×')
  detailClose.type = 'button'
  detailHeader.append(detailTitle, detailClose)

  const detailToolbar = el('div', 'flex items-center gap-2')
  const zoomButtons: HTMLButtonElement[] = []
  const detailSave = el('a', `${BUTTON} ml-auto no-underline`, 'PNG 저장') as HTMLAnchorElement
  const detailMeta = el('span', 'text-[11px] text-zinc-500')

  const detailGrid = el('div', 'grid grid-cols-2 gap-3 overflow-auto')
  const makePane = (label: string) => {
    const pane = el('div', 'flex flex-col gap-1.5 min-w-0')
    const caption = el('span', 'text-[11px] text-zinc-400', label)
    const frame = el(
      'div',
      'flex items-center justify-center overflow-auto rounded-lg border border-white/10 min-h-[200px] max-h-[58vh] p-3'
    )
    frame.style.background = CHECKERBOARD
    const image = el('img', '[image-rendering:pixelated] max-w-none') as HTMLImageElement
    frame.append(image)
    pane.append(caption, frame)
    return { pane, image }
  }
  const beforePane = makePane('변환 전 (원본)')
  const afterPane = makePane('변환 후 (규격 스냅 + QA 통과 여부)')
  detailGrid.append(beforePane.pane, afterPane.pane)

  const detailAxes = el('div', 'flex flex-wrap gap-3')
  detailPanel.append(detailHeader, detailToolbar, detailGrid, detailAxes)

  let detailZoom = 4
  const applyZoom = (): void => {
    for (const [index, button] of zoomButtons.entries()) {
      const scale = ZOOM_STEPS[index]
      button.className = scale === detailZoom ? BUTTON_PRIMARY : BUTTON
    }
    for (const image of [beforePane.image, afterPane.image]) {
      if (image.naturalWidth > 0) {
        image.style.width = `${image.naturalWidth * detailZoom}px`
      }
    }
  }
  for (const scale of ZOOM_STEPS) {
    const button = el('button', BUTTON, `${scale}×`) as HTMLButtonElement
    button.type = 'button'
    button.addEventListener('click', () => {
      detailZoom = scale
      applyZoom()
    })
    zoomButtons.push(button)
    detailToolbar.append(button)
  }
  detailToolbar.append(detailMeta, detailSave)

  const closeDetail = (): void => {
    detailBackdrop.classList.add('hidden')
    detailBackdrop.classList.remove('flex')
  }
  detailClose.addEventListener('click', closeDetail)
  detailBackdrop.addEventListener('click', (event) => {
    if (event.target === detailBackdrop) {
      closeDetail()
    }
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !detailBackdrop.classList.contains('hidden')) {
      closeDetail()
    }
  })

  const openDetail = (result: PipelineResult): void => {
    if (!result.preview_png) {
      return
    }
    detailTitle.textContent = `${result.path}${result.category ? ` · ${CATEGORY_LABEL[result.category] ?? result.category}` : ''}`

    const styledUrl = `data:image/png;base64,${result.preview_png}`
    afterPane.image.onload = applyZoom
    afterPane.image.src = styledUrl
    beforePane.image.onload = () => {
      detailMeta.textContent = `${beforePane.image.naturalWidth}×${beforePane.image.naturalHeight}px`
      applyZoom()
    }
    beforePane.image.src = `/api/style/pipeline/original?path=${encodeURIComponent(result.path)}`

    detailSave.href = styledUrl
    detailSave.download = `${result.path.split('/').pop() ?? 'styled'}`

    detailAxes.textContent = ''
    if (result.error) {
      detailAxes.append(el('span', 'text-[12px] text-red-400', `오류: ${result.error}`))
    }
    for (const [axis, value] of Object.entries(result.qa?.axes ?? {})) {
      const chip = el(
        'span',
        `rounded-lg border px-2 py-1 text-[11px] ${
          value.passed
            ? 'border-emerald-400/30 text-emerald-300'
            : 'border-amber-400/40 text-amber-300'
        }`,
        `${AXIS_LABEL[axis] ?? axis} ${value.score}${value.metric ? ` (${value.metric})` : ''} ${value.passed ? '통과' : '미달'}`
      )
      detailAxes.append(chip)
    }

    detailBackdrop.classList.remove('hidden')
    detailBackdrop.classList.add('flex')
    applyZoom()
  }

  backdrop.append(detailBackdrop)

  const renderReport = (results: PipelineResult[], summary: { total: number; qa_passed: number; applied: number; failed: number }): void => {
    reportArea.textContent = ''
    reportArea.append(
      el(
        'p',
        'text-[12px] text-zinc-300',
        `대상 ${summary.total} · QA 통과 ${summary.qa_passed} · 적용 ${summary.applied} · 오류 ${summary.failed}`
      )
    )
    for (const result of results) {
      const card = el(
        'div',
        `flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-2 ${
          result.preview_png ? 'cursor-zoom-in hover:border-amber-400/40 hover:bg-black/40' : ''
        }`
      )
      if (result.preview_png) {
        card.title = '클릭하면 원본과 나란히 확대 비교합니다'
        card.addEventListener('click', () => openDetail(result))
        const image = el(
          'img',
          'h-12 w-12 rounded object-contain bg-black/40 [image-rendering:pixelated]'
        ) as HTMLImageElement
        image.src = `data:image/png;base64,${result.preview_png}`
        card.append(image)
      }
      const info = el('div', 'flex flex-col gap-0.5 min-w-0')
      const nameRow = el('div', 'flex items-center gap-2')
      nameRow.append(
        el('span', 'text-[12px] text-zinc-200 truncate', result.path.split('/').slice(-2).join('/')),
        el(
          'span',
          `text-[11px] ${result.error ? 'text-red-400' : result.qa?.passed ? 'text-emerald-400' : 'text-amber-400'}`,
          result.error ? `오류: ${result.error}` : result.qa?.passed ? (result.applied ? 'QA 통과 · 적용됨' : 'QA 통과') : 'QA 실패'
        )
      )
      info.append(nameRow)
      if (result.qa) {
        const axisRow = el('div', 'flex flex-wrap gap-2')
        for (const [axis, value] of Object.entries(result.qa.axes)) {
          axisRow.append(
            el(
              'span',
              `text-[11px] ${value.passed ? 'text-zinc-500' : 'text-amber-400'}`,
              `${AXIS_LABEL[axis] ?? axis} ${value.score}${value.metric ? ` (${value.metric})` : ''}`
            )
          )
        }
        info.append(axisRow)
      }
      card.append(info)
      reportArea.append(card)
    }
  }

  runButton.addEventListener('click', () => {
    if (!savedStyleId || selectedPaths.size === 0) {
      return
    }
    runButton.disabled = true
    // 직전 실행 결과를 먼저 비운다 — GPU 작업은 수 분 걸리는데 그동안 옛 카드가 남아
    // 있으면 이미 끝난 것으로 오해하게 된다.
    reportArea.textContent = ''
    setStatus(`파이프라인 실행 중 — 대상 ${selectedPaths.size}개 (GPU 작업)…`)
    void fetch('/api/style/pipeline/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        style_id: savedStyleId,
        targets: [...selectedPaths].map((path) => ({ path })),
        apply: applyCheckbox.checked
      })
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          error?: string
          results?: PipelineResult[]
          summary?: { total: number; qa_passed: number; applied: number; failed: number }
        }
        if (!response.ok || !payload.results || !payload.summary) {
          throw new Error(payload.error ?? `실행 실패 (HTTP ${response.status})`)
        }
        renderReport(payload.results, payload.summary)
        setStatus('파이프라인 완료 — QA 리포트를 확인하세요.')
        if (payload.summary.applied > 0) {
          onAssetChanged?.()
        }
      })
      .catch((error: unknown) => {
        setStatus(`실행 실패: ${error instanceof Error ? error.message : String(error)}`, true)
      })
      .finally(() => {
        runButton.disabled = false
        syncGates()
      })
  })

  // ── 열기/닫기 ──
  const open = (): void => {
    backdrop.classList.remove('hidden')
    backdrop.classList.add('flex')
    setStatus('')
    // 이전 실행의 QA 리포트는 지운 상태에서 연다 — 남아 있으면 이번 실행 결과와 섞여
    // 어떤 카드가 방금 나온 것인지 구분되지 않는다. 확대 비교 오버레이도 함께 닫는다.
    reportArea.textContent = ''
    closeDetail()
    loadInventory()
    // 저장된 스펙이 있으면 이어서 작업할 수 있게 목록에서 최신 것을 불러온다.
    void fetch('/api/style/pipeline/specs')
      .then(async (response) => (await response.json()) as { specs?: Array<{ style_id: string; anchors_approved: boolean }> })
      .then(async (payload) => {
        const latest = payload.specs?.[payload.specs.length - 1]
        if (!latest || currentSpec) {
          return
        }
        const specResponse = await fetch(`/api/style/pipeline/spec/${latest.style_id}`)
        const specPayload = (await specResponse.json()) as { spec?: unknown }
        const { spec } = normalizeStyleSpec(specPayload.spec)
        if (spec) {
          showSpec(spec)
          savedStyleId = spec.style_id
          anchorsApproved = latest.anchors_approved
          await loadAnchors(spec.style_id)
          setStatus(`저장된 스펙 불러옴 — ${spec.style_id}${latest.anchors_approved ? ' (승인됨)' : ''}`)
          syncGates()
        }
      })
      .catch(() => {
        // 서비스 미기동 등 — 인벤토리 로드에서 이미 안내한다.
      })
  }
  const close = (): void => {
    backdrop.classList.add('hidden')
    backdrop.classList.remove('flex')
  }
  openButton.addEventListener('click', open)
  closeButton.addEventListener('click', close)
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      close()
    }
  })

  return { openButton, backdrop }
}
