// 매 프레임 갱신: Lua 컨트롤러 이벤트 받기, 플레이어·몬스터 이동과 행동, 피해·드롭·보스·환경 처리,
// 상호작용 이벤트 처리, 스프라이트·이름표·카메라 맞추기. 맵 화면의 상태는 ctx 로 받는다.
import type { QuestLogState } from '../../questLog'
import type { PlayerProfile } from '../../playerProfile'
import type { PlayerInventory } from '../../playerInventory'
import type { PlayerEquipment } from '../../playerEquipment'
import type { ParsedTiledMap } from '../../tiled/parseTiledMap'
import type { NpcDialogueOverlay } from '../createNpcDialogueOverlay'
import type { MonsterBehaviorConfig } from '../monsterCatalog'
import type { GameSoundEffects } from '../createGameSoundEffects'
import type { GameEventQueue } from '../../events/createGameEventQueue'
import type { GameEvent } from '../../events/createGameEventQueue'
import type { CompleteQuestResult } from '../../questLog'
import type { CharacterControllerRuntime } from '../../createCharacterControllerRuntime'
import type { BossSkillKind } from '../../bossSkills'
import { Application } from 'pixi.js'
import { PLAYER_CHARACTER_ID } from '../../characterState'
import type { CharacterAction, CharacterMoveDirection, CharacterState } from '../../characterState'
import { processInteractionEvents } from '../../interaction/processInteractionEvents'
import { completeQuest, recordQuestObjectiveProgress, startQuest } from '../../questLog'
import {
  createMonsterPatrolState,
  stepMonsterPatrol,
  BOSS_PATROL_RADIUS_TILES,
  type MonsterPatrolState
} from '../../monsterPatrol'
import { type MonsterCombatState } from '../../monsterCombat'
import { buildLuaRuntimeSnapshot } from '../../lua/buildLuaRuntimeSnapshot'
import type { MonsterAnimationTextures } from '../monsterAnimationTextures'
import { getMonsterCatalogEntry } from '../monsterCatalog'
import { isGameSoundEffectId } from '../createGameSoundEffects'
import { BLACKSMITH_SHOP_NPC_ID, HERBALIST_SHOP_NPC_IDS, POTION_SHOP_NPC_IDS, isBossCharacterId } from './constants'
import { getMonsterBehaviorConfig, isStationaryMonster } from './nodes'
import { type MonsterPigAnimationMode, type MonsterPigBehaviorState, type SceneTransitionRequest } from './types'

