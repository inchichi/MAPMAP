import type { QuestObjectiveDefinition } from '../questLog'
import { getPlayerEquipmentItemDefinitionById } from '../playerEquipment'
import { renderItemIconById } from './createBlacksmithShopOverlay'
import { getMonsterCatalogEntry, getMonsterKindLabel } from './monsterCatalog'

// 퀘스트 목표의 "대상"(몬스터/아이템)을 파란 밑줄 링크로 만들고, 클릭하면 그 대상의 이미지를
// 보여주는 팝업을 띄운다. 유저가 무엇을 잡고/얻어야 하는지 시각적으로 알 수 있게 한다.
// 퀘스트 UI가 DOM이라 전부 DOM으로 구현한다(트래커·B창 공용).

// 몬스터 그림은 게임 속과 같은 LPC 시트 — 종류 목록(monsterCatalog)의 왼쪽 대기 동작 첫 프레임을
// 잘라 보여준다. 새 몬스터를 목록에 넣으면 팝업도 따라온다.
type MonsterPopupSprite = {
  sheetUrl: string
  cellWidth: number
  cellHeight: number
  row: number
  frame: number
  label: string
}
const getMonsterPopupSprite = (appearanceType: string): MonsterPopupSprite | undefined => {
  const entry = getMonsterCatalogEntry(appearanceType)
  if (!entry) {
    return undefined
  }
  const strip = entry.spec.idleLeft
  return {
    sheetUrl: strip.url,
    cellWidth: strip.cellWidth,
    cellHeight: strip.cellHeight,
    row: strip.row,
    frame: strip.frames[0] ?? 0,
    label: entry.label
  }
}

const POTION_LABELS: Record<string, string> = {
  'health-potion': '체력 회복 포션',
  'mana-potion': '마나 회복 포션',
  'antidote-incense': '해독 향',
  'warming-tea': '생강차'
}

const MATERIAL_LABELS: Record<string, string> = {
  'crystal-ore': '수정 광석'
}

const resolveItemLabel = (itemId: string): string =>
  getPlayerEquipmentItemDefinitionById(itemId)?.label ??
  POTION_LABELS[itemId] ??
  MATERIAL_LABELS[itemId] ??
  itemId

export type QuestTargetDescriptor =
  | { kind: 'monster'; label: string; appearanceType: string }
  | { kind: 'item'; label: string; itemId: string }

// 목표 → 클릭 가능한 대상(이미지 있는 것). shop/scene/talk는 이미지 대상이 없어 undefined.
export const describeQuestObjectiveTarget = (
  objective: QuestObjectiveDefinition
): QuestTargetDescriptor | undefined => {
  if (objective.type === 'monster-defeat' && objective.target.appearanceType) {
    const appearanceType = objective.target.appearanceType
    return {
      kind: 'monster',
      appearanceType,
      // 특정 개체(보스 등)를 노리는 목표는 몬스터 종류("말캉이") 대신 목표 이름("말캉이-보스")
      label: objective.target.characterId ? objective.label : getMonsterKindLabel(appearanceType)
    }
  }
  if (
    (objective.type === 'item-use' || objective.type === 'item-acquire') &&
    objective.target.itemId
  ) {
    return {
      kind: 'item',
      itemId: objective.target.itemId,
      label: resolveItemLabel(objective.target.itemId)
    }
  }
  return undefined
}

let activePopup: HTMLElement | undefined

const closeQuestTargetPopup = (): void => {
  activePopup?.remove()
  activePopup = undefined
  document.removeEventListener('keydown', handlePopupKeyDown)
}

const handlePopupKeyDown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    event.stopPropagation()
    closeQuestTargetPopup()
  }
}

const renderMonsterIdleFrame = (
  box: HTMLElement,
  appearanceType: string
): void => {
  const sprite = getMonsterPopupSprite(appearanceType)
  if (!sprite) {
    box.textContent = '?'
    return
  }
  const maxWidth = 180
  const maxHeight = 150
  const image = new Image()
  image.src = sprite.sheetUrl
  image.addEventListener('load', () => {
    const scale = Math.min(maxWidth / sprite.cellWidth, maxHeight / sprite.cellHeight)
    box.style.width = `${Math.round(sprite.cellWidth * scale)}px`
    box.style.height = `${Math.round(sprite.cellHeight * scale)}px`
    box.style.backgroundImage = `url(${sprite.sheetUrl})`
    box.style.backgroundRepeat = 'no-repeat'
    box.style.backgroundPosition = `-${Math.round(sprite.frame * sprite.cellWidth * scale)}px -${Math.round(sprite.row * sprite.cellHeight * scale)}px`
    box.style.backgroundSize = `${Math.round(image.naturalWidth * scale)}px ${Math.round(image.naturalHeight * scale)}px`
    box.style.imageRendering = 'pixelated'
  })
}

const showQuestTargetImagePopup = (descriptor: QuestTargetDescriptor): void => {
  closeQuestTargetPopup()

  const backdrop = document.createElement('div')
  backdrop.style.cssText =
    'position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);'

  const card = document.createElement('div')
  card.style.cssText =
    'display:flex;flex-direction:column;align-items:center;gap:10px;padding:18px 22px;border-radius:14px;background:#1f1b16;border:2px solid #d9a85c;box-shadow:0 8px 30px rgba(0,0,0,0.5);min-width:160px;'

  const imageBox = document.createElement('div')
  imageBox.style.cssText =
    'display:flex;align-items:center;justify-content:center;min-width:64px;min-height:64px;'
  if (descriptor.kind === 'item') {
    renderItemIconById(imageBox, descriptor.itemId, 6)
  } else {
    renderMonsterIdleFrame(imageBox, descriptor.appearanceType)
  }

  const caption = document.createElement('div')
  caption.textContent = descriptor.label
  caption.style.cssText = 'color:#f3d88b;font-size:14px;font-weight:600;'

  card.append(imageBox, caption)
  backdrop.append(card)
  backdrop.addEventListener('click', closeQuestTargetPopup)
  card.addEventListener('click', (event) => event.stopPropagation())

  document.body.append(backdrop)
  document.addEventListener('keydown', handlePopupKeyDown)
  activePopup = backdrop
}

// 목표 대상 이름의 파란 밑줄 클릭 링크. 이미지 대상이 없으면(상점/이동/대화) undefined.
export const createQuestTargetLink = (
  objective: QuestObjectiveDefinition
): HTMLButtonElement | undefined => {
  const descriptor = describeQuestObjectiveTarget(objective)
  if (!descriptor) {
    return undefined
  }
  const link = document.createElement('button')
  link.type = 'button'
  link.textContent = descriptor.label
  link.style.cssText =
    'background:none;border:none;padding:0;margin:0;color:#5db3ff;text-decoration:underline;cursor:pointer;font:inherit;'
  link.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    showQuestTargetImagePopup(descriptor)
  })
  return link
}
