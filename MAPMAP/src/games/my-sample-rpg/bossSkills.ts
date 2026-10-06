// 2장 보스의 특수 기술 — 근접 공격 사이사이에 쓴다. 무엇을 언제 쓰는지와 바닥 위험 지대(웅덩이·물기둥)의
// 시간·범위·피해는 여기서 정하고, 그리기·이동·피해 적용은 맵 화면(createPixiTiledMapView)이 한다.
// 위험 지대는 먼저 표시(경고)되고 잠시 뒤 피해를 준다 — 보고 피할 수 있어야 한다. 좌표는 칸 단위.
//
//   늪지기 거대개구리(c2-05): 독 웅덩이(플레이어 자리에 독을 뱉는다), 혀 당기기(멀리 있으면 끌어당긴다)
//   늪의 사제(c2-08): 물기둥(플레이어 자리와 둘레에 솟는다), 소환(물에 빠진 자를 불러낸다)

export type BossSkillKind =
  | 'poison-puddle'
  | 'tongue-pull'
  | 'water-pillar'
  | 'summon'
  // 3장: 트롤 족장의 내려찍기(보스 둘레 충격파), 서리 마녀의 얼음 가시(물기둥과 같은 틀)
  | 'ground-slam'
  | 'ice-spike'
  // 시험의 수호자(시험 보스): 도넛, 돌진, 부채꼴 탄, 유성우, 기 모으기
  | 'ring-burst'
  | 'charge'
  | 'fan-shot'
  | 'meteor-shower'
  | 'charged-blast'

export type BossSkillDefinition = {
  kind: BossSkillKind
  cooldownMilliseconds: number
  // 플레이어와의 거리(칸)가 이 범위 안일 때만 쓴다
  minRangeTiles: number
  maxRangeTiles: number
}

// 기술·연출 표의 열쇠. 2·3장 보스는 외형마다 하나라 외형(appearanceType)을 그대로 쓰지만, 1장 보스는 평범한
// 말캉이·꿀꿀이와 외형이 같고 꿀꿀이-보스·꿀꿀이대장-보스끼리도 같아서 캐릭터 이름으로 따로 찾는다.
const BOSS_KEY_BY_CHARACTER_ID: Record<string, string> = {
  '말캉이-보스': 'boss_slime_king',
  '꿀꿀이-보스': 'boss_pig_king',
  '꿀꿀이대장-보스': 'boss_pig_captain',
  // 시험 보스는 트롤 족장의 외형을 빌린다
  '시험의 수호자-보스': 'boss_trial'
}

export const getBossKey = (boss: { id: string; appearanceType: string }): string =>
  BOSS_KEY_BY_CHARACTER_ID[boss.id] ?? boss.appearanceType

