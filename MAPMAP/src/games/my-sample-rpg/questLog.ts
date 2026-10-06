export const FIRST_SLIME_HUNT_QUEST_ID = 'q001-first-slime-hunt'
export const POTION_SURVIVAL_BASICS_QUEST_ID =
  'q002-potion-survival-basics'
export const PIG_TROUBLE_QUEST_ID = 'q003-pig-trouble'
export const BLACKSMITH_PREPARATION_QUEST_ID = 'q004-before-cave'
export const CAVE_ENTRANCE_INVESTIGATION_QUEST_ID =
  'q005-investigate-cave-entrance'
export const SLIME_BOSS_SHADOW_QUEST_ID = 'q006-slime-boss-shadow'
export const FINAL_SUPPLIES_QUEST_ID = 'q007-final-supplies'
export const PIG_BOSS_THREAT_QUEST_ID = 'q008-pig-boss-threat'
export const MINE_ORE_RUSH_QUEST_ID = 'q009-mine-ore-rush'
export const HARVEST_VILLAGE_VISIT_QUEST_ID = 'q010-harvest-village-visit'
// 딴따라마을 심부름(5단계) + 무기의 길(최종장)
export const FIELD_PIG_ERRAND_QUEST_ID = 'q011-field-pigs'
export const SLUICE_KEEPER_ERRAND_QUEST_ID = 'q012-sluice-keeper'
export const MANOR_SPORE_ERRAND_QUEST_ID = 'q013-manor-spores'
export const WEAPON_PATH_QUEST_ID = 'q014-weapon-path'
// 사냥터 야영지 상인의 탐색 퀘스트(숨은 상자)
export const HIDDEN_CACHE_QUEST_ID = 'q015-hidden-cache'
export const CAMP_MERCHANT_NPC_ID = 'camp_merchant'
export const HIDDEN_CACHE_NPC_ID = 'hidden_cache'
// 1장 곁가지(디테일 살리기 때 이름을 얻은 티르코네일 주민들의 부탁). 3장 설계 번호(q033~q047) 뒤를 쓴다.
export const CARPENTER_STONES_QUEST_ID = 'q048-carpenter-stones'
export const GARDENER_SEEDS_QUEST_ID = 'q049-gardener-seeds'
export const CLOCK_OIL_QUEST_ID = 'q050-clock-oil'
export const BRIDGE_WATCH_QUEST_ID = 'q051-bridge-watch'
// 2장 가라앉은 숲과 고대 유적(docs/chapter2-sunken-forest.md). 설계 번호 c2-01 = q016.
export const VANISHING_WATER_QUEST_ID = 'q016-vanishing-water'
export const SLUICE_KEEPER_NPC_ID = 'mage'
export const SUNKEN_STELE_NPC_ID = 'sunken_stele'
// c2-02 = q017. 갈대골 촌장 미렌에게 보고한다(이멜이 보낸다).
export const REED_VILLAGE_QUEST_ID = 'q017-reed-village'
export const REED_VILLAGE_CHIEF_NPC_ID = 'miren'
// c2-03 = q018. 가라앉은 숲 어귀 — 늪개구리 전사를 몰아내고 사라진 사냥꾼들의 흔적을 찾는다.
export const DROWNED_PATH_QUEST_ID = 'q018-drowned-path'
export const HUNTER_TRACE_NPC_ID = 'hunter_trace'
// c2-04 = q019(해독 향) + q020(독안개 너머). 약초꾼 오디의 해독 향으로 독안개를 건너 사냥꾼 렌을 찾는다.
export const ANTIDOTE_INCENSE_QUEST_ID = 'q019-antidote-incense'
export const BEYOND_THE_FOG_QUEST_ID = 'q020-beyond-the-fog'
export const HERBALIST_NPC_ID = 'odi'
export const LOST_HUNTER_NPC_ID = 'lost_hunter_ren'
// c2-05 = q021. 신전 길목을 지키는 숲의 주인(늪지기 거대개구리, 중간 보스).
export const FOREST_LORD_QUEST_ID = 'q021-forest-lord'
// c2-06 = q022. 잠긴 신전 외곽의 학자 셀린 — 첫 봉인 비석의 글자를 밝힌다.
export const STELE_SCRIPT_QUEST_ID = 'q022-stele-script'
export const SCHOLAR_NPC_ID = 'selin'
export const FIRST_SEAL_STELE_NPC_ID = 'seal_stele_1'
// c2-07 = q023. 신전 1층 동·서쪽 끝 방의 두 번째·세 번째 봉인 비석.
export const REMAINING_SEALS_QUEST_ID = 'q023-remaining-seals'
// c2-08 = q024(봉인의 방 도착 — 전언석으로 마법사의 목소리) + q025(늪의 사제).
export const SEAL_CHAMBER_QUEST_ID = 'q024-seal-chamber'
export const SWAMP_PRIEST_QUEST_ID = 'q025-swamp-priest'
// c2-09 = q026. 물이 다시 흐르는 것을 보고 이멜에게 알린다(2장 끝, 3장 떡밥).
export const WATER_FLOWS_AGAIN_QUEST_ID = 'q026-water-flows-again'
// 2장 곁가지 c2-s1~s6 = q027~q032 (docs/chapter2-sunken-forest.md 의 곁가지 표)
export const FERRY_SHORTCUT_QUEST_ID = 'q027-ferry-shortcut'
export const HERB_BASKET_QUEST_ID = 'q028-herb-basket'
export const HUNTER_KEEPSAKES_QUEST_ID = 'q029-hunter-keepsakes'
export const SKELETON_CREST_QUEST_ID = 'q030-skeleton-crest'
export const HIDDEN_ALTAR_QUEST_ID = 'q031-hidden-altar'
export const VILLAGE_WELL_QUEST_ID = 'q032-village-well'

export const FIRST_SLIME_HUNT_OBJECTIVE_ID = 'defeat-slimes'
export const FIRST_SLIME_HUNT_REQUIRED_SLIME_DEFEATS = 12
export const FIRST_SLIME_HUNT_REWARD_GOLD = 100
export const FIRST_SLIME_HUNT_REWARD_EXPERIENCE = 216

export const WIZARD_NPC_ID = 'wizard'
export const POTION_MERCHANT_NPC_ID = 'potion_merchant'
export const BLACKSMITH_NPC_ID = 'blacksmith'
export const QUEST_GIVER_NPC_IDS = [
  WIZARD_NPC_ID,
  POTION_MERCHANT_NPC_ID,
  BLACKSMITH_NPC_ID
] as const

export type QuestStatus =
  | 'not-started'
  | 'active'
  | 'ready-to-turn-in'
  | 'completed'

// Lua 런타임의 get_status 폴백이 이 값을 그대로 쓴다. 타입에 묶여 있어 QuestStatus를 바꾸면
// 여기서 컴파일이 깨지고, Lua 쪽 표기도 자동으로 따라온다(밑줄/하이픈 드리프트 구조적 차단).
export const QUEST_STATUS_NOT_STARTED: QuestStatus = 'not-started'

export type QuestObjectiveType =
  | 'monster-defeat'
  | 'item-use'
  | 'item-acquire'
  | 'shop-open'
  | 'scene-enter'
  | 'talk'

export type QuestObjectiveTarget = {
  sceneId?: string
  appearanceType?: string
  itemId?: string
  shopId?: string
  npcId?: string
  // 몬스터 처치 목표를 특정 개체(TMX 오브젝트 이름, 예: 꿀꿀이대장-보스)로 좁힐 때
  characterId?: string
}

export type QuestObjectiveDefinition = {
  id: string
  label: string
  required: number
  type: QuestObjectiveType
  target: QuestObjectiveTarget
}

export type QuestItemReward = {
  id: string
  label: string
  quantity: number
}

export type QuestRewards = {
  gold: number
  experience: number
  items: QuestItemReward[]
}

export type QuestDefinition = {
  id: string
  regionName: string
  giverNpcId: string
  giverName: string
  title: string
  trackerLabel: string
  turnInTrackerText?: string
  // 보고(완료)를 준 사람이 아닌 다른 NPC 에게 한다 — 장이 넘어가며 의뢰인이 바뀔 때(예: 이멜이 보내 미렌에게
  // 보고). 수락과 진행 중 대화는 준 사람(giverNpcId)이, 완료 대사는 이 NPC 가 말한다.
  turnInNpcId?: string
  turnInName?: string
  prerequisiteQuestIds: string[]
  requestText: string
  guideText: string
  startDialogueLines: string[]
  activeDialogueLines: string[]
  // 대화 목표의 상대 NPC(퀘스트를 준 사람이 아닌)가 말하는 대사. 없으면 activeDialogueLines.
  talkTargetDialogueLines?: string[]
  // 대화 목표가 여럿일 때 상대마다 다른 대사(예: 신전의 두 비석). 없는 상대는 talkTargetDialogueLines.
  talkTargetDialogueLinesByNpcId?: Record<string, string[]>
  completionDialogueLines: string[]
  arcCompletionMessage?: string
  // 장소 도착(scene-enter)만 목표인 퀘스트: 도착하는 순간 완료하고, 준 사람이 다음 퀘스트를
  // 이어서 맡긴다(마을까지 왕복하지 않게). 대사는 준 사람이 멀리서 전하는 말로 보여 준다.
  autoTurnInOnSceneEnter?: boolean
  // 멀리서 전하는 말(autoTurnInOnSceneEnter 완료 대사)을 의뢰인이 아닌 다른 사람이 할 때 — 예: 셀린이 건넨
  // 전언석에서 들려오는 티르코네일 마법사의 목소리. 대화창의 그림과 이름이 이 사람으로 바뀐다.
  remoteSpeaker?: { npcId: string; name: string }
  objectives: QuestObjectiveDefinition[]
  rewards: QuestRewards
}

export type QuestProgress = {
  id: string
  status: QuestStatus
  objectives: Record<string, number>
  trackerVisible: boolean
}

export type QuestLogState = {
  progressByQuestId: Record<string, QuestProgress>
}

export type QuestNpcBadgeKind = 'new' | 'finish'

export type QuestTrackerItem = {
  questId: string
  text: string
  // 활성 목표(있으면) — 트래커에서 대상 이미지 링크를 만드는 데 쓴다.
  objective?: QuestObjectiveDefinition
}

export type NpcQuestInteractionAction = 'start' | 'active' | 'complete'

export type NpcQuestInteraction = {
  questId: string
  action: NpcQuestInteractionAction
  definition: QuestDefinition
  progress: QuestProgress
}

export type CompleteQuestResult = {
  nextQuestLog: QuestLogState
  didComplete: boolean
  goldReward: number
  experienceReward: number
  itemRewards: QuestItemReward[]
}

export type QuestTextFormatContext = {
  playerName: string
}

const REGION_TIR_CHONAIL = '티르코네일 마을'
const REGION_SUNKEN_FOREST = '가라앉은 숲'
const SCENE_HUNTING_GROUND = 'hunting-ground'
const SCENE_CAVE = 'cave'
const SCENE_CRYSTAL_MINE = 'crystal-mine'
const SCENE_HARVEST_VILLAGE = 'harvest-village'
const SCENE_UPSTREAM_WATERWAY = 'upstream-waterway'
const SCENE_REED_VILLAGE = 'reed-village'
const SCENE_SUNKEN_FOREST = 'sunken-forest'
const SCENE_RUINS_OUTSKIRTS = 'ruins-outskirts'
const SCENE_SUNKEN_TEMPLE_1F = 'sunken-temple-1f'
const SCENE_SUNKEN_TEMPLE_2F = 'sunken-temple-2f'
const SCENE_REED_WELL = 'reed-well'
const MONSTER_SLIME_APPEARANCE_TYPE = 'monster_slime'
const MONSTER_PIG_APPEARANCE_TYPE = 'monster_pig'
const MONSTER_MUSHROOM_APPEARANCE_TYPE = 'monster_mushroom'
const MONSTER_ROCK_APPEARANCE_TYPE = 'monster_rock'
const HEALTH_POTION_REWARD: QuestItemReward = {
  id: 'health-potion',
  label: '체력 회복 포션',
  quantity: 1
}
const MANA_POTION_REWARD: QuestItemReward = {
  id: 'mana-potion',
  label: '마나 회복 포션',
  quantity: 1
}

