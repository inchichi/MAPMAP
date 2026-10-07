// 도끼 계열 스킬. 1장 회오리 베기, 2장 대지 가르기, 3장 처형.
import { SKILL_COLOR, offsetPoint, scaleDamage, type Point, type WeaponSkill } from './weaponSkill'

// 몸 가운데에서 발밑으로(흙먼지·바위 가시는 땅에서 솟는다)
const toFeet = (center: Point, tileHeight: number): Point => ({ x: center.x, y: center.y + tileHeight * 0.45 })

// 1장: 0.4초 동안 둘레 1.5칸을 세 번 벤다(한 번에 기본의 절반). 둘러싸일수록 이득.
const WHIRLWIND: WeaponSkill = {
  id: 'whirlwind',
  cast: ({ now, baseDamage, origin, tileWidth, tileHeight, world, effects, schedule }) => {
    const spin = (at: number) => {
      const center = world.getPlayerCenter()
      world.playPlayerAttackMotion(at)
      // 몸을 감싸는 원형 베기(지름 3칸)
      effects.play('circular-slash', center, at, { scale: 3, centered: true, durationMilliseconds: 220 })
      for (const monster of world.getMonstersInRadius(center, tileWidth * 1.5)) {
        world.hitMonster(monster.id, scaleDamage(baseDamage, 0.5), at)
      }
    }
    spin(now)
    schedule(200, spin)
    schedule(400, spin)
    effects.play('dust-ring', toFeet(origin, tileHeight), now, { scale: 3, durationMilliseconds: 600 })
    return true
  }
}

// 2장: 5칸 앞까지 땅을 갈라 줄지은 적을 베고 밀어낸다.
const GROUND_SPLITTER: WeaponSkill = {
  id: 'ground-splitter',
  cast: ({ now, baseDamage, origin, direction, tileWidth, tileHeight, world, effects, schedule }) => {
    const end = offsetPoint(origin, direction, tileWidth * 5)
    world.playPlayerAttackMotion(now)
    // 칸마다 차례로 바위 가시가 솟고 흙먼지가 인다
    for (let tile = 1; tile <= 5; tile += 1) {
      const feet = toFeet(offsetPoint(origin, direction, tileWidth * tile), tileHeight)
      schedule((tile - 1) * 60, (at) => {
        effects.play('earth-spikes', feet, at, { scale: 1, durationMilliseconds: 420 })
        effects.play('dust-ring', feet, at, { scale: 2, durationMilliseconds: 420 })
      })
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
    // 크게 내리찍는 이중 곡선 베기
    effects.play('slash-double-curved', offsetPoint(origin, direction, tileWidth * 1.2), now, {
      rotation: angle,
      scale: 3,
      centered: true,
      durationMilliseconds: 380
    })
    for (const monster of world.getMonstersNearSegment(origin, front, tileWidth * 1.2)) {
      const isFinishing = world.getMonsterHpRatio(monster.id) < 0.3
      world.hitMonster(monster.id, scaleDamage(baseDamage, isFinishing ? 2.4 : 1.2), now)
      if (isFinishing) {
        effects.play('spark-circle', world.getMonsterCenter(monster), now, {
          scale: 3,
          centered: true,
          tint: SKILL_COLOR.fire,
          durationMilliseconds: 420
        })
      }
    }
    return true
  }
}

export const AXE_SKILLS: readonly WeaponSkill[] = [WHIRLWIND, GROUND_SPLITTER, EXECUTE]
