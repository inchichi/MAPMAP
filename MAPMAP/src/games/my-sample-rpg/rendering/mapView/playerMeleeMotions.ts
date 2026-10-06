// 무기별 근접 공격 모션 목록과 모션 이펙트 재생. 어떤 무기가 어떤 모션인지는 장비 정의(playerEquipment.ts 의
// meleeMotion)가 정한다. 새 무기 모션 = meleeMotions/ 에 모듈 하나 + 아래 목록에 한 줄.
// 기본 베기(slash)는 기존 슬래시 이펙트·판정(playerActions·combat)이 맡으므로 목록에 없다.
import type { ParsedTiledMap } from '../../tiled/parseTiledMap'
import type { CharacterState } from '../../characterState'
import type { PlayerMeleeMotion } from '../../playerEquipment'
import { AnimatedSprite, Container, Texture } from 'pixi.js'
import { PLAYER_ATTACK_COOLDOWN_MILLISECONDS, PLAYER_ATTACK_DURATION_MILLISECONDS } from './constants'
import { getCharacterDepthSortValue } from './tiles'
import { getFacingDirection, type MeleeMotion } from './meleeMotions/meleeMotion'
import { CLEAVE_MOTION } from './meleeMotions/cleave'
import { CRUSH_MOTION } from './meleeMotions/crush'
import { QUICK_SLASH_MOTION } from './meleeMotions/quickSlash'
import { THRUST_MOTION } from './meleeMotions/thrust'

const PLAYER_MELEE_MOTIONS: Record<Exclude<PlayerMeleeMotion, 'slash'>, MeleeMotion> = {
  thrust: THRUST_MOTION,
  cleave: CLEAVE_MOTION,
  crush: CRUSH_MOTION,
  'quick-slash': QUICK_SLASH_MOTION
}

export const getPlayerMeleeMotion = (motion: PlayerMeleeMotion): MeleeMotion | undefined =>
  motion === 'slash' ? undefined : PLAYER_MELEE_MOTIONS[motion]

export const getPlayerMeleeAttackCooldownMilliseconds = (motion: PlayerMeleeMotion): number =>
  getPlayerMeleeMotion(motion)?.cooldownMilliseconds ?? PLAYER_ATTACK_COOLDOWN_MILLISECONDS

export type PlayerMeleeMotionEffectsContext = {
  characterPixelHeight: number
  characterPixelWidth: number
  map: ParsedTiledMap
  getDepthSortedLayer: () => Container | undefined
}

export const createPlayerMeleeMotionEffects = (ctx: PlayerMeleeMotionEffectsContext) => {
  const { characterPixelHeight, characterPixelWidth, map, getDepthSortedLayer } = ctx
  // 모션마다 처음 쓸 때 한 번만 그린다.
  const texturesByMotion = new Map<MeleeMotion, Texture[]>()
  let effectSprite: AnimatedSprite | undefined

  const getTextures = (motion: MeleeMotion): Texture[] => {
    const cached = texturesByMotion.get(motion)
    if (cached) {
      return cached
    }

    const textures = motion.createEffectTextures()
    texturesByMotion.set(motion, textures)
    return textures
  }

  const clearPlayerMeleeMotionEffect = () => {
    if (!effectSprite) {
      return
    }

    effectSprite.removeFromParent()
    effectSprite.destroy()
    effectSprite = undefined
  }

  const playPlayerMeleeMotionEffect = (motion: MeleeMotion, character: CharacterState) => {
    clearPlayerMeleeMotionEffect()

    const textures = getTextures(motion)
    const direction = getFacingDirection(character.facing)
    const placement = motion.getEffectPlacement(
      {
        x: character.position.x * map.tileWidth + characterPixelWidth / 2,
        y: character.position.y * map.tileHeight + characterPixelHeight / 2 - 1,
        bodyWidth: characterPixelWidth,
        bodyHeight: characterPixelHeight,
        directionX: direction.x,
        directionY: direction.y,
        tileWidth: map.tileWidth,
        tileHeight: map.tileHeight
      },
      textures[0].width
    )
    const sprite = new AnimatedSprite(textures)

    sprite.label = 'character:player:melee-motion-effect'
    sprite.anchor.set(placement.anchorX, placement.anchorY)
    // 몸 동작과 같은 박자로 재생해 맞는 프레임에 이펙트가 겹치게
    sprite.animationSpeed =
      motion.effectFramesPerAttack / (PLAYER_ATTACK_DURATION_MILLISECONDS / (1000 / 60))
    sprite.loop = false
    sprite.roundPixels = true
    sprite.rotation = placement.rotation
    sprite.position.set(placement.x, placement.y)
    sprite.scale.set(placement.scale)
    sprite.zIndex =
      getCharacterDepthSortValue(
        character.position.y,
        characterPixelHeight,
        map.tileHeight
      ) + 1
    sprite.onComplete = () => {
      if (effectSprite === sprite) {
        effectSprite = undefined
      }
      sprite.removeFromParent()
      sprite.destroy()
    }

    effectSprite = sprite
    getDepthSortedLayer()?.addChild(sprite)
    getDepthSortedLayer()?.sortChildren()
    sprite.play()
  }

  return {
    clearPlayerMeleeMotionEffect,
    playPlayerMeleeMotionEffect
  }
}
