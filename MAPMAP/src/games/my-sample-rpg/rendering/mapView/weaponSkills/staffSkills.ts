// 지팡이 계열 2·3장 스킬(1장 아이스 볼트·파이어볼·체인 라이트닝은 playerCombatEffects 의 기존 구현). 2장 눈보라, 3장 메테오.
import { SKILL_COLOR, findClosestMonster, scaleDamage, type WeaponSkill } from './weaponSkill'

// 2장: 8칸 안 가장 가까운 적 둘레 2칸에 0.25초 간격 네 번(한 번에 0.4배) + 매번 잠깐 얼린다.
const BLIZZARD: WeaponSkill = {
  id: 'blizzard',
  cast: ({ baseDamage, origin, tileWidth, world, effects, schedule }) => {
    const target = findClosestMonster(world, origin, tileWidth * 8)
    if (!target) {
      return false
    }
    const center = world.getMonsterCenter(target)
    for (let gust = 0; gust < 4; gust += 1) {
      schedule(gust * 250, (at) => {
        effects.ring(center, tileWidth * 2, SKILL_COLOR.ice, 300, at)
        effects.fall({ x: center.x + (gust - 1.5) * tileWidth * 0.5, y: center.y }, 5, SKILL_COLOR.ice, 220, at)
        for (const monster of world.getMonstersInRadius(center, tileWidth * 2)) {
          world.hitMonster(monster.id, scaleDamage(baseDamage, 0.4), at)
          world.freezeMonster(monster.id, 600, at)
        }
      })
    }
    return true
  }
}

// 3장: 0.7초 뒤 가장 가까운 적 자리에 운석. 둘레 2.5칸 1.3배 + 화상.
const METEOR: WeaponSkill = {
  id: 'meteor',
  cast: ({ now, baseDamage, origin, tileWidth, world, effects, schedule }) => {
    const target = findClosestMonster(world, origin, tileWidth * 8)
    if (!target) {
      return false
    }
    const center = world.getMonsterCenter(target)
    effects.fall(center, 14, SKILL_COLOR.fire, 700, now)
    schedule(700, (at) => {
      effects.ring(center, tileWidth * 2.5, SKILL_COLOR.fire, 500, at)
      world.impact(center, SKILL_COLOR.fire, 22, at)
      for (const monster of world.getMonstersInRadius(center, tileWidth * 2.5)) {
        world.hitMonster(monster.id, scaleDamage(baseDamage, 1.3), at)
        world.applyDamageOverTime(
          monster.id,
          'burn',
          { damagePerTick: scaleDamage(baseDamage, 0.15), ticks: 3, intervalMilliseconds: 700 },
          at
        )
      }
    })
    return true
  }
}

export const STAFF_SKILLS: readonly WeaponSkill[] = [BLIZZARD, METEOR]