const BOSS_SKILLS_BY_APPEARANCE_TYPE: Record<string, readonly BossSkillDefinition[]> = {
  // 1장 첫 보스: 몸을 튕겨 내려찍고(경고 고리를 보고 피하는 법을 배운다), 몸이 갈라져 작은 말캉이를 낳는다.
  boss_slime_king: [
    { kind: 'summon', cooldownMilliseconds: 17000, minRangeTiles: 0, maxRangeTiles: 10 },
    { kind: 'ground-slam', cooldownMilliseconds: 7500, minRangeTiles: 0, maxRangeTiles: 3 }
  ],
  // 꿀꿀이는 원래 돌진한다 — 붙어 있으면 발 구르기를 더한다.
  boss_pig_king: [{ kind: 'ground-slam', cooldownMilliseconds: 6500, minRangeTiles: 0, maxRangeTiles: 3 }],
  boss_pig_captain: [
    { kind: 'summon', cooldownMilliseconds: 16000, minRangeTiles: 0, maxRangeTiles: 12 },
    { kind: 'ground-slam', cooldownMilliseconds: 6000, minRangeTiles: 0, maxRangeTiles: 3.2 }
  ],
  monster_frog_king: [
    { kind: 'tongue-pull', cooldownMilliseconds: 9000, minRangeTiles: 3, maxRangeTiles: 7 },
    { kind: 'poison-puddle', cooldownMilliseconds: 6500, minRangeTiles: 0, maxRangeTiles: 8 }
  ],
  monster_swamp_priest: [
    { kind: 'summon', cooldownMilliseconds: 16000, minRangeTiles: 0, maxRangeTiles: 12 },
    { kind: 'water-pillar', cooldownMilliseconds: 5500, minRangeTiles: 0, maxRangeTiles: 10 }
  ],
  monster_troll_chief: [
    { kind: 'summon', cooldownMilliseconds: 18000, minRangeTiles: 0, maxRangeTiles: 12 },
    // 가까이 붙어 있을 때만 내려찍는다 — 떨어지라는 신호
    { kind: 'ground-slam', cooldownMilliseconds: 6000, minRangeTiles: 0, maxRangeTiles: 3.2 }
  ],
  monster_frost_witch: [
    { kind: 'summon', cooldownMilliseconds: 15000, minRangeTiles: 0, maxRangeTiles: 12 },
    { kind: 'ice-spike', cooldownMilliseconds: 5000, minRangeTiles: 0, maxRangeTiles: 10 }
  ],
  // 시험 보스(강화학습 실험용): 패턴마다 피하는 법이 다르다. 내려찍기는 가까우면, 도넛은 멀면,
  // 돌진은 일직선에 서 있으면, 유성우는 멈춰 있으면 맞는다. 기 모으기는 빠져나가거나 때려서 끊는다.
  boss_trial: [
    { kind: 'charged-blast', cooldownMilliseconds: 22000, minRangeTiles: 0, maxRangeTiles: 5 },
    { kind: 'tongue-pull', cooldownMilliseconds: 9000, minRangeTiles: 3, maxRangeTiles: 7 },
    { kind: 'charge', cooldownMilliseconds: 8000, minRangeTiles: 3, maxRangeTiles: 9 },
    { kind: 'ring-burst', cooldownMilliseconds: 9000, minRangeTiles: 0, maxRangeTiles: 5 },
    { kind: 'meteor-shower', cooldownMilliseconds: 15000, minRangeTiles: 0, maxRangeTiles: 12 },
    { kind: 'fan-shot', cooldownMilliseconds: 4500, minRangeTiles: 2, maxRangeTiles: 10 },
    { kind: 'ground-slam', cooldownMilliseconds: 6000, minRangeTiles: 0, maxRangeTiles: 3 }
  ]
}

// 기술 하나를 쓰고 나서 다른 기술도 이만큼 쉰다. 기술이 많은 보스가 기술을 몰아 쏟지 않게.
const BOSS_SKILL_GAP_MILLISECONDS_BY_KEY: Record<string, number> = {
  boss_trial: 1600
}

export const getBossSkillGap = (bossKey: string): number => BOSS_SKILL_GAP_MILLISECONDS_BY_KEY[bossKey] ?? 0

// 보스의 칭호(등장 배너·체력바), 분노(체력 절반 아래) 때 외침, 쓰러질 때 남기는 말. 열쇠는 getBossKey.
export type BossPresentation = {
  title: string
  enrageLine: string
  // 쓰러질 때 대화창으로 보여 줄 말(없으면 대화창 없이 연출만)
  deathLines?: string[]
}

