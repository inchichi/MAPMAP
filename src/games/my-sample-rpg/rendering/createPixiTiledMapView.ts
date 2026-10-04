import { CompositeTilemap } from '@pixi/tilemap'
import {
  Application,
  AnimatedSprite,
  Container,
  ColorMatrixFilter,
  type FederatedPointerEvent,
  Graphics,
  NineSliceSprite,
  Rectangle,
  Sprite,
  Text,
  TextStyle,
  Texture,
  UPDATE_PRIORITY
} from 'pixi.js'

import { loadTextureSafe } from './loadTextureSafe'
import {
  getLpcActionFrameIndex,
  getLpcAnchor,
  getLpcDirectionFromFacing,
  getLpcPlayerAttackAnimation,
  getLpcPlayerLayerFiles,
  getLpcWalkFrameIndex,
  createLpcSheetCache,
  getLpcNpcFullBodyUrl,
  getLpcNpcSheetKey,
  loadLpcArrowTexture,
  loadLpcNpcSheets,
  LPC_PLAYER_LAYER_ORDER,
  type LpcAnimationName,
  type LpcCharacterSheets,
  type LpcPlayerLayerSlot,
  type LpcPlayerLook
} from './lpcCharacterSprites'
import {
  createFlowingWaterSurface,
  createWaterRipplePatternTextures,
  parseWaterFillTileType,
  type FlowingWaterSurface,
  type FlowingWaterSurfaceCell
} from './flowingWaterSurface'
import {
  addPlacement,
  loadPlacementsForMap,
  removePlacement,
  type PlacedItem,
  type PlacementTemplate
} from '../../../editor/placementStore'
import {
  addNpc,
  loadNpcsForMap,
  removeNpc,
  type NpcWireTemplate
} from '../../../editor/npcStore'

