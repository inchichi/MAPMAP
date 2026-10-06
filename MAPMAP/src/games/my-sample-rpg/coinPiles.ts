// 동굴 계열 맵 바닥에 깔린 금화 더미 타일(town-32.tsx의 cave_prop_gold_*)을
// 획득 가능한 코인으로 다루기 위한 순수 로직.
// gid를 하드코딩하지 않고 타일 타입 문자열로 판별한다 —
// append-cave-tiles.py 재실행으로 gid가 재번호되어도 안전하다.
export const COIN_PILE_GOLD_AMOUNT_BY_TILE_TYPE: Readonly<
  Record<string, number>
> = {
  cave_prop_gold_00: 10,
  cave_prop_gold_01: 15,
  cave_prop_gold_02: 20,
  cave_prop_gold_03: 30
}

export const getCoinPileGoldAmount = (
  tileType: string | undefined
): number | undefined =>
  tileType === undefined
    ? undefined
    : COIN_PILE_GOLD_AMOUNT_BY_TILE_TYPE[tileType]

export const createCoinPileTileKey = (
  tileX: number,
  tileY: number
): string => `${tileX},${tileY}`
