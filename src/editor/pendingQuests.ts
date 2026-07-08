import type { QuestDefinition } from '../games/my-sample-rpg/questLog'
import { readLocalStorage, writeLocalStorage } from './safeStorage'

export const PENDING_QUESTS_STORAGE_KEY = 'my-sample-rpg:pending-quests'

// 같은 NPC에 대한 옛 퀘스트 스냅샷이 남아 있으면 배지/트래커가 겹친다.
// 최신 스냅샷만 남기고, quest id 중복도 같이 정리한다.
export const normalizePendingQuestSnapshot = (
  quests: QuestDefinition[]
): QuestDefinition[] => {
  const seenQuestIds = new Set<string>()
  const seenGiverNpcIds = new Set<string>()
  const normalized: QuestDefinition[] = []

  for (let index = quests.length - 1; index >= 0; index -= 1) {
    const quest = quests[index]
    if (seenQuestIds.has(quest.id) || seenGiverNpcIds.has(quest.giverNpcId)) {
      continue
    }
    seenQuestIds.add(quest.id)
    seenGiverNpcIds.add(quest.giverNpcId)
    normalized.unshift(quest)
  }

  return normalized
}

export const loadPendingQuests = (): QuestDefinition[] => {
  const raw = readLocalStorage(PENDING_QUESTS_STORAGE_KEY)

  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as QuestDefinition[]) : []
  } catch {
    return []
  }
}

export const savePendingQuest = (quest: QuestDefinition): QuestDefinition[] => {
  const next = normalizePendingQuestSnapshot([...loadPendingQuests(), quest])

  if (!writeLocalStorage(PENDING_QUESTS_STORAGE_KEY, JSON.stringify(next))) {
    throw new Error('Failed to save the pending quest snapshot.')
  }

  return next
}

export const replacePendingQuests = (
  quests: QuestDefinition[]
): QuestDefinition[] => {
  const next = normalizePendingQuestSnapshot(quests)

  if (!writeLocalStorage(PENDING_QUESTS_STORAGE_KEY, JSON.stringify(next))) {
    throw new Error('Failed to replace the pending quest snapshot.')
  }

  return next
}

export const clearPendingQuests = (): void => {
  replacePendingQuests([])
}
