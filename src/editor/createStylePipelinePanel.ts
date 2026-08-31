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

// 분기 B 대상 — 타일 군집으로 이루어진 '묶인 오브젝트'(나무·건물 등). 파일 하나가 아니라
// 타일셋 안의 셀 묶음이라, 실행 시 path가 아니라 key로 보낸다.
type ExtractedObject = {
  key: string
  label: string
  tilesetPath: string
  cells: unknown[]
  sharedOutsideCells?: number
}

type QaAxis = { score: number; passed: boolean; metric?: string; advisory?: boolean; edge?: number; luma?: number }
type PipelineResult = {
  id?: string
  path: string
  label?: string
  key?: string
  category?: string
  strength?: number
  qa?: { passed: boolean; axes: Record<string, QaAxis> }
  applied: boolean
  error?: string
  preview_png?: string
  sharedOutsideCells?: number
}
type PipelineSummary = { total: number; qa_passed: number; applied: number; failed: number }
type PipelineReport = { strength?: number; results: PipelineResult[]; summary: PipelineSummary }

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
  seam: '이음새',
  content_fidelity: '내용 충실도'
}

// 미달해도 종합 판정을 막지 않는 축(advisory)은 색과 문구를 따로 준다 — 임계값이
// 아직 소표본 기준이라 '차단'이 아니라 '보고 판단하라'는 신호로 쓴다.
const axisText = (axis: string, value: QaAxis): string => {
  const label = AXIS_LABEL[axis] ?? axis
  const detail = value.metric
    ? ` (${value.metric})`
    : value.edge !== undefined && value.luma !== undefined
      ? ` (엣지 ${value.edge} · 명암 ${value.luma})`
      : ''
  const verdict = value.passed ? '통과' : value.advisory ? '낮음' : '미달'
  return `${label} ${value.score}${detail} ${verdict}`
}

