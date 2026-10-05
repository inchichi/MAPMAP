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
  '꿀꿀이대장-보스': 'boss_pig_captain'
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
  ]
}

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
    title: '티르코네일을 노리는 자',
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
    title: '얼음 동굴의 문지기',
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
  'ice-spike': '얼어붙어라!'
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

// 지금 쓸 기술 — 쿨다운이 끝났고 거리가 맞는 것 중 목록 앞의 것. readyAt 에 없는 기술은 바로 쓸 수 있다.
export const pickBossSkill = (
  appearanceType: string,
  distanceTiles: number,
  readyAtByKind: Partial<Record<BossSkillKind, number>>,
  now: number
): BossSkillDefinition | undefined =>
  getBossSkills(appearanceType).find(
    (skill) =>
      (readyAtByKind[skill.kind] ?? 0) <= now &&
      distanceTiles >= skill.minRangeTiles &&
      distanceTiles <= skill.maxRangeTiles
  )

// ---------------------------------------------------------------- 바닥 위험 지대
export type BossHazardKind = 'poison-puddle' | 'water-pillar' | 'ground-slam' | 'ice-spike'

export type BossHazard = {
  id: string
  kind: BossHazardKind
  // 가운데(칸 좌표, 소수)
  x: number
  y: number
  radiusTiles: number
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

export const isPointInBossHazard = (hazard: BossHazard, x: number, y: number): boolean =>
  Math.hypot(x - hazard.x, y - hazard.y) <= hazard.radiusTiles

// 웅덩이는 한 번에 최대 체력의 6%(최소 2), 물기둥은 18%(최소 4). 보스 레벨이 아니라 체력 비율이라
// 어느 레벨에 와도 "두세 번 맞으면 아프다"가 같다.
const BOSS_HAZARD_DAMAGE_RATIO: Record<BossHazardKind, number> = {
  'poison-puddle': 0.06,
  'water-pillar': 0.18,
  'ice-spike': 0.16,
  'ground-slam': 0.2
}

export const getBossHazardDamage = (kind: BossHazardKind, maxHp: number): number =>
  Math.max(kind === 'poison-puddle' ? 2 : 4, Math.round(maxHp * BOSS_HAZARD_DAMAGE_RATIO[kind]))

export type BossHazardTick = {
  hazards: BossHazard[]
  // 이번에 플레이어에게 피해를 준 위험 지대 종류(겹쳐 있어도 종류마다 한 번)
  damageKinds: BossHazardKind[]
}

// 시간을 흘려 끝난 위험 지대를 지우고, 플레이어(칸 좌표)가 서 있는 무장된 지대의 피해를 정한다.
export const tickBossHazards = (
  hazards: readonly BossHazard[],
  playerX: number,
  playerY: number,
  now: number
): BossHazardTick => {
  const damageKinds = new Set<BossHazardKind>()
  const next: BossHazard[] = []
  for (const hazard of hazards) {
    if (hazard.expiresAt <= now) {
      continue
    }
    if (hazard.armedAt > now || hazard.nextTickAt > now) {
      next.push(hazard)
      continue
    }
    if (isPointInBossHazard(hazard, playerX, playerY)) {
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