export type FrameUpdateContext = {
  app: Application
  applyDamageToPlayer: (damage: number, now: number, sourceCharacter?: CharacterState) => boolean
  applyNpcConfigUpdate: (characterId: string, key: string, value: string) => void
  bossSkillReadyAtById: Map<string, Partial<Record<BossSkillKind, number>>>
  clearPressedInputState: () => void
  controllerRuntime: CharacterControllerRuntime
  faceCharacterHorizontally: (characterId: string, deltaX: number) => void
  gameEventQueue: GameEventQueue
  gameSoundEffects: GameSoundEffects
  getCharacterStateById: (characterId: string) => CharacterState
  getMonsterDistanceToPlayer: (character: CharacterState) => number
  getMonsterPigBehaviorState: (characterId: string) => MonsterPigBehaviorState
  getNpcDialoguePortrait: (characterId: string) => { portraitUrl: string; pixelArtPortrait: boolean; }
  grantInventoryItem: (itemId: string, quantity: number) => void
  grantQuestCompletionRewards: (result: CompleteQuestResult) => void
  handleQuestInteractionEvents: (events: GameEvent[], now: number) => GameEvent[]
  handleScenarioInteractionEvents: (events: GameEvent[], now: number) => GameEvent[]
  handleWaystoneInteractionEvents: (events: GameEvent[], now: number) => GameEvent[]
  hideCharacterMessage: (characterId: string) => void
  interactionLockUntilByCharacterPair: Map<string, number>
  isMonsterCharacter: (character: CharacterState) => boolean
  isMonsterCombatStateDefeated: (characterId: string) => boolean
  isMonsterFrozen: (monsterId: string, now: number) => boolean
  isMonsterWithinAttackRange: (monsterCharacter: CharacterState, playerCharacter: CharacterState, behaviorConfig: MonsterBehaviorConfig) => boolean
  isMonsterWithinRange: (character: CharacterState, tiles: number) => boolean
  isPlayerCasting: (now: number) => boolean
  isPlayerRolling: (now: number) => boolean
  knockbackCharacterAwayFromCharacter: (targetCharacterId: string, sourceCharacter: CharacterState, distanceInTiles: number) => void
  map: ParsedTiledMap
  maybeRespawnMonster: (characterId: string, now: number) => boolean
  maybeRespawnPlayer: (now: number) => boolean
  monsterAnimationTexturesByAppearanceType: Map<string, MonsterAnimationTextures>
  monsterCombatStates: Map<string, MonsterCombatState>
  monsterContactDamageLockedUntilById: Map<string, number>
  monsterPatrolStates: Map<string, MonsterPatrolState>
  monsterPigBehaviorStates: Map<string, MonsterPigBehaviorState>
  npcDialogueOverlay: NpcDialogueOverlay
  onRequestSceneChange: (request: SceneTransitionRequest) => void
  playerProfile: PlayerProfile
  pressedDirections: Set<CharacterMoveDirection>
  pruneExpiredCharacterDamageTexts: (now: number) => void
  pruneExpiredCharacterMessages: (now: number) => void
  removeInventoryItem: (itemId: string, quantity: number) => void
  resolveBlizzardDamage: (now: number) => void
  resolveCoinPilePickups: () => void
  resolveMonsterContactDamage: (now: number) => void
  resolveMonsterEquipmentDropPickups: () => void
  resolveMonsterGoldDropPickups: () => void
  resolvePlayerAttackDamage: (now: number) => void
  updatePlayerWeaponSkills: (now: number) => void
  resolvePlayerSmashSkillDamage: (now: number) => void
  resolvePoisonFogDamage: (now: number) => void
  sceneId: string
  setBlacksmithShopOpen: (nextIsOpen: boolean) => void
  setHerbalistShopOpen: (nextIsOpen: boolean) => void
  setMonsterPigAggro: (characterId: string, now: number, behaviorConfig: MonsterBehaviorConfig) => void
  setMonsterPigAttackState: (characterId: string, now: number, behaviorConfig: MonsterBehaviorConfig) => void
  setPotionShopOpen: (nextIsOpen: boolean) => void
  setQuestLog: (nextQuestLog: QuestLogState) => void
  showCharacterMessage: (characterId: string, message: string, durationMilliseconds: number) => void
  stepPlayerRoll: (now: number) => boolean
  stopPlayerFootsteps: () => void
  syncActiveCharacterDamageTexts: (now: number) => void
  syncActiveCharacterMessages: () => void
  syncActiveMonsterEquipmentDrops: (now: number) => void
  syncActiveMonsterGoldDrops: (now: number) => void
  syncCharacterLabelLayers: () => void
  syncMonsterAnimation: (characterId: string, mode: MonsterPigAnimationMode, options?: { forceRestart?: boolean; }) => void
  syncPlayerFootsteps: (didPlayerMove: boolean) => void
  syncQuestNpcBadges: () => void
  syncRuntimeWarningBanner: () => void
  triggerPlayerAttack: (now: number) => void
  triggerPlayerSkillFromSlotIndex: (skillSlotIndex: number, now: number) => void
  triggeredActions: Set<CharacterAction>
  triggeredSkillSlotIndexes: Set<number>
  tryMoveCharacter: (characterId: string, deltaX: number, deltaY: number, options?: { preserveFacing?: boolean; ignoreMonsterBlocking?: boolean; cornerAssist?: boolean; }) => boolean
  tryUseBossSkill: (boss: CharacterState, bossCenter: { x: number; y: number; }, playerCenter: { x: number; y: number; }, distance: number, now: number) => boolean
  updateBossFlashes: (now: number) => void
  updateBossHazards: (now: number) => void
  updateBossTonguePull: (now: number) => void
  updateMapLights: (now: number) => void
  updateMonsterMagicStatuses: (now: number) => void
  updatePlayerMagicCast: (now: number) => void
  updatePlayerProjectiles: (now: number, deltaMilliseconds: number) => void
  getBossHealthOverlay: () => { syncFrame: () => void; destroy: () => void; }
  getCharacterStates: () => CharacterState[]
  getCurrentPlayerEquipment: () => PlayerEquipment
  getCurrentPlayerInventory: () => PlayerInventory
  getCurrentQuestLog: () => QuestLogState
  getIsPauseMenuOpen: () => boolean
  getIsSceneTransitionPending: () => boolean
  getStatusEffectsOverlay: () => { syncFrame: () => void; destroy: () => void; }
  getSyncPlayerCharacterVisual: () => (nowMilliseconds?: number) => void
  getLastPushedSnapshotJson: () => string
  getLastRuntimeErrorMessage: () => string | undefined
  setLastPushedSnapshotJson: (value: string) => void
  setLastRuntimeErrorMessage: (value: string | undefined) => void
}

