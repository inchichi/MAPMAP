// 창 계열 스킬. 1장 돌진 찌르기, 2장 회전 창술, 3장 뇌창.
import { SKILL_COLOR, offsetPoint, scaleDamage, type WeaponSkill } from './weaponSkill'

// 1장: 2칸 뛰어들며 길 위(+창 길이)의 적을 모두 꿰뚫는다. 안전거리를 버리는 대가.
const LUNGE: WeaponSkill = {
  id: 'lunge',
  cast: ({ now, baseDamage, origin, direction, tileWidth, world, effects }) => {
    const movedTiles = world.movePlayer(direction, 2)
    const end = offsetPoint(origin, direction, tileWidth * (movedTiles + 0.8))
    world.playPlayerAttackMotion(now)
    effects.streak(origin, end, SKILL_COLOR.steel, 6, 300, now)
    for (const monster of world.getMonstersNearSegment(origin, end, tileWidth * 0.7)) {
      world.hitMonster(monster.id, baseDamage, now)
    }
    return true
  }
}

// 2장: 창을 크게 돌려 둘레 2칸의 적을 베고 1칸 밀어낸다.
const SPEAR_SWEEP: WeaponSkill = {
  id: 'spear-sweep',
  cast: ({ now, baseDamage, origin, tileWidth, world, effects }) => {
    world.playPlayerAttackMotion(now)
    effects.arc(origin, tileWidth * 1.6, 0, Math.PI * 2, SKILL_COLOR.steel, 360, now)
    effects.ring(origin, tileWidth * 2, SKILL_COLOR.steel, 360, now)
    for (const monster of world.getMonstersInRadius(origin, tileWidth * 2)) {
      world.hitMonster(monster.id, baseDamage, now)
      world.knockbackMonster(monster.id, 1)
    }
    return true
  }
}

// 3장: 7칸 직선 관통 후, 가장 멀리 맞은 적(없으면 끝)에서 터져 둘레 1.5칸을 마비(빙결)시킨다.
const THUNDER_JAVELIN: WeaponSkill = {
  id: 'thunder-javelin',
  cast: ({ now, baseDamage, skillLevel, origin, direction, tileWidth, world, effects }) => {
    const end = offsetPoint(origin, direction, tileWidth * 7)
    const pierced = world.getMonstersNearSegment(origin, end, tileWidth * 0.6)
    world.playPlayerAttackMotion(now)
    effects.streak(origin, end, SKILL_COLOR.lightning, 6, 360, now)
    for (const monster of pierced) {
      world.hitMonster(monster.id, baseDamage, now)
    }
    const farthest = pierced
      .map((monster) => world.getMonsterCenter(monster))
      .sort((left, right) =>
        (right.x - origin.x) * direction.x + (right.y - origin.y) * direction.y -
        ((left.x - origin.x) * direction.x + (left.y - origin.y) * direction.y))[0]
    const blast = farthest ?? end
    effects.ring(blast, tileWidth * 1.5, SKILL_COLOR.lightning, 420, now)
    world.impact(blast, SKILL_COLOR.lightning, 14, now)
    for (const monster of world.getMonstersInRadius(blast, tileWidth * 1.5)) {
      world.hitMonster(monster.id, scaleDamage(baseDamage, 0.6), now)
      world.freezeMonster(monster.id, 1200 + skillLevel * 150, now)
    }
    return true
  }
}

export const SPEAR_SKILLS: readonly WeaponSkill[] = [LUNGE, SPEAR_SWEEP, THUNDER_JAVELIN]
