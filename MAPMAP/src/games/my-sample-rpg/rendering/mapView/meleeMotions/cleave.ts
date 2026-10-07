// 도끼 내려찍어 가르기: 크게 들어 올렸다가 마지막에 내려칠 때 앞쪽 넓은 부채꼴 안의 몬스터를 모두 베고 조금 더 밀어낸다.
// 대신 다음 공격까지 조금 더 기다린다. 몸 동작은 LPC 베기(slash, 6프레임).
import { PLAYER_MELEE_REACH } from '../../../playerMeleeReach'
import { createFrontHitRect, type MeleeMotion } from './meleeMotion'

const CLEAVE_AREA = PLAYER_MELEE_REACH.cleave

export const CLEAVE_MOTION: MeleeMotion = {
  hitStartProgress: 5 / 6,
  hit: {
    kind: 'area',
    getHitRect: (origin) =>
      CLEAVE_AREA.kind === 'area'
        ? createFrontHitRect(origin, CLEAVE_AREA.startInTiles, CLEAVE_AREA.depthInTiles, CLEAVE_AREA.widthInTiles)
        : createFrontHitRect(origin, 0, 0, 0),
    extraKnockbackInTiles: 0.15
  },
  // 위험 보상: 크게 휘둘러 여러 마리를 베는 대신 한 마리 상대 초당 피해는 검의 약 0.86배
  cooldownMilliseconds: 420
}
