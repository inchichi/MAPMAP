import {
  type QuestDefinition,
  type QuestLogState,
  type QuestProgress
} from '../questLog'
import {
  BLACKSMITH_NPC_ID,
  POTION_MERCHANT_NPC_ID,
  WIZARD_NPC_ID,
  abandonQuest,
  formatQuestText,
  getQuestDefinition,
  getQuestProgress,
  getVisibleQuestDefinitions,
  setQuestTrackerVisible
} from '../questLog'
import lpcManifest from '../assets/characters/lpc/manifest.json'
import { getResponsiveUiScale } from './getResponsiveUiScale'
import { createQuestTargetLink } from './questObjectiveTargetView'

type CreateQuestLogOverlayInput = {
  mountElement: HTMLElement
  getIsOpen: () => boolean
  getQuestLog: () => QuestLogState
  getPlayerName: () => string
  onRequestOpenChange: (isOpen: boolean) => void
  onQuestLogChange: (nextQuestLog: QuestLogState) => void
  // 완료한 퀘스트의 대사(수락 + 완료)를 대화창으로 다시 보여 준다.
  onRequestReplayDialogue: (definition: QuestDefinition) => void
}

export type QuestLogOverlay = {
  syncFrame: () => void
  destroy: () => void
}

// 퀘스트 의뢰인 초상화: LPC NPC 시트의 정면 머리·어깨(32x32)를 모은 한 장
// (scripts/build-lpc-characters.py 의 npc-portraits.png). 키는 NPC 외형 또는 'id:<npc id>'.
const LPC_PORTRAIT_ATLAS_URL = new URL(
  '../assets/characters/lpc/npc-portraits.png',
  import.meta.url
).href
const LPC_PORTRAIT_SIZE = lpcManifest.portraits.size
const LPC_PORTRAIT_KEYS: readonly string[] = lpcManifest.portraits.keys
type QuestGiverPortraitFrame = {
  x: number
  y: number
  width: number
  height: number
}
// 의뢰인 NPC id → 초상화 키. 맵의 외형과 build-lpc-characters.py 의 NPC id 전용 외형을 따른다.
export const QUEST_GIVER_PORTRAIT_KEY_BY_NPC_ID: Partial<Record<string, string>> = {
  [WIZARD_NPC_ID]: 'character_wizard_purple',
  [BLACKSMITH_NPC_ID]: 'id:blacksmith',
  [POTION_MERCHANT_NPC_ID]: 'id:potion_merchant',
  santa: 'id:santa',
  villager_1: 'character_villager_brown_tunic',
  elder: 'character_elder_gray_hair',
  farmer: 'id:farmer',
  rona: 'character_villager_flower_dress',
  lady: 'id:lady',
  mage: 'id:mage',
  camp_merchant: 'character_ranger_green',
  // 2장: 갈대골 주요 인물 전용 외형(scripts/add-npc-variants.py)
  miren: 'id:miren',
  odi: 'id:odi',
  tobin: 'id:tobin',
  ren: 'id:ren',
  // 신전 외곽의 학자(scripts/build-ch2-lpc-sheets.py)
  selin: 'id:selin'
}
// 32px 초상화를 2배(64px)로 — 예전 16px 초상화의 4배와 같은 화면 크기
const PORTRAIT_SCALE = 2

