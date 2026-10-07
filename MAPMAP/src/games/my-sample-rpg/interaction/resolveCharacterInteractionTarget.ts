import type { CharacterState } from '../characterState'

type Rect = {
  x: number
  y: number
  width: number
  height: number
}

type ResolveCharacterInteractionTargetInput = {
  sourceCharacter: CharacterState
  targetCharacters: CharacterState[]
  canReceiveInteraction: (character: CharacterState) => boolean
  interactionProbeDistanceInTiles?: number
  // 바라보는 방향의 옆으로 더 넓히는 폭(칸). 공격은 대화보다 넓게 잡는다.
  interactionProbePaddingInTiles?: number
}

const DEFAULT_INTERACTION_PROBE_DISTANCE_IN_TILES = 0.35
const DEFAULT_INTERACTION_PROBE_PADDING_IN_TILES = 0.15

export const resolveCharacterInteractionTarget = ({
  sourceCharacter,
  targetCharacters,
  canReceiveInteraction,
  interactionProbeDistanceInTiles = DEFAULT_INTERACTION_PROBE_DISTANCE_IN_TILES,
  interactionProbePaddingInTiles = DEFAULT_INTERACTION_PROBE_PADDING_IN_TILES
}: ResolveCharacterInteractionTargetInput): CharacterState | undefined => {
  const probeRect = createInteractionProbeRect(
    sourceCharacter,
    interactionProbeDistanceInTiles,
    interactionProbePaddingInTiles
  )
  const probeCenter = getRectCenter(probeRect)

  return targetCharacters
    .filter(
      (targetCharacter) =>
        targetCharacter.id !== sourceCharacter.id &&
        canReceiveInteraction(targetCharacter) &&
        doRectsIntersect(probeRect, createCharacterRect(targetCharacter))
    )
    .sort((leftCharacter, rightCharacter) => {
      const leftDistance = getDistanceSquared(
        probeCenter,
        getRectCenter(createCharacterRect(leftCharacter))
      )
      const rightDistance = getDistanceSquared(
        probeCenter,
        getRectCenter(createCharacterRect(rightCharacter))
      )

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance
      }

      return leftCharacter.id.localeCompare(rightCharacter.id)
    })[0]
}

const createCharacterRect = (character: CharacterState): Rect => ({
  x: character.position.x,
  y: character.position.y,
  width: character.collisionSize.width,
  height: character.collisionSize.height
})

const createInteractionProbeRect = (
  character: CharacterState,
  interactionProbeDistanceInTiles: number,
  paddingInTiles: number
): Rect => {
  switch (character.facing) {
    case 'up':
      return {
        x: character.position.x - paddingInTiles,
        y: character.position.y - interactionProbeDistanceInTiles,
        width:
          character.collisionSize.width +
          paddingInTiles * 2,
        height: interactionProbeDistanceInTiles
      }
    case 'down':
      return {
        x: character.position.x - paddingInTiles,
        y: character.position.y + character.collisionSize.height,
        width:
          character.collisionSize.width +
          paddingInTiles * 2,
        height: interactionProbeDistanceInTiles
      }
    case 'left':
      return {
        x: character.position.x - interactionProbeDistanceInTiles,
        y: character.position.y - paddingInTiles,
        width: interactionProbeDistanceInTiles,
        height:
          character.collisionSize.height +
          paddingInTiles * 2
      }
    case 'right':
      return {
        x: character.position.x + character.collisionSize.width,
        y: character.position.y - paddingInTiles,
        width: interactionProbeDistanceInTiles,
        height:
          character.collisionSize.height +
          paddingInTiles * 2
      }
  }
}

const doRectsIntersect = (leftRect: Rect, rightRect: Rect): boolean =>
  leftRect.x < rightRect.x + rightRect.width &&
  leftRect.x + leftRect.width > rightRect.x &&
  leftRect.y < rightRect.y + rightRect.height &&
  leftRect.y + leftRect.height > rightRect.y

const getRectCenter = (rect: Rect): { x: number; y: number } => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2
})

const getDistanceSquared = (
  leftPoint: { x: number; y: number },
  rightPoint: { x: number; y: number }
): number => {
  const deltaX = leftPoint.x - rightPoint.x
  const deltaY = leftPoint.y - rightPoint.y

  return deltaX * deltaX + deltaY * deltaY
}
