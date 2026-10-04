import type { GameSoundEffectId } from './createGameSoundEffects'
import type { LpcMonsterSpec, LpcMonsterStrip } from './loadLpcMonsterTextures'

// 몬스터 종류 목록 — 새 몬스터는 여기에 한 항목 + assets/monsters/lpc 의 그림(+ CREDITS.txt)만
// 더하면 된다. 게임 화면(그림·행동·소리), 퀘스트 목표 팝업, 에디터 퀘스트 생성 목록이 모두 이
// 목록을 읽는다. 체력·피해·보상은 종류와 상관없이 레벨로 정한다(monsterCombat / monsterRewards).
//
// 맵(TMX)에서는 캐릭터 오브젝트의 type 속성이 appearanceType, monster.level 이 레벨, 오브젝트
// 이름이 화면 이름(예: '늪뱀-1' → '늪뱀', 이름이 '-보스'로 끝나면 보스)이다.

export type MonsterBehaviorConfig = {
  renderScale: number
  aggroRangeTiles: number
  deAggroRangeTiles: number
  chaseSpeedTilesPerSecond: number
  patrolSpeedTilesPerSecond: number
  attackRangeTiles: number
  attackIntervalMilliseconds: number
  attackDurationMilliseconds: number
  hitReactionDurationMilliseconds: number
  idleAnimationSpeed: number
  runAnimationSpeed: number
  hitAnimationSpeed: number
  attackAnimationSpeed: number
  usesRunAnimation: boolean
  runMotionBobPixels: number
  runMotionSwayPixels: number
  // 제자리 함정형(식인 꽃 등): 순찰·추격·밀려남이 없고, 어그로가 붙으면 플레이어 쪽을 바라본다.
  stationary?: boolean
}

export type MonsterCatalogEntry = {
  appearanceType: string
  // 종류 이름 — 퀘스트 목표 팝업, 에디터 목록. 맵의 개체 이름(화면 이름표)과는 따로다.
  label: string
  spec: LpcMonsterSpec
  behavior: MonsterBehaviorConfig
  sounds?: { attack?: GameSoundEffectId; death?: GameSoundEffectId }
}

// 사망음이 따로 없는 몬스터는 묵직한 타격음으로 쓰러짐을 알린다.
export const DEFAULT_MONSTER_DEATH_SOUND: GameSoundEffectId = 'playerSwordHit'

// ---- LPC 몬스터 시트(행 순서: 위·왼·아래·오른, 오른쪽이 없는 시트는 반전)
const lpcMonsterUrl = (file: string) =>
  new URL(`../assets/monsters/lpc/${file}`, import.meta.url).href
const lpcStrip = (
  file: string,
  cellWidth: number,
  cellHeight: number,
  row: number,
  frames: readonly number[],
  mirror = false
): LpcMonsterStrip => ({ url: lpcMonsterUrl(file), cellWidth, cellHeight, row, frames, mirror })
const range = (count: number) => Array.from({ length: count }, (_, index) => index)
// Universal LPC 생성기로 합성한 사람형 몬스터 시트(scripts/build-ch2-lpc-sheets.py): 칸 96,
// 줄 0~3 걷기(위·왼·아래·오른 9프레임, 0번이 서 있기), 4~7 공격, 8 피격(아래 방향만 — 오른쪽은 반전).
const lpcHumanoidSpec = (file: string, attackFrames: number): LpcMonsterSpec => ({
  idleLeft: lpcStrip(file, 96, 96, 1, [0]),
  idleRight: lpcStrip(file, 96, 96, 3, [0]),
  runLeft: lpcStrip(file, 96, 96, 1, range(9).slice(1)),
  runRight: lpcStrip(file, 96, 96, 3, range(9).slice(1)),
  hitLeft: lpcStrip(file, 96, 96, 8, [1]),
  hitRight: lpcStrip(file, 96, 96, 8, [1], true),
  attackLeft: lpcStrip(file, 96, 96, 5, range(attackFrames)),
  attackRight: lpcStrip(file, 96, 96, 7, range(attackFrames))
})