import { PLAYER_CHARACTER_ID } from '../characterState'
import type {
  CharacterAction,
  CharacterMoveDirection,
  CharacterState
} from '../characterState'
import type { CharacterControllerRuntime } from '../createCharacterControllerRuntime'
import {
  createGameEventQueue,
  type GameEvent
} from '../events/createGameEventQueue'
import type { EventReward, HolidayDialogueEventSpec } from '../eventGeneration'
import { createCoinPileTileKey, getCoinPileGoldAmount } from '../coinPiles'
import { processInteractionEvents } from '../interaction/processInteractionEvents'
import {
  getEquippedPlayerAttackBonus,
  getEquippedPlayerDefense,
  getEquippedPlayerWeaponAttackKind,
  PLAYER_EQUIPMENT_ITEM_DEFINITIONS,
  type PlayerEquipment,
  type PlayerEquipmentSlotId
} from '../playerEquipment'
import {
  createPlayerProjectile,
  getPlayerProjectileDirectionFromFacing,
  getPlayerProjectileHitRect,
  getPlayerProjectileRotation,
  PLAYER_ENERGY_BOLT_BASE_POWER,
  PLAYER_MAGIC_ATTACK_COOLDOWN_MILLISECONDS,
  PLAYER_MAGIC_ATTACK_TARGET_RANGE_PIXELS,
  selectPlayerMagicTarget,
  steerPlayerProjectileToward,
  stepPlayerProjectile,
  type PlayerProjectileKind,
  type PlayerProjectileState
} from '../playerProjectile'
import {
  type PlayerInventory,
  type PlayerInventoryItem
} from '../playerInventory'
import type { PlayerProfile } from '../playerProfile'
import { type PlayerQuickslots } from '../playerQuickslots'
import { type PlayerSkillSlots } from '../playerSkillSlots'
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
import {
  MULTI_SHOT_DAMAGE_RATIO,
  PIERCING_ARROW_MAX_HITS,
  POISON_TICK_COUNT,
  POISON_TICK_INTERVAL_MILLISECONDS,
  getMultiShotArrowCount,
  getPoisonDamagePerTick,
  selectMultiShotTargets
} from '../playerBowSkills'
import {
  FIREBALL_BURN_TICK_COUNT,
  FIREBALL_BURN_TICK_INTERVAL_MILLISECONDS,
  FIREBALL_SPLASH_DAMAGE_RATIO,
  PLAYER_MAGIC_CAST_RECOVERY_MILLISECONDS,
  PLAYER_MAGIC_CAST_WINDUP_MILLISECONDS,
  getChainLightningHitDamage,
  getChainLightningJumpCount,
  getFireballBurnDamagePerTick,
  getIceBoltFreezeDurationMilliseconds,
  selectChainLightningTargets,
  selectFireballSplashTargets
} from '../playerMagicSkills'
import {
  PLAYER_SMASH_SKILL_COOLDOWN_MILLISECONDS,
  PLAYER_SMASH_SKILL_EFFECT_ANIMATION_SPEED,
  PLAYER_SMASH_SKILL_ID,
  PLAYER_SMASH_SKILL_SEGMENT_COUNT,
  PLAYER_SMASH_SKILL_SEGMENT_DURATION_MILLISECONDS,
  PLAYER_SMASH_SKILL_SEGMENT_STAGGER_MILLISECONDS
} from '../playerSmashSkill'
import {
  PLAYER_ROLL_COOLDOWN_MILLISECONDS,
  type PlayerRollState,
  type PlayerRollVector,
  type PlayerRollVisualState
} from '../playerRoll'
import {
  type PlayerControlBindingId,
  type PlayerControlBindings
} from '../playerControls'
// 퀘스트는 develop-chich의 TS 모듈을 직접 쓴다(동적 퀘스트가 TS 상태라 Lua 경유 시 누락).
import {
  completeQuest,
  formatQuestTextLines,
  getNextQuestInteractionForNpc,
  getQuestNpcBadgeKindForNpc,
  recordItemAcquireQuestProgress,
  recordItemUseQuestProgress,
  recordMonsterDefeatQuestProgress,
  recordQuestObjectiveProgress,
  getAllQuestDefinitions,
  getQuestProgress,
  getVisibleQuestDefinitions,
  recordShopOpenQuestProgress,
  recordTalkQuestProgress,
  startQuest,
  type CompleteQuestResult,
  type QuestItemReward,
  type QuestDefinition,
  type QuestLogState
} from '../questLog'
// 팀원(develop-chich) Lua 방식: 모듈별 Lua 래퍼 인스턴스 + 비변환 함수는 TS에서.
import { createLuaPlayerStatEffects } from '../playerStatEffectsLua'
import { grantPlayerExperience } from '../playerExperience'
import { rollMonsterEquipmentDrop } from '../monsterEquipmentDrops'
import { grantPlayerSkillPoints } from '../playerProgression'
import {
  createMonsterPatrolState,
  stepMonsterPatrol,
  type MonsterPatrolState
} from '../monsterPatrol'
import {
  applyMonsterDamage,
  isMonsterDefeated,
  type MonsterCombatState
} from '../monsterCombat'
import { createLuaMonsterCombat } from '../monsterCombatLua'
import { createLuaMonsterRewards } from '../monsterRewardsLua'
import { createLuaBlacksmithPricing } from '../blacksmithShopLua'
// 플레이어/캐릭터/스킬/조작/소비/장비 등 chichi가 변환한 로직은 chichi Lua 퍼사드로 실행(동일 시그니처).
import {
  getMonsterDisplayName,
  findFirstEmptyPlayerInventorySlotIndex,
  setPlayerInventorySlot,
  getPlayerEquipmentItemDefinitionById,
  usePlayerQuickslotConsumable,
  clearPlayerQuickslotAssignment,
  getPlayerSkillSlotIndexFromCode,
  getPlayerSkillDamageById,
  getPlayerSkillManaCostById,
  getPlayerSkillLevelById,
  getPlayerProtectSkillDurationByLevel,
  isPlayerSkillUnlockedInProfile,
  createIdleNpcCharacterController,
  createLuaCharacterController,
  createNpcCharacter,
  moveCharacterState,
  getPlayerSmashSkillSegmentPlacement,
  getPlayerRollDistanceTiles,
  getPlayerRollProgress,
  getPlayerRollVisualState,
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
import {
  createMapPortalsFromEventLayers,
  type MapPortal
} from '../tiled/createMapPortalsFromEventLayers'
import {
  createWallTileLookup,
  isWallTileAt
} from '../tiled/createWallTileLookup'
import {
  doCollisionRectsIntersect,
  isCharacterPositionBlocked,
  resolveCornerAssistNudge,
  type CollisionRect
} from './characterCollision'
import type {
  ParsedTiledMap,
  ParsedTiledTile,
  ParsedTiledTileset
} from '../tiled/parseTiledMap'
import {
  createTileTexture,
  resolveTilesetForTile,
  type TileTextureFrameSource,
  type TilesetRenderResources
} from './tiledMapRenderResources'
import {
  getSpriteTransformForTile,
  hasTileTransform
} from './tiledSpriteTransform'
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
import blacksmithPortraitUrl from '../assets/portraits/blacksmith-mozarchan.png'
import potionMerchantPortraitUrl from '../assets/portraits/potion-merchant.png'
import santaPortraitUrl from '../assets/portraits/santa.png'
import type { MonsterAnimationTextures } from './monsterAnimationTextures'
import {
  BOSS_DAMAGE_MULTIPLIER,
  BOSS_HP_MULTIPLIER,
  BOSS_RENDER_SCALE_MULTIPLIER,
  MONSTER_HP_MULTIPLIER
} from '../monsterTuning'
import { loadLpcMonsterTextures, type LpcMonsterSpec } from './loadLpcMonsterTextures'
import { createGameSoundEffects, isGameSoundEffectId } from './createGameSoundEffects'
import {
  createPauseMenuOverlay,
  type AudioSettings
} from './createPauseMenuOverlay'
import {
  QUEST_GIVER_PORTRAIT_KEY_BY_NPC_ID,
  createQuestLogOverlay
} from './createQuestLogOverlay'
import { createQuestTrackerOverlay } from './createQuestTrackerOverlay'
import {
  startScenarioRun,
  type ScenarioRewardGrant,
  type ScenarioRun
} from '../scenario/scenarioRuntime'
import {
  createScenarioFlagAccess,
  getScenarioForNpc,
  isPriorityScenarioForNpc
} from '../scenario/scenarioStore'
import { POTION_ITEM_DEFINITIONS } from '../potionShop'

type CreatePixiTiledMapViewInput = {
  mountElement: HTMLElement
  map: ParsedTiledMap
  characters: CharacterState[]
  playerProfile: PlayerProfile
  playerEquipment: PlayerEquipment
  playerInventory: PlayerInventory
  playerQuickslots: PlayerQuickslots
  playerSkillSlots: PlayerSkillSlots
  playerControlBindings: PlayerControlBindings
  questLog: QuestLogState
  merchantInventory: PlayerInventory
  potionMerchantInventory: PlayerInventory
  sceneId: string
  sceneIntroMessage: string
  cameraTargetCharacterId: string
  characterSpriteSheet: {
    tileset: ParsedTiledTileset
    scale: number
  }
  imageUrls: Record<string, string>
  controllerRuntime: CharacterControllerRuntime
  onPlayerInventoryChange: (nextInventory: PlayerInventory) => void
  onPlayerEquipmentChange: (nextEquipment: PlayerEquipment) => void
  onPlayerQuickslotsChange: (nextQuickslots: PlayerQuickslots) => void
  onPlayerSkillSlotsChange: (nextSkillSlots: PlayerSkillSlots) => void
  onPlayerControlBindingsChange: (
    nextControlBindings: PlayerControlBindings
  ) => void
  onQuestLogChange: (nextQuestLog: QuestLogState) => void
  // 이 씬에서 이미 획득한 바닥 코인 타일 키(`x,y`) — 렌더에서 제외된다.
  collectedCoinTileKeys: readonly string[]
  onCoinPileCollected: (tileKey: string) => void
  // 이 씬에서 이미 쓰러뜨린 보스 id — 다시 나타나지 않는다.
  defeatedBossIds: readonly string[]
  onBossDefeated: (bossId: string) => void
  onMerchantInventoryChange: (nextInventory: PlayerInventory) => void
  onPotionMerchantInventoryChange: (nextInventory: PlayerInventory) => void
  audioSettings: AudioSettings
  onAudioSettingsChange: (nextAudioSettings: AudioSettings) => void
  onRequestSceneChange: (request: SceneTransitionRequest) => void
}

type ApplyEventDraftInput = {
  targetCharacterId?: string
}

export type SceneTransitionRequest = {
  sceneId: string
  spawn: {
    x: number
    y: number
  }
  facing?: CharacterMoveDirection
}

export type ApplyEventDraftResult = {
  didApply: boolean
  targetCharacterId?: string
}

type SlashVfxRenderResources = {
  horizontalTextures: Texture[]
  verticalTextures: Texture[]
}

type ProtectVfxRenderResources = {
  shieldTextures: Texture[]
}

type ResolvedCharacterAppearanceTexture = {
  texture: Texture
  renderScale: number
}

type ActiveCharacterMessage = {
  container: Container
  panel: NineSliceSprite
  text: Text
  expiresAt: number
}

type ActiveCharacterDamageText = {
  container: Container
  text: Text
  startedAt: number
  durationMilliseconds: number
  expiresAt: number
}

type MonsterGoldDrop = {
  id: string
  container: Container
  coin: Sprite
  shine: Graphics
  amountText: Text
  amount: number
  position: {
    x: number
    y: number
  }
  createdAt: number
}

type MonsterEquipmentDrop = {
  id: string
  dropId: string
  itemId: string
  label: string
  container: Container
  sprite: Sprite
  labelText: Text
  position: {
    x: number
    y: number
  }
  createdAt: number
}

type RenderedCharacterNode = {
  container: Container
  sprite: Sprite
  renderScale: number
  // 이름표·체력바·레벨 뱃지: 나무·건물·떨어진 돈에 가리지 않게 메시지 레이어(월드 맨 위)에서
  // 캐릭터 위치를 따라다닌다.
  labelContainer?: Container
  // LPC 그림체 캐릭터(플레이어·NPC): sprite 는 1칸짜리 투명 판(라벨·막대·판정 기준)이고,
  // 실제 그림은 발끝 기준으로 그 위에 얹힌 lpc.sprite 다.
  lpc?: {
    sprite: Sprite
    // 플레이어: 장비 레이어별 스프라이트(뒤 무기 → 기본 → 신발 → 갑옷 → 머리 → 투구 → 앞 무기)
    playerLayers?: Map<LpcPlayerLayerSlot, Sprite>
    npcSheets?: LpcCharacterSheets
    cell: number
    lastX: number
    lastY: number
    movingUntilMilliseconds: number
  }
  playerArmorSprite?: Sprite
  playerHelmetSprite?: Sprite
  questBadge?: Sprite
  playerHealthBar?: {
    container: Container
    track: Graphics
    fill: Graphics
  }
  playerManaBar?: {
    container: Container
    track: Graphics
    fill: Graphics
  }
  playerNameBadge?: Text
  displayLabelPanel?: NineSliceSprite
  displayLabel?: Text
  levelBadge?: Text
  monsterHealthBar?: {
    container: Container
    track: Graphics
    fill: Graphics
  }
}

type RenderedPortalNode = {
  container: Container
  sprite: Sprite
}

type MonsterPigAnimationMode = 'idle' | 'run' | 'hit' | 'attack'

type MonsterPigBehaviorState = {
  isAggroed: boolean
  nextAttackAtMilliseconds: number
  attackUntilMilliseconds: number
  hitReactionUntilMilliseconds: number
}

type MonsterBehaviorConfig = {
  renderScale: number
  aggroRangeTiles: number
  deAggroRangeTiles: number
  chaseSpeedTilesPerSecond: number
  patrolSpeedTilesPerSecond: number
  attackRangeTiles: number
  attackIntervalMilliseconds: number
  attackDurationMilliseconds: number
  hitReactionDurationMilliseconds: number
  idleAnimationSpeed: number
  runAnimationSpeed: number
  hitAnimationSpeed: number
  attackAnimationSpeed: number
  usesRunAnimation: boolean
  runMotionBobPixels: number
  runMotionSwayPixels: number
}

type PlayerHitReactionState = {
  directionX: number
  directionY: number
  startedAtMilliseconds: number
  expiresAtMilliseconds: number
}

type PlayerRollInputState = {
  isModifierPressed: boolean
}

type PlayerVisualEquipmentSlotId = Extract<PlayerEquipmentSlotId, 'armor' | 'hat'>

type PlayerEquipmentAppearanceConfig = {
  slotId: PlayerVisualEquipmentSlotId
  imageUrl: string
  width: number
  height: number
  position: {
    x: number
    y: number
  }
  zIndex: number
}

type PlayerWeaponAppearanceConfig = {
  imageUrl: string
  worldScale: number
  idleOffsetX: number
  idleOffsetY: number
}

const DEPTH_SORTED_LAYER_NAME = 'object'
const TINY_DUNGEON_TILESET_IMAGE_URL = new URL(
  '../assets/tilesets/tiny-dungeon-16.png',
  import.meta.url
).href
const MONSTER_EQUIPMENT_DROP_IMAGE_URL_BY_DROP_ID: Record<string, string> = {
  'iron-sword_drop': new URL(
    '../assets/weapons/lpc/weapon-icon-iron-sword.png',
    import.meta.url
  ).href,
  'battle-axe_drop': new URL(
    '../assets/weapons/lpc/weapon-icon-battle-axe.png',
    import.meta.url
  ).href,
  'long-spear_drop': new URL(
    '../assets/weapons/lpc/weapon-icon-long-spear.png',
    import.meta.url
  ).href,
  'quick-dagger_drop': new URL(
    '../assets/weapons/lpc/weapon-icon-quick-dagger.png',
    import.meta.url
  ).href,
  'spiked-mace_drop': new URL(
    '../assets/weapons/lpc/weapon-icon-spiked-mace.png',
    import.meta.url
  ).href,
  'magic-staff_drop': new URL(
    '../assets/weapons/lpc/weapon-icon-magic-staff.png',
    import.meta.url
  ).href,
  Leather_Armor_drop: new URL(
    '../assets/characters/lpc/gear-icon-Leather_Armor.png',
    import.meta.url
  ).href,
  Leather_Helmet_drop: new URL(
    '../assets/characters/lpc/gear-icon-Leather_Helmet.png',
    import.meta.url
  ).href,
  Chain_Armor_drop: new URL(
    '../assets/characters/lpc/gear-icon-Chain_Armor.png',
    import.meta.url
  ).href,
  Chain_Helmet_drop: new URL(
    '../assets/characters/lpc/gear-icon-Chain_Helmet.png',
    import.meta.url
  ).href,
  Iron_Armor_drop: new URL(
    '../assets/characters/lpc/gear-icon-Iron_Armor.png',
    import.meta.url
  ).href,
  Iron_Helmet_drop: new URL(
    '../assets/characters/lpc/gear-icon-Iron_Helmet.png',
    import.meta.url
  ).href
}
const MESSAGE_PANEL_BORDER_SIZE = 8
const MESSAGE_PANEL_PADDING_X = 12
const MESSAGE_PANEL_PADDING_Y = 8
const MESSAGE_PANEL_MIN_WIDTH = 64
const MESSAGE_PANEL_MIN_HEIGHT = 28
const MESSAGE_TEXT_MAX_WIDTH = 188
const MESSAGE_OFFSET_Y = 10
const MESSAGE_TEXT_STYLE = new TextStyle({
  align: 'center',
  breakWords: true,
  fill: 0x2e2313,
  fontFamily: '"Jersey 25", NeoDunggeunmo, monospace',
  fontSize: 14,
  lineHeight: 18,
  padding: 2,
  wordWrap: true,
  wordWrapWidth: MESSAGE_TEXT_MAX_WIDTH
})
const DAMAGE_TEXT_STYLE = new TextStyle({
  align: 'center',
  fill: 0xff5b5b,
  fontFamily: '"Jersey 25", NeoDunggeunmo, monospace',
  fontSize: 16,
  lineHeight: 18,
  stroke: {
    color: 0x2a0909,
    width: 3
  }
})
const EVADE_TEXT_STYLE = new TextStyle({
  align: 'center',
  fill: 0xe6f79c,
  fontFamily: '"Jersey 25", NeoDunggeunmo, monospace',
  fontSize: 16,
  lineHeight: 18,
  stroke: {
    color: 0x324b12,
    width: 3
  }
})
const LEVEL_UP_TEXT_STYLE = new TextStyle({
  align: 'center',
  fill: 0xffdf7a,
  fontFamily: '"Jersey 25", NeoDunggeunmo, monospace',
  fontSize: 16,
  lineHeight: 18,
  stroke: {
    color: 0x3b2600,
    width: 3
  }
})
const BLACKSMITH_SHOP_NPC_ID = 'blacksmith'
const POTION_SHOP_NPC_ID = 'potion_merchant'
// 물약 상점을 여는 NPC: 마을 물약상인 + 사냥터 야영지 떠돌이 상인
const POTION_SHOP_NPC_IDS = new Set([POTION_SHOP_NPC_ID, 'camp_merchant'])

// 비주얼노벨 대화창을 쓰는 NPC → 초상화 이미지. 여기 등록된 NPC 는 머리 위 말풍선 대신
// 하단 대화창으로 대사를 보여준다. (우선 대장장이 모차르찬부터)
const NPC_PORTRAITS: Record<string, string> = {
  [BLACKSMITH_SHOP_NPC_ID]: blacksmithPortraitUrl,
  [POTION_SHOP_NPC_ID]: potionMerchantPortraitUrl,
  santa: santaPortraitUrl
}

// 시나리오 reward 노드는 item_id 만 담는다. 인벤토리 표시는 라벨이 필요하므로
// 기존 정의(포션·장비)에서 해석하고, 모르는 id 는 id 그대로 노출한다.
const SCENARIO_REWARD_ITEM_LABEL_BY_ID: Record<string, string> = Object.fromEntries([
  ...POTION_ITEM_DEFINITIONS.map((item) => [item.id, item.label] as const),
  ...PLAYER_EQUIPMENT_ITEM_DEFINITIONS.map((item) => [item.id, item.label] as const)
])

const SIGN_POST_APPEARANCE_TYPE = 'sign_inn'
const MONSTER_PIG_APPEARANCE_TYPE = 'monster_pig'
const MONSTER_SLIME_APPEARANCE_TYPE = 'monster_slime'
const MONSTER_ROCK_APPEARANCE_TYPE = 'monster_rock'
const MONSTER_MUSHROOM_APPEARANCE_TYPE = 'monster_mushroom'
const GROUND_LAYER_NAME = 'ground'
const GRASS_TILE_TYPES = new Set(['garden_round_mid_01'])
const GAME_VIEWPORT_WIDTH = 960
const GAME_VIEWPORT_HEIGHT = 540
const CAMERA_DEFAULT_ZOOM = 1.1
const CAMERA_MIN_ZOOM = 0.8
const CAMERA_MAX_ZOOM = 2
const CAMERA_ZOOM_WHEEL_SPEED = 0.0015
const MONSTER_PIG_WORLD_SCALE = 1
const MONSTER_SLIME_WORLD_SCALE = 1
// PA2 스트립 몬스터(바위/버섯)는 프레임이 32-38px라 확대 배율이 1을 넘는다.
const MONSTER_ROCK_WORLD_SCALE = 1
const MONSTER_MUSHROOM_WORLD_SCALE = 0.62

// ---- LPC 몬스터 시트(행 순서: 위·왼·아래·오른, 오른쪽이 없는 시트는 반전)
const lpcMonsterUrl = (file: string) =>
  new URL(`../assets/monsters/lpc/${file}`, import.meta.url).href
const lpcStrip = (
  file: string,
  cellWidth: number,
  cellHeight: number,
  row: number,
  frames: readonly number[],
  mirror = false
) => ({ url: lpcMonsterUrl(file), cellWidth, cellHeight, row, frames, mirror })
const range = (count: number) => Array.from({ length: count }, (_, index) => index)
// 꿀꿀이: 농장 돼지(걷기 4프레임, 먹기 = 들이받기)
const LPC_PIG_SPEC: LpcMonsterSpec = {
  idleLeft: lpcStrip('pig-walk.png', 128, 128, 1, [0]),
  idleRight: lpcStrip('pig-walk.png', 128, 128, 3, [0]),
  runLeft: lpcStrip('pig-walk.png', 128, 128, 1, range(4)),
  runRight: lpcStrip('pig-walk.png', 128, 128, 3, range(4)),
  hitLeft: lpcStrip('pig-walk.png', 128, 128, 1, [2]),
  hitRight: lpcStrip('pig-walk.png', 128, 128, 3, [2]),
  attackLeft: lpcStrip('pig-eat.png', 128, 128, 1, range(4)),
  attackRight: lpcStrip('pig-eat.png', 128, 128, 3, range(4))
}
// 말캉이: 슬라임(통통 튀기 6프레임, 덮치기 8프레임). 방향이 없어 오른쪽은 반전
const LPC_SLIME_SPEC: LpcMonsterSpec = {
  idleLeft: lpcStrip('slime.png', 64, 64, 0, range(6)),
  idleRight: lpcStrip('slime.png', 64, 64, 0, range(6), true),
  runLeft: lpcStrip('slime.png', 64, 64, 0, range(6)),
  runRight: lpcStrip('slime.png', 64, 64, 0, range(6), true),
  hitLeft: lpcStrip('slime.png', 64, 64, 0, [3]),
  hitRight: lpcStrip('slime.png', 64, 64, 0, [3], true),
  attackLeft: lpcStrip('slime.png', 64, 64, 1, range(8)),
  attackRight: lpcStrip('slime.png', 64, 64, 1, range(8), true)
}
// 바위돌이: 골렘(걷기 7프레임, 공격 칸은 64x96)
const LPC_GOLEM_SPEC: LpcMonsterSpec = {
  idleLeft: lpcStrip('golem-walk.png', 64, 64, 1, [0]),
  idleRight: lpcStrip('golem-walk.png', 64, 64, 3, [0]),
  runLeft: lpcStrip('golem-walk.png', 64, 64, 1, range(7)),
  runRight: lpcStrip('golem-walk.png', 64, 64, 3, range(7)),
  hitLeft: lpcStrip('golem-die.png', 64, 64, 0, [1]),
  hitRight: lpcStrip('golem-die.png', 64, 64, 0, [1], true),
  attackLeft: lpcStrip('golem-attack.png', 64, 96, 1, range(7)),
  attackRight: lpcStrip('golem-attack.png', 64, 96, 3, range(7))
}
// 버섯돌이: 얼굴 달린 버섯(2프레임씩 표정 변화). 방향이 없어 오른쪽은 반전
const LPC_MUSHROOM_SPEC: LpcMonsterSpec = {
  idleLeft: lpcStrip('mushroom.png', 64, 64, 0, [0, 1]),
  idleRight: lpcStrip('mushroom.png', 64, 64, 0, [0, 1], true),
  runLeft: lpcStrip('mushroom.png', 64, 64, 1, [0, 1]),
  runRight: lpcStrip('mushroom.png', 64, 64, 1, [0, 1], true),
  hitLeft: lpcStrip('mushroom.png', 64, 64, 2, [0]),
  hitRight: lpcStrip('mushroom.png', 64, 64, 2, [0], true),
  attackLeft: lpcStrip('mushroom.png', 64, 64, 3, [0, 1]),
  attackRight: lpcStrip('mushroom.png', 64, 64, 3, [0, 1], true)
}
const MONSTER_PIG_CHASE_SPEED_TILES_PER_SECOND = 4.4
const MONSTER_PIG_IDLE_ANIMATION_SPEED = 0.08
const MONSTER_PIG_RUN_ANIMATION_SPEED = 0.22
const MONSTER_PIG_HIT_ANIMATION_SPEED = 0.18
const MONSTER_PIG_ATTACK_ANIMATION_SPEED = 0.14
const MONSTER_PIG_ATTACK_INTERVAL_MILLISECONDS = 5000
const MONSTER_PIG_ATTACK_DURATION_MILLISECONDS = 720
const MONSTER_PIG_ATTACK_RANGE_TILES = 1.2
const MONSTER_PIG_AGGRO_RANGE_TILES = 4.8
const MONSTER_PIG_DE_AGGRO_RANGE_TILES = 7.2
const MONSTER_PIG_HIT_REACTION_DURATION_MILLISECONDS = 260
const MONSTER_PIG_RESPAWN_DELAY_MILLISECONDS = 8000
// 보스 몬스터: TMX 오브젝트 이름이 '-보스'로 끝난다(예: 말캉이-보스).
const isBossCharacterId = (characterId: string): boolean => characterId.endsWith('-보스')
// 퀘스트에 아직 필요한 보스는 영영 사라지지 않고 이만큼 뒤에 다시 생긴다.
const BOSS_RETRY_RESPAWN_DELAY_MILLISECONDS = 30000
const MONSTER_CONTACT_DAMAGE_COOLDOWN_MILLISECONDS = 900
const PLAYER_ATTACK_PROBE_DISTANCE_IN_TILES = 1.2
const DAMAGE_TEXT_FLOAT_DISTANCE = 16
const DAMAGE_TEXT_DURATION_MILLISECONDS = 1000
const EVADE_TEXT_DURATION_MILLISECONDS = 700
const DAMAGE_TEXT_OFFSET_Y = 8
const MONSTER_CONTACT_DAMAGE_TOUCH_TOLERANCE_TILES = 0.14
const MONSTER_ATTACK_RANGE_TOUCH_TOLERANCE_TILES = 0.14
const PLAYER_RESPAWN_DELAY_MILLISECONDS = 3000
const PLAYER_HIT_REACTION_DURATION_MILLISECONDS = 180
const PLAYER_DAMAGE_INVULNERABILITY_MILLISECONDS = 600
const PLAYER_HIT_REACTION_MAX_OFFSET_PIXELS = 6
const PLAYER_PROTECT_SKILL_COOLDOWN_MILLISECONDS = 4600
// 떨어진 돈: 동굴 바닥 금화와 같은 LPC 금화 더미 타일(town-32 gid 1109~1112, 동전 몇 개 → 쌓인 더미).
const MONSTER_GOLD_DROP_PILE_GIDS: readonly number[] = [1109, 1110, 1111, 1112]
// 금액이 이 값 이상이면 한 단계 큰 더미 그림
const MONSTER_GOLD_DROP_PILE_THRESHOLDS: readonly number[] = [0, 20, 45, 90]
const MONSTER_GOLD_DROP_ICON_RADIUS = 8
// 튀어나오는 연출: 위로 솟았다 떨어지며 두 번 튄다
const MONSTER_GOLD_DROP_POP_MILLISECONDS = 520
const MONSTER_GOLD_DROP_POP_HEIGHT_PIXELS = 18
const MONSTER_GOLD_DROP_AMOUNT_TEXT_STYLE = new TextStyle({
  align: 'center',
  fill: 0xffd86b,
  fontFamily: '"Jersey 25", NeoDunggeunmo, monospace',
  fontSize: 12,
  lineHeight: 14,
  stroke: {
    color: 0x4f3200,
    width: 3
  }
})
const MONSTER_GOLD_DROP_PICKUP_WIDTH = 14
const MONSTER_GOLD_DROP_PICKUP_HEIGHT = 14
const COIN_PILE_PICKUP_WIDTH = 20
const COIN_PILE_PICKUP_HEIGHT = 20
const MONSTER_EQUIPMENT_DROP_RENDER_SIZE = 24
const MONSTER_EQUIPMENT_DROP_PICKUP_WIDTH = 20
const MONSTER_EQUIPMENT_DROP_PICKUP_HEIGHT = 20
const MONSTER_LEVEL_BADGE_STYLE = new TextStyle({
  align: 'center',
  fill: 0xf4e7c5,
  fontFamily: '"Jersey 25", NeoDunggeunmo, monospace',
  fontSize: 12,
  stroke: {
    color: 0x2e2313,
    width: 3
  }
})
const PLAYER_NAME_BADGE_STYLE = new TextStyle({
  align: 'center',
  fill: 0xf4e7c5,
  fontFamily: '"Jersey 25", NeoDunggeunmo, monospace',
  fontSize: 12,
  lineHeight: 13,
  padding: 1,
  stroke: {
    color: 0x2e2313,
    width: 3
  }
})
const PLAYER_HEALTH_BAR_WIDTH = 38
const PLAYER_HEALTH_BAR_HEIGHT = 5
const PLAYER_HEALTH_BAR_TRACK_COLOR = 0x2e2313
const PLAYER_HEALTH_BAR_FILL_COLOR = 0xd06b5d
const PLAYER_HEALTH_BAR_BORDER_COLOR = 0xf4e7c5
const PLAYER_HEALTH_BAR_GAP = 5
const PLAYER_MANA_BAR_WIDTH = 38
const PLAYER_MANA_BAR_HEIGHT = 5
const PLAYER_MANA_BAR_TRACK_COLOR = 0x2e2313
const PLAYER_MANA_BAR_FILL_COLOR = 0x5b86d6
const PLAYER_MANA_BAR_BORDER_COLOR = 0xf4e7c5
const PLAYER_MANA_BAR_GAP = 2
const SIGN_POST_LABEL_STYLE = new TextStyle({
  align: 'center',
  breakWords: true,
  fill: 0xf4e7c5,
  fontFamily: '"Jersey 25", NeoDunggeunmo, monospace',
  fontSize: 11,
  lineHeight: 12,
  padding: 0,
  stroke: {
    color: 0x2e2313,
    width: 2
  },
  wordWrap: true,
  wordWrapWidth: 128
})
const MONSTER_HEALTH_BAR_WIDTH = 34
const MONSTER_HEALTH_BAR_HEIGHT = 5
const MONSTER_HEALTH_BAR_TRACK_COLOR = 0x2e2313
const MONSTER_HEALTH_BAR_FILL_COLOR = 0x7dc96d
const MONSTER_HEALTH_BAR_BORDER_COLOR = 0xf4e7c5
const MONSTER_HEALTH_BAR_GAP = 4
const PLAYER_WEAPON_TILE_LOCAL_ID = 117
const PLAYER_WEAPON_TILE_FRAME_SOURCE: TileTextureFrameSource = {
  columns: 12,
  margin: 0,
  spacing: 0,
  tileWidth: 16,
  tileHeight: 16
}
const WHITE_SLASH_WIDE_FRAME_URLS = [
  new URL(
    '../assets/vfx/Sword Slashes/White Slash Wide/File1.png',
    import.meta.url
  ).href,
  new URL(
    '../assets/vfx/Sword Slashes/White Slash Wide/File2.png',
    import.meta.url
  ).href,
  new URL(
    '../assets/vfx/Sword Slashes/White Slash Wide/File3.png',
    import.meta.url
  ).href,
  new URL(
    '../assets/vfx/Sword Slashes/White Slash Wide/File4.png',
    import.meta.url
  ).href,
  new URL(
    '../assets/vfx/Sword Slashes/White Slash Wide/File5.png',
    import.meta.url
  ).href,
  new URL(
    '../assets/vfx/Sword Slashes/White Slash Wide/File6.png',
    import.meta.url
  ).href
]
const WHITE_SLASH_WIDE_FRAME_BOUNDS: CollisionRect[] = [
  { x: 63, y: 25, width: 465, height: 345 },
  { x: 75, y: 165, width: 463, height: 196 },
  { x: 33, y: 285, width: 373, height: 87 },
  { x: 11, y: 186, width: 119, height: 181 },
  { x: 11, y: 103, width: 41, height: 212 },
  { x: 29, y: 63, width: 23, height: 55 }
]
const PROTECT_VFX_FRAME_IMAGE_URL = new URL(
  '../assets/Pipoya VFX HEXShield/192x192/pipo-btleffect207_192.png',
  import.meta.url
).href
const PROTECT_VFX_FRAME_WIDTH = 192
const PROTECT_VFX_FRAME_HEIGHT = 192
const PROTECT_VFX_FRAME_COLUMNS = 5
const PROTECT_VFX_FRAME_ROWS = 4
const PROTECT_VFX_ANIMATION_SPEED = 0.35
const PROTECT_VFX_SCALE = 0.52
const SLASH_VFX_HIT_PADDING_PIXELS = 2
const PLAYER_WEAPON_WORLD_SCALE = 1.35
const PLAYER_ATTACK_TRAIL_PROGRESS_STEP = 0.12
const PLAYER_ATTACK_TRAIL_ALPHA = [0.42, 0.28, 0.18, 0.1]
const PLAYER_ATTACK_TRAIL_SPRITE_COUNT = PLAYER_ATTACK_TRAIL_ALPHA.length
const PLAYER_ATTACK_SWING_X_OFFSET = 4
const PLAYER_ATTACK_LIFT_Y_OFFSET = 3
const PLAYER_NAME_BADGE_FOOT_OFFSET = 6
const PLAYER_STATUS_STACK_CLEARANCE = 6
const PLAYER_ATTACK_ROTATION_OFFSET = 1.15
const PLAYER_ATTACK_SCALE_BOOST = 0.06
const PLAYER_ATTACK_SLASH_EFFECT_SCALE_X = 0.23
const PLAYER_ATTACK_SLASH_EFFECT_SCALE_Y = 0.23
const PLAYER_ATTACK_SLASH_EFFECT_ANIMATION_SPEED = 0.6
const PLAYER_WEAPON_PLACEMENT_RIGHT = {
  x: 23,
  y: 21,
  rotation: 0.75
}
const PLAYER_WEAPON_PLACEMENT_LEFT = {
  x: 9,
  y: 21,
  rotation: -0.75
}
const PLAYER_WEAPON_APPEARANCE_CONFIG_BY_ITEM_ID: Record<
  string,
  PlayerWeaponAppearanceConfig
> = {
  'iron-sword': {
    imageUrl: new URL('../assets/weapons/weapon-sword.png', import.meta.url).href,
    worldScale: 0.085,
    idleOffsetX: -3,
    idleOffsetY: 2
  },
  'battle-axe': {
    imageUrl: new URL('../assets/weapons/weapon-axe.png', import.meta.url).href,
    worldScale: 0.085,
    idleOffsetX: -5,
    idleOffsetY: 4
  },
  'long-spear': {
    imageUrl: new URL('../assets/weapons/weapon-spear.png', import.meta.url).href,
    worldScale: 0.085,
    idleOffsetX: -2,
    idleOffsetY: 3
  },
  'quick-dagger': {
    imageUrl: new URL('../assets/weapons/weapon-dagger.png', import.meta.url).href,
    worldScale: 0.085,
    idleOffsetX: -2,
    idleOffsetY: 1
  },
  'spiked-mace': {
    imageUrl: new URL('../assets/weapons/weapon-mace.png', import.meta.url).href,
    worldScale: 0.085,
    idleOffsetX: -4,
    idleOffsetY: 4
  },
  'magic-staff': {
    imageUrl: new URL('../assets/weapons/weapon-staff.png', import.meta.url).href,
    worldScale: 0.085,
    idleOffsetX: -2,
    idleOffsetY: 3
  },
  'hunting-bow': {
    // 임시 인핸드 활 — Legend of Lua 에셋(6x13px). 본편 스타일 활 스프라이트가 생기면 교체.
    imageUrl: '/legend-sprites/items/bow1.png',
    worldScale: 1.6,
    idleOffsetX: -2,
    idleOffsetY: 2
  }
}
const PLAYER_ARMOR_EQUIPMENT_CONFIG = {
  width: 24,
  height: 9,
  position: {
    x: 16,
    y: 24
  },
  zIndex: 12
}
const PLAYER_HELMET_EQUIPMENT_CONFIG = {
  width: 22,
  height: 15,
  position: {
    x: 16,
    y: 9
  },
  zIndex: 13
}
const PLAYER_EQUIPMENT_APPEARANCE_CONFIG_BY_ITEM_ID: Record<
  string,
  PlayerEquipmentAppearanceConfig
> = {
  Leather_Armor: {
    slotId: 'armor',
    imageUrl: new URL('../assets/armor/Leather_Armor.png', import.meta.url).href,
    ...PLAYER_ARMOR_EQUIPMENT_CONFIG
  },
  Leather_Helmet: {
    slotId: 'hat',
    imageUrl: new URL('../assets/armor/Leather_Helmet.png', import.meta.url).href,
    ...PLAYER_HELMET_EQUIPMENT_CONFIG
  },
  Chain_Armor: {
    slotId: 'armor',
    imageUrl: new URL('../assets/armor/Chain_Armor.png', import.meta.url).href,
    ...PLAYER_ARMOR_EQUIPMENT_CONFIG
  },
  Chain_Helmet: {
    slotId: 'hat',
    imageUrl: new URL('../assets/armor/Chain_Helmet.png', import.meta.url).href,
    ...PLAYER_HELMET_EQUIPMENT_CONFIG
  },
  Iron_Armor: {
    slotId: 'armor',
    imageUrl: new URL('../assets/armor/Iron_Armor.png', import.meta.url).href,
    ...PLAYER_ARMOR_EQUIPMENT_CONFIG
  },
  Iron_Helmet: {
    slotId: 'hat',
    imageUrl: new URL('../assets/armor/Iron_Helmet.png', import.meta.url).href,
    ...PLAYER_HELMET_EQUIPMENT_CONFIG
  }
}
const PORTAL_INSIDE_IMAGE_URL = new URL(
  '../assets/tilesets/portal_inside.png',
  import.meta.url
).href
const PORTAL_INSIDE_WORLD_SCALE = 0.08
const SCENE_INTRO_VISIBLE_DURATION_MILLISECONDS = 3000
const PLAYER_ATTACK_DURATION_MILLISECONDS = 320
const PLAYER_ATTACK_COOLDOWN_MILLISECONDS = 300
const QUEST_DIALOGUE_DURATION_MILLISECONDS = 3600
const QUEST_START_TEXT = '퀘스트 시작!'
const QUEST_OBJECTIVE_COMPLETE_TEXT = '퀘스트 목표 완료!'
const QUEST_COMPLETE_TEXT = '퀘스트 완료!'
const QUEST_BADGE_SCALE = 0.16
const QUEST_BADGE_Y_OFFSET = 10
// LPC 캐릭터는 머리가 타일 위로 약 22px 솟는다 — 머리 위 막대·뱃지를 그만큼 더 올린다.
const LPC_HEAD_CLEARANCE_PIXELS = 22
// 한 프레임 동안 위치 변화가 없어도 이 시간까지는 걷는 중으로 본다(프레임 사이 떨림 방지).
const LPC_MOVING_HOLD_MILLISECONDS = 120
type MonsterAppearanceType =
  | typeof MONSTER_PIG_APPEARANCE_TYPE
  | typeof MONSTER_SLIME_APPEARANCE_TYPE
  | typeof MONSTER_ROCK_APPEARANCE_TYPE
  | typeof MONSTER_MUSHROOM_APPEARANCE_TYPE

const MONSTER_BEHAVIOR_CONFIG_BY_APPEARANCE_TYPE: Record<
  MonsterAppearanceType,
  MonsterBehaviorConfig
> = {
  [MONSTER_PIG_APPEARANCE_TYPE]: {
    renderScale: MONSTER_PIG_WORLD_SCALE,
    aggroRangeTiles: MONSTER_PIG_AGGRO_RANGE_TILES,
    deAggroRangeTiles: MONSTER_PIG_DE_AGGRO_RANGE_TILES,
    chaseSpeedTilesPerSecond: MONSTER_PIG_CHASE_SPEED_TILES_PER_SECOND,
    patrolSpeedTilesPerSecond: 2.4,
    attackRangeTiles: MONSTER_PIG_ATTACK_RANGE_TILES,
    attackIntervalMilliseconds: MONSTER_PIG_ATTACK_INTERVAL_MILLISECONDS,
    attackDurationMilliseconds: MONSTER_PIG_ATTACK_DURATION_MILLISECONDS,
    hitReactionDurationMilliseconds: MONSTER_PIG_HIT_REACTION_DURATION_MILLISECONDS,
    idleAnimationSpeed: MONSTER_PIG_IDLE_ANIMATION_SPEED,
    runAnimationSpeed: MONSTER_PIG_RUN_ANIMATION_SPEED,
    hitAnimationSpeed: MONSTER_PIG_HIT_ANIMATION_SPEED,
    attackAnimationSpeed: MONSTER_PIG_ATTACK_ANIMATION_SPEED,
    usesRunAnimation: true,
    runMotionBobPixels: 0,
    runMotionSwayPixels: 0
  },
  [MONSTER_SLIME_APPEARANCE_TYPE]: {
    renderScale: MONSTER_SLIME_WORLD_SCALE,
    aggroRangeTiles: 4.4,
    deAggroRangeTiles: 6.8,
    chaseSpeedTilesPerSecond: 3.1,
    patrolSpeedTilesPerSecond: 1.8,
    attackRangeTiles: 1.0,
    attackIntervalMilliseconds: 5400,
    attackDurationMilliseconds: 760,
    hitReactionDurationMilliseconds: 240,
    idleAnimationSpeed: 0.06,
    runAnimationSpeed: 0.16,
    hitAnimationSpeed: 0.16,
    attackAnimationSpeed: 0.12,
    usesRunAnimation: true,
    runMotionBobPixels: 0,
    runMotionSwayPixels: 0
  },
  [MONSTER_ROCK_APPEARANCE_TYPE]: {
    // 바위돌이 — 느리고 단단한 광산 골렘. 어그로가 짧고 추격이 굼뜨다.
    renderScale: MONSTER_ROCK_WORLD_SCALE,
    aggroRangeTiles: 3.6,
    deAggroRangeTiles: 6.4,
    chaseSpeedTilesPerSecond: 1.7,
    patrolSpeedTilesPerSecond: 0.9,
    attackRangeTiles: 1.0,
    attackIntervalMilliseconds: 4200,
    attackDurationMilliseconds: 700,
    hitReactionDurationMilliseconds: 320,
    idleAnimationSpeed: 0.1,
    runAnimationSpeed: 0.22,
    hitAnimationSpeed: 0.2,
    attackAnimationSpeed: 0.26,
    usesRunAnimation: true,
    runMotionBobPixels: 0,
    runMotionSwayPixels: 0
  },
  [MONSTER_MUSHROOM_APPEARANCE_TYPE]: {
    // 버섯돌이 — 재빠르고 성가신 못가 버섯. 넓은 어그로, 빠른 발.
    renderScale: MONSTER_MUSHROOM_WORLD_SCALE,
    aggroRangeTiles: 5.2,
    deAggroRangeTiles: 7.6,
    chaseSpeedTilesPerSecond: 3.4,
    patrolSpeedTilesPerSecond: 2.2,
    attackRangeTiles: 1.0,
    attackIntervalMilliseconds: 4600,
    attackDurationMilliseconds: 600,
    hitReactionDurationMilliseconds: 220,
    idleAnimationSpeed: 0.14,
    runAnimationSpeed: 0.3,
    hitAnimationSpeed: 0.22,
    attackAnimationSpeed: 0.3,
    usesRunAnimation: true,
    runMotionBobPixels: 0,
    runMotionSwayPixels: 0
  }
}

const getMonsterBehaviorConfig = (
  character: CharacterState
): MonsterBehaviorConfig =>
  MONSTER_BEHAVIOR_CONFIG_BY_APPEARANCE_TYPE[
    character.appearanceType as MonsterAppearanceType
  ] ?? MONSTER_BEHAVIOR_CONFIG_BY_APPEARANCE_TYPE[MONSTER_PIG_APPEARANCE_TYPE]

const createMonsterHealthBar = (): NonNullable<
  RenderedCharacterNode['monsterHealthBar']
> => {
  const container = new Container()
  const track = new Graphics()
  const fill = new Graphics()

  container.sortableChildren = true
  track.roundPixels = true
  fill.roundPixels = true
  track.zIndex = 0
  fill.zIndex = 1
  container.addChild(track, fill)

  return {
    container,
    track,
    fill
  }
}

const createQuestBadgeSprite = (texture: Texture): Sprite => {
  const sprite = new Sprite(texture)

  sprite.anchor.set(0.5, 1)
  sprite.scale.set(QUEST_BADGE_SCALE)
  sprite.roundPixels = true
  sprite.visible = false

  return sprite
}

const createPlayerResourceBar = (): NonNullable<
  RenderedCharacterNode['playerHealthBar']
> => {
  const container = new Container()
  const track = new Graphics()
  const fill = new Graphics()

  container.sortableChildren = true
  track.roundPixels = true
  fill.roundPixels = true
  track.zIndex = 0
  fill.zIndex = 1
  container.addChild(track, fill)

  return {
    container,
    track,
    fill
  }
}

let messageFontsReadyPromise: Promise<void> | undefined

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
  onMerchantInventoryChange,
  onPotionMerchantInventoryChange,
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
    monsterPigAnimationTextures,
    monsterSlimeAnimationTextures,
    monsterRockAnimationTextures,
    monsterMushroomAnimationTextures
  ] = await Promise.all([
    loadTextureSafe(PORTAL_INSIDE_IMAGE_URL),
    loadTextureSafe(TINY_DUNGEON_TILESET_IMAGE_URL),
    loadSlashVfxTextures(),
    loadProtectVfxTextures(),
    // LPC 몬스터(그림체 통일): 출처는 assets/monsters/lpc/CREDITS.txt
    loadLpcMonsterTextures(LPC_PIG_SPEC),
    loadLpcMonsterTextures(LPC_SLIME_SPEC),
    loadLpcMonsterTextures(LPC_GOLEM_SPEC),
    loadLpcMonsterTextures(LPC_MUSHROOM_SPEC)
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

  const monsterAnimationTexturesByAppearanceType: Record<
    MonsterAppearanceType,
    MonsterAnimationTextures
  > = {
    [MONSTER_PIG_APPEARANCE_TYPE]: monsterPigAnimationTextures,
    [MONSTER_SLIME_APPEARANCE_TYPE]: monsterSlimeAnimationTextures,
    [MONSTER_ROCK_APPEARANCE_TYPE]: monsterRockAnimationTextures,
    [MONSTER_MUSHROOM_APPEARANCE_TYPE]: monsterMushroomAnimationTextures
  }

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
  // 무기별 기본 공격 발사체(화살·에너지볼). 이동/수명은 playerProjectile.ts 순수 로직,
  // 여기는 스프라이트·벽/몬스터 판정·데미지 배선만 담당한다.
  // 에너지볼트(마법 공격)는 targetId 몬스터를 따라가고, reticle 이 그 몬스터 발밑에 조준 표시를 띄운다.
  const activePlayerProjectiles = new Map<
    string,
    {
      state: PlayerProjectileState
      sprite: Container
      targetId?: string
      reticle?: Container
      // 마법 발사체: 명중 시 데미지와 스킬 효과(빙결·폭발)를 이 값으로 처리한다.
      magic?: { skillId?: string; skillLevel: number; damage: number }
      physicalDamage?: number
      // 관통 화살: 이미 꿰뚫은 몬스터는 다시 맞지 않는다.
      pierceHitIds?: Set<string>
      // 독화살: 맞은 적을 중독시키는 스킬 레벨
      poisonSkillLevel?: number
    }
  >()
  let playerProjectileCounter = 0
  // 명중 순간의 짧은 빛 번짐(에너지볼트). 수명이 끝나면 지운다.
  const activeProjectileImpacts: Array<{
    sprite: Container
    startedAtMilliseconds: number
  }> = []
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
  const getMonsterCombatStateOptions = (characterId: string) =>
    isBossCharacterId(characterId)
      ? { hpMultiplier: BOSS_HP_MULTIPLIER, damageMultiplier: BOSS_DAMAGE_MULTIPLIER }
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
  let isQuestLogOpen = false
  let isBlacksmithShopOpen = false
  let isPotionShopOpen = false
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
  let monsterGoldDropSequence = 0
  let monsterEquipmentDropSequence = 0
  let sceneIntroHideTimeoutId: number | undefined
  let playerRespawnAtMilliseconds: number | undefined
  let playerHitReactionState: PlayerHitReactionState | undefined
  let playerRollState: PlayerRollState | undefined
  let playerRollReadyAtMilliseconds = 0
  let playerAttackQueuedAfterRoll = false
  let playerAttackResolvedStartedAtMilliseconds: number | undefined
  let playerAttackReadyAtMilliseconds = 0
  let playerMagicAttackReadyAtMilliseconds = 0
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
        playerStatEffects.getPlayerMovementSpeedTilesPerSecond(playerProfile)
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
    playerAttackReadyAtMilliseconds =
      now + PLAYER_ATTACK_COOLDOWN_MILLISECONDS

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
  const createArrowProjectileSprite = (rotation: number): Container => {
    const container = new Container()
    // LPC 화살 그림(오른쪽 향함)을 진행 방향으로 돌린다.
    if (lpcArrowTexture.width > 1) {
      const arrowSprite = new Sprite(lpcArrowTexture)
      arrowSprite.anchor.set(0.75, 0.5)
      arrowSprite.roundPixels = true
      container.addChild(arrowSprite)
      container.rotation = rotation
      return container
    }
    const arrow = new Graphics()
    // 오른쪽(+x)을 향해 그린 뒤 진행 방향으로 회전: 몸통 → 촉 → 깃 순서.
    arrow.rect(-7, -1, 11, 2)
    arrow.fill({ color: 0x8b5a2b })
    arrow.poly([7, -3, 12, 0, 7, 3])
    arrow.fill({ color: 0xd8dde4 })
    arrow.poly([-7, -3, -3, 0, -7, 3])
    arrow.fill({ color: 0xf2f2e9 })
    container.addChild(arrow)
    container.rotation = rotation
    return container
  }

  const createEnergyBallProjectileSprite = (): Container => {
    const container = new Container()
    const glow = new Graphics()
    glow.circle(0, 0, 8)
    glow.fill({ color: 0x7fd4ff, alpha: 0.35 })
    const core = new Graphics()
    core.circle(0, 0, 4.5)
    core.fill({ color: 0xe8f7ff })
    core.stroke({ color: 0x9fe0ff, width: 1.5 })
    container.addChild(glow, core)
    return container
  }

  // 에너지볼트: 꼬리가 긴 보랏빛 마력 화살. 오른쪽(+x)을 향해 그린 뒤 진행 방향으로 회전한다.
  const createEnergyBoltProjectileSprite = (rotation: number): Container => {
    const container = new Container()
    const tail = new Graphics()
    tail.poly([-18, 0, -4, -3.5, 4, 0, -4, 3.5])
    tail.fill({ color: 0x9b7bff, alpha: 0.45 })
    const glow = new Graphics()
    glow.ellipse(1, 0, 9, 6)
    glow.fill({ color: 0xb79bff, alpha: 0.4 })
    const core = new Graphics()
    core.ellipse(2, 0, 5, 2.6)
    core.fill({ color: 0xf4efff })
    core.stroke({ color: 0xc9b6ff, width: 1 })
    container.addChild(tail, glow, core)
    container.rotation = rotation
    return container
  }

  // 조준 표시: 대상 몬스터 발밑의 납작한 링 + 네 귀퉁이 눈금.
  const createMagicTargetReticle = (): Container => {
    const container = new Container()
    const ring = new Graphics()
    ring.ellipse(0, 0, 15, 6)
    ring.stroke({ color: 0xc9b6ff, width: 1.5, alpha: 0.9 })
    for (const [x, y] of [[-19, 0], [19, 0], [0, -8], [0, 8]]) {
      ring.circle(x, y, 1.5)
      ring.fill({ color: 0xe9e0ff, alpha: 0.95 })
    }
    container.addChild(ring)
    return container
  }

  const MAGIC_IMPACT_DURATION_MILLISECONDS = 260
  // 명중 순간의 빛 번짐(색·크기는 마법마다).
  const spawnMagicImpact = (x: number, y: number, now: number, color: number, radius = 10) => {
    const container = new Container()
    const burst = new Graphics()
    burst.circle(0, 0, radius)
    burst.fill({ color, alpha: 0.55 })
    burst.circle(0, 0, radius * 0.4)
    burst.fill({ color: 0xffffff })
    container.addChild(burst)
    container.position.set(x, y)
    container.zIndex = Math.round(y + map.tileHeight * 2)
    depthSortedLayer?.addChild(container)
    activeProjectileImpacts.push({ sprite: container, startedAtMilliseconds: now })
  }

  // 얼음 화살: 하늘색 결정 화살촉 + 서리 꼬리.
  const createIceBoltProjectileSprite = (rotation: number): Container => {
    const container = new Container()
    const tail = new Graphics()
    tail.poly([-16, 0, -3, -3, 3, 0, -3, 3])
    tail.fill({ color: 0x9fe0ff, alpha: 0.45 })
    const shard = new Graphics()
    shard.poly([-4, -3, 8, 0, -4, 3, -1, 0])
    shard.fill({ color: 0xe8f9ff })
    shard.stroke({ color: 0x7fcfff, width: 1 })
    container.addChild(tail, shard)
    container.rotation = rotation
    return container
  }

  // 불덩이: 겹친 주황·노랑 원 + 뒤로 날리는 불꽃 꼬리.
  const createFireballProjectileSprite = (rotation: number): Container => {
    const container = new Container()
    const tail = new Graphics()
    tail.poly([-20, 0, -4, -6, 2, 0, -4, 6])
    tail.fill({ color: 0xff6a2a, alpha: 0.5 })
    const outer = new Graphics()
    outer.circle(0, 0, 7.5)
    outer.fill({ color: 0xff7a2e, alpha: 0.85 })
    const inner = new Graphics()
    inner.circle(1, 0, 4)
    inner.fill({ color: 0xffe08a })
    container.addChild(tail, outer, inner)
    container.rotation = rotation
    return container
  }

  const spawnPlayerProjectile = (
    character: CharacterState,
    kind: PlayerProjectileKind,
    options: {
      direction?: { x: number; y: number }
      targetId?: string
      magic?: { skillId?: string; skillLevel: number; damage: number }
      origin?: { x: number; y: number }
      // 활 스킬처럼 기본 공격력과 다른 물리 피해를 주는 화살
      physicalDamage?: number
      pierce?: boolean
      poisonSkillLevel?: number
    } = {}
  ) => {
    const direction =
      options.direction ?? getPlayerProjectileDirectionFromFacing(character.facing)
    const state = createPlayerProjectile({
      kind,
      originX:
        options.origin?.x ?? character.position.x * map.tileWidth + characterPixelWidth / 2,
      originY:
        options.origin?.y ?? character.position.y * map.tileHeight + characterPixelHeight / 2,
      direction
    })
    const rotation = getPlayerProjectileRotation(direction)
    const sprite =
      kind === 'arrow'
        ? createArrowProjectileSprite(rotation)
        : kind === 'energy-bolt'
          ? createEnergyBoltProjectileSprite(rotation)
          : kind === 'ice-bolt'
            ? createIceBoltProjectileSprite(rotation)
            : kind === 'fireball'
              ? createFireballProjectileSprite(rotation)
              : createEnergyBallProjectileSprite()

    playerProjectileCounter += 1
    const projectileId = `player-projectile-${playerProjectileCounter}`
    sprite.label = projectileId
    sprite.position.set(state.x, state.y)
    sprite.zIndex = Math.round(state.y + map.tileHeight)
    depthSortedLayer?.addChild(sprite)

    let reticle: Container | undefined
    if (options.targetId) {
      reticle = createMagicTargetReticle()
      reticle.label = `${projectileId}:reticle`
      depthSortedLayer?.addChild(reticle)
    }

    activePlayerProjectiles.set(projectileId, {
      state,
      sprite,
      targetId: options.targetId,
      reticle,
      magic: options.magic,
      physicalDamage: options.physicalDamage,
      pierceHitIds: options.pierce ? new Set() : undefined,
      poisonSkillLevel: options.poisonSkillLevel
    })
  }

  // 대상 몬스터의 발밑(조준 링) 좌표.
  const getMonsterReticlePosition = (monster: CharacterState) => {
    const rect = createPixelCollisionRectFromCharacter(monster)
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height }
  }

  // ---------------------------------------------------------------- 마법(시전·마법 공격·마법 스킬)
  // 마법 공격(D)과 마법 스킬은 마법 무기를 장착해야 쓸 수 있다. 시전은 공통 흐름:
  //   대상 조준 → 지팡이를 들어 마법진을 펼치는 준비(windup) → 마법 발동 → 여운(recovery).
  // 준비 중에는 걷기·구르기·다른 공격이 막힌다.
  type PlayerMagicCast = {
    startedAtMilliseconds: number
    releaseAtMilliseconds: number
    endAtMilliseconds: number
    facing: CharacterState['facing']
    color: number
    effect: Container
    circle: Graphics
    orb: Graphics
    release?: (now: number) => void
    // 플레이어 LPC 동작(지팡이 시전 = thrust, 활 = shoot)
    animation: LpcAnimationName
    windupMilliseconds: number
    recoveryMilliseconds: number
  }
  let playerMagicCast: PlayerMagicCast | undefined
  const playerMagicSkillReadyAtMilliseconds = new Map<string, number>()
  const PLAYER_MAGIC_SKILL_COOLDOWN_MILLISECONDS: Record<string, number> = {
    [PLAYER_ICE_BOLT_SKILL_ID]: 900,
    [PLAYER_FIREBALL_SKILL_ID]: 1400,
    [PLAYER_CHAIN_LIGHTNING_SKILL_ID]: 1800
  }
  const MAGIC_COLOR = {
    arcane: 0xb79bff,
    ice: 0x8fd8ff,
    fire: 0xff8a3d,
    lightning: 0xfff2a0
  } as const

  const isPlayerCasting = (now: number): boolean =>
    playerMagicCast !== undefined && now < playerMagicCast.releaseAtMilliseconds

  const hasMagicWeaponEquipped = (): boolean =>
    getEquippedPlayerWeaponAttackKind(currentPlayerEquipment) === 'magic'

  const getLivingMonsterMagicPoints = () =>
    characterStates
      .filter(
        (character) =>
          isMonsterCharacter(character) && !isMonsterCombatStateDefeated(character.id)
      )
      .map((character) => ({ id: character.id, ...getCharacterPixelCenter(character) }))

  const showPlayerMagicMessage = (message: string) => {
    showCharacterDamageText(
      PLAYER_CHARACTER_ID,
      message,
      EVADE_TEXT_DURATION_MILLISECONDS,
      EVADE_TEXT_STYLE
    )
  }

  // 시전 가능 여부 + 조준. 안 되면 이유를 띄우고 undefined.
  const preparePlayerMagic = (now: number) => {
    if (
      playerProfile.hp.current === 0 ||
      isSceneTransitionPending ||
      isPlayerRolling(now) ||
      playerMagicCast !== undefined
    ) {
      return undefined
    }

    if (!hasMagicWeaponEquipped()) {
      showPlayerMagicMessage('마법 무기를 장착해야 한다')
      return undefined
    }

    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
    const origin = getCharacterPixelCenter(playerCharacter)
    const target = selectPlayerMagicTarget({
      originX: origin.x,
      originY: origin.y,
      facing: playerCharacter.facing,
      candidates: getLivingMonsterMagicPoints()
    })

    if (!target) {
      showPlayerMagicMessage('주변에 대상이 없다')
      return undefined
    }

    return { playerCharacter, origin, target }
  }

  // 마법진(발밑 회전 고리 + 룬 점) + 지팡이 끝 마력 구슬.
  const createPlayerMagicCastEffect = (color: number) => {
    const effect = new Container()
    effect.label = 'player:magic-cast'
    const circle = new Graphics()
    circle.ellipse(0, 0, 22, 9)
    circle.stroke({ color, width: 1.5, alpha: 0.9 })
    circle.ellipse(0, 0, 15, 6)
    circle.stroke({ color: 0xffffff, width: 1, alpha: 0.55 })
    for (let index = 0; index < 6; index += 1) {
      const angle = (Math.PI * 2 * index) / 6
      circle.circle(Math.cos(angle) * 22, Math.sin(angle) * 9, 1.6)
      circle.fill({ color: 0xffffff, alpha: 0.9 })
    }
    const orb = new Graphics()
    orb.circle(0, 0, 6)
    orb.fill({ color, alpha: 0.45 })
    orb.circle(0, 0, 3)
    orb.fill({ color: 0xffffff })
    effect.addChild(circle, orb)
    depthSortedLayer?.addChild(effect)
    return { effect, circle, orb }
  }

  const beginPlayerMagicCast = (
    now: number,
    color: number,
    origin: { x: number; y: number },
    target: { x: number; y: number },
    release: (now: number) => void,
    options: {
      animation?: LpcAnimationName
      windupMilliseconds?: number
      recoveryMilliseconds?: number
      showMagicCircle?: boolean
    } = {}
  ) => {
    const windup = options.windupMilliseconds ?? PLAYER_MAGIC_CAST_WINDUP_MILLISECONDS
    const recovery = options.recoveryMilliseconds ?? PLAYER_MAGIC_CAST_RECOVERY_MILLISECONDS
    // 대상 쪽으로 돌아선다 — 상하/좌우 중 더 큰 축.
    const dx = target.x - origin.x
    const dy = target.y - origin.y
    const facing: CharacterState['facing'] =
      Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down'
    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
    characterStates = characterStates.map((character) =>
      character.id === PLAYER_CHARACTER_ID ? { ...playerCharacter, facing } : character
    )
    const { effect, circle, orb } = createPlayerMagicCastEffect(color)
    // 활 쏘기는 마법진·마력 구슬 없이 동작만.
    effect.visible = options.showMagicCircle ?? true
    playerMagicCast = {
      startedAtMilliseconds: now,
      releaseAtMilliseconds: now + windup,
      endAtMilliseconds: now + windup + recovery,
      facing,
      color,
      effect,
      circle,
      orb,
      release,
      animation: options.animation ?? 'thrust',
      windupMilliseconds: windup,
      recoveryMilliseconds: recovery
    }
    if (options.showMagicCircle ?? true) {
      gameSoundEffects.play('playerSkill')
    }
    syncPlayerCharacterVisual(now)
    updatePlayerMagicCast(now)
  }

  // 지팡이 끝(마력 구슬·발사 지점) — LPC 찌르기 동작의 발동 프레임에서 잰 지팡이 머리 위치
  // (캐릭터 중심 기준 픽셀).
  const STAFF_TIP_OFFSET_BY_FACING: Record<string, { x: number; y: number }> = {
    up: { x: 18, y: -55 },
    left: { x: -31, y: -35 },
    down: { x: -3, y: 14 },
    right: { x: 30, y: -35 }
  }
  const getPlayerStaffTipPosition = (facing: CharacterState['facing']) => {
    const center = getCharacterPixelCenter(getCharacterStateById(PLAYER_CHARACTER_ID))
    const offset = STAFF_TIP_OFFSET_BY_FACING[facing] ?? STAFF_TIP_OFFSET_BY_FACING.down
    return { x: center.x + offset.x, y: center.y + offset.y }
  }

  function updatePlayerMagicCast(now: number) {
    const cast = playerMagicCast

    if (!cast) {
      return
    }

    if (playerProfile.hp.current === 0 || now >= cast.endAtMilliseconds) {
      cast.effect.removeFromParent()
      cast.effect.destroy({ children: true })
      playerMagicCast = undefined
      return
    }

    if (cast.release && now >= cast.releaseAtMilliseconds) {
      const release = cast.release
      cast.release = undefined
      release(now)
    }

    const feet = getMonsterReticlePosition(getCharacterStateById(PLAYER_CHARACTER_ID))
    const windup = Math.min(1, (now - cast.startedAtMilliseconds) / cast.windupMilliseconds)
    const fade =
      now < cast.releaseAtMilliseconds
        ? 1
        : 1 - (now - cast.releaseAtMilliseconds) / cast.recoveryMilliseconds
    // 마법진: 발밑에서 펼쳐지며 천천히 돈다(납작한 원이라 회전 대신 점들을 흐르게 보이도록 skew).
    cast.circle.position.set(feet.x, feet.y - 2)
    cast.circle.scale.set(0.4 + 0.6 * windup)
    cast.circle.skew.set(0, Math.sin(now / 160) * 0.12)
    cast.circle.alpha = 0.95 * fade
    // 구슬: 모이며 커지다 발동 순간 가장 밝다.
    const tip = getPlayerStaffTipPosition(cast.facing)
    cast.orb.position.set(tip.x, tip.y)
    cast.orb.scale.set(0.5 + windup * 0.9 + 0.08 * Math.sin(now / 40))
    cast.orb.alpha = fade
    cast.effect.zIndex = Math.round(feet.y + map.tileHeight)
  }

  const clearPlayerMagicCast = () => {
    if (!playerMagicCast) {
      return
    }
    playerMagicCast.effect.removeFromParent()
    playerMagicCast.effect.destroy({ children: true })
    playerMagicCast = undefined
  }

  // 발동 시점에 대상이 이미 쓰러졌으면 그 자리에서 다시 조준한다.
  const resolveMagicReleaseTarget = (targetId: string) => {
    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
    const origin = getCharacterPixelCenter(playerCharacter)
    const living = getLivingMonsterMagicPoints()
    const target =
      living.find((point) => point.id === targetId) ??
      selectPlayerMagicTarget({
        originX: origin.x,
        originY: origin.y,
        facing: playerCharacter.facing,
        candidates: living
      })
    return { playerCharacter, origin, target }
  }

  const fireHomingMagicProjectile = (
    kind: PlayerProjectileKind,
    targetId: string | undefined,
    magic: { skillId?: string; skillLevel: number; damage: number }
  ) => {
    const { playerCharacter, origin, target } = targetId
      ? resolveMagicReleaseTarget(targetId)
      : { ...findPlayerAimTarget(), target: undefined }
    const tip = getPlayerStaffTipPosition(playerCharacter.facing)
    const direction = target
      ? (() => {
          const length = Math.hypot(target.x - origin.x, target.y - origin.y) || 1
          return { x: (target.x - origin.x) / length, y: (target.y - origin.y) / length }
        })()
      : getPlayerProjectileDirectionFromFacing(playerCharacter.facing)
    spawnPlayerProjectile(playerCharacter, kind, {
      direction,
      targetId: target?.id,
      magic,
      origin: tip
    })
  }

  // 마법 공력 공통: 지력 마법 공격력 + 자체 위력 + 마법 무기 보너스(검·활 보너스는 안 더한다).
  const getPlayerMagicDamage = (power: number): number =>
    playerStatEffects.getPlayerMagicAttackPower(playerProfile) +
    power +
    (hasMagicWeaponEquipped() ? getEquippedPlayerAttackBonus(currentPlayerEquipment) : 0)

  // 조준 대상(사거리 안 가장 가까운 몬스터). 없으면 undefined — 기본 공격은 그때 정면으로 쏜다.
  const findPlayerAimTarget = () => {
    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
    const origin = getCharacterPixelCenter(playerCharacter)
    const target = selectPlayerMagicTarget({
      originX: origin.x,
      originY: origin.y,
      facing: playerCharacter.facing,
      candidates: getLivingMonsterMagicPoints()
    })
    return { playerCharacter, origin, target }
  }

  // 정면 한 칸 앞(조준 대상이 없을 때 돌아설 기준점).
  const getPlayerFacingPoint = (playerCharacter: CharacterState, origin: { x: number; y: number }) => {
    const direction = getPlayerProjectileDirectionFromFacing(playerCharacter.facing)
    return { x: origin.x + direction.x * map.tileWidth, y: origin.y + direction.y * map.tileHeight }
  }

  // 지팡이 기본 공격: 지팡이를 찌르며 에너지볼트(MP 없음). 대상을 조준해 따라간다.
  const triggerPlayerStaffAttack = (now: number) => {
    if (now < playerMagicAttackReadyAtMilliseconds || playerMagicCast) {
      return
    }
    const { origin, target, playerCharacter } = findPlayerAimTarget()
    playerMagicAttackReadyAtMilliseconds = now + PLAYER_MAGIC_ATTACK_COOLDOWN_MILLISECONDS
    beginPlayerMagicCast(
      now,
      MAGIC_COLOR.arcane,
      origin,
      target ?? getPlayerFacingPoint(playerCharacter, origin),
      () =>
        fireHomingMagicProjectile('energy-bolt', target?.id, {
          skillLevel: 1,
          damage: getPlayerMagicDamage(PLAYER_ENERGY_BOLT_BASE_POWER)
        })
    )
  }

  // 활 기본 공격: 시위를 당겨(쏘기 동작) 조준 화살을 날린다. 피해는 힘 기반 물리 공격력.
  const PLAYER_BOW_DRAW_MILLISECONDS = 300
  const PLAYER_BOW_RECOVERY_MILLISECONDS = 180
  const triggerPlayerBowAttack = (now: number) => {
    if (now < playerMagicAttackReadyAtMilliseconds || playerMagicCast) {
      return
    }
    const { origin, target, playerCharacter } = findPlayerAimTarget()
    playerMagicAttackReadyAtMilliseconds = now + PLAYER_MAGIC_ATTACK_COOLDOWN_MILLISECONDS
    beginPlayerMagicCast(
      now,
      0xffffff,
      origin,
      target ?? getPlayerFacingPoint(playerCharacter, origin),
      () => {
        fireAimedArrow(target?.id)
        gameSoundEffects.play('playerRollWhoosh')
      },
      {
        animation: 'shoot',
        windupMilliseconds: PLAYER_BOW_DRAW_MILLISECONDS,
        recoveryMilliseconds: PLAYER_BOW_RECOVERY_MILLISECONDS,
        showMagicCircle: false
      }
    )
  }

  const fireAimedArrow = (
    targetId: string | undefined,
    damageOverride?: number,
    extra: { pierce?: boolean; poisonSkillLevel?: number } = {}
  ) => {
    const { playerCharacter, origin, target } = targetId
      ? resolveMagicReleaseTarget(targetId)
      : { ...findPlayerAimTarget(), target: undefined }
    const direction = target
      ? (() => {
          const length = Math.hypot(target.x - origin.x, target.y - origin.y) || 1
          return { x: (target.x - origin.x) / length, y: (target.y - origin.y) / length }
        })()
      : getPlayerProjectileDirectionFromFacing(playerCharacter.facing)
    spawnPlayerProjectile(playerCharacter, 'arrow', {
      direction,
      // 관통 화살은 유도하지 않고 곧게 날아간다.
      targetId: extra.pierce ? undefined : target?.id,
      physicalDamage: damageOverride,
      pierce: extra.pierce,
      poisonSkillLevel: extra.poisonSkillLevel
    })
  }

  // 마법 스킬(아이스 볼트·파이어볼·체인 라이트닝). MP 차감은 triggerPlayerSkillById 가 한다.
  const triggerPlayerMagicSkill = (skillId: string, now: number): boolean => {
    if (now < (playerMagicSkillReadyAtMilliseconds.get(skillId) ?? 0)) {
      showPlayerMagicMessage('아직 준비되지 않았다')
      return false
    }

    const prepared = preparePlayerMagic(now)

    if (!prepared) {
      return false
    }

    const skillLevel = getPlayerSkillLevelById(playerProfile, skillId) ?? 1
    const damage = getPlayerMagicDamage(getPlayerSkillDamageById(playerProfile, skillId))
    const targetId = prepared.target.id
    playerMagicSkillReadyAtMilliseconds.set(
      skillId,
      now + (PLAYER_MAGIC_SKILL_COOLDOWN_MILLISECONDS[skillId] ?? 1000)
    )

    if (skillId === PLAYER_ICE_BOLT_SKILL_ID) {
      beginPlayerMagicCast(now, MAGIC_COLOR.ice, prepared.origin, prepared.target, () =>
        fireHomingMagicProjectile('ice-bolt', targetId, { skillId, skillLevel, damage })
      )
    } else if (skillId === PLAYER_FIREBALL_SKILL_ID) {
      beginPlayerMagicCast(now, MAGIC_COLOR.fire, prepared.origin, prepared.target, () =>
        fireHomingMagicProjectile('fireball', targetId, { skillId, skillLevel, damage })
      )
    } else {
      beginPlayerMagicCast(now, MAGIC_COLOR.lightning, prepared.origin, prepared.target, (releaseNow) =>
        releaseChainLightning(targetId, skillLevel, damage, releaseNow)
      )
    }

    return true
  }

  // 활 스킬(멀티샷·관통 화살·독화살). 활이 필요하고, 쏘기 동작 끝에 화살이 나간다.
  // MP 차감은 triggerPlayerSkillById 가 한다.
  const PLAYER_BOW_SKILL_COOLDOWN_MILLISECONDS: Record<string, number> = {
    [PLAYER_MULTI_SHOT_SKILL_ID]: 1200,
    [PLAYER_PIERCING_ARROW_SKILL_ID]: 1500,
    [PLAYER_POISON_ARROW_SKILL_ID]: 1000
  }
  const triggerPlayerBowSkill = (skillId: string, now: number): boolean => {
    if (getEquippedPlayerWeaponAttackKind(currentPlayerEquipment) !== 'bow') {
      showPlayerMagicMessage('활을 장착해야 한다')
      return false
    }
    if (
      playerProfile.hp.current === 0 ||
      isSceneTransitionPending ||
      isPlayerRolling(now) ||
      playerMagicCast !== undefined
    ) {
      return false
    }
    if (now < (playerMagicSkillReadyAtMilliseconds.get(skillId) ?? 0)) {
      showPlayerMagicMessage('아직 준비되지 않았다')
      return false
    }
    const { origin, target, playerCharacter } = findPlayerAimTarget()
    // 관통 화살은 대상이 없어도 정면으로 쏠 수 있다. 나머지는 조준 대상이 있어야 한다.
    if (!target && skillId !== PLAYER_PIERCING_ARROW_SKILL_ID) {
      showPlayerMagicMessage('주변에 대상이 없다')
      return false
    }
    const skillLevel = getPlayerSkillLevelById(playerProfile, skillId) ?? 1
    const damage = getPlayerBasicAttackDamage(false) + getPlayerSkillDamageById(playerProfile, skillId)
    playerMagicSkillReadyAtMilliseconds.set(
      skillId,
      now + (PLAYER_BOW_SKILL_COOLDOWN_MILLISECONDS[skillId] ?? 1000)
    )
    const aimPoint = target ?? getPlayerFacingPoint(playerCharacter, origin)
    beginPlayerMagicCast(
      now,
      0xffffff,
      origin,
      aimPoint,
      () => {
        gameSoundEffects.play('playerRollWhoosh')
        if (skillId === PLAYER_MULTI_SHOT_SKILL_ID) {
          const releaseOrigin = getCharacterPixelCenter(getCharacterStateById(PLAYER_CHARACTER_ID))
          const targets = selectMultiShotTargets(
            releaseOrigin,
            getLivingMonsterMagicPoints(),
            getMultiShotArrowCount(skillLevel),
            PLAYER_MAGIC_ATTACK_TARGET_RANGE_PIXELS
          )
          for (const multiTarget of targets) {
            fireAimedArrow(multiTarget.id, Math.max(1, Math.round(damage * MULTI_SHOT_DAMAGE_RATIO)))
          }
        } else if (skillId === PLAYER_PIERCING_ARROW_SKILL_ID) {
          fireAimedArrow(target?.id, damage, { pierce: true })
        } else {
          fireAimedArrow(target?.id, damage, { poisonSkillLevel: skillLevel })
        }
      },
      {
        animation: 'shoot',
        windupMilliseconds: PLAYER_BOW_DRAW_MILLISECONDS,
        recoveryMilliseconds: PLAYER_BOW_RECOVERY_MILLISECONDS,
        showMagicCircle: false
      }
    )
    return true
  }

  // ---- 체인 라이트닝: 즉발. 지팡이 끝 → 첫 대상 → 가까운 적들로 번개가 튄다 ----
  const activeLightningArcs: Array<{ graphics: Graphics; startedAtMilliseconds: number }> = []
  const LIGHTNING_ARC_DURATION_MILLISECONDS = 280

  const drawLightningArc = (
    graphics: Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
    seed: number
  ) => {
    // 끝점 사이를 8마디로 나눠 직각 방향으로 흔든 지그재그. seed 로 매번 모양이 달라진다.
    const points: number[] = []
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.hypot(dx, dy) || 1
    const nx = -dy / length
    const ny = dx / length
    for (let index = 0; index <= 8; index += 1) {
      const t = index / 8
      const jitter =
        index === 0 || index === 8 ? 0 : Math.sin(seed * 12.9898 + index * 78.233) * 7
      points.push(from.x + dx * t + nx * jitter, from.y + dy * t + ny * jitter)
    }
    graphics.poly(points, false)
    graphics.stroke({ color: 0x8fb4ff, width: 4, alpha: 0.55 })
    graphics.poly(points, false)
    graphics.stroke({ color: 0xfffbe0, width: 1.6, alpha: 1 })
  }

  function releaseChainLightning(
    targetId: string,
    skillLevel: number,
    damage: number,
    now: number
  ) {
    const { playerCharacter, target } = resolveMagicReleaseTarget(targetId)

    if (!target) {
      return
    }

    const chain = selectChainLightningTargets({
      first: target,
      candidates: getLivingMonsterMagicPoints(),
      jumpCount: getChainLightningJumpCount(skillLevel)
    })
    const graphics = new Graphics()
    graphics.label = 'player:chain-lightning'
    let previous = getPlayerStaffTipPosition(playerCharacter.facing)
    chain.forEach((point, index) => {
      drawLightningArc(graphics, previous, point, now + index)
      previous = point
    })
    graphics.zIndex = Math.round(Math.max(...chain.map((point) => point.y)) + map.tileHeight * 2)
    depthSortedLayer?.addChild(graphics)
    activeLightningArcs.push({ graphics, startedAtMilliseconds: now })

    chain.forEach((point, index) => {
      applyDamageToMonster(point.id, getChainLightningHitDamage(damage, index), now)
      spawnMagicImpact(point.x, point.y, now, MAGIC_COLOR.lightning, 8)
    })
  }

  // ---- 몬스터 상태 이상: 빙결(이동·공격 정지) / 화상(주기 피해) ----
  type MonsterMagicStatus = {
    frozenUntilMilliseconds: number
    // 지속 피해(화상·중독). 하나만 걸린다 — 새로 걸리면 덮어쓴다.
    dotKind: 'burn' | 'poison'
    burnTicksLeft: number
    burnNextTickAtMilliseconds: number
    burnDamagePerTick: number
    burnIntervalMilliseconds: number
    frost?: Graphics
  }
  const monsterMagicStatuses = new Map<string, MonsterMagicStatus>()

  const getMonsterMagicStatus = (monsterId: string): MonsterMagicStatus => {
    let status = monsterMagicStatuses.get(monsterId)
    if (!status) {
      status = {
        frozenUntilMilliseconds: 0,
        dotKind: 'burn',
        burnTicksLeft: 0,
        burnNextTickAtMilliseconds: 0,
        burnDamagePerTick: 0,
        burnIntervalMilliseconds: FIREBALL_BURN_TICK_INTERVAL_MILLISECONDS
      }
      monsterMagicStatuses.set(monsterId, status)
    }
    return status
  }

  const isMonsterFrozen = (monsterId: string, now: number): boolean =>
    (monsterMagicStatuses.get(monsterId)?.frozenUntilMilliseconds ?? 0) > now

  const freezeMonster = (monsterId: string, durationMilliseconds: number, now: number) => {
    const status = getMonsterMagicStatus(monsterId)
    status.frozenUntilMilliseconds = Math.max(
      status.frozenUntilMilliseconds,
      now + durationMilliseconds
    )
    // 얼면 불은 꺼진다.
    status.burnTicksLeft = 0
    showCharacterDamageText(monsterId, '빙결!', EVADE_TEXT_DURATION_MILLISECONDS, EVADE_TEXT_STYLE)
  }

  const applyMonsterDamageOverTime = (
    monsterId: string,
    kind: MonsterMagicStatus['dotKind'],
    dot: { damagePerTick: number; ticks: number; intervalMilliseconds: number },
    now: number
  ) => {
    const status = getMonsterMagicStatus(monsterId)
    status.dotKind = kind
    status.burnTicksLeft = dot.ticks
    status.burnDamagePerTick = dot.damagePerTick
    status.burnIntervalMilliseconds = dot.intervalMilliseconds
    status.burnNextTickAtMilliseconds = now + dot.intervalMilliseconds
    if (kind === 'burn') {
      // 불이 붙으면 얼음은 녹는다.
      status.frozenUntilMilliseconds = Math.min(status.frozenUntilMilliseconds, now)
    } else {
      showCharacterDamageText(monsterId, '중독!', EVADE_TEXT_DURATION_MILLISECONDS, EVADE_TEXT_STYLE)
    }
  }

  const igniteMonster = (monsterId: string, damagePerTick: number, now: number) =>
    applyMonsterDamageOverTime(monsterId, 'burn', {
      damagePerTick,
      ticks: FIREBALL_BURN_TICK_COUNT,
      intervalMilliseconds: FIREBALL_BURN_TICK_INTERVAL_MILLISECONDS
    }, now)

  const updateMonsterMagicStatuses = (now: number) => {
    for (const [monsterId, status] of monsterMagicStatuses) {
      const node = renderedCharacters.get(monsterId)
      const defeated = isMonsterCombatStateDefeated(monsterId)
      const frozen = !defeated && status.frozenUntilMilliseconds > now

      if (!defeated && status.burnTicksLeft > 0 && now >= status.burnNextTickAtMilliseconds) {
        status.burnTicksLeft -= 1
        status.burnNextTickAtMilliseconds = now + status.burnIntervalMilliseconds
        applyDamageToMonster(monsterId, status.burnDamagePerTick, now)
        const center = getCharacterPixelCenter(getCharacterStateById(monsterId))
        spawnMagicImpact(
          center.x,
          center.y - 4,
          now,
          status.dotKind === 'poison' ? 0x8fe36a : MAGIC_COLOR.fire,
          6
        )
      }

      const burning = !isMonsterCombatStateDefeated(monsterId) && status.burnTicksLeft > 0

      if (node) {
        node.sprite.tint = frozen
          ? 0x9fdcff
          : burning
            ? status.dotKind === 'poison'
              ? 0xb8f08a
              : 0xffb488
            : 0xffffff
        const animated = monsterPigAnimatedSprites.get(monsterId)
        if (frozen) {
          animated?.stop()
        } else if (animated && !animated.playing && !defeated) {
          animated.play()
        }
      }

      // 얼음 껍질: 몬스터 발밑~몸통을 덮는 반투명 결정.
      if (frozen && !status.frost) {
        const frost = new Graphics()
        frost.roundRect(-14, -26, 28, 28, 6)
        frost.fill({ color: 0xcdeeff, alpha: 0.32 })
        frost.stroke({ color: 0xe8f8ff, width: 1, alpha: 0.8 })
        frost.poly([-9, -22, -4, -12, -11, -8])
        frost.fill({ color: 0xffffff, alpha: 0.5 })
        frost.label = `${monsterId}:frost`
        depthSortedLayer?.addChild(frost)
        status.frost = frost
      }
      if (status.frost) {
        if (!frozen) {
          status.frost.removeFromParent()
          status.frost.destroy()
          status.frost = undefined
        } else {
          const feet = getMonsterReticlePosition(getCharacterStateById(monsterId))
          status.frost.position.set(feet.x, feet.y)
          status.frost.zIndex = Math.round(feet.y + map.tileHeight + 1)
        }
      }

      if (defeated || (!frozen && !burning && !status.frost)) {
        if (node) {
          node.sprite.tint = 0xffffff
        }
        monsterMagicStatuses.delete(monsterId)
      }
    }

    for (let index = activeLightningArcs.length - 1; index >= 0; index -= 1) {
      const arc = activeLightningArcs[index]
      const progress = (now - arc.startedAtMilliseconds) / LIGHTNING_ARC_DURATION_MILLISECONDS
      if (progress >= 1) {
        arc.graphics.removeFromParent()
        arc.graphics.destroy()
        activeLightningArcs.splice(index, 1)
        continue
      }
      // 번쩍임: 처음엔 밝게 깜빡이다 사라진다.
      arc.graphics.alpha = (1 - progress) * (0.7 + 0.3 * Math.sin(now / 18))
    }
  }

  const clearMagicEffects = () => {
    clearPlayerMagicCast()
    for (const arc of activeLightningArcs) {
      arc.graphics.removeFromParent()
      arc.graphics.destroy()
    }
    activeLightningArcs.length = 0
    for (const status of monsterMagicStatuses.values()) {
      status.frost?.removeFromParent()
      status.frost?.destroy()
    }
    monsterMagicStatuses.clear()
  }

  // 기본 공격 데미지 = 스탯 공격력 + 장비 보너스. 스탯 항은 공격 종류로 갈린다:
  // 마법(에너지볼)은 지력 기반 마법 공격력, 근접·활은 힘 기반 물리 공격력.
  const getPlayerBasicAttackDamage = (isMagic: boolean): number =>
    (isMagic
      ? playerStatEffects.getPlayerMagicAttackPower(playerProfile)
      : playerStatEffects.getPlayerPhysicalAttackPower(playerProfile)) +
    getEquippedPlayerAttackBonus(currentPlayerEquipment)

  // 마법 발사체 명중: 데미지 + 종류별 효과(빙결 / 폭발·화상).
  const applyMagicProjectileHit = (
    state: PlayerProjectileState,
    magic: { skillId?: string; skillLevel: number; damage: number },
    targetId: string,
    now: number
  ) => {
    applyDamageToMonster(targetId, magic.damage, now)

    if (state.kind === 'ice-bolt') {
      spawnMagicImpact(state.x, state.y, now, MAGIC_COLOR.ice, 10)
      if (!isMonsterCombatStateDefeated(targetId)) {
        freezeMonster(targetId, getIceBoltFreezeDurationMilliseconds(magic.skillLevel), now)
      }
      return
    }

    if (state.kind === 'fireball') {
      spawnMagicImpact(state.x, state.y, now, MAGIC_COLOR.fire, 22)
      const burn = getFireballBurnDamagePerTick(magic.skillLevel)
      if (!isMonsterCombatStateDefeated(targetId)) {
        igniteMonster(targetId, burn, now)
      }
      for (const splash of selectFireballSplashTargets(
        { x: state.x, y: state.y },
        targetId,
        getLivingMonsterMagicPoints()
      )) {
        applyDamageToMonster(
          splash.id,
          Math.max(1, Math.round(magic.damage * FIREBALL_SPLASH_DAMAGE_RATIO)),
          now
        )
        if (!isMonsterCombatStateDefeated(splash.id)) {
          igniteMonster(splash.id, burn, now)
        }
      }
      return
    }

    spawnMagicImpact(state.x, state.y, now, MAGIC_COLOR.arcane, 10)
  }

  const removePlayerProjectile = (projectileId: string) => {
    const projectile = activePlayerProjectiles.get(projectileId)
    if (!projectile) {
      return
    }
    projectile.sprite.removeFromParent()
    projectile.sprite.destroy({ children: true })
    projectile.reticle?.removeFromParent()
    projectile.reticle?.destroy({ children: true })
    activePlayerProjectiles.delete(projectileId)
  }

  // 매 프레임: 발사체 이동 → 벽/사거리/몬스터 판정 → 스프라이트 동기화.
  const updatePlayerProjectiles = (now: number, deltaMilliseconds: number) => {
    for (let index = activeProjectileImpacts.length - 1; index >= 0; index -= 1) {
      const impact = activeProjectileImpacts[index]
      const progress =
        (now - impact.startedAtMilliseconds) / MAGIC_IMPACT_DURATION_MILLISECONDS
      if (progress >= 1) {
        impact.sprite.removeFromParent()
        impact.sprite.destroy({ children: true })
        activeProjectileImpacts.splice(index, 1)
        continue
      }
      impact.sprite.scale.set(1 + progress * 1.6)
      impact.sprite.alpha = 1 - progress
    }

    for (const [projectileId, projectile] of activePlayerProjectiles) {
      // 유도: 대상이 살아 있으면 그쪽으로 꺾고 조준 링을 따라 붙인다. 쓰러지면 직진.
      if (projectile.targetId) {
        const target = characterStates.find(
          (character) => character.id === projectile.targetId
        )

        if (target && !isMonsterCombatStateDefeated(target.id)) {
          const center = getCharacterPixelCenter(target)
          projectile.state = steerPlayerProjectileToward(
            projectile.state,
            center.x,
            center.y,
            deltaMilliseconds
          )
          const reticlePosition = getMonsterReticlePosition(target)
          projectile.reticle?.position.set(reticlePosition.x, reticlePosition.y)
          if (projectile.reticle) {
            projectile.reticle.zIndex = Math.round(reticlePosition.y - 1)
            projectile.reticle.rotation = 0
            projectile.reticle.alpha = 0.75 + 0.25 * Math.sin(now / 90)
          }
        } else {
          projectile.targetId = undefined
          projectile.reticle?.removeFromParent()
          projectile.reticle?.destroy({ children: true })
          projectile.reticle = undefined
        }
      }

      const { next, expired } = stepPlayerProjectile(
        projectile.state,
        deltaMilliseconds
      )
      projectile.state = next

      let finished = expired

      if (
        !finished &&
        isWallTileAt(
          wallTiles,
          Math.floor(next.x / map.tileWidth),
          Math.floor(next.y / map.tileHeight)
        )
      ) {
        finished = true
      }

      if (!finished && projectile.pierceHitIds) {
        // 관통: 겹친 몬스터를 모두 맞히고 계속 날아간다.
        for (const monster of resolveMonstersInCollisionRect(getPlayerProjectileHitRect(next))) {
          if (projectile.pierceHitIds.has(monster.id)) {
            continue
          }
          projectile.pierceHitIds.add(monster.id)
          applyDamageToMonster(
            monster.id,
            projectile.physicalDamage ?? getPlayerBasicAttackDamage(false),
            now
          )
          spawnMagicImpact(next.x, next.y, now, 0xcfe8ff, 7)
        }
        if (projectile.pierceHitIds.size >= PIERCING_ARROW_MAX_HITS) {
          finished = true
        }
      } else if (!finished) {
        const targetMonster = resolveClosestMonsterInCollisionRect(
          getPlayerProjectileHitRect(next)
        )

        if (targetMonster) {
          if (projectile.magic) {
            applyMagicProjectileHit(next, projectile.magic, targetMonster.id, now)
          } else {
            applyDamageToMonster(
              targetMonster.id,
              projectile.physicalDamage ??
                getPlayerBasicAttackDamage(next.kind === 'energy-ball'),
              now
            )
            if (
              projectile.poisonSkillLevel !== undefined &&
              !isMonsterCombatStateDefeated(targetMonster.id)
            ) {
              applyMonsterDamageOverTime(targetMonster.id, 'poison', {
                damagePerTick: getPoisonDamagePerTick(projectile.poisonSkillLevel),
                ticks: POISON_TICK_COUNT,
                intervalMilliseconds: POISON_TICK_INTERVAL_MILLISECONDS
              }, now)
            }
          }
          finished = true
        }
      }

      if (finished) {
        removePlayerProjectile(projectileId)
        continue
      }

      projectile.sprite.position.set(next.x, next.y)
      projectile.sprite.zIndex = Math.round(next.y + map.tileHeight)

      if (next.kind === 'energy-bolt' || next.kind === 'ice-bolt' || next.kind === 'fireball') {
        projectile.sprite.rotation = getPlayerProjectileRotation(next.direction)
        projectile.sprite.alpha = 0.85 + 0.15 * Math.sin(next.traveledPixels / 6)
      } else if (next.kind === 'arrow') {
        // 조준 화살도 꺾이며 날아가므로 진행 방향으로 계속 돌린다.
        projectile.sprite.rotation = getPlayerProjectileRotation(next.direction)
      }

      if (next.kind === 'energy-ball') {
        // 에너지볼만 은은한 맥동 — 진행 거리 기반이라 일시정지 중에는 멈춘다.
        const pulse = 1 + 0.12 * Math.sin(next.traveledPixels / 9)
        projectile.sprite.scale.set(pulse)
      }
    }
  }

  const clearPlayerProjectiles = () => {
    for (const projectileId of [...activePlayerProjectiles.keys()]) {
      removePlayerProjectile(projectileId)
    }
    for (const impact of activeProjectileImpacts) {
      impact.sprite.removeFromParent()
      impact.sprite.destroy({ children: true })
    }
    activeProjectileImpacts.length = 0
  }
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
    syncPlayerUiOverlays()
  }
  const setPlayerStatOpen = (nextIsOpen: boolean) => {
    if (isPlayerStatOpen === nextIsOpen) {
      return
    }

    isPlayerStatOpen = nextIsOpen
    syncPlayerUiOverlays()
  }
  const setPlayerEquipmentOpen = (nextIsOpen: boolean) => {
    if (isPlayerEquipmentOpen === nextIsOpen) {
      return
    }

    isPlayerEquipmentOpen = nextIsOpen
    syncPlayerUiOverlays()
  }
  const setPlayerSkillOpen = (nextIsOpen: boolean) => {
    if (isPlayerSkillOpen === nextIsOpen) {
      return
    }

    isPlayerSkillOpen = nextIsOpen
    syncPlayerUiOverlays()
  }
  const setQuestLogOpen = (nextIsOpen: boolean) => {
    if (isQuestLogOpen === nextIsOpen) {
      return
    }

    isQuestLogOpen = nextIsOpen
    syncPlayerUiOverlays()
  }
  const setBlacksmithShopOpen = (nextIsOpen: boolean) => {
    if (isBlacksmithShopOpen === nextIsOpen) {
      return
    }

    if (nextIsOpen) {
      isQuestLogOpen = false
      isPotionShopOpen = false
    }

    isBlacksmithShopOpen = nextIsOpen
    if (nextIsOpen) {
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
    }

    isPotionShopOpen = nextIsOpen
    if (nextIsOpen) {
      setQuestLogWithObjectiveFeedback(
        recordShopOpenQuestProgress(currentQuestLog, 'potion')
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
    setQuestLogWithObjectiveFeedback(
      recordItemUseQuestProgress(currentQuestLog, itemId)
    )
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
    if (isSceneTransitionPending) {
      return
    }

    isSceneTransitionPending = true
    closeAllOverlays()
    clearPressedInputState()
    stopPlayerFootsteps()
    triggeredActions.clear()
    gameEventQueue.clear()
    onRequestSceneChange({
      sceneId: portal.targetSceneId,
      spawn: {
        x: portal.targetSpawn.x,
        y: portal.targetSpawn.y
      },
      facing: portal.targetFacing
    })
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
  // 시나리오 v2: talk 트리거. 퀘스트보다 먼저 가로챈다 — 생성(동적) 콘텐츠가 정적보다 앞서는
  // 기존 규칙(questLog.getQuestDefinitionsForNpc 의 동적 우선)과 같은 방향이다.
  let activeScenarioRun: ScenarioRun | undefined

  const grantScenarioRewards = (reward: ScenarioRewardGrant) => {
    if (reward.gold > 0) {
      currentPlayerInventory = {
        ...currentPlayerInventory,
        gold: currentPlayerInventory.gold + reward.gold
      }
      onPlayerInventoryChange(currentPlayerInventory)
    }
    if (reward.items.length > 0) {
      currentPlayerInventory = addQuestItemRewardsToInventory(
        currentPlayerInventory,
        reward.items.map((item) => ({
          id: item.item_id,
          label: SCENARIO_REWARD_ITEM_LABEL_BY_ID[item.item_id] ?? item.item_id,
          quantity: item.quantity
        }))
      )
      onPlayerInventoryChange(currentPlayerInventory)
    }
    grantPlayerExperienceReward(reward.experience)
    syncPlayerUiOverlays()
  }

  // 대화창 초상화: 일러스트가 있으면 그것, 없으면 그 NPC 의 LPC 전신을 픽셀 그대로 키워 쓴다.
  const getNpcDialoguePortrait = (
    characterId: string
  ): { portraitUrl: string; pixelArtPortrait: boolean } => {
    const illustration = NPC_PORTRAITS[characterId]
    if (illustration) {
      return { portraitUrl: illustration, pixelArtPortrait: false }
    }
    const character = characterStates.find((candidate) => candidate.id === characterId)
    const key = character ? getLpcNpcSheetKey(character.id, character.appearanceType) : undefined
    const fullBody = key ? getLpcNpcFullBodyUrl(key) : undefined
    return { portraitUrl: fullBody ?? '', pixelArtPortrait: fullBody !== undefined }
  }

  const startScenarioForNpc = (npcCharacter: CharacterState) => {
    const scenario = getScenarioForNpc(npcCharacter.id)
    if (!scenario) {
      return
    }

    const flagAccess = createScenarioFlagAccess(scenario.scenario_id)
    activeScenarioRun = startScenarioRun(
      scenario,
      {
        presentDialogue: (request, respond) => {
          hideCharacterMessage(request.speaker)
          const speakerCharacter = characterStates.find(
            (character) => character.id === request.speaker
          )
          npcDialogueOverlay.show({
            ...getNpcDialoguePortrait(request.speaker),
            name: speakerCharacter?.displayText ?? request.speaker,
            lines: request.lines,
            choices: request.choices,
            onChoice: (choiceIndex) => respond(choiceIndex),
            onComplete: () => respond(undefined)
          })
        },
        grantReward: grantScenarioRewards,
        getQuestStatus: (questId) => getQuestProgress(currentQuestLog, questId).status,
        getFlag: flagAccess.get,
        setFlag: flagAccess.set
      },
      () => {
        activeScenarioRun = undefined
      }
    )
  }

  const handleScenarioInteractionEvents = (
    events: GameEvent[],
    now: number
  ): GameEvent[] => {
    const unhandledEvents: GameEvent[] = []

    for (const event of events) {
      if (event.kind !== 'interaction-requested') {
        unhandledEvents.push(event)
        continue
      }

      // 시나리오 실행 중에는 새 상호작용을 전부 삼킨다 — 대화 위에 퀘스트/Lua 대사가
      // 겹쳐 뜨는 것을 막는다(이동 잠금은 MVP 범위 밖, 기존 VN 대화와 동일한 스텁).
      if (activeScenarioRun?.isRunning()) {
        continue
      }

      const sourceCharacter = characterStates.find(
        (character) => character.id === event.sourceCharacterId
      )
      if (!sourceCharacter) {
        unhandledEvents.push(event)
        continue
      }

      const targetCharacter = resolveCharacterInteractionTarget({
        sourceCharacter,
        targetCharacters: characterStates,
        canReceiveInteraction: (character) =>
          getScenarioForNpc(character.id) !== undefined &&
          // 에디터에서 명시적으로 적용한 시나리오는 데모/저작 결과를 확인할 수 있도록
          // 기본 퀘스트보다 우선한다. 내장 골드 예제는 기존 퀘스트 흐름을 막지 않는다.
          (isPriorityScenarioForNpc(character.id) ||
            getNextQuestInteractionForNpc(currentQuestLog, character.id) === undefined)
      })
      if (!targetCharacter) {
        unhandledEvents.push(event)
        continue
      }

      const lockKey = `${sourceCharacter.id}:${targetCharacter.id}:scenario`
      const lockedUntil = interactionLockUntilByCharacterPair.get(lockKey) ?? 0
      if (lockedUntil > now) {
        continue
      }

      startScenarioForNpc(targetCharacter)
      interactionLockUntilByCharacterPair.set(lockKey, now + 1000)
    }

    return unhandledEvents
  }

  const handleQuestInteractionEvents = (
    events: GameEvent[],
    now: number
  ): GameEvent[] => {
    const unhandledEvents: GameEvent[] = []

    for (const event of events) {
      if (event.kind !== 'interaction-requested') {
        unhandledEvents.push(event)
        continue
      }

      const sourceCharacter = characterStates.find(
        (character) => character.id === event.sourceCharacterId
      )

      if (!sourceCharacter) {
        unhandledEvents.push(event)
        continue
      }

      const targetCharacter = resolveCharacterInteractionTarget({
        sourceCharacter,
        targetCharacters: characterStates,
        canReceiveInteraction: (character) =>
          getNextQuestInteractionForNpc(currentQuestLog, character.id) !==
          undefined
      })

      if (!targetCharacter) {
        unhandledEvents.push(event)
        continue
      }

      const lockKey = `${sourceCharacter.id}:${targetCharacter.id}:quest`
      const lockedUntil = interactionLockUntilByCharacterPair.get(lockKey) ?? 0

      if (lockedUntil > now) {
        continue
      }

      handleQuestNpcInteraction(targetCharacter)
      interactionLockUntilByCharacterPair.set(
        lockKey,
        now + QUEST_DIALOGUE_DURATION_MILLISECONDS
      )
    }

    return unhandledEvents
  }
  const handleQuestNpcInteraction = (targetCharacter: CharacterState) => {
    const interaction = getNextQuestInteractionForNpc(
      currentQuestLog,
      targetCharacter.id
    )

    if (!interaction) {
      return
    }

    switch (interaction.action) {
      case 'start': {
        let nextQuestLog = startQuest(currentQuestLog, interaction.questId)

        nextQuestLog = recordTalkQuestProgress(nextQuestLog, targetCharacter.id)
        setQuestLogWithObjectiveFeedback(nextQuestLog)
        showQuestDialogue(
          targetCharacter.id,
          interaction.definition.startDialogueLines
        )
        showCharacterDamageText(
          PLAYER_CHARACTER_ID,
          QUEST_START_TEXT,
          DAMAGE_TEXT_DURATION_MILLISECONDS,
          LEVEL_UP_TEXT_STYLE
        )
        return
      }
      case 'active': {
        setQuestLogWithObjectiveFeedback(
          recordTalkQuestProgress(currentQuestLog, targetCharacter.id)
        )
        // 대사를 다 넘긴 뒤에 상점을 연다(대화창과 상점이 겹치지 않게).
        // 대화 목표의 상대 NPC(퀘스트를 준 사람이 아님)는 자기 대사를 말한다.
        showQuestDialogue(
          targetCharacter.id,
          targetCharacter.id !== interaction.definition.giverNpcId &&
            interaction.definition.talkTargetDialogueLines
            ? interaction.definition.talkTargetDialogueLines
            : interaction.definition.activeDialogueLines,
          () => maybeOpenQuestNpcShop(targetCharacter.id)
        )
        return
      }
      case 'complete': {
        const result = completeQuest(currentQuestLog, interaction.questId)
        const completionLines = interaction.definition.arcCompletionMessage
          ? [
              ...interaction.definition.completionDialogueLines,
              interaction.definition.arcCompletionMessage
            ]
          : interaction.definition.completionDialogueLines

        setQuestLog(result.nextQuestLog)
        showQuestDialogue(targetCharacter.id, completionLines)
        grantQuestCompletionRewards(result)
      }
    }
  }
  // 도착만 하면 되는 퀘스트(autoTurnInOnSceneEnter)는 이 씬에 들어온 순간 완료하고, 준 사람이
  // 다음 퀘스트를 바로 맡긴다. 준 사람은 이 씬에 없으므로 멀리서 전하는 말로 대화창에 띄운다.
  const runSceneEnterAutoTurnIns = () => {
    const readyDefinition = getVisibleQuestDefinitions().find(
      (definition) =>
        definition.autoTurnInOnSceneEnter &&
        getQuestProgress(currentQuestLog, definition.id).status === 'ready-to-turn-in'
    )

    if (!readyDefinition) {
      return
    }

    const result = completeQuest(currentQuestLog, readyDefinition.id)
    let nextQuestLog = result.nextQuestLog
    const lines = [...readyDefinition.completionDialogueLines]
    const followUp = getNextQuestInteractionForNpc(nextQuestLog, readyDefinition.giverNpcId)

    if (followUp?.action === 'start') {
      nextQuestLog = startQuest(nextQuestLog, followUp.questId)
      lines.push(...followUp.definition.startDialogueLines)
    }

    setQuestLog(nextQuestLog)
    grantQuestCompletionRewards(result)
    showRemoteQuestGiverDialogue(readyDefinition, lines)
  }
  // 의뢰인이 이 씬에 없어도(멀리서 전하는 말, 퀘스트 창의 대사 다시 보기) 의뢰인 그림으로 대화창을 띄운다.
  const showRemoteQuestGiverDialogue = (definition: QuestDefinition, lines: string[]) => {
    const giverNpcId = definition.giverNpcId
    const giverCharacter = characterStates.find((character) => character.id === giverNpcId)
    const sheetKey = getLpcNpcSheetKey(
      giverNpcId,
      giverCharacter?.appearanceType ?? QUEST_GIVER_PORTRAIT_KEY_BY_NPC_ID[giverNpcId] ?? ''
    )
    const fullBody = sheetKey ? getLpcNpcFullBodyUrl(sheetKey) : undefined

    npcDialogueOverlay.show({
      portraitUrl: NPC_PORTRAITS[giverNpcId] ?? fullBody ?? '',
      pixelArtPortrait: !NPC_PORTRAITS[giverNpcId] && fullBody !== undefined,
      name: definition.giverName,
      lines: formatQuestTextLines(lines, { playerName: playerProfile.name })
    })
  }
  // 퀘스트 대사는 클릭/Space/Enter 로 한 줄씩 넘기는 대화창으로 보여 준다(예전 말풍선은
  // 3.6초 만에 사라져 읽을 수 없었다). 다른 대화가 열려 있으면 말풍선으로 대신한다.
  const showQuestDialogue = (
    characterId: string,
    lines: string[],
    onComplete?: () => void
  ) => {
    const formattedLines = formatQuestTextLines(lines, {
      playerName: playerProfile.name
    })

    if (npcDialogueOverlay.isOpen()) {
      showCharacterMessage(
        characterId,
        formattedLines.join('\n'),
        QUEST_DIALOGUE_DURATION_MILLISECONDS
      )
      onComplete?.()
      return
    }

    hideCharacterMessage(characterId)
    npcDialogueOverlay.show({
      ...getNpcDialoguePortrait(characterId),
      name: getCharacterStateById(characterId).displayText ?? '',
      lines: formattedLines,
      onComplete
    })
  }
  const maybeOpenQuestNpcShop = (npcId: string) => {
    if (npcId === BLACKSMITH_SHOP_NPC_ID) {
      setBlacksmithShopOpen(true)
      return
    }

    if (POTION_SHOP_NPC_IDS.has(npcId)) {
      setPotionShopOpen(true)
    }
  }
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
  // 물 채움 타일(cave_fill_Water_*)은 무늬 없는 바탕(_00)만 CompositeTilemap 에 굽고,
  // 물결은 flowingWaterSurface 가 물 영역 전체에 이어지는 반복 무늬 두 겹으로 흘려 보낸다.
  // 물길은 하류 방향으로 흐르고 넓은 못은 잔잔하게 일렁인다(타일 경계 이음새 없음).
  const flowingWaterSurfaces: FlowingWaterSurface[] = []
  const waterRippleTexturesByKey = new Map<string, Texture[]>()
  const waterPlainTexturesByKey = new Map<string, Texture | null>()
  const resolveWaterPlainTexture = (
    tileset: ParsedTiledTileset,
    renderResources: TilesetRenderResources,
    family: string
  ): { patternKey: string; plainTexture: Texture } | undefined => {
    const patternKey = `${tileset.source}|${family}`
    let plainTexture = waterPlainTexturesByKey.get(patternKey)

    if (plainTexture === undefined) {
      let plainLocalId: number | undefined
      const rippleLocalIds: number[] = []

      for (const [localId, tileType] of Object.entries(tileset.tileTypes)) {
        const waterFillTile = parseWaterFillTileType(tileType)

        if (waterFillTile?.family !== family) {
          continue
        }
        if (waterFillTile.variant === 0) {
          plainLocalId = Number(localId)
        } else {
          rippleLocalIds.push(Number(localId))
        }
      }

      const rippleTextures =
        plainLocalId === undefined
          ? undefined
          : createWaterRipplePatternTextures(
              renderResources.imageTexture,
              renderResources.tileTextures[plainLocalId].frame,
              rippleLocalIds
                .sort((left, right) => left - right)
                .map((localId) => renderResources.tileTextures[localId].frame),
              `water:${family}`
            )

      plainTexture =
        plainLocalId !== undefined && rippleTextures
          ? renderResources.tileTextures[plainLocalId]
          : null
      waterPlainTexturesByKey.set(patternKey, plainTexture)
      if (rippleTextures) {
        waterRippleTexturesByKey.set(patternKey, rippleTextures)
      }
    }

    return plainTexture ? { patternKey, plainTexture } : undefined
  }
  for (const layer of map.layers) {
    if (layer.name.toLowerCase() === DEPTH_SORTED_LAYER_NAME) {
      const nextDepthSortedLayer = new Container()

      nextDepthSortedLayer.label = `layer:${layer.name}:depth`
      nextDepthSortedLayer.sortableChildren = true

      for (const tile of layer.tiles) {
        const tileset = resolveTilesetForTile(tile, map.tilesets)
        const renderResources = tilesetResources.get(tileset.source)

        if (!renderResources) {
          throw new Error(`Missing render resources for tileset ${tileset.source}`)
        }

        const sprite = createDepthSortedTileSprite(
          renderResources.tileTextures[tile.localId],
          tile,
          map.tileWidth,
          map.tileHeight
        )

        sprite.alpha = layer.opacity
        sprite.visible = layer.visible
        sprite.zIndex = getTileDepthSortValue(tile.y, map.tileHeight)
        nextDepthSortedLayer.addChild(sprite)
      }

      themeColorTargets.push(...nextDepthSortedLayer.children)
      depthSortedLayer = nextDepthSortedLayer
      world.addChild(nextDepthSortedLayer)
      continue
    }

    const tilemap = new CompositeTilemap()
    const transformedTileLayer = new Container()
    const coinPileLayer = new Container()
    const layerWaterCells: FlowingWaterSurfaceCell[] = []

    tilemap.label = `layer:${layer.name}`
    tilemap.alpha = layer.opacity
    tilemap.visible = layer.visible
    transformedTileLayer.label = `layer:${layer.name}:transforms`
    transformedTileLayer.alpha = layer.opacity
    transformedTileLayer.visible = layer.visible
    coinPileLayer.label = `layer:${layer.name}:coin-piles`

    for (const tile of layer.tiles) {
      const tileset = resolveTilesetForTile(tile, map.tilesets)
      const renderResources = tilesetResources.get(tileset.source)

      if (!renderResources) {
        throw new Error(`Missing render resources for tileset ${tileset.source}`)
      }

      // 획득 가능한 코인 타일은 CompositeTilemap 에 굽지 않고 개별 스프라이트로
      // 분리해, 획득 시 그 타일만 제거할 수 있게 한다.
      const coinGoldAmount = getCoinPileGoldAmount(tileset.tileTypes[tile.localId])

      if (coinGoldAmount !== undefined) {
        const tileKey = createCoinPileTileKey(tile.x, tile.y)

        if (collectedCoinTileKeySet.has(tileKey)) {
          continue
        }

        // 뒤집힌 타일은 기존 transform 스프라이트 경로로 방향을 보존한다
        // (anchor 가 달라지므로 픽업 판정은 스프라이트가 아닌 타일 좌표로 계산).
        const coinSprite = hasTileTransform(tile)
          ? createTransformedTileSprite(
              renderResources.tileTextures[tile.localId],
              tile,
              map.tileWidth,
              map.tileHeight
            )
          : new Sprite(renderResources.tileTextures[tile.localId])

        if (!hasTileTransform(tile)) {
          coinSprite.position.set(tile.x * map.tileWidth, tile.y * map.tileHeight)
        }
        coinSprite.alpha = layer.opacity
        coinSprite.visible = layer.visible
        coinPileLayer.addChild(coinSprite)
        coinPileSprites.set(tileKey, {
          sprite: coinSprite,
          goldAmount: coinGoldAmount,
          tileX: tile.x,
          tileY: tile.y
        })
        continue
      }

      // 물 채움 타일은 뒤집힘과 무관하게 바탕만 굽고 칸 좌표를 물결 레이어로 넘긴다.
      const waterFillTile = parseWaterFillTileType(tileset.tileTypes[tile.localId])
      const waterPlain = waterFillTile
        ? resolveWaterPlainTexture(tileset, renderResources, waterFillTile.family)
        : undefined

      if (waterPlain) {
        tilemap.tile(
          waterPlain.plainTexture,
          tile.x * map.tileWidth,
          tile.y * map.tileHeight
        )
        layerWaterCells.push({
          x: tile.x,
          y: tile.y,
          patternKey: waterPlain.patternKey
        })
        continue
      }

      if (hasTileTransform(tile)) {
        transformedTileLayer.addChild(
          createTransformedTileSprite(
            renderResources.tileTextures[tile.localId],
            tile,
            map.tileWidth,
            map.tileHeight
          )
        )
        continue
      }

      tilemap.tile(
        renderResources.tileTextures[tile.localId],
        tile.x * map.tileWidth,
        tile.y * map.tileHeight
      )
    }

    const flowingWaterSurface =
      layerWaterCells.length > 0
        ? createFlowingWaterSurface({
            cells: layerWaterCells,
            rippleTexturesByKey: waterRippleTexturesByKey,
            tileWidth: map.tileWidth,
            tileHeight: map.tileHeight,
            label: `layer:${layer.name}:flowing-water`
          })
        : undefined

    world.addChild(tilemap)
    if (flowingWaterSurface) {
      // 바탕 바로 위, 같은 레이어의 다른 타일/상위 레이어(둑, 소품)보다 아래에 그린다.
      flowingWaterSurface.container.alpha = layer.opacity
      flowingWaterSurface.container.visible = layer.visible
      flowingWaterSurfaces.push(flowingWaterSurface)
      world.addChild(flowingWaterSurface.container)
    }
    world.addChild(transformedTileLayer)
    world.addChild(coinPileLayer)
    if (!['ground', 'shadow_lower', 'shadow_upper'].includes(layer.name)) {
      themeColorTargets.push(tilemap, transformedTileLayer)
      if (flowingWaterSurface) {
        themeColorTargets.push(flowingWaterSurface.container)
      }
    }
  }

  if (!depthSortedLayer) {
    depthSortedLayer = new Container()
    depthSortedLayer.label = 'layer:characters:depth'
    depthSortedLayer.sortableChildren = true
    world.addChild(depthSortedLayer)
  }

  // ---------------------------------------------------------------- LPC 캐릭터(플레이어·NPC)
  // 발끝 기준 스프라이트를 1칸 판(container 원점 = 타일 왼쪽 위) 위에 얹는다.
  function createLpcCharacterNode(
    container: Container,
    character: CharacterState,
    npcSheets: LpcCharacterSheets | undefined
  ): NonNullable<RenderedCharacterNode['lpc']> {
    const createLayerSprite = (label: string, zIndex: number) => {
      const layerSprite = new Sprite(Texture.EMPTY)
      layerSprite.label = label
      layerSprite.roundPixels = true
      layerSprite.zIndex = zIndex
      layerSprite.position.set(map.tileWidth / 2, map.tileHeight)
      container.addChild(layerSprite)
      return layerSprite
    }
    const lpcSprite = createLayerSprite(`character:${character.id}:lpc`, 10)
    const playerLayers =
      character.id === PLAYER_CHARACTER_ID
        ? new Map(
            LPC_PLAYER_LAYER_ORDER.map(
              (slot, index) =>
                [slot, createLayerSprite(`character:${character.id}:lpc:${slot}`, 10 + index * 0.01)] as const
            )
          )
        : undefined
    if (playerLayers) {
      lpcSprite.visible = false
    }
    return {
      sprite: lpcSprite,
      playerLayers,
      npcSheets,
      cell: 0,
      lastX: character.position.x,
      lastY: character.position.y,
      movingUntilMilliseconds: 0
    }
  }

  // 플레이어가 지금 하고 있는 1회성 동작(시전·쏘기·근접 공격)과 그 진행률.
  function getPlayerLpcAction(now: number):
    | { animation?: LpcAnimationName; progress: number; facing: string }
    | undefined {
    const cast = playerMagicCast
    if (cast) {
      return {
        animation: cast.animation,
        progress:
          (now - cast.startedAtMilliseconds) /
          (cast.endAtMilliseconds - cast.startedAtMilliseconds),
        facing: cast.facing
      }
    }
    if (playerAttackStartedAtMilliseconds !== undefined) {
      const elapsed = now - playerAttackStartedAtMilliseconds
      if (elapsed >= 0 && elapsed < PLAYER_ATTACK_DURATION_MILLISECONDS) {
        return {
          progress: elapsed / PLAYER_ATTACK_DURATION_MILLISECONDS,
          facing: playerAttackFacing ?? getCharacterStateById(PLAYER_CHARACTER_ID).facing
        }
      }
    }
    return undefined
  }

  function syncLpcCharacterVisual(
    renderNode: RenderedCharacterNode,
    character: CharacterState,
    now: number
  ) {
    const lpc = renderNode.lpc
    if (!lpc) {
      return
    }

    if (character.position.x !== lpc.lastX || character.position.y !== lpc.lastY) {
      lpc.movingUntilMilliseconds = now + LPC_MOVING_HOLD_MILLISECONDS
      lpc.lastX = character.position.x
      lpc.lastY = character.position.y
    }
    const isMoving = now < lpc.movingUntilMilliseconds

    const walkFrameIndex = getLpcWalkFrameIndex(isMoving, now)
    const scaleX = renderNode.sprite.scale.x / renderNode.renderScale
    const scaleY = renderNode.sprite.scale.y / renderNode.renderScale
    const applyFrame = (
      target: Sprite,
      frames: { cell: number; frames: Record<string, Texture[]> } | undefined,
      facing: string,
      frameIndex: number
    ) => {
      if (!frames) {
        target.visible = false
        return
      }
      const directionFrames = frames.frames[getLpcDirectionFromFacing(facing)]
      target.texture = directionFrames[Math.min(frameIndex, directionFrames.length - 1)]
      const anchor = getLpcAnchor(frames.cell)
      target.anchor.set(anchor.x, anchor.y)
      target.scale.set(scaleX, scaleY)
      target.visible = true
    }

    if (lpc.playerLayers) {
      const look = getPlayerLook()
      const action = getPlayerLpcAction(now)
      let animation: LpcAnimationName = 'walk'
      let frameIndex = walkFrameIndex
      let facing: string = character.facing
      if (action) {
        animation = action.animation ?? getLpcPlayerAttackAnimation(look.weaponId)
        frameIndex = getLpcActionFrameIndex(
          action.progress,
          animation === 'shoot' ? 13 : animation === 'thrust' ? 8 : 6
        )
        facing = action.facing
      }
      let files = getLpcPlayerLayerFiles(look, animation)
      // 동작 시트가 아직 안 불러졌으면 그동안은 걷기 자세로.
      if (!files.base || !lpcSheetCache.get(files.base, animation)) {
        animation = 'walk'
        frameIndex = walkFrameIndex
        files = getLpcPlayerLayerFiles(look, animation)
      }
      for (const [slot, layerSprite] of lpc.playerLayers) {
        const file = files[slot]
        applyFrame(
          layerSprite,
          file ? lpcSheetCache.get(file, animation) : undefined,
          facing,
          frameIndex
        )
      }
      return
    }

    applyFrame(lpc.sprite, lpc.npcSheets?.walk, character.facing, walkFrameIndex)
  }

  for (const character of characterStates) {
    const container = new Container()
    const isMonsterCharacter = character.appearanceType.startsWith('monster_')
    const isSignPostCharacter =
      character.appearanceType === SIGN_POST_APPEARANCE_TYPE
    const monsterAnimationTextures = isMonsterCharacter
      ? monsterAnimationTexturesByAppearanceType[
          character.appearanceType as MonsterAppearanceType
        ]
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
          getMonsterCombatStateOptions(character.id)
        )
      )
      monsterSpawnStates.set(character.id, {
        ...character,
        position: {
          ...character.position
        },
        collisionSize: {
          ...character.collisionSize
        }
      })
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

  const syncCharacterSprite = (
    character: CharacterState,
    now = performance.now()
  ) => {
    const renderNode = renderedCharacters.get(character.id)

    if (!renderNode) {
      throw new Error(`Missing rendered sprite for character ${character.id}`)
    }

    const combatState = monsterCombatStates.get(character.id)

    if (combatState && isMonsterDefeated(combatState)) {
      renderNode.container.visible = false
      return
    }

    if (
      character.id === PLAYER_CHARACTER_ID &&
      playerProfile.hp.current === 0
    ) {
      playerHitReactionState = undefined
      renderNode.container.visible = false
      syncPlayerWeaponSprite(character)
      syncPlayerEquipmentSprites(renderNode)
      return
    }

    let playerHitReactionOffsetX = 0
    let playerHitReactionOffsetY = 0
    let monsterRunMotionOffsetX = 0
    let monsterRunMotionOffsetY = 0
    const playerRollVisualState =
      character.id === PLAYER_CHARACTER_ID
        ? getActivePlayerRollVisualState(now)
        : undefined

    if (character.id === PLAYER_CHARACTER_ID && playerHitReactionState) {
      if (playerHitReactionState.expiresAtMilliseconds <= now) {
        playerHitReactionState = undefined
      } else {
        const elapsedMilliseconds = now - playerHitReactionState.startedAtMilliseconds
        const progress = Math.min(
          1,
          Math.max(0, elapsedMilliseconds / PLAYER_HIT_REACTION_DURATION_MILLISECONDS)
        )
        const recoilStrength =
          PLAYER_HIT_REACTION_MAX_OFFSET_PIXELS * Math.pow(1 - progress, 2)

        playerHitReactionOffsetX = Math.round(
          playerHitReactionState.directionX * recoilStrength
        )
        playerHitReactionOffsetY = Math.round(
          playerHitReactionState.directionY * recoilStrength
        )
      }
    }

    const isMonsterCharacter = character.appearanceType.startsWith('monster_')
    const monsterBehaviorConfig = isMonsterCharacter
      ? getMonsterBehaviorConfig(character)
      : undefined
    const monsterAnimationMode = isMonsterCharacter
      ? monsterPigAnimationModes.get(character.id)
      : undefined

    if (
      monsterBehaviorConfig &&
      monsterAnimationMode === 'run' &&
      monsterBehaviorConfig.usesRunAnimation &&
      (monsterBehaviorConfig.runMotionBobPixels > 0 ||
        monsterBehaviorConfig.runMotionSwayPixels > 0)
    ) {
      const runMotionPhase =
        now / 110 +
        character.position.x * 0.31 +
        character.position.y * 0.53
      const facingMultiplier = character.facing === 'left' ? -1 : 1

      monsterRunMotionOffsetX = Math.round(
        Math.sin(runMotionPhase * 0.5) *
          monsterBehaviorConfig.runMotionSwayPixels *
          facingMultiplier
      )
      monsterRunMotionOffsetY = Math.round(
        -Math.abs(Math.sin(runMotionPhase)) *
          monsterBehaviorConfig.runMotionBobPixels
      )
    }

    // 몬스터 그림은 충돌 칸보다 크다: 그림의 발끝 가운데가 충돌 칸의 아래 가운데에 오게 당긴다.
    const monsterSpriteOffsetX = isMonsterCharacter
      ? Math.round(
          (character.collisionSize.width * map.tileWidth - renderNode.sprite.width) / 2
        )
      : 0
    const monsterSpriteOffsetY = isMonsterCharacter
      ? Math.round(character.collisionSize.height * map.tileHeight - renderNode.sprite.height)
      : 0
    renderNode.container.visible = true
    renderNode.container.position.set(
      character.position.x * map.tileWidth +
        playerHitReactionOffsetX +
        monsterRunMotionOffsetX +
        monsterSpriteOffsetX,
      character.position.y * map.tileHeight +
        playerHitReactionOffsetY +
        monsterRunMotionOffsetY +
        monsterSpriteOffsetY
    )
    renderNode.container.zIndex = getCharacterDepthSortValue(
      character.position.y,
      renderNode.sprite.height,
      map.tileHeight
    ) + (character.appearanceType === SIGN_POST_APPEARANCE_TYPE ? 1 : 0)
    syncPlayerRollSpriteVisual(renderNode, playerRollVisualState)
    syncLpcCharacterVisual(renderNode, character, now)
    syncCharacterDisplayLabel(renderNode)
    syncPlayerNameBadge(renderNode, character)
    syncCharacterLevelBadge(renderNode, character)
    syncPlayerResourceBars(renderNode, character)
    depthSortedLayer?.sortChildren()

    if (character.id === PLAYER_CHARACTER_ID) {
      syncPlayerEquipmentSprites(renderNode)
      syncPlayerWeaponSprite(character)
    }
  }

  const getActivePlayerRollVisualState = (
    now: number
  ): PlayerRollVisualState | undefined => {
    if (!playerRollState) {
      return undefined
    }

    const progress = getPlayerRollProgress({
      nowMilliseconds: now,
      startedAtMilliseconds: playerRollState.startedAtMilliseconds
    })

    if (progress >= 1) {
      return undefined
    }

    return getPlayerRollVisualState({
      vector: playerRollState.vector,
      progress
    })
  }

  const syncPlayerRollSpriteVisual = (
    renderNode: RenderedCharacterNode,
    visualState: PlayerRollVisualState | undefined
  ) => {
    renderNode.sprite.scale.set(
      renderNode.renderScale * (visualState?.scaleX ?? 1),
      renderNode.renderScale * (visualState?.scaleY ?? 1)
    )

    if (!visualState) {
      renderNode.sprite.anchor.set(0)
      renderNode.sprite.position.set(0, 0)
      renderNode.sprite.rotation = 0
      return
    }

    renderNode.sprite.anchor.set(0.5)
    renderNode.sprite.position.set(
      renderNode.sprite.width / 2 + visualState.offsetX,
      renderNode.sprite.height / 2 + visualState.offsetY
    )
    renderNode.sprite.rotation = visualState.rotation
  }

  const syncPlayerEquipmentSprites = (renderNode: RenderedCharacterNode) => {
    // LPC 기사는 갑옷·투구가 그림에 들어 있다 — 예전 2D 덧그림은 쓰지 않는다.
    if (renderNode.lpc) {
      if (renderNode.playerArmorSprite) renderNode.playerArmorSprite.visible = false
      if (renderNode.playerHelmetSprite) renderNode.playerHelmetSprite.visible = false
      return
    }
    syncPlayerEquipmentSprite(renderNode, 'armor', renderNode.playerArmorSprite)
    syncPlayerEquipmentSprite(renderNode, 'hat', renderNode.playerHelmetSprite)
  }

  const syncPlayerEquipmentSprite = (
    renderNode: RenderedCharacterNode,
    slotId: PlayerVisualEquipmentSlotId,
    sprite: Sprite | undefined
  ) => {
    if (!sprite) {
      return
    }

    const equippedItem = currentPlayerEquipment.slots.find(
      (slot) => slot.id === slotId
    )?.item
    const config = equippedItem
      ? PLAYER_EQUIPMENT_APPEARANCE_CONFIG_BY_ITEM_ID[equippedItem.id]
      : undefined
    const texture = equippedItem
      ? playerEquipmentTexturesByItemId.get(equippedItem.id)
      : undefined
    const shouldShowEquipment =
      renderNode.container.visible &&
      playerProfile.hp.current > 0 &&
      config?.slotId === slotId &&
      texture !== undefined

    sprite.visible = shouldShowEquipment

    if (!shouldShowEquipment || !config || !texture) {
      return
    }

    sprite.texture = texture
    const playerRollVisualState = getActivePlayerRollVisualState(performance.now())

    sprite.position.set(
      config.position.x + (playerRollVisualState?.offsetX ?? 0),
      config.position.y + (playerRollVisualState?.offsetY ?? 0)
    )
    sprite.rotation = playerRollVisualState?.rotation ?? 0
    sprite.width = config.width
    sprite.height = config.height
    sprite.zIndex = config.zIndex
  }

  const syncCharacterLevelBadge = (
    renderNode: RenderedCharacterNode,
    character: CharacterState
  ) => {
    if (!renderNode.levelBadge) {
      return
    }

    if (character.level === undefined) {
      renderNode.levelBadge.visible = false
      renderNode.levelBadge.text = ''
      if (renderNode.monsterHealthBar) {
        renderNode.monsterHealthBar.container.visible = false
      }
      return
    }

    if (character.id === PLAYER_CHARACTER_ID) {
      renderNode.levelBadge.visible = true
      renderNode.levelBadge.text = `Lv ${character.level}`
      const playerStatusStackHeight =
        renderNode.levelBadge.height +
        PLAYER_HEALTH_BAR_HEIGHT +
        PLAYER_MANA_BAR_HEIGHT +
        PLAYER_HEALTH_BAR_GAP +
        PLAYER_MANA_BAR_GAP +
        PLAYER_STATUS_STACK_CLEARANCE
      renderNode.levelBadge.position.set(
        Math.round((renderNode.sprite.width - renderNode.levelBadge.width) / 2),
        -Math.round(playerStatusStackHeight)
      )
      return
    }

    renderNode.levelBadge.visible = true
    renderNode.levelBadge.text = `${getMonsterDisplayName({
      id: character.id,
      displayText: character.displayText
    })} Lv ${character.level}`

    if (renderNode.monsterHealthBar && character.appearanceType.startsWith('monster_')) {
      const combatState = monsterCombatStates.get(character.id)

      syncMonsterHealthBar(renderNode.monsterHealthBar, combatState)
      renderNode.levelBadge.position.set(
        Math.round((renderNode.sprite.width - renderNode.levelBadge.width) / 2),
        -Math.round(
          renderNode.levelBadge.height +
            MONSTER_HEALTH_BAR_HEIGHT +
            MONSTER_HEALTH_BAR_GAP +
            6
        )
      )
      renderNode.monsterHealthBar.container.position.set(
        Math.round((renderNode.sprite.width - MONSTER_HEALTH_BAR_WIDTH) / 2),
        -Math.round(MONSTER_HEALTH_BAR_HEIGHT + 4)
      )
      return
    }

    renderNode.levelBadge.position.set(
      Math.round((renderNode.sprite.width - renderNode.levelBadge.width) / 2),
      -Math.round(renderNode.levelBadge.height + 4)
    )
  }

  const syncQuestNpcBadges = () => {
    for (const [npcId, renderNode] of renderedCharacters) {

      if (!renderNode?.questBadge) {
        continue
      }

      const badgeKind = getQuestNpcBadgeKindForNpc(currentQuestLog, npcId)

      if (!badgeKind) {
        renderNode.questBadge.visible = false
        continue
      }

      renderNode.questBadge.visible = true
      renderNode.questBadge.texture =
        badgeKind === 'new' ? questNewTexture : questFinTexture
      renderNode.questBadge.zIndex = renderNode.container.zIndex + 2000
      renderNode.questBadge.position.set(
        Math.round(renderNode.container.x + renderNode.sprite.width / 2),
        Math.round(
          renderNode.container.y -
            QUEST_BADGE_Y_OFFSET -
            (renderNode.lpc ? LPC_HEAD_CLEARANCE_PIXELS : 0)
        )
      )
    }

    messageLayer.sortChildren()
  }

  const syncPlayerNameBadge = (
    renderNode: RenderedCharacterNode,
    character: CharacterState
  ) => {
    if (character.id !== PLAYER_CHARACTER_ID || !renderNode.playerNameBadge) {
      return
    }

    renderNode.playerNameBadge.visible = true
    renderNode.playerNameBadge.text = playerProfile.name

    renderNode.playerNameBadge.position.set(
      Math.round((renderNode.sprite.width - renderNode.playerNameBadge.width) / 2),
      Math.round(renderNode.sprite.height + PLAYER_NAME_BADGE_FOOT_OFFSET)
    )
  }

  const syncPlayerResourceBars = (
    renderNode: RenderedCharacterNode,
    character: CharacterState
  ) => {
    if (
      character.id !== PLAYER_CHARACTER_ID ||
      !renderNode.playerHealthBar ||
      !renderNode.playerManaBar ||
      !renderNode.playerNameBadge
    ) {
      return
    }

    const healthBar = renderNode.playerHealthBar
    const manaBar = renderNode.playerManaBar
    const healthRatio =
      playerProfile.hp.max === 0
        ? 0
        : Math.min(1, Math.max(0, playerProfile.hp.current / playerProfile.hp.max))
    const manaRatio =
      playerProfile.mp.max === 0
        ? 0
        : Math.min(1, Math.max(0, playerProfile.mp.current / playerProfile.mp.max))
    const healthInnerWidth = PLAYER_HEALTH_BAR_WIDTH - 2
    const healthInnerHeight = PLAYER_HEALTH_BAR_HEIGHT - 2
    const manaInnerWidth = PLAYER_MANA_BAR_WIDTH - 2
    const manaInnerHeight = PLAYER_MANA_BAR_HEIGHT - 2
    const healthFilledWidth = Math.max(0, Math.round(healthInnerWidth * healthRatio))
    const manaFilledWidth = Math.max(0, Math.round(manaInnerWidth * manaRatio))
    const statusStackTopY = -Math.round(
      PLAYER_HEALTH_BAR_HEIGHT +
        PLAYER_MANA_BAR_HEIGHT +
        PLAYER_MANA_BAR_GAP +
        PLAYER_STATUS_STACK_CLEARANCE +
        (renderNode.lpc ? LPC_HEAD_CLEARANCE_PIXELS : 0)
    )

    healthBar.container.visible = true
    healthBar.track.clear()
    healthBar.track
      .rect(0, 0, PLAYER_HEALTH_BAR_WIDTH, PLAYER_HEALTH_BAR_HEIGHT)
      .fill({ color: PLAYER_HEALTH_BAR_TRACK_COLOR })
      .stroke({ color: PLAYER_HEALTH_BAR_BORDER_COLOR, width: 1 })
    healthBar.fill.clear()

    if (healthFilledWidth > 0) {
      healthBar.fill
        .rect(1, 1, healthFilledWidth, healthInnerHeight)
        .fill({ color: PLAYER_HEALTH_BAR_FILL_COLOR })
    }

    manaBar.container.visible = true
    manaBar.track.clear()
    manaBar.track
      .rect(0, 0, PLAYER_MANA_BAR_WIDTH, PLAYER_MANA_BAR_HEIGHT)
      .fill({ color: PLAYER_MANA_BAR_TRACK_COLOR })
      .stroke({ color: PLAYER_MANA_BAR_BORDER_COLOR, width: 1 })
    manaBar.fill.clear()

    if (manaFilledWidth > 0) {
      manaBar.fill
        .rect(1, 1, manaFilledWidth, manaInnerHeight)
        .fill({ color: PLAYER_MANA_BAR_FILL_COLOR })
    }

    healthBar.container.position.set(
      Math.round((renderNode.sprite.width - PLAYER_HEALTH_BAR_WIDTH) / 2),
      statusStackTopY
    )
    manaBar.container.position.set(
      Math.round((renderNode.sprite.width - PLAYER_MANA_BAR_WIDTH) / 2),
      healthBar.container.position.y + PLAYER_HEALTH_BAR_HEIGHT + PLAYER_MANA_BAR_GAP
    )
  }

  const syncCharacterDisplayLabel = (
    renderNode: RenderedCharacterNode
  ) => {
    if (!renderNode.displayLabel) {
      return
    }

    if (renderNode.displayLabelPanel) {
      renderNode.displayLabelPanel.visible = true
      renderNode.displayLabelPanel.position.set(
        Math.round(
          (renderNode.sprite.width - renderNode.displayLabelPanel.width) / 2
        ),
        -Math.round(renderNode.displayLabelPanel.height - 6)
      )
      renderNode.displayLabel.anchor.set(0.5)
      renderNode.displayLabel.visible = true
      renderNode.displayLabel.position.set(
        Math.round(renderNode.sprite.width / 2),
        Math.round(
          renderNode.displayLabelPanel.position.y +
            renderNode.displayLabelPanel.height / 2
        )
      )
      return
    }

    renderNode.displayLabel.visible = true
    renderNode.displayLabel.anchor.set(0)
    renderNode.displayLabel.position.set(
      Math.round((renderNode.sprite.width - renderNode.displayLabel.width) / 2),
      Math.round(renderNode.sprite.height + PLAYER_NAME_BADGE_FOOT_OFFSET)
    )
  }

  const syncMonsterHealthBar = (
    monsterHealthBar: NonNullable<RenderedCharacterNode['monsterHealthBar']>,
    combatState: MonsterCombatState | undefined
  ) => {
    if (!combatState) {
      monsterHealthBar.container.visible = false
      return
    }

    const ratio =
      combatState.maxHp === 0
        ? 0
        : Math.min(1, Math.max(0, combatState.currentHp / combatState.maxHp))
    const innerWidth = MONSTER_HEALTH_BAR_WIDTH - 2
    const innerHeight = MONSTER_HEALTH_BAR_HEIGHT - 2
    const filledWidth = Math.max(0, Math.round(innerWidth * ratio))

    monsterHealthBar.container.visible = true
    monsterHealthBar.track.clear()
    monsterHealthBar.track
      .rect(0, 0, MONSTER_HEALTH_BAR_WIDTH, MONSTER_HEALTH_BAR_HEIGHT)
      .fill({ color: MONSTER_HEALTH_BAR_TRACK_COLOR })
      .stroke({ color: MONSTER_HEALTH_BAR_BORDER_COLOR, width: 1 })
    monsterHealthBar.fill.clear()

    if (filledWidth > 0) {
      monsterHealthBar.fill
        .rect(1, 1, filledWidth, innerHeight)
        .fill({ color: MONSTER_HEALTH_BAR_FILL_COLOR })
    }
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
      monsterAnimationTexturesByAppearanceType[
        character.appearanceType as MonsterAppearanceType
      ]
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
      nextAttackAtMilliseconds: Math.max(
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
    const direction = getKnockbackDirection(targetCharacter, sourceCharacter)

    tryMoveCharacter(
      targetCharacterId,
      direction.x * distanceInTiles,
      direction.y * distanceInTiles,
      { preserveFacing: true }
    )
  }

  function knockbackMonsterAwayFromCharacter(
    characterId: string,
    sourceCharacter: CharacterState,
    distanceInTiles: number
  ): void {
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
        getMonsterCombatStateOptions(nextCharacter.id)
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

  // town-32 타일셋(모든 맵의 첫 타일셋)의 gid 그림
  function getTownTileTexture(gid: number): Texture {
    const tileset = map.tilesets[0]
    const resources = tilesetResources.get(tileset.source)
    return resources?.tileTextures[gid - tileset.firstGid] ?? Texture.EMPTY
  }

  function spawnMonsterGoldDrop(
    characterId: string,
    amount: number,
    position: {
      x: number
      y: number
    },
    now: number
  ): void {
    const dropId = `${characterId}:${++monsterGoldDropSequence}`
    const container = new Container()
    const pileIndex = MONSTER_GOLD_DROP_PILE_THRESHOLDS.filter(
      (threshold) => amount >= threshold
    ).length - 1
    const coin = new Sprite(getTownTileTexture(MONSTER_GOLD_DROP_PILE_GIDS[Math.max(0, pileIndex)] ?? 1109))
    // 반짝임: 더미 위에서 가끔 빛나는 십자 별
    const shine = new Graphics()
    shine.poly([0, -4, 1, -1, 4, 0, 1, 1, 0, 4, -1, 1, -4, 0, -1, -1])
    shine.fill({ color: 0xfffbe0 })
    const shadow = new Graphics()
    shadow.ellipse(0, 1, 9, 3)
    shadow.fill({ color: 0x000000, alpha: 0.22 })
    const amountText = new Text({
      style: MONSTER_GOLD_DROP_AMOUNT_TEXT_STYLE,
      text: `${amount}원`
    })

    container.label = `monster-gold-drop:${dropId}`
    container.sortableChildren = true
    coin.anchor.set(0.5, 0.78)
    coin.roundPixels = true
    shine.roundPixels = true
    amountText.roundPixels = true
    amountText.position.set(-Math.round(amountText.width / 2), MONSTER_GOLD_DROP_ICON_RADIUS + 2)
    shadow.zIndex = -1
    coin.zIndex = 0
    shine.zIndex = 1
    amountText.zIndex = 2
    container.addChild(shadow, coin, shine, amountText)
    container.position.set(position.x, position.y)
    container.zIndex = Math.round(position.y + map.tileHeight)
    depthSortedLayer?.addChild(container)
    monsterGoldDrops.set(dropId, {
      id: dropId,
      container,
      coin,
      shine,
      amountText,
      amount,
      position: {
        x: position.x,
        y: position.y
      },
      createdAt: now
    })
  }

  const syncMonsterGoldDropElement = (
    drop: MonsterGoldDrop,
    now: number
  ) => {
    const age = now - drop.createdAt
    // 튀어나오기: 처음엔 위로 솟았다가 땅에 닿으며 한 번 더 작게 튄다. 그 뒤엔 가만히.
    const pop = Math.min(1, age / MONSTER_GOLD_DROP_POP_MILLISECONDS)
    const lift =
      pop < 0.65
        ? Math.sin((pop / 0.65) * Math.PI) * MONSTER_GOLD_DROP_POP_HEIGHT_PIXELS
        : Math.sin(((pop - 0.65) / 0.35) * Math.PI) * MONSTER_GOLD_DROP_POP_HEIGHT_PIXELS * 0.25
    drop.coin.position.set(0, -Math.round(lift))
    drop.container.position.set(drop.position.x, drop.position.y)
    drop.container.zIndex = Math.round(drop.position.y + map.tileHeight)
    // 반짝임: 1.6초마다 잠깐 커졌다 사라진다(더미마다 시점이 다르게)
    const twinkle = ((age + drop.position.x * 7) % 1600) / 1600
    const twinkleScale = twinkle < 0.18 ? Math.sin((twinkle / 0.18) * Math.PI) : 0
    drop.shine.visible = pop >= 1 && twinkleScale > 0.05
    drop.shine.scale.set(twinkleScale)
    drop.shine.position.set(4, -9 - Math.round(lift))
    drop.amountText.alpha = pop >= 1 ? 1 : pop
  }

  const syncActiveMonsterGoldDrops = (now: number) => {
    for (const drop of monsterGoldDrops.values()) {
      syncMonsterGoldDropElement(drop, now)
    }

    depthSortedLayer?.sortChildren()
  }

  function spawnMonsterEquipmentDrop(
    characterId: string,
    dropDefinition: ReturnType<typeof rollMonsterEquipmentDrop>,
    position: {
      x: number
      y: number
    },
    now: number
  ): void {
    if (!dropDefinition) {
      return
    }

    const dropTexture = monsterEquipmentDropTexturesByDropId.get(
      dropDefinition.dropId
    )

    if (!dropTexture) {
      return
    }

    const dropId = `${characterId}:equipment:${++monsterEquipmentDropSequence}`
    const container = new Container()
    const sprite = new Sprite(dropTexture)
    const labelText = new Text({
      style: MONSTER_GOLD_DROP_AMOUNT_TEXT_STYLE,
      text: dropDefinition.label
    })

    container.label = `monster-equipment-drop:${dropId}`
    container.sortableChildren = true
    sprite.anchor.set(0.5)
    sprite.width = MONSTER_EQUIPMENT_DROP_RENDER_SIZE
    sprite.height = MONSTER_EQUIPMENT_DROP_RENDER_SIZE
    sprite.roundPixels = true
    labelText.roundPixels = true
    labelText.position.set(
      -Math.round(labelText.width / 2),
      Math.round(MONSTER_EQUIPMENT_DROP_RENDER_SIZE / 2) + 3
    )
    sprite.zIndex = 0
    labelText.zIndex = 1
    container.addChild(sprite, labelText)
    container.position.set(position.x, position.y)
    container.zIndex = Math.round(position.y + map.tileHeight)
    depthSortedLayer?.addChild(container)
    monsterEquipmentDrops.set(dropId, {
      id: dropId,
      dropId: dropDefinition.dropId,
      itemId: dropDefinition.itemId,
      label: dropDefinition.label,
      container,
      sprite,
      labelText,
      position: {
        x: position.x,
        y: position.y
      },
      createdAt: now
    })
  }

  const syncMonsterEquipmentDropElement = (
    drop: MonsterEquipmentDrop,
    now: number
  ) => {
    const bobOffset = Math.sin((now - drop.createdAt) / 240) * 1.75

    drop.container.position.set(drop.position.x, drop.position.y + bobOffset)
    drop.container.zIndex = Math.round(drop.position.y + map.tileHeight)
    drop.labelText.text = drop.label
    drop.labelText.position.set(
      -Math.round(drop.labelText.width / 2),
      Math.round(MONSTER_EQUIPMENT_DROP_RENDER_SIZE / 2) + 3
    )
  }

  const syncActiveMonsterEquipmentDrops = (now: number) => {
    for (const drop of monsterEquipmentDrops.values()) {
      syncMonsterEquipmentDropElement(drop, now)
    }

    depthSortedLayer?.sortChildren()
  }

  const resolveMonsterEquipmentDropPickups = () => {
    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
    const playerRect = {
      x: playerCharacter.position.x * map.tileWidth,
      y: playerCharacter.position.y * map.tileHeight,
      width: playerCharacter.collisionSize.width * map.tileWidth,
      height: playerCharacter.collisionSize.height * map.tileHeight
    }

    for (const [dropMapId, drop] of monsterEquipmentDrops) {
      const dropRect = {
        x: drop.position.x - MONSTER_EQUIPMENT_DROP_PICKUP_WIDTH / 2,
        y: drop.position.y - MONSTER_EQUIPMENT_DROP_PICKUP_HEIGHT / 2,
        width: MONSTER_EQUIPMENT_DROP_PICKUP_WIDTH,
        height: MONSTER_EQUIPMENT_DROP_PICKUP_HEIGHT
      }

      if (!doCollisionRectsIntersect(playerRect, dropRect)) {
        continue
      }

      const equipmentDefinition = getPlayerEquipmentItemDefinitionById(
        drop.itemId
      )

      if (!equipmentDefinition) {
        continue
      }

      const emptySlotIndex = findFirstEmptyPlayerInventorySlotIndex(
        currentPlayerInventory
      )

      if (emptySlotIndex === undefined) {
        showCharacterDamageText(
          PLAYER_CHARACTER_ID,
          '가방이 가득 찼습니다',
          DAMAGE_TEXT_DURATION_MILLISECONDS
        )
        continue
      }

      currentPlayerInventory = setPlayerInventorySlot({
        inventory: currentPlayerInventory,
        slotIndex: emptySlotIndex,
        item: {
          id: drop.itemId,
          label: equipmentDefinition.label,
          quantity: 1
        }
      })
      onPlayerInventoryChange(currentPlayerInventory)
      // 드롭 장비를 주우면 "아이템 획득" 목표 진행을 기록한다.
      setQuestLogWithObjectiveFeedback(
        recordItemAcquireQuestProgress(currentQuestLog, drop.itemId)
      )
      syncPlayerUiOverlays()
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        `${equipmentDefinition.label} 획득!`,
        DAMAGE_TEXT_DURATION_MILLISECONDS,
        LEVEL_UP_TEXT_STYLE
      )
      drop.container.removeFromParent()
      drop.container.destroy({ children: true })
      monsterEquipmentDrops.delete(dropMapId)
    }
  }

  const resolveMonsterGoldDropPickups = () => {
    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
    const playerRect = {
      x: playerCharacter.position.x * map.tileWidth,
      y: playerCharacter.position.y * map.tileHeight,
      width: playerCharacter.collisionSize.width * map.tileWidth,
      height: playerCharacter.collisionSize.height * map.tileHeight
    }

    for (const [dropId, drop] of monsterGoldDrops) {
      const dropRect = {
        x: drop.position.x - MONSTER_GOLD_DROP_PICKUP_WIDTH / 2,
        y: drop.position.y - MONSTER_GOLD_DROP_PICKUP_HEIGHT / 2,
        width: MONSTER_GOLD_DROP_PICKUP_WIDTH,
        height: MONSTER_GOLD_DROP_PICKUP_HEIGHT
      }

      if (!doCollisionRectsIntersect(playerRect, dropRect)) {
        continue
      }

      currentPlayerInventory = {
        ...currentPlayerInventory,
        gold: currentPlayerInventory.gold + drop.amount
      }
      onPlayerInventoryChange(currentPlayerInventory)
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        `+${drop.amount} 골드`,
        EVADE_TEXT_DURATION_MILLISECONDS,
        EVADE_TEXT_STYLE
      )
      syncPlayerUiOverlays()
      drop.container.removeFromParent()
      drop.container.destroy({ children: true })
      monsterGoldDrops.delete(dropId)
    }
  }

  // 맵 바닥 코인 더미 위를 밟으면 골드를 획득하고 타일 스프라이트를 제거한다.
  const resolveCoinPilePickups = () => {
    if (coinPileSprites.size === 0) {
      return
    }

    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
    const playerRect = {
      x: playerCharacter.position.x * map.tileWidth,
      y: playerCharacter.position.y * map.tileHeight,
      width: playerCharacter.collisionSize.width * map.tileWidth,
      height: playerCharacter.collisionSize.height * map.tileHeight
    }

    for (const [tileKey, coinPile] of coinPileSprites) {
      const coinRect = {
        x:
          (coinPile.tileX + 0.5) * map.tileWidth -
          COIN_PILE_PICKUP_WIDTH / 2,
        y:
          (coinPile.tileY + 0.5) * map.tileHeight -
          COIN_PILE_PICKUP_HEIGHT / 2,
        width: COIN_PILE_PICKUP_WIDTH,
        height: COIN_PILE_PICKUP_HEIGHT
      }

      if (!doCollisionRectsIntersect(playerRect, coinRect)) {
        continue
      }

      currentPlayerInventory = {
        ...currentPlayerInventory,
        gold: currentPlayerInventory.gold + coinPile.goldAmount
      }
      onPlayerInventoryChange(currentPlayerInventory)
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        `+${coinPile.goldAmount} 골드`,
        EVADE_TEXT_DURATION_MILLISECONDS,
        EVADE_TEXT_STYLE
      )
      syncPlayerUiOverlays()
      coinPile.sprite.removeFromParent()
      coinPile.sprite.destroy()
      coinPileSprites.delete(tileKey)
      collectedCoinTileKeySet.add(tileKey)
      onCoinPileCollected(tileKey)
    }
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
      if (
        character.appearanceType === MONSTER_SLIME_APPEARANCE_TYPE ||
        character.appearanceType === MONSTER_MUSHROOM_APPEARANCE_TYPE
      ) {
        gameSoundEffects.play('slimeDeath')
      } else {
        // 돼지/바위 등 — 묵직한 타격음으로 사망을 알린다(전용 음원이 생기면 교체).
        gameSoundEffects.play('playerSwordHit')
      }
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
      if (isBossCharacterId(characterId) && !isMonsterStillNeededByQuest(character)) {
        // 보스는 다시 생기지 않는다 — 씬을 다시 들어와도 없도록 월드 저장에 남긴다.
        // (그 보스를 잡아야 하는 퀘스트가 아직 남아 있으면 길게 기다렸다 다시 생긴다.)
        onBossDefeated(characterId)
      } else if (isBossCharacterId(characterId)) {
        monsterRespawnAtById.set(characterId, now + BOSS_RETRY_RESPAWN_DELAY_MILLISECONDS)
      } else {
        monsterRespawnAtById.set(
          characterId,
          now + MONSTER_PIG_RESPAWN_DELAY_MILLISECONDS
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
      const cast = playerMagicCast
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

  const syncCharacterMessageElement = (characterId: string) => {
    const activeMessage = activeCharacterMessages.get(characterId)

    if (!activeMessage) {
      return
    }

    const character = characterStates.find(
      (candidateCharacter) => candidateCharacter.id === characterId
    )

    if (!character) {
      activeMessage.container.removeFromParent()
      activeMessage.container.destroy({ children: true })
      activeCharacterMessages.delete(characterId)
      return
    }

    activeMessage.container.position.set(
      Math.round(
        character.position.x * map.tileWidth +
          characterPixelWidth / 2 -
          activeMessage.panel.width / 2
      ),
      Math.round(
        character.position.y * map.tileHeight -
          activeMessage.panel.height -
          MESSAGE_OFFSET_Y
      )
    )
    activeMessage.container.zIndex = getCharacterDepthSortValue(
      character.position.y,
      characterPixelHeight,
      map.tileHeight
    )
    messageLayer.sortChildren()
  }

  const syncActiveCharacterMessages = () => {
    for (const characterId of activeCharacterMessages.keys()) {
      syncCharacterMessageElement(characterId)
    }
  }

  const showCharacterMessage = (
    characterId: string,
    message: string,
    durationMilliseconds: number
  ) => {
    let activeMessage = activeCharacterMessages.get(characterId)

    if (!activeMessage) {
      const container = new Container()
      const panel = new NineSliceSprite({
        texture: messagePanelTexture,
        bottomHeight: MESSAGE_PANEL_BORDER_SIZE,
        leftWidth: MESSAGE_PANEL_BORDER_SIZE,
        rightWidth: MESSAGE_PANEL_BORDER_SIZE,
        topHeight: MESSAGE_PANEL_BORDER_SIZE
      })
      const text = new Text({
        style: MESSAGE_TEXT_STYLE,
        text: ''
      })

      panel.roundPixels = true
      text.roundPixels = true
      container.addChild(panel, text)
      messageLayer.addChild(container)
      activeMessage = {
        container,
        panel,
        text,
        expiresAt: 0
      }
      activeCharacterMessages.set(characterId, activeMessage)
    }

    activeMessage.text.text = message
    const panelWidth = Math.max(
      MESSAGE_PANEL_MIN_WIDTH,
      Math.ceil(activeMessage.text.width) + MESSAGE_PANEL_PADDING_X * 2
    )
    const panelHeight = Math.max(
      MESSAGE_PANEL_MIN_HEIGHT,
      Math.ceil(activeMessage.text.height) + MESSAGE_PANEL_PADDING_Y * 2
    )

    activeMessage.panel.setSize(panelWidth, panelHeight)
    activeMessage.text.position.set(
      Math.round((panelWidth - activeMessage.text.width) / 2),
      Math.round((panelHeight - activeMessage.text.height) / 2)
    )
    activeMessage.expiresAt = performance.now() + durationMilliseconds
    syncCharacterMessageElement(characterId)
  }

  const hideCharacterMessage = (characterId: string) => {
    const activeMessage = activeCharacterMessages.get(characterId)

    if (!activeMessage) {
      return
    }

    activeMessage.container.removeFromParent()
    activeMessage.container.destroy({ children: true })
    activeCharacterMessages.delete(characterId)
  }

  // 이벤트 보상을 실제로 지급한다(아이템/골드/경험치). v1은 이벤트 적용 시점에 지급한다.
  // (추후: 플레이어가 그 이벤트를 실제로 트리거할 때 지급하려면 상호작용 완료 훅이 필요하다.)
  const grantEventReward = (reward: EventReward): void => {
    if (reward.type === 'none' || reward.count <= 0) {
      return
    }

    if (reward.type === 'gold') {
      currentPlayerInventory = {
        ...currentPlayerInventory,
        gold: currentPlayerInventory.gold + reward.count
      }
      onPlayerInventoryChange(currentPlayerInventory)
      return
    }

    if (reward.type === 'experience') {
      grantPlayerExperienceReward(reward.count)
      return
    }

    // type === 'item'
    if (reward.id.length === 0) {
      return
    }
    const slotIndex = findFirstEmptyPlayerInventorySlotIndex(currentPlayerInventory)
    if (slotIndex === undefined) {
      return // 인벤토리가 가득 차면 조용히 건너뛴다.
    }
    const label = getPlayerEquipmentItemDefinitionById(reward.id)?.label ?? reward.id
    currentPlayerInventory = setPlayerInventorySlot({
      inventory: currentPlayerInventory,
      slotIndex,
      item: { id: reward.id, label, quantity: reward.count }
    })
    onPlayerInventoryChange(currentPlayerInventory)
  }

  // Phase 3 쓰기 채널 적용기: Lua 가 요청한 액션을 기존 상태 변경 경로로 반영한다.
  const grantInventoryItem = (itemId: string, quantity: number) => {
    if (itemId.length === 0 || quantity <= 0) {
      return
    }
    // 재료류(광석 등)는 같은 슬롯에 쌓는다 — 채굴처럼 반복 지급되는 아이템이
    // 슬롯을 하나씩 먹어치우지 않게. 스택 대상 목록은 퀘스트 보상과 공유한다.
    if (STACKABLE_QUEST_REWARD_ITEM_IDS.has(itemId)) {
      const stackSlotIndex = currentPlayerInventory.slots.findIndex(
        (slot) => slot?.id === itemId
      )
      if (stackSlotIndex >= 0) {
        const stack = currentPlayerInventory.slots[stackSlotIndex]
        if (stack) {
          currentPlayerInventory = setPlayerInventorySlot({
            inventory: currentPlayerInventory,
            slotIndex: stackSlotIndex,
            item: { ...stack, quantity: stack.quantity + quantity }
          })
          onPlayerInventoryChange(currentPlayerInventory)
          return
        }
      }
    }
    const slotIndex = findFirstEmptyPlayerInventorySlotIndex(currentPlayerInventory)
    if (slotIndex === undefined) {
      return
    }
    const label =
      getPlayerEquipmentItemDefinitionById(itemId)?.label ??
      MATERIAL_ITEM_LABEL_BY_ID[itemId] ??
      itemId
    currentPlayerInventory = setPlayerInventorySlot({
      inventory: currentPlayerInventory,
      slotIndex,
      item: { id: itemId, label, quantity }
    })
    onPlayerInventoryChange(currentPlayerInventory)
  }

  const removeInventoryItem = (itemId: string, quantity: number) => {
    if (itemId.length === 0 || quantity <= 0) {
      return
    }
    let remaining = quantity
    const nextSlots = currentPlayerInventory.slots.map((slot) => {
      if (!slot || slot.id !== itemId || remaining <= 0) {
        return slot
      }
      const taken = Math.min(slot.quantity, remaining)
      remaining -= taken
      const nextQuantity = slot.quantity - taken
      return nextQuantity > 0 ? { ...slot, quantity: nextQuantity } : undefined
    })
    currentPlayerInventory = { ...currentPlayerInventory, slots: nextSlots }
    onPlayerInventoryChange(currentPlayerInventory)
  }

  // set-config: NPC 별 플래그를 컨트롤러 config 에 보관하고 재동기화한다(다음 상호작용에서
  // get_controller_config 로 읽힌다). config 변경은 attachment 키를 바꿔 재부착을 유발한다.
  const applyNpcConfigUpdate = (
    characterId: string,
    key: string,
    value: string
  ) => {
    const character = characterStates.find((entry) => entry.id === characterId)
    if (!character || character.controller.kind !== 'lua') {
      return
    }
    const nextCharacter: CharacterState = {
      ...character,
      controller: {
        ...character.controller,
        config: { ...character.controller.config, [key]: value }
      }
    }
    characterStates = characterStates.map((entry) =>
      entry.id === characterId ? nextCharacter : entry
    )
    controllerRuntime.syncCharacters(characterStates)
  }

  const applyEventDraft = (
    draft: HolidayDialogueEventSpec,
    input?: ApplyEventDraftInput
  ): ApplyEventDraftResult => {
    const targetCharacter =
      resolveEventDraftTargetCharacter(input?.targetCharacterId, draft.npc.id)

    if (!targetCharacter) {
      return { didApply: false }
    }

    const nextCharacter: CharacterState = {
      ...targetCharacter,
      appearanceType: draft.npc.appearance_type,
      displayText: draft.npc.display_name,
      controller: createLuaCharacterController({
        scriptId: 'reply-with-message',
        radiusInTiles:
          targetCharacter.controller.kind === 'lua'
            ? targetCharacter.controller.radiusInTiles
            : 0,
        moveSpeedTilesPerSecond:
          targetCharacter.controller.kind === 'lua'
            ? targetCharacter.controller.moveSpeedTilesPerSecond
            : 8,
        config: {
          dialogueLines: [...draft.dialogue.opening_lines],
          messageDurationSeconds: draft.duration
        }
      })
    }

    characterStates = characterStates.map((character) =>
      character.id === nextCharacter.id ? nextCharacter : character
    )

    syncCharacterSprite(nextCharacter)
    controllerRuntime.syncCharacters(characterStates)
    showCharacterMessage(
      nextCharacter.id,
      draft.dialogue.opening_lines[0],
      Math.round(draft.duration * 1000)
    )
    syncQuestNpcBadges()
    grantEventReward(draft.reward)

    return {
      didApply: true,
      targetCharacterId: nextCharacter.id
    }
  }

  const resolveEventDraftTargetCharacter = (
    preferredCharacterId: string | undefined,
    fallbackCharacterId: string
  ): CharacterState | undefined => {
    if (preferredCharacterId) {
      const preferredTarget = characterStates.find(
        (character) => character.id === preferredCharacterId
      )

      if (preferredTarget) {
        return preferredTarget
      }
    }

    const fallbackTarget = characterStates.find(
      (character) => character.id === fallbackCharacterId
    )

    if (fallbackTarget) {
      return fallbackTarget
    }

    const santaTarget = characterStates.find((character) => character.id === 'santa')

    if (santaTarget) {
      return santaTarget
    }

    return characterStates.find((character) => character.controller.kind === 'lua')
  }

  // 에디터가 생성한 Lua 컨트롤러 코드를 대상 NPC에 핫 적용한다. 런타임이 Lua를 검증·재빌드하므로
  // 잘못된 코드면 updateLuaControllerScript가 throw하고, 호출부가 그 에러를 상태로 알린다.
  const applyLuaScript = (input: {
    targetCharacterId: string
    source: string
  }): ApplyEventDraftResult => {
    const targetCharacter = resolveEventDraftTargetCharacter(
      input.targetCharacterId,
      input.targetCharacterId
    )

    if (!targetCharacter) {
      return { didApply: false }
    }

    const scriptId = `generated:${targetCharacter.id}`
    controllerRuntime.updateLuaControllerScript(scriptId, { source: input.source })

    const nextCharacter: CharacterState = {
      ...targetCharacter,
      controller: createLuaCharacterController({
        scriptId,
        radiusInTiles:
          targetCharacter.controller.kind === 'lua'
            ? targetCharacter.controller.radiusInTiles
            : 0,
        moveSpeedTilesPerSecond:
          targetCharacter.controller.kind === 'lua'
            ? targetCharacter.controller.moveSpeedTilesPerSecond
            : 8
      })
    }

    characterStates = characterStates.map((character) =>
      character.id === nextCharacter.id ? nextCharacter : character
    )
    syncCharacterSprite(nextCharacter)
    controllerRuntime.syncCharacters(characterStates)

    return { didApply: true, targetCharacterId: nextCharacter.id }
  }

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

  const syncCharacterDamageTextElement = (
    characterId: string,
    now: number
  ) => {
    const activeDamageText = activeCharacterDamageTexts.get(characterId)

    if (!activeDamageText) {
      return
    }

    const character = characterStates.find(
      (candidateCharacter) => candidateCharacter.id === characterId
    )

    if (!character) {
      activeDamageText.container.removeFromParent()
      activeDamageText.container.destroy({ children: true })
      activeCharacterDamageTexts.delete(characterId)
      return
    }

    const elapsedMilliseconds = now - activeDamageText.startedAt
    const progress = Math.min(
      1,
      Math.max(
        0,
        elapsedMilliseconds / activeDamageText.durationMilliseconds
      )
    )
    const floatOffset = Math.round(progress * DAMAGE_TEXT_FLOAT_DISTANCE)

    activeDamageText.container.position.set(
      Math.round(
        character.position.x * map.tileWidth +
          characterPixelWidth / 2 -
          activeDamageText.text.width / 2
      ),
      Math.round(
        character.position.y * map.tileHeight -
          activeDamageText.text.height -
          DAMAGE_TEXT_OFFSET_Y -
          floatOffset
      )
    )
    activeDamageText.container.alpha = 1 - progress
    activeDamageText.container.zIndex = getCharacterDepthSortValue(
      character.position.y,
      characterPixelHeight,
      map.tileHeight
    )
    messageLayer.sortChildren()
  }

  const syncActiveCharacterDamageTexts = (now: number) => {
    for (const characterId of activeCharacterDamageTexts.keys()) {
      syncCharacterDamageTextElement(characterId, now)
    }
  }

  const showCharacterDamageText = (
    characterId: string,
    message: string,
    durationMilliseconds: number,
    style: TextStyle = DAMAGE_TEXT_STYLE
  ) => {
    let activeDamageText = activeCharacterDamageTexts.get(characterId)

    if (!activeDamageText) {
      const container = new Container()
      const text = new Text({
        style: DAMAGE_TEXT_STYLE,
        text: ''
      })

      text.roundPixels = true
      container.addChild(text)
      messageLayer.addChild(container)
      activeDamageText = {
        container,
        text,
        startedAt: 0,
        durationMilliseconds,
        expiresAt: 0
      }
      activeCharacterDamageTexts.set(characterId, activeDamageText)
    }

    activeDamageText.text.style = style
    activeDamageText.text.text = message
    activeDamageText.startedAt = performance.now()
    activeDamageText.durationMilliseconds = durationMilliseconds
    activeDamageText.expiresAt =
      activeDamageText.startedAt + durationMilliseconds
    activeDamageText.container.alpha = 1
    syncCharacterDamageTextElement(characterId, activeDamageText.startedAt)
  }

  const pruneExpiredCharacterDamageTexts = (now: number) => {
    for (const [characterId, activeDamageText] of activeCharacterDamageTexts) {
      if (activeDamageText.expiresAt > now) {
        continue
      }

      activeDamageText.container.removeFromParent()
      activeDamageText.container.destroy({ children: true })
      activeCharacterDamageTexts.delete(characterId)
    }
  }

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
          if (intent.movement) {
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
          monsterAnimationTexturesByAppearanceType[
            character.appearanceType as MonsterAppearanceType
          ]
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
                if (
                  monsterCharacter.appearanceType ===
                    MONSTER_SLIME_APPEARANCE_TYPE ||
                  monsterCharacter.appearanceType ===
                    MONSTER_MUSHROOM_APPEARANCE_TYPE
                ) {
                  gameSoundEffects.play('slimeAttack')
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

            if (distance > 0) {
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
      }
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
        handleScenarioInteractionEvents(gameEventQueue.drain(), now),
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

  // ── 마우스 에셋 배치(에디터 배치 모드) ──
  // 에디터가 배치 모드+놓을 항목을 postMessage로 켜면, 게임 캔버스 클릭이 그 칸에 배치를 만든다.
  // 배치 데이터는 맵별 localStorage(placementStore)에 저장돼 새로고침·재접속에도 유지된다.
  let placementMode: 'off' | 'place' | 'erase' = 'off'
  // 타일/오브젝트 배치 템플릿 또는 NPC 와이어 템플릿(kind로 구분).
  let placementTemplate: PlacementTemplate | NpcWireTemplate | null = null
  let placementSprites: Sprite[] = []
  const decorationLayer = new Container()
  decorationLayer.label = 'layer:generated-decorations'
  world.addChild(decorationLayer)
  const nightShade = new Graphics()
    .rect(0, 0, map.pixelWidth, map.pixelHeight)
    .fill({ color: 0x07132e, alpha: 0.58 })
  nightShade.label = 'decoration:night-shade'
  nightShade.visible = false
  decorationLayer.addChild(nightShade)
  const bulbLights = new Container()
  bulbLights.label = 'decoration:twinkling-bulbs'
  bulbLights.eventMode = 'none'
  decorationLayer.addChild(bulbLights)
  let decorationRevision = 0
  let lightTime = 0
  let twinkleEnabled = true
  const themeColorFilter = new ColorMatrixFilter()
  const animateDecorationLights = (): void => {
    lightTime += app.ticker.deltaMS / 1000
    bulbLights.children.forEach((light, index) => {
      light.alpha = twinkleEnabled ? 0.65 + 0.25 * Math.sin(lightTime * 2.2 + index * 1.7) : 0.85
    })
  }
  app.ticker.add(animateDecorationLights)
  let flowingWaterTime = 0
  const animateFlowingWater = (): void => {
    if (flowingWaterSurfaces.length === 0) return
    flowingWaterTime += app.ticker.deltaMS / 1000
    for (const flowingWaterSurface of flowingWaterSurfaces) {
      flowingWaterSurface.update(flowingWaterTime)
    }
  }
  app.ticker.add(animateFlowingWater)

  const addBulbLights = async (item: PlacedItem, sprite: Sprite, revision: number): Promise<void> => {
    if (!item.imageUrl) return
    const image = new Image()
    image.src = item.imageUrl
    try { await image.decode() } catch { return }
    if (revision !== decorationRevision) return
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, image.width, image.height).data
    // Merge nearby warm pixels into one glow per small bulb region.
    const cells = new Map<string, { x: number; y: number; count: number }>()
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const i = (y * image.width + x) * 4
        if (pixels[i + 3] < 180 || pixels[i] < 210 || pixels[i + 1] < 150 || pixels[i + 2] > 105) continue
        const key = `${Math.floor(x / 8)},${Math.floor(y / 8)}`
        const cell = cells.get(key) ?? { x: 0, y: 0, count: 0 }
        cell.x += x; cell.y += y; cell.count++
        cells.set(key, cell)
      }
    }
    for (const cell of cells.values()) {
      if (cell.count < 2) continue
      const light = new Graphics()
        .circle(0, 0, 9).fill({ color: 0xffbe55, alpha: 0.07 })
        .circle(0, 0, 5).fill({ color: 0xffc65a, alpha: 0.16 })
        .circle(0, 0, 1.5).fill({ color: 0xfff0b0, alpha: 0.7 })
      light.position.set(
        sprite.x + (cell.x / cell.count - sprite.anchor.x * image.width) * sprite.scale.x,
        sprite.y + (cell.y / cell.count - sprite.anchor.y * image.height) * sprite.scale.y
      )
      bulbLights.addChild(light)
    }
  }
  // 수기 배치 NPC는 정적 스프라이트가 아니라 게임의 CharacterState로 스폰된다(이동 차단 + 대사).
  // 스폰한 NPC의 id 집합 — 저장소와 비교(reconcile)해 추가/삭제를 반영한다.
  const placedNpcIds = new Set<string>()

  const textureForPlacement = async (
    item: PlacedItem
  ): Promise<Texture | undefined> => {
    if (item.kind === 'tile' && item.tileId !== undefined) {
      // 맵에 타일셋이 하나면 source가 안 맞아도 그걸로 폴백.
      const tileset =
        map.tilesets.find((candidate) => candidate.source === item.tilesetSource) ??
        map.tilesets[0]
      const resources = tileset ? tilesetResources.get(tileset.source) : undefined
      return resources?.tileTextures[item.tileId]
    }
    if (item.kind === 'object' && item.imageUrl) {
      return await loadTextureSafe(item.imageUrl)
    }
    return undefined
  }

  const renderPlacements = async (items: PlacedItem[]): Promise<void> => {
    const revision = ++decorationRevision
    for (const light of bulbLights.removeChildren()) light.destroy()
    const settings = items.find(item => item.visible !== false && item.themeSettings)?.themeSettings
    // Explicit generated settings belong to the current map; only legacy decorations use the town fallback.
    const enabled = Boolean(settings) || (sceneId === 'town' && items.some(item => item.renderLayer === 'decoration' && item.visible !== false))
    nightShade.visible = enabled && (settings ? settings.night > 0 : true)
    nightShade.alpha = settings ? Math.max(0, Math.min(0.8, settings.night)) / 0.58 : 1
    twinkleEnabled = settings?.twinkle ?? true
    bulbLights.visible = enabled
    const gain = settings?.color.gain ?? [1, 1, 1]
    const bias = settings?.color.bias ?? [0, 0, 0]
    themeColorFilter.matrix = [gain[0],0,0,0,bias[0], 0,gain[1],0,0,bias[1], 0,0,gain[2],0,bias[2], 0,0,0,1,0]
    for (const target of themeColorTargets) target.filters = settings ? [themeColorFilter] : []
    for (const sprite of placementSprites) {
      sprite.parent?.removeChild(sprite)
      sprite.destroy()
    }
    placementSprites = []
    if (!depthSortedLayer) {
      return
    }
    for (const item of items) {
      if (item.visible === false) {
        continue
      }
      const texture = await textureForPlacement(item)
      if (revision !== decorationRevision) return
      if (!texture) {
        continue
      }
      const sprite = new Sprite(texture)
      const displayScale =
        typeof item.displayScale === 'number' && item.displayScale > 0
          ? item.displayScale
          : 1
      sprite.scale.set(displayScale)
      if (item.anchor === 'bottom-center') {
        sprite.anchor.set(0.5, 1)
        sprite.position.set(
          (item.col + 0.5) * map.tileWidth,
          (item.row + 1) * map.tileHeight
        )
      } else {
        sprite.position.set(item.col * map.tileWidth, item.row * map.tileHeight)
      }
      // 지우기 히트테스트에서 어느 배치인지 역추적하기 위해 배치 id를 표식으로 단다.
      sprite.label = item.id
      // 자기 아래 가장자리 기준 깊이정렬 — 캐릭터/지붕과 같은 규칙으로 자연스럽게 겹친다.
      sprite.zIndex =
        item.anchor === 'bottom-center'
          ? sprite.y + 0.6
          : item.row * map.tileHeight +
            (texture.height || map.tileHeight) * displayScale +
            0.6
      if (item.renderLayer === 'decoration') {
        decorationLayer.addChild(sprite)
        if (enabled && !item.themeSettings) void addBulbLights(item, sprite, revision)
      } else {
        depthSortedLayer.addChild(sprite)
      }
      placementSprites.push(sprite)
    }
    depthSortedLayer.sortChildren()
    decorationLayer.setChildIndex(bulbLights, decorationLayer.children.length - 1)
  }

  const refreshPlacements = (): void => {
    const nextAtlasUrl = loadPlacementsForMap(sceneId).find(item => item.visible !== false && item.themeSettings)?.themeSettings?.tilesetImageUrl
    if (nextAtlasUrl !== appliedAtlasUrl) {
      window.location.reload()
      return
    }
    void renderPlacements(loadPlacementsForMap(sceneId))
  }

  // ── 수기 배치 NPC(에디터 NPC 탭) ──
  // 외형(appearanceType)을 텍스처로 풀어 최소 캐릭터 렌더 노드를 만든다(플레이어/몬스터 부속 없음).
  // 부팅 캐릭터 빌드 루프의 비(非)플레이어·비몬스터 경로만 옮긴 것. renderedCharacters에 등록해야
  // syncCharacterSprite가 매 틱 위치/깊이를 잡는다(엔트리가 없으면 throw).
  const createRenderedNpcNode = (character: CharacterState): void => {
    if (!depthSortedLayer) {
      return
    }
    const resolved = resolveCharacterTexture(
      character.appearanceType,
      characterTilesetResources.tileTextures,
      characterSpriteSheet.tileset,
      map.tilesets,
      tilesetResources,
      map.tileWidth
    )
    const container = new Container()
    container.label = `character:${character.id}:container`
    container.sortableChildren = true
    // 에디터로 놓은 NPC 도 LPC 시트가 있으면(이번 씬에서 이미 불러 둔 외형) 같은 그림체로.
    const npcSheets = getLpcNpcSheetsFor(character)
    const sprite = new Sprite(npcSheets ? lpcPlaceholderTexture : resolved.texture)
    sprite.label = `character:${character.id}`
    sprite.scale.set(npcSheets ? 1 : resolved.renderScale)
    sprite.roundPixels = true
    sprite.zIndex = 10
    container.addChild(sprite)
    const lpcNode = npcSheets ? createLpcCharacterNode(container, character, npcSheets) : undefined
    const displayLabel =
      character.displayText === undefined
        ? undefined
        : new Text({ style: PLAYER_NAME_BADGE_STYLE, text: character.displayText })
    if (displayLabel) {
      displayLabel.label = `character:${character.id}:display-label`
      displayLabel.roundPixels = true
      displayLabel.zIndex = 16
      container.addChild(displayLabel)
    }
    renderedCharacters.set(character.id, {
      container,
      sprite,
      renderScale: npcSheets ? 1 : resolved.renderScale,
      lpc: lpcNode,
      displayLabel
    })
    depthSortedLayer.addChild(container)
    attachCharacterLabelLayer(character.id)
  }

  const despawnPlacedNpc = (id: string): void => {
    const renderNode = renderedCharacters.get(id)
    if (renderNode) {
      renderNode.container.parent?.removeChild(renderNode.container)
      renderNode.container.destroy({ children: true })
      renderNode.labelContainer?.removeFromParent()
      renderNode.labelContainer?.destroy({ children: true })
      renderedCharacters.delete(id)
    }
    characterStates = characterStates.filter((character) => character.id !== id)
    placedNpcIds.delete(id)
    // 이 NPC를 대상으로 한 상호작용 잠금 항목 정리 — 같은 id는 다시 안 생기므로 죽은 항목(장기 세션 누수 방지).
    for (const lockKey of [...interactionLockUntilByCharacterPair.keys()]) {
      if (lockKey.endsWith(`:${id}`) || lockKey.endsWith(`:${id}:quest`)) {
        interactionLockUntilByCharacterPair.delete(lockKey)
      }
    }
  }

  // 저장소(npcStore)의 NPC 목록과 현재 스폰 상태를 맞춘다 — 새 항목은 스폰, 사라진 항목은 디스폰.
  // 반복 호출(부팅·storage·클릭)해도 같은 id를 두 번 스폰하지 않도록 placedNpcIds로 가드한다.
  const refreshNpcs = (): void => {
    const stored = loadNpcsForMap(sceneId)
    const storedById = new Map(stored.map((npc) => [npc.id, npc] as const))
    let changed = false

    for (const id of [...placedNpcIds]) {
      if (!storedById.has(id)) {
        despawnPlacedNpc(id)
        changed = true
      }
    }

    for (const npc of stored) {
      if (placedNpcIds.has(npc.id)) {
        continue
      }
      const character = createNpcCharacter({
        id: npc.id,
        appearanceType: npc.appearanceType,
        position: { x: npc.col, y: npc.row },
        collisionSize: { width: 1, height: 1 },
        displayText: npc.name,
        controller: createIdleNpcCharacterController({
          dialogueLines: npc.dialogueLines
        })
      })
      try {
        // 외형이 캐릭터 시트에 없으면 resolveCharacterTexture가 throw — 그 NPC만 건너뛴다.
        createRenderedNpcNode(character)
      } catch (error) {
        console.warn(`[npc] 외형을 해석하지 못해 건너뜀: ${npc.appearanceType}`, error)
        continue
      }
      characterStates = [...characterStates, character]
      placedNpcIds.add(npc.id)
      syncCharacterSprite(character)
      changed = true
    }

    if (changed) {
      // 컨트롤러 부착(대사 NPC 상호작용 활성)·충돌 반영을 즉시 갱신.
      controllerRuntime.syncCharacters(characterStates)
    }
  }

  // 한 칸이 NPC를 놓기에 적합한지: 맵 안 + 벽 아님 + 다른 캐릭터(플레이어/NPC/몬스터)와 안 겹침.
  const isNpcSpawnableTile = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
      return false
    }
    if (isWallTileAt(wallTiles, x, y)) {
      return false
    }
    const rect: CollisionRect = { x, y, width: 1, height: 1 }
    return !getBlockingCollisionRects('').some((blocker) =>
      doCollisionRectsIntersect(rect, blocker)
    )
  }

  // 플레이어를 중심으로 바깥쪽 링부터 훑어 가장 가까운 빈 칸을 찾는다(자기 칸은 제외).
  const findSpawnTileNearPlayer = (player: {
    x: number
    y: number
  }): { x: number; y: number } | undefined => {
    const px = Math.round(player.x)
    const py = Math.round(player.y)
    for (let radius = 1; radius <= 8; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          // 현재 반지름의 테두리 칸만(안쪽은 이전 반지름에서 이미 검사됨).
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) {
            continue
          }
          const x = px + dx
          const y = py + dy
          if (isNpcSpawnableTile(x, y)) {
            return { x, y }
          }
        }
      }
    }
    return undefined
  }

  // 에디터 생성 NPC를 플레이어 옆 빈 칸에 스폰한다(npcStore에 저장 후 refreshNpcs가 CharacterState로
  // 만든다 — 수기 배치 NPC와 같은 경로). 외형이 시트에 없으면 refreshNpcs의 try/catch가 스킵한다.
  const spawnNpcNearPlayer = (template: {
    appearanceType: string
    name?: string
    dialogueLines?: string[]
  }): boolean => {
    const player = getCharacterStateById(PLAYER_CHARACTER_ID)
    if (!player) {
      return false
    }
    const spot = findSpawnTileNearPlayer(player.position)
    if (!spot) {
      console.warn('[npc] 플레이어 주변에 빈 칸이 없어 NPC를 스폰하지 못했습니다.')
      return false
    }
    addNpc(
      sceneId,
      {
        appearanceType: template.appearanceType,
        name: template.name,
        dialogueLines: template.dialogueLines
      },
      spot.x,
      spot.y
    )
    refreshNpcs()
    return true
  }

  // 배치 NPC를 클릭 지점(스프라이트 픽셀 영역)으로 맞혀 지운다. 맞으면 true(이후 배치 지우기 생략).
  const eraseNpcAtPoint = (x: number, y: number): boolean => {
    for (const id of [...placedNpcIds].reverse()) {
      const renderNode = renderedCharacters.get(id)
      if (!renderNode) {
        continue
      }
      const left = renderNode.container.x
      const top = renderNode.container.y
      if (
        x >= left &&
        x < left + renderNode.sprite.width &&
        y >= top &&
        y < top + renderNode.sprite.height
      ) {
        removeNpc(sceneId, id)
        refreshNpcs()
        return true
      }
    }
    return false
  }

  app.stage.eventMode = 'static'
  app.stage.hitArea = app.screen
  const eraseAtPoint = (x: number, y: number): void => {
    // 칸 앵커가 아니라 스프라이트의 실제 픽셀 영역으로 맞힌다. 오브젝트는 여러 칸을 덮으므로
    // 가운데/아래를 클릭해도 지워진다(타일은 1칸이라 그대로 동작). 위(나중에 그린)것부터 검사.
    for (let i = placementSprites.length - 1; i >= 0; i -= 1) {
      const sprite = placementSprites[i]
      const left = sprite.x
      const top = sprite.y
      if (x >= left && x < left + sprite.width && y >= top && y < top + sprite.height) {
        const id = typeof sprite.label === 'string' ? sprite.label : ''
        if (id) {
          removePlacement(sceneId, id)
          refreshPlacements()
        }
        return
      }
    }
  }
  const handleStagePointerDown = (event: FederatedPointerEvent): void => {
    if (placementMode === 'off') {
      return
    }
    const local = world.toLocal(event.global) // 카메라 줌/스크롤이 반영된 맵 픽셀 좌표.
    const col = Math.floor(local.x / map.tileWidth)
    const row = Math.floor(local.y / map.tileHeight)
    if (col < 0 || col >= map.width || row < 0 || row >= map.height) {
      return
    }
    // 우클릭(button 2)은 모드와 무관하게 클릭 지점의 배치를 지운다(배치 중에도 바로 삭제).
    // NPC를 먼저 맞혀보고(기능 엔티티), 없으면 타일/오브젝트 배치를 지운다.
    if (event.button === 2) {
      if (eraseNpcAtPoint(local.x, local.y)) {
        return
      }
      eraseAtPoint(local.x, local.y)
      return
    }
    if (placementMode === 'place' && placementTemplate) {
      if (placementTemplate.kind === 'npc') {
        // 이동 차단 캐릭터(플레이어/다른 NPC/몬스터)와 겹치는 칸에 차단 NPC를 놓으면 서로 갇혀
        // 빠져나올 수 없으므로 막는다(특히 플레이어 자기 칸에 놓으면 소프트락).
        const targetRect: CollisionRect = { x: col, y: row, width: 1, height: 1 }
        const overlapsBlocker = getBlockingCollisionRects('').some((rect) =>
          doCollisionRectsIntersect(targetRect, rect)
        )
        if (overlapsBlocker) {
          console.warn('[npc] 다른 캐릭터(플레이어 포함)와 겹치는 칸에는 NPC를 놓을 수 없습니다.')
          return
        }
        // NPC는 기능 엔티티 — 저장 후 게임의 CharacterState로 스폰한다(저장소엔 NpcTemplate 필드만).
        addNpc(
          sceneId,
          {
            appearanceType: placementTemplate.appearanceType,
            name: placementTemplate.name,
            dialogueLines: placementTemplate.dialogueLines
          },
          col,
          row
        )
        refreshNpcs()
      } else {
        addPlacement(sceneId, placementTemplate, col, row)
        refreshPlacements()
      }
    } else if (placementMode === 'erase') {
      if (eraseNpcAtPoint(local.x, local.y)) {
        return
      }
      eraseAtPoint(local.x, local.y)
    }
  }
  app.stage.on('pointerdown', handleStagePointerDown)
  // 배치 모드에서 우클릭 시 브라우저 컨텍스트 메뉴를 막아 '우클릭 삭제'가 정상 동작하게 한다.
  const handleCanvasContextMenu = (event: MouseEvent): void => {
    if (placementMode !== 'off') {
      event.preventDefault()
    }
  }
  app.canvas.addEventListener('contextmenu', handleCanvasContextMenu)

  // 저장된 배치/NPC를 부팅 시 반영한다(맵별).
  refreshPlacements()
  refreshNpcs()

  const destroy = () => {
    if (isDestroyed) {
      return
    }

    isDestroyed = true
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
    window.removeEventListener('blur', handleWindowBlur)
    window.removeEventListener('resize', handleWindowResize)
    viewportElement.removeEventListener('wheel', handleViewportWheel)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    app.stage.off('pointerdown', handleStagePointerDown)
    app.canvas.removeEventListener('contextmenu', handleCanvasContextMenu)
    app.ticker.remove(updateCharacters)
    app.ticker.remove(animateDecorationLights)
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
    decorationRevision++
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
    setPlacementMode: (mode: 'off' | 'place' | 'erase') => {
      placementMode = mode
    },
    setPlacementTemplate: (
      template: PlacementTemplate | NpcWireTemplate | null
    ) => {
      placementTemplate = template
    },
    refreshPlacements,
    refreshNpcs,
    spawnNpcNearPlayer
  }
}

