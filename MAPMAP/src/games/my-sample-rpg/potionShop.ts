import {
  clearPlayerInventorySlot,
  findFirstEmptyPlayerInventorySlotIndex,
  setPlayerInventorySlot,
  type PlayerInventory,
  type PlayerInventoryItem
} from './playerInventory'
import { getPlayerEquipmentItemDefinitionById } from './playerEquipment'

export type PotionShopInventory = PlayerInventory

export type PotionShopTransactionResult = {
  ok: boolean
  playerInventory: PlayerInventory
  merchantInventory: PlayerInventory
  message: string
}

type CreateInitialPotionInventoryInput = {
  slotCount?: number
  gold?: number
  // 진열할 물건(순서대로). 없으면 물약상인 기본 진열(체력·마나 포션).
  stockItemIds?: readonly PotionShopItemDefinition['id'][]
}

type BuyPotionShopItemInput = {
  playerInventory: PlayerInventory
  merchantInventory: PlayerInventory
  merchantSlotIndex: number
  quantity?: number
}

type SellPotionShopItemInput = {
  playerInventory: PlayerInventory
  merchantInventory: PlayerInventory
  playerSlotIndex: number
  quantity?: number
}

export type PotionShopItemDefinition = {
  id:
    | 'health-potion'
    | 'mana-potion'
    | 'health-potion-medium'
    | 'mana-potion-medium'
    | 'health-potion-large'
    | 'mana-potion-large'
    | 'antidote-incense'
    | 'warming-tea'
  label: string
  description: string
  price: number
}

export const DEFAULT_POTION_INVENTORY_SLOT_COUNT = 12
export const DEFAULT_POTION_INVENTORY_GOLD = 1_000_000_000_000_000
export const POTION_SALE_RATIO = 0.5
export const DEFAULT_POTION_STOCK_QUANTITY = 999_999
export const POTION_ITEM_DEFINITIONS: PotionShopItemDefinition[] = [
  {
    id: 'health-potion',
    label: '체력 회복 포션',
    description: '체력을 회복하는 물약',
    price: 10
  },
  {
    id: 'mana-potion',
    label: '마나 회복 포션',
    description: '마나를 회복하는 물약',
    price: 15
  },
  // 등급 포션 — 2장(Lv15~)·3장(Lv38~) 몬스터가 떨어뜨리고, 상인도 판다.
  {
    id: 'health-potion-medium',
    label: '중급 체력 포션',
    description: '체력을 60 회복하는 물약',
    price: 60
  },
  {
    id: 'mana-potion-medium',
    label: '중급 마나 포션',
    description: '마나를 40 회복하는 물약',
    price: 70
  },
  {
    id: 'health-potion-large',
    label: '상급 체력 포션',
    description: '체력을 150 회복하는 물약',
    price: 160
  },
  {
    id: 'mana-potion-large',
    label: '상급 마나 포션',
    description: '마나를 80 회복하는 물약',
    price: 180
  },
  {
    // 2장: 갈대골 약초꾼 오디가 만든다. 피우면 한동안 독안개 피해를 막는다(playerFogImmunity).
    id: 'antidote-incense',
    label: '해독 향',
    description: '피우면 90초 동안 독안개를 막아 준다',
    price: 40
  },
  {
    // 3장: 서리목 약재상 이르마가 끓인다. 마시면 한동안 눈보라의 추위를 막는다(poisonFog.ts 의 눈보라).
    id: 'warming-tea',
    label: '생강차',
    description: '마시면 90초 동안 눈보라의 추위를 막아 준다',
    price: 45
  }
]
// 물약상인(마을·야영지)의 기본 진열 — 해독 향은 갈대골 약초꾼만 판다.
export const POTION_MERCHANT_STOCK_ITEM_IDS: readonly PotionShopItemDefinition['id'][] = [
  'health-potion',
  'mana-potion'
]
// 약초꾼(2장 갈대골 오디·3장 서리목 이르마)은 중급 포션도 판다. 상급 포션은 몬스터 드롭으로만 얻는다.
export const HERBALIST_STOCK_ITEM_IDS: readonly PotionShopItemDefinition['id'][] = [
  'antidote-incense',
  'warming-tea',
  'health-potion',
  'mana-potion',
  'health-potion-medium',
  'mana-potion-medium'
]
const POTION_ITEM_DEFINITION_BY_ID: Map<string, PotionShopItemDefinition> = new Map(
  POTION_ITEM_DEFINITIONS.map((definition) => [definition.id, definition] as const)
)

