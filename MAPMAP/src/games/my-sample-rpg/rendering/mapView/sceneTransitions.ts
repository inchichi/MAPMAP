// 장면 전환: 포탈·귀환 표지석의 장면 전환 요청, 플레이어가 닿은 포탈 찾기와 포탈 입장.
// 맵 화면의 상태는 ctx 로 받는다.
import type { PlayerProfile } from '../../playerProfile'
import type { GameEventQueue } from '../../events/createGameEventQueue'
import { PLAYER_CHARACTER_ID } from '../../characterState'
import type { CharacterAction, CharacterState } from '../../characterState'
import { type MapPortal } from '../../tiled/createMapPortalsFromEventLayers'
import { doCollisionRectsIntersect } from '../characterCollision'
import { createCollisionRectFromCharacter, createCollisionRectFromPortal } from './tiles'
import { type SceneTransitionRequest } from './types'

export type SceneTransitionsContext = {
  clearPressedInputState: () => void
  closeAllOverlays: () => boolean
  gameEventQueue: GameEventQueue
  getCharacterStateById: (characterId: string) => CharacterState
  mapPortals: MapPortal[]
  onRequestSceneChange: (request: SceneTransitionRequest) => void
  playerProfile: PlayerProfile
  stopPlayerFootsteps: () => void
  triggeredActions: Set<CharacterAction>
  getIsSceneTransitionPending: () => boolean
  setIsSceneTransitionPending: (value: boolean) => void
}

export const createSceneTransitions = (ctx: SceneTransitionsContext) => {
  const {
    clearPressedInputState,
    closeAllOverlays,
    gameEventQueue,
    getCharacterStateById,
    mapPortals,
    onRequestSceneChange,
    playerProfile,
    stopPlayerFootsteps,
    triggeredActions,
    getIsSceneTransitionPending,
    setIsSceneTransitionPending
  } = ctx

  const requestSceneTransition = (portal: MapPortal) => {
    requestSceneTransitionTo({
      sceneId: portal.targetSceneId,
      spawn: {
        x: portal.targetSpawn.x,
        y: portal.targetSpawn.y
      },
      facing: portal.targetFacing
    })
  }
  // 포탈·귀환 표지석이 같이 쓴다.
  function requestSceneTransitionTo(request: SceneTransitionRequest): void {
    if (getIsSceneTransitionPending()) {
      return
    }

    setIsSceneTransitionPending(true)
    closeAllOverlays()
    clearPressedInputState()
    stopPlayerFootsteps()
    triggeredActions.clear()
    gameEventQueue.clear()
    onRequestSceneChange(request)
  }
  const findTouchedMapPortal = (character: CharacterState): MapPortal | undefined => {
    const characterRect = createCollisionRectFromCharacter(character)

    return mapPortals.find((portal) =>
      doCollisionRectsIntersect(characterRect, createCollisionRectFromPortal(portal))
    )
  }
  const requestPlayerPortalTransition = (): boolean => {
    if (getIsSceneTransitionPending() || playerProfile.hp.current === 0) {
      return false
    }

    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
    const touchedPortal = findTouchedMapPortal(playerCharacter)

    if (!touchedPortal) {
      return false
    }

    requestSceneTransition(touchedPortal)
    return true
  }

  return {
    requestPlayerPortalTransition,
    requestSceneTransitionTo
  }
}
