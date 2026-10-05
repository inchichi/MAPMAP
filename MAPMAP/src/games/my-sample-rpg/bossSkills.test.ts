import { describe, expect, it } from 'vitest'

import {
  POISON_PUDDLE_TICK_MILLISECONDS,
  POISON_PUDDLE_WARNING_MILLISECONDS,
  TONGUE_PULL_STOP_DISTANCE_TILES,
  WATER_PILLAR_WARNING_MILLISECONDS,
  createGroundSlam,
  createPoisonPuddle,
  createWaterPillars,
  getBossHazardDamage,
  getBossKey,
  getBossPresentation,
  getBossSkillShout,
  getBossSkillCooldown,
  getSummonCountPerCast,
  isBossEnraged,
  getBossSummonPrefix,
  getTonguePullVector,
  isBossSummonCharacterId,
  pickBossSkill,
  tickBossHazards
} from './bossSkills'

describe('boss skills', () => {
  it('picks a ready skill whose range fits, in list order', () => {
    expect(pickBossSkill('monster_frog_king', 5, {}, 0)?.kind).toBe('tongue-pull')
    // 가까우면 혀를 쓰지 않는다
    expect(pickBossSkill('monster_frog_king', 1.5, {}, 0)?.kind).toBe('poison-puddle')
    expect(pickBossSkill('monster_frog_king', 5, { 'tongue-pull': 1000 }, 0)?.kind).toBe('poison-puddle')
    expect(
      pickBossSkill('monster_frog_king', 5, { 'tongue-pull': 1000, 'poison-puddle': 1000 }, 0)
    ).toBeUndefined()
    expect(pickBossSkill('monster_pig', 2, {}, 0)).toBeUndefined()
    expect(pickBossSkill('monster_swamp_priest', 4, {}, 0)?.kind).toBe('summon')
  })

  it('warns before a poison puddle hurts, then ticks while the player stands in it', () => {
    let hazards = [createPoisonPuddle('p', 10, 10, 0)]
    // 경고 중에는 피해가 없다
    let tick = tickBossHazards(hazards, 10, 10, POISON_PUDDLE_WARNING_MILLISECONDS - 1)
    expect(tick.damageKinds).toEqual([])
    tick = tickBossHazards(tick.hazards, 10, 10, POISON_PUDDLE_WARNING_MILLISECONDS)
    expect(tick.damageKinds).toEqual(['poison-puddle'])
    hazards = tick.hazards
    // 다음 틱 전에는 다시 깎지 않는다
    tick = tickBossHazards(hazards, 10, 10, POISON_PUDDLE_WARNING_MILLISECONDS + 10)
    expect(tick.damageKinds).toEqual([])
    // 웅덩이 밖이면 깎지 않는다
    tick = tickBossHazards(
      hazards,
      13,
      10,
      POISON_PUDDLE_WARNING_MILLISECONDS + POISON_PUDDLE_TICK_MILLISECONDS
    )
    expect(tick.damageKinds).toEqual([])
    // 끝나면 사라진다
    expect(tickBossHazards(hazards, 10, 10, 60_000).hazards).toEqual([])
  })

  it('bursts water pillars once after the warning, around the player', () => {
    const pillars = createWaterPillars('w', 10, 10, 0, () => 0)
    expect(pillars).toHaveLength(3)
    expect(pillars[0]).toMatchObject({ x: 10, y: 10 })
    // 둘레 기둥은 플레이어 자리와 겹치지 않는다(옆으로 비키면 피할 수 있다)
    for (const pillar of pillars.slice(1)) {
      expect(Math.hypot(pillar.x - 10, pillar.y - 10)).toBeGreaterThan(pillar.radiusTiles * 2)
    }
    let tick = tickBossHazards(pillars, 10, 10, WATER_PILLAR_WARNING_MILLISECONDS)
    expect(tick.damageKinds).toEqual(['water-pillar'])
    tick = tickBossHazards(tick.hazards, 10, 10, WATER_PILLAR_WARNING_MILLISECONDS + 100)
    expect(tick.damageKinds).toEqual([])
  })

  it('scales hazard damage with max hp', () => {
    expect(getBossHazardDamage('poison-puddle', 400)).toBe(24)
    expect(getBossHazardDamage('water-pillar', 400)).toBe(72)
    expect(getBossHazardDamage('poison-puddle', 10)).toBe(2)
  })

  it('pulls the player up to melee reach in front of the boss', () => {
    const pull = getTonguePullVector({ x: 10, y: 10 }, { x: 15, y: 10 })
    expect(pull.y).toBe(0)
    expect(15 + pull.x).toBeCloseTo(10 + TONGUE_PULL_STOP_DISTANCE_TILES)
    expect(getTonguePullVector({ x: 10, y: 10 }, { x: 11, y: 10 })).toEqual({ x: 0, y: 0 })
  })

  it('names summoned minions after their boss', () => {
    expect(getBossSummonPrefix('늪의 사제-보스')).toBe('늪의 사제-소환-')
    expect(isBossSummonCharacterId('늪의 사제-소환-2')).toBe(true)
    expect(isBossSummonCharacterId('물에 빠진 자-2')).toBe(false)
  })

  it('enrages below half hp: shorter cooldowns and one more summon', () => {
    expect(isBossEnraged(51, 100)).toBe(false)
    expect(isBossEnraged(50, 100)).toBe(true)
    const skill = { kind: 'water-pillar' as const, cooldownMilliseconds: 5500, minRangeTiles: 0, maxRangeTiles: 10 }
    expect(getBossSkillCooldown(skill, false)).toBe(5500)
    expect(getBossSkillCooldown(skill, true)).toBe(4400)
    expect(getSummonCountPerCast(true)).toBe(getSummonCountPerCast(false) + 1)
  })

  it('gives chapter 2 bosses a title and the priest last words', () => {
    expect(getBossPresentation('monster_frog_king')?.title).toBe('숲의 주인')
    expect(getBossPresentation('monster_swamp_priest')?.deathLines?.join(' ')).toContain('북쪽')
    expect(getBossPresentation('monster_pig')).toBeUndefined()
  })

  it('gives chapter 3 bosses their own skills, shouts and damage', () => {
    // 트롤 족장은 붙어 있을 때만 내려찍는다
    expect(pickBossSkill('monster_troll_chief', 2, { summon: 99_999 }, 0)?.kind).toBe('ground-slam')
    expect(pickBossSkill('monster_troll_chief', 5, { summon: 99_999 }, 0)).toBeUndefined()
    expect(pickBossSkill('monster_frost_witch', 6, { summon: 99_999 }, 0)?.kind).toBe('ice-spike')
    expect(getBossSkillShout('monster_troll_chief', 'summon')).not.toBe(getBossSkillShout('monster_swamp_priest', 'summon'))
    const slam = createGroundSlam('s', 5, 5, 0)
    expect(tickBossHazards([slam], 6, 5, slam.armedAt).damageKinds).toEqual(['ground-slam'])
    expect(tickBossHazards([slam], 9, 5, slam.armedAt).damageKinds).toEqual([])
    expect(createWaterPillars('i', 5, 5, 0, () => 0, 'ice-spike').every((h) => h.kind === 'ice-spike')).toBe(true)
    expect(getBossHazardDamage('ground-slam', 1000)).toBe(200)
  })

  it('looks up chapter 1 bosses by character id, since they share looks with plain monsters', () => {
    expect(getBossKey({ id: '말캉이-보스', appearanceType: 'monster_slime' })).toBe('boss_slime_king')
    expect(getBossKey({ id: '꿀꿀이대장-보스', appearanceType: 'monster_pig' })).not.toBe(
      getBossKey({ id: '꿀꿀이-보스', appearanceType: 'monster_pig' })
    )
    expect(getBossKey({ id: '늪지기 거대개구리-보스', appearanceType: 'monster_frog_king' })).toBe('monster_frog_king')
    expect(pickBossSkill('boss_slime_king', 5, {}, 0)?.kind).toBe('summon')
    expect(getBossPresentation('boss_pig_captain')?.deathLines?.join(' ')).toContain('용암')
  })
})
