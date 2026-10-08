// 시뮬레이터 화면에 게임 그림을 입힌다: 시험장 타일맵, 플레이어(LPC 기사, 기본 검·사냥용 활·마법 지팡이), 화살·에너지볼트,
// 시험 보스(트롤 족장 LPC 시트).
// 게임과 같은 그림 파일·시트 규칙(lpcCharacterSprites, monsterCatalog)을 읽어 canvas 2D 로 그린다.
// 좌표는 칸 단위(시뮬레이터와 같다), 한 칸은 32px 로 그린다.
import type { ParsedTiledMap } from '../tiled/parseTiledMap'
import type { PlayerWeapon } from '../bossTraining/bossFightSim'
import {
  getLpcPlayerAttackAnimation,
  getLpcPlayerLayerFiles,
  LPC_BODY_FRAME,
  LPC_CENTER_X,
  LPC_FOOT_Y,
  LPC_PLAYER_LAYER_ORDER,
  sheetUrl,
  type LpcAnimationName,
  type LpcDirection,
  type LpcPlayerLook
} from '../rendering/lpcCharacterSprites'
import lpcManifest from '../assets/characters/lpc/manifest.json'
import { BOSS_RENDER_SCALE_MULTIPLIER } from '../monsterTuning'
import { getMonsterCatalogEntry } from '../rendering/monsterCatalog'
import type { LpcMonsterStrip } from '../rendering/loadLpcMonsterTextures'

export const TILE_PIXELS = 32

const TILESET_IMAGE_URLS = import.meta.glob<string>('../assets/tilesets/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
})

const images = new Map<string, HTMLImageElement>()
const loadImage = (url: string): Promise<HTMLImageElement> => {
  const known = images.get(url)
  if (known?.complete) {
    return Promise.resolve(known)
  }
  const image = known ?? new Image()
  if (!known) {
    image.src = url
    images.set(url, image)
  }
  return image.decode().then(() => image)
}

// 맵의 타일 층을 한 장으로 그려 둔다. roof 층은 캐릭터 위에 올라가야 해서 따로 그린다.
const renderLayers = (map: ParsedTiledMap, tilesetImages: HTMLImageElement[], roof: boolean): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = map.width * map.tileWidth
  canvas.height = map.height * map.tileHeight
  const context = canvas.getContext('2d')!
  context.imageSmoothingEnabled = false
  const tilesets = [...map.tilesets].sort((a, b) => b.firstGid - a.firstGid)
  for (const layer of map.layers.filter((candidate) => candidate.visible && (candidate.name === 'roof') === roof)) {
    context.globalAlpha = layer.opacity
    for (const tile of layer.tiles) {
      const tileset = tilesets.find((candidate) => tile.gid >= candidate.firstGid)!
      const image = tilesetImages[map.tilesets.indexOf(tileset)]
      const local = tile.gid - tileset.firstGid
      const sx = tileset.margin + (local % tileset.columns) * (tileset.tileWidth + tileset.spacing)
      const sy = tileset.margin + Math.floor(local / tileset.columns) * (tileset.tileHeight + tileset.spacing)
      context.drawImage(
        image,
        sx,
        sy,
        tileset.tileWidth,
        tileset.tileHeight,
        tile.x * map.tileWidth,
        tile.y * map.tileHeight + map.tileHeight - tileset.tileHeight,
        tileset.tileWidth,
        tileset.tileHeight
      )
    }
  }
  return canvas
}

export type ArenaTiles = { ground: HTMLCanvasElement; roof: HTMLCanvasElement }

export const loadArenaTiles = async (map: ParsedTiledMap): Promise<ArenaTiles> => {
  const tilesetImages = await Promise.all(
    map.tilesets.map((tileset) => {
      const fileName = tileset.image.source.split('/').pop()
      return loadImage(TILESET_IMAGE_URLS[`../assets/tilesets/${fileName}`])
    })
  )
  return { ground: renderLayers(map, tilesetImages, false), roof: renderLayers(map, tilesetImages, true) }
}

