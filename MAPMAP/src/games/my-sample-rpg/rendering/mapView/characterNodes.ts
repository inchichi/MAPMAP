// 부팅 때 캐릭터·포탈 렌더 노드 만들기(스프라이트·이름표·배지·체력바·몬스터 애니메이션)와
// 이름표 레이어(메시지 층) 붙이기·매 프레임 맞추기. 맵 화면의 상태는 ctx 로 받는다.
import type { createLuaMonsterCombat } from '../../monsterCombatLua'
import type { PlayerProfile } from '../../playerProfile'
import type { ParsedTiledTileset } from '../../tiled/parseTiledMap'
import type { ParsedTiledMap } from '../../tiled/parseTiledMap'
import type { LpcCharacterSheets } from '../lpcCharacterSprites'
import type { LpcAnimationFrames } from '../lpcCharacterSprites'
import {
  AnimatedSprite,
  Container,
  NineSliceSprite,
  Sprite,
  Text,
  Texture
} from 'pixi.js'
import { type LpcAnimationName } from '../lpcCharacterSprites'
import { PLAYER_CHARACTER_ID } from '../../characterState'
import type { CharacterState } from '../../characterState'
import { type MonsterCombatState } from '../../monsterCombat'
import { type MapPortal } from '../../tiled/createMapPortalsFromEventLayers'
import { type TilesetRenderResources } from '../tiledMapRenderResources'
import type { MonsterAnimationTextures } from '../monsterAnimationTextures'
import { isBossSummonCharacterId } from '../../bossSkills'
import { createPortalVortexSprite } from './portalVortex'
import { MESSAGE_PANEL_BORDER_SIZE, MONSTER_LEVEL_BADGE_STYLE, PLAYER_ARMOR_EQUIPMENT_CONFIG, PLAYER_ATTACK_TRAIL_SPRITE_COUNT, PLAYER_HELMET_EQUIPMENT_CONFIG, PLAYER_NAME_BADGE_STYLE, PROTECT_VFX_ANIMATION_SPEED, PROTECT_VFX_SCALE, SIGN_POST_APPEARANCE_TYPE, SIGN_POST_LABEL_STYLE } from './constants'
import { createMonsterHealthBar, createPlayerResourceBar, createQuestBadgeSprite, getMonsterBehaviorConfig } from './nodes'
import { resolveCharacterTexture } from './tiles'
import { type MonsterPigAnimationMode, type MonsterPigBehaviorState, type ProtectVfxRenderResources, type RenderedCharacterNode, type RenderedPortalNode } from './types'

export type CharacterNodesContext = {
  characterSpriteSheet: { tileset: ParsedTiledTileset; scale: number; }
  characterTilesetResources: TilesetRenderResources
  createLpcCharacterNode: (container: Container, character: CharacterState, npcSheets: LpcCharacterSheets | undefined) => NonNullable<RenderedCharacterNode["lpc"]>
  createMonsterPigBehaviorState: () => MonsterPigBehaviorState
  getLpcNpcSheetsFor: (character: CharacterState) => Partial<Record<LpcAnimationName, LpcAnimationFrames>> | undefined
  getMonsterCombatStateOptions: (character: CharacterState) => { hpMultiplier: number; damageMultiplier: number; } | { hpMultiplier: number; damageMultiplier?: undefined; }
  getMonsterRenderScaleMultiplier: (characterId: string) => 2 | 1
  lpcPlaceholderTexture: Texture
  luaMonsterCombat: ReturnType<typeof createLuaMonsterCombat>
  map: ParsedTiledMap
  mapPortals: MapPortal[]
  messageLayer: Container
  messagePanelTexture: Texture
  monsterAnimationTexturesByAppearanceType: Map<string, MonsterAnimationTextures>
  monsterCombatStates: Map<string, MonsterCombatState>
  monsterPigAnimatedSprites: Map<string, AnimatedSprite>
  monsterPigBehaviorStates: Map<string, MonsterPigBehaviorState>
  monsterSpawnStates: Map<string, CharacterState>
  playerProfile: PlayerProfile
  protectVfxTextures: ProtectVfxRenderResources
  questNewTexture: Texture
  renderedCharacters: Map<string, RenderedCharacterNode>
  renderedPortals: Map<string, RenderedPortalNode>
  resolveMapPortalTexture: (appearanceType: string) => Texture
  syncMonsterAnimation: (characterId: string, mode: MonsterPigAnimationMode, options?: { forceRestart?: boolean; }) => void
  tilesetResources: Map<string, TilesetRenderResources>
  world: Container
  depthSortedLayer: Container
  getCharacterStates: () => CharacterState[]
  getPlayerArmorSprite: () => Sprite | undefined
  getPlayerHelmetSprite: () => Sprite | undefined
  setPlayerArmorSprite: (value: Sprite | undefined) => void
  setPlayerHelmetSprite: (value: Sprite | undefined) => void
  setPlayerProtectSkillSprite: (value: AnimatedSprite | undefined) => void
  setPlayerWeaponSprite: (value: Sprite | undefined) => void
  setPlayerWeaponTrailSprites: (value: Sprite[]) => void
}

