import {
  Application,
  AnimatedSprite,
  Container,
  Sprite,
  Texture,
  UPDATE_PRIORITY
} from 'pixi.js'
import { loadTextureSafe } from './loadTextureSafe'
import {
  getLpcPlayerAttackAnimation,
  getLpcPlayerLayerFiles,
  createLpcSheetCache,
  getLpcNpcSheetKey,
  loadLpcArrowTexture,
  loadLpcNpcSheets,
  type LpcAnimationName,
  type LpcPlayerLook
} from './lpcCharacterSprites'
import { loadPlacementsForMap, type PlacementTemplate } from '../../../editor/placementStore'
import { type NpcWireTemplate } from '../../../editor/npcStore'
import { PLAYER_CHARACTER_ID } from '../characterState'
import type { CharacterAction, CharacterMoveDirection, CharacterState } from '../characterState'
import { createGameEventQueue } from '../events/createGameEventQueue'
import type { HolidayDialogueEventSpec } from '../eventGeneration'
import { getEquippedPlayerWeaponAttackKind } from '../playerEquipment'
import { type PlayerRollState } from '../playerRoll'
import { type PlayerControlBindingId } from '../playerControls'
import { getAllQuestDefinitions, getQuestProgress } from '../questLog'
import { createLuaPlayerStatEffects } from '../playerStatEffectsLua'
import { type MonsterPatrolState } from '../monsterPatrol'
import { type MonsterCombatState } from '../monsterCombat'
import { createLuaMonsterCombat } from '../monsterCombatLua'
import { createLuaMonsterRewards } from '../monsterRewardsLua'
import { createLuaBlacksmithPricing } from '../blacksmithShopLua'
import { getPlayerControlQuickslotIndexFromCode } from '../lua/luaGameLogic'
import { createMapPortalsFromEventLayers } from '../tiled/createMapPortalsFromEventLayers'
import { createWallTileLookup } from '../tiled/createWallTileLookup'
import { createTileTexture, type TilesetRenderResources } from './tiledMapRenderResources'
import { createMapOverlay } from './createMapOverlay'
import { createNpcDialogueOverlay } from './createNpcDialogueOverlay'
import type { MonsterAnimationTextures } from './monsterAnimationTextures'
import {
  BOSS_DAMAGE_MULTIPLIER,
  BOSS_RENDER_SCALE_MULTIPLIER,
  MONSTER_HP_MULTIPLIER,
  getBossHpMultiplier
} from '../monsterTuning'
import { loadLpcMonsterTextures } from './loadLpcMonsterTextures'
import { MONSTER_CATALOG } from './monsterCatalog'
import { createGameSoundEffects } from './createGameSoundEffects'
import { type AudioSettings } from './createPauseMenuOverlay'
import { createBossEncounter } from './mapView/bossEncounter'
import { createFrameUpdate } from './mapView/frameUpdate'
import { createInputHandlers } from './mapView/inputHandlers'
import { createOverlayControls } from './mapView/overlayControls'
import { createSceneTransitions } from './mapView/sceneTransitions'
import { createUiState } from './mapView/uiState'
import { createUiOverlays } from './mapView/uiOverlays'
import { createPlayerRewards } from './mapView/playerRewards'
import { createEnvironmentHazards } from './mapView/environmentHazards'
import { createPlayerActions } from './mapView/playerActions'
import { createCharacterNodes } from './mapView/characterNodes'
import { createPlayerGearVisuals } from './mapView/playerGearVisuals'
import { createMovement } from './mapView/movement'
import { createCombat } from './mapView/combat'
import { createMonsterBehavior } from './mapView/monsterBehavior'
import { createEditorEventApply } from './mapView/editorEventApply'
import { createNpcInteractions } from './mapView/npcInteractions'
import { createCharacterSprites } from './mapView/characterSprites'
import { createPlayerCombatEffects } from './mapView/playerCombatEffects'
import { createCharacterMessages } from './mapView/characterMessages'
import { createCharacterDamageTexts } from './mapView/characterDamageTexts'
import { createMonsterDrops } from './mapView/monsterDrops'
import { createEditorPlacement } from './mapView/editorPlacement'
import { createMapTileLayers } from './mapView/tileLayers'
import { createMapLightLayer } from './mapView/mapLightLayer'
import { BLIZZARD_MOVE_SPEED_MULTIPLIER } from '../poisonFog'
import { isBossSummonCharacterId } from '../bossSkills'
import { createWindowStack } from './createWindowStack'
import {
  CAMERA_DEFAULT_ZOOM,
  GAME_VIEWPORT_HEIGHT,
  GAME_VIEWPORT_WIDTH,
  MONSTER_EQUIPMENT_DROP_IMAGE_URL_BY_DROP_ID,
  PLAYER_ATTACK_COOLDOWN_MILLISECONDS,
  PLAYER_ATTACK_DURATION_MILLISECONDS,
  PLAYER_EQUIPMENT_APPEARANCE_CONFIG_BY_ITEM_ID,
  PLAYER_WEAPON_APPEARANCE_CONFIG_BY_ITEM_ID,
  PLAYER_WEAPON_TILE_FRAME_SOURCE,
  PLAYER_WEAPON_TILE_LOCAL_ID,
  PORTAL_INSIDE_IMAGE_URL,
  SCENE_INTRO_VISIBLE_DURATION_MILLISECONDS,
  TINY_DUNGEON_TILESET_IMAGE_URL,
  isBossCharacterId
} from './mapView/constants'
import {
  createMessagePanelTexture,
  ensureMessageFontsLoaded,
  loadProtectVfxTextures,
  loadSlashVfxTextures,
  loadTilesetRenderResources
} from './mapView/resources'
import { clampCameraZoom, createGrassTileLookup, resolveTilesetLocalIdByType } from './mapView/tiles'
import {
  type ActiveCharacterDamageText,
  type ActiveCharacterMessage,
  type ApplyEventDraftInput,
  type ApplyEventDraftResult,
  type CreatePixiTiledMapViewInput,
  type MonsterEquipmentDrop,
  type MonsterGoldDrop,
  type MonsterPigAnimationMode,
  type MonsterPigBehaviorState,
  type PlayerHitReactionState,
  type PlayerRollInputState,
  type RenderedCharacterNode,
  type RenderedPortalNode
} from './mapView/types'
export type { SceneTransitionRequest, ApplyEventDraftResult } from './mapView/types'

