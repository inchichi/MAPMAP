// 활 계열 2·3장 스킬(1장 멀티샷·관통·독화살은 playerCombatEffects 의 기존 구현). 2장 화살비, 3장 폭풍 화살.
import { findClosestMonster, offsetPoint, rotateDirection, scaleDamage, type WeaponSkill } from './weaponSkill'

// 하늘에서 떨어지는 화살: 표적 위 높이·옆으로 비낀 정도(픽셀)
const ARROW_FALL_HEIGHT = 140
const ARROW_FALL_DRIFT = 24

// 2장: 8칸 안 가장 가까운 적 둘레 1.8칸에 0.25초 뒤부터 0.2초 간격으로 네 번 쏟아진다(한 번에 0.4배).
const ARROW_RAIN: WeaponSkill = {
  id: 'arrow-rain',
  cast: ({ now, baseDamage, origin, tileWidth, world, effects, schedule }) => {
    const target = findClosestMonster(world, origin, tileWidth * 8)
    if (!target) {
      return false
    }
    const center = world.getMonsterCenter(target)
    // 떨어질 자리를 알리는 마법 원
    effects.play('ring-orange', center, now, { scale: 3, centered: true, durationMilliseconds: 1100, fadeOut: true })
    const fallAngle = Math.atan2(ARROW_FALL_HEIGHT, ARROW_FALL_DRIFT)
    for (let volley = 0; volley < 4; volley += 1) {
      const landings = [{ x: -0.6, y: -0.3 }, { x: 0.5, y: -0.4 }, { x: 0, y: 0.5 }].map((offset) => ({
        x: center.x + offset.x * tileWidth * (1 + volley * 0.2),
        y: center.y + offset.y * tileWidth
      }))
      schedule(volley * 200, (at) => {
        for (const landing of landings) {
          effects.play(
            'arrow',
            { x: landing.x - ARROW_FALL_DRIFT, y: landing.y - ARROW_FALL_HEIGHT },
            at,
            { to: landing, rotation: fallAngle, scale: 1.5, durationMilliseconds: 250 }
          )
        }
      })
      schedule(250 + volley * 200, (at) => {
        for (const landing of landings) {
          effects.play('dust-ring', landing, at, { scale: 1, durationMilliseconds: 300 })
        }
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
    effects.play('spark', origin, now, { scale: 1, centered: true, durationMilliseconds: 200 })
    for (const turn of [-0.4, -0.2, 0, 0.2, 0.4]) {
      const way = rotateDirection(direction, turn)
      const end = offsetPoint(origin, way, tileWidth * 8)
      // 부채꼴로 날아가는 진짜 화살 다섯 발
      effects.play('arrow', offsetPoint(origin, way, 12), now, {
        to: end,
        rotation: Math.atan2(way.y, way.x),
        scale: 1.5,
        durationMilliseconds: 320
      })
      for (const monster of world.getMonstersNearSegment(origin, end, tileWidth * 0.5)) {
        world.hitMonster(monster.id, scaleDamage(baseDamage, 0.6), now)
      }
    }
    return true
  }
}

export const BOW_SKILLS: readonly WeaponSkill[] = [ARROW_RAIN, STORM_ARROWS]
