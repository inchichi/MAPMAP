import { describe, expect, it } from 'vitest'

import { PLAYER_ATTACK_DURATION_MILLISECONDS } from '../constants'
import { createFrontHitRect, isMeleeMotionHitWindowOpen, type MeleeMotionOrigin } from './meleeMotion'
import { CLEAVE_MOTION } from './cleave'
import { QUICK_SLASH_MOTION } from './quickSlash'

const createOrigin = (directionX: number, directionY: number): MeleeMotionOrigin => ({
  x: 100,
  y: 100,
  bodyWidth: 16,
  bodyHeight: 16,
  directionX,
  directionY,
  tileWidth: 16,
  tileHeight: 16
})

describe('isMeleeMotionHitWindowOpen', () => {
  it('opens at the motion hit start and closes shortly after the attack motion ends', () => {
    const hitStart = PLAYER_ATTACK_DURATION_MILLISECONDS * CLEAVE_MOTION.hitStartProgress

    expect(isMeleeMotionHitWindowOpen(CLEAVE_MOTION, hitStart - 1)).toBe(false)
    expect(isMeleeMotionHitWindowOpen(CLEAVE_MOTION, hitStart)).toBe(true)
    expect(isMeleeMotionHitWindowOpen(CLEAVE_MOTION, PLAYER_ATTACK_DURATION_MILLISECONDS + 50)).toBe(true)
    expect(isMeleeMotionHitWindowOpen(CLEAVE_MOTION, PLAYER_ATTACK_DURATION_MILLISECONDS + 100)).toBe(false)
  })

  it('lets the dagger attack again sooner than the axe', () => {
    expect(QUICK_SLASH_MOTION.cooldownMilliseconds).toBeLessThan(CLEAVE_MOTION.cooldownMilliseconds)
  })
})

describe('createFrontHitRect', () => {
  it('puts the area in front of a right-facing player', () => {
    expect(createFrontHitRect(createOrigin(1, 0), 0.5, 1, 2)).toEqual({ x: 108, y: 84, width: 16, height: 32 })
  })

  it('swaps depth and width for an up-facing player', () => {
    expect(createFrontHitRect(createOrigin(0, -1), 0.5, 1, 2)).toEqual({ x: 84, y: 76, width: 32, height: 16 })
  })
})
