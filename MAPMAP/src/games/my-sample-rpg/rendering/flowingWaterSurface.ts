import {
  CanvasSource,
  Container,
  type Rectangle,
  Texture,
  TilingSprite
} from 'pixi.js'

// 물 채움 타일(cave_fill_Water_00 = 무늬 없는 바탕, _01~_03 = 물결 무늬, Deep 등 변형 포함).
// 이 타일들은 맵에 굽지 않고, 바탕만 깐 뒤 물 영역 전체에 이어지는 물결 레이어로 흘려 보낸다.
const WATER_FILL_TILE_TYPE_PATTERN = /^cave_fill_(Water(?:_[A-Za-z]+)*)_(\d+)$/

// 폭이 이 값(타일) 이하이고 길이가 폭의 2배 이상이면 "물길"로 보고 방향을 따라 흘린다.
// 그보다 넓은 곳(못, 웅덩이)은 한 방향으로 쏠리지 않고 잔잔하게 일렁이기만 한다.
const WATER_CHANNEL_MAX_WIDTH_TILES = 4
const WATER_CHANNEL_MIN_LENGTH_TILES = 4
// 이어진 물 덩어리에서 넓은(못) 칸이 이 비율 이상이면 덩어리 전체를 고인 물로 본다.
// 못 가장자리의 좁은 귀퉁이만 물길로 흘러 못 안에 곧은 이음매가 생기던 것을 막는다.
const POND_MIN_WIDE_CELL_RATIO = 0.5

// 물결 무늬 텍스처는 타일 4x4칸 크기(32px 타일이면 128px, 2의 거듭제곱)로 만들어
// 반복(repeat) 샘플링 + 배칭이 되게 한다.
const RIPPLE_PATTERN_COLUMNS = 4
const RIPPLE_PATTERN_ROWS = 4
// 바탕색과 이 거리(RGB)보다 멀어야 물결 픽셀로 본다. 스타일 변환 아틀라스처럼 바탕에
// 잡음이 있으면 잡음 크기에 비례해 임계값을 올린다.
const RIPPLE_MIN_COLOR_DISTANCE = 14
const RIPPLE_NOISE_THRESHOLD_SCALE = 1.5

export type WaterFillTileType = {
  family: string
  variant: number
}

export type WaterCell = {
  x: number
  y: number
}

// 타일 단위 흐름 방향. (0, 0)은 고인 물(못)이다.
export type WaterFlowDirection = {
  x: -1 | 0 | 1
  y: -1 | 0 | 1
}

export type WaterCellRect = {
  x: number
  y: number
  width: number
  height: number
}

export type RgbaPixels = {
  width: number
  height: number
  data: Uint8ClampedArray<ArrayBuffer>
}

export type WaterSurfaceMotion = {
  offsetX: number
  offsetY: number
  alpha: number
}

type WaterSurfaceLayerMotionConfig = {
  // 흐르는 물: 흐름 방향 속도(px/s)와 가로지르는 방향의 흔들림.
  flowSpeed: number
  // 고인 물: 느린 표류(px/s)와 원을 그리는 일렁임.
  driftX: number
  driftY: number
  swayAmplitude: number
  swayPeriodSeconds: number
  alphaBase: number
  alphaAmplitude: number
  alphaPeriodSeconds: number
}

type WaterSurfaceMotionProfile = readonly WaterSurfaceLayerMotionConfig[]

