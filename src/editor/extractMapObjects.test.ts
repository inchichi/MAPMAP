import { describe, expect, it } from 'vitest'

import { buildMapObjectExtractionRequest } from './extractMapObjects'
import type { GameFile, LoadedGameMap } from './loadGame'

// 2x2 타일 나무 군집 하나가 있는 최소 TMX. object 레이어는 비워 군집이 억제되지 않게 한다.
const tmx = (): string => `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.8" orientation="orthogonal" width="4" height="4" tilewidth="32" tileheight="32">
  <tileset firstgid="1" source="../tilesets/town-32.tsx"/>
  <layer id="1" name="object" width="4" height="4">
    <data encoding="csv">
1,2,0,0,
9,10,0,0,
0,0,0,0,
0,0,0,0
</data>
  </layer>
</map>`

const tsx = (): string => `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.8" name="town-32" tilewidth="32" tileheight="32" tilecount="560" columns="8">
  <image source="town-32.png" width="256" height="2240"/>
  <tile id="0" type="tree_canopy"/>
  <tile id="1" type="tree_canopy"/>
  <tile id="8" type="tree_canopy"/>
  <tile id="9" type="tree_canopy"/>
</tileset>`

const files = (mapPath: string): GameFile[] => [
  { path: mapPath, name: 'town.tmx', text: tmx() },
  { path: 'src/games/my-sample-rpg/assets/tilesets/town-32.tsx', name: 'town-32.tsx', text: tsx() }
]

const mapOf = (mapPath: string, entities: LoadedGameMap['entities']): LoadedGameMap => ({
  id: 'town',
  name: 'town',
  file: mapPath,
  entities,
  layers: ['object']
})

describe('buildMapObjectExtractionRequest', () => {
  const mapPath = 'src/games/my-sample-rpg/assets/maps/town.tmx'

  it('맵 파일을 못 찾으면 요청하지 않는다', () => {
    const { result } = buildMapObjectExtractionRequest(mapOf('missing.tmx', []), files(mapPath))
    expect(result.requested).toBe(0)
    expect(result.skippedReason).toBe('no-map-file')
  })

  it('셀을 가진 대상이 없으면 요청하지 않는다', () => {
    const { result } = buildMapObjectExtractionRequest(mapOf(mapPath, []), files(mapPath))
    expect(result.requested).toBe(0)
    expect(result.skippedReason).toBe('no-targets')
  })

  it('군집 엔티티의 셀과 타일셋 메타로 요청을 만든다', () => {
    const entities = [
      // 군집 id의 종류는 타일 type이 아니라 정규화된 종류(tree_canopy → tree)다.
      { id: 'tile:tree:0,0', name: '나무', kind: 'tree' }
    ] as LoadedGameMap['entities']
    const { payload, result } = buildMapObjectExtractionRequest(
      mapOf(mapPath, entities),
      files(mapPath)
    )

    expect(result.requested).toBe(1)
    // 타일셋 이미지 경로가 .tsx 기준 상대 경로로 풀려야 한다.
    expect(payload.tileset_path).toBe('src/games/my-sample-rpg/assets/tilesets/town-32.png')
    expect(payload.tile_width).toBe(32)
    expect(payload.columns).toBe(8)

    const objects = payload.objects as Array<{ id: string; cells: unknown[] }>
    expect(objects).toHaveLength(1)
    expect(objects[0].id).toBe('tile:tree:0,0')
    expect(objects[0].cells).toHaveLength(4)
    expect(objects[0].cells.length).toBeGreaterThan(0)
  })

  it('에셋 폴더 밖 타일셋은 제외한다(서비스가 쓰기를 거부하는 경로)', () => {
    const outside: GameFile[] = [
      { path: mapPath, name: 'town.tmx', text: tmx() },
      { path: 'vendor/tilesets/town-32.tsx', name: 'town-32.tsx', text: tsx() }
    ]
    const entities = [
      // 군집 id의 종류는 타일 type이 아니라 정규화된 종류(tree_canopy → tree)다.
      { id: 'tile:tree:0,0', name: '나무', kind: 'tree' }
    ] as LoadedGameMap['entities']
    const { result } = buildMapObjectExtractionRequest(mapOf(mapPath, entities), outside)
    expect(result.requested).toBe(0)
  })
})
