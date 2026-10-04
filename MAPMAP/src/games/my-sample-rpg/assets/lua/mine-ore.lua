---@class OreVeinState
---@field remaining integer 이 광맥에서 더 캘 수 있는 광석 수
---@field respawn_timer number 고갈 후 재생성까지 남은 시간(초)
---@field ore_item_id string 캐면 지급되는 아이템 id
---@field hits_per_vein integer 재생성 시 채워지는 광석 수
---@field respawn_seconds number 고갈 후 재생성까지 걸리는 시간(초)
---@field tool_item_id string 채굴에 필요한 도구 아이템 id

---광맥 컨트롤러 — 곡괭이를 가진 플레이어가 상호작용하면 광석을 지급한다.
---`docs/lua-controller-api.md` 와 `src/game/lua/luaControllerApi.ts` 계약만 사용한다.
---고갈 상태는 씬이 살아 있는 동안만 유지되고(step 타이머로 재생성),
---씬을 나갔다 오면 광맥이 다시 차 있다 — 폐광의 광맥은 넉넉하다.

---@type table<string, OreVeinState>
local controllers = {}
local controller = {}

local function read_number(value, fallback)
  if type(value) == "number" and value == value and value > 0 then
    return value
  end
  return fallback
end

local function read_string(value, fallback)
  if type(value) == "string" and #value > 0 then
    return value
  end
  return fallback
end

---@param id string 캐릭터(광맥) 식별자
function controller.register(id)
  local config = engine.self.get_controller_config()

  local hits = math.floor(read_number(config.hitsPerVein, 4))
  controllers[id] = {
    remaining = hits,
    respawn_timer = 0,
    ore_item_id = read_string(config.oreItemId, "crystal-ore"),
    hits_per_vein = hits,
    respawn_seconds = read_number(config.respawnSeconds, 45),
    tool_item_id = read_string(config.toolItemId, "pickaxe")
  }
end

---@param id string 캐릭터(광맥) 식별자
function controller.unregister(id)
  controllers[id] = nil
end

---광맥은 움직이지 않는다. 고갈 상태면 재생성 타이머만 돌린다.
---@param id string
---@param dt number
function controller.step(id, dt)
  local state = controllers[id]

  if state ~= nil and state.remaining <= 0 then
    state.respawn_timer = state.respawn_timer - dt

    if state.respawn_timer <= 0 then
      state.remaining = state.hits_per_vein
    end
  end

  return 0, 0
end

---@param id string 광맥 식별자
---@param source_id string 상호작용을 건 캐릭터 식별자
function controller.interact(id, source_id)
  local state = controllers[id]

  if state == nil then
    return nil, nil
  end

  if engine.inventory.get_item_count(state.tool_item_id) <= 0 then
    engine.ui.show_message("단단한 수정 광맥이다. 곡괭이가 있어야 캘 수 있겠어.", 2.2)
    return nil, nil
  end

  if state.remaining <= 0 then
    engine.ui.show_message("바닥난 광맥이다. 수정이 다시 자랄 때까지 기다리자.", 2.2)
    return nil, nil
  end

  state.remaining = state.remaining - 1

  if state.remaining <= 0 then
    state.respawn_timer = state.respawn_seconds
  end

  engine.inventory.request_add(state.ore_item_id, 1)
  engine.audio.play_sound("playerSwordHit")

  if state.remaining > 0 then
    engine.ui.show_message("곡괭이로 수정 광석을 캐냈다! (남은 광석 " .. state.remaining .. ")", 1.3)
  else
    engine.ui.show_message("수정 광석을 캐냈다! 광맥이 바닥났다.", 1.8)
  end

  return nil, nil
end

return controller
