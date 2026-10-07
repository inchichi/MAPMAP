import { Rectangle, Texture } from 'pixi.js'

import manifest from '../assets/characters/lpc/manifest.json'
import { getPlayerEquipmentItemDefinitionById } from '../playerEquipment'
import { loadTextureSafe } from './loadTextureSafe'

// LPC 캐릭터(플레이어 은빛 기사·NPC) 시트 로더와 프레임 선택 규칙.
// 시트는 scripts/build-lpc-characters.py 가 만든다: 4행(위·왼·아래·오른) x N열, 각 칸
// 한가운데에 64px 몸 프레임이 있고 발끝은 몸 프레임의 (32, 62).

export type LpcDirection = 'up' | 'left' | 'down' | 'right'
export type LpcAnimationName = 'walk' | 'slash' | 'chop' | 'halfslash' | 'thrust' | 'shoot' | 'hurt' | 'spellcast'

export type LpcAnimationFrames = {
  cell: number
  // [방향][프레임]
  frames: Record<LpcDirection, Texture[]>
}

export type LpcCharacterSheets = Partial<Record<LpcAnimationName, LpcAnimationFrames>>

const SHEET_URLS = import.meta.glob('../assets/characters/lpc/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>

const ROW_DIRECTIONS: readonly LpcDirection[] = ['up', 'left', 'down', 'right']
export const LPC_BODY_FRAME = manifest.bodyFrame
export const LPC_FOOT_Y = manifest.footY
export const LPC_CENTER_X = manifest.centerX
// 걷기: 0번은 서 있는 자세, 1~8번이 걸음 주기.
export const LPC_WALK_CYCLE_FRAMES = 8
export const LPC_WALK_FRAMES_PER_SECOND = 11

export const sheetUrl = (fileName: string): string => {
  const url = SHEET_URLS[`../assets/characters/lpc/${fileName}`]

  if (!url) {
    throw new Error(`Missing LPC sheet ${fileName}`)
  }

  return url
}

const sliceSheet = (texture: Texture, cell: number, frameCount: number): LpcAnimationFrames => {
  const frames = {} as Record<LpcDirection, Texture[]>

  ROW_DIRECTIONS.forEach((direction, row) => {
    frames[direction] = Array.from(
      { length: frameCount },
      (_, column) =>
        new Texture({
          source: texture.source,
          frame: new Rectangle(column * cell, row * cell, cell, cell)
        })
    )
  })

  return { cell, frames }
}

const loadSheets = async (
  sheetByAnimation: Record<string, string>
): Promise<LpcCharacterSheets> => {
  const sheets: LpcCharacterSheets = {}

  for (const [animation, fileName] of Object.entries(sheetByAnimation)) {
    const spec = manifest.anims[animation as keyof typeof manifest.anims]
    const texture = await loadTextureSafe(sheetUrl(fileName))
    texture.source.scaleMode = 'nearest'
    sheets[animation as LpcAnimationName] = sliceSheet(texture, spec.cell, spec.frames)
  }

  return sheets
}

// ---------------------------------------------------------------- 플레이어(장비 레이어)
// 장비를 바꾸면 겉모습이 바뀐다: 아래 순서로 레이어를 쌓는다. 무기 뒤/앞은 몸을 사이에 둔다.
export type LpcPlayerLayerSlot =
  | 'weaponBack'
  | 'base'
  | 'boots'
  | 'armor'
  | 'hair'
  | 'hat'
  | 'weaponFront'

export const LPC_PLAYER_LAYER_ORDER: readonly LpcPlayerLayerSlot[] = [
  'weaponBack',
  'base',
  'boots',
  'armor',
  'hair',
  'hat',
  'weaponFront'
]

export type LpcPlayerLook = {
  weaponId?: string
  armorId?: string
  hatId?: string
  bootsId?: string
}

type GearEntry = { slot: string; hidesHair: boolean; sheets: Record<string, string> }
type WeaponEntry = {
  attack: string
  back: Record<string, string>
  front: Record<string, string>
}

const PLAYER = manifest.player as unknown as {
  base: Record<string, string>
  hair: Record<string, string>
  gear: Record<string, GearEntry>
  weapons: Record<string, WeaponEntry>
}

// 장비마다 제 몸 그림을 쓴다(등급 장비는 scripts/generate-tier-gear-sheets.py 가 1등급 그림의 색을 바꿔 만든다).
// 제 그림이 없는 장비만 정의의 appearanceId(기존 장비) 그림을 빌린다.
const toAppearanceId = (itemId: string): string =>
  PLAYER.gear[itemId] || PLAYER.weapons[itemId]
    ? itemId
    : getPlayerEquipmentItemDefinitionById(itemId)?.appearanceId ?? itemId

// 동작 한 번의 프레임 수(manifest 의 LPC 시트 규격).
export const getLpcAnimationFrameCount = (animation: LpcAnimationName): number =>
  manifest.anims[animation].frames

// 무기의 공격 동작(검 = 반베기, 도끼 = 내려찍기, 지팡이 = 찌르기, 활 = 쏘기). 맨손은 베기.
export const getLpcPlayerAttackAnimation = (weaponId: string | undefined): LpcAnimationName =>
  ((weaponId && PLAYER.weapons[toAppearanceId(weaponId)]?.attack) as LpcAnimationName | undefined) ??
  'slash'

// 이 동작에서 각 레이어가 쓸 시트 파일(없으면 그 레이어는 숨긴다).
export const getLpcPlayerLayerFiles = (
  look: LpcPlayerLook,
  animation: LpcAnimationName
): Record<LpcPlayerLayerSlot, string | undefined> => {
  const gear = (id: string | undefined) => (id ? PLAYER.gear[toAppearanceId(id)] : undefined)
  const weapon = look.weaponId ? PLAYER.weapons[toAppearanceId(look.weaponId)] : undefined
  const hat = gear(look.hatId)

  return {
    weaponBack: weapon?.back[animation],
    base: PLAYER.base[animation],
    boots: gear(look.bootsId)?.sheets[animation],
    armor: gear(look.armorId)?.sheets[animation],
    hair: hat?.hidesHair ? undefined : PLAYER.hair[animation],
    hat: hat?.sheets[animation],
    weaponFront: weapon?.front[animation]
  }
}

// 시트 캐시: 처음 요청할 때 불러 오고, 다 불러오기 전에는 undefined 를 돌려준다
// (장비를 바꾸는 순간 쓰는 시트만 그때그때 불러 GPU 메모리를 아낀다).
export const createLpcSheetCache = () => {
  const loaded = new Map<string, LpcAnimationFrames>()
  const pending = new Set<string>()

  const get = (
    fileName: string,
    animation: LpcAnimationName
  ): LpcAnimationFrames | undefined => {
    const cached = loaded.get(fileName)
    if (cached || pending.has(fileName)) {
      return cached
    }
    pending.add(fileName)
    const spec = manifest.anims[animation]
    void loadTextureSafe(sheetUrl(fileName)).then((texture) => {
      texture.source.scaleMode = 'nearest'
      loaded.set(fileName, sliceSheet(texture, spec.cell, spec.frames))
      pending.delete(fileName)
    })
    return undefined
  }

  // 미리 불러 두기(현재 장비의 걷기·공격 동작 등).
  const preload = async (files: ReadonlyArray<[string, LpcAnimationName]>) => {
    await Promise.all(
      files.map(async ([fileName, animation]) => {
        if (loaded.has(fileName)) {
          return
        }
        const spec = manifest.anims[animation]
        const texture = await loadTextureSafe(sheetUrl(fileName))
        texture.source.scaleMode = 'nearest'
        loaded.set(fileName, sliceSheet(texture, spec.cell, spec.frames))
      })
    )
  }

  return { get, preload }
}

// 대화창용 전신 초상화(일러스트가 없는 NPC). 키는 getLpcNpcSheetKey 결과.
export const getLpcNpcFullBodyUrl = (sheetKey: string): string | undefined =>
  SHEET_URLS[`../assets/characters/lpc/npc-full-${sheetKey.replace(':', '-')}.png`]

// 화살 발사체(LPC 화살, 오른쪽을 향한 그림).
export const loadLpcArrowTexture = async (): Promise<Texture> => {
  const texture = await loadTextureSafe(sheetUrl('projectile-arrow.png'))
  texture.source.scaleMode = 'nearest'
  return texture
}

export const hasLpcNpcSheet = (key: string): boolean => key in manifest.npcs

// NPC 의 LPC 시트 키: 초상화가 있는 NPC 는 id 전용 외형('id:<npc id>')이 우선, 없으면 외형 공유.
export const getLpcNpcSheetKey = (npcId: string, appearanceType: string): string | undefined =>
  hasLpcNpcSheet(`id:${npcId}`)
    ? `id:${npcId}`
    : hasLpcNpcSheet(appearanceType)
      ? appearanceType
      : undefined

export const loadLpcNpcSheets = async (
  sheetKeys: readonly string[]
): Promise<Map<string, LpcCharacterSheets>> => {
  const unique = [...new Set(sheetKeys.filter(hasLpcNpcSheet))]
  const loaded = await Promise.all(
    unique.map(
      async (appearanceType) =>
        [
          appearanceType,
          await loadSheets({
            walk: manifest.npcs[appearanceType as keyof typeof manifest.npcs]
          })
        ] as const
    )
  )

  return new Map(loaded)
}

export const getLpcDirectionFromFacing = (facing: string): LpcDirection =>
  facing === 'up' || facing === 'left' || facing === 'right' ? facing : 'down'

// 걷기 프레임: 움직이는 동안 1~8을 돌고, 멈추면 0(서 있기).
export const getLpcWalkFrameIndex = (isMoving: boolean, elapsedMilliseconds: number): number =>
  isMoving
    ? 1 +
      (Math.floor((elapsedMilliseconds / 1000) * LPC_WALK_FRAMES_PER_SECOND) %
        LPC_WALK_CYCLE_FRAMES)
    : 0

// 공격·시전 같은 1회성 동작의 프레임: 진행률(0~1)을 프레임 수에 고르게 나눈다.
export const getLpcActionFrameIndex = (progress: number, frameCount: number): number =>
  Math.min(frameCount - 1, Math.max(0, Math.floor(progress * frameCount)))

// 스프라이트 앵커: 칸 안에서 발끝(몸 프레임 32,62)이 기준점이 되게.
export const getLpcAnchor = (cell: number): { x: number; y: number } => {
  const offset = (cell - LPC_BODY_FRAME) / 2
  return { x: (offset + LPC_CENTER_X) / cell, y: (offset + LPC_FOOT_Y) / cell }
}

// ---------------------------------------------------------------- UI 미리보기(장비창)
// 게임 속과 같은 장비 레이어를 캔버스에 겹쳐 그린다(정면 정지 프레임, 몸 64px 칸).
const previewImageCache = new Map<string, HTMLImageElement>()

const loadPreviewImage = (fileName: string): HTMLImageElement => {
  let image = previewImageCache.get(fileName)
  if (!image) {
    image = new Image()
    image.src = sheetUrl(fileName)
    previewImageCache.set(fileName, image)
  }
  return image
}

export const drawLpcPlayerPreview = (canvas: HTMLCanvasElement, look: LpcPlayerLook): void => {
  const files = getLpcPlayerLayerFiles(look, 'walk')
  const cell = manifest.anims.walk.cell
  const offset = (cell - LPC_BODY_FRAME) / 2
  const images = LPC_PLAYER_LAYER_ORDER.map((slot) => files[slot])
    .filter((file): file is string => file !== undefined)
    .map(loadPreviewImage)

  const draw = () => {
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }
    canvas.width = LPC_BODY_FRAME
    canvas.height = LPC_BODY_FRAME
    context.imageSmoothingEnabled = false
    context.clearRect(0, 0, canvas.width, canvas.height)
    for (const image of images) {
      // 아래(정면) 행 = 2, 0번 프레임(서 있기)
      context.drawImage(image, offset, 2 * cell + offset, LPC_BODY_FRAME, LPC_BODY_FRAME, 0, 0, LPC_BODY_FRAME, LPC_BODY_FRAME)
    }
  }

  const pending = images.filter((image) => !image.complete)
  if (pending.length === 0) {
    draw()
    return
  }
  for (const image of pending) {
    image.addEventListener('load', draw, { once: true })
  }
}
