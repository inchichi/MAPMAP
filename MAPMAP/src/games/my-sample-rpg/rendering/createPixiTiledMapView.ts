import {
  Application,
  AnimatedSprite,
  Container,
  NineSliceSprite,
  Sprite,
  Text,
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
import { processInteractionEvents } from '../interaction/processInteractionEvents'
import { getEquippedPlayerDefense, getEquippedPlayerWeaponAttackKind } from '../playerEquipment'
import { type PlayerInventory } from '../playerInventory'
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
} from '../playerSkills'
import { PLAYER_MAGIC_CAST_RECOVERY_MILLISECONDS, PLAYER_MAGIC_CAST_WINDUP_MILLISECONDS } from '../playerMagicSkills'
import {
  PLAYER_SMASH_SKILL_COOLDOWN_MILLISECONDS,
  PLAYER_SMASH_SKILL_EFFECT_ANIMATION_SPEED,
  PLAYER_SMASH_SKILL_ID,
  PLAYER_SMASH_SKILL_SEGMENT_COUNT,
  PLAYER_SMASH_SKILL_SEGMENT_DURATION_MILLISECONDS,
  PLAYER_SMASH_SKILL_SEGMENT_STAGGER_MILLISECONDS
} from '../playerSmashSkill'
import { PLAYER_ROLL_COOLDOWN_MILLISECONDS, type PlayerRollState, type PlayerRollVector } from '../playerRoll'
import { type PlayerControlBindingId, type PlayerControlBindings } from '../playerControls'
import {
  completeQuest,
  recordItemAcquireQuestProgress,
  recordItemUseQuestProgress,
  recordMonsterDefeatQuestProgress,
  recordQuestObjectiveProgress,
  getAllQuestDefinitions,
  getQuestProgress,
  recordShopOpenQuestProgress,
  startQuest,
  type CompleteQuestResult,
  type QuestLogState
} from '../questLog'
import { createLuaPlayerStatEffects } from '../playerStatEffectsLua'
import { grantPlayerExperience } from '../playerExperience'
import { rollMonsterEquipmentDrop } from '../monsterEquipmentDrops'
import { grantPlayerSkillPoints } from '../playerProgression'
import {
  createMonsterPatrolState,
  stepMonsterPatrol,
  BOSS_PATROL_RADIUS_TILES,
  type MonsterPatrolState
} from '../monsterPatrol'
import { applyMonsterDamage, isMonsterDefeated, type MonsterCombatState } from '../monsterCombat'
import { createLuaMonsterCombat } from '../monsterCombatLua'
import { createLuaMonsterRewards } from '../monsterRewardsLua'
import { createLuaBlacksmithPricing } from '../blacksmithShopLua'
import {
  getPlayerEquipmentItemDefinitionById,
  usePlayerQuickslotConsumable,
  clearPlayerQuickslotAssignment,
  getPlayerSkillSlotIndexFromCode,
  getPlayerSkillDamageById,
  getPlayerSkillManaCostById,
  getPlayerSkillLevelById,
  getPlayerProtectSkillDurationByLevel,
  isPlayerSkillUnlockedInProfile,
  moveCharacterState,
  getPlayerSmashSkillSegmentPlacement,
  getPlayerRollDistanceTiles,
  getPlayerRollProgress,
  normalizePlayerRollVector,
  createInitialPlayerControlBindings,
  getPlayerControlActionFromCode,
  getPlayerControlMovementDirectionFromCode,
  getPlayerControlQuickslotIndexFromCode,
  isPlayerControlCaptureModifierKey,
  isPlayerControlPauseKey,
  setPlayerControlBinding,
  getPlayerControlBindingDisplayText
} from '../lua/luaGameLogic'
import { resolveCharacterInteractionTarget } from '../interaction/resolveCharacterInteractionTarget'
import { createMapPortalsFromEventLayers, type MapPortal } from '../tiled/createMapPortalsFromEventLayers'
import { createWallTileLookup } from '../tiled/createWallTileLookup'
import {
  doCollisionRectsIntersect,
  isCharacterPositionBlocked,
  resolveCornerAssistNudge,
  type CollisionRect
} from './characterCollision'
import { createTileTexture, type TilesetRenderResources } from './tiledMapRenderResources'
import { createMapOverlay } from './createMapOverlay'
import { createBlacksmithShopOverlay } from './createBlacksmithShopOverlay'
import { createPotionShopOverlay } from './createPotionShopOverlay'
import { createPlayerEquipmentOverlay } from './createPlayerEquipmentOverlay'
import { createPlayerHudOverlay } from './createPlayerHudOverlay'
import { createPlayerInventoryOverlay } from './createPlayerInventoryOverlay'
import { createPlayerStatOverlay } from './createPlayerStatOverlay'
import { createPlayerSkillOverlay } from './createPlayerSkillOverlay'
import { createNpcDialogueOverlay } from './createNpcDialogueOverlay'
import { buildLuaRuntimeSnapshot } from '../lua/buildLuaRuntimeSnapshot'
import type { MonsterAnimationTextures } from './monsterAnimationTextures'
import {
  BOSS_DAMAGE_MULTIPLIER,
  BOSS_RENDER_SCALE_MULTIPLIER,
  MONSTER_HP_MULTIPLIER,
  getBossHpMultiplier
} from '../monsterTuning'
import { loadLpcMonsterTextures } from './loadLpcMonsterTextures'
import {
  DEFAULT_MONSTER_DEATH_SOUND,
  MONSTER_CATALOG,
  getMonsterCatalogEntry,
  type MonsterBehaviorConfig
} from './monsterCatalog'
import { createGameSoundEffects, isGameSoundEffectId } from './createGameSoundEffects'
import { createPauseMenuOverlay, type AudioSettings } from './createPauseMenuOverlay'
import { createQuestLogOverlay } from './createQuestLogOverlay'
import { createQuestTrackerOverlay } from './createQuestTrackerOverlay'
import { createStatusEffectsOverlay, type StatusEffectPill } from './createStatusEffectsOverlay'
import { createBossEncounter } from './mapView/bossEncounter'
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
import { createBossHealthOverlay } from './createBossHealthOverlay'
import {
  ANTIDOTE_INCENSE_DURATION_MILLISECONDS,
  ANTIDOTE_INCENSE_ITEM_ID,
  POISON_FOG_TICK_MILLISECONDS,
  getPoisonFogDamage,
  getRemainingImmunitySeconds,
  isPoisonFogImmune,
  isPoisonFogTileType,
  BLIZZARD_MOVE_SPEED_MULTIPLIER,
  WARMING_TEA_DURATION_MILLISECONDS,
  WARMING_TEA_ITEM_ID,
  isBlizzardTileType
} from '../poisonFog'
import { isBossSummonCharacterId } from '../bossSkills'
import { isUndergroundScene } from './mapLights'
import { createWindowStack } from './createWindowStack'
import {
  BLACKSMITH_SHOP_NPC_ID,
  BOSS_RETRY_RESPAWN_DELAY_MILLISECONDS,
  CAMERA_DEFAULT_ZOOM,
  CAMERA_ZOOM_WHEEL_SPEED,
  DAMAGE_TEXT_DURATION_MILLISECONDS,
  DAMAGE_TEXT_STYLE,
  EVADE_TEXT_DURATION_MILLISECONDS,
  EVADE_TEXT_STYLE,
  GAME_VIEWPORT_HEIGHT,
  GAME_VIEWPORT_WIDTH,
  HERBALIST_SHOP_ID,
  HERBALIST_SHOP_NPC_IDS,
  LEVEL_UP_TEXT_STYLE,
  MESSAGE_PANEL_BORDER_SIZE,
  MONSTER_ATTACK_RANGE_TOUCH_TOLERANCE_TILES,
  MONSTER_CONTACT_DAMAGE_COOLDOWN_MILLISECONDS,
  MONSTER_CONTACT_DAMAGE_TOUCH_TOLERANCE_TILES,
  MONSTER_EQUIPMENT_DROP_IMAGE_URL_BY_DROP_ID,
  MONSTER_LEVEL_BADGE_STYLE,
  MONSTER_RESPAWN_DELAY_MILLISECONDS,
  PLAYER_ARMOR_EQUIPMENT_CONFIG,
  PLAYER_ATTACK_COOLDOWN_MILLISECONDS,
  PLAYER_ATTACK_DURATION_MILLISECONDS,
  PLAYER_ATTACK_LIFT_Y_OFFSET,
  PLAYER_ATTACK_PROBE_DISTANCE_IN_TILES,
  PLAYER_ATTACK_ROTATION_OFFSET,
  PLAYER_ATTACK_SCALE_BOOST,
  PLAYER_ATTACK_SLASH_EFFECT_ANIMATION_SPEED,
  PLAYER_ATTACK_SLASH_EFFECT_SCALE_X,
  PLAYER_ATTACK_SLASH_EFFECT_SCALE_Y,
  PLAYER_ATTACK_SWING_X_OFFSET,
  PLAYER_ATTACK_TRAIL_ALPHA,
  PLAYER_ATTACK_TRAIL_PROGRESS_STEP,
  PLAYER_ATTACK_TRAIL_SPRITE_COUNT,
  PLAYER_DAMAGE_INVULNERABILITY_MILLISECONDS,
  PLAYER_EQUIPMENT_APPEARANCE_CONFIG_BY_ITEM_ID,
  PLAYER_HELMET_EQUIPMENT_CONFIG,
  PLAYER_HIT_REACTION_DURATION_MILLISECONDS,
  PLAYER_NAME_BADGE_STYLE,
  PLAYER_PROTECT_SKILL_COOLDOWN_MILLISECONDS,
  PLAYER_RESPAWN_DELAY_MILLISECONDS,
  PLAYER_WEAPON_APPEARANCE_CONFIG_BY_ITEM_ID,
  PLAYER_WEAPON_PLACEMENT_LEFT,
  PLAYER_WEAPON_PLACEMENT_RIGHT,
  PLAYER_WEAPON_TILE_FRAME_SOURCE,
  PLAYER_WEAPON_TILE_LOCAL_ID,
  PLAYER_WEAPON_WORLD_SCALE,
  PORTAL_INSIDE_IMAGE_URL,
  PORTAL_INSIDE_WORLD_SCALE,
  POTION_SHOP_NPC_IDS,
  PROTECT_VFX_ANIMATION_SPEED,
  PROTECT_VFX_SCALE,
  QUEST_COMPLETE_TEXT,
  QUEST_OBJECTIVE_COMPLETE_TEXT,
  SCENE_INTRO_VISIBLE_DURATION_MILLISECONDS,
  SIGN_POST_APPEARANCE_TYPE,
  SIGN_POST_LABEL_STYLE,
  SLASH_VFX_HIT_PADDING_PIXELS,
  TINY_DUNGEON_TILESET_IMAGE_URL,
  WHITE_SLASH_WIDE_FRAME_BOUNDS,
  isBossCharacterId
} from './mapView/constants'
import {
  createMonsterHealthBar,
  createPlayerResourceBar,
  createQuestBadgeSprite,
  getMonsterBehaviorConfig,
  isStationaryMonster
} from './mapView/nodes'
import { addQuestItemRewardsToInventory } from './mapView/questRewards'
import {
  createMessagePanelTexture,
  ensureMessageFontsLoaded,
  loadProtectVfxTextures,
  loadSlashVfxTextures,
  loadTilesetRenderResources
} from './mapView/resources'
import {
  clampCameraZoom,
  clampScrollOffset,
  createCollisionRectFromCharacter,
  createCollisionRectFromPortal,
  createGrassTileLookup,
  createRoofTileLookup,
  getCharacterDepthSortValue,
  getFacingFromRollVector,
  isCharacterOnGrass,
  isPlayerRollModifierCode,
  resolveCharacterTexture,
  resolveTilesetLocalIdByType
} from './mapView/tiles'
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
  type RenderedPortalNode,
  type SceneTransitionRequest
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
  const poisonFogTiles = createRoofTileLookup(map, isPoisonFogTileType)
  let poisonFogNextTickAt = 0
  let wasInPoisonFog = false
  const blizzardTiles = createRoofTileLookup(map, isBlizzardTileType)
  let blizzardNextTickAt = 0
  let wasInBlizzard = false
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
    applyDamageToMonster,
    createPixelCollisionRectFromCharacter,
    getCharacterPixelCenter,
    getCharacterStateById,
    isMonsterCharacter,
    isMonsterCombatStateDefeated,
    resolveClosestMonsterInCollisionRect,
    resolveMonstersInCollisionRect,
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
  const triggerPlayerRoll = (
    vector: PlayerRollVector,
    now: number
  ): boolean => {
    const normalizedVector = normalizePlayerRollVector(vector)

    if (
      !normalizedVector ||
      playerProfile.hp.current === 0 ||
      isSceneTransitionPending ||
      isPlayerCasting(now) ||
      now < playerRollReadyAtMilliseconds
    ) {
      return false
    }

    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
    const facing = getFacingFromRollVector(normalizedVector, playerCharacter.facing)

    playerRollState = {
      vector: normalizedVector,
      startedAtMilliseconds: now,
      previousDistanceTiles: 0
    }
    playerRollReadyAtMilliseconds =
      now + PLAYER_ROLL_COOLDOWN_MILLISECONDS
    playerHitReactionState = undefined
    gameSoundEffects.play('playerRollWhoosh')
    characterStates = characterStates.map((character) =>
      character.id === PLAYER_CHARACTER_ID
        ? {
            ...playerCharacter,
            facing
          }
        : character
    )
    syncPlayerCharacterVisual(now)

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
  const isPlayerRolling = (now: number): boolean =>
    playerRollState !== undefined &&
    getPlayerRollProgress({
      nowMilliseconds: now,
      startedAtMilliseconds: playerRollState.startedAtMilliseconds
    }) < 1
  const finishPlayerRoll = (now: number): void => {
    playerRollState = undefined
    playerRollReadyAtMilliseconds =
      now + PLAYER_ROLL_COOLDOWN_MILLISECONDS
    syncPlayerCharacterVisual(now)

    if (!playerAttackQueuedAfterRoll) {
      return
    }

    playerAttackQueuedAfterRoll = false
    triggerPlayerAttack(now)
  }
  const stepPlayerRoll = (now: number): boolean => {
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

    playerRollState = {
      ...playerRollState,
      previousDistanceTiles: nextDistanceTiles
    }

    if (deltaDistanceTiles <= 0) {
      if (isRollComplete) {
        finishPlayerRoll(now)
      } else {
        syncPlayerCharacterVisual(now)
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
    if (playerProfile.hp.current === 0) {
      return false
    }

    if (now < playerProtectSkillReadyAtMilliseconds) {
      return false
    }

    const protectSkillLevel =
      getPlayerSkillLevelById(playerProfile, PLAYER_PROTECT_SKILL_ID) ?? 1

    playerProtectSkillActiveUntilMilliseconds =
      now + getPlayerProtectSkillDurationByLevel(protectSkillLevel)
    playerProtectSkillReadyAtMilliseconds =
      now + PLAYER_PROTECT_SKILL_COOLDOWN_MILLISECONDS
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

    if (now < playerSmashSkillReadyAtMilliseconds) {
      return false
    }

    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)

    clearPlayerSmashSkillEffectSprites()
    playerSmashSkillOrigin = {
      x: playerCharacter.position.x * map.tileWidth + characterPixelWidth / 2,
      y: playerCharacter.position.y * map.tileHeight + characterPixelHeight / 2
    }
    playerSmashSkillStartedAtMilliseconds = now
    playerSmashSkillFacing = playerCharacter.facing
    playerSmashSkillReadyAtMilliseconds =
      now + PLAYER_SMASH_SKILL_COOLDOWN_MILLISECONDS
    playerSmashSkillHitMonsterIds.clear()
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
        // 스매시는 검 계열(근접 무기) 스킬 — 지팡이·활로는 쓸 수 없다.
        if (getEquippedPlayerWeaponAttackKind(currentPlayerEquipment) !== 'melee') {
          showPlayerMagicMessage('근접 무기를 들어야 한다')
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
          playerAttackQueuedAfterRoll = true
        }
        break
      }
      case PLAYER_FOCUS_SKILL_ID: {
        if (
          now < playerFocusSkillReadyAtMilliseconds ||
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
        playerFocusSkillReadyAtMilliseconds = now + 5000
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
      default:
        return false
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
    const skillSlot = currentPlayerSkillSlots.slots[skillSlotIndex]

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
    playerAttackStartedAtMilliseconds = now
    playerAttackResolvedStartedAtMilliseconds = options?.suppressDamage
      ? now
      : undefined
    playerAttackFacing = character.facing
    playPlayerSlashEffect(character)
  }
  const clearPlayerSlashEffectSprite = () => {
    if (!playerSlashEffectSprite) {
      return
    }

    const sprite = playerSlashEffectSprite

    playerSlashEffectSprite = undefined
    sprite.removeFromParent()
    sprite.destroy()
  }
  const clearPlayerProtectSkillEffectSprite = () => {
    if (!playerProtectSkillSprite) {
      return
    }

    playerProtectSkillSprite.visible = false
    playerProtectSkillSprite.stop()
    playerProtectSkillSprite.gotoAndStop(0)
  }
  const playPlayerSlashEffect = (character: CharacterState) => {
    clearPlayerSlashEffectSprite()

    const isHorizontalSlash =
      character.facing !== 'up' && character.facing !== 'down'
    const slashTextures = isHorizontalSlash
      ? slashVfxTextures.horizontalTextures
      : slashVfxTextures.verticalTextures
    const slashSprite = new AnimatedSprite(slashTextures)
    const slashBaseScaleX =
      character.facing === 'left'
        ? -PLAYER_ATTACK_SLASH_EFFECT_SCALE_X
        : PLAYER_ATTACK_SLASH_EFFECT_SCALE_X

    slashSprite.label = 'character:player:slash-effect'
    slashSprite.anchor.set(0.5)
    slashSprite.animationSpeed = PLAYER_ATTACK_SLASH_EFFECT_ANIMATION_SPEED
    slashSprite.loop = false
    slashSprite.roundPixels = true
    slashSprite.rotation = isHorizontalSlash
      ? 0
      : character.facing === 'up'
        ? -Math.PI / 2
        : Math.PI / 2
    slashSprite.position.set(
      character.position.x * map.tileWidth + characterPixelWidth / 2,
      character.position.y * map.tileHeight + characterPixelHeight / 2 - 1
    )
    slashSprite.scale.set(slashBaseScaleX, PLAYER_ATTACK_SLASH_EFFECT_SCALE_Y)
    slashSprite.zIndex =
      getCharacterDepthSortValue(
        character.position.y,
        characterPixelHeight,
        map.tileHeight
      ) + 1
    slashSprite.onComplete = () => {
      if (playerSlashEffectSprite === slashSprite) {
        playerSlashEffectSprite = undefined
      }
      slashSprite.removeFromParent()
      slashSprite.destroy()
    }

    playerSlashEffectSprite = slashSprite
    depthSortedLayer?.addChild(slashSprite)
    depthSortedLayer?.sortChildren()
    slashSprite.play()
  }
  const clearPlayerSmashSkillEffectSprites = () => {
    if (playerSmashSkillSegments.length === 0) {
      playerSmashSkillStartedAtMilliseconds = undefined
      playerSmashSkillFacing = undefined
      playerSmashSkillOrigin = undefined
      playerSmashSkillHitMonsterIds.clear()
      return
    }

    for (const segment of playerSmashSkillSegments) {
      segment.sprite.removeFromParent()
      segment.sprite.destroy()
    }

    playerSmashSkillSegments = []
    playerSmashSkillStartedAtMilliseconds = undefined
    playerSmashSkillFacing = undefined
    playerSmashSkillOrigin = undefined
    playerSmashSkillHitMonsterIds.clear()
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
      playerSmashSkillOrigin?.x ??
      (character.position.x * map.tileWidth + characterPixelWidth / 2)
    const originY =
      playerSmashSkillOrigin?.y ??
      (character.position.y * map.tileHeight + characterPixelHeight / 2)
    const baseZIndex = Math.round(originY + characterPixelHeight / 2) + 1

    playerSmashSkillSegments = Array.from(
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
        depthSortedLayer?.addChild(slashSprite)

        return {
          sprite: slashSprite,
          delayMilliseconds:
            segmentIndex * PLAYER_SMASH_SKILL_SEGMENT_STAGGER_MILLISECONDS,
          started: false,
          index: segmentIndex
        }
      }
    )
    depthSortedLayer?.sortChildren()

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
    if (playerSmashSkillStartedAtMilliseconds === undefined) {
      return
    }

    const facing = playerSmashSkillFacing ?? character.facing
    const originX = playerSmashSkillOrigin?.x ?? characterCenterX
    const originY = playerSmashSkillOrigin?.y ?? characterCenterY
    const totalLifetimeMilliseconds =
      PLAYER_SMASH_SKILL_SEGMENT_DURATION_MILLISECONDS +
      PLAYER_SMASH_SKILL_SEGMENT_STAGGER_MILLISECONDS *
        (PLAYER_SMASH_SKILL_SEGMENT_COUNT - 1)
    const elapsedMilliseconds =
      now - playerSmashSkillStartedAtMilliseconds

    for (const segment of playerSmashSkillSegments) {
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

    depthSortedLayer?.sortChildren()
  }
  const stopPlayerFootsteps = () => {
    gameSoundEffects.stop('grassFootstep')
  }
  const syncPlayerFootsteps = (didPlayerMove: boolean) => {
    if (
      !didPlayerMove ||
      playerProfile.hp.current === 0 ||
      isPauseMenuOpen ||
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
  const setPlayerUiOpen = (nextIsOpen: boolean) => {
    if (isPlayerUiOpen === nextIsOpen) {
      return
    }

    isPlayerUiOpen = nextIsOpen
    if (nextIsOpen) {
      windowStack.raise('.player-inventory-overlay')
    }
    syncPlayerUiOverlays()
  }
  const setPlayerStatOpen = (nextIsOpen: boolean) => {
    if (isPlayerStatOpen === nextIsOpen) {
      return
    }

    isPlayerStatOpen = nextIsOpen
    if (nextIsOpen) {
      windowStack.raise('.player-stat-overlay')
    }
    syncPlayerUiOverlays()
  }
  const setPlayerEquipmentOpen = (nextIsOpen: boolean) => {
    if (isPlayerEquipmentOpen === nextIsOpen) {
      return
    }

    isPlayerEquipmentOpen = nextIsOpen
    if (nextIsOpen) {
      windowStack.raise('.player-equipment-overlay')
    }
    syncPlayerUiOverlays()
  }
  const setPlayerSkillOpen = (nextIsOpen: boolean) => {
    if (isPlayerSkillOpen === nextIsOpen) {
      return
    }

    isPlayerSkillOpen = nextIsOpen
    if (nextIsOpen) {
      windowStack.raise('.player-skill-overlay')
    }
    syncPlayerUiOverlays()
  }
  const setQuestLogOpen = (nextIsOpen: boolean) => {
    if (isQuestLogOpen === nextIsOpen) {
      return
    }

    isQuestLogOpen = nextIsOpen
    if (nextIsOpen) {
      windowStack.raise('.quest-log-overlay')
    }
    syncPlayerUiOverlays()
  }
  const setBlacksmithShopOpen = (nextIsOpen: boolean) => {
    if (isBlacksmithShopOpen === nextIsOpen) {
      return
    }

    if (nextIsOpen) {
      isQuestLogOpen = false
      isPotionShopOpen = false
      isHerbalistShopOpen = false
    }

    isBlacksmithShopOpen = nextIsOpen
    if (nextIsOpen) {
      windowStack.raise('.blacksmith-shop-overlay')
      setQuestLogWithObjectiveFeedback(
        recordShopOpenQuestProgress(currentQuestLog, 'blacksmith')
      )
    }
    syncPlayerUiOverlays()
  }
  const setPotionShopOpen = (nextIsOpen: boolean) => {
    if (isPotionShopOpen === nextIsOpen) {
      return
    }

    if (nextIsOpen) {
      isQuestLogOpen = false
      isBlacksmithShopOpen = false
      isHerbalistShopOpen = false
    }

    isPotionShopOpen = nextIsOpen
    if (nextIsOpen) {
      windowStack.raise('.blacksmith-shop-overlay')
      setQuestLogWithObjectiveFeedback(
        recordShopOpenQuestProgress(currentQuestLog, 'potion')
      )
    }
    syncPlayerUiOverlays()
  }
  // 2장 갈대골 약초꾼 오디의 상점(해독 향). 물약 상점 화면을 이름·진열만 바꿔 쓴다.
  const setHerbalistShopOpen = (nextIsOpen: boolean) => {
    if (isHerbalistShopOpen === nextIsOpen) {
      return
    }

    if (nextIsOpen) {
      isQuestLogOpen = false
      isBlacksmithShopOpen = false
      isPotionShopOpen = false
    }

    isHerbalistShopOpen = nextIsOpen
    if (nextIsOpen) {
      windowStack.raise('.blacksmith-shop-overlay')
      setQuestLogWithObjectiveFeedback(
        recordShopOpenQuestProgress(currentQuestLog, HERBALIST_SHOP_ID)
      )
    }
    syncPlayerUiOverlays()
  }
  const setPauseMenuOpen = (nextIsOpen: boolean) => {
    if (isPauseMenuOpen === nextIsOpen) {
      return
    }

    isPauseMenuOpen = nextIsOpen
    pendingControlBindingId = undefined
    if (nextIsOpen) {
      isPlayerUiOpen = false
      isPlayerStatOpen = false
      isPlayerEquipmentOpen = false
      isPlayerSkillOpen = false
      isQuestLogOpen = false
      isBlacksmithShopOpen = false
      isPotionShopOpen = false
      isHerbalistShopOpen = false
      mapOverlay.setExpanded(false)
      gameSoundEffects.stopAllLoops()
    }
    clearPressedInputState()
    syncPlayerUiOverlays()
  }
  const updateCurrentAudioSettings = (nextAudioSettings: AudioSettings) => {
    currentAudioSettings = nextAudioSettings
    // 음소거는 마스터 볼륨에 곱해 적용 — 해제 시 저장된 sfxVolume이 그대로 돌아온다.
    gameSoundEffects.setMasterVolume(
      currentAudioSettings.isMuted ? 0 : currentAudioSettings.sfxVolume
    )
    onAudioSettingsChange(currentAudioSettings)
    pauseMenuOverlay.syncFrame()
  }
  const setQuestLog = (nextQuestLog: QuestLogState) => {
    if (currentQuestLog === nextQuestLog) {
      return
    }

    currentQuestLog = nextQuestLog
    onQuestLogChange(nextQuestLog)
    questLogOverlay.syncFrame()
    questTrackerOverlay.syncFrame()
    syncQuestNpcBadges()
  }
  const setQuestLogWithObjectiveFeedback = (nextQuestLog: QuestLogState) => {
    const previousQuestLog = currentQuestLog

    if (previousQuestLog === nextQuestLog) {
      return
    }

    const didCompleteObjective = Object.entries(
      previousQuestLog.progressByQuestId
    ).some(([questId, previousQuest]) => {
      const nextQuest = nextQuestLog.progressByQuestId[questId]

      return (
        previousQuest.status === 'active' &&
        nextQuest?.status === 'ready-to-turn-in'
      )
    })

    setQuestLog(nextQuestLog)

    if (didCompleteObjective) {
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        QUEST_OBJECTIVE_COMPLETE_TEXT,
        DAMAGE_TEXT_DURATION_MILLISECONDS,
        LEVEL_UP_TEXT_STYLE
      )
    }
  }
  // 인벤토리 id별 수량 집계.
  const countInventoryItemsById = (
    inventory: PlayerInventory
  ): Map<string, number> => {
    const counts = new Map<string, number>()
    for (const slot of inventory.slots) {
      if (slot) {
        counts.set(slot.id, (counts.get(slot.id) ?? 0) + slot.quantity)
      }
    }
    return counts
  }
  // 상점 구매처럼 어떤 아이템을 얻었는지 직접 안 알려주는 경로에서, 인벤 전/후를 비교해 늘어난
  // 아이템만큼 "획득" 퀘스트 진행을 기록한다.
  const recordAcquiredItemsFromInventoryDelta = (
    previousInventory: PlayerInventory,
    nextInventory: PlayerInventory
  ): void => {
    const previousCounts = countInventoryItemsById(previousInventory)
    let nextQuestLog = currentQuestLog
    for (const [itemId, nextCount] of countInventoryItemsById(nextInventory)) {
      const gained = nextCount - (previousCounts.get(itemId) ?? 0)
      for (let index = 0; index < gained; index += 1) {
        nextQuestLog = recordItemAcquireQuestProgress(nextQuestLog, itemId)
      }
    }
    setQuestLogWithObjectiveFeedback(nextQuestLog)
  }
  const grantPlayerExperienceReward = (experienceReward: number) => {
    const nextPlayerProgress = grantPlayerExperience(
      playerProfile,
      experienceReward
    )

    if (nextPlayerProgress.nextProfile === playerProfile) {
      return nextPlayerProgress
    }

    Object.assign(playerProfile, nextPlayerProgress.nextProfile)
    syncPlayerUiOverlays()
    if (nextPlayerProgress.levelsGained > 0) {
      gameSoundEffects.play('levelUp')
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        // 능력치 분배 안내: 무기에 맞는 능력치(검·활 = 힘, 지팡이 = 지력)를 올리도록 키를 알려 준다.
        `${
          nextPlayerProgress.levelsGained > 1
            ? `레벨 업 x${nextPlayerProgress.levelsGained}!`
            : '레벨 업!'
        }\n능력치 포인트 +${playerProfile.statPoints} (${getPlayerControlBindingDisplayText(
          currentPlayerControlBindings.stat
        )}키)`,
        DAMAGE_TEXT_DURATION_MILLISECONDS,
        LEVEL_UP_TEXT_STYLE
      )
    }

    return nextPlayerProgress
  }
  const grantQuestCompletionRewards = (result: CompleteQuestResult) => {
    if (!result.didComplete) {
      return
    }

    if (result.goldReward > 0) {
      currentPlayerInventory = {
        ...currentPlayerInventory,
        gold: currentPlayerInventory.gold + result.goldReward
      }
      onPlayerInventoryChange(currentPlayerInventory)
    }

    if (result.itemRewards.length > 0) {
      currentPlayerInventory = addQuestItemRewardsToInventory(
        currentPlayerInventory,
        result.itemRewards
      )
      onPlayerInventoryChange(currentPlayerInventory)
    }

    grantPlayerExperienceReward(result.experienceReward)
    showCharacterDamageText(
      PLAYER_CHARACTER_ID,
      QUEST_COMPLETE_TEXT,
      DAMAGE_TEXT_DURATION_MILLISECONDS,
      LEVEL_UP_TEXT_STYLE
    )
    syncPlayerUiOverlays()
  }
  const handleConsumableUsed = (itemId: string) => {
    if (itemId === ANTIDOTE_INCENSE_ITEM_ID) {
      onPoisonFogImmuneUntilChange(Date.now() + ANTIDOTE_INCENSE_DURATION_MILLISECONDS)
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        '해독 향을 피웠다',
        EVADE_TEXT_DURATION_MILLISECONDS * 2,
        EVADE_TEXT_STYLE
      )
      statusEffectsOverlay.syncFrame()
    }
    if (itemId === WARMING_TEA_ITEM_ID) {
      onColdImmuneUntilChange(Date.now() + WARMING_TEA_DURATION_MILLISECONDS)
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        '생강차를 마셨다',
        EVADE_TEXT_DURATION_MILLISECONDS * 2,
        EVADE_TEXT_STYLE
      )
      statusEffectsOverlay.syncFrame()
    }
    setQuestLogWithObjectiveFeedback(
      recordItemUseQuestProgress(currentQuestLog, itemId)
    )
  }
  // 독안개: 안개 칸에 서 있고 해독 향이 꺼져 있으면 1초마다 최대 체력의 5%. 갑옷·보호 스킬로는 못 막는다
  // (숨이 막히는 것이라 — applyDamageToPlayer 에 공격자를 넘기지 않는다).
  const isPlayerInPoisonFog = (): boolean =>
    poisonFogTiles.size > 0 &&
    isCharacterOnGrass(getCharacterStateById(PLAYER_CHARACTER_ID), poisonFogTiles)
  const resolvePoisonFogDamage = (now: number) => {
    const inFog = isPlayerInPoisonFog() && playerProfile.hp.current > 0
    const immune = isPoisonFogImmune(getPoisonFogImmuneUntil(), Date.now())
    if (inFog && !wasInPoisonFog) {
      poisonFogNextTickAt = now + POISON_FOG_TICK_MILLISECONDS
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        immune ? '해독 향이 독안개를 막는다' : '독안개! 숨이 막힌다',
        EVADE_TEXT_DURATION_MILLISECONDS * 2,
        immune ? EVADE_TEXT_STYLE : DAMAGE_TEXT_STYLE
      )
    }
    wasInPoisonFog = inFog
    if (!inFog || immune || now < poisonFogNextTickAt) {
      return
    }
    poisonFogNextTickAt = now + POISON_FOG_TICK_MILLISECONDS
    applyDamageToPlayer(getPoisonFogDamage(playerProfile.hp.max), now)
  }
  // 눈보라: 독안개와 같은 피해에 걸음이 느려진다. 생강차를 마시면 둘 다 막는다.
  const resolveBlizzardDamage = (now: number) => {
    const inBlizzard =
      blizzardTiles.size > 0 &&
      playerProfile.hp.current > 0 &&
      isCharacterOnGrass(getCharacterStateById(PLAYER_CHARACTER_ID), blizzardTiles)
    const immune = isPoisonFogImmune(getColdImmuneUntil(), Date.now())
    if (inBlizzard && !wasInBlizzard) {
      blizzardNextTickAt = now + POISON_FOG_TICK_MILLISECONDS
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        immune ? '생강차 덕에 몸이 따뜻하다' : '눈보라! 몸이 얼어붙는다',
        EVADE_TEXT_DURATION_MILLISECONDS * 2,
        immune ? EVADE_TEXT_STYLE : DAMAGE_TEXT_STYLE
      )
    }
    wasInBlizzard = inBlizzard
    const slowed = inBlizzard && !immune
    if (slowed !== isSlowedByBlizzard) {
      isSlowedByBlizzard = slowed
      syncPlayerDerivedCharacterStats()
    }
    if (!inBlizzard || immune || now < blizzardNextTickAt) {
      return
    }
    blizzardNextTickAt = now + POISON_FOG_TICK_MILLISECONDS
    applyDamageToPlayer(getPoisonFogDamage(playerProfile.hp.max), now)
  }
  const getStatusEffectPills = (): StatusEffectPill[] => {
    const pills: StatusEffectPill[] = []
    const remaining = getRemainingImmunitySeconds(getPoisonFogImmuneUntil(), Date.now())
    if (remaining > 0) {
      pills.push({ kind: 'buff', text: `해독 향 ${remaining}초` })
    } else if (wasInPoisonFog) {
      pills.push({ kind: 'danger', text: '독안개 — 해독 향이 필요하다' })
    }
    const warm = getRemainingImmunitySeconds(getColdImmuneUntil(), Date.now())
    if (warm > 0) {
      pills.push({ kind: 'buff', text: `생강차 ${warm}초` })
    } else if (wasInBlizzard) {
      pills.push({ kind: 'danger', text: '눈보라 — 생강차가 필요하다' })
    }
    return pills
  }
  handleMapOverlayExpandedChange = (nextIsExpanded: boolean) => {
    if (nextIsExpanded) {
      isPlayerUiOpen = false
      isPlayerStatOpen = false
      isPlayerEquipmentOpen = false
      isPlayerSkillOpen = false
      isQuestLogOpen = false
      isBlacksmithShopOpen = false
      isPotionShopOpen = false
      isPauseMenuOpen = false
      pendingControlBindingId = undefined
      gameSoundEffects.stopAllLoops()
    }
    clearPressedInputState()
    syncPlayerUiOverlays()
  }
  const closeAllOverlays = (): boolean => {
    if (
      !isPlayerUiOpen &&
      !isPlayerStatOpen &&
      !isPlayerEquipmentOpen &&
      !isPlayerSkillOpen &&
      !isQuestLogOpen &&
      !isBlacksmithShopOpen &&
      !isPotionShopOpen &&
      !isHerbalistShopOpen &&
      !isPauseMenuOpen &&
      !mapOverlay.getIsExpanded()
    ) {
      return false
    }

    isPlayerUiOpen = false
    isPlayerStatOpen = false
    isPlayerEquipmentOpen = false
    isPlayerSkillOpen = false
    isQuestLogOpen = false
    isBlacksmithShopOpen = false
    isPotionShopOpen = false
    isPauseMenuOpen = false
    pendingControlBindingId = undefined
    mapOverlay.setExpanded(false)
    gameSoundEffects.stopAllLoops()
    clearPressedInputState()
    syncPlayerUiOverlays()
    return true
  }
  const setControlBindingCaptureTarget = (
    bindingId: PlayerControlBindingId | undefined
  ) => {
    pendingControlBindingId = bindingId
    syncPlayerUiOverlays()
  }
  const updatePlayerControlBindings = (
    nextControlBindings: PlayerControlBindings
  ) => {
    currentPlayerControlBindings = nextControlBindings
    onPlayerControlBindingsChange(nextControlBindings)
  }
  const resetPlayerControlBindings = () => {
    pendingControlBindingId = undefined
    updatePlayerControlBindings(createInitialPlayerControlBindings())
    syncPlayerUiOverlays()
  }
  const requestSceneTransition = (portal: MapPortal) => {
    requestSceneTransitionTo({
      sceneId: portal.targetSceneId,
      spawn: {
        x: portal.targetSpawn.x,
        y: portal.targetSpawn.y
      },
      facing: portal.targetFacing
    })
  }
  // 포탈·귀환 표지석이 같이 쓴다.
  function requestSceneTransitionTo(request: SceneTransitionRequest): void {
    if (isSceneTransitionPending) {
      return
    }

    isSceneTransitionPending = true
    closeAllOverlays()
    clearPressedInputState()
    stopPlayerFootsteps()
    triggeredActions.clear()
    gameEventQueue.clear()
    onRequestSceneChange(request)
  }
  const findTouchedMapPortal = (character: CharacterState): MapPortal | undefined => {
    const characterRect = createCollisionRectFromCharacter(character)

    return mapPortals.find((portal) =>
      doCollisionRectsIntersect(characterRect, createCollisionRectFromPortal(portal))
    )
  }
  const requestPlayerPortalTransition = (): boolean => {
    if (isSceneTransitionPending || playerProfile.hp.current === 0) {
      return false
    }

    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
    const touchedPortal = findTouchedMapPortal(playerCharacter)

    if (!touchedPortal) {
      return false
    }

    requestSceneTransition(touchedPortal)
    return true
  }
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
  playerHudOverlay = createPlayerHudOverlay({
    mountElement,
    profile: playerProfile,
    getInventory: () => currentPlayerInventory,
    getQuickslots: () => currentPlayerQuickslots,
    getSkillSlots: () => currentPlayerSkillSlots,
    onRequestQuickslotChange: (nextQuickslots) => {
      currentPlayerQuickslots = nextQuickslots
      onPlayerQuickslotsChange(nextQuickslots)
      syncPlayerUiOverlays()
    },
    onRequestSkillSlotsChange: (nextSkillSlots) => {
      currentPlayerSkillSlots = nextSkillSlots
      onPlayerSkillSlotsChange(nextSkillSlots)
      syncPlayerUiOverlays()
    }
  })
  playerInventoryOverlay = createPlayerInventoryOverlay({
    mountElement,
    profile: playerProfile,
    getInventory: () => currentPlayerInventory,
    getQuickslots: () => currentPlayerQuickslots,
    getEquipment: () => currentPlayerEquipment,
    getIsOpen: () => isPlayerUiOpen,
    onRequestOpenChange: setPlayerUiOpen,
    onRequestInventoryChange: (nextInventory) => {
      currentPlayerInventory = nextInventory
      onPlayerInventoryChange(nextInventory)
      syncPlayerUiOverlays()
    },
    onRequestEquipmentChange: (nextEquipment) => {
      currentPlayerEquipment = nextEquipment
      onPlayerEquipmentChange(nextEquipment)
      syncPlayerCharacterVisual()
      syncPlayerUiOverlays()
    },
    onRequestProfileChange: (nextProfile) => {
      Object.assign(playerProfile, nextProfile)
      syncPlayerUiOverlays()
    },
    onConsumableUsed: handleConsumableUsed
  })
  playerEquipmentOverlay = createPlayerEquipmentOverlay({
    mountElement,
    profile: playerProfile,
    getInventory: () => currentPlayerInventory,
    getEquipment: () => currentPlayerEquipment,
    getIsOpen: () => isPlayerEquipmentOpen,
    onRequestOpenChange: setPlayerEquipmentOpen,
    onRequestInventoryChange: (nextInventory) => {
      currentPlayerInventory = nextInventory
      onPlayerInventoryChange(nextInventory)
      syncPlayerUiOverlays()
    },
    onRequestEquipmentChange: (nextEquipment) => {
      currentPlayerEquipment = nextEquipment
      onPlayerEquipmentChange(nextEquipment)
      syncPlayerCharacterVisual()
      syncPlayerUiOverlays()
    }
  })
  playerStatOverlay = createPlayerStatOverlay({
    mountElement,
    profile: playerProfile,
    getIsOpen: () => isPlayerStatOpen,
    onRequestOpenChange: setPlayerStatOpen,
    onRequestProfileChange: (nextProfile) => {
      Object.assign(playerProfile, nextProfile)
      syncPlayerUiOverlays()
    }
  })
  playerSkillOverlay = createPlayerSkillOverlay({
    mountElement,
    profile: playerProfile,
    getIsOpen: () => isPlayerSkillOpen,
    onRequestOpenChange: setPlayerSkillOpen,
    onRequestProfileChange: (nextProfile) => {
      Object.assign(playerProfile, nextProfile)
      syncPlayerUiOverlays()
    }
  })
  playerShopOverlay = createBlacksmithShopOverlay({
    mountElement,
    getPlayerName: () => playerProfile.name,
    getPlayerInventory: () => currentPlayerInventory,
    getMerchantInventory: () => currentBlacksmithInventory,
    getIsOpen: () => isBlacksmithShopOpen,
    onRequestOpenChange: setBlacksmithShopOpen,
    onRequestTradeStateChange: (
      nextPlayerInventory,
      nextMerchantInventory
    ) => {
      const previousPlayerInventory = currentPlayerInventory
      currentPlayerInventory = nextPlayerInventory
      currentBlacksmithInventory = nextMerchantInventory
      onPlayerInventoryChange(nextPlayerInventory)
      onMerchantInventoryChange(nextMerchantInventory)
      // 구매로 늘어난 아이템에 "획득" 퀘스트 진행을 기록한다.
      recordAcquiredItemsFromInventoryDelta(
        previousPlayerInventory,
        nextPlayerInventory
      )
      syncPlayerUiOverlays()
    },
    getSellPriceById: luaBlacksmithPricing.getSellPriceById
  })
  potionShopOverlay = createPotionShopOverlay({
    mountElement,
    getPlayerName: () => playerProfile.name,
    getPlayerInventory: () => currentPlayerInventory,
    getMerchantInventory: () => currentPotionMerchantInventory,
    getIsOpen: () => isPotionShopOpen,
    onRequestOpenChange: setPotionShopOpen,
    onRequestTradeStateChange: (
      nextPlayerInventory,
      nextMerchantInventory
    ) => {
      const previousPlayerInventory = currentPlayerInventory
      currentPlayerInventory = nextPlayerInventory
      currentPotionMerchantInventory = nextMerchantInventory
      onPlayerInventoryChange(nextPlayerInventory)
      onPotionMerchantInventoryChange(nextMerchantInventory)
      recordAcquiredItemsFromInventoryDelta(
        previousPlayerInventory,
        nextPlayerInventory
      )
      syncPlayerUiOverlays()
    }
  })
  const sceneHerbalist = characterStates.find((character) => HERBALIST_SHOP_NPC_IDS.has(character.id))
  herbalistShopOverlay = createPotionShopOverlay({
    mountElement,
    merchantName: sceneHerbalist?.displayText ?? '약초꾼 오디',
    title: sceneHerbalist?.id === 'irma' ? '약재상' : '약초 상점',
    merchantPortraitNpcId: sceneHerbalist?.id ?? 'odi',
    getPlayerName: () => playerProfile.name,
    getPlayerInventory: () => currentPlayerInventory,
    getMerchantInventory: () => currentHerbalistInventory,
    getIsOpen: () => isHerbalistShopOpen,
    onRequestOpenChange: setHerbalistShopOpen,
    onRequestTradeStateChange: (nextPlayerInventory, nextMerchantInventory) => {
      const previousPlayerInventory = currentPlayerInventory
      currentPlayerInventory = nextPlayerInventory
      currentHerbalistInventory = nextMerchantInventory
      onPlayerInventoryChange(nextPlayerInventory)
      onHerbalistInventoryChange(nextMerchantInventory)
      recordAcquiredItemsFromInventoryDelta(previousPlayerInventory, nextPlayerInventory)
      syncPlayerUiOverlays()
    }
  })
  statusEffectsOverlay = createStatusEffectsOverlay({ mountElement, getPills: getStatusEffectPills })
  bossHealthOverlay = createBossHealthOverlay({ mountElement, getBoss: () => getActiveBossView() })
  // 지하 장면 비네트(mapLights.isUndergroundScene) — 화면 가장자리를 살짝 어둡게
  const sceneVignetteElement = isUndergroundScene(sceneId) ? document.createElement('div') : undefined
  if (sceneVignetteElement) {
    sceneVignetteElement.className = 'scene-vignette'
    mountElement.append(sceneVignetteElement)
  }
  pauseMenuOverlay = createPauseMenuOverlay({
    mountElement,
    getIsOpen: () => isPauseMenuOpen,
    getAudioSettings: () => currentAudioSettings,
    getControlBindings: () => currentPlayerControlBindings,
    getControlBindingCaptureTarget: () => pendingControlBindingId,
    onRequestOpenChange: setPauseMenuOpen,
    onAudioSettingsChange: updateCurrentAudioSettings,
    onRequestControlBindingCapture: setControlBindingCaptureTarget,
    onRequestControlBindingsReset: resetPlayerControlBindings
  })
  questLogOverlay = createQuestLogOverlay({
    mountElement,
    getIsOpen: () => isQuestLogOpen,
    getQuestLog: () => currentQuestLog,
    getPlayerName: () => playerProfile.name,
    onRequestOpenChange: setQuestLogOpen,
    onQuestLogChange: setQuestLog,
    onRequestReplayDialogue: (definition) => {
      setQuestLogOpen(false)
      showRemoteQuestGiverDialogue(definition, [
        ...definition.startDialogueLines,
        ...definition.completionDialogueLines
      ])
    }
  })
  questTrackerOverlay = createQuestTrackerOverlay({
    mountElement,
    getQuestLog: () => currentQuestLog,
    onQuestLogChange: setQuestLog
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
  for (const character of characterStates) {
    const container = new Container()
    const isMonsterCharacter = character.appearanceType.startsWith('monster_')
    const isSignPostCharacter =
      character.appearanceType === SIGN_POST_APPEARANCE_TYPE
    const monsterAnimationTextures = isMonsterCharacter
      ? monsterAnimationTexturesByAppearanceType.get(character.appearanceType)
      : undefined
    const monsterBehaviorConfig = isMonsterCharacter
      ? getMonsterBehaviorConfig(character)
      : undefined
    const resolvedCharacterAppearanceTexture =
      monsterAnimationTextures === undefined
        ? resolveCharacterTexture(
            isSignPostCharacter ? 'post_tall_base_00' : character.appearanceType,
            characterTilesetResources.tileTextures,
            characterSpriteSheet.tileset,
            map.tilesets,
            tilesetResources,
            map.tileWidth
          )
        : undefined
    // 플레이어와 LPC 시트가 있는 NPC 는 LPC 그림체로 그린다(sprite 는 1칸 투명 판).
    const isLpcCharacter =
      character.id === PLAYER_CHARACTER_ID || getLpcNpcSheetsFor(character) !== undefined
    const sprite = monsterAnimationTextures
      ? new AnimatedSprite(monsterAnimationTextures.idleLeft)
      : new Sprite(
          isLpcCharacter
            ? lpcPlaceholderTexture
            : resolvedCharacterAppearanceTexture!.texture
        )
    const renderScale = monsterBehaviorConfig
      ? monsterBehaviorConfig.renderScale * getMonsterRenderScaleMultiplier(character.id)
      : isLpcCharacter
        ? 1
        : resolvedCharacterAppearanceTexture!.renderScale
    const isPlayer = character.id === PLAYER_CHARACTER_ID
    const playerHealthBar = isPlayer
      ? createPlayerResourceBar()
      : undefined
    const playerManaBar = isPlayer
      ? createPlayerResourceBar()
      : undefined
    const monsterHealthBar = isMonsterCharacter
      ? createMonsterHealthBar()
      : undefined
    const playerNameBadge =
      isPlayer
        ? new Text({
            style: PLAYER_NAME_BADGE_STYLE,
            text: playerProfile.name
          })
        : undefined
    // 몬스터 이름(보스 이름표 포함)은 레벨 배지가 보여 준다 — 따로 이름표를 만들면 겹치고, 따라다니지도 않는다.
    const displayLabel =
      character.displayText === undefined || isMonsterCharacter
        ? undefined
        : new Text({
            style: isSignPostCharacter
              ? SIGN_POST_LABEL_STYLE
              : PLAYER_NAME_BADGE_STYLE,
            text: character.displayText
          })
    const displayLabelPanel =
      displayLabel && isSignPostCharacter
        ? new NineSliceSprite({
            texture: messagePanelTexture,
            bottomHeight: MESSAGE_PANEL_BORDER_SIZE,
            leftWidth: MESSAGE_PANEL_BORDER_SIZE,
            rightWidth: MESSAGE_PANEL_BORDER_SIZE,
            topHeight: MESSAGE_PANEL_BORDER_SIZE
          })
        : undefined
    if (displayLabelPanel && displayLabel) {
      displayLabelPanel.roundPixels = true
      // 표지판 이름: 흰 말풍선 대신 나무 판자 색(말풍선 판을 갈색으로 물들임) — 글자 크기에 맞춘 작은 판
      displayLabelPanel.tint = 0x8a5a2e
      displayLabelPanel.setSize(
        Math.max(48, Math.ceil(displayLabel.width) + 16),
        Math.max(18, Math.ceil(displayLabel.height) + 8)
      )
    }
    const levelBadge =
      character.level === undefined
        ? undefined
        : new Text({
            style: MONSTER_LEVEL_BADGE_STYLE,
            text: `Lv ${character.level}`
          })
    const questBadge =
      !isPlayer && !isMonsterCharacter && !isSignPostCharacter
        ? createQuestBadgeSprite(questNewTexture)
        : undefined
    container.label = `character:${character.id}:container`
    container.sortableChildren = true
    sprite.label = `character:${character.id}`
    sprite.scale.set(renderScale)
    sprite.roundPixels = true
    sprite.zIndex = 10
    container.addChild(sprite)
    const lpcNode = isLpcCharacter
      ? createLpcCharacterNode(
          container,
          character,
          getLpcNpcSheetsFor(character)
        )
      : undefined
    if (displayLabelPanel) {
      displayLabelPanel.label = `character:${character.id}:display-label-panel`
      displayLabelPanel.zIndex = 16
      container.addChild(displayLabelPanel)
    }
    if (displayLabel) {
      displayLabel.label = `character:${character.id}:display-label`
      displayLabel.roundPixels = true
      displayLabel.zIndex = displayLabelPanel ? 17 : 16
      container.addChild(displayLabel)
    }
    if (playerNameBadge) {
      playerNameBadge.label = `character:${character.id}:name`
      playerNameBadge.roundPixels = true
      playerNameBadge.zIndex = 21
      container.addChild(playerNameBadge)
    }
    if (playerHealthBar) {
      playerHealthBar.container.label = `character:${character.id}:player-health-bar`
      playerHealthBar.container.zIndex = 18
      container.addChild(playerHealthBar.container)
    }
    if (playerManaBar) {
      playerManaBar.container.label = `character:${character.id}:player-mana-bar`
      playerManaBar.container.zIndex = 18.5
      container.addChild(playerManaBar.container)
    }
    if (monsterHealthBar) {
      monsterHealthBar.container.label = `character:${character.id}:monster-health-bar`
      monsterHealthBar.container.zIndex = 15
      container.addChild(monsterHealthBar.container)
    }
    if (levelBadge) {
      levelBadge.label = `character:${character.id}:level`
      levelBadge.roundPixels = true
      levelBadge.zIndex = 20
      container.addChild(levelBadge)
    }
    if (questBadge) {
      questBadge.label = `character:${character.id}:quest-badge`
      questBadge.roundPixels = true
      questBadge.zIndex = 22
      messageLayer.addChild(questBadge)
    }

    if (isMonsterCharacter) {
      monsterCombatStates.set(
        character.id,
        luaMonsterCombat.createMonsterCombatState(
          character.level ?? 1,
          getMonsterCombatStateOptions(character)
        )
      )
      monsterSpawnStates.set(character.id, {
        ...character,
        blocksMovement: true,
        position: {
          ...character.position
        },
        collisionSize: {
          ...character.collisionSize
        }
      })
      if (isBossSummonCharacterId(character.id)) {
        const summonCombatState = monsterCombatStates.get(character.id)
        if (summonCombatState) {
          monsterCombatStates.set(character.id, { ...summonCombatState, currentHp: 0 })
        }
      }
    }

    if (isPlayer) {
      playerArmorSprite = new Sprite(Texture.EMPTY)
      playerArmorSprite.label = 'character:player:armor'
      playerArmorSprite.anchor.set(0.5)
      playerArmorSprite.visible = false
      playerArmorSprite.roundPixels = true
      playerArmorSprite.zIndex = PLAYER_ARMOR_EQUIPMENT_CONFIG.zIndex
      container.addChild(playerArmorSprite)
      playerHelmetSprite = new Sprite(Texture.EMPTY)
      playerHelmetSprite.label = 'character:player:helmet'
      playerHelmetSprite.anchor.set(0.5)
      playerHelmetSprite.visible = false
      playerHelmetSprite.roundPixels = true
      playerHelmetSprite.zIndex = PLAYER_HELMET_EQUIPMENT_CONFIG.zIndex
      container.addChild(playerHelmetSprite)
      playerProtectSkillSprite = new AnimatedSprite(
        protectVfxTextures.shieldTextures
      )
      playerProtectSkillSprite.label = 'character:player:protect-skill-effect'
      playerProtectSkillSprite.anchor.set(0.5)
      playerProtectSkillSprite.animationSpeed = PROTECT_VFX_ANIMATION_SPEED
      playerProtectSkillSprite.loop = true
      playerProtectSkillSprite.roundPixels = true
      playerProtectSkillSprite.visible = false
      playerProtectSkillSprite.alpha = 0.92
      playerProtectSkillSprite.scale.set(PROTECT_VFX_SCALE)
      playerProtectSkillSprite.zIndex = 9
      playerProtectSkillSprite.position.set(
        Math.round(sprite.width / 2),
        Math.round(sprite.height / 2)
      )
      container.addChild(playerProtectSkillSprite)
      playerWeaponTrailSprites = Array.from(
        { length: PLAYER_ATTACK_TRAIL_SPRITE_COUNT },
        (_, index) => {
          const trailSprite = new Sprite(Texture.EMPTY)

          trailSprite.label = `character:player:weapon-trail:${index}`
          trailSprite.anchor.set(0.5, 1)
          trailSprite.visible = false
          trailSprite.roundPixels = true
          trailSprite.zIndex = index + 1
          container.addChild(trailSprite)

          return trailSprite
        }
      )
      playerWeaponSprite = new Sprite(Texture.EMPTY)
      playerWeaponSprite.label = 'character:player:weapon'
      playerWeaponSprite.anchor.set(0.5, 1)
      playerWeaponSprite.visible = false
      playerWeaponSprite.roundPixels = true
      playerWeaponSprite.zIndex = PLAYER_ATTACK_TRAIL_SPRITE_COUNT + 1
      container.addChild(playerWeaponSprite)
    }

    renderedCharacters.set(character.id, {
      container,
      sprite,
      renderScale,
      lpc: lpcNode,
      labelContainer: undefined,
      playerArmorSprite: isPlayer ? playerArmorSprite : undefined,
      playerHelmetSprite: isPlayer ? playerHelmetSprite : undefined,
      playerHealthBar,
      playerManaBar,
      playerNameBadge,
      displayLabelPanel,
      displayLabel,
      levelBadge,
      questBadge,
      monsterHealthBar
    })
    if (monsterAnimationTextures) {
      monsterPigAnimatedSprites.set(character.id, sprite as AnimatedSprite)
      monsterPigBehaviorStates.set(character.id, createMonsterPigBehaviorState())
      syncMonsterAnimation(character.id, 'idle')
    }
    depthSortedLayer.addChild(container)
  }

  for (const portal of mapPortals) {
    const container = new Container()
    const baseSprite = new Sprite(resolveMapPortalTexture(portal.appearanceType))
    const coreSprite = new Sprite(portalInsideTexture)
    container.label = `portal:${portal.id}:container`
    container.sortableChildren = true
    baseSprite.label = `portal:${portal.id}:base`
    baseSprite.roundPixels = true
    baseSprite.zIndex = 0
    coreSprite.label = `portal:${portal.id}:core`
    coreSprite.anchor.set(0.5, 0.5)
    coreSprite.scale.set(PORTAL_INSIDE_WORLD_SCALE)
    coreSprite.roundPixels = true
    coreSprite.zIndex = 1
    const isCaveEntrancePortal = portal.appearanceType === 'cave_entrance'

    if (isCaveEntrancePortal) {
      baseSprite.scale.set(0.24)
      container.position.set(
        portal.position.x * map.tileWidth - 32,
        portal.position.y * map.tileHeight
      )
      container.addChild(baseSprite)
    } else if (portal.appearanceType === 'stairs_stone_step_base_00') {
      container.position.set(
        portal.position.x * map.tileWidth,
        portal.position.y * map.tileHeight
      )
      baseSprite.scale.set(portal.collisionSize.width, portal.collisionSize.height)
      coreSprite.position.set(
        (portal.collisionSize.width * map.tileWidth) / 2,
        (portal.collisionSize.height * map.tileHeight) / 2
      )
      container.addChild(baseSprite, coreSprite)
    } else {
      baseSprite.scale.set(portal.collisionSize.width, portal.collisionSize.height)
      container.position.set(
        portal.position.x * map.tileWidth,
        portal.position.y * map.tileHeight
      )
      container.addChild(baseSprite)
    }
    container.zIndex = Math.round(
      (portal.position.y + portal.collisionSize.height) * map.tileHeight
    )
    renderedPortals.set(portal.id, {
      container,
      sprite: baseSprite
    })
    depthSortedLayer.addChild(container)
  }
  depthSortedLayer.sortChildren()
  world.addChild(messageLayer)
  for (const characterId of renderedCharacters.keys()) {
    attachCharacterLabelLayer(characterId)
  }

  // 캐릭터 이름표류를 메시지 레이어로 옮긴다(좌표계는 캐릭터 컨테이너와 같다).
  function attachCharacterLabelLayer(characterId: string) {
    const renderNode = renderedCharacters.get(characterId)
    if (!renderNode || renderNode.labelContainer) {
      return
    }
    const labelContainer = new Container()
    labelContainer.label = `character:${characterId}:labels`
    labelContainer.sortableChildren = true
    for (const element of [
      renderNode.displayLabelPanel,
      renderNode.displayLabel,
      renderNode.playerNameBadge,
      renderNode.playerHealthBar?.container,
      renderNode.playerManaBar?.container,
      renderNode.monsterHealthBar?.container,
      renderNode.levelBadge
    ]) {
      if (element) {
        labelContainer.addChild(element)
      }
    }
    renderNode.labelContainer = labelContainer
    // 표지판 이름판은 맨 아래에 — 지나가는 플레이어의 체력바·이름표를 덮지 않게.
    if (renderNode.displayLabelPanel) {
      messageLayer.addChildAt(labelContainer, 0)
    } else {
      messageLayer.addChild(labelContainer)
    }
  }

  // 매 프레임: 이름표 레이어를 캐릭터 위치·표시 여부에 맞춘다.
  function syncCharacterLabelLayers() {
    for (const renderNode of renderedCharacters.values()) {
      const labels = renderNode.labelContainer
      if (!labels) {
        continue
      }
      labels.visible = renderNode.container.visible
      labels.position.copyFrom(renderNode.container.position)
    }
  }

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

    playerHitReactionState = {
      directionX: direction.x,
      directionY: direction.y,
      startedAtMilliseconds: now,
      expiresAtMilliseconds: now + PLAYER_HIT_REACTION_DURATION_MILLISECONDS
    }
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
    characterStates = characterStates.map((character) =>
      character.id === characterId && character.facing !== facing
        ? { ...character, facing }
        : character
    )
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

  const syncAllCharacterSprites = () => {
    for (const character of characterStates) {
      syncCharacterSprite(character)
    }
  }

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

    return characterStates
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
    return characterStates.filter(
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

    characterStates = characterStates.map((character) =>
      character.id === characterId ? nextCharacter : character
    )
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
    if (playerRespawnAtMilliseconds !== undefined) {
      return
    }

    playerRespawnAtMilliseconds =
      now + PLAYER_RESPAWN_DELAY_MILLISECONDS
    playerHitReactionState = undefined
    clearPressedInputState()
    stopPlayerFootsteps()
    playerAttackStartedAtMilliseconds = undefined
    playerAttackResolvedStartedAtMilliseconds = undefined
    playerAttackFacing = undefined
    clearPlayerSlashEffectSprite()
    clearPlayerProtectSkillEffectSprite()
    clearPlayerSmashSkillEffectSprites()
    clearPlayerProjectiles()
    clearMagicEffects()
    playerProtectSkillActiveUntilMilliseconds = 0
    playerProtectSkillReadyAtMilliseconds = now + PLAYER_RESPAWN_DELAY_MILLISECONDS
    playerDamageInvulnerableUntilMilliseconds = 0
    playerAttackReadyAtMilliseconds = now + PLAYER_RESPAWN_DELAY_MILLISECONDS
    playerSmashSkillReadyAtMilliseconds =
      now + PLAYER_RESPAWN_DELAY_MILLISECONDS
    syncCharacterSprite(getCharacterStateById(PLAYER_CHARACTER_ID), now)
  }

  function maybeRespawnPlayer(now: number): boolean {
    if (playerProfile.hp.current > 0) {
      return false
    }

    const respawnAt = playerRespawnAtMilliseconds

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
    const respawnGoldPenalty = Math.floor(currentPlayerInventory.gold * 0.1)
    if (respawnGoldPenalty > 0) {
      currentPlayerInventory = {
        ...currentPlayerInventory,
        gold: currentPlayerInventory.gold - respawnGoldPenalty
      }
      onPlayerInventoryChange(currentPlayerInventory)
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        `-${respawnGoldPenalty} 골드`,
        DAMAGE_TEXT_DURATION_MILLISECONDS
      )
    }
    playerRespawnAtMilliseconds = undefined
    playerHitReactionState = undefined
    clearPressedInputState()
    playerAttackStartedAtMilliseconds = undefined
    playerAttackResolvedStartedAtMilliseconds = undefined
    playerAttackFacing = undefined
    clearPlayerSlashEffectSprite()
    clearPlayerProtectSkillEffectSprite()
    clearPlayerSmashSkillEffectSprites()
    clearPlayerProjectiles()
    clearMagicEffects()
    playerProtectSkillActiveUntilMilliseconds = 0
    playerProtectSkillReadyAtMilliseconds = now
    playerDamageInvulnerableUntilMilliseconds = 0
    playerAttackReadyAtMilliseconds = now
    playerSmashSkillReadyAtMilliseconds = now
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

    if (playerDamageInvulnerableUntilMilliseconds > now) {
      return false
    }

    if (
      sourceCharacter &&
      playerProtectSkillActiveUntilMilliseconds > now
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
      ? Math.max(1, nextDamage - getEquippedPlayerDefense(currentPlayerEquipment))
      : nextDamage
    const nextHp = Math.max(0, playerProfile.hp.current - mitigatedDamage)
    const damageMessage =
      nextHp === 0 ? `-${mitigatedDamage}\n쓰러졌다!` : `-${mitigatedDamage}`

    playerProfile.hp.current = nextHp
    if (nextHp > 0) {
      playerDamageInvulnerableUntilMilliseconds =
        now + PLAYER_DAMAGE_INVULNERABILITY_MILLISECONDS
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
      playerHitReactionState = undefined
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
        recordMonsterDefeatQuestProgress(currentQuestLog, {
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
      playerAttackStartedAtMilliseconds === undefined ||
      playerAttackResolvedStartedAtMilliseconds ===
        playerAttackStartedAtMilliseconds
    ) {
      return
    }

    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
    const targetCharacter = playerSlashEffectSprite
      ? resolveClosestMonsterInCollisionRect(
          createSlashEffectHitRect(playerSlashEffectSprite)
        )
      : resolveCharacterInteractionTarget({
          sourceCharacter: playerCharacter,
          targetCharacters: characterStates,
          canReceiveInteraction: (character) =>
            isMonsterCharacter(character) &&
            !isMonsterCombatStateDefeated(character.id),
          interactionProbeDistanceInTiles: PLAYER_ATTACK_PROBE_DISTANCE_IN_TILES
        })

    if (targetCharacter) {
      // 근접 기본 공격 — 마법 무기는 발사체 경로로 가므로 여기는 항상 물리다.
      applyDamageToMonster(targetCharacter.id, getPlayerBasicAttackDamage(false), now)
      playerAttackResolvedStartedAtMilliseconds =
        playerAttackStartedAtMilliseconds
    }
  }

  function resolvePlayerSmashSkillDamage(now: number): void {
    if (
      playerProfile.hp.current === 0 ||
      playerSmashSkillStartedAtMilliseconds === undefined
    ) {
      return
    }

    const smashSkillDamage =
      getPlayerSkillDamageById(playerProfile, PLAYER_SMASH_SKILL_ID)

    for (const segment of playerSmashSkillSegments) {
      if (!segment.sprite.visible) {
        continue
      }

      const hitRect = createSlashEffectHitRect(segment.sprite)

      for (const monsterCharacter of resolveMonstersInCollisionRect(hitRect)) {
        if (playerSmashSkillHitMonsterIds.has(monsterCharacter.id)) {
          continue
        }

        playerSmashSkillHitMonsterIds.add(monsterCharacter.id)
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

    for (const monsterCharacter of characterStates) {
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

      if (playerProtectSkillActiveUntilMilliseconds > now) {
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

  const syncPlayerWeaponSprite = (character: CharacterState) => {
    if (!playerWeaponSprite) {
      return
    }

    if (playerProfile.hp.current === 0 || playerRollState) {
      playerWeaponSprite.visible = false
      for (const trailSprite of playerWeaponTrailSprites) {
        trailSprite.visible = false
      }
      return
    }

    const weaponSlot = currentPlayerEquipment.slots.find(
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

    const attackFacing = playerAttackFacing ?? character.facing
    const placement =
      attackFacing === 'left'
        ? PLAYER_WEAPON_PLACEMENT_LEFT
        : PLAYER_WEAPON_PLACEMENT_RIGHT
    const weaponWorldScale =
      weaponAppearance?.worldScale ?? PLAYER_WEAPON_WORLD_SCALE
    const now = performance.now()
    const attackElapsedMilliseconds =
      playerAttackStartedAtMilliseconds === undefined
        ? undefined
        : now - playerAttackStartedAtMilliseconds
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
      playerAttackStartedAtMilliseconds !== undefined
    ) {
      playerAttackStartedAtMilliseconds = undefined
      playerAttackResolvedStartedAtMilliseconds = undefined
      playerAttackFacing = undefined
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
    if (
      !playerProtectSkillSprite ||
      character.id !== PLAYER_CHARACTER_ID ||
      playerProfile.hp.current === 0
    ) {
      return
    }

    if (playerProtectSkillActiveUntilMilliseconds <= now) {
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
  const centerCameraOnCharacter = (character: CharacterState) => {
    const characterCenterX =
      (character.position.x * map.tileWidth + characterPixelWidth / 2) *
      cameraZoom
    const characterCenterY =
      (character.position.y * map.tileHeight + characterPixelHeight / 2) *
      cameraZoom
    const nextScrollLeft = clampScrollOffset(
      characterCenterX - viewportElement.clientWidth / 2,
      scaledMapPixelWidth - viewportElement.clientWidth
    )
    const nextScrollTop = clampScrollOffset(
      characterCenterY - viewportElement.clientHeight / 2,
      scaledMapPixelHeight - viewportElement.clientHeight
    )

    viewportElement.scrollTo({
      left: nextScrollLeft,
      top: nextScrollTop
    })
  }

  const getBlockingCollisionRects = (
    excludedCharacterId: string,
    options: {
      ignoreMonsters?: boolean
    } = {}
  ): CollisionRect[] =>
    characterStates
      .filter(
        (character) =>
          character.blocksMovement &&
          character.id !== excludedCharacterId &&
          !(options.ignoreMonsters === true && isMonsterCharacter(character))
      )
      .map((character) => createCollisionRectFromCharacter(character))

  // 막힌 축과 직각으로 살짝 정렬시켜 한 칸 통로에 걸리지 않게 한다.
  const applyCornerAssist = (
    character: CharacterState,
    deltaX: number,
    deltaY: number,
    blockingRects: CollisionRect[]
  ): CharacterState => {
    const nudge = resolveCornerAssistNudge({
      wallTiles,
      blockingRects,
      x: character.position.x,
      y: character.position.y,
      width: character.collisionSize.width,
      height: character.collisionSize.height,
      deltaX,
      deltaY
    })

    if (!nudge) {
      return character
    }

    return moveCharacterState({
      character,
      delta: {
        x: nudge.axis === 'x' ? nudge.amount : 0,
        y: nudge.axis === 'y' ? nudge.amount : 0
      },
      mapWidth: map.width,
      mapHeight: map.height
    })
  }

  const tryMoveCharacter = (
    characterId: string,
    deltaX: number,
    deltaY: number,
    options: {
      preserveFacing?: boolean
      ignoreMonsterBlocking?: boolean
      // 한 칸 통로에 들어갈 때 격자에 자동 정렬시킨다(플레이어 조작 이동에만).
      cornerAssist?: boolean
    } = {}
  ): boolean => {
    const currentCharacter = getCharacterStateById(characterId)
    const desiredFacing = moveCharacterState({
      character: currentCharacter,
      delta: {
        x: deltaX,
        y: deltaY
      },
      mapWidth: map.width,
      mapHeight: map.height
    }).facing
    const nextFacing = options.preserveFacing
      ? currentCharacter.facing
      : desiredFacing
    const blockingRects = getBlockingCollisionRects(characterId, {
      ignoreMonsters: options.ignoreMonsterBlocking
    })
    let nextCharacter =
      nextFacing === currentCharacter.facing
        ? currentCharacter
        : {
            ...currentCharacter,
            facing: nextFacing
          }

    if (deltaX !== 0) {
      const nextXCharacter = moveCharacterState({
        character: nextCharacter,
        delta: {
          x: deltaX,
          y: 0
        },
        mapWidth: map.width,
        mapHeight: map.height
      })

      if (
        !isCharacterPositionBlocked(
          wallTiles,
          blockingRects,
          nextXCharacter.position.x,
          nextXCharacter.position.y,
          nextXCharacter.collisionSize.width,
          nextXCharacter.collisionSize.height
        )
      ) {
        nextCharacter = nextXCharacter
      } else if (options.cornerAssist) {
        nextCharacter = applyCornerAssist(nextCharacter, deltaX, deltaY, blockingRects)
      }
    }

    if (deltaY !== 0) {
      const nextYCharacter = moveCharacterState({
        character: nextCharacter,
        delta: {
          x: 0,
          y: deltaY
        },
        mapWidth: map.width,
        mapHeight: map.height
      })

      if (
        !isCharacterPositionBlocked(
          wallTiles,
          blockingRects,
          nextYCharacter.position.x,
          nextYCharacter.position.y,
          nextYCharacter.collisionSize.width,
          nextYCharacter.collisionSize.height
        )
      ) {
        nextCharacter = nextYCharacter
      } else if (options.cornerAssist) {
        nextCharacter = applyCornerAssist(nextCharacter, deltaX, deltaY, blockingRects)
      }
    }

    if (options.preserveFacing) {
      nextCharacter = {
        ...nextCharacter,
        facing: currentCharacter.facing
      }
    } else if (nextCharacter.facing !== desiredFacing) {
      nextCharacter = {
        ...nextCharacter,
        facing: desiredFacing
      }
    }

    if (
      nextCharacter.position.x === currentCharacter.position.x &&
      nextCharacter.position.y === currentCharacter.position.y &&
      nextCharacter.facing === currentCharacter.facing
    ) {
      return false
    }

    characterStates = characterStates.map((character) =>
      character.id === nextCharacter.id ? nextCharacter : character
    )

    const didPositionChange =
      nextCharacter.position.x !== currentCharacter.position.x ||
      nextCharacter.position.y !== currentCharacter.position.y
    const didFacingChange = nextCharacter.facing !== currentCharacter.facing

    if (didPositionChange || didFacingChange) {
      syncCharacterSprite(nextCharacter)
    }

    if (nextCharacter.id === cameraTargetCharacterId && didPositionChange) {
      centerCameraOnCharacter(nextCharacter)
    }

    return didPositionChange
  }

  const drainControllerRuntimeEventsIntoQueue = () => {
    for (const event of controllerRuntime.drainEvents()) {
      gameEventQueue.enqueue(event)
    }
  }

  const updateCharacters = () => {
    try {
      const now = performance.now()

      if (isPauseMenuOpen) {
        clearPressedInputState()
        stopPlayerFootsteps()
        triggeredActions.clear()
        triggeredSkillSlotIndexes.clear()
            lastRuntimeErrorMessage = undefined
        return
      }

      controllerRuntime.syncCharacters(characterStates)
      drainControllerRuntimeEventsIntoQueue()
      maybeRespawnPlayer(now)
      for (const skillSlotIndex of triggeredSkillSlotIndexes) {
        triggerPlayerSkillFromSlotIndex(skillSlotIndex, now)
      }
      triggeredSkillSlotIndexes.clear()

      let didPlayerMoveThisFrame = stepPlayerRoll(now)

      for (const character of [...characterStates]) {
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

          if (isSceneTransitionPending) {
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
      updatePlayerProjectiles(now, app.ticker.deltaMS)
      if (!npcDialogueOverlay.isOpen()) {
        resolveMonsterContactDamage(now)
        resolvePoisonFogDamage(now)
        resolveBlizzardDamage(now)
        updateBossHazards(now)
        updateBossTonguePull(now)
      }
      statusEffectsOverlay.syncFrame()
      bossHealthOverlay.syncFrame()
      updateBossFlashes(now)
      updateMapLights(now)
      resolveMonsterGoldDropPickups()
      resolveMonsterEquipmentDropPickups()
      resolveCoinPilePickups()
      syncActiveMonsterGoldDrops(now)
      syncActiveMonsterEquipmentDrops(now)

      // Phase 2 읽기 채널: 게임의 권위 있는 상태를 Lua 가 읽도록(변경 시에만) 밀어넣는다.
      const runtimeSnapshot = buildLuaRuntimeSnapshot({
        questLog: currentQuestLog,
        inventory: currentPlayerInventory,
        equipment: currentPlayerEquipment,
        profile: playerProfile,
        sceneId
      })
      const runtimeSnapshotJson = JSON.stringify(runtimeSnapshot)
      if (runtimeSnapshotJson !== lastPushedSnapshotJson) {
        controllerRuntime.pushSnapshot(runtimeSnapshot)
        lastPushedSnapshotJson = runtimeSnapshotJson
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
        characters: characterStates,
        controllerRuntime,
        now,
        interactionLockUntilByCharacterPair
      })

      for (const event of emittedEvents) {
        // Phase 3 쓰기 채널: Lua 가 요청한 액션을 기존 순수 reducer 로 적용한다(Lua=요청, TS=적용).
        if (event.kind === 'request-quest-start') {
          setQuestLog(startQuest(currentQuestLog, event.questId))
          continue
        }
        if (event.kind === 'request-quest-progress') {
          setQuestLog(
            recordQuestObjectiveProgress(
              currentQuestLog,
              event.questId,
              event.objectiveId,
              event.amount
            )
          )
          continue
        }
        if (event.kind === 'request-quest-complete') {
          const completion = completeQuest(currentQuestLog, event.questId)
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
      syncPlayerCharacterVisual(now)
      syncCharacterLabelLayers()
      syncQuestNpcBadges()
      syncPlayerFootsteps(didPlayerMoveThisFrame)
      triggeredActions.clear()
      lastRuntimeErrorMessage = undefined
    } catch (error) {
      stopPlayerFootsteps()
      gameEventQueue.clear()
      triggeredActions.clear()
      triggeredSkillSlotIndexes.clear()
  
      const message = error instanceof Error ? error.message : String(error)

      if (message !== lastRuntimeErrorMessage) {
        console.error('Runtime update failed.', error)
        lastRuntimeErrorMessage = message
      }
    } finally {
      syncRuntimeWarningBanner()
    }
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (isEditableUiTarget(event.target)) {
      return
    }

    const code = event.code
    const skillSlotIndex = getPlayerSkillSlotIndexFromCode(code)
    const isInventoryToggleKey = code === currentPlayerControlBindings.inventory
    const isStatToggleKey = code === currentPlayerControlBindings.stat
    const isEquipmentToggleKey = code === currentPlayerControlBindings.equipment
    const isSkillToggleKey = code === currentPlayerControlBindings.skill
    const isQuestLogToggleKey = code === currentPlayerControlBindings.quest
    const isMapToggleKey = code === currentPlayerControlBindings.map
    const isPortalEnterKey = code === currentPlayerControlBindings.portal
    const isPauseKey = isPlayerControlPauseKey(
      currentPlayerControlBindings,
      code
    )

    if (pendingControlBindingId) {
      event.preventDefault()

      if (event.repeat || isPlayerControlCaptureModifierKey(code)) {
        return
      }

      updatePlayerControlBindings(
        setPlayerControlBinding({
          bindings: currentPlayerControlBindings,
          bindingId: pendingControlBindingId,
          nextCode: code
        })
      )
      pendingControlBindingId = undefined
      syncPlayerUiOverlays()
      return
    }

    if (isInteractiveUiEventTarget(event.target)) {
      return
    }

    if (isPauseKey) {
      event.preventDefault()

      if (event.repeat) {
        return
      }

      if (!closeAllOverlays()) {
        setPauseMenuOpen(true)
      }

      return
    }

    if (isPauseMenuOpen) {
      if (
        !(event.target instanceof HTMLInputElement) ||
        event.target.type !== 'range'
      ) {
        event.preventDefault()
      }

      return
    }

    if (isMapToggleKey) {
      if (!event.repeat) {
        event.preventDefault()

        if (mapOverlay.getIsExpanded()) {
          mapOverlay.setExpanded(false)
        } else {
          mapOverlay.toggleVisible()
        }
      }

      return
    }

    if (mapOverlay.getIsExpanded()) {
      event.preventDefault()
      return
    }

    if (isPortalEnterKey) {
      event.preventDefault()

      if (!event.repeat) {
        requestPlayerPortalTransition()
      }

      return
    }

    if (skillSlotIndex !== undefined) {
      event.preventDefault()

      if (event.repeat || playerProfile.hp.current === 0) {
        return
      }

      triggeredSkillSlotIndexes.add(skillSlotIndex)
      return
    }



    if (isInventoryToggleKey) {
      if (!event.repeat) {
        event.preventDefault()
        setPlayerUiOpen(!isPlayerUiOpen)
      }

      return
    }

    if (isStatToggleKey) {
      if (!event.repeat) {
        event.preventDefault()
        setPlayerStatOpen(!isPlayerStatOpen)
      }

      return
    }

    if (isEquipmentToggleKey) {
      if (!event.repeat) {
        event.preventDefault()
        setPlayerEquipmentOpen(!isPlayerEquipmentOpen)
      }

      return
    }

    if (isSkillToggleKey) {
      if (!event.repeat) {
        event.preventDefault()
        setPlayerSkillOpen(!isPlayerSkillOpen)
      }

      return
    }

    if (isQuestLogToggleKey) {
      if (!event.repeat) {
        event.preventDefault()
        setQuestLogOpen(!isQuestLogOpen)
      }

      return
    }

    if (playerProfile.hp.current === 0) {
      return
    }

    if (isPlayerRollModifierCode(code)) {
      event.preventDefault()
      playerRollInputState.isModifierPressed = true

      if (!event.repeat) {
        triggerPlayerRollFromPressedDirection(performance.now())
      }

      return
    }

    const quickslotIndex = getQuickslotIndexFromKeyboardEvent(event)

    if (quickslotIndex !== undefined) {
      if (event.repeat) {
        return
      }

      const quickslotAssignment =
        currentPlayerQuickslots.slots[quickslotIndex]

      if (!quickslotAssignment) {
        return
      }

      const assignedInventorySlotIndex = quickslotAssignment.inventorySlotIndex
      const assignedItem =
        currentPlayerInventory.slots[assignedInventorySlotIndex]

      if (!assignedItem) {
        currentPlayerQuickslots = clearPlayerQuickslotAssignment({
          quickslots: currentPlayerQuickslots,
          quickslotIndex
        })
        onPlayerQuickslotsChange(currentPlayerQuickslots)
        syncPlayerUiOverlays()
        return
      }

      const nextState = usePlayerQuickslotConsumable({
        profile: playerProfile,
        inventory: currentPlayerInventory,
        quickslots: currentPlayerQuickslots,
        quickslotIndex
      })

      if (!nextState) {
        return
      }

      event.preventDefault()
      currentPlayerInventory = nextState.inventory
      Object.assign(playerProfile, nextState.profile)
      onPlayerInventoryChange(nextState.inventory)
      handleConsumableUsed(assignedItem.id)

      if (nextState.inventory.slots[assignedInventorySlotIndex] === undefined) {
        currentPlayerQuickslots = clearPlayerQuickslotAssignment({
          quickslots: currentPlayerQuickslots,
          quickslotIndex
        })
        onPlayerQuickslotsChange(currentPlayerQuickslots)
      }

      syncPlayerUiOverlays()
      return
    }

    const action = getPlayerControlActionFromCode(
      currentPlayerControlBindings,
      code
    )

    if (action) {
      event.preventDefault()

      if (
        action === 'attack' &&
        playerRollState &&
        !event.repeat
      ) {
        playerAttackQueuedAfterRoll = true
        return
      }

      if (!pressedActions.has(action)) {
        triggeredActions.add(action)
      }

      pressedActions.add(action)
      return
    }

    const direction = getPlayerControlMovementDirectionFromCode(
      currentPlayerControlBindings,
      code
    )

    if (!direction) {
      return
    }

    event.preventDefault()
    pressedDirections.add(direction)

    if (
      !event.repeat &&
      (playerRollInputState.isModifierPressed || event.shiftKey)
    ) {
      triggerPlayerRollFromPressedDirection(performance.now())
    }
  }

  const handleKeyUp = (event: KeyboardEvent) => {
    if (isEditableUiTarget(event.target)) {
      return
    }

    const code = event.code

    if (isPlayerRollModifierCode(code)) {
      playerRollInputState.isModifierPressed = false
      return
    }

    const action = getPlayerControlActionFromCode(
      currentPlayerControlBindings,
      code
    )

    if (action) {
      pressedActions.delete(action)
      return
    }

    const direction = getPlayerControlMovementDirectionFromCode(
      currentPlayerControlBindings,
      code
    )

    if (!direction) {
      return
    }

    pressedDirections.delete(direction)
  }

  const handleWindowBlur = () => {
    clearPressedInputState()
    stopPlayerFootsteps()
  }

  const isEditableUiTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) {
      return false
    }

    return (
      target.matches('input, textarea, select, button') ||
      target.isContentEditable
    )
  }

  const handleViewportWheel = (event: WheelEvent) => {
    event.preventDefault()

    if (event.deltaY === 0) {
      return
    }

    setCameraZoom(cameraZoom * Math.exp(-event.deltaY * CAMERA_ZOOM_WHEEL_SPEED))
  }

  const handleWindowResize = () => {
    syncViewportDisplayScale()
    centerCameraOnCharacter(getCharacterStateById(cameraTargetCharacterId))
    mapOverlay.syncFrame()
  }

  const handleVisibilityChange = () => {
    if (document.hidden) {
      handleWindowBlur()
      app.stop()
      return
    }

    app.start()
  }

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
