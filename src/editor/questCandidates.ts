import {
  buildFeedbackInstruction,
  type GameEntity,
  type GenerationFeedback
} from './gameAdapter'
import type { GameStructureProfile } from './gameStructureProfile'
import {
  DEFAULT_QUEST_CANDIDATE_COUNT,
  generateQuestCandidatesViaCore,
  type QuestCandidate
} from './questPipeline'

// 퀘스트 생성 1단계(피드백 루프 표면): 전체 이벤트 JSON 대신 짧은 자연어 후보를 N개 만든다.
// 유저가 가볍게 고르고/재생성하고 나서, 고른 후보 하나만 2단계에서 실제 이벤트 JSON으로 만든다.
// 후보 모양/정규화/스키마는 legend-of-lua 흐름과 공통(questPipeline)이고, 여기선 my-sample-rpg
// 도메인(profile 그라운딩)만 끼운다.

// 다른 모듈이 './questCandidates'에서 QuestCandidate를 import하던 호환을 유지한다(정의는 공통 코어).
export type { QuestCandidate }

export type GenerateQuestCandidatesInput = {
  apiKey: string
  userPrompt: string
  profile: GameStructureProfile
  entity?: GameEntity
  gameContext?: string
  feedback?: GenerationFeedback
}

export const QUEST_CANDIDATE_COUNT = DEFAULT_QUEST_CANDIDATE_COUNT

// profile의 실재 id 목록을 프롬프트에 넣어 후보가 실재 NPC/맵/아이템에 근거하게 한다
// (claudeEventJsonGenerator 시스템 프롬프트와 같은 접지 전략).
const buildGroundingContext = (profile: GameStructureProfile): string => {
  const npcIds =
    profile.npcs.map((npc) => `${npc.id}(map=${npc.map})`).join(', ') || '(없음)'
  const mapIds = profile.maps.map((map) => map.id).join(', ') || '(없음)'
  const itemIds = profile.items.map((item) => item.id).join(', ') || '(없음)'
  return `\n\n사용 가능한 NPC: ${npcIds}\n사용 가능한 맵: ${mapIds}\n사용 가능한 아이템: ${itemIds}`
}

export const generateQuestCandidates = ({
  apiKey,
  userPrompt,
  profile,
  entity,
  gameContext,
  feedback
}: GenerateQuestCandidatesInput): Promise<QuestCandidate[]> => {
  const targetLine = entity
    ? `\n\n이 퀘스트의 대상은 NPC id="${entity.id}"(${entity.name})로 한다.`
    : ''
  const contextLine = gameContext ? `\n\n게임 정보: ${gameContext}` : ''
  // 재생성(피드백 루프): 단일 흐름과 같은 buildFeedbackInstruction을 재사용한다.
  const feedbackLine = feedback ? buildFeedbackInstruction(feedback) : ''

  return generateQuestCandidatesViaCore({
    apiKey,
    instructions:
      `'${profile.game_title}' 게임에 어울리는 서로 다른 퀘스트 아이디어를 정확히 ${QUEST_CANDIDATE_COUNT}개 제안한다. ` +
      '각 후보는 전체 코드가 아니라 짧은 자연어 요약(title 1줄 + summary 2~3문장)이다. ' +
      'target_hint는 주어진 NPC id 중 하나이거나 빈 문자열이다. target_hint는 퀘스트의 대상 NPC 힌트이지 기버가 아니다. ' +
      'title/summary는 한국어로, 서로 충분히 다른 방향으로 작성한다.',
    input: `시나리오: ${userPrompt}${targetLine}${contextLine}${buildGroundingContext(profile)}${feedbackLine}`,
    targetHintEnum: ['', ...profile.npcs.map((npc) => npc.id)],
    schemaName: 'quest_candidates'
  })
}
