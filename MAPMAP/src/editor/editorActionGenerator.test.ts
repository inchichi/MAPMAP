import { afterEach, describe, expect, it, vi } from 'vitest'

import { decideEditorAction } from './editorActionGenerator'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('decideEditorAction', () => {
  it('routes a natural-language quest request with grounded scene and entity ids', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  action: 'create_quest',
                  target_id: 'npc-1',
                  scene_id: ''
                })
              }
            }
          ]
        })
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      decideEditorAction({
        userPrompt: '마을 주민이 부탁하는 퀘스트를 만들어줘',
        gameName: 'my-sample-rpg',
        selectedEntity: { id: 'npc-1', name: '마을 주민', kind: 'npc', mapId: 'town' },
        entities: [{ id: 'npc-1', name: '마을 주민', kind: 'npc', mapId: 'town' }],
        editorGeneratedNpcs: [],
        scenes: [
          { id: 'town', label: '마을' },
          { id: 'cave', label: '동굴' }
        ]
      })
    ).resolves.toEqual({
      action: 'create_quest',
      target_id: 'npc-1',
      scene_id: ''
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const request = JSON.parse(String(init.body)) as { messages: Array<{ content: string }> }
    expect(request.messages[0]?.content).toContain('create_quest')
    expect(request.messages[0]?.content).toContain('npc-1')
    expect(request.messages[0]?.content).toContain('cave')
  })

  it('normalizes a null target returned by JSON mode for scene actions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    action: 'switch_scene',
                    target_id: null,
                    scene_id: 'cave'
                  })
                }
              }
            ]
          })
      }))
    )

    await expect(
      decideEditorAction({
        userPrompt: '동굴로 이동해줘',
        gameName: 'my-sample-rpg',
        entities: [],
        editorGeneratedNpcs: [],
        scenes: [{ id: 'cave', label: '동굴' }]
      })
    ).resolves.toEqual({
      action: 'switch_scene',
      target_id: '',
      scene_id: 'cave'
    })
  })
})
