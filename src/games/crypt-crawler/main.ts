import tilesetXml from './assets/tilesets/ninja-dungeon-16.tsx?raw'
import atlasUrl from './assets/tilesets/ninja-dungeon-16.png'
// 플레이어는 기존 게임의 캐릭터를 그대로 쓴다. 파일을 복사하지 않고 상대 경로로 가져온다.
import playerWalkUrl from './assets/actors/player/walk.png'
import playerIdleUrl from './assets/actors/player/idle.png'
import playerAttackUrl from './assets/actors/player/attack.png'

import { parseTiledMap } from '../my-sample-rpg/tiled/parseTiledMap'
import { buildDungeonModel } from './dungeonModel'
import type { Floor } from './floors'
import { createCryptView, type LoadFloor } from './rendering/createCryptView'
import {
  loadBossFrames,
  loadImageTexture,
  loadMonsterAnimations,
  loadPlayerAnimations,
  type DirectionalFrames
} from './rendering/loadActorTextures'
import type { Texture } from 'pixi.js'
import './styles.css'

// 몬스터 시트는 종류마다 폴더가 하나, 파일은 sprite.png 로 통일돼 있다(임포트 스크립트가
// 이름을 맞춘다). glob 으로 URL 표를 만들어 맵이 요구하는 종류만 실제로 읽는다.
const monsterSheetUrls = import.meta.glob<string>(
  './assets/actors/monsters/*/sprite.png',
  { eager: true, query: '?url', import: 'default' }
)

// 보스는 방향별 시트가 아니라 동작별 파일이고, 팩마다 있는 동작이 다르다 — walk.png 이 있는
// 것은 demoncyclop 둘뿐이다. 걷는 그림이 있으면 그것을, 없으면 있는 것 중 프레임이 이어지는
// 한 장을 쓴다. sprite.png 는 애니가 아니라 초상 한 장이라 뺀다.
const bossSheetUrls = import.meta.glob<string>(
  './assets/actors/bosses/*/*.png',
  { eager: true, query: '?url', import: 'default' }
)
const BOSS_SHEET_ORDER = ['walk', 'idle', 'charge', 'jump', 'attack', 'hit']

// 파일 이름에 프레임 크기가 붙은 것이 있다(giantfrog/idle40x40.png). 앞부분으로 고른다.
const bossSheetUrl = (kind: string): string | undefined => {
  const folder = `./assets/actors/bosses/${kind}/`
  const paths = Object.keys(bossSheetUrls).filter((path) => path.startsWith(folder))
  const wanted = BOSS_SHEET_ORDER.map(
    (action) => paths.find((path) => path.slice(folder.length).startsWith(action))
  ).find((path) => path !== undefined)

  return wanted ? bossSheetUrls[wanted] : undefined
}

// 종류별 시트는 층을 오갈 때마다 다시 디코드할 이유가 없다. 한 번 읽으면 여기 남는다.
const monsterFrames = new Map<string, DirectionalFrames>()
const bossFrames = new Map<string, Texture[]>()

const ensureMonsterFrames = async (kinds: Set<string>) => {
  await Promise.all(
    [...kinds].filter((kind) => !monsterFrames.has(kind)).map(async (kind) => {
      const url = monsterSheetUrls[`./assets/actors/monsters/${kind}/sprite.png`]
      if (!url) {
        console.warn('[crypt-crawler] 몬스터 시트가 없습니다:', kind)
        return
      }
      monsterFrames.set(kind, await loadMonsterAnimations(url))
    })
  )
}

const ensureBossFrames = async (kinds: Set<string>) => {
  await Promise.all(
    [...kinds].filter((kind) => !bossFrames.has(kind)).map(async (kind) => {
      const url = bossSheetUrl(kind)
      if (!url) {
        console.warn('[crypt-crawler] 보스 시트가 없습니다:', kind)
        return
      }
      bossFrames.set(kind, await loadBossFrames(url))
    })
  )
}

// 384² TMX 한 장이 2.5MB 다. 번들에 인라인하면 5장이 곧 JS 12MB 라 public/ 에 두고 읽는다.
const fetchFloorXml = async (stem: string): Promise<string> => {
  const url = `${import.meta.env.BASE_URL}crypt-maps/${stem}.tmx`
  const response = await fetch(url)
  // dev 서버는 없는 파일에 200 과 index.html 을 대신 내준다. 상태 코드만으로는 모른다.
  const text = response.ok ? await response.text() : ''

  if (!text.includes('<map')) {
    throw new Error(
      `맵을 읽지 못했습니다: ${url} (HTTP ${response.status})\n` +
      'python3 scripts/generate-crypt.py 로 층 맵 5장을 먼저 만드세요.'
    )
  }

  return text
}

// 계약상 타일셋 참조는 하나뿐이다. TMX 가 public/ 로 옮겨지며 TSX 까지의 상대 경로가
// 달라졌으므로 경로를 못 박지 않고 맵이 적어 둔 문자열을 그대로 키로 쓴다.
const tilesetSourceOf = (mapXml: string): string => {
  const found = /<tileset[^>]*\bsource="([^"]+)"/.exec(mapXml)

  if (!found) {
    throw new Error('TMX 에 외부 타일셋 참조가 없습니다.')
  }

  return found[1]
}

const loadFloor: LoadFloor = async (floor: Floor) => {
  const mapXml = await fetchFloorXml(floor.stem)
  const map = parseTiledMap({
    mapXml,
    externalTilesets: { [tilesetSourceOf(mapXml)]: tilesetXml }
  })
  const model = buildDungeonModel(map)

  await ensureMonsterFrames(new Set(model.monsters.map((monster) => monster.kind)))
  await ensureBossFrames(new Set(model.bosses.map((boss) => boss.kind)))

  return { map, model }
}

const boot = async () => {
  const host = document.querySelector<HTMLDivElement>('#app')
  if (!host) {
    throw new Error('#app 요소가 없습니다.')
  }

  const atlas = await loadImageTexture(atlasUrl)
  const player = await loadPlayerAnimations({
    walk: playerWalkUrl,
    idle: playerIdleUrl,
    attack: playerAttackUrl
  })

  await createCryptView(host, { atlas, player, monsterFrames, bossFrames }, loadFloor)
}

// 부팅 실패가 조용히 묻히면 빈 화면만 남는다. 화면에도 띄운다.
boot().catch((error: unknown) => {
  console.error('[crypt-crawler] 부팅 실패', error)
  const host = document.querySelector<HTMLElement>('#app')
  if (host) {
    host.textContent = `부팅 실패: ${error instanceof Error ? error.message : String(error)}`
    host.style.whiteSpace = 'pre-wrap'
  }
})
