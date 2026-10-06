import { describe, expect, it } from 'vitest'

import { createMonsterAi, stepMonsterAi } from './monsterAi'

const config = {
  aggroTiles: 6,
  leashTiles: 12,
  attackTiles: 1,
  attackCooldownMs: 900
}

describe('createMonsterAi', () => {
  it('remembers its spawn tile and starts calm', () => {
    expect(createMonsterAi(40, 25)).toEqual({
      homeX: 40,
      homeY: 25,
      aggro: false,
      nextAttackAtMs: 0
    })
  })
})

describe('stepMonsterAi', () => {
  it('idles at home while the player is out of aggro range', () => {
    const step = stepMonsterAi(createMonsterAi(40, 25), 40, 25, 50, 25, 0, config)

    expect(step.ai.aggro).toBe(false)
    expect(step.intent).toEqual({ moveX: 0, moveY: 0, attack: false })
  })

  it('chases with a unit vector once the player is inside aggro range', () => {
    const step = stepMonsterAi(createMonsterAi(40, 25), 40, 25, 43, 29, 0, config)

    expect(step.ai.aggro).toBe(true)
    expect(step.intent.moveX).toBeCloseTo(0.6)
    expect(step.intent.moveY).toBeCloseTo(0.8)
    expect(step.intent.attack).toBe(false)
    expect(Math.hypot(step.intent.moveX, step.intent.moveY)).toBeCloseTo(1)
  })

  it('keeps chasing after the player leaves aggro range', () => {
    const aggroed = stepMonsterAi(createMonsterAi(40, 25), 40, 25, 45, 25, 0, config).ai
    const chasing = stepMonsterAi(aggroed, 44, 25, 54, 25, 100, config)

    expect(chasing.ai.aggro).toBe(true)
    expect(chasing.intent.moveX).toBeCloseTo(1)
  })

  it('drops aggro only past the leash distance and then walks home', () => {
    const aggroed = stepMonsterAi(createMonsterAi(40, 25), 40, 25, 45, 25, 0, config).ai
    const stillLeashed = stepMonsterAi(aggroed, 52, 25, 80, 25, 100, config)

    expect(stillLeashed.ai.aggro).toBe(true)

    const leashBroken = stepMonsterAi(aggroed, 52.5, 25, 80, 25, 200, config)

    expect(leashBroken.ai.aggro).toBe(false)
    expect(leashBroken.intent).toEqual({ moveX: -1, moveY: 0, attack: false })
  })

  it('does not re-aggro at the leash edge unless the player comes back into aggro range', () => {
    const walkingHome = stepMonsterAi(createMonsterAi(40, 25), 53, 25, 80, 25, 0, config)

    expect(walkingHome.ai.aggro).toBe(false)

    const playerReturns = stepMonsterAi(walkingHome.ai, 53, 25, 58, 25, 100, config)

    expect(playerReturns.ai.aggro).toBe(true)
  })

  it('stops and swings on cooldown once in attack range', () => {
    const aggroed = stepMonsterAi(createMonsterAi(40, 25), 40, 25, 41, 25, 0, config)

    expect(aggroed.intent).toEqual({ moveX: 0, moveY: 0, attack: true })
    expect(aggroed.ai.nextAttackAtMs).toBe(900)

    const onCooldown = stepMonsterAi(aggroed.ai, 40, 25, 41, 25, 500, config)

    expect(onCooldown.intent.attack).toBe(false)
    expect(onCooldown.intent.moveX).toBe(0)
    expect(onCooldown.ai.nextAttackAtMs).toBe(900)

    const ready = stepMonsterAi(aggroed.ai, 40, 25, 41, 25, 900, config)

    expect(ready.intent.attack).toBe(true)
    expect(ready.ai.nextAttackAtMs).toBe(1800)
  })

  it('never mutates the state it is given', () => {
    const ai = createMonsterAi(40, 25)
    const step = stepMonsterAi(ai, 40, 25, 41, 25, 0, config)

    expect(ai).toEqual({ homeX: 40, homeY: 25, aggro: false, nextAttackAtMs: 0 })
    expect(step.ai).not.toBe(ai)
  })
})
