import { describe, expect, it } from 'vitest'

import { findNearestInRange } from './interactables'

const chests = [
  { tileX: 10, tileY: 10, tier: 1 },
  { tileX: 12, tileY: 10, tier: 2 },
  { tileX: 40, tileY: 40, tier: 3 }
]

describe('findNearestInRange', () => {
  it('사거리 안에서 가장 가까운 것을 고른다', () => {
    // 타일 중심(10.5,10.5)에 딱 선 상태.
    const found = findNearestInRange(chests, 10.5, 10.5, 3)

    expect(found?.index).toBe(0)
    expect(found?.item.tier).toBe(1)
    expect(found?.distanceTiles).toBeCloseTo(0)
  })

  it('사거리 밖이면 아무것도 고르지 않는다', () => {
    expect(findNearestInRange(chests, 0, 0, 3)).toBeUndefined()
  })

  it('두 번째가 더 가까우면 그쪽을 고른다', () => {
    const found = findNearestInRange(chests, 12.4, 10.5, 3)

    expect(found?.index).toBe(1)
  })

  it('이미 처리한 대상은 건너뛰고 다음으로 가까운 것을 고른다', () => {
    const opened = new Set([0])
    const found = findNearestInRange(chests, 10.5, 10.5, 4, (index) => opened.has(index))

    expect(found?.index).toBe(1)
  })

  it('전부 건너뛰면 아무것도 없다', () => {
    const found = findNearestInRange(chests, 10.5, 10.5, 99, () => true)

    expect(found).toBeUndefined()
  })

  it('거리가 같으면 앞 인덱스가 이긴다 — 대상이 프레임마다 흔들리지 않게', () => {
    const pair = [
      { tileX: 10, tileY: 10 },
      { tileX: 12, tileY: 10 }
    ]
    // 두 타일 중심(10.5, 12.5)의 정확히 가운데.
    const found = findNearestInRange(pair, 11.5, 10.5, 3)

    expect(found?.index).toBe(0)
  })

  it('사거리 경계는 포함한다', () => {
    const single = [{ tileX: 10, tileY: 10 }]

    expect(findNearestInRange(single, 12.5, 10.5, 2)).toBeDefined()
    expect(findNearestInRange(single, 12.5, 10.5, 1.9)).toBeUndefined()
  })

  it('빈 목록에도 터지지 않는다', () => {
    expect(findNearestInRange([], 0, 0, 5)).toBeUndefined()
  })
})