export const QUEST_DEFINITIONS: QuestDefinition[] = [
  {
    id: FIRST_SLIME_HUNT_QUEST_ID,
    regionName: REGION_TIR_CHONAIL,
    giverNpcId: WIZARD_NPC_ID,
    giverName: '마법사',
    title: '첫 사냥: 말캉이 처치',
    trackerLabel: '첫 사냥: 말캉이 처치',
    turnInTrackerText: '첫 사냥: 마법사에게 돌아가기',
    prerequisiteQuestIds: [],
    requestText: '마을의 마법사가 퀘스트를 의뢰했다.',
    guideText:
      '마을 오른쪽 "사냥터로 가는 길"로 포탈을 타 말캉이 12마리를 잡고 오자.',
    startDialogueLines: [
      '요즘 마을 밖 사냥터에 말캉이들이 자주 나타나고 있단다.',
      '아직 위험한 수준은 아니지만, 초보자인 네가 전투에 익숙해지기에는 딱 좋겠구나.',
      '마을 오른쪽의 "사냥터로 가는 길"을 따라가서 말캉이 12마리를 처치하고 돌아오너라.'
    ],
    activeDialogueLines: [
      '아직 말캉이 기운이 남아 있구나.',
      '사냥터에서 말캉이 12마리를 처치하고 돌아오너라.'
    ],
    completionDialogueLines: [
      '잘했다, {playerName}.',
      '생각보다 훨씬 침착하게 싸우는구나.',
      '하지만 사냥터의 기운이 조금 이상하다. 이건 단순한 말캉이 소동이 아닐지도 모르겠구나.'
    ],
    objectives: [
      {
        id: FIRST_SLIME_HUNT_OBJECTIVE_ID,
        label: '말캉이',
        required: FIRST_SLIME_HUNT_REQUIRED_SLIME_DEFEATS,
        type: 'monster-defeat',
        target: {
          sceneId: SCENE_HUNTING_GROUND,
          appearanceType: MONSTER_SLIME_APPEARANCE_TYPE
        }
      }
    ],
    rewards: {
      gold: FIRST_SLIME_HUNT_REWARD_GOLD,
      experience: FIRST_SLIME_HUNT_REWARD_EXPERIENCE,
      items: []
    }
  },
  {
    id: POTION_SURVIVAL_BASICS_QUEST_ID,
    regionName: REGION_TIR_CHONAIL,
    giverNpcId: POTION_MERCHANT_NPC_ID,
    giverName: '물약상인',
    title: '사냥 준비는 생명줄',
    trackerLabel: '사냥 준비는 생명줄',
    prerequisiteQuestIds: [FIRST_SLIME_HUNT_QUEST_ID],
    requestText:
      '물약상인이 사냥을 계속하려면 회복 물약을 제대로 쓰는 법을 알아야 한다고 했다.',
    guideText: '체력 회복 포션을 사용해보고 다시 말을 걸자.',
    startDialogueLines: [
      '물약이 필요하면 여기로 와.',
      '체력 물약과 마나 물약을 준비해뒀어.',
      '사냥터에 계속 나갈 생각이면 물약을 아끼기만 해서는 안 돼.',
      '위험할 때 바로 쓰는 것도 실력이야. 체력 회복 포션을 한 번 사용해보고 와.'
    ],
    activeDialogueLines: [
      '체력 회복 포션을 한 번 사용해봐.',
      '위험할 때 바로 쓰는 것도 실력이야.'
    ],
    completionDialogueLines: [
      '좋아. 이제 최소한 쓰러지기 전에 물약을 누를 줄은 알겠네.',
      '이건 내가 챙겨주는 보급품이야. 동굴 같은 곳에 들어갈 때는 꼭 여유 있게 챙겨.'
    ],
    objectives: [
      {
        id: 'use-health-potion',
        label: '체력 회복 포션 사용',
        required: 1,
        type: 'item-use',
        target: {
          itemId: 'health-potion'
        }
      }
    ],
    rewards: {
      gold: 0,
      experience: 108,
      items: [
        {
          ...HEALTH_POTION_REWARD,
          quantity: 5
        },
        {
          ...MANA_POTION_REWARD,
          quantity: 3
        }
      ]
    }
  },
  {
    id: PIG_TROUBLE_QUEST_ID,
    regionName: REGION_TIR_CHONAIL,
    giverNpcId: WIZARD_NPC_ID,
    giverName: '마법사',
    title: '사냥터의 꿀꿀한 소동',
    trackerLabel: '사냥터의 꿀꿀한 소동',
    prerequisiteQuestIds: [
      FIRST_SLIME_HUNT_QUEST_ID,
      POTION_SURVIVAL_BASICS_QUEST_ID
    ],
    requestText:
      '마법사는 사냥터에 말캉이보다 더 거친 꿀꿀이들이 나타났다고 했다.',
    guideText: '사냥터로 가서 꿀꿀이 10마리를 처치하자.',
    startDialogueLines: [
      '말캉이만 있는 줄 알았더니, 꿀꿀이들도 점점 사나워지고 있구나.',
      '꿀꿀이는 말캉이보다 조금 더 강하다. 방심하면 안 된다.',
      '이번에는 사냥터에서 꿀꿀이 10마리를 처치하고 돌아오너라.'
    ],
    activeDialogueLines: [
      '꿀꿀이는 말캉이보다 조금 더 강하다.',
      '사냥터에서 꿀꿀이 10마리를 처치하고 돌아오너라.'
    ],
    completionDialogueLines: [
      '역시 이상하군.',
      '말캉이와 꿀꿀이가 동시에 사나워지는 건 흔한 일이 아니다.',
      '사냥터 깊은 곳에 있는 동굴 쪽에서 이상한 기운이 흘러나오는 것 같구나.',
      '들어가기 전에 대장장이에게 들러 장비부터 점검받거라. 맨손으로 갈 곳이 아니다.'
    ],
    objectives: [
      {
        id: 'defeat-pigs',
        label: '꿀꿀이',
        required: 10,
        type: 'monster-defeat',
        target: {
          sceneId: SCENE_HUNTING_GROUND,
          appearanceType: MONSTER_PIG_APPEARANCE_TYPE
        }
      }
    ],
    rewards: {
      gold: 120,
      experience: 288,
      items: []
    }
  },
  {
    id: BLACKSMITH_PREPARATION_QUEST_ID,
    regionName: REGION_TIR_CHONAIL,
    giverNpcId: BLACKSMITH_NPC_ID,
    giverName: '대장장이',
    title: '동굴에 들어가기 전에',
    trackerLabel: '동굴에 들어가기 전에',
    prerequisiteQuestIds: [PIG_TROUBLE_QUEST_ID],
    requestText:
      '마법사는 동굴에 들어가기 전 대장장이에게 장비를 점검받으라고 했다.',
    guideText: '대장장이에게 가서 동굴 탐사 준비를 하자.',
    startDialogueLines: [
      '마법사 영감이 보냈나? 얼굴만 봐도 알겠군.',
      '동굴에 들어간다고? 기본 무기만 들고 가기엔 좀 불안한데.',
      '돈이 모이면 내 가게에서 제대로 된 무기를 맞춰 주지.',
      '일단 이 수호 부적을 가져가. 초보자에게는 작은 방어력도 큰 차이를 만든다.'
    ],
    activeDialogueLines: [
      '장비 상점을 한번 둘러봐.',
      '청동 검, 철 옷, 가죽 신발 같은 장비도 확인해두면 좋다.'
    ],
    completionDialogueLines: [
      '장비는 목숨이다.',
      '청동 검, 철 옷, 가죽 신발 같은 장비도 둘러봐.',
      '돈이 모이면 꼭 바꿔 끼고 가라. 맨몸으로 용감한 척하다가 누우면 아무 의미 없다.'
    ],
    objectives: [
      {
        id: 'open-blacksmith-shop',
        label: '장비 상점 확인',
        required: 1,
        type: 'shop-open',
        target: {
          shopId: 'blacksmith'
        }
      }
    ],
    rewards: {
      gold: 0,
      experience: 180,
      items: [
        {
          id: 'smith-charm',
          label: '수호 부적',
          quantity: 1
        }
      ]
    }
  },
  {
    id: CAVE_ENTRANCE_INVESTIGATION_QUEST_ID,
    regionName: REGION_TIR_CHONAIL,
    giverNpcId: WIZARD_NPC_ID,
    giverName: '마법사',
    title: '동굴입구 조사',
    trackerLabel: '동굴입구 조사',
    prerequisiteQuestIds: [BLACKSMITH_PREPARATION_QUEST_ID],
    requestText:
      '사냥터 깊은 곳의 동굴 안쪽에서 이상한 기운이 느껴진다고 한다.',
    guideText: '사냥터의 "동굴입구" 표지판을 따라가 포탈에서 F를 눌러 동굴에 들어가 보자.',
    autoTurnInOnSceneEnter: true,
    startDialogueLines: [
      '이제 사냥터의 원인을 확인할 때가 되었구나.',
      '사냥터에 있는 "동굴입구" 표지판을 찾아라.',
      '그 안쪽에서 이상한 마력이 흘러나오고 있다.',
      '포탈 앞에서 F를 눌러 동굴 안으로 들어가 보거라.'
    ],
    activeDialogueLines: [
      '사냥터에 있는 "동굴입구" 표지판을 찾아라.',
      '포탈 앞에서 F를 눌러 동굴 안으로 들어가 보거라.'
    ],
    completionDialogueLines: [
      '(머릿속에 마법사의 목소리가 울린다)',
      '들리느냐, {playerName}. 동굴 안에 들어섰구나.',
      '여기서도 어두운 기운이 느껴진다.',
      '안쪽에 분명 평범한 몬스터보다 강한 존재가 있을 것이다.'
    ],
    objectives: [
      {
        id: 'enter-cave',
        label: '동굴 입장',
        required: 1,
        type: 'scene-enter',
        target: {
          sceneId: SCENE_CAVE
        }
      }
    ],
    rewards: {
      gold: 100,
      experience: 252,
      items: []
    }
  },
  {
    id: SLIME_BOSS_SHADOW_QUEST_ID,
    regionName: REGION_TIR_CHONAIL,
    giverNpcId: WIZARD_NPC_ID,
    giverName: '마법사',
    title: '동굴 속 말캉한 그림자',
    trackerLabel: '동굴 속 말캉한 그림자',
    prerequisiteQuestIds: [CAVE_ENTRANCE_INVESTIGATION_QUEST_ID],
    requestText:
      '동굴 안에는 평범한 말캉이보다 훨씬 큰 말캉이-보스가 있다고 한다.',
    guideText: '동굴로 들어가 말캉이-보스를 처치하자.',
    startDialogueLines: [
      '동굴 안의 기운을 살펴보니, 말캉이의 형태를 한 큰 마력 덩어리가 느껴진다.',
      '평범한 말캉이라고 생각하면 다칠 수 있다.',
      '그건 말캉이-보스다. 체력도 높고 공격도 훨씬 강할 것이다.',
      '조심해서 동굴 안쪽으로 들어가 말캉이-보스를 처치하고 돌아오너라.'
    ],
    activeDialogueLines: [
      '말캉이-보스는 동굴 안쪽에 있다.',
      '평범한 말캉이라고 생각하면 다칠 수 있다.'
    ],
    completionDialogueLines: [
      '말캉이-보스를 쓰러뜨렸구나.',
      '훌륭하다. 하지만 동굴의 기운이 아직 사라지지 않았다.',
      '오히려 더 깊은 곳에서 무언가가 화가 난 것처럼 움직이고 있구나.'
    ],
    objectives: [
      {
        id: 'defeat-slime-boss',
        label: '말캉이-보스',
        required: 1,
        type: 'monster-defeat',
        target: {
          sceneId: SCENE_CAVE,
          appearanceType: MONSTER_SLIME_APPEARANCE_TYPE,
          // 보스가 불러낸 작은 말캉이(말캉이-소환-N)는 세지 않는다
          characterId: '말캉이-보스'
        }
      }
    ],
    rewards: {
      gold: 180,
      experience: 432,
      items: []
    }
  },
  {
    id: FINAL_SUPPLIES_QUEST_ID,
    regionName: REGION_TIR_CHONAIL,
    giverNpcId: POTION_MERCHANT_NPC_ID,
    giverName: '물약상인',
    title: '마지막 보급품',
    trackerLabel: '마지막 보급품',
    prerequisiteQuestIds: [SLIME_BOSS_SHADOW_QUEST_ID],
    requestText:
      '물약상인이 동굴 깊은 곳으로 들어가기 전에 마지막 보급품을 챙겨주겠다고 했다.',
    guideText: '마을의 물약상인에게 가자.',
    startDialogueLines: [
      '동굴 안쪽까지 들어갈 생각이야?',
      '그럼 이번엔 장난이 아니야. 보스 몬스터는 평범한 몬스터보다 훨씬 오래 버틴다고.',
      '여기, 마지막 보급품이야. 아끼지 말고 써.',
      '살아 돌아오는 게 제일 중요하니까.'
    ],
    activeDialogueLines: [
      '준비는 끝났어.',
      '무리하지 말고, 체력이 위험하면 바로 물약을 써.'
    ],
    completionDialogueLines: [
      '동굴 깊은 곳은 공기부터 다르대. 숨이 막히면 잠깐 물러서.',
      '체력이 절반 아래로 떨어지면 망설이지 말고 물약을 눌러.',
      '그리고 돌아오면 꼭 들러. 다친 곳 없는지 봐줄게.'
    ],
    objectives: [
      {
        id: 'talk-to-potion-merchant',
        label: '물약상인과 대화',
        required: 1,
        type: 'talk',
        target: {
          npcId: POTION_MERCHANT_NPC_ID
        }
      }
    ],
    rewards: {
      gold: 0,
      experience: 144,
      items: [
        {
          ...HEALTH_POTION_REWARD,
          quantity: 8
        },
        {
          ...MANA_POTION_REWARD,
          quantity: 5
        }
      ]
    }
  },
  {
    id: PIG_BOSS_THREAT_QUEST_ID,
    regionName: REGION_TIR_CHONAIL,
    giverNpcId: WIZARD_NPC_ID,
    giverName: '마법사',
    title: '티르코네일을 위협하는 꿀꿀이-보스',
    trackerLabel: '꿀꿀이-보스 처치',
    prerequisiteQuestIds: [FINAL_SUPPLIES_QUEST_ID],
    requestText:
      '동굴 깊은 곳에서 꿀꿀이-보스가 마을 주변 몬스터들을 사납게 만들고 있었다.',
    guideText:
      '동굴 깊은 곳 보스실 앞을 지키는 바위돌이들을 물리치고, 꿀꿀이-보스를 처치한 뒤 마을로 돌아오자.',
    startDialogueLines: [
      '이제 원인을 알겠다.',
      '동굴 깊은 곳의 꿀꿀이-보스가 주변 몬스터들을 자극하고 있었던 것이다.',
      '지금 막지 않으면 사냥터를 넘어 마을까지 위험해질 수 있다.',
      '보스실 앞은 녀석에게 홀린 바위돌이들이 지키고 있을 게다. 하나씩 끌어내 상대하거라.',
      '{playerName}, 네가 동굴로 들어가 꿀꿀이-보스를 처치해다오.'
    ],
    activeDialogueLines: [
      '보스실 앞 바위돌이들을 먼저 물리치고, 동굴 깊은 곳의 꿀꿀이-보스를 처치해야 한다.',
      '지금 막지 않으면 사냥터를 넘어 마을까지 위험해질 수 있다.'
    ],
    completionDialogueLines: [
      '돌아왔구나, {playerName}.',
      '동굴의 어두운 기운이 사라졌다. 네가 해낸 것이다.',
      '이제 티르코네일 마을은 당분간 안전할 것이다.',
      '하지만 이것은 네 모험의 시작일 뿐이다.',
      '정해진 길은 없다. 검을 들면 검의 길이, 활을 들면 활의 길이, 지팡이를 들면 마법의 길이 열린다.'
    ],
    arcCompletionMessage:
      '티르코네일의 이상한 기운을 해결했다.\n마을 사람들은 {playerName}을 진짜 모험가로 인정하기 시작했다.\n어떤 무기를 드느냐에 따라 싸우는 법이 달라진다.',
    objectives: [
      {
        id: 'defeat-cave-guardians',
        label: '보스실 앞 바위돌이',
        required: 8,
        type: 'monster-defeat',
        target: {
          sceneId: SCENE_CAVE,
          appearanceType: MONSTER_ROCK_APPEARANCE_TYPE
        }
      },
      {
        id: 'defeat-pig-boss',
        label: '꿀꿀이-보스',
        required: 1,
        type: 'monster-defeat',
        target: {
          sceneId: SCENE_CAVE,
          appearanceType: MONSTER_PIG_APPEARANCE_TYPE,
          characterId: '꿀꿀이-보스'
        }
      }
    ],
    rewards: {
      gold: 300,
      experience: 720,
      items: []
    }
  },
  {
    id: MINE_ORE_RUSH_QUEST_ID,
    regionName: REGION_TIR_CHONAIL,
    giverNpcId: BLACKSMITH_NPC_ID,
    giverName: '대장장이',
    title: '잊힌 수정 광산',
    trackerLabel: '수정 광석 채굴',
    prerequisiteQuestIds: [SLIME_BOSS_SHADOW_QUEST_ID],
    requestText:
      '동굴 수정 골방의 옆굴이 옛 광산으로 이어진다는 소문이 있다. 수정 광석을 캐다 달라.',
    guideText:
      '대장간에서 곡괭이를 산 뒤, 동굴 수정 골방 옆 계단으로 잊힌 수정 광산에 내려가 버섯돌이를 물리치며 광맥을 캐자.',
    startDialogueLines: [
      '동굴 안쪽 수정 골방 벽에 옛 광부들이 파 둔 계단이 있다더군.',
      '그 아래가 잊힌 수정 광산이야. 수정 광석이 아직 잔뜩 박혀 있다지.',
      '곡괭이는 내가 팔고 있으니 하나 챙겨 가라.',
      '광석 여덟 덩이만 캐 와 주면 값은 섭섭잖게 쳐주마.',
      '광맥 홀에는 버섯돌이들이 들끓는다더군. 캐다 보면 덤빌 테니 치워 가며 캐라. 꿀꿀이 대장도 버티고 있다니 조심하고.'
    ],
    activeDialogueLines: [
      '곡괭이 없이는 광맥이 꿈쩍도 안 할 거다.',
      '광산의 파란 수정 광맥 앞에서 캐 보아라. 여덟 덩이면 된다.',
      '광맥 홀의 버섯돌이들도 잊지 말고.'
    ],
    completionDialogueLines: [
      '오, 진짜 수정 광석이군! 백 년 묵은 광맥 물건이다.',
      '앞으로도 캐 오면 개당 값을 쳐주마. 광부 일도 제법 어울리는걸.'
    ],
    objectives: [
      {
        id: 'enter-crystal-mine',
        label: '잊힌 수정 광산 진입',
        required: 1,
        type: 'scene-enter',
        target: {
          sceneId: SCENE_CRYSTAL_MINE
        }
      },
      {
        id: 'defeat-mine-mushrooms',
        label: '광산 버섯돌이',
        required: 6,
        type: 'monster-defeat',
        target: {
          sceneId: SCENE_CRYSTAL_MINE,
          appearanceType: MONSTER_MUSHROOM_APPEARANCE_TYPE
        }
      },
      {
        id: 'gather-crystal-ore',
        label: '수정 광석 채굴',
        required: 8,
        type: 'item-acquire',
        target: {
          itemId: 'crystal-ore'
        }
      }
    ],
    rewards: {
      gold: 260,
      experience: 300,
      items: [
        {
          id: 'health-potion',
          label: '체력 회복 포션',
          quantity: 2
        }
      ]
    }
  },
  {
    id: HARVEST_VILLAGE_VISIT_QUEST_ID,
    regionName: REGION_TIR_CHONAIL,
    giverNpcId: POTION_MERCHANT_NPC_ID,
    giverName: '물약상인',
    title: '수로 끝의 마을',
    trackerLabel: '딴따라마을 방문',
    prerequisiteQuestIds: [POTION_SURVIVAL_BASICS_QUEST_ID],
    requestText:
      '남쪽 수교 아래 계단이 딴따라마을로 이어진다. 촌장님께 안부를 전해 달라.',
    guideText:
      '마을 남쪽 수교의 중앙 아치 계단으로 내려가 딴따라마을의 마리네 촌장을 만나자.',
    startDialogueLines: [
      '우리 물약 약초의 절반은 딴따라마을 들녘에서 온단다.',
      '남쪽 수교 아치 밑 계단으로 내려가면 바로 그 마을이야.',
      '우물가에 계신 마리네 촌장님께 내 안부 좀 전해 주겠니?'
    ],
    activeDialogueLines: [
      '남쪽 수교 중앙 아치의 계단을 찾아보렴.',
      '촌장님은 늘 우물가에 계셔.'
    ],
    completionDialogueLines: [
      '촌장님이 잘 계시다니 다행이야.',
      '그 마을 들녘 밀이 올해도 풍년이라지? 물약값은 내리지 못하지만 말이야.'
    ],
    objectives: [
      {
        id: 'enter-harvest-village',
        label: '딴따라마을 진입',
        required: 1,
        type: 'scene-enter',
        target: {
          sceneId: SCENE_HARVEST_VILLAGE
        }
      },
      {
        id: 'meet-elder',
        label: '마리네 촌장과 대화',
        required: 1,
        type: 'talk',
        target: {
          npcId: 'elder'
        }
      }
    ],
    rewards: {
      gold: 150,
      experience: 220,
      items: [
        {
          id: 'mana-potion',
          label: '마나 회복 포션',
          quantity: 1
        }
      ]
    }
  },
  {
    id: FIELD_PIG_ERRAND_QUEST_ID,
    regionName: REGION_TIR_CHONAIL,
    giverNpcId: 'farmer',
    giverName: '파딘',
    title: '들녘을 짓밟는 꿀꿀이',
    trackerLabel: '들녘 꿀꿀이 쫓아내기',
    prerequisiteQuestIds: [HARVEST_VILLAGE_VISIT_QUEST_ID],
    requestText: '사냥터 버려진 돼지 농장의 꿀꿀이들이 밤마다 밀밭까지 내려온다. 쫓아내 달라.',
    guideText: '사냥터 북쪽 버려진 돼지 농장에서 꿀꿀이 8마리를 처치하고 파딘에게 돌아가자.',
    startDialogueLines: [
      '어젯밤에도 밀이 한 이랑 통째로 짓밟혔어.',
      '범인은 사냥터 북쪽, 버려진 돼지 농장에 눌러앉은 꿀꿀이들이야.',
      '여덟 마리만 혼내 주면 한동안은 얌전하겠지.'
    ],
    activeDialogueLines: ['버려진 돼지 농장은 사냥터 야영지 바로 위쪽이야. 여덟 마리면 돼.'],
    completionDialogueLines: [
      '정말 해냈구나! 오늘 밤엔 다리 뻗고 자겠어.',
      '갓 거둔 밀로 구운 빵이야. 포션이랑 같이 챙겨 가.'
    ],
    objectives: [
      {
        id: 'defeat-field-pigs',
        label: '꿀꿀이',
        required: 8,
        type: 'monster-defeat',
        target: {
          sceneId: SCENE_HUNTING_GROUND,
          appearanceType: MONSTER_PIG_APPEARANCE_TYPE
        }
      }
    ],
    rewards: {
      gold: 120,
      experience: 260,
      items: [{ id: 'health-potion', label: '체력 회복 포션', quantity: 2 }]
    }
  },
  {
    id: SLUICE_KEEPER_ERRAND_QUEST_ID,
    regionName: REGION_TIR_CHONAIL,
    giverNpcId: 'rona',
    giverName: '로나',
    title: '수문지기의 안부',
    trackerLabel: '수문지기 이멜 찾아가기',
    prerequisiteQuestIds: [HARVEST_VILLAGE_VISIT_QUEST_ID],
    requestText: '개울 상류 수문을 지키는 이멜이 며칠째 내려오지 않는다. 안부를 확인해 달라.',
    guideText: '개울을 따라 북쪽 수문까지 올라가 이멜과 이야기한 뒤 로나에게 돌아가자.',
    startDialogueLines: [
      '이멜 아저씨가 사흘째 빨래터에 안 내려와.',
      '수문 수위표에 분필로 뭘 잔뜩 적고 계시던데… 혹시 무슨 일이 생긴 건 아니겠지?',
      '개울 따라 북쪽 수교 아래 수문에 가 보면 만날 수 있을 거야.'
    ],
    activeDialogueLines: ['수문은 개울 상류, 수교 바로 아래야. 이멜 아저씨를 꼭 만나 줘.'],
    talkTargetDialogueLines: [
      '로나가 보냈다고? 걱정 끼쳐서 미안하구먼.',
      '요즘 수교 물이 조금씩 줄고 있어서 매일 분필로 수위를 재고 있었지.',
      '동굴 쪽 소란이 가라앉으면 물도 돌아오겠지. 로나에게 잘 있다고 전해 주게.'
    ],
    completionDialogueLines: [
      '물이 줄고 있었구나… 그래도 아저씨가 무사해서 다행이야.',
      '고마워! 빨래터에서 쓰려고 아껴 둔 마나 포션이야.'
    ],
    objectives: [
      {
        id: 'talk-sluice-keeper',
        label: '수문지기 이멜과 대화',
        required: 1,
        type: 'talk',
        target: { npcId: 'mage' }
      }
    ],
    rewards: {
      gold: 80,
      experience: 200,
      items: [{ id: 'mana-potion', label: '마나 회복 포션', quantity: 2 }]
    }
  },
  {
    id: MANOR_SPORE_ERRAND_QUEST_ID,
    regionName: REGION_TIR_CHONAIL,
    giverNpcId: 'lady',
    giverName: '세라핀 부인',
    title: '저택 정원의 독 포자',
    trackerLabel: '동굴 버섯돌이 처치',
    prerequisiteQuestIds: [HARVEST_VILLAGE_VISIT_QUEST_ID, CAVE_ENTRANCE_INVESTIGATION_QUEST_ID],
    requestText: '동굴에서 날아온 버섯 포자가 저택 정원을 시들게 한다. 근원인 버섯돌이를 없애 달라.',
    guideText: '동굴 통로의 버섯돌이 6마리를 처치하고 세라핀 부인에게 돌아가자.',
    startDialogueLines: [
      '정원의 장미가 하룻밤 새 잿빛으로 시들었어요.',
      '정원사 말로는 동굴 바람을 타고 온 버섯 포자 탓이래요.',
      '동굴 통로에 사는 버섯돌이 여섯 마리만 없애 주시겠어요?'
    ],
    activeDialogueLines: ['버섯돌이는 동굴 서쪽 현관과 수정 골방 쪽에 있다고 해요.'],
    completionDialogueLines: [
      '정원에 다시 향기가 돌아요. 정말 고마워요.',
      '촌장님께도 당신 이야기를 해 두었답니다. 이건 작은 사례예요.'
    ],
    objectives: [
      {
        id: 'defeat-cave-mushrooms',
        label: '버섯돌이',
        required: 6,
        type: 'monster-defeat',
        target: {
          sceneId: SCENE_CAVE,
          appearanceType: MONSTER_MUSHROOM_APPEARANCE_TYPE
        }
      }
    ],
    rewards: {
      gold: 220,
      experience: 360,
      items: [{ id: 'health-potion', label: '체력 회복 포션', quantity: 3 }]
    }
  },
  {
    id: WEAPON_PATH_QUEST_ID,
    regionName: REGION_TIR_CHONAIL,
    giverNpcId: WIZARD_NPC_ID,
    giverName: '마법사',
    title: '무기의 길',
    trackerLabel: '무기의 길: 광산의 주인',
    prerequisiteQuestIds: [PIG_BOSS_THREAT_QUEST_ID, MINE_ORE_RUSH_QUEST_ID],
    requestText:
      '검이든 지팡이든 활이든, 손에 쥔 무기로 길을 증명하라. 잊힌 광산의 주인 꿀꿀이 대장을 쓰러뜨려라.',
    guideText: '잊힌 수정 광산에서 바위돌이 6마리를 처치하고, 용암 단조장의 꿀꿀이 대장을 쓰러뜨리자.',
    startDialogueLines: [
      '{playerName}, 이제 너는 어느 길도 정해지지 않은 모험가가 아니다.',
      '검을 들면 검사, 지팡이를 들면 마법사, 활을 들면 사수 — 무기가 길을 연다.',
      '마지막 시험이다. 잊힌 광산의 단조장을 지키는 꿀꿀이 대장을 쓰러뜨려라.',
      '가는 길을 막는 바위돌이 여섯도 잊지 말고.'
    ],
    activeDialogueLines: ['광산 북쪽 용암 단조장, 그 깊은 곳에 꿀꿀이 대장이 있다.'],
    completionDialogueLines: [
      '해냈구나. 광산의 불이 잠잠해졌다는 소식이 벌써 마을까지 들려왔다.',
      '이제 너는 어떤 무기를 들어도 제 길을 찾을 것이다.'
    ],
    arcCompletionMessage: '티르코네일과 딴따라마을에 평화가 돌아왔다. — 무기의 길 완결',
    objectives: [
      {
        id: 'defeat-mine-rocks',
        label: '광산 바위돌이',
        required: 6,
        type: 'monster-defeat',
        target: {
          sceneId: SCENE_CRYSTAL_MINE,
          appearanceType: MONSTER_ROCK_APPEARANCE_TYPE
        }
      },
      {
        id: 'defeat-pig-captain',
        label: '꿀꿀이 대장',
        required: 1,
        type: 'monster-defeat',
        target: {
          sceneId: SCENE_CRYSTAL_MINE,
          appearanceType: MONSTER_PIG_APPEARANCE_TYPE,
          characterId: '꿀꿀이대장-보스'
        }
      }
    ],
    rewards: {
      gold: 400,
      experience: 600,
      items: []
    }
  },
  {
    // 사냥터 야영지의 떠돌이 상인이 주는 탐색 퀘스트: 남쪽 숲길 서쪽 굽이, 나무 틈 안쪽 빈터의 상자.
    id: HIDDEN_CACHE_QUEST_ID,
    regionName: REGION_TIR_CHONAIL,
    giverNpcId: CAMP_MERCHANT_NPC_ID,
    giverName: '떠돌이 상인 바렌',
    title: '사냥꾼의 숨은 보급품',
    trackerLabel: '숲속 숨은 상자 찾기',
    prerequisiteQuestIds: [PIG_TROUBLE_QUEST_ID],
    requestText:
      '옛 사냥꾼들이 남쪽 숲길 어딘가에 보급 상자를 숨겨 두었다고 한다. 찾으면 안에 든 것을 나누자고 한다.',
    guideText:
      '야영지 남쪽 숲길을 따라가다 서쪽으로 크게 굽는 곳에서, 나무 사이 좁은 틈 너머 빈터를 찾아보자.',
    startDialogueLines: [
      '어이, 사냥꾼. 잠깐 얘기 좀 하지.',
      '예전 이 야영지 사냥꾼들이 남쪽 숲길 어딘가에 보급 상자를 숨겨 뒀다더군.',
      '길이 서쪽으로 크게 굽는 곳, 나무 사이에 사람 하나 지나갈 틈이 있다는 소문이야.',
      '버섯돌이가 어슬렁거리니 조심하고. 찾으면 안에 든 건 반씩 나누자고.'
    ],
    activeDialogueLines: [
      '숲길이 서쪽으로 굽는 데서 나무 틈을 잘 살펴봐.',
      '틈 너머에 작은 빈터가 있을 거야.'
    ],
    talkTargetDialogueLines: [
      '나무 틈 너머, 꽃 핀 빈터에 낡은 보급 상자가 놓여 있다.',
      '녹슨 걸쇠를 비틀어 열자 기름 먹인 천에 싸인 물건들이 나왔다.',
      '바렌에게 가져가 보자.'
    ],
    completionDialogueLines: [
      '정말 찾았군! 소문이 사실이었어.',
      '약속대로 나누지. 이 활은 네 몫이야. 무기만 바꿔 들어도 싸우는 법이 달라지지.',
      '물약도 좀 챙겨 가. 다음에 또 들르라고.'
    ],
    objectives: [
      {
        id: 'open-hidden-cache',
        label: '숲속 숨은 상자 열기',
        required: 1,
        type: 'talk',
        target: { npcId: HIDDEN_CACHE_NPC_ID }
      }
    ],
    rewards: {
      gold: 150,
      experience: 300,
      items: [
        { id: 'hunting-bow', label: '사냥용 활', quantity: 1 },
        { id: 'health-potion', label: '체력 회복 포션', quantity: 3 }
      ]
    }
  },
  {
    // 남서쪽 집 목수 토렌(villager_1, 잔디밭을 서성인다). 새 집 세 채 주춧돌.
    id: CARPENTER_STONES_QUEST_ID,
    regionName: REGION_TIR_CHONAIL,
    giverNpcId: 'villager_1',
    giverName: '목수 토렌',
    title: '목수의 주춧돌',
    trackerLabel: '주춧돌 구하기: 바위돌이',
    prerequisiteQuestIds: [PIG_TROUBLE_QUEST_ID],
    requestText: '목수 토렌이 새 집 주춧돌로 쓸 단단한 돌을 구해 달라고 했다. 사냥터 바위돌이의 몸돌이 딱 좋다고 한다.',
    guideText: '사냥터 무너진 광산 쪽과 남쪽 숲길의 바위돌이 4마리를 처치하고 토렌에게 돌아가자.',
    startDialogueLines: [
      '이봐, 모험가. 잠깐 시간 있나?',
      '광장에 새 집을 세 채나 올리는데 주춧돌이 모자라. 강가 돌은 물러서 못 써.',
      '사냥터 바위돌이 녀석들 몸이 딱 좋은 화강암이거든. 네 마리만 부숴 주면 내가 주워 오지.'
    ],
    activeDialogueLines: ['바위돌이는 무너진 광산 앞이랑 남쪽 숲길에 있어. 네 마리면 돼.'],
    completionDialogueLines: [
      '이 정도면 집 한 채는 끄떡없겠군!',
      '지붕 다 올리면 처마 밑에 네 이름 하나 새겨 두지. 농담 아니야.'
    ],
    objectives: [
      {
        id: 'defeat-field-rocks',
        label: '바위돌이',
        required: 4,
        type: 'monster-defeat',
        target: { sceneId: SCENE_HUNTING_GROUND, appearanceType: MONSTER_ROCK_APPEARANCE_TYPE }
      }
    ],
    rewards: {
      gold: 120,
      experience: 240,
      items: [{ id: 'health-potion', label: '체력 회복 포션', quantity: 2 }]
    }
  },
  {
    // 시청 분수 곁 정원사 에일린(villager_2). 딴따라마을 저택의 세라핀 부인(lady)에게 장미 씨앗을 얻어 온다.
    id: GARDENER_SEEDS_QUEST_ID,
    regionName: REGION_TIR_CHONAIL,
    giverNpcId: 'villager_2',
    giverName: '정원사 에일린',
    title: '장미 씨앗 한 줌',
    trackerLabel: '세라핀 부인에게 장미 씨앗 얻기',
    prerequisiteQuestIds: [HARVEST_VILLAGE_VISIT_QUEST_ID],
    requestText: '정원사 에일린이 딴따라마을 저택 정원의 장미 씨앗을 얻어 달라고 했다.',
    guideText: '딴따라마을 저택 정원의 세라핀 부인과 이야기한 뒤 에일린에게 돌아가자.',
    startDialogueLines: [
      '딴따라마을에 다녀오셨다면서요? 거기 저택 정원 장미가 그렇게 곱대요.',
      '시청 앞 화분에도 한 번 피워 보고 싶어서요. 세라핀 부인께 씨앗 한 줌만 부탁드려 주실래요?'
    ],
    activeDialogueLines: ['세라핀 부인은 저택 정원에 계신대요. 수교 아치 밑 계단으로 내려가면 돼요.'],
    talkTargetDialogueLines: [
      '티르코네일 정원사가 보냈다고요? 어머, 반가워라.',
      '여기 씨앗이에요. 햇볕 잘 드는 데 심고, 물은 아침에만 주라고 전해 줘요.'
    ],
    completionDialogueLines: [
      '와, 진짜 장미 씨앗이에요! 아침에만 물을 주라고요? 꼭 그렇게 할게요.',
      '내년 봄에 시청 앞이 빨개지면, 그건 다 당신 덕이에요.'
    ],
    objectives: [
      {
        id: 'talk-lady-seeds',
        label: '세라핀 부인과 대화',
        required: 1,
        type: 'talk',
        target: { npcId: 'lady' }
      }
    ],
    rewards: {
      gold: 80,
      experience: 200,
      items: [{ id: 'mana-potion', label: '마나 회복 포션', quantity: 2 }]
    }
  },
  {
    // 시계탑지기 노인(villager_3). 말캉이 점액은 톱니 기름으로 그만이다.
    id: CLOCK_OIL_QUEST_ID,
    regionName: REGION_TIR_CHONAIL,
    giverNpcId: 'villager_3',
    giverName: '시계탑지기 노인',
    title: '시계탑의 기름칠',
    trackerLabel: '톱니 기름: 말캉이',
    prerequisiteQuestIds: [SLIME_BOSS_SHADOW_QUEST_ID],
    requestText: '시계탑지기 노인이 톱니에 바를 말캉이 점액을 구해 달라고 했다.',
    guideText: '사냥터의 말캉이 8마리를 처치하고 시계탑지기 노인에게 돌아가자.',
    startDialogueLines: [
      '요즘 시계탑 톱니가 끼익끼익 우는구먼. 기름이 다 말랐어.',
      '옛날부터 말캉이 점액만 한 기름이 없지. 끈적하지도 않고 겨울에도 안 얼거든.',
      '사냥터 말캉이 여덟 마리면 한 해는 거뜬하다네.'
    ],
    activeDialogueLines: ['말캉이 여덟 마리. 점액은 내가 알아서 걷어 오지.'],
    completionDialogueLines: [
      '들리나? 톱니 소리가 비단처럼 부드러워졌어.',
      '이 시계탑은 앞으로도 한 번도 멈추지 않을 게야. 자네 덕분에 말이지.'
    ],
    objectives: [
      {
        id: 'defeat-clock-slimes',
        label: '말캉이',
        required: 8,
        type: 'monster-defeat',
        target: { sceneId: SCENE_HUNTING_GROUND, appearanceType: MONSTER_SLIME_APPEARANCE_TYPE }
      }
    ],
    rewards: {
      gold: 100,
      experience: 260,
      items: [{ id: 'health-potion', label: '체력 회복 포션', quantity: 2 }]
    }
  },
  {
    // 다리지기 오웬(villager_4). 수교 물소리가 가늘어졌다 — 딴따라마을 아치 문지기 헤나 경에게 아래쪽 물보라를 묻는다.
    // 2장(q016 사라지는 물) 앞에 물이 줄고 있다는 것을 한 번 더 깐다.
    id: BRIDGE_WATCH_QUEST_ID,
    regionName: REGION_TIR_CHONAIL,
    giverNpcId: 'villager_4',
    giverName: '다리지기 오웬',
    title: '가늘어진 물소리',
    trackerLabel: '헤나 경에게 아치 밑 물보라 묻기',
    prerequisiteQuestIds: [SLUICE_KEEPER_ERRAND_QUEST_ID],
    requestText: '다리지기 오웬이 수교 물소리가 가늘어졌다며, 딴따라마을 아치 문지기 헤나 경에게 아래쪽 사정을 물어 달라고 했다.',
    guideText: '수교 아치 밑 계단으로 내려가 딴따라마을 헤나 경과 이야기한 뒤 오웬에게 돌아가자.',
    startDialogueLines: [
      '이멜 영감이 수위표에 분필을 긋고 있다는 얘기, 자네도 들었소?',
      '여기 위에서도 느껴지오. 아치 밑 물소리가 예전보다 가늘어졌어.',
      '아래 아치를 지키는 헤나 경에게 물보라가 어떤지 좀 물어봐 주겠소? 나는 다리를 비울 수가 없어서.'
    ],
    activeDialogueLines: ['헤나 경은 딴따라마을 북쪽 아치 밑 계단 앞에 서 있소.'],
    talkTargetDialogueLines: [
      '오웬이 물었다고? 역시 그 친구 귀는 못 속이는군.',
      '사철 마르지 않던 물보라가 요즘은 아침나절이면 그치오. 이런 일은 처음이오.',
      '상류 어딘가에서 물을 붙잡고 있는 게 있는 모양이오. 오웬에게 그렇게 전해 주시오.'
    ],
    completionDialogueLines: [
      '물보라가 아침이면 그친다고… 그래, 내 귀가 틀리지 않았구먼.',
      '물길이 마르면 마을도 마르는 법이오. 무슨 일이 생기면 자네가 제일 먼저 알게 될 게요.'
    ],
    objectives: [
      {
        id: 'talk-gatekeeper',
        label: '헤나 경과 대화',
        required: 1,
        type: 'talk',
        target: { npcId: 'gatekeeper' }
      }
    ],
    rewards: {
      gold: 90,
      experience: 220,
      items: [{ id: 'health-potion', label: '체력 회복 포션', quantity: 2 }]
    }
  },
  {
    // 2장 첫 퀘스트. q012 에서 이멜은 "동굴 쪽 소란이 가라앉으면 물도 돌아오겠지"라고 했다 —
    // q014 로 소란을 잠재웠는데도 물이 돌아오지 않는 데서 시작한다. 수문 위 아치(upstream_gate)는
    // q014 완료 후에만 열린다.
    id: VANISHING_WATER_QUEST_ID,
    regionName: REGION_SUNKEN_FOREST,
    giverNpcId: SLUICE_KEEPER_NPC_ID,
    giverName: '이멜',
    title: '사라지는 물',
    trackerLabel: '물이 사라지는 곳 찾기',
    prerequisiteQuestIds: [WEAPON_PATH_QUEST_ID],
    requestText:
      '동굴의 소란이 가라앉았는데도 수교 물이 돌아오지 않는다. 개울을 거슬러 올라가 물이 어디로 사라지는지 알아봐 달라.',
    guideText:
      '이멜이 지키는 수문 위 아치를 지나 수로 상류길로 올라가, 물이 사라지는 곳을 살펴본 뒤 이멜에게 돌아가자.',
    startDialogueLines: [
      '자네, 마침 잘 왔네.',
      '동굴 소란이 가라앉았는데도 수교 물이 돌아오질 않아. 오히려 더 줄었지.',
      '백 년치 수위표에도 이런 줄어듦은 없었네. 물이 어딘가로 새고 있는 게야.',
      '수문 위 아치를 열어 두었으니, 개울을 거슬러 올라가 물이 어디로 가는지 봐 주게.'
    ],
    activeDialogueLines: ['아치 너머로 개울을 거슬러 올라가 보게. 물이 어디서 사라지는지 알아야 해.'],
    talkTargetDialogueLines: [
      '물이 땅속 구멍으로 소용돌이치며 빨려 들고 있다.',
      '구멍 곁에 반쯤 잠긴 돌 비석이 있다. 이끼 사이로 낯선 글자가 희미하게 빛난다.',
      '이멜에게 알려야겠다.'
    ],
    completionDialogueLines: [
      '구멍이라고? 물이 땅으로 빨려 든단 말인가…',
      '빛나는 비석 이야기도 마음에 걸리는구먼. 그런 글자는 백 년 기록 어디에도 없어.',
      '그 물길 너머 숲 깊은 곳에 갈대골이라는 늪 마을이 있다네. 그쪽 사람들이라면 뭔가 알지도 모르지.',
      '길이 물에 잠겼다니 건널 방법부터 찾아야겠군. 수고했네, 얼마 안 되지만 받아 두게.'
    ],
    objectives: [
      {
        id: 'enter-upstream-waterway',
        label: '수로 상류길로 가기',
        required: 1,
        type: 'scene-enter',
        target: { sceneId: SCENE_UPSTREAM_WATERWAY }
      },
      {
        id: 'inspect-sunken-stele',
        label: '물이 사라지는 곳 살펴보기',
        required: 1,
        type: 'talk',
        target: { npcId: SUNKEN_STELE_NPC_ID }
      }
    ],
    rewards: {
      gold: 220,
      experience: 450,
      items: [{ id: 'health-potion', label: '체력 회복 포션', quantity: 2 }]
    }
  },
  {
    // 늪 마을 갈대골로 건너간다. 이멜이 소식을 전하고, 도착하면 촌장 미렌에게 보고한다(turnInNpcId).
    // 상류길 전망 둑의 나룻배(reed_ferry)는 q016 완료 후에 닿아 있다.
    id: REED_VILLAGE_QUEST_ID,
    regionName: REGION_SUNKEN_FOREST,
    giverNpcId: SLUICE_KEEPER_NPC_ID,
    giverName: '이멜',
    turnInNpcId: REED_VILLAGE_CHIEF_NPC_ID,
    turnInName: '촌장 미렌',
    title: '갈대골',
    trackerLabel: '나룻배 타고 갈대골로',
    prerequisiteQuestIds: [VANISHING_WATER_QUEST_ID],
    requestText:
      '갈대골 사공 토빈이 수로를 거슬러 왔다. 늪 물이 불어 마을이 잠기고 있다며, 촌장 미렌이 만나고 싶어 한다.',
    guideText: '수로 상류길 동쪽 전망 둑 끝의 나룻배를 타고 갈대골로 건너가, 촌장 미렌을 만나자.',
    startDialogueLines: [
      '마침 잘 왔네. 아까 늪 쪽에서 낯선 나룻배 하나가 수로를 거슬러 올라왔다네.',
      '갈대골 사공 토빈이라더군. 늪 물이 하루가 다르게 불어나 마을이 잠기고 있다는 게야.',
      '여기선 물이 땅으로 빨려 드는데, 저쪽에선 물이 불어난다… 우연은 아니겠지.',
      '촌장 미렌이 자네를 꼭 만나고 싶어 한다네. 토빈이 전망 둑에 배를 대어 두었으니 타고 건너가 보게.'
    ],
    activeDialogueLines: ['전망 둑 끝에서 토빈의 나룻배를 타게. 촌장 미렌이 기다린다네.'],
    completionDialogueLines: [
      '자네가 이멜이 말한 그 사람이군. 먼 길 와 주어 고맙네.',
      '숲이 가라앉기 시작한 건 석 달 전, 숲속 유적에서 종이 처음 울린 밤부터였네.',
      '그 뒤로 늪 물이 불어 갈대밭이 반이나 잠기고, 숲에 들어간 사냥꾼들은 하나둘 돌아오지 않았지.',
      '오늘은 우선 쉬게. 마을 사람들에게 숲 이야기를 들어 두면 도움이 될 걸세.'
    ],
    objectives: [
      {
        id: 'reach-reed-village',
        label: '갈대골에 도착',
        required: 1,
        type: 'scene-enter',
        target: { sceneId: SCENE_REED_VILLAGE }
      }
    ],
    rewards: {
      gold: 250,
      experience: 500,
      items: [{ id: 'health-potion', label: '체력 회복 포션', quantity: 2 }]
    }
  },
  {
    // 숲 문은 q017 을 마치면 열린다. 미렌의 조카 렌을 포함한 사냥꾼 다섯이 석 달째 돌아오지 않았다.
    // 사냥꾼 일지가 "동쪽 안개 속 종소리"를 가리켜 c2-04(독안개, 오디의 해독 향)로 이어진다.
    id: DROWNED_PATH_QUEST_ID,
    regionName: REGION_SUNKEN_FOREST,
    giverNpcId: REED_VILLAGE_CHIEF_NPC_ID,
    giverName: '촌장 미렌',
    title: '늪에 잠긴 길',
    trackerLabel: '늪개구리 전사 처치',
    prerequisiteQuestIds: [REED_VILLAGE_QUEST_ID],
    requestText:
      '석 달 전 숲에 들어간 사냥꾼 다섯이 돌아오지 않았다. 숲 어귀의 늪개구리 전사들을 몰아내고 사냥꾼들의 흔적을 찾아 달라.',
    guideText:
      '갈대골 남동쪽 문으로 가라앉은 숲에 들어가 늪개구리 전사를 물리치고, 북쪽 둔덕의 사냥꾼 야영지를 살펴본 뒤 미렌에게 돌아가자.',
    startDialogueLines: [
      '하르에게 일러 두었네. 이제 숲 문을 지나갈 수 있을 걸세.',
      '석 달 전 숲에 들어간 사냥꾼 다섯이 아직 돌아오지 않았네. 그중엔 내 조카 렌도 있지.',
      '숲 어귀엔 요즘 삼지창을 든 개구리 녀석들이 떼로 몰려다닌다더군. 녀석들을 몰아내 주게.',
      '사냥꾼들은 늘 북쪽 둔덕에 야영지를 꾸렸었네. 무엇이든 흔적을 찾아 주게.'
    ],
    activeDialogueLines: ['북쪽 둔덕의 사냥꾼 야영지를 찾아보게. 개구리 녀석들을 조심하고.'],
    talkTargetDialogueLines: [
      '오래전에 꺼진 모닥불 곁에 갈대골 문양이 새겨진 활집이 놓여 있다.',
      '젖은 사냥 일지의 마지막 장: "동쪽 안개 속에서 종이 울린다. 렌이 소리를 따라갔다. 우리도 뒤따른다."',
      '일지를 챙겨 촌장 미렌에게 가져가자.'
    ],
    completionDialogueLines: [
      '렌의 활집이로군… 그 아이가 아끼던 것이야.',
      '안개 속 종소리를 따라갔다고? 그 안개는 들이마시면 숨이 막히는 독안개라네.',
      '약초꾼 오디라면 독안개를 견딜 방법을 알지도 모르겠군. 북쪽 섬 오두막으로 찾아가 보게.'
    ],
    objectives: [
      {
        id: 'defeat-frog-warriors',
        label: '늪개구리 전사',
        required: 6,
        type: 'monster-defeat',
        target: { sceneId: SCENE_SUNKEN_FOREST, appearanceType: 'monster_frog' }
      },
      {
        id: 'find-hunter-trace',
        label: '사냥꾼 야영지 살펴보기',
        required: 1,
        type: 'talk',
        target: { npcId: HUNTER_TRACE_NPC_ID }
      }
    ],
    rewards: {
      gold: 320,
      experience: 700,
      items: [{ id: 'health-potion', label: '체력 회복 포션', quantity: 3 }]
    }
  },
  {
    // 해독 향 재료는 식인 꽃의 꽃가루주머니(독을 먹고 자라 꽃가루가 독을 잡아먹는다). 마치면 숲의
    // 독안개 장막이 걷히고(quest.hiddenWhenCompleted) 오디의 약초 상점에서 향을 살 수 있다.
    id: ANTIDOTE_INCENSE_QUEST_ID,
    regionName: REGION_SUNKEN_FOREST,
    giverNpcId: HERBALIST_NPC_ID,
    giverName: '약초꾼 오디',
    title: '해독 향',
    trackerLabel: '식인 꽃 처치',
    prerequisiteQuestIds: [DROWNED_PATH_QUEST_ID],
    requestText: '독안개를 견딜 해독 향을 만들려면 식인 꽃의 꽃가루주머니가 필요하다. 가라앉은 숲의 식인 꽃을 쓰러뜨려 달라.',
    guideText: '가라앉은 숲 물가에 뿌리박은 식인 꽃 셋을 쓰러뜨리고 약초꾼 오디에게 돌아가자.',
    startDialogueLines: [
      '촌장님께 들었어요. 동쪽 독안개를 건너야 한다고요?',
      '맨몸으로 들어가면 몇 걸음 못 가서 쓰러져요. 해독 향을 피워야 해요.',
      '향을 만들려면 식인 꽃의 꽃가루주머니가 필요해요. 그 꽃은 독을 먹고 자라서, 꽃가루가 독을 잡아먹거든요.',
      '숲에서 식인 꽃 세 송이만 쓰러뜨려 주세요. 가까이 가면 무니까 조심하고요.'
    ],
    activeDialogueLines: ['식인 꽃은 물가에 뿌리를 박고 움직이지 않아요. 멀리서 찌르거나 쏘면 덜 다쳐요.'],
    completionDialogueLines: [
      '이 정도면 충분해요! 잠깐만요…',
      '자, 해독 향이에요. 피우면 한동안 독안개를 막아 줘요. 다 떨어지면 제 상점에서 사 가세요.',
      '향이 꺼지기 전에 안개를 빠져나와야 해요. 숨이 막히기 시작하면 바로 피우거나 돌아오고요.',
      '하르에게도 말해 둘게요. 숲 속 안개 장막도 이제 지나갈 수 있을 거예요.'
    ],
    objectives: [
      {
        id: 'defeat-man-eater-flowers',
        label: '식인 꽃',
        required: 3,
        type: 'monster-defeat',
        target: { sceneId: SCENE_SUNKEN_FOREST, appearanceType: 'monster_flower' }
      }
    ],
    rewards: {
      gold: 200,
      experience: 650,
      items: [{ id: 'antidote-incense', label: '해독 향', quantity: 3 }]
    }
  },
  {
    // 해독 향을 피우고 독안개 속으로 — 남쪽 섬에 쓰러진 사냥꾼 렌을 찾아 미렌에게 알린다. 렌은 나머지
    // 사냥꾼들이 동쪽 유적(잠긴 신전)으로 끌려갔다고 전한다 → c2-05 숲의 주인, c2-06 신전.
    id: BEYOND_THE_FOG_QUEST_ID,
    regionName: REGION_SUNKEN_FOREST,
    giverNpcId: HERBALIST_NPC_ID,
    giverName: '약초꾼 오디',
    turnInNpcId: REED_VILLAGE_CHIEF_NPC_ID,
    turnInName: '촌장 미렌',
    title: '독안개 너머',
    trackerLabel: '안개 속에서 렌 찾기',
    prerequisiteQuestIds: [ANTIDOTE_INCENSE_QUEST_ID],
    requestText: '해독 향을 피우고 독안개 속으로 들어가 사라진 사냥꾼 렌을 찾아 달라.',
    guideText: '해독 향을 피우고(가방에서 쓰거나 퀵슬롯에 올려 두자) 숲 동쪽 독안개 속 남쪽 섬으로 가 렌을 찾자. 찾으면 촌장 미렌에게 알리자.',
    startDialogueLines: [
      '렌은 제 소꿉친구예요. 꼭… 꼭 찾아 주세요.',
      '안개에 들어가기 전에 해독 향을 피우는 거 잊지 마세요. 가방에서 쓰거나 퀵슬롯에 올려 두면 돼요.',
      '안개 깊은 곳, 남쪽 섬 쪽에서 종소리가 들린다고들 해요. 렌도 그 소리를 따라갔을 거예요.'
    ],
    activeDialogueLines: ['해독 향을 피우고 안개 속 남쪽 섬으로 가 보세요. 향이 꺼지기 전에요!'],
    talkTargetDialogueLines: [
      '…누, 누구야? 갈대골에서 왔다고?',
      '종소리를 따라왔는데… 안개에 정신을 잃었어. 다른 사냥꾼들은 개구리 놈들한테 끌려갔어. 동쪽 유적 쪽으로.',
      '나는 괜찮아, 혼자 걸을 수 있어. 촌장님께 알려 줘. 유적에서… 종이 울리고 있다고.'
    ],
    completionDialogueLines: [
      '렌이 살아 있다니! 고맙네, 정말 고맙네.',
      '나머지 사냥꾼들은 동쪽 유적으로 끌려갔다고… 그곳은 옛 신전이 잠긴 곳이라네.',
      '종소리, 가라앉는 숲, 사라지는 물… 모두 그 신전에서 시작된 게 틀림없네.',
      '신전으로 가는 길목은 숲의 주인이라 불리는 거대한 개구리가 지킨다고 들었네. 몸을 추스르고 준비하게.'
    ],
    objectives: [
      {
        id: 'find-lost-hunter',
        label: '사냥꾼 렌 찾기',
        required: 1,
        type: 'talk',
        target: { npcId: LOST_HUNTER_NPC_ID }
      }
    ],
    rewards: {
      gold: 400,
      experience: 900,
      items: [{ id: 'antidote-incense', label: '해독 향', quantity: 2 }]
    }
  },
  {
    // 숲의 주인(c2-05) — 안개 길 동쪽 끝 공터에서 신전 가는 길목을 지키는 늪지기 거대개구리. 사냥꾼들을 끌고 간
    // 개구리 무리의 우두머리로, 석 달 전 종이 울린 뒤로 독을 뿜는다. 보고하면 길을 덮은 가시덩굴이 시들고
    // (sunken-forest east_thorns, quest.hiddenWhenCompleted) 미렌이 신전 외곽의 학자 셀린을 알려 준다 → c2-06.
    id: FOREST_LORD_QUEST_ID,
    regionName: REGION_SUNKEN_FOREST,
    giverNpcId: REED_VILLAGE_CHIEF_NPC_ID,
    giverName: '촌장 미렌',
    title: '숲의 주인',
    trackerLabel: '늪지기 거대개구리 처치',
    prerequisiteQuestIds: [BEYOND_THE_FOG_QUEST_ID],
    requestText: '신전으로 가는 길목을 지키는 숲의 주인, 늪지기 거대개구리를 쓰러뜨려 달라.',
    guideText:
      '해독 향을 피우고 가라앉은 숲 독안개 길을 따라 동쪽 끝 공터로 가 늪지기 거대개구리를 쓰러뜨리자. 녀석이 뱉은 초록 독 웅덩이는 피하고, 쓰러뜨리면 촌장 미렌에게 알리자.',
    startDialogueLines: [
      '렌이 정신을 차리고 이야기를 더 해 주었네.',
      '사냥꾼들을 끌고 간 개구리 무리에겐 우두머리가 있다더군. 안개 길 동쪽 끝, 신전으로 가는 길목에 버티고 있는 거대한 개구리라네.',
      '늪 사람들은 예부터 그놈을 숲의 주인이라 불렀지. 본디 늪을 지키던 순한 놈이었는데… 종이 처음 울린 밤부터 독을 뿜기 시작했다네.',
      '그놈이 뱉는 독 웅덩이는 해독 향으로도 못 막는다더군. 발밑을 잘 보게. 멀리 떨어지면 긴 혀로 끌어당긴다니 그것도 조심하고.',
      '숲의 주인을 쓰러뜨려 주게. 그래야 신전으로 가는 길이 열리네.'
    ],
    activeDialogueLines: ['숲의 주인은 안개 길 동쪽 끝 공터에 있네. 해독 향을 넉넉히 챙겨 가게.'],
    completionDialogueLines: [
      '숲의 주인을 쓰러뜨렸다고? 이 늪에서 그런 일을 해낸 사람은 자네가 처음일세.',
      '그놈의 독을 먹고 자라던 가시덩굴도 이제 시들 걸세. 숲 동쪽 끝 길로 신전 외곽에 갈 수 있을 거야.',
      '그러고 보니 몇 해째 신전 외곽에서 야영하며 유적을 살피는 학자가 있다네. 셀린이라고… 비석의 옛 글자를 읽을 줄 안다지.',
      '종소리의 정체도, 끌려간 사냥꾼들의 행방도 그 학자라면 알지 모르네. 셀린을 찾아가 보게.'
    ],
    objectives: [
      {
        id: 'defeat-forest-lord',
        label: '늪지기 거대개구리',
        required: 1,
        type: 'monster-defeat',
        target: { sceneId: SCENE_SUNKEN_FOREST, appearanceType: 'monster_frog_king' }
      }
    ],
    rewards: {
      gold: 650,
      experience: 1500,
      items: [{ id: 'health-potion', label: '체력 회복 포션', quantity: 3 }]
    }
  },
  {
    // 비석의 글자(c2-06) — 신전 외곽 남쪽 돌 광장의 첫 봉인 비석. 수호하는 해골병을 물리치고 비석에 손을 대면
    // 글자가 빛난다: "봉인 셋이 물을 붙든다". 보고하면 비석이 빛나는 그림으로 바뀌고(seal_stele_1_lit) 신전
    // 입구 돌문이 열린다(temple_door_seal 숨김, temple_stairs 포탈) → c2-07 신전 1층의 남은 두 봉인.
    id: STELE_SCRIPT_QUEST_ID,
    regionName: REGION_SUNKEN_FOREST,
    giverNpcId: SCHOLAR_NPC_ID,
    giverName: '학자 셀린',
    title: '비석의 글자',
    trackerLabel: '유적 해골병 처치',
    prerequisiteQuestIds: [FOREST_LORD_QUEST_ID],
    requestText: '첫 봉인 비석을 지키는 해골병들을 물리치고, 비석에 손을 대 빛나는 옛 글자를 읽어 달라.',
    guideText:
      '잠긴 신전 외곽 남쪽 돌 광장에서 유적 해골병을 물리치고 봉인 비석에 손을 대 글자를 읽자. 읽으면 북서쪽 야영지의 셀린에게 돌아가자.',
    startDialogueLines: [
      '촌장님이 보내셨다고요? 반가워요. 저는 셀린, 이 유적을 몇 해째 살피고 있어요.',
      '석 달 전부터 신전 깊은 곳에서 종이 울려요. 그 뒤로 숲이 가라앉고, 무덤에 누워 있어야 할 해골병들이 일어나 돌아다니기 시작했죠.',
      '남쪽 돌 광장의 비석이 열쇠예요. 그런데 비석을 지키는 해골병들 때문에 가까이 갈 수가 없어요.',
      '해골병들을 물리치고 비석에 손을 대 보세요. 옛 글자는 사람 손이 닿으면 잠깐 빛나거든요. 그때 보이는 글자를 알려 주세요.'
    ],
    activeDialogueLines: ['남쪽 돌 광장의 비석이에요. 해골병들은 칼을 휘두르니 조심하세요.'],
    talkTargetDialogueLines: [
      '비석에 손을 대자 새겨진 글자가 하나씩 푸르게 빛나기 시작한다.',
      '"봉인 셋이 물을 붙든다. 하나가 깨지면 물이 새고, 셋이 깨지면 잠든 이가 깬다."',
      '마지막 글자가 빛나자 북동쪽 신전 입구에서 돌이 갈리는 소리가 울렸다. 셀린에게 알리자.'
    ],
    completionDialogueLines: [
      '봉인 셋이 물을 붙든다… 역시 그랬군요!',
      '숲의 물이 빠지는 건 봉인이 하나씩 깨지고 있어서예요. 남쪽 비석이 첫 번째 봉인이고, 방금 당신 손으로 다시 밝혀졌어요.',
      '나머지 두 봉인은 신전 안에 있을 거예요. 비석이 밝아지면서 신전 입구의 돌문도 풀렸을 거고요.',
      '셋이 깨지면 잠든 이가 깬다… 종을 울리는 누군가가 일부러 봉인을 깨고 있는 거예요. 서둘러야 해요.'
    ],
    objectives: [
      {
        id: 'defeat-ruin-skeletons',
        label: '유적 해골병',
        required: 5,
        type: 'monster-defeat',
        target: { sceneId: SCENE_RUINS_OUTSKIRTS, appearanceType: 'monster_skeleton' }
      },
      {
        id: 'read-first-seal',
        label: '첫 봉인 비석 읽기',
        required: 1,
        type: 'talk',
        target: { npcId: FIRST_SEAL_STELE_NPC_ID }
      }
    ],
    rewards: {
      gold: 700,
      experience: 1700,
      items: [
        { id: 'health-potion', label: '체력 회복 포션', quantity: 2 },
        { id: 'mana-potion', label: '마나 회복 포션', quantity: 2 }
      ]
    }
  },
  {
    // 남은 두 봉인(c2-07) — 신전 1층 서쪽·동쪽 끝 방의 비석. 물에 빠진 자(옛 신관들)와 이끼 골렘이 지킨다.
    // 보고하면 두 비석이 빛나고(_lit) 2층으로 가는 돌문이 열린다. 셀린이 마법사의 전언석을 건넨다 → q024.
    id: REMAINING_SEALS_QUEST_ID,
    regionName: REGION_SUNKEN_FOREST,
    giverNpcId: SCHOLAR_NPC_ID,
    giverName: '학자 셀린',
    title: '남은 두 봉인',
    trackerLabel: '물에 빠진 자 처치',
    prerequisiteQuestIds: [STELE_SCRIPT_QUEST_ID],
    requestText: '잠긴 신전 1층 동쪽과 서쪽 끝 방의 봉인 비석 둘을 다시 밝혀 달라.',
    guideText:
      '신전 외곽 북동쪽 돌계단으로 잠긴 신전 1층에 내려가, 물에 빠진 자들을 물리치며 서쪽·동쪽 끝 방의 비석에 손을 대자. 둘 다 밝히면 셀린에게 돌아가자.',
    startDialogueLines: [
      '신전 문이 열렸어요! 이제 남은 두 봉인을 찾아야 해요.',
      '돌문의 글자가 두 갈래로 동쪽과 서쪽을 가리켰다고요? 그럼 신전 1층 양쪽 끝 방에 하나씩 있을 거예요.',
      '안에는 물에 잠겨 죽은 옛 신관들이 아직 신전을 떠돌아요. 느리지만 끈질기니 둘러싸이지 않게 조심하세요.',
      '두 비석을 모두 밝혀 주세요. 그러면 위층으로 가는 길도 열릴 거예요.'
    ],
    activeDialogueLines: ['신전 1층 서쪽과 동쪽 끝 방의 비석이에요. 하나만 밝혀서는 안 돼요.'],
    talkTargetDialogueLinesByNpcId: {
      seal_stele_2: [
        '비석에 손을 대자 물기에 젖은 글자가 하나씩 푸르게 빛난다.',
        '"물을 붙드는 둘째 봉인. 깨어나려는 이의 이름을 부르지 말라."',
        '봉인 하나가 다시 밝혀졌다. 신전 어딘가에서 새던 물소리가 잦아든다. 동쪽 끝 방에 비석이 하나 더 있다.'
      ],
      seal_stele_3: [
        '이끼 낀 글자가 손끝에서 하나씩 깨어나 푸르게 빛난다.',
        '"물을 붙드는 셋째 봉인. 종이 울리면 사제가 먼저 깬다."',
        '봉인 하나가 다시 밝혀졌다. 두 비석을 모두 밝혔다면 셀린에게 알리자.'
      ]
    },
    completionDialogueLines: [
      '두 봉인이 다시 빛난다고요? 이제 물이 더 새지는 않을 거예요!',
      '그런데 이상해요. 비석마다 "사제"라는 말이 나와요. 종이 울리면 사제가 먼저 깬다고…',
      '봉인을 깨던 존재는 아마 2층 봉인의 방에 있을 거예요. 위층으로 가는 돌문도 이제 열렸을 거고요.',
      '아, 그리고… 티르코네일의 마법사님께 편지를 띄웠더니 답장 대신 이게 왔어요. 전언석이래요.'
    ],
    objectives: [
      {
        id: 'defeat-drowned',
        label: '물에 빠진 자',
        required: 5,
        type: 'monster-defeat',
        target: { sceneId: SCENE_SUNKEN_TEMPLE_1F, appearanceType: 'monster_drowned' }
      },
      {
        id: 'read-second-seal',
        label: '두 번째 봉인 비석 읽기',
        required: 1,
        type: 'talk',
        target: { npcId: 'seal_stele_2' }
      },
      {
        id: 'read-third-seal',
        label: '세 번째 봉인 비석 읽기',
        required: 1,
        type: 'talk',
        target: { npcId: 'seal_stele_3' }
      }
    ],
    rewards: {
      gold: 800,
      experience: 2000,
      items: [{ id: 'health-potion', label: '체력 회복 포션', quantity: 3 }]
    }
  },
  {
    // 봉인의 방(c2-08 앞부분) — 2층에 들어서면 셀린이 건넨 전언석에서 티르코네일 마법사의 목소리가 들린다
    // (autoTurnInOnSceneEnter + remoteSpeaker, 1장 q005 와 같은 방식). 이어서 q025 가 바로 시작된다.
    id: SEAL_CHAMBER_QUEST_ID,
    regionName: REGION_SUNKEN_FOREST,
    giverNpcId: SCHOLAR_NPC_ID,
    giverName: '학자 셀린',
    remoteSpeaker: { npcId: WIZARD_NPC_ID, name: '마법사(전언석)' },
    title: '봉인의 방',
    trackerLabel: '2층 봉인의 방으로',
    prerequisiteQuestIds: [REMAINING_SEALS_QUEST_ID],
    requestText: '전언석을 지니고 잠긴 신전 2층 봉인의 방으로 올라가 달라.',
    guideText: '잠긴 신전 1층 북쪽, 가고일이 지키는 계단으로 2층 봉인의 방에 올라가자.',
    autoTurnInOnSceneEnter: true,
    startDialogueLines: [
      '이 전언석을 품에 넣어 두세요. 마법사님이 당신과 직접 이야기하고 싶어 하셨대요.',
      '봉인의 방은 신전 1층 북쪽 계단 위예요. 가고일 석상이 지키는 그 계단이요.',
      '저는 여기서 비석의 나머지 글자를 읽고 있을게요. 조심하세요, {playerName}.'
    ],
    activeDialogueLines: ['신전 1층 북쪽 계단으로 올라가세요. 전언석을 잃어버리면 안 돼요!'],
    completionDialogueLines: [
      '(품속의 전언석이 따뜻해지며 낯익은 목소리가 울린다)',
      '들리느냐, {playerName}. 티르코네일의 마법사다. 셀린의 편지로 다 들었다. 봉인 셋을 다시 밝혔다니 장하구나.',
      '동굴의 기운이 더 깊은 곳에서 화가 난 것처럼 움직인다고 했던 것을 기억하느냐? 그 기운이 땅 밑 물길을 타고 이 신전까지 흘러왔다.',
      '그 기운에 옛 신전을 지키던 늪의 사제가 삼켜졌다. 종을 울려 봉인을 깨던 자가 바로 그다.'
    ],
    objectives: [
      {
        id: 'reach-seal-chamber',
        label: '봉인의 방 도착',
        required: 1,
        type: 'scene-enter',
        target: { sceneId: SCENE_SUNKEN_TEMPLE_2F }
      }
    ],
    rewards: {
      gold: 300,
      experience: 800,
      items: []
    }
  },
  {
    // 늪의 사제(c2-08, 2장 최종 보스) — 2층 봉인의 방. 물에 빠진 자를 불러내고(소환) 발밑에서 물기둥을 솟게 한다
    // (bossSkills.ts). q024 가 끝나는 순간 전언석의 목소리로 이어서 맡는다(시작 대사도 마법사의 말).
    // 쓰러뜨리고 셀린에게 보고하면 사제의 마지막 말("진짜 깨어나는 것은 북쪽에") → q026.
    id: SWAMP_PRIEST_QUEST_ID,
    regionName: REGION_SUNKEN_FOREST,
    giverNpcId: SCHOLAR_NPC_ID,
    giverName: '학자 셀린',
    title: '늪의 사제',
    trackerLabel: '늪의 사제 처치',
    prerequisiteQuestIds: [SEAL_CHAMBER_QUEST_ID],
    requestText: '봉인을 깨던 늪의 사제를 쓰러뜨리고 셀린에게 알려 달라.',
    guideText:
      '잠긴 신전 2층 봉인의 방 안쪽 제단 앞의 늪의 사제를 쓰러뜨리자. 사제가 불러낸 물에 빠진 자에 둘러싸이지 말고, 바닥의 푸른 고리가 차오르면 비키자. 쓰러뜨리면 신전 외곽의 셀린에게 돌아가자.',
    startDialogueLines: [
      '(전언석의 목소리가 이어진다) 사제를 쓰러뜨려라, {playerName}.',
      '녀석은 물에 빠진 자들을 불러내고, 네 발밑에서 물기둥을 솟구치게 할 것이다. 바닥에 푸른 고리가 차오르면 바로 비켜라.',
      '사제가 쓰러지면 봉인이 온전해지고 물도 다시 흐를 것이다. 다 끝나면 셀린에게 알려 주어라.'
    ],
    activeDialogueLines: ['늪의 사제는 2층 봉인의 방 안쪽 제단 앞에 있어요. 마법사님 말씀대로 발밑을 조심하세요.'],
    completionDialogueLines: [
      '(늪의 사제가 남긴 마지막 말을 셀린에게 전했다)',
      '사제를 쓰러뜨렸다고요? 방금 신전 안쪽에서 커다란 물소리가 났어요. 막혀 있던 물길이 다시 열린 거예요!',
      '그리고 조금 전 신전 계단에서 사냥꾼 넷이 비틀거리며 올라왔어요. 사제가 물 밑 방에 가둬 두었대요. 렌의 동료들이에요! 갈대골로 먼저 보냈어요.',
      '그런데 사제가 그런 말을 했다고요? 북쪽에서 깨어나는 것… 비석 어디에도 그런 글자는 없었는데.',
      '…일단은 기뻐해요. 당신 덕분에 숲이 다시 숨을 쉴 거예요.'
    ],
    objectives: [
      {
        id: 'defeat-swamp-priest',
        label: '늪의 사제',
        required: 1,
        type: 'monster-defeat',
        target: { sceneId: SCENE_SUNKEN_TEMPLE_2F, appearanceType: 'monster_swamp_priest' }
      }
    ],
    rewards: {
      gold: 1500,
      experience: 3500,
      items: [
        { id: 'health-potion', label: '체력 회복 포션', quantity: 5 },
        { id: 'mana-potion', label: '마나 회복 포션', quantity: 3 }
      ]
    }
  },
  {
    // 다시 흐르는 물(c2-09, 2장 끝) — 셀린이 맡기고 딴따라마을 수문지기 이멜에게 보고한다. 수로 상류길의
    // 빨려 들던 구멍이 메워지고(upstream-waterway, quest.requiresCompleted q025) 물이 다시 흐른다.
    // 이멜의 완료 대사와 장 완료 메시지가 3장(북쪽)으로 넘어가는 고리다.
    id: WATER_FLOWS_AGAIN_QUEST_ID,
    regionName: REGION_SUNKEN_FOREST,
    giverNpcId: SCHOLAR_NPC_ID,
    giverName: '학자 셀린',
    turnInNpcId: SLUICE_KEEPER_NPC_ID,
    turnInName: '이멜',
    title: '다시 흐르는 물',
    trackerLabel: '수로 상류길 둘러보기',
    prerequisiteQuestIds: [SWAMP_PRIEST_QUEST_ID],
    requestText: '수로 상류길에 물이 다시 흐르는지 보고, 딴따라마을 수문지기 이멜에게 알려 달라.',
    guideText:
      '갈대골 나루에서 토빈의 나룻배로 수로 상류길에 건너가 물이 다시 흐르는지 보고, 딴따라마을 수문의 이멜에게 알리자.',
    startDialogueLines: [
      '처음에 당신을 이 숲으로 보낸 사람이 딴따라마을 수문지기라고 했죠? 그분께 알려 드려야죠.',
      '물이 땅으로 빨려 들던 수로 상류길도 지금쯤 메워졌을 거예요. 가는 길에 꼭 보고 가세요.',
      '저는 여기 남아 비석을 마저 읽을게요. 사제가 말한 "북쪽"이 무엇인지… 알아내면 꼭 알려 드릴게요.'
    ],
    activeDialogueLines: ['수로 상류길을 지나 딴따라마을의 이멜에게 가 보세요.'],
    completionDialogueLines: [
      '물이… 물이 다시 차오르고 있네! 아까부터 수문이 덜컹거리길래 무슨 일인가 했지.',
      '갈대골도, 가라앉은 숲도 무사하다고? 자네가 정말 해냈구먼.',
      '그런데 늪의 사제가 북쪽을 말했다고? 북쪽이라면… 눈 덮인 산맥 너머 말인가.',
      '그쪽에서 내려오는 바람이 요즘 유난히 차갑다네. 언젠가 자네가 그 바람을 거슬러 올라가게 될지도 모르겠군.'
    ],
    arcCompletionMessage:
      '가라앉은 숲의 봉인이 다시 밝아지고, 막혔던 물이 흐르기 시작했다.\n하지만 늪의 사제는 마지막에 말했다. 진짜 깨어나는 것은 북쪽에 있다고.\n{playerName}의 다음 여정은 차가운 바람이 내려오는 북쪽이다.',
    objectives: [
      {
        id: 'see-upstream-waterway',
        label: '수로 상류길 둘러보기',
        required: 1,
        type: 'scene-enter',
        target: { sceneId: SCENE_UPSTREAM_WATERWAY }
      }
    ],
    rewards: {
      gold: 1000,
      experience: 2500,
      items: [{ id: 'antidote-incense', label: '해독 향', quantity: 3 }]
    }
  },
  {
    // c2-s1 사공의 나룻배 — 토빈의 옛 나룻배가 숲 남쪽 늪가에 처박혀 있다. 둘레의 늪뱀을 쫓고 배를 살펴 보고하면
    // 토빈이 배를 고쳐 갈대골 나루 ↔ 신전 외곽 북서 연못을 잇는 지름길을 연다(outskirts_raft·reed_raft).
    id: FERRY_SHORTCUT_QUEST_ID,
    regionName: REGION_SUNKEN_FOREST,
    giverNpcId: 'tobin',
    giverName: '사공 토빈',
    title: '사공의 나룻배',
    trackerLabel: '가라앉은 숲 늪뱀 쫓기',
    prerequisiteQuestIds: [FOREST_LORD_QUEST_ID],
    requestText: '숲 남쪽 늪가에 처박힌 옛 나룻배를 찾아, 둘레의 늪뱀을 쫓고 배를 살펴 달라.',
    guideText: '가라앉은 숲 개구리 소굴 섬 남쪽 늪가에서 늪뱀을 쫓고 부서진 나룻배를 살펴본 뒤 토빈에게 돌아가자.',
    startDialogueLines: [
      '신전 외곽까지 걸어서 오가려니 다리가 남아나질 않지?',
      '사실 내 옛 나룻배가 숲 남쪽 늪가에 처박혀 있어. 물이 불던 날 떠내려갔거든.',
      '배 둘레에 늪뱀들이 똬리를 틀어서 가 볼 엄두를 못 냈어. 뱀들을 쫓고 배가 고칠 만한지 봐 줄래?',
      '쓸 만하면 신전 쪽 연못까지 물길을 내 줄게. 거기서부턴 노 몇 번이면 돼.'
    ],
    activeDialogueLines: ['숲 개구리 소굴 섬 남쪽 늪가야. 뱀 조심하고.'],
    talkTargetDialogueLines: [
      '바닥에 구멍이 났지만 용골은 멀쩡하다. 갈대와 송진으로 메우면 다시 뜰 것 같다.',
      '토빈에게 알려 주자.'
    ],
    completionDialogueLines: [
      '용골이 멀쩡하다고? 역시 내 배야!',
      '오늘 밤 안에 고쳐서 나루에 대 둘게. 신전 외곽 북서쪽 연못까지 물길을 열어 두지.',
      '나루 맨 끝 나룻배를 타면 숲을 건너지 않고 바로 신전 쪽으로 갈 수 있어. 돌아올 때도 그 연못에서 타면 되고.'
    ],
    objectives: [
      {
        id: 'chase-snakes',
        label: '늪뱀',
        required: 4,
        type: 'monster-defeat',
        target: { sceneId: SCENE_SUNKEN_FOREST, appearanceType: 'monster_snake' }
      },
      { id: 'inspect-boat', label: '부서진 나룻배 살펴보기', required: 1, type: 'talk', target: { npcId: 'sunken_boat' } }
    ],
    rewards: { gold: 400, experience: 900, items: [] }
  },
  {
    // c2-s2 약초꾼의 바구니 — 오디가 해독 향 말고도 약을 짓게 세 곳의 약초를 캐 온다(채집 = 대화 목표).
    id: HERB_BASKET_QUEST_ID,
    regionName: REGION_SUNKEN_FOREST,
    giverNpcId: HERBALIST_NPC_ID,
    giverName: '약초꾼 오디',
    title: '약초꾼의 바구니',
    trackerLabel: '늪 약초 캐기',
    prerequisiteQuestIds: [ANTIDOTE_INCENSE_QUEST_ID],
    requestText: '숲 북쪽 둔덕, 독안개 속 남쪽 섬, 수로 상류길 개울가의 약초를 캐 달라.',
    guideText:
      '가라앉은 숲 북쪽 사냥꾼 야영지 곁, 독안개 속 남쪽 섬(해독 향 필요), 수로 상류길 개울가 숲의 약초를 캐서 오디에게 가져가자.',
    startDialogueLines: [
      '해독 향만으로는 부족해요. 마을 사람들 기침약, 상처 연고도 지어야 하거든요.',
      '세 군데 약초가 필요해요. 숲 북쪽 야영지 곁의 푸른 풀, 독안개 속에서만 자라는 붉은 잎, 그리고 상류길 개울가의 하얀 꽃이요.',
      '독안개 쪽은 꼭 향을 피우고 가세요!'
    ],
    activeDialogueLines: ['야영지 곁 푸른 풀, 안개 속 붉은 잎, 개울가 하얀 꽃이에요.'],
    talkTargetDialogueLinesByNpcId: {
      herb_patch_1: ['푸른 풀을 뿌리째 캐서 바구니에 담았다.'],
      herb_patch_2: ['숨을 참고 붉은 잎을 몇 장 땄다. 손끝이 저릿하다.'],
      herb_patch_3: ['하얀 꽃을 꺾어 바구니에 담았다. 은은한 향이 난다.']
    },
    completionDialogueLines: [
      '와, 세 가지 다 있네요! 붉은 잎은 정말 귀한 건데.',
      '이걸로 약을 지으면 겨울까지는 넉넉해요. 고마워요. 이건 제가 지은 약이에요, 가져가세요.'
    ],
    objectives: [
      { id: 'herb-ridge', label: '야영지 곁 푸른 풀', required: 1, type: 'talk', target: { npcId: 'herb_patch_1' } },
      { id: 'herb-fog', label: '독안개 속 붉은 잎', required: 1, type: 'talk', target: { npcId: 'herb_patch_2' } },
      { id: 'herb-stream', label: '개울가 하얀 꽃', required: 1, type: 'talk', target: { npcId: 'herb_patch_3' } }
    ],
    rewards: {
      gold: 300,
      experience: 800,
      items: [
        { id: 'health-potion', label: '체력 회복 포션', quantity: 4 },
        { id: 'antidote-incense', label: '해독 향', quantity: 2 }
      ]
    }
  },
  {
    // c2-s3 돌아오지 않은 사냥꾼 — 사냥꾼들이 끌려가며 흘린 물건 셋(숲 곳곳, 탐험). 미렌이 가족에게 돌려준다.
    id: HUNTER_KEEPSAKES_QUEST_ID,
    regionName: REGION_SUNKEN_FOREST,
    giverNpcId: REED_VILLAGE_CHIEF_NPC_ID,
    giverName: '촌장 미렌',
    title: '돌아오지 않은 사냥꾼',
    trackerLabel: '사냥꾼의 유품 찾기',
    prerequisiteQuestIds: [BEYOND_THE_FOG_QUEST_ID],
    requestText: '끌려간 사냥꾼들이 숲에 흘린 물건을 찾아 가족에게 돌려주고 싶다.',
    guideText:
      '가라앉은 숲 서쪽 입구 둔덕 남쪽, 독안개 길, 안개 속 북쪽 섬을 돌며 사냥꾼들의 물건을 찾아 미렌에게 가져가자.',
    startDialogueLines: [
      '렌 말로는 끌려가면서 다들 뭔가를 떨어뜨렸다더군. 일부러 흘린 것일지도 모르지.',
      '가족들이 매일 내 집 앞을 서성인다네. 무엇이든 하나라도 쥐여 주고 싶어.',
      '입구 둔덕 남쪽, 안개 길, 안개 속 북쪽 섬 — 렌이 기억하는 곳은 그쯤이라네.'
    ],
    activeDialogueLines: ['입구 둔덕 남쪽, 안개 길, 안개 속 북쪽 섬이라네.'],
    talkTargetDialogueLinesByNpcId: {
      hunter_keepsake_1: ['진흙에서 부러진 활을 건졌다. 손잡이에 "다르"라고 새겨져 있다.'],
      hunter_keepsake_2: ['가죽 주머니 안에 아이 그림이 그려진 나무 조각이 들어 있다.'],
      hunter_keepsake_3: ['갈대 무늬 목도리를 풀어 챙겼다. 끝자락에 "미카"라는 수가 놓여 있다.']
    },
    completionDialogueLines: [
      '다르의 활… 미카의 목도리… 이 나무 조각은 막내 사냥꾼 딸아이가 깎아 준 걸세.',
      '고맙네. 이걸 쥐면 가족들도 조금은 버틸 수 있을 게야. 그 아이들이 꼭 돌아와야 할 텐데.'
    ],
    objectives: [
      { id: 'keepsake-bow', label: '부러진 활', required: 1, type: 'talk', target: { npcId: 'hunter_keepsake_1' } },
      { id: 'keepsake-pouch', label: '젖은 가죽 주머니', required: 1, type: 'talk', target: { npcId: 'hunter_keepsake_2' } },
      { id: 'keepsake-scarf', label: '찢어진 목도리', required: 1, type: 'talk', target: { npcId: 'hunter_keepsake_3' } }
    ],
    rewards: { gold: 450, experience: 1000, items: [{ id: 'mana-potion', label: '마나 회복 포션', quantity: 3 }] }
  },
  {
    // c2-s4 해골병의 문장 — 유적 해골병의 방패에 남은 물결 문장과 쓰러진 수비대 깃발(셀린의 연구).
    id: SKELETON_CREST_QUEST_ID,
    regionName: REGION_SUNKEN_FOREST,
    giverNpcId: SCHOLAR_NPC_ID,
    giverName: '학자 셀린',
    title: '해골병의 문장',
    trackerLabel: '유적 해골병 처치',
    prerequisiteQuestIds: [STELE_SCRIPT_QUEST_ID],
    requestText: '유적 해골병들이 두른 물결 문장의 정체를 알고 싶다. 해골병을 쓰러뜨리고 옛 수비대 깃발을 찾아 달라.',
    guideText: '신전 외곽에서 유적 해골병을 더 쓰러뜨리고, 남서쪽 풀밭에 쓰러진 깃발을 살펴본 뒤 셀린에게 돌아가자.',
    startDialogueLines: [
      '해골병들 방패에 물결 세 줄 문장이 있는 거 봤어요? 신전 수비대 문장 같아요.',
      '수비대였다면 어딘가에 깃발이 남아 있을 거예요. 남서쪽 풀밭 어딘가에서 봤다는 순례자 기록이 있어요.',
      '해골병들도 조금 더 쓰러뜨려 주세요. 방패를 몇 개 더 보면 문장을 정확히 옮겨 그릴 수 있어요.'
    ],
    activeDialogueLines: ['남서쪽 풀밭의 깃발, 그리고 해골병 방패예요.'],
    talkTargetDialogueLines: [
      '흙을 털어 내자 물결 세 줄 아래 작은 글씨가 드러난다: "물을 지키는 자는 물에 잠겨도 지킨다."',
      '셀린에게 알려 주자.'
    ],
    completionDialogueLines: [
      '"물에 잠겨도 지킨다"… 그래서 죽어서도 신전을 돌고 있었던 거예요.',
      '그들은 적이 아니었을지도 몰라요. 사제가 깨지 못하게 봉인을 지키던 거라면…',
      '고마워요. 문장 기록은 제 연구의 큰 조각이에요. 이건 제 비상금이에요, 받아 주세요.'
    ],
    objectives: [
      {
        id: 'defeat-more-skeletons',
        label: '유적 해골병',
        required: 8,
        type: 'monster-defeat',
        target: { sceneId: SCENE_RUINS_OUTSKIRTS, appearanceType: 'monster_skeleton' }
      },
      { id: 'read-banner', label: '쓰러진 깃발 살펴보기', required: 1, type: 'talk', target: { npcId: 'fallen_banner' } }
    ],
    rewards: { gold: 600, experience: 1400, items: [{ id: 'health-potion', label: '체력 회복 포션', quantity: 2 }] }
  },
  {
    // c2-s5 숨은 제단 — 신전 외곽 북쪽 숲 뒤 좁은 틈의 제단이 직접 퀘스트를 준다(발견). 수호 골렘을 쓰러뜨리면
    // 제단에 바쳐진 부적을 얻는다.
    id: HIDDEN_ALTAR_QUEST_ID,
    regionName: REGION_SUNKEN_FOREST,
    giverNpcId: 'hidden_altar',
    giverName: '숨은 제단',
    title: '숨은 제단',
    trackerLabel: '제단 수호자 처치',
    prerequisiteQuestIds: [STELE_SCRIPT_QUEST_ID],
    requestText: '제단을 지키는 이끼 골렘을 쓰러뜨리면 제단이 바쳐진 것을 내어 줄 것 같다.',
    guideText: '신전 외곽 북서쪽 숲 뒤 제단 곁의 이끼 골렘을 쓰러뜨린 뒤 제단에 다시 손을 대자.',
    startDialogueLines: [
      '제단 위 이끼 아래로 작은 부적이 비친다.',
      '손을 뻗자 뒤에서 돌 굴러가는 소리가 난다. 제단을 지키는 무언가가 깨어난 것 같다.'
    ],
    activeDialogueLines: ['제단 곁의 수호자가 아직 서 있다.'],
    completionDialogueLines: [
      '수호자가 무너지자 제단의 이끼가 스르르 걷힌다.',
      '물결 세 줄이 새겨진 부적이 손바닥 위로 떨어졌다.'
    ],
    objectives: [
      {
        id: 'defeat-altar-guardian',
        label: '제단 수호자',
        required: 1,
        type: 'monster-defeat',
        target: { sceneId: SCENE_RUINS_OUTSKIRTS, appearanceType: 'monster_moss_golem', characterId: '이끼 골렘-제단' }
      }
    ],
    rewards: { gold: 300, experience: 1200, items: [{ id: 'altar-charm', label: '늪 제단의 부적', quantity: 1 }] }
  },
  {
    // c2-s6 마을의 우물 — 갈대골 마당 우물 아래 옛 물길에 뱀과 개구리가 숨어들고 물길 입구가 막혔다.
    id: VILLAGE_WELL_QUEST_ID,
    regionName: REGION_SUNKEN_FOREST,
    giverNpcId: REED_VILLAGE_CHIEF_NPC_ID,
    giverName: '촌장 미렌',
    title: '마을의 우물',
    trackerLabel: '우물 속 짐승 쫓기',
    prerequisiteQuestIds: [DROWNED_PATH_QUEST_ID],
    requestText: '마당 우물 아래 물길에 숨어든 뱀과 개구리를 쫓고 막힌 물길을 뚫어 달라.',
    guideText: '갈대골 마당 우물로 내려가 늪뱀과 늪개구리 전사를 쫓고, 북쪽 끝 막힌 물길을 뚫은 뒤 미렌에게 돌아가자.',
    startDialogueLines: [
      '자네에게 이런 일까지 부탁해서 미안하네만… 마당 우물물이 썩어 가고 있네.',
      '늪 물이 우물 아래 옛 물길로 거꾸로 차오르면서 뱀이며 개구리가 숨어들었다더군.',
      '안쪽 물길 입구도 막혔는지 물이 돌지를 않아. 우물 밧줄을 타고 내려가 보게.'
    ],
    activeDialogueLines: ['우물 밧줄을 타고 내려가면 된다네. 북쪽 끝 물길 입구를 뚫어 주게.'],
    talkTargetDialogueLines: [
      '썩은 갈대 더미를 몇 번 걷어차자 물길이 뚫리며 물이 콸콸 흘러간다.',
      '미렌에게 알리자.'
    ],
    completionDialogueLines: [
      '우물물이 맑아졌다고 아이들이 뛰어왔다네. 허허, 고맙네.',
      '갈대골 사람들은 이런 작은 은혜를 잊지 않는다네.'
    ],
    objectives: [
      {
        id: 'clear-well-beasts',
        label: '우물 속 짐승',
        required: 5,
        type: 'monster-defeat',
        target: { sceneId: SCENE_REED_WELL, appearanceType: 'monster_snake' }
      },
      { id: 'unclog-well', label: '막힌 물길 뚫기', required: 1, type: 'talk', target: { npcId: 'well_clog' } }
    ],
    rewards: { gold: 350, experience: 900, items: [{ id: 'health-potion', label: '체력 회복 포션', quantity: 2 }] }
  }
]

