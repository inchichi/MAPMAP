-- TS playerSkills.ts → Lua (순수 로직 6개 함수). Vite 에셋 URL이 필요한 display info는 제외.
-- profile.skills 는 {level, maxLevel, ...} 객체 배열 (JS 0-based 인덱스).
-- 결과는 callJson 경유(JSON 마샬링): boolean → true/false, 미발견 number → json_null.

local PLAYER_SMASH_SKILL_ID    = 'smash'
local PLAYER_PROTECT_SKILL_ID  = 'protect'
local PLAYER_DASH_SKILL_ID     = 'dash'
local PLAYER_SKILL_UNLOCK_LEVEL = 1

-- skillId → profile.skills 배열 인덱스 (0-based, Lua 내부에선 +1 해서 접근)
local PROFILE_INDEX_BY_ID = {
  smash   = 0,
  protect = 1,
  dash    = 2,
  focus   = 3,
  ['ice-bolt']        = 4,
  fireball            = 5,
  ['chain-lightning'] = 6,
  ['multi-shot']      = 7,
  ['piercing-arrow']  = 8,
  ['poison-arrow']    = 9,
  -- 무기 계열 스킬(TS playerWeaponSkills.ts 정의 순서)
  ['cross-slash']     = 10,
  ['flash-strike']    = 11,
  whirlwind           = 12,
  ['ground-splitter'] = 13,
  execute             = 14,
  ['arrow-rain']      = 15,
  ['storm-arrows']    = 16,
  blizzard            = 17,
  meteor              = 18,
}

-- 마법 스킬 레벨별 MP/위력 (TS PLAYER_MAGIC_SKILL_TABLE 미러). 5레벨 이후는 마지막 값에서
-- 레벨당 MP +1, 위력 +step.
local MAGIC_SKILL_TABLE = {
  ['ice-bolt']        = { mana = { 4, 4, 5, 5, 6 },  power = { 3, 5, 7, 9, 11 },   step = 2 },
  fireball            = { mana = { 6, 7, 8, 9, 10 }, power = { 8, 11, 14, 18, 22 }, step = 4 },
  ['chain-lightning'] = { mana = { 7, 8, 9, 10, 11 }, power = { 6, 8, 10, 13, 16 }, step = 3 },
  ['multi-shot']      = { mana = { 3, 3, 4, 4, 5 },  power = { 2, 3, 4, 5, 6 },     step = 1 },
  ['piercing-arrow']  = { mana = { 4, 5, 5, 6, 7 },  power = { 6, 9, 12, 15, 18 },  step = 3 },
  ['poison-arrow']    = { mana = { 3, 4, 4, 5, 5 },  power = { 2, 3, 4, 5, 6 },     step = 1 },
  -- 무기 계열 스킬(TS playerWeaponSkills.ts 장별 표)
  ['cross-slash']     = { mana = { 9, 10, 11, 12, 13 }, power = { 24, 30, 37, 45, 54 }, step = 9 },
  ['flash-strike']    = { mana = { 15, 16, 18, 20, 22 }, power = { 48, 60, 74, 90, 108 }, step = 18 },
  whirlwind           = { mana = { 4, 5, 6, 7, 8 }, power = { 10, 14, 18, 23, 28 }, step = 5 },
  ['ground-splitter'] = { mana = { 9, 10, 11, 12, 13 }, power = { 24, 30, 37, 45, 54 }, step = 9 },
  execute             = { mana = { 15, 16, 18, 20, 22 }, power = { 48, 60, 74, 90, 108 }, step = 18 },
  ['arrow-rain']      = { mana = { 9, 10, 11, 12, 13 }, power = { 24, 30, 37, 45, 54 }, step = 9 },
  ['storm-arrows']    = { mana = { 15, 16, 18, 20, 22 }, power = { 48, 60, 74, 90, 108 }, step = 18 },
  blizzard            = { mana = { 9, 10, 11, 12, 13 }, power = { 24, 30, 37, 45, 54 }, step = 9 },
  meteor              = { mana = { 15, 16, 18, 20, 22 }, power = { 48, 60, 74, 90, 108 }, step = 18 },
}