// 레이어 0 = 또렷한 주 물결, 레이어 1 = 옅게 겹치는 보조 물결. 두 겹이 서로 다른 속도로
// 미끄러지며 겹쳤다 흩어지기 때문에 물결이 계속 새로 생기고 사라지는 것처럼 보인다.
const FLOWING_WATER_MOTION_PROFILE: WaterSurfaceMotionProfile = [
  {
    flowSpeed: 15,
    driftX: 0,
    driftY: 0,
    swayAmplitude: 1.5,
    swayPeriodSeconds: 3.4,
    alphaBase: 0.9,
    alphaAmplitude: 0.1,
    alphaPeriodSeconds: 2.9
  },
  {
    flowSpeed: 9,
    driftX: 0,
    driftY: 0,
    swayAmplitude: 2.5,
    swayPeriodSeconds: 4.7,
    alphaBase: 0.5,
    alphaAmplitude: 0.2,
    alphaPeriodSeconds: 3.7
  }
]
const STILL_WATER_MOTION_PROFILE: WaterSurfaceMotionProfile = [
  {
    flowSpeed: 0,
    driftX: 0.8,
    driftY: 0.3,
    swayAmplitude: 2.5,
    swayPeriodSeconds: 9,
    alphaBase: 0.85,
    alphaAmplitude: 0.12,
    alphaPeriodSeconds: 4.3
  },
  {
    flowSpeed: 0,
    driftX: -0.6,
    driftY: 0.4,
    swayAmplitude: 2,
    swayPeriodSeconds: 6.5,
    alphaBase: 0.5,
    alphaAmplitude: 0.22,
    alphaPeriodSeconds: 3.1
  }
]
const WATER_SURFACE_LAYER_PATTERNS = [
  { density: 0.5, seed: 0x5eed_0001 },
  { density: 0.38, seed: 0x5eed_0002 }
] as const

export const WATER_SURFACE_LAYER_COUNT = WATER_SURFACE_LAYER_PATTERNS.length

export const parseWaterFillTileType = (
  tileType: string | undefined
): WaterFillTileType | undefined => {
  if (!tileType) {
    return undefined
  }

  const match = WATER_FILL_TILE_TYPE_PATTERN.exec(tileType)

  if (!match) {
    return undefined
  }

  return {
    family: match[1],
    variant: Number(match[2])
  }
}

