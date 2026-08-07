// StyleSpec — 시나리오 기반 스타일 명세(디벨롭 방향 8/6, Stage 1).
// 자유도는 concept/palette/material/lighting/motif까지만 — immutable(실루엣·타일 격자·
// 충돌·앵커·알파)은 LLM 출력이 무엇이든 클라이언트/서버 양쪽에서 상수로 강제한다.
// 코드 트랙의 `자연어 → EventSpec(JSON) → Lua`와 대칭 구조: `시나리오 → StyleSpec(JSON) → 렌더링`.

export const STYLE_SPEC_CATEGORIES = ['terrain_tile', 'object', 'character_sprite'] as const
export type StyleSpecCategory = (typeof STYLE_SPEC_CATEGORIES)[number]

// 서버(style_spec.py IMMUTABLE_FIELDS)와 동일해야 한다.
export const IMMUTABLE_FIELDS = [
  'silhouette',
  'tile_grid',
  'collision',
  'anchor_points',
  'alpha_mask'
] as const

export type StyleSpec = {
  style_id: string
  concept: string
  palette: { n_colors: number; anchors: string[] }
  material: string[]
  lighting: { key: string; ambient: string }
  motif: string[]
  per_category_prompt: Partial<Record<StyleSpecCategory, string>>
  style_strength: number
  negative_prompt: string
  immutable: string[]
}

// LLM 구조화 출력용 JSON 스키마 — immutable은 아예 스키마에 없다(스키마 수준 차단).
export const STYLE_SPEC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['style_id', 'concept', 'palette', 'style_strength'],
  properties: {
    style_id: {
      type: 'string',
      pattern: '^[a-z0-9][a-z0-9_-]{1,63}$',
      description: '스타일 식별자(영문 소문자 스네이크케이스, 예: ashen_ruins_v1)'
    },
    concept: { type: 'string', maxLength: 500, description: '시나리오에서 뽑은 핵심 컨셉 한 문장' },
    palette: {
      type: 'object',
      required: ['n_colors', 'anchors'],
      properties: {
        n_colors: { type: 'integer', minimum: 4, maximum: 64, description: '제한 팔레트 색 수(픽셀아트는 8~32 권장)' },
        anchors: {
          type: 'array',
          minItems: 2,
          maxItems: 16,
          items: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
          description: '팔레트 앵커 색상(hex). 어두운 색→밝은 색 순서'
        }
      }
    },
    material: {
      type: 'array',
      maxItems: 12,
      items: { type: 'string', maxLength: 200 },
      description: '재질 키워드(예: 재, 그을린 석재)'
    },
    lighting: {
      type: 'object',
      properties: {
        key: { type: 'string', maxLength: 200, description: '주광 묘사' },
        ambient: { type: 'string', maxLength: 200, description: '환경광 묘사' }
      }
    },
    motif: {
      type: 'array',
      maxItems: 12,
      items: { type: 'string', maxLength: 200 },
      description: '반복 모티프(예: 균열, 낙하하는 재)'
    },
    per_category_prompt: {
      type: 'object',
      additionalProperties: false,
      properties: {
        terrain_tile: { type: 'string', maxLength: 300, description: '지형 타일 전용 키워드 프롬프트(영어)' },
        object: { type: 'string', maxLength: 300, description: '오브젝트 전용 키워드 프롬프트(영어)' },
        character_sprite: { type: 'string', maxLength: 300, description: '캐릭터 전용 키워드 프롬프트(영어)' }
      },
      description: '카테고리별 전용 프롬프트 — 자연어 문장이 아니라 키워드 나열'
    },
    style_strength: {
      type: 'number',
      minimum: 0.1,
      maximum: 0.9,
      description: '스타일 강도 단일 노브(0.4~0.6 권장). 카테고리별 배율은 서버가 정한다'
    },
    negative_prompt: { type: 'string', maxLength: 300, description: '금지 요소(영어 키워드)' }
  }
} as const

