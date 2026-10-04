import { Texture } from 'pixi.js'

import type { MonsterAnimationTextures } from './monsterAnimationTextures'
import { loadTextureSafe } from './loadTextureSafe'

// LPC 몬스터 시트(assets/monsters/lpc, 출처는 같은 폴더 CREDITS.txt)를 게임의 몬스터 애니메이션
// 형식(왼쪽/오른쪽 × 대기·이동·피격·공격)으로 자른다.
//
// 시트마다 칸 크기·행 순서가 달라서 동작별로 (시트, 칸 크기, 행, 프레임 목록)을 적는다. 모든
// 프레임을 "발끝(칸 아래) 기준으로 맞춘 하나의 공통 상자"로 자르기 때문에, 동작이 바뀌어도
// 몬스터가 들썩이지 않고 스프라이트 왼쪽 위가 늘 같은 자리다.

export type LpcMonsterStrip = {
  url: string
  cellWidth: number
  cellHeight: number
  row: number
  frames: readonly number[]
  // 오른쪽 그림이 없는 시트는 왼쪽 그림을 좌우 반전해 쓴다
  mirror?: boolean
}

export type LpcMonsterSpec = Record<keyof MonsterAnimationTextures, LpcMonsterStrip>

const readImageData = async (url: string): Promise<ImageData> => {
  const texture = await loadTextureSafe(url)
  const source = texture.source.resource as CanvasImageSource
  const canvas = document.createElement('canvas')
  canvas.width = texture.source.pixelWidth
  canvas.height = texture.source.pixelHeight
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error(`Could not create canvas context for ${url}`)
  }
  context.drawImage(source, 0, 0)
  return context.getImageData(0, 0, canvas.width, canvas.height)
}

// 칸 안의 보이는 픽셀 범위(칸 아래 기준 높이로)
const measureCell = (
  data: ImageData,
  strip: LpcMonsterStrip,
  frame: number
): { left: number; right: number; heightFromBottom: number } | undefined => {
  const originX = frame * strip.cellWidth
  const originY = strip.row * strip.cellHeight
  let left = Infinity
  let right = -Infinity
  let top = Infinity
  for (let y = 0; y < strip.cellHeight; y += 1) {
    for (let x = 0; x < strip.cellWidth; x += 1) {
      const alpha = data.data[((originY + y) * data.width + originX + x) * 4 + 3]
      if (alpha > 0) {
        left = Math.min(left, x)
        right = Math.max(right, x)
        top = Math.min(top, y)
      }
    }
  }
  return Number.isFinite(left)
    ? { left, right, heightFromBottom: strip.cellHeight - top }
    : undefined
}

export const loadLpcMonsterTextures = async (
  spec: LpcMonsterSpec
): Promise<MonsterAnimationTextures> => {
  const strips = Object.values(spec)
  const urls = [...new Set(strips.map((strip) => strip.url))]
  const imageDataByUrl = new Map(
    await Promise.all(urls.map(async (url) => [url, await readImageData(url)] as const))
  )
  const textureByUrl = new Map(
    await Promise.all(urls.map(async (url) => [url, await loadTextureSafe(url)] as const))
  )

  // 공통 상자: 가로는 칸 가운데 기준 최대 폭, 세로는 발끝에서 가장 높은 곳까지
  let halfWidth = 0
  let height = 0
  for (const strip of strips) {
    const data = imageDataByUrl.get(strip.url)!
    for (const frame of strip.frames) {
      const bounds = measureCell(data, strip, frame)
      if (!bounds) {
        continue
      }
      const center = strip.cellWidth / 2
      halfWidth = Math.max(halfWidth, center - bounds.left, bounds.right + 1 - center)
      height = Math.max(height, bounds.heightFromBottom)
    }
  }
  halfWidth = Math.ceil(halfWidth)

  // 각 프레임을 공통 상자 크기의 캔버스에 발끝 맞춰 옮겨 그린다(반전도 여기서).
  const cut = (strip: LpcMonsterStrip): Texture[] => {
    const image = textureByUrl.get(strip.url)!.source.resource as CanvasImageSource
    return strip.frames.map((frame) => {
      const canvas = document.createElement('canvas')
      canvas.width = halfWidth * 2
      canvas.height = height
      const context = canvas.getContext('2d')!
      context.imageSmoothingEnabled = false
      if (strip.mirror) {
        context.translate(canvas.width, 0)
        context.scale(-1, 1)
      }
      context.drawImage(
        image,
        frame * strip.cellWidth + strip.cellWidth / 2 - halfWidth,
        (strip.row + 1) * strip.cellHeight - height,
        halfWidth * 2,
        height,
        0,
        0,
        halfWidth * 2,
        height
      )
      const texture = Texture.from(canvas)
      texture.source.scaleMode = 'nearest'
      return texture
    })
  }

  return {
    idleLeft: cut(spec.idleLeft),
    idleRight: cut(spec.idleRight),
    runLeft: cut(spec.runLeft),
    runRight: cut(spec.runRight),
    hitLeft: cut(spec.hitLeft),
    hitRight: cut(spec.hitRight),
    attackLeft: cut(spec.attackLeft),
    attackRight: cut(spec.attackRight)
  }
}