export const createQuestLogOverlay = ({
  mountElement,
  getIsOpen,
  getQuestLog,
  getPlayerName,
  onRequestOpenChange,
  onQuestLogChange,
  onRequestReplayDialogue
}: CreateQuestLogOverlayInput): QuestLogOverlay => {
  const overlayRoot = document.createElement('div')
  const panel = document.createElement('div')
  const panelBody = document.createElement('div')
  const header = document.createElement('div')
  const titleGroup = document.createElement('div')
  const title = document.createElement('div')
  const summary = document.createElement('div')
  const closeButton = document.createElement('button')
  const closeIcon = document.createElement('span')
  const regionPane = document.createElement('div')
  const tabBar = document.createElement('div')
  const regionTab = document.createElement('button')
  const completedTab = document.createElement('button')
  const questList = document.createElement('div')
  const emptyState = document.createElement('div')
  const detailPane = document.createElement('div')
  const detailEmptyState = document.createElement('div')
  const detailHeader = document.createElement('div')
  const portrait = document.createElement('div')
  const detailTitleGroup = document.createElement('div')
  const detailTitle = document.createElement('div')
  const detailMeta = document.createElement('div')
  const requestText = document.createElement('p')
  const guideText = document.createElement('p')
  const objectiveList = document.createElement('div')
  const actionRow = document.createElement('div')
  const trackerToggleButton = document.createElement('button')
  const abandonButton = document.createElement('button')
  const replayButton = document.createElement('button')
  const confirmPanel = document.createElement('div')
  const confirmText = document.createElement('div')
  const confirmActionRow = document.createElement('div')
  const confirmAbandonButton = document.createElement('button')
  const cancelAbandonButton = document.createElement('button')
  let selectedQuestId: string | undefined
  // 'active' = 진행 중 목록, 'completed' = 완료한 퀘스트(대사 다시 보기)
  let listMode: 'active' | 'completed' = 'active'
  let isAbandonConfirmVisible = false
  let previousRenderSignature = ''

  overlayRoot.className = 'quest-log-overlay'
  panel.className = 'quest-log-overlay__panel'
  panel.hidden = true
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'false')
  panel.setAttribute('aria-labelledby', 'quest-log-overlay-title')
  panelBody.className = 'quest-log-overlay__panel-body'
  header.className = 'quest-log-overlay__header'
  titleGroup.className = 'quest-log-overlay__title-group'
  title.id = 'quest-log-overlay-title'
  title.className = 'quest-log-overlay__title'
  title.textContent = '퀘스트 창'
  summary.className = 'quest-log-overlay__summary'

  closeButton.type = 'button'
  closeButton.className = 'quest-log-overlay__close'
  closeButton.setAttribute('aria-label', '퀘스트 창 닫기')
  closeButton.title = '퀘스트 창 닫기 (Esc)'
  closeIcon.className = 'quest-log-overlay__close-icon'
  closeIcon.textContent = '×'
  closeIcon.setAttribute('aria-hidden', 'true')
  closeButton.append(closeIcon)

  regionPane.className = 'quest-log-overlay__region-pane'
  tabBar.className = 'quest-log-overlay__tab-bar'
  regionTab.type = 'button'
  regionTab.className = 'quest-log-overlay__tab'
  regionTab.textContent = '진행 중'
  completedTab.type = 'button'
  completedTab.className = 'quest-log-overlay__tab'
  completedTab.textContent = '완료'
  questList.className = 'quest-log-overlay__quest-list'
  emptyState.className = 'quest-log-overlay__empty-state'
  emptyState.textContent = '진행 중인 퀘스트가 없습니다'

  detailPane.className = 'quest-log-overlay__detail-pane'
  detailEmptyState.className = 'quest-log-overlay__detail-empty'
  detailEmptyState.textContent = '왼쪽에서 퀘스트를 선택하세요'
  detailHeader.className = 'quest-log-overlay__detail-header'
  portrait.className = 'quest-log-overlay__portrait'
  portrait.setAttribute('aria-hidden', 'true')
  detailTitleGroup.className = 'quest-log-overlay__detail-title-group'
  detailTitle.className = 'quest-log-overlay__detail-title'
  detailMeta.className = 'quest-log-overlay__detail-meta'
  requestText.className = 'quest-log-overlay__description'
  guideText.className = 'quest-log-overlay__description'
  objectiveList.className = 'quest-log-overlay__objective-list'
  actionRow.className = 'quest-log-overlay__action-row'

  trackerToggleButton.type = 'button'
  trackerToggleButton.className = 'quest-log-overlay__tracker-toggle'
  trackerToggleButton.textContent = '퀘스트 알림'
  abandonButton.type = 'button'
  abandonButton.className = 'quest-log-overlay__abandon'
  abandonButton.textContent = '포기하기'
  replayButton.type = 'button'
  replayButton.className = 'quest-log-overlay__tracker-toggle'
  replayButton.textContent = '대화 다시 보기'

  confirmPanel.className = 'quest-log-overlay__confirm'
  confirmText.className = 'quest-log-overlay__confirm-text'
  confirmText.textContent = '정말 이 퀘스트를 포기할까요?'
  confirmActionRow.className = 'quest-log-overlay__confirm-actions'
  confirmAbandonButton.type = 'button'
  confirmAbandonButton.className = 'quest-log-overlay__confirm-abandon'
  confirmAbandonButton.textContent = '포기'
  cancelAbandonButton.type = 'button'
  cancelAbandonButton.className = 'quest-log-overlay__confirm-cancel'
  cancelAbandonButton.textContent = '취소'

  titleGroup.append(title, summary)
  header.append(titleGroup, closeButton)
  tabBar.append(regionTab, completedTab)
  regionPane.append(tabBar, questList, emptyState)
  detailTitleGroup.append(detailTitle, detailMeta)
  detailHeader.append(portrait, detailTitleGroup)
  actionRow.append(trackerToggleButton, abandonButton, replayButton)
  confirmActionRow.append(confirmAbandonButton, cancelAbandonButton)
  confirmPanel.append(confirmText, confirmActionRow)
  detailPane.append(
    detailEmptyState,
    detailHeader,
    requestText,
    guideText,
    objectiveList,
    actionRow,
    confirmPanel
  )
  panelBody.append(header, regionPane, detailPane)
  panel.append(panelBody)
  overlayRoot.append(panel)
  mountElement.append(overlayRoot)

  const syncFrame = () => {
    const isOpen = getIsOpen()

    panel.hidden = !isOpen
    panel.style.display = isOpen ? '' : 'none'
    overlayRoot.setAttribute('aria-hidden', String(!isOpen))

    if (!isOpen) {
      return
    }

    const questLog = getQuestLog()
    const visibleDefinitions =
      listMode === 'active'
        ? getActiveQuestDefinitions(questLog)
        : getCompletedQuestDefinitions(questLog)

    if (
      selectedQuestId === undefined ||
      !visibleDefinitions.some((definition) => definition.id === selectedQuestId)
    ) {
      selectedQuestId = visibleDefinitions[0]?.id
      isAbandonConfirmVisible = false
    }

    const selectedDefinition = selectedQuestId
      ? getQuestDefinition(selectedQuestId)
      : undefined
    const selectedQuest = selectedQuestId
      ? getQuestProgress(questLog, selectedQuestId)
      : undefined
    const uiScale = getResponsiveUiScale()
    const renderSignature = JSON.stringify({
      uiScale,
      playerName: getPlayerName(),
      selectedQuestId,
      listMode,
      isAbandonConfirmVisible,
      quests: visibleDefinitions.map((definition) => {
        const quest = getQuestProgress(questLog, definition.id)

        return {
          id: definition.id,
          status: quest.status,
          objectives: quest.objectives,
          trackerVisible: quest.trackerVisible
        }
      })
    })

    if (previousRenderSignature === renderSignature) {
      return
    }

    previousRenderSignature = renderSignature

    panel.style.transform = `translate(-50%, -50%) scale(${uiScale})`
    summary.textContent =
      listMode === 'active'
        ? `${visibleDefinitions.length}개 진행 중`
        : `${visibleDefinitions.length}개 완료`
    for (const [tab, mode] of [
      [regionTab, 'active'],
      [completedTab, 'completed']
    ] as const) {
      tab.classList.toggle('quest-log-overlay__tab--active', listMode === mode)
      tab.setAttribute('aria-pressed', String(listMode === mode))
    }
    emptyState.textContent =
      listMode === 'active' ? '진행 중인 퀘스트가 없습니다' : '아직 완료한 퀘스트가 없습니다'
    renderQuestList(visibleDefinitions)
    renderQuestDetail(selectedDefinition, selectedQuest)
  }

  const renderQuestList = (definitions: QuestDefinition[]) => {
    questList.replaceChildren()
    emptyState.hidden = definitions.length > 0
    emptyState.style.display = definitions.length > 0 ? 'none' : ''

    for (const definition of definitions) {
      const questButton = document.createElement('button')
      const isSelected = definition.id === selectedQuestId

      questButton.type = 'button'
      questButton.className = 'quest-log-overlay__quest-row'
      questButton.classList.toggle('quest-log-overlay__quest-row--active', isSelected)
      questButton.textContent = `[${definition.giverName}] ${definition.title}`
      questButton.setAttribute('aria-pressed', String(isSelected))
      questButton.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        selectedQuestId = definition.id
        isAbandonConfirmVisible = false
        syncFrame()
      })

      questList.append(questButton)
    }
  }

  const renderQuestDetail = (
    definition: QuestDefinition | undefined,
    quest: QuestProgress | undefined
  ) => {
    const hasQuest = definition !== undefined && quest !== undefined

    detailPane.classList.toggle('quest-log-overlay__detail-pane--empty', !hasQuest)
    detailEmptyState.hidden = hasQuest
    detailEmptyState.style.display = hasQuest ? 'none' : ''
    detailHeader.hidden = !hasQuest
    detailHeader.style.display = hasQuest ? '' : 'none'
    requestText.hidden = !hasQuest
    requestText.style.display = hasQuest ? '' : 'none'
    guideText.hidden = !hasQuest
    guideText.style.display = hasQuest ? '' : 'none'
    objectiveList.hidden = !hasQuest
    objectiveList.style.display = hasQuest ? '' : 'none'
    actionRow.hidden = !hasQuest
    actionRow.style.display = hasQuest ? '' : 'none'
    confirmPanel.hidden = !hasQuest || !isAbandonConfirmVisible
    confirmPanel.style.display = hasQuest && isAbandonConfirmVisible ? '' : 'none'

    if (!hasQuest) {
      detailTitle.textContent = '선택된 퀘스트가 없습니다'
      detailMeta.textContent = ''
      requestText.textContent = ''
      guideText.textContent = ''
      objectiveList.replaceChildren()
      return
    }

    setPortraitFrame(portrait, getQuestGiverPortraitFrame(definition.giverNpcId))
    detailTitle.textContent = definition.title
    detailMeta.textContent = `[${definition.giverName}] ${definition.regionName}`
    const questTextContext = {
      playerName: getPlayerName()
    }

    requestText.textContent = formatQuestText(
      definition.requestText,
      questTextContext
    )
    guideText.textContent = formatQuestText(definition.guideText, questTextContext)
    // 완료한 퀘스트는 알림·포기 대신 '대화 다시 보기'만.
    const isCompleted = quest.status === 'completed'
    trackerToggleButton.style.display = isCompleted ? 'none' : ''
    abandonButton.style.display = isCompleted ? 'none' : ''
    replayButton.style.display = isCompleted ? '' : 'none'
    trackerToggleButton.classList.toggle(
      'quest-log-overlay__tracker-toggle--active',
      quest.trackerVisible
    )
    trackerToggleButton.setAttribute('aria-pressed', String(quest.trackerVisible))
    objectiveList.replaceChildren(
      ...definition.objectives.map((objective) => {
        const objectiveRow = document.createElement('div')

        objectiveRow.className = 'quest-log-overlay__objective-row'
        objectiveRow.append(
          document.createTextNode(
            `${objective.label}: ${isCompleted ? objective.required : (quest.objectives[objective.id] ?? 0)}/${objective.required}`
          )
        )
        // 대상(몬스터/아이템)에 파란 밑줄 링크 — 클릭하면 이미지 팝업.
        const targetLink = createQuestTargetLink(objective)
        if (targetLink) {
          objectiveRow.append(document.createTextNode(' '), targetLink)
        }
        return objectiveRow
      })
    )
  }

  const selectListMode = (mode: 'active' | 'completed') => (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (listMode === mode) {
      return
    }
    listMode = mode
    selectedQuestId = undefined
    isAbandonConfirmVisible = false
    syncFrame()
  }
  regionTab.addEventListener('click', selectListMode('active'))
  completedTab.addEventListener('click', selectListMode('completed'))

  replayButton.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (selectedQuestId) {
      onRequestReplayDialogue(getQuestDefinition(selectedQuestId))
    }
  })

  trackerToggleButton.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (!selectedQuestId) {
      return
    }

    const quest = getQuestProgress(getQuestLog(), selectedQuestId)

    onQuestLogChange(
      setQuestTrackerVisible(getQuestLog(), selectedQuestId, !quest.trackerVisible)
    )
    isAbandonConfirmVisible = false
    syncFrame()
  })

  abandonButton.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    isAbandonConfirmVisible = true
    syncFrame()
  })

  confirmAbandonButton.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (!selectedQuestId) {
      return
    }

    onQuestLogChange(abandonQuest(getQuestLog(), selectedQuestId))
    selectedQuestId = undefined
    isAbandonConfirmVisible = false
    syncFrame()
  })

  cancelAbandonButton.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    isAbandonConfirmVisible = false
    syncFrame()
  })

  closeButton.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onRequestOpenChange(false)
  })

  syncFrame()

  return {
    syncFrame,
    destroy: () => {
      overlayRoot.remove()
    }
  }
}

