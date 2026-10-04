import { openProjectDirectory } from './openProjectDirectory'
import { createHoverPreview, buildTileSlicePreview, buildImagePreview, buildCellsCanvasPreview } from './createHoverPreview'
import { buildLayeredObjectHoverPreview } from './buildBuildingHoverPreview'
import { extractTilesetTileIdByType, extractTmxTilesetImageInfo } from './tmxTileEntities'
import type { StyleTransferMapObject } from './createStyleTransferModal'
import { installDecorationDemo, loadPlacementsForMap, setDecorationLayerVisible, type PlacedItem } from './placementStore'
import {
  buildTileClusterEntities,
  findFileByRelativeSource,
  findObjectKindCells,
  findTileClusterDetail,
  resolveRelativePath,
  isTileClusterEntity,
  loadGame,
  type GameFile,
  type LoadedGame,
  type LoadedGameMap
} from './loadGame'
import { analyzeGame, type GameAnalysis } from './analyzeGame'
import { extractTmxLayerNames, extractTmxObjects, type TmxObject } from './tmxObjects'
import { readLocalStorage } from './safeStorage'
import { LOCAL_LLM_MODEL } from './llmProvider'
import {
  appendEventEvaluation,
  clearEventEvaluations,
  loadEventEvaluations,
  type EventEvaluation,
  type EventEvaluationVerdict
} from './eventEvaluator'
import { buildSessionMetrics, type SessionGenerationTally } from './sessionMetrics'
import { editorIcon, type EditorIconName } from './editorIcons'
import type { GameEntity, GenerationFeedback, GenerationResult } from './gameAdapter'
import { generateQuestCandidates, type QuestCandidate } from './questCandidates'
import { dryRunEventApply, type DryRunReport } from './dryRunEventApply'
// 후보 흐름에서 "진짜 퀘스트" 생성 경로(회귀 복원). my-sample-rpg 전용.
import { generateQuestJson } from './questJsonGenerator'
import { dryRunQuestApply } from './dryRunQuestApply'
import { convertGeneratedQuestToDefinition } from './questCodeGenerator'
import { createGeneratedQuestValidationIssues } from './questJsonSchema'
import { replacePendingQuests } from './pendingQuests'
import { appendPendingScenario } from './pendingScenarios'
import {
  generateScenarioWithLlm,
  ScenarioGenerationError
} from './scenarioGenerator'
import { SHELL_GAME_SCENARIO } from './scenarioGoldExample'
import { MY_SAMPLE_RPG_SCENARIO_REGISTRY } from './scenarioRegistry'
import { formatScenarioAsText } from './scenarioTextFormat'
import { createScenarioValidationIssues } from './scenarioValidator'
import {
  createScenarioDemoReport,
  formatScenarioDemoReport,
  SCENARIO_DEMO_PROMPT,
  type ScenarioDemoSource
} from './scenarioDemo'
import { createStyleTransferModal } from './createStyleTransferModal'
// SpecDriven 파이프라인(시나리오→StyleSpec→앵커 승인→일괄 변환+QA) — 디벨롭 방향 8/6.
import { createStylePipelinePanel } from './createStylePipelinePanel'
// my-sample-rpg 라이브 NPC 생성(자연어 → 플레이어 옆 스폰).
import { generateNpcJson } from './npcJsonGenerator'
import { decideEditorAction } from './editorActionGenerator'
import { resolveLegendEntitySpriteUrl } from './legendEntitySprite'
// 맵 인식 시 묶인 오브젝트 누끼 자동 추출(분기 B·스타일 모달 '추출' 탭의 입력).
import { requestMapObjectExtraction } from './extractMapObjects'
import type { GeneratedScenarioJson } from '../games/my-sample-rpg/scenario/scenarioTypes'
// 게임이 localStorage에 저장한 수기/생성 NPC — 트리에 TMX 엔티티와 합쳐 보여주기 위해 읽는다.
import { loadNpcsForMap, PENDING_NPCS_STORAGE_KEY, removeNpc } from './npcStore'
import { createStyleChangePanel } from './panels/createStyleChangePanel'

// 하드코딩 어댑터가 엔티티를 못 찾은 미지의 게임을, LLM 분석이 찾은 editable 그룹으로 채운다.
const buildEntitiesFromAnalysis = (
  files: GameFile[],
  analysis: GameAnalysis
): LoadedGameMap[] => {
  const editableKindByGroup = new Map<string, string>()
  for (const entityGroup of analysis.entity_groups) {
    if (entityGroup.editable) {
      editableKindByGroup.set(entityGroup.group, entityGroup.kind)
    }
  }

  return files
    .filter((file) => file.name.endsWith('.tmx'))
    .map((file) => {
      const id = file.name.replace(/\.tmx$/u, '')
      // 한 맵이 깨졌다고 분석 기반 트리 재구성을 통째로 죽이지 않는다(loadGame과 동일한 격리).
      let objects: TmxObject[] = []
      try {
        objects = extractTmxObjects(file.text)
      } catch {
        // 파싱 실패 맵 → 엔티티 0개
      }
      const entities = objects
        .filter(
          (object) =>
            editableKindByGroup.has(object.group) && object.name.length > 0
        )
        .map((object) => ({
          id: `${object.group}-${object.id}`,
          name: object.name,
          kind: editableKindByGroup.get(object.group) ?? 'entity',
          mapId: id
        }))
        // 분석으로 트리를 갈아끼워도 타일 군집(보기 전용 구조물)은 유지한다 — loadGame과 동일.
        .concat(buildTileClusterEntities(id, file, files, objects))
      return { id, name: id, file: file.path, entities, layers: extractTmxLayerNames(file.text) }
    })
}

type CreateEditorAppInput = {
  mountElement: HTMLElement
  initialFiles: GameFile[]
  gamePreviewUrl: string
}

// 종류별 게임풍 SVG 아이콘 매핑(editorIcons.ts에서 손으로 그린 것들). emoji는 쓰지 않는다.
const KIND_ICON: Record<string, EditorIconName> = {
  npc: 'npc',
  monster: 'monster',
  enemy: 'monster',
  sign: 'sign',
  portal: 'portal',
  chest: 'chest',
  loot: 'loot',
  building: 'building',
  character: 'character',
  // 타일 군집(tmxTileEntities)으로 인식되는 종류들.
  tent: 'tent',
  clocktower: 'clocktower',
  fountain: 'fountain',
  lamp: 'lamp',
  banner: 'banner',
  tree: 'tree',
  hedge: 'hedge',
  flower: 'flower',
  prop: 'prop',
  rock: 'rock',
  stairs: 'stairs',
  wall: 'wall',
  window: 'window'
}

// 보기 전용 요소(몬스터·표지판·포털 등)에 붙는 짧은 한국어 종류 라벨.
const KIND_LABEL: Record<string, string> = {
  npc: 'NPC',
  monster: '몬스터',
  enemy: '몬스터',
  sign: '표지판',
  portal: '포털',
  chest: '상자',
  loot: '전리품',
  building: '건물',
  object: '객체',
  character: '캐릭터',
  // 타일 군집(tmxTileEntities)으로 인식되는 종류들.
  tent: '천막',
  clocktower: '시계탑',
  fountain: '분수',
  lamp: '가로등',
  banner: '깃발',
  tree: '나무',
  hedge: '생울타리',
  flower: '화단',
  prop: '소품',
  rock: '바위',
  stairs: '계단',
  wall: '벽',
  window: '창문'
}

// 에셋 카테고리(표시 전용) — 인물/건축물/장식물/환경 4층으로 묶어 정보 구조를 만든다.
// 표시용 이름 정리(표시 전용) — 내부 id 느낌의 이름('villager_a' 등)을 발표용 라벨로 바꾼다.
// 우선순위: 짧은 원본 이름 그대로 → 흔한 영문 키워드 한글화 → 구분자/확장자 정리.
const displayNameOf = (rawName: string): string => {
  const cleaned = rawName
    .replace(/\.(png|jpe?g|json|tmx|lua)$/iu, '')
    .replace(/[_-]+/gu, ' ')
    .trim()
  const lower = cleaned.toLowerCase()
  const villager = lower.match(/^villager\s*([a-z0-9]*)$/u)
  if (villager) {
    const suffix = (villager[1] ?? '').toUpperCase()
    return suffix ? `주민 ${suffix}` : '주민'
  }
  if (lower.startsWith('blacksmith')) {
    return '대장장이'
  }
  if (lower.startsWith('merchant') || lower.startsWith('vendor')) {
    return '상인'
  }
  if (lower.startsWith('mage') || lower.startsWith('wizard')) {
    return '마법사'
  }
  if (lower.startsWith('guard')) {
    return '경비병'
  }
  if (lower.startsWith('santa')) {
    return '산타'
  }
  return cleaned
}

// NPC 역할별 아이콘(표시 전용) — 이름 키워드로 추정한다. 사용자는 이름보다 아이콘으로 먼저 구분한다.
const npcIconFor = (name: string): EditorIconName => {
  const lower = name.toLowerCase()
  if (name.includes('마법') || lower.includes('mage') || lower.includes('wizard')) {
    return 'orb'
  }
  if (name.includes('대장') || lower.includes('smith')) {
    return 'sword'
  }
  if (name.includes('경비') || name.includes('기사') || lower.includes('guard') || lower.includes('knight')) {
    return 'shield'
  }
  if (name.includes('상인') || name.includes('상점') || lower.includes('merchant') || lower.includes('shop') || lower.includes('vendor')) {
    return 'loot'
  }
  return 'npc'
}

// 트리 그룹핑용 종류 정규화. LLM 분석이 'NPC'처럼 대소문자를 섞어 줄 수 있어 소문자로 맞추고,
// enemy는 라벨·아이콘이 '몬스터'로 같아 monster 그룹에 합친다(그래서 위 맵에는 enemy 키가 없다).
const groupKindOf = (kind: string): string => {
  const normalized = kind.trim().toLowerCase()
  return normalized === 'enemy' ? 'monster' : normalized
}

// 작업 로그/결과 보드 시간 표시(표시 전용). 타임라인은 절대 시각(HH:MM, 안정적),
// "Last Generated"는 상대 시각(2 minutes ago)으로 살아있는 느낌을 준다.
const formatClock = (date: Date): string =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
const formatRelativeTime = (date: Date): string => {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (seconds < 45) {
    return 'just now'
  }
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  }
  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) {
    node.textContent = text
  }
  return node
}

// ---- 디자인 토큰 ----
// 상용 MMORPG 월드 에디터 톤: 게임 화면이 주인공, UI는 짙은 갈색/회색 + 은은한 금색(#b6bac1)으로
// 보조한다. 패널은 반투명(rgba(37,33,31,0.9))이라 게임과 경쟁하지 않는다.
// 팔레트 — 배경 #0a0a0a · 패널 #141416 · hover #302a26 · 테두리 #333336 · 강조 #b6bac1
//          텍스트 #d4d4d4 · 보조 텍스트 #9d9d9d.
const LABEL = 'text-[11px] font-semibold tracking-wide text-[#9d9d9d]'
// 큰 영역(왼쪽 에셋/게임 카드/입력 카드/결과 카드)이 공유하는 패널 골격 — 은은한 그라데이션 테두리.
const PANEL = 'rounded-xl box-grad-border [--bgb:rgba(37,37,38,0.97)] text-[#d4d4d4]'
const CARD =
  'rounded-lg border border-[#b6bac1]/25 bg-[#0a0a0a]/60 p-3 flex flex-col gap-2'
// 자연어 입력창 — 어두운 속지에 갈색 테두리, focus 시 금색.
const FIELD_INPUT =
  'w-full rounded-[12px] border-2 border-[#b6bac1]/45 bg-[#0d0d0d] px-4 py-3 text-[12px] text-[#d4d4d4] outline-none transition placeholder:text-[#919191] focus:border-[#b6bac1] focus:shadow-[0_0_18px_rgba(208,154,76,0.18)]'
// 액션 버튼 — 생성이 화면의 메인 CTA(가장 크고 눈에 띄는 금색), 적용(초록)은 그보다 작게.
// CTA 계층: 생성(Primary, 금색 그라데이션+glow) > 적용(Secondary, 금테+어두운 브라운) > 복사/내보내기(보조).
// 메탈릭 실버/그래파이트 버튼 — 폴리시한 2D 게임 UI 톤(골드 제거).
// 생성=밝은 브러시드 실버(주인공), 적용=그래파이트 스틸, 복사/내보내기=다크+실버 테두리.
// 진한 회색 플랫 버튼 — 검정 테마에 맞춰 중간 진회색 + 밝은 글자. Create=한 단계 밝은 회색,
// Apply=한 단계 가라앉은 회색, 복사/내보내기=외곽선.
const PRIMARY_BUTTON =
  'rounded-xl h-[52px] min-w-[240px] px-6 flex items-center justify-center bg-[#595c62] text-[#f0f1f3] font-semibold border border-[#787c83] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_2px_5px_rgba(0,0,0,0.45)] transition duration-150 hover:bg-[#666a71] hover:-translate-y-px active:translate-y-0 active:brightness-95 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0'
const APPLY_BUTTON =
  'rounded-xl h-[46px] px-5 flex items-center justify-center bg-[#45474c] text-[#dfe1e5] text-[15px] font-semibold border border-[#5e6168] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.4)] transition duration-150 hover:bg-[#505257] hover:-translate-y-px active:translate-y-0 active:brightness-95 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0'
const GHOST_BUTTON =
  'rounded-lg h-[40px] px-3.5 bg-[#3a3b3e] text-[#d4d7dc] text-[13px] border border-[#9296a0]/55 transition duration-150 hover:bg-[#44464a] hover:text-[#f0f1f3] hover:border-[#9296a0] active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed'
// 종류 카드 — 게임 에디터의 선택 카드: 아이콘(46px) + 이름 + '8개' 카운트. 한 화면에 10개 이상 보이게 낮춘다.
// 에셋 종류 카드 — 기본/hover는 테두리 없이 면(배경)으로만 구분, 선택된 카드만 금색 테두리.
// 구성원 pill(34px, 한 줄에 2개) — 짧은 한글 표시 이름은 잘리지 않고, 긴 이름은 툴팁으로 보완.
const ENTITY_BASE =
  'h-[34px] min-w-0 flex items-center gap-1.5 rounded-lg px-2 text-left bg-[#1a1a1c] border border-[#3c3c3c] text-[12px] text-[#d4d4d4] transition hover:bg-[#242427] hover:border-[#5a5d63]'
// 선택된 구성원(=지금 편집 중인 에셋) — 가장 또렷한 소프트 그레이 필 + 밝은 테두리(퀵카드 선택과 동일 언어).
const ENTITY_ACTIVE =
  'h-[34px] min-w-0 flex items-center gap-1.5 rounded-lg px-2 text-left bg-[#52555b] border border-[#9296a0] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] text-[12px] text-[#f0f1f3] transition duration-150'
// 게임 미리보기 위 맵 탭(마을/사냥터/동굴) — 둥근 나무 탭, 선택된 탭만 금색 그라데이션.
const SCENE_TAB =
  'h-[26px] flex items-center gap-1.5 text-[14px] leading-none rounded-lg px-3 py-1 bg-[#1a1a1c] border border-[#3c3c3c] text-[#9d9d9d] transition hover:bg-[#242427] hover:text-[#d4d4d4]'
const SCENE_TAB_ACTIVE =
  'h-[26px] flex items-center gap-1.5 text-[14px] leading-none rounded-lg px-3 py-1 bg-[#a8adb5] border border-[#878d96] text-[#1c1d20] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition'
// 진행 단계 캡슐(선택→작성→생성→확인→적용) — 숫자 원형 배지 + 라벨 구조.
// 현재 단계: 금색 테두리+은은한 glow 펄스, 숫자는 금색 채움 / 완료: ✓ / 미완료: 보조 정보 수준.
const STEP_PILL =
  'group h-[30px] inline-flex items-center gap-1.5 text-[13px] rounded-full pl-1 pr-3 bg-[#1a1a1c] border border-[#3c3c3c] transition hover:border-[#5a5d63]'
const STEP_PILL_ACTIVE =
  'step-pulse h-[30px] inline-flex items-center gap-1.5 text-[13px] rounded-full pl-1 pr-3 bg-gradient-to-b from-[#52555b] to-[#34363a] border border-[#b6bac1] transition'
const STEP_PILL_DONE =
  'h-[30px] inline-flex items-center gap-1.5 text-[13px] rounded-full pl-1 pr-3 bg-[#1a1a1c] border border-[#5a5d63]/50 transition'
// 숫자 원형 배지 — 활성은 살짝 크고 금색 채움 + 밝은 숫자.
const STEP_NUM =
  'w-[18px] h-[18px] shrink-0 flex items-center justify-center rounded-full bg-[#242427] text-[10px] leading-none text-[#9d9d9d] transition'
const STEP_NUM_ACTIVE =
  'w-[20px] h-[20px] shrink-0 flex items-center justify-center rounded-full bg-[#0a0a0a]/30 border border-[#cfd2d6] text-[11px] leading-none text-[#f0f0f0] font-semibold transition'
const STEP_NUM_DONE =
  'w-[18px] h-[18px] shrink-0 flex items-center justify-center rounded-full bg-[#34363a] text-[10px] leading-none text-[#c8ccd2] transition'
const STEP_TEXT = 'text-[#8a8a8a] transition group-hover:text-[#b8b8b8]'
const STEP_TEXT_ACTIVE = 'text-[#f0f0f0] font-semibold'
const STEP_TEXT_DONE = 'text-[#b6bac1]'

// ---- 설정 모달(VSCode Dark 설정창) 토큰 ----
// 메인 에디터(차콜)보다 두세 단계 밝은 연회색 계층 — 모달이 떠 있을 때 명확히 분리돼 보인다.
const SETTINGS_SECTION = 'rounded-2xl border-2 border-[#5a5a61] bg-[#45454b] p-4 flex flex-col gap-3'
const SETTINGS_LABEL = 'text-base font-semibold text-[#e6e6e6]'
// 프로젝트 기본 버튼 — 연회색 보조 버튼 톤.
const SETTINGS_BUTTON =
  'flex items-center justify-center gap-2.5 rounded-xl min-h-[48px] px-4 bg-[#4a4a50] text-[#e6e6e6] text-lg border border-[#5e5e66] transition hover:bg-[#56565c] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0'
// 메인 액션(AI 게임 분석) — 밝은 회색 버튼으로 강조(블루 제거, 버튼 색 통일).
const SETTINGS_BUTTON_SPECIAL =
  'flex items-center justify-center gap-2.5 rounded-xl min-h-[48px] px-4 bg-[#c6cad1] text-[#1c1d20] text-lg font-semibold border border-[#9aa0a8] transition hover:bg-[#d3d7dd] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0'
