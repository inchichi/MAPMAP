import { Rectangle, Texture } from 'pixi.js'


// Ninja Adventure 스프라이트 시트 규약(Knight/Skull/Cyclope/Beast 에서 열2·열3이 오차 0.0의
// 정확한 거울상임을 확인해 확정): 열 = 방향, 행 = 애니 프레임.
export const ACTOR_DIRECTIONS = ['down', 'up', 'left', 'right'] as const

export type ActorDirection = (typeof ACTOR_DIRECTIONS)[number]

// 방향별 프레임 목록. 프레임이 한 장뿐인 동작(idle/attack)도 같은 모양으로 다룬다.
export type DirectionalFrames = Record<ActorDirection, Texture[]>

const FRAME_SIZE = 16

// Pixi 의 Assets 로더는 워커에서 이미지를 디코드하는데, 그 경로가 환경에 따라 완료되지
// 않는 일이 있다(이 저장소의 헤드리스 크로미움에서 실제로 멈췄다). 캐시/번들 기능이
// 필요 없으므로 평범한 Image 디코드로 텍스처를 만든다.
export const loadImageTexture = async (url: string): Promise<Texture> => {
  const image = new Image()
  image.src = url
  await image.decode()
  const texture = Texture.from(image)
  // Pixi 8 의 기본 필터는 linear 다. 16px 아트를 2배로 띄우면 보간이 걸려 뭉개지고,
  // 계약 1절의 "2x 정수 배율(nearest)" 과 어긋나 화면이 내보내기 렌더와 달라진다.
  // 기존 게임(createPixiTiledMapView)도 같은 이유로 텍스처마다 nearest 를 지정한다.
  texture.source.scaleMode = 'nearest'
  return texture
}

const sliceDirectional = (
  texture: Texture,
  frameWidth: number,
  frameHeight: number
): DirectionalFrames => {
  const columns = Math.floor(texture.width / frameWidth)
  const rows = Math.floor(texture.height / frameHeight)
  if (columns < ACTOR_DIRECTIONS.length) {
    throw new Error(
      `스프라이트 시트에 방향 4열이 없습니다: ${columns}열 (${texture.width}x${texture.height})`
    )
  }

  const frames = {} as DirectionalFrames
  ACTOR_DIRECTIONS.forEach((direction, column) => {
    frames[direction] = Array.from({ length: rows }, (_unused, row) => new Texture({
      source: texture.source,
      frame: new Rectangle(
        column * frameWidth,
        row * frameHeight,
        frameWidth,
        frameHeight
      )
    }))
  })
  return frames
}

/**
 * 기존 게임의 플레이어 외형. 방향별 시트가 아니라 타일셋 안의 정지 타일 한 장이라
 * (tiny-dungeon-16), type 속성으로 타일을 찾아 그 칸만 잘라낸다.
 */
export type ActorAnimations = {
  walk: DirectionalFrames
  idle: DirectionalFrames
  attack: DirectionalFrames
}

/** 플레이어: walk.png 64x64(4방향 x 4프레임), idle/attack.png 64x16(4방향 x 1프레임). */
export const loadPlayerAnimations = async (urls: {
  walk: string
  idle: string
  attack: string
}): Promise<ActorAnimations> => {
  const [walk, idle, attack] = await Promise.all([
    loadImageTexture(urls.walk),
    loadImageTexture(urls.idle),
    loadImageTexture(urls.attack)
  ])
  return {
    walk: sliceDirectional(walk, FRAME_SIZE, FRAME_SIZE),
    idle: sliceDirectional(idle, FRAME_SIZE, FRAME_SIZE),
    attack: sliceDirectional(attack, FRAME_SIZE, FRAME_SIZE)
  }
}

export const loadMonsterAnimations = async (url: string): Promise<DirectionalFrames> => {
  const texture = await loadImageTexture(url)
  return sliceDirectional(texture, FRAME_SIZE, FRAME_SIZE)
}

/**
 * 보스: 동작마다 파일이 따로 있고 프레임 크기도 팩마다 다르다(50x50, 60x60 등).
 * 높이를 프레임 한 변으로 보고 폭에서 프레임 수를 유도한다 — 보스 시트는 가로 한 줄이다.
 */
export const loadBossFrames = async (url: string): Promise<Texture[]> => {
  const texture = await loadImageTexture(url)
  const size = texture.height
  const count = Math.max(1, Math.floor(texture.width / size))
  return Array.from({ length: count }, (_unused, index) => new Texture({
    source: texture.source,
    frame: new Rectangle(index * size, 0, size, size)
  }))
}
