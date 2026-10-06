// 전투 판정: 몬스터 판별, 명중 범위·대상 고르기, 몬스터 리스폰, 플레이어 사망·부활,
// 플레이어/몬스터 피해 적용, 근접·강타·접촉 피해 처리. 맵 화면의 상태는 ctx 로 받는다.
import type { TextStyle } from 'pixi.js'
import type { createLuaMonsterCombat } from '../../monsterCombatLua'
import type { PlayerStatEffectRules } from '../../playerStatEffectsLua'
import type { PlayerProfile } from '../../playerProfile'
import type { PlayerEquipment } from '../../playerEquipment'
import type { ParsedTiledMap } from '../../tiled/parseTiledMap'
import type { MonsterRewardsRules } from '../../monsterRewardsLua'
import type { GrantPlayerExperienceResult } from '../../playerExperience'
import type { GameSoundEffects } from '../createGameSoundEffects'
import { AnimatedSprite } from 'pixi.js'
import { PLAYER_CHARACTER_ID } from '../../characterState'
import type { CharacterMoveDirection, CharacterState } from '../../characterState'
import { getEquippedPlayerDefense, getEquippedPlayerMeleeMotion } from '../../playerEquipment'
import { type PlayerInventory } from '../../playerInventory'
import { PLAYER_SMASH_SKILL_ID } from '../../playerSmashSkill'
import { recordMonsterDefeatQuestProgress, type QuestLogState } from '../../questLog'
import { rollMonsterEquipmentDrop } from '../../monsterEquipmentDrops'
import { grantPlayerSkillPoints } from '../../playerProgression'
import { type MonsterPatrolState } from '../../monsterPatrol'
import { applyMonsterDamage, isMonsterDefeated, type MonsterCombatState } from '../../monsterCombat'
import { getPlayerEquipmentItemDefinitionById, getPlayerSkillDamageById } from '../../lua/luaGameLogic'
import { resolveCharacterInteractionTarget } from '../../interaction/resolveCharacterInteractionTarget'
import { doCollisionRectsIntersect, type CollisionRect } from '../characterCollision'
import { DEFAULT_MONSTER_DEATH_SOUND, getMonsterCatalogEntry, type MonsterBehaviorConfig } from '../monsterCatalog'
import { isBossSummonCharacterId } from '../../bossSkills'
import { BOSS_RETRY_RESPAWN_DELAY_MILLISECONDS, DAMAGE_TEXT_DURATION_MILLISECONDS, EVADE_TEXT_DURATION_MILLISECONDS, EVADE_TEXT_STYLE, MONSTER_ATTACK_RANGE_TOUCH_TOLERANCE_TILES, MONSTER_CONTACT_DAMAGE_COOLDOWN_MILLISECONDS, MONSTER_CONTACT_DAMAGE_TOUCH_TOLERANCE_TILES, MONSTER_RESPAWN_DELAY_MILLISECONDS, PLAYER_ATTACK_PROBE_DISTANCE_IN_TILES, PLAYER_DAMAGE_INVULNERABILITY_MILLISECONDS, PLAYER_RESPAWN_DELAY_MILLISECONDS, SLASH_VFX_HIT_PADDING_PIXELS, WHITE_SLASH_WIDE_FRAME_BOUNDS, isBossCharacterId } from './constants'
import { getMonsterBehaviorConfig } from './nodes'
import { getPlayerMeleeMotion } from './playerMeleeMotions'
import { getFacingDirection, isMeleeMotionHitWindowOpen, type MeleeMotion } from './meleeMotions/meleeMotion'
import { createCollisionRectFromCharacter } from './tiles'
import { type MonsterPigAnimationMode, type MonsterPigBehaviorState, type PlayerHitReactionState, type RenderedCharacterNode } from './types'

