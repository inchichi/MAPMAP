// 활 계열 2·3장 스킬(1장 멀티샷·관통·독화살은 playerCombatEffects 의 기존 구현). 2장 화살비, 3장 폭풍 화살.
import { SKILL_COLOR, findClosestMonster, offsetPoint, rotateDirection, scaleDamage, type WeaponSkill } from './weaponSkill'

// 2장: 8칸 안 가장 가까운 적 둘레 1.8칸에 0.25초 뒤부터 0.2초 간격으로 네 번 쏟아진다(한 번에 0.4배).
const ARROW_RAIN: WeaponSkill = {
  id: 'arrow-rain',
  cast: ({ now, baseDamage, origin, tileWidth, world, effects, schedule }) => {
    const target = findClosestMonster(world, origin, tileWidth * 8)
    if (!target) {
      return false
    }
    const center = world.getMonsterCenter(target)
    effects.ring(center, tileWidth * 1.8, SKILL_COLOR.gold, 1100, now)
    for (let volley = 0; volley < 4; volley += 1) {
      schedule(volley * 200, (at) => {
        for (const offset of [{ x: -0.6, y: -0.3 }, { x: 0.5, y: -0.4 }, { x: 0, y: 0.5 }]) {
          effects.fall(
            { x: center.x + offset.x * tileWidth * (1 + volley * 0.2), y: center.y + offset.y * tileWidth },
            6,
            SKILL_COLOR.steel,
            250,
            at
          )
        }
      })
      schedule(250 + volley * 200, (at) => {
        for (const monster of world.getMonstersInRadius(center, tileWidth * 1.8)) {
          world.hitMonster(monster.id, scaleDamage(baseDamage, 0.4), at)
        }
      })
    }
    return true
  }
}

// 3장: 부채꼴 다섯 발(±0.4 라디안), 발마다 8칸 관통. 가까이 줄지은 적은 여러 발을 맞는다(발당 0.6배).
const STORM_ARROWS: WeaponSkill = {
  id: 'storm-arrows',
  cast: ({ now, baseDamage, origin, direction, tileWidth, world, effects }) => {
    for (const turn of [-0.4, -0.2, 0, 0.2, 0.4]) {
      const end = offsetPoint(origin, rotateDirection(direction, turn), tileWidth * 8)
      effects.streak(origin, end, SKILL_COLOR.gold, 3, 320, now)
      for (const monster of world.getMonstersNearSegment(origin, end, tileWidth * 0.5)) {
        world.hitMonster(monster.id, scaleDamage(baseDamage, 0.6), now)
      }
    }
    return true
  }
}

export const BOW_SKILLS: readonly WeaponSkill[] = [ARROW_RAIN, STORM_ARROWS]
