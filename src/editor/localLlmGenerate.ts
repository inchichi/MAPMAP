// OpenAI-compatible JSON generation for the fixed local vLLM server.
export const LOCAL_LLM_MODEL = 'qwen36-27b-int4-best'
export const LOCAL_LLM_ENDPOINT = '/api/llm/v1/chat/completions'

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
  model = LOCAL_LLM_MODEL
}: {
  instructions: string
  input: string
  schemaName: string
  schema: object
  model?: string
}): Promise<T> => {
  const response = await fetch(LOCAL_LLM_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
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
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      chat_template_kwargs: { enable_thinking: false }
    })
  })

  const rawText = await response.text()
  let payload: LocalLlmResponse & LocalLlmErrorResponse = {}
  try {
    payload = JSON.parse(rawText) as LocalLlmResponse & LocalLlmErrorResponse
  } catch {
    payload = {}
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
