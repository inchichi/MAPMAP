import { generateJson } from './llmProvider'
import { LUA_NPC_APPEARANCES } from './luaNpcSchema'

// my-sample-rpg 라이브 NPC 생성: 자연어 → {이름, 외형, 대사}. 게임이 이 데이터를 받아 플레이어 옆에
// 실제 CharacterState로 스폰한다(npcStore.PlacedNpc 모양과 호환). 외형은 character 스프라이트 시트에
// 실재하는 type으로 못박는다(enum 그라운딩) — 게임의 resolveCharacterTexture가 못 풀면 그 NPC는 스킵된다.

export type GeneratedNpcJson = {
  name: string
  appearance_type: string
  dialogue_lines: string[]
}

export const NPC_APPEARANCE_TYPES = LUA_NPC_APPEARANCES

export const generateNpcJson = ({
  apiKey,
  userPrompt
}: {
  apiKey: string
  userPrompt: string
}): Promise<GeneratedNpcJson> =>
  generateJson<GeneratedNpcJson>({
    apiKey,
    instructions: [
      'You create ONE NPC (villager/townsperson) for a 2D village RPG ("my-sample-rpg").',
      'Return JSON only: name, appearance_type, dialogue_lines.',
      'appearance_type MUST be exactly one of the allowed character sprite types.',
      'dialogue_lines: 1 to 4 short lines the NPC says when the player talks to them.',
      // 게임은 한글 폰트를 갖췄고, 화면에 보이는 텍스트(이름·대사)는 한국어로 고정한다.
      'Write name and all dialogue_lines in Korean (한국어).',
      `Allowed appearance_type: ${LUA_NPC_APPEARANCES.join(', ')}`
    ].join('\n'),
    input: userPrompt,
    schemaName: 'generated_npc_json',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', minLength: 1 },
        appearance_type: { type: 'string', enum: [...LUA_NPC_APPEARANCES] },
        dialogue_lines: {
          type: 'array',
          minItems: 1,
          maxItems: 4,
          items: { type: 'string', minLength: 1 }
        }
      },
      required: ['name', 'appearance_type', 'dialogue_lines']
    }
  })
