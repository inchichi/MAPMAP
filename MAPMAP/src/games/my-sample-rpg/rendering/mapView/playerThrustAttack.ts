// 창 찌르기 공격: 앞으로 뻗는 찌르기 이펙트(텍스처·재생·정리)와 찌르기 판정 규칙(사거리·판정 시작 시점).
// 어떤 무기가 찌르기인지는 장비 정의(playerEquipment.ts 의 meleeMotion)가 정한다.
import type { ParsedTiledMap } from '../../tiled/parseTiledMap'
import type { CharacterState } from '../../characterState'
import { AnimatedSprite, Container, Texture } from 'pixi.js'
import { PLAYER_ATTACK_DURATION_MILLISECONDS } from './constants'
import { getCharacterDepthSortValue } from './tiles'

// 창 찌르기는 옆으로 넓은 슬래시 판정 대신 앞쪽 직선 판정 — 그만큼 더 멀리 닿는다.
export const PLAYER_THRUST_ATTACK_PROBE_DISTANCE_IN_TILES = 1.6
// 찌르기 몸동작 8프레임 중 창이 뻗는 4번 프레임(진행률 4/8)부터 판정 — 찌르기 이펙트도 이때 나온다.
const PLAYER_THRUST_HIT_START_PROGRESS = 4 / 8

// 겨누고 당기는 동안은 판정 없음 — 창이 앞으로 뻗은 뒤부터 맞는다.
export const isPlayerThrustHitWindowOpen = (attackElapsedMilliseconds: number): boolean =>
  attackElapsedMilliseconds >= PLAYER_ATTACK_DURATION_MILLISECONDS * PLAYER_THRUST_HIT_START_PROGRESS

// 찌르기 이펙트: 찌르기 몸동작 8프레임과 1:1로 맞춘다. 0~3번(겨누고 당기기)은 비우고,
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

const createThrustVfxTextures = (): Texture[] =>
  THRUST_VFX_FRAMES.map((frame) => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Could not create canvas context for thrust vfx')
    }

    canvas.width = THRUST_VFX_WIDTH
    canvas.height = THRUST_VFX_HEIGHT
    context.imageSmoothingEnabled = false
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

    const texture = Texture.from(canvas)

    texture.source.scaleMode = 'nearest'
    texture.source.addressMode = 'clamp-to-edge'

    return texture
  })

export type PlayerThrustAttackContext = {
  characterPixelHeight: number
  characterPixelWidth: number
  map: ParsedTiledMap
  getDepthSortedLayer: () => Container | undefined
}

export const createPlayerThrustAttack = (ctx: PlayerThrustAttackContext) => {
  const { characterPixelHeight, characterPixelWidth, map, getDepthSortedLayer } = ctx
  const thrustTextures = createThrustVfxTextures()
  let playerThrustEffectSprite: AnimatedSprite | undefined

  const clearPlayerThrustEffectSprite = () => {
    if (!playerThrustEffectSprite) {
      return
    }

    playerThrustEffectSprite.removeFromParent()
    playerThrustEffectSprite.destroy()
    playerThrustEffectSprite = undefined
  }

  const playPlayerThrustEffect = (character: CharacterState) => {
    clearPlayerThrustEffectSprite()

    const thrustSprite = new AnimatedSprite(thrustTextures)
    const directionX =
      character.facing === 'left' ? -1 : character.facing === 'right' ? 1 : 0
    const directionY =
      character.facing === 'up' ? -1 : character.facing === 'down' ? 1 : 0
    // 몸 가장자리에서 시작해 직선 판정 끝(1.6칸)까지 닿는 길이
    const startOffset = (directionX !== 0 ? characterPixelWidth : characterPixelHeight) / 2 - 6
    const length = PLAYER_THRUST_ATTACK_PROBE_DISTANCE_IN_TILES * map.tileWidth + 6
    const scale = length / thrustTextures[0].width

    thrustSprite.label = 'character:player:thrust-effect'
    thrustSprite.anchor.set(0, 0.5)
    // 찌르기 몸동작(8프레임)과 같은 길이로 재생해 창이 뻗는 프레임에 빛줄기가 겹치게
    thrustSprite.animationSpeed =
      thrustTextures.length / (PLAYER_ATTACK_DURATION_MILLISECONDS / (1000 / 60))
    thrustSprite.loop = false
    thrustSprite.roundPixels = true
    thrustSprite.rotation = Math.atan2(directionY, directionX)
    thrustSprite.position.set(
      character.position.x * map.tileWidth + characterPixelWidth / 2 + directionX * startOffset,
      character.position.y * map.tileHeight + characterPixelHeight / 2 - 1 + directionY * startOffset
    )
    thrustSprite.scale.set(scale)
    thrustSprite.zIndex =
      getCharacterDepthSortValue(
        character.position.y,
        characterPixelHeight,
        map.tileHeight
      ) + 1
    thrustSprite.onComplete = () => {
      if (playerThrustEffectSprite === thrustSprite) {
        playerThrustEffectSprite = undefined
      }
      thrustSprite.removeFromParent()
      thrustSprite.destroy()
    }

    playerThrustEffectSprite = thrustSprite
    getDepthSortedLayer()?.addChild(thrustSprite)
    getDepthSortedLayer()?.sortChildren()
    thrustSprite.play()
  }

  return {
    clearPlayerThrustEffectSprite,
    playPlayerThrustEffect
  }
}
