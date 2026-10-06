// 에디터 → 실행 중 게임 적용: 이벤트 초안(대사 NPC·보상), Lua 컨트롤러 코드 핫 적용,
// Lua 쓰기 채널 액션(아이템 지급·회수, NPC config). 맵 화면의 상태는 ctx 로 받는다.
import type { CharacterState } from '../../characterState'
import type { EventReward, HolidayDialogueEventSpec } from '../../eventGeneration'
import { type PlayerInventory } from '../../playerInventory'
import {
  findFirstEmptyPlayerInventorySlotIndex,
  setPlayerInventorySlot,
  getPlayerEquipmentItemDefinitionById,
  createLuaCharacterController
} from '../../lua/luaGameLogic'
import { MATERIAL_ITEM_LABEL_BY_ID, STACKABLE_QUEST_REWARD_ITEM_IDS } from './questRewards'
import { type ApplyEventDraftInput, type ApplyEventDraftResult, type CreatePixiTiledMapViewInput } from './types'

export type EditorEventApplyContext = {
  controllerRuntime: CreatePixiTiledMapViewInput['controllerRuntime']
  onPlayerInventoryChange: (nextInventory: PlayerInventory) => void
  grantPlayerExperienceReward: (experienceReward: number) => void
  syncCharacterSprite: (character: CharacterState) => void
  syncQuestNpcBadges: () => void
  showCharacterMessage: (characterId: string, message: string, durationMilliseconds: number) => void
  getCharacterStates: () => CharacterState[]
  setCharacterStates: (value: CharacterState[]) => void
  getCurrentPlayerInventory: () => PlayerInventory
  setCurrentPlayerInventory: (value: PlayerInventory) => void
}

