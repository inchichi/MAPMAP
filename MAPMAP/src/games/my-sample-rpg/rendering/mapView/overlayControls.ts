// 창 제어: 지도 펼침 시 다른 창 닫기, 모든 창 닫기(Esc), 조작 키 설정 입력 대기·변경·초기화.
// 맵 화면의 상태는 ctx 로 받는다.
import type { MapOverlay } from '../createMapOverlay'
import type { GameSoundEffects } from '../createGameSoundEffects'
import { type PlayerControlBindingId, type PlayerControlBindings } from '../../playerControls'
import { createInitialPlayerControlBindings } from '../../lua/luaGameLogic'

export type OverlayControlsContext = {
  clearPressedInputState: () => void
  gameSoundEffects: GameSoundEffects
  mapOverlay: MapOverlay
  onPlayerControlBindingsChange: (nextControlBindings: PlayerControlBindings) => void
  syncPlayerUiOverlays: () => void
  getIsHerbalistShopOpen: () => boolean
  getIsBlacksmithShopOpen: () => boolean
  getIsPauseMenuOpen: () => boolean
  getIsPlayerEquipmentOpen: () => boolean
  getIsPlayerSkillOpen: () => boolean
  getIsPlayerStatOpen: () => boolean
  getIsPlayerUiOpen: () => boolean
  getIsPotionShopOpen: () => boolean
  getIsQuestLogOpen: () => boolean
  setCurrentPlayerControlBindings: (value: PlayerControlBindings) => void
  setHandleMapOverlayExpandedChange: (value: (_isExpanded: boolean) => void) => void
  setIsBlacksmithShopOpen: (value: boolean) => void
  setIsPauseMenuOpen: (value: boolean) => void
  setIsPlayerEquipmentOpen: (value: boolean) => void
  setIsPlayerSkillOpen: (value: boolean) => void
  setIsPlayerStatOpen: (value: boolean) => void
  setIsPlayerUiOpen: (value: boolean) => void
  setIsPotionShopOpen: (value: boolean) => void
  setIsQuestLogOpen: (value: boolean) => void
  setPendingControlBindingId: (value: PlayerControlBindingId | undefined) => void
}

export const createOverlayControls = (ctx: OverlayControlsContext) => {
  const {
    clearPressedInputState,
    gameSoundEffects,
    mapOverlay,
    onPlayerControlBindingsChange,
    syncPlayerUiOverlays,
    getIsHerbalistShopOpen,
    getIsBlacksmithShopOpen,
    getIsPauseMenuOpen,
    getIsPlayerEquipmentOpen,
    getIsPlayerSkillOpen,
    getIsPlayerStatOpen,
    getIsPlayerUiOpen,
    getIsPotionShopOpen,
    getIsQuestLogOpen,
    setCurrentPlayerControlBindings,
    setHandleMapOverlayExpandedChange,
    setIsBlacksmithShopOpen,
    setIsPauseMenuOpen,
    setIsPlayerEquipmentOpen,
    setIsPlayerSkillOpen,
    setIsPlayerStatOpen,
    setIsPlayerUiOpen,
    setIsPotionShopOpen,
    setIsQuestLogOpen,
    setPendingControlBindingId
  } = ctx

  setHandleMapOverlayExpandedChange((nextIsExpanded: boolean) => {
    if (nextIsExpanded) {
      setIsPlayerUiOpen(false)
      setIsPlayerStatOpen(false)
      setIsPlayerEquipmentOpen(false)
      setIsPlayerSkillOpen(false)
      setIsQuestLogOpen(false)
      setIsBlacksmithShopOpen(false)
      setIsPotionShopOpen(false)
      setIsPauseMenuOpen(false)
      setPendingControlBindingId(undefined)
      gameSoundEffects.stopAllLoops()
    }
    clearPressedInputState()
    syncPlayerUiOverlays()
  })
  const closeAllOverlays = (): boolean => {
    if (
      !getIsPlayerUiOpen() &&
      !getIsPlayerStatOpen() &&
      !getIsPlayerEquipmentOpen() &&
      !getIsPlayerSkillOpen() &&
      !getIsQuestLogOpen() &&
      !getIsBlacksmithShopOpen() &&
      !getIsPotionShopOpen() &&
      !getIsHerbalistShopOpen() &&
      !getIsPauseMenuOpen() &&
      !mapOverlay.getIsExpanded()
    ) {
      return false
    }

    setIsPlayerUiOpen(false)
    setIsPlayerStatOpen(false)
    setIsPlayerEquipmentOpen(false)
    setIsPlayerSkillOpen(false)
    setIsQuestLogOpen(false)
    setIsBlacksmithShopOpen(false)
    setIsPotionShopOpen(false)
    setIsPauseMenuOpen(false)
    setPendingControlBindingId(undefined)
    mapOverlay.setExpanded(false)
    gameSoundEffects.stopAllLoops()
    clearPressedInputState()
    syncPlayerUiOverlays()
    return true
  }
  const setControlBindingCaptureTarget = (
    bindingId: PlayerControlBindingId | undefined
  ) => {
    setPendingControlBindingId(bindingId)
    syncPlayerUiOverlays()
  }
  const updatePlayerControlBindings = (
    nextControlBindings: PlayerControlBindings
  ) => {
    setCurrentPlayerControlBindings(nextControlBindings)
    onPlayerControlBindingsChange(nextControlBindings)
  }
  const resetPlayerControlBindings = () => {
    setPendingControlBindingId(undefined)
    updatePlayerControlBindings(createInitialPlayerControlBindings())
    syncPlayerUiOverlays()
  }

  return {
    closeAllOverlays,
    resetPlayerControlBindings,
    setControlBindingCaptureTarget,
    updatePlayerControlBindings
  }
}
