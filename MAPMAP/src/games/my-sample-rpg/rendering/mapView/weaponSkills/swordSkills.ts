// 검 계열 스킬(1장 스매시는 playerActions·combat 의 기존 구현). 2장 십자 베기, 3장 섬광 일섬.
import { offsetPoint, rotateDirection, scaleDamage, type WeaponSkill } from './weaponSkill'

// 2장: 네 방향으로 3칸 검기. 둘러싸였을 때 모두 벤다.
const CROSS_SLASH: WeaponSkill = {
  id: 'cross-slash',
  cast: ({ now, baseDamage, origin, direction, tileWidth, world, effects }) => {
    const hitIds = new Set<string>()
    world.playPlayerAttackMotion(now)
    // 가운데 X자 베기 + 네 방향으로 날아가는 검기
    effects.play('slash-double', origin, now, { scale: 3, centered: true, durationMilliseconds: 300 })
    for (const turn of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const way = rotateDirection(direction, turn)
      const end = offsetPoint(origin, way, tileWidth * 3)
      effects.play('slash-curved', offsetPoint(origin, way, tileWidth * 0.6), now, {
        to: end,
        rotation: Math.atan2(way.y, way.x),
        scale: 2,
        durationMilliseconds: 320,
        fadeOut: true
      })
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
    const angle = Math.atan2(direction.y, direction.x)
    // 지나간 길에 칸마다 차례로 베기 자국, 도착점에 번쩍임
    for (let tile = 0; tile <= Math.max(1, movedTiles); tile += 1) {
      const point = offsetPoint(origin, direction, tileWidth * tile)
      schedule(tile * 30, (at) =>
        effects.play('cut', point, at, { rotation: angle, scale: 2, centered: true, durationMilliseconds: 260 })
      )
    }
    effects.play('spark', end, now, { scale: 2, centered: true, durationMilliseconds: 320 })
    world.playPlayerAttackMotion(now)
    for (const monster of targets) {
      world.hitMonster(monster.id, baseDamage, now)
    }
    schedule(300, (later) => {
      const liveIds = new Set(world.getLiveMonsters().map((monster) => monster.id))
      for (const monster of targets) {
        if (liveIds.has(monster.id)) {
          // 뒤늦게 터지는 두 번째 베기
          effects.play('slash-double', world.getMonsterCenter(monster), later, {
            scale: 2,
            centered: true,
            durationMilliseconds: 260
          })
          world.hitMonster(monster.id, scaleDamage(baseDamage, 0.5), later)
        }
      }
    })
    return true
  }
}

export const SWORD_SKILLS: readonly WeaponSkill[] = [CROSS_SLASH, FLASH_STRIKE]
