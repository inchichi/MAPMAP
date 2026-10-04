import { describe, expect, it } from 'vitest'
import { styleWorkspaceContext } from './styleWorkspaceContext'

describe('style workspace map context', () => {
  it('routes harvest village to document planning and returns to the same map', () => {
    const context = styleWorkspaceContext('?workspace=style&map=harvest-village')
    expect(context.crypt).toBe(false)
    expect(context.editorUrl).toBe('/editor.html?game=my-sample-rpg&map=harvest-village')
  })
  it('defaults to the previous Crypt ruins editor, never the town demo', () => {
    expect(styleWorkspaceContext('?workspace=style').editorUrl).toBe('/editor.html?game=crypt&map=floor-1-ruins')
  })
  it('keeps the selected Crypt floor when returning to the editor', () => {
    expect(styleWorkspaceContext('?workspace=style&game=crypt&map=floor-0-town').activeUrl).toBe('/crypt-style/active.json')
  })
  it('requires an explicit town map to use town controls', () => {
    expect(styleWorkspaceContext('?workspace=style&map=town').crypt).toBe(false)
  })
})
