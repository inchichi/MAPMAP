// 플레이어 보상: 인벤토리 변화로 아이템 획득 퀘스트 기록, 경험치·레벨업, 퀘스트 완료 보상,
// 소모품 사용 처리. 맵 화면의 상태는 ctx 로 받는다.
import type { TextStyle } from 'pixi.js'
import type { PlayerProfile } from '../../playerProfile'
import type { GameSoundEffects } from '../createGameSoundEffects'
import { PLAYER_CHARACTER_ID } from '../../characterState'
import { type PlayerInventory } from '../../playerInventory'
import { type PlayerControlBindings } from '../../playerControls'
import {
  recordItemAcquireQuestProgress,
  recordItemUseQuestProgress,
  type CompleteQuestResult,
  type QuestLogState
} from '../../questLog'
import { grantPlayerExperience } from '../../playerExperience'
import { getPlayerControlBindingDisplayText } from '../../lua/luaGameLogic'
import {
  ANTIDOTE_INCENSE_DURATION_MILLISECONDS,
  ANTIDOTE_INCENSE_ITEM_ID,
  WARMING_TEA_DURATION_MILLISECONDS,
  WARMING_TEA_ITEM_ID
} from '../../poisonFog'
import { DAMAGE_TEXT_DURATION_MILLISECONDS, EVADE_TEXT_DURATION_MILLISECONDS, EVADE_TEXT_STYLE, LEVEL_UP_TEXT_STYLE, QUEST_COMPLETE_TEXT } from './constants'
import { addQuestItemRewardsToInventory } from './questRewards'

export type PlayerRewardsContext = {
  gameSoundEffects: GameSoundEffects
  onColdImmuneUntilChange: (immuneUntil: number) => void
  onPlayerInventoryChange: (nextInventory: PlayerInventory) => void
  onPoisonFogImmuneUntilChange: (immuneUntil: number) => void
  playerProfile: PlayerProfile
  setQuestLogWithObjectiveFeedback: (nextQuestLog: QuestLogState) => void
  syncPlayerUiOverlays: () => void
  showCharacterDamageText: (characterId: string, message: string, durationMilliseconds: number, style?: TextStyle) => void
  getCurrentPlayerControlBindings: () => PlayerControlBindings
  getCurrentQuestLog: () => QuestLogState
  getStatusEffectsOverlay: () => { syncFrame: () => void; destroy: () => void; }
  getCurrentPlayerInventory: () => PlayerInventory
  setCurrentPlayerInventory: (value: PlayerInventory) => void
}

