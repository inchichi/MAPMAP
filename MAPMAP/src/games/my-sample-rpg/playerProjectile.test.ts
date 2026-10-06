import { describe, expect, it } from 'vitest'

import {
  createPlayerProjectile,
  getPlayerProjectileDirectionFromFacing,
  getPlayerProjectileHitRect,
  getPlayerProjectileRotation,
  PLAYER_PROJECTILE_MAX_TRAVEL_PIXELS,
  PLAYER_PROJECTILE_SPEED_PIXELS_PER_SECOND,
  selectPlayerMagicTarget,
  steerPlayerProjectileToward,
  stepPlayerProjectile
} from './playerProjectile'

describe('playerProjectile', () => {
  it('maps character facing to unit directions with a down fallback', () => {
    expect(getPlayerProjectileDirectionFromFacing('up')).toEqual({ x: 0, y: -1 })
    expect(getPlayerProjectileDirectionFromFacing('left')).toEqual({ x: -1, y: 0 })
    expect(getPlayerProjectileDirectionFromFacing('right')).toEqual({ x: 1, y: 0 })
    expect(getPlayerProjectileDirectionFromFacing('unknown')).toEqual({ x: 0, y: 1 })
  })

  it('integrates movement by speed and delta time', () => {
    const projectile = createPlayerProjectile({
      kind: 'arrow',
      originX: 100,
      originY: 50,
      direction: { x: 1, y: 0 }
    })

    const { next, expired } = stepPlayerProjectile(projectile, 100)

    expect(expired).toBe(false)
    expect(next.x).toBeCloseTo(
      100 + PLAYER_PROJECTILE_SPEED_PIXELS_PER_SECOND.arrow * 0.1
    )
    expect(next.y).toBe(50)
    expect(next.traveledPixels).toBeCloseTo(
      PLAYER_PROJECTILE_SPEED_PIXELS_PER_SECOND.arrow * 0.1
    )
  })

  it('clamps the final step to max travel and reports expiry exactly at range', () => {
    let projectile = createPlayerProjectile({
      kind: 'energy-ball',
      originX: 0,
      originY: 0,
      direction: { x: 0, y: 1 }
    })

    // 아주 큰 델타 한 방 — 사거리 밖으로 나가지 않고 정확히 사거리에서 멈춘다.
    const { next, expired } = stepPlayerProjectile(projectile, 60_000)

    expect(expired).toBe(true)
    expect(next.traveledPixels).toBe(
      PLAYER_PROJECTILE_MAX_TRAVEL_PIXELS['energy-ball']
    )
    expect(next.y).toBe(PLAYER_PROJECTILE_MAX_TRAVEL_PIXELS['energy-ball'])
  })

  it('builds a pixel hit rect centered on the projectile', () => {
    const projectile = createPlayerProjectile({
      kind: 'energy-ball',
      originX: 40,
      originY: 60,
      direction: { x: 1, y: 0 }
    })

    expect(getPlayerProjectileHitRect(projectile)).toEqual({
      x: 30,
      y: 50,
      width: 20,
      height: 20
    })
  })

  it('rotates directional visuals toward the travel direction', () => {
    expect(getPlayerProjectileRotation({ x: 1, y: 0 })).toBe(0)
    expect(getPlayerProjectileRotation({ x: 0, y: 1 })).toBeCloseTo(Math.PI / 2)
    expect(getPlayerProjectileRotation({ x: -1, y: 0 })).toBeCloseTo(Math.PI)
  })

  it('targets the nearest monster inside the magic range', () => {
    const target = selectPlayerMagicTarget({
      originX: 0,
      originY: 0,
      facing: 'right',
      candidates: [
        { id: 'far', x: 200, y: 0 },
        { id: 'near', x: 0, y: 80 },
        { id: 'out', x: 400, y: 0 }
      ]
    })

    expect(target?.id).toBe('near')
  })

  it('returns no target when every monster is out of range', () => {
    expect(
      selectPlayerMagicTarget({
        originX: 0,
        originY: 0,
        facing: 'down',
        candidates: [{ id: 'out', x: 0, y: 300 }]
      })
    ).toBeUndefined()
  })

  it('breaks distance ties toward the facing direction', () => {
    const target = selectPlayerMagicTarget({
      originX: 0,
      originY: 0,
      facing: 'left',
      candidates: [
        { id: 'a-behind', x: 64, y: 0 },
        { id: 'z-ahead', x: -64, y: 0 }
      ]
    })

    expect(target?.id).toBe('z-ahead')
  })

  it('turns an energy bolt toward its target by a bounded angle', () => {
    const bolt = createPlayerProjectile({
      kind: 'energy-bolt',
      originX: 0,
      originY: 0,
      direction: { x: 1, y: 0 }
    })

    const partial = steerPlayerProjectileToward(bolt, 0, 100, 100, 7)
    expect(Math.atan2(partial.direction.y, partial.direction.x)).toBeCloseTo(0.7)
    expect(Math.hypot(partial.direction.x, partial.direction.y)).toBeCloseTo(1)

    const full = steerPlayerProjectileToward(bolt, 0, 100, 1000, 7)
    expect(full.direction.x).toBeCloseTo(0)
    expect(full.direction.y).toBeCloseTo(1)
  })
})
