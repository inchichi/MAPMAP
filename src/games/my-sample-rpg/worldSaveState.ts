import type { QuestLogState, QuestProgress, QuestStatus } from './questLog'

// 월드 진행 상태(퀘스트 로그 + 마지막 씬) 저장.
// 플레이어 저장(playerSaveState)과 별도 키를 쓴다 — 그쪽 직렬화는 Lua 퍼사드를
// 경유하므로 필드를 늘리면 TS/Lua 양쪽을 맞춰야 하고, 버전을 올리면 기존 세이브가
// 통째로 폐기된다. 월드 상태는 순수 TS로 여기서만 다룬다.

export const WORLD_SAVE_STATE_STORAGE_KEY = 'my-sample-rpg:world-save-state'
export const WORLD_SAVE_STATE_VERSION = 1

export type WorldSaveState = {
  version: number
  sceneId: string
  questProgressByQuestId: Record<string, QuestProgress>
}

const QUEST_STATUSES: ReadonlySet<string> = new Set([
  'not-started',
  'active',
  'ready-to-turn-in',
  'completed'
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeQuestProgress = (
  questId: string,
  value: unknown
): QuestProgress | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  if (typeof value.status !== 'string' || !QUEST_STATUSES.has(value.status)) {
    return undefined
  }

  const objectives: Record<string, number> = {}

  if (isRecord(value.objectives)) {
    for (const [objectiveId, count] of Object.entries(value.objectives)) {
      if (typeof count === 'number' && Number.isFinite(count) && count >= 0) {
        objectives[objectiveId] = Math.floor(count)
      }
    }
  }

  return {
    id: questId,
    status: value.status as QuestStatus,
    objectives,
    trackerVisible: value.trackerVisible === true
  }
}

export const serializeWorldSaveState = (input: {
  sceneId: string
  questLog: QuestLogState
}): string =>
  JSON.stringify({
    version: WORLD_SAVE_STATE_VERSION,
    sceneId: input.sceneId,
    questProgressByQuestId: input.questLog.progressByQuestId
  } satisfies WorldSaveState)

export const parseStoredWorldSaveState = (
  raw: string | null
): WorldSaveState | undefined => {
  if (!raw) {
    return undefined
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }

  if (!isRecord(parsed) || parsed.version !== WORLD_SAVE_STATE_VERSION) {
    return undefined
  }

  if (typeof parsed.sceneId !== 'string' || parsed.sceneId.length === 0) {
    return undefined
  }

  const questProgressByQuestId: Record<string, QuestProgress> = {}

  if (isRecord(parsed.questProgressByQuestId)) {
    for (const [questId, progress] of Object.entries(
      parsed.questProgressByQuestId
    )) {
      const normalized = normalizeQuestProgress(questId, progress)

      if (normalized) {
        questProgressByQuestId[questId] = normalized
      }
    }
  }

  return {
    version: WORLD_SAVE_STATE_VERSION,
    sceneId: parsed.sceneId,
    questProgressByQuestId
  }
}
