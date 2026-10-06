import { describe, expect, it } from 'vitest'

import { filterSceneEntries, groupSceneEntries, pushRecentScene, type SceneSwitcherEntry } from './createSceneSwitcher'

const entries: SceneSwitcherEntry[] = [
  { id: 'town', label: '마을', icon: 'building', group: '1장' },
  { id: 'cave', label: '어스름 굴', icon: 'crystal', group: '1장' },
  { id: 'ice-cave-1f', label: '서리굴', icon: 'crystal', group: '3장' },
  { id: 'boss-arena', label: '시험장', icon: 'sword', group: '테스트' }
]

describe('scene switcher', () => {
  it('finds maps by label or id, ignoring case and spaces', () => {
    expect(filterSceneEntries(entries, ' 굴 ').map((entry) => entry.id)).toEqual(['cave', 'ice-cave-1f'])
    expect(filterSceneEntries(entries, 'BOSS').map((entry) => entry.id)).toEqual(['boss-arena'])
    expect(filterSceneEntries(entries, '')).toHaveLength(4)
    expect(filterSceneEntries(entries, '없는 맵')).toEqual([])
  })

  it('groups maps in list order', () => {
    expect(groupSceneEntries(entries).map(({ group, entries: groupEntries }) => [group, groupEntries.length])).toEqual([
      ['1장', 2],
      ['3장', 1],
      ['테스트', 1]
    ])
    expect(groupSceneEntries([{ id: 'a', label: 'A', icon: 'map' }])[0].group).toBe('')
  })

  it('keeps the latest map first without duplicates', () => {
    expect(pushRecentScene(['town', 'cave'], 'boss-arena', 3)).toEqual(['boss-arena', 'town', 'cave'])
    expect(pushRecentScene(['town', 'cave', 'boss-arena'], 'cave', 3)).toEqual(['cave', 'town', 'boss-arena'])
    expect(pushRecentScene(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b'])
  })
})