const BOSS_PRESENTATION_BY_APPEARANCE_TYPE: Record<string, BossPresentation> = {
  boss_slime_king: {
    title: '동굴 어귀의 문지기',
    enrageLine: '말캉… 말캉말캉!!'
  },
  boss_pig_king: {
    title: '느티골을 노리는 자',
    enrageLine: '꾸에에에엑!',
    deathLines: [
      '꾸… 꾸르륵…',
      '(쓰러진 꿀꿀이-보스의 목에서 낡은 광부 인식표가 떨어졌다. "잊힌 수정 광산"이라고 새겨져 있다.)'
    ]
  },
  boss_pig_captain: {
    title: '용암 단조장의 주인',
    enrageLine: '단조장은 내 거다, 꾸엑!',
    deathLines: [
      '꾸엑… 이 불은… 원래 우리 것이 아니었어…',
      '(꿀꿀이 대장이 쓰러지자 단조장의 용암이 천천히 잦아든다.)'
    ]
  },
  monster_frog_king: {
    title: '숲의 주인',
    enrageLine: '꾸르르르…!'
  },
  monster_swamp_priest: {
    title: '봉인을 깨는 자',
    enrageLine: '종이여… 다시 울려라!',
    deathLines: [
      '…아아, 종소리가… 멎었구나.',
      '우리는… 막고 있었을 뿐…',
      '진짜 깨어나는 것은… 북쪽에…'
    ]
  },
  monster_troll_chief: {
    title: '서리굴의 문지기',
    enrageLine: '크아아아!'
  },
  monster_frost_witch: {
    title: '잠든 거인의 무녀',
    enrageLine: '눈보라여, 일어나라!',
    deathLines: [
      '…늦었다. 거인은 이미 몸을 뒤척였어.',
      '남쪽 불의 산에서… 두 번째 종이 울릴 거야.',
      '그 종이 울리면… 이 땅은 다시 얼음과 불의 시대로…'
    ]
  },
  boss_trial: {
    title: '시험장의 수호자',
    enrageLine: '이제부터가 진짜 시험이다!'
  }
}

export const getBossPresentation = (appearanceType: string): BossPresentation | undefined =>
  BOSS_PRESENTATION_BY_APPEARANCE_TYPE[appearanceType]

// 기술을 쓰기 직전 보스 머리 위 외침 — 무엇이 올지 미리 알린다.
export const BOSS_SKILL_SHOUTS: Record<BossSkillKind, string> = {
  'poison-puddle': '퉤!',
  'tongue-pull': '꾸르륵…',
  'water-pillar': '물이여, 솟아라!',
  summon: '일어나라…',
  'ground-slam': '쿵!',
  'ice-spike': '얼어붙어라!',
  'ring-burst': '어디로 도망치느냐!',
  charge: '비켜라!',
  'fan-shot': '받아라!',
  'meteor-shower': '하늘이 무너진다!',
  'charged-blast': '힘을… 모은다…'
}

// 같은 기술이라도 보스마다 외침이 다르다(소환 등).
const BOSS_SKILL_SHOUT_OVERRIDES: Record<string, Partial<Record<BossSkillKind, string>>> = {
  boss_slime_king: { summon: '뿌지직… 갈라진다!', 'ground-slam': '말캉!' },
  boss_pig_king: { 'ground-slam': '쿵쾅!' },
  boss_pig_captain: { summon: '얘들아, 나와라!', 'ground-slam': '쿵쾅!' },
  monster_troll_chief: { summon: '나와라, 이 녀석들아!' },
  monster_frost_witch: { summon: '와라, 늑대들아!' }
}

export const getBossSkillShout = (appearanceType: string, kind: BossSkillKind): string =>
  BOSS_SKILL_SHOUT_OVERRIDES[appearanceType]?.[kind] ?? BOSS_SKILL_SHOUTS[kind]

// 체력이 이 비율 아래로 내려가면 분노: 기술 간격이 짧아지고 소환이 하나 늘어난다.
export const BOSS_ENRAGE_HP_RATIO = 0.5
const ENRAGED_COOLDOWN_MULTIPLIER = 0.8

export const isBossEnraged = (currentHp: number, maxHp: number): boolean =>
  maxHp > 0 && currentHp / maxHp <= BOSS_ENRAGE_HP_RATIO

export const getBossSkillCooldown = (skill: BossSkillDefinition, enraged: boolean): number =>
  Math.round(skill.cooldownMilliseconds * (enraged ? ENRAGED_COOLDOWN_MULTIPLIER : 1))

// 싸움이 붙자마자 기술을 쏟아붓지 않게 첫 기술은 조금 기다렸다 쓴다.
export const BOSS_FIRST_SKILL_DELAY_MILLISECONDS = 3000

export const getBossSkills = (appearanceType: string): readonly BossSkillDefinition[] =>
  BOSS_SKILLS_BY_APPEARANCE_TYPE[appearanceType] ?? []

