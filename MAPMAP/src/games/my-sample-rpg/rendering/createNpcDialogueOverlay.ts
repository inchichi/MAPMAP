// 비주얼노벨 스타일 NPC 대화 오버레이.
// 게임 화면(960x540 뷰포트) 위에 정확히 겹쳐 그 크기에 비례해 커진다 — 큰 모니터에서도 같은 비율.
// 하단에 나무 액자 대사창(불투명), 그 위에 초상화가 서고, 이름표는 대사창 왼쪽 위 테두리에 걸친다.
// 대사는 한 줄씩 보여주고 클릭/Space/Enter 로 다음 줄로 넘어가며, 마지막 줄에서 더 넘기면
// 닫히고 onComplete 가 호출된다. DOM + 인라인 스타일로 자급자족하며 게임 styles.css 에 의존하지 않는다.

const STYLE_ELEMENT_ID = 'npc-dialogue-overlay-style'

// blink 애니메이션 등 인라인 style 로 표현하기 번거로운 것만 한 번 주입한다.
const ensureStyleInjected = () => {
  if (document.getElementById(STYLE_ELEMENT_ID)) {
    return
  }
  const style = document.createElement('style')
  style.id = STYLE_ELEMENT_ID
  style.textContent = `
@keyframes npc-dialogue-advance-blink {
  0%, 100% { opacity: 0.25; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(3px); }
}
.npc-dialogue-overlay__advance {
  animation: npc-dialogue-advance-blink 1.1s ease-in-out infinite;
}
.npc-dialogue-overlay__portrait {
  transition: opacity 220ms ease, transform 220ms ease;
}
.npc-dialogue-overlay__choice {
  transition: background-color 120ms ease, transform 120ms ease;
}
.npc-dialogue-overlay__choice:hover {
  background-color: #fbe8c4;
}
.npc-dialogue-overlay__choice:active {
  transform: translateY(1px);
}
.npc-dialogue-overlay__choice:focus-visible {
  outline: 2px solid #6d4b27;
  outline-offset: 1px;
}
`
  document.head.append(style)
}

type ShowNpcDialogueInput = {
  portraitUrl: string
  // 작은 픽셀 아트 초상화(LPC 전신) — 흐려지지 않게 픽셀 그대로 키운다.
  pixelArtPortrait?: boolean
  name: string
  lines: string[]
  // 마지막 줄에서 함께 뜨는 선택지 라벨. 있으면 그 줄에서는 넘겨서 닫을 수 없고,
  // 클릭 또는 숫자키(1~4)로 하나를 골라야 한다. 고르면 닫히고 onChoice(index)가 호출된다.
  choices?: string[]
  onChoice?: (choiceIndex: number) => void
  onComplete?: () => void
}

export type NpcDialogueOverlay = {
  show: (input: ShowNpcDialogueInput) => void
  hide: () => void
  isOpen: () => boolean
  destroy: () => void
}

type CreateNpcDialogueOverlayInput = {
  mountElement: HTMLElement
  // 게임 화면(뷰포트) 요소 — 대화창을 이 영역에 맞춰 띄운다(창 전체가 아니라).
  getViewportElement: () => HTMLElement
}

// 게임 화면 높이 540 기준 글자 크기(px). 실제 크기는 화면 배율만큼 커진다.
const BASE_FONT_PIXELS = 16
const VIEWPORT_DESIGN_HEIGHT = 540

// 가방·장비·스킬 창과 같은 나무 액자 팔레트
const PAPER = '#fff1d2'
const PAPER_LIGHT = '#fff6e0'
const WOOD_DARK = '#6d4b27'
const WOOD = '#c58747'
const WOOD_DEEP = '#a3703a'
const TEXT_DARK = '#4a3218'
const LABEL_BROWN = '#8a6338'

