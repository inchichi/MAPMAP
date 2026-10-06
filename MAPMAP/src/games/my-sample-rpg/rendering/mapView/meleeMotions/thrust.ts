// 창 찌르기: 앞쪽 직선으로 멀리(1.6칸) 닿고, 창이 앞으로 뻗는 프레임부터 맞는다.
// 이펙트는 창끝 앞으로 뻗는 빛줄기. 몸 동작은 LPC 찌르기(thrust, 8프레임).
import { PLAYER_ATTACK_COOLDOWN_MILLISECONDS } from '../constants'
import { createCanvasFrameTextures, type MeleeMotion } from './meleeMotion'

const THRUST_PROBE_DISTANCE_IN_TILES = 1.6

// 찌르기 몸동작 8프레임과 1:1로 맞춘다. 0~3번(겨누고 당기기)은 비우고,
// 4번에 창끝 앞으로 빛줄기가 뻗고, 5번에 끝에서 번쩍, 6·7번에 사라진다.
// 오른쪽을 향한 그림(앵커 왼쪽 가운데)이고 방향마다 돌려 쓴다.
const THRUST_VFX_WIDTH = 48
const THRUST_VFX_HEIGHT = 11

type ThrustVfxFrame = {
  // 빛줄기 [시작, 끝] x, 흰 심지 시작 x, 투명도
  streak?: { from: number; to: number; coreFrom: number; alpha: number; thick: boolean }
  spark?: { x: number; size: number; alpha: number }
  speedLines?: number
}

const THRUST_VFX_FRAMES: ThrustVfxFrame[] = [
  {},
  {},
  {},
  {},
  { streak: { from: 4, to: 40, coreFrom: 14, alpha: 1, thick: true }, spark: { x: 40, size: 1, alpha: 1 } },
  { streak: { from: 10, to: 46, coreFrom: 20, alpha: 1, thick: true }, spark: { x: 45, size: 2, alpha: 1 }, speedLines: 0.6 },
  { streak: { from: 24, to: 46, coreFrom: 30, alpha: 0.6, thick: false }, spark: { x: 45, size: 1, alpha: 0.6 }, speedLines: 0.3 },
  { streak: { from: 36, to: 46, coreFrom: 40, alpha: 0.3, thick: false } }
]

const drawThrustFrame = (context: CanvasRenderingContext2D, frame: ThrustVfxFrame) => {
  const middle = Math.floor(THRUST_VFX_HEIGHT / 2)

  if (frame.speedLines) {
    context.fillStyle = `rgba(214, 234, 255, ${frame.speedLines})`
    context.fillRect(2, middle - 4, 16, 1)
    context.fillRect(8, middle + 4, 14, 1)
  }

  const streak = frame.streak
  if (streak) {
    // 꼬리는 투명 → 머리는 진하게(뒤에서 앞으로 뻗는 느낌)
    const glow = context.createLinearGradient(streak.from, 0, streak.to, 0)
    glow.addColorStop(0, 'rgba(170, 215, 255, 0)')
    glow.addColorStop(1, `rgba(170, 215, 255, ${0.55 * streak.alpha})`)
    context.fillStyle = glow
    const glowHalf = streak.thick ? 2 : 1
    context.fillRect(streak.from, middle - glowHalf, streak.to - streak.from, glowHalf * 2 + 1)

    const core = context.createLinearGradient(streak.coreFrom, 0, streak.to, 0)
    core.addColorStop(0, 'rgba(255, 255, 255, 0)')
    core.addColorStop(1, `rgba(255, 255, 255, ${streak.alpha})`)
    context.fillStyle = core
    context.fillRect(streak.coreFrom, middle - (streak.thick ? 1 : 0), streak.to - streak.coreFrom, streak.thick ? 2 : 1)
  }

  const spark = frame.spark
  if (spark) {
    // 창끝 번쩍임: 십자
    context.fillStyle = `rgba(255, 255, 255, ${spark.alpha})`
    context.fillRect(spark.x - spark.size, middle, spark.size * 2 + 1, 1)
    context.fillRect(spark.x, middle - spark.size - 1, 1, spark.size * 2 + 3)
  }
}

export const THRUST_MOTION: MeleeMotion = {
  hitStartProgress: 4 / 8,
  hit: { kind: 'single', probeDistanceInTiles: THRUST_PROBE_DISTANCE_IN_TILES },
  cooldownMilliseconds: PLAYER_ATTACK_COOLDOWN_MILLISECONDS,
  createEffectTextures: () =>
    createCanvasFrameTextures(THRUST_VFX_WIDTH, THRUST_VFX_HEIGHT, THRUST_VFX_FRAMES.length, (context, frameIndex) =>
      drawThrustFrame(context, THRUST_VFX_FRAMES[frameIndex])
    ),
  getEffectPlacement: (origin, textureWidth) => {
    // 몸 가장자리에서 시작해 직선 판정 끝까지 닿는 길이
    const startOffset = (origin.directionX !== 0 ? origin.bodyWidth : origin.bodyHeight) / 2 - 6
    const length = THRUST_PROBE_DISTANCE_IN_TILES * origin.tileWidth + 6

    return {
      anchorX: 0,
      anchorY: 0.5,
      rotation: Math.atan2(origin.directionY, origin.directionX),
      x: origin.x + origin.directionX * startOffset,
      y: origin.y + origin.directionY * startOffset,
      scale: length / textureWidth
    }
  }
}