// 지금 쓸 수 있는 기술 — 쿨다운이 끝났고 거리가 맞는 것(목록 순서). readyAt 에 없는 기술은 바로 쓸 수 있다.
export const getReadyBossSkills = (
  appearanceType: string,
  distanceTiles: number,
  readyAtByKind: Partial<Record<BossSkillKind, number>>,
  now: number
): BossSkillDefinition[] =>
  getBossSkills(appearanceType).filter(
    (skill) =>
      (readyAtByKind[skill.kind] ?? 0) <= now &&
      distanceTiles >= skill.minRangeTiles &&
      distanceTiles <= skill.maxRangeTiles
  )

// 지금 쓸 기술 — 쓸 수 있는 것 중 목록 앞의 것
export const pickBossSkill = (
  appearanceType: string,
  distanceTiles: number,
  readyAtByKind: Partial<Record<BossSkillKind, number>>,
  now: number
): BossSkillDefinition | undefined => getReadyBossSkills(appearanceType, distanceTiles, readyAtByKind, now)[0]

// ---------------------------------------------------------------- 바닥 위험 지대
export type BossHazardKind =
  | 'poison-puddle'
  | 'water-pillar'
  | 'ground-slam'
  | 'ice-spike'
  | 'ring-burst'
  | 'charge-lane'
  | 'fan-shot'
  | 'meteor'
  | 'charged-blast'

export type BossHazard = {
  id: string
  kind: BossHazardKind
  // 가운데(칸 좌표, 소수). 움직이는 것(탄)은 armedAt 때의 자리.
  x: number
  y: number
  radiusTiles: number
  // 도넛: 가운데에서 이만큼 안쪽은 안전하다
  innerRadiusTiles?: number
  // 탄: armedAt 부터 이 속도(칸/초)로 날아가고, 한 번 맞히거나 벽에 닿으면 사라진다
  velocity?: { x: number; y: number }
  // 이때부터 피해를 준다(그 전은 경고 표시)
  armedAt: number
  expiresAt: number
  // 웅덩이: 다음 피해 시각. 물기둥: 한 번만 터진다.
  nextTickAt: number
}

export const POISON_PUDDLE_WARNING_MILLISECONDS = 900
export const POISON_PUDDLE_DURATION_MILLISECONDS = 6000
export const POISON_PUDDLE_TICK_MILLISECONDS = 800
export const POISON_PUDDLE_RADIUS_TILES = 1.3
export const WATER_PILLAR_WARNING_MILLISECONDS = 1100
// 터진 물기둥이 보이는 시간(피해는 터지는 순간 한 번)
export const WATER_PILLAR_BURST_MILLISECONDS = 450
export const WATER_PILLAR_RADIUS_TILES = 1.1
// 물기둥은 플레이어 자리 하나 + 둘레에 몇 개 더 — 한 칸 옆으로 비키면 피할 수 있게 사이를 둔다.
export const WATER_PILLAR_EXTRA_COUNT = 2
const WATER_PILLAR_EXTRA_DISTANCE_TILES = 2.6

export const createPoisonPuddle = (id: string, x: number, y: number, now: number): BossHazard => ({
  id,
  kind: 'poison-puddle',
  x,
  y,
  radiusTiles: POISON_PUDDLE_RADIUS_TILES,
  armedAt: now + POISON_PUDDLE_WARNING_MILLISECONDS,
  expiresAt: now + POISON_PUDDLE_WARNING_MILLISECONDS + POISON_PUDDLE_DURATION_MILLISECONDS,
  nextTickAt: now + POISON_PUDDLE_WARNING_MILLISECONDS
})

// random 은 0 이상 1 미만(Math.random). 둘레 물기둥의 방향을 고른다.
export const GROUND_SLAM_WARNING_MILLISECONDS = 900
export const GROUND_SLAM_BURST_MILLISECONDS = 400
export const GROUND_SLAM_RADIUS_TILES = 2.6

