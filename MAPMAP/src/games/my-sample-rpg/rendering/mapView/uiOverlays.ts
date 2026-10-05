// UI 창 만들기: HUD·인벤토리·장비·스탯·스킬·상점(대장간·물약·약초)·상태 효과·보스 체력·
// 일시정지·퀘스트 창·퀘스트 추적기, 지하 비네트. 창 콜백을 맵 화면 상태에 잇는다. 맵 화면의 상태는 ctx 로 받는다.
import type { StatusEffectPill } from '../createStatusEffectsOverlay'
import type { QuestDefinition } from '../../questLog'
import type { PlayerSkillSlots } from '../../playerSkillSlots'
import type { PlayerQuickslots } from '../../playerQuickslots'
import type { PlayerProfile } from '../../playerProfile'
import type { PlayerInventory } from '../../playerInventory'
import type { PlayerEquipment } from '../../playerEquipment'
import type { BossHealthView } from '../createBossHealthOverlay'
import type { CharacterState } from '../../characterState'
import { type PlayerControlBindingId, type PlayerControlBindings } from '../../playerControls'
import { type QuestLogState } from '../../questLog'
import { createBlacksmithShopOverlay } from '../createBlacksmithShopOverlay'
import { createPotionShopOverlay } from '../createPotionShopOverlay'
import { createPlayerEquipmentOverlay } from '../createPlayerEquipmentOverlay'
import { createPlayerHudOverlay } from '../createPlayerHudOverlay'
import { createPlayerInventoryOverlay } from '../createPlayerInventoryOverlay'
import { createPlayerStatOverlay } from '../createPlayerStatOverlay'
import { createPlayerSkillOverlay } from '../createPlayerSkillOverlay'
import { createPauseMenuOverlay, type AudioSettings } from '../createPauseMenuOverlay'
import { createQuestLogOverlay } from '../createQuestLogOverlay'
import { createQuestTrackerOverlay } from '../createQuestTrackerOverlay'
import { createStatusEffectsOverlay } from '../createStatusEffectsOverlay'
import { createBossHealthOverlay } from '../createBossHealthOverlay'
import { isUndergroundScene } from '../mapLights'
import { HERBALIST_SHOP_NPC_IDS } from './constants'

