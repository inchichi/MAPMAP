// playerProgression의 레벨업/스탯/스킬 보상 규칙을 Lua로 실행하는 래퍼(PlayerProfile 객체 ↔ callJson).
// 원본의 export 함수 시그니처를 그대로 미러링한다. spend* 의 undefined 반환은 Lua의 json_null(→null)로
// 표현되며 TS undefined로 정규화한다. 상수 소유는 TS — 호출 시 인자로 Lua에 전달한다(공식만 Lua).

import playerProgressionSource from '../assets/lua/player-progression.lua?raw'

import {
  PLAYER_MAX_LEVEL,
  type PlayerProfile,
  type PlayerSkillSlot,
  type PlayerStatId
} from '../playerProfile'
// 원본 playerProgression.ts가 소유한 공개 상수(단일 출처: TS). Lua엔 인자로 전달한다.
import {
  PLAYER_BASE_MAX_MANA,
  PLAYER_LEVEL_UP_HP_BONUS,
  PLAYER_LEVEL_UP_MP_BONUS,
  PLAYER_LEVEL_UP_SKILL_POINTS,
  PLAYER_LEVEL_UP_STAT_POINTS
} from '../playerProgression'
import {
  PLAYER_BASE_INTELLIGENCE_STAT,
  PLAYER_INTELLIGENCE_MP_BONUS_PER_POINT,
  getPlayerStatMaxUsefulValue
} from '../playerStatEffects'

import {
  createLuaLogicHost,
  type CreateLuaLogicHostInput,
  type LuaLogicHost
} from './luaLogicHost'

export type PlayerProgressionLua = {
  grantPlayerLevelUpRewards: (
    profile: PlayerProfile,
    levels?: number
  ) => PlayerProfile
  spendPlayerStatPoint: (
    profile: PlayerProfile,
    statId: PlayerStatId
  ) => PlayerProfile | undefined
  spendPlayerSkillPoint: (
    profile: PlayerProfile,
    skillIndex: number
  ) => PlayerProfile | undefined
  getPlayerSkillPointCost: (skill: PlayerSkillSlot) => number
  getPlayerSkillLevelLabel: (skill: PlayerSkillSlot) => string
  getPlayerSkillUserLevel: (totalSkillPointsEarned: number) => number
  getPlayerMaxManaForProfile: (
    profile: Pick<PlayerProfile, 'level' | 'stats'>
  ) => number
  close: () => void
}

// 최대 마나 공식에 쓰는 TS 상수 묶음(Lua 의 mana 인자).
const PLAYER_MANA_CONSTANTS = {
  base_max_mana: PLAYER_BASE_MAX_MANA,
  level_up_mp_bonus: PLAYER_LEVEL_UP_MP_BONUS,
  base_intelligence_stat: PLAYER_BASE_INTELLIGENCE_STAT,
  intelligence_mp_bonus_per_point: PLAYER_INTELLIGENCE_MP_BONUS_PER_POINT
}

// JSON 은 Infinity 를 못 실으므로 상한 없는 스탯은 -1 로 넘긴다.
const maxUsefulStatValueForLua = (statId: PlayerStatId): number => {
  const value = getPlayerStatMaxUsefulValue(statId)
  return Number.isFinite(value) ? value : -1
}

export const createPlayerProgressionLua = async (
  input: CreateLuaLogicHostInput & { host?: LuaLogicHost } = {}
): Promise<PlayerProgressionLua> => {
  const host = input.host ?? (await createLuaLogicHost(input))
  host.runModule(playerProgressionSource, '@player-progression.lua')

  return {
    grantPlayerLevelUpRewards: (
      profile: PlayerProfile,
      levels = 1
    ): PlayerProfile =>
      host.callJson<PlayerProfile>(
        'progression_grant_level_up_rewards',
        profile,
        levels,
        PLAYER_MAX_LEVEL,
        PLAYER_LEVEL_UP_STAT_POINTS,
        PLAYER_LEVEL_UP_HP_BONUS,
        PLAYER_LEVEL_UP_SKILL_POINTS,
        PLAYER_LEVEL_UP_MP_BONUS
      ),
    spendPlayerStatPoint: (
      profile: PlayerProfile,
      statId: PlayerStatId
    ): PlayerProfile | undefined => {
      const result = host.callJson<PlayerProfile | null>(
        'progression_spend_stat_point',
        profile,
        statId,
        maxUsefulStatValueForLua(statId),
        PLAYER_MANA_CONSTANTS
      )

      return result === null ? undefined : result
    },
    spendPlayerSkillPoint: (
      profile: PlayerProfile,
      skillIndex: number
    ): PlayerProfile | undefined => {
      const result = host.callJson<PlayerProfile | null>(
        'progression_spend_skill_point',
        profile,
        skillIndex
      )

      return result === null ? undefined : result
    },
    getPlayerSkillPointCost: (skill: PlayerSkillSlot): number =>
      host.callJson<number>('progression_skill_point_cost', skill),
    getPlayerSkillLevelLabel: (skill: PlayerSkillSlot): string =>
      host.callJson<string>('progression_skill_level_label', skill),
    getPlayerSkillUserLevel: (totalSkillPointsEarned: number): number =>
      host.callJson<number>(
        'progression_skill_user_level',
        totalSkillPointsEarned
      ),
    getPlayerMaxManaForProfile: (
      profile: Pick<PlayerProfile, 'level' | 'stats'>
    ): number =>
      host.callJson<number>(
        'progression_max_mana_for_profile',
        profile,
        PLAYER_MANA_CONSTANTS
      ),
    close: (): void => {
      if (!input.host) {
        host.close()
      }
    }
  }
}