export const createNpcDialogueOverlay = ({
  mountElement,
  getViewportElement
}: CreateNpcDialogueOverlayInput): NpcDialogueOverlay => {
  ensureStyleInjected()

  const overlayRoot = document.createElement('div')
  const portrait = document.createElement('img')
  const nameBanner = document.createElement('div')
  const dialogueBox = document.createElement('div')
  const dialogueText = document.createElement('div')
  const advanceIndicator = document.createElement('div')

  overlayRoot.className = 'npc-dialogue-overlay'
  overlayRoot.setAttribute('aria-hidden', 'true')
  Object.assign(overlayRoot.style, {
    position: 'absolute',
    zIndex: '70',
    display: 'none',
    pointerEvents: 'none',
    // 하단을 살짝 어둡게 깔아 초상화·대화창을 바닥에 앉힌다(과하지 않게).
    background:
      'linear-gradient(to top, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.12) 24%, rgba(0,0,0,0) 42%)',
    fontFamily: "'NeoDunggeunmo', 'Jersey 25', monospace",
    userSelect: 'none'
  } as CSSStyleDeclaration)

  portrait.className = 'npc-dialogue-overlay__portrait'
  portrait.alt = ''
  portrait.draggable = false
  // 초상화는 대사창 윗변에 서 있다(대사창을 덮지 않는다).
  Object.assign(portrait.style, {
    position: 'absolute',
    left: '1em',
    bottom: '100%',
    height: '13em',
    objectFit: 'contain',
    objectPosition: 'left bottom',
    filter: 'drop-shadow(0 0.3em 0.6em rgba(0,0,0,0.45))',
    pointerEvents: 'none'
  } as CSSStyleDeclaration)

  nameBanner.className = 'npc-dialogue-overlay__name'
  // 이름표 — 대사창 왼쪽 위 테두리에 걸친 나무 명패
  Object.assign(nameBanner.style, {
    position: 'absolute',
    left: '1.2em',
    top: '0',
    transform: 'translateY(-65%)',
    zIndex: '1',
    padding: '0.3em 0.9em',
    color: PAPER,
    fontSize: '1em',
    letterSpacing: '0.04em',
    textShadow: `1px 1px 0 ${WOOD_DARK}`,
    background: WOOD,
    border: `3px solid ${WOOD_DARK}`,
    boxShadow: `inset 0 3px 0 #dca465, inset 0 -3px 0 ${WOOD_DEEP}`,
    whiteSpace: 'nowrap',
    pointerEvents: 'none'
  } as CSSStyleDeclaration)

  dialogueBox.className = 'npc-dialogue-overlay__box'
  Object.assign(dialogueBox.style, {
    position: 'absolute',
    left: '3%',
    right: '3%',
    bottom: '3%',
    minHeight: '24%',
    boxSizing: 'border-box',
    padding: '1.4em 1.6em 1.1em',
    background: PAPER,
    border: `3px solid ${WOOD_DARK}`,
    borderRadius: '0',
    boxShadow: `inset 0 0 0 3px ${WOOD}, 4px 4px 0 rgba(0, 0, 0, 0.35)`,
    color: TEXT_DARK,
    cursor: 'pointer',
    pointerEvents: 'auto'
  } as CSSStyleDeclaration)

  dialogueText.className = 'npc-dialogue-overlay__text'
  Object.assign(dialogueText.style, {
    fontSize: '1.15em',
    lineHeight: '1.55',
    whiteSpace: 'pre-wrap',
    color: TEXT_DARK
  } as CSSStyleDeclaration)

  advanceIndicator.className = 'npc-dialogue-overlay__advance'
  advanceIndicator.textContent = '▼'
  Object.assign(advanceIndicator.style, {
    position: 'absolute',
    right: '1em',
    bottom: '0.6em',
    color: LABEL_BROWN,
    fontSize: '0.9em',
    pointerEvents: 'none'
  } as CSSStyleDeclaration)

  const choiceList = document.createElement('div')
  choiceList.className = 'npc-dialogue-overlay__choices'
  Object.assign(choiceList.style, {
    display: 'none',
    flexDirection: 'column',
    gap: '0.4em',
    marginTop: '0.7em'
  } as CSSStyleDeclaration)

  dialogueBox.append(dialogueText, choiceList, advanceIndicator)
  dialogueBox.append(portrait, nameBanner)
  overlayRoot.append(dialogueBox)
  mountElement.append(overlayRoot)

  let lines: string[] = []
  let lineIndex = 0
  let open = false
  let choices: string[] = []
  let onChoice: ((choiceIndex: number) => void) | undefined
  let onComplete: (() => void) | undefined

  // 선택지는 마지막 줄에서만 뜬다.
  const isChoicePhase = (): boolean => choices.length > 0 && lineIndex >= lines.length - 1

  // 선택지 개수가 매번 달라 show() 마다 버튼을 다시 만든다.
  const renderChoiceButtons = (labels: string[]) => {
    choiceList.replaceChildren()
    for (const [index, label] of labels.entries()) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'npc-dialogue-overlay__choice'
      button.textContent = `${index + 1}. ${label}`
      button.setAttribute('aria-label', label)
      Object.assign(button.style, {
        width: '100%',
        boxSizing: 'border-box',
        padding: '0.45em 0.9em',
        textAlign: 'left',
        fontFamily: 'inherit',
        fontSize: '1em',
        color: TEXT_DARK,
        background: PAPER_LIGHT,
        border: `2px solid ${WOOD_DEEP}`,
        borderRadius: '0',
        cursor: 'pointer'
      } as CSSStyleDeclaration)
      button.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        selectChoice(index)
      })
      choiceList.append(button)
    }
  }

  const renderCurrentLine = () => {
    dialogueText.textContent = lines[lineIndex] ?? ''
    const showsChoices = isChoicePhase()
    choiceList.style.display = showsChoices ? 'flex' : 'none'
    advanceIndicator.style.display = showsChoices ? 'none' : ''
    const isLast = lineIndex >= lines.length - 1
    advanceIndicator.textContent = isLast ? '✕' : '▼'
  }

  // 게임 화면 영역에 겹치고, 글자 크기를 화면 배율에 맞춘다(모든 크기가 em 이라 함께 커진다).
  const syncBounds = () => {
    const viewportRect = getViewportElement().getBoundingClientRect()
    const mountRect = mountElement.getBoundingClientRect()

    Object.assign(overlayRoot.style, {
      left: `${viewportRect.left - mountRect.left}px`,
      top: `${viewportRect.top - mountRect.top}px`,
      width: `${viewportRect.width}px`,
      height: `${viewportRect.height}px`,
      fontSize: `${(viewportRect.height / VIEWPORT_DESIGN_HEIGHT) * BASE_FONT_PIXELS}px`
    } as CSSStyleDeclaration)
  }

  const hide = () => {
    if (!open) {
      return
    }
    open = false
    window.removeEventListener('resize', syncBounds)
    overlayRoot.style.display = 'none'
    overlayRoot.style.pointerEvents = 'none'
    overlayRoot.setAttribute('aria-hidden', 'true')
    window.removeEventListener('keydown', handleKeyDown, true)
    lines = []
    lineIndex = 0
    choices = []
    choiceList.replaceChildren()
    choiceList.style.display = 'none'
  }

  // 다음 줄로. 마지막 줄에서 더 넘기면 닫고 onComplete 호출.
  // 선택지 단계에서는 넘겨서 닫을 수 없다 — 골라야 한다.
  const advance = () => {
    if (!open || isChoicePhase()) {
      return
    }
    if (lineIndex < lines.length - 1) {
      lineIndex += 1
      renderCurrentLine()
      return
    }
    const completion = onComplete
    hide()
    completion?.()
  }

  // advance 와 같은 관용구: 콜백을 붙잡고 → 닫고 → 호출. onChoice 안에서 show() 가
  // 재진입해도 상태가 엉키지 않는 순서다.
  const selectChoice = (choiceIndex: number) => {
    if (!open || !isChoicePhase()) {
      return
    }
    const select = onChoice
    hide()
    select?.(choiceIndex)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!open) {
      return
    }
    // 선택지 단계: 숫자키 1~4 로 고른다.
    if (isChoicePhase() && event.code.startsWith('Digit')) {
      const index = Number(event.code.slice(5)) - 1
      if (index >= 0 && index < choices.length) {
        event.preventDefault()
        event.stopImmediatePropagation()
        selectChoice(index)
      }
      return
    }
    if (
      event.code === 'Space' ||
      event.code === 'Enter' ||
      event.code === 'NumpadEnter'
    ) {
      // 게임 입력(점프/상호작용 등)과 겹치지 않도록 이 오버레이가 키를 소비한다.
      event.preventDefault()
      event.stopImmediatePropagation()
      advance()
      return
    }
    if (event.code === 'Escape') {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (isChoicePhase()) {
        // 선택을 회피해 닫으면 호출자가 임의 선택으로 오인한다 — 선택지에서는 Escape 를 막는다.
        return
      }
      const completion = onComplete
      hide()
      completion?.()
    }
  }

  dialogueBox.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    advance()
  })

  const show = (input: ShowNpcDialogueInput) => {
    const validLines = input.lines.filter((line) => line.trim().length > 0)
    const nextChoices = input.choices ?? []
    if (validLines.length === 0 && nextChoices.length === 0) {
      return
    }
    lines = validLines
    lineIndex = 0
    choices = nextChoices
    onChoice = input.onChoice
    onComplete = input.onComplete
    renderChoiceButtons(nextChoices)
    if (input.portraitUrl) {
      portrait.src = input.portraitUrl
      portrait.style.display = ''
      portrait.style.imageRendering = input.pixelArtPortrait ? 'pixelated' : ''
      portrait.style.height = input.pixelArtPortrait ? '13em' : '17em'
    } else {
      portrait.removeAttribute('src')
      portrait.style.display = 'none'
    }
    nameBanner.textContent = input.name
    nameBanner.style.display = input.name.trim().length > 0 ? '' : 'none'
    renderCurrentLine()

    open = true
    syncBounds()
    window.addEventListener('resize', syncBounds)
    overlayRoot.style.display = 'block'
    overlayRoot.style.pointerEvents = 'auto'
    overlayRoot.setAttribute('aria-hidden', 'false')
    window.addEventListener('keydown', handleKeyDown, true)
  }

  return {
    show,
    hide,
    isOpen: () => open,
    destroy: () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('resize', syncBounds)
      overlayRoot.remove()
    }
  }
}