const QUEST_DEFINITION_BY_ID = Object.fromEntries(
  QUEST_DEFINITIONS.map((definition) => [definition.id, definition])
) as Record<string, QuestDefinition>

// 에디터에서 생성·주입한 동적 퀘스트. 정적 QUEST_DEFINITIONS와 합쳐 런타임에서 함께 동작한다.
// 모듈 전역이라 테스트에서는 clearDynamicQuestDefinitions로 비워야 한다(정적 아크 테스트 보호).
const dynamicQuestDefinitionById: Record<string, QuestDefinition> = {}

// 정적 + 동적 전체 정의. 트래커/배지/목표매칭 등 "모든 퀘스트"를 도는 곳은 이걸 써야 한다.
export const getAllQuestDefinitions = (): QuestDefinition[] => [
  ...QUEST_DEFINITIONS,
  ...Object.values(dynamicQuestDefinitionById)
]

let questDefinitionVisibilityFilter: Set<string> | undefined

export const setQuestDefinitionVisibilityFilter = (
  questIds: string[] | undefined
): void => {
  if (!questIds || questIds.length === 0) {
    questDefinitionVisibilityFilter = undefined
    return
  }

  questDefinitionVisibilityFilter = new Set(questIds)
}

export const getVisibleQuestDefinitions = (): QuestDefinition[] =>
  getAllQuestDefinitions().filter((definition) =>
    isQuestDefinitionVisible(definition)
  )

