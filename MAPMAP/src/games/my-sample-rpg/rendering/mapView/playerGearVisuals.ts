// 플레이어 무기·보호막 그리기: 무기 스프라이트(휘두르기 궤적 포함) 위치·회전, 보호 스킬 효과.
// 맵 화면의 상태는 ctx 로 받는다.
import type { createPlayerCombatEffects } from './playerCombatEffects'
import type { PlayerProfile } from '../../playerProfile'
import type { PlayerEquipment } from '../../playerEquipment'
import { AnimatedSprite, Sprite, Texture } from 'pixi.js'
import { PLAYER_CHARACTER_ID } from '../../characterState'
import type { CharacterMoveDirection, CharacterState } from '../../characterState'
import { PLAYER_MAGIC_CAST_RECOVERY_MILLISECONDS, PLAYER_MAGIC_CAST_WINDUP_MILLISECONDS } from '../../playerMagicSkills'
import { type PlayerRollState } from '../../playerRoll'
import { PLAYER_ATTACK_DURATION_MILLISECONDS, PLAYER_ATTACK_LIFT_Y_OFFSET, PLAYER_ATTACK_ROTATION_OFFSET, PLAYER_ATTACK_SCALE_BOOST, PLAYER_ATTACK_SWING_X_OFFSET, PLAYER_ATTACK_TRAIL_ALPHA, PLAYER_ATTACK_TRAIL_PROGRESS_STEP, PLAYER_WEAPON_APPEARANCE_CONFIG_BY_ITEM_ID, PLAYER_WEAPON_PLACEMENT_LEFT, PLAYER_WEAPON_PLACEMENT_RIGHT, PLAYER_WEAPON_WORLD_SCALE } from './constants'
import { type RenderedCharacterNode } from './types'

export type PlayerGearVisualsContext = {
  getPlayerMagicCast: ReturnType<typeof createPlayerCombatEffects>['getPlayerMagicCast']
  playerProfile: PlayerProfile
  playerWeaponAppearanceTexturesByItemId: Map<string, Texture>
  playerWeaponTexture: Texture
  renderedCharacters: Map<string, RenderedCharacterNode>
  getCurrentPlayerEquipment: () => PlayerEquipment
  getPlayerProtectSkillActiveUntilMilliseconds: () => number
  getPlayerProtectSkillSprite: () => AnimatedSprite | undefined
  getPlayerRollState: () => PlayerRollState | undefined
  getPlayerWeaponSprite: () => Sprite | undefined
  getPlayerWeaponTrailSprites: () => Sprite[]
  getPlayerAttackFacing: () => CharacterMoveDirection | undefined
  getPlayerAttackStartedAtMilliseconds: () => number | undefined
  setPlayerAttackFacing: (value: CharacterMoveDirection | undefined) => void
  setPlayerAttackResolvedStartedAtMilliseconds: (value: number | undefined) => void
  setPlayerAttackStartedAtMilliseconds: (value: number | undefined) => void
}

