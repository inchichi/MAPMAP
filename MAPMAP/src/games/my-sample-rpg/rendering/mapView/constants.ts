import { TextStyle } from 'pixi.js'
import { PLAYER_EQUIPMENT_ITEM_DEFINITIONS } from '../../playerEquipment'
import { type CollisionRect } from '../characterCollision'
import { type TileTextureFrameSource } from '../tiledMapRenderResources'
import { POTION_ITEM_DEFINITIONS } from '../../potionShop'
import { type PlayerEquipmentAppearanceConfig, type PlayerWeaponAppearanceConfig } from './types'

export const DEPTH_SORTED_LAYER_NAME = 'object'
export const TINY_DUNGEON_TILESET_IMAGE_URL = new URL(
  '../../assets/tilesets/tiny-dungeon-16.png',
  import.meta.url
).href
export const MONSTER_EQUIPMENT_DROP_IMAGE_URL_BY_DROP_ID: Record<string, string> = {
  'iron-sword_drop': new URL(
    '../../assets/weapons/lpc/weapon-icon-iron-sword.png',
    import.meta.url
  ).href,
  'battle-axe_drop': new URL(
    '../../assets/weapons/lpc/weapon-icon-battle-axe.png',
    import.meta.url
  ).href,
  'long-spear_drop': new URL(
    '../../assets/weapons/lpc/weapon-icon-long-spear.png',
    import.meta.url
  ).href,
  'quick-dagger_drop': new URL(
    '../../assets/weapons/lpc/weapon-icon-quick-dagger.png',
    import.meta.url
  ).href,
  'spiked-mace_drop': new URL(
    '../../assets/weapons/lpc/weapon-icon-spiked-mace.png',
    import.meta.url
  ).href,
  'magic-staff_drop': new URL(
    '../../assets/weapons/lpc/weapon-icon-magic-staff.png',
    import.meta.url
  ).href,
  Leather_Armor_drop: new URL(
    '../../assets/characters/lpc/gear-icon-Leather_Armor.png',
    import.meta.url
  ).href,
  Leather_Helmet_drop: new URL(
    '../../assets/characters/lpc/gear-icon-Leather_Helmet.png',
    import.meta.url
  ).href,
  Chain_Armor_drop: new URL(
    '../../assets/characters/lpc/gear-icon-Chain_Armor.png',
    import.meta.url
  ).href,
  Chain_Helmet_drop: new URL(
    '../../assets/characters/lpc/gear-icon-Chain_Helmet.png',
    import.meta.url
  ).href,
  Iron_Armor_drop: new URL(
    '../../assets/characters/lpc/gear-icon-Iron_Armor.png',
    import.meta.url
  ).href,
  Iron_Helmet_drop: new URL(
    '../../assets/characters/lpc/gear-icon-Iron_Helmet.png',
    import.meta.url
  ).href
}
export const MESSAGE_PANEL_BORDER_SIZE = 8
export const MESSAGE_PANEL_PADDING_X = 12
export const MESSAGE_PANEL_PADDING_Y = 8
export const MESSAGE_PANEL_MIN_WIDTH = 64
export const MESSAGE_PANEL_MIN_HEIGHT = 28
export const MESSAGE_TEXT_MAX_WIDTH = 188
export const MESSAGE_OFFSET_Y = 10
export const MESSAGE_TEXT_STYLE = new TextStyle({
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
export const DAMAGE_TEXT_STYLE = new TextStyle({
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
export const EVADE_TEXT_STYLE = new TextStyle({
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
export const LEVEL_UP_TEXT_STYLE = new TextStyle({
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
export const BLACKSMITH_SHOP_NPC_ID = 'blacksmith'
export const POTION_SHOP_NPC_ID = 'potion_merchant'
// 물약 상점을 여는 NPC: 마을 물약상인 + 사냥터 야영지 떠돌이 상인
export const POTION_SHOP_NPC_IDS = new Set([POTION_SHOP_NPC_ID, 'camp_merchant'])
// 2장 갈대골 약초꾼 — 상점 열기 퀘스트 목표의 shopId 는 'herbalist'
// 3장 서리목 약재상 이르마도 같은 약초 상점(재고 공유)을 연다 — 씬에 있는 쪽의 이름·초상화를 쓴다.
export const HERBALIST_SHOP_NPC_IDS: ReadonlySet<string> = new Set(['odi', 'irma'])
export const HERBALIST_SHOP_ID = 'herbalist'
// tiny-dungeon-16 의 두건 쓴 약초꾼 얼굴(상점 초상화)

// 시나리오 reward 노드는 item_id 만 담는다. 인벤토리 표시는 라벨이 필요하므로
// 기존 정의(포션·장비)에서 해석하고, 모르는 id 는 id 그대로 노출한다.
export const SCENARIO_REWARD_ITEM_LABEL_BY_ID: Record<string, string> = Object.fromEntries([
  ...POTION_ITEM_DEFINITIONS.map((item) => [item.id, item.label] as const),
  ...PLAYER_EQUIPMENT_ITEM_DEFINITIONS.map((item) => [item.id, item.label] as const)
])

export const SIGN_POST_APPEARANCE_TYPE = 'sign_inn'
export const GROUND_LAYER_NAME = 'ground'
export const GRASS_TILE_TYPES = new Set(['garden_round_mid_01'])
export const GAME_VIEWPORT_WIDTH = 960
export const GAME_VIEWPORT_HEIGHT = 540
export const CAMERA_DEFAULT_ZOOM = 1.1
export const CAMERA_MIN_ZOOM = 0.8
export const CAMERA_MAX_ZOOM = 2
export const CAMERA_ZOOM_WHEEL_SPEED = 0.0015
// 일반 몬스터는 쓰러지고 이만큼 뒤에 다시 생긴다(종류 공통).
export const MONSTER_RESPAWN_DELAY_MILLISECONDS = 8000
// 보스 몬스터: TMX 오브젝트 이름이 '-보스'로 끝난다(예: 말캉이-보스).
export const isBossCharacterId = (characterId: string): boolean => characterId.endsWith('-보스')
// 퀘스트에 아직 필요한 보스는 영영 사라지지 않고 이만큼 뒤에 다시 생긴다.
export const BOSS_RETRY_RESPAWN_DELAY_MILLISECONDS = 30000
export const MONSTER_CONTACT_DAMAGE_COOLDOWN_MILLISECONDS = 900
export const PLAYER_ATTACK_PROBE_DISTANCE_IN_TILES = 1.2
export const DAMAGE_TEXT_FLOAT_DISTANCE = 16
export const DAMAGE_TEXT_DURATION_MILLISECONDS = 1000
export const EVADE_TEXT_DURATION_MILLISECONDS = 700
// 보스 외침(기술 예고·분노)은 조금 오래 띄운다
export const BOSS_SHOUT_DURATION_MILLISECONDS = 1100
export const DAMAGE_TEXT_OFFSET_Y = 8
export const MONSTER_CONTACT_DAMAGE_TOUCH_TOLERANCE_TILES = 0.14
export const MONSTER_ATTACK_RANGE_TOUCH_TOLERANCE_TILES = 0.14
export const PLAYER_RESPAWN_DELAY_MILLISECONDS = 3000
export const PLAYER_HIT_REACTION_DURATION_MILLISECONDS = 180
export const PLAYER_DAMAGE_INVULNERABILITY_MILLISECONDS = 600
export const PLAYER_HIT_REACTION_MAX_OFFSET_PIXELS = 6
export const PLAYER_PROTECT_SKILL_COOLDOWN_MILLISECONDS = 4600
// 떨어진 돈: 동굴 바닥 금화와 같은 LPC 금화 더미 타일(town-32 gid 1109~1112, 동전 몇 개 → 쌓인 더미).
export const MONSTER_GOLD_DROP_PILE_GIDS: readonly number[] = [1109, 1110, 1111, 1112]
// 금액이 이 값 이상이면 한 단계 큰 더미 그림
export const MONSTER_GOLD_DROP_PILE_THRESHOLDS: readonly number[] = [0, 20, 45, 90]
export const MONSTER_GOLD_DROP_ICON_RADIUS = 8
// 튀어나오는 연출: 위로 솟았다 떨어지며 두 번 튄다
export const MONSTER_GOLD_DROP_POP_MILLISECONDS = 520
export const MONSTER_GOLD_DROP_POP_HEIGHT_PIXELS = 18
export const MONSTER_GOLD_DROP_AMOUNT_TEXT_STYLE = new TextStyle({
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
export const MONSTER_GOLD_DROP_PICKUP_WIDTH = 14
export const MONSTER_GOLD_DROP_PICKUP_HEIGHT = 14
export const COIN_PILE_PICKUP_WIDTH = 20
export const COIN_PILE_PICKUP_HEIGHT = 20
export const MONSTER_EQUIPMENT_DROP_RENDER_SIZE = 24
export const MONSTER_EQUIPMENT_DROP_PICKUP_WIDTH = 20
export const MONSTER_EQUIPMENT_DROP_PICKUP_HEIGHT = 20
export const MONSTER_LEVEL_BADGE_STYLE = new TextStyle({
  align: 'center',
  fill: 0xf4e7c5,
  fontFamily: '"Jersey 25", NeoDunggeunmo, monospace',
  fontSize: 12,
  stroke: {
    color: 0x2e2313,
    width: 3
  }
})
export const PLAYER_NAME_BADGE_STYLE = new TextStyle({
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
export const PLAYER_HEALTH_BAR_WIDTH = 38
export const PLAYER_HEALTH_BAR_HEIGHT = 5
export const PLAYER_HEALTH_BAR_TRACK_COLOR = 0x2e2313
export const PLAYER_HEALTH_BAR_FILL_COLOR = 0xd06b5d
export const PLAYER_HEALTH_BAR_BORDER_COLOR = 0xf4e7c5
export const PLAYER_HEALTH_BAR_GAP = 5
export const PLAYER_MANA_BAR_WIDTH = 38
export const PLAYER_MANA_BAR_HEIGHT = 5
export const PLAYER_MANA_BAR_TRACK_COLOR = 0x2e2313
export const PLAYER_MANA_BAR_FILL_COLOR = 0x5b86d6
export const PLAYER_MANA_BAR_BORDER_COLOR = 0xf4e7c5
export const PLAYER_MANA_BAR_GAP = 2
export const SIGN_POST_LABEL_STYLE = new TextStyle({
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
export const MONSTER_HEALTH_BAR_WIDTH = 34
export const MONSTER_HEALTH_BAR_HEIGHT = 5
export const MONSTER_HEALTH_BAR_TRACK_COLOR = 0x2e2313
export const MONSTER_HEALTH_BAR_FILL_COLOR = 0x7dc96d
export const MONSTER_HEALTH_BAR_BORDER_COLOR = 0xf4e7c5
export const MONSTER_HEALTH_BAR_GAP = 4
export const PLAYER_WEAPON_TILE_LOCAL_ID = 117
export const PLAYER_WEAPON_TILE_FRAME_SOURCE: TileTextureFrameSource = {
  columns: 12,
  margin: 0,
  spacing: 0,
  tileWidth: 16,
  tileHeight: 16
}
export const WHITE_SLASH_WIDE_FRAME_URLS = [
  new URL(
    '../../assets/vfx/Sword Slashes/White Slash Wide/File1.png',
    import.meta.url
  ).href,
  new URL(
    '../../assets/vfx/Sword Slashes/White Slash Wide/File2.png',
    import.meta.url
  ).href,
  new URL(
    '../../assets/vfx/Sword Slashes/White Slash Wide/File3.png',
    import.meta.url
  ).href,
  new URL(
    '../../assets/vfx/Sword Slashes/White Slash Wide/File4.png',
    import.meta.url
  ).href,
  new URL(
    '../../assets/vfx/Sword Slashes/White Slash Wide/File5.png',
    import.meta.url
  ).href,
  new URL(
    '../../assets/vfx/Sword Slashes/White Slash Wide/File6.png',
    import.meta.url
  ).href
]
export const WHITE_SLASH_WIDE_FRAME_BOUNDS: CollisionRect[] = [
  { x: 63, y: 25, width: 465, height: 345 },
  { x: 75, y: 165, width: 463, height: 196 },
  { x: 33, y: 285, width: 373, height: 87 },
  { x: 11, y: 186, width: 119, height: 181 },
  { x: 11, y: 103, width: 41, height: 212 },
  { x: 29, y: 63, width: 23, height: 55 }
]
export const PROTECT_VFX_FRAME_IMAGE_URL = new URL(
  '../../assets/Pipoya VFX HEXShield/192x192/pipo-btleffect207_192.png',
  import.meta.url
).href
export const PROTECT_VFX_FRAME_WIDTH = 192
export const PROTECT_VFX_FRAME_HEIGHT = 192
export const PROTECT_VFX_FRAME_COLUMNS = 5
export const PROTECT_VFX_FRAME_ROWS = 4
export const PROTECT_VFX_ANIMATION_SPEED = 0.35
export const PROTECT_VFX_SCALE = 0.52
export const SLASH_VFX_HIT_PADDING_PIXELS = 2
export const PLAYER_WEAPON_WORLD_SCALE = 1.35
export const PLAYER_ATTACK_TRAIL_PROGRESS_STEP = 0.12
export const PLAYER_ATTACK_TRAIL_ALPHA = [0.42, 0.28, 0.18, 0.1]
export const PLAYER_ATTACK_TRAIL_SPRITE_COUNT = PLAYER_ATTACK_TRAIL_ALPHA.length
export const PLAYER_ATTACK_SWING_X_OFFSET = 4
export const PLAYER_ATTACK_LIFT_Y_OFFSET = 3
export const PLAYER_NAME_BADGE_FOOT_OFFSET = 6
export const PLAYER_STATUS_STACK_CLEARANCE = 6
export const PLAYER_ATTACK_ROTATION_OFFSET = 1.15
export const PLAYER_ATTACK_SCALE_BOOST = 0.06
export const PLAYER_ATTACK_SLASH_EFFECT_SCALE_X = 0.23
export const PLAYER_ATTACK_SLASH_EFFECT_SCALE_Y = 0.23
export const PLAYER_ATTACK_SLASH_EFFECT_ANIMATION_SPEED = 0.6
export const PLAYER_WEAPON_PLACEMENT_RIGHT = {
  x: 23,
  y: 21,
  rotation: 0.75
}
export const PLAYER_WEAPON_PLACEMENT_LEFT = {
  x: 9,
  y: 21,
  rotation: -0.75
}
export const PLAYER_WEAPON_APPEARANCE_CONFIG_BY_ITEM_ID: Record<
  string,
  PlayerWeaponAppearanceConfig
> = {
  'iron-sword': {
    imageUrl: new URL('../../assets/weapons/weapon-sword.png', import.meta.url).href,
    worldScale: 0.085,
    idleOffsetX: -3,
    idleOffsetY: 2
  },
  'battle-axe': {
    imageUrl: new URL('../../assets/weapons/weapon-axe.png', import.meta.url).href,
    worldScale: 0.085,
    idleOffsetX: -5,
    idleOffsetY: 4
  },
  'long-spear': {
    imageUrl: new URL('../../assets/weapons/weapon-spear.png', import.meta.url).href,
    worldScale: 0.085,
    idleOffsetX: -2,
    idleOffsetY: 3
  },
  'quick-dagger': {
    imageUrl: new URL('../../assets/weapons/weapon-dagger.png', import.meta.url).href,
    worldScale: 0.085,
    idleOffsetX: -2,
    idleOffsetY: 1
  },
  'spiked-mace': {
    imageUrl: new URL('../../assets/weapons/weapon-mace.png', import.meta.url).href,
    worldScale: 0.085,
    idleOffsetX: -4,
    idleOffsetY: 4
  },
  'magic-staff': {
    imageUrl: new URL('../../assets/weapons/weapon-staff.png', import.meta.url).href,
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
export const PLAYER_ARMOR_EQUIPMENT_CONFIG = {
  width: 24,
  height: 9,
  position: {
    x: 16,
    y: 24
  },
  zIndex: 12
}
export const PLAYER_HELMET_EQUIPMENT_CONFIG = {
  width: 22,
  height: 15,
  position: {
    x: 16,
    y: 9
  },
  zIndex: 13
}
export const PLAYER_EQUIPMENT_APPEARANCE_CONFIG_BY_ITEM_ID: Record<
  string,
  PlayerEquipmentAppearanceConfig
> = {
  Leather_Armor: {
    slotId: 'armor',
    imageUrl: new URL('../../assets/armor/Leather_Armor.png', import.meta.url).href,
    ...PLAYER_ARMOR_EQUIPMENT_CONFIG
  },
  Leather_Helmet: {
    slotId: 'hat',
    imageUrl: new URL('../../assets/armor/Leather_Helmet.png', import.meta.url).href,
    ...PLAYER_HELMET_EQUIPMENT_CONFIG
  },
  Chain_Armor: {
    slotId: 'armor',
    imageUrl: new URL('../../assets/armor/Chain_Armor.png', import.meta.url).href,
    ...PLAYER_ARMOR_EQUIPMENT_CONFIG
  },
  Chain_Helmet: {
    slotId: 'hat',
    imageUrl: new URL('../../assets/armor/Chain_Helmet.png', import.meta.url).href,
    ...PLAYER_HELMET_EQUIPMENT_CONFIG
  },
  Iron_Armor: {
    slotId: 'armor',
    imageUrl: new URL('../../assets/armor/Iron_Armor.png', import.meta.url).href,
    ...PLAYER_ARMOR_EQUIPMENT_CONFIG
  },
  Iron_Helmet: {
    slotId: 'hat',
    imageUrl: new URL('../../assets/armor/Iron_Helmet.png', import.meta.url).href,
    ...PLAYER_HELMET_EQUIPMENT_CONFIG
  }
}
export const PORTAL_INSIDE_IMAGE_URL = new URL(
  '../../assets/tilesets/portal_inside.png',
  import.meta.url
).href
export const PORTAL_INSIDE_WORLD_SCALE = 0.08
export const SCENE_INTRO_VISIBLE_DURATION_MILLISECONDS = 3000
export const PLAYER_ATTACK_DURATION_MILLISECONDS = 320
export const PLAYER_ATTACK_COOLDOWN_MILLISECONDS = 300
export const QUEST_DIALOGUE_DURATION_MILLISECONDS = 3600
export const QUEST_START_TEXT = '퀘스트 시작!'
export const QUEST_OBJECTIVE_COMPLETE_TEXT = '퀘스트 목표 완료!'
export const QUEST_COMPLETE_TEXT = '퀘스트 완료!'
export const QUEST_BADGE_SCALE = 0.16
export const QUEST_BADGE_Y_OFFSET = 10
// LPC 캐릭터는 머리가 타일 위로 약 22px 솟는다 — 머리 위 막대·뱃지를 그만큼 더 올린다.
export const LPC_HEAD_CLEARANCE_PIXELS = 22
// 한 프레임 동안 위치 변화가 없어도 이 시간까지는 걷는 중으로 본다(프레임 사이 떨림 방지).
export const LPC_MOVING_HOLD_MILLISECONDS = 120
