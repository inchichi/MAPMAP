// 세계 지도(M): 지역(씬)을 격자 칸에 놓은 배치, 지역 사이 길, 지형 종류.
// 실제 연결은 각 맵 TMX 의 portal 오브젝트를 따른다(배치 칸은 보기 좋게 손으로 정한 것 — 북쪽이 위).
// 시험장(boss-arena)은 에디터로만 들어가는 곳이라 지도에 없다.
// 가 본 지역 목록은 worldSaveState.visitedSceneIds 에 저장하고, 안 가 본 지역은 지도에서 안개로 가린다.

export type WorldMapBiome = 'village' | 'forest' | 'cave' | 'water' | 'ruins' | 'snow'

export type WorldMapRegion = {
  sceneId: string
  column: number
  row: number
  biome: WorldMapBiome
}

export const WORLD_MAP_COLUMNS = 6
export const WORLD_MAP_ROWS = 7

export const WORLD_MAP_REGIONS: readonly WorldMapRegion[] = [
  // 3장 — 북쪽
  { sceneId: 'ice-cave-2f', column: 0, row: 0, biome: 'cave' },
  { sceneId: 'frost-village', column: 2, row: 1, biome: 'snow' },
  { sceneId: 'frozen-lake', column: 1, row: 1, biome: 'snow' },
  { sceneId: 'ice-cave-1f', column: 0, row: 1, biome: 'cave' },
  { sceneId: 'north-pass', column: 3, row: 2, biome: 'snow' },
  // 1장 — 느티골 둘레
  { sceneId: 'crystal-mine', column: 5, row: 2, biome: 'cave' },
  { sceneId: 'town', column: 3, row: 3, biome: 'village' },
  { sceneId: 'hunting-ground', column: 4, row: 3, biome: 'forest' },
  { sceneId: 'cave', column: 5, row: 3, biome: 'cave' },
  { sceneId: 'harvest-village', column: 3, row: 4, biome: 'village' },
  // 2장 — 남서쪽 물길과 숲
  { sceneId: 'sunken-temple-2f', column: 4, row: 4, biome: 'ruins' },
  { sceneId: 'upstream-waterway', column: 2, row: 5, biome: 'water' },
  { sceneId: 'sunken-temple-1f', column: 4, row: 5, biome: 'ruins' },
  { sceneId: 'reed-well', column: 0, row: 6, biome: 'water' },
  { sceneId: 'reed-village', column: 1, row: 6, biome: 'village' },
  { sceneId: 'sunken-forest', column: 2, row: 6, biome: 'forest' },
  { sceneId: 'ruins-outskirts', column: 3, row: 6, biome: 'ruins' }
]

// 포탈로 이어진 지역 쌍(한 번씩만)
export const WORLD_MAP_ROUTES: readonly (readonly [string, string])[] = [
  ['town', 'hunting-ground'],
  ['town', 'harvest-village'],
  ['town', 'north-pass'],
  ['hunting-ground', 'cave'],
  ['hunting-ground', 'crystal-mine'],
  ['cave', 'crystal-mine'],
  ['north-pass', 'frost-village'],
  ['frost-village', 'frozen-lake'],
  ['frozen-lake', 'ice-cave-1f'],
  ['ice-cave-1f', 'ice-cave-2f'],
  ['harvest-village', 'upstream-waterway'],
  ['upstream-waterway', 'reed-village'],
  ['reed-village', 'reed-well'],
  ['reed-village', 'sunken-forest'],
  ['reed-village', 'ruins-outskirts'],
  ['sunken-forest', 'ruins-outskirts'],
  ['ruins-outskirts', 'sunken-temple-1f'],
  ['sunken-temple-1f', 'sunken-temple-2f']
]

export const getWorldMapRegion = (sceneId: string): WorldMapRegion | undefined =>
  WORLD_MAP_REGIONS.find((region) => region.sceneId === sceneId)

// 길은 한쪽 끝이라도 가 봤으면 보인다 — 안개 속으로 이어지는 길이 "아직 갈 곳"을 알려 준다.
export const isWorldMapRouteVisible = (
  route: readonly [string, string],
  visitedSceneIds: ReadonlySet<string>
): boolean => visitedSceneIds.has(route[0]) || visitedSceneIds.has(route[1])
