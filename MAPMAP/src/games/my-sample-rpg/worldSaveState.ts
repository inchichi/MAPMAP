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
  collectedCoinTileKeysBySceneId: Record<string, string[]>
  // 쓰러뜨린 보스(다시 생기지 않는다). 버전 1 에 나중에 더한 필드 — 없으면 빈 객체.
  defeatedBossIdsBySceneId: Record<string, string[]>
  // 손을 대 발견한 귀환 표지석 id(waystones.ts). 버전 1 에 나중에 더한 필드 — 없으면 빈 목록.
  discoveredWaystoneIds: string[]
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

// 획득한 코인 키 목록은 버전 1 스키마에 추가된 필드다. 필드가 없는 기존
// 세이브는 빈 객체로 정규화되므로 버전을 올리지 않는다(올리면 세이브 폐기).
const normalizeCollectedCoinTileKeys = (
  value: unknown
): Record<string, string[]> => {
  if (!isRecord(value)) {
    return {}
  }

  const collectedBySceneId: Record<string, string[]> = {}

  for (const [sceneId, keys] of Object.entries(value)) {
    if (!Array.isArray(keys)) {
      continue
    }

    collectedBySceneId[sceneId] = [
      ...new Set(keys.filter((key): key is string => typeof key === 'string'))
    ]
  }

  return collectedBySceneId
}

export const serializeWorldSaveState = (input: {
  sceneId: string
  questLog: QuestLogState
  collectedCoinTileKeysBySceneId: Record<string, string[]>
  defeatedBossIdsBySceneId?: Record<string, string[]>
  discoveredWaystoneIds?: string[]
}): string =>
  JSON.stringify({
    version: WORLD_SAVE_STATE_VERSION,
    sceneId: input.sceneId,
    questProgressByQuestId: input.questLog.progressByQuestId,
    collectedCoinTileKeysBySceneId: input.collectedCoinTileKeysBySceneId,
    defeatedBossIdsBySceneId: input.defeatedBossIdsBySceneId ?? {},
    discoveredWaystoneIds: input.discoveredWaystoneIds ?? []
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
    questProgressByQuestId,
    collectedCoinTileKeysBySceneId: normalizeCollectedCoinTileKeys(
      parsed.collectedCoinTileKeysBySceneId
    ),
    // 씬별 문자열 목록이라 코인 키와 같은 정규화를 쓴다.
    defeatedBossIdsBySceneId: normalizeCollectedCoinTileKeys(parsed.defeatedBossIdsBySceneId),
    discoveredWaystoneIds: Array.isArray(parsed.discoveredWaystoneIds)
      ? [...new Set(parsed.discoveredWaystoneIds.filter((id): id is string => typeof id === 'string'))]
      : []
  }
}
