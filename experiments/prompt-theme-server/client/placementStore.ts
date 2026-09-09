// 마우스로 맵에 배치한 에셋(타일/오브젝트)의 영구 저장소.
// 에디터(별도 페이지)와 게임(iframe)은 같은 origin이라 localStorage를 공유한다 —
// 에디터가 배치 모드를 켜고, 게임이 캔버스 클릭으로 실제 배치를 만들어 여기에 저장한다.
// 게임은 부팅 시 읽어 그리고, 다른 컨텍스트(에디터)의 변경은 'storage' 이벤트로 라이브 반영한다.
// 맵별로 분리 저장(맵을 바꿔도 각 맵의 배치가 유지됨).

import { readLocalStorage, writeLocalStorage } from './safeStorage'

export const PENDING_PLACEMENTS_STORAGE_KEY = 'my-sample-rpg:pending-placements'

// 배치 1건. kind에 따라 타일(타일셋 로컬 id) 또는 오브젝트(누끼 PNG url)로 그린다.
export type PlacedItem = {
  id: string
  kind: 'tile' | 'object'
  col: number
  row: number
  label?: string
  // kind === 'tile'
  tilesetSource?: string
  tileId?: number
  // kind === 'object'
  imageUrl?: string
  // 세그멘테이션 누끼는 클릭한 칸의 아래 중앙을 기준으로 배치한다.
  anchor?: 'top-left' | 'bottom-center'
  // 고해상도 재생성 PNG를 원래 게임 월드 크기로 표시한다.
  displayScale?: number
  // Decorations are separate from the original tile and object layers.
  renderLayer?: 'decoration'
  // 자동 생성된 장식처럼 한꺼번에 표시/교체/제거할 수 있는 그룹.
  sourceGroup?: string
  visible?: boolean
  themeSettings?: {
    runId: string
    night: number
    twinkle: boolean
    color: { gain: number[]; bias: number[] }
  }
}

// 배치 모드에서 게임으로 보내는 "지금 놓을 항목" 템플릿(좌표는 클릭 시 채운다).
export type PlacementTemplate = Omit<PlacedItem, 'id' | 'col' | 'row'>

type PlacementsByMap = Record<string, PlacedItem[]>
type SharedMapWorkflowState = {
  placements?: Record<string, PlacedItem[]>
}

const SHARED_STATE_ENDPOINT = '/__map-workflow-state'

const loadAll = (): PlacementsByMap => {
  const raw = readLocalStorage(PENDING_PLACEMENTS_STORAGE_KEY)
  if (!raw) {
    return {}
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as PlacementsByMap) : {}
  } catch {
    return {}
  }
}

const persist = (all: PlacementsByMap): void => {
  if (!writeLocalStorage(PENDING_PLACEMENTS_STORAGE_KEY, JSON.stringify(all))) {
    throw new Error('배치를 저장하지 못했습니다 (브라우저 저장소 차단 또는 용량 초과).')
  }
}

export const loadPlacementsForMap = (mapId: string): PlacedItem[] => {
  const items = loadAll()[mapId]
  return Array.isArray(items) ? items : []
}

export const setDecorationLayerVisible = async (
  mapId: string,
  visible: boolean
): Promise<void> => {
  const all = loadAll()
  all[mapId] = (all[mapId] ?? []).map((item) =>
    item.renderLayer === 'decoration' ? { ...item, visible } : item
  )
  persist(all)
  await persistSharedPlacements(mapId, all[mapId])
}

// 고유 id — 같은 칸에 여러 번 배치해도 구분되도록 시각 + 난수.
const newId = (): string =>
  `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

export const addPlacement = (
  mapId: string,
  template: PlacementTemplate,
  col: number,
  row: number
): PlacedItem => {
  const all = loadAll()
  const item: PlacedItem = { ...template, id: newId(), col, row }
  all[mapId] = [...(all[mapId] ?? []), item]
  persist(all)
  void persistSharedPlacements(mapId, all[mapId])
  return item
}

export const removePlacement = (mapId: string, id: string): PlacedItem[] => {
  const all = loadAll()
  const next = (all[mapId] ?? []).filter((item) => item.id !== id)
  all[mapId] = next
  persist(all)
  void persistSharedPlacements(mapId, next)
  return next
}

export const clearPlacementsForMap = (mapId: string): void => {
  const all = loadAll()
  delete all[mapId]
  persist(all)
  void persistSharedPlacements(mapId, [])
}

export type PositionedPlacement = {
  template: PlacementTemplate
  col: number
  row: number
}

export const replacePlacementsForSourceGroup = (
  mapId: string,
  sourceGroup: string,
  positioned: PositionedPlacement[]
): PlacedItem[] => {
  const all = loadAll()
  const preserved = (all[mapId] ?? []).filter(
    (item) => item.sourceGroup !== sourceGroup
  )
  const generated = positioned.map(({ template, col, row }) => ({
    ...template,
    sourceGroup,
    visible: template.visible !== false,
    id: newId(),
    col,
    row
  }))
  all[mapId] = [...preserved, ...generated]
  persist(all)
  void persistSharedPlacements(mapId, all[mapId])
  return all[mapId]
}

export const setPlacementsVisibleForSourceGroup = (
  mapId: string,
  sourceGroup: string,
  visible: boolean
): PlacedItem[] => {
  const all = loadAll()
  all[mapId] = (all[mapId] ?? []).map((item) =>
    item.sourceGroup === sourceGroup ? { ...item, visible } : item
  )
  persist(all)
  void persistSharedPlacements(mapId, all[mapId])
  return all[mapId]
}

export const removePlacementsForSourceGroup = (
  mapId: string,
  sourceGroup: string
): PlacedItem[] => {
  const all = loadAll()
  all[mapId] = (all[mapId] ?? []).filter(
    (item) => item.sourceGroup !== sourceGroup
  )
  persist(all)
  void persistSharedPlacements(mapId, all[mapId])
  return all[mapId]
}

const persistSharedPlacements = async (
  mapId: string,
  placements: PlacedItem[]
): Promise<void> => {
  try {
    await fetch(SHARED_STATE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'placements', mapId, placements })
    })
  } catch {
    // 개발 서버를 통하지 않는 실행에서는 기존 localStorage 동작을 유지한다.
  }
}

export const hydratePlacementsForMapFromServer = async (
  mapId: string
): Promise<PlacedItem[]> => {
  try {
    const response = await fetch(SHARED_STATE_ENDPOINT, { cache: 'no-store' })
    if (!response.ok) return loadPlacementsForMap(mapId)
    const payload = (await response.json()) as SharedMapWorkflowState
    if (!payload.placements || !(mapId in payload.placements)) {
      return loadPlacementsForMap(mapId)
    }
    const placements = payload.placements[mapId]
    if (!Array.isArray(placements)) return loadPlacementsForMap(mapId)
    const all = loadAll()
    all[mapId] = placements
    persist(all)
    return placements
  } catch {
    return loadPlacementsForMap(mapId)
  }
}
