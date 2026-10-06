import { generateJson } from './llmProvider'
import type { GameEntity } from './gameAdapter'

export type EditorActionName =
  | 'create_npc'
  | 'delete_npc'
  | 'create_quest'
  | 'create_scenario'
  | 'switch_scene'
  | 'generate_content'
  | 'other'

export type EditorAction = {
  action: EditorActionName
  target_id: string
  scene_id: string
}

// 에디터의 자연어 입력을 실제 실행 가능한 도구 선택으로 바꾼다.
// Qwen 서버의 tool call 대신 JSON mode를 사용하지만, 역할은 LLM function calling과 같다.
export const decideEditorAction = async ({
  userPrompt,
  gameName,
  selectedEntity,
  entities,
  editorGeneratedNpcs,
  scenes,
  modeHint
}: {
  userPrompt: string
  gameName: string
  selectedEntity?: GameEntity
  entities: GameEntity[]
  editorGeneratedNpcs: GameEntity[]
  scenes: Array<{ id: string; label: string }>
  modeHint?: string
}): Promise<EditorAction> => {
  const result = await generateJson<{
    action?: unknown
    target_id?: unknown
    scene_id?: unknown
  }>({
    apiKey: '',
    instructions: [
      'You are the tool router for a 2D game content editor.',
      '한국어 자연어 요청을 읽고 에디터에서 실행할 다음 작업 하나를 선택한다.',
      'Use create_npc for adding or spawning one new NPC.',
      'Use delete_npc only for deleting an existing editor-generated NPC.',
      'Use create_quest for creating a new quest or mission. This starts the quest candidate workflow.',
      'Use create_scenario for a branching event or story: dialogue with player choices, conditional branches, state that changes on revisit, or a staged encounter. Keywords: 시나리오, 이벤트 스토리, 선택지, 분기.',
      'Use switch_scene for changing the live preview to a named scene or map.',
      'Use generate_content for dialogue, NPC behavior, event, description, or other content changes handled by the game adapter.',
      'Use other only for a question or a request that is not an editor operation.',
      'If a target is not explicitly named, use the selected entity when it is appropriate.',
      'target_id must be an exact supplied entity id or an empty string. Never invent ids.',
      'scene_id must be an exact supplied scene id or an empty string. Never invent scene ids.',
      'Return one JSON object only.'
    ].join('\n'),
    input: [
      'Game: ' + gameName,
      'User request: ' + userPrompt,
      selectedEntity
        ? 'Selected entity: ' +
          selectedEntity.id +
          ' (' +
          selectedEntity.name +
          '), kind=' +
          selectedEntity.kind +
          ', map=' +
          selectedEntity.mapId
        : 'Selected entity: none',
      modeHint ? 'UI mode hint: ' + modeHint : 'UI mode hint: none',
      'Entities: ' +
        (entities.length > 0
          ? entities.map((entity) => entity.id + ' (' + entity.name + ', ' + entity.kind + ')').join(', ')
          : '(none)'),
      'Editor-generated NPCs that are safe deletion targets: ' +
        (editorGeneratedNpcs.length > 0
          ? editorGeneratedNpcs
              .map((npc) => npc.id + ' (' + npc.name + ', map=' + npc.mapId + ')')
              .join(', ')
          : '(none)'),
      'Scenes: ' +
        (scenes.length > 0
          ? scenes.map((scene) => scene.id + ' (' + scene.label + ')').join(', ')
          : '(none)')
    ].join('\n'),
    schemaName: 'editor_action',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: {
          type: 'string',
          enum: [
            'create_npc',
            'delete_npc',
            'create_quest',
            'create_scenario',
            'switch_scene',
            'generate_content',
            'other'
          ]
        },
        target_id: {
          type: 'string',
          enum: ['', ...entities.map((entity) => entity.id)]
        },
        scene_id: {
          type: 'string',
          enum: ['', ...scenes.map((scene) => scene.id)]
        }
      },
      required: ['action', 'target_id', 'scene_id']
    }
  })

  // JSON mode 서버가 schema상 문자열이어야 하는 빈 값을 null로 보내는 경우가 있어,
  // 비어 있는 대상/씬만 안전하게 빈 문자열로 정규화한다. id 자체는 절대 보정하지 않는다.
  return {
    action: result.action as EditorActionName,
    target_id: typeof result.target_id === 'string' ? result.target_id : '',
    scene_id: typeof result.scene_id === 'string' ? result.scene_id : ''
  }
}
