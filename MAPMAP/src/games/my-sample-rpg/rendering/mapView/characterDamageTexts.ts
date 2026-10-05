// 캐릭터 머리 위로 떠오르는 글자(데미지 숫자·회피·외침·퀘스트 알림). 맵 화면의 상태는 ctx 로 받는다.
import type { ParsedTiledMap } from '../../tiled/parseTiledMap'
import { Container, Text, TextStyle } from 'pixi.js'
import type { CharacterState } from '../../characterState'
import { DAMAGE_TEXT_FLOAT_DISTANCE, DAMAGE_TEXT_OFFSET_Y, DAMAGE_TEXT_STYLE } from './constants'
import { getCharacterDepthSortValue } from './tiles'
import { type ActiveCharacterDamageText } from './types'

export type CharacterDamageTextsContext = {
  map: ParsedTiledMap
  messageLayer: Container
  characterPixelWidth: number
  characterPixelHeight: number
  activeCharacterDamageTexts: Map<string, ActiveCharacterDamageText>
  getCharacterStates: () => CharacterState[]
}

export const createCharacterDamageTexts = (ctx: CharacterDamageTextsContext) => {
  const {
    map,
    messageLayer,
    characterPixelWidth,
    characterPixelHeight,
    activeCharacterDamageTexts,
    getCharacterStates
  } = ctx


  const syncCharacterDamageTextElement = (
    characterId: string,
    now: number
  ) => {
    const activeDamageText = activeCharacterDamageTexts.get(characterId)

    if (!activeDamageText) {
      return
    }

    const character = getCharacterStates().find(
      (candidateCharacter) => candidateCharacter.id === characterId
    )

    if (!character) {
      activeDamageText.container.removeFromParent()
      activeDamageText.container.destroy({ children: true })
      activeCharacterDamageTexts.delete(characterId)
      return
    }

    const elapsedMilliseconds = now - activeDamageText.startedAt
    const progress = Math.min(
      1,
      Math.max(
        0,
        elapsedMilliseconds / activeDamageText.durationMilliseconds
      )
    )
    const floatOffset = Math.round(progress * DAMAGE_TEXT_FLOAT_DISTANCE)

    activeDamageText.container.position.set(
      Math.round(
        character.position.x * map.tileWidth +
          characterPixelWidth / 2 -
          activeDamageText.text.width / 2
      ),
      Math.round(
        character.position.y * map.tileHeight -
          activeDamageText.text.height -
          DAMAGE_TEXT_OFFSET_Y -
          floatOffset
      )
    )
    activeDamageText.container.alpha = 1 - progress
    activeDamageText.container.zIndex = getCharacterDepthSortValue(
      character.position.y,
      characterPixelHeight,
      map.tileHeight
    )
    messageLayer.sortChildren()
  }

  const syncActiveCharacterDamageTexts = (now: number) => {
    for (const characterId of activeCharacterDamageTexts.keys()) {
      syncCharacterDamageTextElement(characterId, now)
    }
  }

  const showCharacterDamageText = (
    characterId: string,
    message: string,
    durationMilliseconds: number,
    style: TextStyle = DAMAGE_TEXT_STYLE
  ) => {
    let activeDamageText = activeCharacterDamageTexts.get(characterId)

    if (!activeDamageText) {
      const container = new Container()
      const text = new Text({
        style: DAMAGE_TEXT_STYLE,
        text: ''
      })

      text.roundPixels = true
      container.addChild(text)
      messageLayer.addChild(container)
      activeDamageText = {
        container,
        text,
        startedAt: 0,
        durationMilliseconds,
        expiresAt: 0
      }
      activeCharacterDamageTexts.set(characterId, activeDamageText)
    }

    activeDamageText.text.style = style
    activeDamageText.text.text = message
    activeDamageText.startedAt = performance.now()
    activeDamageText.durationMilliseconds = durationMilliseconds
    activeDamageText.expiresAt =
      activeDamageText.startedAt + durationMilliseconds
    activeDamageText.container.alpha = 1
    syncCharacterDamageTextElement(characterId, activeDamageText.startedAt)
  }

  const pruneExpiredCharacterDamageTexts = (now: number) => {
    for (const [characterId, activeDamageText] of activeCharacterDamageTexts) {
      if (activeDamageText.expiresAt > now) {
        continue
      }

      activeDamageText.container.removeFromParent()
      activeDamageText.container.destroy({ children: true })
      activeCharacterDamageTexts.delete(characterId)
    }
  }

  return {
    showCharacterDamageText,
    syncActiveCharacterDamageTexts,
    pruneExpiredCharacterDamageTexts
  }
}