// 물 칸들의 모양만 보고 칸마다 흐름 방향을 정한다.
// 1) 칸마다 가로/세로로 이어진 물 길이를 재서, 좁고 긴 곳은 세로/가로 물길, 나머지는 못으로 본다.
// 2) 연결된 물 덩어리마다 가장 위(북쪽) 줄을 수원으로 두고 BFS 거리를 잰다(수교에서 내려오는 물).
// 3) 같은 방향의 물길 조각마다, 수원에서 멀어지는 쪽을 투표해 하류 방향으로 삼는다.
//    거리 차이가 없으면(예: 한 줄짜리 웅덩이) 방향을 알 수 없으므로 고인 물로 둔다.
export const classifyWaterFlowDirections = (
  cells: readonly WaterCell[]
): WaterFlowDirection[] => {
  if (cells.length === 0) {
    return []
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const cell of cells) {
    minX = Math.min(minX, cell.x)
    minY = Math.min(minY, cell.y)
    maxX = Math.max(maxX, cell.x)
    maxY = Math.max(maxY, cell.y)
  }

  const gridWidth = maxX - minX + 1
  const gridHeight = maxY - minY + 1
  const grid = new Int32Array(gridWidth * gridHeight).fill(-1)
  const indexAt = (x: number, y: number): number =>
    x < minX || x > maxX || y < minY || y > maxY
      ? -1
      : grid[(y - minY) * gridWidth + (x - minX)]

  cells.forEach((cell, index) => {
    grid[(cell.y - minY) * gridWidth + (cell.x - minX)] = index
  })

  const horizontalRuns = new Int32Array(cells.length)
  const verticalRuns = new Int32Array(cells.length)

  for (let y = minY; y <= maxY; y += 1) {
    let runStart = minX

    for (let x = minX; x <= maxX + 1; x += 1) {
      if (x <= maxX && indexAt(x, y) >= 0) {
        continue
      }

      for (let runX = runStart; runX < x; runX += 1) {
        horizontalRuns[indexAt(runX, y)] = x - runStart
      }
      runStart = x + 1
    }
  }

  for (let x = minX; x <= maxX; x += 1) {
    let runStart = minY

    for (let y = minY; y <= maxY + 1; y += 1) {
      if (y <= maxY && indexAt(x, y) >= 0) {
        continue
      }

      for (let runY = runStart; runY < y; runY += 1) {
        verticalRuns[indexAt(x, runY)] = y - runStart
      }
      runStart = y + 1
    }
  }

  const neighborOffsets = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ] as const
  const componentIds = new Int32Array(cells.length).fill(-1)
  const componentTopRows: number[] = []

  cells.forEach((startCell, startIndex) => {
    if (componentIds[startIndex] >= 0) {
      return
    }

    const componentId = componentTopRows.length
    const queue = [startIndex]
    let topRow = startCell.y

    componentIds[startIndex] = componentId
    for (let head = 0; head < queue.length; head += 1) {
      const cell = cells[queue[head]]

      topRow = Math.min(topRow, cell.y)
      for (const [offsetX, offsetY] of neighborOffsets) {
        const neighborIndex = indexAt(cell.x + offsetX, cell.y + offsetY)

        if (neighborIndex >= 0 && componentIds[neighborIndex] < 0) {
          componentIds[neighborIndex] = componentId
          queue.push(neighborIndex)
        }
      }
    }
    componentTopRows.push(topRow)
  })

  const distances = new Int32Array(cells.length).fill(-1)
  const distanceQueue: number[] = []

  cells.forEach((cell, index) => {
    if (cell.y === componentTopRows[componentIds[index]]) {
      distances[index] = 0
      distanceQueue.push(index)
    }
  })
  for (let head = 0; head < distanceQueue.length; head += 1) {
    const index = distanceQueue[head]
    const cell = cells[index]

    for (const [offsetX, offsetY] of neighborOffsets) {
      const neighborIndex = indexAt(cell.x + offsetX, cell.y + offsetY)

      if (neighborIndex >= 0 && distances[neighborIndex] < 0) {
        distances[neighborIndex] = distances[index] + 1
        distanceQueue.push(neighborIndex)
      }
    }
  }

  // 0 = 고인 물, 1 = 세로 물길, 2 = 가로 물길
  const orientations = new Uint8Array(cells.length)

  cells.forEach((_, index) => {
    const width = horizontalRuns[index]
    const height = verticalRuns[index]

    if (
      width <= WATER_CHANNEL_MAX_WIDTH_TILES &&
      height >= Math.max(WATER_CHANNEL_MIN_LENGTH_TILES, width * 2)
    ) {
      orientations[index] = 1
    } else if (
      height <= WATER_CHANNEL_MAX_WIDTH_TILES &&
      width >= Math.max(WATER_CHANNEL_MIN_LENGTH_TILES, height * 2)
    ) {
      orientations[index] = 2
    }
  })

  const componentCellCounts = new Int32Array(componentTopRows.length)
  const componentWideCellCounts = new Int32Array(componentTopRows.length)

  cells.forEach((_, index) => {
    componentCellCounts[componentIds[index]] += 1
    if (orientations[index] === 0) {
      componentWideCellCounts[componentIds[index]] += 1
    }
  })
  cells.forEach((_, index) => {
    const componentId = componentIds[index]

    if (componentWideCellCounts[componentId] >= componentCellCounts[componentId] * POND_MIN_WIDE_CELL_RATIO) {
      orientations[index] = 0
    }
  })

  const directions: WaterFlowDirection[] = cells.map(() => ({ x: 0, y: 0 }))
  const visited = new Uint8Array(cells.length)

  cells.forEach((_, startIndex) => {
    const orientation = orientations[startIndex]

    if (orientation === 0 || visited[startIndex]) {
      return
    }

    const axisX = orientation === 2 ? 1 : 0
    const axisY = orientation === 1 ? 1 : 0
    const segment = [startIndex]
    let downstreamVote = 0

    visited[startIndex] = 1
    for (let head = 0; head < segment.length; head += 1) {
      const index = segment[head]
      const cell = cells[index]
      const nextIndex = indexAt(cell.x + axisX, cell.y + axisY)
      const previousIndex = indexAt(cell.x - axisX, cell.y - axisY)
      const nextDistance = nextIndex >= 0 ? distances[nextIndex] : distances[index]
      const previousDistance =
        previousIndex >= 0 ? distances[previousIndex] : distances[index]

      downstreamVote += Math.sign(nextDistance - previousDistance)
      for (const [offsetX, offsetY] of neighborOffsets) {
        const neighborIndex = indexAt(cell.x + offsetX, cell.y + offsetY)

        if (
          neighborIndex >= 0 &&
          !visited[neighborIndex] &&
          orientations[neighborIndex] === orientation
        ) {
          visited[neighborIndex] = 1
          segment.push(neighborIndex)
        }
      }
    }

    const sign = Math.sign(downstreamVote) as -1 | 0 | 1

    if (sign === 0) {
      return
    }

    for (const index of segment) {
      directions[index] = {
        x: (axisX * sign) as -1 | 0 | 1,
        y: (axisY * sign) as -1 | 0 | 1
      }
    }
  })

  return directions
}

