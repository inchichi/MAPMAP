// 단검 빠른 두 번 긋기: 사거리는 짧지만(1칸) 휘두르자마자 맞고, 다음 공격까지 거의 기다리지 않는다.
// 이펙트는 앞에서 X자로 엇갈리는 가는 칼자국 두 줄. 몸 동작은 LPC 베기(slash, 6프레임).
import { createCanvasFrameTextures, type MeleeMotion } from './meleeMotion'

const QUICK_SLASH_VFX_SIZE = 24
const QUICK_SLASH_CENTER_OFFSET_IN_TILES = 0.75
const QUICK_SLASH_EFFECT_SIZE_IN_TILES = 1

// 칼자국 두 줄: 아래→위, 위→아래 대각선
const FIRST_STREAK = { fromX: 4, fromY: 18, toX: 20, toY: 6 }
const SECOND_STREAK = { fromX: 4, fromY: 6, toX: 20, toY: 18 }

type QuickSlashFrame = {
  firstAlpha: number
  secondAlpha: number
}

// 베기 몸동작 6프레임과 1:1. 1번에 첫 줄, 2번에 둘째 줄, 3번에 사라진다.
const QUICK_SLASH_FRAMES: (QuickSlashFrame | undefined)[] = [
  undefined,
  { firstAlpha: 1, secondAlpha: 0 },
  { firstAlpha: 0.6, secondAlpha: 1 },
  { firstAlpha: 0.3, secondAlpha: 0.35 },
  undefined,
  undefined
]

const drawStreak = (
  context: CanvasRenderingContext2D,
  streak: typeof FIRST_STREAK,
  alpha: number
) => {
  if (alpha <= 0) {
    return
  }

  context.lineCap = 'round'
  context.beginPath()
  context.moveTo(streak.fromX, streak.fromY)
  context.lineTo(streak.toX, streak.toY)
  context.strokeStyle = `rgba(160, 210, 255, ${0.5 * alpha})`
  context.lineWidth = 3
  context.stroke()
  context.strokeStyle = `rgba(235, 248, 255, ${alpha})`
  context.lineWidth = 1.5
  context.stroke()
}

export const QUICK_SLASH_MOTION: MeleeMotion = {
  hitStartProgress: 1 / 6,
  hit: { kind: 'single', probeDistanceInTiles: 1 },
  cooldownMilliseconds: 120,
  createEffectTextures: () =>
    createCanvasFrameTextures(QUICK_SLASH_VFX_SIZE, QUICK_SLASH_VFX_SIZE, QUICK_SLASH_FRAMES.length, (context, frameIndex) => {
      const frame = QUICK_SLASH_FRAMES[frameIndex]

      if (!frame) {
        return
      }

      drawStreak(context, FIRST_STREAK, frame.firstAlpha)
      drawStreak(context, SECOND_STREAK, frame.secondAlpha)
    }),
  getEffectPlacement: (origin, textureWidth) => ({
    anchorX: 0.5,
    anchorY: 0.5,
    rotation: Math.atan2(origin.directionY, origin.directionX),
    x: origin.x + origin.directionX * QUICK_SLASH_CENTER_OFFSET_IN_TILES * origin.tileWidth,
    y: origin.y + origin.directionY * QUICK_SLASH_CENTER_OFFSET_IN_TILES * origin.tileHeight,
    scale: (QUICK_SLASH_EFFECT_SIZE_IN_TILES * origin.tileWidth) / textureWidth
  })
}