const createMessagePanelTexture = (): Texture => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Could not create canvas context for message panel')
  }

  canvas.width = 32
  canvas.height = 32
  context.imageSmoothingEnabled = false
  context.clearRect(0, 0, canvas.width, canvas.height)

  context.fillStyle = '#c9a271'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#fffaf0'
  context.fillRect(1, 1, canvas.width - 2, canvas.height - 2)
  context.fillStyle = '#f4e5c8'
  context.fillRect(1, 1, canvas.width - 2, 1)
  context.fillRect(1, 1, 1, canvas.height - 2)
  context.fillStyle = '#a98256'
  context.fillRect(1, canvas.height - 2, canvas.width - 2, 1)
  context.fillRect(canvas.width - 2, 1, 1, canvas.height - 2)
  context.fillStyle = '#fffdf8'
  context.fillRect(2, 2, canvas.width - 4, canvas.height - 4)
  context.fillStyle = '#ecd8b8'
  context.fillRect(2, 2, canvas.width - 4, 1)
  context.fillRect(2, 2, 1, canvas.height - 4)
  context.fillStyle = '#d9c29a'
  context.fillRect(2, canvas.height - 3, canvas.width - 4, 1)
  context.fillRect(canvas.width - 3, 2, 1, canvas.height - 4)

  const texture = Texture.from(canvas)

  texture.source.scaleMode = 'nearest'
  texture.source.addressMode = 'clamp-to-edge'

  return texture
}