local function magic_table_value(values, skill_level, step)
  local nl = math.max(1, math.floor(skill_level))
  if nl <= #values then return values[nl] end
  return values[#values] + (nl - #values) * step
end

local SMASH_MANA_COST_BY_LEVEL = {
  [1] = 4, [2] = 5, [3] = 6, [4] = 7, [5] = 8,
}

local SMASH_DAMAGE_BY_LEVEL = {
  [1] = 10, [2] = 14, [3] = 18, [4] = 23, [5] = 28,
}

local PROTECT_DURATION_BY_LEVEL = {
  [1] = 1800, [2] = 2200, [3] = 2600, [4] = 3000, [5] = 3400,
}

-- ── 내부 헬퍼 ──

local function smash_damage_by_level(skill_level)
  local nl = math.max(1, math.floor(skill_level))
  local v = SMASH_DAMAGE_BY_LEVEL[nl]
  if v ~= nil then return v end
  return SMASH_DAMAGE_BY_LEVEL[5] + (nl - 5) * 5
end

local function smash_mana_cost_by_level(skill_level)
  local nl = math.max(1, math.floor(skill_level))
  local v = SMASH_MANA_COST_BY_LEVEL[nl]
  if v ~= nil then return v end
  return SMASH_MANA_COST_BY_LEVEL[5] + (nl - 5)
end

-- ── 공개 함수 ──

-- getPlayerSkillLevelById: number or json_null
function player_skills_get_level(profile, skill_id)
  local profile_index = PROFILE_INDEX_BY_ID[skill_id]
  if profile_index == nil then
    return json_null
  end
  local skill = profile.skills[profile_index + 1]
  if skill == nil or skill == json_null then
    return json_null
  end
  return math.min(skill.level, skill.maxLevel)
end

-- isPlayerSkillUnlockedInProfile: boolean
function player_skills_is_unlocked(profile, skill_id)
  local profile_index = PROFILE_INDEX_BY_ID[skill_id]
  if profile_index == nil then
    return false
  end
  local skill = profile.skills[profile_index + 1]
  if skill == nil or skill == json_null then
    return false
  end
  return skill.level >= PLAYER_SKILL_UNLOCK_LEVEL
end

-- getPlayerSkillDamageById: number (0 if not smash or unknown)
function player_skills_damage(profile, skill_id)
  local level = player_skills_get_level(profile, skill_id)
  if level == json_null then
    return 0
  end
  local magic = MAGIC_SKILL_TABLE[skill_id]
  if magic ~= nil then
    return magic_table_value(magic.power, level, magic.step)
  end
  if skill_id ~= PLAYER_SMASH_SKILL_ID then
    return 0
  end
  return smash_damage_by_level(level)
end

-- getPlayerSkillDamageBonusById: same as damage
function player_skills_damage_bonus(profile, skill_id)
  return player_skills_damage(profile, skill_id)
end

-- getPlayerSkillManaCostById: number
function player_skills_mana_cost(profile, skill_id)
  local level = player_skills_get_level(profile, skill_id)
  if level == json_null then
    return 0
  end
  if skill_id == PLAYER_SMASH_SKILL_ID then
    return smash_mana_cost_by_level(level)
  end
  if skill_id == PLAYER_PROTECT_SKILL_ID then
    return 2
  end
  if skill_id == PLAYER_DASH_SKILL_ID then
    return 3
  end
  local magic = MAGIC_SKILL_TABLE[skill_id]
  if magic ~= nil then
    return magic_table_value(magic.mana, level, 1)
  end
  return 0
end

-- getPlayerProtectSkillDurationByLevel: number
function player_skills_protect_duration(skill_level)
  local nl = math.max(1, math.floor(skill_level))
  local v = PROTECT_DURATION_BY_LEVEL[nl]
  if v ~= nil then return v end
  return PROTECT_DURATION_BY_LEVEL[5] + (nl - 5) * 400
end