const getActiveQuestDefinitions = (
  questLog: QuestLogState
): QuestDefinition[] =>
  // 정적 + 동적(에디터 생성) 퀘스트를 모두 본다. 진행도 항목이 아직 없는 동적 퀘스트는 건너뛴다.
  getVisibleQuestDefinitions().filter((definition) => {
    const quest = questLog.progressByQuestId[definition.id]

    return quest?.status === 'active' || quest?.status === 'ready-to-turn-in'
  })

const getCompletedQuestDefinitions = (
  questLog: QuestLogState
): QuestDefinition[] =>
  getVisibleQuestDefinitions().filter(
    (definition) => questLog.progressByQuestId[definition.id]?.status === 'completed'
  )

export const getQuestGiverPortraitFrame = (
  npcId: string
): QuestGiverPortraitFrame => {
  const key = QUEST_GIVER_PORTRAIT_KEY_BY_NPC_ID[npcId] ?? 'character_wizard_purple'
  const index = Math.max(0, LPC_PORTRAIT_KEYS.indexOf(key))
  return { x: index * LPC_PORTRAIT_SIZE, y: 0, width: LPC_PORTRAIT_SIZE, height: LPC_PORTRAIT_SIZE }
}

const setPortraitFrame = (
  element: HTMLElement,
  frame: QuestGiverPortraitFrame,
  scale = PORTRAIT_SCALE
) => {
  element.style.backgroundImage = `url(${LPC_PORTRAIT_ATLAS_URL})`
  element.style.backgroundRepeat = 'no-repeat'
  element.style.backgroundPosition = `-${frame.x * scale}px -${frame.y * scale}px`
  element.style.backgroundSize = `${LPC_PORTRAIT_KEYS.length * LPC_PORTRAIT_SIZE * scale}px ${LPC_PORTRAIT_SIZE * scale}px`
  element.style.imageRendering = 'pixelated'
  element.style.width = `${frame.width * scale}px`
  element.style.height = `${frame.height * scale}px`
}

// 퀘스트 창 밖(2장 약초 상점 등)에서도 LPC NPC 얼굴을 같은 그림으로 쓴다.
export const setNpcPortrait = (element: HTMLElement, npcId: string, scale = PORTRAIT_SCALE) =>
  setPortraitFrame(element, getQuestGiverPortraitFrame(npcId), scale)
