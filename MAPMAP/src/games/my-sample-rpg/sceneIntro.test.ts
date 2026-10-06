import { describe, expect, it } from 'vitest'

import { getSceneIntroMessage } from './sceneIntro'

describe('getSceneIntroMessage', () => {
  it('returns the town intro text', () => {
    expect(getSceneIntroMessage('town')).toBe('느티골')
  })

  it('returns the hunting ground intro text', () => {
    expect(getSceneIntroMessage('hunting-ground')).toBe('말캉이 숲')
  })

  it('returns the cave intro text', () => {
    expect(getSceneIntroMessage('cave')).toBe('어스름 굴')
  })

  it('returns an empty string for unknown scenes', () => {
    expect(getSceneIntroMessage('unknown-scene')).toBe('')
  })
})
