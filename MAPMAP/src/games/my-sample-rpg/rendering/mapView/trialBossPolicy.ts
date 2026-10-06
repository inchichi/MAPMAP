// 시험 보스(boss_trial)가 기술을 고를 때 학습한 정책을 쓴다(docs/boss-rl-design.md 의 "Policy In The Game").
// bossEncounter 가 기술을 고를 차례마다 pickSkill 을 부른다. 관찰은 학습 때와 같은 함수(bossObservation)로 만들고,
// 싸움마다 기억할 것(싸움 시작 시각, 지난 행동, "안 씀" 대기, 받은 피해)은 이 모듈이 보스별로 들고 있다.
// 게임에서 알 수 없는 두 칸은 이렇게 채운다: 남은 물약은 가득(1), 구르기 준비는 "지금 구르는 중이 아님".
import trialBossPolicyJson from '../../assets/boss/trial-boss-policy.json'
import { getBossKey, getReadyBossSkills, type BossSkillKind } from '../../bossSkills'
import {
  BOSS_POLICY_ACTIONS,
  buildBossObservation,
  createRecentDamageWindow,
  getBossActionMask,
  NONE_ACTION_HOLD_MILLISECONDS,
  TRIAL_BOSS_POLICY_KEY
} from '../../bossTraining/bossObservation'
import { isBossPolicyCompatible, pickBossPolicyAction, type BossPolicyNetwork } from '../../bossTraining/bossPolicyNetwork'
import type { CharacterState } from '../../characterState'
import type { MonsterCombatState } from '../../monsterCombat'
import type { PlayerProfile } from '../../playerProfile'
import type { MonsterPigBehaviorState } from './types'

const network = trialBossPolicyJson as BossPolicyNetwork

export type TrialBossPolicyContext = {
  monsterCombatStates: Map<string, MonsterCombatState>
  monsterPigBehaviorStates: Map<string, MonsterPigBehaviorState>
  getPlayerProfile: () => PlayerProfile
  isPlayerRolling: (now: number) => boolean
}

type FightMemory = {
  startedAt: number
  lastAction: number
  holdUntil: number
  lastPlayerHp: number
  playerDamage: number
  recentDamage: ReturnType<typeof createRecentDamageWindow>
}

export const createTrialBossPolicy = (ctx: TrialBossPolicyContext) => {
  const { monsterCombatStates, monsterPigBehaviorStates, getPlayerProfile, isPlayerRolling } = ctx
  const fights = new Map<string, FightMemory>()
  // 정책 파일이 지금 코드와 맞지 않으면 쓰지 않는다(지금 게임의 규칙대로 고른다)
  const enabled = isBossPolicyCompatible(network)
  if (!enabled) {
    console.warn('[trial boss] policy file does not match the current observation layout; using the rule-based boss')
  }

  // 이 보스를 정책이 맡는가
  const handles = (boss: CharacterState): boolean => enabled && getBossKey(boss) === TRIAL_BOSS_POLICY_KEY

  // 쓸 기술을 고른다. undefined 면 이번엔 기술을 쓰지 않는다(쫓아가서 근접 공격).
  const pickSkill = (
    boss: CharacterState,
    bossCenter: { x: number; y: number },
    playerCenter: { x: number; y: number },
    readyAt: Partial<Record<BossSkillKind, number>>,
    hazardCount: number,
    now: number
  ): BossSkillKind | undefined => {
    const profile = getPlayerProfile()
    let fight = fights.get(boss.id)
    if (!fight) {
      fight = {
        startedAt: now,
        lastAction: 0,
        holdUntil: 0,
        lastPlayerHp: profile.hp.current,
        playerDamage: 0,
        recentDamage: createRecentDamageWindow()
      }
      fights.set(boss.id, fight)
    }
    // 물약으로 찬 체력은 빼고 깎인 만큼만 쌓는다
    fight.playerDamage += Math.max(0, fight.lastPlayerHp - profile.hp.current)
    fight.lastPlayerHp = profile.hp.current

    const distance = Math.hypot(playerCenter.x - bossCenter.x, playerCenter.y - bossCenter.y)
    const ready = getReadyBossSkills(getBossKey(boss), distance, readyAt, now).map((skill) => skill.kind)
    const combat = monsterCombatStates.get(boss.id)
    if (ready.length === 0 || now < fight.holdUntil || !combat) {
      return undefined
    }
    const recent = fight.recentDamage(now, fight.playerDamage, combat.maxHp - combat.currentHp)
    const observation = buildBossObservation({
      boss: bossCenter,
      player: playerCenter,
      playerHp: profile.hp.current,
      playerMaxHp: profile.hp.max,
      bossHp: combat.currentHp,
      bossMaxHp: combat.maxHp,
      potionRatio: 1,
      playerRolling: isPlayerRolling(now),
      playerRollReady: !isPlayerRolling(now),
      bossMeleeReady: (monsterPigBehaviorStates.get(boss.id)?.nextAttackAtMilliseconds ?? 0) <= now,
      hazardCount,
      fightMilliseconds: now - fight.startedAt,
      recentPlayerDamage: recent.player,
      recentBossDamage: recent.boss,
      skillCooldownLeft: Object.fromEntries(
        Object.entries(readyAt).map(([kind, at]) => [kind, (at ?? 0) - now])
      ),
      lastAction: fight.lastAction
    })
    const action = pickBossPolicyAction(network, observation, getBossActionMask(ready))
    fight.lastAction = action
    if (action === 0) {
      fight.holdUntil = now + NONE_ACTION_HOLD_MILLISECONDS
      return undefined
    }
    return BOSS_POLICY_ACTIONS[action] as BossSkillKind
  }

  return {
    handles,
    pickSkill,
    // 싸움이 끝나거나 어그로가 풀려 기술 시계가 새로 잡힐 때 싸움 기억을 버린다
    forgetBoss: (bossId: string): void => {
      fights.delete(bossId)
    }
  }
}
