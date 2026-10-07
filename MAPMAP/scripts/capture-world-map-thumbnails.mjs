// 세계 지도(M) 지역 카드 그림을 다시 만든다: 게임을 테스트 모드로 열어 각 지역으로 옮긴 뒤,
// 가장 큰 미니맵 캔버스(지형만 — 캐릭터·내 위치 점은 캔버스 밖)를 PNG 로 저장한다.
// 맵을 고쳤을 때만 다시 돌린다. 결과: src/games/my-sample-rpg/assets/world-map/<sceneId>.png
//
//   npm run dev  (다른 터미널)
//   PLAYWRIGHT_MODULE=<playwright 패키지 경로> node scripts/capture-world-map-thumbnails.mjs [게임 주소]
//   (playwright 가 node_modules 에 있으면 PLAYWRIGHT_MODULE 은 없어도 된다)
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = join(root, 'src/games/my-sample-rpg/assets/world-map')
const gameUrl = process.argv[2] ?? 'http://localhost:5173/'
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(join(process.env.PLAYWRIGHT_MODULE, 'index.mjs')).href
    : 'playwright'
)

// worldMap.ts 의 WORLD_MAP_REGIONS 와 같은 목록(시험장 제외)
const sceneIds = [
  'town', 'hunting-ground', 'cave', 'crystal-mine', 'harvest-village',
  'upstream-waterway', 'reed-village', 'reed-well', 'sunken-forest', 'ruins-outskirts',
  'sunken-temple-1f', 'sunken-temple-2f', 'north-pass', 'frost-village', 'frozen-lake',
  'ice-cave-1f', 'ice-cave-2f'
]

mkdirSync(outputDirectory, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
// 미니맵을 가장 큰 단계로
await page.addInitScript(() => window.localStorage.setItem('my-sample-rpg:minimap-size', '3'))
await page.goto(new URL('?tester', gameUrl).href, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(8000)

for (const sceneId of sceneIds) {
  await page.evaluate((id) => window.postMessage({ type: 'editor:switch-scene', sceneId: id }, '*'), sceneId)
  await page.waitForTimeout(3500)
  const dataUrl = await page.evaluate(() =>
    document.querySelector('.world-map-overlay__canvas')?.toDataURL('image/png')
  )

  if (!dataUrl) {
    throw new Error(`No minimap canvas for ${sceneId}`)
  }

  writeFileSync(join(outputDirectory, `${sceneId}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'))
  console.log('saved', sceneId)
}

await browser.close()
