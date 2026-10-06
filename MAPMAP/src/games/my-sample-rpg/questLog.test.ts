import { describe, expect, it } from 'vitest'

import {
  BLACKSMITH_PREPARATION_QUEST_ID,
  FIRST_SLIME_HUNT_OBJECTIVE_ID,
  FIRST_SLIME_HUNT_QUEST_ID,
  FIELD_PIG_ERRAND_QUEST_ID,
  SLUICE_KEEPER_ERRAND_QUEST_ID,
  MANOR_SPORE_ERRAND_QUEST_ID,
  WEAPON_PATH_QUEST_ID,
  HIDDEN_CACHE_QUEST_ID,
  CARPENTER_STONES_QUEST_ID,
  GARDENER_SEEDS_QUEST_ID,
  CLOCK_OIL_QUEST_ID,
  BRIDGE_WATCH_QUEST_ID,
  VANISHING_WATER_QUEST_ID,
  REED_VILLAGE_QUEST_ID,
  DROWNED_PATH_QUEST_ID,
  ANTIDOTE_INCENSE_QUEST_ID,
  BEYOND_THE_FOG_QUEST_ID,
  FOREST_LORD_QUEST_ID,
  STELE_SCRIPT_QUEST_ID,
  REMAINING_SEALS_QUEST_ID,
  SEAL_CHAMBER_QUEST_ID,
  SWAMP_PRIEST_QUEST_ID,
  WATER_FLOWS_AGAIN_QUEST_ID,
  FIRST_SLIME_HUNT_REQUIRED_SLIME_DEFEATS,
  FINAL_SUPPLIES_QUEST_ID,
  HARVEST_VILLAGE_VISIT_QUEST_ID,
  MINE_ORE_RUSH_QUEST_ID,
  PIG_BOSS_THREAT_QUEST_ID,
  PIG_TROUBLE_QUEST_ID,
  POTION_SURVIVAL_BASICS_QUEST_ID,
  QUEST_DEFINITIONS,
  SLIME_BOSS_SHADOW_QUEST_ID,
  abandonQuest,
  completeQuest,
  createInitialQuestLog,
  formatQuestText,
  getNextQuestInteractionForNpc,
  getQuestNpcBadgeKindForNpc,
  getQuestProgress,
  getTalkTargetDialogueLines,
  isQuestUnlocked,
  getQuestDefinition,
  getVisibleQuestTrackers,
  hideVisibleQuestTrackers,
  recordItemUseQuestProgress,
  recordMonsterDefeatQuestProgress,
  recordQuestObjectiveProgress,
  recordSceneEnterQuestProgress,
  recordShopOpenQuestProgress,
  recordTalkQuestProgress,
  setQuestTrackerVisible,
  startQuest
} from './questLog'
import { grantPlayerExperience } from './playerExperience'
import {
  PLAYER_JOB_PROMOTION_LEVEL,
  createInitialPlayerProfile
} from './playerProfile'

const WIZARD_NPC_ID = 'wizard'
const POTION_MERCHANT_NPC_ID = 'potion_merchant'

// 초보자 아크(q001~q008)는 완주 시 정확히 승급 레벨(10)에 도달하도록 경험치가 맞춰져 있다.
// q009~는 아크 밖 확장 퀘스트라 레벨 밸런스 검증에서 제외한다.
const BEGINNER_ARC_QUEST_IDS = [
  FIRST_SLIME_HUNT_QUEST_ID,
  POTION_SURVIVAL_BASICS_QUEST_ID,
  PIG_TROUBLE_QUEST_ID,
  BLACKSMITH_PREPARATION_QUEST_ID,
  'q005-investigate-cave-entrance',
  SLIME_BOSS_SHADOW_QUEST_ID,
  FINAL_SUPPLIES_QUEST_ID,
  PIG_BOSS_THREAT_QUEST_ID
]

const completeQuestById = (questLog = createInitialQuestLog(), questId: string) =>
  completeQuest(
    recordQuestObjectiveProgress(
      startQuest(questLog, questId),
      questId,
      FIRST_SLIME_HUNT_OBJECTIVE_ID,
      99
    ),
    questId
  ).nextQuestLog

const getQuestDefinitionRegion = (questId: string) =>
  QUEST_DEFINITIONS.find((definition) => definition.id === questId)?.regionName