const isQuestDefinitionVisible = (definition: QuestDefinition): boolean =>
  questDefinitionVisibilityFilter === undefined ||
  questDefinitionVisibilityFilter.has(definition.id)

const findQuestDefinition = (questId: string): QuestDefinition | undefined =>
  QUEST_DEFINITION_BY_ID[questId] ?? dynamicQuestDefinitionById[questId]

const isStaticQuestDefinition = (definition: QuestDefinition): boolean =>
  QUEST_DEFINITION_BY_ID[definition.id] !== undefined

// 진행도 항목을 throw 없이 조회(동적 퀘스트가 아직 진행도에 없을 수 있어 순회 시 방어용).
const questProgressOrUndefined = (
  questLog: QuestLogState,
  questId: string
): QuestProgress | undefined => questLog.progressByQuestId[questId]

// 동적 퀘스트 등록(멱등): 정적 id와 충돌하거나 이미 등록된 id는 무시한다. 씬 로드마다 재주입돼도
// 안전하다. 등록 후에는 ensureQuestProgressEntries로 진행도 항목을 채워야 한다.
export const registerDynamicQuestDefinitions = (
  definitions: QuestDefinition[]
): void => {
  for (const definition of definitions) {
    if (QUEST_DEFINITION_BY_ID[definition.id]) {
      continue
    }
    dynamicQuestDefinitionById[definition.id] = definition
  }
}

