// 무기별 근접 공격 모션 목록. 어떤 무기가 어떤 모션인지는 장비 정의(playerEquipment.ts 의 meleeMotion)가 정한다.
// 새 무기 모션 = meleeMotions/ 에 모듈 하나 + 아래 목록에 한 줄. 기본 베기(slash)는 combat 이 직접 판정해 목록에 없다.
// 공격 이펙트는 그리지 않는다(몸 동작만).
import type { PlayerMeleeMotion } from '../../playerEquipment'
import { PLAYER_ATTACK_COOLDOWN_MILLISECONDS } from './constants'
import type { MeleeMotion } from './meleeMotions/meleeMotion'
import { CLEAVE_MOTION } from './meleeMotions/cleave'

const PLAYER_MELEE_MOTIONS: Record<Exclude<PlayerMeleeMotion, 'slash'>, MeleeMotion> = {
  cleave: CLEAVE_MOTION
}

export const getPlayerMeleeMotion = (motion: PlayerMeleeMotion): MeleeMotion | undefined =>
  motion === 'slash' ? undefined : PLAYER_MELEE_MOTIONS[motion]

export const getPlayerMeleeAttackCooldownMilliseconds = (motion: PlayerMeleeMotion): number =>
  getPlayerMeleeMotion(motion)?.cooldownMilliseconds ?? PLAYER_ATTACK_COOLDOWN_MILLISECONDS
