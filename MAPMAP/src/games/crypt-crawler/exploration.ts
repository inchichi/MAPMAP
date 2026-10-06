// 지도에 드러난 영역. 256x256 맵을 전부 보여주면 157스크린짜리 던전을 탐험할 이유가
// 사라지므로, 플레이어가 지나간 반경만 누적해 기록한다. 타일당 1바이트(65,536바이트)면
// 충분해서 비트팩킹은 하지 않는다 — 읽는 쪽이 단순한 편이 낫다.

export type ExplorationState = {
  width: number
  height: number
  discovered: Uint8Array
}

export const createExploration = (width: number, height: number): ExplorationState => ({
  width,
  height,
  discovered: new Uint8Array(width * height)
})

export const isDiscovered = (
  state: ExplorationState,
  tileX: number,
  tileY: number
): boolean => {
  if (tileX < 0 || tileY < 0 || tileX >= state.width || tileY >= state.height) {
    return false
  }

  return state.discovered[tileY * state.width + tileX] !== 0
}

/**
 * 플레이어 주변 원형 영역을 드러내고, 이번에 새로 드러난 칸 수를 돌려준다.
 * 0이면 지도 텍스처를 다시 그릴 필요가 없다는 뜻이라 호출부가 그걸로 갱신을 건너뛴다.
 */
export const revealAround = (
  state: ExplorationState,
  tileX: number,
  tileY: number,
  radiusTiles: number
): number => {
  const centerX = Math.floor(tileX)
  const centerY = Math.floor(tileY)
  const radius = Math.max(0, Math.floor(radiusTiles))
  const radiusSquared = radius * radius
  let revealed = 0

  const minY = Math.max(0, centerY - radius)
  const maxY = Math.min(state.height - 1, centerY + radius)
  const minX = Math.max(0, centerX - radius)
  const maxX = Math.min(state.width - 1, centerX + radius)

  for (let y = minY; y <= maxY; y += 1) {
    const dy = y - centerY
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - centerX
      if (dx * dx + dy * dy > radiusSquared) {
        continue
      }
      const index = y * state.width + x
      if (state.discovered[index] === 0) {
        state.discovered[index] = 1
        revealed += 1
      }
    }
  }

  return revealed
}

export const discoveredRatio = (state: ExplorationState): number => {
  if (state.discovered.length === 0) {
    return 0
  }

  let count = 0
  for (let index = 0; index < state.discovered.length; index += 1) {
    count += state.discovered[index]
  }

  return count / state.discovered.length
}