// 같은 흐름 구역의 칸들을 큰 직사각형 몇 개로 묶는다(가로 구간을 만든 뒤 아래로 이어 붙임).
// 직사각형마다 TilingSprite 하나를 쓰면 마스크 없이도 물 칸만 정확히 덮는다.
export const mergeWaterCellsIntoRects = (
  cells: readonly WaterCell[]
): WaterCellRect[] => {
  const columnsByRow = new Map<number, number[]>()

  for (const cell of cells) {
    const columns = columnsByRow.get(cell.y)

    if (columns) {
      columns.push(cell.x)
    } else {
      columnsByRow.set(cell.y, [cell.x])
    }
  }

  const rects: WaterCellRect[] = []
  let openRects = new Map<string, WaterCellRect>()
  const rows = [...columnsByRow.keys()].sort((left, right) => left - right)

  for (const y of rows) {
    const columns = [...new Set(columnsByRow.get(y))].sort(
      (left, right) => left - right
    )
    const nextOpenRects = new Map<string, WaterCellRect>()
    let runStart = 0

    for (let index = 1; index <= columns.length; index += 1) {
      if (index < columns.length && columns[index] === columns[index - 1] + 1) {
        continue
      }

      const x = columns[runStart]
      const width = columns[index - 1] - x + 1
      const key = `${x}:${width}`
      const openRect = openRects.get(key)

      if (openRect && openRect.y + openRect.height === y) {
        openRect.height += 1
        nextOpenRects.set(key, openRect)
      } else {
        const rect = { x, y, width, height: 1 }

        rects.push(rect)
        nextOpenRects.set(key, rect)
      }
      runStart = index
    }
    openRects = nextOpenRects
  }

  return rects
}

const getColorDistance = (
  data: Uint8ClampedArray,
  offset: number,
  red: number,
  green: number,
  blue: number
): number =>
  Math.hypot(data[offset] - red, data[offset + 1] - green, data[offset + 2] - blue)

// 물결 타일에서 바탕(_00)과 확연히 다른 픽셀만 남기고 나머지는 투명하게 만든다.
export const extractRipplePixels = (
  plain: RgbaPixels,
  ripple: RgbaPixels
): RgbaPixels => {
  const output: RgbaPixels = {
    width: ripple.width,
    height: ripple.height,
    data: new Uint8ClampedArray(ripple.width * ripple.height * 4)
  }
  let opaqueCount = 0
  let redSum = 0
  let greenSum = 0
  let blueSum = 0

  for (let offset = 0; offset < plain.data.length; offset += 4) {
    if (plain.data[offset + 3] < 128) {
      continue
    }

    opaqueCount += 1
    redSum += plain.data[offset]
    greenSum += plain.data[offset + 1]
    blueSum += plain.data[offset + 2]
  }

  if (opaqueCount === 0) {
    return output
  }

  const red = redSum / opaqueCount
  const green = greenSum / opaqueCount
  const blue = blueSum / opaqueCount
  const plainDistances: number[] = []

  for (let offset = 0; offset < plain.data.length; offset += 4) {
    if (plain.data[offset + 3] >= 128) {
      plainDistances.push(getColorDistance(plain.data, offset, red, green, blue))
    }
  }
  plainDistances.sort((left, right) => left - right)

  const plainNoise =
    plainDistances[Math.min(plainDistances.length - 1, Math.floor(plainDistances.length * 0.95))]
  const threshold = Math.max(
    RIPPLE_MIN_COLOR_DISTANCE,
    plainNoise * RIPPLE_NOISE_THRESHOLD_SCALE
  )

  for (let offset = 0; offset < ripple.data.length; offset += 4) {
    if (
      ripple.data[offset + 3] >= 128 &&
      getColorDistance(ripple.data, offset, red, green, blue) > threshold
    ) {
      output.data[offset] = ripple.data[offset]
      output.data[offset + 1] = ripple.data[offset + 1]
      output.data[offset + 2] = ripple.data[offset + 2]
      output.data[offset + 3] = 255
    }
  }

  return output
}

