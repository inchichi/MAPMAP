import { afterEach, describe, expect, it, vi } from 'vitest'

import { generateJsonWithLocalLlm, LOCAL_LLM_ENDPOINT, LOCAL_LLM_MODEL } from './localLlmGenerate'

const schema = {
  type: 'object',
  properties: { name: { type: 'string' } },
  required: ['name']
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('generateJsonWithLocalLlm', () => {
  it('calls the fixed endpoint and parses a JSON result', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ name: 'Qwen' }) } }]
        })
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      generateJsonWithLocalLlm({
        instructions: 'system',
        input: 'user',
        schemaName: 'thing',
        schema
      })
    ).resolves.toEqual({ name: 'Qwen' })

    expect(fetchMock).toHaveBeenCalledWith(
      LOCAL_LLM_ENDPOINT,
      expect.objectContaining({ method: 'POST', headers: { 'content-type': 'application/json' } })
    )
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const request = JSON.parse(String(init.body)) as {
      model: string
      response_format: { type: string }
      chat_template_kwargs: { enable_thinking: boolean }
      messages: Array<{ content: string }>
    }
    expect(request.model).toBe(LOCAL_LLM_MODEL)
    expect(request.response_format.type).toBe('json_object')
    expect(request.chat_template_kwargs.enable_thinking).toBe(false)
    expect(request.messages[0]?.content).toContain(JSON.stringify(schema))
  })

  it('also parses JSON content when the server does not return a tool call', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ choices: [{ message: { content: '```json\n{"name":"Qwen"}\n```' } }] })
      }))
    )

    await expect(
      generateJsonWithLocalLlm({
        instructions: 'system',
        input: 'user',
        schemaName: 'thing',
        schema
      })
    ).resolves.toEqual({ name: 'Qwen' })
  })
})
