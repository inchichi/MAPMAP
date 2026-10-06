// NPC·표지석 상호작용: 시나리오(talk 트리거), 귀환 표지석 메뉴, 퀘스트 수락·완료 대사, 도착 자동 완료,
// 의뢰인 대화창, 퀘스트 NPC 상점 열기. 맵 화면의 상태는 ctx 로 받는다.
import type { TextStyle } from 'pixi.js'
import type { PlayerProfile } from '../../playerProfile'
import { getLpcNpcFullBodyUrl, getLpcNpcSheetKey } from '../lpcCharacterSprites'
import { PLAYER_CHARACTER_ID } from '../../characterState'
import type { CharacterState } from '../../characterState'
import { type GameEvent } from '../../events/createGameEventQueue'
import { type PlayerInventory } from '../../playerInventory'
import {
  completeQuest,
  formatQuestTextLines,
  getNextQuestInteractionForNpc,
  getQuestProgress,
  getTalkTargetDialogueLines,
  getVisibleQuestDefinitions,
  recordTalkQuestProgress,
  startQuest,
  type CompleteQuestResult,
  type QuestDefinition,
  type QuestLogState
} from '../../questLog'
import { resolveCharacterInteractionTarget } from '../../interaction/resolveCharacterInteractionTarget'
import type { createNpcDialogueOverlay } from '../createNpcDialogueOverlay'
import { QUEST_GIVER_PORTRAIT_KEY_BY_NPC_ID } from '../createQuestLogOverlay'
import { getWaystone, getWaystoneIdFromCharacterId, getWaystoneMenuPage } from '../../waystones'
import { startScenarioRun, type ScenarioRewardGrant, type ScenarioRun } from '../../scenario/scenarioRuntime'
import { createScenarioFlagAccess, getScenarioForNpc, isPriorityScenarioForNpc } from '../../scenario/scenarioStore'
import { BLACKSMITH_SHOP_NPC_ID, DAMAGE_TEXT_DURATION_MILLISECONDS, HERBALIST_SHOP_NPC_IDS, LEVEL_UP_TEXT_STYLE, POTION_SHOP_NPC_IDS, QUEST_DIALOGUE_DURATION_MILLISECONDS, QUEST_START_TEXT, SCENARIO_REWARD_ITEM_LABEL_BY_ID } from './constants'
import { addQuestItemRewardsToInventory } from './questRewards'
import { type SceneTransitionRequest } from './types'

export type NpcInteractionsContext = {
  playerProfile: PlayerProfile
  interactionLockUntilByCharacterPair: Map<string, number>
  getDiscoveredWaystoneIds: () => readonly string[]
  onWaystoneDiscovered: (waystoneId: string) => void
  onPlayerInventoryChange: (nextInventory: PlayerInventory) => void
  getCharacterStateById: (characterId: string) => CharacterState
  grantPlayerExperienceReward: (experienceReward: number) => void
  grantQuestCompletionRewards: (result: CompleteQuestResult) => void
  requestSceneTransitionTo: (request: SceneTransitionRequest) => void
  setBlacksmithShopOpen: (nextIsOpen: boolean) => void
  setPotionShopOpen: (nextIsOpen: boolean) => void
  setHerbalistShopOpen: (nextIsOpen: boolean) => void
  setQuestLog: (nextQuestLog: QuestLogState) => void
  setQuestLogWithObjectiveFeedback: (nextQuestLog: QuestLogState) => void
  syncPlayerUiOverlays: () => void
  showCharacterMessage: (characterId: string, message: string, durationMilliseconds: number) => void
  hideCharacterMessage: (characterId: string) => void
  showCharacterDamageText: (characterId: string, message: string, durationMilliseconds: number, style?: TextStyle) => void
  getNpcDialogueOverlay: () => ReturnType<typeof createNpcDialogueOverlay>
  getCharacterStates: () => CharacterState[]
  getCurrentQuestLog: () => QuestLogState
  getCurrentPlayerInventory: () => PlayerInventory
  setCurrentPlayerInventory: (value: PlayerInventory) => void
}

