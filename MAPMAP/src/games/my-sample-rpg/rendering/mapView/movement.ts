// 이동·충돌·카메라: 카메라를 캐릭터에 맞추기, 막는 충돌 사각형, 모서리 보정, 캐릭터 이동 시도.
// 맵 화면의 상태는 ctx 로 받는다.
import type { ParsedTiledMap } from '../../tiled/parseTiledMap'
import type { CharacterState } from '../../characterState'
import { moveCharacterState } from '../../lua/luaGameLogic'
import { isCharacterPositionBlocked, resolveCornerAssistNudge, type CollisionRect } from '../characterCollision'
import { clampScrollOffset, createCollisionRectFromCharacter } from './tiles'

export type MovementContext = {
  cameraTargetCharacterId: string
  characterPixelHeight: number
  characterPixelWidth: number
  getCharacterStateById: (characterId: string) => CharacterState
  isMonsterCharacter: (character: CharacterState) => boolean
  map: ParsedTiledMap
  syncCharacterSprite: (character: CharacterState, now?: number) => void
  viewportElement: HTMLDivElement
  wallTiles: Set<string>
  getCameraZoom: () => number
  getScaledMapPixelHeight: () => number
  getScaledMapPixelWidth: () => number
  // 카메라 왼쪽 위(화면 픽셀). world 를 그만큼 반대로 옮긴다.
  setCameraOffset: (x: number, y: number) => void
  getCharacterStates: () => CharacterState[]
  setCharacterStates: (value: CharacterState[]) => void
}

