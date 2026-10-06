// 몬스터 행동 상태와 연출: 애니메이션 모드, 돼지형 몬스터 행동(추격·피격·공격), 넉백, 좌우 바라보기,
// 플레이어 피격 반동 시작. 맵 화면의 상태는 ctx 로 받는다.
import { AnimatedSprite } from 'pixi.js'
import { PLAYER_CHARACTER_ID } from '../../characterState'
import type { CharacterState } from '../../characterState'
import { isMonsterDefeated, type MonsterCombatState } from '../../monsterCombat'
import type { MonsterAnimationTextures } from '../monsterAnimationTextures'
import { type MonsterBehaviorConfig } from '../monsterCatalog'
import { PLAYER_HIT_REACTION_DURATION_MILLISECONDS, isBossCharacterId } from './constants'
import { getMonsterBehaviorConfig, isStationaryMonster } from './nodes'
import { type MonsterPigAnimationMode, type MonsterPigBehaviorState, type PlayerHitReactionState } from './types'

export type MonsterBehaviorContext = {
  getCharacterStateById: (characterId: string) => CharacterState
  monsterAnimationTexturesByAppearanceType: Map<string, MonsterAnimationTextures>
  monsterCombatStates: Map<string, MonsterCombatState>
  monsterPigAnimatedSprites: Map<string, AnimatedSprite>
  monsterPigAnimationModes: Map<string, MonsterPigAnimationMode>
  monsterPigBehaviorStates: Map<string, MonsterPigBehaviorState>
  syncCharacterSprite: (character: CharacterState, now?: number) => void
  tryMoveCharacter: (characterId: string, deltaX: number, deltaY: number, options?: { preserveFacing?: boolean; ignoreMonsterBlocking?: boolean; cornerAssist?: boolean; }) => boolean
  getCharacterStates: () => CharacterState[]
  setCharacterStates: (value: CharacterState[]) => void
  setPlayerHitReactionState: (value: PlayerHitReactionState | undefined) => void
}

