import { Sprite, type Container, type Texture } from 'pixi.js'

import { HEALTH_POTION, WEAPONS, goldIconId, type Weapon } from '../items'
import type { LootDrop } from '../loot'
import type { CharacterMoveDirection } from '../../my-sample-rpg/characterState'
import { loadImageTexture } from './loadActorTextures'

const TILE = 16
// 밟으면 들어오는 거리. 타일 하나보다 짧게 잡아 "지나가다 주웠다"로 읽히게 한다.
const TOUCH_RADIUS_TILES = 0.7
// 바닥 아이템을 타일 중앙보다 살짝 위에 놓는다. 정중앙이면 발밑에 깔려 안 보인다.
const ITEM_LIFT_PIXELS = 3
// 같은 칸에 둘 이상 떨어졌을 때 좌우로 벌리는 간격.
const ITEM_SPREAD_PIXELS = 8

const iconUrls = import.meta.glob<string>('../assets/items/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
})
const weaponUrls = import.meta.glob<string>('../assets/items/weapons/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
})

/** 바닥에 놓인 금화·물약. 밟으면 자동으로 들어온다. */
type GroundPickup = {
  tileX: number
  tileY: number
  gold: number
  potions: number
  sprite: Sprite
}

/** 바닥에 놓인 무기. 상자와 같은 규칙(F, findNearestInRange)으로 줍는다. */
export type GroundWeapon = {
  tileX: number
  tileY: number
  weapon: Weapon
  sprite: Sprite
}

// 방향별 손 위치와 칼끝 각도. 든 그림은 위쪽이 손잡이, 아래쪽이 칼끝이라 rotation 0 이
// 곧 아래 방향이다. 위를 볼 때만 무기가 몸 뒤로 가려진다.
const HELD_POSES: Record<
  CharacterMoveDirection,
  { x: number, y: number, rotation: number, behind: boolean }
> = {
  down: { x: 6, y: -4, rotation: 0, behind: false },
  up: { x: -7, y: -6, rotation: Math.PI, behind: true },
  left: { x: -7, y: -4, rotation: Math.PI / 2, behind: false },
  right: { x: 7, y: -4, rotation: -Math.PI / 2, behind: false }
}

const loadItemTextures = async (): Promise<Record<string, Texture>> => {
  const wanted: [string, string][] = [
    [HEALTH_POTION.id, iconUrls[`../assets/items/${HEALTH_POTION.id}.png`]],
    ['goldcoin', iconUrls['../assets/items/goldcoin.png']],
    ['silvercoin', iconUrls['../assets/items/silvercoin.png']],
    ...WEAPONS.flatMap<[string, string]>((weapon) => [
      [weapon.id, weaponUrls[`../assets/items/weapons/${weapon.id}.png`]],
      [`${weapon.id}_hand`, weaponUrls[`../assets/items/weapons/${weapon.id}_hand.png`]]
    ])
  ]

  const textures: Record<string, Texture> = {}
  await Promise.all(
    wanted.map(async ([key, url]) => {
      textures[key] = await loadImageTexture(url)
    })
  )

  return textures
}

/**
 * 바닥에 떨어진 아이템과 플레이어가 든 무기를 그린다. 아이템 텍스처를 양쪽이 함께 쓰므로
 * 한 파일에 둔다. 스프라이트는 `actors` 에 붙어 몬스터·플레이어와 같은 y 정렬을 받는다.
 */