// 내려찍기: 보스 자리 둘레 한 번. 경고 고리가 차오르는 동안 둘레 밖으로 빠져나가면 피한다.
export const createGroundSlam = (id: string, x: number, y: number, now: number): BossHazard => ({
  id,
  kind: 'ground-slam',
  x,
  y,
  radiusTiles: GROUND_SLAM_RADIUS_TILES,
  armedAt: now + GROUND_SLAM_WARNING_MILLISECONDS,
  expiresAt: now + GROUND_SLAM_WARNING_MILLISECONDS + GROUND_SLAM_BURST_MILLISECONDS,
  nextTickAt: now + GROUND_SLAM_WARNING_MILLISECONDS
})

// kind: 물기둥(늪의 사제) 또는 얼음 가시(서리 마녀) — 같은 시간·범위, 그림만 다르다.
export const createWaterPillars = (
  idPrefix: string,
  x: number,
  y: number,
  now: number,
  random: () => number,
  kind: 'water-pillar' | 'ice-spike' = 'water-pillar'
): BossHazard[] => {
  const baseAngle = random() * Math.PI * 2
  const centers = [
    { x, y },
    ...Array.from({ length: WATER_PILLAR_EXTRA_COUNT }, (_, index) => {
      const angle = baseAngle + (index * Math.PI * 2) / WATER_PILLAR_EXTRA_COUNT
      return {
        x: x + Math.cos(angle) * WATER_PILLAR_EXTRA_DISTANCE_TILES,
        y: y + Math.sin(angle) * WATER_PILLAR_EXTRA_DISTANCE_TILES
      }
    })
  ]
  return centers.map((center, index) => ({
    id: `${idPrefix}:${index}`,
    kind,
    x: center.x,
    y: center.y,
    radiusTiles: WATER_PILLAR_RADIUS_TILES,
    armedAt: now + WATER_PILLAR_WARNING_MILLISECONDS,
    expiresAt: now + WATER_PILLAR_WARNING_MILLISECONDS + WATER_PILLAR_BURST_MILLISECONDS,
    nextTickAt: now + WATER_PILLAR_WARNING_MILLISECONDS
  }))
}

// ---------------------------------------------------------------- 시험 보스의 기술
// 도넛: 보스 둘레 큰 고리가 터지고 안쪽은 안전하다 — 내려찍기와 반대로 붙어야 산다.
export const RING_BURST_WARNING_MILLISECONDS = 1100
export const RING_BURST_BURST_MILLISECONDS = 400
export const RING_BURST_RADIUS_TILES = 4.6
export const RING_BURST_INNER_RADIUS_TILES = 1.8

export const createRingBurst = (id: string, x: number, y: number, now: number): BossHazard => ({
  id,
  kind: 'ring-burst',
  x,
  y,
  radiusTiles: RING_BURST_RADIUS_TILES,
  innerRadiusTiles: RING_BURST_INNER_RADIUS_TILES,
  armedAt: now + RING_BURST_WARNING_MILLISECONDS,
  expiresAt: now + RING_BURST_WARNING_MILLISECONDS + RING_BURST_BURST_MILLISECONDS,
  nextTickAt: now + RING_BURST_WARNING_MILLISECONDS
})

// 돌진: 갈 길을 먼저 보여 주고(준비) 그 길을 빠르게 달린다. 플레이어를 지나 조금 더 간다 — 옆으로 비켜야 한다.
export const CHARGE_WINDUP_MILLISECONDS = 800
export const CHARGE_DASH_MILLISECONDS = 350
export const CHARGE_MAX_DISTANCE_TILES = 9
export const CHARGE_OVERSHOOT_TILES = 2
export const CHARGE_LANE_RADIUS_TILES = 0.9
const CHARGE_LANE_SPACING_TILES = 0.8
// 길의 칸 하나가 보스가 지나간 뒤에도 잠깐 피해를 준다
const CHARGE_LANE_HIT_MILLISECONDS = 120

