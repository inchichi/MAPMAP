// 층 목록과 층별 기억. 계약(notes/crypt-crawler-contract.md 1절)의 맵 5장 구조를 그대로 옮긴다.
// TMX·fetch·Pixi 를 모르는 순수 모듈이라 그대로 테스트할 수 있다.

import { createExploration, type ExplorationState } from './exploration'
import type { StairsDirection } from './dungeonModel'

export type Floor = {
  /** 0부터. 아래로 갈수록 커진다. audio.ts 의 층 곡 색인과 순서가 같다. */
  index: number
  /** `public/crypt-maps/<stem>.tmx` 이자 계단 `target` 속성이 쓰는 이름. */
  stem: string
  name: string
  /** 층마다 보스가 하나다(docs/crypt-crawler-world.md 4절). 보스 체력바에 띄운다. */
  bossName: string
}

export const FLOORS: readonly Floor[] = [
  { index: 0, stem: 'floor-1-ruins', name: '폐허 마을', bossName: '거대 유령' },
  { index: 1, stem: 'floor-2-mushroom', name: '버섯굴', bossName: '거대 너구리' },
  { index: 2, stem: 'floor-3-water', name: '물웅덩이', bossName: '거대 개구리' },
  { index: 3, stem: 'floor-4-lava', name: '용암굴', bossName: '거대 불꽃' },
  { index: 4, stem: 'floor-5-deep', name: '구덩이의 눈', bossName: '외눈 악마' }
]

export const FIRST_FLOOR: Floor = FLOORS[0]

/** HUD 한 줄. "3층  물웅덩이". */
export const floorLabel = (floor: Floor): string => `${floor.index + 1}층  ${floor.name}`

export const floorByStem = (stem: string): Floor => {
  const found = FLOORS.find((floor) => floor.stem === stem)

  if (!found) {
    throw new Error(`알 수 없는 층입니다: ${stem}`)
  }

  return found
}

export const floorBelow = (floor: Floor): Floor | undefined =>
  FLOORS.find((candidate) => candidate.index === floor.index + 1)

export const floorAbove = (floor: Floor): Floor | undefined =>
  FLOORS.find((candidate) => candidate.index === floor.index - 1)

/**
 * 계단을 타면 가는 층. `target` 속성이 정본이고, 방향과 층 순서가 그 값과 맞는지 본다 —
 * 왕복이 어긋난 맵(계단이 엉뚱한 층을 가리키는 경우)은 걷다가 헤매기 전에 여기서 걸린다.
 */
export const stairsDestination = (
  from: Floor,
  direction: StairsDirection,
  target: string
): Floor => {
  const to = floorByStem(target)
  const expected = direction === 'down' ? floorBelow(from) : floorAbove(from)

  if (!expected || expected.stem !== to.stem) {
    throw new Error(`${from.stem} 의 ${direction} 계단이 ${target} 을 가리킵니다`)
  }

  return to
}

/** 하행 계단은 그 층 보스를 잡아야 열린다. 상행은 언제나 열려 있다. */
export const isStairsOpen = (direction: StairsDirection, bossesAlive: number): boolean =>
  direction === 'up' || bossesAlive === 0

/**
 * 층을 떠나도 남는 것. 다시 내려왔을 때 잡아 둔 몬스터가 되살아나 있으면 오르내리기가
 * 벌이 된다. 세이브가 없으므로 이번 판(메모리)에만 산다.
 */
export type FloorMemory = {
  /** `model.chests` 의 인덱스. */
  openedChests: Set<number>
  /** `model.monsters` 의 인덱스. */
  defeatedMonsters: Set<number>
  /** `model.bosses` 의 인덱스. */
  defeatedBosses: Set<number>
  exploration: ExplorationState
}

export type FloorMemories = Map<number, FloorMemory>

/** 그 층의 기억. 처음 들어가는 층이면 그 자리에서 만든다. */
export const floorMemory = (
  memories: FloorMemories,
  floor: Floor,
  width: number,
  height: number
): FloorMemory => {
  const found = memories.get(floor.index)

  if (found) {
    return found
  }

  const created: FloorMemory = {
    openedChests: new Set(),
    defeatedMonsters: new Set(),
    defeatedBosses: new Set(),
    exploration: createExploration(width, height)
  }
  memories.set(floor.index, created)

  return created
}
