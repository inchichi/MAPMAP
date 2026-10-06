import {
  Container,
  Graphics,
  Sprite,
  Texture
} from 'pixi.js'
import type { CharacterState } from '../../characterState'
import { getMonsterCatalogEntry, type MonsterBehaviorConfig } from '../monsterCatalog'
import { QUEST_BADGE_SCALE } from './constants'
import { type RenderedCharacterNode } from './types'

// 종류별 행동값은 monsterCatalog.ts. 목록에 없는 monster_* 는 꿀꿀이 행동을 쓴다(그림이 없으면
// 아래 텍스처 표에도 없어 AI 가 돌지 않는다).
export const FALLBACK_MONSTER_BEHAVIOR = getMonsterCatalogEntry('monster_pig')!.behavior
export const getMonsterBehaviorConfig = (
  character: CharacterState
): MonsterBehaviorConfig =>
  getMonsterCatalogEntry(character.appearanceType)?.behavior ?? FALLBACK_MONSTER_BEHAVIOR

export const isStationaryMonster = (character: CharacterState): boolean =>
  getMonsterCatalogEntry(character.appearanceType)?.behavior.stationary === true

export const createMonsterHealthBar = (): NonNullable<
  RenderedCharacterNode['monsterHealthBar']
> => {
  const container = new Container()
  const track = new Graphics()
  const fill = new Graphics()

  container.sortableChildren = true
  track.roundPixels = true
  fill.roundPixels = true
  track.zIndex = 0
  fill.zIndex = 1
  container.addChild(track, fill)

  return {
    container,
    track,
    fill
  }
}

export const createQuestBadgeSprite = (texture: Texture): Sprite => {
  const sprite = new Sprite(texture)

  sprite.anchor.set(0.5, 1)
  sprite.scale.set(QUEST_BADGE_SCALE)
  sprite.roundPixels = true
  sprite.visible = false

  return sprite
}

export const createPlayerResourceBar = (): NonNullable<
  RenderedCharacterNode['playerHealthBar']
> => {
  const container = new Container()
  const track = new Graphics()
  const fill = new Graphics()

  container.sortableChildren = true
  track.roundPixels = true
  fill.roundPixels = true
  track.zIndex = 0
  fill.zIndex = 1
  container.addChild(track, fill)

  return {
    container,
    track,
    fill
  }
}