export type CombatContext = {
  clearMagicEffects: () => void
  clearPlayerProjectiles: () => void
  clearPlayerProtectSkillEffectSprite: () => void
  clearPlayerSlashEffectSprite: () => void
  clearPlayerSmashSkillEffectSprites: () => void
  clearPressedInputState: () => void
  createMonsterPigBehaviorState: () => MonsterPigBehaviorState
  gameSoundEffects: GameSoundEffects
  getCharacterStateById: (characterId: string) => CharacterState
  getMonsterCombatStateOptions: (character: CharacterState) => { hpMultiplier: number; damageMultiplier: number; } | { hpMultiplier: number; damageMultiplier?: undefined; }
  getPlayerBasicAttackDamage: (isMagic: boolean) => number
  grantPlayerExperienceReward: (experienceReward: number) => GrantPlayerExperienceResult
  isMonsterFrozen: (monsterId: string, now: number) => boolean
  isMonsterStillNeededByQuest: (monster: CharacterState) => boolean
  isPlayerRolling: (now: number) => boolean
  knockbackCharacterAwayFromCharacter: (targetCharacterId: string, sourceCharacter: CharacterState, distanceInTiles: number) => void
  knockbackMonsterAwayFromCharacter: (characterId: string, sourceCharacter: CharacterState, distanceInTiles: number) => void
  luaMonsterCombat: ReturnType<typeof createLuaMonsterCombat>
  map: ParsedTiledMap
  monsterCombatStates: Map<string, MonsterCombatState>
  monsterContactDamageLockedUntilById: Map<string, number>
  monsterPatrolStates: Map<string, MonsterPatrolState>
  monsterPigAnimationModes: Map<string, MonsterPigAnimationMode>
  monsterPigBehaviorStates: Map<string, MonsterPigBehaviorState>
  monsterRespawnAtById: Map<string, number>
  monsterRewards: MonsterRewardsRules
  monsterSpawnStates: Map<string, CharacterState>
  onBossDefeated: (bossId: string) => void
  onPlayerInventoryChange: (nextInventory: PlayerInventory) => void
  playerProfile: PlayerProfile
  playerRespawnState: { position: { x: number; y: number; }; facing: CharacterMoveDirection; }
  playerStatEffects: PlayerStatEffectRules
  renderedCharacters: Map<string, RenderedCharacterNode>
  sceneId: string
  setMonsterPigHitReaction: (characterId: string, now: number, behaviorConfig: MonsterBehaviorConfig) => void
  setPlayerHitReaction: (sourceCharacter: CharacterState, now: number) => void
  setQuestLogWithObjectiveFeedback: (nextQuestLog: QuestLogState) => void
  stopPlayerFootsteps: () => void
  syncCharacterSprite: (character: CharacterState, now?: number) => void
  syncMonsterAnimation: (characterId: string, mode: MonsterPigAnimationMode, options?: { forceRestart?: boolean; }) => void
  syncPlayerUiOverlays: () => void
  clearBossEncounter: (bossId: string) => void
  showCharacterDamageText: (characterId: string, message: string, durationMilliseconds: number, style?: TextStyle) => void
  spawnMonsterEquipmentDrop: (characterId: string, dropDefinition: ReturnType<typeof rollMonsterEquipmentDrop>, position: { x: number; y: number; }, now: number) => void
  spawnMonsterGoldDrop: (characterId: string, amount: number, position: { x: number; y: number; }, now: number) => void
  getCurrentPlayerEquipment: () => PlayerEquipment
  getCurrentQuestLog: () => QuestLogState
  getPlayerSlashEffectSprite: () => AnimatedSprite | undefined
  getPlayerSmashSkillHitMonsterIds: () => Set<string>
  getPlayerSmashSkillSegments: () => { sprite: AnimatedSprite; delayMilliseconds: number; started: boolean; index: number; }[]
  getPlayerSmashSkillStartedAtMilliseconds: () => number | undefined
  getCharacterStates: () => CharacterState[]
  getCurrentPlayerInventory: () => PlayerInventory
  getPlayerAttackResolvedStartedAtMilliseconds: () => number | undefined
  getPlayerAttackStartedAtMilliseconds: () => number | undefined
  getPlayerDamageInvulnerableUntilMilliseconds: () => number
  getPlayerProtectSkillActiveUntilMilliseconds: () => number
  getPlayerRespawnAtMilliseconds: () => number | undefined
  setCharacterStates: (value: CharacterState[]) => void
  setCurrentPlayerInventory: (value: PlayerInventory) => void
  setPlayerAttackFacing: (value: CharacterMoveDirection | undefined) => void
  setPlayerAttackReadyAtMilliseconds: (value: number) => void
  setPlayerAttackResolvedStartedAtMilliseconds: (value: number | undefined) => void
  setPlayerAttackStartedAtMilliseconds: (value: number | undefined) => void
  setPlayerDamageInvulnerableUntilMilliseconds: (value: number) => void
  setPlayerHitReactionState: (value: PlayerHitReactionState | undefined) => void
  setPlayerProtectSkillActiveUntilMilliseconds: (value: number) => void
  setPlayerProtectSkillReadyAtMilliseconds: (value: number) => void
  setPlayerRespawnAtMilliseconds: (value: number | undefined) => void
  setPlayerSmashSkillReadyAtMilliseconds: (value: number) => void
}

