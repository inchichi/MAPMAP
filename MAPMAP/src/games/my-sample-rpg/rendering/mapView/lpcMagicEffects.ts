import { AnimatedSprite, Rectangle, Texture, type Container } from 'pixi.js'

import type { CharacterMoveDirection } from '../../characterState'
import { loadTextureSafe } from '../loadTextureSafe'

// 플레이어 마법 그림 — Extended LPC Magic Pack(daneeklu, CC-BY-SA 3.0 / GPL 3.0, licenses/assets/lpc-magic-pack)의
// 손그림 시트를 그대로 재생한다(코드로 도형을 그리지 않는다). 위치·크기만 정하고 판정은 부르는 쪽이 한다.
//   화염 사자: 화염구 발사체(달리는 프레임 반복) → 명중하면 타오르다 사그라지는 프레임. 메테오 폭발.
//   번개 발톱: 체인 라이트닝이 맞힌 자리마다.
//   얼음 가시: 얼음 화살이 맞힌 자리.
//   얼음 촉수: 눈보라.
//   화염 기둥(아래를 향한 화염 사자 전체): 메테오.
// playerCombatEffects(마법 공격·마법 스킬)와 weaponSkills/staffSkills(지팡이 스킬)가 쓴다.

const asset = (fileName: string) => new URL(`../../assets/vfx/lpc-magic/${fileName}`, import.meta.url).href

const FIRE_LION_URL_BY_FACING: Record<CharacterMoveDirection, string> = {
  up: asset('firelion_up.png'),
  down: asset('firelion_down.png'),
  left: asset('firelion_left.png'),
  right: asset('firelion_right.png')
}

// 시트 규격: 128px 칸 4x4(16프레임), 얼음 가시는 64px 칸 10x4 중 마지막 줄(얼음 무리)
const BIG_CELL = 128
const SPIKES_CELL = 64
const ICE_SPIKES_ROW = 3

// 화염 사자 프레임: 0~3 나타남, 4~7 달림(발사체로 반복), 8~15 타오르다 사그라짐(명중)
const FIRE_LION_RUN_FRAMES = [4, 5, 6, 7]
const FIRE_LION_BURN_FRAMES = [8, 9, 10, 11, 12, 13, 14, 15]

// fire-pillar: 아래를 향한 화염 사자 전체(솟구쳐 타오르다 사그라짐) — 메테오
export type LpcMagicEffectKind = 'lightning-claw' | 'ice-spikes' | 'ice-tentacle' | 'fire-burst' | 'fire-pillar'

export type LpcMagicTextures = {
  fireLionByFacing: Record<CharacterMoveDirection, Texture[]>
  lightningClaw: Texture[]
  iceSpikes: Texture[]
  iceTentacle: Texture[]
}

const sliceGrid = (texture: Texture, cell: number, columns: number, rows: number[]): Texture[] =>
  rows.flatMap((row) =>
    Array.from({ length: columns }, (_, column) =>
      new Texture({ source: texture.source, frame: new Rectangle(column * cell, row * cell, cell, cell) })
    )
  )

export const loadLpcMagicTextures = async (): Promise<LpcMagicTextures> => {
  const load = async (url: string) => {
    const texture = await loadTextureSafe(url)
    texture.source.scaleMode = 'nearest'
    return texture
  }
  const [up, down, left, right, claw, spikes, tentacle] = await Promise.all([
    load(FIRE_LION_URL_BY_FACING.up),
    load(FIRE_LION_URL_BY_FACING.down),
    load(FIRE_LION_URL_BY_FACING.left),
    load(FIRE_LION_URL_BY_FACING.right),
    load(asset('lightningclaw.png')),
    load(asset('spikes.png')),
    load(asset('icetacle.png'))
  ])
  const big = (texture: Texture) => sliceGrid(texture, BIG_CELL, 4, [0, 1, 2, 3])

  return {
    fireLionByFacing: { up: big(up), down: big(down), left: big(left), right: big(right) },
    lightningClaw: big(claw),
    iceSpikes: sliceGrid(spikes, SPIKES_CELL, 10, [ICE_SPIKES_ROW]),
    iceTentacle: big(tentacle)
  }
}

// 진행 방향에 가까운 4방향
export const getMagicFacing = (direction: { x: number; y: number }): CharacterMoveDirection =>
  Math.abs(direction.x) >= Math.abs(direction.y)
    ? direction.x < 0
      ? 'left'
      : 'right'
    : direction.y < 0
      ? 'up'
      : 'down'

type LpcMagicEffectsContext = {
  textures: LpcMagicTextures
  getDepthSortedLayer: () => Container | undefined
  tileHeight: number
}

export const createLpcMagicEffects = ({ textures, getDepthSortedLayer, tileHeight }: LpcMagicEffectsContext) => {
  const active = new Set<AnimatedSprite>()

  const framesFor = (kind: LpcMagicEffectKind, facing: CharacterMoveDirection): Texture[] => {
    switch (kind) {
      case 'lightning-claw':
        return textures.lightningClaw
      case 'ice-spikes':
        return textures.iceSpikes
      case 'ice-tentacle':
        return textures.iceTentacle
      case 'fire-burst':
        return FIRE_LION_BURN_FRAMES.map((index) => textures.fireLionByFacing[facing][index])
      case 'fire-pillar':
        return textures.fireLionByFacing.down
    }
  }

  // 발밑(x, y)에 한 번 재생하고 사라진다. scale 1 = 시트 원래 크기.
  const play = (
    kind: LpcMagicEffectKind,
    x: number,
    y: number,
    options: { scale?: number; facing?: CharacterMoveDirection; durationMilliseconds?: number } = {}
  ) => {
    const frames = framesFor(kind, options.facing ?? 'down')
    const sprite = new AnimatedSprite(frames)
    const duration = options.durationMilliseconds ?? 600
    sprite.anchor.set(0.5, 0.85)
    sprite.scale.set(options.scale ?? 1)
    sprite.position.set(x, y)
    sprite.zIndex = Math.round(y + tileHeight)
    sprite.roundPixels = true
    sprite.loop = false
    sprite.animationSpeed = frames.length / (duration / (1000 / 60))
    sprite.onComplete = () => {
      active.delete(sprite)
      sprite.destroy()
    }
    active.add(sprite)
    getDepthSortedLayer()?.addChild(sprite)
    sprite.play()
  }

  // 화염구 발사체: 진행 방향의 화염 사자가 달리는 프레임을 반복한다. 위치는 부르는 쪽이 옮긴다.
  const createFireLionProjectile = (direction: { x: number; y: number }, scale = 0.5): AnimatedSprite => {
    const facing = getMagicFacing(direction)
    const sprite = new AnimatedSprite(FIRE_LION_RUN_FRAMES.map((index) => textures.fireLionByFacing[facing][index]))
    sprite.anchor.set(0.5)
    sprite.scale.set(scale)
    sprite.roundPixels = true
    sprite.animationSpeed = 0.25
    sprite.play()
    return sprite
  }

  const clear = () => {
    for (const sprite of active) {
      sprite.destroy()
    }
    active.clear()
  }

  return { play, createFireLionProjectile, clear }
}

export type LpcMagicEffects = ReturnType<typeof createLpcMagicEffects>