export const createNpcInteractions = (ctx: NpcInteractionsContext) => {
  const {
    playerProfile,
    interactionLockUntilByCharacterPair,
    getDiscoveredWaystoneIds,
    onWaystoneDiscovered,
    onPlayerInventoryChange,
    getCharacterStateById,
    grantPlayerExperienceReward,
    grantQuestCompletionRewards,
    requestSceneTransitionTo,
    setBlacksmithShopOpen,
    setPotionShopOpen,
    setHerbalistShopOpen,
    setQuestLog,
    setQuestLogWithObjectiveFeedback,
    syncPlayerUiOverlays,
    showCharacterMessage,
    hideCharacterMessage,
    showCharacterDamageText,
    getNpcDialogueOverlay,
    getCharacterStates,
    getCurrentQuestLog,
    getCurrentPlayerInventory,
    setCurrentPlayerInventory
  } = ctx


  // 시나리오 v2: talk 트리거. 퀘스트보다 먼저 가로챈다 — 생성(동적) 콘텐츠가 정적보다 앞서는
  // 기존 규칙(questLog.getQuestDefinitionsForNpc 의 동적 우선)과 같은 방향이다.
  let activeScenarioRun: ScenarioRun | undefined

  const grantScenarioRewards = (reward: ScenarioRewardGrant) => {
    if (reward.gold > 0) {
      setCurrentPlayerInventory({
        ...getCurrentPlayerInventory(),
        gold: getCurrentPlayerInventory().gold + reward.gold
      })
      onPlayerInventoryChange(getCurrentPlayerInventory())
    }
    if (reward.items.length > 0) {
      setCurrentPlayerInventory(addQuestItemRewardsToInventory(
        getCurrentPlayerInventory(),
        reward.items.map((item) => ({
          id: item.item_id,
          label: SCENARIO_REWARD_ITEM_LABEL_BY_ID[item.item_id] ?? item.item_id,
          quantity: item.quantity
        }))
      ))
      onPlayerInventoryChange(getCurrentPlayerInventory())
    }
    grantPlayerExperienceReward(reward.experience)
    syncPlayerUiOverlays()
  }

  // 대화창 초상화: 게임 그림체에 맞춰 그 NPC 의 LPC 전신을 픽셀 그대로 키워 쓴다.
  const getNpcDialoguePortrait = (
    characterId: string
  ): { portraitUrl: string; pixelArtPortrait: boolean } => {
    const character = getCharacterStates().find((candidate) => candidate.id === characterId)
    const key = character ? getLpcNpcSheetKey(character.id, character.appearanceType) : undefined
    const fullBody = key ? getLpcNpcFullBodyUrl(key) : undefined
    return { portraitUrl: fullBody ?? '', pixelArtPortrait: fullBody !== undefined }
  }

  const startScenarioForNpc = (npcCharacter: CharacterState) => {
    const scenario = getScenarioForNpc(npcCharacter.id)
    if (!scenario) {
      return
    }

    const flagAccess = createScenarioFlagAccess(scenario.scenario_id)
    activeScenarioRun = startScenarioRun(
      scenario,
      {
        presentDialogue: (request, respond) => {
          hideCharacterMessage(request.speaker)
          const speakerCharacter = getCharacterStates().find(
            (character) => character.id === request.speaker
          )
          getNpcDialogueOverlay().show({
            ...getNpcDialoguePortrait(request.speaker),
            name: speakerCharacter?.displayText ?? request.speaker,
            lines: request.lines,
            choices: request.choices,
            onChoice: (choiceIndex) => respond(choiceIndex),
            onComplete: () => respond(undefined)
          })
        },
        grantReward: grantScenarioRewards,
        getQuestStatus: (questId) => getQuestProgress(getCurrentQuestLog(), questId).status,
        getFlag: flagAccess.get,
        setFlag: flagAccess.set
      },
      () => {
        activeScenarioRun = undefined
      }
    )
  }

  const handleScenarioInteractionEvents = (
    events: GameEvent[],
    now: number
  ): GameEvent[] => {
    const unhandledEvents: GameEvent[] = []

    for (const event of events) {
      if (event.kind !== 'interaction-requested') {
        unhandledEvents.push(event)
        continue
      }

      // 시나리오 실행 중에는 새 상호작용을 전부 삼킨다 — 대화 위에 퀘스트/Lua 대사가
      // 겹쳐 뜨는 것을 막는다(이동 잠금은 MVP 범위 밖, 기존 VN 대화와 동일한 스텁).
      if (activeScenarioRun?.isRunning()) {
        continue
      }

      const sourceCharacter = getCharacterStates().find(
        (character) => character.id === event.sourceCharacterId
      )
      if (!sourceCharacter) {
        unhandledEvents.push(event)
        continue
      }

      const targetCharacter = resolveCharacterInteractionTarget({
        sourceCharacter,
        targetCharacters: getCharacterStates(),
        canReceiveInteraction: (character) =>
          getScenarioForNpc(character.id) !== undefined &&
          // 에디터에서 명시적으로 적용한 시나리오는 데모/저작 결과를 확인할 수 있도록
          // 기본 퀘스트보다 우선한다. 내장 골드 예제는 기존 퀘스트 흐름을 막지 않는다.
          (isPriorityScenarioForNpc(character.id) ||
            getNextQuestInteractionForNpc(getCurrentQuestLog(), character.id) === undefined)
      })
      if (!targetCharacter) {
        unhandledEvents.push(event)
        continue
      }

      const lockKey = `${sourceCharacter.id}:${targetCharacter.id}:scenario`
      const lockedUntil = interactionLockUntilByCharacterPair.get(lockKey) ?? 0
      if (lockedUntil > now) {
        continue
      }

      startScenarioForNpc(targetCharacter)
      interactionLockUntilByCharacterPair.set(lockKey, now + 1000)
    }

    return unhandledEvents
  }

  // 귀환 표지석: 손을 대면 발견으로 기록하고, 발견한 다른 표지석으로 가는 선택지를 띄운다.
  const openWaystoneMenu = (waystoneId: string, page: number) => {
    const waystone = getWaystone(waystoneId)
    if (!waystone) {
      return
    }
    const menu = getWaystoneMenuPage(getDiscoveredWaystoneIds(), waystoneId, page)
    const onlyHere = menu.targets.length === 1
    getNpcDialogueOverlay().show({
      portraitUrl: '',
      name: `귀환 표지석 — ${waystone.label}`,
      lines: [
        onlyHere
          ? '표지석의 옛 글자가 손끝에서 빛난다. 다른 표지석에 손을 대 두면 이곳에서 바로 갈 수 있다.'
          : '표지석의 옛 글자가 손끝에서 빛난다. 어디로 갈까?'
      ],
      choices: menu.choices,
      onChoice: (index) => {
        const target = menu.targets[index]
        if (target?.kind === 'next') {
          window.setTimeout(() => openWaystoneMenu(waystoneId, target.page), 0)
        } else if (target?.kind === 'travel') {
          requestSceneTransitionTo({
            sceneId: target.waystone.sceneId,
            spawn: target.waystone.spawn,
            facing: 'down'
          })
        }
      }
    })
  }
  const handleWaystoneInteractionEvents = (events: GameEvent[], now: number): GameEvent[] =>
    events.filter((event) => {
      if (event.kind !== 'interaction-requested' || getNpcDialogueOverlay().isOpen()) {
        return true
      }
      const sourceCharacter = getCharacterStates().find((character) => character.id === event.sourceCharacterId)
      if (!sourceCharacter) {
        return true
      }
      const target = resolveCharacterInteractionTarget({
        sourceCharacter,
        targetCharacters: getCharacterStates(),
        canReceiveInteraction: (character) => getWaystoneIdFromCharacterId(character.id) !== undefined
      })
      const waystoneId = target ? getWaystoneIdFromCharacterId(target.id) : undefined
      if (!waystoneId) {
        return true
      }
      const lockKey = `${sourceCharacter.id}:${target!.id}:waystone`
      if ((interactionLockUntilByCharacterPair.get(lockKey) ?? 0) > now) {
        return false
      }
      interactionLockUntilByCharacterPair.set(lockKey, now + 600)
      if (!getDiscoveredWaystoneIds().includes(waystoneId)) {
        onWaystoneDiscovered(waystoneId)
        showCharacterDamageText(PLAYER_CHARACTER_ID, '표지석 발견!', DAMAGE_TEXT_DURATION_MILLISECONDS, LEVEL_UP_TEXT_STYLE)
      }
      openWaystoneMenu(waystoneId, 0)
      return false
    })

  const handleQuestInteractionEvents = (
    events: GameEvent[],
    now: number
  ): GameEvent[] => {
    const unhandledEvents: GameEvent[] = []

    for (const event of events) {
      if (event.kind !== 'interaction-requested') {
        unhandledEvents.push(event)
        continue
      }

      const sourceCharacter = getCharacterStates().find(
        (character) => character.id === event.sourceCharacterId
      )

      if (!sourceCharacter) {
        unhandledEvents.push(event)
        continue
      }

      const targetCharacter = resolveCharacterInteractionTarget({
        sourceCharacter,
        targetCharacters: getCharacterStates(),
        canReceiveInteraction: (character) =>
          getNextQuestInteractionForNpc(getCurrentQuestLog(), character.id) !==
          undefined
      })

      if (!targetCharacter) {
        unhandledEvents.push(event)
        continue
      }

      const lockKey = `${sourceCharacter.id}:${targetCharacter.id}:quest`
      const lockedUntil = interactionLockUntilByCharacterPair.get(lockKey) ?? 0

      if (lockedUntil > now) {
        continue
      }

      handleQuestNpcInteraction(targetCharacter)
      interactionLockUntilByCharacterPair.set(
        lockKey,
        now + QUEST_DIALOGUE_DURATION_MILLISECONDS
      )
    }

    return unhandledEvents
  }
  const handleQuestNpcInteraction = (targetCharacter: CharacterState) => {
    const interaction = getNextQuestInteractionForNpc(
      getCurrentQuestLog(),
      targetCharacter.id
    )

    if (!interaction) {
      return
    }

    switch (interaction.action) {
      case 'start': {
        let nextQuestLog = startQuest(getCurrentQuestLog(), interaction.questId)

        nextQuestLog = recordTalkQuestProgress(nextQuestLog, targetCharacter.id)
        setQuestLogWithObjectiveFeedback(nextQuestLog)
        showQuestDialogue(
          targetCharacter.id,
          interaction.definition.startDialogueLines
        )
        showCharacterDamageText(
          PLAYER_CHARACTER_ID,
          QUEST_START_TEXT,
          DAMAGE_TEXT_DURATION_MILLISECONDS,
          LEVEL_UP_TEXT_STYLE
        )
        return
      }
      case 'active': {
        setQuestLogWithObjectiveFeedback(
          recordTalkQuestProgress(getCurrentQuestLog(), targetCharacter.id)
        )
        // 대사를 다 넘긴 뒤에 상점을 연다(대화창과 상점이 겹치지 않게).
        // 대화 목표의 상대 NPC(퀘스트를 준 사람이 아님)는 자기 대사를 말한다.
        showQuestDialogue(
          targetCharacter.id,
          targetCharacter.id !== interaction.definition.giverNpcId
            ? getTalkTargetDialogueLines(interaction.definition, targetCharacter.id)
            : interaction.definition.activeDialogueLines,
          () => maybeOpenQuestNpcShop(targetCharacter.id)
        )
        return
      }
      case 'complete': {
        const result = completeQuest(getCurrentQuestLog(), interaction.questId)
        const completionLines = interaction.definition.arcCompletionMessage
          ? [
              ...interaction.definition.completionDialogueLines,
              interaction.definition.arcCompletionMessage
            ]
          : interaction.definition.completionDialogueLines

        setQuestLog(result.nextQuestLog)
        showQuestDialogue(targetCharacter.id, completionLines)
        grantQuestCompletionRewards(result)
      }
    }
  }
  // 도착만 하면 되는 퀘스트(autoTurnInOnSceneEnter)는 이 씬에 들어온 순간 완료하고, 준 사람이
  // 다음 퀘스트를 바로 맡긴다. 준 사람은 이 씬에 없으므로 멀리서 전하는 말로 대화창에 띄운다.
  const runSceneEnterAutoTurnIns = () => {
    const readyDefinition = getVisibleQuestDefinitions().find(
      (definition) =>
        definition.autoTurnInOnSceneEnter &&
        getQuestProgress(getCurrentQuestLog(), definition.id).status === 'ready-to-turn-in'
    )

    if (!readyDefinition) {
      return
    }

    const result = completeQuest(getCurrentQuestLog(), readyDefinition.id)
    let nextQuestLog = result.nextQuestLog
    const lines = [...readyDefinition.completionDialogueLines]
    const followUp = getNextQuestInteractionForNpc(nextQuestLog, readyDefinition.giverNpcId)

    if (followUp?.action === 'start') {
      nextQuestLog = startQuest(nextQuestLog, followUp.questId)
      lines.push(...followUp.definition.startDialogueLines)
    }

    setQuestLog(nextQuestLog)
    grantQuestCompletionRewards(result)
    showRemoteQuestGiverDialogue(readyDefinition, lines, true)
  }
  // 의뢰인이 이 씬에 없어도(멀리서 전하는 말, 퀘스트 창의 대사 다시 보기) 의뢰인 그림으로 대화창을 띄운다.
  // fromRemoteSpeaker: 도착 완료 대사처럼 멀리서 전하는 말이면 remoteSpeaker(있으면)가 말한다.
  const showRemoteQuestGiverDialogue = (
    definition: QuestDefinition,
    lines: string[],
    fromRemoteSpeaker = false
  ) => {
    const speaker = fromRemoteSpeaker ? definition.remoteSpeaker : undefined
    const giverNpcId = speaker?.npcId ?? definition.giverNpcId
    const giverCharacter = getCharacterStates().find((character) => character.id === giverNpcId)
    const sheetKey = getLpcNpcSheetKey(
      giverNpcId,
      giverCharacter?.appearanceType ?? QUEST_GIVER_PORTRAIT_KEY_BY_NPC_ID[giverNpcId] ?? ''
    )
    const fullBody = sheetKey ? getLpcNpcFullBodyUrl(sheetKey) : undefined

    getNpcDialogueOverlay().show({
      portraitUrl: fullBody ?? '',
      pixelArtPortrait: fullBody !== undefined,
      name: speaker?.name ?? definition.giverName,
      lines: formatQuestTextLines(lines, { playerName: playerProfile.name })
    })
  }
  // 퀘스트 대사는 클릭/Space/Enter 로 한 줄씩 넘기는 대화창으로 보여 준다(예전 말풍선은
  // 3.6초 만에 사라져 읽을 수 없었다). 다른 대화가 열려 있으면 말풍선으로 대신한다.
  const showQuestDialogue = (
    characterId: string,
    lines: string[],
    onComplete?: () => void
  ) => {
    const formattedLines = formatQuestTextLines(lines, {
      playerName: playerProfile.name
    })

    if (getNpcDialogueOverlay().isOpen()) {
      showCharacterMessage(
        characterId,
        formattedLines.join('\n'),
        QUEST_DIALOGUE_DURATION_MILLISECONDS
      )
      onComplete?.()
      return
    }

    hideCharacterMessage(characterId)
    getNpcDialogueOverlay().show({
      ...getNpcDialoguePortrait(characterId),
      name: getCharacterStateById(characterId).displayText ?? '',
      lines: formattedLines,
      onComplete
    })
  }
  const maybeOpenQuestNpcShop = (npcId: string) => {
    if (npcId === BLACKSMITH_SHOP_NPC_ID) {
      setBlacksmithShopOpen(true)
      return
    }

    if (POTION_SHOP_NPC_IDS.has(npcId)) {
      setPotionShopOpen(true)
      return
    }

    if (HERBALIST_SHOP_NPC_IDS.has(npcId)) {
      setHerbalistShopOpen(true)
    }
  }

  return {
    getNpcDialoguePortrait,
    handleQuestInteractionEvents,
    handleScenarioInteractionEvents,
    handleWaystoneInteractionEvents,
    runSceneEnterAutoTurnIns,
    showRemoteQuestGiverDialogue
  }
}
