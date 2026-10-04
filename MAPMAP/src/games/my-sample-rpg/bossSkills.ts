// 2장 보스의 특수 기술 — 근접 공격 사이사이에 쓴다. 무엇을 언제 쓰는지와 바닥 위험 지대(웅덩이·물기둥)의
// 시간·범위·피해는 여기서 정하고, 그리기·이동·피해 적용은 맵 화면(createPixiTiledMapView)이 한다.
// 위험 지대는 먼저 표시(경고)되고 잠시 뒤 피해를 준다 — 보고 피할 수 있어야 한다. 좌표는 칸 단위.
//
//   늪지기 거대개구리(c2-05): 독 웅덩이(플레이어 자리에 독을 뱉는다), 혀 당기기(멀리 있으면 끌어당긴다)
//   늪의 사제(c2-08): 물기둥(플레이어 자리와 둘레에 솟는다), 소환(물에 빠진 자를 불러낸다)

export type BossSkillKind = 'poison-puddle' | 'tongue-pull' | 'water-pillar' | 'summon'

export type BossSkillDefinition = {
  kind: BossSkillKind
  cooldownMilliseconds: number
  // 플레이어와의 거리(칸)가 이 범위 안일 때만 쓴다
  minRangeTiles: number
  maxRangeTiles: number
}

const BOSS_SKILLS_BY_APPEARANCE_TYPE: Record<string, readonly BossSkillDefinition[]> = {
  monster_frog_king: [
    { kind: 'tongue-pull', cooldownMilliseconds: 9000, minRangeTiles: 3, maxRangeTiles: 7 },
    { kind: 'poison-puddle', cooldownMilliseconds: 6500, minRangeTiles: 0, maxRangeTiles: 8 }
  ],
  monster_swamp_priest: [
    { kind: 'summon', cooldownMilliseconds: 16000, minRangeTiles: 0, maxRangeTiles: 12 },
    { kind: 'water-pillar', cooldownMilliseconds: 5500, minRangeTiles: 0, maxRangeTiles: 10 }
  ]
}

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
export type BossHazardKind = 'poison-puddle' | 'water-pillar'

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
export const createWaterPillars = (
  idPrefix: string,
  x: number,
  y: number,
  now: number,
  random: () => number
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
    kind: 'water-pillar',
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
export const getBossHazardDamage = (kind: BossHazardKind, maxHp: number): number =>
  kind === 'poison-puddle'
    ? Math.max(2, Math.round(maxHp * 0.06))
    : Math.max(4, Math.round(maxHp * 0.18))

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
export const MAX_ACTIVE_SUMMONS = 3

export const getBossSummonPrefix = (bossCharacterId: string): string =>
  `${bossCharacterId.replace(/-보스$/, '')}-소환-`

export const isBossSummonCharacterId = (characterId: string): boolean => characterId.includes('-소환-')