export type UiOverlaysContext = {
  getStatusEffectPills: () => StatusEffectPill[]
  handleConsumableUsed: (itemId: string) => void
  luaBlacksmithPricing: { getSellPriceById: (itemId: string) => number | undefined; }
  mountElement: HTMLElement
  onHerbalistInventoryChange: (nextInventory: PlayerInventory) => void
  onMerchantInventoryChange: (nextInventory: PlayerInventory) => void
  onPlayerEquipmentChange: (nextEquipment: PlayerEquipment) => void
  onPlayerInventoryChange: (nextInventory: PlayerInventory) => void
  onPlayerQuickslotsChange: (nextQuickslots: PlayerQuickslots) => void
  onPlayerSkillSlotsChange: (nextSkillSlots: PlayerSkillSlots) => void
  onPotionMerchantInventoryChange: (nextInventory: PlayerInventory) => void
  playerProfile: PlayerProfile
  recordAcquiredItemsFromInventoryDelta: (previousInventory: PlayerInventory, nextInventory: PlayerInventory) => void
  resetPlayerControlBindings: () => void
  sceneId: string
  setBlacksmithShopOpen: (nextIsOpen: boolean) => void
  setControlBindingCaptureTarget: (bindingId: PlayerControlBindingId | undefined) => void
  setHerbalistShopOpen: (nextIsOpen: boolean) => void
  setPauseMenuOpen: (nextIsOpen: boolean) => void
  setPlayerEquipmentOpen: (nextIsOpen: boolean) => void
  setPlayerSkillOpen: (nextIsOpen: boolean) => void
  setPlayerStatOpen: (nextIsOpen: boolean) => void
  setPlayerUiOpen: (nextIsOpen: boolean) => void
  setPotionShopOpen: (nextIsOpen: boolean) => void
  setQuestLog: (nextQuestLog: QuestLogState) => void
  setQuestLogOpen: (nextIsOpen: boolean) => void
  showRemoteQuestGiverDialogue: (definition: QuestDefinition, lines: string[], fromRemoteSpeaker?: boolean) => void
  syncPlayerUiOverlays: () => void
  updateCurrentAudioSettings: (nextAudioSettings: AudioSettings) => void
  getActiveBossView: () => BossHealthView | undefined
  getCharacterStates: () => CharacterState[]
  getCurrentAudioSettings: () => AudioSettings
  getCurrentPlayerControlBindings: () => PlayerControlBindings
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
  getPendingControlBindingId: () => PlayerControlBindingId | undefined
  getSyncPlayerCharacterVisual: () => (nowMilliseconds?: number) => void
  getCurrentBlacksmithInventory: () => PlayerInventory
  getCurrentHerbalistInventory: () => PlayerInventory
  getCurrentPlayerEquipment: () => PlayerEquipment
  getCurrentPlayerInventory: () => PlayerInventory
  getCurrentPlayerQuickslots: () => PlayerQuickslots
  getCurrentPlayerSkillSlots: () => PlayerSkillSlots
  getCurrentPotionMerchantInventory: () => PlayerInventory
  setBossHealthOverlay: (value: { syncFrame: () => void; destroy: () => void; }) => void
  setCurrentBlacksmithInventory: (value: PlayerInventory) => void
  setCurrentHerbalistInventory: (value: PlayerInventory) => void
  setCurrentPlayerEquipment: (value: PlayerEquipment) => void
  setCurrentPlayerInventory: (value: PlayerInventory) => void
  setCurrentPlayerQuickslots: (value: PlayerQuickslots) => void
  setCurrentPlayerSkillSlots: (value: PlayerSkillSlots) => void
  setCurrentPotionMerchantInventory: (value: PlayerInventory) => void
  setHerbalistShopOverlay: (value: { syncFrame: () => void; destroy: () => void; }) => void
  setPauseMenuOverlay: (value: { syncFrame: () => void; destroy: () => void; }) => void
  setPlayerEquipmentOverlay: (value: { syncFrame: () => void; destroy: () => void; }) => void
  setPlayerHudOverlay: (value: { syncFrame: () => void; destroy: () => void; }) => void
  setPlayerInventoryOverlay: (value: { syncFrame: () => void; destroy: () => void; }) => void
  setPlayerShopOverlay: (value: { syncFrame: () => void; destroy: () => void; }) => void
  setPlayerSkillOverlay: (value: { syncFrame: () => void; destroy: () => void; }) => void
  setPlayerStatOverlay: (value: { syncFrame: () => void; destroy: () => void; }) => void
  setPotionShopOverlay: (value: { syncFrame: () => void; destroy: () => void; }) => void
  setQuestLogOverlay: (value: { syncFrame: () => void; destroy: () => void; }) => void
  setQuestTrackerOverlay: (value: { syncFrame: () => void; destroy: () => void; }) => void
  setStatusEffectsOverlay: (value: { syncFrame: () => void; destroy: () => void; }) => void
}