// 진행 중(수락됨·미완료)인 "아이템 획득" 목표가 요구하는 아이템 id 목록.
// 몬스터 드롭이 이 아이템을 우선 떨어뜨리게 해, 랜덤 드롭 사이에서 퀘스트 진행이 운에 막히지 않게 한다.
export const getActiveItemAcquireItemIds = (questLog: QuestLogState): string[] => {
  const itemIds: string[] = []
  for (const definition of getAllQuestDefinitions()) {
    const progress = questProgressOrUndefined(questLog, definition.id)
    if (!progress || progress.status !== 'active') {
      continue
    }
    for (const objective of definition.objectives) {
      if (objective.type !== 'item-acquire' || !objective.target.itemId) {
        continue
      }
      if ((progress.objectives[objective.id] ?? 0) < objective.required) {
        itemIds.push(objective.target.itemId)
      }
    }
  }
  return itemIds
}

// 등록된 퀘스트 중 진행도 항목이 없는 것만 채운다(기존 진행도는 절대 덮어쓰지 않음). 동적 퀘스트는
// createInitialQuestLog 이후에 등록되므로, 등록 직후 이 함수로 진행도를 보강해야 추적이 시작된다.
export const ensureQuestProgressEntries = (
  questLog: QuestLogState
): QuestLogState => {
  let next = questLog
  for (const definition of getAllQuestDefinitions()) {
    if (!next.progressByQuestId[definition.id]) {
      next = {
        progressByQuestId: {
          ...next.progressByQuestId,
          [definition.id]: createInitialQuestProgress(definition)
        }
      }
    }
  }
  return next
}