export const createPlayerRewards = (ctx: PlayerRewardsContext) => {
  const {
    gameSoundEffects,
    onColdImmuneUntilChange,
    onPlayerInventoryChange,
    onPoisonFogImmuneUntilChange,
    playerProfile,
    setQuestLogWithObjectiveFeedback,
    syncPlayerUiOverlays,
    showCharacterDamageText,
    getCurrentPlayerControlBindings,
    getCurrentQuestLog,
    getStatusEffectsOverlay,
    getCurrentPlayerInventory,
    setCurrentPlayerInventory
  } = ctx

  // 인벤토리 id별 수량 집계.
  const countInventoryItemsById = (
    inventory: PlayerInventory
  ): Map<string, number> => {
    const counts = new Map<string, number>()
    for (const slot of inventory.slots) {
      if (slot) {
        counts.set(slot.id, (counts.get(slot.id) ?? 0) + slot.quantity)
      }
    }
    return counts
  }
  // 상점 구매처럼 어떤 아이템을 얻었는지 직접 안 알려주는 경로에서, 인벤 전/후를 비교해 늘어난
  // 아이템만큼 "획득" 퀘스트 진행을 기록한다.
  const recordAcquiredItemsFromInventoryDelta = (
    previousInventory: PlayerInventory,
    nextInventory: PlayerInventory
  ): void => {
    const previousCounts = countInventoryItemsById(previousInventory)
    let nextQuestLog = getCurrentQuestLog()
    for (const [itemId, nextCount] of countInventoryItemsById(nextInventory)) {
      const gained = nextCount - (previousCounts.get(itemId) ?? 0)
      for (let index = 0; index < gained; index += 1) {
        nextQuestLog = recordItemAcquireQuestProgress(nextQuestLog, itemId)
      }
    }
    setQuestLogWithObjectiveFeedback(nextQuestLog)
  }
  const grantPlayerExperienceReward = (experienceReward: number) => {
    const nextPlayerProgress = grantPlayerExperience(
      playerProfile,
      experienceReward
    )

    if (nextPlayerProgress.nextProfile === playerProfile) {
      return nextPlayerProgress
    }

    Object.assign(playerProfile, nextPlayerProgress.nextProfile)
    syncPlayerUiOverlays()
    if (nextPlayerProgress.levelsGained > 0) {
      gameSoundEffects.play('levelUp')
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        // 능력치 분배 안내: 무기에 맞는 능력치(검·활 = 힘, 지팡이 = 지력)를 올리도록 키를 알려 준다.
        `${
          nextPlayerProgress.levelsGained > 1
            ? `레벨 업 x${nextPlayerProgress.levelsGained}!`
            : '레벨 업!'
        }\n능력치 포인트 +${playerProfile.statPoints} (${getPlayerControlBindingDisplayText(
          getCurrentPlayerControlBindings().stat
        )}키)`,
        DAMAGE_TEXT_DURATION_MILLISECONDS,
        LEVEL_UP_TEXT_STYLE
      )
    }

    return nextPlayerProgress
  }
  const grantQuestCompletionRewards = (result: CompleteQuestResult) => {
    if (!result.didComplete) {
      return
    }

    if (result.goldReward > 0) {
      setCurrentPlayerInventory({
        ...getCurrentPlayerInventory(),
        gold: getCurrentPlayerInventory().gold + result.goldReward
      })
      onPlayerInventoryChange(getCurrentPlayerInventory())
    }

    if (result.itemRewards.length > 0) {
      setCurrentPlayerInventory(addQuestItemRewardsToInventory(
        getCurrentPlayerInventory(),
        result.itemRewards
      ))
      onPlayerInventoryChange(getCurrentPlayerInventory())
    }

    grantPlayerExperienceReward(result.experienceReward)
    showCharacterDamageText(
      PLAYER_CHARACTER_ID,
      QUEST_COMPLETE_TEXT,
      DAMAGE_TEXT_DURATION_MILLISECONDS,
      LEVEL_UP_TEXT_STYLE
    )
    syncPlayerUiOverlays()
  }
  const handleConsumableUsed = (itemId: string) => {
    if (itemId === ANTIDOTE_INCENSE_ITEM_ID) {
      onPoisonFogImmuneUntilChange(Date.now() + ANTIDOTE_INCENSE_DURATION_MILLISECONDS)
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        '해독 향을 피웠다',
        EVADE_TEXT_DURATION_MILLISECONDS * 2,
        EVADE_TEXT_STYLE
      )
      getStatusEffectsOverlay().syncFrame()
    }
    if (itemId === WARMING_TEA_ITEM_ID) {
      onColdImmuneUntilChange(Date.now() + WARMING_TEA_DURATION_MILLISECONDS)
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        '생강차를 마셨다',
        EVADE_TEXT_DURATION_MILLISECONDS * 2,
        EVADE_TEXT_STYLE
      )
      getStatusEffectsOverlay().syncFrame()
    }
    setQuestLogWithObjectiveFeedback(
      recordItemUseQuestProgress(getCurrentQuestLog(), itemId)
    )
  }

  return {
    grantPlayerExperienceReward,
    grantQuestCompletionRewards,
    handleConsumableUsed,
    recordAcquiredItemsFromInventoryDelta
  }
}