const createFrameTexturesFromGrid = ({
  imageTexture,
  frameWidth,
  frameHeight,
  columns,
  rows
}: {
  imageTexture: Texture
  frameWidth: number
  frameHeight: number
  columns: number
  rows: number
}): Texture[] => {
  // 시트가 기대보다 작으면(예: 다운로드 안 된 LFS 플레이스홀더) 던져서 렌더러를 죽이지 않고,
  // 같은 프레임 수만큼 원본(플레이스홀더) 텍스처를 그대로 반환해 효과만 비어 보이게 한다.
  if (
    imageTexture.source.pixelWidth < frameWidth * columns ||
    imageTexture.source.pixelHeight < frameHeight * rows
  ) {
    return Array.from({ length: columns * rows }, () => imageTexture)
  }

  return Array.from({ length: columns * rows }, (_, index) => {
    const columnIndex = index % columns
    const rowIndex = Math.floor(index / columns)

    return new Texture({
      source: imageTexture.source,
      frame: new Rectangle(
        columnIndex * frameWidth,
        rowIndex * frameHeight,
        frameWidth,
        frameHeight
      ),
      orig: new Rectangle(0, 0, frameWidth, frameHeight)
    })
  })
}

const loadSlashVfxTextures = async (): Promise<SlashVfxRenderResources> => {
  const textures = await Promise.all(
    WHITE_SLASH_WIDE_FRAME_URLS.map((frameUrl) =>
      loadTextureSafe(frameUrl)
    )
  )

  textures.forEach((texture) => {
    texture.source.scaleMode = 'nearest'
  })

  return {
    horizontalTextures: textures,
    verticalTextures: textures
  }
}