export const createPlayerGearVisuals = (ctx: PlayerGearVisualsContext) => {
  const {
    getPlayerMagicCast,
    playerProfile,
    playerWeaponAppearanceTexturesByItemId,
    playerWeaponTexture,
    renderedCharacters,
    getCurrentPlayerEquipment,
    getPlayerProtectSkillActiveUntilMilliseconds,
    getPlayerProtectSkillSprite,
    getPlayerRollState,
    getPlayerWeaponSprite,
    getPlayerWeaponTrailSprites,
    getPlayerAttackFacing,
    getPlayerAttackStartedAtMilliseconds,
    setPlayerAttackFacing,
    setPlayerAttackResolvedStartedAtMilliseconds,
    setPlayerAttackStartedAtMilliseconds
  } = ctx

  const syncPlayerWeaponSprite = (character: CharacterState) => {
    const playerWeaponSprite = getPlayerWeaponSprite()
    const playerWeaponTrailSprites = getPlayerWeaponTrailSprites()
    if (!playerWeaponSprite) {
      return
    }

    if (playerProfile.hp.current === 0 || getPlayerRollState()) {
      playerWeaponSprite.visible = false
      for (const trailSprite of playerWeaponTrailSprites) {
        trailSprite.visible = false
      }
      return
    }

    const weaponSlot = getCurrentPlayerEquipment().slots.find(
      (slot) => slot.id === 'weapon'
    )
    const weaponItem = weaponSlot?.item

    if (!weaponItem) {
      playerWeaponSprite.visible = false
      for (const trailSprite of playerWeaponTrailSprites) {
        trailSprite.visible = false
      }
      return
    }

    const weaponAppearance = PLAYER_WEAPON_APPEARANCE_CONFIG_BY_ITEM_ID[
      weaponItem.id
    ]
    const weaponTexture = weaponAppearance
      ? playerWeaponAppearanceTexturesByItemId.get(weaponItem.id) ??
        playerWeaponTexture
      : playerWeaponTexture

    if (!weaponTexture) {
      playerWeaponSprite.visible = false
      for (const trailSprite of playerWeaponTrailSprites) {
        trailSprite.visible = false
      }
      return
    }

    const attackFacing = getPlayerAttackFacing() ?? character.facing
    const placement =
      attackFacing === 'left'
        ? PLAYER_WEAPON_PLACEMENT_LEFT
        : PLAYER_WEAPON_PLACEMENT_RIGHT
    const weaponWorldScale =
      weaponAppearance?.worldScale ?? PLAYER_WEAPON_WORLD_SCALE
    const now = performance.now()
    const attackStartedAtMilliseconds = getPlayerAttackStartedAtMilliseconds()
    const attackElapsedMilliseconds =
      attackStartedAtMilliseconds === undefined
        ? undefined
        : now - attackStartedAtMilliseconds
    const attackProgress =
      attackElapsedMilliseconds === undefined ||
      attackElapsedMilliseconds < 0 ||
      attackElapsedMilliseconds >= PLAYER_ATTACK_DURATION_MILLISECONDS
        ? undefined
        : attackElapsedMilliseconds / PLAYER_ATTACK_DURATION_MILLISECONDS
    const facingMultiplier = attackFacing === 'left' ? -1 : 1
    const weaponFacingMultiplier = attackFacing === 'right' ? -1 : 1
    // 마법 시전: 준비 동안 지팡이를 높이 들어 앞으로 겨누고, 여운 동안 천천히 내린다.
    const castLift = (() => {
      const cast = getPlayerMagicCast()
      if (!cast) {
        return 0
      }
      if (now < cast.releaseAtMilliseconds) {
        const t = (now - cast.startedAtMilliseconds) / PLAYER_MAGIC_CAST_WINDUP_MILLISECONDS
        return Math.sin(Math.min(1, Math.max(0, t)) * Math.PI * 0.5)
      }
      return Math.max(
        0,
        1 - (now - cast.releaseAtMilliseconds) / PLAYER_MAGIC_CAST_RECOVERY_MILLISECONDS
      )
    })()
    const createPose = (progress: number | undefined) => {
      if (castLift > 0) {
        return {
          x: placement.x + facingMultiplier * 3 * castLift,
          y: placement.y - 9 * castLift,
          rotation: placement.rotation - facingMultiplier * 0.55 * castLift,
          scaleX: (weaponWorldScale + 0.04 * castLift) * weaponFacingMultiplier,
          scaleY: weaponWorldScale + 0.04 * castLift
        }
      }

      if (progress === undefined) {
        return {
          x: placement.x + (weaponAppearance?.idleOffsetX ?? 0),
          y: placement.y + (weaponAppearance?.idleOffsetY ?? 0),
          rotation: placement.rotation,
          scaleX: weaponWorldScale * weaponFacingMultiplier,
          scaleY: weaponWorldScale
        }
      }

      const swingAmount = Math.sin(progress * Math.PI)
      const liftAmount = Math.sin(progress * Math.PI * 0.5)

      return {
        x:
          placement.x +
          facingMultiplier * PLAYER_ATTACK_SWING_X_OFFSET * swingAmount,
        y: placement.y - PLAYER_ATTACK_LIFT_Y_OFFSET * liftAmount,
        rotation:
          placement.rotation +
          facingMultiplier * PLAYER_ATTACK_ROTATION_OFFSET * swingAmount,
        scaleX:
          (weaponWorldScale + PLAYER_ATTACK_SCALE_BOOST * swingAmount) *
          weaponFacingMultiplier,
        scaleY: weaponWorldScale + PLAYER_ATTACK_SCALE_BOOST * swingAmount
      }
    }
    const applyPose = (
      sprite: Sprite,
      pose: {
        x: number
        y: number
        rotation: number
        scaleX: number
        scaleY: number
      },
      alpha: number
    ) => {
      sprite.texture = weaponTexture
      sprite.visible = true
      sprite.position.set(pose.x, pose.y)
      sprite.rotation = pose.rotation
      sprite.scale.set(pose.scaleX, pose.scaleY)
      sprite.alpha = alpha
    }

    // LPC 플레이어는 무기를 손에 쥔 그림이 시트에 들어 있다 — 따로 띄우던 무기 그림은 숨긴다.
    const isLpcPlayer = Boolean(renderedCharacters.get(PLAYER_CHARACTER_ID)?.lpc)
    if (isLpcPlayer) {
      playerWeaponSprite.visible = false
    } else {
      applyPose(playerWeaponSprite, createPose(attackProgress), 1)
    }

    if (
      attackProgress === undefined &&
      getPlayerAttackStartedAtMilliseconds() !== undefined
    ) {
      setPlayerAttackStartedAtMilliseconds(undefined)
      setPlayerAttackResolvedStartedAtMilliseconds(undefined)
      setPlayerAttackFacing(undefined)
    }

    for (let index = 0; index < playerWeaponTrailSprites.length; index += 1) {
      const trailSprite = playerWeaponTrailSprites[index]
      const trailProgress =
        attackProgress === undefined
          ? undefined
          : attackProgress - (index + 1) * PLAYER_ATTACK_TRAIL_PROGRESS_STEP

      if (isLpcPlayer || trailProgress === undefined || trailProgress <= 0) {
        trailSprite.visible = false
        continue
      }

      applyPose(
        trailSprite,
        createPose(trailProgress),
        PLAYER_ATTACK_TRAIL_ALPHA[index] ?? 0.1
      )
    }
  }

  function syncPlayerProtectSkillVisual(
    character: CharacterState,
    now: number
  ): void {
    const playerProtectSkillSprite = getPlayerProtectSkillSprite()
    if (
      !playerProtectSkillSprite ||
      character.id !== PLAYER_CHARACTER_ID ||
      playerProfile.hp.current === 0
    ) {
      return
    }

    if (getPlayerProtectSkillActiveUntilMilliseconds() <= now) {
      playerProtectSkillSprite.visible = false
      playerProtectSkillSprite.stop()
      playerProtectSkillSprite.gotoAndStop(0)
      return
    }

    const renderNode = renderedCharacters.get(character.id)

    if (!renderNode) {
      return
    }

    playerProtectSkillSprite.visible = true
    playerProtectSkillSprite.position.set(
      Math.round(renderNode.sprite.width / 2),
      Math.round(renderNode.sprite.height / 2)
    )
    playerProtectSkillSprite.alpha = 0.92

    if (!playerProtectSkillSprite.playing) {
      playerProtectSkillSprite.gotoAndPlay(0)
    }
  }

  return {
    syncPlayerProtectSkillVisual,
    syncPlayerWeaponSprite
  }
}