export const createEditorEventApply = (ctx: EditorEventApplyContext) => {
  const {
    controllerRuntime,
    onPlayerInventoryChange,
    grantPlayerExperienceReward,
    syncCharacterSprite,
    syncQuestNpcBadges,
    showCharacterMessage,
    getCharacterStates,
    getCurrentPlayerInventory,
    setCharacterStates,
    setCurrentPlayerInventory
  } = ctx


  // 이벤트 보상을 실제로 지급한다(아이템/골드/경험치). v1은 이벤트 적용 시점에 지급한다.
  // (추후: 플레이어가 그 이벤트를 실제로 트리거할 때 지급하려면 상호작용 완료 훅이 필요하다.)
  const grantEventReward = (reward: EventReward): void => {
    if (reward.type === 'none' || reward.count <= 0) {
      return
    }

    if (reward.type === 'gold') {
      setCurrentPlayerInventory({
        ...getCurrentPlayerInventory(),
        gold: getCurrentPlayerInventory().gold + reward.count
      })
      onPlayerInventoryChange(getCurrentPlayerInventory())
      return
    }

    if (reward.type === 'experience') {
      grantPlayerExperienceReward(reward.count)
      return
    }

    // type === 'item'
    if (reward.id.length === 0) {
      return
    }
    const slotIndex = findFirstEmptyPlayerInventorySlotIndex(getCurrentPlayerInventory())
    if (slotIndex === undefined) {
      return // 인벤토리가 가득 차면 조용히 건너뛴다.
    }
    const label = getPlayerEquipmentItemDefinitionById(reward.id)?.label ?? reward.id
    setCurrentPlayerInventory(setPlayerInventorySlot({
      inventory: getCurrentPlayerInventory(),
      slotIndex,
      item: { id: reward.id, label, quantity: reward.count }
    }))
    onPlayerInventoryChange(getCurrentPlayerInventory())
  }

  // Phase 3 쓰기 채널 적용기: Lua 가 요청한 액션을 기존 상태 변경 경로로 반영한다.
  const grantInventoryItem = (itemId: string, quantity: number) => {
    if (itemId.length === 0 || quantity <= 0) {
      return
    }
    // 재료류(광석 등)는 같은 슬롯에 쌓는다 — 채굴처럼 반복 지급되는 아이템이
    // 슬롯을 하나씩 먹어치우지 않게. 스택 대상 목록은 퀘스트 보상과 공유한다.
    if (STACKABLE_QUEST_REWARD_ITEM_IDS.has(itemId)) {
      const stackSlotIndex = getCurrentPlayerInventory().slots.findIndex(
        (slot) => slot?.id === itemId
      )
      if (stackSlotIndex >= 0) {
        const stack = getCurrentPlayerInventory().slots[stackSlotIndex]
        if (stack) {
          setCurrentPlayerInventory(setPlayerInventorySlot({
            inventory: getCurrentPlayerInventory(),
            slotIndex: stackSlotIndex,
            item: { ...stack, quantity: stack.quantity + quantity }
          }))
          onPlayerInventoryChange(getCurrentPlayerInventory())
          return
        }
      }
    }
    const slotIndex = findFirstEmptyPlayerInventorySlotIndex(getCurrentPlayerInventory())
    if (slotIndex === undefined) {
      return
    }
    const label =
      getPlayerEquipmentItemDefinitionById(itemId)?.label ??
      MATERIAL_ITEM_LABEL_BY_ID[itemId] ??
      itemId
    setCurrentPlayerInventory(setPlayerInventorySlot({
      inventory: getCurrentPlayerInventory(),
      slotIndex,
      item: { id: itemId, label, quantity }
    }))
    onPlayerInventoryChange(getCurrentPlayerInventory())
  }

  const removeInventoryItem = (itemId: string, quantity: number) => {
    if (itemId.length === 0 || quantity <= 0) {
      return
    }
    let remaining = quantity
    const nextSlots = getCurrentPlayerInventory().slots.map((slot) => {
      if (!slot || slot.id !== itemId || remaining <= 0) {
        return slot
      }
      const taken = Math.min(slot.quantity, remaining)
      remaining -= taken
      const nextQuantity = slot.quantity - taken
      return nextQuantity > 0 ? { ...slot, quantity: nextQuantity } : undefined
    })
    setCurrentPlayerInventory({ ...getCurrentPlayerInventory(), slots: nextSlots })
    onPlayerInventoryChange(getCurrentPlayerInventory())
  }

  // set-config: NPC 별 플래그를 컨트롤러 config 에 보관하고 재동기화한다(다음 상호작용에서
  // get_controller_config 로 읽힌다). config 변경은 attachment 키를 바꿔 재부착을 유발한다.
  const applyNpcConfigUpdate = (
    characterId: string,
    key: string,
    value: string
  ) => {
    const character = getCharacterStates().find((entry) => entry.id === characterId)
    if (!character || character.controller.kind !== 'lua') {
      return
    }
    const nextCharacter: CharacterState = {
      ...character,
      controller: {
        ...character.controller,
        config: { ...character.controller.config, [key]: value }
      }
    }
    setCharacterStates(getCharacterStates().map((entry) =>
      entry.id === characterId ? nextCharacter : entry
    ))
    controllerRuntime.syncCharacters(getCharacterStates())
  }

  const applyEventDraft = (
    draft: HolidayDialogueEventSpec,
    input?: ApplyEventDraftInput
  ): ApplyEventDraftResult => {
    const targetCharacter =
      resolveEventDraftTargetCharacter(input?.targetCharacterId, draft.npc.id)

    if (!targetCharacter) {
      return { didApply: false }
    }

    const nextCharacter: CharacterState = {
      ...targetCharacter,
      appearanceType: draft.npc.appearance_type,
      displayText: draft.npc.display_name,
      controller: createLuaCharacterController({
        scriptId: 'reply-with-message',
        radiusInTiles:
          targetCharacter.controller.kind === 'lua'
            ? targetCharacter.controller.radiusInTiles
            : 0,
        moveSpeedTilesPerSecond:
          targetCharacter.controller.kind === 'lua'
            ? targetCharacter.controller.moveSpeedTilesPerSecond
            : 8,
        config: {
          dialogueLines: [...draft.dialogue.opening_lines],
          messageDurationSeconds: draft.duration
        }
      })
    }

    setCharacterStates(getCharacterStates().map((character) =>
      character.id === nextCharacter.id ? nextCharacter : character
    ))

    syncCharacterSprite(nextCharacter)
    controllerRuntime.syncCharacters(getCharacterStates())
    showCharacterMessage(
      nextCharacter.id,
      draft.dialogue.opening_lines[0],
      Math.round(draft.duration * 1000)
    )
    syncQuestNpcBadges()
    grantEventReward(draft.reward)

    return {
      didApply: true,
      targetCharacterId: nextCharacter.id
    }
  }

  const resolveEventDraftTargetCharacter = (
    preferredCharacterId: string | undefined,
    fallbackCharacterId: string
  ): CharacterState | undefined => {
    if (preferredCharacterId) {
      const preferredTarget = getCharacterStates().find(
        (character) => character.id === preferredCharacterId
      )

      if (preferredTarget) {
        return preferredTarget
      }
    }

    const fallbackTarget = getCharacterStates().find(
      (character) => character.id === fallbackCharacterId
    )

    if (fallbackTarget) {
      return fallbackTarget
    }

    const santaTarget = getCharacterStates().find((character) => character.id === 'santa')

    if (santaTarget) {
      return santaTarget
    }

    return getCharacterStates().find((character) => character.controller.kind === 'lua')
  }

  // 에디터가 생성한 Lua 컨트롤러 코드를 대상 NPC에 핫 적용한다. 런타임이 Lua를 검증·재빌드하므로
  // 잘못된 코드면 updateLuaControllerScript가 throw하고, 호출부가 그 에러를 상태로 알린다.
  const applyLuaScript = (input: {
    targetCharacterId: string
    source: string
  }): ApplyEventDraftResult => {
    const targetCharacter = resolveEventDraftTargetCharacter(
      input.targetCharacterId,
      input.targetCharacterId
    )

    if (!targetCharacter) {
      return { didApply: false }
    }

    const scriptId = `generated:${targetCharacter.id}`
    controllerRuntime.updateLuaControllerScript(scriptId, { source: input.source })

    const nextCharacter: CharacterState = {
      ...targetCharacter,
      controller: createLuaCharacterController({
        scriptId,
        radiusInTiles:
          targetCharacter.controller.kind === 'lua'
            ? targetCharacter.controller.radiusInTiles
            : 0,
        moveSpeedTilesPerSecond:
          targetCharacter.controller.kind === 'lua'
            ? targetCharacter.controller.moveSpeedTilesPerSecond
            : 8
      })
    }

    setCharacterStates(getCharacterStates().map((character) =>
      character.id === nextCharacter.id ? nextCharacter : character
    ))
    syncCharacterSprite(nextCharacter)
    controllerRuntime.syncCharacters(getCharacterStates())

    return { didApply: true, targetCharacterId: nextCharacter.id }
  }

  return {
    applyEventDraft,
    applyLuaScript,
    applyNpcConfigUpdate,
    grantInventoryItem,
    removeInventoryItem
  }
}
