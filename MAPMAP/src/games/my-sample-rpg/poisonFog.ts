// 2장 독안개 — 가라앉은 숲 동쪽을 덮은 안개 칸(roof 레이어의 swamp_fog_* 타일)에 서 있으면 숨이 막혀 체력이
// 깎인다. 갈대골 약초꾼 오디의 해독 향을 피우면 한동안 막는다. 면역 시간은 씬을 넘어 이어져야 하므로
// (갈대골에서 피우고 숲으로 건너간다) 맵 화면이 아니라 게임 상태(main.ts)에 둔다. 시각은 Date.now().

export const ANTIDOTE_INCENSE_ITEM_ID = 'antidote-incense'
export const ANTIDOTE_INCENSE_DURATION_MILLISECONDS = 90_000
export const POISON_FOG_TICK_MILLISECONDS = 1_000
// 안개 칸이 아니라 안개 장막(오브젝트 그림)은 피해를 주지 않는다 — 막고 말을 걸 뿐이다.
const FOG_TILE_TYPE_PATTERN = /^swamp_fog_(\d+|edge_w)$/

export const isPoisonFogTileType = (tileType: string | undefined): boolean =>
  tileType !== undefined && FOG_TILE_TYPE_PATTERN.test(tileType)

// 한 번에 최대 체력의 5%(최소 2). 해독 향 없이 20초 남짓 버티면 쓰러진다.
export const getPoisonFogDamage = (maxHp: number): number => Math.max(2, Math.round(maxHp * 0.05))

export const isPoisonFogImmune = (immuneUntil: number, now: number): boolean => now < immuneUntil

export const getRemainingImmunitySeconds = (immuneUntil: number, now: number): number =>
  Math.max(0, Math.ceil((immuneUntil - now) / 1000))
