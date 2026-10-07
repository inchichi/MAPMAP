import { DEFAULT_CHARACTER_MOVE_SPEED_TILES_PER_SECOND } from './characterState'
import type { PlayerProfile, PlayerStatId } from './playerProfile'

export const PLAYER_AGILITY_MOVE_SPEED_BONUS_PER_POINT = 0.35
export const PLAYER_MIN_MOVE_SPEED_TILES_PER_SECOND = 4
export const PLAYER_MAX_MOVE_SPEED_TILES_PER_SECOND = 12
export const PLAYER_BASE_INTELLIGENCE_STAT = 3
export const PLAYER_INTELLIGENCE_MP_BONUS_PER_POINT = 2
export const PLAYER_LUCK_EVADE_BASE_CHANCE = 0.04
export const PLAYER_LUCK_EVADE_BONUS_PER_POINT = 0.015
export const PLAYER_MAX_EVADE_CHANCE = 0.35

export const getPlayerPhysicalAttackPower = (
  profile: Pick<PlayerProfile, 'stats'>
): number => Math.max(1, Math.floor(profile.stats.strength))

// 마법 공격력 — 힘이 물리 공격력을 올리듯 지력이 마법 공격력을 올린다.
// 마법 무기(마법 지팡이)의 기본 공격인 에너지볼 데미지가 이 값을 쓴다.
export const getPlayerMagicAttackPower = (
  profile: Pick<PlayerProfile, 'stats'>
): number => Math.max(1, Math.floor(profile.stats.intelligence))

export const getPlayerMovementSpeedTilesPerSecond = (
  profile: Pick<PlayerProfile, 'stats'>
): number =>
  clamp(
    DEFAULT_CHARACTER_MOVE_SPEED_TILES_PER_SECOND +
      (profile.stats.agility - 4) * PLAYER_AGILITY_MOVE_SPEED_BONUS_PER_POINT,
    PLAYER_MIN_MOVE_SPEED_TILES_PER_SECOND,
    PLAYER_MAX_MOVE_SPEED_TILES_PER_SECOND
  )

export const getPlayerEvadeChance = (
  profile: Pick<PlayerProfile, 'stats'>
): number =>
  clamp(
    PLAYER_LUCK_EVADE_BASE_CHANCE +
      profile.stats.luck * PLAYER_LUCK_EVADE_BONUS_PER_POINT,
    0,
    PLAYER_MAX_EVADE_CHANCE
  )

// 이 값부터는 더 찍어도 효과가 늘지 않는다(민첩=이동 속도 상한, 행운=회피율 상한). 힘·지력은 상한이 없다.
export const getPlayerStatMaxUsefulValue = (statId: PlayerStatId): number => {
  if (statId === 'agility') {
    return (
      4 +
      Math.ceil(
        (PLAYER_MAX_MOVE_SPEED_TILES_PER_SECOND - DEFAULT_CHARACTER_MOVE_SPEED_TILES_PER_SECOND) /
          PLAYER_AGILITY_MOVE_SPEED_BONUS_PER_POINT
      )
    )
  }

  if (statId === 'luck') {
    return Math.ceil(
      (PLAYER_MAX_EVADE_CHANCE - PLAYER_LUCK_EVADE_BASE_CHANCE) / PLAYER_LUCK_EVADE_BONUS_PER_POINT
    )
  }

  return Number.POSITIVE_INFINITY
}

export const shouldPlayerEvadeDamage = (
  profile: Pick<PlayerProfile, 'stats'>,
  randomValue = Math.random()
): boolean => randomValue < getPlayerEvadeChance(profile)

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))
