// 검 계열 스킬(1장 스매시는 playerActions·combat 의 기존 구현). 2장 십자 베기, 3장 섬광 일섬.
import { SKILL_COLOR, offsetPoint, rotateDirection, scaleDamage, type WeaponSkill } from './weaponSkill'

// 2장: 네 방향으로 3칸 검기. 둘러싸였을 때 모두 벤다.
const CROSS_SLASH: WeaponSkill = {
  id: 'cross-slash',
  cast: ({ now, baseDamage, origin, direction, tileWidth, world, effects }) => {
    const hitIds = new Set<string>()
    world.playPlayerAttackMotion(now)
    for (const turn of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const end = offsetPoint(origin, rotateDirection(direction, turn), tileWidth * 3)
      effects.streak(origin, end, SKILL_COLOR.steel, 6, 320, now)
      for (const monster of world.getMonstersNearSegment(origin, end, tileWidth * 0.6)) {
        hitIds.add(monster.id)
      }
    }
    for (const monsterId of hitIds) {
      world.hitMonster(monsterId, baseDamage, now)
      world.knockbackMonster(monsterId, 0.4)
    }
    return true
  }
}

// 3장: 4칸을 빛처럼 지나가며 길 위의 적을 벤다(지나가는 동안 무적). 0.3초 뒤 같은 적을 한 번 더 벤다.
const FLASH_STRIKE: WeaponSkill = {
  id: 'flash-strike',
  cast: ({ now, baseDamage, origin, direction, tileWidth, world, effects, schedule }) => {
    world.protectPlayer(500, now)
    const movedTiles = world.movePlayer(direction, 4)
    const end = offsetPoint(origin, direction, tileWidth * Math.max(1, movedTiles))
    const targets = world.getMonstersNearSegment(origin, end, tileWidth * 0.8)
    effects.streak(origin, end, SKILL_COLOR.gold, 10, 380, now)
    world.playPlayerAttackMotion(now)
    for (const monster of targets) {
      world.hitMonster(monster.id, baseDamage, now)
    }
    schedule(300, (later) => {
      effects.streak(end, origin, SKILL_COLOR.steel, 4, 260, later)
      const liveIds = new Set(world.getLiveMonsters().map((monster) => monster.id))
      for (const monster of targets) {
        if (liveIds.has(monster.id)) {
          world.hitMonster(monster.id, scaleDamage(baseDamage, 0.5), later)
        }
      }
    })
    return true
  }
}

export const SWORD_SKILLS: readonly WeaponSkill[] = [CROSS_SLASH, FLASH_STRIKE]
