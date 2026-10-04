// 퀘스트 목표(달성 조건) 에셋의 legend-of-lua 스프라이트 URL을 추정한다.
// 스프라이트는 public/legend-sprites/ 에 번들돼 있다(legend-of-lua/sprites/ 에서 복사).
// 정확히 못 찾으면 null을 돌려준다 → UI가 종류 아이콘으로 폴백하고, <img> onerror로도 한 번 더 폴백한다.
//
// 키 출처(GameEntity.spriteKey): NPC=외형(appearance, sprites/npc/<id>.png), 적=name("bat" 등),
// 보급품(loot)=type("coin1"/"key"…). 상자(chest)는 종류로 고정 스프라이트를 쓴다.

const BASE = '/legend-sprites'

// 적 name → 대표 스프라이트(단일 프레임). 시트/하위폴더는 대표 한 장으로 보여준다.
const ENEMY_FILE: Record<string, string> = {
  bat: 'enemies/bat.png',
  eye: 'enemies/eye/eye1.png',
  skeleton: 'enemies/skeleton/mage.png'
}

// 보급품(loot) type → 아이템 스프라이트.
const LOOT_FILE: Record<string, string> = {
  coin1: 'items/coin.png',
  coin2: 'items/coin.png',
  coin3: 'items/coin.png',
  coin: 'items/coin.png',
  key: 'items/key.png',
  heart: 'items/heart.png',
  arrow: 'items/arrow.png',
  bomb: 'items/bomb.png'
}

export const resolveLegendEntitySpriteUrl = (
  kind: string,
  spriteKey?: string
): string | null => {
  const key = (spriteKey ?? '').trim()
  switch (kind) {
    case 'npc':
      // 외형 id가 곧 파일명: sprites/npc/character_wizard_purple.png 등.
      return key ? `${BASE}/npc/${key}.png` : null
    case 'enemy':
      return ENEMY_FILE[key] ? `${BASE}/${ENEMY_FILE[key]}` : null
    case 'chest':
      return `${BASE}/environment/chestClosed.png`
    case 'loot':
      // 알려진 type이면 그 아이템, 아니면 동전으로 대체(획득물 기본 표현).
      return `${BASE}/${LOOT_FILE[key] ?? 'items/coin.png'}`
    default:
      return null
  }
}