export const countOpaquePixels = (pixels: RgbaPixels): number => {
  let count = 0

  for (let offset = 3; offset < pixels.data.length; offset += 4) {
    if (pixels.data[offset] > 0) {
      count += 1
    }
  }

  return count
}

const createSeededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state

    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

// 물결 조각들을 columns x rows 칸 캔버스에 흩어 찍는다. 좌표를 캔버스 크기로 감아(wrap)
// 찍기 때문에 결과 텍스처는 가장자리까지 이음새 없이 반복된다.
export const composeRipplePattern = ({
  ripples,
  columns = RIPPLE_PATTERN_COLUMNS,
  rows = RIPPLE_PATTERN_ROWS,
  density,
  seed
}: {
  ripples: readonly RgbaPixels[]
  columns?: number
  rows?: number
  density: number
  seed: number
}): RgbaPixels => {
  const tileWidth = ripples[0]?.width ?? 0
  const tileHeight = ripples[0]?.height ?? 0
  const width = tileWidth * columns
  const height = tileHeight * rows
  const output: RgbaPixels = {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4)
  }

  if (ripples.length === 0 || width === 0 || height === 0) {
    return output
  }

  const random = createSeededRandom(seed)
  const stamp = (column: number, row: number): void => {
    const ripple = ripples[Math.floor(random() * ripples.length)]
    const flipHorizontally = random() < 0.5
    const jitterX = Math.round((random() - 0.5) * (tileWidth / 2))
    const jitterY = Math.round((random() - 0.5) * (tileHeight / 2))

    for (let y = 0; y < tileHeight; y += 1) {
      for (let x = 0; x < tileWidth; x += 1) {
        const sourceOffset = (y * tileWidth + x) * 4

        if (ripple.data[sourceOffset + 3] === 0) {
          continue
        }

        const targetX =
          (((column * tileWidth + (flipHorizontally ? tileWidth - 1 - x : x) + jitterX) %
            width) +
            width) %
          width
        const targetY =
          (((row * tileHeight + y + jitterY) % height) + height) % height
        const targetOffset = (targetY * width + targetX) * 4

        if (output.data[targetOffset + 3] !== 0) {
          continue
        }

        output.data[targetOffset] = ripple.data[sourceOffset]
        output.data[targetOffset + 1] = ripple.data[sourceOffset + 1]
        output.data[targetOffset + 2] = ripple.data[sourceOffset + 2]
        output.data[targetOffset + 3] = 255
      }
    }
  }
  let stampCount = 0

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (random() < density) {
        stamp(column, row)
        stampCount += 1
      }
    }
  }

  if (stampCount === 0) {
    stamp(0, 0)
  }

  return output
}

const TWO_PI = Math.PI * 2

// 시간 t(초)에서 물결 레이어가 얼마나 밀려 있는지(정수 px)와 투명도를 out 에 쓴다.
// 매 프레임 호출되므로 새 객체를 만들지 않는다. 픽셀아트가 번지지 않도록 오프셋은 정수로 맞춘다.
export const sampleWaterSurfaceMotion = (
  flow: WaterFlowDirection,
  layerIndex: number,
  timeSeconds: number,
  phase: number,
  out: WaterSurfaceMotion
): WaterSurfaceMotion => {
  const isFlowing = flow.x !== 0 || flow.y !== 0
  const profile = isFlowing ? FLOWING_WATER_MOTION_PROFILE : STILL_WATER_MOTION_PROFILE
  const config = profile[Math.min(layerIndex, profile.length - 1)]
  const swayAngle = (timeSeconds / config.swayPeriodSeconds) * TWO_PI + phase
  let offsetX: number
  let offsetY: number

  if (isFlowing) {
    // 흐름 방향으로 곧게 밀되, 가로지르는 방향으로 살짝 흔들어 물살이 굽이치게 한다.
    const along = config.flowSpeed * timeSeconds
    const across = config.swayAmplitude * Math.sin(swayAngle)

    offsetX = flow.x * along - flow.y * across
    offsetY = flow.y * along + flow.x * across
  } else {
    // 고인 물은 아주 느리게 표류하면서 작은 원을 그리며 일렁인다.
    offsetX = config.driftX * timeSeconds + config.swayAmplitude * Math.cos(swayAngle)
    offsetY = config.driftY * timeSeconds + config.swayAmplitude * Math.sin(swayAngle)
  }

  out.offsetX = Math.round(offsetX)
  out.offsetY = Math.round(offsetY)
  out.alpha =
    config.alphaBase +
    config.alphaAmplitude *
      Math.sin((timeSeconds / config.alphaPeriodSeconds) * TWO_PI + phase * 1.7)

  return out
}

