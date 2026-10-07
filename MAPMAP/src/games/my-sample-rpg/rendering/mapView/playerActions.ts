// 플레이어 행동: 구르기(시작·진행·끝), 보호·강타·마법 등 스킬 발동, 무기 휘두르기 시작,
// 베기·강타·보호 효과 그리기, 발소리. 맵 화면의 상태는 ctx 로 받는다.
import type { TextStyle } from 'pixi.js'
import type { PlayerSkillSlots } from '../../playerSkillSlots'
import type { PlayerProfile } from '../../playerProfile'
import type { PlayerEquipment } from '../../playerEquipment'
import type { ParsedTiledMap } from '../../tiled/parseTiledMap'
import type { MapOverlay } from '../createMapOverlay'
import type { GameSoundEffects } from '../createGameSoundEffects'
import { AnimatedSprite, Container } from 'pixi.js'
import { PLAYER_CHARACTER_ID } from '../../characterState'
import type { CharacterMoveDirection, CharacterState } from '../../characterState'
import { getEquippedPlayerWeaponLine } from '../../playerEquipment'
import {
  PLAYER_CHAIN_LIGHTNING_SKILL_ID,
  PLAYER_DASH_SKILL_ID,
  PLAYER_FIREBALL_SKILL_ID,
  PLAYER_FOCUS_SKILL_ID,
  PLAYER_ICE_BOLT_SKILL_ID,
  PLAYER_MULTI_SHOT_SKILL_ID,
  PLAYER_PIERCING_ARROW_SKILL_ID,
  PLAYER_POISON_ARROW_SKILL_ID,
  PLAYER_PROTECT_SKILL_ID,
  getPlayerFocusSkillManaRestoreByLevel
} from '../../playerSkills'
import {
  PLAYER_SMASH_SKILL_COOLDOWN_MILLISECONDS,
  PLAYER_SMASH_SKILL_EFFECT_ANIMATION_SPEED,
  PLAYER_SMASH_SKILL_ID,
  PLAYER_SMASH_SKILL_SEGMENT_COUNT,
  PLAYER_SMASH_SKILL_SEGMENT_DURATION_MILLISECONDS,
  PLAYER_SMASH_SKILL_SEGMENT_STAGGER_MILLISECONDS
} from '../../playerSmashSkill'
import { PLAYER_ROLL_COOLDOWN_MILLISECONDS, type PlayerRollState, type PlayerRollVector } from '../../playerRoll'
import {
  getPlayerSkillManaCostById,
  getPlayerSkillLevelById,
  getPlayerProtectSkillDurationByLevel,
  isPlayerSkillUnlockedInProfile,
  getPlayerSmashSkillSegmentPlacement,
  getPlayerRollDistanceTiles,
  getPlayerRollProgress,
  normalizePlayerRollVector
} from '../../lua/luaGameLogic'
import { EVADE_TEXT_DURATION_MILLISECONDS, EVADE_TEXT_STYLE, PLAYER_PROTECT_SKILL_COOLDOWN_MILLISECONDS } from './constants'
import { getFacingFromRollVector, isCharacterOnGrass } from './tiles'
import type { PlayerWeaponSkillTriggerResult } from './playerWeaponSkills'
import { type PlayerHitReactionState, type SlashVfxRenderResources } from './types'