export const createEditorApp = ({
  mountElement,
  initialFiles,
  gamePreviewUrl
}: CreateEditorAppInput): void => {
  let game: LoadedGame = loadGame(initialFiles)
  let currentFiles: GameFile[] = initialFiles
  let selectedEntity: GameEntity | undefined
  let currentResult: GenerationResult | undefined
  let currentAnalysis: GameAnalysis | undefined
  let isGenerating = false
  let isAnalyzing = false
  let entityButtons: Array<{ entity: GameEntity; node: HTMLButtonElement }> = []
  let styleTransferModal: ReturnType<typeof createStyleTransferModal>
  let stylePipelinePanel: ReturnType<typeof createStylePipelinePanel>
  // 라이브 게임(iframe)이 보고한 현재 맵 id. 트리를 이 맵의 요소만으로 좁힌다(showAllMaps면 전부).
  // 게임의 sceneId 와 에디터 map.id(=tmx 파일명)가 같아 직접 비교한다. 게임이 맵을 바꿀 때마다
  // 'game:scene-changed' 메시지로 갱신된다.
  let currentMapId: string | undefined
  // my-sample-rpg는 게임이 'game:scene-changed'로 현재 맵을 되보고해 트리가 그 맵을 자동으로 따라간다.
  // legend-of-lua 등은 인게임 맵 이동(포털)을 에디터에 알리지 못해, 현재-맵 필터가 stale해져 다른 맵에
  // 생성한 NPC가 트리에서 사라진 것처럼 보인다. 그래서 씬 되보고가 없는 게임은 기본적으로 전체 맵을
  // 보여줘(showAllMaps=true) 생성 엔티티가 어느 맵 탭에서나 항상 보이게 한다(토글로 좁힐 수 있음).
  let showAllMaps = game.adapter.id !== 'my-sample-rpg'
  // 에셋 검색어(표시 전용) — 왼쪽 트리를 이름으로 실시간 필터링한다.
  let assetQuery = ''
  // 트리의 종류별 그룹(NPC/몬스터 등) 펼침 상태. 키는 `${mapId}:${kind}` — 트리를 다시 그려도 유지된다.
  // 기본은 접힘: 요소를 쭉 나열하면 목록이 길어 보기 불편하다는 피드백에 따른 동작.
  const expandedGroups = new Set<string>()
  // 카테고리(인물/건축물/장식물/환경) 접힘 상태 — 표시 전용.
  // 세션 내 생성 결과 누적(최신 우선, 최대 10개). 데모에서 여러 생성을 비교·재선택하려는 용도.
  const HISTORY_LIMIT = 10
  let history: Array<{ n: number; result: GenerationResult }> = []
  let historyCounter = 0
  // Evaluator(사람 이진 평가, 회의 #3/#7): 생성/검증과 분리된 품질 판정. 단일 지표 acceptance_rate.
  // 평가 판정은 결과 객체 동일성으로 기억한다(단일 슬롯이면 히스토리에서 옛 결과를 다시 골라 재평가 →
  // 중복 집계되어 acceptance_rate가 오염됨). WeakMap이라 참조가 사라진 결과는 알아서 GC된다.
  let evaluations: EventEvaluation[] = loadEventEvaluations()
  let verdictByResult = new WeakMap<GenerationResult, EventEvaluationVerdict>()
  // 결과 보드의 "적용 상태" 표시 전용 — 게임에 적용된 결과를 기억한다(로직에는 영향 없음).
  const appliedResults = new WeakSet<GenerationResult>()
  // 빈 보드의 '오늘 작업' 통계 표시 전용 — 이번 세션의 적용 횟수.
  let appliedCount = 0
  // '최근 작업' 시간 표시 전용 — 결과가 처음 화면에 잡힌 시각(생성 직후 render에서 기록).
  const resultTimes = new WeakMap<GenerationResult, Date>()
  // 액티비티 피드(표시 전용) — 선택·생성·검증·적용 같은 에디터 동작을 시간순으로 기록한다(최신이 위).
  // 개발 툴 콘솔처럼 "방금 무슨 일이 있었는지"를 보여줘 사용자 확신·시연·디버깅을 돕는다.
  const activityLog: Array<{ time: Date; text: string }> = []
  const logActivity = (text: string): void => {
    activityLog.unshift({ time: new Date(), text })
    if (activityLog.length > 40) {
      activityLog.length = 40
    }
  }
  // 이번 세션 집계: 생성 수 + Validator 통과 수. 프로젝트를 바꾸면 초기화한다.
  let sessionTally: SessionGenerationTally = { generations: 0, validatorPasses: 0 }
  // 퀘스트 모드(2단계 생성): 라우팅이 create_quest 로 판별하면 켜진다. 1단계는 자연어 후보 N개를
  // 만들고, 유저가 하나를 골라 2단계에서 그 후보만 이벤트 JSON으로 만든 뒤 드라이런 검증→적용한다.
  let candidateMode = false
  // NPC 생성 모드(my-sample-rpg): 라우팅이 create_npc 로 판별하면 켜진다. 적용 시 플레이어 옆 라이브 스폰.
  let npcMode = false
  let candidates: QuestCandidate[] = []
  let selectedCandidateIndex: number | undefined
  // 인라인 요약 편집 중인 후보 인덱스(표시 전용).
  let editingCandidateIndex: number | undefined
  // 후보 재생성(피드백 루프) 반복 횟수.
  let candidateIteration = 0
  // 마지막 2단계 결과의 무결성 검증(드라이런) 리포트. 퀘스트 모드에서 적용 게이트로 쓴다.
  let currentDryRun: DryRunReport | undefined
  // 후보 카드 다시 그리기 훅 — 실제 구현은 핸들러 정의부에서 할당한다(render에서 안전히 호출하려 let).
  let renderCandidates: () => void = () => {}

  // ---------- shell ----------
  // w-screen이 아니라 w-full — 100vw는 세로 스크롤바 폭을 포함해 가로 스크롤을 만든다.
  const root = el('div', 'h-screen w-full flex flex-col bg-[#0a0a0a] text-[#d4d4d4] overflow-hidden')
  root.classList.add('editor-workspace')

  // 헤더는 얇고 어두운 도구 바 — 시선은 아래 게임 화면으로 가게 한다.
  // 게임 화면이 주인공이도록 헤더는 낮게 압축한다.
  const header = el('header', 'settings-game-font select-none shrink-0 flex items-center justify-between gap-3 px-4 py-1.5 border-b border-[#b6bac1]/28 bg-[#141416] text-[#d4d4d4]')
  header.classList.add('editor-workspace-header')
  const brand = el('div', 'flex items-center gap-2.5 min-w-0')
  const brandText = el('div', 'flex flex-col gap-0.5 min-w-0')
  const brandTitleRow = el('div', 'flex items-center gap-2 min-w-0')
  brandTitleRow.append(
    el('span', 'text-[18px] font-bold leading-none tracking-[0.01em] whitespace-nowrap text-[#f0f1f3]', 'Village Story Workshop')
  )
  // 헤더 프로젝트 메타(표시 전용) — Project/Map/Version을 실데이터에 연결한다.
  // Project·Version은 어댑터, Map은 현재 씬(scene-changed로 실시간). 좁은 화면에선 숨겨 도구바가 넘치지 않게.
  const headerMetaField = (label: string): { wrap: HTMLElement; value: HTMLElement } => {
    const wrap = el('span', 'flex items-baseline gap-1 leading-none min-w-0')
    const value = el('span', 'text-[10px] font-medium text-[#b6bac1] truncate max-w-[150px]')
    wrap.append(
      el('span', 'shrink-0 text-[10px] text-[#777777]', `${label}:`),
      value
    )
    return { wrap, value }
  }
  const projectMeta = headerMetaField('Current Project')
  const mapMeta = headerMetaField('Current Map')
  const versionMeta = headerMetaField('Version')
  const headerMeta = el('div', 'hidden md:flex items-center gap-3 mt-[3px] min-w-0')
  headerMeta.append(projectMeta.wrap, mapMeta.wrap, versionMeta.wrap)
  brandText.append(brandTitleRow, headerMeta)
  // 다른 프로젝트를 열거나 게임이 맵을 바꾸면 즉시 반영된다(render()와 scene-changed 핸들러가 호출).
  const updateHeaderMeta = (): void => {
    projectMeta.value.textContent = game.adapter.projectTitle ?? game.adapter.name
    const focusMap =
      currentMapId !== undefined
        ? game.maps.find((map) => map.id === currentMapId)
        : game.maps[0]
    mapMeta.value.textContent = focusMap?.name ?? '—'
    versionMeta.value.textContent = game.adapter.version ?? '—'
  }
  brand.append(editorIcon('sword', 20), brandText)
  // 모델 배지 — 에디터는 고정된 로컬 vLLM 모델만 사용한다.
  const modelBadge = el(
    'span',
    'self-start text-[12px] rounded-md px-2 py-0.5 bg-[#45454b] border border-[#5a5a61] text-[#b8b8b8]',
    `로컬 vLLM · ${LOCAL_LLM_MODEL}`
  )
  // 연결 상태 배지 — 28px 캡슐. 연결되면 초록(#72d36b)으로 바뀐다(iframe load 리스너에서 갱신).
  const connection = el('div', 'h-7 flex items-center gap-1.5 text-[11px] rounded-full px-2.5 bg-[#1a1a1c] border border-[#b6bac1]/28 text-[#9d9d9d]')
  const connectionDot = el('span', 'w-2 h-2 rounded-full bg-[#6e6e6e]')
  const connectionLabel = el('span', '', '접속 중...')
  connection.append(connectionDot, connectionLabel)
  // 설정 — 톱니 아이콘만 있는 32px 원형 버튼.
  const settingsButton = el('button', 'w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-[#1a1a1c] border border-[#5a5d63]/60 transition hover:bg-[#34363a] hover:border-[#8a8e95]') as HTMLButtonElement
  settingsButton.setAttribute('aria-label', '설정')
  settingsButton.append(editorIcon('gear', 16))
  settingsButton.type = 'button'
  const headerRight = el('div', 'flex items-center gap-2 shrink-0')
  headerRight.append(connection, settingsButton)
  const decorationToggle = el('button', 'px-2 py-1 border rounded', '장식 켜기/끄기') as HTMLButtonElement
  decorationToggle.type = 'button'
  decorationToggle.addEventListener('click', () => {
    if (game.adapter.id === 'crypt-crawler') {
      const visible = localStorage.getItem('crypt-crawler:style-visible') !== 'false'
      localStorage.setItem('crypt-crawler:style-visible', String(!visible))
      decorationToggle.textContent = visible ? '장식 꺼짐' : '장식 켜짐'
      return
    }
    const mapId = currentMapId ?? 'town'
    const visible = loadPlacementsForMap(mapId).some(item => item.renderLayer === 'decoration' && item.visible !== false)
    setDecorationLayerVisible(mapId, !visible)
    decorationToggle.textContent = visible ? '장식 꺼짐' : '장식 켜짐'
  })
  const decorationDemo = el('button', 'px-2 py-1 border rounded', '첫 결과 복원 · 크리스마스') as HTMLButtonElement
  decorationDemo.type = 'button'
  decorationDemo.addEventListener('click', async () => {
    decorationDemo.disabled = true
    try {
      const response = await fetch('/experiments/flux-decorations-20260909/placements.json')
      if (!response.ok) throw new Error('Decoration fixture failed to load')
      installDecorationDemo(await response.json() as PlacedItem[])
      decorationToggle.textContent = '장식 켜짐'
      decorationDemo.textContent = '첫 결과 복원됨'
    } catch {
      decorationDemo.textContent = '적용 실패 · 다시 시도'
    } finally {
      decorationDemo.disabled = false
    }
  })
  const promptThemeLink = el('a', 'px-3 py-2 border border-[#c9a96b] rounded text-[#e2bd8c]', '스타일 변환')
  promptThemeLink.classList.add('editor-style-action')
  const styleWorkspaceUrl = (): string => game.adapter.id === 'crypt-crawler'
    ? `/editor.html?workspace=style&game=crypt&map=${encodeURIComponent(currentMapId ?? new URLSearchParams(location.search).get('map') ?? 'floor-1-ruins')}`
    : '/editor.html?workspace=style&map=town'
  promptThemeLink.href = styleWorkspaceUrl()
  promptThemeLink.addEventListener('click', () => { promptThemeLink.href = styleWorkspaceUrl() })
  if (game.adapter.id !== 'crypt-crawler') headerRight.append(promptThemeLink, decorationDemo, decorationToggle)
  else headerRight.append(promptThemeLink, decorationToggle)
  header.append(brand, headerRight)

  // LLM 챗 스타일 배치: 가운데가 라이브 게임(위 가득) + 프롬프트(아래), 오른쪽이 생성 결과.
  // 3열은 md(≥768px)부터 바로 적용한다 — 이전엔 lg부터여서, 브라우저 줌을 쓰는 일반 노트북
  // 창이 "결과가 하단 전폭" 배치로 떨어지며 게임 세로 공간을 잃었다(게임이 납작한 띠가 됨).
  //  - md(≥768px): [엔티티 트리 | 게임+프롬프트 | 생성 결과] 3열 (lg부터는 사이드가 약간 넓어짐)
  //  - 그 미만: 트리 → 게임+프롬프트 → 생성 결과 세로 스택
  const body = el(
    'div',
    // 패널 사이 여백은 최소로 — 게임 화면에 최대한 면적을 준다(헤더 쪽 위 여백은 절반).
    'flex-1 min-h-0 grid gap-2 px-2 pb-2 pt-1 ' +
      'grid-cols-1 grid-rows-[auto_minmax(0,1.4fr)_minmax(0,1fr)] [grid-template-areas:"tree""main""side"] ' +
      // 게임 화면이 화면 대부분을 차지하도록 좌우 사이드를 좁게 못 박는다.
      // 왼쪽은 아이콘 카드 2열(카드 약 90px+)이 들어가야 해서 최소 폭을 조금 더 준다.
      'md:grid-cols-[minmax(212px,17%)_minmax(0,1fr)_minmax(248px,21%)] md:grid-rows-[minmax(0,1fr)] md:[grid-template-areas:"tree_main_side"]'
  )

  // ---------- left: project tree ----------
  // 스택 배치(<md)에선 높이 제한(목록이 길면 자체 스크롤), md부터는 왼쪽 열 카드.
  const tree = el(
    'aside',
    // settings-game-font: 왼쪽 패널도 ESC/설정 모달과 같은 둥근 픽셀 폰트를 쓴다.
    // select-none: 라벨이 드래그로 파랗게 선택되면 UI 오류처럼 보인다 — 패널 전체 선택 금지.
    `settings-game-font select-none [grid-area:tree] ${PANEL} min-w-0 max-h-[35vh] md:max-h-none flex flex-col min-h-0 overflow-hidden`
  )
  // 상단 정보는 압축 — 에셋 목록이 더 위에서부터 보이게.
  const treeHeader = el('div', 'px-2.5 pt-2 pb-1.5 border-b border-[#b6bac1]/25 flex flex-col gap-1')
  // 설정 모달의 프로젝트 버튼 — 모바일 게임 버튼(그라데이션 + 아이콘 + hover 떠오름).
  const openButton = el('button', SETTINGS_BUTTON) as HTMLButtonElement
  openButton.append(editorIcon('folder', 22), el('span', '', '게임 폴더 열기'))
  openButton.type = 'button'
  const analyzeButton = el('button', SETTINGS_BUTTON_SPECIAL) as HTMLButtonElement
  // 분석 버튼은 진행 상태에 따라 라벨만 갈아끼운다(textContent를 통째로 바꾸면 아이콘이 날아간다).
  const analyzeLabel = el('span', '', 'AI 게임 분석')
  analyzeButton.append(editorIcon('orb', 22), analyzeLabel)
  analyzeButton.type = 'button'
  const resetButton = el('button', SETTINGS_BUTTON) as HTMLButtonElement
  resetButton.append(editorIcon('building', 20), el('span', '', '게임으로 복귀'))
  resetButton.type = 'button'
  // 프로젝트 버튼(폴더 열기/분석/복귀)은 설정 모달로 이동했다. 사이드바는 엔티티 목록만.
  const treeHeaderTop = el('div', 'flex items-center justify-between gap-2')
  const treeTitle = el('div', 'flex items-center gap-2 text-[15px] font-semibold tracking-wide text-[#e6e6e6]')
  treeTitle.append(editorIcon('map', 16), el('span', '', '현재 맵 에셋'))
  treeHeaderTop.append(treeTitle)
  // 라이브 게임이 맵을 보고한 뒤에만 의미가 있는 토글(현재 맵만 ↔ 전체 맵). 그 전엔 숨긴다.
  const mapFilterToggle = el('button', 'text-[11px] text-[#9d9d9d] transition hover:text-[#d4d4d4]', '전체 보기') as HTMLButtonElement
  mapFilterToggle.type = 'button'
  mapFilterToggle.hidden = true
  treeHeaderTop.append(mapFilterToggle)
  // 선택 대상 카드 — 종류별 개수는 아래 카드 그리드가 보여주므로 헤더엔 타겟만 남긴다.
  // 선택 대상은 한 줄 정보바(36px) — 🎯 선택 대상 : 이름.
  // 선택 대상은 보조 정보 — 카드가 아니라 '현재 맵' 줄과 같은 레벨의 한 줄 텍스트.
  // 선택 객체 패널 — 게임 오브젝트를 고르면 Type/Name/ID/Map/Position을 실시간으로 보여준다.
  // 좌표는 GameEntity.tileX/tileY(타일 단위). 선택이 없으면 흐린 빈 상태 안내.
  const summaryCard = el('div', 'h-[28px] px-1 flex items-center gap-1.5 opacity-80')
  summaryCard.append(editorIcon('target', 13))
  const targetValue = el('span', 'text-[11px] text-[#e2bd8c] truncate')
  summaryCard.append(el('span', 'text-[11px] text-[#b59458]', '선택 대상 :'), targetValue)
  const updateSummary = (): void => {
    targetValue.textContent = selectedEntity?.name ?? '없음'
  }
  // 게임과의 동기화 상태(현재 맵 이름)를 보여주는 줄. 연결 전엔 대기 메시지.
  const treeSyncLine = el('div', 'text-[12px] font-medium text-[#b6bac1]', '게임과 연결 대기 중…')
  // 짧은 안내문 — 눈에 띄지 않는 흐린 브라운, 카드 그리드를 방해하지 않는 한 줄.
  // 에셋 검색 — 이름으로 실시간 필터링. NPC가 수십 개로 늘어나도 탐색기처럼 쓸 수 있다.
  // 검색이 패널의 첫 행동으로 보이게 — 40px 높이 + 살짝 밝은 배경 + focus 금색.
  const assetSearch = el('input', 'h-[40px] w-full rounded-[10px] border border-[#b6bac1]/28 bg-[#0d0d0d] px-3 text-[12px] text-[#d4d4d4] outline-none transition placeholder:text-[#919191] focus:border-[#b6bac1] focus:shadow-[0_0_8px_rgba(255,255,255,0.2)]') as HTMLInputElement
  assetSearch.type = 'search'
  assetSearch.placeholder = 'NPC · 건물 · 오브젝트 검색'
  assetSearch.addEventListener('input', () => {
    assetQuery = assetSearch.value
    renderTree()
    render()
  })
  // 순서: 제목 → 검색 → 현재 맵 → 선택 대상 — 정보는 두 줄만, 설명문은 없앤다.
  treeHeader.append(treeHeaderTop, assetSearch, treeSyncLine, summaryCard)
  const treeList = el('div', 'flex-1 overflow-auto p-3 flex flex-col gap-3')
  tree.classList.add('legacy-asset-tree')
  tree.dataset.sidebar = 'legacy-list'
  tree.append(treeHeader, treeList)

  // ---------- center: 라이브 게임(위) + 프롬프트 컴포저(아래) ----------
  // min-w-0: grid 자식의 기본 min-width:auto 때문에 내용이 열을 밀어내는 것 방지.
  const center = el('main', '[grid-area:main] min-w-0 min-h-0 flex flex-col gap-2')
  // 선택 대상 배지 — 입력창 위 오른쪽의 작은 상태 캡슐(render()가 내용을 채운다).
  const targetLine = el('div', 'flex items-center')
  const analysisPanel = el('div', 'rounded-lg border border-[#b6bac1]/28 bg-[#141416] p-3 flex flex-col gap-1.5 text-[#d4d4d4]')
  analysisPanel.hidden = true
  const supportNote = el('div', 'rounded-lg border border-[#b6bac1]/22 bg-[#34363a] px-3 py-2 text-xs text-[#b6bac1]')

  // 모델은 프로젝트가 연결한 로컬 서버의 한 모델로 고정한다.
  const modelField = el('div', 'flex flex-col gap-2.5')
  modelField.append(el('span', SETTINGS_LABEL, '고정 LLM'), modelBadge)

  // 필요하면 손잡이로 더 늘릴 수 있다(resize-y). placeholder는 예시 목록 형태.
  const promptField = el('label', 'flex flex-col gap-1')
  // 화면에서 가장 강한 입력 요소 — 입력 내용에 맞춰 높이가 자동으로 늘어난다(최대 150px). 그 위는 스크롤.
  const promptInput = el('textarea', `${FIELD_INPUT} min-h-[72px] max-h-[150px] overflow-y-auto resize-none leading-[1.6]`) as HTMLTextAreaElement
  promptInput.placeholder =
    '예) 마법사가 플레이어에게 위험을 경고하는 대사를 추가해줘\n예) 숨겨진 퀘스트를 만들어줘\n예) 나무를 가을 분위기로 바꿔줘'
  // 자동 높이 조절 — 빈 화면 불안을 줄이고 긴 요청도 한눈에. scrollHeight를 150px로 클램프.
  const autoSizePrompt = (): void => {
    promptInput.style.height = 'auto'
    promptInput.style.height = `${Math.min(promptInput.scrollHeight, 150)}px`
  }
  // 글자수 카운터 — 우측 정렬, 입력에 따라 갱신(작성 중임을 시각적으로 알려준다).
  const promptCounter = el('span', 'self-end text-[10px] leading-none tabular-nums text-[#777777]', '0자')
  promptField.append(promptInput, promptCounter)

  // 입력창 자동 채움 — 빈 화면보다 예시를 고쳐 쓰는 게 훨씬 쉽다.
  // (입력 이벤트를 쏴서 생성 버튼 활성화·진행 표시도 함께 갱신.)
  const fillPrompt = (text: string): void => {
    promptInput.value = text
    promptInput.dispatchEvent(new Event('input'))
    promptInput.focus()
  }

  // 작업 유형 — 아이콘 카드. 클릭하면 입력창이 채워지고 카드에 '✓ 선택됨' 상태가 남아
  // "지금 내가 뭘 만드는 중인지"가 보인다(표시 전용 상태).
  // primary: 대표 액션(핵심 기능) 표시 — 카드가 한 단계 강조된다.
  // Quick Actions — 자주 쓰는 6개 작업. 아이콘으로 먼저 구분되고, 클릭하면 입력창이 채워진다.
  // quest:true인 카드만 2단계(후보→선택→검증) 모드로 들어간다(라벨 문자열 비교 대신 플래그).
  const SUGGESTIONS: Array<{
    label: string
    desc: string
    text: string
    primary: boolean
    icon: EditorIconName
    quest?: boolean
  }> = [
    // 시나리오·스타일 계열만 남긴다. 퀘스트·NPC 추가·대사·건물·이벤트 수정은 별도 유형 없이
    // 자유 입력으로 충분하다 — 요청을 쓰면 라우팅(decideEditorAction)이 알맞은 흐름
    // (퀘스트 후보 2단계·NPC 라이브 스폰 등)을 자동으로 고른다.
    { label: '시나리오', desc: '분기 이벤트 생성', text: '마법사가 수상한 내기를 제안하는 시나리오를 만들어줘. 참가 여부를 선택할 수 있고, 이기면 보상을 주고, 다시 말 걸면 다른 대사가 나와야 해', primary: true, icon: 'scroll' },
    { label: '스타일 변경', desc: '외형 수정', text: '이 나무를 가을 분위기의 나무로 바꿔줘', primary: false, icon: 'crystal' }
  ]
  let activeSuggestion: string | undefined
  // 빠른 템플릿 선택 — 기본은 완전 중립(회색 테두리, 금색 없음). 약한 hover, 금색은 active(클릭)만.
  const QUICK_CARD =
    'h-[52px] flex flex-col items-start justify-center gap-1 rounded-lg px-3 text-left bg-[#1a1a1c] border border-[#3c3c3c] transition duration-[180ms] ease-out hover:bg-[#242427] hover:border-[#4a4a4a]'
  // 대표 액션(퀘스트·시나리오)도 기본은 다른 카드와 똑같은 중립으로 둔다(초기 진입 시
  // 선택된 것처럼 미리 강조되면 안 됨). 강조는 active(클릭)에만.
  const QUICK_CARD_PRIMARY = QUICK_CARD
  // 선택된 도구 — Figma/Notion/Linear 식 차분한 강조: 소프트 그레이 필 + 한 단계 밝은 얇은 테두리
  // + 아주 옅은 inset 하이라이트. 외곽 글로우·이동 애니메이션은 쓰지 않는다(게이밍/네온 금지).
  const QUICK_CARD_ACTIVE =
    'h-[52px] flex flex-col items-start justify-center gap-1 rounded-lg px-3 text-left bg-[#52555b] border border-[#9296a0] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-[180ms] ease-out hover:bg-[#5a5d63]'
  const quickStart = el('div', 'flex flex-wrap items-center gap-1.5')
  quickStart.append(el('span', 'text-[10px] leading-none text-[#777777]', '작업 유형'))
  const suggestionRow = el('div', 'flex flex-wrap gap-1.5')
  const quickCards = SUGGESTIONS.map((suggestion) => {
    const card = el('button', suggestion.primary ? QUICK_CARD_PRIMARY : QUICK_CARD) as HTMLButtonElement
    card.type = 'button'
    const badge = el('span', 'text-[10px] leading-none text-[#e0e0e0]', '✓')
    badge.hidden = true
    const titleLine = el('span', 'flex items-center gap-1.5')
    // 라벨만 — 아이콘 없이 텍스트로. 기본은 중립 회색, 선택 시 대비를 한 단계 올린다(updateQuickCards).
    const labelEl = el('span', 'text-[14px] leading-none text-[#d4d4d4]', suggestion.label)
    titleLine.append(labelEl, badge)
    card.append(
      titleLine,
      el('span', 'text-[11px] leading-none text-[#777777] opacity-65', suggestion.desc)
    )
    suggestionRow.append(card)
    return { label: suggestion.label, text: suggestion.text, primary: suggestion.primary, quest: suggestion.quest === true, card, badge, labelEl }
  })
  const updateQuickCards = (): void => {
    for (const { label, primary, card, badge, labelEl } of quickCards) {
      const active = label === activeSuggestion
      card.className = active ? QUICK_CARD_ACTIVE : primary ? QUICK_CARD_PRIMARY : QUICK_CARD
      // 선택된 도구만 텍스트 대비를 올린다 — 폰트·크기는 그대로, 색만 한 단계 밝게.
      labelEl.className = active
        ? 'text-[14px] leading-none text-[#f0f1f3]'
        : 'text-[14px] leading-none text-[#d4d4d4]'
      badge.hidden = !active
    }
  }
  for (const quickCard of quickCards) {
    quickCard.card.addEventListener('click', () => {
      activeSuggestion = quickCard.label
      // 작업 유형 선택은 예문 채우기 + 표시 전용. 특수 모드(퀘스트 후보·NPC 스폰)는
      // 만들기 시점의 라우팅(decideEditorAction)이 켠다.
      candidateMode = quickCard.quest
      npcMode = false
      candidates = []
      selectedCandidateIndex = undefined
      editingCandidateIndex = undefined
      currentDryRun = undefined
      if (!candidateMode && activeBoardTab === 'candidates') {
        activeBoardTab = undefined
      }
      fillPrompt(quickCard.text)
      updateQuickCards()
      render()
    })
  }
  const styleTransferButton = el('button', QUICK_CARD) as HTMLButtonElement
  styleTransferButton.type = 'button'
  styleTransferButton.title = '오브젝트별 FLUX 스타일 변환 페이지를 엽니다'
  styleTransferButton.append(
    el('span', 'text-[14px] leading-none text-[#d4d4d4]', '스타일 변환'),
    el('span', 'text-[11px] leading-none text-[#777777] opacity-65', '스타일 변환')
  )
  styleTransferButton.addEventListener('click', () => {
    window.location.assign(styleWorkspaceUrl())
  })
  suggestionRow.append(styleTransferButton)
  const stylePipelineButton = el('button', QUICK_CARD) as HTMLButtonElement
  stylePipelineButton.type = 'button'
  stylePipelineButton.title = '시나리오 → StyleSpec → 앵커 승인 → 일괄 변환+QA 파이프라인'
  stylePipelineButton.append(
    el('span', 'text-[14px] leading-none text-[#d4d4d4]', '스타일 파이프라인'),
    el('span', 'text-[11px] leading-none text-[#777777] opacity-65', '시나리오 일괄 변환')
  )
  stylePipelineButton.addEventListener('click', () => {
    stylePipelinePanel.openButton.click()
  })
  suggestionRow.append(stylePipelineButton)
  const scenarioDemoButton = el('button', QUICK_CARD) as HTMLButtonElement
  scenarioDemoButton.type = 'button'
  scenarioDemoButton.title = 'LLM 없이 검증된 시나리오를 바로 불러와 게임에 적용합니다'
  scenarioDemoButton.append(
    el('span', 'text-[14px] leading-none text-[#d4d4d4]', '시나리오 데모'),
    el('span', 'text-[11px] leading-none text-[#777777] opacity-65', '고정 예제 실행')
  )
  suggestionRow.append(scenarioDemoButton)
  quickStart.append(suggestionRow)

  // 예시 요청 — 한 줄 칩. 설명은 툴팁(title)으로, 클릭하면 그대로 입력창에 들어간다.
  const RECOMMENDED = [
    { title: '마법사의 경고', desc: '플레이어에게 위험 경고', text: '마법사가 플레이어에게 위험을 경고하는 대사를 추가해줘' },
    { title: '숨겨진 퀘스트', desc: '새로운 보상 퀘스트', text: '마을 주민이 부탁하는 숨겨진 퀘스트를 만들어줘' },
    { title: '계절 변화', desc: '가을 분위기로 변경', text: '이 나무를 가을 분위기의 나무로 바꿔줘' }
  ]
  // 도움말처럼 보이게: 더 어두운 배경 + 흐린 테두리 + 좌측 배지 — 입력창과 즉시 구분된다.
  const recommendBoard = el('div', 'flex flex-wrap items-center gap-1.5 rounded-lg bg-[#050506] border border-white/[0.06] px-2 py-1.5')
  recommendBoard.append(
    el('span', 'rounded px-2 py-0.5 text-[11px] leading-none text-[#b6bac1] bg-[#b6bac1]/10 border border-[#b6bac1]/25', '예시 요청')
  )
  for (const item of RECOMMENDED) {
    const chip = el('button', 'h-[26px] flex items-center rounded-full px-2.5 text-[11px] leading-none text-[#b6bac1]/75 bg-white/[0.02] border border-[#b6bac1]/18 transition hover:border-[#b6bac1] hover:bg-[#242427] hover:text-[#f2dfb3]', item.title) as HTMLButtonElement
    chip.type = 'button'
    chip.title = item.desc
    chip.addEventListener('click', () => {
      fillPrompt(item.text)
    })
    recommendBoard.append(chip)
  }

  const actions = el('div', 'flex flex-wrap items-end gap-2')
  // 메인 CTA — 적용/복사/내보내기보다 살짝만 크게(42px). 라벨 span만 갱신한다.
  const generateButton = el('button', PRIMARY_BUTTON) as HTMLButtonElement
  const generateLabel = el('span', 'text-[18px] font-bold leading-none', '만들기')
  generateButton.append(generateLabel)
  generateButton.type = 'button'
  const applyButton = el('button', APPLY_BUTTON, '적용') as HTMLButtonElement
  applyButton.type = 'button'
  const copyButton = el('button', GHOST_BUTTON, '복사') as HTMLButtonElement
  copyButton.type = 'button'
  const exportButton = el('button', GHOST_BUTTON, '내보내기') as HTMLButtonElement
  exportButton.type = 'button'
  // 큰 액션 2개(왼쪽) + 보조 2개(오른쪽) + 단축키 힌트.
  // 좌측 = 주요 작업(생성+적용, 설명은 버튼 아래) / 우측 = 보조 작업(복사·내보내기·안내).
  const primaryRow = el('div', 'flex flex-wrap items-center gap-2')
  primaryRow.append(generateButton, applyButton)
  const primaryGroup = el('div', 'flex flex-col gap-1')
  primaryGroup.append(
    primaryRow,
    el('span', 'text-[11px] leading-[1.3] text-[#777777] opacity-70', '요청한 내용으로 퀘스트·시나리오·대사 등을 생성합니다.')
  )
  const utilityGroup = el('div', 'flex flex-wrap items-center gap-1.5')
  utilityGroup.append(
    copyButton,
    exportButton,
    // 결과 보드로 이어지는 시선 안내 + 단축키를 한 줄에 병합.
    el('span', 'hidden sm:inline text-[10px] text-[#777777]', '생성 후 → 결과 보드에서 확인 · ⌘/Ctrl+Enter')
  )
  actions.append(primaryGroup, el('div', 'flex-1'), utilityGroup)

  const status = el('div', 'text-sm text-[#9d9d9d] min-h-[1.25rem]')
  const validationLine = el('div', 'text-xs')
  validationLine.hidden = true

  // ---------- 결과 보드: 위 목록(4줄) + 아래 단일 상세 창 (퀘스트 로그식 마스터-디테일) ----------
  type BoardTab = 'lua' | 'files' | 'verify' | 'apply' | 'candidates'
  // 표시 전용 상태 — 어떤 항목의 상세를 보여줄지. 처음엔 미선택("항목을 선택하세요").
  let activeBoardTab: BoardTab | undefined
  // 상태 카드형 목록(52px): 제목 + 짧은 상태 텍스트 + 우측 화살표. hover에서 화살표도 같이 강조.
  const BOARD_ROW =
    'group h-[52px] shrink-0 flex items-center gap-2 rounded-xl border border-[#3c3c3c] bg-[#1a1a1c] px-3 text-left transition duration-150 hover:bg-[#242427] hover:border-[#5a5d63]'
  const BOARD_ROW_ACTIVE =
    'group h-[52px] shrink-0 flex items-center gap-2 rounded-xl border border-[#9296a0] bg-[#4a4d52] px-3 text-left transition duration-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
  // 상세 창의 항목별 내용 — 항상 하나의 상세 창 안에서 토글된다(새 창 생성 금지).
  const makeDetailView = (title: string): { view: HTMLElement; body: HTMLElement } => {
    const view = el('div', 'flex flex-col gap-2')
    view.hidden = true
    view.append(el('div', 'text-[15px] text-[#d4d7dc] [text-shadow:0_1px_0_rgba(0,0,0,0.35)] pb-1.5 border-b border-[#b6bac1]/20', title))
    const body = el('div', 'flex flex-col gap-1')
    view.append(body)
    return { view, body }
  }
  const luaView = makeDetailView('생성된 JSON 코드')
  const luaStatus = el('div', 'text-[12px] text-[#9d9d9d]', '생성 후 표시됩니다')
  const result = el('pre', 'm-0 max-h-[36vh] overflow-auto text-[12px] leading-relaxed text-[#d4d4d4] whitespace-pre-wrap break-words')
  result.hidden = true
  // 퀘스트 달성 조건(목표) 요약 — 타깃 에셋을 파란 링크로 보여주고, 누르면 스프라이트 미리보기를 띄운다.
  const questObjectivesBox = el('div', 'flex flex-col gap-1')
  questObjectivesBox.hidden = true
  luaView.body.append(luaStatus, questObjectivesBox, result)
  const filesView = makeDetailView('변경 예정 파일')
  const filesStatus = el('div', 'text-[12px] text-[#9d9d9d]', '변경 파일 없음')
  filesView.body.append(filesStatus)
  const verifyView = makeDetailView('검증 결과')
  // 무결성 검증(드라이런) 단계별 결과 — verify 상세에 validationLine과 함께 표시(render가 채움).
  const dryRunBox = el('div', 'flex flex-col gap-1 pt-1')
  dryRunBox.hidden = true
  // 퀘스트 1단계 후보 카드 영역(render의 renderCandidates가 채움).
  const candidatesView = makeDetailView('퀘스트 후보 (하나를 선택하세요)')
  const applyView = makeDetailView('적용 상태')
  const applyStatus = el('div', 'text-[12px] text-[#9d9d9d]', '대기 중')
  applyView.body.append(applyStatus)

  // 퀘스트 목표 에셋 미리보기 팝업(스프라이트 이미지). 파란 링크 클릭 시 띄운다. 배경 클릭으로 닫힘.
  const assetPopup = el('div', 'fixed inset-0 z-[60] hidden items-center justify-center bg-black/60')
  const assetCard = el('div', 'flex flex-col items-center gap-2 rounded-2xl border border-[#d9a85c]/40 bg-[#1c1c1c] p-4 min-w-[160px]')
  assetCard.addEventListener('click', (event) => event.stopPropagation())
  assetPopup.append(assetCard)
  assetPopup.addEventListener('click', () => {
    assetPopup.classList.add('hidden')
    assetPopup.classList.remove('flex')
  })
  document.body.append(assetPopup)

  const showAssetPopup = (entity: GameEntity): void => {
    const groupKind = groupKindOf(entity.kind)
    const url = resolveLegendEntitySpriteUrl(entity.kind, entity.spriteKey)
    const imgWrap = el('div', 'flex items-center justify-center w-24 h-24 bg-[#111] rounded-lg')
    const fallback = (): void => {
      imgWrap.replaceChildren(editorIcon(KIND_ICON[groupKind] ?? 'prop', 48))
    }
    if (url) {
      const img = el('img', 'max-w-[84px] max-h-[84px] [image-rendering:pixelated]') as HTMLImageElement
      img.src = url
      img.alt = entity.name
      img.addEventListener('error', fallback) // 번들에 없는 스프라이트면 종류 아이콘으로 폴백
      imgWrap.append(img)
    } else {
      fallback()
    }
    assetCard.replaceChildren(
      imgWrap,
      el('div', 'text-[13px] text-[#e8d5a5] text-center', entity.name),
      el('div', 'text-[11px] text-[#9d9d9d]', `${KIND_LABEL[groupKind] ?? entity.kind} · ${entity.mapId}`)
    )
    assetPopup.classList.remove('hidden')
    assetPopup.classList.add('flex')
  }

  // 목표 타입 → 한국어 동사 라벨.
  const OBJECTIVE_LABEL: Record<string, string> = {
    defeat: '처치',
    talk: '대화',
    acquire: '획득',
    reach: '도달'
  }

  // 현재 결과가 legend 퀘스트면, 달성 조건(목표)을 타깃 에셋(파란 링크)과 함께 보여준다.
  const renderQuestObjectives = (): void => {
    questObjectivesBox.replaceChildren()
    const payload = currentResult?.bridgePayload
    if (!payload || payload.kind !== 'quest' || payload.quest.objectives.length === 0) {
      questObjectivesBox.hidden = true
      return
    }
    const allEntities = game.maps.flatMap((map) => map.entities)
    questObjectivesBox.hidden = false
    questObjectivesBox.append(
      el('div', 'text-[12px] text-[#9d9d9d]', '달성 조건 — 파란 글씨를 누르면 에셋 미리보기')
    )
    for (const objective of payload.quest.objectives) {
      const row = el('div', 'flex items-center gap-1.5 text-[12px] text-[#d4d4d4]')
      row.append(el('span', 'text-[#9d8a5a]', OBJECTIVE_LABEL[objective.type] ?? objective.type))
      if (objective.type === 'reach') {
        row.append(el('span', '', objective.target.mapId ?? ''))
      } else {
        const entity = allEntities.find((e) => e.id === objective.target.entityId)
        const targetName = entity?.name ?? objective.target.entityId ?? '?'
        if (entity) {
          const link = el(
            'button',
            'text-[#6cb6ff] underline decoration-dotted underline-offset-2 hover:text-[#9fd0ff]',
            targetName
          ) as HTMLButtonElement
          link.type = 'button'
          link.addEventListener('click', () => showAssetPopup(entity))
          row.append(link)
        } else {
          // 카탈로그에서 못 찾은 타깃(이미 사라졌거나 외부 엔티티)은 링크 없이 표시.
          row.append(el('span', 'text-[#6cb6ff]/50', targetName))
        }
      }
      if (objective.required > 1) {
        row.append(el('span', 'text-[#777777]', `×${objective.required}`))
      }
      questObjectivesBox.append(row)
    }
  }

  // 위쪽 목록 — 클릭하면 아래 상세 창의 내용만 바뀐다.
  const boardList = el('div', 'flex flex-col gap-1.5')
  const BOARD_TABS: Array<{ id: BoardTab; label: string }> = [
    { id: 'lua', label: '생성된 JSON 코드' },
    { id: 'files', label: '변경 예정 파일' },
    { id: 'verify', label: '검증 결과' },
    { id: 'apply', label: '적용 상태' }
  ]
  // 아래 상세 창 — 깊은 차콜 + 중립 테두리의 둥근 카드 하나.
  const boardDetail = el('div', 'flex-1 min-h-[240px] rounded-2xl border border-[#b6bac1]/28 bg-[#0d0d0d] p-3.5 flex flex-col overflow-auto')
  // 빈 상태엔 검은 공간 대신 '오늘 작업' 요약을 보여준다(값은 render()가 갱신).
  // '오늘 작업' 통계 카드 — 결과 카드 4장 바로 아래에 붙는 독립 카드(라벨/숫자 분리, 숫자 강조).
  const todayCard = el('div', 'shrink-0 w-full rounded-lg border border-[#b6bac1]/22 bg-[#1a1a1c] px-3 py-2.5 flex flex-col gap-1.5 text-left')
  const todayStats = el('div', 'flex flex-col gap-1.5')
  const statGen = el('span', 'text-[12px] font-bold leading-none text-[#d4d7dc]', '0')
  const statPass = el('span', 'text-[12px] font-bold leading-none text-[#d4d7dc]', '0')
  const statApply = el('span', 'text-[12px] font-bold leading-none text-[#d4d7dc]', '0')
  const statGenRow = el('div', 'flex items-center justify-between')
  statGenRow.append(el('span', 'text-[11px] font-medium leading-none text-[#9d9d9d]', '생성 요청'), statGen)
  const statPassRow = el('div', 'flex items-center justify-between')
  statPassRow.append(el('span', 'text-[11px] font-medium leading-none text-[#9d9d9d]', '검증 통과'), statPass)
  const statApplyRow = el('div', 'flex items-center justify-between')
  statApplyRow.append(el('span', 'text-[11px] font-medium leading-none text-[#9d9d9d]', '게임 적용'), statApply)
  todayStats.append(statGenRow, statPassRow, statApplyRow)
  todayCard.append(
    el('div', 'text-[12px] leading-none text-[#d4d7dc]', '오늘 작업'),
    todayStats
  )
  // '최근 작업' 카드 — 오늘 작업과 같은 톤의 작은 기록 카드(작업명 ── 시간 한 줄). 빈 상태에서도 낮게.
  const recentCard = el('div', 'shrink-0 w-full min-h-[84px] rounded-lg border border-[#b6bac1]/22 bg-[#1a1a1c] px-3 py-2.5 flex flex-col gap-1.5 text-left')
  // 스크롤 가능한 활동 이력 — 길어져도 카드가 늘어나지 않고 자체 스크롤(개발 툴 콘솔 느낌).
  const recentList = el('div', 'flex flex-col gap-1.5 max-h-[148px] overflow-y-auto pr-0.5')
  recentCard.append(
    el('div', 'text-[12px] leading-none text-[#d4d7dc]', 'Recent Activity'),
    recentList
  )
  // 빈 상태 안내 — 설명 패널처럼 보이게 텍스트 블록을 중앙보다 살짝 위에 둔다.
  const detailPlaceholder = el('div', 'flex-1 flex flex-col items-center justify-center gap-1.5 pt-2 pb-8 text-center leading-relaxed')
  const detailPlaceholderIcon = el('div', 'opacity-25 mb-1')
  detailPlaceholderIcon.append(editorIcon('crystal', 28))
  // 빈 화면을 안내 워크플로우로 — "다음에 뭘 하면 되는지" 5단계를 번호로 보여준다(프로 에디터 톤).
  const PLACEHOLDER_STEPS = [
    '왼쪽 패널에서 에셋 선택',
    '편집 액션 선택',
    '요청 작성',
    '콘텐츠 생성',
    '검토 후 적용'
  ]
  const workflowGuide = el('div', 'flex flex-col items-start gap-1.5 mt-1')
  PLACEHOLDER_STEPS.forEach((label, index) => {
    const row = el('div', 'flex items-center gap-2')
    row.append(
      el('span', 'shrink-0 w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#1a1a1c] border border-[#3c3c3c] text-[10px] leading-none text-[#9d9d9d]', String(index + 1)),
      el('span', 'text-[11px] leading-none text-[#9d9d9d]', label)
    )
    workflowGuide.append(row)
  })
  detailPlaceholder.append(
    detailPlaceholderIcon,
    el('div', 'text-[13px] font-semibold text-[#d4d7dc] mb-1', 'No Generation Results'),
    workflowGuide
  )
  boardDetail.append(detailPlaceholder, candidatesView.view, luaView.view, filesView.view, verifyView.view, applyView.view)
  const boardRows = BOARD_TABS.map((tab) => {
    const row = el('button', BOARD_ROW) as HTMLButtonElement
    // 제목(좌) + 상태 캡슐 배지(우, render()가 채움) + ▸ 화살표(클릭하면 아래 상세가 열린다는 신호).
    const rowStatus = el('span', 'h-[20px] flex items-center rounded-full px-2 text-[10px] font-semibold leading-none whitespace-nowrap bg-[#242427] text-[#9d9d9d]', '대기')
    row.append(
      el('span', 'truncate text-[13px] leading-none text-[#d4d7dc]', tab.label),
      el('span', 'ml-auto flex items-center gap-1.5'),
      rowStatus,
      el('span', 'text-[11px] text-[#777777] transition group-hover:text-[#b6bac1]', '▸')
    )
    row.type = 'button'
    boardList.append(row)
    return { id: tab.id, row, status: rowStatus }
  })
  const updateBoard = (): void => {
    for (const { id, row, status } of boardRows) {
      const active = id === activeBoardTab
      row.className = active ? BOARD_ROW_ACTIVE : BOARD_ROW
      // 선택된 행은 상태 배지도 금색 링으로 함께 강조(표시 전용).
      status.classList.toggle('ring-1', active)
      status.classList.toggle('ring-[#b6bac1]/60', active)
    }
    detailPlaceholder.hidden = activeBoardTab !== undefined
    candidatesView.view.hidden = activeBoardTab !== 'candidates'
    luaView.view.hidden = activeBoardTab !== 'lua'
    filesView.view.hidden = activeBoardTab !== 'files'
    verifyView.view.hidden = activeBoardTab !== 'verify'
    applyView.view.hidden = activeBoardTab !== 'apply'
  }
  for (const { id, row } of boardRows) {
    row.addEventListener('click', () => {
      activeBoardTab = id
      updateBoard()
    })
  }

  // ---------- Evaluator (사람 이진 평가) ----------
  const evaluationWrap = el('div', CARD)
  evaluationWrap.hidden = true
  // flex-wrap: 좁은 사이드바에선 지표 줄이 라벨 옆에 끼어 두 줄 컬럼으로 뭉개지는 대신 제 줄로 내려간다.
  const evaluationTop = el('div', 'flex flex-wrap items-center justify-between gap-x-2 gap-y-1')
  evaluationTop.append(
    el('span', LABEL, 'Evaluator · 사람 이진 평가')
  )
  const acceptanceStat = el('span', 'text-xs text-[#9d9d9d]')
  evaluationTop.append(acceptanceStat)
  const evaluationButtons = el('div', 'flex flex-wrap items-center gap-2')
  const acceptButton = el('button', GHOST_BUTTON, '수용') as HTMLButtonElement
  acceptButton.type = 'button'
  const rejectButton = el('button', GHOST_BUTTON, '거부') as HTMLButtonElement
  rejectButton.type = 'button'
  const evaluationVerdict = el('span', 'text-xs flex-1')
  const resetEvaluationsButton = el('button', 'text-[11px] text-[#9d9d9d] transition hover:text-[#d4d4d4]', '누적 기록 초기화') as HTMLButtonElement
  resetEvaluationsButton.type = 'button'
  evaluationButtons.append(acceptButton, rejectButton, evaluationVerdict, resetEvaluationsButton)
  evaluationWrap.append(evaluationTop, evaluationButtons)

  const historyWrap = el('div', 'flex flex-col gap-1.5')
  historyWrap.hidden = true
  const historyHeader = el('div', 'flex items-center justify-between')
  historyHeader.append(
    el('span', LABEL, '생성 히스토리')
  )
  const clearHistoryButton = el('button', 'text-[11px] text-[#9d9d9d] transition hover:text-[#d4d4d4]', '비우기') as HTMLButtonElement
  clearHistoryButton.type = 'button'
  historyHeader.append(clearHistoryButton)
  const historyList = el('div', 'flex flex-col gap-1')
  historyWrap.append(historyHeader, historyList)

  // ---------- center 상단: live game preview ----------
  // min-h 바닥: 어떤 창 크기에서도 게임이 HUD만 보이는 납작한 띠로 짓눌리지 않게 한다.
  // 게임 화면이 이 화면의 주인공 — 프레임(위 탭 바·아래 단계 바)은 얇고 어둡게 유지한다.
  const preview = el('section', `flex-1 min-h-[200px] md:min-h-[300px] min-w-0 flex flex-col ${PANEL} overflow-hidden`)
  // 게임 화면 위에 붙은 작은 RPG 조작 패널 — 짧은 제목 + 나무 탭 + 아이콘 버튼.
  const previewBar = el('div', 'settings-game-font select-none h-9 shrink-0 flex items-center justify-between gap-2 px-3 border-b border-[#b6bac1]/22 bg-[#141416] min-w-0')
  previewBar.classList.add('editor-preview-toolbar')
  // 시선이 요청 패널로 먼저 가도록 게임 화면 헤더는 한 톤 차분하게.
  const previewTitle = el('span', 'flex items-center gap-2 truncate min-w-0')
  previewTitle.append(
    editorIcon('map', 14),
    el('span', 'truncate text-[13px] font-medium leading-none text-[#9d9d9d]', '게임 화면'),
    el('span', 'hidden lg:inline text-[10px] leading-none text-[#7a6a52]', '현재 실행 중')
  )
  // 맵 요약(현재 맵 + 개체 수) — 텍스트 나열 대신 정보 칩(pill)로 분리해 한눈에 읽히게.
  // 줄바꿈 금지: 공간이 모자라면 overflow-hidden으로 끝 칩부터 잘린다(헤더 높이 고정).
  const STAT_CHIP =
    'h-[22px] shrink-0 inline-flex items-center gap-1 px-2 rounded-full border border-[#b6bac1]/35 bg-[#1a1a1c]/65 text-[11px] font-semibold leading-none text-[#e8d3a3] whitespace-nowrap'
  const STAT_CHIP_MAP =
    'h-[22px] shrink-0 inline-flex items-center px-2.5 rounded-full border border-[#b6bac1]/50 bg-[#b6bac1]/[0.18] text-[11px] font-semibold leading-none text-[#d4d7dc] whitespace-nowrap'
  // translate-y-[2px]: 헤더 수직 중앙에 더 가깝게 정렬.
  const previewStats = el('span', 'hidden md:flex flex-1 items-center justify-center gap-1.5 leading-none min-w-0 overflow-hidden translate-y-[2px]')
  // 표시 전용: 현재 맵의 NPC/건물/포털/기타 개수를 한 줄로 요약한다(render()가 갱신).
  // 맵별 직전 카운트 — 같은 맵에서 값이 바뀐 칩만 펄스를 준다(맵 전환으로 인한 오인 방지).
  const prevCountsByMap: Record<string, { npc: number; building: number; portal: number; other: number }> = {}
  const updatePreviewStats = (): void => {
    const focusMap =
      currentMapId !== undefined
        ? game.maps.find((map) => map.id === currentMapId)
        : undefined
    const map = focusMap ?? game.maps[0]
    if (!map) {
      previewStats.replaceChildren()
      return
    }
    const counts = { npc: 0, building: 0, portal: 0, other: 0 }
    // 트리와 같은 기준 — TMX 정적 엔티티 + localStorage에 저장된 수기/생성 NPC를 함께 센다.
    for (const entity of map.entities.concat(placedNpcEntities(map.id))) {
      const kind = groupKindOf(entity.kind)
      if (kind === 'npc') {
        counts.npc += 1
      } else if (kind === 'building') {
        counts.building += 1
      } else if (kind === 'portal') {
        counts.portal += 1
      } else {
        counts.other += 1
      }
    }
    const prev = prevCountsByMap[map.id]
    // 라벨은 살짝 흐리게, 숫자는 굵은 은색으로 — 수치가 먼저 읽히게(표시 전용).
    // 같은 맵에서 값이 바뀌면 숫자에 count-bump 펄스를 줘 "방금 갱신됨"이 보인다.
    const statChip = (label: string, value: number, changed: boolean): HTMLElement => {
      const chip = el('span', STAT_CHIP)
      const numberClass = `font-bold text-[#d4d7dc]${changed ? ' count-bump' : ''}`
      chip.append(
        el('span', 'opacity-75', label),
        el('span', numberClass, String(value))
      )
      return chip
    }
    const mapChip = el('span', STAT_CHIP_MAP, map.name)
    mapChip.title = `현재 맵: ${map.name}`
    // 문자열 정보 칩(Selection/Mode) — 씬 상태바를 진짜 에디터 컨텍스트 바로 만든다.
    const infoChip = (label: string, value: string, accent = false): HTMLElement => {
      const chip = el('span', STAT_CHIP)
      chip.append(
        el('span', 'opacity-75', label),
        el('span', `font-bold ${accent ? 'text-[#f0f1f3]' : 'text-[#d4d7dc]'} truncate max-w-[120px]`, value)
      )
      return chip
    }
    // 현재 편집 모드 — 고른 작업 유형에서 파생. 없으면 '탐색'.
    const MODE_LABEL: Record<string, string> = {
      시나리오: '시나리오 작성',
      '스타일 변경': '스타일 편집'
    }
    const chips: HTMLElement[] = [
      mapChip,
      statChip('NPC', counts.npc, prev !== undefined && prev.npc !== counts.npc),
      statChip('건물', counts.building, prev !== undefined && prev.building !== counts.building),
      statChip('포털', counts.portal, prev !== undefined && prev.portal !== counts.portal),
      statChip('오브젝트', counts.other, prev !== undefined && prev.other !== counts.other),
      infoChip('Mode', activeSuggestion ? (MODE_LABEL[activeSuggestion] ?? activeSuggestion) : '탐색', true)
    ]
    if (selectedEntity) {
      chips.splice(5, 0, infoChip('선택', selectedEntity.name))
    }
    previewStats.replaceChildren(...chips)
    prevCountsByMap[map.id] = counts
  }
  previewBar.append(previewTitle, previewStats)
  const previewActions = el('div', 'flex items-center gap-1.5 shrink-0')
  // 맵 전환 — 프리뷰는 항상 my-sample-rpg를 실행하므로 그 게임의 씬(마을/사냥터/동굴)을 바꾼다.
  // 탭마다 게임풍 아이콘: 마을→집, 사냥터→검, 동굴→수정.
  const previewScenes: Array<{ id: string; label: string; icon: EditorIconName }> = [
    { id: 'town', label: '마을', icon: 'building' },
    { id: 'hunting-ground', label: '사냥터', icon: 'sword' },
    { id: 'cave', label: '동굴', icon: 'crystal' },
    { id: 'crystal-mine', label: '수정 광산', icon: 'orb' },
    { id: 'harvest-village', label: '딴따라마을', icon: 'tree' },
    { id: 'upstream-waterway', label: '수로 상류길', icon: 'map' }
  ]
  const mapSwitcher = el('div', 'flex items-center gap-1')
  // 새 창/새로고침은 아이콘 버튼으로 — 의미는 title(툴팁)로 유지한다.
  const popoutButton = el('button', 'w-[26px] h-[26px] flex items-center justify-center rounded-lg bg-[#1a1a1c] border border-[#3c3c3c] text-[13px] leading-none text-[#9d9d9d] transition hover:bg-[#242427] hover:text-[#d4d7dc]', '↗') as HTMLButtonElement
  popoutButton.type = 'button'
  popoutButton.title = '새 창에서 열기'
  const reloadButton = el('button', 'w-[26px] h-[26px] flex items-center justify-center rounded-lg bg-[#1a1a1c] border border-[#3c3c3c] text-[13px] leading-none text-[#9d9d9d] transition hover:bg-[#242427] hover:text-[#d4d7dc]', '↻') as HTMLButtonElement
  reloadButton.type = 'button'
  reloadButton.title = '게임 새로고침'
  previewActions.append(mapSwitcher, popoutButton, reloadButton)
  previewBar.append(previewActions)
  // 게임 스테이지 — 16:9 고정 대신 패널을 '덮는'(cover) 방식. iframe(게임 창)을 패널보다
  // 크게 키워 중앙 정렬하고 넘치는 가장자리는 overflow로 잘라낸다 → 레터박스(빈 검정) 없이
  // 타일맵이 패널을 가득 채운다. 미니맵 등 게임 오버레이는 게임 화면 위에 그대로 얹힌다.
  // 패딩 8px만 남겨 게임 주변 프레임 느낌을 준다.
  // 게임이 패널 안을 꽉 채우게 — 프레임은 패널의 둥근 테두리만으로 충분하다.
  // items-end: 게임 창을 바닥 기준으로 정렬해, 넘치는 부분이 위쪽(맵의 빈 어두운 띠)부터 잘리게 한다.
  // ---------- 게임에 맞춰 프리뷰 iframe 소스 결정 ----------
  // love.js 웹빌드가 있는 게임(legend-of-lua)은 그 빌드를, 그 외(my-sample-rpg)는 기본 게임 URL을
  // iframe에 띄운다. 이전에 설정에서 저장한 웹빌드 URL(localStorage)이 있으면 그것을 우선한다.
  const WEB_BUILD_URL_STORAGE_KEY = 'my-sample-rpg:web-build-url'
  const previewSrcForGame = (): string => {
    // 자체 love.js 웹빌드가 있는 게임(legend-of-lua)만 웹빌드 URL을 띄운다. 샘플(my-sample-rpg)처럼
    // 웹빌드가 없는 게임은 저장된 web-build-url(과거 세션의 잔여 값일 수 있음)을 무시하고 기본 게임
    // URL을 쓴다 — 안 그러면 stored 값이 샘플 프리뷰까지 덮어써 legend-of-lua가 뜬다.
    const adapterWebBuild = (game.adapter.defaultWebBuildUrl ?? '').trim()
    if (adapterWebBuild.length === 0) {
      return gamePreviewUrl
    }
    const stored = (readLocalStorage(WEB_BUILD_URL_STORAGE_KEY) ?? '').trim()
    return stored.length > 0 ? stored : adapterWebBuild
  }
  const previewStage = el('div', 'relative flex-1 min-h-0 flex items-end justify-center overflow-hidden bg-[#050506]')
  const iframe = el('iframe', 'shrink-0 border-0 bg-black') as HTMLIFrameElement
  iframe.src = previewSrcForGame()
  iframe.title = '게임 프리뷰'
  previewStage.append(iframe)
  // love.js 빌드는 wasm·게임 데이터를 받느라 첫 로드에 시간이 걸린다 — 빈 화면 대신 로딩 안내를
  // 띄우고, iframe load 이벤트에서 지운다.
  const previewLoading = el(
    'div',
    'absolute inset-0 z-10 flex items-center justify-center text-[13px] text-[#d4d7dc] bg-[#050506]/85 pointer-events-none',
    '게임 로딩 중…'
  )
  previewLoading.style.display = 'none'
  previewStage.append(previewLoading)
  // 선택 네임플레이트 — 게임 화면 위에 "지금 무엇을 편집 중인지"를 항상 띄운다(게임 내부를 건드리지 않는
  // 안전한 방식). 게임 안 엔티티 자체에 아웃라인을 그리려면 게임 렌더링/메시지 프로토콜 변경이 필요하다.
  const selectionNameplate = el(
    'div',
    'absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full px-3 py-1 bg-[#0d0d0d]/85 border border-[#6b6f76] text-[11px] leading-none text-[#e6e6e6] pointer-events-none transition-opacity duration-150'
  )
  const selectionNameplateLabel = el('span', 'truncate max-w-[220px]')
  selectionNameplate.append(
    el('span', 'shrink-0 w-1.5 h-1.5 rounded-full bg-[#8fc96a]'),
    el('span', 'shrink-0 text-[#9d9d9d]', 'Editing'),
    selectionNameplateLabel
  )
  selectionNameplate.style.display = 'none'
  previewStage.append(selectionNameplate)
  // 좌표 readout — 씬 에디터처럼 화면 좌하단에 선택 객체의 타일 좌표(X/Y)를 표시한다.
  const coordReadout = el(
    'div',
    'absolute bottom-2 left-2 z-20 flex items-center gap-2 rounded-md px-2 py-1 bg-[#0d0d0d]/80 border border-[#3c3c3c] text-[10px] leading-none tabular-nums text-[#9d9d9d] pointer-events-none'
  )
  coordReadout.style.display = 'none'
  previewStage.append(coordReadout)
  // 선택 객체의 타일 좌표 — 오브젝트는 tileX/tileY, 타일 구조물은 id 끝('tile:wall:5,3')에서 파싱.
  const selectedTileCoords = (entity: GameEntity): { x: number; y: number } | undefined => {
    if (entity.tileX !== undefined && entity.tileY !== undefined) {
      return { x: entity.tileX, y: entity.tileY }
    }
    const match = entity.id.match(/:(\d+),\s*(\d+)$/)
    return match ? { x: Number(match[1]), y: Number(match[2]) } : undefined
  }
  const updateSelectionNameplate = (): void => {
    if (selectedEntity) {
      selectionNameplate.style.display = ''
      selectionNameplateLabel.textContent =
        `${selectedEntity.name} · ${KIND_LABEL[groupKindOf(selectedEntity.kind)] ?? selectedEntity.kind}`
      const coords = selectedTileCoords(selectedEntity)
      if (coords) {
        coordReadout.style.display = ''
        coordReadout.replaceChildren(
          el('span', 'text-[#777777]', 'X'),
          el('span', 'text-[#d4d7dc]', String(coords.x)),
          el('span', 'text-[#777777]', 'Y'),
          el('span', 'text-[#d4d7dc]', String(coords.y))
        )
      } else {
        coordReadout.style.display = 'none'
      }
    } else {
      selectionNameplate.style.display = 'none'
      coordReadout.style.display = 'none'
    }
  }
  // 표시 전용: 스테이지 크기가 바뀔 때마다 iframe을 16:9 비율의 cover 크기로 다시 맞춘다.
  // TOP_TRIM: 마을 맵 위쪽의 빈 어두운 띠가 헤더 아래에 보이지 않도록, 게임 창을 살짝 키워
  // 그만큼을 위에서 잘라낸다(바닥 정렬이라 잘리는 쪽은 항상 위). 캐릭터·카메라는 그대로다.
  const GAME_TOP_TRIM = 40
  const fitGameFrame = (): void => {
    const stageWidth = previewStage.clientWidth
    const stageHeight = previewStage.clientHeight
    if (stageWidth <= 0 || stageHeight <= 0) {
      return
    }
    const width = Math.max(stageWidth, ((stageHeight + GAME_TOP_TRIM) * 16) / 9)
    iframe.style.width = `${Math.floor(width)}px`
    iframe.style.height = `${Math.floor((width * 9) / 16)}px`
  }
  new ResizeObserver(fitGameFrame).observe(previewStage)
  iframe.addEventListener('load', () => {
    connection.className = 'h-7 flex items-center gap-1.5 text-[11px] rounded-full px-2.5 bg-[#72d36b]/10 border border-[#72d36b]/50 text-[#9fe296]'
    connectionDot.className = 'w-2 h-2 rounded-full bg-[#72d36b] shadow-[0_0_6px_rgba(114,211,107,0.8)]'
    connectionLabel.textContent = 'AI 연결됨'
    previewLoading.style.display = 'none'
  })

  // 게임이 바뀌면(폴더 열기/복귀) 프리뷰 iframe을 그 게임 URL로 다시 가리킨다. URL이 같으면
  // 불필요한 재로드를 피한다(같은 게임 재선택 등).
  const syncPreviewToGame = (): void => {
    const src = previewSrcForGame()
    if (iframe.src === new URL(src, location.href).href) {
      return
    }
    previewLoading.style.display = 'flex'
    iframe.src = src
  }
  // 상단 맵/씬 버튼은 로드된 게임에 맞춰 구성한다:
  // - my-sample-rpg: 큐레이션된 씬(마을/사냥터/동굴) + 아이콘, 'editor:switch-scene' 전송
  //   (게임이 'game:scene-changed'로 되보고 → currentMapId 갱신).
  // - 그 외(legend-of-lua 등): 실제 맵 목록(game.maps), 'editor:goto-map' 전송. 되보고가 없으므로
  //   버튼이 currentMapId의 주인 — 클릭 시 직접 집중·강조한다.
  styleTransferModal = createStyleTransferModal({
    onAssetChanged: () => {
      reloadButton.click()
    }
  })
  document.body.append(styleTransferModal.backdrop)
  stylePipelinePanel = createStylePipelinePanel({
    onAssetChanged: () => {
      reloadButton.click()
    }
  })
  document.body.append(stylePipelinePanel.backdrop)
  let mapSwitcherButtons: Array<{ id: string; button: HTMLButtonElement }> = []
  // 게임이 보고/선택한 현재 맵의 탭을 금색으로 강조한다(표시 전용). rpg는 연결 전 기본 맵(town).
  const updateSceneTabs = (): void => {
    const activeId =
      currentMapId ?? (game.adapter.id === 'my-sample-rpg' ? 'town' : undefined)
    for (const { id, button } of mapSwitcherButtons) {
      button.className = id === activeId ? SCENE_TAB_ACTIVE : SCENE_TAB
    }
  }
  const renderMapSwitcher = (): void => {
    const isRpg = game.adapter.id === 'my-sample-rpg'
    const entries: Array<{ id: string; label: string; icon: EditorIconName }> = isRpg
      ? previewScenes
      : game.maps.map((map) => ({ id: map.id, label: map.name, icon: 'map' as const }))
    mapSwitcherButtons = entries.map((entry) => {
      const button = el('button', SCENE_TAB) as HTMLButtonElement
      button.append(editorIcon(entry.icon, 12), el('span', '', entry.label))
      button.type = 'button'
      button.addEventListener('click', () => {
        if (isRpg) {
          iframe.contentWindow?.postMessage(
            { type: 'editor:switch-scene', sceneId: entry.id },
            '*'
          )
          return
        }
        if (game.adapter.id !== 'crypt-crawler') currentMapId = entry.id
        // legend 등 씬 되보고가 없는 게임은 탭으로 게임 맵만 바꾸고 트리는 전체 보기를 유지한다 —
        // 인게임에서 다른 맵으로 이동해도 생성 NPC가 트리에서 사라지지 않게(현재 맵은 '· 현재 맵'으로 표시).
        iframe.contentWindow?.postMessage(
          { type: 'editor:goto-map', mapId: entry.id, mapName: entry.label },
          '*'
        )
        renderTree()
        render()
        updateSceneTabs()
      })
      return { id: entry.id, button }
    })
    mapSwitcher.replaceChildren(...mapSwitcherButtons.map((b) => b.button))
    updateSceneTabs()
  }
  renderMapSwitcher()
  // 진행 단계 바 — RPG 퀘스트 진행도처럼 ①~⑤ 번호 캡슐 + 화살표.
  const FLOW_STEPS = ['Select', 'Request', 'Generate', 'Review', 'Apply']
  const stepBar = el('div', 'flex flex-wrap items-center gap-1.5')
  const stepPills = FLOW_STEPS.map((label, index) => {
    const pill = el('span', STEP_PILL)
    const num = el('span', STEP_NUM, String(index + 1))
    const text = el('span', STEP_TEXT, label)
    pill.append(num, text)
    return { pill, num, text }
  })
  // 단계 사이 연결선(→) — 진행된 구간은 금색, 남은 구간은 어두운 브론즈로 칠한다.
  const stepArrows: HTMLElement[] = []
  stepPills.forEach(({ pill }, index) => {
    if (index > 0) {
      const arrow = el('span', 'text-[11px] text-[#b6bac1]/28 transition', '→')
      stepArrows.push(arrow)
      stepBar.append(arrow)
    }
    stepBar.append(pill)
  })
  // 진행 단계를 실제 상태와 연결(표시 전용): 완료엔 숫자 대신 ✓, 생성 중엔 로딩 문구.
  const updateStepBar = (): void => {
    const applied = currentResult !== undefined && appliedResults.has(currentResult)
    const hasPrompt = promptInput.value.trim().length > 0
    // 선택 전 0 → 작성 중 1 → 생성(작성 완료/생성 중) 2 → 확인 3 → 적용 후엔 5(전부 완료).
    const activeStep = !selectedEntity
      ? 0
      : isGenerating
        ? 2
        : currentResult
          ? applied
            ? 5
            : 3
          : hasPrompt
            ? 2
            : 1
    stepPills.forEach(({ pill, num, text }, index) => {
      const isDone = index < activeStep
      const isActive = index === activeStep
      pill.className = isActive ? STEP_PILL_ACTIVE : isDone ? STEP_PILL_DONE : STEP_PILL
      num.className = isActive ? STEP_NUM_ACTIVE : isDone ? STEP_NUM_DONE : STEP_NUM
      // 완료 ✓ · 현재 ● · 미완료 ○ — 숫자 대신 상태 글리프로 "지금 어디"가 한눈에.
      num.textContent = isDone ? '✓' : isActive ? '●' : '○'
      text.className = isActive ? STEP_TEXT_ACTIVE : isDone ? STEP_TEXT_DONE : STEP_TEXT
      text.textContent =
        isActive && index === 2 && isGenerating
          ? 'Generating…'
          : isDone && index === 4
            ? 'Applied'
            : FLOW_STEPS[index] ?? ''
    })
    // 연결선 진행색: i번째 화살표는 i단계가 완료됐을 때 금색이 된다.
    stepArrows.forEach((arrow, index) => {
      arrow.className =
        index < activeStep
          ? 'text-[11px] text-[#b6bac1] transition'
          : 'text-[11px] text-[#b6bac1]/28 transition'
    })
  }
  preview.append(previewBar, previewStage)

  // ---------- center 하단: 프롬프트 컴포저 (마을 게시판/퀘스트 보드 카드) ----------
  // max-h+스크롤: 창이 낮을 때 컴포저가 게임 영역을 통째로 밀어내지 않게 한다.
  // settings-game-font: ESC/왼쪽 패널과 같은 둥근 픽셀 폰트로 통일.
  // 화면의 주인공 — 다른 패널보다 밝은 금색 그라데이션 테두리(과한 glow 없이 은은하게).
  // 세로를 아끼려 제목·설명을 한 줄에 같이 두고, 높이 상한도 낮춰 게임 화면에 공간을 양보한다.
  // 화면의 주인공 '콘텐츠 생성 요청' 패널 — 다른 패널보다 밝은 배경 + 2px 금색 테두리,
  // 입력에 포커스되면 은은한 발광(focus-within)으로 "여기에 쓰면 된다"가 바로 보이게.
  // 게임 화면이 주인공 — 요청 패널은 화면의 약 1/3 이하로 압축한다.
  const composer = el('div', 'settings-game-font shrink-0 max-h-[36%] overflow-y-auto rounded-xl box-grad-border box-grad-border--strong box-grad-border--thick [--bgb:#141416] text-[#d4d4d4] p-2.5 flex flex-col gap-1.5 transition focus-within:shadow-[0_0_20px_rgba(222,170,90,0.25)]')
  // 제목은 하나, 설명도 한 줄만 — 정보를 줄여 흐름(선택→작성→생성)이 먼저 읽히게.
  const composerTitle = el('div', 'flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 min-w-0')
  const composerTitleRow = el('div', 'flex items-center gap-2')
  composerTitleRow.append(
    editorIcon('scroll', 20),
    el('span', 'text-[18px] font-semibold leading-none text-[#d4d7dc]', '콘텐츠 생성 요청')
  )
  composerTitle.append(
    composerTitleRow,
    el('span', 'text-[13px] text-[#9d9d9d] opacity-75', '생성할 콘텐츠를 자연어로 작성하세요. 대상 선택은 선택 사항이며, 지정하면 더 정확한 결과를 얻습니다.')
  )
  // 우측 상단: 선택된 대상 카드만 표시한다(선택 없으면 비움) — 대상 선택은 필수가 아니라
  // 진행 단계·안내 배지로 상태를 알리지 않는다.
  const composerRight = el('div', 'flex items-center gap-3 shrink-0')
  composerRight.append(targetLine)
  const composerTop = el('div', 'flex flex-wrap items-start justify-between gap-2')
  composerTop.append(composerTitle, composerRight)
  // 제목 → 작업 유형 → 입력창 → 예시 요청 → 생성 버튼: 보조 행은 전부 다른 줄에 병합했다.
  // 최근 생성 결과 한 줄 — 처음엔 발표용 예시, 실제 결과가 생기면 그 라벨로 바뀐다(render()가 갱신).
  const recentResultLine = el('div', 'text-[10px] leading-[1.4] text-[#777777]')
  composer.append(composerTop, supportNote, quickStart, promptField, recommendBoard, actions, status, recentResultLine)
  center.append(preview, composer)
  // Crypt: 컴포저 자리에 스타일 결과의 변경 목록(Generate), 결과 보드 위에 에셋 상세(Review)를 둔다(읽기 전용).
  const requestedStyleRun = new URLSearchParams(location.search).get('styleRun') ?? ''
  const townStyleRun = game.adapter.id === 'my-sample-rpg' && /^[a-f0-9]{32}$/.test(requestedStyleRun) ? requestedStyleRun : ''
  const styleChanges = game.adapter.id === 'crypt-crawler' || game.adapter.id === 'my-sample-rpg' ? createStyleChangePanel() : undefined
  if (styleChanges) {
    const contentPane = el('div', 'flex flex-col gap-1.5')
    contentPane.append(...Array.from(composer.childNodes))
    const stylePane = el('div', 'flex flex-col gap-2')
    const createStyle = el('a', 'editor-style-action px-3 py-2 rounded self-start', '새 스타일 생성 열기 ↗')
    createStyle.href = styleWorkspaceUrl()
    createStyle.addEventListener('click', () => { createStyle.href = styleWorkspaceUrl() })
    stylePane.append(createStyle, el('p', 'text-[11px] text-[#9d9d9d]', '저장 결과를 선택해 비교·적용하세요. 오브젝트를 선택하면 오른쪽에 원본·장식·합성이 표시됩니다.'), styleChanges.changeList)
    const tabs = el('div', 'flex gap-2 border-b border-[#475569] pb-2')
    tabs.setAttribute('role', 'tablist')
    tabs.setAttribute('aria-label', '편집 작업 선택')
    const contentTab = el('button', 'px-3 py-2 rounded font-semibold', '콘텐츠 생성 요청')
    const styleTab = el('button', 'px-3 py-2 rounded font-semibold', '스타일 결과·검수')
    const selectTab = (style: boolean): void => {
      for (const [tab, pane, selected] of [[contentTab, contentPane, !style], [styleTab, stylePane, style]] as const) {
        tab.setAttribute('aria-selected', String(selected))
        tab.style.background = selected ? '#2456bd' : '#202b3d'
        tab.style.color = selected ? '#ffffff' : '#b9c5d8'
        pane.style.display = selected ? 'flex' : 'none'
      }
      styleChanges.dslCard.style.display = style ? '' : 'none'
      styleChanges.assetDetails.style.display = style ? '' : 'none'
    }
    for (const [tab, pane, id] of [[contentTab, contentPane, 'content'], [styleTab, stylePane, 'style']] as const) {
      tab.type = 'button'
      tab.id = `composer-tab-${id}`
      tab.setAttribute('role', 'tab')
      tab.setAttribute('aria-controls', `composer-pane-${id}`)
      pane.id = `composer-pane-${id}`
      pane.setAttribute('role', 'tabpanel')
      pane.setAttribute('aria-labelledby', tab.id)
    }
    contentTab.addEventListener('click', () => selectTab(false))
    styleTab.addEventListener('click', () => selectTab(true))
    tabs.append(contentTab, styleTab)
    composer.replaceChildren(tabs, contentPane, stylePane)
    selectTab(game.adapter.id === 'crypt-crawler' || !!townStyleRun)
    if (townStyleRun) styleChanges.showRun(townStyleRun)
  }

  // ---------- right: 생성 결과 사이드바 ----------
  // 결과 사이드는 보조 정보 — 패널 자체를 본문보다 살짝 더 어둡게 가라앉힌다.
  const side = el(
    'aside',
    // settings-game-font: 왼쪽 패널·컴포저와 같은 둥근 픽셀 폰트로 통일.
    'settings-game-font [grid-area:side] rounded-xl box-grad-border [--bgb:#141416] text-[#d4d4d4] min-w-0 min-h-0 overflow-y-auto p-3.5 flex flex-col gap-3'
  )
  const sideTitle = el('div', 'flex items-center gap-2 text-[15px] font-semibold text-[#e6e6e6] pb-2 border-b border-[#b6bac1]/30')
  sideTitle.append(el('span', '', '결과 보드'))
  // 결과가 없을 때만 보이는 작은 안내문(큰 빈 카드 대신).
  const boardHint = el('div', 'text-[11px] text-[#777777]', '생성 결과와 검증 상태를 확인하세요.')
  // 검증 표시(render()가 갱신)는 검증 섹션 본문 안에 산다. 검증 전엔 대기 한 줄.
  const validationEmpty = el('div', 'text-[12px] text-[#9d9d9d]', '대기 중')
  verifyView.body.append(validationEmpty, validationLine, dryRunBox)
  // 마지막 생성 시각(상대 시간) — 파이프라인이 "방금 돌았다"는 신호. 생성 전엔 숨김.
  const lastGeneratedLine = el('div', 'flex items-center justify-between gap-2 px-0.5 text-[10px] leading-none')
  const lastGeneratedValue = el('span', 'tabular-nums font-medium text-[#b6bac1]', '—')
  lastGeneratedLine.append(
    el('span', 'text-[#777777]', 'Last Generated'),
    lastGeneratedValue
  )
  lastGeneratedLine.hidden = true
  side.append(
    sideTitle,
    ...(styleChanges ? [styleChanges.dslCard, styleChanges.assetDetails] : []),
    analysisPanel,
    boardHint,
    boardList,
    lastGeneratedLine,
    todayCard,
    recentCard,
    boardDetail,
    evaluationWrap,
    historyWrap
  )

  body.append(tree, center, side)
  // ---------- settings modal (헤더 ⚙) ----------
  // 고정 LLM 정보·폴더 열기·분석·복귀는 상시 노출 대신 여기로 모은다. 메인은 편집에 집중.
  const settingsBackdrop = el('div', 'fixed inset-0 z-50 bg-black/60 backdrop-blur flex items-center justify-center p-4')
  // 숨김은 hidden 속성 대신 인라인 display로 제어한다 — `flex` 클래스의 display:flex가 [hidden]을
  // 덮어써 안 닫히는 사고를 막는다(인라인 스타일이 항상 이긴다).
  settingsBackdrop.style.display = 'none'
  // VSCode 설정창 톤: 차콜 패널 + 중립 테두리 + 깊은 그림자(크기·여백은 기존 그대로).
  const settingsPanel = el('div', 'settings-game-font relative w-full max-w-[600px] rounded-[24px] border border-[#57575e] bg-[#3a3a3f] text-[#e0e0e0] p-6 pt-5 flex flex-col gap-4 shadow-[0_10px_40px_rgba(0,0,0,0.55)] max-h-[90vh] overflow-y-auto')
  const settingsTitle = el('div', 'flex items-center justify-center gap-2.5 pb-3 border-b border-[#5a5a61]')
  settingsTitle.append(
    editorIcon('gear', 26),
    el('span', 'text-[27px] leading-none tracking-wide text-[#e6e6e6]', '프로젝트 설정')
  )
  // 우측 상단 원형 닫기 버튼 — 기본은 연회색, hover 시 VSCode 닫기 레드.
  const settingsClose = el('button', 'absolute top-3.5 right-3.5 w-9 h-9 rounded-full bg-[#4a4a50] text-[#b6bac1] text-base font-semibold leading-none border border-[#5e5e66] transition hover:bg-[#c42b1c] hover:text-white hover:-translate-y-0.5 active:translate-y-0', '✕') as HTMLButtonElement
  settingsClose.type = 'button'
  const modelSection = el('div', SETTINGS_SECTION)
  modelSection.append(modelField)
  const projectSection = el('div', SETTINGS_SECTION)
  projectSection.append(el('span', SETTINGS_LABEL, '프로젝트'), openButton, analyzeButton, resetButton)
  settingsPanel.append(settingsTitle, settingsClose, modelSection, projectSection)
  settingsBackdrop.append(settingsPanel)

  const closeSettings = (): void => {
    settingsBackdrop.style.display = 'none'
  }
  settingsButton.addEventListener('click', () => {
    settingsBackdrop.style.display = 'flex'
  })
  settingsClose.addEventListener('click', closeSettings)
  settingsBackdrop.addEventListener('click', (event) => {
    // 패널 바깥(백드롭)을 클릭했을 때만 닫는다.
    if (event.target === settingsBackdrop) {
      closeSettings()
    }
  })
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && settingsBackdrop.style.display !== 'none') {
      closeSettings()
    }
  })

  // 진행 단계 스트립 — 헤더 바로 아래 한 줄(퀘스트 진행 UI, 화살표 없음).
  const stepStrip = el('div', 'settings-game-font select-none shrink-0 flex px-4 py-1 border-b border-[#b6bac1]/22 bg-[#141416]')
  stepStrip.append(stepBar)
  root.append(header, stepStrip, body, settingsBackdrop)
  mountElement.append(root)

  // ---------- behavior ----------
  const setStatus = (message: string): void => {
    status.textContent = message
  }

  // 파싱 실패한 맵이 있으면 상태 메시지 끝에 붙일 경고(없으면 빈 문자열). loadGame이 throw 대신
  // game.parseErrors로 모아주므로, 에디터가 통째로 안 뜨는 일 없이 실패를 사용자에게 알린다.
  const parseErrorNote = (): string =>
    game.parseErrors.length > 0
      ? ` · 파싱 실패 맵 ${game.parseErrors.length}개: ${game.parseErrors.join(', ')}`
      : ''

  const renderAnalysis = (): void => {
    if (!currentAnalysis) {
      analysisPanel.hidden = true
      return
    }

    analysisPanel.hidden = false
    const analysis = currentAnalysis
    analysisPanel.replaceChildren(
      el('div', 'text-[11px] font-semibold tracking-wide text-[#b6bac1]', 'LLM 게임 분석'),
      el('div', 'text-sm text-[#d4d4d4] font-medium', `${analysis.game_name} · ${analysis.engine}`),
      el('div', 'text-xs text-[#9d9d9d]', `콘텐츠 모델: ${analysis.content_model}`),
      el('div', 'text-xs text-[#9d9d9d]', `적용 전략: ${analysis.apply_strategy}`),
      ...analysis.entity_groups.map((entityGroup) =>
        el(
          'div',
          'text-xs text-[#777777]',
          `• ${entityGroup.group} → ${entityGroup.kind}${entityGroup.editable ? ' (편집 가능)' : ''}`
        )
      )
    )
  }

  const runAnalyze = async (): Promise<void> => {
    if (isAnalyzing) {
      return
    }

    isAnalyzing = true
    analyzeButton.disabled = true
    analyzeLabel.textContent = '분석 중...'
    setStatus('LLM이 게임을 분석 중...')

    const filesAtStart = currentFiles
    try {
      const analysis = await analyzeGame({ apiKey: '', files: filesAtStart })
      // 분석 중 다른 프로젝트를 열었으면 이 결과는 버린다(레이스 방지).
      if (currentFiles !== filesAtStart) {
        return
      }
      currentAnalysis = analysis
      // 하드코딩 어댑터가 엔티티를 못 찾았으면(미지의 게임), 분석 결과로 트리를 채운다.
      // 타일 군집(보기 전용 구조물)은 세지 않는다 — 장식만 있는 미지의 게임에서 분석 결과가
      // 트리에 반영되지 못하게 막아버린다.
      const totalEntities = game.maps.reduce(
        (sum, map) =>
          sum + map.entities.filter((entity) => !isTileClusterEntity(entity)).length,
        0
      )
      if (totalEntities === 0) {
        game = { ...game, maps: buildEntitiesFromAnalysis(filesAtStart, analysis) }
        // 트리를 새 엔티티로 갈아끼우므로, 이전 대상의 생성 결과·히스토리·세션 집계는 모두 무효 처리한다
        // (open/reset과 동일한 초기화 묶음 — 지표가 폐기된 생성을 계속 세지 않도록).
        selectedEntity = undefined
        currentResult = undefined
        history = []
        historyCounter = 0
        sessionTally = { generations: 0, validatorPasses: 0 }
        expandedGroups.clear()
        renderTree()
      }
      renderAnalysis()
      render()
      setStatus(`분석 완료: ${analysis.game_name} (${analysis.engine})`)
    } catch (error) {
      setStatus(`분석 실패: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      isAnalyzing = false
      analyzeButton.disabled = false
      analyzeLabel.textContent = 'AI 게임 분석'
    }
  }

  // 게임(iframe)이 localStorage에 저장한 수기/생성 NPC를 트리 표시용 GameEntity로 환산한다.
  // TMX에서 읽은 정적 엔티티(map.entities)는 부팅 때 한 번만 채워지므로, '적용'으로 새로 스폰된
  // NPC는 거기에 없다 — 여기서 합쳐줘야 '인물' 카드에 생성 직후 바로 나타난다.
  // 같은 id는 같은 객체 참조로 캐시한다(selectedEntity 비교·하이라이트가 렌더 간 유지되도록).
  const placedNpcEntityCache = new Map<string, GameEntity>()
  const placedNpcEntities = (mapId: string): GameEntity[] =>
    loadNpcsForMap(mapId).map((npc) => {
      const name = npc.name ?? '이름 없는 NPC'
      const cached = placedNpcEntityCache.get(npc.id)
      if (cached) {
        cached.name = name
        cached.tileX = npc.col
        cached.tileY = npc.row
        return cached
      }
      const entity: GameEntity = {
        id: npc.id,
        name,
        kind: 'npc',
        mapId,
        tileX: npc.col,
        tileY: npc.row
      }
      placedNpcEntityCache.set(npc.id, entity)
      return entity
    })

  const buildStyleObjectTarget = (
    map: LoadedGameMap,
    entity: GameEntity
  ): StyleTransferMapObject | undefined => {
    const mapFile = currentFiles.find((file) => file.path === map.file)
    if (!mapFile) {
      return undefined
    }
    let objects: TmxObject[] = []
    try {
      objects = extractTmxObjects(mapFile.text)
    } catch {
      return undefined
    }
    // 타일 군집(좌표 id)은 군집 재추출로, 영역 오브젝트(건물·분수·나무 장식 등)는
    // 사각형 안의 같은 종류 타일 수집으로 셀 목록을 얻는다.
    const detail = isTileClusterEntity(entity)
      ? findTileClusterDetail(mapFile, currentFiles, objects, entity.id)
      : findObjectKindCells(mapFile, currentFiles, objects, entity)
    if (!detail || detail.cells.length === 0 || detail.tilesetSource === undefined) {
      return undefined
    }
    const tsxFile = findFileByRelativeSource(currentFiles, mapFile.path, detail.tilesetSource)
    const info = tsxFile ? extractTmxTilesetImageInfo(tsxFile.text) : undefined
    if (!tsxFile || !info) {
      return undefined
    }
    const imagePath = resolveRelativePath(tsxFile.path, info.imageSource)
    if (!imagePath.startsWith('src/games/my-sample-rpg/assets/') &&
        !imagePath.startsWith('src/games/crypt-crawler/assets/')) {
      return undefined
    }
    const kind = groupKindOf(entity.kind)
    return {
      label: `${KIND_ICON[kind] ?? '•'} ${entity.name}`,
      tilesetImagePath: imagePath,
      tileWidth: info.tileWidth,
      tileHeight: info.tileHeight,
      columns: info.columns,
      cells: detail.cells,
      sharedOutsideCells: detail.sharedOutsideCells
    }
  }

  // 몬스터 appearanceType → 전용 애니메이션 스프라이트 시트 파일(게임 로더가 하드코딩으로 import).
  // 이 두 종류는 타일이 아니라 통짜 시트라, 시트 전체를 변환·적용한다.
  const MONSTER_SHEET_BY_APPEARANCE: Record<string, string> = {
    monster_pig: 'src/games/my-sample-rpg/assets/monsters/monster-pig-sheet.png',
    monster_slime: 'src/games/my-sample-rpg/assets/monsters/몬스터-말캉이.png'
  }
  const NPC_TILESET_TSX = 'tiny-dungeon-16.tsx'

  // 클릭한 캐릭터 엔티티의 외형(appearanceType)을 TMX에서 복구한다(GameEntity엔 없음).
  // rpgAdapter의 id 규칙(object.name, 없으면 `${kind}-${object.id}`)을 역으로 매칭한다.
  const getEntityAppearanceType = (
    map: LoadedGameMap,
    entity: GameEntity
  ): string | undefined => {
    const mapFile = currentFiles.find((file) => file.path === map.file)
    if (!mapFile) {
      return undefined
    }
    let objects: TmxObject[] = []
    try {
      objects = extractTmxObjects(mapFile.text)
    } catch {
      return undefined
    }
    const object =
      objects.find((candidate) => candidate.name === entity.id) ??
      objects.find((candidate) => `${entity.kind}-${candidate.id}` === entity.id)
    const appearance = object?.properties.type ?? object?.properties.appearanceType
    return appearance || undefined
  }

  // NPC(및 tiny-dungeon-16에 타일로 존재하는 캐릭터/몬스터)를 단일 타일 패치 대상으로 만든다.
  // appearanceType → tiny-dungeon-16.tsx의 타일 id → (col,row) 단일 셀. 같은 외형의 다른
  // 캐릭터도 같은 타일을 공유하므로 함께 바뀐다(배너로 안내).
  const buildStyleCharacterTileTarget = (
    appearanceType: string,
    displayName: string
  ): StyleTransferMapObject | undefined => {
    const tsxFile = currentFiles.find((file) => file.name === NPC_TILESET_TSX)
    if (!tsxFile) {
      return undefined
    }
    const info = extractTmxTilesetImageInfo(tsxFile.text)
    const tileId = extractTilesetTileIdByType(tsxFile.text, appearanceType)
    if (!info || tileId === undefined) {
      return undefined
    }
    const imagePath = resolveRelativePath(tsxFile.path, info.imageSource)
    if (!imagePath.startsWith('src/games/my-sample-rpg/assets/')) {
      return undefined
    }
    return {
      label: displayName,
      tilesetImagePath: imagePath,
      tileWidth: info.tileWidth,
      tileHeight: info.tileHeight,
      columns: info.columns,
      cells: [{ col: tileId % info.columns, row: Math.floor(tileId / info.columns), tileId }],
      sharedOutsideCells: 0,
      bannerText: `캐릭터: ${displayName} · ⚠ 같은 외형(${appearanceType})의 캐릭터가 모두 함께 바뀝니다`
    }
  }

  const treeHoverPreview = createHoverPreview()
  const buildEntityPreviewContent = (
    map: LoadedGameMap,
    entity: GameEntity
  ): HTMLElement | undefined | Promise<HTMLElement | undefined> => {
    const appearanceType = getEntityAppearanceType(map, entity)
    if (appearanceType) {
      const monsterSheet = MONSTER_SHEET_BY_APPEARANCE[appearanceType]
      if (monsterSheet) {
        return buildImagePreview(`/${monsterSheet}`, { maxSize: 192 })
      }
      const characterTarget = buildStyleCharacterTileTarget(appearanceType, entity.name)
      const characterCell = characterTarget?.cells[0]
      if (characterTarget && characterCell) {
        return buildTileSlicePreview({
          imageUrl: `/${characterTarget.tilesetImagePath}`,
          columns: characterTarget.columns,
          tileWidth: characterTarget.tileWidth,
          tileHeight: characterTarget.tileHeight,
          tileId: characterCell.tileId,
          targetSize: 128
        })
      }
    }
    if (game.adapter.id === 'my-sample-rpg' && ['building', 'tree', 'fountain', 'lamp', 'flower', 'prop'].includes(groupKindOf(entity.kind)) && !isTileClusterEntity(entity)) {
      return buildLayeredObjectHoverPreview(currentFiles, map.file, entity.id)
    }
    const objectTarget = buildStyleObjectTarget(map, entity)
    if (objectTarget) {
      return buildCellsCanvasPreview({
        imageUrl: currentFiles.find(file => file.path === objectTarget.tilesetImagePath)?.url ?? `/${objectTarget.tilesetImagePath}`,
        columns: objectTarget.columns,
        tileWidth: objectTarget.tileWidth,
        tileHeight: objectTarget.tileHeight,
        cells: objectTarget.cells,
        targetSize: 176
      })
    }
    return undefined
  }
  const bindEntityPreview = (target: HTMLElement, map: LoadedGameMap, entity: GameEntity): void => {
    treeHoverPreview.bind(target, () => buildEntityPreviewContent(map, entity))
  }

  // Crypt's atlas has no tile type metadata, so expose its used tiles by layer.
  const cryptTileLists = new Map<string, HTMLElement>()
  const cryptTilesFor = (map: LoadedGameMap): HTMLElement => {
    const cached = cryptTileLists.get(map.file)
    if (cached) return cached
    const list = el('div', 'flex flex-col gap-1')
    const file = currentFiles.find(item => item.path === map.file)
    const atlas = currentFiles.find(item => item.name === 'ninja-dungeon-16.png')
    if (!file || !atlas?.url) return list
    const xml = new DOMParser().parseFromString(file.text, 'text/xml')
    const firstGid = Number(xml.querySelector('tileset')?.getAttribute('firstgid') ?? 1)
    for (const layer of xml.querySelectorAll('layer')) {
      const name = layer.getAttribute('name') ?? ''
      if (name === 'collision') continue
      const data = layer.querySelector('data')
      if (data?.getAttribute('encoding') !== 'csv') continue
      const ids = [...new Set((data.textContent ?? '').split(',').map(Number).filter(gid => gid > 0).map(gid => (gid & 0x0fffffff) - firstGid))]
      const details = el('details', 'text-[12px] text-[#d4d4d4]')
      details.append(el('summary', 'cursor-pointer py-2', `${name} 타일 · ${ids.length}종`))
      const grid = el('div', 'flex flex-wrap gap-1 p-1')
      for (const tileId of ids) {
        const tile = el('button', 'rounded border border-[#48484e] p-1') as HTMLButtonElement
        tile.type = 'button'
        tile.title = `${name} · 타일 ${tileId}`
        tile.setAttribute('aria-label', tile.title)
        const options = { imageUrl: atlas.url, columns: 32, tileWidth: 16, tileHeight: 16, tileId }
        tile.append(buildTileSlicePreview({ ...options, targetSize: 32 }))
        treeHoverPreview.bind(tile, () => buildTileSlicePreview(options))
        grid.append(tile)
      }
      details.append(grid)
      list.append(details)
    }
    cryptTileLists.set(map.file, list)
    return list
  }

  const renderTree = (): void => {
    entityButtons = []
    const groups: HTMLElement[] = []

    // 게임이 보고한 현재 맵을 트리의 기준으로 삼는다. 그 맵을 game.maps에서 찾으면(=같은 프로젝트)
    // 기본적으로 그 맵의 요소만 보여준다. 다른 게임 폴더를 열어 매칭이 안 되면 전체를 보여준다.
    const focusMap =
      currentMapId !== undefined
        ? game.maps.find((map) => map.id === currentMapId)
        : undefined
    const mapsToShow = focusMap && !showAllMaps ? [focusMap] : game.maps

    // 동기화 상태줄·토글 갱신. focusMap이 있을 때만 토글이 의미가 있다.
    if (focusMap) {
      mapFilterToggle.hidden = false
      mapFilterToggle.textContent = showAllMaps ? '현재 맵만' : '전체 보기'
      treeSyncLine.replaceChildren(
        el('span', 'inline-block w-1.5 h-1.5 rounded-full bg-[#7ba368] mr-1.5 align-middle'),
        showAllMaps
          ? document.createTextNode('전체 맵 표시 중')
          : el('span', 'text-[#d4d4d4]', `현재 맵: ${focusMap.name}`)
      )
    } else {
      mapFilterToggle.hidden = true
      // 연결 전(undefined)엔 대기 메시지, 매칭 안 되는 프로젝트면 줄을 비운다.
      treeSyncLine.textContent =
        currentMapId === undefined ? '게임과 연결 대기 중…' : ''
    }

    for (const map of mapsToShow) {
      // TMX 정적 엔티티 + localStorage에 저장된 수기/생성 NPC를 합쳐 한 맵의 전체 요소로 본다.
      const mapEntities = map.entities.concat(placedNpcEntities(map.id))
      // 객체도 레이어도 없는 맵만 건너뛴다(예: 파싱 실패). 몬스터만 있는 맵·지형만 있는 맵도 보여준다.
      if (mapEntities.length === 0 && map.layers.length === 0) {
        continue
      }

      const group = el('div', 'flex flex-col gap-1')
      const isCurrent = map.id === currentMapId
      const mapTitle = el('div', 'flex items-center gap-1.5 text-[12px] text-[#d4d4d4] font-semibold tracking-wide px-1')
      mapTitle.append(
        editorIcon('map', 13),
        el('span', 'truncate', `${map.name}${isCurrent ? ' · 현재 맵' : ''}`)
      )
      group.append(mapTitle)

      // 검색어가 있으면 이름으로 실시간 필터링(표시 전용).
      const query = assetQuery.trim().toLowerCase()
      const visibleEntities = query
        ? mapEntities.filter((entity) => entity.name.toLowerCase().includes(query))
        : mapEntities
      // 검색 중인데 이 맵에 일치하는 에셋이 없으면 맵 자체를 건너뛴다.
      if (query && visibleEntities.length === 0) {
        continue
      }

      // 같은 종류끼리 접이식 그룹으로 묶는다(쭉 나열하면 길어서 보기 불편하다는 피드백).
      // NPC 그룹을 맨 위로, 나머지는 맵에 등장한 순서대로.
      const byKind = new Map<string, GameEntity[]>()
      for (const entity of visibleEntities) {
        const kind = groupKindOf(entity.kind)
        const list = byKind.get(kind)
        if (list) {
          list.push(entity)
        } else {
          byKind.set(kind, [entity])
        }
      }
      const kindEntries = [...byKind.entries()].sort(
        (a, b) => (a[0] === 'npc' ? 0 : 1) - (b[0] === 'npc' ? 0 : 1)
      )

      // 모든 요소를 펼쳐 고를 수 있게 한다 — 오브젝트(NPC·포털·건물·표지판·몬스터·상자…)와
      // 타일로 그린 구조물(깃발·벽·나무·분수·가로등…)까지. 어느 카테고리(환경/장식물/건축물)든
      // 카드를 누르면 목록이 펼쳐지고 개별 선택된다. (대화 생성의 큐레이션은 profile.npcs가 따로 관리한다.)
      const isSelectableEntity = (_entity: GameEntity): boolean => true

      const selectableCount = visibleEntities.filter(isSelectableEntity).length
      // Preserve the original compact, collapsible asset list.
      for (const [kind, entities] of kindEntries) {
        const groupKey = `${map.id}:${kind}`
        const expanded = query.length > 0 || expandedGroups.has(groupKey) ||
          entities.some(entity => entity === selectedEntity)
        const headerButton = el('button', 'w-full flex items-center gap-1.5 px-1 py-2 text-left text-[13px] hover:bg-[#302a26] rounded') as HTMLButtonElement
        headerButton.type = 'button'
        headerButton.setAttribute('aria-expanded', String(expanded))
        headerButton.append(
          el('span', 'w-3 text-[10px] text-[#777777]', expanded ? '▾' : '▸'),
          editorIcon(KIND_ICON[kind] ?? 'prop', 14),
          el('span', 'truncate', `${kind} ${KIND_LABEL[kind] ?? kind}`),
          el('span', 'ml-auto text-[11px] text-[#777777]', String(entities.length))
        )
        headerButton.onclick = () => {
          if (expandedGroups.has(groupKey)) expandedGroups.delete(groupKey)
          else expandedGroups.add(groupKey)
          renderTree()
        }
        group.append(headerButton)
        if (!expanded) continue
        for (const entity of entities) {
          const node = el('button', ENTITY_BASE) as HTMLButtonElement
          node.type = 'button'
          node.title = entity.name
          node.dataset.assetId = entity.id
          bindEntityPreview(node, map, entity)
          node.append(
            editorIcon(kind === 'npc' ? npcIconFor(entity.name) : (KIND_ICON[kind] ?? 'prop'), 14),
            el('span', 'truncate', displayNameOf(entity.name))
          )
          node.onclick = () => {
            selectedEntity = selectedEntity === entity ? undefined : entity
            currentResult = undefined
            render()
          }
          entityButtons.push({ entity, node })
          group.append(node)
        }
      }

      // 요소는 있는데 생성 대상이 하나도 없는 맵(사냥터·동굴 등)에선, 왜 클릭할 게 없는지 알려준다.
      if (selectableCount === 0 && mapEntities.length > 0) {
        group.append(
          el('div', 'px-1 text-[11px] text-[#777777] italic', '생성 대상이 없는 맵 — 위 요소는 보기 전용입니다.')
        )
      }

      // "ground" 같은 타일/지형 레이어 — 객체가 아니라 맵 자체의 구성. 보기 전용 정보로 한 줄에 보여준다.
      if (game.adapter.id === 'crypt-crawler') group.append(cryptTilesFor(map))
      if (map.layers.length > 0) {
        const layersLine = el('div', 'px-1 pt-0.5 flex items-center gap-1.5 text-[11px] text-[#777777]')
        layersLine.append(
          editorIcon('layers', 12),
          el('span', 'truncate', `타일 레이어: ${map.layers.join(' · ')}`)
        )
        group.append(layersLine)
      }

      groups.push(group)
    }

    if (groups.length === 0) {
      const message =
        assetQuery.trim().length > 0
          ? `'${assetQuery.trim()}' 검색 결과가 없습니다.`
          : focusMap && !showAllMaps
            ? `현재 맵(${focusMap.name})에서 읽을 요소가 없습니다. ‘전체 보기’로 다른 맵을 볼 수 있어요.`
            : '로드된 맵이 없습니다. "게임 폴더 열기"로 프로젝트를 여세요.'
      groups.push(el('div', 'text-xs text-[#9d9d9d] leading-relaxed', message))
    }

    treeList.replaceChildren(...groups)
  }

  const renderHistory = (): void => {
    if (history.length === 0) {
      historyWrap.hidden = true
      return
    }

    historyWrap.hidden = false
    historyList.replaceChildren(
      ...history.map((entry) => {
        const active = entry.result === currentResult
        // truncate: 라벨은 snake_case 강제라 줄바꿈 지점이 없어, 좁은 사이드바에 가로 스크롤을 만든다.
        const node = el(
          'button',
          active
            ? 'truncate text-left rounded-md px-2.5 py-1.5 text-xs bg-[#b6bac1]/15 text-[#b6bac1] ring-1 ring-inset ring-[#b6bac1]/40 transition'
            : 'truncate text-left rounded-md px-2.5 py-1.5 text-xs text-[#9d9d9d] transition hover:bg-[#302a26] hover:text-[#d4d4d4]'
        ) as HTMLButtonElement
        node.type = 'button'
        const mark = entry.result.issues.length === 0 ? '✓' : '!'
        // 라벨은 LLM/열린 파일에서 온 임의 값이라 textContent로만 넣는다(주입/깨짐 방지).
        node.textContent = `#${entry.n} ${mark} ${entry.result.label}`
        node.addEventListener('click', () => {
          currentResult = entry.result
          render()
        })
        return node
      })
    )
  }

  const renderEvaluation = (): void => {
    if (!currentResult) {
      evaluationWrap.hidden = true
      return
    }

    evaluationWrap.hidden = false
    // 자동 Validator 통과율(이번 세션) + 사람 수용률(누적)을 한 줄로(회의의 두 평가 개념).
    // 둘은 시간 범위가 다르다: validatorPass는 sessionTally(프로젝트 전환 시 초기화), 수용률은
    // localStorage에 영속되는 평가 전체(누적 acceptance_rate 목표용)라 라벨로 범위를 구분한다.
    const metrics = buildSessionMetrics(sessionTally, evaluations)
    const validatorPercent = Math.round(metrics.validatorPassRate * 100)
    const acceptancePercent = Math.round(metrics.acceptanceRate * 100)
    acceptanceStat.textContent =
      `세션 생성 ${metrics.generations} · Validator 통과 ${validatorPercent}%` +
      (metrics.acceptanceTotal === 0
        ? ' · 누적 수용 평가 없음'
        : ` · 누적 수용률 ${acceptancePercent}%${metrics.meetsAcceptanceGoal ? ' ✓' : ''}`)

    // 현재 결과가 이미 평가됐으면(객체 단위로 기억) 그 판정을 보여주고 버튼을 잠근다(중복 집계 방지).
    const verdict = verdictByResult.get(currentResult)
    const evaluated = verdict !== undefined
    acceptButton.disabled = evaluated
    rejectButton.disabled = evaluated
    acceptButton.className =
      verdict === 'acceptable'
        ? 'rounded-lg h-8 px-3 bg-[#4e6b42]/25 text-[#a3bd92] text-sm border border-[#4e6b42]/50'
        : GHOST_BUTTON
    rejectButton.className =
      verdict === 'not_acceptable'
        ? 'rounded-lg h-8 px-3 bg-[#8a4a3e]/25 text-[#d49a8c] text-sm border border-[#8a4a3e]/50'
        : GHOST_BUTTON
    if (evaluated) {
      evaluationVerdict.className =
        verdict === 'acceptable' ? 'text-xs text-[#a3bd92]' : 'text-xs text-[#d49a8c]'
      evaluationVerdict.textContent =
        verdict === 'acceptable' ? '· 이 결과를 수용함' : '· 이 결과를 거부함'
    } else {
      evaluationVerdict.textContent = ''
    }
  }

  const runResetEvaluations = (): void => {
    clearEventEvaluations()
    evaluations = []
    // 영속 기록을 비웠으니 현재 결과의 잠금(verdict)도 함께 풀어 정합성을 맞춘다.
    verdictByResult = new WeakMap<GenerationResult, EventEvaluationVerdict>()
    renderEvaluation()
    setStatus('누적 평가 기록을 초기화했습니다.')
  }

  const runEvaluate = (verdict: EventEvaluationVerdict): void => {
    if (!currentResult || verdictByResult.has(currentResult)) {
      return
    }

    evaluations = appendEventEvaluation({
      event_id: `${currentResult.label || 'generation'}-${evaluations.length + 1}`,
      event_name: currentResult.label,
      verdict,
      reason: '',
      evaluated_at: Date.now()
    })
    verdictByResult.set(currentResult, verdict)
    renderEvaluation()
    const metrics = buildSessionMetrics(sessionTally, evaluations)
    setStatus(
      `평가 기록됨(${verdict === 'acceptable' ? '수용' : '거부'}) · 누적 수용률 ${Math.round(
        metrics.acceptanceRate * 100
      )}%`
    )
  }

  function render(): void {
    updateHeaderMeta()

    if (game.adapter.applyMode !== 'none') {
      supportNote.hidden = true
    } else {
      supportNote.hidden = false
      supportNote.textContent = `${game.adapter.name}: 생성은 되지만 라이브 적용은 아직 지원되지 않습니다 (Stage 3). 결과는 미리보기로 확인하세요.`
    }

    // 엔티티 이름/맵은 열린 TMX에서 온 임의 값이므로 textContent로만 넣는다(주입/깨짐 방지).
    if (selectedEntity) {
      // 선택됨: '선택 대상 / OO 선택됨' 카드 — 금색 테두리 + 은은한 발광 + 페이드 전환.
      const selectedCard = el('span', 'fade-in inline-flex items-center gap-2 rounded-lg px-3 py-1.5 bg-[#34363a]/15 border border-[#b6bac1] shadow-[0_0_8px_rgba(213,161,79,0.25)] max-w-full')
      const selectedText = el('span', 'flex flex-col gap-1 min-w-0')
      selectedText.append(
        el('span', 'text-[10px] leading-none text-[#9d9d9d]', '선택 대상'),
        el('span', 'text-[14px] leading-none text-[#f6e4b8] truncate', `${selectedEntity.name} 선택됨`)
      )
      selectedCard.append(
        editorIcon(KIND_ICON[groupKindOf(selectedEntity.kind)] ?? 'target', 20),
        selectedText
      )
      targetLine.replaceChildren(selectedCard)
    } else {
      // 선택 전: 아무것도 표시하지 않는다 — 대상 선택은 필수가 아니라 상태를 알릴 필요가 없다.
      targetLine.replaceChildren()
    }

    for (const { entity, node } of entityButtons) {
      // id가 아니라 참조로 비교한다 — id는 맵이 달라도 겹칠 수 있어(같은 TMX 이름·그룹-번호 조합)
      // '전체 보기'에서 다른 맵의 동명 NPC까지 선택된 것처럼 칠해진다.
      node.className = entity === selectedEntity ? ENTITY_ACTIVE : ENTITY_BASE
    }

    if (!currentResult) {
      validationLine.hidden = true
    } else if (currentResult.issues.length === 0) {
      validationLine.hidden = false
      validationLine.className = 'text-[12px] leading-relaxed text-[#8fc96a]'
      validationLine.replaceChildren(
        document.createTextNode('✓ 자동 검증 통과')
      )
    } else {
      validationLine.hidden = false
      validationLine.className = 'text-[12px] leading-relaxed text-[#d9a64f] flex flex-col gap-0.5'
      // 이슈 문자열은 Validator가 만든 값이지만 안전하게 textContent(el)로만 넣는다.
      validationLine.replaceChildren(
        el('div', '', `! 자동 검증 ${currentResult.issues.length}건 확인 필요`),
        ...currentResult.issues.map((issue) => el('div', 'pl-3 text-[#d9a64f]/80', `• ${issue}`))
      )
    }
    // 검증 전 안내문은 검증 표시와 반대로 토글(둘 다 검증 섹션 본문 안).
    validationEmpty.hidden = !validationLine.hidden

    // 무결성 검증(드라이런) 단계별 결과 — 퀘스트 2단계 생성 후에만 채워진다.
    if (currentDryRun) {
      dryRunBox.hidden = false
      dryRunBox.replaceChildren(
        el(
          'div',
          'text-[12px] font-semibold pt-1 ' +
            (currentDryRun.ok ? 'text-[#8fc96a]' : 'text-[#e06c6c]'),
          `무결성 검증(드라이런) — ${currentDryRun.ok ? '통과' : '실패'}`
        ),
        ...currentDryRun.steps.map((step) => {
          const icon = step.status === 'ok' ? '✓' : step.status === 'warn' ? '⚠' : '✗'
          const color =
            step.status === 'ok'
              ? 'text-[#8fc96a]'
              : step.status === 'warn'
                ? 'text-[#d9a64f]'
                : 'text-[#e06c6c]'
          return el('div', `text-[11px] leading-relaxed ${color}`, `${icon} ${step.label} — ${step.detail}`)
        }),
        ...currentDryRun.jsonIssues.map((issue) =>
          el('div', 'text-[11px] leading-relaxed text-[#d9a64f]/80 pl-3', `• ${issue}`)
        ),
        el(
          'div',
          'text-[10px] leading-[1.4] text-[#777777] pt-1',
          '※ 에디터 프로필 기준 시뮬레이션입니다. 실제 게임 상태와 다를 수 있습니다.'
        )
      )
    } else {
      dryRunBox.hidden = true
    }

    generateLabel.textContent = isGenerating ? '만드는 중...' : '만들기'
    // 버튼은 생성 중일 때만 잠근다 — 나머지(키·요청 등)는 클릭 시 runGenerate가 친절한 메시지로 안내한다.
    // "왜 못 누르지?" 대신 "눌렀더니 뭘 해야 하는지 알려준다"로(되게 눌러지게).
    generateButton.disabled = isGenerating
    // 비활성 이유를 툴팁으로 — "왜 못 누르지?"를 절대 헷갈리지 않게(없으면 다음 단계 안내).
    generateButton.title = isGenerating
      ? '생성 중입니다…'
      : promptInput.value.trim().length === 0
        ? '요청 내용을 입력하세요'
        : !selectedEntity
          ? '바로 생성할 수 있습니다 — 대상 객체를 고르면 더 정확합니다'
          : '콘텐츠 생성'
    // 적용 버튼도 생성 중일 때만 잠근다 — 결과 없음/검증 전이면 클릭 시 runApply가 메시지로 안내한다.
    applyButton.disabled = isGenerating
    // 적용 버튼도 단계별 이유를 명시 — 생성 전/검증 전/지원 안 됨/적용 가능.
    applyButton.title = isGenerating
      ? '생성 중입니다…'
      : !currentResult
        ? '먼저 콘텐츠를 생성하세요'
        : !currentResult.apply
          ? '이 결과는 라이브 적용을 지원하지 않습니다'
          : candidateMode && currentDryRun?.ok !== true
            ? '무결성 검증을 통과해야 적용할 수 있습니다'
            : '게임에 적용'
    // 복사·내보내기도 생성 중일 때만 잠근다 — 결과 없으면 클릭 시 메시지로 안내(되게 눌러지게).
    copyButton.disabled = isGenerating
    exportButton.disabled = isGenerating
    copyButton.title = currentResult ? '생성 결과 복사' : '먼저 콘텐츠를 생성하세요'
    exportButton.title = currentResult ? '결과를 파일로 내보내기' : '먼저 콘텐츠를 생성하세요'
    // 결과 보드 채우기(표시 전용): 목록 4줄은 항상 보이고, 상세 창 내용만 갱신된다.
    // 목록 카드 우측 상태 배지(캡슐) — 색으로 상태가 한눈에 들어온다.
    const BADGE = 'h-[20px] flex items-center gap-1.5 rounded-full px-2 text-[10px] font-semibold leading-none whitespace-nowrap bg-[#242427]'
    // 상태 톤 — 좁은 다크 테마에서 색만으로 빠르게 읽히게: 성공=초록·대기=앰버·오류=빨강·유휴=회색.
    // 작은 색 도트 + 같은 톤 텍스트. 화려한 색/글로우 없이 의미만 전달한다.
    const STATUS_TONE = {
      green: { dot: 'bg-[#6cbf5a]', text: 'text-[#8fc96a]' },
      amber: { dot: 'bg-[#c0973f]', text: 'text-[#d9a64f]' },
      red: { dot: 'bg-[#d06c6c]', text: 'text-[#e06c6c]' },
      gray: { dot: 'bg-[#6b6f76]', text: 'text-[#9d9d9d]' },
      neutral: { dot: 'bg-[#8a8e95]', text: 'text-[#d4d7dc]' }
    } as const
    const setStatusPill = (
      status: HTMLElement,
      text: string,
      tone: keyof typeof STATUS_TONE,
      pulse = false
    ): void => {
      const t = STATUS_TONE[tone]
      status.className = `${BADGE} ${t.text}`
      status.replaceChildren(
        el('span', `shrink-0 w-1.5 h-1.5 rounded-full ${t.dot}${pulse ? ' status-pulse' : ''}`),
        el('span', '', text)
      )
    }
    const appliedNow = currentResult !== undefined && appliedResults.has(currentResult)
    for (const { id, status } of boardRows) {
      // 생성 중에는 보드 전체가 "지금 작동 중"으로 — 깜빡이는 도트로 시스템이 살아있음을 알린다.
      if (isGenerating) {
        if (id === 'lua') {
          setStatusPill(status, 'Generating…', 'amber', true)
        } else if (id === 'files') {
          setStatusPill(status, '—', 'gray')
        } else if (id === 'verify') {
          setStatusPill(status, 'Validating…', 'amber', true)
        } else {
          setStatusPill(status, 'Pending', 'gray')
        }
        continue
      }
      if (id === 'lua') {
        setStatusPill(status, currentResult ? 'Completed' : 'Ready', currentResult ? 'green' : 'gray')
      } else if (id === 'files') {
        setStatusPill(status, currentResult ? '1개' : '0개', currentResult ? 'neutral' : 'gray')
      } else if (id === 'verify') {
        // 퀘스트 모드면 드라이런 통과/실패를 우선 표시, 아니면 기존 자동 검증 배지.
        if (currentDryRun) {
          setStatusPill(status, currentDryRun.ok ? '검증 통과' : '검증 실패', currentDryRun.ok ? 'green' : 'red')
        } else if (!currentResult) {
          setStatusPill(status, '0 Errors', 'gray')
        } else if (currentResult.issues.length === 0) {
          setStatusPill(status, 'Passed', 'green')
        } else {
          setStatusPill(status, `${currentResult.issues.length} Issues`, 'amber')
        }
      } else {
        setStatusPill(
          status,
          !currentResult ? 'Ready' : appliedNow ? '적용 완료' : '적용 전',
          appliedNow ? 'green' : !currentResult ? 'gray' : 'amber'
        )
      }
    }
    // 빈 상태의 '오늘 작업' 요약(이번 세션 집계) + 최근 작업 목록.
    statGen.textContent = String(sessionTally.generations)
    statPass.textContent = String(sessionTally.validatorPasses)
    statApply.textContent = String(appliedCount)
    // 작업 로그(표시 전용) — 실제 history를 타임라인으로. 각 결과의 첫 등장 시각(Date)을 기억해
    // 타임라인은 절대 시각(HH:MM), 'Last Generated'는 상대 시각으로 보여준다. 빈 상태는 가짜 샘플 대신
    // 정직한 안내. newest = history[0](생성 시 맨 앞에 prepend됨).
    // Last Generated — 생성 history 기준 상대 시각(생성 결과의 첫 등장 시각을 기억).
    if (history.length === 0) {
      lastGeneratedLine.hidden = true
    } else {
      let newest = resultTimes.get(history[0].result)
      if (newest === undefined) {
        newest = new Date()
        resultTimes.set(history[0].result, newest)
      }
      lastGeneratedLine.hidden = false
      lastGeneratedValue.textContent = formatRelativeTime(newest)
    }
    // 액티비티 피드 — 선택·생성·검증·적용 이벤트를 시간순으로(최신이 위). 비면 정직한 안내.
    if (activityLog.length === 0) {
      recentList.replaceChildren(
        el('div', 'py-0.5 text-[11px] leading-none text-[#777777] opacity-70', '아직 활동 기록이 없습니다')
      )
    } else {
      recentList.replaceChildren(
        ...activityLog.slice(0, 12).map((entry) => {
          const rowItem = el('div', 'flex items-center gap-2')
          rowItem.append(
            el('span', 'shrink-0 w-1.5 h-1.5 rounded-full bg-[#b6bac1]/80'),
            el('span', 'shrink-0 text-[10px] leading-none tabular-nums text-[#b6bac1]/80', formatClock(entry.time)),
            el('span', 'truncate text-[11px] leading-none text-[#9d9d9d]', entry.text)
          )
          return rowItem
        })
      )
    }
    luaStatus.hidden = currentResult !== undefined
    result.hidden = currentResult === undefined
    result.textContent = currentResult ? currentResult.preview : ''
    renderQuestObjectives() // legend 퀘스트면 달성 조건(타깃 에셋 파란 링크) 표시
    filesStatus.textContent = currentResult
      ? `${currentResult.exportFileExtension === 'lua' ? 'Lua 코드' : '이벤트'}: ${currentResult.label}`
      : '변경 파일 없음'
    if (!currentResult) {
      applyStatus.className = 'text-[12px] text-[#9d9d9d]'
      applyStatus.textContent = '대기 중'
    } else if (appliedResults.has(currentResult)) {
      applyStatus.className = 'text-[12px] text-[#8fc96a]'
      applyStatus.textContent = '적용 완료'
    } else {
      applyStatus.className = 'text-[12px] text-[#9d9d9d]'
      applyStatus.textContent = '적용 전'
    }
    // 최근 생성 결과 표시(표시 전용): 실제 결과 우선, 없으면 발표용 예시 한 줄.
    recentResultLine.textContent = currentResult
      ? `최근 생성 결과 · "${currentResult.label}" 이벤트가 생성되었습니다.`
      : '최근 생성 결과 · "마법사가 플레이어에게 마을 북쪽 숲의 위험을 경고하는 대사가 생성되었습니다."'
    // 결과가 생겼는데 아직 아무 항목도 안 골랐으면 Lua 코드 상세를 자동으로 연다.
    if (currentResult && activeBoardTab === undefined) {
      activeBoardTab = 'lua'
    }
    updateBoard()
    // 퀘스트 후보 카드의 선택/버튼 상태를 현재 상태에 맞춰 다시 그린다(표시 전용).
    if (candidateMode) {
      renderCandidates()
    }
    // 표시 전용 UI 동기화: 요약 카드 · 맵 탭 강조 · 진행 단계 바 · 맵 통계.
    updatePreviewStats()
    updateSummary()
    updateSelectionNameplate()
    updateSceneTabs()
    updateStepBar()
    renderEvaluation()
    renderHistory()
  }

  // ---------- 퀘스트 모드: 1단계 후보 ↔ 2단계 후보로 생성 + 드라이런 검증 ----------
  const CANDIDATE_CARD =
    'w-full flex flex-col gap-1 rounded-xl border border-[#b6bac1]/22 bg-[#1a1a1c] px-3 py-2.5 text-left transition hover:border-[#b6bac1]/70 hover:bg-[#242427]'
  const CANDIDATE_CARD_ACTIVE =
    'w-full flex flex-col gap-1 rounded-xl border border-[#b6bac1] bg-[#34363a] px-3 py-2.5 text-left shadow-[0_0_10px_rgba(255,255,255,0.3)]'

  // 1단계: 자연어 후보 N개 생성(피드백이 있으면 재생성). 결과 보드의 '퀘스트 후보' 상세에 카드로 뜬다.
  const runGenerateCandidates = async (
    feedback?: GenerationFeedback
  ): Promise<void> => {
    // game은 let이라 TS가 game.profile을 좁혀주지 못한다 — const로 캡처해 좁힌다.
    const profile = game.profile
    if (!profile) {
      setStatus('이 게임의 구조 프로필이 없습니다.')
      return
    }
    isGenerating = true
    const filesAtStart = currentFiles
    setStatus('퀘스트 후보 생성 중...')
    activeBoardTab = 'candidates'
    render()

    try {
      const result = await generateQuestCandidates({
        apiKey: '',
        userPrompt: promptInput.value,
        profile,
        entity: selectedEntity,
        gameContext: currentAnalysis
          ? `${currentAnalysis.game_name} (${currentAnalysis.engine}). 콘텐츠 모델: ${currentAnalysis.content_model}`
          : undefined,
        feedback
      })
      if (currentFiles !== filesAtStart) {
        return
      }
      candidates = result
      selectedCandidateIndex = undefined
      editingCandidateIndex = undefined
      currentResult = undefined
      currentDryRun = undefined
      setStatus(
        result.length > 0
          ? `후보 ${result.length}개 생성됨 — 하나를 골라 "이 후보로 생성"을 누르세요.`
          : '후보를 생성하지 못했습니다. 다시 시도하세요.'
      )
    } catch (error) {
      if (currentFiles !== filesAtStart) {
        return
      }
      setStatus(`후보 생성 실패: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      isGenerating = false
      render()
    }
  }

  const runRegenerateCandidates = async (): Promise<void> => {
    if (isGenerating) {
      return
    }
    candidateIteration += 1
    await runGenerateCandidates({
      previousOutput: JSON.stringify(candidates),
      validatorIssues: [],
      rejectionReason: '다른 방향의 후보들로 다시 제안해줘',
      iteration: candidateIteration
    })
  }

  // 2단계: 고른 후보로만 실제 이벤트 JSON 생성 → 드라이런 검증 → 통과 시 적용 가능.
  const runGenerateFromCandidate = async (): Promise<void> => {
    if (isGenerating || selectedCandidateIndex === undefined) {
      return
    }
    const candidate = candidates[selectedCandidateIndex]
    if (!candidate) {
      return
    }
    // 프로필이 있는 게임(my-sample-rpg)은 "목표 포함 진짜 퀘스트"를 생성한다. 예전엔 후보 흐름도
    // game.adapter.generate(이벤트)로 빠져 퀘스트가 안 만들어졌고 B창·NPC "?"에 안 떴다(회귀).
    // 5eb6f9e의 퀘스트 경로를 복원한다. 프로필이 없는 게임(legend 등)은 기존 이벤트 경로를 유지한다.
    const profile = game.profile
    const selectedNpcId =
      selectedEntity?.kind === 'npc' ? selectedEntity.id : undefined
    isGenerating = true
    const filesAtStart = currentFiles
    setStatus(
      profile
        ? `"${candidate.title}" 후보로 퀘스트 생성 중...`
        : `"${candidate.title}" 후보로 이벤트 생성 중...`
    )
    render()

    try {
      if (profile) {
        // 퀘스트 모드: 후보로 진짜 퀘스트 JSON을 생성한다(대사 이벤트가 아님).
        const quest = await generateQuestJson({
          apiKey: '',
          userPrompt: promptInput.value,
          profile,
          candidate,
          entity: selectedEntity
        })
        if (currentFiles !== filesAtStart) {
          return
        }
        // 무결성 검증(드라이런): 목표/기버/보상 타깃이 런타임에서 추적되는 값인지 단계별 점검.
        currentDryRun = dryRunQuestApply(quest, profile, {
          selectedEntityId: selectedNpcId
        })
        const issues = createGeneratedQuestValidationIssues(quest, profile, {
          selectedEntityId: selectedNpcId
        }).map((issue) => `${issue.path} - ${issue.message}`)
        // apply는 런타임 퀘스트로 변환·저장(localStorage) → 게임이 storage 이벤트로 등록한다.
        const result: GenerationResult = {
          label: quest.title || quest.quest_id,
          preview: JSON.stringify(quest, null, 2),
          issues,
          apply: () => {
            replacePendingQuests([
              convertGeneratedQuestToDefinition(quest, profile)
            ])
          },
          bridgePayload: null
        }
        currentResult = result
        historyCounter += 1
        history = [{ n: historyCounter, result }, ...history].slice(0, HISTORY_LIMIT)
        sessionTally = {
          generations: sessionTally.generations + 1,
          validatorPasses:
            sessionTally.validatorPasses + (result.issues.length === 0 ? 1 : 0)
        }
        activeBoardTab = 'verify'
        setStatus(
          currentDryRun && !currentDryRun.ok
            ? `생성됨 — 무결성 검증 실패. '검증 결과'에서 위치를 확인하고 다시 시도하세요.`
            : `생성 완료: ${result.label} — 무결성 검증 통과`
        )
      } else {
        const result = await game.adapter.generate({
          apiKey: '',
          userPrompt: promptInput.value,
          entity: selectedEntity,
          profile: game.profile,
          candidate,
          gameContext: currentAnalysis
            ? `${currentAnalysis.game_name} (${currentAnalysis.engine}). 콘텐츠 모델: ${currentAnalysis.content_model}`
            : undefined
        })
        if (currentFiles !== filesAtStart) {
          return
        }
        currentResult = result
        // 무결성 검증(드라이런): 이벤트 JSON을 복제 스냅샷에 시험 적용해 통과/실패·위치를 보고한다.
        currentDryRun =
          result.eventJson && game.profile
            ? dryRunEventApply(result.eventJson, game.profile)
            : undefined
        historyCounter += 1
        history = [{ n: historyCounter, result }, ...history].slice(0, HISTORY_LIMIT)
        sessionTally = {
          generations: sessionTally.generations + 1,
          validatorPasses:
            sessionTally.validatorPasses + (result.issues.length === 0 ? 1 : 0)
        }
        activeBoardTab = 'verify'
        setStatus(
          currentDryRun && !currentDryRun.ok
            ? `생성됨 — 무결성 검증 실패. '검증 결과'에서 위치를 확인하고 다시 시도하세요.`
            : `생성 완료: ${result.label} — 무결성 검증 통과`
        )
      }
    } catch (error) {
      if (currentFiles !== filesAtStart) {
        return
      }
      setStatus(`생성 실패: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      isGenerating = false
      render()
    }
  }

  // 후보 카드 렌더(상태 훅에 할당). 카드 클릭=선택, 수정=요약 인라인 편집, 하단에 생성/재생성 버튼.
  renderCandidates = (): void => {
    candidatesView.body.replaceChildren()
    if (candidates.length === 0) {
      candidatesView.body.append(
        el(
          'div',
          'text-[12px] text-[#9d9d9d]',
          isGenerating ? '후보 생성 중...' : '후보가 없습니다. "만들기"로 후보를 만드세요.'
        )
      )
      return
    }
    candidates.forEach((candidate, index) => {
      const selected = index === selectedCandidateIndex
      const card = el('div', selected ? CANDIDATE_CARD_ACTIVE : CANDIDATE_CARD)
      const header = el('div', 'flex items-center gap-2')
      const titleEl = el('div', 'flex-1 text-[13px] font-semibold text-[#d4d7dc] truncate')
      titleEl.textContent = candidate.title || `후보 ${index + 1}`
      const editBtn = el(
        'button',
        'shrink-0 text-[11px] text-[#9d9d9d] transition hover:text-[#d4d7dc]',
        editingCandidateIndex === index ? '완료' : '수정'
      ) as HTMLButtonElement
      editBtn.type = 'button'
      editBtn.addEventListener('click', (event) => {
        event.stopPropagation()
        editingCandidateIndex = editingCandidateIndex === index ? undefined : index
        renderCandidates()
      })
      header.append(titleEl, editBtn)
      card.append(header)
      if (editingCandidateIndex === index) {
        const textarea = el(
          'textarea',
          `${FIELD_INPUT} min-h-[64px] text-[12px] leading-[1.5]`
        ) as HTMLTextAreaElement
        textarea.value = candidate.summary
        textarea.addEventListener('click', (event) => event.stopPropagation())
        textarea.addEventListener('input', () => {
          candidates[index] = { ...candidate, summary: textarea.value }
        })
        card.append(textarea)
      } else {
        const summaryEl = el(
          'div',
          'text-[12px] leading-[1.5] text-[#bfbfbf] whitespace-pre-wrap'
        )
        summaryEl.textContent = candidate.summary
        card.append(summaryEl)
      }
      if (candidate.target_hint) {
        const chip = el(
          'span',
          'self-start rounded-full px-2 py-0.5 text-[10px] leading-none text-[#b6bac1] bg-[#b6bac1]/10 border border-[#b6bac1]/25'
        )
        chip.textContent = `대상: ${candidate.target_hint}`
        card.append(chip)
      }
      card.addEventListener('click', () => {
        selectedCandidateIndex = index
        renderCandidates()
        render()
      })
      candidatesView.body.append(card)
    })
    const actionRow = el('div', 'flex flex-wrap items-center gap-2 pt-1')
    const genFromBtn = el('button', APPLY_BUTTON, '이 후보로 생성') as HTMLButtonElement
    genFromBtn.type = 'button'
    genFromBtn.disabled = selectedCandidateIndex === undefined || isGenerating
    genFromBtn.addEventListener('click', () => void runGenerateFromCandidate())
    const regenBtn = el('button', GHOST_BUTTON, '후보 다시 제안') as HTMLButtonElement
    regenBtn.type = 'button'
    regenBtn.disabled = isGenerating
    regenBtn.addEventListener('click', () => void runRegenerateCandidates())
    actionRow.append(genFromBtn, regenBtn)
    candidatesView.body.append(actionRow)
  }

  // NPC 추가(my-sample-rpg): 자연어로 NPC 한 명을 생성한다. '적용'이 게임 iframe에 editor:spawn-npc를
  // 보내면, 실행 중인 게임이 플레이어 옆 빈 칸에 실제 CharacterState로 스폰한다(대사 상호작용 포함).
  // 시나리오 v2: 자연어 → 2단계 생성(골격→장면) → 결정적 그래프 검증 → 적용(localStorage 주입).
  // "시나리오를 뽑고, 실제 데이터로 만들어, 게임에 적용"의 전체 고리다.
  type ScenarioDemoIssues = ReturnType<typeof createScenarioValidationIssues>

  const createScenarioGenerationResult = ({
    scenario,
    source,
    llmCalls,
    issues
  }: {
    scenario: GeneratedScenarioJson
    source: ScenarioDemoSource
    llmCalls: number
    issues: ScenarioDemoIssues
  }): GenerationResult => {
    const report = createScenarioDemoReport({ scenario, source, llmCalls, issues })
    const flowSummary = scenario.scenes
      .map((scene) => {
        const last = scene.steps.at(-1)
        const to =
          last?.type === 'goto'
            ? `→ ${last.scene}`
            : last?.type === 'branch'
              ? `→ ${last.then_scene} | ${last.else_scene}`
              : last?.type === 'choice'
                ? `→ ${last.options.map((option) => option.goto).join(' | ')}`
                : '→ (끝)'
        return `  ${scene.id} (${scene.steps.length}스텝) ${to}`
      })
      .join('\n')
    const warnings = issues.filter((issue) => issue.severity === 'warning')
    const preview = [
      formatScenarioDemoReport(report),
      '',
      formatScenarioAsText(scenario),
      '',
      `제목: ${scenario.title}`,
      `트리거: ${scenario.trigger.npc_id} 에게 말 걸기`,
      `플래그: ${scenario.flags.join(', ') || '(없음)'}`,
      `장면 흐름 (진입: ${scenario.entry_scene})`,
      flowSummary,
      '',
      JSON.stringify(scenario, null, 2)
    ].join('\n')

    return {
      label: scenario.title || scenario.scenario_id,
      preview,
      issues: warnings.map((issue) => `${issue.path} - ${issue.message}`),
      // 적용: localStorage 에 저장 → 게임이 storage 이벤트로 등록소를 갱신 →
      // 다음 상호작용부터 그 NPC 가 이 시나리오를 실행한다(새로고침 불필요).
      apply: () => {
        appendPendingScenario(scenario)
      },
      bridgePayload: null
    }
  }

  const commitScenarioResult = ({
    scenario,
    source,
    llmCalls,
    issues,
    countAsGeneration
  }: {
    scenario: GeneratedScenarioJson
    source: ScenarioDemoSource
    llmCalls: number
    issues: ScenarioDemoIssues
    countAsGeneration: boolean
  }): GenerationResult => {
    const errors = issues.filter((issue) => issue.severity === 'error')
    if (errors.length > 0) {
      throw new ScenarioGenerationError('시나리오 데모가 검증을 통과하지 못했습니다.', errors)
    }

    const result = createScenarioGenerationResult({ scenario, source, llmCalls, issues })
    currentDryRun = undefined
    currentResult = result
    historyCounter += 1
    history = [{ n: historyCounter, result }, ...history].slice(0, HISTORY_LIMIT)
    if (countAsGeneration) {
      sessionTally = {
        generations: sessionTally.generations + 1,
        validatorPasses: sessionTally.validatorPasses + 1
      }
    }
    activeBoardTab = 'verify'
    logActivity(
      source === 'fixed' ? '고정 데모 시나리오 로드' : `"${result.label}" 시나리오 생성`
    )
    return result
  }

  const runGenerateScenario = async (): Promise<void> => {
    isGenerating = true
    const filesAtStart = currentFiles
    setStatus('시나리오 생성 시작…')
    render()

    try {
      const generated = await generateScenarioWithLlm({
        request: promptInput.value,
        registry: MY_SAMPLE_RPG_SCENARIO_REGISTRY,
        onProgress: (message) => {
          setStatus(message)
        }
      })
      if (currentFiles !== filesAtStart) {
        return
      }

      const scenario = generated.scenario
      const result = commitScenarioResult({
        scenario,
        source: 'generated',
        llmCalls: generated.llmCalls,
        issues: generated.issues,
        countAsGeneration: true
      })
      const warnings = generated.issues.filter((issue) => issue.severity === 'warning')
      setStatus(
        `생성 완료: ${result.label} — 검증 통과(경고 ${warnings.length}건). ` +
          `'적용'하면 ${scenario.trigger.npc_id} 에게 말 걸 때 실행됩니다`
      )
    } catch (error) {
      if (currentFiles !== filesAtStart) {
        return
      }
      if (error instanceof ScenarioGenerationError) {
        // 검증을 못 넘은 생성물 — dry-run 게이트가 Apply 를 막은 것. 이슈를 그대로 보여준다.
        sessionTally = {
          generations: sessionTally.generations + 1,
          validatorPasses: sessionTally.validatorPasses
        }
        setStatus(`생성 실패(검증 미통과): ${error.message}`)
      } else {
        setStatus(`생성 실패: ${error instanceof Error ? error.message : String(error)}`)
      }
    } finally {
      isGenerating = false
      render()
    }
  }

  const loadScenarioDemo = (): void => {
    if (isGenerating) {
      return
    }

    const issues = createScenarioValidationIssues(
      SHELL_GAME_SCENARIO,
      MY_SAMPLE_RPG_SCENARIO_REGISTRY
    )
    activeSuggestion = '시나리오'
    candidateMode = false
    npcMode = false
    fillPrompt(SCENARIO_DEMO_PROMPT)
    updateQuickCards()

    try {
      const result = commitScenarioResult({
        scenario: SHELL_GAME_SCENARIO,
        source: 'fixed',
        llmCalls: 0,
        issues,
        countAsGeneration: false
      })
      render()
      setStatus(`고정 데모 준비 완료: ${result.label} — 검증 통과. '적용'을 눌러 게임에서 실행하세요`)
    } catch (error) {
      setStatus(`고정 데모 준비 실패: ${error instanceof Error ? error.message : String(error)}`)
      render()
    }
  }

  const runGenerateNpc = async (): Promise<void> => {
    isGenerating = true
    const filesAtStart = currentFiles
    setStatus('NPC 생성 중…')
    render()

    try {
      const npc = await generateNpcJson({
        apiKey: '',
        userPrompt: promptInput.value
      })
      if (currentFiles !== filesAtStart) {
        return
      }
      const result: GenerationResult = {
        label: npc.name || 'NPC',
        preview: JSON.stringify(npc, null, 2),
        // 외형은 스키마 enum으로 그라운딩, 대사는 자유 텍스트라 결정적 검증 이슈는 없다.
        issues: [],
        // 적용: 실행 중인 게임(iframe)에 스폰 요청을 보낸다. 같은 origin이라 postMessage로 충분하다.
        apply: () => {
          iframe.contentWindow?.postMessage(
            {
              type: 'editor:spawn-npc',
              npc: {
                appearanceType: npc.appearance_type,
                name: npc.name,
                dialogueLines: npc.dialogue_lines
              }
            },
            '*'
          )
        },
        bridgePayload: null
      }
      currentDryRun = undefined
      currentResult = result
      historyCounter += 1
      history = [{ n: historyCounter, result }, ...history].slice(0, HISTORY_LIMIT)
      sessionTally = {
        generations: sessionTally.generations + 1,
        validatorPasses: sessionTally.validatorPasses + 1
      }
      activeBoardTab = 'verify'
      logActivity(`"${result.label}" NPC 생성`)
      setStatus(`생성 완료: ${result.label} — '적용'하면 플레이어 옆에 스폰됩니다`)
    } catch (error) {
      if (currentFiles !== filesAtStart) {
        return
      }
      setStatus(`생성 실패: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      isGenerating = false
      render()
    }
  }

  // 자연어 라우터가 고른 즉시 실행 작업도 기존 결과 보드/적용 파이프라인에 올린다.
  const commitActionResult = (
    result: GenerationResult,
    activity: string,
    message: string
  ): void => {
    currentDryRun = undefined
    currentResult = result
    historyCounter += 1
    history = [{ n: historyCounter, result }, ...history].slice(0, HISTORY_LIMIT)
    sessionTally = {
      generations: sessionTally.generations + 1,
      validatorPasses: sessionTally.validatorPasses + 1
    }
    activeBoardTab = 'verify'
    logActivity(activity)
    setStatus(message)
  }

  const runGenerate = async (): Promise<void> => {
    if (isGenerating) {
      return
    }

    if (promptInput.value.trim().length === 0) {
      setStatus('생성할 내용을 자연어 프롬프트에 입력하세요.')
      return
    }

    // 모든 자연어 요청은 먼저 로컬 LLM이 에디터 도구를 고른다. 퀘스트/NPC 빠른시작은
    // 모델에게 힌트로만 전달하고, 사용자가 프롬프트를 바꾸면 그 의도가 우선한다.
    {
      isGenerating = true
      const filesAtStart = currentFiles
      setStatus('에디터 작업 판단 중…')
      render()

      try {
        const editorGeneratedNpcs = game.maps.flatMap((map) => placedNpcEntities(map.id))
        const entities = game.maps
          .flatMap((map) => map.entities.concat(placedNpcEntities(map.id)))
          .filter((entity) => !isTileClusterEntity(entity))
        const scenes =
          game.adapter.id === 'my-sample-rpg'
            ? previewScenes.map(({ id, label }) => ({ id, label }))
            : game.maps.map((map) => ({ id: map.id, label: map.name }))
        const action = await decideEditorAction({
          userPrompt: promptInput.value,
          gameName: game.adapter.name,
          selectedEntity,
          entities,
          editorGeneratedNpcs,
          scenes,
          modeHint: candidateMode ? '퀘스트 빠른 시작' : npcMode ? 'NPC 추가 빠른 시작' : undefined
        })
        if (currentFiles !== filesAtStart) {
          return
        }

        if (
          ![
            'create_npc',
            'delete_npc',
            'create_quest',
            'create_scenario',
            'switch_scene',
            'generate_content',
            'other'
          ].includes(action.action) ||
          typeof action.target_id !== 'string' ||
          typeof action.scene_id !== 'string'
        ) {
          throw new Error('에디터 작업 판별 결과가 올바르지 않습니다.')
        }

        if (action.action === 'create_npc') {
          if (game.adapter.id !== 'my-sample-rpg') {
            setStatus('현재 연결된 게임은 라이브 NPC 생성을 지원하지 않습니다.')
            return
          }
          candidateMode = false
          npcMode = true
          isGenerating = false
          render()
          await runGenerateNpc()
          return
        }

        if (action.action === 'create_scenario') {
          if (game.adapter.id !== 'my-sample-rpg') {
            setStatus('현재 연결된 게임은 시나리오 생성을 지원하지 않습니다.')
            return
          }
          candidateMode = false
          npcMode = false
          isGenerating = false
          render()
          await runGenerateScenario()
          return
        }

        if (action.action === 'create_quest') {
          if (!game.profile) {
            setStatus('현재 연결된 게임은 퀘스트 생성 프로필이 없습니다.')
            return
          }
          candidateMode = true
          npcMode = false
          isGenerating = false
          render()
          await runGenerateCandidates()
          return
        }

        if (action.action === 'switch_scene') {
          const targetScene = scenes.find((scene) => scene.id === action.scene_id)
          if (!targetScene) {
            setStatus('전환할 씬 이름을 확인할 수 없습니다. 마을·사냥터·동굴 중에서 지정하세요.')
            return
          }
          candidateMode = false
          npcMode = false
          const result: GenerationResult = {
            label: '씬 전환 · ' + targetScene.label,
            preview: JSON.stringify(
              { action: 'switch_scene', scene_id: targetScene.id },
              null,
              2
            ),
            issues: [],
            apply: () => {
              currentMapId = targetScene.id
              if (game.adapter.id === 'my-sample-rpg') {
                iframe.contentWindow?.postMessage(
                  { type: 'editor:switch-scene', sceneId: targetScene.id },
                  '*'
                )
              } else {
                iframe.contentWindow?.postMessage(
                  {
                    type: 'editor:goto-map',
                    mapId: targetScene.id,
                    mapName: targetScene.label
                  },
                  '*'
                )
              }
              renderTree()
              render()
            },
            bridgePayload: null
          }
          commitActionResult(
            result,
            '씬 전환 판단 — ' + targetScene.label,
            '씬 확인: ' + targetScene.label + " — '적용'을 누르면 전환됩니다"
          )
          return
        }

        if (action.action === 'delete_npc') {
          const selectedEntityId = selectedEntity?.id
          const selectedNpc = selectedEntityId
            ? editorGeneratedNpcs.find((npc) => npc.id === selectedEntityId)
            : undefined
          const target = action.target_id
            ? editorGeneratedNpcs.find((npc) => npc.id === action.target_id)
            : selectedNpc

          if (game.adapter.id !== 'my-sample-rpg') {
            setStatus('현재 연결된 게임은 에디터 NPC 삭제를 지원하지 않습니다.')
            return
          }
          if (!target) {
            setStatus('삭제할 에디터 생성 NPC를 선택하거나 이름을 정확히 입력하세요.')
            return
          }
          candidateMode = false
          npcMode = false

          const result: GenerationResult = {
            label: 'NPC 삭제 · ' + target.name,
            preview: JSON.stringify(
              { action: 'delete_npc', target_id: target.id, map_id: target.mapId },
              null,
              2
            ),
            issues: [],
            // 실제 삭제는 기존 적용 버튼을 누를 때만 실행한다. 실수로 모델이 고른 대상을 즉시 지우지 않는다.
            apply: () => {
              removeNpc(target.mapId, target.id)
              if (selectedEntity?.id === target.id) {
                selectedEntity = undefined
              }
              renderTree()
              render()
            },
            bridgePayload: null
          }
          commitActionResult(
            result,
            '"' + target.name + '" NPC 삭제 판단',
            '삭제 대상 확인: ' + target.name + " — '적용'을 누르면 삭제됩니다"
          )
          return
        }

        if (action.action === 'other') {
          setStatus('이 요청은 현재 에디터에서 실행할 수 있는 작업으로 해석되지 않았습니다.')
          return
        }

        candidateMode = false
        npcMode = false
      } catch (error) {
        if (currentFiles !== filesAtStart) {
          return
        }
        setStatus(
          '에디터 작업 판단 실패: ' + (error instanceof Error ? error.message : String(error))
        )
        return
      } finally {
        isGenerating = false
        render()
      }
    }

    isGenerating = true
    // 생성은 비동기다. 도중에 다른 프로젝트를 열거나(runOpenProject) 복귀(runReset)하면, 늦게 도착한
    // 이 결과를 새 게임에 섞으면 안 된다(히스토리/집계 오염 + 옛 게임에 묶인 apply() 클로저). 시작 시점의
    // 프로젝트 정체성을 캡처해 커밋 전에 검사한다(runAnalyze의 filesAtStart 가드와 동일).
    const filesAtStart = currentFiles
    setStatus('Lua 스크립트 생성 중…')
    render()

    try {
      const result = await game.adapter.generate({
        apiKey: '',
        userPrompt: promptInput.value,
        entity: selectedEntity,
        profile: game.profile,
        gameContext: currentAnalysis
          ? `${currentAnalysis.game_name} (${currentAnalysis.engine}). 콘텐츠 모델: ${currentAnalysis.content_model}`
          : undefined
      })
      // 생성 중 프로젝트가 바뀌었으면 이 결과는 버린다.
      if (currentFiles !== filesAtStart) {
        return
      }
      currentResult = result
      historyCounter += 1
      history = [{ n: historyCounter, result }, ...history].slice(0, HISTORY_LIMIT)
      // 세션 지표 집계: 생성 1건 + (Validator 통과면) 통과 1건.
      sessionTally = {
        generations: sessionTally.generations + 1,
        validatorPasses: sessionTally.validatorPasses + (result.issues.length === 0 ? 1 : 0)
      }
      // 액티비티 피드: 생성 → 검증 순으로 기록(최신이 위라 검증이 생성 위에 쌓인다).
      logActivity(`"${result.label}" 생성`)
      logActivity(
        result.issues.length === 0 ? '검증 통과' : `검증 ${result.issues.length}건 확인 필요`
      )
      setStatus(
        `생성 완료 · ${result.issues.length === 0 ? '검증 통과' : `검증 ${result.issues.length}건 확인 필요`} — ${result.label}`
      )
    } catch (error) {
      // 프로젝트가 바뀐 뒤 도착한 실패는 새 게임의 상태를 건드리지 않는다.
      if (currentFiles !== filesAtStart) {
        return
      }
      const message = error instanceof Error ? error.message : String(error)
      logActivity('생성 실패 — 요청을 수정해 다시 시도하세요')
      setStatus(`생성 실패: ${message}`)
    } finally {
      // isGenerating은 이 호출이 소유하므로 항상 해제하고 다시 그린다. 프로젝트가 바뀌었어도 render()는
      // 현재(=새) 게임 상태를 그대로 반영하므로 안전하다(생성 버튼 disabled 갱신 등).
      isGenerating = false
      render()
    }
  }

  const runApply = (): void => {
    // 버튼이 항상 눌러지므로(생성 중 제외), 여기서 단계별로 친절히 안내한다.
    if (isGenerating) {
      return
    }
    if (!currentResult) {
      setStatus('먼저 콘텐츠를 생성한 뒤 적용할 수 있습니다.')
      return
    }
    if (candidateMode && currentDryRun?.ok !== true) {
      setStatus('무결성 검증을 통과해야 게임에 적용할 수 있습니다.')
      return
    }
    if (!currentResult.apply) {
      setStatus('이 결과는 라이브 적용을 지원하지 않습니다 (미리보기로 확인하세요).')
      return
    }

    // apply()는 localStorage 저장을 동반해 실패할 수 있다. 조용히 죽지 않고 상태로 알린다.
    try {
      const appliedLabel = currentResult.label
      currentResult.apply()
      // 결과 보드 "적용 상태"·'오늘 작업' 갱신용 표시 전용 기록.
      appliedResults.add(currentResult)
      appliedCount += 1
      logActivity(`게임에 적용 — ${appliedLabel}`)
      render()
      setStatus('게임에 적용됨 — 오른쪽 라이브 프리뷰에 즉시 반영됩니다.')
    } catch (error) {
      logActivity('적용 실패')
      setStatus(`적용 실패: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const runCopy = async (): Promise<void> => {
    if (isGenerating) {
      return
    }
    if (!currentResult) {
      setStatus('복사할 결과가 없습니다 — 먼저 콘텐츠를 생성하세요.')
      return
    }

    // clipboard API는 비보안 컨텍스트·권한 거부에서 없거나 reject될 수 있어 방어한다.
    try {
      await navigator.clipboard.writeText(currentResult.preview)
      setStatus('생성 결과를 클립보드에 복사했습니다.')
    } catch {
      setStatus('클립보드 복사에 실패했습니다(브라우저 권한/보안 컨텍스트 확인).')
    }
  }

  const runClearHistory = (): void => {
    history = []
    historyCounter = 0
    renderHistory()
    setStatus('생성 히스토리를 비웠습니다.')
  }

  const runExport = (): void => {
    if (isGenerating) {
      return
    }
    if (!currentResult) {
      setStatus('내보낼 결과가 없습니다 — 먼저 콘텐츠를 생성하세요.')
      return
    }

    // preview 가 순수 JSON 이면 .json, 대본 텍스트가 섞인 결과(시나리오 등)면 .txt 로 저장한다.
    let isJson = true
    try {
      JSON.parse(currentResult.preview)
    } catch {
      isJson = false
    }
    const fileName = `${currentResult.label || 'generated'}.${isJson ? 'json' : 'txt'}`
    const blob = new Blob([currentResult.preview], {
      type: isJson ? 'application/json' : 'text/plain'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
    setStatus(`내보냄: ${fileName}`)
  }

  const runOpenProject = async (): Promise<void> => {
    try {
      const files = await openProjectDirectory()
      const loaded = loadGame(files)

      if (loaded.maps.length === 0) {
        setStatus('선택한 폴더에서 .tmx 맵을 찾지 못했습니다.')
        return
      }

      game = loaded
      currentFiles = files
      // 새 게임에 맞춰 프리뷰 iframe을 다시 가리키고(예: legend-of-lua면 love.js 빌드), 상단 맵/씬
      // 버튼도 그 게임의 실제 맵으로 다시 구성한다.
      syncPreviewToGame()
      currentMapId = undefined
      renderMapSwitcher()
      selectedEntity = undefined
      currentResult = undefined
      currentAnalysis = undefined
      // 퀘스트 모드 상태도 프로젝트 단위 — 새 게임에 옛 후보/검증이 묻어 나오지 않게 비운다.
      candidateMode = false
      candidates = []
      selectedCandidateIndex = undefined
      editingCandidateIndex = undefined
      candidateIteration = 0
      currentDryRun = undefined
      history = []
      historyCounter = 0
      activityLog.length = 0
      sessionTally = { generations: 0, validatorPasses: 0 }
      // 그룹 펼침 상태도 프로젝트 단위 — 맵 id(tmx 파일명)가 프로젝트끼리 겹쳐서, 안 비우면
      // 이전 게임에서 펼친 상태가 새 게임 트리에 그대로 묻어 나온다.
      expandedGroups.clear()
      renderTree()
      renderAnalysis()
      render()
      // 엔티티(어댑터가 찾은 개체)와 타일 구조물(보기 전용)을 나눠 세서, 수치가 부풀어 보이지 않게 한다.
      const allEntities = game.maps.flatMap((map) => map.entities)
      const tileCount = allEntities.filter(isTileClusterEntity).length
      const entityCount = allEntities.length - tileCount
      setStatus(
        `프로젝트 로드: ${game.adapter.name} · 맵 ${game.maps.length}개 · 엔티티 ${entityCount}개` +
          `${tileCount > 0 ? ` · 구조물 ${tileCount}개` : ''}${parseErrorNote()}`
      )
      // 프로젝트를 열면 고정된 로컬 LLM이 자동으로 구조를 분석한다.
      void runAnalyze()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      setStatus(error instanceof Error ? error.message : String(error))
    }
  }

  const runReset = (): void => {
    game = loadGame(initialFiles)
    currentFiles = initialFiles
    // 내 게임으로 복귀 — 프리뷰도 기본 게임 URL로, 맵/씬 버튼도 다시 구성한다.
    syncPreviewToGame()
    currentMapId = undefined
    renderMapSwitcher()
    selectedEntity = undefined
    currentResult = undefined
    currentAnalysis = undefined
    candidateMode = false
    candidates = []
    selectedCandidateIndex = undefined
    editingCandidateIndex = undefined
    candidateIteration = 0
    currentDryRun = undefined
    history = []
    historyCounter = 0
    activityLog.length = 0
    sessionTally = { generations: 0, validatorPasses: 0 }
    expandedGroups.clear()
    renderTree()
    renderAnalysis()
    render()
    setStatus(`내 게임으로 복귀했습니다.${parseErrorNote()}`)
  }

  resetButton.addEventListener('click', runReset)
  generateButton.addEventListener('click', () => {
    void runGenerate()
  })
  scenarioDemoButton.addEventListener('click', loadScenarioDemo)
  promptInput.addEventListener('input', () => {
    // 생성 버튼은 생성 중일 때만 잠근다 — 키·요청은 클릭 시 runGenerate가 안내(되게 눌러지게).
    generateButton.disabled = isGenerating
    // 글자수 카운터 + 자동 높이 갱신.
    promptCounter.textContent = `${promptInput.value.length}자`
    autoSizePrompt()
    updateStepBar()
  })
  // ⌘/Ctrl+Enter로 빠르게 생성(데모 흐름용). runGenerate가 자체 가드(키·프롬프트·생성중)를 가진다.
  promptInput.addEventListener('keydown', (event) => {
    // 한글 IME 조합 중의 Enter(후보 확정)는 가로채지 않는다 — 에디터 전체가 한국어 입력이다.
    if (event.isComposing) {
      return
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      void runGenerate()
    }
  })
  applyButton.addEventListener('click', runApply)
  copyButton.addEventListener('click', () => {
    void runCopy()
  })
  clearHistoryButton.addEventListener('click', runClearHistory)
  acceptButton.addEventListener('click', () => {
    runEvaluate('acceptable')
  })
  rejectButton.addEventListener('click', () => {
    runEvaluate('not_acceptable')
  })
  resetEvaluationsButton.addEventListener('click', runResetEvaluations)
  exportButton.addEventListener('click', runExport)
  // 폴더 열기/분석은 결과가 중앙(분석 패널·상태줄)에 나오므로, 설정 모달을 닫아 그걸 가리지 않게 한다.
  openButton.addEventListener('click', () => {
    closeSettings()
    void runOpenProject()
  })
  analyzeButton.addEventListener('click', () => {
    closeSettings()
    void runAnalyze()
  })
  popoutButton.addEventListener('click', () => {
    window.open(previewSrcForGame(), 'game-window', 'width=1280,height=720')
  })
  reloadButton.addEventListener('click', () => {
    previewLoading.style.display = 'flex'
    iframe.src = previewSrcForGame()
  })
  // 현재 맵만 ↔ 전체 맵 토글. 트리만 다시 그리되, 보이는 버튼의 선택 강조는 render()가 다시 입힌다.
  mapFilterToggle.addEventListener('click', () => {
    showAllMaps = !showAllMaps
    renderTree()
    render()
  })
  // 라이브 게임(iframe)이 맵을 바꾸면 그 맵의 요소만 트리에 보여준다. 게임은 bootstrapScene에서
  // 부모(에디터)로 'game:scene-changed'를 쏜다(초기 로드·포털 이동·맵 버튼 모두 포함).
  window.addEventListener('message', (event) => {
    // 게임 iframe에서 온 메시지만 신뢰한다(브라우저 확장 등 다른 출처 무시).
    if (event.source !== iframe.contentWindow) {
      return
    }
    const data = event.data as { type?: unknown; sceneId?: unknown } | null
    if (
      !data ||
      data.type !== 'game:scene-changed' ||
      typeof data.sceneId !== 'string' ||
      data.sceneId === currentMapId
    ) {
      return
    }
    currentMapId = data.sceneId
    if (!townStyleRun) styleChanges?.showMap(data.sceneId)
    updateSceneTabs()
    // 게임이 새 맵으로 가면 자동으로 그 맵에 다시 집중한다(전체 보기 해제).
    showAllMaps = false
    renderTree()
    render()
    // 이 맵의 묶인 오브젝트를 누끼로 추출해 둔다(맵당 1회, 실패해도 무시).
    // 스타일 모달 '추출' 탭·배치 팔레트·파이프라인 분기 B가 이 결과를 대상으로 쓴다.
    const changedMap = game.maps.find((candidate) => candidate.id === data.sceneId)
    if (changedMap && game.adapter.id !== 'crypt-crawler') {
      void requestMapObjectExtraction(changedMap, currentFiles)
    }
  })
  // '적용'으로 스폰된 NPC는 게임(iframe)이 localStorage(PENDING_NPCS_STORAGE_KEY)에 저장한다.
  // 같은 origin이라 부모(에디터) 창에 'storage' 이벤트가 오므로, 그때 트리를 다시 그려 새 NPC를
  // '인물' 목록에 바로 반영한다(부팅 때 굳은 map.entities에는 없으니 이 신호가 없으면 안 보인다).
  window.addEventListener('storage', (event) => {
    if (event.key === PENDING_NPCS_STORAGE_KEY) {
      renderTree()
      render()
    }
  })

  renderTree()
  renderAnalysis()
  render()
  // 'Last Generated' 상대 시각이 상호작용 없이도 흐르도록 30초마다 갱신(표시 전용).
  // 에디터는 페이지 수명 동안 한 번만 마운트되므로 별도 teardown 없이 둔다.
  window.setInterval(() => {
    if (history.length > 0) {
      const newest = resultTimes.get(history[0].result)
      if (newest) {
        lastGeneratedValue.textContent = formatRelativeTime(newest)
      }
    }
  }, 30_000)
  if (game.parseErrors.length > 0) {
    setStatus(`기본 맵 일부를 읽지 못했습니다${parseErrorNote()}`)
  }
  promptInput.focus()
}
