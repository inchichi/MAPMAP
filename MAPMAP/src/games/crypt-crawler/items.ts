// 아이템 표. 이 파일에는 "무엇이 있는가"만 둔다 — 언제 떨어지는가는 loot.ts,
// 화면에 어떻게 보이는가는 rendering/createLootOverlay.ts 다.
//
// 무기는 assets/items/weapons/ 에 아이콘 <id>.png 와 든 모습 <id>_hand.png 가 짝으로
// 있는 것만 골랐다. bow / bow2 / fishing_rod 는 든 모습 파일이 없어 뺐다 — 플레이어
// 옆에 그릴 그림이 없으면 장착이 화면에 나타나지 않는다.

export type Weapon = {
  id: string
  name: string
  /** 플레이어 물리 공격력에 더해지는 값. */
  attack: number
  /** 이 레벨부터 드랍 후보에 들어온다. */
  minLevel: number
}

/**
 * 공격력 오름차순으로 둔다. 드랍이 "뒤쪽일수록 좋은 것"이라는 순서에 기대어 고르므로
 * 이 정렬이 깨지면 깊은 층에서 약한 무기가 쏟아진다(items.test.ts 가 지킨다).
 * 존 레벨이 3·9·16·25·30 이라 minLevel 도 그 구간에 맞춰 퍼뜨렸다.
 */
export const WEAPONS: readonly Weapon[] = [
  { id: 'stick', name: '나뭇가지', attack: 1, minLevel: 1 },
  { id: 'bone', name: '뼈다귀', attack: 2, minLevel: 1 },
  { id: 'fork', name: '쇠스랑', attack: 3, minLevel: 2 },
  { id: 'club', name: '몽둥이', attack: 4, minLevel: 3 },
  { id: 'axetool', name: '장작도끼', attack: 5, minLevel: 4 },
  { id: 'pickaxe', name: '곡괭이', attack: 6, minLevel: 5 },
  { id: 'sword2', name: '낡은 검', attack: 7, minLevel: 6 },
  { id: 'sai', name: '사이', attack: 8, minLevel: 8 },
  { id: 'ninjaku', name: '쿠나이', attack: 9, minLevel: 9 },
  { id: 'whip', name: '채찍', attack: 10, minLevel: 11 },
  { id: 'sword', name: '강철 검', attack: 11, minLevel: 12 },
  { id: 'katana', name: '카타나', attack: 13, minLevel: 14 },
  { id: 'magicwand', name: '마법봉', attack: 14, minLevel: 15 },
  { id: 'axe', name: '전투도끼', attack: 15, minLevel: 16 },
  { id: 'rapier', name: '레이피어', attack: 16, minLevel: 18 },
  { id: 'book', name: '마법서', attack: 17, minLevel: 20 },
  { id: 'hammer', name: '쇠망치', attack: 19, minLevel: 22 },
  { id: 'lance2', name: '창', attack: 20, minLevel: 24 },
  { id: 'lance', name: '장창', attack: 22, minLevel: 26 },
  { id: 'bigsword', name: '대검', attack: 24, minLevel: 28 }
]

/** 아리가 구덩이로 내려갈 때 이미 들고 있는 것. 맨손 상태를 따로 두지 않는다. */
export const STARTING_WEAPON = WEAPONS[0]

/** 이 레벨에서 나올 수 있는 무기들. 표 순서를 그대로 유지한다(뒤쪽이 강하다). */
export const weaponsAvailableAt = (level: number): readonly Weapon[] => {
  const depth = Math.max(1, Math.floor(level))

  return WEAPONS.filter((weapon) => weapon.minLevel <= depth)
}

/** 주운 것을 들고 있던 것과 비교한다. 등급도 옵션도 없으니 공격력이 전부다. */
export const isBetterWeapon = (candidate: Weapon, held: Weapon): boolean =>
  candidate.attack > held.attack

/** 소비품은 체력 물약 하나뿐이다. 회복량과 아이콘을 한곳에 둬 HUD 와 드랍이 어긋나지 않게 한다. */
export const HEALTH_POTION = {
  id: 'lifepot',
  name: '체력 물약',
  /** 최대 체력의 이 비율만큼 회복한다. */
  healRatio: 0.4
}

/** 바닥에 놓인 금화 더미의 아이콘. 액수가 크면 금화, 적으면 은화로 보인다. */
export const goldIconId = (amount: number): string =>
  amount >= 25 ? 'goldcoin' : 'silvercoin'
