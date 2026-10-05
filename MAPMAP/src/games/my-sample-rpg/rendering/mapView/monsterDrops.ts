// 몬스터 드롭(금화·장비)과 맵 바닥 코인 더미: 떨어뜨리기·튀어 오르는 연출·줍기. 맵 화면의 상태는 ctx 로 받는다.
import type { ParsedTiledMap } from '../../tiled/parseTiledMap'
import {
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  Texture
} from 'pixi.js'
import { PLAYER_CHARACTER_ID } from '../../characterState'
import type { CharacterState } from '../../characterState'
import { type PlayerInventory } from '../../playerInventory'
import { recordItemAcquireQuestProgress, type QuestLogState } from '../../questLog'
import { rollMonsterEquipmentDrop } from '../../monsterEquipmentDrops'
import { findFirstEmptyPlayerInventorySlotIndex, setPlayerInventorySlot, getPlayerEquipmentItemDefinitionById } from '../../lua/luaGameLogic'
import { doCollisionRectsIntersect } from '../characterCollision'
import { type TilesetRenderResources } from '../tiledMapRenderResources'
import { COIN_PILE_PICKUP_HEIGHT, COIN_PILE_PICKUP_WIDTH, DAMAGE_TEXT_DURATION_MILLISECONDS, EVADE_TEXT_DURATION_MILLISECONDS, EVADE_TEXT_STYLE, LEVEL_UP_TEXT_STYLE, MONSTER_EQUIPMENT_DROP_PICKUP_HEIGHT, MONSTER_EQUIPMENT_DROP_PICKUP_WIDTH, MONSTER_EQUIPMENT_DROP_RENDER_SIZE, MONSTER_GOLD_DROP_AMOUNT_TEXT_STYLE, MONSTER_GOLD_DROP_ICON_RADIUS, MONSTER_GOLD_DROP_PICKUP_HEIGHT, MONSTER_GOLD_DROP_PICKUP_WIDTH, MONSTER_GOLD_DROP_PILE_GIDS, MONSTER_GOLD_DROP_PILE_THRESHOLDS, MONSTER_GOLD_DROP_POP_HEIGHT_PIXELS, MONSTER_GOLD_DROP_POP_MILLISECONDS } from './constants'
import { type MonsterEquipmentDrop, type MonsterGoldDrop } from './types'

export type MonsterDropsContext = {
  map: ParsedTiledMap
  tilesetResources: Map<string, TilesetRenderResources>
  monsterEquipmentDropTexturesByDropId: Map<string, Texture>
  monsterGoldDrops: Map<string, MonsterGoldDrop>
  monsterEquipmentDrops: Map<string, MonsterEquipmentDrop>
  coinPileSprites: Map<string, { sprite: Sprite; goldAmount: number; tileX: number; tileY: number }>
  collectedCoinTileKeySet: Set<string>
  onCoinPileCollected: (tileKey: string) => void
  onPlayerInventoryChange: (nextInventory: PlayerInventory) => void
  getCharacterStateById: (characterId: string) => CharacterState
  setQuestLogWithObjectiveFeedback: (nextQuestLog: QuestLogState) => void
  syncPlayerUiOverlays: () => void
  showCharacterDamageText: (characterId: string, message: string, durationMilliseconds: number, style?: TextStyle) => void
  getDepthSortedLayer: () => Container | undefined
  getCurrentQuestLog: () => QuestLogState
  getCurrentPlayerInventory: () => PlayerInventory
  setCurrentPlayerInventory: (value: PlayerInventory) => void
}

export const createMonsterDrops = (ctx: MonsterDropsContext) => {
  const {
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
    showCharacterDamageText,
    getDepthSortedLayer,
    getCurrentQuestLog,
    getCurrentPlayerInventory,
    setCurrentPlayerInventory
  } = ctx

  let monsterGoldDropSequence = 0
  let monsterEquipmentDropSequence = 0

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
    getDepthSortedLayer()?.addChild(container)
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

    getDepthSortedLayer()?.sortChildren()
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
    getDepthSortedLayer()?.addChild(container)
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

    getDepthSortedLayer()?.sortChildren()
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
        getCurrentPlayerInventory()
      )

      if (emptySlotIndex === undefined) {
        showCharacterDamageText(
          PLAYER_CHARACTER_ID,
          '가방이 가득 찼습니다',
          DAMAGE_TEXT_DURATION_MILLISECONDS
        )
        continue
      }

      setCurrentPlayerInventory(setPlayerInventorySlot({
        inventory: getCurrentPlayerInventory(),
        slotIndex: emptySlotIndex,
        item: {
          id: drop.itemId,
          label: equipmentDefinition.label,
          quantity: 1
        }
      }))
      onPlayerInventoryChange(getCurrentPlayerInventory())
      // 드롭 장비를 주우면 "아이템 획득" 목표 진행을 기록한다.
      setQuestLogWithObjectiveFeedback(
        recordItemAcquireQuestProgress(getCurrentQuestLog(), drop.itemId)
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

      setCurrentPlayerInventory({
        ...getCurrentPlayerInventory(),
        gold: getCurrentPlayerInventory().gold + drop.amount
      })
      onPlayerInventoryChange(getCurrentPlayerInventory())
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

      setCurrentPlayerInventory({
        ...getCurrentPlayerInventory(),
        gold: getCurrentPlayerInventory().gold + coinPile.goldAmount
      })
      onPlayerInventoryChange(getCurrentPlayerInventory())
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

  return {
    spawnMonsterGoldDrop,
    spawnMonsterEquipmentDrop,
    syncActiveMonsterGoldDrops,
    syncActiveMonsterEquipmentDrops,
    resolveMonsterEquipmentDropPickups,
    resolveMonsterGoldDropPickups,
    resolveCoinPilePickups
  }
}