// 돌진할 방향(단위 벡터)과 거리. 벽(isBlocked)에 닿으면 그 앞에서 멈춘다.
export const getChargePath = (
  boss: { x: number; y: number },
  player: { x: number; y: number },
  isBlocked: (x: number, y: number) => boolean
): { direction: { x: number; y: number }; distanceTiles: number } => {
  const dx = player.x - boss.x
  const dy = player.y - boss.y
  const length = Math.hypot(dx, dy) || 1
  const direction = { x: dx / length, y: dy / length }
  const wanted = Math.min(CHARGE_MAX_DISTANCE_TILES, length + CHARGE_OVERSHOOT_TILES)
  let distanceTiles = 0
  while (
    distanceTiles + 0.25 <= wanted &&
    !isBlocked(boss.x + direction.x * (distanceTiles + 0.25), boss.y + direction.y * (distanceTiles + 0.25))
  ) {
    distanceTiles += 0.25
  }
  return { direction, distanceTiles }
}

// 돌진 길 위에 늘어선 작은 지대들. 보스가 그 칸을 지나는 순간에 차례로 피해를 준다.
export const createChargeLane = (
  idPrefix: string,
  from: { x: number; y: number },
  path: { direction: { x: number; y: number }; distanceTiles: number },
  now: number
): BossHazard[] => {
  const dashStartAt = now + CHARGE_WINDUP_MILLISECONDS
  const count = Math.max(1, Math.ceil(path.distanceTiles / CHARGE_LANE_SPACING_TILES))
  return Array.from({ length: count + 1 }, (_, index) => {
    const distance = Math.min(path.distanceTiles, index * CHARGE_LANE_SPACING_TILES)
    const armedAt =
      dashStartAt + Math.round((distance / Math.max(path.distanceTiles, 0.01)) * CHARGE_DASH_MILLISECONDS)
    return {
      id: `${idPrefix}:${index}`,
      kind: 'charge-lane' as const,
      x: from.x + path.direction.x * distance,
      y: from.y + path.direction.y * distance,
      radiusTiles: CHARGE_LANE_RADIUS_TILES,
      armedAt,
      expiresAt: armedAt + CHARGE_LANE_HIT_MILLISECONDS,
      nextTickAt: armedAt
    }
  })
}

// 부채꼴 탄: 플레이어 쪽으로 여러 발을 부채꼴로 쏜다. 탄 사이 틈으로 빠진다.
export const FAN_SHOT_WINDUP_MILLISECONDS = 350
export const FAN_SHOT_COUNT = 5
const FAN_SHOT_SPREAD_RADIANS = 0.26
export const FAN_SHOT_SPEED_TILES_PER_SECOND = 7
const FAN_SHOT_LIFETIME_MILLISECONDS = 1800
export const FAN_SHOT_RADIUS_TILES = 0.4

export const getFanShotCount = (enraged: boolean): number => FAN_SHOT_COUNT + (enraged ? 2 : 0)

export const createFanShot = (
  idPrefix: string,
  from: { x: number; y: number },
  target: { x: number; y: number },
  count: number,
  now: number
): BossHazard[] => {
  const aim = Math.atan2(target.y - from.y, target.x - from.x)
  const armedAt = now + FAN_SHOT_WINDUP_MILLISECONDS
  return Array.from({ length: count }, (_, index) => {
    const angle = aim + (index - (count - 1) / 2) * FAN_SHOT_SPREAD_RADIANS
    return {
      id: `${idPrefix}:${index}`,
      kind: 'fan-shot' as const,
      x: from.x,
      y: from.y,
      radiusTiles: FAN_SHOT_RADIUS_TILES,
      velocity: {
        x: Math.cos(angle) * FAN_SHOT_SPEED_TILES_PER_SECOND,
        y: Math.sin(angle) * FAN_SHOT_SPEED_TILES_PER_SECOND
      },
      armedAt,
      expiresAt: armedAt + FAN_SHOT_LIFETIME_MILLISECONDS,
      nextTickAt: armedAt
    }
  })
}

// 유성우: 첫 돌은 플레이어 자리, 나머지는 둘레 아무 데나 시간차로 떨어진다. 멈춰 있으면 맞는다.
export const METEOR_WARNING_MILLISECONDS = 1000
export const METEOR_STAGGER_MILLISECONDS = 220
const METEOR_BURST_MILLISECONDS = 400
export const METEOR_RADIUS_TILES = 1.2
const METEOR_SCATTER_TILES = 4.5
export const METEOR_COUNT = 7

export const getMeteorCount = (enraged: boolean): number => METEOR_COUNT + (enraged ? 3 : 0)

