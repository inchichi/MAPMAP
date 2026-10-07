// 무기별 근접 공격 모션의 공통 계약. 무기 모션 하나 = 이 타입을 채운 모듈 하나(meleeMotions/*.ts).
// 몸 동작(LPC 시트)은 그대로 두고, 판정 시점·범위·쿨다운을 무기마다 다르게 한다(공격 이펙트는 그리지 않는다).
import type { CharacterMoveDirection } from '../../../characterState'
import type { CollisionRect } from '../../characterCollision'
import { PLAYER_ATTACK_DURATION_MILLISECONDS } from '../constants'

// 플레이어 몸 가운데(픽셀), 몸 크기(픽셀), 바라보는 방향, 타일 크기
export type MeleeMotionOrigin = {
  x: number
  y: number
  bodyWidth: number
  bodyHeight: number
  directionX: number
  directionY: number
  tileWidth: number
  tileHeight: number
}

export type MeleeMotionHit =
  // 앞쪽에서 가장 가까운 한 마리
  | { kind: 'single'; probeDistanceInTiles: number; sidePaddingInTiles: number }
  // 범위 안의 몬스터 전부. 맞은 몬스터는 기본 넉백에 더해 extraKnockbackInTiles 만큼 더 밀린다.
  | { kind: 'area'; getHitRect: (origin: MeleeMotionOrigin) => CollisionRect; extraKnockbackInTiles: number }

export type MeleeMotion = {
  // 공격 동작 시간 중 이 진행률부터 동작이 끝날 때(+여유)까지 판정
  hitStartProgress: number
  hit: MeleeMotionHit
  // 동작이 끝난 뒤 다음 공격까지 기다리는 시간
  cooldownMilliseconds: number
}

export const getFacingDirection = (facing: CharacterMoveDirection) => ({
  x: facing === 'left' ? -1 : facing === 'right' ? 1 : 0,
  y: facing === 'up' ? -1 : facing === 'down' ? 1 : 0
})

// 프레임이 느린 환경에서 판정 구간을 한 번도 확인하지 못하고 지나치지 않게 동작 끝 뒤에 조금 더 연다.
const MELEE_MOTION_HIT_GRACE_MILLISECONDS = 100

export const isMeleeMotionHitWindowOpen = (
  motion: MeleeMotion,
  attackElapsedMilliseconds: number
): boolean =>
  attackElapsedMilliseconds >= PLAYER_ATTACK_DURATION_MILLISECONDS * motion.hitStartProgress &&
  attackElapsedMilliseconds < PLAYER_ATTACK_DURATION_MILLISECONDS + MELEE_MOTION_HIT_GRACE_MILLISECONDS

// 몸 가운데에서 startInTiles 떨어진 곳부터 앞으로 depthInTiles, 옆으로 widthInTiles 인 사각형(픽셀)
export const createFrontHitRect = (
  origin: MeleeMotionOrigin,
  startInTiles: number,
  depthInTiles: number,
  widthInTiles: number
): CollisionRect => {
  const isHorizontal = origin.directionX !== 0
  const width = (isHorizontal ? depthInTiles : widthInTiles) * origin.tileWidth
  const height = (isHorizontal ? widthInTiles : depthInTiles) * origin.tileHeight
  const centerOffsetInTiles = startInTiles + depthInTiles / 2
  const centerX = origin.x + origin.directionX * centerOffsetInTiles * origin.tileWidth
  const centerY = origin.y + origin.directionY * centerOffsetInTiles * origin.tileHeight

  return { x: centerX - width / 2, y: centerY - height / 2, width, height }
}
