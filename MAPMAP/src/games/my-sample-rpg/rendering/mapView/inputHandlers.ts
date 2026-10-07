// 입력 처리: 키 누름/뗌(이동·공격·구르기·스킬·퀵슬롯·창 단축키·키 설정 입력), 창 포커스 잃음,
// 휠 확대, 창 크기 변경, 탭 숨김. 맵 화면의 상태는 ctx 로 받는다.
import type { PlayerQuickslots } from '../../playerQuickslots'
import type { PlayerProfile } from '../../playerProfile'
import type { PlayerInventory } from '../../playerInventory'
import type { PlayerControlBindings } from '../../playerControls'
import type { MapOverlay } from '../createMapOverlay'
import { Application } from 'pixi.js'
import type { CharacterAction, CharacterMoveDirection, CharacterState } from '../../characterState'
import { type PlayerRollState } from '../../playerRoll'
import { type PlayerControlBindingId } from '../../playerControls'
import {
  usePlayerQuickslotConsumable,
  clearPlayerQuickslotAssignment,
  getPlayerSkillSlotIndexFromCode,
  getPlayerControlActionFromCode,
  getPlayerControlMovementDirectionFromCode,
  isPlayerControlCaptureModifierKey,
  isPlayerControlPauseKey,
  setPlayerControlBinding
} from '../../lua/luaGameLogic'
import { CAMERA_ZOOM_WHEEL_SPEED } from './constants'
import { isPlayerRollModifierCode } from './tiles'
import { type PlayerRollInputState } from './types'

// 브라우저 확대/축소 단축키(Ctrl/⌘ 와 함께)
const BROWSER_ZOOM_KEY_CODES: ReadonlySet<string> = new Set([
  'Equal',
  'Minus',
  'NumpadAdd',
  'NumpadSubtract',
  'Digit0',
  'Numpad0'
])

export type InputHandlersContext = {
  app: Application
  cameraTargetCharacterId: string
  centerCameraOnCharacter: (character: CharacterState) => void
  clearPressedInputState: () => void
  closeAllOverlays: () => boolean
  getCharacterStateById: (characterId: string) => CharacterState
  getQuickslotIndexFromKeyboardEvent: (event: KeyboardEvent) => number | undefined
  handleConsumableUsed: (itemId: string) => void
  isInteractiveUiEventTarget: (target: EventTarget | null) => boolean
  mapOverlay: MapOverlay
  onPlayerInventoryChange: (nextInventory: PlayerInventory) => void
  onPlayerQuickslotsChange: (nextQuickslots: PlayerQuickslots) => void
  playerProfile: PlayerProfile
  playerRollInputState: PlayerRollInputState
  pressedActions: Set<CharacterAction>
  pressedDirections: Set<CharacterMoveDirection>
  requestPlayerPortalTransition: () => boolean
  setCameraZoom: (nextCameraZoom: number) => void
  setPauseMenuOpen: (nextIsOpen: boolean) => void
  setPlayerEquipmentOpen: (nextIsOpen: boolean) => void
  setPlayerSkillOpen: (nextIsOpen: boolean) => void
  setPlayerStatOpen: (nextIsOpen: boolean) => void
  setPlayerUiOpen: (nextIsOpen: boolean) => void
  setQuestLogOpen: (nextIsOpen: boolean) => void
  stopPlayerFootsteps: () => void
  syncPlayerUiOverlays: () => void
  syncViewportDisplayScale: () => void
  triggerPlayerRollFromPressedDirection: (now: number) => boolean
  triggeredActions: Set<CharacterAction>
  triggeredSkillSlotIndexes: Set<number>
  updatePlayerControlBindings: (nextControlBindings: PlayerControlBindings) => void
  getCameraZoom: () => number
  getCurrentPlayerControlBindings: () => PlayerControlBindings
  getIsPauseMenuOpen: () => boolean
  getIsPlayerEquipmentOpen: () => boolean
  getIsPlayerSkillOpen: () => boolean
  getIsPlayerStatOpen: () => boolean
  getIsPlayerUiOpen: () => boolean
  getIsQuestLogOpen: () => boolean
  getPlayerRollState: () => PlayerRollState | undefined
  getCurrentPlayerInventory: () => PlayerInventory
  getCurrentPlayerQuickslots: () => PlayerQuickslots
  getPendingControlBindingId: () => PlayerControlBindingId | undefined
  setCurrentPlayerInventory: (value: PlayerInventory) => void
  setCurrentPlayerQuickslots: (value: PlayerQuickslots) => void
  setPendingControlBindingId: (value: PlayerControlBindingId | undefined) => void
  setPlayerAttackQueuedAfterRoll: (value: boolean) => void
}

