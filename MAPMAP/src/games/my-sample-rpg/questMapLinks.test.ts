import { readdirSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { QUEST_DEFINITIONS } from './questLog'

// 맵과 퀘스트가 서로를 이름으로만 가리키므로, 한쪽만 고치면 조용히 끊긴다
// (예전 3장 맵이 아직 없는 q034·q036·q039 를 문 조건으로 쓰고 있었다).
const MAPS_DIR = new URL('./assets/maps/', import.meta.url)
const mapXmls = readdirSync(MAPS_DIR)
  .filter((fileName) => fileName.endsWith('.tmx'))
  .map((fileName) => readFileSync(new URL(fileName, MAPS_DIR), 'utf8'))

const characterNames = new Set(
  mapXmls.flatMap((xml) =>
    [...xml.matchAll(/<object id="\d+" name="([^"]+)" type="character"/g)].map((match) => match[1])
  )
)
const questIds = new Set(QUEST_DEFINITIONS.map((definition) => definition.id))

describe('quest ↔ map links', () => {
  it('gates map objects only on quests that exist', () => {
    const gatedQuestIds = mapXmls.flatMap((xml) =>
      [...xml.matchAll(/name="quest\.(?:requiresCompleted|hiddenWhenCompleted)" value="([^"]+)"/g)].map(
        (match) => match[1]
      )
    )

    expect(gatedQuestIds.filter((questId) => !questIds.has(questId))).toEqual([])
  })

  it('places every quest giver, turn-in NPC and talk target on some map', () => {
    const npcIds = QUEST_DEFINITIONS.flatMap((definition) => [
      definition.giverNpcId,
      ...(definition.turnInNpcId ? [definition.turnInNpcId] : []),
      ...definition.objectives.flatMap((objective) =>
        objective.type === 'talk' && objective.target.npcId ? [objective.target.npcId] : []
      )
    ])

    expect([...new Set(npcIds)].filter((npcId) => !characterNames.has(npcId))).toEqual([])
  })
})
