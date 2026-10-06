// Stage 1 — 시나리오 텍스트 → StyleSpec(JSON) LLM 생성.
// 기존 이벤트/퀘스트 생성과 같은 generateJson(구조화 출력) 진입점을 쓴다.
// 자유도는 여기(텍스트 층)까지 — 구조 규격은 스키마가 원천 차단한다.

import { generateJson } from './llmProvider'
import { normalizeStyleSpec, STYLE_SPEC_SCHEMA, type StyleSpec } from './styleSpec'

const INSTRUCTIONS = [
  '너는 2D 픽셀아트 RPG의 아트 디렉터다. 사용자가 주는 시나리오(세계관·분위기 묘사)를 읽고',
  '게임 에셋 스타일 변환 파이프라인이 쓸 StyleSpec(JSON)을 만든다.',
  '',
  '규칙:',
  '- style_id: 시나리오를 요약한 영문 스네이크케이스 + _v1 (예: ashen_ruins_v1)',
  '- palette.anchors: 시나리오 분위기를 대표하는 hex 색 4~8개, 어두운 색부터 밝은 색 순.',
  '  제한 팔레트가 곧 일관성 장치다 — 색을 아껴라 (픽셀아트는 n_colors 8~32).',
  '- per_category_prompt: 지형/오브젝트/캐릭터별 영어 키워드 프롬프트.',
  '  자연어 문장 금지 — 쉼표로 구분한 키워드 나열만 쓴다.',
  '- style_strength: 0.4~0.6 사이에서 시나리오의 변화 강도에 맞게.',
  '- negative_prompt: 스타일을 해치는 요소(photo, realistic 등) 영어 키워드.',
  '- 에셋의 실루엣·타일 격자·충돌 영역은 파이프라인이 보존한다 — 스펙은 색·재질·분위기만 다룬다.'
].join('\n')

export const generateStyleSpec = async ({
  apiKey,
  scenario
}: {
  apiKey: string
  scenario: string
}): Promise<StyleSpec> => {
  const raw = await generateJson<unknown>({
    apiKey,
    instructions: INSTRUCTIONS,
    input: `시나리오:\n${scenario.trim()}`,
    schemaName: 'style_spec',
    schema: STYLE_SPEC_SCHEMA
  })

  const { spec, issues } = normalizeStyleSpec(raw)
  if (!spec) {
    throw new Error(
      `LLM이 만든 StyleSpec이 유효하지 않습니다: ${issues
        .map((issue) => `${issue.field} — ${issue.message}`)
        .join(', ')}`
    )
  }
  return spec
}
