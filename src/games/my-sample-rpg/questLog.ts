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
  completionDialogueLines: string[]
  arcCompletionMessage?: string
  // 장소 도착(scene-enter)만 목표인 퀘스트: 도착하는 순간 완료하고, 준 사람이 다음 퀘스트를
  // 이어서 맡긴다(마을까지 왕복하지 않게). 대사는 준 사람이 멀리서 전하는 말로 보여 준다.
  autoTurnInOnSceneEnter?: boolean
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
      '사냥터 깊은 곳에 있는 동굴 쪽에서 이상한 기운이 흘러나오는 것 같구나.'
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
      '힘세고 강한 아침, 만일 내게 물어보면 I AM 대장장이.',
      '동굴에 들어간다고? 기본 무기만 들고 가기엔 좀 불안한데.',
      '나중에는 YOU 에게 무기도 팔게 될 거야.',
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
          appearanceType: MONSTER_SLIME_APPEARANCE_TYPE
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
      '준비는 끝났어.',
      '무리하지 말고, 체력이 위험하면 바로 물약을 써.',
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
          appearanceType: MONSTER_PIG_APPEARANCE_TYPE
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
      '가는 길의 바위돌이 셋도 잊지 말고.'
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
      case 'active':
        const objective = definition.objectives[0]

        return [
          {
            questId: definition.id,
            text: `${definition.trackerLabel} ${quest.objectives[objective.id]}/${objective.required}`,
            objective
          }
        ]
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