// 기본 행동값(꿀꿀이 기준). 종류마다 다른 값만 덮어쓴다.
const BASE_BEHAVIOR: MonsterBehaviorConfig = {
  renderScale: 1,
  aggroRangeTiles: 4.8,
  deAggroRangeTiles: 7.2,
  chaseSpeedTilesPerSecond: 4.4,
  patrolSpeedTilesPerSecond: 2.4,
  attackRangeTiles: 1.2,
  attackIntervalMilliseconds: 5000,
  attackDurationMilliseconds: 720,
  hitReactionDurationMilliseconds: 260,
  idleAnimationSpeed: 0.08,
  runAnimationSpeed: 0.22,
  hitAnimationSpeed: 0.18,
  attackAnimationSpeed: 0.14,
  usesRunAnimation: true,
  runMotionBobPixels: 0,
  runMotionSwayPixels: 0
}

export const MONSTER_CATALOG: readonly MonsterCatalogEntry[] = [
  {
    // 꿀꿀이: 농장 돼지(걷기 4프레임, 먹기 = 들이받기)
    appearanceType: 'monster_pig',
    label: '꿀꿀이',
    spec: {
      idleLeft: lpcStrip('pig-walk.png', 128, 128, 1, [0]),
      idleRight: lpcStrip('pig-walk.png', 128, 128, 3, [0]),
      runLeft: lpcStrip('pig-walk.png', 128, 128, 1, range(4)),
      runRight: lpcStrip('pig-walk.png', 128, 128, 3, range(4)),
      hitLeft: lpcStrip('pig-walk.png', 128, 128, 1, [2]),
      hitRight: lpcStrip('pig-walk.png', 128, 128, 3, [2]),
      attackLeft: lpcStrip('pig-eat.png', 128, 128, 1, range(4)),
      attackRight: lpcStrip('pig-eat.png', 128, 128, 3, range(4))
    },
    behavior: BASE_BEHAVIOR
  },
  {
    // 말캉이: 슬라임(통통 튀기 6프레임, 덮치기 8프레임). 방향이 없어 오른쪽은 반전
    appearanceType: 'monster_slime',
    label: '말캉이',
    spec: {
      idleLeft: lpcStrip('slime.png', 64, 64, 0, range(6)),
      idleRight: lpcStrip('slime.png', 64, 64, 0, range(6), true),
      runLeft: lpcStrip('slime.png', 64, 64, 0, range(6)),
      runRight: lpcStrip('slime.png', 64, 64, 0, range(6), true),
      hitLeft: lpcStrip('slime.png', 64, 64, 0, [3]),
      hitRight: lpcStrip('slime.png', 64, 64, 0, [3], true),
      attackLeft: lpcStrip('slime.png', 64, 64, 1, range(8)),
      attackRight: lpcStrip('slime.png', 64, 64, 1, range(8), true)
    },
    behavior: {
      ...BASE_BEHAVIOR,
      aggroRangeTiles: 4.4,
      deAggroRangeTiles: 6.8,
      chaseSpeedTilesPerSecond: 3.1,
      patrolSpeedTilesPerSecond: 1.8,
      attackRangeTiles: 1.0,
      attackIntervalMilliseconds: 5400,
      attackDurationMilliseconds: 760,
      hitReactionDurationMilliseconds: 240,
      idleAnimationSpeed: 0.06,
      runAnimationSpeed: 0.16,
      hitAnimationSpeed: 0.16,
      attackAnimationSpeed: 0.12
    },
    sounds: { attack: 'slimeAttack', death: 'slimeDeath' }
  },
  {
    // 바위돌이: 골렘(걷기 7프레임, 공격 칸은 64x96). 느리고 단단하다 — 어그로가 짧고 추격이 굼뜨다.
    appearanceType: 'monster_rock',
    label: '바위돌이',
    spec: {
      idleLeft: lpcStrip('golem-walk.png', 64, 64, 1, [0]),
      idleRight: lpcStrip('golem-walk.png', 64, 64, 3, [0]),
      runLeft: lpcStrip('golem-walk.png', 64, 64, 1, range(7)),
      runRight: lpcStrip('golem-walk.png', 64, 64, 3, range(7)),
      hitLeft: lpcStrip('golem-die.png', 64, 64, 0, [1]),
      hitRight: lpcStrip('golem-die.png', 64, 64, 0, [1], true),
      attackLeft: lpcStrip('golem-attack.png', 64, 96, 1, range(7)),
      attackRight: lpcStrip('golem-attack.png', 64, 96, 3, range(7))
    },
    behavior: {
      ...BASE_BEHAVIOR,
      aggroRangeTiles: 3.6,
      deAggroRangeTiles: 6.4,
      chaseSpeedTilesPerSecond: 1.7,
      patrolSpeedTilesPerSecond: 0.9,
      attackRangeTiles: 1.0,
      attackIntervalMilliseconds: 4200,
      attackDurationMilliseconds: 700,
      hitReactionDurationMilliseconds: 320,
      idleAnimationSpeed: 0.1,
      runAnimationSpeed: 0.22,
      hitAnimationSpeed: 0.2,
      attackAnimationSpeed: 0.26
    }
  },
  {
    // 버섯돌이: 얼굴 달린 버섯(2프레임씩 표정 변화). 재빠르고 성가시다 — 넓은 어그로, 빠른 발.
    appearanceType: 'monster_mushroom',
    label: '버섯돌이',
    spec: {
      idleLeft: lpcStrip('mushroom.png', 64, 64, 0, [0, 1]),
      idleRight: lpcStrip('mushroom.png', 64, 64, 0, [0, 1], true),
      runLeft: lpcStrip('mushroom.png', 64, 64, 1, [0, 1]),
      runRight: lpcStrip('mushroom.png', 64, 64, 1, [0, 1], true),
      hitLeft: lpcStrip('mushroom.png', 64, 64, 2, [0]),
      hitRight: lpcStrip('mushroom.png', 64, 64, 2, [0], true),
      attackLeft: lpcStrip('mushroom.png', 64, 64, 3, [0, 1]),
      attackRight: lpcStrip('mushroom.png', 64, 64, 3, [0, 1], true)
    },
    behavior: {
      ...BASE_BEHAVIOR,
      renderScale: 0.62,
      aggroRangeTiles: 5.2,
      deAggroRangeTiles: 7.6,
      chaseSpeedTilesPerSecond: 3.4,
      patrolSpeedTilesPerSecond: 2.2,
      attackRangeTiles: 1.0,
      attackIntervalMilliseconds: 4600,
      attackDurationMilliseconds: 600,
      hitReactionDurationMilliseconds: 220,
      idleAnimationSpeed: 0.14,
      runAnimationSpeed: 0.3,
      hitAnimationSpeed: 0.22,
      attackAnimationSpeed: 0.3
    },
    sounds: { attack: 'slimeAttack', death: 'slimeDeath' }
  },
  {
    // 늪뱀(2장): [LPC] Monsters 뱀. 4방향 시트 — 0~3 기어가기, 4 물기. 물가 풀숲을 재빨리
    // 미끄러지듯 다가와 짧게 문다. 공격 간격이 짧고 맷집은 레벨 그대로.
    appearanceType: 'monster_snake',
    label: '늪뱀',
    spec: {
      idleLeft: lpcStrip('snake.png', 64, 64, 1, [0, 3]),
      idleRight: lpcStrip('snake.png', 64, 64, 3, [0, 3]),
      runLeft: lpcStrip('snake.png', 64, 64, 1, range(4)),
      runRight: lpcStrip('snake.png', 64, 64, 3, range(4)),
      hitLeft: lpcStrip('snake.png', 64, 64, 1, [5]),
      hitRight: lpcStrip('snake.png', 64, 64, 3, [5]),
      attackLeft: lpcStrip('snake.png', 64, 64, 1, [3, 4, 4, 6]),
      attackRight: lpcStrip('snake.png', 64, 64, 3, [3, 4, 4, 6])
    },
    behavior: {
      ...BASE_BEHAVIOR,
      // LPC 뱀은 몸이 24px 남짓이라 플레이어 옆에서 잘 안 보인다 — 키워서 쓴다
      renderScale: 1.35,
      aggroRangeTiles: 4.6,
      deAggroRangeTiles: 7.0,
      chaseSpeedTilesPerSecond: 3.8,
      patrolSpeedTilesPerSecond: 1.6,
      attackRangeTiles: 1.1,
      attackIntervalMilliseconds: 3200,
      attackDurationMilliseconds: 520,
      hitReactionDurationMilliseconds: 220,
      idleAnimationSpeed: 0.05,
      runAnimationSpeed: 0.2,
      hitAnimationSpeed: 0.2,
      attackAnimationSpeed: 0.2
    }
  },
  {
    // 식인 꽃(2장): [LPC] Monsters 식인 꽃(칸 128). 4방향 시트 — 0~2 입 벌린 채 흔들기, 3~5 덮치기.
    // 늪가에 뿌리박은 제자리 함정: 움직이지 않고 밀려나지도 않으며, 가까이 오면 그쪽을 보고 문다.
    // 길을 막는 자리에 두면 돌아가거나 쓰러뜨려야 한다.
    appearanceType: 'monster_flower',
    label: '식인 꽃',
    spec: {
      idleLeft: lpcStrip('man_eater_flower.png', 128, 128, 1, range(3)),
      idleRight: lpcStrip('man_eater_flower.png', 128, 128, 3, range(3)),
      runLeft: lpcStrip('man_eater_flower.png', 128, 128, 1, range(3)),
      runRight: lpcStrip('man_eater_flower.png', 128, 128, 3, range(3)),
      hitLeft: lpcStrip('man_eater_flower.png', 128, 128, 1, [2]),
      hitRight: lpcStrip('man_eater_flower.png', 128, 128, 3, [2]),
      attackLeft: lpcStrip('man_eater_flower.png', 128, 128, 1, [3, 4, 5]),
      attackRight: lpcStrip('man_eater_flower.png', 128, 128, 3, [3, 4, 5])
    },
    behavior: {
      ...BASE_BEHAVIOR,
      renderScale: 0.85,
      aggroRangeTiles: 2.6,
      deAggroRangeTiles: 3.6,
      chaseSpeedTilesPerSecond: 0,
      patrolSpeedTilesPerSecond: 0,
      attackRangeTiles: 1.5,
      attackIntervalMilliseconds: 2400,
      attackDurationMilliseconds: 560,
      hitReactionDurationMilliseconds: 200,
      idleAnimationSpeed: 0.05,
      runAnimationSpeed: 0.1,
      hitAnimationSpeed: 0.2,
      attackAnimationSpeed: 0.16,
      usesRunAnimation: false,
      stationary: true
    }
  },
  {
    // 늪개구리 전사(2장): LPC Frogman(청록으로 바꾼 것, scripts/recolor-frogman.py). 칸 80x96 —
    // 줄 0~3 삼지창 찌르기(위·왼·아래·오른 4프레임), 4~7 뛰어 걷기(6프레임), 8 쓰러짐.
    // 무리 지어 다니며 사거리 긴 삼지창으로 찌른다. 뛰어오는 동안은 빠르지만 찌른 뒤 틈이 길다.
    appearanceType: 'monster_frog',
    label: '늪개구리 전사',
    spec: {
      idleLeft: lpcStrip('frogman.png', 80, 96, 5, [0, 1]),
      idleRight: lpcStrip('frogman.png', 80, 96, 7, [0, 1]),
      runLeft: lpcStrip('frogman.png', 80, 96, 5, range(6)),
      runRight: lpcStrip('frogman.png', 80, 96, 7, range(6)),
      hitLeft: lpcStrip('frogman.png', 80, 96, 8, [0]),
      hitRight: lpcStrip('frogman.png', 80, 96, 8, [0], true),
      attackLeft: lpcStrip('frogman.png', 80, 96, 1, range(4)),
      attackRight: lpcStrip('frogman.png', 80, 96, 3, range(4))
    },
    behavior: {
      ...BASE_BEHAVIOR,
      aggroRangeTiles: 5.0,
      deAggroRangeTiles: 7.6,
      chaseSpeedTilesPerSecond: 3.6,
      patrolSpeedTilesPerSecond: 1.7,
      attackRangeTiles: 1.6,
      attackIntervalMilliseconds: 4200,
      attackDurationMilliseconds: 640,
      hitReactionDurationMilliseconds: 260,
      idleAnimationSpeed: 0.05,
      runAnimationSpeed: 0.2,
      hitAnimationSpeed: 0.18,
      attackAnimationSpeed: 0.16
    }
  },
  {
    // 늪지기 거대개구리(2장 중간 보스, c2-05): 같은 Frogman 묶음의 왕관 쓴 개구리를 보랏빛으로 바꾼 것
    // (scripts/recolor-frogman.py). 칸·줄은 전사와 같다. 맵에서 이름이 '-보스'로 끝나 두 배로 커진다.
    // 무겁게 뛰어다니며 삼지창이 길다. 독 웅덩이·혀 당기기는 bossSkills.ts.
    appearanceType: 'monster_frog_king',
    label: '늪지기 거대개구리',
    spec: {
      idleLeft: lpcStrip('frogman-king.png', 80, 96, 5, [0, 1]),
      idleRight: lpcStrip('frogman-king.png', 80, 96, 7, [0, 1]),
      runLeft: lpcStrip('frogman-king.png', 80, 96, 5, range(6)),
      runRight: lpcStrip('frogman-king.png', 80, 96, 7, range(6)),
      hitLeft: lpcStrip('frogman-king.png', 80, 96, 8, [0]),
      hitRight: lpcStrip('frogman-king.png', 80, 96, 8, [0], true),
      attackLeft: lpcStrip('frogman-king.png', 80, 96, 1, range(4)),
      attackRight: lpcStrip('frogman-king.png', 80, 96, 3, range(4))
    },
    behavior: {
      ...BASE_BEHAVIOR,
      aggroRangeTiles: 6.0,
      deAggroRangeTiles: 10.0,
      chaseSpeedTilesPerSecond: 2.6,
      patrolSpeedTilesPerSecond: 1.0,
      attackRangeTiles: 2.0,
      attackIntervalMilliseconds: 3600,
      attackDurationMilliseconds: 760,
      hitReactionDurationMilliseconds: 180,
      idleAnimationSpeed: 0.05,
      runAnimationSpeed: 0.16,
      hitAnimationSpeed: 0.18,
      attackAnimationSpeed: 0.13
    }
  },
  ...['monster_skeleton', 'monster_drowned'].map((appearanceType): MonsterCatalogEntry => {
    // 유적 해골병·물에 빠진 자(2장 신전): Universal LPC 생성기로 합성한 사람형 시트(scripts/build-ch2-lpc-sheets.py).
    // 칸 96 — 줄 0~3 걷기 9프레임, 4~7 베기 6프레임, 8 피격(아래 방향).
    const isSkeleton = appearanceType === 'monster_skeleton'
    const file = isSkeleton ? 'skeleton-soldier.png' : 'drowned.png'
    return {
      appearanceType,
      label: isSkeleton ? '유적 해골병' : '물에 빠진 자',
      spec: lpcHumanoidSpec(file, 6),
      // 해골병은 칼을 들고 성큼 다가오고, 물에 빠진 자는 느릿느릿 따라와 손톱으로 할퀸다.
      behavior: isSkeleton
        ? {
            ...BASE_BEHAVIOR,
            aggroRangeTiles: 5.0,
            deAggroRangeTiles: 7.6,
            chaseSpeedTilesPerSecond: 3.3,
            patrolSpeedTilesPerSecond: 1.5,
            attackRangeTiles: 1.3,
            attackIntervalMilliseconds: 3800,
            attackDurationMilliseconds: 600,
            hitReactionDurationMilliseconds: 240,
            idleAnimationSpeed: 0.05,
            runAnimationSpeed: 0.2,
            hitAnimationSpeed: 0.18,
            attackAnimationSpeed: 0.2
          }
        : {
            ...BASE_BEHAVIOR,
            aggroRangeTiles: 4.2,
            deAggroRangeTiles: 7.0,
            chaseSpeedTilesPerSecond: 1.9,
            patrolSpeedTilesPerSecond: 0.9,
            attackRangeTiles: 1.2,
            attackIntervalMilliseconds: 4400,
            attackDurationMilliseconds: 700,
            hitReactionDurationMilliseconds: 320,
            idleAnimationSpeed: 0.04,
            runAnimationSpeed: 0.12,
            hitAnimationSpeed: 0.16,
            attackAnimationSpeed: 0.14
          }
    }
  }),
  {
    // 이끼 골렘(2장 신전): 바위돌이 시트에 이끼를 입힌 것(scripts/recolor-golem.py). 행동도 바위돌이처럼 굼뜨다.
    appearanceType: 'monster_moss_golem',
    label: '이끼 골렘',
    spec: {
      idleLeft: lpcStrip('golem-moss-walk.png', 64, 64, 1, [0]),
      idleRight: lpcStrip('golem-moss-walk.png', 64, 64, 3, [0]),
      runLeft: lpcStrip('golem-moss-walk.png', 64, 64, 1, range(7)),
      runRight: lpcStrip('golem-moss-walk.png', 64, 64, 3, range(7)),
      hitLeft: lpcStrip('golem-moss-die.png', 64, 64, 0, [1]),
      hitRight: lpcStrip('golem-moss-die.png', 64, 64, 0, [1], true),
      attackLeft: lpcStrip('golem-moss-attack.png', 64, 96, 1, range(7)),
      attackRight: lpcStrip('golem-moss-attack.png', 64, 96, 3, range(7))
    },
    behavior: {
      ...BASE_BEHAVIOR,
      renderScale: 1.1,
      aggroRangeTiles: 3.8,
      deAggroRangeTiles: 6.4,
      chaseSpeedTilesPerSecond: 1.7,
      patrolSpeedTilesPerSecond: 0.8,
      attackRangeTiles: 1.1,
      attackIntervalMilliseconds: 4200,
      attackDurationMilliseconds: 700,
      hitReactionDurationMilliseconds: 320,
      idleAnimationSpeed: 0.1,
      runAnimationSpeed: 0.22,
      hitAnimationSpeed: 0.2,
      attackAnimationSpeed: 0.26
    }
  },
  {
    // 늪의 사제(2장 최종 보스, c2-08): 생성기 합성(창백한 초록 피부, 검은 로브·두건). 공격은 주문 동작(7프레임).
    // 물기둥·소환은 bossSkills.ts. 맵에서 이름이 '-보스'로 끝난다.
    appearanceType: 'monster_swamp_priest',
    label: '늪의 사제',
    spec: lpcHumanoidSpec('swamp-priest.png', 7),
    behavior: {
      ...BASE_BEHAVIOR,
      aggroRangeTiles: 7.0,
      deAggroRangeTiles: 11.0,
      chaseSpeedTilesPerSecond: 1.6,
      patrolSpeedTilesPerSecond: 0.8,
      attackRangeTiles: 1.6,
      attackIntervalMilliseconds: 3400,
      attackDurationMilliseconds: 800,
      hitReactionDurationMilliseconds: 160,
      idleAnimationSpeed: 0.04,
      runAnimationSpeed: 0.12,
      hitAnimationSpeed: 0.16,
      attackAnimationSpeed: 0.16
    }
  }
]

const MONSTER_CATALOG_BY_APPEARANCE_TYPE = new Map(
  MONSTER_CATALOG.map((entry) => [entry.appearanceType, entry] as const)
)

export const getMonsterCatalogEntry = (
  appearanceType: string
): MonsterCatalogEntry | undefined => MONSTER_CATALOG_BY_APPEARANCE_TYPE.get(appearanceType)

export const getMonsterKindLabel = (appearanceType: string): string =>
  getMonsterCatalogEntry(appearanceType)?.label ?? appearanceType
