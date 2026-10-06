// 귀환 표지석(빠른 이동) — 지역이 늘어 오가기가 지루해지지 않게, 한 번 손을 댄 표지석 사이를 바로 오간다.
// 표지석은 맵에 'waystone_<id>' 오브젝트로 두고(그림은 오벨리스크), 도착 칸은 여기 한 곳에서 정한다.
// 발견한 표지석은 월드 저장(worldSaveState.discoveredWaystoneIds)에 남는다. 느티골은 처음부터 안다.

export type Waystone = {
  id: string
  label: string
  sceneId: string
  // 이동해 오면 서는 칸(표지석 바로 아래)
  spawn: { x: number; y: number }
}

export const WAYSTONES: readonly Waystone[] = [
  { id: 'tir-chonail', label: '느티골', sceneId: 'town', spawn: { x: 30, y: 21 } },
  { id: 'harvest-village', label: '물레골', sceneId: 'harvest-village', spawn: { x: 17, y: 7 } },
  { id: 'reed-village', label: '갈대골', sceneId: 'reed-village', spawn: { x: 17, y: 23 } },
  { id: 'ruins-camp', label: '신전 외곽 야영지', sceneId: 'ruins-outskirts', spawn: { x: 9, y: 13 } },
  { id: 'frost-village', label: '서리목', sceneId: 'frost-village', spawn: { x: 24, y: 18 } }
]

export const STARTING_WAYSTONE_IDS: readonly string[] = ['tir-chonail']

const WAYSTONE_OBJECT_PREFIX = 'waystone_'
// 한 쪽에 고를 수 있는 곳의 수(대화창 선택지는 숫자키 1~4) — 넘치면 "다음…"으로 넘긴다.
const WAYSTONES_PER_PAGE = 3

export const getWaystoneIdFromCharacterId = (characterId: string): string | undefined => {
  if (!characterId.startsWith(WAYSTONE_OBJECT_PREFIX)) {
    return undefined
  }
  const id = characterId.slice(WAYSTONE_OBJECT_PREFIX.length)
  return WAYSTONES.some((waystone) => waystone.id === id) ? id : undefined
}

export const getWaystone = (id: string): Waystone | undefined =>
  WAYSTONES.find((waystone) => waystone.id === id)

export type WaystoneMenuPage = {
  choices: string[]
  // 선택지 순서대로: 가는 곳(표지석) 또는 다음 쪽
  targets: Array<{ kind: 'travel'; waystone: Waystone } | { kind: 'next'; page: number } | { kind: 'stay' }>
}

// 지금 서 있는 표지석을 뺀, 발견한 표지석 목록의 한 쪽. 목록 순서는 WAYSTONES(이야기 순서)를 따른다.
export const getWaystoneMenuPage = (
  discoveredIds: readonly string[],
  currentId: string,
  page: number
): WaystoneMenuPage => {
  const destinations = WAYSTONES.filter(
    (waystone) => waystone.id !== currentId && discoveredIds.includes(waystone.id)
  )
  const pageCount = Math.max(1, Math.ceil(destinations.length / WAYSTONES_PER_PAGE))
  const safePage = ((page % pageCount) + pageCount) % pageCount
  const slice = destinations.slice(safePage * WAYSTONES_PER_PAGE, (safePage + 1) * WAYSTONES_PER_PAGE)
  const targets: WaystoneMenuPage['targets'] = slice.map((waystone) => ({ kind: 'travel', waystone }))
  const choices = slice.map((waystone) => waystone.label)
  if (pageCount > 1) {
    targets.push({ kind: 'next', page: safePage + 1 })
    choices.push('다음…')
  } else {
    targets.push({ kind: 'stay' })
    choices.push('그만두기')
  }
  return { choices, targets }
}