describe('chapter 2 opening (q016 vanishing water)', () => {
  const withWeaponPathCompleted = () => {
    const questLog = createInitialQuestLog()
    return {
      progressByQuestId: {
        ...questLog.progressByQuestId,
        [WEAPON_PATH_QUEST_ID]: {
          ...getQuestProgress(questLog, WEAPON_PATH_QUEST_ID),
          status: 'completed' as const
        }
      }
    }
  }

  it('unlocks only after the chapter 1 finale', () => {
    expect(isQuestUnlocked(createInitialQuestLog(), VANISHING_WATER_QUEST_ID)).toBe(false)
    expect(isQuestUnlocked(withWeaponPathCompleted(), VANISHING_WATER_QUEST_ID)).toBe(true)
  })

  it('is ready to turn in after entering the waterway and inspecting the stele', () => {
    let questLog = startQuest(withWeaponPathCompleted(), VANISHING_WATER_QUEST_ID)
    questLog = recordTalkQuestProgress(questLog, 'sunken_stele')
    expect(getQuestProgress(questLog, VANISHING_WATER_QUEST_ID).status).toBe('active')
    questLog = recordSceneEnterQuestProgress(questLog, 'upstream-waterway')
    expect(getQuestProgress(questLog, VANISHING_WATER_QUEST_ID).status).toBe('ready-to-turn-in')
  })
})

describe('chapter 2 reed village (q017, turned in to another npc)', () => {
  const afterVanishingWater = () => {
    const questLog = createInitialQuestLog()
    return {
      progressByQuestId: {
        ...questLog.progressByQuestId,
        [WEAPON_PATH_QUEST_ID]: { ...getQuestProgress(questLog, WEAPON_PATH_QUEST_ID), status: 'completed' as const },
        [VANISHING_WATER_QUEST_ID]: {
          ...getQuestProgress(questLog, VANISHING_WATER_QUEST_ID),
          status: 'completed' as const
        }
      }
    }
  }

  it('is offered by Imel and reported to chief Miren, not back to Imel', () => {
    expect(getNextQuestInteractionForNpc(afterVanishingWater(), 'mage')).toMatchObject({
      questId: REED_VILLAGE_QUEST_ID,
      action: 'start'
    })
    let questLog = startQuest(afterVanishingWater(), REED_VILLAGE_QUEST_ID)
    questLog = recordSceneEnterQuestProgress(questLog, 'reed-village')
    expect(getQuestProgress(questLog, REED_VILLAGE_QUEST_ID).status).toBe('ready-to-turn-in')

    expect(getNextQuestInteractionForNpc(questLog, 'miren')).toMatchObject({
      questId: REED_VILLAGE_QUEST_ID,
      action: 'complete'
    })
    expect(getQuestNpcBadgeKindForNpc(questLog, 'miren')).toBe('finish')
    expect(getNextQuestInteractionForNpc(questLog, 'mage')?.action).not.toBe('complete')
    expect(getQuestNpcBadgeKindForNpc(questLog, 'mage')).not.toBe('finish')
    expect(getVisibleQuestTrackers(questLog).map((tracker) => tracker.text)).toContain(
      '갈대골: 촌장 미렌에게 가기'
    )
  })
})