export const createCharacterNodes = (ctx: CharacterNodesContext) => {
  const {
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
    protectVfxTextures,
    questNewTexture,
    renderedCharacters,
    renderedPortals,
    resolveMapPortalTexture,
    syncMonsterAnimation,
    tilesetResources,
    world,
    depthSortedLayer,
    getCharacterStates,
    getPlayerArmorSprite,
    getPlayerHelmetSprite,
    setPlayerArmorSprite,
    setPlayerHelmetSprite,
    setPlayerProtectSkillSprite,
    setPlayerWeaponSprite,
    setPlayerWeaponTrailSprites
  } = ctx

  for (const character of getCharacterStates()) {
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
      const playerArmorSprite = new Sprite(Texture.EMPTY)
      setPlayerArmorSprite(playerArmorSprite)
      playerArmorSprite.label = 'character:player:armor'
      playerArmorSprite.anchor.set(0.5)
      playerArmorSprite.visible = false
      playerArmorSprite.roundPixels = true
      playerArmorSprite.zIndex = PLAYER_ARMOR_EQUIPMENT_CONFIG.zIndex
      container.addChild(playerArmorSprite)
      const playerHelmetSprite = new Sprite(Texture.EMPTY)
      setPlayerHelmetSprite(playerHelmetSprite)
      playerHelmetSprite.label = 'character:player:helmet'
      playerHelmetSprite.anchor.set(0.5)
      playerHelmetSprite.visible = false
      playerHelmetSprite.roundPixels = true
      playerHelmetSprite.zIndex = PLAYER_HELMET_EQUIPMENT_CONFIG.zIndex
      container.addChild(playerHelmetSprite)
      const playerProtectSkillSprite = new AnimatedSprite(
        protectVfxTextures.shieldTextures
      )
      setPlayerProtectSkillSprite(playerProtectSkillSprite)
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
      setPlayerWeaponTrailSprites(Array.from(
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
      ))
      const playerWeaponSprite = new Sprite(Texture.EMPTY)
      setPlayerWeaponSprite(playerWeaponSprite)
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
      playerArmorSprite: isPlayer ? getPlayerArmorSprite() : undefined,
      playerHelmetSprite: isPlayer ? getPlayerHelmetSprite() : undefined,
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
    const portalRect = {
      x: portal.position.x * map.tileWidth,
      y: portal.position.y * map.tileHeight,
      width: portal.collisionSize.width * map.tileWidth,
      height: portal.collisionSize.height * map.tileHeight
    }
    // 메이플 포탈 같은 빛 소용돌이(portalVortex.ts). 동굴 입구는 입구 그림 앞에 소용돌이를 세운다.
    const vortexSprite = createPortalVortexSprite(portalRect, {
      width: map.pixelWidth,
      height: map.pixelHeight
    })
    container.label = `portal:${portal.id}:container`
    container.sortableChildren = true
    vortexSprite.label = `portal:${portal.id}:vortex`
    vortexSprite.zIndex = 1

    if (portal.appearanceType === 'cave_entrance') {
      const caveSprite = new Sprite(resolveMapPortalTexture(portal.appearanceType))
      caveSprite.label = `portal:${portal.id}:base`
      caveSprite.roundPixels = true
      caveSprite.scale.set(0.24)
      caveSprite.position.set(portalRect.x - 32, portalRect.y)
      container.addChild(caveSprite)
    }

    container.addChild(vortexSprite)
    container.zIndex = Math.round(portalRect.y + portalRect.height)
    renderedPortals.set(portal.id, {
      container,
      sprite: vortexSprite
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

  return {
    attachCharacterLabelLayer,
    syncCharacterLabelLayers
  }
}
