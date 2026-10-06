// 몬스터 한 마리의 판단만 한다. 실제 이동·충돌·애니메이션은 렌더러가 intent 를 받아 처리한다.
// moveX/moveY 는 크기 1의 방향 벡터이고(정지면 0), 렌더러가 속도와 델타타임을 곱한다.

export type MonsterIntent = {
  moveX: number
  moveY: number
  attack: boolean
}

export type MonsterAiState = {
  homeX: number
  homeY: number
  aggro: boolean
  nextAttackAtMs: number
}

// 집에 이만큼 가까우면 복귀를 끝낸다. 없으면 스폰 지점 위에서 미세하게 떨린다.
const HOME_ARRIVAL_TILES = 0.2

const IDLE_INTENT: MonsterIntent = { moveX: 0, moveY: 0, attack: false }

export const createMonsterAi = (homeX: number, homeY: number): MonsterAiState => ({
  homeX,
  homeY,
  aggro: false,
  nextAttackAtMs: 0
})

export const stepMonsterAi = (
  ai: MonsterAiState,
  monsterX: number,
  monsterY: number,
  playerX: number,
  playerY: number,
  nowMs: number,
  config: {
    aggroTiles: number
    leashTiles: number
    attackTiles: number
    attackCooldownMs: number
  }
): { ai: MonsterAiState, intent: MonsterIntent } => {
  const toPlayerX = playerX - monsterX
  const toPlayerY = playerY - monsterY
  const toHomeX = ai.homeX - monsterX
  const toHomeY = ai.homeY - monsterY
  const playerDistance = Math.hypot(toPlayerX, toPlayerY)
  const homeDistance = Math.hypot(toHomeX, toHomeY)
  // 히스테리시스: 어그로는 aggroTiles 안에서 켜지고, 플레이어가 멀어져도 꺼지지 않는다.
  // 집에서 leashTiles 밖으로 끌려나가야만 풀린다 — 무리 하나를 끌고 던전을 가로지를 수 없다.
  const aggro = ai.aggro ? homeDistance <= config.leashTiles : playerDistance <= config.aggroTiles

  if (!aggro) {
    return {
      ai: { ...ai, aggro: false },
      intent:
        homeDistance <= HOME_ARRIVAL_TILES
          ? IDLE_INTENT
          : { moveX: toHomeX / homeDistance, moveY: toHomeY / homeDistance, attack: false }
    }
  }

  if (playerDistance <= config.attackTiles) {
    // 사거리 안에서는 멈춰서 휘두른다. 그래야 여러 마리가 플레이어를 둘러싸고 굳는다.
    const attack = nowMs >= ai.nextAttackAtMs

    return {
      ai: {
        ...ai,
        aggro: true,
        nextAttackAtMs: attack ? nowMs + config.attackCooldownMs : ai.nextAttackAtMs
      },
      intent: { moveX: 0, moveY: 0, attack }
    }
  }

  return {
    ai: { ...ai, aggro: true },
    intent: {
      moveX: toPlayerX / playerDistance,
      moveY: toPlayerY / playerDistance,
      attack: false
    }
  }
}
