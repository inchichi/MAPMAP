// 도끼 내려찍어 가르기: 크게 들어 올린 뒤(판정 늦음) 앞쪽 넓은 부채꼴 안의 몬스터를 모두 베고 조금 더 밀어낸다.
// 대신 다음 공격까지 조금 더 기다린다. 이펙트는 넓은 주황빛 초승달 궤적. 몸 동작은 LPC 베기(slash, 6프레임).
import { createCanvasFrameTextures, createFrontHitRect, type MeleeMotion } from './meleeMotion'

const CLEAVE_VFX_WIDTH = 36
const CLEAVE_VFX_HEIGHT = 56
// 오른쪽을 향한 초승달: 원의 중심은 그림 왼쪽 바깥, 위에서 아래로 휘두른다.
const CLEAVE_ARC_CENTER_X = -6
const CLEAVE_ARC_RADIUS = 36
const CLEAVE_ARC_HALF_ANGLE = 1.05
const CLEAVE_REACH_IN_TILES = 1.5

type CleaveFrame = {
  // 궤적이 그려진 비율(0~1), 투명도, 심지 굵기
  sweep: number
  alpha: number
  lineWidth: number
  sparks?: boolean
}

// 베기 몸동작 6프레임과 1:1. 0·1번은 들어 올리기, 2번에 휘두르기 시작, 3번에 궤적이 다 그려지며 맞는다.
const CLEAVE_FRAMES: (CleaveFrame | undefined)[] = [
  undefined,
  undefined,
  { sweep: 0.45, alpha: 0.5, lineWidth: 2 },
  { sweep: 1, alpha: 1, lineWidth: 4 },
  { sweep: 1, alpha: 0.55, lineWidth: 3, sparks: true },
  { sweep: 1, alpha: 0.25, lineWidth: 2 }
]

const drawCleaveFrame = (context: CanvasRenderingContext2D, frame: CleaveFrame | undefined) => {
  if (!frame) {
    return
  }

  const centerY = CLEAVE_VFX_HEIGHT / 2
  const startAngle = -CLEAVE_ARC_HALF_ANGLE
  const endAngle = startAngle + CLEAVE_ARC_HALF_ANGLE * 2 * frame.sweep

  context.lineCap = 'round'
  context.beginPath()
  context.arc(CLEAVE_ARC_CENTER_X, centerY, CLEAVE_ARC_RADIUS, startAngle, endAngle)
  context.strokeStyle = `rgba(255, 196, 120, ${0.5 * frame.alpha})`
  context.lineWidth = frame.lineWidth + 3
  context.stroke()
  context.strokeStyle = `rgba(255, 250, 235, ${frame.alpha})`
  context.lineWidth = frame.lineWidth
  context.stroke()

  if (frame.sparks) {
    // 궤적 끝에서 튀는 불똥
    context.fillStyle = `rgba(255, 220, 160, ${frame.alpha})`
    for (const angle of [-0.7, 0, 0.7]) {
      const sparkX = CLEAVE_ARC_CENTER_X + Math.cos(angle) * (CLEAVE_ARC_RADIUS + 3)
      const sparkY = centerY + Math.sin(angle) * (CLEAVE_ARC_RADIUS + 3)
      context.fillRect(Math.round(sparkX), Math.round(sparkY), 2, 2)
    }
  }
}

export const CLEAVE_MOTION: MeleeMotion = {
  hitStartProgress: 3 / 6,
  hit: {
    kind: 'area',
    getHitRect: (origin) => createFrontHitRect(origin, 0.2, 1.4, 2.2),
    extraKnockbackInTiles: 0.3
  },
  cooldownMilliseconds: 420,
  createEffectTextures: () =>
    createCanvasFrameTextures(CLEAVE_VFX_WIDTH, CLEAVE_VFX_HEIGHT, CLEAVE_FRAMES.length, (context, frameIndex) =>
      drawCleaveFrame(context, CLEAVE_FRAMES[frameIndex])
    ),
  getEffectPlacement: (origin, textureWidth) => {
    const startOffset = (origin.directionX !== 0 ? origin.bodyWidth : origin.bodyHeight) / 2 - 4

    return {
      anchorX: 0,
      anchorY: 0.5,
      rotation: Math.atan2(origin.directionY, origin.directionX),
      x: origin.x + origin.directionX * startOffset,
      y: origin.y + origin.directionY * startOffset,
      scale: (CLEAVE_REACH_IN_TILES * origin.tileWidth) / textureWidth
    }
  }
}
