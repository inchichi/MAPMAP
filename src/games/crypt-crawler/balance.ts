// crypt-crawler 의 수치 조정. 전투·성장 계산 자체는 my-sample-rpg 의 순수 모듈을 그대로 쓰고,
// 여기에는 그 모듈들이 정하지 않는 두 가지만 둔다 — 보스 배율과 레벨업 포인트 자동 분배.

import type { PlayerProfile, PlayerStatId } from '../my-sample-rpg/playerProfile'
import { spendPlayerStatPoint } from '../my-sample-rpg/playerProgression'

// 보스는 같은 레벨 잡몹 수치를 이 배율로 부풀려 쓴다(createMonsterCombatState 의 옵션).
// HP 12배면 동레벨 플레이어가 20타 넘게 때려야 하고, 접촉 피해 2.2배면 다섯 대에 죽으므로
// 거리 관리가 강제된다.
export const BOSS_HP_MULTIPLIER = 12
export const BOSS_DAMAGE_MULTIPLIER = 2.2

// 핵앤슬래시에는 스탯 창이 없다. 레벨업으로 받은 포인트를 힘·민첩·행운에 하나씩 돌려 쓴다
// (지력은 마나만 올리는데 이 게임에는 마나가 없다).
const AUTO_SPENT_STAT_IDS: PlayerStatId[] = ['strength', 'agility', 'luck']

export const spendPlayerStatPoints = (profile: PlayerProfile): PlayerProfile => {
  let spent = profile

  for (let index = 0; index < profile.statPoints; index += 1) {
    spent =
      spendPlayerStatPoint(spent, AUTO_SPENT_STAT_IDS[index % AUTO_SPENT_STAT_IDS.length]) ??
      spent
  }

  return spent
}