export const createUiOverlays = (ctx: UiOverlaysContext) => {
  const {
    getStatusEffectPills,
    handleConsumableUsed,
    luaBlacksmithPricing,
    mountElement,
    onHerbalistInventoryChange,
    onMerchantInventoryChange,
    onPlayerEquipmentChange,
    onPlayerInventoryChange,
    onPlayerQuickslotsChange,
    onPlayerSkillSlotsChange,
    onPotionMerchantInventoryChange,
    playerProfile,
    recordAcquiredItemsFromInventoryDelta,
    resetPlayerControlBindings,
    sceneId,
    setBlacksmithShopOpen,
    setControlBindingCaptureTarget,
    setHerbalistShopOpen,
    setPauseMenuOpen,
    setPlayerEquipmentOpen,
    setPlayerSkillOpen,
    setPlayerStatOpen,
    setPlayerUiOpen,
    setPotionShopOpen,
    setQuestLog,
    setQuestLogOpen,
    showRemoteQuestGiverDialogue,
    syncPlayerUiOverlays,
    updateCurrentAudioSettings,
    getActiveBossView,
    getCharacterStates,
    getCurrentAudioSettings,
    getCurrentPlayerControlBindings,
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
    getPendingControlBindingId,
    getSyncPlayerCharacterVisual,
    getCurrentBlacksmithInventory,
    getCurrentHerbalistInventory,
    getCurrentPlayerEquipment,
    getCurrentPlayerInventory,
    getCurrentPlayerQuickslots,
    getCurrentPlayerSkillSlots,
    getCurrentPotionMerchantInventory,
    setBossHealthOverlay,
    setCurrentBlacksmithInventory,
    setCurrentHerbalistInventory,
    setCurrentPlayerEquipment,
    setCurrentPlayerInventory,
    setCurrentPlayerQuickslots,
    setCurrentPlayerSkillSlots,
    setCurrentPotionMerchantInventory,
    setHerbalistShopOverlay,
    setPauseMenuOverlay,
    setPlayerEquipmentOverlay,
    setPlayerHudOverlay,
    setPlayerInventoryOverlay,
    setPlayerShopOverlay,
    setPlayerSkillOverlay,
    setPlayerStatOverlay,
    setPotionShopOverlay,
    setQuestLogOverlay,
    setQuestTrackerOverlay,
    setStatusEffectsOverlay
  } = ctx

  setPlayerHudOverlay(createPlayerHudOverlay({
    mountElement,
    profile: playerProfile,
    getInventory: () => getCurrentPlayerInventory(),
    getQuickslots: () => getCurrentPlayerQuickslots(),
    getSkillSlots: () => getCurrentPlayerSkillSlots(),
    onRequestQuickslotChange: (nextQuickslots) => {
      setCurrentPlayerQuickslots(nextQuickslots)
      onPlayerQuickslotsChange(nextQuickslots)
      syncPlayerUiOverlays()
    },
    onRequestSkillSlotsChange: (nextSkillSlots) => {
      setCurrentPlayerSkillSlots(nextSkillSlots)
      onPlayerSkillSlotsChange(nextSkillSlots)
      syncPlayerUiOverlays()
    }
  }))
  setPlayerInventoryOverlay(createPlayerInventoryOverlay({
    mountElement,
    profile: playerProfile,
    getInventory: () => getCurrentPlayerInventory(),
    getQuickslots: () => getCurrentPlayerQuickslots(),
    getEquipment: () => getCurrentPlayerEquipment(),
    getIsOpen: () => getIsPlayerUiOpen(),
    onRequestOpenChange: setPlayerUiOpen,
    onRequestInventoryChange: (nextInventory) => {
      setCurrentPlayerInventory(nextInventory)
      onPlayerInventoryChange(nextInventory)
      syncPlayerUiOverlays()
    },
    onRequestEquipmentChange: (nextEquipment) => {
      setCurrentPlayerEquipment(nextEquipment)
      onPlayerEquipmentChange(nextEquipment)
      getSyncPlayerCharacterVisual()()
      syncPlayerUiOverlays()
    },
    onRequestProfileChange: (nextProfile) => {
      Object.assign(playerProfile, nextProfile)
      syncPlayerUiOverlays()
    },
    onConsumableUsed: handleConsumableUsed
  }))
  setPlayerEquipmentOverlay(createPlayerEquipmentOverlay({
    mountElement,
    profile: playerProfile,
    getInventory: () => getCurrentPlayerInventory(),
    getEquipment: () => getCurrentPlayerEquipment(),
    getIsOpen: () => getIsPlayerEquipmentOpen(),
    onRequestOpenChange: setPlayerEquipmentOpen,
    onRequestInventoryChange: (nextInventory) => {
      setCurrentPlayerInventory(nextInventory)
      onPlayerInventoryChange(nextInventory)
      syncPlayerUiOverlays()
    },
    onRequestEquipmentChange: (nextEquipment) => {
      setCurrentPlayerEquipment(nextEquipment)
      onPlayerEquipmentChange(nextEquipment)
      getSyncPlayerCharacterVisual()()
      syncPlayerUiOverlays()
    }
  }))
  setPlayerStatOverlay(createPlayerStatOverlay({
    mountElement,
    profile: playerProfile,
    getIsOpen: () => getIsPlayerStatOpen(),
    onRequestOpenChange: setPlayerStatOpen,
    onRequestProfileChange: (nextProfile) => {
      Object.assign(playerProfile, nextProfile)
      syncPlayerUiOverlays()
    }
  }))
  setPlayerSkillOverlay(createPlayerSkillOverlay({
    mountElement,
    profile: playerProfile,
    getIsOpen: () => getIsPlayerSkillOpen(),
    onRequestOpenChange: setPlayerSkillOpen,
    onRequestProfileChange: (nextProfile) => {
      Object.assign(playerProfile, nextProfile)
      syncPlayerUiOverlays()
    }
  }))
  setPlayerShopOverlay(createBlacksmithShopOverlay({
    mountElement,
    getPlayerName: () => playerProfile.name,
    getPlayerInventory: () => getCurrentPlayerInventory(),
    getMerchantInventory: () => getCurrentBlacksmithInventory(),
    getIsOpen: () => getIsBlacksmithShopOpen(),
    onRequestOpenChange: setBlacksmithShopOpen,
    onRequestTradeStateChange: (
      nextPlayerInventory,
      nextMerchantInventory
    ) => {
      const previousPlayerInventory = getCurrentPlayerInventory()
      setCurrentPlayerInventory(nextPlayerInventory)
      setCurrentBlacksmithInventory(nextMerchantInventory)
      onPlayerInventoryChange(nextPlayerInventory)
      onMerchantInventoryChange(nextMerchantInventory)
      // 구매로 늘어난 아이템에 "획득" 퀘스트 진행을 기록한다.
      recordAcquiredItemsFromInventoryDelta(
        previousPlayerInventory,
        nextPlayerInventory
      )
      syncPlayerUiOverlays()
    },
    getSellPriceById: luaBlacksmithPricing.getSellPriceById
  }))
  setPotionShopOverlay(createPotionShopOverlay({
    mountElement,
    getPlayerName: () => playerProfile.name,
    getPlayerInventory: () => getCurrentPlayerInventory(),
    getMerchantInventory: () => getCurrentPotionMerchantInventory(),
    getIsOpen: () => getIsPotionShopOpen(),
    onRequestOpenChange: setPotionShopOpen,
    onRequestTradeStateChange: (
      nextPlayerInventory,
      nextMerchantInventory
    ) => {
      const previousPlayerInventory = getCurrentPlayerInventory()
      setCurrentPlayerInventory(nextPlayerInventory)
      setCurrentPotionMerchantInventory(nextMerchantInventory)
      onPlayerInventoryChange(nextPlayerInventory)
      onPotionMerchantInventoryChange(nextMerchantInventory)
      recordAcquiredItemsFromInventoryDelta(
        previousPlayerInventory,
        nextPlayerInventory
      )
      syncPlayerUiOverlays()
    }
  }))
  const sceneHerbalist = getCharacterStates().find((character) => HERBALIST_SHOP_NPC_IDS.has(character.id))
  setHerbalistShopOverlay(createPotionShopOverlay({
    mountElement,
    merchantName: sceneHerbalist?.displayText ?? '약초꾼 오디',
    title: sceneHerbalist?.id === 'irma' ? '약재상' : '약초 상점',
    merchantPortraitNpcId: sceneHerbalist?.id ?? 'odi',
    getPlayerName: () => playerProfile.name,
    getPlayerInventory: () => getCurrentPlayerInventory(),
    getMerchantInventory: () => getCurrentHerbalistInventory(),
    getIsOpen: () => getIsHerbalistShopOpen(),
    onRequestOpenChange: setHerbalistShopOpen,
    onRequestTradeStateChange: (nextPlayerInventory, nextMerchantInventory) => {
      const previousPlayerInventory = getCurrentPlayerInventory()
      setCurrentPlayerInventory(nextPlayerInventory)
      setCurrentHerbalistInventory(nextMerchantInventory)
      onPlayerInventoryChange(nextPlayerInventory)
      onHerbalistInventoryChange(nextMerchantInventory)
      recordAcquiredItemsFromInventoryDelta(previousPlayerInventory, nextPlayerInventory)
      syncPlayerUiOverlays()
    }
  }))
  setStatusEffectsOverlay(createStatusEffectsOverlay({ mountElement, getPills: getStatusEffectPills }))
  setBossHealthOverlay(createBossHealthOverlay({ mountElement, getBoss: () => getActiveBossView() }))
  // 지하 장면 비네트(mapLights.isUndergroundScene) — 화면 가장자리를 살짝 어둡게
  const sceneVignetteElement = isUndergroundScene(sceneId) ? document.createElement('div') : undefined
  if (sceneVignetteElement) {
    sceneVignetteElement.className = 'scene-vignette'
    mountElement.append(sceneVignetteElement)
  }
  setPauseMenuOverlay(createPauseMenuOverlay({
    mountElement,
    getIsOpen: () => getIsPauseMenuOpen(),
    getAudioSettings: () => getCurrentAudioSettings(),
    getControlBindings: () => getCurrentPlayerControlBindings(),
    getControlBindingCaptureTarget: () => getPendingControlBindingId(),
    onRequestOpenChange: setPauseMenuOpen,
    onAudioSettingsChange: updateCurrentAudioSettings,
    onRequestControlBindingCapture: setControlBindingCaptureTarget,
    onRequestControlBindingsReset: resetPlayerControlBindings
  }))
  setQuestLogOverlay(createQuestLogOverlay({
    mountElement,
    getIsOpen: () => getIsQuestLogOpen(),
    getQuestLog: () => getCurrentQuestLog(),
    getPlayerName: () => playerProfile.name,
    onRequestOpenChange: setQuestLogOpen,
    onQuestLogChange: setQuestLog,
    onRequestReplayDialogue: (definition) => {
      setQuestLogOpen(false)
      showRemoteQuestGiverDialogue(definition, [
        ...definition.startDialogueLines,
        ...definition.completionDialogueLines
      ])
    }
  }))
  setQuestTrackerOverlay(createQuestTrackerOverlay({
    mountElement,
    getQuestLog: () => getCurrentQuestLog(),
    onQuestLogChange: setQuestLog
  }))

  return {
    sceneVignetteElement
  }
}
