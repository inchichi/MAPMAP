// 캐릭터 그리기: LPC 스프라이트(플레이어 장비 겹 포함)와 매 프레임 동기화 — 위치·깊이·구르기·피격 반동,
// 이름표·레벨 배지·퀘스트 배지·자원 막대·몬스터 체력바. 맵 화면의 상태는 ctx 로 받는다.
import { getPlayerInvulnerableBlinkAlpha } from './playerHitStagger'
import { Container, Sprite, Texture } from 'pixi.js'
import type { ParsedTiledMap } from '../../tiled/parseTiledMap'
import type { PlayerEquipment } from '../../playerEquipment'
import type { PlayerProfile } from '../../playerProfile'
import {
  getLpcActionFrameIndex,
  getLpcAnchor,
  getLpcDirectionFromFacing,
  getLpcPlayerAttackAnimation,
  getLpcAnimationFrameCount,
  getLpcPlayerLayerFiles,
  getLpcWalkFrameIndex,
  createLpcSheetCache,
  LPC_PLAYER_LAYER_ORDER,
  type LpcAnimationName,
  type LpcCharacterSheets,
  type LpcPlayerLook
} from '../lpcCharacterSprites'
import { PLAYER_CHARACTER_ID } from '../../characterState'
import type { CharacterMoveDirection, CharacterState } from '../../characterState'
import { type PlayerRollState, type PlayerRollVisualState } from '../../playerRoll'
import { getQuestNpcBadgeKindForNpc, type QuestLogState } from '../../questLog'
import { isMonsterDefeated, type MonsterCombatState } from '../../monsterCombat'
import { getMonsterDisplayName, getPlayerRollProgress, getPlayerRollVisualState } from '../../lua/luaGameLogic'
import { LPC_HEAD_CLEARANCE_PIXELS, LPC_MOVING_HOLD_MILLISECONDS, MONSTER_HEALTH_BAR_BORDER_COLOR, MONSTER_HEALTH_BAR_FILL_COLOR, MONSTER_HEALTH_BAR_GAP, MONSTER_HEALTH_BAR_HEIGHT, MONSTER_HEALTH_BAR_TRACK_COLOR, MONSTER_HEALTH_BAR_WIDTH, PLAYER_ATTACK_DURATION_MILLISECONDS, PLAYER_EQUIPMENT_APPEARANCE_CONFIG_BY_ITEM_ID, PLAYER_HEALTH_BAR_BORDER_COLOR, PLAYER_HEALTH_BAR_FILL_COLOR, PLAYER_HEALTH_BAR_GAP, PLAYER_HEALTH_BAR_HEIGHT, PLAYER_HEALTH_BAR_TRACK_COLOR, PLAYER_HEALTH_BAR_WIDTH, PLAYER_MANA_BAR_BORDER_COLOR, PLAYER_MANA_BAR_FILL_COLOR, PLAYER_MANA_BAR_GAP, PLAYER_MANA_BAR_HEIGHT, PLAYER_MANA_BAR_TRACK_COLOR, PLAYER_MANA_BAR_WIDTH, PLAYER_NAME_BADGE_FOOT_OFFSET, PLAYER_STATUS_STACK_CLEARANCE, QUEST_BADGE_Y_OFFSET, SIGN_POST_APPEARANCE_TYPE } from './constants'
import { getMonsterBehaviorConfig } from './nodes'
import type { createPlayerCombatEffects } from './playerCombatEffects'
import { getCharacterDepthSortValue } from './tiles'
import { type MonsterPigAnimationMode, type PlayerHitReactionState, type PlayerVisualEquipmentSlotId, type RenderedCharacterNode } from './types'