export const createPixiTiledMapView = async ({
  mountElement,
  map,
  characters,
  playerProfile,
  playerEquipment,
  playerInventory,
  playerQuickslots,
  playerSkillSlots,
  playerControlBindings,
  questLog,
  merchantInventory,
  potionMerchantInventory,
  herbalistInventory,
  getPoisonFogImmuneUntil,
  onPoisonFogImmuneUntilChange,
  getColdImmuneUntil,
  onColdImmuneUntilChange,
  sceneId,
  sceneIntroMessage,
  cameraTargetCharacterId,
  characterSpriteSheet,
  imageUrls,
  controllerRuntime,
  onPlayerInventoryChange,
  onPlayerEquipmentChange,
  onPlayerQuickslotsChange,
  onPlayerSkillSlotsChange,
  onPlayerControlBindingsChange,
  onQuestLogChange,
  collectedCoinTileKeys,
  onCoinPileCollected,
  defeatedBossIds,
  onBossDefeated,
  getDiscoveredWaystoneIds,
  onWaystoneDiscovered,
  onMerchantInventoryChange,
  onPotionMerchantInventoryChange,
  onHerbalistInventoryChange,
  audioSettings,
  onAudioSettingsChange,
  onRequestSceneChange
}: CreatePixiTiledMapViewInput): Promise<{
  destroy: () => void
  updateAudioSettings: (nextAudioSettings: AudioSettings) => void
  applyEventDraft: (
    draft: HolidayDialogueEventSpec,
    input?: ApplyEventDraftInput
  ) => ApplyEventDraftResult
  applyLuaScript: (input: {
    targetCharacterId: string
    source: string
  }) => ApplyEventDraftResult
  setPlacementMode: (mode: 'off' | 'place' | 'erase') => void
  setPlacementTemplate: (
    template: PlacementTemplate | NpcWireTemplate | null
  ) => void
  refreshPlacements: () => void
  refreshNpcs: () => void
  // 에디터가 자연어로 생성한 NPC를 실행 중인 게임의 플레이어 옆에 라이브 스폰한다.
  spawnNpcNearPlayer: (template: {
    appearanceType: string
    name?: string
    dialogueLines?: string[]
  }) => boolean
}> => {
  const app = new Application()
  let cameraZoom = CAMERA_DEFAULT_ZOOM
  let scaledMapPixelWidth = Math.round(map.pixelWidth * cameraZoom)
  let scaledMapPixelHeight = Math.round(map.pixelHeight * cameraZoom)
  const [
    portalInsideTexture,
    tinyDungeonWeaponImageTexture,
    slashVfxTextures,
    protectVfxTextures,
    catalogMonsterAnimationTextures
  ] = await Promise.all([
    loadTextureSafe(PORTAL_INSIDE_IMAGE_URL),
    loadTextureSafe(TINY_DUNGEON_TILESET_IMAGE_URL),
    loadSlashVfxTextures(),
    loadProtectVfxTextures(),
    // LPC 몬스터(그림체 통일): 종류 목록은 monsterCatalog.ts, 출처는 assets/monsters/lpc/CREDITS.txt
    Promise.all(MONSTER_CATALOG.map((entry) => loadLpcMonsterTextures(entry.spec)))
  ])
  const playerWeaponAppearanceTexturesByItemId = new Map(
    await Promise.all(
      Object.entries(PLAYER_WEAPON_APPEARANCE_CONFIG_BY_ITEM_ID).map(
        async ([itemId, config]) => [
          itemId,
          await loadTextureSafe(config.imageUrl)
        ] as const
      )
    )
  )
  const monsterEquipmentDropTexturesByDropId = new Map(
    await Promise.all(
      Object.entries(MONSTER_EQUIPMENT_DROP_IMAGE_URL_BY_DROP_ID).map(
        async ([dropId, imageUrl]) => [
          dropId,
          await loadTextureSafe(imageUrl)
        ] as const
      )
    )
  )
  const playerEquipmentTexturesByItemId = new Map(
    await Promise.all(
      Object.entries(PLAYER_EQUIPMENT_APPEARANCE_CONFIG_BY_ITEM_ID).map(
        async ([itemId, config]) => [
          itemId,
          await loadTextureSafe(config.imageUrl)
        ] as const
      )
    )
  )
  const messagePanelTexture = createMessagePanelTexture()

  const monsterAnimationTexturesByAppearanceType = new Map<string, MonsterAnimationTextures>(
    MONSTER_CATALOG.map((entry, index) => [entry.appearanceType, catalogMonsterAnimationTextures[index]])
  )

  tinyDungeonWeaponImageTexture.source.scaleMode = 'nearest'
  tinyDungeonWeaponImageTexture.source.addressMode = 'clamp-to-edge'
  portalInsideTexture.source.scaleMode = 'nearest'
  portalInsideTexture.source.addressMode = 'clamp-to-edge'
  for (const texture of playerWeaponAppearanceTexturesByItemId.values()) {
    texture.source.scaleMode = 'nearest'
    texture.source.addressMode = 'clamp-to-edge'
  }
  for (const texture of monsterEquipmentDropTexturesByDropId.values()) {
    texture.source.scaleMode = 'nearest'
    texture.source.addressMode = 'clamp-to-edge'
  }
  for (const texture of playerEquipmentTexturesByItemId.values()) {
    texture.source.scaleMode = 'nearest'
    texture.source.addressMode = 'clamp-to-edge'
  }
  await ensureMessageFontsLoaded()

  await app.init({
    antialias: false,
    autoDensity: true,
    backgroundColor: 0x171311,
    height: scaledMapPixelHeight,
    preference: 'webgl',
    roundPixels: true,
    resolution: window.devicePixelRatio || 1,
    width: scaledMapPixelWidth
  })
  app.ticker.maxFPS = 60

  const viewportElement = document.createElement('div')
  const sceneElement = document.createElement('div')
  const runtimeWarningBannerElement = document.createElement('div')
  const sceneIntroBannerElement = document.createElement('div')
  const sceneIntroPanelElement = document.createElement('div')
  const sceneIntroTextElement = document.createElement('div')

  viewportElement.className = 'game-viewport'
  sceneElement.className = 'game-scene'
  sceneElement.style.width = `${scaledMapPixelWidth}px`
  sceneElement.style.height = `${scaledMapPixelHeight}px`
  sceneElement.append(app.canvas)
  viewportElement.append(sceneElement)
  mountElement.replaceChildren(viewportElement)
  app.canvas.classList.add('game-canvas')

  runtimeWarningBannerElement.setAttribute('role', 'alert')
  runtimeWarningBannerElement.setAttribute('aria-live', 'polite')
  runtimeWarningBannerElement.hidden = true
  runtimeWarningBannerElement.style.position = 'fixed'
  runtimeWarningBannerElement.style.top = '12px'
  runtimeWarningBannerElement.style.left = '50%'
  runtimeWarningBannerElement.style.transform = 'translateX(-50%)'
  runtimeWarningBannerElement.style.zIndex = '9999'
  runtimeWarningBannerElement.style.maxWidth = 'min(720px, calc(100vw - 24px))'
  runtimeWarningBannerElement.style.padding = '8px 12px'
  runtimeWarningBannerElement.style.border = '1px solid #d94b4b'
  runtimeWarningBannerElement.style.background = '#fff1f1'
  runtimeWarningBannerElement.style.color = '#7a1f1f'
  runtimeWarningBannerElement.style.fontFamily =
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace'
  runtimeWarningBannerElement.style.fontSize = '0.7rem'
  runtimeWarningBannerElement.style.whiteSpace = 'pre-wrap'
  runtimeWarningBannerElement.style.pointerEvents = 'none'
  document.body.append(runtimeWarningBannerElement)

  sceneIntroBannerElement.className = 'scene-intro-overlay'
  sceneIntroBannerElement.setAttribute('aria-hidden', 'true')
  sceneIntroPanelElement.className = 'scene-intro-overlay__panel'
  sceneIntroTextElement.className = 'scene-intro-overlay__message'
  sceneIntroTextElement.textContent = sceneIntroMessage
  sceneIntroPanelElement.append(sceneIntroTextElement)
  sceneIntroBannerElement.append(sceneIntroPanelElement)
  mountElement.append(sceneIntroBannerElement)

  const world = new Container()
  world.scale.set(cameraZoom)
  const messageLayer = new Container()
  const tilesetResources = new Map<string, TilesetRenderResources>()
  const wallTiles = createWallTileLookup(map)
  const pressedDirections = new Set<CharacterMoveDirection>()
  const pressedActions = new Set<CharacterAction>()
  const playerRollInputState: PlayerRollInputState = {
    isModifierPressed: false
  }
  const triggeredActions = new Set<CharacterAction>()
  const gameEventQueue = createGameEventQueue()
  let currentAudioSettings = audioSettings
  const gameSoundEffects = createGameSoundEffects({
    masterVolume: currentAudioSettings.isMuted ? 0 : currentAudioSettings.sfxVolume
  })
  const interactionLockUntilByCharacterPair = new Map<string, number>()
  const activeCharacterMessages = new Map<string, ActiveCharacterMessage>()
  const activeCharacterDamageTexts = new Map<
    string,
    ActiveCharacterDamageText
  >()
  const monsterGoldDrops = new Map<string, MonsterGoldDrop>()
  const monsterEquipmentDrops = new Map<string, MonsterEquipmentDrop>()
  // 맵에 배치된 바닥 코인 더미(shadow_lower 레이어의 cave_prop_gold_* 타일).
  // CompositeTilemap 은 타일 단위 제거가 불가능해 개별 스프라이트로 분리해 둔다.
  const coinPileSprites = new Map<
    string,
    { sprite: Sprite; goldAmount: number; tileX: number; tileY: number }
  >()
  const collectedCoinTileKeySet = new Set(collectedCoinTileKeys)
  const renderedCharacters = new Map<string, RenderedCharacterNode>()
  const renderedPortals = new Map<string, RenderedPortalNode>()
  const characterPixelWidth =
    characterSpriteSheet.tileset.tileWidth * characterSpriteSheet.scale
  const characterPixelHeight =
    characterSpriteSheet.tileset.tileHeight * characterSpriteSheet.scale
  let currentPlayerEquipment = playerEquipment
  let currentPlayerInventory = playerInventory
  let currentPlayerQuickslots = playerQuickslots
  let currentPlayerSkillSlots = playerSkillSlots
  let currentPlayerControlBindings = playerControlBindings
  const triggeredSkillSlotIndexes = new Set<number>()
  let currentQuestLog = questLog
  // Phase 2 읽기 채널: 마지막으로 Lua 에 밀어넣은 스냅샷(변경 시에만 재푸시하기 위한 dirty 체크).
  let lastPushedSnapshotJson = ''
  // 게임 규칙을 Lua 로 실행한다(Lua 불가 시 TS 폴백). 호출부 시그니처는 TS 와 동일.
  const monsterRewards = createLuaMonsterRewards((source) =>
    controllerRuntime.loadDataModule(source)
  )
  const playerStatEffects = createLuaPlayerStatEffects((source) =>
    controllerRuntime.loadDataModule(source)
  )
  const luaMonsterCombat = createLuaMonsterCombat((source) =>
    controllerRuntime.loadDataModule(source)
  )
  const luaBlacksmithPricing = createLuaBlacksmithPricing((source) =>
    controllerRuntime.loadDataModule(source)
  )
  let currentBlacksmithInventory = merchantInventory
  let currentPotionMerchantInventory = potionMerchantInventory
  let currentHerbalistInventory = herbalistInventory
  let playerAttackStartedAtMilliseconds: number | undefined
  let playerAttackFacing: CharacterMoveDirection | undefined
  let playerWeaponTrailSprites: Sprite[] = []
  let playerWeaponSprite: Sprite | undefined
  let playerArmorSprite: Sprite | undefined
  let playerHelmetSprite: Sprite | undefined
  let playerSlashEffectSprite: AnimatedSprite | undefined
  let playerProtectSkillSprite: AnimatedSprite | undefined
  let playerProtectSkillActiveUntilMilliseconds = 0
  let playerProtectSkillReadyAtMilliseconds = 0
  let playerFocusSkillReadyAtMilliseconds = 0
  let playerDamageInvulnerableUntilMilliseconds = 0
  let playerSmashSkillStartedAtMilliseconds: number | undefined
  let playerSmashSkillFacing: CharacterMoveDirection | undefined
  let playerSmashSkillOrigin:
    | {
        x: number
        y: number
      }
    | undefined
  let playerSmashSkillReadyAtMilliseconds = 0
  let playerSmashSkillSegments: {
    sprite: AnimatedSprite
    delayMilliseconds: number
    started: boolean
    index: number
  }[] = []
  let playerSmashSkillHitMonsterIds = new Set<string>()
  let syncPlayerCharacterVisual: (nowMilliseconds?: number) => void = () => {}
  let isSceneTransitionPending = false
  let isDestroyed = false
  // 일반 몬스터 체력 2배(세 번쯤 때려야 쓰러지게). 보스(이름이 '-보스'로 끝남)는 어느 맵에서든
  // 체력 10배·피해 2배·크기 2배.
  const getMonsterCombatStateOptions = (character: CharacterState) =>
    isBossCharacterId(character.id)
      ? {
          hpMultiplier: getBossHpMultiplier(character.appearanceType),
          damageMultiplier: BOSS_DAMAGE_MULTIPLIER
        }
      : { hpMultiplier: MONSTER_HP_MULTIPLIER }
  const getMonsterRenderScaleMultiplier = (characterId: string) =>
    isBossCharacterId(characterId) ? BOSS_RENDER_SCALE_MULTIPLIER : 1
  const clearPressedInputState = () => {
    pressedDirections.clear()
    pressedActions.clear()
    playerRollInputState.isModifierPressed = false
    playerAttackQueuedAfterRoll = false
    triggeredActions.clear()
    triggeredSkillSlotIndexes.clear()
  }
  let isPlayerUiOpen = false
  let isPlayerStatOpen = false
  let isPlayerEquipmentOpen = false
  let isPlayerSkillOpen = false
  let windowStack: ReturnType<typeof createWindowStack>
  let isQuestLogOpen = false
  let isBlacksmithShopOpen = false
  let isPotionShopOpen = false
  let isHerbalistShopOpen = false
  let isPauseMenuOpen = false
  let pendingControlBindingId: PlayerControlBindingId | undefined
  let playerHudOverlay: {
    syncFrame: () => void
    destroy: () => void
  } = {
    syncFrame: () => {},
    destroy: () => {}
  }
  let playerInventoryOverlay: {
    syncFrame: () => void
    destroy: () => void
  } = {
    syncFrame: () => {},
    destroy: () => {}
  }
  let playerEquipmentOverlay: {
    syncFrame: () => void
    destroy: () => void
  } = {
    syncFrame: () => {},
    destroy: () => {}
  }
  let playerStatOverlay: {
    syncFrame: () => void
    destroy: () => void
  } = {
    syncFrame: () => {},
    destroy: () => {}
  }
  let playerSkillOverlay: {
    syncFrame: () => void
    destroy: () => void
  } = {
    syncFrame: () => {},
    destroy: () => {}
  }
  let questLogOverlay: {
    syncFrame: () => void
    destroy: () => void
  } = {
    syncFrame: () => {},
    destroy: () => {}
  }
  let playerShopOverlay: {
    syncFrame: () => void
    destroy: () => void
  } = {
    syncFrame: () => {},
    destroy: () => {}
  }
  let herbalistShopOverlay: {
    syncFrame: () => void
    destroy: () => void
  } = {
    syncFrame: () => {},
    destroy: () => {}
  }
  let statusEffectsOverlay: {
    syncFrame: () => void
    destroy: () => void
  } = {
    syncFrame: () => {},
    destroy: () => {}
  }
  let potionShopOverlay: {
    syncFrame: () => void
    destroy: () => void
  } = {
    syncFrame: () => {},
    destroy: () => {}
  }
  let pauseMenuOverlay: {
    syncFrame: () => void
    destroy: () => void
  } = {
    syncFrame: () => {},
    destroy: () => {}
  }
  let questTrackerOverlay: {
    syncFrame: () => void
    destroy: () => void
  } = {
    syncFrame: () => {},
    destroy: () => {}
  }
  const monsterPatrolStates = new Map<string, MonsterPatrolState>()
  const monsterSpawnStates = new Map<string, CharacterState>()
  const monsterPigAnimatedSprites = new Map<string, AnimatedSprite>()
  const monsterPigAnimationModes = new Map<string, MonsterPigAnimationMode>()
  const monsterPigBehaviorStates = new Map<string, MonsterPigBehaviorState>()
  const monsterCombatStates = new Map<string, MonsterCombatState>()
  const monsterContactDamageLockedUntilById = new Map<string, number>()
  const monsterRespawnAtById = new Map<string, number>()
  let bossHealthOverlay = { syncFrame: () => {}, destroy: () => {} }
  let sceneIntroHideTimeoutId: number | undefined
  let playerRespawnAtMilliseconds: number | undefined
  let playerHitReactionState: PlayerHitReactionState | undefined
  let playerRollState: PlayerRollState | undefined
  let playerRollReadyAtMilliseconds = 0
  let playerAttackQueuedAfterRoll = false
  let playerAttackResolvedStartedAtMilliseconds: number | undefined
  let playerAttackReadyAtMilliseconds = 0
  let lastRuntimeErrorMessage: string | undefined
  let depthSortedLayer: Container | undefined
  // 이 몬스터(씬·외형)를 잡아야 하는 퀘스트가 아직 끝나지 않았는가 — 보스를 퀘스트를 받기
  // 전에 잡아 버려 퀘스트를 깰 수 없게 되는 일을 막는다.
  const isMonsterStillNeededByQuest = (monster: CharacterState): boolean =>
    getAllQuestDefinitions().some((definition) => {
      const status = getQuestProgress(currentQuestLog, definition.id).status
      if (status === 'completed' || status === 'ready-to-turn-in') {
        return false
      }
      return definition.objectives.some(
        (objective) =>
          objective.type === 'monster-defeat' &&
          objective.target.sceneId === sceneId &&
          objective.target.appearanceType === monster.appearanceType
      )
    })
  // 쓰러뜨린 보스는 씬에 다시 놓지 않는다(엔딩 대사와 맞게 — 보스는 한 번만 잡는다).
  const defeatedBossIdSet = new Set(defeatedBossIds)
  let characterStates = characters
    .filter((character) => !(isBossCharacterId(character.id) && defeatedBossIdSet.has(character.id)))
    .map((character) => ({
      ...character,
      // 보스의 소환 하수인은 쓰러진 채로 시작한다(보스가 불러낼 때 나타난다)
      blocksMovement: isBossSummonCharacterId(character.id) ? false : character.blocksMovement,
      position: { ...character.position },
      collisionSize: { ...character.collisionSize }
    }))
  const initialPlayerCharacter = characterStates.find(
    (character) => character.id === PLAYER_CHARACTER_ID
  )

  if (!initialPlayerCharacter) {
    throw new Error('Missing player character in scene')
  }

  const playerRespawnState = {
    position: {
      ...initialPlayerCharacter.position
    },
    facing: initialPlayerCharacter.facing
  }
  const mapPortals = createMapPortalsFromEventLayers({ map })
  const grassTiles = createGrassTileLookup(map)
  let isSlowedByBlizzard = false
  let handleMapOverlayExpandedChange = (_isExpanded: boolean) => {}
  const mapOverlay = createMapOverlay({
    mountElement,
    cameraElement: viewportElement,
    sourceCanvas: app.canvas,
    mapPixelWidth: map.pixelWidth,
    mapPixelHeight: map.pixelHeight,
    getSceneScale: () => cameraZoom,
    getFocusPoint: () => {
      const focusCharacter = characterStates.find(
        (candidateCharacter) => candidateCharacter.id === cameraTargetCharacterId
      )

      if (!focusCharacter) {
        return {
          x: map.pixelWidth / 2,
          y: map.pixelHeight / 2
        }
      }

      return {
        x: focusCharacter.position.x * map.tileWidth + characterPixelWidth / 2,
        y:
          focusCharacter.position.y * map.tileHeight +
          characterPixelHeight / 2
      }
    },
    onExpandedChange: (isExpanded) => handleMapOverlayExpandedChange(isExpanded)
  })
  const syncViewportDisplayScale = () => {
    const displayScale = Math.max(
      0.1,
      Math.min(
        window.innerWidth / GAME_VIEWPORT_WIDTH,
        window.innerHeight / GAME_VIEWPORT_HEIGHT
      )
    )

    viewportElement.style.transform = `scale(${displayScale})`
  }
  const syncCameraZoomLayout = () => {
    scaledMapPixelWidth = Math.round(map.pixelWidth * cameraZoom)
    scaledMapPixelHeight = Math.round(map.pixelHeight * cameraZoom)
    world.scale.set(cameraZoom)
    app.renderer.resize(scaledMapPixelWidth, scaledMapPixelHeight)
    sceneElement.style.width = `${scaledMapPixelWidth}px`
    sceneElement.style.height = `${scaledMapPixelHeight}px`
  }
  const setCameraZoom = (nextCameraZoom: number) => {
    const clampedCameraZoom = clampCameraZoom(nextCameraZoom)

    if (clampedCameraZoom === cameraZoom) {
      return
    }

    cameraZoom = clampedCameraZoom
    syncCameraZoomLayout()
    centerCameraOnCharacter(getCharacterStateById(cameraTargetCharacterId))
    mapOverlay.syncFrame()
  }
  const syncPlayerUiOverlays = () => {
    syncPlayerDerivedCharacterStats()
    playerHudOverlay.syncFrame()
    playerInventoryOverlay.syncFrame()
    playerEquipmentOverlay.syncFrame()
    playerStatOverlay.syncFrame()
    playerSkillOverlay.syncFrame()
    questLogOverlay.syncFrame()
    playerShopOverlay.syncFrame()
    potionShopOverlay.syncFrame()
    herbalistShopOverlay.syncFrame()
    pauseMenuOverlay.syncFrame()
    questTrackerOverlay.syncFrame()
  }
  const syncPlayerDerivedCharacterStats = () => {
    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)

    if (playerCharacter.controller.kind !== 'keyboard') {
      return
    }

    playerCharacter.controller = {
      ...playerCharacter.controller,
      moveSpeedTilesPerSecond:
        playerStatEffects.getPlayerMovementSpeedTilesPerSecond(playerProfile) *
        (isSlowedByBlizzard ? BLIZZARD_MOVE_SPEED_MULTIPLIER : 1)
    }
  }
  const showSceneIntroBanner = () => {
    if (!sceneIntroMessage) {
      return
    }

    window.clearTimeout(sceneIntroHideTimeoutId)
    sceneIntroBannerElement.classList.add('scene-intro-overlay--visible')
    sceneIntroHideTimeoutId = window.setTimeout(() => {
      sceneIntroBannerElement.classList.remove('scene-intro-overlay--visible')
    }, SCENE_INTRO_VISIBLE_DURATION_MILLISECONDS)
  }
  const getQuickslotIndexFromKeyboardEvent = (
    event: KeyboardEvent
  ): number | undefined => {
    return getPlayerControlQuickslotIndexFromCode(
      currentPlayerControlBindings,
      event.code
    )
  }
  const triggerPlayerAttack = (now: number) => {
    if (now < playerAttackReadyAtMilliseconds || isPlayerCasting(now)) {
      return
    }

    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
    // 쿨다운은 휘두르기가 끝난 뒤부터 센다(동작 320ms + 300ms ≈ 0.62초에 한 번).
    // 예전엔 시작부터 세어 0.3초마다 — 동작이 끝나기도 전에 다음 공격이 나갔다.
    playerAttackReadyAtMilliseconds =
      now + PLAYER_ATTACK_DURATION_MILLISECONDS + PLAYER_ATTACK_COOLDOWN_MILLISECONDS

    // 장착 무기의 공격 방식 분기: 근접은 기존 스윙+슬래시, 활/마법은 발사체.
    const attackKind = getEquippedPlayerWeaponAttackKind(currentPlayerEquipment)

    if (attackKind === 'melee') {
      startPlayerWeaponAttackMotion(playerCharacter, now)
      return
    }

    // 원거리: 지팡이는 조준 에너지볼트, 활은 조준 화살. 동작(찌르기/쏘기)과 발사 시점은
    // 시전 흐름(beginPlayerMagicCast)이 맡는다.
    if (attackKind === 'magic') {
      triggerPlayerStaffAttack(now)
    } else {
      triggerPlayerBowAttack(now)
    }
  }

  // 발사체 비주얼은 전용 아트가 아직 없어 Graphics 로 그린다(골드 드랍 동전과 같은 방식).
  const {
    clearMagicEffects,
    clearPlayerProjectiles,
    getPlayerBasicAttackDamage,
    isMonsterFrozen,
    isPlayerCasting,
    monsterMagicStatuses,
    showPlayerMagicMessage,
    triggerPlayerBowAttack,
    triggerPlayerBowSkill,
    triggerPlayerMagicSkill,
    triggerPlayerStaffAttack,
    updateMonsterMagicStatuses,
    updatePlayerMagicCast,
    updatePlayerProjectiles,
    getPlayerMagicCast
  } = createPlayerCombatEffects({
    map,
    wallTiles,
    gameSoundEffects,
    renderedCharacters,
    monsterPigAnimatedSprites,
    playerStatEffects,
    characterPixelWidth,
    characterPixelHeight,
    applyDamageToMonster: (...args) => applyDamageToMonster(...args),
    createPixelCollisionRectFromCharacter: (...args) => createPixelCollisionRectFromCharacter(...args),
    getCharacterPixelCenter: (...args) => getCharacterPixelCenter(...args),
    getCharacterStateById,
    isMonsterCharacter: (...args) => isMonsterCharacter(...args),
    isMonsterCombatStateDefeated: (...args) => isMonsterCombatStateDefeated(...args),
    resolveClosestMonsterInCollisionRect: (...args) => resolveClosestMonsterInCollisionRect(...args),
    resolveMonstersInCollisionRect: (...args) => resolveMonstersInCollisionRect(...args),
    isPlayerRolling: (...args) => isPlayerRolling(...args),
    showCharacterDamageText: (...args) => showCharacterDamageText(...args),
    getDepthSortedLayer: () => depthSortedLayer,
    getCurrentPlayerEquipment: () => currentPlayerEquipment,
    getIsSceneTransitionPending: () => isSceneTransitionPending,
    getLpcArrowTexture: () => lpcArrowTexture,
    getPlayerProfile: () => playerProfile,
    getSyncPlayerCharacterVisual: () => syncPlayerCharacterVisual,
    getCharacterStates: () => characterStates,
    setCharacterStates: (value) => {
      characterStates = value
    }
  })
  const {
    clearPlayerProtectSkillEffectSprite,
    clearPlayerSlashEffectSprite,
    clearPlayerSmashSkillEffectSprites,
    isPlayerRolling,
    startPlayerWeaponAttackMotion,
    stepPlayerRoll,
    stopPlayerFootsteps,
    syncPlayerFootsteps,
    syncPlayerSmashSkillVisual,
    triggerPlayerRollFromPressedDirection,
    triggerPlayerSkillFromSlotIndex
  } = createPlayerActions({
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
    showCharacterDamageText: (...args) => showCharacterDamageText(...args),
    tryMoveCharacter: (...args) => tryMoveCharacter(...args),
    getCurrentPlayerEquipment: () => currentPlayerEquipment,
    getCurrentPlayerSkillSlots: () => currentPlayerSkillSlots,
    getDepthSortedLayer: () => depthSortedLayer,
    getIsPauseMenuOpen: () => isPauseMenuOpen,
    getIsSceneTransitionPending: () => isSceneTransitionPending,
    getPlayerProtectSkillSprite: () => playerProtectSkillSprite,
    getPlayerSmashSkillHitMonsterIds: () => playerSmashSkillHitMonsterIds,
    getSyncPlayerCharacterVisual: () => syncPlayerCharacterVisual,
    getCharacterStates: () => characterStates,
    getPlayerAttackQueuedAfterRoll: () => playerAttackQueuedAfterRoll,
    getPlayerFocusSkillReadyAtMilliseconds: () => playerFocusSkillReadyAtMilliseconds,
    getPlayerProtectSkillReadyAtMilliseconds: () => playerProtectSkillReadyAtMilliseconds,
    getPlayerRollReadyAtMilliseconds: () => playerRollReadyAtMilliseconds,
    getPlayerRollState: () => playerRollState,
    getPlayerSlashEffectSprite: () => playerSlashEffectSprite,
    getPlayerSmashSkillFacing: () => playerSmashSkillFacing,
    getPlayerSmashSkillOrigin: () => playerSmashSkillOrigin,
    getPlayerSmashSkillReadyAtMilliseconds: () => playerSmashSkillReadyAtMilliseconds,
    getPlayerSmashSkillSegments: () => playerSmashSkillSegments,
    getPlayerSmashSkillStartedAtMilliseconds: () => playerSmashSkillStartedAtMilliseconds,
    setCharacterStates: (value) => {
      characterStates = value
    },
    setPlayerAttackFacing: (value) => {
      playerAttackFacing = value
    },
    setPlayerAttackQueuedAfterRoll: (value) => {
      playerAttackQueuedAfterRoll = value
    },
    setPlayerAttackResolvedStartedAtMilliseconds: (value) => {
      playerAttackResolvedStartedAtMilliseconds = value
    },
    setPlayerAttackStartedAtMilliseconds: (value) => {
      playerAttackStartedAtMilliseconds = value
    },
    setPlayerFocusSkillReadyAtMilliseconds: (value) => {
      playerFocusSkillReadyAtMilliseconds = value
    },
    setPlayerHitReactionState: (value) => {
      playerHitReactionState = value
    },
    setPlayerProtectSkillActiveUntilMilliseconds: (value) => {
      playerProtectSkillActiveUntilMilliseconds = value
    },
    setPlayerProtectSkillReadyAtMilliseconds: (value) => {
      playerProtectSkillReadyAtMilliseconds = value
    },
    setPlayerRollReadyAtMilliseconds: (value) => {
      playerRollReadyAtMilliseconds = value
    },
    setPlayerRollState: (value) => {
      playerRollState = value
    },
    setPlayerSlashEffectSprite: (value) => {
      playerSlashEffectSprite = value
    },
    setPlayerSmashSkillFacing: (value) => {
      playerSmashSkillFacing = value
    },
    setPlayerSmashSkillOrigin: (value) => {
      playerSmashSkillOrigin = value
    },
    setPlayerSmashSkillReadyAtMilliseconds: (value) => {
      playerSmashSkillReadyAtMilliseconds = value
    },
    setPlayerSmashSkillSegments: (value) => {
      playerSmashSkillSegments = value
    },
    setPlayerSmashSkillStartedAtMilliseconds: (value) => {
      playerSmashSkillStartedAtMilliseconds = value
    }
  })
  const {
    setBlacksmithShopOpen,
    setHerbalistShopOpen,
    setPauseMenuOpen,
    setPlayerEquipmentOpen,
    setPlayerSkillOpen,
    setPlayerStatOpen,
    setPlayerUiOpen,
    setPotionShopOpen,
    setQuestLog,
    setQuestLogOpen,
    setQuestLogWithObjectiveFeedback,
    updateCurrentAudioSettings
  } = createUiState({
    clearPressedInputState,
    gameSoundEffects,
    mapOverlay,
    onAudioSettingsChange,
    onQuestLogChange,
    syncPlayerUiOverlays,
    showCharacterDamageText: (...args) => showCharacterDamageText(...args),
    syncQuestNpcBadges: (...args) => syncQuestNpcBadges(...args),
    getPauseMenuOverlay: () => pauseMenuOverlay,
    getQuestLogOverlay: () => questLogOverlay,
    getQuestTrackerOverlay: () => questTrackerOverlay,
    getWindowStack: () => windowStack,
    getCurrentAudioSettings: () => currentAudioSettings,
    getCurrentQuestLog: () => currentQuestLog,
    getIsBlacksmithShopOpen: () => isBlacksmithShopOpen,
    getIsHerbalistShopOpen: () => isHerbalistShopOpen,
    getIsPauseMenuOpen: () => isPauseMenuOpen,
    getIsPlayerEquipmentOpen: () => isPlayerEquipmentOpen,
    getIsPlayerSkillOpen: () => isPlayerSkillOpen,
    getIsPlayerStatOpen: () => isPlayerStatOpen,
    getIsPlayerUiOpen: () => isPlayerUiOpen,
    getIsPotionShopOpen: () => isPotionShopOpen,
    getIsQuestLogOpen: () => isQuestLogOpen,
    setCurrentAudioSettings: (value) => {
      currentAudioSettings = value
    },
    setCurrentQuestLog: (value) => {
      currentQuestLog = value
    },
    setIsBlacksmithShopOpen: (value) => {
      isBlacksmithShopOpen = value
    },
    setIsHerbalistShopOpen: (value) => {
      isHerbalistShopOpen = value
    },
    setIsPauseMenuOpen: (value) => {
      isPauseMenuOpen = value
    },
    setIsPlayerEquipmentOpen: (value) => {
      isPlayerEquipmentOpen = value
    },
    setIsPlayerSkillOpen: (value) => {
      isPlayerSkillOpen = value
    },
    setIsPlayerStatOpen: (value) => {
      isPlayerStatOpen = value
    },
    setIsPlayerUiOpen: (value) => {
      isPlayerUiOpen = value
    },
    setIsPotionShopOpen: (value) => {
      isPotionShopOpen = value
    },
    setIsQuestLogOpen: (value) => {
      isQuestLogOpen = value
    },
    setPendingControlBindingId: (value) => {
      pendingControlBindingId = value
    }
  })
  const {
    grantPlayerExperienceReward,
    grantQuestCompletionRewards,
    handleConsumableUsed,
    recordAcquiredItemsFromInventoryDelta
  } = createPlayerRewards({
    gameSoundEffects,
    onColdImmuneUntilChange,
    onPlayerInventoryChange,
    onPoisonFogImmuneUntilChange,
    playerProfile,
    setQuestLogWithObjectiveFeedback,
    syncPlayerUiOverlays,
    showCharacterDamageText: (...args) => showCharacterDamageText(...args),
    getCurrentPlayerControlBindings: () => currentPlayerControlBindings,
    getCurrentQuestLog: () => currentQuestLog,
    getStatusEffectsOverlay: () => statusEffectsOverlay,
    getCurrentPlayerInventory: () => currentPlayerInventory,
    setCurrentPlayerInventory: (value) => {
      currentPlayerInventory = value
    }
  })
  const {
    getStatusEffectPills,
    resolveBlizzardDamage,
    resolvePoisonFogDamage
  } = createEnvironmentHazards({
    getCharacterStateById,
    getColdImmuneUntil,
    getPoisonFogImmuneUntil,
    map,
    playerProfile,
    syncPlayerDerivedCharacterStats,
    applyDamageToPlayer: (...args) => applyDamageToPlayer(...args),
    showCharacterDamageText: (...args) => showCharacterDamageText(...args),
    getIsSlowedByBlizzard: () => isSlowedByBlizzard,
    setIsSlowedByBlizzard: (value) => {
      isSlowedByBlizzard = value
    }
  })
  const {
    closeAllOverlays,
    resetPlayerControlBindings,
    setControlBindingCaptureTarget,
    updatePlayerControlBindings
  } = createOverlayControls({
    clearPressedInputState,
    gameSoundEffects,
    mapOverlay,
    onPlayerControlBindingsChange,
    syncPlayerUiOverlays,
    getIsHerbalistShopOpen: () => isHerbalistShopOpen,
    getIsBlacksmithShopOpen: () => isBlacksmithShopOpen,
    getIsPauseMenuOpen: () => isPauseMenuOpen,
    getIsPlayerEquipmentOpen: () => isPlayerEquipmentOpen,
    getIsPlayerSkillOpen: () => isPlayerSkillOpen,
    getIsPlayerStatOpen: () => isPlayerStatOpen,
    getIsPlayerUiOpen: () => isPlayerUiOpen,
    getIsPotionShopOpen: () => isPotionShopOpen,
    getIsQuestLogOpen: () => isQuestLogOpen,
    setCurrentPlayerControlBindings: (value) => {
      currentPlayerControlBindings = value
    },
    setHandleMapOverlayExpandedChange: (value) => {
      handleMapOverlayExpandedChange = value
    },
    setIsBlacksmithShopOpen: (value) => {
      isBlacksmithShopOpen = value
    },
    setIsPauseMenuOpen: (value) => {
      isPauseMenuOpen = value
    },
    setIsPlayerEquipmentOpen: (value) => {
      isPlayerEquipmentOpen = value
    },
    setIsPlayerSkillOpen: (value) => {
      isPlayerSkillOpen = value
    },
    setIsPlayerStatOpen: (value) => {
      isPlayerStatOpen = value
    },
    setIsPlayerUiOpen: (value) => {
      isPlayerUiOpen = value
    },
    setIsPotionShopOpen: (value) => {
      isPotionShopOpen = value
    },
    setIsQuestLogOpen: (value) => {
      isQuestLogOpen = value
    },
    setPendingControlBindingId: (value) => {
      pendingControlBindingId = value
    }
  })
  const {
    requestPlayerPortalTransition,
    requestSceneTransitionTo
  } = createSceneTransitions({
    clearPressedInputState,
    closeAllOverlays,
    gameEventQueue,
    getCharacterStateById,
    mapPortals,
    onRequestSceneChange,
    playerProfile,
    stopPlayerFootsteps,
    triggeredActions,
    getIsSceneTransitionPending: () => isSceneTransitionPending,
    setIsSceneTransitionPending: (value) => {
      isSceneTransitionPending = value
    }
  })
  const {
    getNpcDialoguePortrait,
    handleQuestInteractionEvents,
    handleScenarioInteractionEvents,
    handleWaystoneInteractionEvents,
    runSceneEnterAutoTurnIns,
    showRemoteQuestGiverDialogue
  } = createNpcInteractions({
    playerProfile,
    interactionLockUntilByCharacterPair,
    getDiscoveredWaystoneIds,
    onWaystoneDiscovered,
    onPlayerInventoryChange,
    getCharacterStateById,
    grantPlayerExperienceReward,
    grantQuestCompletionRewards,
    requestSceneTransitionTo,
    setBlacksmithShopOpen,
    setPotionShopOpen,
    setHerbalistShopOpen,
    setQuestLog,
    setQuestLogWithObjectiveFeedback,
    syncPlayerUiOverlays,
    showCharacterMessage: (...args) => showCharacterMessage(...args),
    hideCharacterMessage: (...args) => hideCharacterMessage(...args),
    showCharacterDamageText: (...args) => showCharacterDamageText(...args),
    getNpcDialogueOverlay: () => npcDialogueOverlay,
    getCharacterStates: () => characterStates,
    getCurrentQuestLog: () => currentQuestLog,
    getCurrentPlayerInventory: () => currentPlayerInventory,
    setCurrentPlayerInventory: (value) => {
      currentPlayerInventory = value
    }
  })
  const {
    sceneVignetteElement
  } = createUiOverlays({
    getStatusEffectPills,
    handleConsumableUsed,
    luaBlacksmithPricing,
    mountElement,
    onHerbalistInventoryChange,
    onMerchantInventoryChange,
    onPlayerEquipmentChange,
    onPlayerInventoryChange,
    onPlayerQuickslotsChange,
    onPlayerSkillSlotsChange,
    onPotionMerchantInventoryChange,
    playerProfile,
    recordAcquiredItemsFromInventoryDelta,
    resetPlayerControlBindings,
    sceneId,
    setBlacksmithShopOpen,
    setControlBindingCaptureTarget,
    setHerbalistShopOpen,
    setPauseMenuOpen,
    setPlayerEquipmentOpen,
    setPlayerSkillOpen,
    setPlayerStatOpen,
    setPlayerUiOpen,
    setPotionShopOpen,
    setQuestLog,
    setQuestLogOpen,
    showRemoteQuestGiverDialogue,
    syncPlayerUiOverlays,
    updateCurrentAudioSettings,
    getActiveBossView: (...args) => getActiveBossView(...args),
    getCharacterStates: () => characterStates,
    getCurrentAudioSettings: () => currentAudioSettings,
    getCurrentPlayerControlBindings: () => currentPlayerControlBindings,
    getCurrentQuestLog: () => currentQuestLog,
    getIsBlacksmithShopOpen: () => isBlacksmithShopOpen,
    getIsHerbalistShopOpen: () => isHerbalistShopOpen,
    getIsPauseMenuOpen: () => isPauseMenuOpen,
    getIsPlayerEquipmentOpen: () => isPlayerEquipmentOpen,
    getIsPlayerSkillOpen: () => isPlayerSkillOpen,
    getIsPlayerStatOpen: () => isPlayerStatOpen,
    getIsPlayerUiOpen: () => isPlayerUiOpen,
    getIsPotionShopOpen: () => isPotionShopOpen,
    getIsQuestLogOpen: () => isQuestLogOpen,
    getPendingControlBindingId: () => pendingControlBindingId,
    getSyncPlayerCharacterVisual: () => syncPlayerCharacterVisual,
    getCurrentBlacksmithInventory: () => currentBlacksmithInventory,
    getCurrentHerbalistInventory: () => currentHerbalistInventory,
    getCurrentPlayerEquipment: () => currentPlayerEquipment,
    getCurrentPlayerInventory: () => currentPlayerInventory,
    getCurrentPlayerQuickslots: () => currentPlayerQuickslots,
    getCurrentPlayerSkillSlots: () => currentPlayerSkillSlots,
    getCurrentPotionMerchantInventory: () => currentPotionMerchantInventory,
    setBossHealthOverlay: (value) => {
      bossHealthOverlay = value
    },
    setCurrentBlacksmithInventory: (value) => {
      currentBlacksmithInventory = value
    },
    setCurrentHerbalistInventory: (value) => {
      currentHerbalistInventory = value
    },
    setCurrentPlayerEquipment: (value) => {
      currentPlayerEquipment = value
    },
    setCurrentPlayerInventory: (value) => {
      currentPlayerInventory = value
    },
    setCurrentPlayerQuickslots: (value) => {
      currentPlayerQuickslots = value
    },
    setCurrentPlayerSkillSlots: (value) => {
      currentPlayerSkillSlots = value
    },
    setCurrentPotionMerchantInventory: (value) => {
      currentPotionMerchantInventory = value
    },
    setHerbalistShopOverlay: (value) => {
      herbalistShopOverlay = value
    },
    setPauseMenuOverlay: (value) => {
      pauseMenuOverlay = value
    },
    setPlayerEquipmentOverlay: (value) => {
      playerEquipmentOverlay = value
    },
    setPlayerHudOverlay: (value) => {
      playerHudOverlay = value
    },
    setPlayerInventoryOverlay: (value) => {
      playerInventoryOverlay = value
    },
    setPlayerShopOverlay: (value) => {
      playerShopOverlay = value
    },
    setPlayerSkillOverlay: (value) => {
      playerSkillOverlay = value
    },
    setPlayerStatOverlay: (value) => {
      playerStatOverlay = value
    },
    setPotionShopOverlay: (value) => {
      potionShopOverlay = value
    },
    setQuestLogOverlay: (value) => {
      questLogOverlay = value
    },
    setQuestTrackerOverlay: (value) => {
      questTrackerOverlay = value
    },
    setStatusEffectsOverlay: (value) => {
      statusEffectsOverlay = value
    }
  })
  const npcDialogueOverlay = createNpcDialogueOverlay({ mountElement })
  // 인게임 시나리오 에디터 런처는 제거했다 — 콘텐츠 생성은 별도 에디터 페이지(/editor.html)가 담당한다.

  const syncRuntimeWarningBanner = () => {
    const warnings = controllerRuntime.getRuntimeWarnings()

    if (warnings.length === 0) {
      runtimeWarningBannerElement.hidden = true
      runtimeWarningBannerElement.replaceChildren()
      return
    }

    runtimeWarningBannerElement.hidden = false
    const warningBlocks = warnings.map((warning) => {
      const warningElement = document.createElement('div')
      const warningLines = warning.split('\n')

      warningElement.style.display = 'grid'
      warningElement.style.gap = '2px'

      for (const line of warningLines) {
        const lineElement = document.createElement('div')
        const luaSourceReferenceMatch = line.match(/([A-Za-z0-9_./-]+\.lua:\d+)/u)

        if (luaSourceReferenceMatch && luaSourceReferenceMatch.index !== undefined) {
          const prefixElement = document.createElement('span')
          const pathElement = document.createElement('span')
          const suffixElement = document.createElement('span')
          const matchStart = luaSourceReferenceMatch.index
          const matchedPath = luaSourceReferenceMatch[1]

          prefixElement.textContent = line.slice(0, matchStart)
          pathElement.textContent = matchedPath
          pathElement.style.textDecoration = 'underline'
          pathElement.style.textDecorationThickness = '1px'
          suffixElement.textContent = line.slice(matchStart + matchedPath.length)
          lineElement.append(prefixElement, pathElement, suffixElement)
        } else {
          lineElement.textContent = line
        }

        warningElement.append(lineElement)
      }

      return warningElement
    })

    runtimeWarningBannerElement.replaceChildren(...warningBlocks)
  }

  const isInteractiveUiEventTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) {
      return false
    }

    return (
      target.closest(
        'button, input, textarea, select, [contenteditable="true"]'
      ) !== null
    )
  }

  controllerRuntime.syncCharacters(characterStates)
  syncRuntimeWarningBanner()

  messageLayer.label = 'layer:messages'
  messageLayer.sortableChildren = true
  app.stage.addChild(world)

  const appliedAtlasUrl = loadPlacementsForMap(sceneId).find(item => item.visible !== false && item.themeSettings)?.themeSettings?.tilesetImageUrl
  if (appliedAtlasUrl && map.tilesets.length !== 1) throw new Error('Theme atlas requires exactly one map tileset')
  for (const tileset of map.tilesets) {
    tilesetResources.set(
      tileset.source,
      await loadTilesetRenderResources(tileset, appliedAtlasUrl ? { ...imageUrls, [tileset.image.source]: appliedAtlasUrl } : imageUrls)
    )
  }
  const characterTilesetResources = await loadTilesetRenderResources(
    characterSpriteSheet.tileset,
    imageUrls,
    'nearest'
  )
  const playerWeaponTexture = createTileTexture(
    tinyDungeonWeaponImageTexture,
    PLAYER_WEAPON_TILE_FRAME_SOURCE,
    PLAYER_WEAPON_TILE_LOCAL_ID
  )
  const questNewTexture = await loadTextureSafe(
    imageUrls['quest_new.png']
  )
  const questFinTexture = await loadTextureSafe(
    imageUrls['quest_fin.png']
  )
  const caveEntranceTexture = await loadTextureSafe(
    imageUrls['cave1-visible.png']
  )
  // 플레이어 장비 레이어 시트: 장비를 바꾸면 그때 필요한 시트만 불러 온다.
  const lpcSheetCache = createLpcSheetCache()
  const lpcArrowTexture = await loadLpcArrowTexture()
  const getPlayerLook = (): LpcPlayerLook => {
    const itemId = (slotId: string) =>
      currentPlayerEquipment.slots.find((slot) => slot.id === slotId)?.item?.id
    return {
      weaponId: itemId('weapon'),
      armorId: itemId('armor'),
      hatId: itemId('hat'),
      bootsId: itemId('boots')
    }
  }
  {
    // 첫 화면에서 맨몸이 깜빡이지 않게 현재 장비의 걷기·공격 시트를 미리 불러 둔다.
    const look = getPlayerLook()
    const preload: Array<[string, LpcAnimationName]> = []
    for (const animation of ['walk', getLpcPlayerAttackAnimation(look.weaponId)] as const) {
      for (const file of Object.values(getLpcPlayerLayerFiles(look, animation))) {
        if (file) {
          preload.push([file, animation])
        }
      }
    }
    await lpcSheetCache.preload(preload)
  }
  const lpcNpcSheets = await loadLpcNpcSheets(
    characterStates.flatMap((character) => [`id:${character.id}`, character.appearanceType])
  )
  const getLpcNpcSheetsFor = (character: CharacterState) => {
    const key = getLpcNpcSheetKey(character.id, character.appearanceType)
    return key ? lpcNpcSheets.get(key) : undefined
  }
  // LPC 캐릭터의 판정·라벨 기준이 되는 1칸 크기 투명 판.
  const lpcPlaceholderTexture = (() => {
    const canvas = document.createElement('canvas')
    canvas.width = map.tileWidth
    canvas.height = map.tileHeight
    return Texture.from(canvas)
  })()
  caveEntranceTexture.source.addressMode = 'clamp-to-edge'
  const resolveMapPortalTexture = (appearanceType: string): Texture => {
    if (appearanceType === 'cave_entrance') {
      return caveEntranceTexture
    }

    for (const tileset of map.tilesets) {
      const renderResources = tilesetResources.get(tileset.source)

      if (!renderResources) {
        throw new Error(`Missing render resources for tileset ${tileset.source}`)
      }

      try {
        return renderResources.tileTextures[
          resolveTilesetLocalIdByType(tileset, appearanceType)
        ]
      } catch {
        continue
      }
    }

    throw new Error(`Could not resolve portal texture ${appearanceType}`)
  }

  const themeColorTargets: Container[] = []
  const {
    depthSortedLayer: builtDepthSortedLayer,
    flowingWaterSurfaces,
    waterRippleTexturesByKey
  } = createMapTileLayers({
    map,
    world,
    tilesetResources,
    coinPileSprites,
    collectedCoinTileKeySet,
    themeColorTargets
  })
  depthSortedLayer = builtDepthSortedLayer

  // ---------------------------------------------------------------- 빛(mapView/mapLightLayer.ts)
  const { updateMapLights } = createMapLightLayer({ map, world })

  const {
    createLpcCharacterNode,
    syncCharacterSprite,
    syncQuestNpcBadges
  } = createCharacterSprites({
    map,
    messageLayer,
    monsterCombatStates,
    monsterPigAnimationModes,
    playerEquipmentTexturesByItemId,
    playerProfile,
    questFinTexture,
    questNewTexture,
    renderedCharacters,
    getCharacterStateById,
    getPlayerLook,
    lpcSheetCache,
    getPlayerMagicCast,
    syncPlayerWeaponSprite: (...args) => syncPlayerWeaponSprite(...args),
    getPlayerAttackFacing: () => playerAttackFacing,
    getPlayerAttackStartedAtMilliseconds: () => playerAttackStartedAtMilliseconds,
    getCurrentPlayerEquipment: () => currentPlayerEquipment,
    getCurrentQuestLog: () => currentQuestLog,
    getDepthSortedLayer: () => depthSortedLayer,
    getPlayerRollState: () => playerRollState,
    getPlayerHitReactionState: () => playerHitReactionState,
    setPlayerHitReactionState: (value) => {
      playerHitReactionState = value
    }
  })
  const {
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
  } = createMonsterBehavior({
    getCharacterStateById,
    monsterAnimationTexturesByAppearanceType,
    monsterCombatStates,
    monsterPigAnimatedSprites,
    monsterPigAnimationModes,
    monsterPigBehaviorStates,
    syncCharacterSprite,
    tryMoveCharacter: (...args) => tryMoveCharacter(...args),
    getCharacterStates: () => characterStates,
    setCharacterStates: (value) => {
      characterStates = value
    },
    setPlayerHitReactionState: (value) => {
      playerHitReactionState = value
    }
  })

  const {
    attachCharacterLabelLayer,
    syncCharacterLabelLayers
  } = createCharacterNodes({
    characterSpriteSheet,
    characterTilesetResources,
    createLpcCharacterNode,
    createMonsterPigBehaviorState,
    getLpcNpcSheetsFor,
    getMonsterCombatStateOptions,
    getMonsterRenderScaleMultiplier,
    lpcPlaceholderTexture,
    luaMonsterCombat,
    map,
    mapPortals,
    messageLayer,
    messagePanelTexture,
    monsterAnimationTexturesByAppearanceType,
    monsterCombatStates,
    monsterPigAnimatedSprites,
    monsterPigBehaviorStates,
    monsterSpawnStates,
    playerProfile,
    portalInsideTexture,
    protectVfxTextures,
    questNewTexture,
    renderedCharacters,
    renderedPortals,
    resolveMapPortalTexture,
    syncMonsterAnimation,
    tilesetResources,
    world,
    depthSortedLayer,
    getCharacterStates: () => characterStates,
    getPlayerArmorSprite: () => playerArmorSprite,
    getPlayerHelmetSprite: () => playerHelmetSprite,
    setPlayerArmorSprite: (value) => {
      playerArmorSprite = value
    },
    setPlayerHelmetSprite: (value) => {
      playerHelmetSprite = value
    },
    setPlayerProtectSkillSprite: (value) => {
      playerProtectSkillSprite = value
    },
    setPlayerWeaponSprite: (value) => {
      playerWeaponSprite = value
    },
    setPlayerWeaponTrailSprites: (value) => {
      playerWeaponTrailSprites = value
    }
  })
  function getCharacterStateById(characterId: string): CharacterState {
    const character = characterStates.find(
      (candidateCharacter) => candidateCharacter.id === characterId
    )

    if (!character) {
      throw new Error(`Missing character ${characterId}`)
    }

    return character
  }

  syncPlayerCharacterVisual = (now = performance.now()) => {
    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)

    syncCharacterSprite(playerCharacter, now)
    syncPlayerSmashSkillVisual(playerCharacter, now)
    syncPlayerProtectSkillVisual(playerCharacter, now)
  }

  const syncAllCharacterSprites = () => {
    for (const character of characterStates) {
      syncCharacterSprite(character)
    }
  }

  const {
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
  } = createCombat({
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
    clearBossEncounter: (...args) => clearBossEncounter(...args),
    showCharacterDamageText: (...args) => showCharacterDamageText(...args),
    spawnMonsterEquipmentDrop: (...args) => spawnMonsterEquipmentDrop(...args),
    spawnMonsterGoldDrop: (...args) => spawnMonsterGoldDrop(...args),
    getCurrentPlayerEquipment: () => currentPlayerEquipment,
    getCurrentQuestLog: () => currentQuestLog,
    getPlayerSlashEffectSprite: () => playerSlashEffectSprite,
    getPlayerSmashSkillHitMonsterIds: () => playerSmashSkillHitMonsterIds,
    getPlayerSmashSkillSegments: () => playerSmashSkillSegments,
    getPlayerSmashSkillStartedAtMilliseconds: () => playerSmashSkillStartedAtMilliseconds,
    getCharacterStates: () => characterStates,
    getCurrentPlayerInventory: () => currentPlayerInventory,
    getPlayerAttackResolvedStartedAtMilliseconds: () => playerAttackResolvedStartedAtMilliseconds,
    getPlayerAttackStartedAtMilliseconds: () => playerAttackStartedAtMilliseconds,
    getPlayerDamageInvulnerableUntilMilliseconds: () => playerDamageInvulnerableUntilMilliseconds,
    getPlayerProtectSkillActiveUntilMilliseconds: () => playerProtectSkillActiveUntilMilliseconds,
    getPlayerRespawnAtMilliseconds: () => playerRespawnAtMilliseconds,
    setCharacterStates: (value) => {
      characterStates = value
    },
    setCurrentPlayerInventory: (value) => {
      currentPlayerInventory = value
    },
    setPlayerAttackFacing: (value) => {
      playerAttackFacing = value
    },
    setPlayerAttackReadyAtMilliseconds: (value) => {
      playerAttackReadyAtMilliseconds = value
    },
    setPlayerAttackResolvedStartedAtMilliseconds: (value) => {
      playerAttackResolvedStartedAtMilliseconds = value
    },
    setPlayerAttackStartedAtMilliseconds: (value) => {
      playerAttackStartedAtMilliseconds = value
    },
    setPlayerDamageInvulnerableUntilMilliseconds: (value) => {
      playerDamageInvulnerableUntilMilliseconds = value
    },
    setPlayerHitReactionState: (value) => {
      playerHitReactionState = value
    },
    setPlayerProtectSkillActiveUntilMilliseconds: (value) => {
      playerProtectSkillActiveUntilMilliseconds = value
    },
    setPlayerProtectSkillReadyAtMilliseconds: (value) => {
      playerProtectSkillReadyAtMilliseconds = value
    },
    setPlayerRespawnAtMilliseconds: (value) => {
      playerRespawnAtMilliseconds = value
    },
    setPlayerSmashSkillReadyAtMilliseconds: (value) => {
      playerSmashSkillReadyAtMilliseconds = value
    }
  })
  const {
    bossSkillReadyAtById,
    destroy: destroyBossEncounter,
    tryUseBossSkill,
    getActiveBossView,
    updateBossFlashes,
    updateBossHazards,
    clearBossHazards,
    updateBossTonguePull,
    clearBossTonguePull,
    clearBossEncounter,
  } = createBossEncounter({
    app,
    map,
    mountElement,
    wallTiles,
    gameSoundEffects,
    renderedCharacters,
    monsterSpawnStates,
    monsterPigBehaviorStates,
    monsterCombatStates,
    monsterRespawnAtById,
    monsterMagicStatuses,
    npcDialogueOverlay,
    sceneIntroBannerElement,
    sceneIntroTextElement,
    sceneIntroMessage,
    getCharacterStates: () => characterStates,
    getDepthSortedLayer: () => depthSortedLayer,
    getPlayerProfile: () => playerProfile,
    getSceneIntroHideTimeoutId: () => sceneIntroHideTimeoutId,
    setSceneIntroHideTimeoutId: (id) => {
      sceneIntroHideTimeoutId = id
    },
    applyDamageToPlayer,
    getCharacterPixelCenter,
    getCharacterStateById,
    isMonsterCombatStateDefeated,
    isPlayerRolling,
    syncCharacterSprite,
    showCharacterDamageText: (...args) => showCharacterDamageText(...args),
    getBlockingCollisionRects: (...args) => getBlockingCollisionRects(...args),
    tryMoveCharacter: (...args) => tryMoveCharacter(...args)
  })

  const {
    spawnMonsterGoldDrop,
    spawnMonsterEquipmentDrop,
    syncActiveMonsterGoldDrops,
    syncActiveMonsterEquipmentDrops,
    resolveMonsterEquipmentDropPickups,
    resolveMonsterGoldDropPickups,
    resolveCoinPilePickups
  } = createMonsterDrops({
    map,
    tilesetResources,
    monsterEquipmentDropTexturesByDropId,
    monsterGoldDrops,
    monsterEquipmentDrops,
    coinPileSprites,
    collectedCoinTileKeySet,
    onCoinPileCollected,
    onPlayerInventoryChange,
    getCharacterStateById,
    setQuestLogWithObjectiveFeedback,
    syncPlayerUiOverlays,
    showCharacterDamageText: (...args) => showCharacterDamageText(...args),
    getDepthSortedLayer: () => depthSortedLayer,
    getCurrentQuestLog: () => currentQuestLog,
    getCurrentPlayerInventory: () => currentPlayerInventory,
    setCurrentPlayerInventory: (value) => {
      currentPlayerInventory = value
    }
  })

  const {
    syncPlayerProtectSkillVisual,
    syncPlayerWeaponSprite
  } = createPlayerGearVisuals({
    getPlayerMagicCast,
    playerProfile,
    playerWeaponAppearanceTexturesByItemId,
    playerWeaponTexture,
    renderedCharacters,
    getCurrentPlayerEquipment: () => currentPlayerEquipment,
    getPlayerProtectSkillActiveUntilMilliseconds: () => playerProtectSkillActiveUntilMilliseconds,
    getPlayerProtectSkillSprite: () => playerProtectSkillSprite,
    getPlayerRollState: () => playerRollState,
    getPlayerWeaponSprite: () => playerWeaponSprite,
    getPlayerWeaponTrailSprites: () => playerWeaponTrailSprites,
    getPlayerAttackFacing: () => playerAttackFacing,
    getPlayerAttackStartedAtMilliseconds: () => playerAttackStartedAtMilliseconds,
    setPlayerAttackFacing: (value) => {
      playerAttackFacing = value
    },
    setPlayerAttackResolvedStartedAtMilliseconds: (value) => {
      playerAttackResolvedStartedAtMilliseconds = value
    },
    setPlayerAttackStartedAtMilliseconds: (value) => {
      playerAttackStartedAtMilliseconds = value
    }
  })
  const {
    showCharacterMessage,
    hideCharacterMessage,
    syncActiveCharacterMessages
  } = createCharacterMessages({
    map,
    messageLayer,
    messagePanelTexture,
    characterPixelWidth,
    characterPixelHeight,
    activeCharacterMessages,
    getCharacterStates: () => characterStates
  })
  const {
    applyEventDraft,
    applyLuaScript,
    applyNpcConfigUpdate,
    grantInventoryItem,
    removeInventoryItem
  } = createEditorEventApply({
    controllerRuntime,
    onPlayerInventoryChange,
    grantPlayerExperienceReward,
    syncCharacterSprite,
    syncQuestNpcBadges,
    showCharacterMessage,
    getCharacterStates: () => characterStates,
    getCurrentPlayerInventory: () => currentPlayerInventory,
    setCharacterStates: (value) => {
      characterStates = value
    },
    setCurrentPlayerInventory: (value) => {
      currentPlayerInventory = value
    }
  })
  const pruneExpiredCharacterMessages = (now: number) => {
    for (const [characterId, activeMessage] of activeCharacterMessages) {
      if (activeMessage.expiresAt > now) {
        continue
      }

      activeMessage.container.removeFromParent()
      activeMessage.container.destroy({ children: true })
      activeCharacterMessages.delete(characterId)
    }
  }

  const {
    showCharacterDamageText,
    syncActiveCharacterDamageTexts,
    pruneExpiredCharacterDamageTexts
  } = createCharacterDamageTexts({
    map,
    messageLayer,
    characterPixelWidth,
    characterPixelHeight,
    activeCharacterDamageTexts,
    getCharacterStates: () => characterStates
  })
  const {
    centerCameraOnCharacter,
    getBlockingCollisionRects,
    tryMoveCharacter
  } = createMovement({
    cameraTargetCharacterId,
    characterPixelHeight,
    characterPixelWidth,
    getCharacterStateById,
    isMonsterCharacter,
    map,
    syncCharacterSprite,
    viewportElement,
    wallTiles,
    getCameraZoom: () => cameraZoom,
    getScaledMapPixelHeight: () => scaledMapPixelHeight,
    getScaledMapPixelWidth: () => scaledMapPixelWidth,
    getCharacterStates: () => characterStates,
    setCharacterStates: (value) => {
      characterStates = value
    }
  })
  const {
    updateCharacters
  } = createFrameUpdate({
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
    getBossHealthOverlay: () => bossHealthOverlay,
    getCharacterStates: () => characterStates,
    getCurrentPlayerEquipment: () => currentPlayerEquipment,
    getCurrentPlayerInventory: () => currentPlayerInventory,
    getCurrentQuestLog: () => currentQuestLog,
    getIsPauseMenuOpen: () => isPauseMenuOpen,
    getIsSceneTransitionPending: () => isSceneTransitionPending,
    getStatusEffectsOverlay: () => statusEffectsOverlay,
    getSyncPlayerCharacterVisual: () => syncPlayerCharacterVisual,
    getLastPushedSnapshotJson: () => lastPushedSnapshotJson,
    getLastRuntimeErrorMessage: () => lastRuntimeErrorMessage,
    setLastPushedSnapshotJson: (value) => {
      lastPushedSnapshotJson = value
    },
    setLastRuntimeErrorMessage: (value) => {
      lastRuntimeErrorMessage = value
    }
  })
  const {
    handleKeyDown,
    handleKeyUp,
    handleViewportWheel,
    handleVisibilityChange,
    handleWindowBlur,
    handleWindowResize
  } = createInputHandlers({
    app,
    cameraTargetCharacterId,
    centerCameraOnCharacter,
    clearPressedInputState,
    closeAllOverlays,
    getCharacterStateById,
    getQuickslotIndexFromKeyboardEvent,
    handleConsumableUsed,
    isInteractiveUiEventTarget,
    mapOverlay,
    onPlayerInventoryChange,
    onPlayerQuickslotsChange,
    playerProfile,
    playerRollInputState,
    pressedActions,
    pressedDirections,
    requestPlayerPortalTransition,
    setCameraZoom,
    setPauseMenuOpen,
    setPlayerEquipmentOpen,
    setPlayerSkillOpen,
    setPlayerStatOpen,
    setPlayerUiOpen,
    setQuestLogOpen,
    stopPlayerFootsteps,
    syncPlayerUiOverlays,
    syncViewportDisplayScale,
    triggerPlayerRollFromPressedDirection,
    triggeredActions,
    triggeredSkillSlotIndexes,
    updatePlayerControlBindings,
    getCameraZoom: () => cameraZoom,
    getCurrentPlayerControlBindings: () => currentPlayerControlBindings,
    getIsPauseMenuOpen: () => isPauseMenuOpen,
    getIsPlayerEquipmentOpen: () => isPlayerEquipmentOpen,
    getIsPlayerSkillOpen: () => isPlayerSkillOpen,
    getIsPlayerStatOpen: () => isPlayerStatOpen,
    getIsPlayerUiOpen: () => isPlayerUiOpen,
    getIsQuestLogOpen: () => isQuestLogOpen,
    getPlayerRollState: () => playerRollState,
    getCurrentPlayerInventory: () => currentPlayerInventory,
    getCurrentPlayerQuickslots: () => currentPlayerQuickslots,
    getPendingControlBindingId: () => pendingControlBindingId,
    setCurrentPlayerInventory: (value) => {
      currentPlayerInventory = value
    },
    setCurrentPlayerQuickslots: (value) => {
      currentPlayerQuickslots = value
    },
    setPendingControlBindingId: (value) => {
      pendingControlBindingId = value
    },
    setPlayerAttackQueuedAfterRoll: (value) => {
      playerAttackQueuedAfterRoll = value
    }
  })
  windowStack = createWindowStack(mountElement)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('blur', handleWindowBlur)
  window.addEventListener('resize', handleWindowResize)
  viewportElement.addEventListener('wheel', handleViewportWheel, {
    passive: false
  })
  document.addEventListener('visibilitychange', handleVisibilityChange)
  app.ticker.add(updateCharacters)
  app.ticker.add(mapOverlay.syncFrame, undefined, UPDATE_PRIORITY.UTILITY)
  app.ticker.add(playerHudOverlay.syncFrame, undefined, UPDATE_PRIORITY.UTILITY)
  app.ticker.add(
    playerInventoryOverlay.syncFrame,
    undefined,
    UPDATE_PRIORITY.UTILITY
  )
  app.ticker.add(
    playerEquipmentOverlay.syncFrame,
    undefined,
    UPDATE_PRIORITY.UTILITY
  )
  app.ticker.add(playerStatOverlay.syncFrame, undefined, UPDATE_PRIORITY.UTILITY)
  app.ticker.add(
    playerSkillOverlay.syncFrame,
    undefined,
    UPDATE_PRIORITY.UTILITY
  )
  app.ticker.add(questLogOverlay.syncFrame, undefined, UPDATE_PRIORITY.UTILITY)
  app.ticker.add(playerShopOverlay.syncFrame, undefined, UPDATE_PRIORITY.UTILITY)
  app.ticker.add(pauseMenuOverlay.syncFrame, undefined, UPDATE_PRIORITY.UTILITY)
  app.ticker.add(questTrackerOverlay.syncFrame, undefined, UPDATE_PRIORITY.UTILITY)
  syncAllCharacterSprites()
  syncQuestNpcBadges()
  syncViewportDisplayScale()
  centerCameraOnCharacter(getCharacterStateById(cameraTargetCharacterId))
  showSceneIntroBanner()
  runSceneEnterAutoTurnIns()
  mapOverlay.syncFrame()
  playerHudOverlay.syncFrame()
  playerInventoryOverlay.syncFrame()
  playerEquipmentOverlay.syncFrame()
  playerStatOverlay.syncFrame()
  playerSkillOverlay.syncFrame()
  questLogOverlay.syncFrame()
  playerShopOverlay.syncFrame()
  pauseMenuOverlay.syncFrame()
  questTrackerOverlay.syncFrame()
  handleVisibilityChange()

  let flowingWaterTime = 0
  const animateFlowingWater = (): void => {
    if (flowingWaterSurfaces.length === 0) return
    flowingWaterTime += app.ticker.deltaMS / 1000
    for (const flowingWaterSurface of flowingWaterSurfaces) {
      flowingWaterSurface.update(flowingWaterTime)
    }
  }
  app.ticker.add(animateFlowingWater)

  const {
    refreshPlacements,
    refreshNpcs,
    spawnNpcNearPlayer,
    setPlacementMode,
    setPlacementTemplate,
    destroy: destroyEditorPlacement
  } = createEditorPlacement({
    app,
    world,
    map,
    sceneId,
    tilesetResources,
    characterTilesetResources,
    characterSpriteSheet,
    controllerRuntime,
    wallTiles,
    themeColorTargets,
    appliedAtlasUrl,
    renderedCharacters,
    interactionLockUntilByCharacterPair,
    lpcPlaceholderTexture,
    getLpcNpcSheetsFor,
    createLpcCharacterNode,
    attachCharacterLabelLayer,
    syncCharacterSprite,
    getCharacterStateById,
    getBlockingCollisionRects: (excludedCharacterId) => getBlockingCollisionRects(excludedCharacterId),
    getDepthSortedLayer: () => depthSortedLayer,
    getCharacterStates: () => characterStates,
    setCharacterStates: (value) => {
      characterStates = value
    }
  })

  // 저장된 배치/NPC를 부팅 시 반영한다(맵별).
  refreshPlacements()
  refreshNpcs()

  const destroy = () => {
    if (isDestroyed) {
      return
    }

    isDestroyed = true
    window.removeEventListener('keydown', handleKeyDown)
    windowStack.destroy()
    window.removeEventListener('keyup', handleKeyUp)
    window.removeEventListener('blur', handleWindowBlur)
    window.removeEventListener('resize', handleWindowResize)
    viewportElement.removeEventListener('wheel', handleViewportWheel)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    destroyEditorPlacement()
    app.ticker.remove(updateCharacters)
    app.ticker.remove(animateFlowingWater)
    for (const flowingWaterSurface of flowingWaterSurfaces) {
      flowingWaterSurface.destroy()
    }
    flowingWaterSurfaces.length = 0
    for (const rippleTextures of waterRippleTexturesByKey.values()) {
      for (const rippleTexture of rippleTextures) {
        rippleTexture.destroy(true)
      }
    }
    waterRippleTexturesByKey.clear()
    app.ticker.remove(mapOverlay.syncFrame)
    app.ticker.remove(playerHudOverlay.syncFrame)
    app.ticker.remove(playerInventoryOverlay.syncFrame)
    app.ticker.remove(playerEquipmentOverlay.syncFrame)
    app.ticker.remove(playerStatOverlay.syncFrame)
    app.ticker.remove(playerSkillOverlay.syncFrame)
    app.ticker.remove(questLogOverlay.syncFrame)
    app.ticker.remove(playerShopOverlay.syncFrame)
    app.ticker.remove(pauseMenuOverlay.syncFrame)
    app.ticker.remove(questTrackerOverlay.syncFrame)
    gameEventQueue.clear()
    monsterPatrolStates.clear()
    monsterSpawnStates.clear()
    monsterCombatStates.clear()
    monsterContactDamageLockedUntilById.clear()
    monsterRespawnAtById.clear()
    bossSkillReadyAtById.clear()
    clearBossHazards()
    clearBossTonguePull()
    clearPlayerSmashSkillEffectSprites()
    clearPlayerProjectiles()
    clearMagicEffects()
    for (const monsterGoldDrop of monsterGoldDrops.values()) {
      monsterGoldDrop.container.destroy({ children: true })
    }
    monsterGoldDrops.clear()
    for (const monsterEquipmentDrop of monsterEquipmentDrops.values()) {
      monsterEquipmentDrop.container.destroy({ children: true })
    }
    monsterEquipmentDrops.clear()
    for (const coinPile of coinPileSprites.values()) {
      coinPile.sprite.destroy()
    }
    coinPileSprites.clear()
    monsterPigAnimatedSprites.clear()
    monsterPigAnimationModes.clear()
    monsterPigBehaviorStates.clear()
    for (const activeDamageText of activeCharacterDamageTexts.values()) {
      activeDamageText.container.destroy({ children: true })
    }
    activeCharacterDamageTexts.clear()
    window.clearTimeout(sceneIntroHideTimeoutId)
    for (const activeMessage of activeCharacterMessages.values()) {
      activeMessage.container.destroy({ children: true })
    }
    activeCharacterMessages.clear()
    runtimeWarningBannerElement.remove()
    sceneIntroBannerElement.remove()
    mapOverlay.destroy()
    playerHudOverlay.destroy()
    playerInventoryOverlay.destroy()
    playerEquipmentOverlay.destroy()
    playerStatOverlay.destroy()
    playerSkillOverlay.destroy()
    questLogOverlay.destroy()
    playerShopOverlay.destroy()
    potionShopOverlay.destroy()
    herbalistShopOverlay.destroy()
    statusEffectsOverlay.destroy()
    bossHealthOverlay.destroy()
    sceneVignetteElement?.remove()
    destroyBossEncounter()
    app.ticker.speed = 1
    pauseMenuOverlay.destroy()
    questTrackerOverlay.destroy()
    npcDialogueOverlay.destroy()
    gameSoundEffects.destroy()
    controllerRuntime.destroy()
    app.destroy({ removeView: true }, { children: true })
    viewportElement.remove()
  }

  if (import.meta.hot) {
    import.meta.hot.dispose(destroy)
  }

  return {
    destroy,
    updateAudioSettings: updateCurrentAudioSettings,
    applyEventDraft,
    applyLuaScript,
    setPlacementMode,
    setPlacementTemplate,
    refreshPlacements,
    refreshNpcs,
    spawnNpcNearPlayer
  }
}
