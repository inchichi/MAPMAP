// 보스전 체력바 — 보스와 싸움이 붙으면 화면 위 가운데(상태 표시줄 아래)에 칭호·이름과 긴 체력바를 띄운다.
// 쓰러지거나 싸움이 풀리면 사라진다. 분노(체력 절반 아래)면 막대가 붉게 맥동한다.

export type BossHealthView = {
  title?: string
  name: string
  hpRatio: number
  enraged: boolean
}

type CreateBossHealthOverlayInput = {
  mountElement: HTMLElement
  getBoss: () => BossHealthView | undefined
}

export const createBossHealthOverlay = ({ mountElement, getBoss }: CreateBossHealthOverlayInput) => {
  const root = document.createElement('div')
  root.className = 'boss-health-overlay'
  root.hidden = true
  const label = document.createElement('div')
  label.className = 'boss-health-overlay__label'
  const bar = document.createElement('div')
  bar.className = 'boss-health-overlay__bar'
  const fill = document.createElement('div')
  fill.className = 'boss-health-overlay__fill'
  bar.append(fill)
  root.append(label, bar)
  mountElement.append(root)
  let lastKey = ''

  const syncFrame = () => {
    const boss = getBoss()
    const key = boss ? `${boss.title}|${boss.name}|${boss.hpRatio.toFixed(3)}|${boss.enraged}` : ''
    if (key === lastKey) {
      return
    }
    lastKey = key
    root.hidden = !boss
    if (!boss) {
      return
    }
    label.textContent = boss.title ? `${boss.title} — ${boss.name}` : boss.name
    fill.style.width = `${Math.max(0, Math.min(1, boss.hpRatio)) * 100}%`
    root.classList.toggle('boss-health-overlay--enraged', boss.enraged)
  }

  return {
    syncFrame,
    destroy: () => root.remove()
  }
}
