import { describe, expect, it } from 'vitest'

import {
  STACKED_WINDOW_BASE_Z_INDEX,
  getStackedWindowZIndex,
  raiseWindowInOrder
} from './createWindowStack'

describe('window stack', () => {
  it('moves the raised window to the front without dropping others', () => {
    const order = ['.a', '.b', '.c']

    expect(raiseWindowInOrder(order, '.a')).toEqual(['.b', '.c', '.a'])
    expect(raiseWindowInOrder(order, '.c')).toEqual(order)
  })

  it('gives the front window the highest z-index, staying in the window band', () => {
    const order = raiseWindowInOrder(['.inventory', '.skill'], '.inventory')

    expect(getStackedWindowZIndex(order, '.inventory')).toBeGreaterThan(
      getStackedWindowZIndex(order, '.skill')
    )
    expect(getStackedWindowZIndex(order, '.skill')).toBe(STACKED_WINDOW_BASE_Z_INDEX)
  })
})