export type PlayerActionsContext = {
  characterPixelHeight: number
  characterPixelWidth: number
  gameSoundEffects: GameSoundEffects
  getCharacterStateById: (characterId: string) => CharacterState
  grassTiles: Set<string>
  isPlayerCasting: (now: number) => boolean
  map: ParsedTiledMap
  mapOverlay: MapOverlay
  playerProfile: PlayerProfile
  pressedDirections: Set<CharacterMoveDirection>
  showPlayerMagicMessage: (message: string) => void
  slashVfxTextures: SlashVfxRenderResources
  syncPlayerUiOverlays: () => void
  triggerPlayerAttack: (now: number) => void
  triggerPlayerBowSkill: (skillId: string, now: number) => boolean
  triggerPlayerMagicSkill: (skillId: string, now: number) => boolean
  triggerPlayerWeaponSkill: (skillId: string, now: number) => PlayerWeaponSkillTriggerResult
  showCharacterDamageText: (characterId: string, message: string, durationMilliseconds: number, style?: TextStyle) => void
  tryMoveCharacter: (characterId: string, deltaX: number, deltaY: number, options?: { preserveFacing?: boolean; ignoreMonsterBlocking?: boolean; cornerAssist?: boolean; }) => boolean
  getCurrentPlayerEquipment: () => PlayerEquipment
  getCurrentPlayerSkillSlots: () => PlayerSkillSlots
  getDepthSortedLayer: () => Container | undefined
  getIsPauseMenuOpen: () => boolean
  getIsSceneTransitionPending: () => boolean
  getPlayerProtectSkillSprite: () => AnimatedSprite | undefined
  getPlayerSmashSkillHitMonsterIds: () => Set<string>
  getSyncPlayerCharacterVisual: () => (nowMilliseconds?: number) => void
  getCharacterStates: () => CharacterState[]
  getPlayerAttackQueuedAfterRoll: () => boolean
  getPlayerFocusSkillReadyAtMilliseconds: () => number
  getPlayerProtectSkillReadyAtMilliseconds: () => number
  getPlayerRollReadyAtMilliseconds: () => number
  getPlayerRollState: () => PlayerRollState | undefined
  getPlayerSmashSkillFacing: () => CharacterMoveDirection | undefined
  getPlayerSmashSkillOrigin: () => { x: number; y: number; } | undefined
  getPlayerSmashSkillReadyAtMilliseconds: () => number
  getPlayerSmashSkillSegments: () => { sprite: AnimatedSprite; delayMilliseconds: number; started: boolean; index: number; }[]
  getPlayerSmashSkillStartedAtMilliseconds: () => number | undefined
  setCharacterStates: (value: CharacterState[]) => void
  setPlayerAttackFacing: (value: CharacterMoveDirection | undefined) => void
  setPlayerAttackQueuedAfterRoll: (value: boolean) => void
  setPlayerAttackResolvedStartedAtMilliseconds: (value: number | undefined) => void
  setPlayerAttackStartedAtMilliseconds: (value: number | undefined) => void
  setPlayerFocusSkillReadyAtMilliseconds: (value: number) => void
  setPlayerHitReactionState: (value: PlayerHitReactionState | undefined) => void
  setPlayerProtectSkillActiveUntilMilliseconds: (value: number) => void
  setPlayerProtectSkillReadyAtMilliseconds: (value: number) => void
  setPlayerRollReadyAtMilliseconds: (value: number) => void
  setPlayerRollState: (value: PlayerRollState | undefined) => void
  setPlayerSmashSkillFacing: (value: CharacterMoveDirection | undefined) => void
  setPlayerSmashSkillOrigin: (value: { x: number; y: number; } | undefined) => void
  setPlayerSmashSkillReadyAtMilliseconds: (value: number) => void
  setPlayerSmashSkillSegments: (value: { sprite: AnimatedSprite; delayMilliseconds: number; started: boolean; index: number; }[]) => void
  setPlayerSmashSkillStartedAtMilliseconds: (value: number | undefined) => void
}