const readTexturePixels = (
  imageTexture: Texture,
  frames: readonly Rectangle[]
): RgbaPixels[] | undefined => {
  const resource = imageTexture.source.resource as CanvasImageSource | undefined

  if (!resource || frames.length === 0 || typeof document === 'undefined') {
    return undefined
  }

  const tileWidth = frames[0].width
  const tileHeight = frames[0].height
  const canvas = document.createElement('canvas')

  canvas.width = tileWidth
  canvas.height = tileHeight * frames.length

  const context = canvas.getContext('2d', { willReadFrequently: true })

  if (!context) {
    return undefined
  }

  try {
    frames.forEach((frame, index) => {
      context.drawImage(
        resource,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        0,
        index * tileHeight,
        tileWidth,
        tileHeight
      )
    })

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)

    return frames.map((_, index) => ({
      width: tileWidth,
      height: tileHeight,
      data: imageData.data.slice(
        index * tileWidth * tileHeight * 4,
        (index + 1) * tileWidth * tileHeight * 4
      )
    }))
  } catch {
    // 교차 출처 이미지 등으로 픽셀을 읽을 수 없으면 정적인 물 타일로 둔다.
    return undefined
  }
}

const createPatternTexture = (pixels: RgbaPixels, label: string): Texture => {
  const canvas = document.createElement('canvas')

  canvas.width = pixels.width
  canvas.height = pixels.height
  canvas
    .getContext('2d')
    ?.putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0)

  return new Texture({
    source: new CanvasSource({
      resource: canvas,
      scaleMode: 'nearest',
      addressMode: 'repeat',
      label
    }),
    label
  })
}

// 타일셋의 바탕(_00)과 물결(_01~) 타일에서 물결 픽셀을 뽑아, 겹쳐 흘릴 반복 텍스처들을 만든다.
// 물결 픽셀을 얻지 못하면 undefined 를 돌려주고, 호출한 쪽은 원래 타일을 그대로 굽는다.
export const createWaterRipplePatternTextures = (
  imageTexture: Texture,
  plainFrame: Rectangle,
  rippleFrames: readonly Rectangle[],
  label: string
): Texture[] | undefined => {
  const pixels = readTexturePixels(imageTexture, [plainFrame, ...rippleFrames])

  if (!pixels) {
    return undefined
  }

  const [plainPixels, ...ripplePixels] = pixels
  const ripples = ripplePixels
    .map((ripple) => extractRipplePixels(plainPixels, ripple))
    .filter((ripple) => countOpaquePixels(ripple) > 0)

  if (ripples.length === 0) {
    return undefined
  }

  return WATER_SURFACE_LAYER_PATTERNS.map(({ density, seed }, layerIndex) =>
    createPatternTexture(
      composeRipplePattern({ ripples, density, seed }),
      `${label}:ripple-${layerIndex}`
    )
  )
}

export type FlowingWaterSurfaceCell = WaterCell & {
  // 같은 물 종류(예: 타일셋 + Water/Water_Deep)를 가리키는 키. rippleTexturesByKey 의 키와 같다.
  patternKey: string
}

export type FlowingWaterSurface = {
  container: Container
  update: (timeSeconds: number) => void
  destroy: () => void
}

