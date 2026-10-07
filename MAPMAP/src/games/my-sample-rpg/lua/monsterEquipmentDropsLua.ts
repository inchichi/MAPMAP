// 몬스터 장비 드롭 규칙의 Lua 구현 래퍼 — monsterEquipmentDrops.ts(TS)와 동일한 API를 제공하되
// 드롭 인덱스 계산은 monster-equipment-drops.lua(Lua VM)에서 한다. 게임 부팅 시 1회 await로 만들고,
// 이후 동기 호출(원시값 마샬링이라 가볍다). 정의 배열 + 확률 상수는 TS 데이터로 남는다.
//
// 드롭 종류·등급 고르기는 TS rollMonsterDrop 그대로 쓰고, 후보 인덱스 계산만 Lua 에 맡긴다.

import monsterEquipmentDropsLuaSource from '../assets/lua/monster-equipment-drops.lua?raw'

import {
  rollMonsterDrop,
  type MonsterEquipmentDropDefinition
} from '../monsterEquipmentDrops'
import {
  createLuaLogicHost,
  type CreateLuaLogicHostInput
} from './luaLogicHost'

export type MonsterEquipmentDropsLua = {
  rollMonsterDrop: (
    input: Omit<Parameters<typeof rollMonsterDrop>[0], 'pickIndex'>
  ) => MonsterEquipmentDropDefinition | undefined
  close: () => void
}

export const MONSTER_EQUIPMENT_DROPS_LUA_SOURCE = monsterEquipmentDropsLuaSource

export const createMonsterEquipmentDropsLua = async (
  input: CreateLuaLogicHostInput = {}
): Promise<MonsterEquipmentDropsLua> => {
  const host = await createLuaLogicHost(input)
  host.runModule(monsterEquipmentDropsLuaSource, '@monster-equipment-drops.lua')

  return {
    rollMonsterDrop: (dropInput) =>
      rollMonsterDrop({
        ...dropInput,
        pickIndex: (indexRoll, count) =>
          host.callNumber('monster_equipment_drop_index', indexRoll, count)
      }),
    close: (): void => {
      host.close()
    }
  }
}