export const createLootOverlay = async (actors: Container) => {
  const textures = await loadItemTextures()
  const pickups: GroundPickup[] = []
  const groundWeapons: GroundWeapon[] = []

  const place = (textureKey: string, tileX: number, tileY: number, offsetX: number) => {
    const sprite = new Sprite(textures[textureKey])
    sprite.anchor.set(0.5, 0.5)
    sprite.position.set(
      (tileX + 0.5) * TILE + offsetX,
      (tileY + 0.5) * TILE - ITEM_LIFT_PIXELS
    )
    // 같은 칸의 배우보다 살짝 아래로 깔린다 — 바닥에 놓인 물건이다.
    sprite.zIndex = tileY - 0.5
    actors.addChild(sprite)
    return sprite
  }

  const dropAt = (tileX: number, tileY: number, drop: LootDrop) => {
    const count =
      (drop.gold > 0 ? 1 : 0) + (drop.potions > 0 ? 1 : 0) + (drop.weapon ? 1 : 0)
    let placed = 0
    // 한 칸에 여러 개가 떨어지면 겹쳐 하나로 보인다. 가운데를 기준으로 좌우로 벌린다.
    const nextOffset = () => {
      const offset = (placed - (count - 1) / 2) * ITEM_SPREAD_PIXELS
      placed += 1
      return offset
    }

    if (drop.gold > 0) {
      pickups.push({
        tileX,
        tileY,
        gold: drop.gold,
        potions: 0,
        sprite: place(goldIconId(drop.gold), tileX, tileY, nextOffset())
      })
    }
    if (drop.potions > 0) {
      pickups.push({
        tileX,
        tileY,
        gold: 0,
        potions: drop.potions,
        sprite: place(HEALTH_POTION.id, tileX, tileY, nextOffset())
      })
    }
    if (drop.weapon) {
      groundWeapons.push({
        tileX,
        tileY,
        weapon: drop.weapon,
        sprite: place(drop.weapon.id, tileX, tileY, nextOffset())
      })
    }
  }

  /** 밟은 금화·물약을 걷어 합계를 돌려준다. 무기는 걷지 않는다(F 로 줍는다). */
  const collectTouched = (x: number, y: number) => {
    let gold = 0
    let potions = 0

    for (let index = pickups.length - 1; index >= 0; index -= 1) {
      const pickup = pickups[index]
      if (Math.hypot(pickup.tileX + 0.5 - x, pickup.tileY + 0.5 - y) > TOUCH_RADIUS_TILES) {
        continue
      }
      gold += pickup.gold
      potions += pickup.potions
      pickup.sprite.destroy()
      pickups.splice(index, 1)
    }

    return { gold, potions }
  }

  /** 바닥 무기를 집고 들고 있던 것을 그 자리에 내려놓는다. 창 없이도 되돌릴 수 있다. */
  const swapWeapon = (index: number, held: Weapon): Weapon => {
    const ground = groundWeapons[index]
    const taken = ground.weapon
    ground.weapon = held
    ground.sprite.texture = textures[held.id]
    return taken
  }

  const heldSprite = new Sprite()
  // 대부분의 든 그림은 위쪽이 손잡이다. 그 근처를 회전 중심으로 삼아야 휘두를 때 손이 안 뜬다.
  heldSprite.anchor.set(0.5, 0.2)
  actors.addChild(heldSprite)

  const setHeldWeapon = (weapon: Weapon) => {
    heldSprite.texture = textures[`${weapon.id}_hand`]
  }

  /**
   * 든 무기를 플레이어 옆에 놓는다. x·y 는 플레이어 스프라이트의 화면 좌표를 그대로 받아
   * 돌진·반동까지 따라가게 하고, depth 는 y 정렬용 타일 좌표다.
   */
  const updateHeldWeapon = (
    x: number,
    y: number,
    facing: CharacterMoveDirection,
    swing: number,
    depth: number
  ) => {
    const pose = HELD_POSES[facing]
    heldSprite.position.set(x + pose.x, y + pose.y)
    heldSprite.rotation = pose.rotation + swing
    heldSprite.zIndex = depth + (pose.behind ? -0.01 : 0.01)
  }

  return {
    groundWeapons: groundWeapons as readonly GroundWeapon[],
    dropAt,
    collectTouched,
    swapWeapon,
    setHeldWeapon,
    updateHeldWeapon
  }
}
