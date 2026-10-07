import type { PlayerMeleeMotion } from './playerEquipment'

// 무기(근접 모션)별 공격 범위(칸) — 무기 특성을 범위로 드러낸다. 게임 판정(rendering/mapView/combat.ts,
// meleeMotions/*.ts)과 보스 전투 시뮬레이터(bossTraining/bossFightSim.ts)가 같이 쓰는 한 곳.
// 둘이 다르면 학습한 보스 정책이 게임에서 어긋난다. 이펙트 그림은 이 범위에 맞춰 그리고, 판정은 그림을 읽지 않는다.
//
// single: 바라보는 쪽 몸 가장자리에서 reach 칸 앞까지, 옆으로 sidePadding 칸씩 넓힌 띠 안의 가장 가까운 한 마리.
// area: 몸 가운데에서 start 칸 떨어진 곳부터 앞으로 depth, 옆으로 width 인 사각형 안의 전부.
export type PlayerMeleeReach =
  | { kind: 'single'; reachInTiles: number; sidePaddingInTiles: number }
  | { kind: 'area'; startInTiles: number; depthInTiles: number; widthInTiles: number }

export const PLAYER_MELEE_REACH: Record<PlayerMeleeMotion, PlayerMeleeReach> = {
  // 검: 균형형 — 중간 사거리, 넓은 호(옆 여유가 넓다)
  slash: { kind: 'single', reachInTiles: 1.4, sidePaddingInTiles: 0.45 },
  // 도끼: 앞쪽을 넓게 휩쓸어 여러 마리
  cleave: { kind: 'area', startInTiles: 0.2, depthInTiles: 1.6, widthInTiles: 2.8 }
}

export const getPlayerMeleeReach = (motion: PlayerMeleeMotion): PlayerMeleeReach =>
  PLAYER_MELEE_REACH[motion]

// 기본 검(베기)의 한 마리 판정 — 게임과 보스 전투 시뮬레이터가 같이 쓴다.
export const getPlayerSwordReach = (): { reachInTiles: number; sidePaddingInTiles: number } => {
  const reach = PLAYER_MELEE_REACH.slash
  return reach.kind === 'single' ? reach : { reachInTiles: 0, sidePaddingInTiles: 0 }
}