const axisTone = (value: QaAxis): string =>
  value.passed
    ? 'border-emerald-400/30 text-emerald-300'
    : value.advisory
      ? 'border-sky-400/40 text-sky-300'
      : 'border-amber-400/40 text-amber-300'

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
      '지형은 낮은 강도+circular padding(이음새), 묶인 오브젝트는 셀을 한 장으로 조립해 변환 후 타일셋에 역패치, 캐릭터는 실루엣 하드 제약. 전부 팔레트 스냅 후 QA(실루엣 IoU·팔레트 준수·이음새)를 통과한 것만 적용된다.'
    )
  )
  const targetList = el('div', 'flex flex-col gap-1 max-h-[220px] overflow-y-auto pr-1')
  const strengthSweepRow = el('div', 'flex flex-wrap items-center gap-2')
  const strengthSweepCheckbox = el('input', '') as HTMLInputElement
  strengthSweepCheckbox.type = 'checkbox'
  const strengthSweepInput = el('input', `${INPUT} max-w-[220px]`) as HTMLInputElement
  strengthSweepInput.type = 'text'
  strengthSweepInput.value = '0.2, 0.3, 0.4'
  strengthSweepInput.placeholder = '예: 0.2, 0.3, 0.4'
  strengthSweepInput.disabled = true
  const strengthSweepLabel = el('label', 'flex items-center gap-1.5 text-[12px] text-zinc-300')
  strengthSweepLabel.append(strengthSweepCheckbox, document.createTextNode('Strength 스윕'))
  strengthSweepRow.append(
    strengthSweepLabel,
    strengthSweepInput,
    el('span', HINT, '쉼표로 입력한 값마다 미리보기를 생성합니다. 스윕 중에는 적용하지 않습니다.')
  )
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
  runSection.append(targetList, strengthSweepRow, runButtonRow, reportArea)

  modal.append(header, statusLine, specSection, anchorSection, runSection)

  // ── 상태 ──
  let currentSpec: StyleSpec | undefined
  let savedStyleId: string | undefined
  let anchorsApproved = false
  let inventoryAssets: InventoryAsset[] = []
  let extractedObjects: ExtractedObject[] = []
  const selectedPaths = new Set<string>()
  // 묶인 오브젝트는 파일 경로가 없어 key로 따로 관리한다.
  const selectedObjectKeys = new Set<string>()
  const selectedCount = (): number => selectedPaths.size + selectedObjectKeys.size

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
    strengthSweepInput.disabled = !strengthSweepCheckbox.checked
    applyCheckbox.disabled = strengthSweepCheckbox.checked
    if (strengthSweepCheckbox.checked) {
      applyCheckbox.checked = false
    }
    runButton.disabled = !anchorsApproved || selectedCount() === 0
  }

  strengthSweepCheckbox.addEventListener('change', () => {
    syncGates()
    setStatus(
      strengthSweepCheckbox.checked
        ? 'Strength 스윕 모드: 입력한 강도별 결과를 카드로 비교합니다.'
        : ''
    )
  })

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
          // 그룹 헤더 체크 상태는 렌더 시점에만 계산되므로 다시 그려야 실제 선택과 맞는다.
          renderTargets()
          syncGates()
        })
        const shortName = asset.path.split('/').slice(-2).join('/')
        row.append(checkbox, document.createTextNode(`${shortName} · ${asset.width}×${asset.height}`))
        targetList.append(row)
      }
    }

    // 분기 B — 묶인 오브젝트. 파일 목록과 성격이 달라(타일셋 안의 셀 묶음) 맨 아래에
    // 별도 그룹으로 둔다. 에디터가 맵을 인식할 때 추출되므로 비어 있을 수 있다.
    const objectGroupHeader = el('div', 'flex items-center gap-2 mt-2')
    const objectToggle = el('input', '') as HTMLInputElement
    objectToggle.type = 'checkbox'
    objectToggle.disabled = extractedObjects.length === 0
    objectToggle.addEventListener('change', () => {
      for (const object of extractedObjects) {
        if (objectToggle.checked) {
          selectedObjectKeys.add(object.key)
        } else {
          selectedObjectKeys.delete(object.key)
        }
      }
      renderTargets()
      syncGates()
    })
    objectToggle.checked =
      extractedObjects.length > 0 && extractedObjects.every((object) => selectedObjectKeys.has(object.key))
    objectGroupHeader.append(
      objectToggle,
      el(
        'span',
        'text-[12px] font-semibold text-zinc-300',
        `묶인 오브젝트 · 타일 군집 (${extractedObjects.length})`
      )
    )
    targetList.append(objectGroupHeader)

    if (extractedObjects.length === 0) {
      targetList.append(
        el(
          'span',
          'pl-5 text-[11px] text-zinc-500',
          '아직 추출된 오브젝트가 없습니다 — 에디터에서 맵을 한 번 열면 자동 추출됩니다.'
        )
      )
      return
    }

    for (const object of extractedObjects) {
      const row = el('label', 'flex items-center gap-2 pl-5 text-[12px] text-zinc-400 hover:text-zinc-200 cursor-pointer')
      const checkbox = el('input', '') as HTMLInputElement
      checkbox.type = 'checkbox'
      checkbox.checked = selectedObjectKeys.has(object.key)
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          selectedObjectKeys.add(object.key)
        } else {
          selectedObjectKeys.delete(object.key)
        }
        renderTargets()
        syncGates()
      })
      const cellCount = Array.isArray(object.cells) ? object.cells.length : 0
      row.append(checkbox, document.createTextNode(`${object.label} · 타일 ${cellCount}장`))
      // 이 오브젝트가 쓰는 타일을 다른 오브젝트도 쓰면, 패치가 그쪽에도 함께 반영된다.
      if (object.sharedOutsideCells && object.sharedOutsideCells > 0) {
        row.append(
          el('span', 'text-[10px] text-amber-400/80', `공유 타일 ${object.sharedOutsideCells}`)
        )
      }
      targetList.append(row)
    }
  }

  const loadInventory = (): void => {
    // 묶인 오브젝트 목록은 실패해도 파일 목록 표시를 막지 않는다(추출 전일 수 있음).
    void fetch('/api/style/extracted-objects')
      .then(async (response) => (await response.json()) as { objects?: ExtractedObject[] })
      .then((payload) => {
        extractedObjects = payload.objects ?? []
        renderTargets()
      })
      .catch(() => {
        extractedObjects = []
      })
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
  // 결과 표시 이름 — 묶인 오브젝트는 경로가 아니라 라벨(나무 등)로 보여준다.
  // 실패한 대상은 path 없이 label만 있을 수 있어 순서대로 폴백한다.
  const resultName = (result: PipelineResult): string =>
    result.key
      ? result.label ?? result.key
      : (result.path ?? result.label ?? result.id ?? '(알 수 없음)').split('/').slice(-2).join('/')

  // 변환 전 원본 이미지 주소. 둘 다 originals/의 최초 원본에서 뜬다 — 추출 시점 PNG를
  // 쓰면 이미 스타일이 적용된 타일셋에서 다시 추출된 그림이 '원본'으로 보일 수 있다.
  const originalUrlOf = (result: PipelineResult): string =>
    result.key
      ? `/api/style/pipeline/object-original?key=${encodeURIComponent(result.key)}`
      : `/api/style/pipeline/original?path=${encodeURIComponent(result.path ?? '')}`

  // ── 결과 확대 비교 오버레이 ──
  // 픽셀아트는 48px 썸네일로는 변환 품질을 판단할 수 없다. 카드를 클릭하면 변환 전/후를
  // 정수배 확대(NEAREST 렌더링)로 나란히 놓아 실루엣·팔레트 변화가 눈으로 확인되게 한다.
  // '전' 이미지는 /pipeline/original에서 받는다 — 이미 적용된 에셋이라도 최초 원본이 나온다.
  // 'fit'은 전체가 프레임에 들어오게 맞춘다 — 타일셋은 1402×1122처럼 크고 95%가 투명해서
  // 정수배 확대로 열면 빈 영역만 보인다. 그래서 기본값이 fit이다.
  type Zoom = 'fit' | number
  const ZOOM_STEPS: Zoom[] = ['fit', 1, 2, 4, 8]
  const ZOOM_LABEL = (zoom: Zoom): string => (zoom === 'fit' ? '맞춤' : `${zoom}×`)
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

  let detailZoom: Zoom = 'fit'
  // 원본의 불투명 영역(내용 bbox). 정수배 확대로 바꿀 때 이 지점으로 스크롤해, 투명한
  // 여백이 아니라 실제 그림이 화면에 오게 한다.
  let contentBox: { x: number; y: number } | undefined

  // fit 배율은 두 패널이 공유한다 — 프레임 높이가 서로 조금 달라 각자 계산하면 전/후가
  // 다른 크기로 그려져 나란히 비교가 어긋난다.
  const sharedFitScale = (): number => {
    let scale = 1
    for (const image of [beforePane.image, afterPane.image]) {
      const frame = image.parentElement
      if (!frame || image.naturalWidth === 0) {
        continue
      }
      // p-3(12px) 좌우 패딩을 뺀 실제 표시 폭·높이에 맞춘다.
      scale = Math.min(
        scale,
        (frame.clientWidth - 24) / image.naturalWidth,
        (frame.clientHeight - 24) / image.naturalHeight
      )
    }
    return scale > 0 ? scale : 1
  }

  const applyZoom = (): void => {
    for (const [index, button] of zoomButtons.entries()) {
      button.className = ZOOM_STEPS[index] === detailZoom ? BUTTON_PRIMARY : BUTTON
    }
    const scale = detailZoom === 'fit' ? sharedFitScale() : detailZoom
    for (const image of [beforePane.image, afterPane.image]) {
      if (image.naturalWidth === 0) {
        continue
      }
      image.style.width = `${Math.max(1, Math.round(image.naturalWidth * scale))}px`
      // fit일 때는 다운스케일이라 NEAREST가 심하게 깨진다 — 그때만 보간을 허용한다.
      image.style.imageRendering = scale < 1 ? 'auto' : 'pixelated'
      const frame = image.parentElement
      if (frame && contentBox && detailZoom !== 'fit') {
        frame.scrollLeft = Math.max(0, contentBox.x * scale - 24)
        frame.scrollTop = Math.max(0, contentBox.y * scale - 24)
      }
    }
  }
  for (const zoom of ZOOM_STEPS) {
    const button = el('button', BUTTON, ZOOM_LABEL(zoom)) as HTMLButtonElement
    button.type = 'button'
    button.addEventListener('click', () => {
      detailZoom = zoom
      applyZoom()
    })
    zoomButtons.push(button)
    detailToolbar.append(button)
  }
  detailToolbar.append(detailMeta, detailSave)

  // 두 프레임의 스크롤을 묶는다 — 따로 움직이면 같은 부분을 비교할 수 없다.
  const syncScroll = (from: HTMLElement, to: HTMLElement): void => {
    let mirroring = false
    from.addEventListener('scroll', () => {
      if (mirroring) {
        mirroring = false
        return
      }
      mirroring = true
      to.scrollLeft = from.scrollLeft
      to.scrollTop = from.scrollTop
    })
  }
  {
    const beforeFrame = beforePane.image.parentElement
    const afterFrame = afterPane.image.parentElement
    if (beforeFrame && afterFrame) {
      syncScroll(beforeFrame, afterFrame)
      syncScroll(afterFrame, beforeFrame)
    }
  }

  // 원본의 불투명 영역 좌상단을 찾는다(캔버스로 알파 스캔). 큰 타일셋은 내용이 한쪽에
  // 몰려 있어, 이걸 모르면 확대 시 빈 곳에 착지한다.
  const findContentOrigin = (image: HTMLImageElement): { x: number; y: number } | undefined => {
    const { naturalWidth: width, naturalHeight: height } = image
    if (width === 0 || width * height > 4096 * 4096) {
      return undefined
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      return undefined
    }
    context.drawImage(image, 0, 0)
    let pixels: Uint8ClampedArray
    try {
      pixels = context.getImageData(0, 0, width, height).data
    } catch {
      return undefined // 다른 출처 이미지면 캔버스가 오염돼 읽을 수 없다
    }
    let minX = width
    let minY = height
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (pixels[(y * width + x) * 4 + 3] > 0) {
          if (x < minX) minX = x
          if (y < minY) minY = y
        }
      }
    }
    return minX < width && minY < height ? { x: minX, y: minY } : undefined
  }

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
    const kindLabel = result.key
      ? '묶인 오브젝트'
      : CATEGORY_LABEL[result.category ?? ''] ?? result.category ?? ''
    // 묶인 오브젝트는 어느 타일셋에 되박히는지도 함께 보여준다.
    detailTitle.textContent = [resultName(result), kindLabel, result.key ? result.path : undefined]
      .filter(Boolean)
      .join(' · ')

    // 대상이 바뀌면 매번 전체가 보이는 상태로 시작한다 — 앞 대상에서 쓰던 8× 배율이
    // 남아 있으면 큰 타일셋에서 투명한 여백만 보인다.
    detailZoom = 'fit'
    contentBox = undefined

    const styledUrl = `data:image/png;base64,${result.preview_png}`
    afterPane.image.onload = applyZoom
    afterPane.image.src = styledUrl
    beforePane.image.onload = () => {
      const { naturalWidth: width, naturalHeight: height } = beforePane.image
      contentBox = findContentOrigin(beforePane.image)
      const opaqueNote = contentBox && (contentBox.x > 0 || contentBox.y > 0)
        ? ` · 내용 시작 ${contentBox.x},${contentBox.y}`
        : ''
      detailMeta.textContent = `${width}×${height}px${opaqueNote}`
      applyZoom()
    }
    beforePane.image.src = originalUrlOf(result)

    detailSave.href = styledUrl
    detailSave.download = result.key
      ? `${result.key}.png`
      : `${result.path?.split('/').pop() ?? 'styled.png'}`

    detailAxes.textContent = ''
    if (result.error) {
      detailAxes.append(el('span', 'text-[12px] text-red-400', `오류: ${result.error}`))
    }
    for (const [axis, value] of Object.entries(result.qa?.axes ?? {})) {
      const chip = el(
        'span',
        `rounded-lg border px-2 py-1 text-[11px] ${axisTone(value)}`,
        axisText(axis, value)
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
        el('span', 'text-[12px] text-zinc-200 truncate', resultName(result)),
        el(
          'span',
          `text-[11px] ${result.error ? 'text-red-400' : result.qa?.passed ? 'text-emerald-400' : 'text-amber-400'}`,
          result.error ? `오류: ${result.error}` : result.qa?.passed ? (result.applied ? 'QA 통과 · 적용됨' : 'QA 통과') : 'QA 실패'
        )
      )
      if (result.key) {
        nameRow.append(
          el('span', 'rounded border border-white/10 px-1.5 text-[10px] text-zinc-400', '묶인 오브젝트')
        )
      }
      info.append(nameRow)
      if (result.qa) {
        const axisRow = el('div', 'flex flex-wrap gap-2')
        for (const [axis, value] of Object.entries(result.qa.axes)) {
          axisRow.append(
            el(
              'span',
              `text-[11px] ${value.passed ? 'text-zinc-500' : value.advisory ? 'text-sky-400' : 'text-amber-400'}`,
              axisText(axis, value)
            )
          )
        }
        info.append(axisRow)
      }
      card.append(info)
      reportArea.append(card)
    }
  }

  const renderSweepReport = (reports: PipelineReport[]): void => {
    const results = reports.flatMap((report) => report.results)
    const qaPassed = results.filter((result) => result.qa?.passed).length
    const failed = results.filter((result) => result.error).length
    reportArea.textContent = ''
    reportArea.append(
      el(
        'p',
        'text-[12px] text-zinc-300',
        `Strength 스윕 완료 · 결과 ${results.length}개 · QA 통과 ${qaPassed} · 오류 ${failed}`
      )
    )
    const grid = el('div', 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3')
    for (const result of results) {
      const card = el(
        'div',
        `rounded-lg border border-white/10 bg-black/20 p-3 ${
          result.preview_png ? 'cursor-zoom-in hover:border-amber-400/40 hover:bg-black/40' : ''
        }`
      )
      if (result.preview_png) {
        card.title = '클릭하면 원본과 결과를 크게 비교합니다.'
        card.addEventListener('click', () => openDetail(result))
        const image = el(
          'img',
          'h-48 w-full rounded object-contain bg-black/40 [image-rendering:pixelated]'
        ) as HTMLImageElement
        image.src = `data:image/png;base64,${result.preview_png}`
        image.alt = resultName(result)
        card.append(image)
      }
      const info = el('div', 'mt-2 flex flex-col gap-1')
      const strength = result.strength !== undefined ? result.strength.toFixed(2) : '?'
      info.append(
        el('span', 'text-[12px] font-semibold text-zinc-200', `${resultName(result)} · strength ${strength}`)
      )
      if (result.error) {
        info.append(el('span', 'text-[11px] text-red-400', result.error))
      } else if (result.qa) {
        const axisRow = el('div', 'flex flex-wrap gap-1.5')
        for (const [axis, value] of Object.entries(result.qa.axes)) {
          axisRow.append(
            el(
              'span',
              `text-[11px] ${value.passed ? 'text-zinc-500' : value.advisory ? 'text-sky-400' : 'text-amber-400'}`,
              axisText(axis, value)
            )
          )
        }
        info.append(axisRow)
      }
      card.append(info)
      grid.append(card)
    }
    reportArea.append(grid)
  }

  const parseSweepStrengths = (): number[] | undefined => {
    const values = strengthSweepInput.value
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(Number)
    if (
      values.length === 0 ||
      values.length > 8 ||
      values.some((value) => !Number.isFinite(value) || value < 0.1 || value > 0.9)
    ) {
      return undefined
    }
    return [...new Set(values)].sort((a, b) => a - b)
  }

  const requestPipeline = async (styleId: string, strengthOverride?: number): Promise<PipelineReport> => {
    const targets = [
      ...[...selectedPaths].map((path) => ({ path })),
      ...[...selectedObjectKeys].map((key) => ({ kind: 'extracted-object' as const, key }))
    ]
    const body: {
      style_id: string
      targets: typeof targets
      apply: boolean
      strength_override?: number
    } = {
      style_id: styleId,
      targets,
      apply: strengthOverride === undefined && applyCheckbox.checked
    }
    if (strengthOverride !== undefined) {
      body.strength_override = strengthOverride
    }

    const response = await fetch('/api/style/pipeline/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
    const payload = (await response.json()) as {
      error?: string
      strength?: number
      results?: PipelineResult[]
      summary?: PipelineSummary
    }
    if (!response.ok || !payload.results || !payload.summary) {
      throw new Error(payload.error ?? `실행 실패 (HTTP ${response.status})`)
    }
    const results = payload.results.map((result) => ({
      ...result,
      strength: result.strength ?? payload.strength ?? strengthOverride
    }))
    return { strength: payload.strength ?? strengthOverride, results, summary: payload.summary }
  }

  runButton.addEventListener('click', () => {
    if (!savedStyleId || selectedCount() === 0) {
      return
    }
    const styleId = savedStyleId
    const sweepStrengths = strengthSweepCheckbox.checked ? parseSweepStrengths() : undefined
    if (strengthSweepCheckbox.checked && !sweepStrengths) {
      setStatus('Strength는 0.1~0.9 범위에서 최대 8개까지 입력하세요.', true)
      return
    }
    runButton.disabled = true
    reportArea.textContent = ''
    void (async () => {
      try {
        if (sweepStrengths) {
          const reports: PipelineReport[] = []
          for (const [index, strength] of sweepStrengths.entries()) {
            setStatus(`Strength ${strength.toFixed(2)} 실행 중 (${index + 1}/${sweepStrengths.length}) — GPU 작업…`)
            reports.push(await requestPipeline(styleId, strength))
          }
          renderSweepReport(reports)
          setStatus('Strength 스윕 완료 — 카드 그리드에서 결과를 비교하세요.')
          return
        }

        setStatus(`파이프라인 실행 중 — 대상 ${selectedCount()}개 (GPU 작업)…`)
        const report = await requestPipeline(styleId)
        renderReport(report.results, report.summary)
        setStatus('파이프라인 완료 — QA 리포트를 확인하세요.')
        if (report.summary.applied > 0) {
          onAssetChanged?.()
        }
      } catch (error: unknown) {
        setStatus(`실행 실패: ${error instanceof Error ? error.message : String(error)}`, true)
      } finally {
        runButton.disabled = false
        syncGates()
      }
    })()
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
