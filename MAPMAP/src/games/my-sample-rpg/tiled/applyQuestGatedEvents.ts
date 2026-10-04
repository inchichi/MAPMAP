import type { QuestLogState } from '../questLog'
import type { ParsedTiledMap } from './parseTiledMap'

// 퀘스트 진행에 따라 맵 오브젝트를 보이거나 숨긴다(씬을 띄울 때 한 번 적용).
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
