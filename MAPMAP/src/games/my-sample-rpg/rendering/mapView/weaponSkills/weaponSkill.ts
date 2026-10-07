// 무기 계열 스킬의 공통 계약. 스킬 하나 = cast 함수 하나(weaponSkills/<계열>Skills.ts).
// 무기 확인·쿨다운·MP·예약 타격·정리는 playerWeaponSkills.ts 가 맡고, 스킬은 "누구를 어떻게 때리나"만 정한다.
import type { LpcMagicEffects } from '../lpcMagicEffects'
import type { CharacterMoveDirection, CharacterState } from '../../../characterState'
import type { CollisionRect } from '../../characterCollision'
import type { WeaponSkillEffects } from './weaponSkillEffects'

export type Point = { x: number; y: number }

// 스킬이 맵 화면에 할 수 있는 일. 좌표는 픽셀, 거리 단위는 이름에 적었다.
export type WeaponSkillWorld = {
  getLiveMonsters: () => CharacterState[]
  getMonsterCenter: (monster: CharacterState) => Point
  getMonstersInRect: (rect: CollisionRect) => CharacterState[]
  getMonstersInRadius: (center: Point, radiusPixels: number) => CharacterState[]
  // 선분 a→b 에서 halfWidthPixels 안에 몸 가운데가 있는 몬스터
  getMonstersNearSegment: (from: Point, to: Point, halfWidthPixels: number) => CharacterState[]
  getMonsterHpRatio: (monsterId: string) => number
  hitMonster: (monsterId: string, damage: number, now: number) => void
  knockbackMonster: (monsterId: string, distanceInTiles: number) => void
  freezeMonster: (monsterId: string, durationMilliseconds: number, now: number) => void
  applyDamageOverTime: (
    monsterId: string,
    kind: 'burn' | 'poison',
    dot: { damagePerTick: number; ticks: number; intervalMilliseconds: number },
    now: number
  ) => void
  // 벽에 막히면 멈춘다(몬스터는 지나간다). 실제로 움직인 칸 수를 돌려준다.
  movePlayer: (direction: Point, distanceInTiles: number) => number
  setPlayerFacing: (facing: CharacterMoveDirection) => void
  // 몬스터가 주는 피해를 막는다(방어 자세와 같은 판정).
  protectPlayer: (durationMilliseconds: number, now: number) => void
  // 몸 동작(장착 무기의 공격 모션)만 재생한다. 판정은 스킬이 직접 한다.
  playPlayerAttackMotion: (now: number) => void
  getPlayerCenter: () => Point
  impact: (point: Point, color: number, radiusPixels: number, now: number) => void
}

export type WeaponSkillCast = {
  now: number
  skillLevel: number
  // 스탯 공격력(지팡이는 지력, 그 밖은 힘) + 스킬 위력 + 무기 공격력
  baseDamage: number
  player: CharacterState
  origin: Point
  direction: Point
  tileWidth: number
  tileHeight: number
  world: WeaponSkillWorld
  effects: WeaponSkillEffects
  // 마법 손그림(Extended LPC Magic Pack) — 지팡이 스킬이 쓴다
  magic: LpcMagicEffects
  // delayMilliseconds 뒤에 action 을 실행한다(여러 번 때리기, 늦게 떨어지는 공격). 사망·씬 이동 때 취소된다.
  schedule: (delayMilliseconds: number, action: (now: number) => void) => void
}

export type WeaponSkill = {
  id: string
  // 대상이 없어 쓰지 못했으면 false (MP·쿨다운을 쓰지 않는다)
  cast: (cast: WeaponSkillCast) => boolean
}

export const SKILL_COLOR = {
  steel: 0xe8f2ff,
  gold: 0xffe08a,
  ember: 0xffa04a,
  earth: 0xd8b48a,
  shadow: 0xb28cff,
  poison: 0x9be36a,
  lightning: 0xfff2a0,
  ice: 0x9fdcff,
  fire: 0xff7a3d
}

export const getFacingFromDirection = (direction: Point): CharacterMoveDirection =>
  Math.abs(direction.x) >= Math.abs(direction.y)
    ? direction.x < 0 ? 'left' : 'right'
    : direction.y < 0 ? 'up' : 'down'

export const scaleDamage = (baseDamage: number, factor: number): number =>
  Math.max(1, Math.round(baseDamage * factor))

export const rotateDirection = (direction: Point, radians: number): Point => ({
  x: direction.x * Math.cos(radians) - direction.y * Math.sin(radians),
  y: direction.x * Math.sin(radians) + direction.y * Math.cos(radians)
})

export const offsetPoint = (point: Point, direction: Point, distancePixels: number): Point => ({
  x: point.x + direction.x * distancePixels,
  y: point.y + direction.y * distancePixels
})

export const getDistance = (from: Point, to: Point): number =>
  Math.hypot(to.x - from.x, to.y - from.y)

export const getDistanceToSegment = (point: Point, from: Point, to: Point): number => {
  const segmentX = to.x - from.x
  const segmentY = to.y - from.y
  const lengthSquared = segmentX * segmentX + segmentY * segmentY
  const t = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((point.x - from.x) * segmentX + (point.y - from.y) * segmentY) / lengthSquared))

  return getDistance(point, { x: from.x + segmentX * t, y: from.y + segmentY * t })
}

export const findClosestMonster = (
  world: WeaponSkillWorld,
  origin: Point,
  maxDistancePixels: number
): CharacterState | undefined =>
  world
    .getLiveMonsters()
    .map((monster) => ({ monster, distance: getDistance(origin, world.getMonsterCenter(monster)) }))
    .filter(({ distance }) => distance <= maxDistancePixels)
    .sort((left, right) => left.distance - right.distance)[0]?.monster