export const createPlayerActions = (ctx: PlayerActionsContext) => {
  const {
    characterPixelHeight,
    characterPixelWidth,
    gameSoundEffects,
    getCharacterStateById,
    grassTiles,
    isPlayerCasting,
    map,
    mapOverlay,
    playerProfile,
    pressedDirections,
    showPlayerMagicMessage,
    slashVfxTextures,
    syncPlayerUiOverlays,
    triggerPlayerAttack,
    triggerPlayerBowSkill,
    triggerPlayerMagicSkill,
    triggerPlayerWeaponSkill,
    showCharacterDamageText,
    tryMoveCharacter,
    getCurrentPlayerEquipment,
    getCurrentPlayerSkillSlots,
    getDepthSortedLayer,
    getIsPauseMenuOpen,
    getIsSceneTransitionPending,
    getPlayerProtectSkillSprite,
    getPlayerSmashSkillHitMonsterIds,
    getSyncPlayerCharacterVisual,
    getCharacterStates,
    getPlayerAttackQueuedAfterRoll,
    getPlayerFocusSkillReadyAtMilliseconds,
    getPlayerProtectSkillReadyAtMilliseconds,
    getPlayerRollReadyAtMilliseconds,
    getPlayerRollState,
    getPlayerSmashSkillFacing,
    getPlayerSmashSkillOrigin,
    getPlayerSmashSkillReadyAtMilliseconds,
    getPlayerSmashSkillSegments,
    getPlayerSmashSkillStartedAtMilliseconds,
    setCharacterStates,
    setPlayerAttackFacing,
    setPlayerAttackQueuedAfterRoll,
    setPlayerAttackResolvedStartedAtMilliseconds,
    setPlayerAttackStartedAtMilliseconds,
    setPlayerFocusSkillReadyAtMilliseconds,
    setPlayerHitReactionState,
    setPlayerProtectSkillActiveUntilMilliseconds,
    setPlayerProtectSkillReadyAtMilliseconds,
    setPlayerRollReadyAtMilliseconds,
    setPlayerRollState,
    setPlayerSmashSkillFacing,
    setPlayerSmashSkillOrigin,
    setPlayerSmashSkillReadyAtMilliseconds,
    setPlayerSmashSkillSegments,
    setPlayerSmashSkillStartedAtMilliseconds
  } = ctx

  const triggerPlayerRoll = (
    vector: PlayerRollVector,
    now: number
  ): boolean => {
    const normalizedVector = normalizePlayerRollVector(vector)

    if (
      !normalizedVector ||
      playerProfile.hp.current === 0 ||
      getIsSceneTransitionPending() ||
      isPlayerCasting(now) ||
      now < getPlayerRollReadyAtMilliseconds()
    ) {
      return false
    }

    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
    const facing = getFacingFromRollVector(normalizedVector, playerCharacter.facing)

    setPlayerRollState({
      vector: normalizedVector,
      startedAtMilliseconds: now,
      previousDistanceTiles: 0
    })
    setPlayerRollReadyAtMilliseconds(now + PLAYER_ROLL_COOLDOWN_MILLISECONDS)
    setPlayerHitReactionState(undefined)
    gameSoundEffects.play('playerRollWhoosh')
    setCharacterStates(getCharacterStates().map((character) =>
      character.id === PLAYER_CHARACTER_ID
        ? {
            ...playerCharacter,
            facing
          }
        : character
    ))
    getSyncPlayerCharacterVisual()(now)

    return true
  }
  const triggerPlayerRollFromPressedDirection = (now: number): boolean => {
    const vector = getRollVectorFromPressedDirections()

    return vector ? triggerPlayerRoll(vector, now) : false
  }
  const getRollVectorFromPressedDirections = ():
    | PlayerRollVector
    | undefined => {
    let x = 0
    let y = 0

    if (pressedDirections.has('left')) {
      x -= 1
    }

    if (pressedDirections.has('right')) {
      x += 1
    }

    if (pressedDirections.has('up')) {
      y -= 1
    }

    if (pressedDirections.has('down')) {
      y += 1
    }

    return normalizePlayerRollVector({ x, y })
  }
  const isPlayerRolling = (now: number): boolean => {
    const playerRollState = getPlayerRollState()
    return (
      playerRollState !== undefined &&
      getPlayerRollProgress({
        nowMilliseconds: now,
        startedAtMilliseconds: playerRollState.startedAtMilliseconds
      }) < 1
    )
  }
  const finishPlayerRoll = (now: number): void => {
    setPlayerRollState(undefined)
    setPlayerRollReadyAtMilliseconds(now + PLAYER_ROLL_COOLDOWN_MILLISECONDS)
    getSyncPlayerCharacterVisual()(now)

    if (!getPlayerAttackQueuedAfterRoll()) {
      return
    }

    setPlayerAttackQueuedAfterRoll(false)
    triggerPlayerAttack(now)
  }
  const stepPlayerRoll = (now: number): boolean => {
    const playerRollState = getPlayerRollState()
    if (!playerRollState) {
      return false
    }

    const progress = getPlayerRollProgress({
      nowMilliseconds: now,
      startedAtMilliseconds: playerRollState.startedAtMilliseconds
    })
    const nextDistanceTiles = getPlayerRollDistanceTiles(progress)
    const deltaDistanceTiles =
      nextDistanceTiles - playerRollState.previousDistanceTiles
    const isRollComplete = progress >= 1

    setPlayerRollState({
      ...playerRollState,
      previousDistanceTiles: nextDistanceTiles
    })

    if (deltaDistanceTiles <= 0) {
      if (isRollComplete) {
        finishPlayerRoll(now)
      } else {
        getSyncPlayerCharacterVisual()(now)
      }
      return false
    }

    const didMove = tryMoveCharacter(
      PLAYER_CHARACTER_ID,
      playerRollState.vector.x * deltaDistanceTiles,
      playerRollState.vector.y * deltaDistanceTiles,
      {
        ignoreMonsterBlocking: true,
        preserveFacing: true
      }
    )

    if (!didMove) {
      finishPlayerRoll(now)
      return false
    }

    if (isRollComplete) {
      finishPlayerRoll(now)
    }

    return didMove
  }
  const triggerPlayerProtectSkill = (now: number): boolean => {
    const playerProtectSkillSprite = getPlayerProtectSkillSprite()
    if (playerProfile.hp.current === 0) {
      return false
    }

    if (now < getPlayerProtectSkillReadyAtMilliseconds()) {
      return false
    }

    const protectSkillLevel =
      getPlayerSkillLevelById(playerProfile, PLAYER_PROTECT_SKILL_ID) ?? 1

    setPlayerProtectSkillActiveUntilMilliseconds(now + getPlayerProtectSkillDurationByLevel(protectSkillLevel))
    setPlayerProtectSkillReadyAtMilliseconds(now + PLAYER_PROTECT_SKILL_COOLDOWN_MILLISECONDS)
    if (playerProtectSkillSprite) {
      playerProtectSkillSprite.gotoAndPlay(0)
      playerProtectSkillSprite.visible = true
    }
    showCharacterDamageText(
      PLAYER_CHARACTER_ID,
      '방어!',
      EVADE_TEXT_DURATION_MILLISECONDS,
      EVADE_TEXT_STYLE
    )
    return true
  }
  const triggerPlayerSmashSkill = (now: number): boolean => {
    if (playerProfile.hp.current === 0) {
      return false
    }

    if (now < getPlayerSmashSkillReadyAtMilliseconds()) {
      return false
    }

    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)

    clearPlayerSmashSkillEffectSprites()
    setPlayerSmashSkillOrigin({
      x: playerCharacter.position.x * map.tileWidth + characterPixelWidth / 2,
      y: playerCharacter.position.y * map.tileHeight + characterPixelHeight / 2
    })
    setPlayerSmashSkillStartedAtMilliseconds(now)
    setPlayerSmashSkillFacing(playerCharacter.facing)
    setPlayerSmashSkillReadyAtMilliseconds(now + PLAYER_SMASH_SKILL_COOLDOWN_MILLISECONDS)
    getPlayerSmashSkillHitMonsterIds().clear()
    playPlayerSmashSkillEffect(playerCharacter, now)
    return true
  }
  const triggerPlayerSkillById = (skillId: string, now: number): boolean => {
    const manaCost = getPlayerSkillManaCostById(playerProfile, skillId)

    if (!isPlayerSkillUnlockedInProfile(playerProfile, skillId)) {
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        '아직 배우지 못한 스킬이다',
        EVADE_TEXT_DURATION_MILLISECONDS,
        EVADE_TEXT_STYLE
      )
      return false
    }

    if (manaCost > 0 && playerProfile.mp.current < manaCost) {
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        'MP가 부족하다',
        EVADE_TEXT_DURATION_MILLISECONDS,
        EVADE_TEXT_STYLE
      )
      return false
    }

    let didTrigger = false

    switch (skillId) {
      case PLAYER_PROTECT_SKILL_ID:
        didTrigger = triggerPlayerProtectSkill(now)
        break
      case PLAYER_SMASH_SKILL_ID:
        // 스매시는 검 계열 1장 스킬 — 다른 무기는 각자의 계열 스킬을 쓴다.
        if (getEquippedPlayerWeaponLine(getCurrentPlayerEquipment()) !== 'sword') {
          showPlayerMagicMessage('검 계열 무기를 들어야 한다')
          return false
        }
        didTrigger = triggerPlayerSmashSkill(now)
        break
      case PLAYER_MULTI_SHOT_SKILL_ID:
      case PLAYER_PIERCING_ARROW_SKILL_ID:
      case PLAYER_POISON_ARROW_SKILL_ID:
        if (!triggerPlayerBowSkill(skillId, now)) {
          return false
        }
        didTrigger = true
        break
      case PLAYER_ICE_BOLT_SKILL_ID:
      case PLAYER_FIREBALL_SKILL_ID:
      case PLAYER_CHAIN_LIGHTNING_SKILL_ID:
        // 실패 이유(무기·대상·쿨다운)는 마법 쪽에서 이미 띄웠다 — 공통 '준비 안 됨' 문구를 생략.
        if (!triggerPlayerMagicSkill(skillId, now)) {
          return false
        }
        didTrigger = true
        break
      case PLAYER_DASH_SKILL_ID: {
        // 돌진: 이동 입력 방향(없으면 바라보는 방향)으로 구르고, 도착 즉시 벤다.
        const facing = getCharacterStateById(PLAYER_CHARACTER_ID).facing
        const facingVector =
          facing === 'left'
            ? { x: -1, y: 0 }
            : facing === 'right'
              ? { x: 1, y: 0 }
              : facing === 'up'
                ? { x: 0, y: -1 }
                : { x: 0, y: 1 }
        const dashVector =
          getRollVectorFromPressedDirections() ?? facingVector
        didTrigger = triggerPlayerRoll(dashVector, now)
        if (didTrigger) {
          setPlayerAttackQueuedAfterRoll(true)
        }
        break
      }
      case PLAYER_FOCUS_SKILL_ID: {
        if (
          now < getPlayerFocusSkillReadyAtMilliseconds() ||
          playerProfile.mp.current >= playerProfile.mp.max
        ) {
          didTrigger = false
          break
        }
        const focusLevel =
          getPlayerSkillLevelById(playerProfile, PLAYER_FOCUS_SKILL_ID) ?? 1
        const restoreAmount = getPlayerFocusSkillManaRestoreByLevel(focusLevel)
        playerProfile.mp.current = Math.min(
          playerProfile.mp.max,
          playerProfile.mp.current + restoreAmount
        )
        setPlayerFocusSkillReadyAtMilliseconds(now + 5000)
        showCharacterDamageText(
          PLAYER_CHARACTER_ID,
          `+${restoreAmount} MP`,
          EVADE_TEXT_DURATION_MILLISECONDS,
          EVADE_TEXT_STYLE
        )
        syncPlayerUiOverlays()
        didTrigger = true
        break
      }
      default: {
        // 무기 계열 스킬(playerWeaponSkills): 무기·대상이 없으면 이유를 이미 띄웠다.
        const result = triggerPlayerWeaponSkill(skillId, now)
        if (result === 'blocked' || result === 'not-weapon-skill') {
          return false
        }
        didTrigger = result === 'cast'
        break
      }
    }

    if (!didTrigger) {
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        '아직 준비되지 않았다',
        EVADE_TEXT_DURATION_MILLISECONDS,
        EVADE_TEXT_STYLE
      )
      return false
    }

    gameSoundEffects.play('playerSkill')

    if (manaCost > 0) {
      playerProfile.mp.current = Math.max(0, playerProfile.mp.current - manaCost)
      syncPlayerUiOverlays()
    }

    return true
  }
  const triggerPlayerSkillFromSlotIndex = (
    skillSlotIndex: number,
    now: number
  ) => {
    const skillSlot = getCurrentPlayerSkillSlots().slots[skillSlotIndex]

    if (!skillSlot) {
      return
    }

    triggerPlayerSkillById(skillSlot.skillId, now)
  }
  const startPlayerWeaponAttackMotion = (
    character: CharacterState,
    now: number,
    options?: {
      suppressDamage?: boolean
    }
  ) => {
    setPlayerAttackStartedAtMilliseconds(now)
    setPlayerAttackResolvedStartedAtMilliseconds(options?.suppressDamage
      ? now
      : undefined)
    setPlayerAttackFacing(character.facing)
  }
  const clearPlayerProtectSkillEffectSprite = () => {
    const playerProtectSkillSprite = getPlayerProtectSkillSprite()
    if (!playerProtectSkillSprite) {
      return
    }

    playerProtectSkillSprite.visible = false
    playerProtectSkillSprite.stop()
    playerProtectSkillSprite.gotoAndStop(0)
  }
  const clearPlayerSmashSkillEffectSprites = () => {
    if (getPlayerSmashSkillSegments().length === 0) {
      setPlayerSmashSkillStartedAtMilliseconds(undefined)
      setPlayerSmashSkillFacing(undefined)
      setPlayerSmashSkillOrigin(undefined)
      getPlayerSmashSkillHitMonsterIds().clear()
      return
    }

    for (const segment of getPlayerSmashSkillSegments()) {
      segment.sprite.removeFromParent()
      segment.sprite.destroy()
    }

    setPlayerSmashSkillSegments([])
    setPlayerSmashSkillStartedAtMilliseconds(undefined)
    setPlayerSmashSkillFacing(undefined)
    setPlayerSmashSkillOrigin(undefined)
    getPlayerSmashSkillHitMonsterIds().clear()
  }
  const playPlayerSmashSkillEffect = (
    character: CharacterState,
    now: number
  ) => {
    const isHorizontalSlash =
      character.facing !== 'up' && character.facing !== 'down'
    const slashTextures = isHorizontalSlash
      ? slashVfxTextures.horizontalTextures
      : slashVfxTextures.verticalTextures
    const originX =
      getPlayerSmashSkillOrigin()?.x ??
      (character.position.x * map.tileWidth + characterPixelWidth / 2)
    const originY =
      getPlayerSmashSkillOrigin()?.y ??
      (character.position.y * map.tileHeight + characterPixelHeight / 2)
    const baseZIndex = Math.round(originY + characterPixelHeight / 2) + 1

    setPlayerSmashSkillSegments(Array.from(
      { length: PLAYER_SMASH_SKILL_SEGMENT_COUNT },
      (_, segmentIndex) => {
        const slashSprite = new AnimatedSprite(slashTextures)

        slashSprite.label = 'character:player:smash-skill-effect'
        slashSprite.anchor.set(0.5)
        slashSprite.animationSpeed = PLAYER_SMASH_SKILL_EFFECT_ANIMATION_SPEED
        slashSprite.loop = false
        slashSprite.roundPixels = true
        slashSprite.visible = false
        slashSprite.zIndex = baseZIndex + segmentIndex
        getDepthSortedLayer()?.addChild(slashSprite)

        return {
          sprite: slashSprite,
          delayMilliseconds:
            segmentIndex * PLAYER_SMASH_SKILL_SEGMENT_STAGGER_MILLISECONDS,
          started: false,
          index: segmentIndex
        }
      }
    ))
    getDepthSortedLayer()?.sortChildren()

    syncPlayerSmashSkillVisual(character, now, originX, originY)
  }
  const syncPlayerSmashSkillVisual = (
    character: CharacterState,
    now: number,
    characterCenterX: number = character.position.x * map.tileWidth +
      characterPixelWidth / 2,
    characterCenterY: number = character.position.y * map.tileHeight +
      characterPixelHeight / 2
  ) => {
    const playerSmashSkillStartedAtMilliseconds = getPlayerSmashSkillStartedAtMilliseconds()
    if (playerSmashSkillStartedAtMilliseconds === undefined) {
      return
    }

    const facing = getPlayerSmashSkillFacing() ?? character.facing
    const originX = getPlayerSmashSkillOrigin()?.x ?? characterCenterX
    const originY = getPlayerSmashSkillOrigin()?.y ?? characterCenterY
    const totalLifetimeMilliseconds =
      PLAYER_SMASH_SKILL_SEGMENT_DURATION_MILLISECONDS +
      PLAYER_SMASH_SKILL_SEGMENT_STAGGER_MILLISECONDS *
        (PLAYER_SMASH_SKILL_SEGMENT_COUNT - 1)
    const elapsedMilliseconds =
      now - playerSmashSkillStartedAtMilliseconds

    for (const segment of getPlayerSmashSkillSegments()) {
      const segmentElapsedMilliseconds =
        elapsedMilliseconds - segment.delayMilliseconds

      if (segmentElapsedMilliseconds < 0) {
        segment.sprite.visible = false
        continue
      }

      if (!segment.started) {
        segment.sprite.gotoAndPlay(0)
        segment.started = true
      }

      const progress = Math.min(
        1,
        segmentElapsedMilliseconds /
          PLAYER_SMASH_SKILL_SEGMENT_DURATION_MILLISECONDS
      )
      const placement = getPlayerSmashSkillSegmentPlacement({
        characterCenterX: originX,
        characterCenterY: originY,
        facing,
        segmentIndex: segment.index,
        progress
      })

      segment.sprite.visible = placement.alpha > 0
      segment.sprite.position.set(placement.x, placement.y)
      segment.sprite.zIndex =
        Math.round(placement.y + characterPixelHeight / 2) + segment.index
      segment.sprite.rotation =
        facing === 'up'
          ? -Math.PI / 2
          : facing === 'down'
            ? Math.PI / 2
            : 0
      segment.sprite.scale.set(
        facing === 'left' ? -placement.scaleX : placement.scaleX,
        placement.scaleY
      )
      segment.sprite.alpha = placement.alpha
    }

    if (elapsedMilliseconds >= totalLifetimeMilliseconds) {
      clearPlayerSmashSkillEffectSprites()
      return
    }

    getDepthSortedLayer()?.sortChildren()
  }
  const stopPlayerFootsteps = () => {
    gameSoundEffects.stop('grassFootstep')
  }
  const syncPlayerFootsteps = (didPlayerMove: boolean) => {
    if (
      !didPlayerMove ||
      playerProfile.hp.current === 0 ||
      getIsPauseMenuOpen() ||
      mapOverlay.getIsExpanded()
    ) {
      stopPlayerFootsteps()
      return
    }

    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)

    if (!isCharacterOnGrass(playerCharacter, grassTiles)) {
      stopPlayerFootsteps()
      return
    }

    gameSoundEffects.startLoop('grassFootstep')
  }

  return {
    clearPlayerProtectSkillEffectSprite,
    clearPlayerSmashSkillEffectSprites,
    isPlayerRolling,
    startPlayerWeaponAttackMotion,
    stepPlayerRoll,
    stopPlayerFootsteps,
    syncPlayerFootsteps,
    syncPlayerSmashSkillVisual,
    triggerPlayerRollFromPressedDirection,
    triggerPlayerSkillById,
    triggerPlayerSkillFromSlotIndex
  }
}
