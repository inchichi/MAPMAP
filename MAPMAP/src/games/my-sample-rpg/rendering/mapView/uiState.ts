// UI 상태 바꾸기: 각 창 열기/닫기(창 쌓기 순서·효과음 포함), 소리 설정, 퀘스트 기록 갱신과
// 목표 진행 알림. 맵 화면의 상태는 ctx 로 받는다.
import type { TextStyle } from 'pixi.js'
import type { MapOverlay } from '../createMapOverlay'
import type { GameSoundEffects } from '../createGameSoundEffects'
import { PLAYER_CHARACTER_ID } from '../../characterState'
import { type PlayerControlBindingId } from '../../playerControls'
import { recordShopOpenQuestProgress, type QuestLogState } from '../../questLog'
import { type AudioSettings } from '../createPauseMenuOverlay'
import { DAMAGE_TEXT_DURATION_MILLISECONDS, HERBALIST_SHOP_ID, LEVEL_UP_TEXT_STYLE, QUEST_OBJECTIVE_COMPLETE_TEXT } from './constants'

export type UiStateContext = {
  clearPressedInputState: () => void
  gameSoundEffects: GameSoundEffects
  mapOverlay: MapOverlay
  onAudioSettingsChange: (nextAudioSettings: AudioSettings) => void
  onQuestLogChange: (nextQuestLog: QuestLogState) => void
  syncPlayerUiOverlays: () => void
  showCharacterDamageText: (characterId: string, message: string, durationMilliseconds: number, style?: TextStyle) => void
  syncQuestNpcBadges: () => void
  getPauseMenuOverlay: () => { syncFrame: () => void; destroy: () => void; }
  getQuestLogOverlay: () => { syncFrame: () => void; destroy: () => void; }
  getQuestTrackerOverlay: () => { syncFrame: () => void; destroy: () => void; }
  getWindowStack: () => { raise: (selector: string) => void; destroy: () => void; }
  getCurrentAudioSettings: () => AudioSettings
  getCurrentQuestLog: () => QuestLogState
  getIsBlacksmithShopOpen: () => boolean
  getIsHerbalistShopOpen: () => boolean
  getIsPauseMenuOpen: () => boolean
  getIsPlayerEquipmentOpen: () => boolean
  getIsPlayerSkillOpen: () => boolean
  getIsPlayerStatOpen: () => boolean
  getIsPlayerUiOpen: () => boolean
  getIsPotionShopOpen: () => boolean
  getIsQuestLogOpen: () => boolean
  setCurrentAudioSettings: (value: AudioSettings) => void
  setCurrentQuestLog: (value: QuestLogState) => void
  setIsBlacksmithShopOpen: (value: boolean) => void
  setIsHerbalistShopOpen: (value: boolean) => void
  setIsPauseMenuOpen: (value: boolean) => void
  setIsPlayerEquipmentOpen: (value: boolean) => void
  setIsPlayerSkillOpen: (value: boolean) => void
  setIsPlayerStatOpen: (value: boolean) => void
  setIsPlayerUiOpen: (value: boolean) => void
  setIsPotionShopOpen: (value: boolean) => void
  setIsQuestLogOpen: (value: boolean) => void
  setPendingControlBindingId: (value: PlayerControlBindingId | undefined) => void
}

