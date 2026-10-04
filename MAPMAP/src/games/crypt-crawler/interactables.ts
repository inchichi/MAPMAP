// 상자처럼 "가까이 가서 누르는" 대상 고르기. 렌더러가 매 프레임 호출하므로 순수하게 두고
// 별도로 테스트한다.

export type InteractableTarget<T> = {
  item: T
  index: number
  distanceTiles: number
}

/**
 * 사거리 안에서 가장 가까운 대상을 고른다. 이미 처리한 대상은 `skip` 으로 걸러낸다
 * (연 상자를 계속 다시 집으면 바로 옆의 안 연 상자를 영영 못 연다).
 * 거리가 같으면 앞 인덱스가 이긴다 — 프레임마다 대상이 흔들리지 않게 하기 위해서다.
 */
export const findNearestInRange = <T extends { tileX: number, tileY: number }>(
  items: readonly T[],
  x: number,
  y: number,
  rangeTiles: number,
  skip: (index: number) => boolean = () => false
): InteractableTarget<T> | undefined => {
  let best: InteractableTarget<T> | undefined

  for (let index = 0; index < items.length; index += 1) {
    if (skip(index)) {
      continue
    }
    const item = items[index]
    // 타일 중심 기준으로 잰다 — 스폰 좌표는 타일의 좌상단이다.
    const distanceTiles = Math.hypot(item.tileX + 0.5 - x, item.tileY + 0.5 - y)
    if (distanceTiles > rangeTiles) {
      continue
    }
    if (!best || distanceTiles < best.distanceTiles) {
      best = { item, index, distanceTiles }
    }
  }

  return best
}
