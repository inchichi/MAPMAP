// 맵 인식 시점의 묶인 오브젝트 자동 추출 요청.
//
// 나무·건물처럼 타일 여러 장으로 그려진 오브젝트를 스타일 서비스가 누끼 PNG + 사이드카
// 메타(셀 목록·타일셋)로 저장해 두면, 스타일 변환 모달의 '추출' 탭과 배치 팔레트, 그리고
// 스타일 파이프라인의 분기 B(묶인 오브젝트)가 그걸 대상으로 쓴다. 이 요청이 없으면 세
// 기능 모두 대상이 0개인 채로 남는다.
//
// createEditorApp에서 분리한 이유: 저 파일은 병합 충돌이 잦아, 재파싱·경로 해석 로직을
// 여기 두고 호출부는 한 줄로 유지한다.

import {
  findAllStyleTargetCells,
  findFileByRelativeSource,
  resolveRelativePath,
  type GameFile,
  type LoadedGameMap
} from './loadGame'
import { extractTmxObjects, type TmxObject } from './tmxObjects'
import { extractTmxTilesetImageInfo } from './tmxTileEntities'

// 스타일 서비스가 쓰기를 허용하는 에셋 루트. 이 밖의 타일셋은 보내지 않는다
// (서비스도 경로 탈출을 거부하므로 여기서 먼저 걸러 불필요한 요청을 줄인다).
const ASSETS_PREFIX = 'src/games/my-sample-rpg/assets/'

type ResolvedTileset = {
  imagePath: string
  tileWidth: number
  tileHeight: number
  columns: number
}

export type MapObjectExtractionResult = {
  requested: number
  tilesetPath?: string
  skippedReason?: 'no-map-file' | 'parse-failed' | 'no-targets'
}

// 한 맵의 오브젝트 셀을 모아 /extract-objects로 보낸다. 실패해도 조용히 무시한다 —
// 추출은 부가 기능이고, 스타일 서비스가 꺼져 있을 수 있다.
export const buildMapObjectExtractionRequest = (
  map: LoadedGameMap,
  files: GameFile[]
): { payload: Record<string, unknown>; result: MapObjectExtractionResult } => {
  const mapFile = files.find((file) => file.path === map.file)
  if (!mapFile) {
    return { payload: {}, result: { requested: 0, skippedReason: 'no-map-file' } }
  }

  let objects: TmxObject[] = []
  try {
    objects = extractTmxObjects(mapFile.text)
  } catch {
    return { payload: {}, result: { requested: 0, skippedReason: 'parse-failed' } }
  }

  const cellsByEntityId = findAllStyleTargetCells(mapFile, files, objects, map.entities)

  // 타일셋 .tsx 해석은 source별로 1회만 — 맵 하나에 엔티티 수십 개가 같은 타일셋을 쓴다.
  const tilesetBySource = new Map<string, ResolvedTileset | undefined>()
  const resolveTileset = (source: string): ResolvedTileset | undefined => {
    if (!tilesetBySource.has(source)) {
      const tsxFile = findFileByRelativeSource(files, mapFile.path, source)
      const info = tsxFile ? extractTmxTilesetImageInfo(tsxFile.text) : undefined
      const imagePath =
        tsxFile && info ? resolveRelativePath(tsxFile.path, info.imageSource) : undefined
      tilesetBySource.set(
        source,
        info && imagePath && imagePath.startsWith(ASSETS_PREFIX)
          ? {
              imagePath,
              tileWidth: info.tileWidth,
              tileHeight: info.tileHeight,
              columns: info.columns
            }
          : undefined
      )
    }
    return tilesetBySource.get(source)
  }

  const targets: Array<{
    id: string
    label: string
    cells: unknown[]
    sharedOutsideCells: number
    tileset: ResolvedTileset
  }> = []

  for (const entity of map.entities) {
    const detail = cellsByEntityId.get(entity.id)
    if (!detail || detail.cells.length === 0 || detail.tilesetSource === undefined) {
      continue
    }
    const tileset = resolveTileset(detail.tilesetSource)
    if (!tileset) {
      continue
    }
    targets.push({
      id: entity.id,
      label: entity.name,
      cells: detail.cells,
      sharedOutsideCells: detail.sharedOutsideCells,
      tileset
    })
  }

  if (targets.length === 0) {
    return { payload: {}, result: { requested: 0, skippedReason: 'no-targets' } }
  }

  // 요청 하나는 타일셋 하나를 다룬다(서비스 계약). 현재 데이터는 맵당 타일셋이 하나라
  // 첫 대상 기준으로 묶고, 다른 타일셋을 쓰는 대상은 이번 요청에서 제외한다.
  const first = targets[0].tileset
  const sameTileset = targets.filter((target) => target.tileset.imagePath === first.imagePath)

  return {
    payload: {
      tileset_path: first.imagePath,
      tile_width: first.tileWidth,
      tile_height: first.tileHeight,
      columns: first.columns,
      objects: sameTileset.map((target) => ({
        id: target.id,
        label: target.label,
        cells: target.cells,
        sharedOutsideCells: target.sharedOutsideCells
      }))
    },
    result: { requested: sameTileset.length, tilesetPath: first.imagePath }
  }
}

// 맵당 1회만 보낸다 — scene-changed는 같은 맵으로도 반복해서 온다.
const requestedMapIds = new Set<string>()

export const requestMapObjectExtraction = (
  map: LoadedGameMap,
  files: GameFile[]
): Promise<MapObjectExtractionResult> => {
  if (requestedMapIds.has(map.id)) {
    return Promise.resolve({ requested: 0, skippedReason: 'no-targets' })
  }

  const { payload, result } = buildMapObjectExtractionRequest(map, files)
  if (result.requested === 0) {
    return Promise.resolve(result)
  }

  // 파싱은 이미 끝났고 남은 건 네트워크 — 성공한 맵만 기록해, 서비스가 꺼져 있었으면
  // 다음 씬 전환 때 다시 시도한다.
  return fetch('/api/style/extract-objects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then((response) => {
      if (response.ok) {
        requestedMapIds.add(map.id)
      }
      return result
    })
    .catch(() => ({ requested: 0, skippedReason: 'no-targets' as const }))
}