const loadProtectVfxTextures = async (): Promise<ProtectVfxRenderResources> => {
  const imageTexture = await loadTextureSafe(PROTECT_VFX_FRAME_IMAGE_URL)

  imageTexture.source.scaleMode = 'nearest'
  imageTexture.source.addressMode = 'clamp-to-edge'

  return {
    shieldTextures: createFrameTexturesFromGrid({
      imageTexture,
      frameWidth: PROTECT_VFX_FRAME_WIDTH,
      frameHeight: PROTECT_VFX_FRAME_HEIGHT,
      columns: PROTECT_VFX_FRAME_COLUMNS,
      rows: PROTECT_VFX_FRAME_ROWS
    })
  }
}

const ensureMessageFontsLoaded = async (): Promise<void> => {
  if (messageFontsReadyPromise) {
    return messageFontsReadyPromise
  }

  if (!document.fonts) {
    return
  }

  // 폰트는 장식용이라 로드 실패(예: @font-face url 404)가 렌더러 전체를 죽이면 안 된다.
  // 실패하면 기본 폰트로 조용히 폴백한다.
  messageFontsReadyPromise = Promise.all([
    document.fonts.load('400 14px "Jersey 25"'),
    document.fonts.load('400 14px "NeoDunggeunmo"')
  ])
    .then(() => undefined)
    .catch(() => undefined)

  return messageFontsReadyPromise
}

