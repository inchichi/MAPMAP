// 맵의 빛 — 화로·모닥불, 발광 식물, 수정, 밝힌 비석 둘레에 가산 혼합 빛 원을 얹는다(맥동·일렁임).
// 어떤 타일이 빛을 내는지와 색·크기·밝기 변화는 여기서 정하고, 그리기는 맵 화면(createPixiTiledMapView)이 한다.

export type MapLightKind = 'fire' | 'glow-plant' | 'crystal' | 'stele'

export type MapLightStyle = {
  color: number
  // 빛 원 반지름(칸)
  radiusTiles: number
  // 평균 밝기(가산 혼합 알파)
  alpha: number
  // 타일 왼쪽 위에서 빛 중심까지(칸). 두 칸짜리 비석은 두 칸 사이.
  offsetX: number
  offsetY: number
}

const MAP_LIGHT_STYLES: Record<MapLightKind, MapLightStyle> = {
  fire: { color: 0xff9a3c, radiusTiles: 2.6, alpha: 0.42, offsetX: 0.5, offsetY: 0.45 },
  'glow-plant': { color: 0x5effd0, radiusTiles: 1.4, alpha: 0.32, offsetX: 0.5, offsetY: 0.5 },
  crystal: { color: 0x8cc8ff, radiusTiles: 1.3, alpha: 0.24, offsetX: 0.5, offsetY: 0.5 },
  stele: { color: 0x6fb4ff, radiusTiles: 2.4, alpha: 0.36, offsetX: 1, offsetY: 0.2 }
}

export const getMapLightStyle = (kind: MapLightKind): MapLightStyle => MAP_LIGHT_STYLES[kind]

// 빛을 내는 타일 종류. 여러 칸짜리 소품은 한 칸에만 빛을 단다(장신 수정은 윗칸, 비석은 아랫줄 왼쪽).
export const getMapLightKind = (tileType: string | undefined): MapLightKind | undefined => {
  if (!tileType) {
    return undefined
  }
  if (/^cave_prop_brazier_\d+$/.test(tileType)) {
    return 'fire'
  }
  if (/^cave_prop_glow_plant_[ab]$/.test(tileType)) {
    return 'glow-plant'
  }
  if (/^cave_prop_crystal_(a|c|tall_r0c0)$/.test(tileType)) {
    return 'crystal'
  }
  if (tileType === 'ruins_stele_lit_r1c0') {
    return 'stele'
  }
  return undefined
}

// 지금 밝기(알파). 불은 빠르게 일렁이고, 식물·수정은 느리게 숨 쉬고, 비석은 아주 천천히 밝아졌다 어두워진다.
// phase 는 빛마다 다른 값(같은 박자로 깜빡이지 않게).
export const getMapLightAlpha = (kind: MapLightKind, now: number, phase: number): number => {
  const { alpha } = MAP_LIGHT_STYLES[kind]
  const t = now / 1000 + phase
  switch (kind) {
    case 'fire':
      return alpha * (0.82 + 0.1 * Math.sin(t * 9.3) + 0.08 * Math.sin(t * 23.7))
    case 'glow-plant':
    case 'crystal':
      return alpha * (0.8 + 0.2 * Math.sin(t * 1.6))
    case 'stele':
      return alpha * (0.7 + 0.3 * Math.sin(t * 0.9))
  }
}

// 불빛은 크기도 조금 일렁인다(1 기준 배율).
export const getMapLightScale = (kind: MapLightKind, now: number, phase: number): number =>
  kind === 'fire' ? 1 + 0.04 * Math.sin((now / 1000 + phase) * 7.1) : 1

// 지하 장면은 화면 가장자리를 살짝 어둡게(비네트) — 화로 빛이 더 살아 보인다.
const UNDERGROUND_SCENE_IDS = new Set([
  'cave',
  'crystal-mine',
  'sunken-temple-1f',
  'sunken-temple-2f',
  'reed-well',
  'ice-cave-1f',
  'ice-cave-2f'
])

export const isUndergroundScene = (sceneId: string): boolean => UNDERGROUND_SCENE_IDS.has(sceneId)
