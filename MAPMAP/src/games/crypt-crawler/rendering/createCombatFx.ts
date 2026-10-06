import { Container, Rectangle, Sprite, Texture } from 'pixi.js'

import slashSheetUrl from '../assets/fx/slashcurved.png'
import { deathLook } from '../hitFeel'
import { loadImageTexture } from './loadActorTextures'
import type { CharacterMoveDirection } from '../../my-sample-rpg/characterState'

const TILE = 16

// slashcurved.png 128x32 = 32px 프레임 4장. 실측으로 확인했다.
const SLASH_FRAME_SIZE = 32
const SLASH_FRAME_MS = 40

// 이 시트의 호는 프레임 정중앙이 아니라 (14.2, 13.6)px 을 중심으로 반지름 14.6px(≈0.9타일)
// 을 돈다(네 프레임의 불투명 픽셀에 원을 최소제곱으로 맞춰 잰 값). 앵커를 그 중심에 두어야
// 방향을 바꿔도 호가 같은 자리를 돈다.
const SLASH_PIVOT_X = 14.2 / SLASH_FRAME_SIZE
const SLASH_PIVOT_Y = 13.6 / SLASH_FRAME_SIZE

// 호의 반지름이 0.9타일이라 그대로 두면 몸에 붙는다. 앞으로 조금 밀어 호의 바깥이
// 사거리(1.7타일) 근처에 닿게 한다.
const SLASH_OFFSET_TILES = 0.45

// 동시에 살아 있을 수 있는 베기 수. 한 장이 160ms, 공격 간격이 380ms 라 둘이면 충분하지만
// 여유로 셋을 돌린다. 스프라이트를 미리 만들어 두므로 휘두를 때마다 할당이 없다.
const SLASH_POOL_SIZE = 3

// 이펙트는 y 정렬 위로 조금 띄운다. 앞에 선 몬스터에 가려지면 이펙트가 안 보인다.
const FX_Z_OFFSET = 1.5

// 시트의 초승달은 오른쪽으로 볼록하다 = 오른쪽을 향한 휘두르기. 나머지 세 방향은 회전이다.
const SLASH_POSE: Record<
  CharacterMoveDirection,
  { rotation: number, stepX: number, stepY: number }
> = {
  right: { rotation: 0, stepX: 1, stepY: 0 },
  down: { rotation: Math.PI / 2, stepX: 0, stepY: 1 },
  left: { rotation: Math.PI, stepX: -1, stepY: 0 },
  up: { rotation: -Math.PI / 2, stepX: 0, stepY: -1 }
}

type SlashRuntime = {
  sprite: Sprite
  elapsedMs: number
}

type DeathRuntime = {
  sprite: Sprite
  // 곱셈 tint 로는 스프라이트를 밝게 만들 수 없다. 같은 그림을 가산 합성으로 겹쳐 번쩍인다.
  flash: Sprite
  baseScale: number
  elapsedMs: number
}

export type CombatFx = {
  /** 휘두른 자리에 베기 한 장. 좌표는 타일 단위(플레이어 중심). */
  playSlash: (tileX: number, tileY: number, facing: CharacterMoveDirection) => void
  /** 죽은 몬스터 스프라이트를 넘기면 번쩍이며 줄어들다 사라진다. */
  playDeath: (sprite: Sprite) => void
  update: (deltaMs: number) => void
}

const sliceRow = (sheet: Texture, frameSize: number): Texture[] =>
  Array.from(
    { length: Math.floor(sheet.width / frameSize) },
    (_unused, index) => new Texture({
      source: sheet.source,
      frame: new Rectangle(index * frameSize, 0, frameSize, frameSize)
    })
  )

/**
 * 전투 이펙트. 계산은 전부 hitFeel 에 있고 여기서는 스프라이트에 바르기만 한다.
 * layer 는 월드 좌표계의 배우 컨테이너여야 한다(카메라·흔들림을 같이 받아야 한다).
 */
export const createCombatFx = async (layer: Container): Promise<CombatFx> => {
  const slashFrames = sliceRow(await loadImageTexture(slashSheetUrl), SLASH_FRAME_SIZE)

  const slashes: SlashRuntime[] = Array.from({ length: SLASH_POOL_SIZE }, () => {
    const sprite = new Sprite(slashFrames[0])
    sprite.anchor.set(SLASH_PIVOT_X, SLASH_PIVOT_Y)
    sprite.visible = false
    layer.addChild(sprite)
    return { sprite, elapsedMs: 0 }
  })
  let nextSlash = 0

  const deaths: DeathRuntime[] = []

  const playSlash = (
    tileX: number,
    tileY: number,
    facing: CharacterMoveDirection
  ) => {
    const slash = slashes[nextSlash]
    nextSlash = (nextSlash + 1) % slashes.length

    const pose = SLASH_POSE[facing]
    slash.elapsedMs = 0
    slash.sprite.texture = slashFrames[0]
    slash.sprite.rotation = pose.rotation
    slash.sprite.position.set(
      (tileX + pose.stepX * SLASH_OFFSET_TILES) * TILE,
      (tileY + pose.stepY * SLASH_OFFSET_TILES) * TILE
    )
    slash.sprite.zIndex = tileY + FX_Z_OFFSET
    slash.sprite.visible = true
  }

  const playDeath = (sprite: Sprite) => {
    const flash = new Sprite(sprite.texture)
    flash.anchor.copyFrom(sprite.anchor)
    flash.position.copyFrom(sprite.position)
    flash.scale.copyFrom(sprite.scale)
    flash.blendMode = 'add'
    flash.zIndex = sprite.zIndex + FX_Z_OFFSET
    layer.addChild(flash)

    deaths.push({ sprite, flash, baseScale: sprite.scale.x, elapsedMs: 0 })
  }

  const update = (deltaMs: number) => {
    for (const slash of slashes) {
      if (!slash.sprite.visible) {
        continue
      }
      slash.elapsedMs += deltaMs
      const frame = Math.floor(slash.elapsedMs / SLASH_FRAME_MS)
      if (frame >= slashFrames.length) {
        slash.sprite.visible = false
        continue
      }
      slash.sprite.texture = slashFrames[frame]
    }

    for (let index = deaths.length - 1; index >= 0; index -= 1) {
      const death = deaths[index]
      death.elapsedMs += deltaMs
      const look = deathLook(death.elapsedMs)

      death.sprite.alpha = look.alpha
      death.sprite.scale.set(death.baseScale * look.scale)
      death.flash.alpha = look.flashAlpha
      death.flash.scale.set(death.baseScale * look.scale)

      if (look.done) {
        // 시체는 숨기되 스프라이트 자체는 원래 상태로 되돌린다 — 다시 쓰이지 않더라도
        // 반쯤 줄어든 채 남겨 두면 나중에 재사용할 때 원인을 찾기 어렵다.
        death.sprite.visible = false
        death.sprite.alpha = 1
        death.sprite.scale.set(death.baseScale)
        death.flash.destroy()
        deaths.splice(index, 1)
      }
    }
  }

  return { playSlash, playDeath, update }
}