describe('chapter 2 poison fog (q019 antidote incense, q020 beyond the fog)', () => {
  const completedThrough = (questIds: string[]) => {
    const questLog = createInitialQuestLog()
    return {
      progressByQuestId: {
        ...questLog.progressByQuestId,
        ...Object.fromEntries(
          questIds.map((questId) => [
            questId,
            { ...getQuestProgress(questLog, questId), status: 'completed' as const }
          ])
        )
      }
    }
  }
  const CHAPTER_2_UNTIL_DROWNED_PATH = [
    WEAPON_PATH_QUEST_ID,
    VANISHING_WATER_QUEST_ID,
    REED_VILLAGE_QUEST_ID,
    DROWNED_PATH_QUEST_ID
  ]

  it('lets herbalist Odi offer the incense quest after the drowned path', () => {
    expect(isQuestUnlocked(completedThrough(CHAPTER_2_UNTIL_DROWNED_PATH.slice(0, 3)), ANTIDOTE_INCENSE_QUEST_ID)).toBe(
      false
    )
    const questLog = completedThrough(CHAPTER_2_UNTIL_DROWNED_PATH)
    expect(getNextQuestInteractionForNpc(questLog, 'odi')).toMatchObject({
      questId: ANTIDOTE_INCENSE_QUEST_ID,
      action: 'start'
    })
  })

  it('needs three man-eater flowers in the sunken forest and pays out incense', () => {
    let questLog = startQuest(completedThrough(CHAPTER_2_UNTIL_DROWNED_PATH), ANTIDOTE_INCENSE_QUEST_ID)
    for (let i = 0; i < 2; i += 1) {
      questLog = recordMonsterDefeatQuestProgress(questLog, {
        sceneId: 'sunken-forest',
        appearanceType: 'monster_flower'
      })
    }
    questLog = recordMonsterDefeatQuestProgress(questLog, {
      sceneId: 'sunken-forest',
      appearanceType: 'monster_frog'
    })
    expect(getQuestProgress(questLog, ANTIDOTE_INCENSE_QUEST_ID).status).toBe('active')
    questLog = recordMonsterDefeatQuestProgress(questLog, {
      sceneId: 'sunken-forest',
      appearanceType: 'monster_flower'
    })
    expect(getQuestProgress(questLog, ANTIDOTE_INCENSE_QUEST_ID).status).toBe('ready-to-turn-in')

    const result = completeQuest(questLog, ANTIDOTE_INCENSE_QUEST_ID)
    expect(result.itemRewards).toEqual([{ id: 'antidote-incense', label: '해독 향', quantity: 3 }])
    expect(isQuestUnlocked(result.nextQuestLog, BEYOND_THE_FOG_QUEST_ID)).toBe(true)
  })

  it('finds Ren in the fog and reports to chief Miren', () => {
    let questLog = startQuest(
      completedThrough([...CHAPTER_2_UNTIL_DROWNED_PATH, ANTIDOTE_INCENSE_QUEST_ID]),
      BEYOND_THE_FOG_QUEST_ID
    )
    questLog = recordTalkQuestProgress(questLog, 'lost_hunter_ren')
    expect(getQuestProgress(questLog, BEYOND_THE_FOG_QUEST_ID).status).toBe('ready-to-turn-in')
    expect(getNextQuestInteractionForNpc(questLog, 'miren')).toMatchObject({
      questId: BEYOND_THE_FOG_QUEST_ID,
      action: 'complete'
    })
    expect(getQuestNpcBadgeKindForNpc(questLog, 'odi')).not.toBe('finish')
  })
})

