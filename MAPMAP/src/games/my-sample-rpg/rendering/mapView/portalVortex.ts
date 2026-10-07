// 포탈 그림: 메이플 포탈처럼 서 있는 푸른 빛 소용돌이(타원) + 바닥 빛 + 위로 떠오르는 반짝이.
// 작은 픽셀 캔버스에 8장 그림을 한 번 만들어 모든 포탈이 같이 쓰고(AnimatedSprite), 2배로 늘려 픽셀이 또렷하게 보인다.
// characterNodes.ts 가 포탈마다 만들고, 씬이 끝날 때 컨테이너와 함께 사라진다(그림 자체는 모듈에 남겨 다음 씬에서 다시 쓴다).
import { AnimatedSprite, Texture } from 'pixi.js'

const ART_WIDTH = 24
const ART_HEIGHT = 36
const FRAME_COUNT = 8
// 화면에서 커지는 배율(픽셀 1칸 = 2px)
export const PORTAL_VORTEX_SCALE = 2
export const PORTAL_VORTEX_WIDTH = ART_WIDTH * PORTAL_VORTEX_SCALE
export const PORTAL_VORTEX_HEIGHT = ART_HEIGHT * PORTAL_VORTEX_SCALE

// 안쪽(밝음) → 바깥쪽(짙음) 푸른 빛
const BODY_COLORS = ['#f2fdff', '#b8efff', '#6fd2ff', '#3f9cf0', '#2f68d0'] as const
const BAND_COLOR = '#24479e'
const RIM_COLOR = '#d9f8ff'
const GLOW_COLOR = 'rgba(111, 210, 255, 0.45)'
const SPARKLE_COLORS = ['#ffffff', '#bff3ff'] as const

let frameTextures: Texture[] | undefined

const drawFrame = (context: CanvasRenderingContext2D, frame: number) => {
  const phase = (frame / FRAME_COUNT) * Math.PI * 2
  const centerX = ART_WIDTH / 2
  const centerY = 17
  const radiusX = 8
  const radiusY = 13

  context.clearRect(0, 0, ART_WIDTH, ART_HEIGHT)

  // 바닥 빛
  context.fillStyle = GLOW_COLOR
  for (let dy = -2; dy <= 2; dy += 1) {
    const halfWidth = Math.round(11 * Math.sqrt(1 - (dy / 3) ** 2))
    context.fillRect(centerX - halfWidth, 32 + dy, halfWidth * 2, 1)
  }

  // 소용돌이 몸통 — 타원 안 픽셀마다 거리·각도로 색을 고르고, 나선 띠는 프레임마다 돈다.
  for (let y = 0; y < ART_HEIGHT; y += 1) {
    for (let x = 0; x < ART_WIDTH; x += 1) {
      const nx = (x + 0.5 - centerX) / radiusX
      const ny = (y + 0.5 - centerY) / radiusY
      const distance = Math.hypot(nx, ny)

      if (distance > 1) {
        continue
      }

      if (distance > 0.88) {
        context.fillStyle = RIM_COLOR
      } else {
        const angle = Math.atan2(ny, nx)
        const spiral = Math.sin(angle * 2 + distance * 7 - phase)
        context.fillStyle =
          spiral > 0.55 && distance > 0.25
            ? BAND_COLOR
            : BODY_COLORS[Math.min(BODY_COLORS.length - 1, Math.floor(distance * BODY_COLORS.length))]
      }

      context.fillRect(x, y, 1, 1)
    }
  }

  // 위로 떠오르는 반짝이(프레임마다 한 칸씩 오른다)
  for (let index = 0; index < 5; index += 1) {
    const rise = (frame * 3 + index * 7) % 30
    const x = index % 2 === 0 ? 2 + (index % 3) : ART_WIDTH - 3 - (index % 3)
    const y = 31 - rise

    context.fillStyle = SPARKLE_COLORS[index % 2]
    context.fillRect(x, y, 1, 1)

    if (index % 2 === 0) {
      context.fillRect(x - 1, y, 3, 1)
      context.fillRect(x, y - 1, 1, 3)
    }
  }
}

const getFrameTextures = (): Texture[] => {
  if (frameTextures) {
    return frameTextures
  }

  frameTextures = Array.from({ length: FRAME_COUNT }, (_, frame) => {
    const canvas = document.createElement('canvas')
    canvas.width = ART_WIDTH
    canvas.height = ART_HEIGHT
    const context = canvas.getContext('2d')

    if (context) {
      drawFrame(context, frame)
    }

    const texture = Texture.from(canvas)
    texture.source.scaleMode = 'nearest'
    return texture
  })

  return frameTextures
}

// 포탈 칸(맵 픽셀 사각형) 가운데 아래에 서는 소용돌이. 맵 밖으로 나가지 않게 위치를 맞춘다.
export const createPortalVortexSprite = (
  portalRect: { x: number; y: number; width: number; height: number },
  mapSize: { width: number; height: number }
): AnimatedSprite => {
  const sprite = new AnimatedSprite(getFrameTextures())
  sprite.scale.set(PORTAL_VORTEX_SCALE)
  sprite.animationSpeed = 0.18
  sprite.roundPixels = true
  sprite.position.set(
    Math.round(
      Math.min(
        Math.max(portalRect.x + portalRect.width / 2 - PORTAL_VORTEX_WIDTH / 2, 0),
        mapSize.width - PORTAL_VORTEX_WIDTH
      )
    ),
    Math.round(
      Math.min(
        Math.max(portalRect.y + portalRect.height - PORTAL_VORTEX_HEIGHT + 6, 0),
        mapSize.height - PORTAL_VORTEX_HEIGHT
      )
    )
  )
  sprite.play()
  return sprite
}
