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
  VANISHING_WATER_QUEST_ID,
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
  isQuestUnlocked,
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

describe('questLog', () => {
  it('registers the quest catalog with stable q001-q016 ids', () => {
    expect(QUEST_DEFINITIONS.map((definition) => definition.id)).toEqual([
      ...BEGINNER_ARC_QUEST_IDS,
      MINE_ORE_RUSH_QUEST_ID,
      HARVEST_VILLAGE_VISIT_QUEST_ID,
      FIELD_PIG_ERRAND_QUEST_ID,
      SLUICE_KEEPER_ERRAND_QUEST_ID,
      MANOR_SPORE_ERRAND_QUEST_ID,
      WEAPON_PATH_QUEST_ID,
      HIDDEN_CACHE_QUEST_ID,
      VANISHING_WATER_QUEST_ID
    ])
    // 1장(q001~q015)은 티르코네일, 2장부터는 가라앉은 숲
    expect(
      QUEST_DEFINITIONS.filter((definition) => definition.id !== VANISHING_WATER_QUEST_ID).every(
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
    questLog = recordMonsterDefeatQuestProgress(questLog, {
      sceneId: 'cave',
      appearanceType: 'monster_slime'
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
      appearanceType: 'monster_pig'
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
