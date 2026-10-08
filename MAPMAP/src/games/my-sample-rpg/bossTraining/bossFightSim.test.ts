import { describe, expect, it } from 'vitest'

import {
  createFightState,
  createSeededRandom,
  getAvailableBossSkills,
  ruleBasedBossPolicy,
  stepFight,
  type FightSetup,
  type PlayerAction
} from './bossFightSim'
import { runFight, scoreFightFun, summarizeFights } from './fightEvaluation'

// 30×30 칸 빈 방(테두리 밖만 벽)
const setup: FightSetup = {
  isWall: (x, y) => x < 0 || y < 0 || x >= 30 || y >= 30,
  bossStart: { x: 15, y: 10 },
  playerStart: { x: 15, y: 16 },
  playerLevel: 10,
  bossLevel: 10,
  potions: 10
}

const idle: PlayerAction = { move: { x: 0, y: 0 }, attack: false }

describe('boss fight simulator', () => {
  it('replays the same fight for the same seed', () => {
    expect(runFight(setup, ruleBasedBossPolicy, 'normal', 42)).toEqual(runFight(setup, ruleBasedBossPolicy, 'normal', 42))
  })

  it('waits before the first skill, then offers skills in list order', () => {
    const state = createFightState(setup)
    expect(getAvailableBossSkills(state)).toEqual([])
    state.now = 3000
    // 시험 보스는 거리와 상관없이 쿨다운이 끝난 기술을 모두 쓸 수 있다(목록 순서)
    expect(getAvailableBossSkills(state)).toEqual([
      'charged-blast',
      'tongue-pull',
      'charge',
      'ring-burst',
      'meteor-shower',
      'fan-shot',
      'ground-slam'
    ])
  })

  it('lets a roll evade a telegraphed hit but not the charged blast', () => {
    const random = createSeededRandom(1)
    const state = createFightState(setup)
    state.player.x = 15
    state.player.y = 12
    state.now = 3000
    // 기 모으기를 쓰게 한 뒤, 터질 때 구르고 있어도 맞는다
    stepFight(state, idle, () => 'charged-blast', random)
    const hpBefore = state.player.hp
    while (state.hazards.length > 0 && state.player.hp === hpBefore) {
      stepFight(state, { ...idle, roll: { x: 1, y: 0 } }, () => undefined, random)
      state.player.x = 15
    }
    expect(state.player.hp).toBeLessThan(hpBefore)
    expect(state.stats.damageTakenByKind['charged-blast']).toBeGreaterThan(0)
  })

  it('interrupts the charged blast when the player hits hard enough', () => {
    const random = createSeededRandom(1)
    const state = createFightState(setup)
    state.player.x = 15
    state.player.y = 11.2
    state.now = 3000
    stepFight(state, idle, () => 'charged-blast', random)
    for (let step = 0; step < 40 && state.stats.interrupts === 0; step += 1) {
      stepFight(state, { ...idle, attack: true }, () => undefined, random)
    }
    expect(state.stats.interrupts).toBe(1)
    expect(state.hazards.some((hazard) => hazard.kind === 'charged-blast')).toBe(false)
  })

  it('heals with potions until they run out', () => {
    const random = createSeededRandom(1)
    const state = createFightState({ ...setup, potions: 1 })
    state.player.hp = 10
    stepFight(state, { ...idle, drinkPotion: true }, () => undefined, random)
    state.player.potionReadyAt = 0
    stepFight(state, { ...idle, drinkPotion: true }, () => undefined, random)
    expect(state.player.hp).toBe(20)
    expect(state.stats.potionsUsed).toBe(1)
  })

  it('locks a bow player in place while drawing, then lands a homing arrow from range', () => {
    const random = createSeededRandom(1)
    const state = createFightState(setup)
    state.player.weapon = 'bow'
    // 보스에게서 6칸(조준 사거리 7칸 안)
    stepFight(state, { ...idle, attack: true }, () => undefined, random)
    // 당기는 동안은 걷기도 구르기도 안 된다
    stepFight(state, { move: { x: 1, y: 0 }, attack: false, roll: { x: 1, y: 0 } }, () => undefined, random)
    expect(state.player.x).toBe(15)
    expect(state.player.rollReadyAt).toBe(0)
    const hpBefore = state.boss.hp
    for (let step = 0; step < 20 && state.boss.hp === hpBefore; step += 1) {
      stepFight(state, idle, () => undefined, random)
    }
    expect(hpBefore - state.boss.hp).toBe(state.player.attackPower)
    // 당기기 300ms + 6칸 비행(약 0.45초) 뒤에 맞는다
    expect(state.now).toBeGreaterThan(600)
    expect(state.now).toBeLessThan(1000)
  })

  it('does not shoot a bow at a boss beyond aim range', () => {
    const random = createSeededRandom(1)
    const state = createFightState({ ...setup, playerStart: { x: 15, y: 25 } })
    state.player.weapon = 'bow'
    stepFight(state, { ...idle, attack: true }, () => undefined, random)
    for (let step = 0; step < 30; step += 1) {
      stepFight(state, idle, () => undefined, random)
    }
    expect(state.stats.playerAttacks).toBe(1)
    expect(state.stats.playerHits).toBe(0)
  })

  it('lands a magic bolt from range after a shorter cast than the bow', () => {
    const random = createSeededRandom(1)
    const state = createFightState(setup)
    state.player.weapon = 'magic'
    stepFight(state, { ...idle, attack: true }, () => undefined, random)
    // 찌르기 220ms 가 끝나면 다시 걸을 수 있다(활은 300ms)
    for (let step = 0; step < 4; step += 1) {
      stepFight(state, { move: { x: 1, y: 0 }, attack: false }, () => undefined, random)
    }
    expect(state.player.x).toBe(15)
    stepFight(state, { move: { x: 1, y: 0 }, attack: false }, () => undefined, random)
    expect(state.player.x).toBeGreaterThan(15)
    const hpBefore = state.boss.hp
    for (let step = 0; step < 30 && state.boss.hp === hpBefore; step += 1) {
      stepFight(state, idle, () => undefined, random)
    }
    expect(hpBefore - state.boss.hp).toBe(state.player.attackPower)
  })

  it.each(['bow', 'magic'] as const)('lets a %s bot keep its distance from the boss', (weapon) => {
    const results = Array.from({ length: 20 }, (_, index) =>
      runFight(setup, ruleBasedBossPolicy, 'normal', index, weapon)
    )
    const melee = results.reduce((sum, result) => sum + (result.stats.damageTakenByKind.melee ?? 0), 0)
    const swordMelee = Array.from({ length: 20 }, (_, index) =>
      runFight(setup, ruleBasedBossPolicy, 'normal', index)
    ).reduce((sum, result) => sum + (result.stats.damageTakenByKind.melee ?? 0), 0)
    expect(melee).toBeLessThan(swordMelee / 2)
    expect(results.every((result) => result.stats.playerHits > 0)).toBe(true)
  })

  it('makes skilled bots take less damage than novices', () => {
    const damage = (tier: 'novice' | 'expert') => {
      const results = Array.from({ length: 40 }, (_, index) => runFight(setup, ruleBasedBossPolicy, tier, index))
      const summary = summarizeFights(tier, results)
      return Object.values(summary.damageTakenByKind).reduce((sum, value) => sum + value, 0)
    }
    expect(damage('expert')).toBeLessThan(damage('novice'))
  })

  it('scores close, one-to-two minute, varied fights as more fun', () => {
    const base = runFight(setup, ruleBasedBossPolicy, 'normal', 3)
    const close = { ...base, outcome: 'player-win' as const, playerHpRatio: 0.2, durationMilliseconds: 90_000 }
    const stomp = { ...close, playerHpRatio: 1, durationMilliseconds: 15_000 }
    expect(scoreFightFun(close).total).toBeGreaterThan(scoreFightFun(stomp).total)
    expect(scoreFightFun({ ...close, outcome: 'timeout' }).closeness).toBe(0)
  })
})
