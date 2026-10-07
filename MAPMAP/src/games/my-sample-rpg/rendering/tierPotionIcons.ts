import tierPotionIcons from '../assets/items/tier-potion-icons.json'

// 등급 포션(중급·상급) 아이콘: 기본 포션 그림에 금빛 표시를 더한 한 장
// (scripts/generate-tier-potion-icons.py 의 tier-potion-icons.png, 16px 칸).
const TIER_POTION_ICON_ATLAS_URL = new URL(
  '../assets/items/tier-potion-icons.png',
  import.meta.url
).href

export const TIER_POTION_ICON_FRAMES: Record<
  string,
  {
    imageUrl: string
    imageWidth: number
    imageHeight: number
    frame: { x: number; y: number; width: number; height: number }
  }
> = Object.fromEntries(
  tierPotionIcons.items.map((itemId, index) => [
    itemId,
    {
      imageUrl: TIER_POTION_ICON_ATLAS_URL,
      imageWidth: tierPotionIcons.size * tierPotionIcons.items.length,
      imageHeight: tierPotionIcons.size,
      frame: {
        x: index * tierPotionIcons.size,
        y: 0,
        width: tierPotionIcons.size,
        height: tierPotionIcons.size
      }
    }
  ])
)
