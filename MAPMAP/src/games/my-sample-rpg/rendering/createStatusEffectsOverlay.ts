// 화면 위쪽 가운데의 작은 상태 표시줄 — 지금은 2장 독안개용: 해독 향이 타는 동안 남은 시간(초록), 향 없이
// 독안개 속에 있을 때 경고(빨강). HUD 아래 칸은 꽉 차 있어 따로 띄운다.

export type StatusEffectPill = {
  kind: 'buff' | 'danger'
  text: string
}

type CreateStatusEffectsOverlayInput = {
  mountElement: HTMLElement
  getPills: () => StatusEffectPill[]
}

export const createStatusEffectsOverlay = ({ mountElement, getPills }: CreateStatusEffectsOverlayInput) => {
  const root = document.createElement('div')
  root.className = 'status-effects-overlay'
  mountElement.append(root)
  let lastKey = ''

  const syncFrame = () => {
    const pills = getPills()
    const key = pills.map((pill) => `${pill.kind}:${pill.text}`).join('|')
    if (key === lastKey) {
      return
    }
    lastKey = key
    root.replaceChildren(
      ...pills.map((pill) => {
        const element = document.createElement('span')
        element.className = `status-effects-overlay__pill status-effects-overlay__pill--${pill.kind}`
        element.textContent = pill.text
        return element
      })
    )
  }

  return {
    syncFrame,
    destroy: () => root.remove()
  }
}