export const createInputHandlers = (ctx: InputHandlersContext) => {
  const {
    app,
    cameraTargetCharacterId,
    centerCameraOnCharacter,
    clearPressedInputState,
    closeAllOverlays,
    getCharacterStateById,
    getQuickslotIndexFromKeyboardEvent,
    handleConsumableUsed,
    isInteractiveUiEventTarget,
    mapOverlay,
    onPlayerInventoryChange,
    onPlayerQuickslotsChange,
    playerProfile,
    playerRollInputState,
    pressedActions,
    pressedDirections,
    requestPlayerPortalTransition,
    setCameraZoom,
    setPauseMenuOpen,
    setPlayerEquipmentOpen,
    setPlayerSkillOpen,
    setPlayerStatOpen,
    setPlayerUiOpen,
    setQuestLogOpen,
    stopPlayerFootsteps,
    syncPlayerUiOverlays,
    syncViewportDisplayScale,
    triggerPlayerRollFromPressedDirection,
    triggeredActions,
    triggeredSkillSlotIndexes,
    updatePlayerControlBindings,
    getCameraZoom,
    getCurrentPlayerControlBindings,
    getIsPauseMenuOpen,
    getIsPlayerEquipmentOpen,
    getIsPlayerSkillOpen,
    getIsPlayerStatOpen,
    getIsPlayerUiOpen,
    getIsQuestLogOpen,
    getPlayerRollState,
    getCurrentPlayerInventory,
    getCurrentPlayerQuickslots,
    getPendingControlBindingId,
    setCurrentPlayerInventory,
    setCurrentPlayerQuickslots,
    setPendingControlBindingId,
    setPlayerAttackQueuedAfterRoll
  } = ctx

  const handleKeyDown = (event: KeyboardEvent) => {
    // 게임 중에는 브라우저 확대/축소(Ctrl + -/+/0)를 막는다 — 실수로 눌러 화면 전체가 작아지는 일을 막는다.
    if ((event.ctrlKey || event.metaKey) && BROWSER_ZOOM_KEY_CODES.has(event.code)) {
      event.preventDefault()
      return
    }

    if (isEditableUiTarget(event.target)) {
      return
    }

    const code = event.code
    const skillSlotIndex = getPlayerSkillSlotIndexFromCode(code)
    const isInventoryToggleKey = code === getCurrentPlayerControlBindings().inventory
    const isStatToggleKey = code === getCurrentPlayerControlBindings().stat
    const isEquipmentToggleKey = code === getCurrentPlayerControlBindings().equipment
    const isSkillToggleKey = code === getCurrentPlayerControlBindings().skill
    const isQuestLogToggleKey = code === getCurrentPlayerControlBindings().quest
    const isMapToggleKey = code === getCurrentPlayerControlBindings().map
    const isPortalEnterKey = code === getCurrentPlayerControlBindings().portal
    const isPauseKey = isPlayerControlPauseKey(
      getCurrentPlayerControlBindings(),
      code
    )

    const pendingControlBindingId = getPendingControlBindingId()
    if (pendingControlBindingId) {
      event.preventDefault()

      if (event.repeat || isPlayerControlCaptureModifierKey(code)) {
        return
      }

      updatePlayerControlBindings(
        setPlayerControlBinding({
          bindings: getCurrentPlayerControlBindings(),
          bindingId: pendingControlBindingId,
          nextCode: code
        })
      )
      setPendingControlBindingId(undefined)
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

    if (getIsPauseMenuOpen()) {
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

        // M: 좌상단 미니맵은 늘 켜 두고, 전체 지도를 펼치고 닫는다.
        mapOverlay.toggleExpanded()
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

    // 메이플처럼 포탈 위에서 위쪽 이동 키(↑)를 누르면 포탈을 탄다. 포탈 위가 아니면 평소처럼 위로 걷는다.
    if (
      code === getCurrentPlayerControlBindings()['move-up'] &&
      !event.repeat &&
      requestPlayerPortalTransition()
    ) {
      event.preventDefault()
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
        setPlayerUiOpen(!getIsPlayerUiOpen())
      }

      return
    }

    if (isStatToggleKey) {
      if (!event.repeat) {
        event.preventDefault()
        setPlayerStatOpen(!getIsPlayerStatOpen())
      }

      return
    }

    if (isEquipmentToggleKey) {
      if (!event.repeat) {
        event.preventDefault()
        setPlayerEquipmentOpen(!getIsPlayerEquipmentOpen())
      }

      return
    }

    if (isSkillToggleKey) {
      if (!event.repeat) {
        event.preventDefault()
        setPlayerSkillOpen(!getIsPlayerSkillOpen())
      }

      return
    }

    if (isQuestLogToggleKey) {
      if (!event.repeat) {
        event.preventDefault()
        setQuestLogOpen(!getIsQuestLogOpen())
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
        getCurrentPlayerQuickslots().slots[quickslotIndex]

      if (!quickslotAssignment) {
        return
      }

      const assignedInventorySlotIndex = quickslotAssignment.inventorySlotIndex
      const assignedItem =
        getCurrentPlayerInventory().slots[assignedInventorySlotIndex]

      if (!assignedItem) {
        setCurrentPlayerQuickslots(clearPlayerQuickslotAssignment({
          quickslots: getCurrentPlayerQuickslots(),
          quickslotIndex
        }))
        onPlayerQuickslotsChange(getCurrentPlayerQuickslots())
        syncPlayerUiOverlays()
        return
      }

      const nextState = usePlayerQuickslotConsumable({
        profile: playerProfile,
        inventory: getCurrentPlayerInventory(),
        quickslots: getCurrentPlayerQuickslots(),
        quickslotIndex
      })

      if (!nextState) {
        return
      }

      event.preventDefault()
      setCurrentPlayerInventory(nextState.inventory)
      Object.assign(playerProfile, nextState.profile)
      onPlayerInventoryChange(nextState.inventory)
      handleConsumableUsed(assignedItem.id)

      if (nextState.inventory.slots[assignedInventorySlotIndex] === undefined) {
        setCurrentPlayerQuickslots(clearPlayerQuickslotAssignment({
          quickslots: getCurrentPlayerQuickslots(),
          quickslotIndex
        }))
        onPlayerQuickslotsChange(getCurrentPlayerQuickslots())
      }

      syncPlayerUiOverlays()
      return
    }

    const action = getPlayerControlActionFromCode(
      getCurrentPlayerControlBindings(),
      code
    )

    if (action) {
      event.preventDefault()

      if (
        action === 'attack' &&
        getPlayerRollState() &&
        !event.repeat
      ) {
        setPlayerAttackQueuedAfterRoll(true)
        return
      }

      if (!pressedActions.has(action)) {
        triggeredActions.add(action)
      }

      pressedActions.add(action)
      return
    }

    const direction = getPlayerControlMovementDirectionFromCode(
      getCurrentPlayerControlBindings(),
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
      getCurrentPlayerControlBindings(),
      code
    )

    if (action) {
      pressedActions.delete(action)
      return
    }

    const direction = getPlayerControlMovementDirectionFromCode(
      getCurrentPlayerControlBindings(),
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

    // Ctrl + 휠·터치패드 핀치는 카메라 줌으로 쓰지 않는다(브라우저 줌은 handleWindowWheel 이 막는다).
    if (event.deltaY === 0 || event.ctrlKey) {
      return
    }

    setCameraZoom(getCameraZoom() * Math.exp(-event.deltaY * CAMERA_ZOOM_WHEEL_SPEED))
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

  // 게임 화면 밖(HUD·창 위)에서도 Ctrl + 휠·핀치로 브라우저가 축소되지 않게 막는다.
  const handleWindowWheel = (event: WheelEvent) => {
    if (event.ctrlKey) {
      event.preventDefault()
    }
  }

  return {
    handleKeyDown,
    handleKeyUp,
    handleViewportWheel,
    handleWindowWheel,
    handleVisibilityChange,
    handleWindowBlur,
    handleWindowResize
  }
}
