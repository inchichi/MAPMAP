-- TS playerProgression.ts → Lua. PlayerProfile(객체)를 받아 레벨업/스탯/스킬 보상 규칙을 계산한다(JSON 마샬링).
-- 상수 소유는 TS(공식만 Lua): PLAYER_MAX_LEVEL, PLAYER_LEVEL_UP_STAT_POINTS, PLAYER_LEVEL_UP_HP_BONUS,
-- PLAYER_LEVEL_UP_SKILL_POINTS, PLAYER_LEVEL_UP_MP_BONUS, PLAYER_BASE_MAX_MANA,
-- PLAYER_BASE_INTELLIGENCE_STAT, PLAYER_INTELLIGENCE_MP_BONUS_PER_POINT 와 스탯 효과 상한은 모두 인자로 전달된다.
-- skill_index 는 JS 0-based, Lua skills 배열은 1-based. spend_* 의 실패(undefined)는 json_null 로 반환한다.

-- profile 의 모든 키를 얕게 복사한다(중첩 객체는 호출부에서 새로 만든다 — TS의 spread 패턴).
local function shallow_copy(t)
  local out = {}
  for k, v in pairs(t) do
    out[k] = v
  end
  return out
end

-- ── getPlayerSkillPointCost ──
function progression_skill_point_cost(skill)
  if skill.level >= skill.maxLevel then
    return 0
  end
  if skill.level <= 1 then
    return 2
  end
  if skill.level == 2 then
    return 3
  end
  return 4
end

-- ── getPlayerSkillLevelLabel ──
function progression_skill_level_label(skill)
  if skill.level >= skill.maxLevel then
    return 'MAX'
  end
  return skill.level .. ' / ' .. skill.maxLevel
end

-- ── getPlayerSkillUserLevel ──
function progression_skill_user_level(total_skill_points_earned)
  return math.max(1, math.floor(total_skill_points_earned) + 1)
end

-- ── getPlayerMaxManaForProfile ── 기본 + 레벨당 + 지력 보너스.
-- mana 는 { base_max_mana, level_up_mp_bonus, base_intelligence_stat, intelligence_mp_bonus_per_point } (TS 상수).
function progression_max_mana_for_profile(profile, mana)
  return mana.base_max_mana
    + (math.max(1, math.floor(profile.level)) - 1) * mana.level_up_mp_bonus
    + math.max(0, profile.stats.intelligence - mana.base_intelligence_stat) * mana.intelligence_mp_bonus_per_point
end

-- 내부: syncPlayerManaFromStats — mp.max 가 바뀌면 늘어난 만큼 current 도 올린다.
local function sync_mana_from_stats(profile, mana)
  local next_mp_max = progression_max_mana_for_profile(profile, mana)

  if next_mp_max == profile.mp.max then
    return profile
  end

  local next_mp_current = math.min(
    next_mp_max,
    profile.mp.current + math.max(0, next_mp_max - profile.mp.max)
  )

  local out = shallow_copy(profile)
  out.mp = { current = next_mp_current, max = next_mp_max }
  return out
end

-- ── grantPlayerLevelUpRewards ──
function progression_grant_level_up_rewards(
  profile,
  levels,
  max_level,
  level_up_stat_points,
  level_up_hp_bonus,
  level_up_skill_points,
  level_up_mp_bonus
)
  local next_levels = math.max(0, math.floor(levels))
  local applied_levels = math.min(next_levels, math.max(0, max_level - profile.level))

  if applied_levels == 0 then
    return profile
  end

  local next_hp_max = profile.hp.max + applied_levels * level_up_hp_bonus
  local next_mp_max = profile.mp.max + applied_levels * level_up_mp_bonus
  local gained_skill_points = applied_levels * level_up_skill_points

  local out = shallow_copy(profile)
  out.level = profile.level + applied_levels
  out.statPoints = profile.statPoints + applied_levels * level_up_stat_points
  out.availableSkillPoints = profile.availableSkillPoints + gained_skill_points
  out.totalSkillPointsEarned = profile.totalSkillPointsEarned + gained_skill_points
  out.hp = { current = next_hp_max, max = next_hp_max }
  out.mp = { current = next_mp_max, max = next_mp_max }
  return out
end

-- ── spendPlayerStatPoint ── (실패 시 json_null)
-- max_useful_value: 이 값부터는 효과가 늘지 않아 더 찍지 못한다(상한 없는 스탯은 -1).
function progression_spend_stat_point(profile, stat_id, max_useful_value, mana)
  if profile.statPoints <= 0 then
    return json_null
  end

  if max_useful_value >= 0 and profile.stats[stat_id] >= max_useful_value then
    return json_null
  end

  -- stats 는 새 테이블로(중첩 spread). 해당 stat_id 만 +1.
  local next_stats = shallow_copy(profile.stats)
  next_stats[stat_id] = profile.stats[stat_id] + 1

  local next_profile = shallow_copy(profile)
  next_profile.stats = next_stats

  -- TS: mp 는 intelligence 일 때만 sync 후 mp, 아니면 원래 profile.mp.
  local result = shallow_copy(next_profile)
  result.statPoints = profile.statPoints - 1
  if stat_id == 'intelligence' then
    local synced = sync_mana_from_stats(next_profile, mana)
    result.mp = synced.mp
  else
    result.mp = profile.mp
  end
  return result
end

-- 스킬을 배울 수 있는 플레이어 레벨(0-based profile.skills 인덱스, TS getPlayerSkillRequiredLevelByProfileIndex 미러).
-- 표에 없는 스킬은 1.
local SKILL_REQUIRED_LEVEL_BY_INDEX = {
  [10] = 15, -- cross-slash
  [11] = 38, -- flash-strike
  [12] = 1, -- whirlwind
  [13] = 15, -- ground-splitter
  [14] = 38, -- execute
  [15] = 15, -- arrow-rain
  [16] = 38, -- storm-arrows
  [17] = 15, -- blizzard
  [18] = 38, -- meteor
}

-- ── spendPlayerSkillPoint ── (실패 시 json_null) skill_index 0-based.
function progression_spend_skill_point(profile, skill_index)
  local skill = profile.skills[skill_index + 1]

  if skill == nil or skill == json_null then
    return json_null
  end

  local skill_point_cost = progression_skill_point_cost(skill)

  if skill_point_cost <= 0 or profile.availableSkillPoints < skill_point_cost then
    return json_null
  end

  -- 2·3장 무기 스킬은 그 장의 레벨대가 되어야 배운다.
  if profile.level < (SKILL_REQUIRED_LEVEL_BY_INDEX[skill_index] or 1) then
    return json_null
  end

  -- skills 배열을 새로 만들되, 대상 인덱스만 level+1 한 새 스킬로 교체(TS의 map).
  local next_skills = json_array({})
  for i = 1, #profile.skills do
    if i == skill_index + 1 then
      local updated = shallow_copy(profile.skills[i])
      updated.level = profile.skills[i].level + 1
      next_skills[i] = updated
    else
      next_skills[i] = profile.skills[i]
    end
  end

  local out = shallow_copy(profile)
  out.availableSkillPoints = profile.availableSkillPoints - skill_point_cost
  out.skills = next_skills
  return out
end