export const createFrameUpdate = (ctx: FrameUpdateContext) => {
  const {
    app,
    applyDamageToPlayer,
    applyNpcConfigUpdate,
    bossSkillReadyAtById,
    clearPressedInputState,
    controllerRuntime,
    faceCharacterHorizontally,
    gameEventQueue,
    gameSoundEffects,
    getCharacterStateById,
    getMonsterDistanceToPlayer,
    getMonsterPigBehaviorState,
    getNpcDialoguePortrait,
    grantInventoryItem,
    grantQuestCompletionRewards,
    handleQuestInteractionEvents,
    handleScenarioInteractionEvents,
    handleWaystoneInteractionEvents,
    hideCharacterMessage,
    interactionLockUntilByCharacterPair,
    isMonsterCharacter,
    isMonsterCombatStateDefeated,
    isMonsterFrozen,
    isMonsterWithinAttackRange,
    isMonsterWithinRange,
    isPlayerCasting,
    isPlayerRolling,
    knockbackCharacterAwayFromCharacter,
    map,
    maybeRespawnMonster,
    maybeRespawnPlayer,
    monsterAnimationTexturesByAppearanceType,
    monsterCombatStates,
    monsterContactDamageLockedUntilById,
    monsterPatrolStates,
    monsterPigBehaviorStates,
    npcDialogueOverlay,
    onRequestSceneChange,
    playerProfile,
    pressedDirections,
    pruneExpiredCharacterDamageTexts,
    pruneExpiredCharacterMessages,
    removeInventoryItem,
    resolveBlizzardDamage,
    resolveCoinPilePickups,
    resolveMonsterContactDamage,
    resolveMonsterEquipmentDropPickups,
    resolveMonsterGoldDropPickups,
    resolvePlayerAttackDamage,
    updatePlayerWeaponSkills,
    resolvePlayerSmashSkillDamage,
    resolvePoisonFogDamage,
    sceneId,
    setBlacksmithShopOpen,
    setHerbalistShopOpen,
    setMonsterPigAggro,
    setMonsterPigAttackState,
    setPotionShopOpen,
    setQuestLog,
    showCharacterMessage,
    stepPlayerRoll,
    stopPlayerFootsteps,
    syncActiveCharacterDamageTexts,
    syncActiveCharacterMessages,
    syncActiveMonsterEquipmentDrops,
    syncActiveMonsterGoldDrops,
    syncCharacterLabelLayers,
    syncMonsterAnimation,
    syncPlayerFootsteps,
    syncQuestNpcBadges,
    syncRuntimeWarningBanner,
    triggerPlayerAttack,
    triggerPlayerSkillFromSlotIndex,
    triggeredActions,
    triggeredSkillSlotIndexes,
    tryMoveCharacter,
    tryUseBossSkill,
    updateBossFlashes,
    updateBossHazards,
    updateBossTonguePull,
    updateMapLights,
    updateMonsterMagicStatuses,
    updatePlayerMagicCast,
    updatePlayerProjectiles,
    getBossHealthOverlay,
    getCharacterStates,
    getCurrentPlayerEquipment,
    getCurrentPlayerInventory,
    getCurrentQuestLog,
    getIsPauseMenuOpen,
    getIsSceneTransitionPending,
    getStatusEffectsOverlay,
    getSyncPlayerCharacterVisual,
    getLastPushedSnapshotJson,
    getLastRuntimeErrorMessage,
    setLastPushedSnapshotJson,
    setLastRuntimeErrorMessage
  } = ctx

  const drainControllerRuntimeEventsIntoQueue = () => {
    for (const event of controllerRuntime.drainEvents()) {
      gameEventQueue.enqueue(event)
    }
  }

  const updateCharacters = () => {
    try {
      const now = performance.now()

      if (getIsPauseMenuOpen()) {
        clearPressedInputState()
        stopPlayerFootsteps()
        triggeredActions.clear()
        triggeredSkillSlotIndexes.clear()
            setLastRuntimeErrorMessage(undefined)
        return
      }

      controllerRuntime.syncCharacters(getCharacterStates())
      drainControllerRuntimeEventsIntoQueue()
      maybeRespawnPlayer(now)
      for (const skillSlotIndex of triggeredSkillSlotIndexes) {
        triggerPlayerSkillFromSlotIndex(skillSlotIndex, now)
      }
      triggeredSkillSlotIndexes.clear()

      let didPlayerMoveThisFrame = stepPlayerRoll(now)

      for (const character of [...getCharacterStates()]) {
        if (character.id === PLAYER_CHARACTER_ID && playerProfile.hp.current === 0) {
          continue
        }

        if (character.id === PLAYER_CHARACTER_ID && isPlayerRolling(now)) {
          continue
        }

        // 시전 준비 중엔 제자리, 얼어붙은 몬스터는 이동·공격하지 않는다.
        if (
          character.id === PLAYER_CHARACTER_ID &&
          (isPlayerCasting(now) || npcDialogueOverlay.isOpen())
        ) {
          continue
        }

        // 대화 중에는 몬스터도 멈춘다(플레이어가 묶인 채 맞지 않게).
        if (
          isMonsterCharacter(character) &&
          (isMonsterFrozen(character.id, now) || npcDialogueOverlay.isOpen())
        ) {
          continue
        }

        const intent = controllerRuntime.getIntent({
          character,
          deltaMilliseconds: app.ticker.deltaMS,
          pressedDirections,
          triggeredActions
        })

        if (intent) {
          if (intent.movement && !isStationaryMonster(character)) {
            // 코너 어시스트는 플레이어 조작 이동에만 — 몬스터가 한 칸 길목을
            // 통과하게 되면 난이도가 바뀌고, 구르기·넉백은 각자 고유 규칙이 있다.
            const didMove = tryMoveCharacter(
              character.id,
              intent.movement.x,
              intent.movement.y,
              character.id === PLAYER_CHARACTER_ID ? { cornerAssist: true } : {}
            )

            if (character.id === PLAYER_CHARACTER_ID && didMove) {
              didPlayerMoveThisFrame = true
            }
          }

          if (getIsSceneTransitionPending()) {
            stopPlayerFootsteps()
            return
          }

          drainControllerRuntimeEventsIntoQueue()

          if (intent.actions?.includes('interact')) {
            gameEventQueue.enqueue({
              kind: 'interaction-requested',
              sourceCharacterId: character.id
            })
          }

          if (
            intent.actions?.includes('attack') &&
            character.id === PLAYER_CHARACTER_ID
          ) {
            triggerPlayerAttack(now)
          }

        }

        if (
          character.appearanceType.startsWith('monster_') &&
          monsterAnimationTexturesByAppearanceType.get(character.appearanceType)
        ) {
          if (maybeRespawnMonster(character.id, now)) {
            continue
          }

          if (isMonsterCombatStateDefeated(character.id)) {
            continue
          }

          const monsterCharacter = getCharacterStateById(character.id)
          const monsterBehaviorConfig =
            getMonsterBehaviorConfig(monsterCharacter)
          let behaviorState = getMonsterPigBehaviorState(character.id)
          const monsterDistanceToPlayer =
            getMonsterDistanceToPlayer(monsterCharacter)

          if (
            behaviorState.isAggroed &&
            monsterDistanceToPlayer > monsterBehaviorConfig.deAggroRangeTiles
          ) {
            monsterPigBehaviorStates.set(character.id, {
              ...behaviorState,
              isAggroed: false,
              nextAttackAtMilliseconds: 0,
              attackUntilMilliseconds: 0,
              hitReactionUntilMilliseconds: 0
            })
            behaviorState = getMonsterPigBehaviorState(character.id)
            bossSkillReadyAtById.delete(character.id)
            syncMonsterAnimation(character.id, 'idle', {
              forceRestart: true
            })
          }

          if (behaviorState.hitReactionUntilMilliseconds > now) {
            syncMonsterAnimation(character.id, 'hit')
            continue
          }

          if (behaviorState.attackUntilMilliseconds > now) {
            syncMonsterAnimation(character.id, 'attack')
            continue
          }

          if (
            !behaviorState.isAggroed &&
            isMonsterWithinRange(
              monsterCharacter,
              monsterBehaviorConfig.aggroRangeTiles
            )
          ) {
            setMonsterPigAggro(character.id, now, monsterBehaviorConfig)
            behaviorState = getMonsterPigBehaviorState(character.id)
          }

          if (behaviorState.isAggroed) {
            const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
            const monsterCenterX =
              monsterCharacter.position.x +
              monsterCharacter.collisionSize.width / 2
            const monsterCenterY =
              monsterCharacter.position.y +
              monsterCharacter.collisionSize.height / 2
            const playerCenterX =
              playerCharacter.position.x +
              playerCharacter.collisionSize.width / 2
            const playerCenterY =
              playerCharacter.position.y + playerCharacter.collisionSize.height / 2
            const deltaX = playerCenterX - monsterCenterX
            const deltaY = playerCenterY - monsterCenterY
            const distance = Math.hypot(deltaX, deltaY)

            if (
              isBossCharacterId(character.id) &&
              tryUseBossSkill(
                monsterCharacter,
                { x: monsterCenterX, y: monsterCenterY },
                { x: playerCenterX, y: playerCenterY },
                distance,
                now
              )
            ) {
              faceCharacterHorizontally(character.id, deltaX)
              setMonsterPigAttackState(character.id, now, monsterBehaviorConfig)
              syncMonsterAnimation(character.id, 'attack')
              continue
            }

            if (
              behaviorState.nextAttackAtMilliseconds <= now &&
              isMonsterWithinAttackRange(
                monsterCharacter,
                playerCharacter,
                monsterBehaviorConfig
              )
            ) {
              const combatState = monsterCombatStates.get(character.id)

              if (combatState) {
                setMonsterPigAttackState(
                  character.id,
                  now,
                  monsterBehaviorConfig
                )
                const attackSound = getMonsterCatalogEntry(
                  monsterCharacter.appearanceType
                )?.sounds?.attack
                if (attackSound) {
                  gameSoundEffects.play(attackSound)
                }
                monsterContactDamageLockedUntilById.set(
                  character.id,
                  now + monsterBehaviorConfig.attackDurationMilliseconds
                )
                const didDamagePlayer = applyDamageToPlayer(
                  Math.max(1, combatState.contactDamage + 1),
                  now,
                  monsterCharacter
                )

                if (didDamagePlayer) {
                  knockbackCharacterAwayFromCharacter(
                    PLAYER_CHARACTER_ID,
                    monsterCharacter,
                    0.12
                  )
                }
                syncMonsterAnimation(character.id, 'attack')
                continue
              }
            }

            if (monsterBehaviorConfig.stationary) {
              // 제자리 몬스터: 움직이지 않고 플레이어 쪽(왼/오른)을 바라본다.
              faceCharacterHorizontally(character.id, deltaX)
            } else if (distance > 0) {
              const stepDistance =
                (monsterBehaviorConfig.chaseSpeedTilesPerSecond *
                  app.ticker.deltaMS) /
                1000

              tryMoveCharacter(
                character.id,
                (deltaX / distance) * stepDistance,
                (deltaY / distance) * stepDistance
              )
            }

            syncMonsterAnimation(character.id, 'run')
            continue
          }

          if (monsterBehaviorConfig.stationary) {
            syncMonsterAnimation(character.id, 'idle')
            continue
          }

          const patrolState =
            monsterPatrolStates.get(character.id) ??
            createMonsterPatrolState(monsterCharacter)
          const nextPatrolStep = stepMonsterPatrol({
            character: monsterCharacter,
            patrolState,
            deltaMilliseconds: app.ticker.deltaMS,
            nowMilliseconds: now,
            mapWidth: map.width,
            mapHeight: map.height,
            speedTilesPerSecond: monsterBehaviorConfig.patrolSpeedTilesPerSecond,
            radiusInTiles: isBossCharacterId(character.id) ? BOSS_PATROL_RADIUS_TILES : undefined,
            random: Math.random
          })

          monsterPatrolStates.set(character.id, nextPatrolStep.patrolState)

          if (nextPatrolStep.movement) {
            tryMoveCharacter(
              character.id,
              nextPatrolStep.movement.x,
              nextPatrolStep.movement.y
            )
            syncMonsterAnimation(character.id, 'run')
          } else {
            syncMonsterAnimation(character.id, 'idle')
          }
        }
      }

      resolvePlayerAttackDamage(now)
      resolvePlayerSmashSkillDamage(now)
      updatePlayerMagicCast(now)
      updateMonsterMagicStatuses(now)
      updatePlayerWeaponSkills(now)
      updatePlayerProjectiles(now, app.ticker.deltaMS)
      if (!npcDialogueOverlay.isOpen()) {
        resolveMonsterContactDamage(now)
        resolvePoisonFogDamage(now)
        resolveBlizzardDamage(now)
        updateBossHazards(now)
        updateBossTonguePull(now)
      }
      getStatusEffectsOverlay().syncFrame()
      getBossHealthOverlay().syncFrame()
      updateBossFlashes(now)
      updateMapLights(now)
      resolveMonsterGoldDropPickups()
      resolveMonsterEquipmentDropPickups()
      resolveCoinPilePickups()
      syncActiveMonsterGoldDrops(now)
      syncActiveMonsterEquipmentDrops(now)

      // Phase 2 읽기 채널: 게임의 권위 있는 상태를 Lua 가 읽도록(변경 시에만) 밀어넣는다.
      const runtimeSnapshot = buildLuaRuntimeSnapshot({
        questLog: getCurrentQuestLog(),
        inventory: getCurrentPlayerInventory(),
        equipment: getCurrentPlayerEquipment(),
        profile: playerProfile,
        sceneId
      })
      const runtimeSnapshotJson = JSON.stringify(runtimeSnapshot)
      if (runtimeSnapshotJson !== getLastPushedSnapshotJson()) {
        controllerRuntime.pushSnapshot(runtimeSnapshot)
        setLastPushedSnapshotJson(runtimeSnapshotJson)
      }

      const interactionEvents = handleQuestInteractionEvents(
        handleWaystoneInteractionEvents(
          handleScenarioInteractionEvents(gameEventQueue.drain(), now),
          now
        ),
        now
      )

      const emittedEvents = processInteractionEvents({
        events: interactionEvents,
        characters: getCharacterStates(),
        controllerRuntime,
        now,
        interactionLockUntilByCharacterPair
      })

      for (const event of emittedEvents) {
        // Phase 3 쓰기 채널: Lua 가 요청한 액션을 기존 순수 reducer 로 적용한다(Lua=요청, TS=적용).
        if (event.kind === 'request-quest-start') {
          setQuestLog(startQuest(getCurrentQuestLog(), event.questId))
          continue
        }
        if (event.kind === 'request-quest-progress') {
          setQuestLog(
            recordQuestObjectiveProgress(
              getCurrentQuestLog(),
              event.questId,
              event.objectiveId,
              event.amount
            )
          )
          continue
        }
        if (event.kind === 'request-quest-complete') {
          const completion = completeQuest(getCurrentQuestLog(), event.questId)
          setQuestLog(completion.nextQuestLog)
          grantQuestCompletionRewards(completion)
          continue
        }
        if (event.kind === 'request-inventory-add') {
          grantInventoryItem(event.itemId, event.quantity)
          continue
        }
        if (event.kind === 'request-inventory-remove') {
          removeInventoryItem(event.itemId, event.quantity)
          continue
        }
        if (event.kind === 'set-config') {
          applyNpcConfigUpdate(event.characterId, event.key, event.value)
          continue
        }
        if (event.kind === 'request-scene-transition') {
          onRequestSceneChange({
            sceneId: event.sceneId,
            spawn: { x: event.x, y: event.y }
          })
          continue
        }
        if (event.kind === 'play-sound') {
          if (isGameSoundEffectId(event.soundId)) {
            gameSoundEffects.play(event.soundId)
          }
          continue
        }

        if (event.kind === 'show-npc-dialogue') {
          // Lua 컨트롤러(vn-dialogue)가 요청한 비주얼노벨 대화창. 대사는 Lua 가 보내고,
          // 초상화/이름은 캐릭터에서 채운다. 대화가 다 끝나면 해당 NPC 의 상점을 연다.
          hideCharacterMessage(event.characterId)
          if (!npcDialogueOverlay.isOpen()) {
            const portraitCharacter = getCharacterStateById(event.characterId)
            const openShopOnComplete =
              event.characterId === BLACKSMITH_SHOP_NPC_ID
                ? () => setBlacksmithShopOpen(true)
                : POTION_SHOP_NPC_IDS.has(event.characterId)
                  ? () => setPotionShopOpen(true)
                  : HERBALIST_SHOP_NPC_IDS.has(event.characterId)
                    ? () => setHerbalistShopOpen(true)
                    : undefined
            npcDialogueOverlay.show({
              ...getNpcDialoguePortrait(event.characterId),
              name: portraitCharacter.displayText ?? '',
              lines: event.lines,
              onComplete: openShopOnComplete
            })
          }
          continue
        }

        if (event.kind !== 'show-character-message') {
          continue
        }

        showCharacterMessage(
          event.characterId,
          event.message,
          event.durationMilliseconds
        )

        if (
          event.message === '!' &&
          getCharacterStateById(event.characterId).appearanceType.startsWith(
            'monster_'
          )
        ) {
          setMonsterPigAggro(
            event.characterId,
            now,
            getMonsterBehaviorConfig(getCharacterStateById(event.characterId))
          )
        }

      }

      pruneExpiredCharacterMessages(now)
      pruneExpiredCharacterDamageTexts(now)
      syncActiveCharacterMessages()
      syncActiveCharacterDamageTexts(now)
      getSyncPlayerCharacterVisual()(now)
      syncCharacterLabelLayers()
      syncQuestNpcBadges()
      syncPlayerFootsteps(didPlayerMoveThisFrame)
      triggeredActions.clear()
      setLastRuntimeErrorMessage(undefined)
    } catch (error) {
      stopPlayerFootsteps()
      gameEventQueue.clear()
      triggeredActions.clear()
      triggeredSkillSlotIndexes.clear()

      const message = error instanceof Error ? error.message : String(error)

      if (message !== getLastRuntimeErrorMessage()) {
        console.error('Runtime update failed.', error)
        setLastRuntimeErrorMessage(message)
      }
    } finally {
      syncRuntimeWarningBanner()
    }
  }

  return {
    updateCharacters
  }
}