export const createMonsterBehavior = (ctx: MonsterBehaviorContext) => {
  const {
    getCharacterStateById,
    monsterAnimationTexturesByAppearanceType,
    monsterCombatStates,
    monsterPigAnimatedSprites,
    monsterPigAnimationModes,
    monsterPigBehaviorStates,
    syncCharacterSprite,
    tryMoveCharacter,
    getCharacterStates,
    setCharacterStates,
    setPlayerHitReactionState
  } = ctx

  function syncMonsterAnimation(
    characterId: string,
    mode: MonsterPigAnimationMode,
    options: {
      forceRestart?: boolean
    } = {}
  ) {
    const sprite = monsterPigAnimatedSprites.get(characterId)
    const combatState = monsterCombatStates.get(characterId)
    const character = getCharacterStateById(characterId)
    const monsterAnimationTextures =
      monsterAnimationTexturesByAppearanceType.get(character.appearanceType)
    const behaviorConfig = getMonsterBehaviorConfig(character)

    if (
      !sprite ||
      !monsterAnimationTextures ||
      (combatState && isMonsterDefeated(combatState))
    ) {
      return
    }

    const facingKey = character.facing === 'right' ? 'right' : 'left'
    const isRunAnimationEnabled = behaviorConfig.usesRunAnimation
    const resolvedMode =
      mode === 'run' && !isRunAnimationEnabled ? 'idle' : mode
    const nextTextures =
      resolvedMode === 'run'
        ? facingKey === 'right'
          ? monsterAnimationTextures.runRight
          : monsterAnimationTextures.runLeft
        : resolvedMode === 'hit'
          ? facingKey === 'right'
            ? monsterAnimationTextures.hitRight
            : monsterAnimationTextures.hitLeft
          : resolvedMode === 'attack'
            ? facingKey === 'right'
              ? monsterAnimationTextures.attackRight
              : monsterAnimationTextures.attackLeft
            : facingKey === 'right'
              ? monsterAnimationTextures.idleRight
            : monsterAnimationTextures.idleLeft
    const previousMode = monsterPigAnimationModes.get(characterId)
    const currentFrame = sprite.currentFrame

    if (
      !options.forceRestart &&
      previousMode === mode &&
      sprite.textures === nextTextures
    ) {
      return
    }

    monsterPigAnimationModes.set(characterId, mode)
    sprite.textures = nextTextures
    sprite.animationSpeed =
      resolvedMode === 'run'
        ? behaviorConfig.runAnimationSpeed
        : resolvedMode === 'hit'
          ? behaviorConfig.hitAnimationSpeed
          : resolvedMode === 'attack'
            ? behaviorConfig.attackAnimationSpeed
            : behaviorConfig.idleAnimationSpeed
    sprite.loop = resolvedMode === 'idle' || resolvedMode === 'run'
    const shouldPreserveRunPhase =
      resolvedMode === 'run' &&
      isRunAnimationEnabled &&
      previousMode === mode &&
      !options.forceRestart

    sprite.gotoAndPlay(
      shouldPreserveRunPhase
        ? currentFrame % nextTextures.length
        : 0
    )

  }

  function createMonsterPigBehaviorState(): MonsterPigBehaviorState {
    return {
      isAggroed: false,
      nextAttackAtMilliseconds: 0,
      attackUntilMilliseconds: 0,
      hitReactionUntilMilliseconds: 0
    }
  }

  function getMonsterPigBehaviorState(
    characterId: string
  ): MonsterPigBehaviorState {
    const currentBehaviorState = monsterPigBehaviorStates.get(characterId)

    if (currentBehaviorState) {
      return currentBehaviorState
    }

    const nextBehaviorState = createMonsterPigBehaviorState()

    monsterPigBehaviorStates.set(characterId, nextBehaviorState)
    return nextBehaviorState
  }

  function setMonsterPigAggro(
    characterId: string,
    now: number,
    behaviorConfig: MonsterBehaviorConfig
  ): void {
    const currentBehaviorState = getMonsterPigBehaviorState(characterId)

    if (currentBehaviorState.isAggroed) {
      return
    }

    monsterPigBehaviorStates.set(characterId, {
      ...currentBehaviorState,
      isAggroed: true,
      nextAttackAtMilliseconds:
        now + behaviorConfig.attackIntervalMilliseconds
    })
    syncCharacterSprite(getCharacterStateById(characterId), now)
  }

  function setMonsterPigHitReaction(
    characterId: string,
    now: number,
    behaviorConfig: MonsterBehaviorConfig
  ): void {
    const currentBehaviorState = getMonsterPigBehaviorState(characterId)

    monsterPigBehaviorStates.set(characterId, {
      ...currentBehaviorState,
      isAggroed: true,
      // 맞으면 공격이 한 박자 늦춰진다. 보스는 늦추지 않는다 — 계속 때리면 보스가 영영 반격하지 못했다.
      nextAttackAtMilliseconds: isBossCharacterId(characterId)
        ? currentBehaviorState.nextAttackAtMilliseconds
        : Math.max(
            currentBehaviorState.nextAttackAtMilliseconds,
            now + behaviorConfig.attackIntervalMilliseconds
          ),
      attackUntilMilliseconds: 0,
      hitReactionUntilMilliseconds:
        now + behaviorConfig.hitReactionDurationMilliseconds
    })
    syncCharacterSprite(getCharacterStateById(characterId), now)
  }

  function setMonsterPigAttackState(
    characterId: string,
    now: number,
    behaviorConfig: MonsterBehaviorConfig
  ): void {
    const currentBehaviorState = getMonsterPigBehaviorState(characterId)

    monsterPigBehaviorStates.set(characterId, {
      ...currentBehaviorState,
      isAggroed: true,
      attackUntilMilliseconds:
        now + behaviorConfig.attackDurationMilliseconds,
      hitReactionUntilMilliseconds: 0,
      nextAttackAtMilliseconds:
        now + behaviorConfig.attackIntervalMilliseconds
    })
    syncCharacterSprite(getCharacterStateById(characterId), now)
  }

  function getKnockbackDirection(
    targetCharacter: CharacterState,
    sourceCharacter: CharacterState
  ): {
    x: number
    y: number
  } {
    const targetCenterX =
      targetCharacter.position.x + targetCharacter.collisionSize.width / 2
    const targetCenterY =
      targetCharacter.position.y + targetCharacter.collisionSize.height / 2
    const sourceCenterX =
      sourceCharacter.position.x + sourceCharacter.collisionSize.width / 2
    const sourceCenterY =
      sourceCharacter.position.y + sourceCharacter.collisionSize.height / 2
    let deltaX = targetCenterX - sourceCenterX
    let deltaY = targetCenterY - sourceCenterY

    if (deltaX === 0 && deltaY === 0) {
      switch (sourceCharacter.facing) {
        case 'up':
          deltaY = -1
          break
        case 'down':
          deltaY = 1
          break
        case 'left':
          deltaX = -1
          break
        case 'right':
          deltaX = 1
          break
      }
    }

    const distance = Math.hypot(deltaX, deltaY) || 1

    return {
      x: deltaX / distance,
      y: deltaY / distance
    }
  }

  function setPlayerHitReaction(
    sourceCharacter: CharacterState,
    now: number
  ): void {
    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
    const direction = getKnockbackDirection(playerCharacter, sourceCharacter)

    setPlayerHitReactionState({
      directionX: direction.x,
      directionY: direction.y,
      startedAtMilliseconds: now,
      expiresAtMilliseconds: now + PLAYER_HIT_REACTION_DURATION_MILLISECONDS
    })
  }

  function knockbackCharacterAwayFromCharacter(
    targetCharacterId: string,
    sourceCharacter: CharacterState,
    distanceInTiles: number
  ): void {
    const targetCharacter = getCharacterStateById(targetCharacterId)
    // 뿌리박은 제자리 몬스터(식인 꽃 등)는 밀려나지 않는다.
    if (isStationaryMonster(targetCharacter)) {
      return
    }
    const direction = getKnockbackDirection(targetCharacter, sourceCharacter)

    tryMoveCharacter(
      targetCharacterId,
      direction.x * distanceInTiles,
      direction.y * distanceInTiles,
      { preserveFacing: true }
    )
  }

  function faceCharacterHorizontally(characterId: string, deltaX: number): void {
    if (deltaX === 0) {
      return
    }
    const facing: CharacterState['facing'] = deltaX < 0 ? 'left' : 'right'
    setCharacterStates(getCharacterStates().map((character) =>
      character.id === characterId && character.facing !== facing
        ? { ...character, facing }
        : character
    ))
  }

  function knockbackMonsterAwayFromCharacter(
    characterId: string,
    sourceCharacter: CharacterState,
    distanceInTiles: number
  ): void {
    // 보스는 밀려나지 않는다 — 두 배 덩치가 칼 한 번에 뒤로 미끄러지면 가벼워 보인다
    if (isBossCharacterId(characterId)) {
      return
    }
    knockbackCharacterAwayFromCharacter(
      characterId,
      sourceCharacter,
      distanceInTiles
    )
  }

  return {
    createMonsterPigBehaviorState,
    faceCharacterHorizontally,
    getMonsterPigBehaviorState,
    knockbackCharacterAwayFromCharacter,
    knockbackMonsterAwayFromCharacter,
    setMonsterPigAggro,
    setMonsterPigAttackState,
    setMonsterPigHitReaction,
    setPlayerHitReaction,
    syncMonsterAnimation
  }
}
