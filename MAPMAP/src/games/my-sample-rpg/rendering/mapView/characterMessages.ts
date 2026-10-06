// 캐릭터 말풍선(NPC 한마디·이벤트 대사). 맵 화면의 상태는 ctx 로 받는다.
import type { ParsedTiledMap } from '../../tiled/parseTiledMap'
import {
  Container,
  NineSliceSprite,
  Text,
  Texture
} from 'pixi.js'
import type { CharacterState } from '../../characterState'
import { MESSAGE_OFFSET_Y, MESSAGE_PANEL_BORDER_SIZE, MESSAGE_PANEL_MIN_HEIGHT, MESSAGE_PANEL_MIN_WIDTH, MESSAGE_PANEL_PADDING_X, MESSAGE_PANEL_PADDING_Y, MESSAGE_TEXT_STYLE } from './constants'
import { getCharacterDepthSortValue } from './tiles'
import { type ActiveCharacterMessage } from './types'

export type CharacterMessagesContext = {
  map: ParsedTiledMap
  messageLayer: Container
  messagePanelTexture: Texture
  characterPixelWidth: number
  characterPixelHeight: number
  activeCharacterMessages: Map<string, ActiveCharacterMessage>
  getCharacterStates: () => CharacterState[]
}

export const createCharacterMessages = (ctx: CharacterMessagesContext) => {
  const {
    map,
    messageLayer,
    messagePanelTexture,
    characterPixelWidth,
    characterPixelHeight,
    activeCharacterMessages,
    getCharacterStates
  } = ctx



  const syncCharacterMessageElement = (characterId: string) => {
    const activeMessage = activeCharacterMessages.get(characterId)

    if (!activeMessage) {
      return
    }

    const character = getCharacterStates().find(
      (candidateCharacter) => candidateCharacter.id === characterId
    )

    if (!character) {
      activeMessage.container.removeFromParent()
      activeMessage.container.destroy({ children: true })
      activeCharacterMessages.delete(characterId)
      return
    }

    activeMessage.container.position.set(
      Math.round(
        character.position.x * map.tileWidth +
          characterPixelWidth / 2 -
          activeMessage.panel.width / 2
      ),
      Math.round(
        character.position.y * map.tileHeight -
          activeMessage.panel.height -
          MESSAGE_OFFSET_Y
      )
    )
    activeMessage.container.zIndex = getCharacterDepthSortValue(
      character.position.y,
      characterPixelHeight,
      map.tileHeight
    )
    messageLayer.sortChildren()
  }

  const syncActiveCharacterMessages = () => {
    for (const characterId of activeCharacterMessages.keys()) {
      syncCharacterMessageElement(characterId)
    }
  }

  const showCharacterMessage = (
    characterId: string,
    message: string,
    durationMilliseconds: number
  ) => {
    let activeMessage = activeCharacterMessages.get(characterId)

    if (!activeMessage) {
      const container = new Container()
      const panel = new NineSliceSprite({
        texture: messagePanelTexture,
        bottomHeight: MESSAGE_PANEL_BORDER_SIZE,
        leftWidth: MESSAGE_PANEL_BORDER_SIZE,
        rightWidth: MESSAGE_PANEL_BORDER_SIZE,
        topHeight: MESSAGE_PANEL_BORDER_SIZE
      })
      const text = new Text({
        style: MESSAGE_TEXT_STYLE,
        text: ''
      })

      panel.roundPixels = true
      text.roundPixels = true
      container.addChild(panel, text)
      messageLayer.addChild(container)
      activeMessage = {
        container,
        panel,
        text,
        expiresAt: 0
      }
      activeCharacterMessages.set(characterId, activeMessage)
    }

    activeMessage.text.text = message
    const panelWidth = Math.max(
      MESSAGE_PANEL_MIN_WIDTH,
      Math.ceil(activeMessage.text.width) + MESSAGE_PANEL_PADDING_X * 2
    )
    const panelHeight = Math.max(
      MESSAGE_PANEL_MIN_HEIGHT,
      Math.ceil(activeMessage.text.height) + MESSAGE_PANEL_PADDING_Y * 2
    )

    activeMessage.panel.setSize(panelWidth, panelHeight)
    activeMessage.text.position.set(
      Math.round((panelWidth - activeMessage.text.width) / 2),
      Math.round((panelHeight - activeMessage.text.height) / 2)
    )
    activeMessage.expiresAt = performance.now() + durationMilliseconds
    syncCharacterMessageElement(characterId)
  }

  const hideCharacterMessage = (characterId: string) => {
    const activeMessage = activeCharacterMessages.get(characterId)

    if (!activeMessage) {
      return
    }

    activeMessage.container.removeFromParent()
    activeMessage.container.destroy({ children: true })
    activeCharacterMessages.delete(characterId)
  }

  return {
    showCharacterMessage,
    hideCharacterMessage,
    syncActiveCharacterMessages
  }
}