export const createUiState = (ctx: UiStateContext) => {
  const {
    clearPressedInputState,
    gameSoundEffects,
    mapOverlay,
    onAudioSettingsChange,
    onQuestLogChange,
    syncPlayerUiOverlays,
    showCharacterDamageText,
    syncQuestNpcBadges,
    getPauseMenuOverlay,
    getQuestLogOverlay,
    getQuestTrackerOverlay,
    getWindowStack,
    getCurrentAudioSettings,
    getCurrentQuestLog,
    getIsBlacksmithShopOpen,
    getIsHerbalistShopOpen,
    getIsPauseMenuOpen,
    getIsPlayerEquipmentOpen,
    getIsPlayerSkillOpen,
    getIsPlayerStatOpen,
    getIsPlayerUiOpen,
    getIsPotionShopOpen,
    getIsQuestLogOpen,
    setCurrentAudioSettings,
    setCurrentQuestLog,
    setIsBlacksmithShopOpen,
    setIsHerbalistShopOpen,
    setIsPauseMenuOpen,
    setIsPlayerEquipmentOpen,
    setIsPlayerSkillOpen,
    setIsPlayerStatOpen,
    setIsPlayerUiOpen,
    setIsPotionShopOpen,
    setIsQuestLogOpen,
    setPendingControlBindingId
  } = ctx

  const setPlayerUiOpen = (nextIsOpen: boolean) => {
    if (getIsPlayerUiOpen() === nextIsOpen) {
      return
    }

    setIsPlayerUiOpen(nextIsOpen)
    if (nextIsOpen) {
      getWindowStack().raise('.player-inventory-overlay')
    }
    syncPlayerUiOverlays()
  }
  const setPlayerStatOpen = (nextIsOpen: boolean) => {
    if (getIsPlayerStatOpen() === nextIsOpen) {
      return
    }

    setIsPlayerStatOpen(nextIsOpen)
    if (nextIsOpen) {
      getWindowStack().raise('.player-stat-overlay')
    }
    syncPlayerUiOverlays()
  }
  const setPlayerEquipmentOpen = (nextIsOpen: boolean) => {
    if (getIsPlayerEquipmentOpen() === nextIsOpen) {
      return
    }

    setIsPlayerEquipmentOpen(nextIsOpen)
    if (nextIsOpen) {
      getWindowStack().raise('.player-equipment-overlay')
    }
    syncPlayerUiOverlays()
  }
  const setPlayerSkillOpen = (nextIsOpen: boolean) => {
    if (getIsPlayerSkillOpen() === nextIsOpen) {
      return
    }

    setIsPlayerSkillOpen(nextIsOpen)
    if (nextIsOpen) {
      getWindowStack().raise('.player-skill-overlay')
    }
    syncPlayerUiOverlays()
  }
  const setQuestLogOpen = (nextIsOpen: boolean) => {
    if (getIsQuestLogOpen() === nextIsOpen) {
      return
    }

    setIsQuestLogOpen(nextIsOpen)
    if (nextIsOpen) {
      getWindowStack().raise('.quest-log-overlay')
    }
    syncPlayerUiOverlays()
  }
  const setBlacksmithShopOpen = (nextIsOpen: boolean) => {
    if (getIsBlacksmithShopOpen() === nextIsOpen) {
      return
    }

    if (nextIsOpen) {
      setIsQuestLogOpen(false)
      setIsPotionShopOpen(false)
      setIsHerbalistShopOpen(false)
    }

    setIsBlacksmithShopOpen(nextIsOpen)
    if (nextIsOpen) {
      getWindowStack().raise('.blacksmith-shop-overlay')
      setQuestLogWithObjectiveFeedback(
        recordShopOpenQuestProgress(getCurrentQuestLog(), 'blacksmith')
      )
    }
    syncPlayerUiOverlays()
  }
  const setPotionShopOpen = (nextIsOpen: boolean) => {
    if (getIsPotionShopOpen() === nextIsOpen) {
      return
    }

    if (nextIsOpen) {
      setIsQuestLogOpen(false)
      setIsBlacksmithShopOpen(false)
      setIsHerbalistShopOpen(false)
    }

    setIsPotionShopOpen(nextIsOpen)
    if (nextIsOpen) {
      getWindowStack().raise('.blacksmith-shop-overlay')
      setQuestLogWithObjectiveFeedback(
        recordShopOpenQuestProgress(getCurrentQuestLog(), 'potion')
      )
    }
    syncPlayerUiOverlays()
  }
  // 2장 갈대골 약초꾼 오디의 상점(해독 향). 물약 상점 화면을 이름·진열만 바꿔 쓴다.
  const setHerbalistShopOpen = (nextIsOpen: boolean) => {
    if (getIsHerbalistShopOpen() === nextIsOpen) {
      return
    }

    if (nextIsOpen) {
      setIsQuestLogOpen(false)
      setIsBlacksmithShopOpen(false)
      setIsPotionShopOpen(false)
    }

    setIsHerbalistShopOpen(nextIsOpen)
    if (nextIsOpen) {
      getWindowStack().raise('.blacksmith-shop-overlay')
      setQuestLogWithObjectiveFeedback(
        recordShopOpenQuestProgress(getCurrentQuestLog(), HERBALIST_SHOP_ID)
      )
    }
    syncPlayerUiOverlays()
  }
  const setPauseMenuOpen = (nextIsOpen: boolean) => {
    if (getIsPauseMenuOpen() === nextIsOpen) {
      return
    }

    setIsPauseMenuOpen(nextIsOpen)
    setPendingControlBindingId(undefined)
    if (nextIsOpen) {
      setIsPlayerUiOpen(false)
      setIsPlayerStatOpen(false)
      setIsPlayerEquipmentOpen(false)
      setIsPlayerSkillOpen(false)
      setIsQuestLogOpen(false)
      setIsBlacksmithShopOpen(false)
      setIsPotionShopOpen(false)
      setIsHerbalistShopOpen(false)
      mapOverlay.setExpanded(false)
      gameSoundEffects.stopAllLoops()
    }
    clearPressedInputState()
    syncPlayerUiOverlays()
  }
  const updateCurrentAudioSettings = (nextAudioSettings: AudioSettings) => {
    setCurrentAudioSettings(nextAudioSettings)
    // 음소거는 마스터 볼륨에 곱해 적용 — 해제 시 저장된 sfxVolume이 그대로 돌아온다.
    gameSoundEffects.setMasterVolume(
      getCurrentAudioSettings().isMuted ? 0 : getCurrentAudioSettings().sfxVolume
    )
    onAudioSettingsChange(getCurrentAudioSettings())
    getPauseMenuOverlay().syncFrame()
  }
  const setQuestLog = (nextQuestLog: QuestLogState) => {
    if (getCurrentQuestLog() === nextQuestLog) {
      return
    }

    setCurrentQuestLog(nextQuestLog)
    onQuestLogChange(nextQuestLog)
    getQuestLogOverlay().syncFrame()
    getQuestTrackerOverlay().syncFrame()
    syncQuestNpcBadges()
  }
  const setQuestLogWithObjectiveFeedback = (nextQuestLog: QuestLogState) => {
    const previousQuestLog = getCurrentQuestLog()

    if (previousQuestLog === nextQuestLog) {
      return
    }

    const didCompleteObjective = Object.entries(
      previousQuestLog.progressByQuestId
    ).some(([questId, previousQuest]) => {
      const nextQuest = nextQuestLog.progressByQuestId[questId]

      return (
        previousQuest.status === 'active' &&
        nextQuest?.status === 'ready-to-turn-in'
      )
    })

    setQuestLog(nextQuestLog)

    if (didCompleteObjective) {
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        QUEST_OBJECTIVE_COMPLETE_TEXT,
        DAMAGE_TEXT_DURATION_MILLISECONDS,
        LEVEL_UP_TEXT_STYLE
      )
    }
  }

  return {
    setBlacksmithShopOpen,
    setHerbalistShopOpen,
    setPauseMenuOpen,
    setPlayerEquipmentOpen,
    setPlayerSkillOpen,
    setPlayerStatOpen,
    setPlayerUiOpen,
    setPotionShopOpen,
    setQuestLog,
    setQuestLogOpen,
    setQuestLogWithObjectiveFeedback,
    updateCurrentAudioSettings
  }
}
