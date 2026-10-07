import type { PlayerProfile } from '../playerProfile'
import {
  getPlayerSkillLevelLabel,
  getPlayerSkillPointCost,
  getPlayerSkillUserLevel,
  spendPlayerSkillPoint
} from '../lua/luaGameLogic'
import {
  PLAYER_SKILL_DRAG_MIME_TYPE
} from '../playerSkillSlots'
import {
  PLAYER_SKILL_IDS_IN_DISPLAY_ORDER,
  getPlayerSkillDisplayInfoById,
  getPlayerSkillProfileIndex,
  getPlayerSkillRequiredLevel,
  getPlayerSkillWeaponLine
} from '../playerSkills'
import type { PlayerWeaponLine } from '../playerEquipment'
import { PLAYER_WEAPON_LINE_LABEL } from '../playerWeaponSkills'
import { isPlayerSkillUnlockedInProfile } from '../lua/luaGameLogic'
import { getResponsiveUiScale } from './getResponsiveUiScale'

type CreatePlayerSkillOverlayInput = {
  mountElement: HTMLElement
  profile: PlayerProfile
  getIsOpen: () => boolean
  onRequestOpenChange: (isOpen: boolean) => void
  onRequestProfileChange: (nextProfile: PlayerProfile) => void
  // 창을 열 때 지금 든 무기 계열의 탭을 먼저 보여 준다.
  getEquippedWeaponLine: () => PlayerWeaponLine | undefined
  // 스킬 줄을 더블클릭하면 그 스킬을 한 번 쓴다(배움·MP 확인은 게임 쪽에서 Q·W·E·R 키와 똑같이 한다).
  onRequestUseSkill: (skillId: string) => void
}

export type PlayerSkillOverlay = {
  syncFrame: () => void
  destroy: () => void
}

const OVERLAY_MARGIN = 16
const PANEL_MIN_WIDTH = 440
const PANEL_MAX_WIDTH = 620
const PANEL_MIN_HEIGHT = 340
// 탭 하나에 스킬이 많아야 5개라 스크롤 없이 다 보이는 높이
const PANEL_MAX_HEIGHT = 660
// 아래 HUD(스킬 Q·W·E·R 칸) 높이 + 바닥 여백. 창이 이 띠를 덮으면 스킬을 끌어 놓을 칸이 가려진다.
const HUD_RESERVED_HEIGHT = 100

// 스킬 창 탭: 공통 스킬, 그다음 무기 계열(스크롤 대신 종류별로 묶는다)
type SkillCategory = 'common' | PlayerWeaponLine
const SKILL_CATEGORY_ORDER: readonly SkillCategory[] = ['common', 'sword', 'axe', 'bow', 'staff']
const getSkillCategoryLabel = (category: SkillCategory): string =>
  category === 'common' ? '공통' : PLAYER_WEAPON_LINE_LABEL[category]
const PANEL_MARGIN = 16