// 테스트 격리용 — 동적 레지스트리를 비운다.
export const clearDynamicQuestDefinitions = (): void => {
  for (const id of Object.keys(dynamicQuestDefinitionById)) {
    delete dynamicQuestDefinitionById[id]
  }
  questDefinitionVisibilityFilter = undefined
}

export const createInitialQuestLog = (): QuestLogState => ({
  progressByQuestId: Object.fromEntries(
    QUEST_DEFINITIONS.map((definition) => [
      definition.id,
      createInitialQuestProgress(definition)
    ])
  ) as Record<string, QuestProgress>
})

export const getQuestDefinition = (questId: string): QuestDefinition => {
  const definition = findQuestDefinition(questId)

  if (!definition) {
    throw new Error(`Unknown quest id ${questId}`)
  }

  return definition
}

export const getQuestProgress = (
  questLog: QuestLogState,
  questId: string
): QuestProgress => {
  const quest = questLog.progressByQuestId[questId]

  if (!quest) {
    throw new Error(`Unknown quest id ${questId}`)
  }

  return quest
}

export const isQuestUnlocked = (
  questLog: QuestLogState,
  questId: string
): boolean =>
  getQuestDefinition(questId).prerequisiteQuestIds.every(
    (prerequisiteQuestId) =>
      getQuestProgress(questLog, prerequisiteQuestId).status === 'completed'
  )

