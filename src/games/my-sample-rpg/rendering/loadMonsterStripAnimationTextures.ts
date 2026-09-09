import type { MonsterAnimationTextures } from './monsterAnimationTextures'
import {
  createFrameTexturesFromRects,
  loadImage,
  type FrameRect
} from './loadMonsterSheetTextures'

// Pixel Adventure 2 계열 가로 스트립 시트(프레임이 고정 폭으로 옆으로 나열)용
// 로더. pig/slime의 대형 모션 시트와 달리 프레임 경계가 규칙적이라 밴드 검출이
// 필요 없다. 스프라이트는 왼쪽을 보고 있어 오른쪽은 미러로 만든다.
// 전용 공격 모션이 없는 몹이라 돌진(run) 프레임을 공격 모션으로 재사용한다.

const hasVisiblePixel = (
  _red: number,
  _green: number,
  _blue: number,
  alpha: number
): boolean => alpha > 0

const stripFrames = (
  imageWidth: number,
  frameWidth: number,
  frameHeight: number
): FrameRect[] => {
  const frames: FrameRect[] = []

  for (let left = 0; left + frameWidth <= imageWidth; left += frameWidth) {
    frames.push({ left, top: 0, width: frameWidth, height: frameHeight })
  }

  return frames
}

const readImageData = async (url: string): Promise<ImageData> => {
  const image = await loadImage(url)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error(`Could not create canvas context for ${url}`)
  }

  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  context.drawImage(image, 0, 0)

  return context.getImageData(0, 0, canvas.width, canvas.height)
}

export const loadMonsterStripAnimationTextures = async ({
  idleUrl,
  runUrl,
  hitUrl,
  frameWidth,
  frameHeight
}: {
  idleUrl: string
  runUrl: string
  hitUrl: string
  frameWidth: number
  frameHeight: number
}): Promise<MonsterAnimationTextures> => {
  const [idleData, runData, hitData] = await Promise.all([
    readImageData(idleUrl),
    readImageData(runUrl),
    readImageData(hitUrl)
  ])

  const fromStrip = (data: ImageData, mirrorX: boolean) =>
    createFrameTexturesFromRects({
      sourceImageData: data,
      frames: stripFrames(data.width, frameWidth, frameHeight),
      mirrorX,
      pixelPredicate: hasVisiblePixel
    })

  const runLeft = fromStrip(runData, false)
  const runRight = fromStrip(runData, true)

  return {
    idleLeft: fromStrip(idleData, false),
    idleRight: fromStrip(idleData, true),
    runLeft,
    runRight,
    hitLeft: fromStrip(hitData, false),
    hitRight: fromStrip(hitData, true),
    attackLeft: runLeft,
    attackRight: runRight
  }
}
