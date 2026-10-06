// 철퇴 내려치기: 바로 앞 바닥을 내려쳐 충격파 안의 몬스터를 모두 맞히고 크게 밀어낸다.
// 사거리는 짧고 다음 공격까지 조금 더 기다린다. 이펙트는 번쩍임 + 퍼지는 충격파 고리 + 튀는 돌 조각.
// 몸 동작은 LPC 베기(slash, 6프레임).
import { createCanvasFrameTextures, createFrontHitRect, type MeleeMotion } from './meleeMotion'

const CRUSH_VFX_SIZE = 40
const CRUSH_CENTER_OFFSET_IN_TILES = 0.95
const CRUSH_EFFECT_SIZE_IN_TILES = 1.6

type CrushFrame = {
  // 충격파 고리 가로·세로 반지름(위에서 내려다본 바닥이라 납작하다), 투명도
  ring: { radiusX: number; radiusY: number; alpha: number }
  flash?: number
  debrisRadius?: number
}

// 베기 몸동작 6프레임과 1:1(LPC 베기는 5번 프레임에서야 앞으로 내려친다).
// 5번에 바닥을 치며 맞고, 6·7번은 동작이 끝난 뒤 충격파가 퍼지는 잔상.
const CRUSH_FRAMES: (CrushFrame | undefined)[] = [
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  { ring: { radiusX: 8, radiusY: 5, alpha: 1 }, flash: 8 },
  { ring: { radiusX: 14, radiusY: 9, alpha: 0.8 }, debrisRadius: 12 },
  { ring: { radiusX: 18, radiusY: 12, alpha: 0.35 }, debrisRadius: 16 }
]

const DEBRIS_ANGLES = [-2.6, -1.9, -1.2, -0.5, 0.3, 2.9]

const drawCrushFrame = (context: CanvasRenderingContext2D, frame: CrushFrame | undefined) => {
  if (!frame) {
    return
  }

  const center = CRUSH_VFX_SIZE / 2
  const { radiusX, radiusY, alpha } = frame.ring

  context.beginPath()
  context.ellipse(center, center, radiusX, radiusY, 0, 0, Math.PI * 2)
  context.strokeStyle = `rgba(255, 176, 90, ${0.5 * alpha})`
  context.lineWidth = 4
  context.stroke()
  context.strokeStyle = `rgba(255, 238, 200, ${alpha})`
  context.lineWidth = 2
  context.stroke()

  if (frame.flash) {
    // 내려친 곳의 번쩍임: 십자
    context.fillStyle = 'rgba(255, 255, 255, 1)'
    context.fillRect(center - frame.flash, center - 1, frame.flash * 2, 2)
    context.fillRect(center - 1, center - frame.flash, 2, frame.flash * 2)
  }

  const debrisRadius = frame.debrisRadius
  if (debrisRadius) {
    context.fillStyle = `rgba(150, 128, 104, ${alpha})`
    for (const angle of DEBRIS_ANGLES) {
      const debrisX = center + Math.cos(angle) * debrisRadius
      const debrisY = center + Math.sin(angle) * debrisRadius * 0.65
      context.fillRect(Math.round(debrisX), Math.round(debrisY), 2, 2)
    }
  }
}

export const CRUSH_MOTION: MeleeMotion = {
  hitStartProgress: 5 / 6,
  hit: {
    kind: 'area',
    getHitRect: (origin) => createFrontHitRect(origin, CRUSH_CENTER_OFFSET_IN_TILES - 0.75, 1.5, 1.5),
    // 기본 넉백과 합쳐 다음 내려치기 범위 끝에 걸리는 만큼만 밀어낸다
    extraKnockbackInTiles: 0.25
  },
  // 위험 보상: 밀어내 몸을 지키고 여러 마리를 맞히는 대신 한 마리 상대 초당 피해는 검의 약 0.86배
  cooldownMilliseconds: 460,
  createEffectTextures: () =>
    createCanvasFrameTextures(CRUSH_VFX_SIZE, CRUSH_VFX_SIZE, CRUSH_FRAMES.length, (context, frameIndex) =>
      drawCrushFrame(context, CRUSH_FRAMES[frameIndex])
    ),
  effectFramesPerAttack: 6,
  getEffectPlacement: (origin, textureWidth) => ({
    anchorX: 0.5,
    anchorY: 0.5,
    rotation: 0,
    x: origin.x + origin.directionX * CRUSH_CENTER_OFFSET_IN_TILES * origin.tileWidth,
    y: origin.y + origin.directionY * CRUSH_CENTER_OFFSET_IN_TILES * origin.tileHeight,
    scale: (CRUSH_EFFECT_SIZE_IN_TILES * origin.tileWidth) / textureWidth
  })
}