export const startQuest = (
  questLog: QuestLogState,
  questId: string
): QuestLogState => {
  const quest = getQuestProgress(questLog, questId)

  if (quest.status !== 'not-started' || !isQuestUnlocked(questLog, questId)) {
    return questLog
  }

  return updateQuestProgress(questLog, {
    ...quest,
    status: 'active',
    trackerVisible: true
  })
}

export const recordQuestObjectiveProgress = (
  questLog: QuestLogState,
  questId: string,
  objectiveId: string,
  amount = 1
): QuestLogState => {
  const quest = getQuestProgress(questLog, questId)

  if (quest.status !== 'active') {
    return questLog
  }

  const definition = getQuestDefinition(questId)
  const objective = definition.objectives.find(
    (candidate) => candidate.id === objectiveId
  )

  if (!objective) {
    return questLog
  }

  const current = quest.objectives[objectiveId] ?? 0
  const nextCurrent = Math.min(
    objective.required,
    current + Math.max(0, Math.floor(amount))
  )
  const nextQuest = {
    ...quest,
    objectives: {
      ...quest.objectives,
      [objectiveId]: nextCurrent
    }
  }

  return updateQuestProgress(questLog, {
    ...nextQuest,
    status: areQuestObjectivesComplete(definition, nextQuest)
      ? 'ready-to-turn-in'
      : 'active'
  })
}