describe('chapter 2 forest lord (q021, mid boss)', () => {
  const completedThrough = (questIds: string[]) => {
    const questLog = createInitialQuestLog()
    return {
      progressByQuestId: {
        ...questLog.progressByQuestId,
        ...Object.fromEntries(
          questIds.map((questId) => [
            questId,
            { ...getQuestProgress(questLog, questId), status: 'completed' as const }
          ])
        )
      }
    }
  }
  const UNTIL_BEYOND_THE_FOG = [
    WEAPON_PATH_QUEST_ID,
    VANISHING_WATER_QUEST_ID,
    REED_VILLAGE_QUEST_ID,
    DROWNED_PATH_QUEST_ID,
    ANTIDOTE_INCENSE_QUEST_ID,
    BEYOND_THE_FOG_QUEST_ID
  ]

  it('is offered by chief Miren after Ren is found', () => {
    // (그 전에는 미렌이 곁가지 '마을의 우물'만 준다)
    expect(getNextQuestInteractionForNpc(completedThrough(UNTIL_BEYOND_THE_FOG.slice(0, 5)), 'miren')?.questId).not.toBe(
      FOREST_LORD_QUEST_ID
    )
    expect(getNextQuestInteractionForNpc(completedThrough(UNTIL_BEYOND_THE_FOG), 'miren')).toMatchObject({
      questId: FOREST_LORD_QUEST_ID,
      action: 'start'
    })
  })

  it('counts only the frog king in the sunken forest and reports back to Miren', () => {
    let questLog = startQuest(completedThrough(UNTIL_BEYOND_THE_FOG), FOREST_LORD_QUEST_ID)
    questLog = recordMonsterDefeatQuestProgress(questLog, { sceneId: 'sunken-forest', appearanceType: 'monster_frog' })
    expect(getQuestProgress(questLog, FOREST_LORD_QUEST_ID).status).toBe('active')
    questLog = recordMonsterDefeatQuestProgress(questLog, {
      sceneId: 'sunken-forest',
      appearanceType: 'monster_frog_king',
      characterId: '늪지기 거대개구리-보스'
    })
    expect(getQuestProgress(questLog, FOREST_LORD_QUEST_ID).status).toBe('ready-to-turn-in')
    expect(getNextQuestInteractionForNpc(questLog, 'miren')).toMatchObject({
      questId: FOREST_LORD_QUEST_ID,
      action: 'complete'
    })
  })

  it('leads to scholar Selin, who needs ruin skeletons cleared and the first seal read', () => {
    const afterLord = completedThrough([...UNTIL_BEYOND_THE_FOG, FOREST_LORD_QUEST_ID])
    expect(getNextQuestInteractionForNpc(completedThrough(UNTIL_BEYOND_THE_FOG), 'selin')).toBeUndefined()
    expect(getNextQuestInteractionForNpc(afterLord, 'selin')).toMatchObject({
      questId: STELE_SCRIPT_QUEST_ID,
      action: 'start'
    })
    let questLog = startQuest(afterLord, STELE_SCRIPT_QUEST_ID)
    // 목표가 여럿이면 첫 목표도 목표 이름으로 — 숫자가 어느 목표의 것인지 보이게
    expect(getVisibleQuestTrackers(questLog).find((item) => item.questId === STELE_SCRIPT_QUEST_ID)?.text).toBe(
      `${getQuestDefinition(STELE_SCRIPT_QUEST_ID).objectives[0].label} 0/5`
    )
    // 비석이 "여기로 와서 대화" 표시를 받는다
    expect(getQuestNpcBadgeKindForNpc(questLog, 'seal_stele_1')).toBe('new')
    for (let i = 0; i < 5; i += 1) {
      questLog = recordMonsterDefeatQuestProgress(questLog, {
        sceneId: 'ruins-outskirts',
        appearanceType: 'monster_skeleton'
      })
    }
    // 처치를 다 채우면 추적창은 남은 목표(비석 읽기)를 보여 준다
    expect(getVisibleQuestTrackers(questLog).find((item) => item.questId === STELE_SCRIPT_QUEST_ID)).toMatchObject({
      text: '첫 봉인 비석 읽기 0/1',
      objective: { id: 'read-first-seal' }
    })
    questLog = recordTalkQuestProgress(questLog, 'seal_stele_1')
    expect(getQuestProgress(questLog, STELE_SCRIPT_QUEST_ID).status).toBe('ready-to-turn-in')
    expect(getNextQuestInteractionForNpc(questLog, 'selin')).toMatchObject({ action: 'complete' })
  })

  it('needs both temple seals read, then hands over the chamber and priest quests to the end of chapter 2', () => {
    const afterStele = completedThrough([...UNTIL_BEYOND_THE_FOG, FOREST_LORD_QUEST_ID, STELE_SCRIPT_QUEST_ID])
    let questLog = startQuest(afterStele, REMAINING_SEALS_QUEST_ID)
    for (let i = 0; i < 5; i += 1) {
      questLog = recordMonsterDefeatQuestProgress(questLog, {
        sceneId: 'sunken-temple-1f',
        appearanceType: 'monster_drowned'
      })
    }
    // 두 비석은 서로 다른 글귀를 말한다
    const seals = QUEST_DEFINITIONS.find((definition) => definition.id === REMAINING_SEALS_QUEST_ID)!
    expect(getTalkTargetDialogueLines(seals, 'seal_stele_2')).not.toEqual(
      getTalkTargetDialogueLines(seals, 'seal_stele_3')
    )
    expect(getTalkTargetDialogueLines(seals, 'seal_stele_3').join(' ')).toContain('사제')
    questLog = recordTalkQuestProgress(questLog, 'seal_stele_2')
    // 비석 하나로는 끝나지 않는다
    expect(getQuestProgress(questLog, REMAINING_SEALS_QUEST_ID).status).toBe('active')
    questLog = recordTalkQuestProgress(questLog, 'seal_stele_3')
    expect(getQuestProgress(questLog, REMAINING_SEALS_QUEST_ID).status).toBe('ready-to-turn-in')
    questLog = completeQuest(questLog, REMAINING_SEALS_QUEST_ID).nextQuestLog

    // 봉인의 방: 도착만 하면 끝나고(멀리서 전언석의 마법사가 말한다), 같은 의뢰인의 사제 퀘스트가 이어진다
    questLog = startQuest(questLog, SEAL_CHAMBER_QUEST_ID)
    questLog = recordSceneEnterQuestProgress(questLog, 'sunken-temple-2f')
    expect(getQuestProgress(questLog, SEAL_CHAMBER_QUEST_ID).status).toBe('ready-to-turn-in')
    const chamber = QUEST_DEFINITIONS.find((definition) => definition.id === SEAL_CHAMBER_QUEST_ID)
    expect(chamber?.autoTurnInOnSceneEnter).toBe(true)
    expect(chamber?.remoteSpeaker).toEqual({ npcId: 'wizard', name: '마법사(전언석)' })
    questLog = completeQuest(questLog, SEAL_CHAMBER_QUEST_ID).nextQuestLog
    expect(getNextQuestInteractionForNpc(questLog, 'selin')).toMatchObject({
      questId: SWAMP_PRIEST_QUEST_ID,
      action: 'start'
    })

    questLog = startQuest(questLog, SWAMP_PRIEST_QUEST_ID)
    questLog = recordMonsterDefeatQuestProgress(questLog, {
      sceneId: 'sunken-temple-2f',
      appearanceType: 'monster_swamp_priest',
      characterId: '늪의 사제-보스'
    })
    questLog = completeQuest(questLog, SWAMP_PRIEST_QUEST_ID).nextQuestLog

    // 다시 흐르는 물: 셀린이 맡기고 상류길을 둘러본 뒤 이멜에게 보고한다
    questLog = startQuest(questLog, WATER_FLOWS_AGAIN_QUEST_ID)
    questLog = recordSceneEnterQuestProgress(questLog, 'upstream-waterway')
    expect(getNextQuestInteractionForNpc(questLog, 'mage')).toMatchObject({
      questId: WATER_FLOWS_AGAIN_QUEST_ID,
      action: 'complete'
    })
    const result = completeQuest(questLog, WATER_FLOWS_AGAIN_QUEST_ID)
    expect(result.didComplete).toBe(true)
    const finale = QUEST_DEFINITIONS.find((definition) => definition.id === WATER_FLOWS_AGAIN_QUEST_ID)
    expect(finale?.arcCompletionMessage).toContain('북쪽')
  })
})

