// 도끼 계열 스킬. 1장 회오리 베기, 2장 대지 가르기, 3장 처형.
import { SKILL_COLOR, offsetPoint, scaleDamage, type WeaponSkill } from './weaponSkill'

// 1장: 0.4초 동안 둘레 1.5칸을 세 번 벤다(한 번에 기본의 절반). 둘러싸일수록 이득.
const WHIRLWIND: WeaponSkill = {
  id: 'whirlwind',
  cast: ({ now, baseDamage, origin, tileWidth, world, effects, schedule }) => {
    const spin = (at: number) => {
      const center = world.getPlayerCenter()
      world.playPlayerAttackMotion(at)
      effects.arc(center, tileWidth * 1.3, 0, Math.PI * 2, SKILL_COLOR.ember, 220, at)
      for (const monster of world.getMonstersInRadius(center, tileWidth * 1.5)) {
        world.hitMonster(monster.id, scaleDamage(baseDamage, 0.5), at)
      }
    }
    spin(now)
    schedule(200, spin)
    schedule(400, spin)
    effects.ring(origin, tileWidth * 1.5, SKILL_COLOR.ember, 600, now)
    return true
  }
}

// 2장: 5칸 앞까지 땅을 갈라 줄지은 적을 베고 밀어낸다.
const GROUND_SPLITTER: WeaponSkill = {
  id: 'ground-splitter',
  cast: ({ now, baseDamage, origin, direction, tileWidth, world, effects }) => {
    const end = offsetPoint(origin, direction, tileWidth * 5)
    world.playPlayerAttackMotion(now)
    effects.streak(origin, end, SKILL_COLOR.earth, 8, 420, now)
    for (let tile = 1; tile <= 5; tile += 1) {
      effects.ring(offsetPoint(origin, direction, tileWidth * tile), tileWidth * 0.7, SKILL_COLOR.earth, 300 + tile * 40, now)
    }
    for (const monster of world.getMonstersNearSegment(origin, end, tileWidth * 0.6)) {
      world.hitMonster(monster.id, baseDamage, now)
      world.knockbackMonster(monster.id, 0.5)
    }
    return true
  }
}

// 3장: 앞 2칸·폭 2.4칸을 크게 내리찍는다. 체력이 30% 아래인 적은 두 배.
const EXECUTE: WeaponSkill = {
  id: 'execute',
  cast: ({ now, baseDamage, origin, direction, tileWidth, world, effects }) => {
    const front = offsetPoint(origin, direction, tileWidth * 2)
    const angle = Math.atan2(direction.y, direction.x)
    world.playPlayerAttackMotion(now)
    effects.arc(origin, tileWidth * 1.8, angle - 1.1, angle + 1.1, SKILL_COLOR.ember, 380, now)
    effects.ring(offsetPoint(origin, direction, tileWidth * 1.2), tileWidth * 1.2, SKILL_COLOR.ember, 380, now)
    for (const monster of world.getMonstersNearSegment(origin, front, tileWidth * 1.2)) {
      const isFinishing = world.getMonsterHpRatio(monster.id) < 0.3
      world.hitMonster(monster.id, scaleDamage(baseDamage, isFinishing ? 2.4 : 1.2), now)
      if (isFinishing) {
        world.impact(world.getMonsterCenter(monster), SKILL_COLOR.fire, 16, now)
      }
    }
    return true
  }
}

export const AXE_SKILLS: readonly WeaponSkill[] = [WHIRLWIND, GROUND_SPLITTER, EXECUTE]
