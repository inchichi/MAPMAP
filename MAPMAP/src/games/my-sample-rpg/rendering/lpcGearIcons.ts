import manifest from '../assets/characters/lpc/manifest.json'
import tierGearIcons from '../assets/characters/lpc/tier-gear-icons.json'
import weaponIcons from '../assets/weapons/lpc/weapon-icons.json'

// 방어구·투구·신발 아이콘: 그 장비의 LPC 레이어(정면 정지 프레임)를 잘라 모은 한 장
// (scripts/build-lpc-characters.py 의 gear-icons.png). 입었을 때 모습과 같은 그림이다.
// 아이콘 키는 'lpc-gear:<아이템 id>'.
// 무기 아이콘은 같은 LPC 팔레트·외곽선으로 찍은 한 장(scripts/generate-weapon-icons.py 의
// weapon-icons.png), 키는 'lpc-weapon:<아이템 id>'.
const GEAR_ICON_ATLAS_URL = new URL(
  '../assets/characters/lpc/gear-icons.png',
  import.meta.url
).href
// 등급 방어구(2·3등급)는 1등급 아이콘의 색만 바꾼 따로 한 장(scripts/generate-tier-gear-icons.py), 키는 같은 'lpc-gear:<id>'.
const TIER_GEAR_ICON_ATLAS_URL = new URL(
  '../assets/characters/lpc/tier-gear-icons.png',
  import.meta.url
).href
const WEAPON_ICON_ATLAS_URL = new URL(
  '../assets/weapons/lpc/weapon-icons.png',
  import.meta.url
).href

type IconFrame = {
  imageUrl: string
  imageWidth: number
  imageHeight: number
  frame: { x: number; y: number; width: number; height: number }
}

const atlasFrames = (
  prefix: string,
  imageUrl: string,
  size: number,
  items: readonly string[]
): Array<[string, IconFrame]> =>
  items.map((itemId, index) => [
    `${prefix}:${itemId}`,
    {
      imageUrl,
      imageWidth: size * items.length,
      imageHeight: size,
      frame: { x: index * size, y: 0, width: size, height: size }
    }
  ])

export const LPC_GEAR_ICON_FRAMES: Record<
  `lpc-gear:${string}` | `lpc-weapon:${string}`,
  IconFrame
> = Object.fromEntries([
  ...atlasFrames('lpc-gear', GEAR_ICON_ATLAS_URL, manifest.gearIcons.size, manifest.gearIcons.items),
  ...atlasFrames('lpc-gear', TIER_GEAR_ICON_ATLAS_URL, tierGearIcons.size, tierGearIcons.items),
  ...atlasFrames('lpc-weapon', WEAPON_ICON_ATLAS_URL, weaponIcons.size, weaponIcons.items)
])
