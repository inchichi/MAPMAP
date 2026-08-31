#!/usr/bin/env node
// 스파이크 ②: 배포 vLLM이 문법 강제(guided decoding)를 지원하는지, 그리고 시나리오 스키마 v2가
// 쓰려는 JSON Schema 기능을 xgrammar가 받아주는지 실측한다.
//
//   node scripts/vllm-guided-json-smoke.mjs [baseUrl]
//   LLM_BASE_URL=http://호스트:8000 node scripts/vllm-guided-json-smoke.mjs
//
// 판정 대상
//   A. 도달성 / 모델 id
//   B. json_object            — 지금 쓰는 방식(기준선)
//   C. response_format:json_schema — OpenAI 호환 구조화 출력
//   D. guided_json            — vLLM 네이티브 파라미터
//   E. anyOf + const 판별자   — 노드 유니온(say/choice/...)이 이 형태를 요구한다
//   F. enum 그라운딩          — 레지스트리 id 환각 차단이 이것에 달려 있다
//   G. 중첩 배열(scenes→steps) + 지연/토큰 실측
//
// 종료 코드: 0 = 통과 경로 있음, 1 = 문법 강제 전부 실패(폴백 설계 필요), 2 = 서버 도달 실패

const BASE = (process.argv[2] || process.env.LLM_BASE_URL || 'http://100.115.43.82:8000').replace(/\/$/, '')
const MODEL = process.env.LLM_MODEL || 'qwen36-27b-int4-best'
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 120000)

const results = []

