-- TS playerConsumables.ts → Lua. 소비 아이템(포션) 사용 로직.
-- inventory_* 전역은 같은 호스트에 로드된 player-inventory.lua 에서 옴.
-- quickslots_* 전역은 같은 호스트에 로드된 player-quickslots.lua 에서 옴.
-- 결과가 없으면 json_null 을 반환(래퍼에서 undefined 로 정규화).

-- 포션별 회복량 — TS playerConsumables.ts 의 PLAYER_POTION_RESTORE 와 같아야 한다.
local POTION_RESTORE = {
  ['health-potion'] = { resource = 'hp', amount = 10 },
  ['mana-potion'] = { resource = 'mp', amount = 10 },
  ['health-potion-medium'] = { resource = 'hp', amount = 60 },
  ['mana-potion-medium'] = { resource = 'mp', amount = 40 },
  ['health-potion-large'] = { resource = 'hp', amount = 150 },
  ['mana-potion-large'] = { resource = 'mp', amount = 80 },
}

-- 문자열 키 테이블을 얕게 복사한다(TS 의 spread 패턴).
local function shallow_copy(t)
  local out = {}
  for k, v in pairs(t) do
    out[k] = v
  end
  return out
end

-- consumeInventorySlot: quantity > 1 이면 set(quantity-1), 아니면 clear.
local function consume_inventory_slot(inventory, slot_index, item)
  if item.quantity > 1 then
    local reduced = shallow_copy(item)
    reduced.quantity = item.quantity - 1
    return inventory_set_slot(inventory, slot_index, reduced)
  else
    return inventory_clear_slot(inventory, slot_index)
  end
end

-- consumables_use_inventory(profile_json, inventory_json, slot_index)
-- → {profile=..., inventory=...} 또는 json_null
-- slot_index 는 0-based.
function consumables_use_inventory(profile, inventory, slot_index)
  local item = inventory.slots[slot_index + 1]
  if item == nil or item == json_null then
    return json_null
  end

  local restore = POTION_RESTORE[item.id]

  if restore ~= nil then
    local resource = profile[restore.resource]
    local next_resource = shallow_copy(resource)
    next_resource.current = math.min(resource.max, resource.current + restore.amount)
    local next_profile = shallow_copy(profile)
    next_profile[restore.resource] = next_resource
    return {
      profile = next_profile,
      inventory = consume_inventory_slot(inventory, slot_index, item)
    }

  elseif item.id == 'antidote-incense' or item.id == 'warming-tea' then
    -- 해독 향·생강차: 능력치는 그대로, 하나만 쓴다(독안개·눈보라 면역 시간은 화면 쪽 poisonFog 가 잰다)
    return {
      profile = profile,
      inventory = consume_inventory_slot(inventory, slot_index, item)
    }

  else
    return json_null
  end
end

-- consumables_use_quickslot(profile_json, inventory_json, quickslots_json, quickslot_index)
-- → {profile=..., inventory=...} 또는 json_null
-- quickslot_index 는 0-based.
function consumables_use_quickslot(profile, inventory, quickslots, quickslot_index)
  local assignment = quickslots_get_assignment(quickslots, quickslot_index)
  if assignment == nil or assignment == json_null then
    return json_null
  end
  return consumables_use_inventory(profile, inventory, assignment.inventorySlotIndex)
end
