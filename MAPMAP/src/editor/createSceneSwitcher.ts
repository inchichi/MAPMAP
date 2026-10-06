// 게임 미리보기 위 맵 전환기 — 맵이 아무리 많아도 한 줄에 들어가게, 최근 맵 몇 개만 탭으로 두고
// 나머지는 검색되는 드롭다운(장별로 묶음)에서 고른다. 어떤 맵으로 갈지는 onSelect 를 받은 쪽이 정한다.
import { editorIcon, type EditorIconName } from './editorIcons'
import { readLocalStorage, writeLocalStorage } from './safeStorage'

export type SceneSwitcherEntry = {
  id: string
  label: string
  icon: EditorIconName
  // 드롭다운에서 묶어 보여 줄 이름(예: '1장'). 없으면 머리글 없이 보인다.
  group?: string
}

export type SceneGroup = { group: string; entries: SceneSwitcherEntry[] }

const RECENT_SCENE_LIMIT = 3

// 이름·id 어느 쪽에 검색어가 들어 있어도 찾는다(대소문자·앞뒤 공백 무시).
export const filterSceneEntries = (
  entries: readonly SceneSwitcherEntry[],
  query: string
): SceneSwitcherEntry[] => {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return [...entries]
  }
  return entries.filter(
    (entry) => entry.label.toLowerCase().includes(needle) || entry.id.toLowerCase().includes(needle)
  )
}

// 처음 나온 순서대로 묶는다(목록 순서가 곧 장 순서).
export const groupSceneEntries = (entries: readonly SceneSwitcherEntry[]): SceneGroup[] => {
  const groups: SceneGroup[] = []
  for (const entry of entries) {
    const name = entry.group ?? ''
    const group = groups.find((candidate) => candidate.group === name)
    if (group) {
      group.entries.push(entry)
    } else {
      groups.push({ group: name, entries: [entry] })
    }
  }
  return groups
}

// 방금 간 맵을 맨 앞에 두고, 겹치면 빼고, 개수를 자른다.
export const pushRecentScene = (recent: readonly string[], id: string, limit: number): string[] =>
  [id, ...recent.filter((recentId) => recentId !== id)].slice(0, limit)

const TAB =
  'h-[26px] shrink-0 flex items-center gap-1.5 text-[14px] leading-none rounded-lg px-3 py-1 bg-[#1a1a1c] border border-[#3c3c3c] text-[#9d9d9d] transition hover:bg-[#242427] hover:text-[#d4d4d4]'
const TAB_ACTIVE =
  'h-[26px] shrink-0 flex items-center gap-1.5 text-[14px] leading-none rounded-lg px-3 py-1 bg-[#a8adb5] border border-[#878d96] text-[#1c1d20] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition'
const OPTION =
  'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-[#d4d7dc] hover:bg-[#2a3346]'
const OPTION_ACTIVE =
  'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-[#1c1d20] bg-[#a8adb5]'

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) {
    node.textContent = text
  }
  return node
}

