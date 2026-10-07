// 스킬 그림 효과 — 코드로 도형을 그리지 않고 픽셀 이펙트 시트를 재생한다(마법 스킬의 lpcMagicEffects 와 같은 결).
//   Ninja Adventure FX(Pixel-boy·AAA, CC0, licenses/assets/ninja-adventure): 베기·원형 베기·스파크·먼지·오라·에너지볼
//   Extended LPC Magic Pack 바위 가시(spikes.png 1행, licenses/assets/lpc-magic-pack), LPC 화살(projectile-arrow.png)
// 위치·회전·크기·색조와 "A 에서 B 로 날아가기"만 정한다. 판정은 부르는 쪽(스킬·전투 모듈)이 한다.
// 검·도끼·활 스킬(weaponSkills/*), 화살 명중·독·화상(playerCombatEffects), 집중·돌진(playerActions)이 쓴다.
// 사망·씬 이동 때 clear 로 모두 지운다.
import { AnimatedSprite, Rectangle, Sprite, Texture, type Container } from 'pixi.js'

import { loadTextureSafe } from '../loadTextureSafe'

const ninjaFx = (fileName: string) => new URL(`../../assets/vfx/ninja-fx/${fileName}`, import.meta.url).href

// 시트: [파일, 칸 너비, 칸 높이, 프레임 수]
const SHEETS = {
  'circular-slash': [ninjaFx('circular-slash.png'), 32, 32, 4],
  'slash-double': [ninjaFx('slash-double.png'), 32, 32, 4],
  'slash-double-curved': [ninjaFx('slash-double-curved.png'), 32, 32, 4],
  'slash-curved': [ninjaFx('slash-curved.png'), 32, 32, 4],
  cut: [ninjaFx('cut.png'), 32, 32, 5],
  spark: [ninjaFx('spark.png'), 32, 32, 5],
  'spark-circle': [ninjaFx('spark-circle.png'), 32, 32, 6],
  'ring-orange': [ninjaFx('ring-orange.png'), 32, 32, 4],
  smoke: [ninjaFx('smoke.png'), 32, 32, 6],
  'dust-ring': [ninjaFx('dust-ring.png'), 30, 14, 8],
  aura: [ninjaFx('aura.png'), 32, 32, 4],
  'energy-ball': [ninjaFx('energy-ball.png'), 16, 16, 4]
} as const

const EARTH_SPIKES_URL = new URL('../../assets/vfx/lpc-magic/spikes.png', import.meta.url).href
const EARTH_SPIKES_ROW = 1
const ARROW_URL = new URL('../../assets/characters/lpc/projectile-arrow.png', import.meta.url).href

// 베기 시트는 첫 프레임이 작은 조각이고 큰 베기 모양은 한 장뿐이라, 고르게 넘기면 큰 모양이 순간만 보였다.
// 시트마다 보여 줄 프레임 순서를 정해 큰 모양을 더 오래 보인다(없으면 0, 1, 2, … 그대로).
const FRAME_SEQUENCE: Partial<Record<keyof typeof SHEETS, readonly number[]>> = {
  'slash-double': [1, 1, 1, 2, 3],
  'slash-double-curved': [1, 1, 2, 2, 3],
  'slash-curved': [1, 1, 2, 2, 3],
  cut: [1, 1, 2, 3, 3, 4]
}

export type SkillFxKind = keyof typeof SHEETS | 'earth-spikes' | 'arrow'

export type SkillFxTextures = Record<SkillFxKind, Texture[]>

const sliceRow = (texture: Texture, width: number, height: number, count: number, row = 0): Texture[] =>
  Array.from({ length: count }, (_, column) =>
    new Texture({ source: texture.source, frame: new Rectangle(column * width, row * height, width, height) })
  )

