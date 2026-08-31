import { afterEach, describe, expect, it } from 'vitest'
import { buildLuaRuntimeSnapshot } from './buildLuaRuntimeSnapshot'
import {
  clearDynamicQuestDefinitions,
  createInitialQuestLog,
  ensureQuestProgressEntries,
  registerDynamicQuestDefinitions,
  QUEST_DEFINITIONS,
  type QuestDefinition
} from '../questLog'
import { createInitialPlayerProfile } from '../playerProfile'
import type { PlayerInventory } from '../playerInventory'

describe('buildLuaRuntimeSnapshot', () => {
  // 동적 레지스트리는 모듈 전역이라 테스트 간 격리가 필요하다.
  afterEach(() => {
    clearDynamicQuestDefinitions()
  })

  const inventory: PlayerInventory = {
    gold: 250,
    slots: [
      { id: 'potion_hp', label: 'HP 물약', quantity: 3 },
      undefined,
      { id: 'potion_hp', label: 'HP 물약', quantity: 2 }
    ]
  }

  it('flattens scene/profile/inventory/quest state into snapshot keys', () => {
    const profile = createInitialPlayerProfile()
    const snapshot = buildLuaRuntimeSnapshot({
      questLog: createInitialQuestLog(),
      inventory,
      profile,
      sceneId: 'town'
    })

    expect(snapshot.strings['scene:id']).toBe('town')
    expect(snapshot.strings['p:name']).toBe(profile.name)
    expect(snapshot.numbers['p:level']).toBe(profile.level)
    expect(snapshot.numbers['p:max_hp']).toBe(profile.hp.max)
    expect(snapshot.numbers['p:gold']).toBe(250)
    // 같은 item id 슬롯 수량이 합산된다.
    expect(snapshot.numbers['inv:potion_hp']).toBe(5)
    // 정의된 모든 퀘스트가 status/unlocked 키를 갖는다.
    const firstQuestId = QUEST_DEFINITIONS[0].id
    expect(typeof snapshot.strings[`q:status:${firstQuestId}`]).toBe('string')
    expect(typeof snapshot.booleans[`q:unlocked:${firstQuestId}`]).toBe('boolean')
  })

  // 회귀: 정적 정의만 순회하면 에디터 생성 퀘스트의 q:status 키가 아예 없어서, Lua는
  // engine.quest.get_status 폴백만 받고 생성 콘텐츠의 상태 분기가 조용히 죽는다.
  it('includes editor-generated dynamic quests, not just the static arc', () => {
    const dynamicQuest: QuestDefinition = {
      id: 'generated_hunt',
      regionName: '테스트 지역',
      giverNpcId: 'wizard',
      giverName: '마법사',
      title: '생성된 퀘스트',
      trackerLabel: '생성된 퀘스트',
      prerequisiteQuestIds: [],
      requestText: '의뢰',
      guideText: '안내',
      startDialogueLines: ['시작'],
      activeDialogueLines: ['진행'],
      completionDialogueLines: ['완료'],
      objectives: [
        {
          id: 'obj_1',
          label: '슬라임 1마리 처치',
          required: 1,
          type: 'monster-defeat',
          target: { sceneId: 'hunting-ground', appearanceType: 'monster_slime' }
        }
      ],
      rewards: { gold: 10, experience: 5, items: [] }
    }

    registerDynamicQuestDefinitions([dynamicQuest])
    const snapshot = buildLuaRuntimeSnapshot({
      questLog: ensureQuestProgressEntries(createInitialQuestLog()),
      inventory,
      profile: createInitialPlayerProfile(),
      sceneId: 'hunting-ground'
    })

    expect(snapshot.strings['q:status:generated_hunt']).toBe('not-started')
    expect(snapshot.booleans['q:unlocked:generated_hunt']).toBe(true)
    expect(snapshot.numbers['q:obj:generated_hunt:obj_1']).toBe(0)
  })
})