export const createInitialPotionInventory = ({
  slotCount = DEFAULT_POTION_INVENTORY_SLOT_COUNT,
  gold = DEFAULT_POTION_INVENTORY_GOLD,
  stockItemIds = POTION_MERCHANT_STOCK_ITEM_IDS
}: CreateInitialPotionInventoryInput = {}): PotionShopInventory => {
  const slots: Array<PlayerInventoryItem | undefined> = Array.from(
    { length: slotCount },
    () => undefined
  )

  for (
    let index = 0;
    index < slotCount && index < stockItemIds.length;
    index += 1
  ) {
    const itemDefinition = getPotionShopItemDefinitionById(stockItemIds[index])

    if (!itemDefinition) {
      throw new Error(
        `Missing potion stock item definition for ${stockItemIds[index]}`
      )
    }

    slots[index] = createPlayerInventoryItemFromPotionDefinition(
      itemDefinition
    )
  }

  return {
    gold,
    slots
  }
}

export const getPotionShopItemDefinitionById = (
  itemId: string
): PotionShopItemDefinition | undefined => POTION_ITEM_DEFINITION_BY_ID.get(itemId)

export const getPotionShopBuyPriceById = (
  itemId: string
): number | undefined => getPotionShopItemDefinitionById(itemId)?.price

export const getPotionShopSellPriceById = (
  itemId: string
): number | undefined => {
  const buyPrice = getPotionShopTradeItemPriceById(itemId)

  if (buyPrice === undefined) {
    return undefined
  }

  return Math.max(1, Math.floor(buyPrice * POTION_SALE_RATIO))
}

export const buyPotionShopItem = ({
  playerInventory,
  merchantInventory,
  merchantSlotIndex,
  quantity: requestedQuantity
}: BuyPotionShopItemInput): PotionShopTransactionResult => {
  assertInventorySlotIndex(merchantInventory, merchantSlotIndex)

  const merchantItem = merchantInventory.slots[merchantSlotIndex]

  if (!merchantItem) {
    return createPotionShopTransactionFailure({
      playerInventory,
      merchantInventory,
      message: '재고가 없습니다.'
    })
  }

  const itemPrice = getPotionShopBuyPriceById(merchantItem.id)

  if (itemPrice === undefined) {
    return createPotionShopTransactionFailure({
      playerInventory,
      merchantInventory,
      message: '이 상점에서는 판매하지 않는 아이템입니다.'
    })
  }

  const quantity = resolveTradeQuantity({
    requestedQuantity,
    defaultQuantity: 1
  })

  if (quantity === undefined) {
    return createPotionShopTransactionFailure({
      playerInventory,
      merchantInventory,
      message: '구매 수량은 1개 이상의 정수여야 합니다.'
    })
  }

  if (merchantItem.quantity < quantity) {
    return createPotionShopTransactionFailure({
      playerInventory,
      merchantInventory,
      message: '재고가 부족합니다.'
    })
  }

  const totalPrice = itemPrice * quantity

  if (playerInventory.gold < totalPrice) {
    return createPotionShopTransactionFailure({
      playerInventory,
      merchantInventory,
      message: '돈이 부족합니다.'
    })
  }

  const playerInventorySlotIndex =
    findPlayerInventoryStackSlotIndexByItemId(playerInventory, merchantItem.id) ??
    findFirstEmptyPlayerInventorySlotIndex(playerInventory)

  if (playerInventorySlotIndex === undefined) {
    return createPotionShopTransactionFailure({
      playerInventory,
      merchantInventory,
      message: '인벤토리가 가득 찼습니다.'
    })
  }

  const existingPlayerItem = playerInventory.slots[playerInventorySlotIndex]
  const nextPlayerItemQuantity = existingPlayerItem
    ? existingPlayerItem.quantity + quantity
    : quantity
  const nextPlayerInventory = withInventoryGold(
    setPlayerInventorySlot({
      inventory: playerInventory,
      slotIndex: playerInventorySlotIndex,
      item: {
        id: merchantItem.id,
        label: merchantItem.label,
        quantity: nextPlayerItemQuantity
      }
    }),
    playerInventory.gold - totalPrice
  )
  const nextMerchantInventory = withInventoryGold(
    merchantItem.quantity === quantity
      ? clearPlayerInventorySlot({
          inventory: merchantInventory,
          slotIndex: merchantSlotIndex
        })
      : setPlayerInventorySlot({
          inventory: merchantInventory,
          slotIndex: merchantSlotIndex,
          item: {
            ...merchantItem,
            quantity: merchantItem.quantity - quantity
          }
        }),
    merchantInventory.gold + totalPrice
  )

  return {
    ok: true,
    playerInventory: nextPlayerInventory,
    merchantInventory: nextMerchantInventory,
    message: `${quantity}개를 구매했습니다.`
  }
}