// ---------------------------------------------------------------- 플레이어(LPC 기사)
// 검 봇은 게임 시작 장비(기본 검), 활 봇은 첫 활(사냥용 활), 마법 봇은 첫 지팡이(마법 지팡이)를 든 기사
const PLAYER_LOOKS: Record<PlayerWeapon, LpcPlayerLook> = {
  sword: { weaponId: 'basic-sword' },
  bow: { weaponId: 'hunting-bow' },
  magic: { weaponId: 'magic-staff' }
}
export const getPlayerAttackAnimation = (weapon: PlayerWeapon): LpcAnimationName =>
  getLpcPlayerAttackAnimation(PLAYER_LOOKS[weapon].weaponId)

const playerLayerImages = new Map<string, HTMLImageElement[]>()

const loadPlayerSheets = () =>
  Promise.all(
    (Object.keys(PLAYER_LOOKS) as PlayerWeapon[]).flatMap((weapon) =>
      (['walk', getPlayerAttackAnimation(weapon), 'hurt'] as LpcAnimationName[]).map(async (animation) => {
        const files = getLpcPlayerLayerFiles(PLAYER_LOOKS[weapon], animation)
        const layers = LPC_PLAYER_LAYER_ORDER.map((slot) => files[slot]).filter((file): file is string => !!file)
        playerLayerImages.set(`${weapon}:${animation}`, await Promise.all(layers.map((file) => loadImage(sheetUrl(file)))))
      })
    )
  )

export const getPlayerFrameCount = (animation: LpcAnimationName): number => lpcManifest.anims[animation].frames

const LPC_ROWS: readonly LpcDirection[] = ['up', 'left', 'down', 'right']

// 발끝이 (x, y) 픽셀에 오게 그린다
export const drawPlayerSprite = (
  context: CanvasRenderingContext2D,
  weapon: PlayerWeapon,
  pose: { animation: LpcAnimationName; direction: LpcDirection; frame: number },
  x: number,
  y: number
) => {
  const layers = playerLayerImages.get(`${weapon}:${pose.animation}`)
  if (!layers) {
    return
  }
  const cell = lpcManifest.anims[pose.animation].cell
  const offset = (cell - LPC_BODY_FRAME) / 2
  const row = LPC_ROWS.indexOf(pose.direction)
  for (const image of layers) {
    context.drawImage(
      image,
      pose.frame * cell,
      row * cell,
      cell,
      cell,
      Math.round(x - offset - LPC_CENTER_X),
      Math.round(y - offset - LPC_FOOT_Y),
      cell,
      cell
    )
  }
}

// ---------------------------------------------------------------- 시험 보스(트롤 족장 외형)
const BOSS_ENTRY = getMonsterCatalogEntry('monster_troll_chief')!
export type BossAnimation = 'idle' | 'run' | 'hit' | 'attack'

const getBossStrip = (animation: BossAnimation, facingRight: boolean): LpcMonsterStrip => {
  const spec = BOSS_ENTRY.spec
  const strips: Record<BossAnimation, [LpcMonsterStrip, LpcMonsterStrip]> = {
    idle: [spec.idleLeft, spec.idleRight],
    run: [spec.runLeft, spec.runRight],
    hit: [spec.hitLeft, spec.hitRight],
    attack: [spec.attackLeft, spec.attackRight]
  }
  return strips[animation][facingRight ? 1 : 0]
}

export const getBossFrameCount = (animation: BossAnimation): number => getBossStrip(animation, false).frames.length

const loadBossSheets = () => Promise.all([...new Set(Object.values(BOSS_ENTRY.spec).map((strip) => strip.url))].map(loadImage))

