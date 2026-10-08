import { describe, expect, it } from 'vitest'

import {
  CHARGE_DASH_MILLISECONDS,
  CHARGE_WINDUP_MILLISECONDS,
  FAN_SHOT_SPEED_TILES_PER_SECOND,
  POISON_PUDDLE_TICK_MILLISECONDS,
  POISON_PUDDLE_WARNING_MILLISECONDS,
  TONGUE_PULL_STOP_DISTANCE_TILES,
  WATER_PILLAR_WARNING_MILLISECONDS,
  createChargedBlast,
  createChargeLane,
  createFanShot,
  createGroundSlam,
  createMeteorShower,
  createPoisonPuddle,
  createRingBurst,
  createWaterPillars,
  getBossHazardDamage,
  getBossKey,
  getBossPresentation,
  getBossSkillShout,
  getBossSkillCooldown,
  getBossSkillGap,
  getChargePath,
  getReadyBossSkills,
  getSummonCountPerCast,
  isBossEnraged,
  getBossSummonPrefix,
  getTonguePullVector,
  isBossSummonCharacterId,
  pickBossSkill,
  shouldInterruptChargedBlast,
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

  it('lets the trial boss use any ready skill at any distance', () => {
    // 돌진(3~9칸)·혀(3~7칸)도 붙어 있을 때, 지면 강타(0~3칸)도 멀리서 고를 수 있다
    const kinds = (distance: number) =>
      getReadyBossSkills('boss_trial', distance, {}, 0).map((skill) => skill.kind)
    expect(kinds(0.5)).toEqual(kinds(20))
    expect(kinds(20)).toHaveLength(7)
    // 쿨다운은 그대로 막는다
    expect(getReadyBossSkills('boss_trial', 5, { charge: 1000 }, 0).map((skill) => skill.kind)).not.toContain('charge')
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

  it('gives the trial boss many skills, spaced out by a shared gap', () => {
    const key = getBossKey({ id: '시험의 수호자-보스', appearanceType: 'monster_troll_chief' })
    expect(key).toBe('boss_trial')
    expect(getBossSkillGap(key)).toBeGreaterThan(0)
    expect(getBossSkillGap('monster_troll_chief')).toBe(0)
    // 거리와 상관없이 목록 순서
    expect(pickBossSkill(key, 2, {}, 0)?.kind).toBe('charged-blast')
    expect(pickBossSkill(key, 8, {}, 0)?.kind).toBe('charged-blast')
    expect(getBossPresentation(key)?.title).toBeDefined()
  })

  it('makes the ring burst safe only near the boss', () => {
    const ring = createRingBurst('r', 10, 10, 0)
    expect(tickBossHazards([ring], 10.5, 10, ring.armedAt).damageKinds).toEqual([])
    expect(tickBossHazards([ring], 13, 10, ring.armedAt).damageKinds).toEqual(['ring-burst'])
    expect(tickBossHazards([ring], 20, 10, ring.armedAt).damageKinds).toEqual([])
  })

  it('charges past the player but stops before a wall, hitting the lane as it passes', () => {
    const open = getChargePath({ x: 0, y: 0 }, { x: 4, y: 0 }, () => false)
    expect(open.direction).toEqual({ x: 1, y: 0 })
    expect(open.distanceTiles).toBe(6)
    const walled = getChargePath({ x: 0, y: 0 }, { x: 4, y: 0 }, (x) => x >= 3)
    expect(walled.distanceTiles).toBe(2.75)

    const lane = createChargeLane('c', { x: 0, y: 0 }, open, 0)
    const dashStart = CHARGE_WINDUP_MILLISECONDS
    // 준비 중에는 길 위에 서 있어도 다치지 않는다
    expect(tickBossHazards(lane, 4, 0, dashStart - 1).damageKinds).toEqual([])
    // 길 끝은 돌진이 끝날 때 맞는다
    expect(lane.at(-1)?.armedAt).toBe(dashStart + CHARGE_DASH_MILLISECONDS)
    expect(tickBossHazards(lane, 6, 0, dashStart + CHARGE_DASH_MILLISECONDS).damageKinds).toEqual(['charge-lane'])
    // 옆으로 비키면 맞지 않는다
    expect(tickBossHazards(lane, 3, 2, dashStart + CHARGE_DASH_MILLISECONDS / 2).damageKinds).toEqual([])
  })

  it('flies fan shots outward, hitting once and vanishing at walls', () => {
    const shots = createFanShot('f', { x: 0, y: 0 }, { x: 10, y: 0 }, 5, 0)
    expect(shots).toHaveLength(5)
    const middle = shots[2]
    const secondsToPlayer = 3 / FAN_SHOT_SPEED_TILES_PER_SECOND
    const hitAt = middle.armedAt + secondsToPlayer * 1000
    const tick = tickBossHazards([middle], 3, 0, hitAt)
    expect(tick.damageKinds).toEqual(['fan-shot'])
    expect(tick.hazards).toEqual([])
    expect(tickBossHazards([middle], 3, 5, hitAt).hazards).toHaveLength(1)
    expect(tickBossHazards([middle], 3, 5, hitAt, (x) => x >= 2).hazards).toEqual([])
  })

  it('drops the first meteor on the player and the rest later around them', () => {
    const meteors = createMeteorShower('m', { x: 10, y: 10 }, 4, 0, () => 0.5)
    expect(meteors[0]).toMatchObject({ x: 10, y: 10 })
    expect(meteors[1].armedAt).toBeGreaterThan(meteors[0].armedAt)
    expect(tickBossHazards([meteors[0]], 10, 10, meteors[0].armedAt).damageKinds).toEqual(['meteor'])
  })

  it('interrupts the charged blast once the boss loses enough hp', () => {
    const blast = createChargedBlast('b', 0, 0, 0)
    expect(blast.armedAt).toBeGreaterThan(2000)
    expect(shouldInterruptChargedBlast(1000, 990, 1000)).toBe(false)
    expect(shouldInterruptChargedBlast(1000, 950, 1000)).toBe(true)
    expect(getBossHazardDamage('charged-blast', 100)).toBeGreaterThan(getBossHazardDamage('ground-slam', 100))
  })
})