export const recordMonsterDefeatQuestProgress = (
  questLog: QuestLogState,
  target: {
    sceneId: string
    appearanceType: string
    characterId?: string
  }
): QuestLogState =>
  recordMatchingQuestObjectiveProgress(questLog, (objective) =>
    objective.type === 'monster-defeat' &&
    objective.target.sceneId === target.sceneId &&
    objective.target.appearanceType === target.appearanceType &&
    (objective.target.characterId === undefined ||
      objective.target.characterId === target.characterId)
  )

export const recordItemUseQuestProgress = (
  questLog: QuestLogState,
  itemId: string
): QuestLogState =>
  recordMatchingQuestObjectiveProgress(questLog, (objective) =>
    objective.type === 'item-use' && objective.target.itemId === itemId
  )

// 아이템/장비 "획득" 진행 — 드롭 픽업·상점 구매 등 인벤에 들어올 때 호출한다(item-use는 소비 기준).
export const recordItemAcquireQuestProgress = (
  questLog: QuestLogState,
  itemId: string
): QuestLogState =>
  recordMatchingQuestObjectiveProgress(questLog, (objective) =>
    objective.type === 'item-acquire' && objective.target.itemId === itemId
  )

export const recordShopOpenQuestProgress = (
  questLog: QuestLogState,
  shopId: string
): QuestLogState =>
  recordMatchingQuestObjectiveProgress(questLog, (objective) =>
    objective.type === 'shop-open' && objective.target.shopId === shopId
  )

export const recordSceneEnterQuestProgress = (
  questLog: QuestLogState,
  sceneId: string
): QuestLogState =>
  recordMatchingQuestObjectiveProgress(questLog, (objective) =>
    objective.type === 'scene-enter' && objective.target.sceneId === sceneId
  )

export const recordTalkQuestProgress = (
  questLog: QuestLogState,
  npcId: string
): QuestLogState =>
  recordMatchingQuestObjectiveProgress(questLog, (objective) =>
    objective.type === 'talk' && objective.target.npcId === npcId
  )

export const setQuestTrackerVisible = (
  questLog: QuestLogState,
  questId: string,
  trackerVisible: boolean
): QuestLogState => {
  const quest = getQuestProgress(questLog, questId)

  if (
    trackerVisible &&
    quest.status !== 'active' &&
    quest.status !== 'ready-to-turn-in'
  ) {
    return questLog
  }

  if (quest.trackerVisible === trackerVisible) {
    return questLog
  }

  return updateQuestProgress(questLog, {
    ...quest,
    trackerVisible
  })
}

export const hideVisibleQuestTrackers = (
  questLog: QuestLogState
): QuestLogState => ({
  progressByQuestId: Object.fromEntries(
    Object.entries(questLog.progressByQuestId).map(([questId, quest]) => [
      questId,
      {
        ...quest,
        trackerVisible: false
      }
    ])
  ) as Record<string, QuestProgress>
})

export const abandonQuest = (
  questLog: QuestLogState,
  questId: string
): QuestLogState =>
  updateQuestProgress(
    questLog,
    createInitialQuestProgress(getQuestDefinition(questId))
  )

export const completeQuest = (
  questLog: QuestLogState,
  questId: string
): CompleteQuestResult => {
  const quest = getQuestProgress(questLog, questId)
  const definition = getQuestDefinition(questId)

  if (quest.status !== 'ready-to-turn-in') {
    return {
      nextQuestLog: questLog,
      didComplete: false,
      goldReward: 0,
      experienceReward: 0,
      itemRewards: []
    }
  }

  return {
    nextQuestLog: updateQuestProgress(questLog, {
      ...quest,
      status: 'completed',
      trackerVisible: false
    }),
    didComplete: true,
    goldReward: definition.rewards.gold,
    experienceReward: definition.rewards.experience,
    itemRewards: definition.rewards.items.map(cloneQuestItemReward)
  }
}

export const getVisibleQuestTrackers = (
  questLog: QuestLogState
): QuestTrackerItem[] =>
  getVisibleQuestDefinitions().flatMap((definition) => {
    const quest = questProgressOrUndefined(questLog, definition.id)

    if (!quest || !quest.trackerVisible) {
      return []
    }

    switch (quest.status) {
      case 'active': {
        // 아직 끝나지 않은 첫 목표를 보여 준다(처치 5/5 를 채웠는데 "비석 읽기"가 안 보이던 문제). 목표가 하나면
        // 퀘스트의 추적 이름(trackerLabel), 여럿이면 숫자가 어느 목표의 것인지 보이게 늘 목표 이름으로 쓴다
        // ("수정 광석 채굴 0/1" 이 실은 광산 진입 0/1 이던 문제).
        const index = Math.max(
          0,
          definition.objectives.findIndex(
            (candidate) => (quest.objectives[candidate.id] ?? 0) < candidate.required
          )
        )
        const objective = definition.objectives[index]
        const label = definition.objectives.length === 1 ? definition.trackerLabel : objective.label

        return [
          {
            questId: definition.id,
            text: `${label} ${quest.objectives[objective.id] ?? 0}/${objective.required}`,
            objective
          }
        ]
      }
      case 'ready-to-turn-in':
        return [
          {
            questId: definition.id,
            text:
              definition.turnInTrackerText ??
              (definition.turnInNpcId
                ? `${definition.title}: ${definition.turnInName ?? definition.turnInNpcId}에게 가기`
                : `${definition.title}: ${definition.giverName}에게 돌아가기`)
          }
        ]
      case 'not-started':
      case 'completed':
        return []
    }
  })

export const getQuestNpcBadgeKind = (
  questLog: QuestLogState,
  questId: string
): QuestNpcBadgeKind | undefined => {
  const definition = getQuestDefinition(questId)
  if (!isQuestDefinitionVisible(definition)) {
    return undefined
  }

  const quest = getQuestProgress(questLog, questId)

  switch (quest.status) {
    case 'not-started':
      return isQuestUnlocked(questLog, questId) ? 'new' : undefined
    case 'ready-to-turn-in':
      return 'finish'
    case 'active':
    case 'completed':
      return undefined
  }
}

export const getQuestNpcBadgeKindForNpc = (
  questLog: QuestLogState,
  npcId: string
): QuestNpcBadgeKind | undefined => {
  const definitions = getQuestDefinitionsForNpc(npcId)

  if (
    getQuestDefinitionsToTurnInAtNpc(npcId).some(
      (definition) =>
        questProgressOrUndefined(questLog, definition.id)?.status ===
        'ready-to-turn-in'
    )
  ) {
    return 'finish'
  }

  if (
    definitions.some((definition) => {
      const quest = questProgressOrUndefined(questLog, definition.id)

      return (
        quest?.status === 'not-started' &&
        isQuestUnlocked(questLog, definition.id)
      )
    })
  ) {
    return 'new'
  }

  // 액티브 퀘스트의 talk 목표가 이 NPC를 가리키면 "여기로 와서 대화" 안내로 "?"를 띄운다.
  // 단, 그 퀘스트의 기버 NPC 본인은 제외한다 — 기버는 수락 직후 "?"가 사라져야 하고(방금 수락함),
  // 완료(ready-to-turn-in) 시 'finish'로 다시 표시된다. 목표가 동시 진행이라, 기버를 제외하지 않으면
  // "기버에게 전달" 류 talk 목표 때문에 수락 직후에도 기버 위 "?"가 계속 남는다.
  if (
    getQuestDefinitionsWithPendingTalkObjectiveForNpc(questLog, npcId).some(
      (definition) => definition.giverNpcId !== npcId
    )
  ) {
    return 'new'
  }

  return undefined
}

export const getNextQuestInteractionForNpc = (
  questLog: QuestLogState,
  npcId: string
): NpcQuestInteraction | undefined => {
  const definitions = getQuestDefinitionsForNpc(npcId)
  const readyDefinition = getQuestDefinitionsToTurnInAtNpc(npcId).find(
    (definition) =>
      questProgressOrUndefined(questLog, definition.id)?.status ===
      'ready-to-turn-in'
  )

  if (readyDefinition) {
    return createNpcQuestInteraction(questLog, readyDefinition, 'complete')
  }

  const activeDefinition = definitions.find(
    (definition) =>
      questProgressOrUndefined(questLog, definition.id)?.status === 'active'
  )

  if (activeDefinition) {
    return createNpcQuestInteraction(questLog, activeDefinition, 'active')
  }

  const activeTalkDefinition = getQuestDefinitionsWithPendingTalkObjectiveForNpc(
    questLog,
    npcId
  )[0]

  if (activeTalkDefinition) {
    return createNpcQuestInteraction(questLog, activeTalkDefinition, 'active')
  }

  const unlockedDefinition = definitions.find((definition) => {
    const quest = questProgressOrUndefined(questLog, definition.id)

    return (
      quest?.status === 'not-started' && isQuestUnlocked(questLog, definition.id)
    )
  })

  return unlockedDefinition
    ? createNpcQuestInteraction(questLog, unlockedDefinition, 'start')
    : undefined
}

// 대화 목표의 상대 NPC 가 말하는 대사. 상대별 대사 → 공통 대사 → 진행 중 대사 순.
export const getTalkTargetDialogueLines = (
  definition: QuestDefinition,
  npcId: string
): string[] =>
  definition.talkTargetDialogueLinesByNpcId?.[npcId] ??
  definition.talkTargetDialogueLines ??
  definition.activeDialogueLines

export const formatQuestText = (
  text: string,
  context: QuestTextFormatContext
): string => text.replace(/\{playerName\}/g, context.playerName)

export const formatQuestTextLines = (
  lines: string[],
  context: QuestTextFormatContext
): string[] => lines.map((line) => formatQuestText(line, context))

const getQuestDefinitionsForNpc = (npcId: string): QuestDefinition[] => {
  const definitions = getVisibleQuestDefinitions().filter(
    (definition) => definition.giverNpcId === npcId
  )

  return [
    ...definitions.filter((definition) => !isStaticQuestDefinition(definition)),
    ...definitions.filter((definition) => isStaticQuestDefinition(definition))
  ]
}

// 이 NPC 에게 보고(완료)하는 퀘스트 — turnInNpcId 가 있으면 그 NPC, 없으면 준 사람.
const getQuestDefinitionsToTurnInAtNpc = (npcId: string): QuestDefinition[] => {
  const definitions = getVisibleQuestDefinitions().filter(
    (definition) => (definition.turnInNpcId ?? definition.giverNpcId) === npcId
  )

  return [
    ...definitions.filter((definition) => !isStaticQuestDefinition(definition)),
    ...definitions.filter((definition) => isStaticQuestDefinition(definition))
  ]
}

const hasPendingTalkObjectiveForNpc = (
  questLog: QuestLogState,
  definition: QuestDefinition,
  npcId: string
): boolean => {
  const quest = questProgressOrUndefined(questLog, definition.id)

  if (!quest || quest.status !== 'active') {
    return false
  }

  return definition.objectives.some(
    (objective) =>
      objective.type === 'talk' &&
      objective.target.npcId === npcId &&
      (quest.objectives[objective.id] ?? 0) < objective.required
  )
}

const getQuestDefinitionsWithPendingTalkObjectiveForNpc = (
  questLog: QuestLogState,
  npcId: string
): QuestDefinition[] => {
  const definitions = getVisibleQuestDefinitions().filter((definition) =>
    hasPendingTalkObjectiveForNpc(questLog, definition, npcId)
  )

  return [
    ...definitions.filter((definition) => !isStaticQuestDefinition(definition)),
    ...definitions.filter((definition) => isStaticQuestDefinition(definition))
  ]
}

const createNpcQuestInteraction = (
  questLog: QuestLogState,
  definition: QuestDefinition,
  action: NpcQuestInteractionAction
): NpcQuestInteraction => ({
  questId: definition.id,
  action,
  definition,
  progress: getQuestProgress(questLog, definition.id)
})

const recordMatchingQuestObjectiveProgress = (
  questLog: QuestLogState,
  matchesObjective: (objective: QuestObjectiveDefinition) => boolean
): QuestLogState => {
  let nextQuestLog = questLog

  for (const definition of getVisibleQuestDefinitions()) {
    const quest = questProgressOrUndefined(nextQuestLog, definition.id)

    if (!quest || quest.status !== 'active') {
      continue
    }

    for (const objective of definition.objectives) {
      if (matchesObjective(objective)) {
        nextQuestLog = recordQuestObjectiveProgress(
          nextQuestLog,
          definition.id,
          objective.id
        )
      }
    }
  }

  return nextQuestLog
}

const createInitialQuestProgress = (
  definition: QuestDefinition
): QuestProgress => ({
  id: definition.id,
  status: 'not-started',
  objectives: Object.fromEntries(
    definition.objectives.map((objective) => [objective.id, 0])
  ) as Record<string, number>,
  trackerVisible: false
})

const updateQuestProgress = (
  questLog: QuestLogState,
  quest: QuestProgress
): QuestLogState => ({
  progressByQuestId: {
    ...questLog.progressByQuestId,
    [quest.id]: quest
  }
})

const areQuestObjectivesComplete = (
  definition: QuestDefinition,
  quest: QuestProgress
): boolean =>
  definition.objectives.every(
    (objective) => (quest.objectives[objective.id] ?? 0) >= objective.required
  )

const cloneQuestItemReward = (itemReward: QuestItemReward): QuestItemReward => ({
  id: itemReward.id,
  label: itemReward.label,
  quantity: itemReward.quantity
})
