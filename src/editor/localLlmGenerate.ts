// OpenAI-compatible JSON generation for the fixed local vLLM server.
export const LOCAL_LLM_MODEL = 'qwen38-27b-int8'
export const LOCAL_LLM_ENDPOINT = '/api/llm/v1/chat/completions'
const LOCAL_LLM_MODELS_ENDPOINT = '/api/llm/v1/models'

// vLLM 서버가 실제 서빙 중인 모델 id 캐시. 서버 모델이 교체 배포되면 상수와 어긋나
// "The model `...` does not exist"로 전부 실패하므로, 그때 한 번 조회해 이후 요청에 쓴다.
let resolvedServedModel: string | undefined

const fetchServedModel = async (): Promise<string | undefined> => {
  try {
    const response = await fetch(LOCAL_LLM_MODELS_ENDPOINT)
    if (!response.ok) {
      return undefined
    }
    const payload = (await response.json()) as { data?: Array<{ id?: string }> }
    const id = payload.data?.[0]?.id
    return typeof id === 'string' && id.length > 0 ? id : undefined
  } catch {
    return undefined
  }
}

type LocalLlmToolCall = {
  function?: { arguments?: string }
}

type LocalLlmMessage = {
  content?: string | Array<{ text?: string }>
  tool_calls?: LocalLlmToolCall[]
}

type LocalLlmResponse = {
  choices?: Array<{
    finish_reason?: string
    message?: LocalLlmMessage
  }>
}

type LocalLlmErrorResponse = {
  error?: { message?: string }
}

const parseJsonContent = (content: string): unknown => {
  const trimmed = content.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/u)
  return JSON.parse(fenced?.[1] ?? trimmed)
}

export const generateJsonWithLocalLlm = async <T>({
  instructions,
  input,
  schemaName,
  schema,
  model = LOCAL_LLM_MODEL,
  maxTokens = 4096,
  structuredOutput = false
}: {
  instructions: string
  input: string
  schemaName: string
  schema: object
  model?: string
  maxTokens?: number
  // true면 vLLM 문법 강제(response_format: json_schema)를 시도한다. 서버가 거부하면(4xx)
  // 기존 json_object + 프롬프트 스키마 주입으로 자동 폴백한다 — 호출부는 모드를 몰라도 된다.
  structuredOutput?: boolean
}): Promise<T> => {
  // 호출부가 명시적으로 다른 모델을 고른 경우가 아니면, 서버에서 확인된 모델 id를 우선한다.
  let effectiveModel = model === LOCAL_LLM_MODEL ? (resolvedServedModel ?? model) : model

  const requestBody = (useJsonSchema: boolean) =>
    JSON.stringify({
      model: effectiveModel,
      messages: [
        {
          role: 'system',
          content: [
            instructions,
            'Return only one JSON object. Do not include reasoning or markdown.',
            `The requested schema name is: ${schemaName}.`,
            `The JSON object must follow this schema: ${JSON.stringify(schema)}`
          ].join('\n\n')
        },
        { role: 'user', content: input }
      ],
      max_tokens: maxTokens,
      response_format: useJsonSchema
        ? { type: 'json_schema', json_schema: { name: schemaName, schema, strict: true } }
        : { type: 'json_object' },
      chat_template_kwargs: { enable_thinking: false }
    })

  const performRequest = async () => {
    let response = await fetch(LOCAL_LLM_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: requestBody(structuredOutput)
    })

    if (structuredOutput && !response.ok && response.status < 500) {
      // 배포 vLLM이 json_schema를 안 받는 경우 — 검토 보고서 §8의 폴백 경로.
      response = await fetch(LOCAL_LLM_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: requestBody(false)
      })
    }

    const rawText = await response.text()
    let payload: LocalLlmResponse & LocalLlmErrorResponse = {}
    try {
      payload = JSON.parse(rawText) as LocalLlmResponse & LocalLlmErrorResponse
    } catch {
      payload = {}
    }
    return { response, rawText, payload }
  }

  let { response, rawText, payload } = await performRequest()

  // 서버 모델 교체로 이름이 안 맞는 경우: 서빙 중인 모델을 조회해 한 번만 재시도.
  if (
    !response.ok &&
    effectiveModel === (resolvedServedModel ?? LOCAL_LLM_MODEL) &&
    /model .* does not exist/iu.test(payload.error?.message ?? '')
  ) {
    const servedModel = await fetchServedModel()
    if (servedModel && servedModel !== effectiveModel) {
      resolvedServedModel = servedModel
      effectiveModel = servedModel
      ;({ response, rawText, payload } = await performRequest())
    }
  }

  if (!response.ok) {
    throw new Error(
      payload.error?.message || rawText || `Local LLM request failed with status ${response.status}`
    )
  }

  const choice = payload.choices?.[0]
  if (choice?.finish_reason === 'length') {
    throw new Error('로컬 LLM 응답이 길이 한도로 잘렸습니다. 더 짧게 요청하세요.')
  }

  const message = choice?.message
  const toolArguments = message?.tool_calls?.[0]?.function?.arguments
  const content =
    typeof message?.content === 'string'
      ? message.content
      : message?.content?.map((part) => part.text ?? '').join('')
  const rawResult = toolArguments ?? content

  if (!rawResult) {
    throw new Error('로컬 LLM 응답에 구조화된 JSON 결과가 없습니다.')
  }

  let result: unknown
  try {
    result = parseJsonContent(rawResult)
  } catch {
    throw new Error('로컬 LLM 응답 JSON 파싱에 실패했습니다.')
  }

  if (result === null || typeof result !== 'object') {
    throw new Error('로컬 LLM 응답이 객체 형식이 아닙니다.')
  }

  const required = (schema as { required?: unknown }).required
  if (Array.isArray(required)) {
    const present = result as Record<string, unknown>
    const missing = required.filter(
      (key) => typeof key === 'string' && !(key in present)
    )
    if (missing.length > 0) {
      throw new Error(`로컬 LLM 응답에 필수 필드가 없습니다: ${missing.join(', ')}`)
    }
  }

  return result as T
}
