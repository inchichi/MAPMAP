import { Rectangle, Texture } from 'pixi.js'
import { loadTextureSafe } from '../loadTextureSafe'
import type { ParsedTiledTileset } from '../../tiled/parseTiledMap'
import { createTileTexture, type TilesetRenderResources } from '../tiledMapRenderResources'
import { PROTECT_VFX_FRAME_COLUMNS, PROTECT_VFX_FRAME_HEIGHT, PROTECT_VFX_FRAME_IMAGE_URL, PROTECT_VFX_FRAME_ROWS, PROTECT_VFX_FRAME_WIDTH, WHITE_SLASH_WIDE_FRAME_URLS } from './constants'
import { type ProtectVfxRenderResources, type SlashVfxRenderResources } from './types'

export let messageFontsReadyPromise: Promise<void> | undefined

export const createMessagePanelTexture = (): Texture => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Could not create canvas context for message panel')
  }

  canvas.width = 32
  canvas.height = 32
  context.imageSmoothingEnabled = false
  context.clearRect(0, 0, canvas.width, canvas.height)

  context.fillStyle = '#c9a271'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#fffaf0'
  context.fillRect(1, 1, canvas.width - 2, canvas.height - 2)
  context.fillStyle = '#f4e5c8'
  context.fillRect(1, 1, canvas.width - 2, 1)
  context.fillRect(1, 1, 1, canvas.height - 2)
  context.fillStyle = '#a98256'
  context.fillRect(1, canvas.height - 2, canvas.width - 2, 1)
  context.fillRect(canvas.width - 2, 1, 1, canvas.height - 2)
  context.fillStyle = '#fffdf8'
  context.fillRect(2, 2, canvas.width - 4, canvas.height - 4)
  context.fillStyle = '#ecd8b8'
  context.fillRect(2, 2, canvas.width - 4, 1)
  context.fillRect(2, 2, 1, canvas.height - 4)
  context.fillStyle = '#d9c29a'
  context.fillRect(2, canvas.height - 3, canvas.width - 4, 1)
  context.fillRect(canvas.width - 3, 2, 1, canvas.height - 4)

  const texture = Texture.from(canvas)

  texture.source.scaleMode = 'nearest'
  texture.source.addressMode = 'clamp-to-edge'

  return texture
}

export const createFrameTexturesFromGrid = ({
  imageTexture,
  frameWidth,
  frameHeight,
  columns,
  rows
}: {
  imageTexture: Texture
  frameWidth: number
  frameHeight: number
  columns: number
  rows: number
}): Texture[] => {
  // 시트가 기대보다 작으면(예: 다운로드 안 된 LFS 플레이스홀더) 던져서 렌더러를 죽이지 않고,
  // 같은 프레임 수만큼 원본(플레이스홀더) 텍스처를 그대로 반환해 효과만 비어 보이게 한다.
  if (
    imageTexture.source.pixelWidth < frameWidth * columns ||
    imageTexture.source.pixelHeight < frameHeight * rows
  ) {
    return Array.from({ length: columns * rows }, () => imageTexture)
  }

  return Array.from({ length: columns * rows }, (_, index) => {
    const columnIndex = index % columns
    const rowIndex = Math.floor(index / columns)

    return new Texture({
      source: imageTexture.source,
      frame: new Rectangle(
        columnIndex * frameWidth,
        rowIndex * frameHeight,
        frameWidth,
        frameHeight
      ),
      orig: new Rectangle(0, 0, frameWidth, frameHeight)
    })
  })
}

export const loadSlashVfxTextures = async (): Promise<SlashVfxRenderResources> => {
  const textures = await Promise.all(
    WHITE_SLASH_WIDE_FRAME_URLS.map((frameUrl) =>
      loadTextureSafe(frameUrl)
    )
  )

  textures.forEach((texture) => {
    texture.source.scaleMode = 'nearest'
  })

  return {
    horizontalTextures: textures,
    verticalTextures: textures
  }
}

export const loadProtectVfxTextures = async (): Promise<ProtectVfxRenderResources> => {
  const imageTexture = await loadTextureSafe(PROTECT_VFX_FRAME_IMAGE_URL)

  imageTexture.source.scaleMode = 'nearest'
  imageTexture.source.addressMode = 'clamp-to-edge'

  return {
    shieldTextures: createFrameTexturesFromGrid({
      imageTexture,
      frameWidth: PROTECT_VFX_FRAME_WIDTH,
      frameHeight: PROTECT_VFX_FRAME_HEIGHT,
      columns: PROTECT_VFX_FRAME_COLUMNS,
      rows: PROTECT_VFX_FRAME_ROWS
    })
  }
}

export const ensureMessageFontsLoaded = async (): Promise<void> => {
  if (messageFontsReadyPromise) {
    return messageFontsReadyPromise
  }

  if (!document.fonts) {
    return
  }

  // 폰트는 장식용이라 로드 실패(예: @font-face url 404)가 렌더러 전체를 죽이면 안 된다.
  // 실패하면 기본 폰트로 조용히 폴백한다.
  messageFontsReadyPromise = Promise.all([
    document.fonts.load('400 14px "Jersey 25"'),
    document.fonts.load('400 14px "NeoDunggeunmo"')
  ])
    .then(() => undefined)
    .catch(() => undefined)

  return messageFontsReadyPromise
}

export const loadTilesetRenderResources = async (
  tileset: ParsedTiledTileset,
  imageUrls: Record<string, string>,
  scaleMode?: 'nearest' | 'linear'
): Promise<TilesetRenderResources> => {
  const imageUrl = imageUrls[tileset.image.source]

  if (!imageUrl) {
    throw new Error(`Missing image URL for ${tileset.image.source}`)
  }

  const imageTexture = await loadTextureSafe(imageUrl)

  if (scaleMode) {
    imageTexture.source.scaleMode = scaleMode
  }
  imageTexture.source.addressMode = 'clamp-to-edge'
  const tileTextures = Array.from(
    { length: tileset.tileCount },
    (_, localId) => createTileTexture(imageTexture, tileset, localId)
  )

  return {
    imageTexture,
    tileTextures
  }
}