type FlowingWaterSurfaceLayer = {
  container: Container
  sprites: TilingSprite[]
  flow: WaterFlowDirection
  layerIndex: number
  phase: number
  patternWidth: number
  patternHeight: number
}

const wrapOffset = (value: number, size: number): number =>
  ((value % size) + size) % size

// 한 맵 레이어의 물 칸 전체를 덮는 물결 레이어를 만든다. 흐름 구역(물길 방향/못)과 물 종류별로
// 칸을 직사각형으로 묶고, 직사각형마다 월드 좌표에 맞춘 TilingSprite 를 둬서 무늬가 타일
// 경계와 상관없이 이어진다. 같은 텍스처를 쓰는 스프라이트들은 한 번에 배칭된다.
export const createFlowingWaterSurface = ({
  cells,
  rippleTexturesByKey,
  tileWidth,
  tileHeight,
  label
}: {
  cells: readonly FlowingWaterSurfaceCell[]
  rippleTexturesByKey: ReadonlyMap<string, readonly Texture[]>
  tileWidth: number
  tileHeight: number
  label: string
}): FlowingWaterSurface => {
  const container = new Container()
  const directions = classifyWaterFlowDirections(cells)
  const zones = new Map<
    string,
    { patternKey: string; flow: WaterFlowDirection; cells: WaterCell[] }
  >()
  const surfaceLayers: FlowingWaterSurfaceLayer[] = []
  const motion: WaterSurfaceMotion = { offsetX: 0, offsetY: 0, alpha: 1 }

  container.label = label
  cells.forEach((cell, index) => {
    const flow = directions[index]
    const zoneKey = `${cell.patternKey}|${flow.x},${flow.y}`
    const zone = zones.get(zoneKey)

    if (zone) {
      zone.cells.push(cell)
    } else {
      zones.set(zoneKey, { patternKey: cell.patternKey, flow, cells: [cell] })
    }
  })

  let zoneIndex = 0

  for (const zone of zones.values()) {
    const textures = rippleTexturesByKey.get(zone.patternKey)

    if (!textures) {
      continue
    }

    const rects = mergeWaterCellsIntoRects(zone.cells)

    textures.forEach((texture, layerIndex) => {
      const layerContainer = new Container()
      const sprites = rects.map((rect) => {
        const sprite = new TilingSprite({
          texture,
          width: rect.width * tileWidth,
          height: rect.height * tileHeight
        })

        sprite.position.set(rect.x * tileWidth, rect.y * tileHeight)
        layerContainer.addChild(sprite)

        return sprite
      })

      layerContainer.label = `${label}:${zone.flow.x},${zone.flow.y}:${layerIndex}`
      container.addChild(layerContainer)
      surfaceLayers.push({
        container: layerContainer,
        sprites,
        flow: zone.flow,
        layerIndex,
        // 물길은 구역마다 위상을 달리해 똑같이 숨 쉬지 않게 하고, 고인 물은 얕은 곳·깊은 곳이 같은
        // 위상으로 움직여 경계에서 물결이 끊기지 않게 한다.
        phase: (zone.flow.x !== 0 || zone.flow.y !== 0 ? zoneIndex * 2.39 : 0) + layerIndex * 1.13,
        patternWidth: texture.width,
        patternHeight: texture.height
      })
    })
    zoneIndex += 1
  }

  const update = (timeSeconds: number): void => {
    for (const surfaceLayer of surfaceLayers) {
      sampleWaterSurfaceMotion(
        surfaceLayer.flow,
        surfaceLayer.layerIndex,
        timeSeconds,
        surfaceLayer.phase,
        motion
      )
      surfaceLayer.container.alpha = motion.alpha
      for (const sprite of surfaceLayer.sprites) {
        // 스프라이트 위치를 빼서 무늬를 월드 좌표에 고정한다(직사각형끼리 무늬가 이어짐).
        sprite.tilePosition.set(
          wrapOffset(motion.offsetX - sprite.x, surfaceLayer.patternWidth),
          wrapOffset(motion.offsetY - sprite.y, surfaceLayer.patternHeight)
        )
      }
    }
  }

  update(0)

  return {
    container,
    update,
    destroy: () => {
      surfaceLayers.length = 0
      container.destroy({ children: true })
    }
  }
}