// random 은 0 이상 1 미만(Math.random).
export const createMeteorShower = (
  idPrefix: string,
  target: { x: number; y: number },
  count: number,
  now: number,
  random: () => number
): BossHazard[] =>
  Array.from({ length: count }, (_, index) => {
    const angle = random() * Math.PI * 2
    const distance = index === 0 ? 0 : Math.sqrt(random()) * METEOR_SCATTER_TILES
    const armedAt = now + METEOR_WARNING_MILLISECONDS + index * METEOR_STAGGER_MILLISECONDS
    return {
      id: `${idPrefix}:${index}`,
      kind: 'meteor' as const,
      x: target.x + Math.cos(angle) * distance,
      y: target.y + Math.sin(angle) * distance,
      radiusTiles: METEOR_RADIUS_TILES,
      armedAt,
      expiresAt: armedAt + METEOR_BURST_MILLISECONDS,
      nextTickAt: armedAt
    }
  })

// 기 모으기: 보스가 멈춰 서서 오래 힘을 모은 뒤 넓게 터뜨린다(아주 아프다). 범위 밖으로 나가거나,
// 모으는 동안 보스 체력을 일정 비율 깎으면 끊기고 보스가 한동안 휘청인다.
export const CHARGED_BLAST_CHANNEL_MILLISECONDS = 2200
const CHARGED_BLAST_BURST_MILLISECONDS = 450
export const CHARGED_BLAST_RADIUS_TILES = 4.2
export const CHARGED_BLAST_INTERRUPT_HP_RATIO = 0.05
export const CHARGED_BLAST_STAGGER_MILLISECONDS = 1800

export const createChargedBlast = (id: string, x: number, y: number, now: number): BossHazard => ({
  id,
  kind: 'charged-blast',
  x,
  y,
  radiusTiles: CHARGED_BLAST_RADIUS_TILES,
  armedAt: now + CHARGED_BLAST_CHANNEL_MILLISECONDS,
  expiresAt: now + CHARGED_BLAST_CHANNEL_MILLISECONDS + CHARGED_BLAST_BURST_MILLISECONDS,
  nextTickAt: now + CHARGED_BLAST_CHANNEL_MILLISECONDS
})

export const shouldInterruptChargedBlast = (startHp: number, currentHp: number, maxHp: number): boolean =>
  startHp - currentHp >= maxHp * CHARGED_BLAST_INTERRUPT_HP_RATIO

// ---------------------------------------------------------------- 위험 지대 판정
// 지금 가운데 — 탄은 armedAt 부터 날아간다.
export const getBossHazardCenter = (hazard: BossHazard, now: number): { x: number; y: number } => {
  if (!hazard.velocity) {
    return { x: hazard.x, y: hazard.y }
  }
  const seconds = Math.max(0, now - hazard.armedAt) / 1000
  return { x: hazard.x + hazard.velocity.x * seconds, y: hazard.y + hazard.velocity.y * seconds }
}

export const isPointInBossHazard = (hazard: BossHazard, x: number, y: number, now: number): boolean => {
  const center = getBossHazardCenter(hazard, now)
  const distance = Math.hypot(x - center.x, y - center.y)
  return distance <= hazard.radiusTiles && distance >= (hazard.innerRadiusTiles ?? 0)
}

// 웅덩이는 한 번에 최대 체력의 6%(최소 2), 물기둥은 18%(최소 4). 보스 레벨이 아니라 체력 비율이라
// 어느 레벨에 와도 "두세 번 맞으면 아프다"가 같다.
const BOSS_HAZARD_DAMAGE_RATIO: Record<BossHazardKind, number> = {
  'poison-puddle': 0.06,
  'water-pillar': 0.18,
  'ice-spike': 0.16,
  'ground-slam': 0.2,
  'ring-burst': 0.2,
  'charge-lane': 0.22,
  'fan-shot': 0.07,
  meteor: 0.14,
  // 끊거나 빠져나갈 시간이 넉넉한 대신 맞으면 반 가까이 깎인다
  'charged-blast': 0.45
}