export const sellPotionShopItem = ({
  playerInventory,
  merchantInventory,
  playerSlotIndex,
  quantity: requestedQuantity
}: SellPotionShopItemInput): PotionShopTransactionResult => {
  assertInventorySlotIndex(playerInventory, playerSlotIndex)

  const playerItem = playerInventory.slots[playerSlotIndex]

  if (!playerItem) {
    return createPotionShopTransactionFailure({
      playerInventory,
      merchantInventory,
      message: '판매할 아이템이 없습니다.'
    })
  }

  const itemPrice = getPotionShopSellPriceById(playerItem.id)

  if (itemPrice === undefined) {
    return createPotionShopTransactionFailure({
      playerInventory,
      merchantInventory,
      message: '이 상점에서는 매입하지 않는 아이템입니다.'
    })
  }

  const quantity = resolveTradeQuantity({
    requestedQuantity,
    defaultQuantity: playerItem.quantity
  })

  if (quantity === undefined) {
    return createPotionShopTransactionFailure({
      playerInventory,
      merchantInventory,
      message: '판매 수량은 1개 이상의 정수여야 합니다.'
    })
  }

  if (playerItem.quantity < quantity) {
    return createPotionShopTransactionFailure({
      playerInventory,
      merchantInventory,
      message: '보유 수량보다 많이 판매할 수 없습니다.'
    })
  }

  const totalPrice = itemPrice * quantity

  if (merchantInventory.gold < totalPrice) {
    return createPotionShopTransactionFailure({
      playerInventory,
      merchantInventory,
      message: '상점 보유금이 부족합니다.'
    })
  }

  const nextPlayerInventory = withInventoryGold(
    quantity === playerItem.quantity
      ? clearPlayerInventorySlot({
          inventory: playerInventory,
          slotIndex: playerSlotIndex
        })
      : setPlayerInventorySlot({
          inventory: playerInventory,
          slotIndex: playerSlotIndex,
          item: {
            ...playerItem,
            quantity: playerItem.quantity - quantity
          }
        }),
    playerInventory.gold + totalPrice
  )
  const nextMerchantInventory = withInventoryGold(
    merchantInventory,
    merchantInventory.gold - totalPrice
  )

  return {
    ok: true,
    playerInventory: nextPlayerInventory,
    merchantInventory: nextMerchantInventory,
    message: `${quantity}개를 판매했습니다.`
  }
}

const getPotionShopTradeItemPriceById = (
  itemId: string
): number | undefined =>
  getPotionShopItemDefinitionById(itemId)?.price ??
  getPlayerEquipmentItemDefinitionById(itemId)?.price

const createPlayerInventoryItemFromPotionDefinition = (
  definition: PotionShopItemDefinition,
  quantity = DEFAULT_POTION_STOCK_QUANTITY
): PlayerInventoryItem => ({
  id: definition.id,
  label: definition.label,
  quantity
})

const withInventoryGold = (
  inventory: PlayerInventory,
  gold: number
): PlayerInventory => ({
  ...inventory,
  gold
})

const createPotionShopTransactionFailure = ({
  playerInventory,
  merchantInventory,
  message
}: {
  playerInventory: PlayerInventory
  merchantInventory: PlayerInventory
  message: string
}): PotionShopTransactionResult => ({
  ok: false,
  playerInventory,
  merchantInventory,
  message
})

const resolveTradeQuantity = ({
  requestedQuantity,
  defaultQuantity
}: {
  requestedQuantity: number | undefined
  defaultQuantity: number
}): number | undefined => {
  const quantity = requestedQuantity ?? defaultQuantity

  return Number.isInteger(quantity) && quantity > 0 ? quantity : undefined
}

const findPlayerInventoryStackSlotIndexByItemId = (
  inventory: PlayerInventory,
  itemId: string
): number | undefined => {
  const slotIndex = inventory.slots.findIndex((slot) => slot?.id === itemId)

  return slotIndex < 0 ? undefined : slotIndex
}

const assertInventorySlotIndex = (
  inventory: PlayerInventory,
  slotIndex: number
) => {
  if (slotIndex < 0 || slotIndex >= inventory.slots.length) {
    throw new Error(`Invalid inventory slot index ${slotIndex}`)
  }
}
