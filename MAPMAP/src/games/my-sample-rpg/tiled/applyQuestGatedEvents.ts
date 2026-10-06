import type { QuestLogState } from '../questLog'
import type { ParsedTiledMap } from './parseTiledMap'

// 퀘스트 진행에 따라 맵 오브젝트를 보이거나 숨긴다(씬을 띄울 때 적용하고, 씬 안에서 퀘스트를 마쳐 결과가
// 바뀌면 main.ts 가 그 자리에서 씬을 다시 띄운다 — getQuestGatedEventKey 로 바뀌었는지 본다).
//   quest.requiresCompleted = <퀘스트 id>  그 퀘스트를 완료해야 나타난다 (예: 광산 지름길 포탈)
//   quest.hiddenWhenCompleted = <퀘스트 id> 그 퀘스트를 완료하면 사라진다 (예: 갱도를 막은 낙석)
const REQUIRES_COMPLETED_PROPERTY = 'quest.requiresCompleted'
const HIDDEN_WHEN_COMPLETED_PROPERTY = 'quest.hiddenWhenCompleted'

export const applyQuestGatedEvents = (
  map: ParsedTiledMap,
  questLog: QuestLogState
): ParsedTiledMap => {
  const isCompleted = (questId: unknown) =>
    typeof questId === 'string' &&
    questLog.progressByQuestId[questId]?.status === 'completed'

  return {
    ...map,
    eventLayers: map.eventLayers.map((eventLayer) => ({
      ...eventLayer,
      events: eventLayer.events.filter((event) => {
        const requires = event.properties[REQUIRES_COMPLETED_PROPERTY]
        const hiddenWhen = event.properties[HIDDEN_WHEN_COMPLETED_PROPERTY]

        if (requires !== undefined && !isCompleted(requires)) {
          return false
        }

        return !(hiddenWhen !== undefined && isCompleted(hiddenWhen))
      })
    }))
  }
}

// 지금 진행도에서 보이는 퀘스트 조건 오브젝트들의 키. 퀘스트를 마친 뒤 이 값이 바뀌면 맵을 다시 반영해야 한다.
export const getQuestGatedEventKey = (map: ParsedTiledMap, questLog: QuestLogState): string =>
  applyQuestGatedEvents(map, questLog)
    .eventLayers.flatMap((eventLayer) =>
      eventLayer.events
        .filter(
          (event) =>
            event.properties[REQUIRES_COMPLETED_PROPERTY] !== undefined ||
            event.properties[HIDDEN_WHEN_COMPLETED_PROPERTY] !== undefined
        )
        .map((event) => `${eventLayer.id}:${event.id}:${event.name}`)
    )
    .join('|')
