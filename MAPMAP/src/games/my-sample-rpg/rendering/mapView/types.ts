import {
  Container,
  Graphics,
  NineSliceSprite,
  Sprite,
  Text,
  Texture
} from 'pixi.js'
import { type LpcCharacterSheets, type LpcPlayerLayerSlot } from '../lpcCharacterSprites'
import type { CharacterMoveDirection, CharacterState } from '../../characterState'
import type { CharacterControllerRuntime } from '../../createCharacterControllerRuntime'
import { type PlayerEquipment, type PlayerEquipmentSlotId } from '../../playerEquipment'
import { type PlayerInventory } from '../../playerInventory'
import type { PlayerProfile } from '../../playerProfile'
import { type PlayerQuickslots } from '../../playerQuickslots'
import { type PlayerSkillSlots } from '../../playerSkillSlots'
import { type PlayerControlBindings } from '../../playerControls'
import { type QuestLogState } from '../../questLog'
import type { ParsedTiledMap, ParsedTiledTileset } from '../../tiled/parseTiledMap'
import { type AudioSettings } from '../createPauseMenuOverlay'

export type CreatePixiTiledMapViewInput = {
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
  // 2장 갈대골 약초꾼 오디의 상점 진열(해독 향 등)
  herbalistInventory: PlayerInventory
  // 해독 향 면역이 끝나는 시각(Date.now 기준) — 씬을 넘어 이어지게 게임 상태가 들고 있다
  getPoisonFogImmuneUntil: () => number
  onPoisonFogImmuneUntilChange: (immuneUntil: number) => void
  // 3장 눈보라 면역(생강차) — 독안개처럼 씬을 넘어 이어진다
  getColdImmuneUntil: () => number
  onColdImmuneUntilChange: (immuneUntil: number) => void
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
  // 귀환 표지석(waystones.ts): 발견한 표지석 목록과, 처음 손을 댔을 때 알림
  getDiscoveredWaystoneIds: () => readonly string[]
  onWaystoneDiscovered: (waystoneId: string) => void
  onMerchantInventoryChange: (nextInventory: PlayerInventory) => void
  onPotionMerchantInventoryChange: (nextInventory: PlayerInventory) => void
  onHerbalistInventoryChange: (nextInventory: PlayerInventory) => void
  audioSettings: AudioSettings
  onAudioSettingsChange: (nextAudioSettings: AudioSettings) => void
  onRequestSceneChange: (request: SceneTransitionRequest) => void
}

export type ApplyEventDraftInput = {
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

export type SlashVfxRenderResources = {
  horizontalTextures: Texture[]
  verticalTextures: Texture[]
}

export type ProtectVfxRenderResources = {
  shieldTextures: Texture[]
}

export type ResolvedCharacterAppearanceTexture = {
  texture: Texture
  renderScale: number
}

export type ActiveCharacterMessage = {
  container: Container
  panel: NineSliceSprite
  text: Text
  expiresAt: number
}

export type ActiveCharacterDamageText = {
  container: Container
  text: Text
  startedAt: number
  durationMilliseconds: number
  expiresAt: number
}

export type MonsterGoldDrop = {
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

export type MonsterEquipmentDrop = {
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

export type RenderedCharacterNode = {
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

export type RenderedPortalNode = {
  container: Container
  sprite: Sprite
}

export type MonsterPigAnimationMode = 'idle' | 'run' | 'hit' | 'attack'

export type MonsterPigBehaviorState = {
  isAggroed: boolean
  nextAttackAtMilliseconds: number
  attackUntilMilliseconds: number
  hitReactionUntilMilliseconds: number
}

export type PlayerHitReactionState = {
  directionX: number
  directionY: number
  startedAtMilliseconds: number
  expiresAtMilliseconds: number
}

export type PlayerRollInputState = {
  isModifierPressed: boolean
}

export type PlayerVisualEquipmentSlotId = Extract<PlayerEquipmentSlotId, 'armor' | 'hat'>

export type PlayerEquipmentAppearanceConfig = {
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

export type PlayerWeaponAppearanceConfig = {
  imageUrl: string
  worldScale: number
  idleOffsetX: number
  idleOffsetY: number
}