const STYLE_ID_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/
const HEX_RE = /^#[0-9a-fA-F]{6}$/

export type StyleSpecIssue = { field: string; message: string }

const asStringArray = (value: unknown, max: number): string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim().slice(0, 200))
        .slice(0, max)
    : []

// LLM 출력(unknown)을 검증·정규화한다. 문제는 issues로 모으고, 복구 가능한 것은
// 기본값으로 채운다(생성→검증→적용 흐름의 검증 단계). immutable은 여기서 강제 주입.
export const normalizeStyleSpec = (
  raw: unknown
): { spec?: StyleSpec; issues: StyleSpecIssue[] } => {
  const issues: StyleSpecIssue[] = []
  if (raw === null || typeof raw !== 'object') {
    return { issues: [{ field: '(root)', message: 'StyleSpec이 객체가 아닙니다.' }] }
  }
  const input = raw as Record<string, unknown>

  const styleId = typeof input.style_id === 'string' ? input.style_id.trim() : ''
  if (!STYLE_ID_RE.test(styleId)) {
    issues.push({ field: 'style_id', message: '소문자/숫자/_/- 2~64자여야 합니다.' })
  }

  const concept = typeof input.concept === 'string' ? input.concept.trim() : ''
  if (concept.length === 0 || concept.length > 500) {
    issues.push({ field: 'concept', message: '컨셉이 비었거나 500자를 넘습니다.' })
  }

  const paletteRaw = (input.palette ?? {}) as Record<string, unknown>
  const nColors =
    typeof paletteRaw.n_colors === 'number' && Number.isInteger(paletteRaw.n_colors)
      ? paletteRaw.n_colors
      : 16
  const anchors = Array.isArray(paletteRaw.anchors)
    ? paletteRaw.anchors.filter(
        (color): color is string => typeof color === 'string' && HEX_RE.test(color)
      )
    : []
  if (nColors < 4 || nColors > 64) {
    issues.push({ field: 'palette.n_colors', message: '4~64 사이여야 합니다.' })
  }
  if (anchors.length < 2) {
    issues.push({ field: 'palette.anchors', message: '유효한 hex 색상이 2개 이상 필요합니다.' })
  }

  const lightingRaw = (input.lighting ?? {}) as Record<string, unknown>
  const perCategoryRaw = (input.per_category_prompt ?? {}) as Record<string, unknown>
  const perCategory: Partial<Record<StyleSpecCategory, string>> = {}
  for (const category of STYLE_SPEC_CATEGORIES) {
    const prompt = perCategoryRaw[category]
    if (typeof prompt === 'string' && prompt.trim()) {
      perCategory[category] = prompt.trim().slice(0, 300)
    }
  }

  const strengthRaw = input.style_strength
  const strength = typeof strengthRaw === 'number' ? strengthRaw : 0.5
  if (strength < 0.1 || strength > 0.9) {
    issues.push({ field: 'style_strength', message: '0.1~0.9 사이여야 합니다.' })
  }

  if (issues.length > 0) {
    return { issues }
  }

  return {
    issues,
    spec: {
      style_id: styleId,
      concept,
      palette: { n_colors: nColors, anchors: anchors.map((color) => color.toLowerCase()) },
      material: asStringArray(input.material, 12),
      lighting: {
        key: typeof lightingRaw.key === 'string' ? lightingRaw.key.trim().slice(0, 200) : '',
        ambient:
          typeof lightingRaw.ambient === 'string' ? lightingRaw.ambient.trim().slice(0, 200) : ''
      },
      motif: asStringArray(input.motif, 12),
      per_category_prompt: perCategory,
      style_strength: strength,
      negative_prompt:
        typeof input.negative_prompt === 'string'
          ? input.negative_prompt.trim().slice(0, 300)
          : '',
      // LLM이 무엇을 보냈든 상수 강제 — 서버(style_spec.py)도 같은 값으로 다시 덮는다.
      immutable: [...IMMUTABLE_FIELDS]
    }
  }
}