const loadTilesetRenderResources = async (
  tileset: ParsedTiledTileset,
  imageUrls: Record<string, string>,
  scaleMode?: 'nearest' | 'linear'
): Promise<TilesetRenderResources> => {
  const imageUrl = imageUrls[tileset.image.source]

  if (!imageUrl) {
    throw new Error(`Missing image URL for ${tileset.image.source}`)
  }

  const imageTexture = await loadTextureSafe(imageUrl)

  if (scaleMode) {
    imageTexture.source.scaleMode = scaleMode
  }
  imageTexture.source.addressMode = 'clamp-to-edge'
  const tileTextures = Array.from(
    { length: tileset.tileCount },
    (_, localId) => createTileTexture(imageTexture, tileset, localId)
  )

  return {
    imageTexture,
    tileTextures
  }
}

const clampScrollOffset = (value: number, max: number): number =>
  Math.max(0, Math.min(Math.round(value), Math.max(0, max)))

const clampCameraZoom = (value: number): number =>
  Math.max(CAMERA_MIN_ZOOM, Math.min(value, CAMERA_MAX_ZOOM))


const createGrassTileLookup = (map: ParsedTiledMap): Set<string> => {
  const groundLayer = map.layers.find(
    (layer) => layer.name.toLowerCase() === GROUND_LAYER_NAME
  )
  const grassTileKeys = new Set<string>()

  if (!groundLayer) {
    return grassTileKeys
  }

  for (const tile of groundLayer.tiles) {
    const tileset = resolveTilesetForTile(tile, map.tilesets)
    const tileType = tileset.tileTypes[tile.localId]

    if (tileType && GRASS_TILE_TYPES.has(tileType)) {
      grassTileKeys.add(createTileLookupKey(tile.x, tile.y))
    }
  }

  return grassTileKeys
}

