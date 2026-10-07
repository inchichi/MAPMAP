// 지팡이 계열 2·3장 스킬(1장 아이스 볼트·파이어볼·체인 라이트닝은 playerCombatEffects 의 기존 구현). 2장 눈보라, 3장 메테오.
import { findClosestMonster, scaleDamage, type WeaponSkill } from './weaponSkill'

// 2장: 8칸 안 가장 가까운 적 둘레 2칸에 0.25초 간격 네 번(한 번에 0.4배) + 매번 잠깐 얼린다.
const BLIZZARD: WeaponSkill = {
  id: 'blizzard',
  cast: ({ baseDamage, origin, tileWidth, world, magic, schedule }) => {
    const target = findClosestMonster(world, origin, tileWidth * 8)
    if (!target) {
      return false
    }
    const center = world.getMonsterCenter(target)
    // 얼음 촉수가 솟아 네 번 때리는 동안, 둘레에 얼음 가시가 차례로 솟는다(LPC 마법 그림).
    magic.play('ice-tentacle', center.x, center.y + 12, { scale: 0.9, durationMilliseconds: 1100 })
    for (let gust = 0; gust < 4; gust += 1) {
      schedule(gust * 250, (at) => {
        const angle = (gust / 4) * Math.PI * 2
        magic.play('ice-spikes', center.x + Math.cos(angle) * tileWidth, center.y + Math.sin(angle) * tileWidth * 0.6 + 8, {
          durationMilliseconds: 450
        })
        for (const monster of world.getMonstersInRadius(center, tileWidth * 2)) {
          world.hitMonster(monster.id, scaleDamage(baseDamage, 0.4), at)
          world.freezeMonster(monster.id, 600, at)
        }
      })
    }
    return true
  }
}

// 3장: 0.7초 뒤 가장 가까운 적 자리에 불기둥. 둘레 2.5칸 1.3배 + 화상.
const METEOR: WeaponSkill = {
  id: 'meteor',
  cast: ({ baseDamage, origin, tileWidth, world, magic, schedule }) => {
    const target = findClosestMonster(world, origin, tileWidth * 8)
    if (!target) {
      return false
    }
    const center = world.getMonsterCenter(target)
    // 화염 기둥이 솟구쳐 0.7초 뒤 가장 크게 타오를 때 맞는다(LPC 마법 그림).
    magic.play('fire-pillar', center.x, center.y + 14, { scale: 1.1, durationMilliseconds: 1400 })
    schedule(700, (at) => {
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
