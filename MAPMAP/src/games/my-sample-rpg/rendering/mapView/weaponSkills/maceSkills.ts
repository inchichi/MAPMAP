// 철퇴 계열 스킬. 1장 대지 강타, 2장 충격파, 3장 지진. 철퇴는 적을 묶고 밀어 몸을 지키는 무기다.
import { SKILL_COLOR, scaleDamage, type WeaponSkill } from './weaponSkill'

// 1장: 둘레 2칸 약한 피해 + 잠시 얼어붙음(레벨당 길어짐).
const GROUND_SLAM: WeaponSkill = {
  id: 'ground-slam',
  cast: ({ now, baseDamage, skillLevel, origin, tileWidth, world, effects }) => {
    world.playPlayerAttackMotion(now)
    effects.ring(origin, tileWidth * 2, SKILL_COLOR.earth, 420, now)
    world.impact(origin, SKILL_COLOR.earth, 12, now)
    for (const monster of world.getMonstersInRadius(origin, tileWidth * 2)) {
      world.hitMonster(monster.id, scaleDamage(baseDamage, 0.6), now)
      world.freezeMonster(monster.id, 800 + skillLevel * 200, now)
    }
    return true
  }
}

// 2장: 0.2초 간격 세 겹의 충격파(1.2·2.2·3.2칸). 가까운 적일수록 여러 번 맞고 밀려난다.
const SHOCKWAVE: WeaponSkill = {
  id: 'shockwave',
  cast: ({ now, baseDamage, origin, tileWidth, world, effects, schedule }) => {
    world.playPlayerAttackMotion(now)
    const wave = (radiusTiles: number) => (at: number) => {
      effects.ring(origin, tileWidth * radiusTiles, SKILL_COLOR.earth, 320, at)
      for (const monster of world.getMonstersInRadius(origin, tileWidth * radiusTiles)) {
        world.hitMonster(monster.id, scaleDamage(baseDamage, 0.5), at)
        world.knockbackMonster(monster.id, 0.6)
      }
    }
    wave(1.2)(now)
    schedule(200, wave(2.2))
    schedule(400, wave(3.2))
    return true
  }
}

// 3장: 0.35초 간격 세 번, 둘레 4칸. 첫 진동에 오래 얼어붙는다.
const EARTHQUAKE: WeaponSkill = {
  id: 'earthquake',
  cast: ({ now, baseDamage, skillLevel, origin, tileWidth, world, effects, schedule }) => {
    world.playPlayerAttackMotion(now)
    const quake = (isFirst: boolean) => (at: number) => {
      effects.ring(origin, tileWidth * 4, SKILL_COLOR.earth, 380, at)
      for (const monster of world.getMonstersInRadius(origin, tileWidth * 4)) {
        world.hitMonster(monster.id, scaleDamage(baseDamage, 0.5), at)
        world.impact(world.getMonsterCenter(monster), SKILL_COLOR.earth, 8, at)
        if (isFirst) {
          world.freezeMonster(monster.id, 1500 + skillLevel * 200, at)
        }
      }
    }
    quake(true)(now)
    schedule(350, quake(false))
    schedule(700, quake(false))
    return true
  }
}

export const MACE_SKILLS: readonly WeaponSkill[] = [GROUND_SLAM, SHOCKWAVE, EARTHQUAKE]