const isCharacterOnGrass = (
  character: CharacterState,
  grassTiles: Set<string>
): boolean => {
  const tileX = Math.floor(
    character.position.x + character.collisionSize.width / 2
  )
  const tileY = Math.floor(
    character.position.y + character.collisionSize.height / 2
  )

  return grassTiles.has(createTileLookupKey(tileX, tileY))
}

const createTileLookupKey = (tileX: number, tileY: number): string =>
  `${tileX},${tileY}`

const createCollisionRectFromCharacter = (
  character: CharacterState
): CollisionRect => ({
  x: character.position.x,
  y: character.position.y,
  width: character.collisionSize.width,
  height: character.collisionSize.height
})

const createCollisionRectFromPortal = (portal: MapPortal): CollisionRect => ({
  x: portal.position.x,
  y: portal.position.y,
  width: portal.collisionSize.width,
  height: portal.collisionSize.height
})

const getTileDepthSortValue = (tileY: number, tileHeight: number): number =>
  (tileY + 1) * tileHeight

const getCharacterDepthSortValue = (
  characterY: number,
  characterPixelHeight: number,
  tileHeight: number
): number => characterY * tileHeight + characterPixelHeight

const isPlayerRollModifierCode = (code: string): boolean =>
  code === 'ShiftLeft' || code === 'ShiftRight'