export const createCombat = (ctx: CombatContext) => {
  const {
    clearMagicEffects,
    clearPlayerProjectiles,
    clearPlayerProtectSkillEffectSprite,
    clearPlayerSlashEffectSprite,
    clearPlayerSmashSkillEffectSprites,
    clearPressedInputState,
    createMonsterPigBehaviorState,
    gameSoundEffects,
    getCharacterStateById,
    getMonsterCombatStateOptions,
    getPlayerBasicAttackDamage,
    grantPlayerExperienceReward,
    isMonsterFrozen,
    isMonsterStillNeededByQuest,
    isPlayerRolling,
    knockbackCharacterAwayFromCharacter,
    knockbackMonsterAwayFromCharacter,
    luaMonsterCombat,
    map,
    monsterCombatStates,
    monsterContactDamageLockedUntilById,
    monsterPatrolStates,
    monsterPigAnimationModes,
    monsterPigBehaviorStates,
    monsterRespawnAtById,
    monsterRewards,
    monsterSpawnStates,
    onBossDefeated,
    onPlayerInventoryChange,
    playerProfile,
    playerRespawnState,
    playerStatEffects,
    renderedCharacters,
    sceneId,
    setMonsterPigHitReaction,
    setPlayerHitReaction,
    setQuestLogWithObjectiveFeedback,
    stopPlayerFootsteps,
    syncCharacterSprite,
    syncMonsterAnimation,
    syncPlayerUiOverlays,
    clearBossEncounter,
    showCharacterDamageText,
    spawnMonsterEquipmentDrop,
    spawnMonsterGoldDrop,
    getCurrentPlayerEquipment,
    getCurrentQuestLog,
    getPlayerSlashEffectSprite,
    getPlayerSmashSkillHitMonsterIds,
    getPlayerSmashSkillSegments,
    getPlayerSmashSkillStartedAtMilliseconds,
    getCharacterStates,
    getCurrentPlayerInventory,
    getPlayerAttackResolvedStartedAtMilliseconds,
    getPlayerAttackStartedAtMilliseconds,
    getPlayerDamageInvulnerableUntilMilliseconds,
    getPlayerProtectSkillActiveUntilMilliseconds,
    getPlayerRespawnAtMilliseconds,
    setCharacterStates,
    setCurrentPlayerInventory,
    setPlayerAttackFacing,
    setPlayerAttackReadyAtMilliseconds,
    setPlayerAttackResolvedStartedAtMilliseconds,
    setPlayerAttackStartedAtMilliseconds,
    setPlayerDamageInvulnerableUntilMilliseconds,
    setPlayerHitReactionState,
    setPlayerProtectSkillActiveUntilMilliseconds,
    setPlayerProtectSkillReadyAtMilliseconds,
    setPlayerRespawnAtMilliseconds,
    setPlayerSmashSkillReadyAtMilliseconds
  } = ctx

  function isMonsterCharacter(character: CharacterState): boolean {
    return character.appearanceType.startsWith('monster_')
  }

  function isMonsterCombatStateDefeated(characterId: string): boolean {
    const combatState = monsterCombatStates.get(characterId)

    return combatState ? isMonsterDefeated(combatState) : false
  }

  function createSlashEffectHitRect(
    slashSprite: AnimatedSprite
  ): CollisionRect {
    const frameIndex = Math.min(
      Math.max(0, Math.floor(slashSprite.currentFrame)),
      WHITE_SLASH_WIDE_FRAME_BOUNDS.length - 1
    )
    const frameBounds =
      WHITE_SLASH_WIDE_FRAME_BOUNDS[frameIndex] ??
      WHITE_SLASH_WIDE_FRAME_BOUNDS[0]
    const textureWidth = slashSprite.texture.source.pixelWidth
    const textureHeight = slashSprite.texture.source.pixelHeight
    const scaleX = slashSprite.scale.x
    const scaleY = slashSprite.scale.y
    const rotation = slashSprite.rotation
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)
    const corners = [
      {
        x: frameBounds.x - textureWidth / 2 - SLASH_VFX_HIT_PADDING_PIXELS,
        y: frameBounds.y - textureHeight / 2 - SLASH_VFX_HIT_PADDING_PIXELS
      },
      {
        x:
          frameBounds.x +
          frameBounds.width -
          textureWidth / 2 +
          SLASH_VFX_HIT_PADDING_PIXELS,
        y: frameBounds.y - textureHeight / 2 - SLASH_VFX_HIT_PADDING_PIXELS
      },
      {
        x: frameBounds.x - textureWidth / 2 - SLASH_VFX_HIT_PADDING_PIXELS,
        y:
          frameBounds.y +
          frameBounds.height -
          textureHeight / 2 +
          SLASH_VFX_HIT_PADDING_PIXELS
      },
      {
        x:
          frameBounds.x +
          frameBounds.width -
          textureWidth / 2 +
          SLASH_VFX_HIT_PADDING_PIXELS,
        y:
          frameBounds.y +
          frameBounds.height -
          textureHeight / 2 +
          SLASH_VFX_HIT_PADDING_PIXELS
      }
    ]
    const worldCorners = corners.map((corner) => {
      const scaledX = corner.x * scaleX
      const scaledY = corner.y * scaleY

      return {
        x:
          slashSprite.position.x +
          scaledX * cos -
          scaledY * sin,
        y:
          slashSprite.position.y +
          scaledX * sin +
          scaledY * cos
      }
    })
    const xCoordinates = worldCorners.map((corner) => corner.x)
    const yCoordinates = worldCorners.map((corner) => corner.y)
    const minX = Math.min(...xCoordinates)
    const maxX = Math.max(...xCoordinates)
    const minY = Math.min(...yCoordinates)
    const maxY = Math.max(...yCoordinates)

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  }

  function resolveClosestMonsterInCollisionRect(
    hitRect: CollisionRect
  ): CharacterState | undefined {
    const hitRectCenterX = hitRect.x + hitRect.width / 2
    const hitRectCenterY = hitRect.y + hitRect.height / 2

    return getCharacterStates()
      .filter(
        (character) =>
          isMonsterCharacter(character) &&
          !isMonsterCombatStateDefeated(character.id) &&
          doCollisionRectsIntersect(
            hitRect,
            createPixelCollisionRectFromCharacter(character)
          )
      )
      .sort((leftCharacter, rightCharacter) => {
        const leftCenter = getCharacterPixelCenter(leftCharacter)
        const rightCenter = getCharacterPixelCenter(rightCharacter)
        const leftDistance =
          (leftCenter.x - hitRectCenterX) ** 2 +
          (leftCenter.y - hitRectCenterY) ** 2
        const rightDistance =
          (rightCenter.x - hitRectCenterX) ** 2 +
          (rightCenter.y - hitRectCenterY) ** 2

        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance
        }

        return leftCharacter.id.localeCompare(rightCharacter.id)
      })[0]
  }

  function resolveMonstersInCollisionRect(
    hitRect: CollisionRect
  ): CharacterState[] {
    return getCharacterStates().filter(
      (character) =>
        isMonsterCharacter(character) &&
        !isMonsterCombatStateDefeated(character.id) &&
        doCollisionRectsIntersect(
          hitRect,
          createPixelCollisionRectFromCharacter(character)
        )
    )
  }

  function createPixelCollisionRectFromCharacter(
    character: CharacterState
  ): CollisionRect {
    return {
      x: character.position.x * map.tileWidth,
      y: character.position.y * map.tileHeight,
      width: character.collisionSize.width * map.tileWidth,
      height: character.collisionSize.height * map.tileHeight
    }
  }

  function getCharacterPixelCenter(character: CharacterState): {
    x: number
    y: number
  } {
    return {
      x:
        character.position.x * map.tileWidth +
        (character.collisionSize.width * map.tileWidth) / 2,
      y:
        character.position.y * map.tileHeight +
        (character.collisionSize.height * map.tileHeight) / 2
    }
  }

  function maybeRespawnMonster(characterId: string, now: number): boolean {
    const respawnAt = monsterRespawnAtById.get(characterId)

    if (respawnAt === undefined || respawnAt > now) {
      return false
    }

    const spawnCharacter = monsterSpawnStates.get(characterId)

    if (!spawnCharacter) {
      return false
    }

    const nextCharacter: CharacterState = {
      ...spawnCharacter,
      position: {
        ...spawnCharacter.position
      },
      collisionSize: {
        ...spawnCharacter.collisionSize
      }
    }

    setCharacterStates(getCharacterStates().map((character) =>
      character.id === characterId ? nextCharacter : character
    ))
    monsterCombatStates.set(
      characterId,
      luaMonsterCombat.createMonsterCombatState(
        nextCharacter.level ?? 1,
        getMonsterCombatStateOptions(nextCharacter)
      )
    )
    monsterPatrolStates.delete(characterId)
    monsterContactDamageLockedUntilById.delete(characterId)
    monsterPigBehaviorStates.set(
      characterId,
      createMonsterPigBehaviorState()
    )
    monsterPigAnimationModes.delete(characterId)
    monsterRespawnAtById.delete(characterId)
    syncCharacterSprite(nextCharacter)
    syncMonsterAnimation(characterId, 'idle')

    return true
  }

  function getMonsterDistanceToPlayer(character: CharacterState): number {
    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
    const monsterCenterX = character.position.x + character.collisionSize.width / 2
    const monsterCenterY = character.position.y + character.collisionSize.height / 2
    const playerCenterX =
      playerCharacter.position.x + playerCharacter.collisionSize.width / 2
    const playerCenterY =
      playerCharacter.position.y + playerCharacter.collisionSize.height / 2

    return Math.hypot(
      playerCenterX - monsterCenterX,
      playerCenterY - monsterCenterY
    )
  }

  function isMonsterWithinRange(
    character: CharacterState,
    tiles: number
  ): boolean {
    return getMonsterDistanceToPlayer(character) <= tiles
  }

  function isMonsterWithinAttackRange(
    monsterCharacter: CharacterState,
    playerCharacter: CharacterState,
    behaviorConfig: MonsterBehaviorConfig
  ): boolean {
    const monsterCenterX =
      monsterCharacter.position.x + monsterCharacter.collisionSize.width / 2
    const monsterCenterY =
      monsterCharacter.position.y + monsterCharacter.collisionSize.height / 2
    const playerCenterX =
      playerCharacter.position.x + playerCharacter.collisionSize.width / 2
    const playerCenterY =
      playerCharacter.position.y + playerCharacter.collisionSize.height / 2

    return (
      Math.hypot(
        playerCenterX - monsterCenterX,
        playerCenterY - monsterCenterY
      ) <=
      behaviorConfig.attackRangeTiles +
        MONSTER_ATTACK_RANGE_TOUCH_TOLERANCE_TILES
    )
  }

  function beginPlayerDeath(now: number): void {
    if (getPlayerRespawnAtMilliseconds() !== undefined) {
      return
    }

    setPlayerRespawnAtMilliseconds(now + PLAYER_RESPAWN_DELAY_MILLISECONDS)
    setPlayerHitReactionState(undefined)
    clearPressedInputState()
    stopPlayerFootsteps()
    setPlayerAttackStartedAtMilliseconds(undefined)
    setPlayerAttackResolvedStartedAtMilliseconds(undefined)
    setPlayerAttackFacing(undefined)
    clearPlayerSlashEffectSprite()
    clearPlayerProtectSkillEffectSprite()
    clearPlayerSmashSkillEffectSprites()
    clearPlayerProjectiles()
    clearMagicEffects()
    setPlayerProtectSkillActiveUntilMilliseconds(0)
    setPlayerProtectSkillReadyAtMilliseconds(now + PLAYER_RESPAWN_DELAY_MILLISECONDS)
    setPlayerDamageInvulnerableUntilMilliseconds(0)
    setPlayerAttackReadyAtMilliseconds(now + PLAYER_RESPAWN_DELAY_MILLISECONDS)
    setPlayerSmashSkillReadyAtMilliseconds(now + PLAYER_RESPAWN_DELAY_MILLISECONDS)
    syncCharacterSprite(getCharacterStateById(PLAYER_CHARACTER_ID), now)
  }

  function maybeRespawnPlayer(now: number): boolean {
    if (playerProfile.hp.current > 0) {
      return false
    }

    const respawnAt = getPlayerRespawnAtMilliseconds()

    if (respawnAt === undefined || respawnAt > now) {
      return false
    }

    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)

    playerCharacter.position = {
      ...playerRespawnState.position
    }
    playerCharacter.facing = playerRespawnState.facing
    playerProfile.hp.current = playerProfile.hp.max
    // 사망 페널티 — 소지 골드의 10%를 잃는다(죽음에 무게를 준다).
    const respawnGoldPenalty = Math.floor(getCurrentPlayerInventory().gold * 0.1)
    if (respawnGoldPenalty > 0) {
      setCurrentPlayerInventory({
        ...getCurrentPlayerInventory(),
        gold: getCurrentPlayerInventory().gold - respawnGoldPenalty
      })
      onPlayerInventoryChange(getCurrentPlayerInventory())
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        `-${respawnGoldPenalty} 골드`,
        DAMAGE_TEXT_DURATION_MILLISECONDS
      )
    }
    setPlayerRespawnAtMilliseconds(undefined)
    setPlayerHitReactionState(undefined)
    clearPressedInputState()
    setPlayerAttackStartedAtMilliseconds(undefined)
    setPlayerAttackResolvedStartedAtMilliseconds(undefined)
    setPlayerAttackFacing(undefined)
    clearPlayerSlashEffectSprite()
    clearPlayerProtectSkillEffectSprite()
    clearPlayerSmashSkillEffectSprites()
    clearPlayerProjectiles()
    clearMagicEffects()
    setPlayerProtectSkillActiveUntilMilliseconds(0)
    setPlayerProtectSkillReadyAtMilliseconds(now)
    setPlayerDamageInvulnerableUntilMilliseconds(0)
    setPlayerAttackReadyAtMilliseconds(now)
    setPlayerSmashSkillReadyAtMilliseconds(now)
    syncCharacterSprite(playerCharacter, now)
    syncPlayerUiOverlays()
    showCharacterDamageText(
      PLAYER_CHARACTER_ID,
      '부활했다!',
      DAMAGE_TEXT_DURATION_MILLISECONDS
    )

    return true
  }

  function applyDamageToPlayer(
    damage: number,
    now: number,
    sourceCharacter?: CharacterState
  ): boolean {
    const nextDamage = Math.max(0, Math.floor(damage))

    if (nextDamage === 0 || playerProfile.hp.current === 0) {
      return false
    }

    if (getPlayerDamageInvulnerableUntilMilliseconds() > now) {
      return false
    }

    if (
      sourceCharacter &&
      getPlayerProtectSkillActiveUntilMilliseconds() > now
    ) {
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        '방어!',
        EVADE_TEXT_DURATION_MILLISECONDS,
        EVADE_TEXT_STYLE
      )
      return false
    }

    if (sourceCharacter && isPlayerRolling(now)) {
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        '회피!',
        EVADE_TEXT_DURATION_MILLISECONDS,
        EVADE_TEXT_STYLE
      )
      return false
    }

    if (
      sourceCharacter &&
      playerStatEffects.shouldPlayerEvadeDamage(playerProfile)
    ) {
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        '회피!',
        EVADE_TEXT_DURATION_MILLISECONDS,
        EVADE_TEXT_STYLE
      )
      return false
    }

    // 장비 방어력 — 몬스터가 준 피해만 줄인다(최소 1은 들어온다).
    const mitigatedDamage = sourceCharacter
      ? Math.max(1, nextDamage - getEquippedPlayerDefense(getCurrentPlayerEquipment()))
      : nextDamage
    // 시험장(시험 보스 실험용)에서는 체력이 줄지 않는다 — 피해 숫자만 띄운다.
    const nextHp =
      sceneId === 'boss-arena'
        ? playerProfile.hp.current
        : Math.max(0, playerProfile.hp.current - mitigatedDamage)
    const damageMessage =
      nextHp === 0 ? `-${mitigatedDamage}\n쓰러졌다!` : `-${mitigatedDamage}`

    playerProfile.hp.current = nextHp
    if (nextHp > 0) {
      setPlayerDamageInvulnerableUntilMilliseconds(now + PLAYER_DAMAGE_INVULNERABILITY_MILLISECONDS)
    }
    gameSoundEffects.play(nextHp === 0 ? 'playerGameOver' : 'playerDamage')
    showCharacterDamageText(
      PLAYER_CHARACTER_ID,
      damageMessage,
      DAMAGE_TEXT_DURATION_MILLISECONDS
    )
    if (sourceCharacter && nextHp > 0) {
      setPlayerHitReaction(sourceCharacter, now)
    }
    syncPlayerUiOverlays()

    if (nextHp === 0) {
      setPlayerHitReactionState(undefined)
      beginPlayerDeath(now)
    }

    return true
  }

  function applyDamageToMonster(
    characterId: string,
    damage: number,
    now: number
  ): void {
    const character = getCharacterStateById(characterId)
    const combatState = monsterCombatStates.get(characterId)
    const monsterBehaviorConfig = getMonsterBehaviorConfig(character)

    if (!combatState) {
      return
    }

    const nextCombatState = applyMonsterDamage(combatState, damage)

    if (nextCombatState === combatState) {
      return
    }

    monsterCombatStates.set(characterId, nextCombatState)
    gameSoundEffects.play('playerSwordHit')
    const nextDamage = Math.max(0, Math.floor(damage))
    const damageMessage =
      nextCombatState.currentHp === 0
        ? `-${nextDamage}\n쓰러졌다!`
        : `-${nextDamage}`

    showCharacterDamageText(
      characterId,
      damageMessage,
      DAMAGE_TEXT_DURATION_MILLISECONDS
    )

    if (isMonsterDefeated(nextCombatState)) {
      gameSoundEffects.play(
        getMonsterCatalogEntry(character.appearanceType)?.sounds?.death ??
          DEFAULT_MONSTER_DEATH_SOUND
      )
      setQuestLogWithObjectiveFeedback(
        recordMonsterDefeatQuestProgress(getCurrentQuestLog(), {
          sceneId,
          appearanceType: character.appearanceType,
          characterId
        })
      )
      character.blocksMovement = false
      monsterPatrolStates.delete(characterId)
      monsterContactDamageLockedUntilById.delete(characterId)
      monsterPigAnimationModes.delete(characterId)
      monsterPigBehaviorStates.delete(characterId)
      const experienceReward = monsterRewards.getMonsterExperienceDropAmount(
        character.level ?? 1
      )
      grantPlayerExperienceReward(experienceReward)
      const dropPosition = {
        x:
          character.position.x * map.tileWidth +
          (character.collisionSize.width * map.tileWidth) / 2,
        y:
          character.position.y * map.tileHeight +
          (character.collisionSize.height * map.tileHeight) / 2
      }
      const skillPointReward = monsterRewards.getMonsterSkillPointDropAmount(
        character.level ?? 1
      )
      Object.assign(
        playerProfile,
        grantPlayerSkillPoints(playerProfile, skillPointReward)
      )
      syncPlayerUiOverlays()

      // 몬스터 레벨보다 높은 등급 장비는 떨어지지 않는다 — 저레벨 몹이 최상급
      // 장비를 뿌리던 것을 막고, 상위 지역일수록 좋은 드롭이 나오게 한다.
      const equipmentDropRoll = rollMonsterEquipmentDrop(Math.random)
      const equipmentDrop =
        equipmentDropRoll &&
        (getPlayerEquipmentItemDefinitionById(equipmentDropRoll.itemId)?.level ??
          1) <= (character.level ?? 1)
          ? equipmentDropRoll
          : undefined

      if (equipmentDrop) {
        spawnMonsterEquipmentDrop(characterId, equipmentDrop, dropPosition, now)
      } else {
        spawnMonsterGoldDrop(
          characterId,
          monsterRewards.getMonsterGoldDropAmount(character.level ?? 1),
          dropPosition,
          now
        )
      }
      if (isBossCharacterId(characterId)) {
        clearBossEncounter(characterId)
      }
      if (isBossSummonCharacterId(characterId)) {
        // 소환 하수인은 저절로 다시 생기지 않는다 — 보스가 다시 불러낸다
      } else if (isBossCharacterId(characterId) && !isMonsterStillNeededByQuest(character)) {
        // 보스는 다시 생기지 않는다 — 씬을 다시 들어와도 없도록 월드 저장에 남긴다.
        // (그 보스를 잡아야 하는 퀘스트가 아직 남아 있으면 길게 기다렸다 다시 생긴다.)
        onBossDefeated(characterId)
      } else if (isBossCharacterId(characterId)) {
        monsterRespawnAtById.set(characterId, now + BOSS_RETRY_RESPAWN_DELAY_MILLISECONDS)
      } else {
        monsterRespawnAtById.set(
          characterId,
          now + MONSTER_RESPAWN_DELAY_MILLISECONDS
        )
      }
      const renderNode = renderedCharacters.get(characterId)

      if (renderNode) {
        renderNode.container.visible = false
      }
      return
    }

    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)

    monsterContactDamageLockedUntilById.set(
      characterId,
      now + monsterBehaviorConfig.hitReactionDurationMilliseconds
    )
    setMonsterPigHitReaction(characterId, now, monsterBehaviorConfig)
    knockbackMonsterAwayFromCharacter(characterId, playerCharacter, 0.45)
    monsterPigAnimationModes.delete(characterId)
    syncMonsterAnimation(characterId, 'hit', { forceRestart: true })
    syncCharacterSprite(getCharacterStateById(characterId), now)
  }

  function resolvePlayerAttackDamage(now: number): void {
    if (playerProfile.hp.current === 0) {
      return
    }

    if (
      getPlayerAttackStartedAtMilliseconds() === undefined ||
      getPlayerAttackResolvedStartedAtMilliseconds() ===
        getPlayerAttackStartedAtMilliseconds()
    ) {
      return
    }

    const meleeMotion = getPlayerMeleeMotion(getEquippedPlayerMeleeMotion(getCurrentPlayerEquipment()))
    if (meleeMotion) {
      resolvePlayerMeleeMotionDamage(meleeMotion, now)
      return
    }

    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
    const playerSlashEffectSprite = getPlayerSlashEffectSprite()
    const targetCharacter = playerSlashEffectSprite
      ? resolveClosestMonsterInCollisionRect(
          createSlashEffectHitRect(playerSlashEffectSprite)
        )
      : resolveCharacterInteractionTarget({
          sourceCharacter: playerCharacter,
          targetCharacters: getCharacterStates(),
          canReceiveInteraction: (character) =>
            isMonsterCharacter(character) &&
            !isMonsterCombatStateDefeated(character.id),
          interactionProbeDistanceInTiles: PLAYER_ATTACK_PROBE_DISTANCE_IN_TILES
        })

    if (targetCharacter) {
      // 근접 기본 공격 — 마법 무기는 발사체 경로로 가므로 여기는 항상 물리다.
      applyDamageToMonster(targetCharacter.id, getPlayerBasicAttackDamage(false), now)
      setPlayerAttackResolvedStartedAtMilliseconds(getPlayerAttackStartedAtMilliseconds())
    }
  }

  // 무기별 모션(창·도끼·철퇴·단검) 판정: 모션이 정한 시점부터 동작이 끝날 때까지,
  // 한 마리(single) 또는 범위 안 전부(area)를 한 번 맞힌다.
  function resolvePlayerMeleeMotionDamage(meleeMotion: MeleeMotion, now: number): void {
    const attackStartedAt = getPlayerAttackStartedAtMilliseconds() ?? now
    if (!isMeleeMotionHitWindowOpen(meleeMotion, now - attackStartedAt)) {
      return
    }

    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
    const damage = getPlayerBasicAttackDamage(false)
    const hit = meleeMotion.hit

    if (hit.kind === 'single') {
      const targetCharacter = resolveCharacterInteractionTarget({
        sourceCharacter: playerCharacter,
        targetCharacters: getCharacterStates(),
        canReceiveInteraction: (character) =>
          isMonsterCharacter(character) &&
          !isMonsterCombatStateDefeated(character.id),
        interactionProbeDistanceInTiles: hit.probeDistanceInTiles
      })

      if (targetCharacter) {
        applyDamageToMonster(targetCharacter.id, damage, now)
        setPlayerAttackResolvedStartedAtMilliseconds(attackStartedAt)
      }
      return
    }

    const center = getCharacterPixelCenter(playerCharacter)
    const direction = getFacingDirection(playerCharacter.facing)
    const hitRect = hit.getHitRect({
      x: center.x,
      y: center.y,
      bodyWidth: playerCharacter.collisionSize.width * map.tileWidth,
      bodyHeight: playerCharacter.collisionSize.height * map.tileHeight,
      directionX: direction.x,
      directionY: direction.y,
      tileWidth: map.tileWidth,
      tileHeight: map.tileHeight
    })
    const targetCharacters = getCharacterStates().filter(
      (character) =>
        isMonsterCharacter(character) &&
        !isMonsterCombatStateDefeated(character.id) &&
        doCollisionRectsIntersect(hitRect, createPixelCollisionRectFromCharacter(character))
    )

    if (targetCharacters.length === 0) {
      return
    }

    for (const targetCharacter of targetCharacters) {
      applyDamageToMonster(targetCharacter.id, damage, now)
      knockbackMonsterAwayFromCharacter(targetCharacter.id, playerCharacter, hit.extraKnockbackInTiles)
    }
    setPlayerAttackResolvedStartedAtMilliseconds(attackStartedAt)
  }

  function resolvePlayerSmashSkillDamage(now: number): void {
    if (
      playerProfile.hp.current === 0 ||
      getPlayerSmashSkillStartedAtMilliseconds() === undefined
    ) {
      return
    }

    const smashSkillDamage =
      getPlayerSkillDamageById(playerProfile, PLAYER_SMASH_SKILL_ID)

    for (const segment of getPlayerSmashSkillSegments()) {
      if (!segment.sprite.visible) {
        continue
      }

      const hitRect = createSlashEffectHitRect(segment.sprite)

      for (const monsterCharacter of resolveMonstersInCollisionRect(hitRect)) {
        if (getPlayerSmashSkillHitMonsterIds().has(monsterCharacter.id)) {
          continue
        }

        getPlayerSmashSkillHitMonsterIds().add(monsterCharacter.id)
        applyDamageToMonster(
          monsterCharacter.id,
          smashSkillDamage,
          now
        )
      }
    }
  }

  function resolveMonsterContactDamage(now: number): void {
    if (playerProfile.hp.current === 0) {
      return
    }

    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
    const playerRect = createCollisionRectFromCharacter(playerCharacter)
    const expandedPlayerRect = {
      x: playerRect.x - MONSTER_CONTACT_DAMAGE_TOUCH_TOLERANCE_TILES,
      y: playerRect.y - MONSTER_CONTACT_DAMAGE_TOUCH_TOLERANCE_TILES,
      width: playerRect.width + MONSTER_CONTACT_DAMAGE_TOUCH_TOLERANCE_TILES * 2,
      height:
        playerRect.height + MONSTER_CONTACT_DAMAGE_TOUCH_TOLERANCE_TILES * 2
    }

    for (const monsterCharacter of getCharacterStates()) {
      if (!isMonsterCharacter(monsterCharacter)) {
        continue
      }

      const combatState = monsterCombatStates.get(monsterCharacter.id)

      if (
        !combatState ||
        isMonsterDefeated(combatState) ||
        isMonsterFrozen(monsterCharacter.id, now)
      ) {
        continue
      }

      if (
        !doCollisionRectsIntersect(
          expandedPlayerRect,
          createCollisionRectFromCharacter(monsterCharacter)
        )
      ) {
        continue
      }

      const lockedUntil =
        monsterContactDamageLockedUntilById.get(monsterCharacter.id) ?? 0

      if (lockedUntil > now) {
        continue
      }

      if (getPlayerProtectSkillActiveUntilMilliseconds() > now) {
        monsterContactDamageLockedUntilById.set(
          monsterCharacter.id,
          now + MONSTER_CONTACT_DAMAGE_COOLDOWN_MILLISECONDS
        )
        showCharacterDamageText(
          PLAYER_CHARACTER_ID,
          '방어!',
          EVADE_TEXT_DURATION_MILLISECONDS,
          EVADE_TEXT_STYLE
        )
        continue
      }

      monsterContactDamageLockedUntilById.set(
        monsterCharacter.id,
        now + MONSTER_CONTACT_DAMAGE_COOLDOWN_MILLISECONDS
      )
      const didDamagePlayer = applyDamageToPlayer(
        combatState.contactDamage,
        now,
        monsterCharacter
      )

      if (didDamagePlayer) {
        knockbackCharacterAwayFromCharacter(
          PLAYER_CHARACTER_ID,
          monsterCharacter,
          0.18
        )
      }
    }
  }

  return {
    applyDamageToMonster,
    applyDamageToPlayer,
    createPixelCollisionRectFromCharacter,
    getCharacterPixelCenter,
    getMonsterDistanceToPlayer,
    isMonsterCharacter,
    isMonsterCombatStateDefeated,
    isMonsterWithinAttackRange,
    isMonsterWithinRange,
    maybeRespawnMonster,
    maybeRespawnPlayer,
    resolveClosestMonsterInCollisionRect,
    resolveMonsterContactDamage,
    resolveMonstersInCollisionRect,
    resolvePlayerAttackDamage,
    resolvePlayerSmashSkillDamage
  }
}