const post = async (body, timeoutMs = TIMEOUT_MS) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()
  try {
    const response = await fetch(`${BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, ...body }),
      signal: controller.signal
    })
    const text = await response.text()
    let payload
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { _raw: text }
    }
    return { ok: response.ok, status: response.status, payload, ms: Date.now() - startedAt }
  } catch (error) {
    return { ok: false, status: 0, payload: { error: { message: String(error) } }, ms: Date.now() - startedAt }
  } finally {
    clearTimeout(timer)
  }
}

const contentOf = (payload) => {
  const message = payload?.choices?.[0]?.message
  if (typeof message?.content === 'string') return message.content
  if (Array.isArray(message?.content)) return message.content.map((p) => p.text ?? '').join('')
  return undefined
}

const errorOf = (r) => r.payload?.error?.message || r.payload?._raw || `HTTP ${r.status}`

// 응답을 파싱해 검사기(check)에 통과하는지 본다. 문법 강제가 진짜로 걸렸는지 보려면
// "형식이 맞다"가 아니라 "스키마가 금지한 값이 안 나온다"를 봐야 한다.
const record = (name, r, check) => {
  if (!r.ok) {
    results.push({ name, verdict: 'UNSUPPORTED', detail: errorOf(r).slice(0, 220), ms: r.ms })
    return undefined
  }
  const raw = contentOf(r.payload)
  if (!raw) {
    results.push({ name, verdict: 'FAIL', detail: '본문에 content 없음', ms: r.ms })
    return undefined
  }
  let parsed
  try {
    parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''))
  } catch {
    results.push({ name, verdict: 'FAIL', detail: `JSON 파싱 실패: ${raw.slice(0, 160)}`, ms: r.ms })
    return undefined
  }
  const problem = check ? check(parsed) : undefined
  results.push({
    name,
    verdict: problem ? 'FAIL' : 'PASS',
    detail: problem ?? JSON.stringify(parsed).slice(0, 200),
    ms: r.ms,
    finish: r.payload?.choices?.[0]?.finish_reason,
    tokens: r.payload?.usage?.completion_tokens
  })
  return parsed
}

const SYS = 'You emit only one JSON object. No prose, no markdown fences.'
const ask = (schema, user, mode) => {
  const body = {
    messages: [
      { role: 'system', content: `${SYS}\nSchema: ${JSON.stringify(schema)}` },
      { role: 'user', content: user }
    ],
    max_tokens: 1200,
    temperature: 0,
    chat_template_kwargs: { enable_thinking: false }
  }
  if (mode === 'json_object') body.response_format = { type: 'json_object' }
  if (mode === 'json_schema') {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: 'probe', schema, strict: true }
    }
  }
  if (mode === 'guided_json') body.guided_json = schema
  return post(body)
}

// ---------------------------------------------------------------- 스키마 프로브

const SIMPLE = {
  type: 'object',
  additionalProperties: false,
  properties: { title: { type: 'string' }, count: { type: 'integer' } },
  required: ['title', 'count']
}

// 레지스트리 그라운딩: 이 3개 밖의 값이 나오면 환각 차단이 안 되는 것이다.
const ALLOWED_NPCS = ['npc_marvin', 'npc_bishubak', 'npc_eva']
const ENUM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { speaker: { type: 'string', enum: ALLOWED_NPCS }, line: { type: 'string' } },
  required: ['speaker', 'line']
}

// 노드 유니온: 문서 §5.2가 oneOf 대신 anyOf + const 판별자를 쓰기로 한 근거를 실측한다.
const NODE_UNION = {
  type: 'object',
  additionalProperties: false,
  properties: {
    steps: {
      type: 'array',
      minItems: 3,
      items: {
        anyOf: [
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', const: 'say' },
              speaker: { type: 'string', enum: ALLOWED_NPCS },
              text: { type: 'string' }
            },
            required: ['type', 'speaker', 'text']
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', const: 'set_flag' },
              flag: { type: 'string' },
              value: { type: 'boolean' }
            },
            required: ['type', 'flag', 'value']
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', const: 'end' }
            },
            required: ['type']
          }
        ]
      }
    }
  },
  required: ['steps']
}

// 실전 형태: scenes는 동적 키 맵이 아니라 배열이어야 xgrammar가 받는다(§5.2).
const SCENES = {
  type: 'object',
  additionalProperties: false,
  properties: {
    cast: { type: 'array', items: { type: 'string', enum: ALLOWED_NPCS } },
    scenes: {
      type: 'array',
      minItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          steps: NODE_UNION.properties.steps
        },
        required: ['id', 'steps']
      }
    }
  },
  required: ['cast', 'scenes']
}

const isNode = (n) =>
  n && typeof n === 'object' &&
  ((n.type === 'say' && ALLOWED_NPCS.includes(n.speaker) && typeof n.text === 'string') ||
   (n.type === 'set_flag' && typeof n.flag === 'string' && typeof n.value === 'boolean') ||
   (n.type === 'end' && Object.keys(n).length === 1))

// ---------------------------------------------------------------- 실행

const main = async () => {
  console.log(`대상: ${BASE}  모델: ${MODEL}\n`)

  // A. 도달성
  let models
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const r = await fetch(`${BASE}/v1/models`, { signal: controller.signal })
    clearTimeout(timer)
    models = await r.json()
    const ids = (models?.data ?? []).map((m) => m.id)
    console.log(`A. 도달성        PASS — 모델: ${ids.join(', ') || '(비어 있음)'}`)
    if (ids.length && !ids.includes(MODEL)) {
      console.log(`   ⚠ 요청 모델 '${MODEL}'이 목록에 없다. LLM_MODEL로 지정하라.`)
    }
  } catch (error) {
    console.error(`A. 도달성        실패 — ${error}`)
    console.error('\n서버가 떠 있는지, Tailscale/VPN이 붙어 있는지 확인하라.')
    process.exit(2)
  }

  // B~D. 문법 강제 경로
  record('B. json_object (현행)', await ask(SIMPLE, 'Make a title and count for a fishing quest.', 'json_object'),
    (o) => (typeof o.title === 'string' && Number.isInteger(o.count) ? undefined : '형식 불일치'))
  record('C. response_format:json_schema', await ask(SIMPLE, 'Make a title and count for a fishing quest.', 'json_schema'),
    (o) => (typeof o.title === 'string' && Number.isInteger(o.count) ? undefined : '형식 불일치'))
  record('D. guided_json', await ask(SIMPLE, 'Make a title and count for a fishing quest.', 'guided_json'),
    (o) => (typeof o.title === 'string' && Number.isInteger(o.count) ? undefined : '형식 불일치'))

  // 통과한 강제 모드를 골라 나머지 프로브에 쓴다
  const forced = results.find((r) => r.name.startsWith('C.') && r.verdict === 'PASS') ? 'json_schema'
    : results.find((r) => r.name.startsWith('D.') && r.verdict === 'PASS') ? 'guided_json'
      : undefined

  if (!forced) {
    console.log('\n문법 강제 경로가 전부 실패했다 — 폴백(스키마 텍스트 주입 + 사후 검증 + 재시도)이 필요하다.')
  }
  const mode = forced ?? 'json_object'
  console.log(`\n이후 프로브 모드: ${mode}${forced ? '' : ' (강제 실패 → 기준선으로 측정만)'}\n`)

  // E. enum 그라운딩 — 일부러 목록에 없는 이름을 요구해 본다
  record('E. enum 그라운딩', await ask(ENUM_SCHEMA,
    'The speaker is a brand-new character named 프랑켄 마빈 who is NOT in any list. Emit one line.', mode),
    (o) => (ALLOWED_NPCS.includes(o.speaker) ? undefined : `enum 이탈: ${o.speaker}`))

  // F. anyOf + const 판별자
  record('F. anyOf+const 노드 유니온', await ask(NODE_UNION,
    'Three steps: Bishubak says hello, set flag shell_game_cleared true, then end.', mode),
    (o) => {
      if (!Array.isArray(o.steps) || o.steps.length < 3) return 'steps 부족'
      const bad = o.steps.find((n) => !isNode(n))
      return bad ? `노드 불일치: ${JSON.stringify(bad).slice(0, 120)}` : undefined
    })

  // G. 중첩 scenes + 지연/토큰
  record('G. 중첩 scenes 배열', await ask(SCENES,
    'Two scenes for a shell-game event: scene "intro" (greeting + set flag) and scene "reward" (line + end).', mode),
    (o) => {
      if (!Array.isArray(o.scenes) || o.scenes.length < 2) return 'scenes 부족'
      for (const s of o.scenes) {
        if (typeof s.id !== 'string' || !Array.isArray(s.steps)) return `scene 형식 불일치: ${s.id}`
        const bad = s.steps.find((n) => !isNode(n))
        if (bad) return `노드 불일치: ${JSON.stringify(bad).slice(0, 120)}`
      }
      const badCast = (o.cast ?? []).find((c) => !ALLOWED_NPCS.includes(c))
      return badCast ? `cast enum 이탈: ${badCast}` : undefined
    })

  // ---------------------------------------------------------------- 보고
  console.log('결과')
  for (const r of results) {
    const meta = [r.ms != null ? `${(r.ms / 1000).toFixed(1)}s` : null,
      r.tokens != null ? `${r.tokens}tok` : null,
      r.finish && r.finish !== 'stop' ? `finish=${r.finish}` : null].filter(Boolean).join(' ')
    console.log(`  ${r.verdict.padEnd(11)} ${r.name.padEnd(30)} ${meta}`)
    if (r.verdict !== 'PASS') console.log(`              ↳ ${r.detail}`)
  }

  console.log('\n판정')
  if (forced) {
    console.log(`  · 문법 강제 사용 가능: ${forced}`)
    const enumOk = results.find((r) => r.name.startsWith('E.'))?.verdict === 'PASS'
    const unionOk = results.find((r) => r.name.startsWith('F.'))?.verdict === 'PASS'
    const scenesOk = results.find((r) => r.name.startsWith('G.'))?.verdict === 'PASS'
    console.log(`  · 레지스트리 enum 그라운딩: ${enumOk ? '가능 — 환각 참조를 문법 수준에서 차단' : '불가 — 사후 검증으로 막아야 함'}`)
    console.log(`  · anyOf+const 노드 유니온: ${unionOk ? '가능 — 스키마 v2 노드 어휘를 그대로 강제 가능' : '불가 — 노드별 분리 호출 또는 단일 타입 평탄화 필요'}`)
    console.log(`  · 중첩 scenes 배열: ${scenesOk ? '가능 — Stage 1/2 분할 없이도 한 번에 나올 수 있음' : '불가 — 장면 단위 분할 호출이 필수'}`)
    process.exit(0)
  } else {
    console.log('  · 문법 강제 전부 실패 → 문서 §8 폴백 경로로 간다')
    console.log('    (스키마 텍스트 주입 + 강한 사후 검증 + 제한 재시도, 재시도 예산 산정 필요)')
    process.exit(1)
  }
}

main()
