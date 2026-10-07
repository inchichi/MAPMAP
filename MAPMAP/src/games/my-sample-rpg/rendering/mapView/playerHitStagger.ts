// 피격 경직: 몬스터에게 맞으면 맞은 반대쪽으로 반 칸쯤 실제로 밀려나고(벽·물·용암에서는 멈춘다),
// 밀려나는 동안 잠깐 이동·공격을 못 한다. 맞은 뒤 무적 시간에는 캐릭터가 깜빡여 잠깐 안전하다는 걸 보여 준다.
// 예전에는 그림만 6px 튀었다 돌아오고 걷기는 그대로라 덜컥거려 보였다.
// 피격 상태(방향·시작·끝)는 monsterBehavior.ts 의 setPlayerHitReaction 이 만들고, 구르기를 시작하면 지워진다.
import { PLAYER_CHARACTER_ID } from '../../characterState'
import { type PlayerHitReactionState } from './types'

export const PLAYER_HIT_KNOCKBACK_TILES = 0.5
export const PLAYER_HIT_STAGGER_MILLISECONDS = 240
const INVULNERABLE_BLINK_PERIOD_MILLISECONDS = 90
const INVULNERABLE_BLINK_ALPHA = 0.35

// 밀려난 거리 비율(0~1) — 처음에 빠르게 밀리고 끝에서 부드럽게 멈춘다.
export const getPlayerHitKnockbackProgress = (elapsedMilliseconds: number): number => {
  const t = Math.min(1, Math.max(0, elapsedMilliseconds / PLAYER_HIT_STAGGER_MILLISECONDS))
  return 1 - (1 - t) ** 3
}

// 무적 시간 동안 깜빡이는 투명도(무적이 아니면 1)
export const getPlayerInvulnerableBlinkAlpha = (now: number, invulnerableUntilMilliseconds: number): number =>
  now < invulnerableUntilMilliseconds &&
  Math.floor(now / INVULNERABLE_BLINK_PERIOD_MILLISECONDS) % 2 === 0
    ? INVULNERABLE_BLINK_ALPHA
    : 1

type PlayerHitStaggerContext = {
  getPlayerHitReactionState: () => PlayerHitReactionState | undefined
  setPlayerHitReactionState: (value: PlayerHitReactionState | undefined) => void
  tryMoveCharacter: (
    characterId: string,
    deltaX: number,
    deltaY: number,
    options?: { preserveFacing?: boolean }
  ) => boolean
}

export const createPlayerHitStagger = ({
  getPlayerHitReactionState,
  setPlayerHitReactionState,
  tryMoveCharacter
}: PlayerHitStaggerContext) => {
  // 이번 피격에서 이미 밀려난 비율(같은 피격인지는 시작 시각으로 가린다)
  let pushedStartedAt = -1
  let pushedProgress = 0

  // 경직 중이면 이번 프레임 밀어내고 true — 부르는 쪽은 그 프레임의 플레이어 조작을 건너뛴다.
  const step = (now: number): boolean => {
    const state = getPlayerHitReactionState()

    if (!state) {
      return false
    }

    if (now >= state.expiresAtMilliseconds) {
      setPlayerHitReactionState(undefined)
      return false
    }

    if (pushedStartedAt !== state.startedAtMilliseconds) {
      pushedStartedAt = state.startedAtMilliseconds
      pushedProgress = 0
    }

    const progress = getPlayerHitKnockbackProgress(now - state.startedAtMilliseconds)
    const distance = (progress - pushedProgress) * PLAYER_HIT_KNOCKBACK_TILES

    pushedProgress = progress
    if (distance > 0) {
      tryMoveCharacter(
        PLAYER_CHARACTER_ID,
        state.directionX * distance,
        state.directionY * distance,
        { preserveFacing: true }
      )
    }

    return true
  }

  return { step }
}