export const loadSkillFxTextures = async (): Promise<SkillFxTextures> => {
  const load = async (url: string) => {
    const texture = await loadTextureSafe(url)
    texture.source.scaleMode = 'nearest'
    return texture
  }
  const entries = Object.entries(SHEETS) as [keyof typeof SHEETS, (typeof SHEETS)[keyof typeof SHEETS]][]
  const [sheetTextures, spikes, arrow] = await Promise.all([
    Promise.all(entries.map(async ([kind, [url, width, height, count]]) => {
      const frames = sliceRow(await load(url), width, height, count)
      return [kind, FRAME_SEQUENCE[kind]?.map((index) => frames[index]) ?? frames] as const
    })),
    load(EARTH_SPIKES_URL),
    load(ARROW_URL)
  ])

  return {
    ...Object.fromEntries(sheetTextures),
    'earth-spikes': sliceRow(spikes, 64, 64, 10, EARTH_SPIKES_ROW),
    arrow: [arrow]
  } as SkillFxTextures
}

export type SkillFxOptions = {
  // 화면 픽셀 배율(시트 1px = scale px). 도트가 고르게 보이게 정수를 권한다.
  scale?: number
  // 라디안(오른쪽 = 0). 화살·베기 방향을 맞춘다.
  rotation?: number
  durationMilliseconds?: number
  // 흰 시트에 색을 입힌다(스파크·오라)
  tint?: number
  // 있으면 지속 시간 동안 이 점까지 날아간다(검기·화살)
  to?: { x: number; y: number }
  // 발밑 기준(0.85) 대신 가운데 기준(0.5)으로 놓는다
  centered?: boolean
  // 끝날 즈음 서서히 사라진다
  fadeOut?: boolean
}

type ActiveFx = {
  sprite: Sprite
  startedAt: number
  durationMilliseconds: number
  from: { x: number; y: number }
  to?: { x: number; y: number }
  fadeOut: boolean
  frames: Texture[]
}

export type SkillFx = ReturnType<typeof createSkillFx>

export const createSkillFx = (ctx: {
  textures: SkillFxTextures
  getDepthSortedLayer: () => Container | undefined
  tileHeight: number
}) => {
  const active: ActiveFx[] = []

  const syncDepth = (sprite: Sprite) => {
    sprite.zIndex = Math.round(sprite.position.y + ctx.tileHeight * 2)
  }

  // (x, y)에 한 번 재생하고 사라진다. 프레임은 지속 시간에 맞춰 넘긴다.
  const play = (kind: SkillFxKind, at: { x: number; y: number }, now: number, options: SkillFxOptions = {}) => {
    const frames = ctx.textures[kind]
    const sprite = frames.length > 1 ? new AnimatedSprite(frames) : new Sprite(frames[0])
    const durationMilliseconds = options.durationMilliseconds ?? 400

    sprite.anchor.set(0.5, options.centered || options.to ? 0.5 : 0.85)
    sprite.scale.set(options.scale ?? 2)
    sprite.rotation = options.rotation ?? 0
    sprite.position.set(at.x, at.y)
    sprite.roundPixels = true
    if (options.tint !== undefined) {
      sprite.tint = options.tint
    }
    syncDepth(sprite)
    ctx.getDepthSortedLayer()?.addChild(sprite)
    active.push({
      sprite,
      startedAt: now,
      durationMilliseconds,
      from: { ...at },
      to: options.to,
      fadeOut: options.fadeOut ?? false,
      frames
    })
  }

  const update = (now: number) => {
    for (let index = active.length - 1; index >= 0; index -= 1) {
      const fx = active[index]
      const progress = (now - fx.startedAt) / fx.durationMilliseconds

      if (progress >= 1) {
        fx.sprite.destroy()
        active.splice(index, 1)
        continue
      }

      const t = Math.max(0, progress)

      if (fx.sprite instanceof AnimatedSprite) {
        fx.sprite.gotoAndStop(Math.min(fx.frames.length - 1, Math.floor(t * fx.frames.length)))
      }

      if (fx.to) {
        fx.sprite.position.set(fx.from.x + (fx.to.x - fx.from.x) * t, fx.from.y + (fx.to.y - fx.from.y) * t)
        syncDepth(fx.sprite)
      }

      if (fx.fadeOut) {
        fx.sprite.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4
      }
    }
  }

  const clear = () => {
    for (const fx of active) {
      fx.sprite.destroy()
    }
    active.length = 0
  }

  return { play, update, clear, textures: ctx.textures }
}