describe('questLog', () => {
  it('registers the quest catalog with stable q001-q032 ids', () => {
    expect(QUEST_DEFINITIONS.map((definition) => definition.id)).toEqual([
      ...BEGINNER_ARC_QUEST_IDS,
      MINE_ORE_RUSH_QUEST_ID,
      HARVEST_VILLAGE_VISIT_QUEST_ID,
      FIELD_PIG_ERRAND_QUEST_ID,
      SLUICE_KEEPER_ERRAND_QUEST_ID,
      MANOR_SPORE_ERRAND_QUEST_ID,
      WEAPON_PATH_QUEST_ID,
      HIDDEN_CACHE_QUEST_ID,
      CARPENTER_STONES_QUEST_ID,
      GARDENER_SEEDS_QUEST_ID,
      CLOCK_OIL_QUEST_ID,
      BRIDGE_WATCH_QUEST_ID,
      VANISHING_WATER_QUEST_ID,
      REED_VILLAGE_QUEST_ID,
      DROWNED_PATH_QUEST_ID,
      ANTIDOTE_INCENSE_QUEST_ID,
      BEYOND_THE_FOG_QUEST_ID,
      FOREST_LORD_QUEST_ID,
      STELE_SCRIPT_QUEST_ID,
      REMAINING_SEALS_QUEST_ID,
      SEAL_CHAMBER_QUEST_ID,
      SWAMP_PRIEST_QUEST_ID,
      WATER_FLOWS_AGAIN_QUEST_ID,
      'q027-ferry-shortcut',
      'q028-herb-basket',
      'q029-hunter-keepsakes',
      'q030-skeleton-crest',
      'q031-hidden-altar',
      'q032-village-well'
    ])
    // 1장(q001~q015, 곁가지 q048~q051)은 티르코네일, 2장부터는 가라앉은 숲
    expect(
      QUEST_DEFINITIONS.filter((definition) => !definition.id.match(/^q0(1[6-9]|[2-3]\d)/)).every(
        (definition) => definition.regionName === '티르코네일 마을'
      )
    ).toBe(true)
    expect(getQuestDefinitionRegion(VANISHING_WATER_QUEST_ID)).toBe('가라앉은 숲')
    expect(JSON.stringify(QUEST_DEFINITIONS)).not.toContain('준수')
  })

  it('grants enough quest experience to reach level 10 after the beginner arc', () => {
    const questExperience = QUEST_DEFINITIONS.filter((definition) =>
      BEGINNER_ARC_QUEST_IDS.includes(definition.id)
    ).reduce(
      (totalExperience, definition) => totalExperience + definition.rewards.experience,
      0
    )

    const result = grantPlayerExperience(
      createInitialPlayerProfile(),
      questExperience
    )

    expect(result.nextProfile.level).toBe(PLAYER_JOB_PROMOTION_LEVEL)
    expect(result.nextProfile.experience.current).toBe(0)
  })

  it('starts only unlocked quests and exposes the next NPC quest interaction', () => {
    let questLog = createInitialQuestLog()

    expect(
      getNextQuestInteractionForNpc(questLog, WIZARD_NPC_ID)
    ).toMatchObject({
      action: 'start',
      questId: FIRST_SLIME_HUNT_QUEST_ID
    })
    expect(startQuest(questLog, POTION_SURVIVAL_BASICS_QUEST_ID)).toBe(questLog)

    questLog = startQuest(questLog, FIRST_SLIME_HUNT_QUEST_ID)
    questLog = recordQuestObjectiveProgress(
      questLog,
      FIRST_SLIME_HUNT_QUEST_ID,
      FIRST_SLIME_HUNT_OBJECTIVE_ID,
      FIRST_SLIME_HUNT_REQUIRED_SLIME_DEFEATS
    )
    questLog = completeQuest(questLog, FIRST_SLIME_HUNT_QUEST_ID).nextQuestLog

    expect(
      getNextQuestInteractionForNpc(questLog, POTION_MERCHANT_NPC_ID)
    ).toMatchObject({
      action: 'start',
      questId: POTION_SURVIVAL_BASICS_QUEST_ID
    })
  })

  it('tracks the first slime hunt and toggles the tracker independently', () => {
    let questLog = startQuest(createInitialQuestLog(), FIRST_SLIME_HUNT_QUEST_ID)

    // 트래커 아이템은 활성 목표(objective)도 함께 담는다 — questId/text만 확인한다.
    expect(getVisibleQuestTrackers(questLog)).toMatchObject([
      {
        questId: FIRST_SLIME_HUNT_QUEST_ID,
        text: `첫 사냥: 말캉이 처치 0/${FIRST_SLIME_HUNT_REQUIRED_SLIME_DEFEATS}`
      }
    ])

    questLog = recordMonsterDefeatQuestProgress(questLog, {
      sceneId: 'hunting-ground',
      appearanceType: 'monster_slime'
    })
    questLog = setQuestTrackerVisible(questLog, FIRST_SLIME_HUNT_QUEST_ID, false)

    expect(getVisibleQuestTrackers(questLog)).toEqual([])
    expect(
      getQuestProgress(questLog, FIRST_SLIME_HUNT_QUEST_ID).objectives[
        FIRST_SLIME_HUNT_OBJECTIVE_ID
      ]
    ).toBe(1)

    questLog = hideVisibleQuestTrackers(
      setQuestTrackerVisible(questLog, FIRST_SLIME_HUNT_QUEST_ID, true)
    )

    expect(getQuestProgress(questLog, FIRST_SLIME_HUNT_QUEST_ID).status).toBe(
      'active'
    )
  })

  it('records item-use, shop-open, scene-enter, talk, and boss objectives', () => {
    let questLog = completeQuestById(undefined, FIRST_SLIME_HUNT_QUEST_ID)

    questLog = startQuest(questLog, POTION_SURVIVAL_BASICS_QUEST_ID)
    questLog = recordItemUseQuestProgress(questLog, 'health-potion')
    expect(
      getQuestProgress(questLog, POTION_SURVIVAL_BASICS_QUEST_ID).status
    ).toBe('ready-to-turn-in')
    questLog = completeQuest(questLog, POTION_SURVIVAL_BASICS_QUEST_ID).nextQuestLog

    questLog = startQuest(questLog, PIG_TROUBLE_QUEST_ID)
    for (let defeat = 0; defeat < 10; defeat += 1) {
      questLog = recordMonsterDefeatQuestProgress(questLog, {
        sceneId: 'hunting-ground',
        appearanceType: 'monster_pig'
      })
    }
    expect(getQuestProgress(questLog, PIG_TROUBLE_QUEST_ID).status).toBe(
      'ready-to-turn-in'
    )
    questLog = completeQuest(questLog, PIG_TROUBLE_QUEST_ID).nextQuestLog

    questLog = startQuest(questLog, BLACKSMITH_PREPARATION_QUEST_ID)
    questLog = recordShopOpenQuestProgress(questLog, 'blacksmith')
    expect(
      getQuestProgress(questLog, BLACKSMITH_PREPARATION_QUEST_ID).status
    ).toBe('ready-to-turn-in')
    questLog = completeQuest(questLog, BLACKSMITH_PREPARATION_QUEST_ID)
      .nextQuestLog

    questLog = startQuest(questLog, 'q005-investigate-cave-entrance')
    questLog = recordSceneEnterQuestProgress(questLog, 'cave')
    expect(
      getQuestProgress(questLog, 'q005-investigate-cave-entrance').status
    ).toBe('ready-to-turn-in')
    questLog = completeQuest(questLog, 'q005-investigate-cave-entrance')
      .nextQuestLog

    questLog = startQuest(questLog, SLIME_BOSS_SHADOW_QUEST_ID)
    // 보스가 불러낸 작은 말캉이는 세지 않는다
    questLog = recordMonsterDefeatQuestProgress(questLog, {
      sceneId: 'cave',
      appearanceType: 'monster_slime',
      characterId: '말캉이-소환-1'
    })
    expect(getQuestProgress(questLog, SLIME_BOSS_SHADOW_QUEST_ID).status).toBe('active')
    questLog = recordMonsterDefeatQuestProgress(questLog, {
      sceneId: 'cave',
      appearanceType: 'monster_slime',
      characterId: '말캉이-보스'
    })
    expect(getQuestProgress(questLog, SLIME_BOSS_SHADOW_QUEST_ID).status).toBe(
      'ready-to-turn-in'
    )
    questLog = completeQuest(questLog, SLIME_BOSS_SHADOW_QUEST_ID).nextQuestLog

    questLog = startQuest(questLog, FINAL_SUPPLIES_QUEST_ID)
    questLog = recordTalkQuestProgress(questLog, POTION_MERCHANT_NPC_ID)
    expect(getQuestProgress(questLog, FINAL_SUPPLIES_QUEST_ID).status).toBe(
      'ready-to-turn-in'
    )
    questLog = completeQuest(questLog, FINAL_SUPPLIES_QUEST_ID).nextQuestLog

    questLog = startQuest(questLog, PIG_BOSS_THREAT_QUEST_ID)
    questLog = recordMonsterDefeatQuestProgress(questLog, {
      sceneId: 'cave',
      appearanceType: 'monster_pig',
      characterId: '꿀꿀이-보스'
    })
    // 보스만 잡아서는 끝나지 않는다 — 보스실 앞 바위돌이 8마리도 물리쳐야 한다.
    expect(getQuestProgress(questLog, PIG_BOSS_THREAT_QUEST_ID).status).toBe('active')
    for (let index = 0; index < 8; index += 1) {
      questLog = recordMonsterDefeatQuestProgress(questLog, {
        sceneId: 'cave',
        appearanceType: 'monster_rock'
      })
    }
    expect(getQuestProgress(questLog, PIG_BOSS_THREAT_QUEST_ID).status).toBe(
      'ready-to-turn-in'
    )
  })

  it('returns item rewards and grants all rewards once', () => {
    let questLog = completeQuestById(undefined, FIRST_SLIME_HUNT_QUEST_ID)

    questLog = startQuest(questLog, POTION_SURVIVAL_BASICS_QUEST_ID)
    questLog = recordItemUseQuestProgress(questLog, 'health-potion')

    const completedResult = completeQuest(
      questLog,
      POTION_SURVIVAL_BASICS_QUEST_ID
    )
    const repeatedResult = completeQuest(
      completedResult.nextQuestLog,
      POTION_SURVIVAL_BASICS_QUEST_ID
    )

    expect(completedResult).toMatchObject({
      didComplete: true,
      goldReward: 0,
      experienceReward: 108,
      itemRewards: [
        {
          id: 'health-potion',
          label: '체력 회복 포션',
          quantity: 5
        },
        {
          id: 'mana-potion',
          label: '마나 회복 포션',
          quantity: 3
        }
      ]
    })
    expect(repeatedResult).toMatchObject({
      didComplete: false,
      goldReward: 0,
      experienceReward: 0,
      itemRewards: []
    })
  })

  it('returns npc badge state for unlocked and ready quests', () => {
    let questLog = createInitialQuestLog()

    expect(getQuestNpcBadgeKindForNpc(questLog, WIZARD_NPC_ID)).toBe('new')
    expect(
      getQuestNpcBadgeKindForNpc(questLog, POTION_MERCHANT_NPC_ID)
    ).toBeUndefined()

    questLog = startQuest(questLog, FIRST_SLIME_HUNT_QUEST_ID)
    questLog = recordQuestObjectiveProgress(
      questLog,
      FIRST_SLIME_HUNT_QUEST_ID,
      FIRST_SLIME_HUNT_OBJECTIVE_ID,
      FIRST_SLIME_HUNT_REQUIRED_SLIME_DEFEATS
    )

    expect(getQuestNpcBadgeKindForNpc(questLog, WIZARD_NPC_ID)).toBe('finish')

    questLog = completeQuest(questLog, FIRST_SLIME_HUNT_QUEST_ID).nextQuestLog

    expect(getQuestNpcBadgeKindForNpc(questLog, POTION_MERCHANT_NPC_ID)).toBe(
      'new'
    )
  })

  it('abandons only the selected quest and resets its objectives', () => {
    const activeQuestLog = recordQuestObjectiveProgress(
      startQuest(createInitialQuestLog(), FIRST_SLIME_HUNT_QUEST_ID),
      FIRST_SLIME_HUNT_QUEST_ID,
      FIRST_SLIME_HUNT_OBJECTIVE_ID
    )
    const abandonedQuestLog = abandonQuest(
      activeQuestLog,
      FIRST_SLIME_HUNT_QUEST_ID
    )
    const quest = getQuestProgress(
      abandonedQuestLog,
      FIRST_SLIME_HUNT_QUEST_ID
    )

    expect(quest).toMatchObject({
      status: 'not-started',
      trackerVisible: false
    })
    expect(quest.objectives[FIRST_SLIME_HUNT_OBJECTIVE_ID]).toBe(0)
    expect(getVisibleQuestTrackers(abandonedQuestLog)).toEqual([])
  })

  it('formats quest dialogue with the current player name placeholder', () => {
    expect(formatQuestText('잘했다, {playerName}.', { playerName: '루아' })).toBe(
      '잘했다, 루아.'
    )
  })

  it('counts the mine boss objective only for the named boss', () => {
    let questLog = createInitialQuestLog()
    questLog = startQuest(
      { ...questLog, progressByQuestId: Object.fromEntries(
        Object.entries(questLog.progressByQuestId).map(([id, progress]) => [
          id,
          id === WEAPON_PATH_QUEST_ID ? progress : { ...progress, status: 'completed' as const }
        ])
      ) },
      WEAPON_PATH_QUEST_ID
    )
    questLog = recordMonsterDefeatQuestProgress(questLog, {
      sceneId: 'crystal-mine',
      appearanceType: 'monster_pig',
      characterId: '꿀꿀이-1'
    })
    expect(getQuestProgress(questLog, WEAPON_PATH_QUEST_ID).objectives['defeat-pig-captain'] ?? 0).toBe(0)
    questLog = recordMonsterDefeatQuestProgress(questLog, {
      sceneId: 'crystal-mine',
      appearanceType: 'monster_pig',
      characterId: '꿀꿀이대장-보스'
    })
    expect(getQuestProgress(questLog, WEAPON_PATH_QUEST_ID).objectives['defeat-pig-captain']).toBe(1)
  })
})
