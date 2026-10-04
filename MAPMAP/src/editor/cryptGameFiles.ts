import tileset from '../games/crypt-crawler/assets/tilesets/ninja-dungeon-16.tsx?raw'
import atlas from '../games/crypt-crawler/assets/tilesets/ninja-dungeon-16.png'
import type { GameFile } from './loadGame'

export const CRYPT_MAP_NAMES: Record<string, string> = {
  'floor-0-town': '마을', 'floor-1-ruins': '1층 폐허 마을',
  'floor-2-mushroom': '2층 버섯굴', 'floor-3-water': '3층 물웅덩이',
  'floor-4-lava': '4층 용암굴', 'floor-5-deep': '5층 구덩이의 눈'
}

export const loadCryptGameFiles = async (): Promise<GameFile[]> => [
  ...await Promise.all(Object.keys(CRYPT_MAP_NAMES).map(async name => {
    const response = await fetch(`/crypt-maps/${name}.tmx`)
    if (!response.ok) throw new Error(`맵 읽기 실패: ${name}`)
    return { name: `${name}.tmx`, path: `public/crypt-maps/${name}.tmx`, text: await response.text() }
  })),
  { name: 'ninja-dungeon-16.tsx', path: 'src/games/crypt-crawler/assets/tilesets/ninja-dungeon-16.tsx', text: tileset },
  { name: 'ninja-dungeon-16.png', path: 'src/games/crypt-crawler/assets/tilesets/ninja-dungeon-16.png', text: '', url: atlas }
]
