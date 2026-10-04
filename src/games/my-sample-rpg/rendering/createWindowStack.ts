// 여러 창(가방·장비·스탯·스킬·퀘스트·상점)을 함께 띄울 때, 마지막으로 열거나 누른 창이 맨 앞에 오게 한다.
// 창들은 모두 화면 가운데에 뜨므로, 쌓는 순서가 없으면 나중에 연 창이 먼저 연 창을 가린 채 고정된다.
export const STACKED_WINDOW_ROOT_SELECTORS = [
  '.player-inventory-overlay',
  '.player-equipment-overlay',
  '.player-stat-overlay',
  '.player-skill-overlay',
  '.quest-log-overlay',
  '.blacksmith-shop-overlay'
] as const

// HUD(45)보다 위, 대화창(68)·일시정지 메뉴(70)보다 아래.
export const STACKED_WINDOW_BASE_Z_INDEX = 50

export const raiseWindowInOrder = (
  order: readonly string[],
  selector: string
): string[] => [...order.filter((entry) => entry !== selector), selector]

export const getStackedWindowZIndex = (
  order: readonly string[],
  selector: string
): number => STACKED_WINDOW_BASE_Z_INDEX + Math.max(0, order.indexOf(selector))

export const createWindowStack = (mountElement: HTMLElement) => {
  let order: string[] = [...STACKED_WINDOW_ROOT_SELECTORS]

  const applyZIndexes = () => {
    for (const selector of order) {
      for (const root of mountElement.querySelectorAll<HTMLElement>(selector)) {
        root.style.zIndex = String(getStackedWindowZIndex(order, selector))
      }
    }
  }

  const raise = (selector: string) => {
    order = raiseWindowInOrder(order, selector)
    applyZIndexes()
  }

  // 창 안을 누르면 그 창을 앞으로. 캡처 단계라 창 안의 stopPropagation 과 상관없이 받는다.
  const handlePointerDown = (event: PointerEvent) => {
    if (!(event.target instanceof Element)) {
      return
    }

    const selector = STACKED_WINDOW_ROOT_SELECTORS.find((candidate) =>
      event.target instanceof Element && event.target.closest(candidate)
    )

    if (selector) {
      raise(selector)
    }
  }

  mountElement.addEventListener('pointerdown', handlePointerDown, true)
  applyZIndexes()

  return {
    raise,
    destroy: () => {
      mountElement.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }
}