export const createMovement = (ctx: MovementContext) => {
  const {
    cameraTargetCharacterId,
    characterPixelHeight,
    characterPixelWidth,
    getCharacterStateById,
    isMonsterCharacter,
    map,
    syncCharacterSprite,
    viewportElement,
    wallTiles,
    getCameraZoom,
    getScaledMapPixelHeight,
    getScaledMapPixelWidth,
    setCameraOffset,
    getCharacterStates,
    setCharacterStates
  } = ctx

  const centerCameraOnCharacter = (character: CharacterState) => {
    const characterCenterX =
      (character.position.x * map.tileWidth + characterPixelWidth / 2) *
      getCameraZoom()
    const characterCenterY =
      (character.position.y * map.tileHeight + characterPixelHeight / 2) *
      getCameraZoom()
    const nextScrollLeft = clampScrollOffset(
      characterCenterX - viewportElement.clientWidth / 2,
      getScaledMapPixelWidth() - viewportElement.clientWidth
    )
    const nextScrollTop = clampScrollOffset(
      characterCenterY - viewportElement.clientHeight / 2,
      getScaledMapPixelHeight() - viewportElement.clientHeight
    )

    setCameraOffset(nextScrollLeft, nextScrollTop)
  }

  const getBlockingCollisionRects = (
    excludedCharacterId: string,
    options: {
      ignoreMonsters?: boolean
    } = {}
  ): CollisionRect[] =>
    getCharacterStates()
      .filter(
        (character) =>
          character.blocksMovement &&
          character.id !== excludedCharacterId &&
          !(options.ignoreMonsters === true && isMonsterCharacter(character))
      )
      .map((character) => createCollisionRectFromCharacter(character))

  // 막힌 축과 직각으로 살짝 정렬시켜 한 칸 통로에 걸리지 않게 한다.
  const applyCornerAssist = (
    character: CharacterState,
    deltaX: number,
    deltaY: number,
    blockingRects: CollisionRect[]
  ): CharacterState => {
    const nudge = resolveCornerAssistNudge({
      wallTiles,
      blockingRects,
      x: character.position.x,
      y: character.position.y,
      width: character.collisionSize.width,
      height: character.collisionSize.height,
      deltaX,
      deltaY
    })

    if (!nudge) {
      return character
    }

    return moveCharacterState({
      character,
      delta: {
        x: nudge.axis === 'x' ? nudge.amount : 0,
        y: nudge.axis === 'y' ? nudge.amount : 0
      },
      mapWidth: map.width,
      mapHeight: map.height
    })
  }

  const tryMoveCharacter = (
    characterId: string,
    deltaX: number,
    deltaY: number,
    options: {
      preserveFacing?: boolean
      ignoreMonsterBlocking?: boolean
      // 한 칸 통로에 들어갈 때 격자에 자동 정렬시킨다(플레이어 조작 이동에만).
      cornerAssist?: boolean
    } = {}
  ): boolean => {
    const currentCharacter = getCharacterStateById(characterId)
    const desiredFacing = moveCharacterState({
      character: currentCharacter,
      delta: {
        x: deltaX,
        y: deltaY
      },
      mapWidth: map.width,
      mapHeight: map.height
    }).facing
    const nextFacing = options.preserveFacing
      ? currentCharacter.facing
      : desiredFacing
    const blockingRects = getBlockingCollisionRects(characterId, {
      ignoreMonsters: options.ignoreMonsterBlocking
    })
    let nextCharacter =
      nextFacing === currentCharacter.facing
        ? currentCharacter
        : {
            ...currentCharacter,
            facing: nextFacing
          }

    if (deltaX !== 0) {
      const nextXCharacter = moveCharacterState({
        character: nextCharacter,
        delta: {
          x: deltaX,
          y: 0
        },
        mapWidth: map.width,
        mapHeight: map.height
      })

      if (
        !isCharacterPositionBlocked(
          wallTiles,
          blockingRects,
          nextXCharacter.position.x,
          nextXCharacter.position.y,
          nextXCharacter.collisionSize.width,
          nextXCharacter.collisionSize.height
        )
      ) {
        nextCharacter = nextXCharacter
      } else if (options.cornerAssist) {
        nextCharacter = applyCornerAssist(nextCharacter, deltaX, deltaY, blockingRects)
      }
    }

    if (deltaY !== 0) {
      const nextYCharacter = moveCharacterState({
        character: nextCharacter,
        delta: {
          x: 0,
          y: deltaY
        },
        mapWidth: map.width,
        mapHeight: map.height
      })

      if (
        !isCharacterPositionBlocked(
          wallTiles,
          blockingRects,
          nextYCharacter.position.x,
          nextYCharacter.position.y,
          nextYCharacter.collisionSize.width,
          nextYCharacter.collisionSize.height
        )
      ) {
        nextCharacter = nextYCharacter
      } else if (options.cornerAssist) {
        nextCharacter = applyCornerAssist(nextCharacter, deltaX, deltaY, blockingRects)
      }
    }

    if (options.preserveFacing) {
      nextCharacter = {
        ...nextCharacter,
        facing: currentCharacter.facing
      }
    } else if (nextCharacter.facing !== desiredFacing) {
      nextCharacter = {
        ...nextCharacter,
        facing: desiredFacing
      }
    }

    if (
      nextCharacter.position.x === currentCharacter.position.x &&
      nextCharacter.position.y === currentCharacter.position.y &&
      nextCharacter.facing === currentCharacter.facing
    ) {
      return false
    }

    setCharacterStates(getCharacterStates().map((character) =>
      character.id === nextCharacter.id ? nextCharacter : character
    ))

    const didPositionChange =
      nextCharacter.position.x !== currentCharacter.position.x ||
      nextCharacter.position.y !== currentCharacter.position.y
    const didFacingChange = nextCharacter.facing !== currentCharacter.facing

    if (didPositionChange || didFacingChange) {
      syncCharacterSprite(nextCharacter)
    }

    if (nextCharacter.id === cameraTargetCharacterId && didPositionChange) {
      centerCameraOnCharacter(nextCharacter)
    }

    return didPositionChange
  }

  return {
    centerCameraOnCharacter,
    getBlockingCollisionRects,
    tryMoveCharacter
  }
}
