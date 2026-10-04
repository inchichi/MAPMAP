import { describe, expect, it } from 'vitest'

import lpcManifest from '../assets/characters/lpc/manifest.json'
import {
  BLACKSMITH_NPC_ID,
  POTION_MERCHANT_NPC_ID,
  QUEST_DEFINITIONS,
  QUEST_GIVER_NPC_IDS,
  WIZARD_NPC_ID
} from '../questLog'
import {
  QUEST_GIVER_PORTRAIT_KEY_BY_NPC_ID,
  getQuestGiverPortraitFrame
} from './createQuestLogOverlay'

const portraitKeys: readonly string[] = lpcManifest.portraits.keys

describe('quest log overlay portraits', () => {
  it('uses the LPC portrait of each quest giver', () => {
    for (const [npcId, key] of [
      [WIZARD_NPC_ID, 'character_wizard_purple'],
      [BLACKSMITH_NPC_ID, 'id:blacksmith'],
      [POTION_MERCHANT_NPC_ID, 'id:potion_merchant']
    ] as const) {
      expect(getQuestGiverPortraitFrame(npcId)).toEqual({
        x: portraitKeys.indexOf(key) * 32,
        y: 0,
        width: 32,
        height: 32
      })
    }
  })

  it('has portraits for all NPCs that give quests', () => {
    for (const npcId of QUEST_GIVER_NPC_IDS) {
      expect(portraitKeys).toContain(QUEST_GIVER_PORTRAIT_KEY_BY_NPC_ID[npcId])
    }
  })

  it('keeps every quest definition covered by a portrait', () => {
    for (const definition of QUEST_DEFINITIONS) {
      expect(portraitKeys).toContain(QUEST_GIVER_PORTRAIT_KEY_BY_NPC_ID[definition.giverNpcId])
    }
  })
})