export const getBossHazardDamage = (kind: BossHazardKind, maxHp: number): number =>
  Math.max(
    kind === 'poison-puddle' || kind === 'fan-shot' ? 2 : 4,
    Math.round(maxHp * BOSS_HAZARD_DAMAGE_RATIO[kind])
  )

export type BossHazardTick = {
  hazards: BossHazard[]
  // 이번에 플레이어에게 피해를 준 위험 지대 종류(겹쳐 있어도 종류마다 한 번)
  damageKinds: BossHazardKind[]
}

// 시간을 흘려 끝난 위험 지대를 지우고, 플레이어(칸 좌표)가 서 있는 무장된 지대의 피해를 정한다.
// 탄은 벽(isBlocked)에 닿거나 플레이어를 한 번 맞히면 사라진다.
export const tickBossHazards = (
  hazards: readonly BossHazard[],
  playerX: number,
  playerY: number,
  now: number,
  isBlocked: (x: number, y: number) => boolean = () => false
): BossHazardTick => {
  const damageKinds = new Set<BossHazardKind>()
  const next: BossHazard[] = []
  for (const hazard of hazards) {
    if (hazard.expiresAt <= now) {
      continue
    }
    if (hazard.velocity && hazard.armedAt <= now) {
      const center = getBossHazardCenter(hazard, now)
      if (isBlocked(center.x, center.y)) {
        continue
      }
      if (isPointInBossHazard(hazard, playerX, playerY, now)) {
        damageKinds.add(hazard.kind)
        continue
      }
      next.push(hazard)
      continue
    }
    if (hazard.armedAt > now || hazard.nextTickAt > now) {
      next.push(hazard)
      continue
    }
    if (isPointInBossHazard(hazard, playerX, playerY, now)) {
      damageKinds.add(hazard.kind)
    }
    next.push({
      ...hazard,
      nextTickAt:
        hazard.kind === 'poison-puddle'
          ? now + POISON_PUDDLE_TICK_MILLISECONDS
          : Number.POSITIVE_INFINITY
    })
  }
  return { hazards: next, damageKinds: [...damageKinds] }
}

// ---------------------------------------------------------------- 혀 당기기
export const TONGUE_PULL_DURATION_MILLISECONDS = 280
// 혀를 내밀기 전 입을 벌리고 멈추는 틈 — 이때 구르면 빠져나갈 수 있다
export const TONGUE_PULL_WINDUP_MILLISECONDS = 450
// 보스 앞 이만큼(칸)까지 끌려온다 — 바로 다음 근접 공격 거리 안
export const TONGUE_PULL_STOP_DISTANCE_TILES = 1.6

// 플레이어를 보스 쪽으로 옮길 전체 거리(칸 벡터).
export const getTonguePullVector = (
  boss: { x: number; y: number },
  player: { x: number; y: number }
): { x: number; y: number } => {
  const dx = boss.x - player.x
  const dy = boss.y - player.y
  const distance = Math.hypot(dx, dy)
  if (distance <= TONGUE_PULL_STOP_DISTANCE_TILES) {
    return { x: 0, y: 0 }
  }
  const scale = (distance - TONGUE_PULL_STOP_DISTANCE_TILES) / distance
  return { x: dx * scale, y: dy * scale }
}

// ---------------------------------------------------------------- 소환
// 하수인은 맵에 '<보스 이름>-소환-N' 으로 미리 둔다(보스는 '<보스 이름>-보스'). 씬이 시작될 때는 쓰러진
// 상태이고, 보스가 소환 기술로 곁에 불러낸다. 저절로 다시 생기지 않고, 보스가 쓰러지면 함께 사라진다.
export const SUMMON_COUNT_PER_CAST = 2

export const getSummonCountPerCast = (enraged: boolean): number => SUMMON_COUNT_PER_CAST + (enraged ? 1 : 0)
export const MAX_ACTIVE_SUMMONS = 3

export const getBossSummonPrefix = (bossCharacterId: string): string =>
  `${bossCharacterId.replace(/-보스$/, '')}-소환-`

export const isBossSummonCharacterId = (characterId: string): boolean => characterId.includes('-소환-')
