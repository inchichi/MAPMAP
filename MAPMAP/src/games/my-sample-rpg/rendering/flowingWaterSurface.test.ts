import { describe, expect, it } from 'vitest'

import { classifyWaterFlowDirections, type WaterCell } from './flowingWaterSurface'

const rect = (x: number, y: number, width: number, height: number): WaterCell[] =>
  Array.from({ length: width * height }, (_, index) => ({
    x: x + (index % width),
    y: y + Math.floor(index / width)
  }))

describe('classifyWaterFlowDirections', () => {
  it('keeps a whole pond still, even its narrow arms', () => {
    // 8x8 못 + 아래로 6칸 내려가는 2칸 폭 귀퉁이
    const cells = [...rect(0, 0, 8, 8), ...rect(3, 8, 2, 6)]

    expect(classifyWaterFlowDirections(cells).every((flow) => flow.x === 0 && flow.y === 0)).toBe(true)
  })

  it('still lets a long narrow stream flow downstream', () => {
    const cells = rect(5, 0, 2, 12)
    const directions = classifyWaterFlowDirections(cells)

    expect(directions.every((flow) => flow.x === 0 && flow.y === 1)).toBe(true)
  })
})