export const createPlayerSkillOverlay = ({
  mountElement,
  profile,
  getIsOpen,
  onRequestOpenChange,
  onRequestProfileChange,
  getEquippedWeaponLine,
  onRequestUseSkill
}: CreatePlayerSkillOverlayInput): PlayerSkillOverlay => {
  const overlayRoot = document.createElement('div')
  const backdropButton = document.createElement('button')
  const panel = document.createElement('section')
  const panelBody = document.createElement('div')
  const headerRow = document.createElement('div')
  const titleGroup = document.createElement('div')
  const titleElement = document.createElement('div')
  const summaryElement = document.createElement('div')
  const closeButton = document.createElement('button')
  const closeIcon = document.createElement('span')
  const infoCard = document.createElement('div')
  const infoName = document.createElement('div')
  const infoJob = document.createElement('div')
  const infoLevel = document.createElement('div')
  const infoHint = document.createElement('div')
  const tabBar = document.createElement('div')
  const skillGrid = document.createElement('div')
  const footerElement = document.createElement('div')
  const skillRows: HTMLButtonElement[] = []
  const skillIcons: HTMLSpanElement[] = []
  const skillHotkeys: HTMLSpanElement[] = []
  const skillNames: HTMLSpanElement[] = []
  const skillLevels: HTMLSpanElement[] = []
  const skillDescriptions: HTMLSpanElement[] = []
  const skillActions: HTMLSpanElement[] = []
  // 공통 스킬, 그다음 무기 계열마다 해금 레벨 순(playerSkills.ts)
  const visibleSkillEntries = PLAYER_SKILL_IDS_IN_DISPLAY_ORDER.map((skillId) => ({
    skillId,
    profileSkillIndex: getPlayerSkillProfileIndex(skillId) ?? -1,
    category: (getPlayerSkillWeaponLine(skillId) ?? 'common') as SkillCategory
  }))
  const tabButtons = new Map<SkillCategory, HTMLButtonElement>()
  let activeCategory: SkillCategory = 'common'
  let wasOpen = false
  let lastContentKey = ''
  let panelPosition = { left: 0, top: 0 }
  let hasPanelPosition = false
  let dragState:
    | {
        pointerId: number
        offsetX: number
        offsetY: number
        width: number
        height: number
      }
    | undefined

  overlayRoot.className = 'player-skill-overlay'

  backdropButton.type = 'button'
  backdropButton.className = 'player-skill-overlay__backdrop'
  backdropButton.hidden = true
  backdropButton.tabIndex = -1
  backdropButton.setAttribute('aria-hidden', 'true')

  panel.className = 'player-skill-overlay__panel'
  panel.hidden = true
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'false')
  panel.setAttribute('aria-labelledby', 'player-skill-overlay-title')

  panelBody.className = 'player-skill-overlay__panel-body'
  headerRow.className = 'player-skill-overlay__header'
  titleGroup.className = 'player-skill-overlay__title-group'
  titleElement.id = 'player-skill-overlay-title'
  titleElement.className = 'player-skill-overlay__title'
  titleElement.textContent = '스킬'
  summaryElement.className = 'player-skill-overlay__summary'
  summaryElement.textContent = `남은 포인트 ${profile.availableSkillPoints}`

  closeButton.type = 'button'
  closeButton.className = 'player-skill-overlay__close'
  closeButton.setAttribute('aria-label', '스킬 창 닫기')
  closeButton.title = '스킬 창 닫기 (Esc)'

  closeIcon.className = 'player-skill-overlay__close-icon'
  closeIcon.textContent = '×'
  closeIcon.setAttribute('aria-hidden', 'true')

  infoCard.className = 'player-skill-overlay__info-card'
  infoName.className = 'player-skill-overlay__info-name'
  infoName.textContent = profile.name
  infoJob.className = 'player-skill-overlay__info-job'
  infoJob.textContent = profile.job
  infoLevel.className = 'player-skill-overlay__info-level'
  infoLevel.textContent = `사용자 레벨 ${getPlayerSkillUserLevel(
    profile.totalSkillPointsEarned
  )}`
  infoHint.className = 'player-skill-overlay__info-hint'
  infoHint.textContent = '레벨업마다 스킬 포인트를 사용해 기술을 성장시킵니다'

  skillGrid.className = 'player-skill-overlay__skill-grid'
  tabBar.className = 'player-skill-overlay__tab-bar'
  tabBar.setAttribute('role', 'tablist')
  for (const category of SKILL_CATEGORY_ORDER) {
    const tabButton = document.createElement('button')
    tabButton.type = 'button'
    tabButton.className = 'player-skill-overlay__tab'
    tabButton.setAttribute('role', 'tab')
    tabButton.textContent = getSkillCategoryLabel(category)
    tabButton.addEventListener('click', () => selectCategory(category))
    tabButtons.set(category, tabButton)
    tabBar.append(tabButton)
  }
  footerElement.className = 'player-skill-overlay__footer'
  footerElement.textContent = '강화 버튼으로 강화 · 더블클릭으로 사용 · Q·W·E·R 칸으로 끌어서 장착 · Esc로 닫기'

  for (const skillEntry of visibleSkillEntries) {
    const skill = profile.skills[skillEntry.profileSkillIndex]
    const displaySkill = getPlayerSkillDisplayInfoById(skillEntry.skillId)
    const row = document.createElement('button')
    const icon = document.createElement('span')
    const hotkey = document.createElement('span')
    const content = document.createElement('div')
    const name = document.createElement('span')
    const description = document.createElement('span')
    const level = document.createElement('span')
    const action = document.createElement('span')

    row.type = 'button'
    row.className = 'player-skill-overlay__skill-row'
    row.dataset.playerSkillIndex = String(skillEntry.profileSkillIndex)
    row.dataset.playerSkillId = skillEntry.skillId
    row.setAttribute('aria-label', `${skill.label} 강화`)
    row.draggable = isPlayerSkillUnlockedInProfile(profile, skillEntry.skillId)

    icon.className = 'player-skill-overlay__skill-icon'
    icon.setAttribute('aria-hidden', 'true')

    hotkey.className = 'player-skill-overlay__skill-hotkey'
    hotkey.textContent = skill.hotkey

    content.className = 'player-skill-overlay__skill-content'
    name.className = 'player-skill-overlay__skill-name'
    name.textContent = skill.label
    description.className = 'player-skill-overlay__skill-description'
    description.textContent = getPlayerSkillDisplayInfoById(skillEntry.skillId).description
    level.className = 'player-skill-overlay__skill-level'
    level.textContent = getPlayerSkillLevelLabel(skill)
    action.className = 'player-skill-overlay__skill-action'
    action.textContent = '강화'

    content.append(name, description)
    row.append(icon, hotkey, content, level, action)
    renderSkillIcon(icon, displaySkill.iconUrl)
    skillGrid.append(row)

    skillRows.push(row)
    skillIcons.push(icon)
    skillHotkeys.push(hotkey)
    skillNames.push(name)
    skillLevels.push(level)
    skillDescriptions.push(description)
    skillActions.push(action)
  }

  titleGroup.append(titleElement, summaryElement)
  headerRow.append(titleGroup, closeButton)
  closeButton.append(closeIcon)
  infoCard.append(infoName, infoJob, infoLevel, infoHint)
  panelBody.append(headerRow, infoCard, tabBar, skillGrid, footerElement)

  // 고른 종류의 스킬만 보인다.
  function selectCategory(category: SkillCategory) {
    activeCategory = category
    for (const [tabCategory, tabButton] of tabButtons) {
      const isActive = tabCategory === category
      tabButton.classList.toggle('player-skill-overlay__tab--active', isActive)
      tabButton.setAttribute('aria-selected', String(isActive))
    }
    visibleSkillEntries.forEach((entry, index) => {
      skillRows[index].hidden = entry.category !== category
    })
  }
  selectCategory(activeCategory)
  panel.append(panelBody)
  overlayRoot.append(backdropButton, panel)
  mountElement.append(overlayRoot)

  const clampPanelPosition = (
    left: number,
    top: number,
    width: number,
    height: number
  ) => ({
    left: clamp(left, PANEL_MARGIN, Math.max(PANEL_MARGIN, window.innerWidth - width - PANEL_MARGIN)),
    top: clamp(top, PANEL_MARGIN, Math.max(PANEL_MARGIN, window.innerHeight - height - PANEL_MARGIN))
  })

  const startDragging = (event: PointerEvent) => {
    if (event.button !== 0 || panel.hidden || !event.isPrimary) {
      return
    }

    const target = event.target

    if (!(target instanceof Element) || closeButton.contains(target)) {
      return
    }

    const rect = panel.getBoundingClientRect()

    dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height
    }
    hasPanelPosition = true
    headerRow.classList.add('player-skill-overlay__header--dragging')
    event.preventDefault()
  }

  const stopDragging = (pointerId?: number) => {
    if (dragState && pointerId !== undefined && dragState.pointerId !== pointerId) {
      return
    }

    dragState = undefined
    headerRow.classList.remove('player-skill-overlay__header--dragging')
  }

  const handleDocumentPointerMove = (event: PointerEvent) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return
    }

    panelPosition = clampPanelPosition(
      event.clientX - dragState.offsetX,
      event.clientY - dragState.offsetY,
      dragState.width,
      dragState.height
    )
    panel.style.left = `${panelPosition.left}px`
    panel.style.top = `${panelPosition.top}px`
  }

  const handleDocumentPointerUp = (event: PointerEvent) => {
    stopDragging(event.pointerId)
  }

  const syncLayout = () => {
    const isOpen = getIsOpen()
    const uiScale = getResponsiveUiScale()

    overlayRoot.hidden = !isOpen
    overlayRoot.style.display = isOpen ? '' : 'none'
    overlayRoot.setAttribute('aria-hidden', String(!isOpen))

    if (!isOpen) {
      wasOpen = false
      stopDragging()
      backdropButton.hidden = true
      panel.hidden = true
      return
    }

    // 열 때마다 지금 든 무기의 탭부터
    if (!wasOpen) {
      wasOpen = true
      const weaponLine = getEquippedWeaponLine()
      selectCategory(weaponLine && SKILL_CATEGORY_ORDER.includes(weaponLine) ? weaponLine : 'common')
    }

    const availableWidth = Math.max(1, window.innerWidth - OVERLAY_MARGIN * 2)
    const hudReservedHeight = HUD_RESERVED_HEIGHT * uiScale
    const availableHeight = Math.max(
      1,
      window.innerHeight - OVERLAY_MARGIN * 2 - hudReservedHeight
    )
    // 창은 uiScale 만큼 커져 그려지므로, 화면에 남은 공간을 uiScale 로 나눈 크기 안에서 정한다
    // (큰 화면에서 UI가 커져도 아래 HUD 스킬 칸을 덮지 않게).
    const panelWidth = clamp(availableWidth / uiScale, PANEL_MIN_WIDTH, PANEL_MAX_WIDTH)
    const panelHeight = clamp(availableHeight / uiScale, PANEL_MIN_HEIGHT, PANEL_MAX_HEIGHT)
    const renderedWidth = panelWidth * uiScale
    const renderedHeight = panelHeight * uiScale
    const defaultPosition = clampPanelPosition(
      (window.innerWidth - renderedWidth) / 2,
      (window.innerHeight - hudReservedHeight - renderedHeight) / 2,
      renderedWidth,
      renderedHeight
    )

    backdropButton.hidden = false
    panel.hidden = false
    panel.style.width = `${panelWidth}px`
    panel.style.height = `${panelHeight}px`
    panel.style.transformOrigin = 'left top'
    panel.style.transform = `scale(${uiScale})`

    if (!hasPanelPosition) {
      panelPosition = defaultPosition
    } else {
      panelPosition = clampPanelPosition(
        panelPosition.left,
        panelPosition.top,
        renderedWidth,
        renderedHeight
      )
    }

    panel.style.left = `${panelPosition.left}px`
    panel.style.top = `${panelPosition.top}px`

    // 내용(글자·아이콘·강화 가능 여부)은 프로필이 바뀌었을 때만 다시 쓴다. 매 프레임 다시 쓰면 칸마다
    // Lua 호출(프로필 전체를 JSON 으로 넘김)이 돌아 창을 끌 때 크게 버벅였다.
    const contentKey = JSON.stringify([
      profile.name,
      profile.job,
      profile.level,
      profile.availableSkillPoints,
      profile.totalSkillPointsEarned,
      profile.skills.map((skill) => [skill.level, skill.hotkey, skill.label])
    ])
    if (contentKey === lastContentKey) {
      return
    }
    lastContentKey = contentKey

    infoName.textContent = profile.name
    infoJob.textContent = profile.job
    infoLevel.textContent = `사용자 레벨 ${getPlayerSkillUserLevel(
      profile.totalSkillPointsEarned
    )}`
    summaryElement.textContent = `남은 포인트 ${profile.availableSkillPoints}`

    for (let index = 0; index < visibleSkillEntries.length; index += 1) {
      const skillEntry = visibleSkillEntries[index]
      const skill = profile.skills[skillEntry.profileSkillIndex]

      if (!skill) {
        continue
      }

      const displaySkill = getPlayerSkillDisplayInfoById(skillEntry.skillId)
      const row = skillRows[index]
      const icon = skillIcons[index]
      const hotkey = skillHotkeys[index]
      const name = skillNames[index]
      const level = skillLevels[index]
      const description = skillDescriptions[index]
      const action = skillActions[index]
    const skillPointCost = getPlayerSkillPointCost(skill)
    const requiredLevel = getPlayerSkillRequiredLevel(skillEntry.skillId)
    const isLevelLocked = profile.level < requiredLevel
    const canUpgrade =
      !isLevelLocked && profile.availableSkillPoints >= skillPointCost && skillPointCost > 0
    const actionLabel =
      isLevelLocked
        ? `Lv${requiredLevel}`
        : skill.level <= 0
          ? '잠김'
          : skill.level >= skill.maxLevel
            ? 'MAX'
            : '강화'

      row.classList.toggle('player-skill-overlay__skill-row--locked', !canUpgrade)
      const isUnlocked = isPlayerSkillUnlockedInProfile(profile, skillEntry.skillId)
      row.classList.toggle('player-skill-overlay__skill-row--draggable', isUnlocked)
      row.draggable = isUnlocked
      row.title = canUpgrade
        ? `${skill.label}을 ${skillPointCost} 포인트로 올립니다`
        : isLevelLocked
          ? `레벨 ${requiredLevel}부터 배울 수 있습니다`
          : skill.level >= skill.maxLevel
            ? `${skill.label}은 이미 최대 레벨입니다`
            : '스킬 포인트가 부족합니다'
      row.setAttribute(
        'aria-label',
        canUpgrade
          ? `${skill.label} 강화`
          : skill.level >= skill.maxLevel
            ? `${skill.label} 최대 레벨`
            : `${skill.label} 강화 불가. 스킬 포인트가 부족합니다`
      )
      hotkey.textContent = skill.hotkey
      name.textContent = skill.label
      description.textContent = displaySkill.description
      level.textContent = getPlayerSkillLevelLabel(skill)
      action.textContent = actionLabel
      renderSkillIcon(icon, displaySkill.iconUrl)
    }
  }

  const handleSkillClick = (skillIndex: number) => {
    const nextProfile = spendPlayerSkillPoint(profile, skillIndex)

    if (!nextProfile) {
      return
    }

    onRequestProfileChange(nextProfile)
  }

  const handleSkillRowDragStart = (event: DragEvent) => {
    const row =
      event.currentTarget instanceof HTMLButtonElement
        ? event.currentTarget
        : undefined

    if (!row || !event.dataTransfer) {
      return
    }

    const skillId = row.dataset.playerSkillId

    if (!skillId) {
      event.preventDefault()
      return
    }

    const skillIndex = Number(row.dataset.playerSkillIndex)
    const skill = Number.isNaN(skillIndex)
      ? undefined
      : profile.skills[skillIndex]

    if (!skill || !isPlayerSkillUnlockedInProfile(profile, skillId)) {
      event.preventDefault()
      return
    }

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(PLAYER_SKILL_DRAG_MIME_TYPE, skillId)
    event.dataTransfer.setData('text/plain', skillId)

    // skillIcons 는 줄 순서다(프로필 스킬 번호가 아니다) — 다른 탭의 숨은 아이콘을 넘기면 끌리는 그림이 사라진다.
    const icon = skillIcons[skillRows.indexOf(row)]

    if (icon) {
      event.dataTransfer.setDragImage(
        icon,
        Math.round(icon.offsetWidth / 2),
        Math.round(icon.offsetHeight / 2)
      )
    }
  }

  const handlePanelClick = (event: MouseEvent) => {
    const target = event.target

    if (!(target instanceof Element)) {
      return
    }

    const skillButton = target.closest('button[data-player-skill-index]') as
      | HTMLButtonElement
      | null

    if (!skillButton) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    // 강화는 강화 버튼만 — 줄 전체가 강화면 더블클릭(사용)할 때 포인트를 두 번 쓴다.
    if (!target.closest('.player-skill-overlay__skill-action')) {
      return
    }

    const skillIndex = Number(skillButton.dataset.playerSkillIndex)

    if (!Number.isNaN(skillIndex)) {
      handleSkillClick(skillIndex)
    }
  }

  const handlePanelDoubleClick = (event: MouseEvent) => {
    const target = event.target

    if (!(target instanceof Element) || target.closest('.player-skill-overlay__skill-action')) {
      return
    }

    const skillButton = target.closest('button[data-player-skill-index]') as
      | HTMLButtonElement
      | null
    const skillId = skillButton?.dataset.playerSkillId

    if (!skillId) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    onRequestUseSkill(skillId)
  }

  const handleBackdropPointerDown = (event: PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    onRequestOpenChange(false)
  }

  const handleBackdropClick = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    stopDragging()
    onRequestOpenChange(false)
  }

  const handleCloseButtonPointerDown = (event: PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    stopDragging()
    onRequestOpenChange(false)
  }

  const handleCloseButtonClick = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    stopDragging()
    onRequestOpenChange(false)
  }

  const handleGlobalKeyDown = (event: KeyboardEvent) => {
    if (!getIsOpen() || event.key !== 'Escape') {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    onRequestOpenChange(false)
  }

  backdropButton.addEventListener('pointerdown', handleBackdropPointerDown)
  backdropButton.addEventListener('click', handleBackdropClick)
  headerRow.addEventListener('pointerdown', startDragging)
  document.addEventListener('pointermove', handleDocumentPointerMove)
  document.addEventListener('pointerup', handleDocumentPointerUp)
  document.addEventListener('pointercancel', handleDocumentPointerUp)
  closeButton.addEventListener('pointerdown', handleCloseButtonPointerDown)
  closeButton.addEventListener('click', handleCloseButtonClick)
  panel.addEventListener('click', handlePanelClick)
  panel.addEventListener('dblclick', handlePanelDoubleClick)
  document.addEventListener('keydown', handleGlobalKeyDown, true)
  for (const skillRow of skillRows) {
    skillRow.addEventListener('dragstart', handleSkillRowDragStart)
  }

  const syncFrame = () => {
    syncLayout()
  }

  const destroy = () => {
    backdropButton.removeEventListener('pointerdown', handleBackdropPointerDown)
    backdropButton.removeEventListener('click', handleBackdropClick)
    headerRow.removeEventListener('pointerdown', startDragging)
    document.removeEventListener('pointermove', handleDocumentPointerMove)
    document.removeEventListener('pointerup', handleDocumentPointerUp)
    document.removeEventListener('pointercancel', handleDocumentPointerUp)
    closeButton.removeEventListener('pointerdown', handleCloseButtonPointerDown)
    closeButton.removeEventListener('click', handleCloseButtonClick)
    panel.removeEventListener('click', handlePanelClick)
    panel.removeEventListener('dblclick', handlePanelDoubleClick)
    document.removeEventListener('keydown', handleGlobalKeyDown, true)
    for (const skillRow of skillRows) {
      skillRow.removeEventListener('dragstart', handleSkillRowDragStart)
    }
    overlayRoot.remove()
  }

  syncFrame()

  return {
    syncFrame,
    destroy
  }
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const renderSkillIcon = (
  element: HTMLSpanElement,
  iconUrl: string | undefined
) => {
  if (!iconUrl) {
    element.hidden = true
    element.style.backgroundImage = 'none'
    element.style.backgroundRepeat = 'no-repeat'
    element.style.backgroundPosition = 'center'
    element.style.backgroundSize = 'contain'
    element.style.imageRendering = 'pixelated'
    return
  }

  element.hidden = false
  element.style.backgroundImage = `url(${iconUrl})`
  element.style.backgroundRepeat = 'no-repeat'
  element.style.backgroundPosition = 'center'
  element.style.backgroundSize = 'contain'
  element.style.imageRendering = 'pixelated'
}
