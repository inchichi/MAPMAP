import { isWallTileAt } from '../tiled/createWallTileLookup'

export type CollisionRect = {
  x: number
  y: number
  width: number
  height: number
}

// 코너 어시스트: 한 칸짜리 통로에 들어갈 때 정확히 격자에 맞춰 서지 않아도
// 진행 방향과 직각으로 살짝 밀어 넣어준다. 어긋남이 이 값보다 크면
// "벽을 향해 걷는 중"으로 보고 개입하지 않는다(의도치 않은 미끄러짐 방지).
export const CORNER_ASSIST_MAX_MISALIGNMENT_TILES = 0.4

export const doCollisionRectsIntersect = (
  left: CollisionRect,
  right: CollisionRect
): boolean =>
  left.x < right.x + right.width &&
  left.x + left.width > right.x &&
  left.y < right.y + right.height &&
  left.y + left.height > right.y

export const isCharacterPositionBlocked = (
  wallTiles: Set<string>,
  blockingRects: CollisionRect[],
  x: number,
  y: number,
  width: number,
  height: number
): boolean => {
  const epsilon = 1e-6
  const minTileX = Math.floor(x + epsilon)
  const maxTileX = Math.floor(x + width - epsilon)
  const minTileY = Math.floor(y + epsilon)
  const maxTileY = Math.floor(y + height - epsilon)

  for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
    for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
      if (isWallTileAt(wallTiles, tileX, tileY)) {
        return true
      }
    }
  }

  return blockingRects.some((blockingRect) =>
    doCollisionRectsIntersect(blockingRect, {
      x,
      y,
      width,
      height
    })
  )
}

type CornerAssistInput = {
  wallTiles: Set<string>
  blockingRects: CollisionRect[]
  x: number
  y: number
  width: number
  height: number
  deltaX: number
  deltaY: number
}

export type CornerAssistNudge = {
  axis: 'x' | 'y'
  amount: number
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

// 막힌 축과 직각으로 밀어 넣을 양을 구한다. 통로 칸에 몸이 걸쳐 있을 때만
// 동작하며, 밀어 넣은 자리가 실제로 비어 있는 경우에만 값을 돌려준다.
const resolveAxisNudge = (
  input: CornerAssistInput,
  axis: 'x' | 'y'
): CornerAssistNudge | undefined => {
  const { wallTiles, blockingRects, x, y, width, height } = input
  const epsilon = 1e-6
  // 이동하려던 축의 목표 좌표(그쪽은 이미 막힌 상태) + 정렬시킬 축의 현재 좌표
  const movingDelta = axis === 'y' ? input.deltaX : input.deltaY
  const alignPosition = axis === 'y' ? y : x
  const alignSize = axis === 'y' ? height : width
  const targetX = axis === 'y' ? x + input.deltaX : x
  const targetY = axis === 'y' ? y : y + input.deltaY

  // 몸이 한 줄 안에 들어가지 않으면(2칸 이상 차지) 정렬로 해결되지 않는다.
  if (alignSize > 1) {
    return undefined
  }

  const firstLine = Math.floor(alignPosition + epsilon)
  const lastLine = Math.floor(alignPosition + alignSize - epsilon)

  // 이미 한 줄에 정렬돼 있으면 진짜 벽이다 — 어시스트하지 않는다.
  if (firstLine === lastLine) {
    return undefined
  }

  const candidates = [firstLine, firstLine + 1].sort(
    (left, right) =>
      Math.abs(left - alignPosition) - Math.abs(right - alignPosition)
  )

  for (const candidate of candidates) {
    const misalignment = candidate - alignPosition

    if (Math.abs(misalignment) > CORNER_ASSIST_MAX_MISALIGNMENT_TILES) {
      continue
    }

    const alignedX = axis === 'y' ? targetX : candidate
    const alignedY = axis === 'y' ? candidate : targetY

    // 정렬된 목적지가 벽으로 막혀 있으면 통로가 아니다(캐릭터 사각형은 무시 —
    // 목적지 판정은 지형만 본다).
    if (
      isCharacterPositionBlocked(wallTiles, [], alignedX, alignedY, width, height)
    ) {
      continue
    }

    // 옆으로 미는 동작 자체는 현재 위치 기준으로 NPC·몬스터까지 포함해 검사한다.
    const sidewaysX = axis === 'y' ? x : candidate
    const sidewaysY = axis === 'y' ? candidate : y

    if (
      isCharacterPositionBlocked(
        wallTiles,
        blockingRects,
        sidewaysX,
        sidewaysY,
        width,
        height
      )
    ) {
      continue
    }

    // 프레임당 이동량을 넘지 않게 잘라 속도가 늘어나지 않도록 한다.
    const budget = Math.abs(movingDelta)

    return {
      axis,
      amount: clamp(misalignment, -budget, budget)
    }
  }

  return undefined
}

// 가로 이동이 막혔으면 세로로, 세로 이동이 막혔으면 가로로 살짝 정렬시킨다.
// 대각 입력은 기존 축분리 슬라이딩이 이미 처리하므로 개입하지 않는다.
export const resolveCornerAssistNudge = (
  input: CornerAssistInput
): CornerAssistNudge | undefined => {
  if (input.deltaX !== 0 && input.deltaY === 0) {
    return resolveAxisNudge(input, 'y')
  }

  if (input.deltaY !== 0 && input.deltaX === 0) {
    return resolveAxisNudge(input, 'x')
  }

  return undefined
}
