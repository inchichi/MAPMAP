import { describe, expect, it } from 'vitest'

import {
  FIRST_FLOOR,
  FLOORS,
  floorAbove,
  floorBelow,
  floorByStem,
  floorLabel,
  floorMemory,
  isStairsOpen,
  stairsDestination,
  type FloorMemories
} from './floors'

describe('FLOORS', () => {
  it('계약의 층 다섯 장을 순서대로 담는다', () => {
    expect(FLOORS.map((floor) => floor.stem)).toEqual([
      'floor-1-ruins',
      'floor-2-mushroom',
      'floor-3-water',
      'floor-4-lava',
      'floor-5-deep'
    ])
    // index 는 배열 자리와 같아야 한다 — audio.ts 의 층 곡 표를 이 값으로 색인한다.
    FLOORS.forEach((floor, index) => {
      expect(floor.index).toBe(index)
    })
    expect(FIRST_FLOOR.stem).toBe('floor-1-ruins')
  })

  it('HUD 에 층 번호와 이름을 함께 띄운다', () => {
    expect(floorLabel(FLOORS[2])).toBe('3층  물웅덩이')
  })
})

describe('floorByStem', () => {
  it('계단 target 을 층으로 되돌린다', () => {
    expect(floorByStem('floor-4-lava').name).toBe('용암굴')
  })

  it('목록에 없는 이름은 던진다', () => {
    expect(() => floorByStem('floor-9-nowhere')).toThrow(/floor-9-nowhere/)
  })
})

describe('floorBelow / floorAbove', () => {
  it('한 칸씩 오르내린다', () => {
    expect(floorBelow(FLOORS[0])?.stem).toBe('floor-2-mushroom')
    expect(floorAbove(FLOORS[1])?.stem).toBe('floor-1-ruins')
  })

  it('맨 위와 맨 아래에서는 갈 곳이 없다', () => {
    expect(floorAbove(FLOORS[0])).toBeUndefined()
    expect(floorBelow(FLOORS[4])).toBeUndefined()
  })
})

describe('stairsDestination', () => {
  it('target 이 가리키는 층을 돌려준다', () => {
    expect(stairsDestination(FLOORS[1], 'down', 'floor-3-water').index).toBe(2)
    expect(stairsDestination(FLOORS[1], 'up', 'floor-1-ruins').index).toBe(0)
  })

  it('방향과 어긋난 target 은 던진다', () => {
    // 왕복이 어긋난 맵. 걷다가 헤매기 전에 여기서 걸려야 한다.
    expect(() => stairsDestination(FLOORS[1], 'down', 'floor-1-ruins')).toThrow(/floor-1-ruins/)
    expect(() => stairsDestination(FLOORS[4], 'down', 'floor-5-deep')).toThrow(/floor-5-deep/)
  })
})

describe('isStairsOpen', () => {
  it('하행은 그 층 보스를 잡아야 열린다', () => {
    expect(isStairsOpen('down', 1)).toBe(false)
    expect(isStairsOpen('down', 0)).toBe(true)
  })

  it('상행은 언제나 열려 있다', () => {
    expect(isStairsOpen('up', 3)).toBe(true)
  })
})

describe('floorMemory', () => {
  it('처음 들어간 층에는 빈 기억을 만든다', () => {
    const memories: FloorMemories = new Map()
    const memory = floorMemory(memories, FLOORS[0], 8, 8)

    expect(memory.openedChests.size).toBe(0)
    expect(memory.defeatedMonsters.size).toBe(0)
    expect(memory.defeatedBosses.size).toBe(0)
    expect(memory.exploration.discovered.length).toBe(64)
  })

  it('다시 들어가면 같은 기억을 준다', () => {
    const memories: FloorMemories = new Map()
    floorMemory(memories, FLOORS[1], 4, 4).defeatedMonsters.add(7)
    // 다른 층을 거쳐 돌아와도 잡아 둔 몬스터가 살아나면 안 된다.
    floorMemory(memories, FLOORS[2], 4, 4).defeatedMonsters.add(1)

    expect([...floorMemory(memories, FLOORS[1], 4, 4).defeatedMonsters]).toEqual([7])
    expect(memories.size).toBe(2)
  })
})