// LPC 사람형 시트(칸 96)는 64px 몸 칸이 가운데에 있다 — 발끝은 몸 칸의 (32, 62)
export const drawBossSprite = (
  context: CanvasRenderingContext2D,
  pose: { animation: BossAnimation; facingRight: boolean; frame: number },
  x: number,
  y: number
) => {
  const strip = getBossStrip(pose.animation, pose.facingRight)
  const image = images.get(strip.url)
  if (!image?.complete) {
    return
  }
  // 게임과 같이 보스는 2배로 그린다
  const scale = BOSS_ENTRY.behavior.renderScale * BOSS_RENDER_SCALE_MULTIPLIER
  const column = strip.frames[pose.frame % strip.frames.length]
  const offsetX = (strip.cellWidth - LPC_BODY_FRAME) / 2
  const offsetY = (strip.cellHeight - LPC_BODY_FRAME) / 2
  context.save()
  context.translate(Math.round(x), Math.round(y))
  context.scale(strip.mirror ? -scale : scale, scale)
  context.drawImage(
    image,
    column * strip.cellWidth,
    strip.row * strip.cellHeight,
    strip.cellWidth,
    strip.cellHeight,
    -offsetX - LPC_CENTER_X,
    -offsetY - LPC_FOOT_Y,
    strip.cellWidth,
    strip.cellHeight
  )
  context.restore()
}

// ---------------------------------------------------------------- 화살(LPC 화살, 오른쪽을 향한 그림)
const ARROW_URL = sheetUrl('projectile-arrow.png')

// 가운데가 (x, y) 픽셀에 오고 angle(라디안) 쪽을 향하게 그린다. 게임처럼 촉 쪽(가로 3/4)을 기준으로 둔다.
export const drawArrowSprite = (context: CanvasRenderingContext2D, x: number, y: number, angle: number) => {
  const image = images.get(ARROW_URL)
  if (!image?.complete) {
    return
  }
  context.save()
  context.translate(Math.round(x), Math.round(y))
  context.rotate(angle)
  context.drawImage(image, -Math.round(image.width * 0.75), -Math.round(image.height / 2))
  context.restore()
}

// ---------------------------------------------------------------- 에너지볼트(Ninja Adventure 에너지볼 16×16 4프레임)
// 게임처럼 2배로, 보랏빛(0xc9b6ff)으로 물들여 그린다. 물들인 시트는 한 번만 만든다.
const ENERGY_BALL_URL = new URL('../assets/vfx/ninja-fx/energy-ball.png', import.meta.url).href
const ENERGY_BALL_FRAME = 16
const ENERGY_BALL_FRAMES = 4
const ENERGY_BOLT_TINT = '#c9b6ff'
let energyBoltSheet: HTMLCanvasElement | undefined

const getEnergyBoltSheet = (): HTMLCanvasElement | undefined => {
  const image = images.get(ENERGY_BALL_URL)
  if (!energyBoltSheet && image?.complete) {
    energyBoltSheet = document.createElement('canvas')
    energyBoltSheet.width = image.width
    energyBoltSheet.height = image.height
    const context = energyBoltSheet.getContext('2d')!
    context.drawImage(image, 0, 0)
    context.globalCompositeOperation = 'multiply'
    context.fillStyle = ENERGY_BOLT_TINT
    context.fillRect(0, 0, image.width, image.height)
    context.globalCompositeOperation = 'destination-in'
    context.drawImage(image, 0, 0)
  }
  return energyBoltSheet
}

export const drawEnergyBoltSprite = (context: CanvasRenderingContext2D, x: number, y: number, now: number) => {
  const sheet = getEnergyBoltSheet()
  if (!sheet) {
    return
  }
  // 게임의 animationSpeed 0.25(60fps 기준) = 초당 15프레임
  const frame = Math.floor((now / 1000) * 15) % ENERGY_BALL_FRAMES
  const size = ENERGY_BALL_FRAME * 2
  context.drawImage(
    sheet,
    frame * ENERGY_BALL_FRAME,
    0,
    ENERGY_BALL_FRAME,
    ENERGY_BALL_FRAME,
    Math.round(x - size / 2),
    Math.round(y - size / 2),
    size,
    size
  )
}

export const loadCharacterSprites = () =>
  Promise.all([loadPlayerSheets(), loadBossSheets(), loadImage(ARROW_URL), loadImage(ENERGY_BALL_URL)])