const getFacingFromRollVector = (
  vector: PlayerRollVector,
  fallbackFacing: CharacterMoveDirection
): CharacterMoveDirection => {
  if (Math.abs(vector.x) >= Math.abs(vector.y) && vector.x !== 0) {
    return vector.x > 0 ? 'right' : 'left'
  }

  if (vector.y !== 0) {
    return vector.y > 0 ? 'down' : 'up'
  }

  return fallbackFacing
}

const resolveCharacterTexture = (
  appearanceType: string,
  tileTextures: Texture[],
  tileset: ParsedTiledTileset,
  fallbackTilesets: ParsedTiledTileset[],
  fallbackTileTextureResources: Map<string, TilesetRenderResources>,
  mapTileWidth: number
): ResolvedCharacterAppearanceTexture => {
  const characterTexture = resolveTextureByAppearanceType(
    appearanceType,
    tileTextures,
    tileset
  )

  if (characterTexture) {
    return {
      texture: characterTexture,
      renderScale: mapTileWidth / tileset.tileWidth
    }
  }

  for (const fallbackTileset of fallbackTilesets) {
    const fallbackTileTextureResource = fallbackTileTextureResources.get(
      fallbackTileset.source
    )

    if (!fallbackTileTextureResource) {
      throw new Error(
        `Missing render resources for tileset ${fallbackTileset.source}`
      )
    }

    const fallbackTexture = resolveTextureByAppearanceType(
      appearanceType,
      fallbackTileTextureResource.tileTextures,
      fallbackTileset
    )

    if (fallbackTexture) {
      return {
        texture: fallbackTexture,
        renderScale: mapTileWidth / fallbackTileset.tileWidth
      }
    }
  }

  throw new Error(`Could not resolve tileset tile type ${appearanceType}`)
}

const resolveTextureByAppearanceType = (
  appearanceType: string,
  tileTextures: Texture[],
  tileset: ParsedTiledTileset
): Texture | undefined => {
  try {
    const localId = resolveTilesetLocalIdByType(tileset, appearanceType)

    return tileTextures[localId]
  } catch {
    return undefined
  }
}

const resolveTilesetLocalIdByType = (
  tileset: ParsedTiledTileset,
  tileType: string
): number => {
  const entry = Object.entries(tileset.tileTypes).find(
    ([, candidateType]) => candidateType === tileType
  )

  if (!entry) {
    throw new Error(`Could not resolve tileset tile type ${tileType}`)
  }

  return Number(entry[0])
}

const STACKABLE_QUEST_REWARD_ITEM_IDS = new Set([
  'health-potion',
  'mana-potion',
  'crystal-ore'
])

// 장비/포션 카탈로그에 없는 재료 아이템의 표시 이름.
const MATERIAL_ITEM_LABEL_BY_ID: Record<string, string> = {
  'crystal-ore': '수정 광석'
}

const addQuestItemRewardsToInventory = (
  inventory: PlayerInventory,
  itemRewards: QuestItemReward[]
): PlayerInventory => {
  let nextInventory = inventory

  for (const itemReward of itemRewards) {
    nextInventory = addQuestItemRewardToInventory(nextInventory, itemReward)
  }

  return nextInventory
}

const addQuestItemRewardToInventory = (
  inventory: PlayerInventory,
  itemReward: QuestItemReward
): PlayerInventory => {
  if (STACKABLE_QUEST_REWARD_ITEM_IDS.has(itemReward.id)) {
    const stackSlotIndex = inventory.slots.findIndex(
      (item) => item?.id === itemReward.id
    )

    if (stackSlotIndex >= 0) {
      const slots = [...inventory.slots]
      const stack = slots[stackSlotIndex] as PlayerInventoryItem

      slots[stackSlotIndex] = {
        ...stack,
        quantity: stack.quantity + itemReward.quantity
      }

      return {
        ...inventory,
        slots
      }
    }

    return addQuestRewardAsNewInventorySlot(inventory, itemReward)
  }

  return addQuestRewardAsNewInventorySlots(inventory, itemReward)
}

const addQuestRewardAsNewInventorySlot = (
  inventory: PlayerInventory,
  itemReward: QuestItemReward
): PlayerInventory => {
  const emptySlotIndex = inventory.slots.findIndex((item) => item === undefined)

  if (emptySlotIndex < 0) {
    return inventory
  }

  const slots = [...inventory.slots]

  slots[emptySlotIndex] = {
    id: itemReward.id,
    label: itemReward.label,
    quantity: itemReward.quantity
  }

  return {
    ...inventory,
    slots
  }
}

const addQuestRewardAsNewInventorySlots = (
  inventory: PlayerInventory,
  itemReward: QuestItemReward
): PlayerInventory => {
  let nextInventory = inventory

  for (let quantity = 0; quantity < itemReward.quantity; quantity += 1) {
    const emptySlotIndex = nextInventory.slots.findIndex(
      (item) => item === undefined
    )

    if (emptySlotIndex < 0) {
      return nextInventory
    }

    const slots = [...nextInventory.slots]

    slots[emptySlotIndex] = {
      id: itemReward.id,
      label: itemReward.label,
      quantity: 1
    }
    nextInventory = {
      ...nextInventory,
      slots
    }
  }

  return nextInventory
}

const createDepthSortedTileSprite = (
  texture: Texture,
  tile: ParsedTiledTile,
  tileWidth: number,
  tileHeight: number
): Sprite => {
  if (hasTileTransform(tile)) {
    return createTransformedTileSprite(texture, tile, tileWidth, tileHeight)
  }

  const sprite = new Sprite(texture)

  sprite.position.set(tile.x * tileWidth, tile.y * tileHeight)
  sprite.roundPixels = true

  return sprite
}

const createTransformedTileSprite = (
  texture: Texture,
  tile: ParsedTiledTile,
  tileWidth: number,
  tileHeight: number
): Sprite => {
  const sprite = new Sprite(texture)
  const transform = getSpriteTransformForTile(tile)

  sprite.anchor.set(0.5)
  sprite.position.set(
    tile.x * tileWidth + tileWidth / 2,
    tile.y * tileHeight + tileHeight / 2
  )
  sprite.rotation = transform.rotation
  sprite.scale.set(transform.scaleX, transform.scaleY)
  sprite.roundPixels = true

  return sprite
}
