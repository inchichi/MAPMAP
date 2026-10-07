import { describe, expect, it } from 'vitest'

import { PLAYER_ATTACK_REACH_TILES } from './bossTraining/bossFightSim'
import { PLAYER_MELEE_REACH, getPlayerSwordReach } from './playerMeleeReach'

describe('PLAYER_MELEE_REACH', () => {
  it('gives the sword a single-target arc and the axe a wide sweep', () => {
    const sword = PLAYER_MELEE_REACH.slash
    const axe = PLAYER_MELEE_REACH.cleave

    expect(sword.kind).toBe('single')
    expect(axe.kind === 'area' && sword.kind === 'single' && axe.widthInTiles > sword.sidePaddingInTiles * 2 + 1).toBe(true)
  })

  it('is the same sword reach the boss fight simulator uses', () => {
    expect(PLAYER_ATTACK_REACH_TILES).toBeCloseTo(getPlayerSwordReach().reachInTiles + 0.4)
  })
})
