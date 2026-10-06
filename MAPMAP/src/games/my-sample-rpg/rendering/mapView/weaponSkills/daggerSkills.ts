// 단검 계열 스킬. 1장 급소 찌르기, 2장 그림자 습격, 3장 칼날 폭풍. 적에게 붙을수록 강하다.
import {
  SKILL_COLOR,
  findClosestMonster,
  getDistance,
  getFacingFromDirection,
  offsetPoint,
  scaleDamage,
  type WeaponSkill
} from './weaponSkill'

// 1장: 1.4칸 안 가장 가까운 적 하나에 두 배 피해. 붙어 있지 않으면 쓸 수 없다.
const VITAL_STRIKE: WeaponSkill = {
  id: 'vital-strike',
  cast: ({ now, baseDamage, origin, tileWidth, world, effects }) => {
    const target = findClosestMonster(world, origin, tileWidth * 1.4)
    if (!target) {
      return false
    }
    const targetCenter = world.getMonsterCenter(target)
    world.playPlayerAttackMotion(now)
    effects.streak(origin, targetCenter, SKILL_COLOR.shadow, 4, 220, now)
    world.impact(targetCenter, SKILL_COLOR.shadow, 12, now)
    world.hitMonster(target.id, scaleDamage(baseDamage, 2), now)
    return true
  }
}

// 2장: 4칸 안 가장 가까운 적의 등 뒤로 순간이동해 1.5배로 벤다(벽은 못 지나간다).
const SHADOW_STEP: WeaponSkill = {
  id: 'shadow-step',
  cast: ({ now, baseDamage, origin, tileWidth, world, effects }) => {
    const target = findClosestMonster(world, origin, tileWidth * 4)
    if (!target) {
      return false
    }
    const targetCenter = world.getMonsterCenter(target)
    const distance = Math.max(1, getDistance(origin, targetCenter))
    const toTarget = { x: (targetCenter.x - origin.x) / distance, y: (targetCenter.y - origin.y) / distance }
    world.movePlayer(toTarget, distance / tileWidth + 0.9)
    const landed = world.getPlayerCenter()
    world.setPlayerFacing(getFacingFromDirection({ x: targetCenter.x - landed.x, y: targetCenter.y - landed.y }))
    world.protectPlayer(300, now)
    world.playPlayerAttackMotion(now)
    effects.streak(origin, landed, SKILL_COLOR.shadow, 3, 300, now)
    world.impact(targetCenter, SKILL_COLOR.shadow, 14, now)
    world.hitMonster(target.id, scaleDamage(baseDamage, 1.5), now)
    return true
  }
}

// 3장: 0.1초 간격 여섯 번, 둘레 1.4칸(한 번에 기본의 0.3배) + 첫 타에 중독.
const BLADE_FLURRY: WeaponSkill = {
  id: 'blade-flurry',
  cast: ({ baseDamage, tileWidth, world, effects, schedule }) => {
    for (let strike = 0; strike < 6; strike += 1) {
      schedule(strike * 100, (at) => {
        const center = world.getPlayerCenter()
        const angle = strike * 2.1
        effects.streak(
          offsetPoint(center, { x: Math.cos(angle), y: Math.sin(angle) }, -tileWidth * 0.9),
          offsetPoint(center, { x: Math.cos(angle), y: Math.sin(angle) }, tileWidth * 0.9),
          SKILL_COLOR.shadow,
          3,
          160,
          at
        )
        world.playPlayerAttackMotion(at)
        for (const monster of world.getMonstersInRadius(center, tileWidth * 1.4)) {
          world.hitMonster(monster.id, scaleDamage(baseDamage, 0.3), at)
          if (strike === 0) {
            world.applyDamageOverTime(
              monster.id,
              'poison',
              { damagePerTick: scaleDamage(baseDamage, 0.15), ticks: 4, intervalMilliseconds: 700 },
              at
            )
          }
        }
      })
    }
    return true
  }
}

export const DAGGER_SKILLS: readonly WeaponSkill[] = [VITAL_STRIKE, SHADOW_STEP, BLADE_FLURRY]