export type CharacterSpritesContext = {
  map: ParsedTiledMap
  messageLayer: Container
  monsterCombatStates: Map<string, MonsterCombatState>
  monsterPigAnimationModes: Map<string, MonsterPigAnimationMode>
  playerEquipmentTexturesByItemId: Map<string, Texture>
  playerProfile: PlayerProfile
  questFinTexture: Texture
  questNewTexture: Texture
  renderedCharacters: Map<string, RenderedCharacterNode>
  getCharacterStateById: (characterId: string) => CharacterState
  getPlayerLook: () => LpcPlayerLook
  lpcSheetCache: ReturnType<typeof createLpcSheetCache>
  getPlayerMagicCast: ReturnType<typeof createPlayerCombatEffects>['getPlayerMagicCast']
  syncPlayerWeaponSprite: (character: CharacterState) => void
  getPlayerAttackFacing: () => CharacterMoveDirection | undefined
  getPlayerAttackStartedAtMilliseconds: () => number | undefined
  getCurrentPlayerEquipment: () => PlayerEquipment
  getCurrentQuestLog: () => QuestLogState
  getDepthSortedLayer: () => Container | undefined
  getPlayerRollState: () => PlayerRollState | undefined
  getPlayerDamageInvulnerableUntilMilliseconds: () => number
  setPlayerHitReactionState: (value: PlayerHitReactionState | undefined) => void
}

export const createCharacterSprites = (ctx: CharacterSpritesContext) => {
  const {
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
    syncPlayerWeaponSprite,
    getPlayerAttackFacing,
    getPlayerAttackStartedAtMilliseconds,
    getCurrentPlayerEquipment,
    getCurrentQuestLog,
    getDepthSortedLayer,
    getPlayerRollState,
    getPlayerDamageInvulnerableUntilMilliseconds,
    setPlayerHitReactionState
  } = ctx

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
    const cast = getPlayerMagicCast()
    if (cast) {
      return {
        animation: cast.animation,
        progress:
          (now - cast.startedAtMilliseconds) /
          (cast.endAtMilliseconds - cast.startedAtMilliseconds),
        facing: cast.facing
      }
    }
    const playerAttackStartedAtMilliseconds = getPlayerAttackStartedAtMilliseconds()
    if (playerAttackStartedAtMilliseconds !== undefined) {
      const elapsed = now - playerAttackStartedAtMilliseconds
      if (elapsed >= 0 && elapsed < PLAYER_ATTACK_DURATION_MILLISECONDS) {
        return {
          progress: elapsed / PLAYER_ATTACK_DURATION_MILLISECONDS,
          facing: getPlayerAttackFacing() ?? getCharacterStateById(PLAYER_CHARACTER_ID).facing
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
          getLpcAnimationFrameCount(animation)
        )
        facing = action.facing
      }
      let files = getLpcPlayerLayerFiles(look, animation)
      // 동작 시트(몸·장비 레이어 전부)가 아직 안 불러졌으면 그동안은 걷기 자세로 — 갑옷이 늦게 와 맨몸이 비치지 않게.
      const isAnimationReady =
        files.base !== undefined &&
        Object.values(files).every((file) => file === undefined || lpcSheetCache.get(file, animation) !== undefined)
      if (!isAnimationReady) {
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
      setPlayerHitReactionState(undefined)
      renderNode.container.visible = false
      syncPlayerWeaponSprite(character)
      syncPlayerEquipmentSprites(renderNode)
      return
    }

    let monsterRunMotionOffsetX = 0
    let monsterRunMotionOffsetY = 0
    const playerRollVisualState =
      character.id === PLAYER_CHARACTER_ID
        ? getActivePlayerRollVisualState(now)
        : undefined

    // 피격: 실제로 밀려나는 건 playerHitStagger.ts 가 맡고, 여기서는 맞은 뒤 무적 시간 동안 깜빡이기만 한다.
    if (character.id === PLAYER_CHARACTER_ID) {
      renderNode.container.alpha = getPlayerInvulnerableBlinkAlpha(
        now,
        getPlayerDamageInvulnerableUntilMilliseconds()
      )
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
        monsterRunMotionOffsetX +
        monsterSpriteOffsetX,
      character.position.y * map.tileHeight +
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
    getDepthSortedLayer()?.sortChildren()

    if (character.id === PLAYER_CHARACTER_ID) {
      syncPlayerEquipmentSprites(renderNode)
      syncPlayerWeaponSprite(character)
    }
  }

  const getActivePlayerRollVisualState = (
    now: number
  ): PlayerRollVisualState | undefined => {
    const playerRollState = getPlayerRollState()
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

    const equippedItem = getCurrentPlayerEquipment().slots.find(
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

      const badgeKind = getQuestNpcBadgeKindForNpc(getCurrentQuestLog(), npcId)

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

  return {
    createLpcCharacterNode,
    syncCharacterSprite,
    syncQuestNpcBadges
  }
}