export const createSceneSwitcher = (options: { onSelect: (entry: SceneSwitcherEntry) => void }) => {
  const element = el('div', 'flex items-center justify-end gap-1 min-w-0')
  const recentTabs = el('div', 'flex items-center gap-1 min-w-0 overflow-hidden')
  const toggle = el('button', `${TAB_ACTIVE} max-w-[200px]`) as HTMLButtonElement
  toggle.type = 'button'
  toggle.title = '맵 고르기'
  element.append(recentTabs, toggle)

  // 드롭다운은 툴바 밖(body)에 띄운다 — 툴바가 넘치는 내용을 자르더라도 가려지지 않게.
  const panel = el(
    'div',
    'fixed z-[1000] w-[260px] max-h-[60vh] flex flex-col rounded-lg border border-[#3c4658] bg-[#181f2c] shadow-xl'
  )
  panel.hidden = true
  const search = el(
    'input',
    'm-2 rounded-md border border-[#3c4658] bg-[#10151f] px-2 py-1.5 text-[13px] text-[#e5e7eb] outline-none focus:border-[#7a8aa8]'
  ) as HTMLInputElement
  search.type = 'search'
  search.placeholder = '맵 검색…'
  const list = el('div', 'flex-1 overflow-y-auto px-2 pb-2')
  panel.append(search, list)
  document.body.append(panel)

  let entries: SceneSwitcherEntry[] = []
  let activeId: string | undefined
  let storageKey = ''
  let recentIds: string[] = []

  const select = (entry: SceneSwitcherEntry): void => {
    close()
    options.onSelect(entry)
  }

  const renderList = (): void => {
    const groups = groupSceneEntries(filterSceneEntries(entries, search.value))
    if (groups.length === 0) {
      list.replaceChildren(el('div', 'px-2 py-3 text-[12px] text-[#9da9bc]', '맞는 맵이 없어요'))
      return
    }
    list.replaceChildren(
      ...groups.flatMap(({ group, entries: groupEntries }) => [
        ...(group ? [el('div', 'px-2 pt-2 pb-1 text-[11px] font-bold text-[#9da9bc]', group)] : []),
        ...groupEntries.map((entry) => {
          const option = el('button', entry.id === activeId ? OPTION_ACTIVE : OPTION) as HTMLButtonElement
          option.type = 'button'
          option.append(editorIcon(entry.icon, 12), el('span', 'truncate', entry.label))
          option.addEventListener('click', () => select(entry))
          return option
        })
      ])
    )
  }

  const renderTabs = (): void => {
    const active = entries.find((entry) => entry.id === activeId)
    toggle.replaceChildren(
      ...(active ? [editorIcon(active.icon, 12)] : []),
      el('span', 'truncate', active?.label ?? `맵 ${entries.length}개`),
      el('span', 'text-[10px] opacity-70', '▾')
    )
    // 최근 맵 탭: 지금 맵은 드롭다운 단추가 보여 주므로 빼고 나머지만
    recentTabs.replaceChildren(
      ...recentIds
        .filter((id) => id !== activeId)
        .flatMap((id) => entries.filter((entry) => entry.id === id))
        .map((entry) => {
          const tab = el('button', TAB) as HTMLButtonElement
          tab.type = 'button'
          tab.title = '최근 맵'
          tab.append(editorIcon(entry.icon, 12), el('span', '', entry.label))
          tab.addEventListener('click', () => select(entry))
          return tab
        })
    )
  }

  const open = (): void => {
    const rect = toggle.getBoundingClientRect()
    panel.style.top = `${rect.bottom + 4}px`
    panel.style.left = `${Math.max(8, rect.right - 260)}px`
    search.value = ''
    renderList()
    panel.hidden = false
    search.focus()
  }

  function close(): void {
    panel.hidden = true
  }

  toggle.addEventListener('click', () => (panel.hidden ? open() : close()))
  search.addEventListener('input', renderList)
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      close()
      return
    }
    if (event.key === 'Enter') {
      const first = filterSceneEntries(entries, search.value)[0]
      if (first) {
        select(first)
      }
    }
  })
  document.addEventListener('pointerdown', (event) => {
    const target = event.target as Node
    if (!panel.hidden && !panel.contains(target) && !toggle.contains(target)) {
      close()
    }
  })

  return {
    element,
    // 게임이 바뀌면 맵 목록과 최근 맵(게임마다 따로 저장)을 다시 잡는다.
    setEntries: (gameId: string, nextEntries: SceneSwitcherEntry[]): void => {
      entries = nextEntries
      storageKey = `editor:recent-scenes:${gameId}`
      const stored = readLocalStorage(storageKey)
      let parsed: unknown = []
      try {
        parsed = stored ? JSON.parse(stored) : []
      } catch {
        parsed = []
      }
      recentIds = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
      activeId = undefined
      close()
      renderTabs()
    },
    // 지금 맵(게임이 되보고한 맵)을 표시하고 최근 맵에 올린다.
    setActive: (id: string | undefined): void => {
      if (id === activeId) {
        return
      }
      activeId = id
      if (id && entries.some((entry) => entry.id === id)) {
        recentIds = pushRecentScene(recentIds, id, RECENT_SCENE_LIMIT + 1)
        writeLocalStorage(storageKey, JSON.stringify(recentIds))
      }
      renderTabs()
    }
  }
}
