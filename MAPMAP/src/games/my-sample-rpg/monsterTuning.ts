// 이 게임(my-sample-rpg)만의 몬스터 배수. 공용 공식(monsterCombat.ts)은 crypt-crawler 도 쓰므로
// 그대로 두고 여기서 곱한다. 게임 화면(createPixiTiledMapView)과 scripts/estimate-playtime.ts 가 같이 쓴다.
// 일반 몬스터는 같은 레벨에서 세 번쯤 때려야 쓰러지게(2배로는 무기 공격력 때문에 두 번이면 쓰러졌다),
// 보스(이름이 '-보스'로 끝남)는 어느 맵에서든 크게.
export const MONSTER_HP_MULTIPLIER = 3
export const BOSS_HP_MULTIPLIER = 10
export const BOSS_DAMAGE_MULTIPLIER = 2
export const BOSS_RENDER_SCALE_MULTIPLIER = 2

// 2장 보스는 기술(독 웅덩이·물기둥 등)로 몰아붙이는 동안 버텨야 해서 기본 보스보다 체력을 더 준다.
// 측정(scripts/estimate-playtime.ts)으로 보스 전투가 1~2분이 되게 맞춘 값.
const BOSS_HP_EXTRA_BY_APPEARANCE_TYPE: Record<string, number> = {
  monster_frog_king: 3.5,
  monster_swamp_priest: 4,
  monster_troll_chief: 3.5,
  monster_frost_witch: 4,
  // 시험 보스(트롤 족장 외형을 빌림): 보스 전투 시뮬레이터(scripts/simulate-boss-fight.ts)로 실력별 목표
  // 승률과 1~2분 싸움에 맞춘 값 — docs/boss-rl-design.md 의 "Balance"
  boss_trial: 4
}

// 열쇠는 보스 키(bossSkills.getBossKey) — 대부분 외형과 같고, 외형을 빌린 보스(시험 보스 등)만 다르다.
export const getBossHpMultiplier = (bossKey: string): number =>
  BOSS_HP_MULTIPLIER * (BOSS_HP_EXTRA_BY_APPEARANCE_TYPE[bossKey] ?? 1)

// 시험 보스는 기술이 7가지라 근접 공격까지 2배면 싸움이 근접 피해로만 끝났다(시뮬레이터 측정).
const BOSS_DAMAGE_MULTIPLIER_BY_KEY: Record<string, number> = {
  boss_trial: 1
}

export const getBossDamageMultiplier = (bossKey: string): number =>
  BOSS_DAMAGE_MULTIPLIER_BY_KEY[bossKey] ?? BOSS_DAMAGE_MULTIPLIER
