import { readFile } from 'node:fs/promises'

import { afterEach, describe, expect, it } from 'vitest'

import { rollMonsterDrop } from '../monsterEquipmentDrops'
import {
  createMonsterEquipmentDropsLua,
  type MonsterEquipmentDropsLua
} from './monsterEquipmentDropsLua'

// 실제 Lua 5.3.6 WASM VM을 node에서 로드해(디스크의 mjs/wasm 주입), Lua 구현이 TS 기준
// 구현과 모든 시퀀스에서 동일한 드롭(또는 undefined)을 내는지 검증한다. RNG는 고정 배열에서
// 순차적으로 값을 내는 클로저로 결정론적으로 만든다(확률 게이트 + 인덱스, 같은 순서로 소비).
const LUA_MODULE_JS_URL = new URL(
  '../../../../public/vendor/lua/lua-5.3.6.mjs',
  import.meta.url
)
const LUA_MODULE_WASM_URL = new URL(
  '../../../../public/vendor/lua/lua-5.3.6.wasm',
  import.meta.url
)

const createDrops = async (): Promise<MonsterEquipmentDropsLua> => {
  const [{ default: createLuaModule }, wasmBinary] = await Promise.all([
    import(/* @vite-ignore */ LUA_MODULE_JS_URL.href),
    readFile(LUA_MODULE_WASM_URL)
  ])

  return createMonsterEquipmentDropsLua({
    createLuaModuleFactory: async () => createLuaModule,
    createLuaModuleOptions: { wasmBinary }
  })
}

// 각 시퀀스는 [종류 값, 한 등급 아래 값, 인덱스 값] 순으로 소비된다(보스는 등급 값을 건너뛴다).
// 장비(<0.2)·포션(<0.45)·없음, 등급 낮춤 여부, 인덱스 처음/중간/끝/클램프를 두루 다룬다.
const SEQUENCES: number[][] = [
  [0.45, 0.0, 0.0], // 없음(경계)
  [0.95, 0.5, 0.5], // 없음
  [0.0, 0.9, 0.0], // 장비 + 제 등급 + 인덱스 0
  [0.19, 0.1, 0.5], // 장비 + 한 등급 아래 + 중간
  [0.1, 0.25, 0.999], // 장비 + 제 등급(경계) + 끝
  [0.0, 0.0, 1.0], // 장비 + 한 등급 아래 + 인덱스 클램프
  [0.2, 0.9, 0.0], // 포션(경계) + 제 등급 + 처음
  [0.3, 0.1, 0.75], // 포션 + 한 등급 아래
  [0.44, 0.5, 0.9999999], // 포션 + 끝 경계
  [0.123, 0.456, 0.333333] // 임의
]

const createSequenceRng = (values: number[]): (() => number) => {
  let cursor = 0

  return (): number => {
    const value = values[cursor] ?? 0
    cursor += 1

    return value
  }
}

describe('monsterEquipmentDropsLua (real wasm bridge)', () => {
  let drops: MonsterEquipmentDropsLua | undefined

  afterEach(() => {
    drops?.close()
    drops = undefined
  })

  it('matches the TS monsterEquipmentDrops across every sequence', async () => {
    drops = await createDrops()

    for (const sequence of SEQUENCES) {
      for (const monsterLevel of [1, 12, 18, 30, 40, 49]) {
        for (const isBoss of [false, true]) {
          const luaResult = drops.rollMonsterDrop({
            monsterLevel,
            isBoss,
            random: createSequenceRng(sequence)
          })
          const referenceResult = rollMonsterDrop({
            monsterLevel,
            isBoss,
            random: createSequenceRng(sequence)
          })

          expect(luaResult).toEqual(referenceResult)
        }
      }
    }
  })
})
