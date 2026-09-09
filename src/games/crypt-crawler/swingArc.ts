// 휘두르기 판정만 남긴 모듈. 전투 수치와 성장은 my-sample-rpg 의 순수 모듈을 그대로 쓰지만,
// 90도 부채꼴 판정은 거기 대응하는 것이 없어 crypt-crawler 가 직접 가진다.

import type { CharacterMoveDirection } from '../my-sample-rpg/characterState'

export const isWithinSwingArc = (
  originX: number,
  originY: number,
  facing: CharacterMoveDirection,
  targetX: number,
  targetY: number,
  reachTiles: number
): boolean => {
  const toTargetX = targetX - originX
  const toTargetY = targetY - originY

  if (toTargetX * toTargetX + toTargetY * toTargetY > reachTiles * reachTiles) {
    return false
  }

  // 90도 부채꼴 = 바라보는 축의 성분이 옆 축 성분 이상인 사분면. 대각선 경계는 포함이라
  // 두 방향에서 모두 맞을 수 있지만, 등 뒤는 어떤 거리에서도 맞지 않는다.
  switch (facing) {
    case 'down':
      return toTargetY >= Math.abs(toTargetX)
    case 'up':
      return -toTargetY >= Math.abs(toTargetX)
    case 'left':
      return -toTargetX >= Math.abs(toTargetY)
    case 'right':
      return toTargetX >= Math.abs(toTargetY)
  }
}
