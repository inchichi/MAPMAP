import { getResponsiveUiScale } from './getResponsiveUiScale'

type CreateMapOverlayInput = {
  mountElement: HTMLElement
  // 미니맵 위 줄에 보이는 지역 이름
  title: string
  // M 으로 펼치면 세계 지도(worldMapView.ts)를 그린다 — 칸 수로 가로세로 비율을 정한다.
  worldMap: {
    columns: number
    rows: number
    draw: (target: CanvasRenderingContext2D, width: number, height: number) => void
    // 플레이어 점 위치(세계 지도 전체에 대한 0~1). 지도에 없는 곳이면 점을 숨긴다.
    getMarkerRatio: () => { x: number; y: number } | undefined
    // 마우스를 올린 지역의 이름·미리보기 그림(가 본 곳만) — 메이플 지도처럼 툴팁으로 보여 준다.
    getHoverInfo: (ratio: { x: number; y: number }) => { title: string; imageUrl?: string } | undefined
  }
  // 미니맵에 그릴 맵 그림(없으면 아직 안 그린다)
  getSourceCanvas: () => HTMLCanvasElement | undefined
  mapPixelWidth: number
  mapPixelHeight: number
  getFocusPoint: () => {
    x: number
    y: number
  }
  onExpandedChange?: (isExpanded: boolean) => void
}

export type MapOverlay = {
  syncFrame: () => void
  getIsExpanded: () => boolean
  getIsVisible: () => boolean
  setExpanded: (isExpanded: boolean) => void
  setVisible: (isVisible: boolean) => void
  toggleExpanded: () => void
  toggleVisible: () => void
  destroy: () => void
}

// 미니맵 −/+ (메이플 미니맵처럼): 미니맵은 늘 지금 맵 전체를 보여 주고, 창 크기만 바꾼다.
// 0 은 접힌 상태(이름 줄만). 고른 단계는 브라우저에 기억한다.
const MINIMAP_WIDTHS = [0, 140, 200, 280] as const
const DEFAULT_MINIMAP_SIZE_INDEX = 2
const MINIMAP_SIZE_STORAGE_KEY = 'my-sample-rpg:minimap-size'
const MINIMAP_BAR_MIN_WIDTH = 140
const OVERLAY_MARGIN = 16
// 나무 액자 창과 같은 팔레트(진갈·나무·진갈 테두리 + 번지지 않는 그림자)
const DISPLAY_BORDER_SHADOW =
  '0 0 0 2px #6d4b27, 0 0 0 5px #c58747, 0 0 0 7px #6d4b27, 4px 4px 0 7px rgba(0, 0, 0, 0.35)'
const FOCUS_MARKER_SIZE = 10
// 미니맵 위 지역 이름 + −/+ 줄의 높이와 미니맵까지 간격(나무 테두리 두께 포함)
const ZOOM_BAR_HEIGHT = 24
const ZOOM_BAR_GAP = 12

const readStoredMinimapSizeIndex = (): number => {
  try {
    const stored = window.localStorage.getItem(MINIMAP_SIZE_STORAGE_KEY)
    const index = Number(stored)

    return stored !== null && Number.isInteger(index) && index >= 0 && index < MINIMAP_WIDTHS.length
      ? index
      : DEFAULT_MINIMAP_SIZE_INDEX
  } catch {
    return DEFAULT_MINIMAP_SIZE_INDEX
  }
}

export const createMapOverlay = ({
  mountElement,
  title,
  worldMap,
  getSourceCanvas,
  mapPixelWidth,
  mapPixelHeight,
  getFocusPoint,
  onExpandedChange
}: CreateMapOverlayInput): MapOverlay => {
  const overlayRoot = document.createElement('div')
  const backdropButton = document.createElement('button')
  const panelButton = document.createElement('button')
  const mapFrame = document.createElement('div')
  const previewCanvas = document.createElement('canvas')
  const viewportFrame = document.createElement('div')
  const badgeElement = document.createElement('div')
  const tooltipElement = document.createElement('div')
  const tooltipImage = document.createElement('img')
  const tooltipTitle = document.createElement('div')
  const zoomBar = document.createElement('div')
  const zoomTitle = document.createElement('span')
  const zoomOutButton = document.createElement('button')
  const zoomInButton = document.createElement('button')
  const previewContext = previewCanvas.getContext('2d')

  if (!previewContext) {
    throw new Error('Missing 2D context for the map overlay')
  }

  let isExpanded = false
  let isVisible = true
  let displayWidth = 0
  let displayHeight = 0
  let backingWidth = 0
  let backingHeight = 0
  let minimapSizeIndex = readStoredMinimapSizeIndex()

  const syncMapFocusMode = () => {
    mountElement.classList.toggle('game-root--map-focused', isExpanded)
    document.body.classList.toggle('game-root--map-focused', isExpanded)
  }

  overlayRoot.className = 'world-map-overlay'
  overlayRoot.setAttribute('aria-hidden', 'false')

  backdropButton.type = 'button'
  backdropButton.className = 'world-map-overlay__backdrop'
  backdropButton.hidden = true
  backdropButton.setAttribute('aria-label', '월드맵 닫기')
  backdropButton.tabIndex = -1

  panelButton.type = 'button'
  panelButton.className = 'world-map-overlay__panel'
  panelButton.setAttribute('aria-label', '월드맵 열기')
  panelButton.setAttribute('aria-expanded', 'false')

  mapFrame.className = 'world-map-overlay__frame'
  mapFrame.setAttribute('aria-hidden', 'true')

  previewCanvas.className = 'world-map-overlay__canvas'
  viewportFrame.className = 'world-map-overlay__viewport'
  badgeElement.className = 'world-map-overlay__badge'
  badgeElement.textContent = title

  zoomBar.className = 'world-map-overlay__zoom-bar'
  zoomTitle.className = 'world-map-overlay__zoom-title'
  zoomTitle.textContent = title
  for (const [button, label, text] of [
    [zoomOutButton, '미니맵 작게(끝까지 줄이면 접기)', '−'],
    [zoomInButton, '미니맵 크게', '+']
  ] as const) {
    button.type = 'button'
    button.className = 'world-map-overlay__zoom-button'
    button.textContent = text
    button.title = label
    button.setAttribute('aria-label', label)
  }
  zoomBar.append(zoomTitle, zoomOutButton, zoomInButton)

  previewCanvas.setAttribute('aria-hidden', 'true')
  viewportFrame.setAttribute('aria-hidden', 'true')
  badgeElement.setAttribute('aria-hidden', 'true')

  mapFrame.append(previewCanvas, viewportFrame)
  panelButton.append(mapFrame, badgeElement)
  tooltipElement.className = 'world-map-overlay__tooltip'
  tooltipElement.hidden = true
  tooltipImage.className = 'world-map-overlay__tooltip-image'
  tooltipImage.alt = ''
  tooltipTitle.className = 'world-map-overlay__tooltip-title'
  tooltipElement.append(tooltipImage, tooltipTitle)
  overlayRoot.append(backdropButton, panelButton, zoomBar, tooltipElement)
  mountElement.append(overlayRoot)

  const shouldShowOverlay = () => isVisible || isExpanded

  const syncFrame = () => {
    const sourceCanvas = getSourceCanvas()
    if (!sourceCanvas || !shouldShowOverlay() || displayWidth === 0 || displayHeight === 0) {
      return
    }

    const focusPoint = getFocusPoint()
    previewContext.setTransform(1, 0, 0, 1, 0, 0)
    previewContext.clearRect(0, 0, backingWidth, backingHeight)
    previewContext.imageSmoothingEnabled = false

    if (isExpanded) {
      worldMap.draw(previewContext, backingWidth, backingHeight)

      // 플레이어 위치 — 미니맵과 같은 금색 점(조금 크게)
      const expandedMarkerSize = FOCUS_MARKER_SIZE + 4
      const markerRatio = worldMap.getMarkerRatio()
      viewportFrame.hidden = !markerRatio
      viewportFrame.classList.add('world-map-overlay__viewport--blink')
      viewportFrame.style.left = `${Math.round((markerRatio?.x ?? 0) * displayWidth - expandedMarkerSize / 2)}px`
      viewportFrame.style.top = `${Math.round((markerRatio?.y ?? 0) * displayHeight - expandedMarkerSize / 2)}px`
      viewportFrame.style.width = `${expandedMarkerSize}px`
      viewportFrame.style.height = `${expandedMarkerSize}px`
      viewportFrame.style.borderRadius = '999px'
      viewportFrame.style.background = '#ffd75e'
      viewportFrame.style.border = '2px solid #6d4b27'
      viewportFrame.style.boxShadow = '0 0 0 2px #fff1d2'
      viewportFrame.style.transform = 'none'
      mapFrame.style.borderRadius = '0'
      mapFrame.style.background = '#f1ddb2'
      badgeElement.textContent = '세계 지도'
      badgeElement.hidden = false
      // 왼쪽 위에는 지역 카드가 있어 오른쪽 위 빈자리에 둔다.
      badgeElement.style.left = 'auto'
      badgeElement.style.right = '8px'
      badgeElement.style.top = '8px'
      badgeElement.style.transform = 'none'
      return
    }

    // 미니맵 — 지금 맵 전체를 창 크기에 맞춰 그리고, 플레이어를 금색 점으로 찍는다.
    previewContext.drawImage(
      sourceCanvas,
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height,
      0,
      0,
      backingWidth,
      backingHeight
    )

    const focusMarkerLeft = clamp(
      Math.round((focusPoint.x / mapPixelWidth) * displayWidth),
      0,
      displayWidth
    )
    const focusMarkerTop = clamp(
      Math.round((focusPoint.y / mapPixelHeight) * displayHeight),
      0,
      displayHeight
    )

    viewportFrame.style.left = `${Math.max(
      0,
      focusMarkerLeft - Math.round(FOCUS_MARKER_SIZE / 2)
    )}px`
    viewportFrame.style.top = `${Math.max(
      0,
      focusMarkerTop - Math.round(FOCUS_MARKER_SIZE / 2)
    )}px`
    viewportFrame.style.width = `${FOCUS_MARKER_SIZE}px`
    viewportFrame.style.height = `${FOCUS_MARKER_SIZE}px`
    // 플레이어 표시 — 금색 점
    viewportFrame.hidden = false
    viewportFrame.classList.remove('world-map-overlay__viewport--blink')
    viewportFrame.style.borderRadius = '999px'
    viewportFrame.style.background = '#ffd75e'
    viewportFrame.style.border = '2px solid #6d4b27'
    viewportFrame.style.boxShadow = '0 0 0 1px #fff1d2'
    viewportFrame.style.transform = 'none'
    mapFrame.style.borderRadius = '0'
    mapFrame.style.background = '#181a22'
    // 미니맵에서는 위 −/+ 줄이 지역 이름을 보여 준다.
    badgeElement.hidden = true
  }

  const syncLayout = () => {
    const shouldShow = shouldShowOverlay()

    overlayRoot.hidden = !shouldShow
    overlayRoot.style.display = shouldShow ? '' : 'none'
    overlayRoot.setAttribute('aria-hidden', String(!shouldShow))
    panelButton.hidden = !shouldShow

    if (!shouldShow) {
      backdropButton.hidden = true
      return
    }

    const uiScale = getResponsiveUiScale()
    const minimapWidth: number = MINIMAP_WIDTHS[minimapSizeIndex]
    let nextDisplayWidth = minimapWidth
    let nextDisplayHeight = Math.round((minimapWidth * mapPixelHeight) / mapPixelWidth)

    if (isExpanded) {
      const availableWidth = Math.max(1, window.innerWidth - OVERLAY_MARGIN * 2)
      const availableHeight = Math.max(1, window.innerHeight - OVERLAY_MARGIN * 2)
      const scale = Math.min(availableWidth / worldMap.columns, availableHeight / worldMap.rows)

      nextDisplayWidth = Math.max(1, Math.round(worldMap.columns * scale))
      nextDisplayHeight = Math.max(1, Math.round(worldMap.rows * scale))
    }

    const nextBackingWidth = Math.round(nextDisplayWidth * (window.devicePixelRatio || 1))
    const nextBackingHeight = Math.round(nextDisplayHeight * (window.devicePixelRatio || 1))

    displayWidth = nextDisplayWidth
    displayHeight = nextDisplayHeight
    backingWidth = nextBackingWidth
    backingHeight = nextBackingHeight

    panelButton.classList.toggle(
      'world-map-overlay__panel--expanded',
      isExpanded
    )
    panelButton.classList.toggle(
      'world-map-overlay__panel--collapsed',
      !isExpanded
    )
    const scaledMargin = Math.round(OVERLAY_MARGIN * uiScale)
    panelButton.style.left = isExpanded ? '50%' : `${scaledMargin}px`
    panelButton.style.top = isExpanded
      ? '50%'
      : `${scaledMargin + Math.round((ZOOM_BAR_HEIGHT + ZOOM_BAR_GAP) * uiScale)}px`
    panelButton.style.transformOrigin = isExpanded ? 'center center' : 'top left'
    panelButton.style.transform = isExpanded
      ? 'translate(-50%, -50%)'
      : `scale(${uiScale})`
    panelButton.style.width = `${displayWidth}px`
    panelButton.style.height = `${displayHeight}px`
    panelButton.style.cursor = isExpanded ? 'zoom-out' : 'zoom-in'
    panelButton.style.boxShadow = 'none'
    panelButton.style.background = 'transparent'
    panelButton.setAttribute(
      'aria-label',
      isExpanded ? '월드맵 닫기' : '월드맵 열기'
    )
    panelButton.setAttribute('aria-expanded', String(isExpanded))
    // 펼친 세계 지도에서는 지역 툴팁을 띄우므로 브라우저 기본 툴팁(title)은 끈다.
    panelButton.title = isExpanded ? '' : '월드맵 열기'
    backdropButton.hidden = !isExpanded
    if (!isExpanded) {
      tooltipElement.hidden = true
    }
    // 접힌 미니맵(크기 0)은 이름 줄만 남긴다.
    panelButton.hidden = !isExpanded && minimapWidth === 0

    // 미니맵 위 지역 이름 + −/+ 줄(펼친 지도에서는 숨긴다)
    zoomBar.hidden = isExpanded
    zoomBar.style.left = `${scaledMargin}px`
    zoomBar.style.top = `${scaledMargin}px`
    zoomBar.style.height = `${ZOOM_BAR_HEIGHT}px`
    zoomBar.style.width = `${Math.max(MINIMAP_BAR_MIN_WIDTH, minimapWidth)}px`
    zoomBar.style.transform = `scale(${uiScale})`
    zoomOutButton.disabled = minimapSizeIndex <= 0
    zoomInButton.disabled = minimapSizeIndex >= MINIMAP_WIDTHS.length - 1

    previewCanvas.width = backingWidth
    previewCanvas.height = backingHeight
    previewCanvas.style.width = '100%'
    previewCanvas.style.height = '100%'
    mapFrame.style.width = '100%'
    mapFrame.style.height = '100%'
    // 펼친 세계 지도는 CSS 나무 액자(.world-map-overlay__panel--expanded)를 쓴다.
    mapFrame.style.boxShadow = isExpanded ? 'none' : DISPLAY_BORDER_SHADOW

    syncFrame()
  }

  const setExpanded = (nextExpanded: boolean) => {
    if (isExpanded === nextExpanded) {
      return
    }

    isExpanded = nextExpanded
    syncMapFocusMode()
    syncLayout()
    onExpandedChange?.(isExpanded)
  }

  const setVisible = (nextVisible: boolean) => {
    if (isVisible === nextVisible) {
      return
    }

    isVisible = nextVisible

    if (!isVisible && isExpanded) {
      isExpanded = false
      syncLayout()
      onExpandedChange?.(isExpanded)
      return
    }

    syncLayout()
  }

  const toggleExpanded = () => {
    setExpanded(!isExpanded)
  }

  const toggleVisible = () => {
    setVisible(!isVisible)
  }

  // 지도 버튼에 포커스가 남으면 게임 키(이동·F 포탈·M 등)가 버튼으로 가서 무시된다 — 누른 뒤 바로 놓는다.
  const handlePanelClick = (event: MouseEvent) => {
    event.preventDefault()
    panelButton.blur()
    setExpanded(!isExpanded)
  }

  const changeMinimapSize = (step: number) => {
    const nextIndex = clamp(minimapSizeIndex + step, 0, MINIMAP_WIDTHS.length - 1)

    if (nextIndex === minimapSizeIndex) {
      return
    }

    minimapSizeIndex = nextIndex
    try {
      window.localStorage.setItem(MINIMAP_SIZE_STORAGE_KEY, String(nextIndex))
    } catch {
      // 저장할 수 없으면 이번 판에서만 기억한다.
    }
    syncLayout()
  }

  // 버튼에 포커스가 남으면 게임 키(이동·M 등)가 버튼으로 가서 무시된다 — 누른 뒤 바로 놓는다.
  const handleZoomOutClick = (event: MouseEvent) => {
    event.preventDefault()
    zoomOutButton.blur()
    changeMinimapSize(-1)
  }

  const handleZoomInClick = (event: MouseEvent) => {
    event.preventDefault()
    zoomInButton.blur()
    changeMinimapSize(1)
  }

  const handleBackdropClick = (event: MouseEvent) => {
    event.preventDefault()
    backdropButton.blur()
    setExpanded(false)
  }

  const handlePanelMouseMove = (event: MouseEvent) => {
    if (!isExpanded) {
      return
    }

    const rect = mapFrame.getBoundingClientRect()
    const info = worldMap.getHoverInfo({
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height
    })

    tooltipElement.hidden = !info
    panelButton.style.cursor = info ? 'help' : 'zoom-out'

    if (!info) {
      return
    }

    if (tooltipTitle.textContent !== info.title) {
      tooltipTitle.textContent = info.title
      tooltipImage.hidden = !info.imageUrl
      tooltipImage.src = info.imageUrl ?? ''
    }

    tooltipElement.style.left = `${event.clientX + 16}px`
    tooltipElement.style.top = `${event.clientY + 16}px`
  }

  const handlePanelMouseLeave = () => {
    tooltipElement.hidden = true
  }

  const handleWindowResize = () => {
    syncLayout()
  }

  panelButton.addEventListener('click', handlePanelClick)
  backdropButton.addEventListener('click', handleBackdropClick)
  zoomOutButton.addEventListener('click', handleZoomOutClick)
  zoomInButton.addEventListener('click', handleZoomInClick)
  panelButton.addEventListener('mousemove', handlePanelMouseMove)
  panelButton.addEventListener('mouseleave', handlePanelMouseLeave)
  window.addEventListener('resize', handleWindowResize)

  syncMapFocusMode()
  syncLayout()

  return {
    syncFrame,
    getIsExpanded: () => isExpanded,
    getIsVisible: () => isVisible,
    setExpanded,
    setVisible,
    toggleExpanded,
    toggleVisible,
    destroy: () => {
      mountElement.classList.remove('game-root--map-focused')
      document.body.classList.remove('game-root--map-focused')
      panelButton.removeEventListener('click', handlePanelClick)
      backdropButton.removeEventListener('click', handleBackdropClick)
      zoomOutButton.removeEventListener('click', handleZoomOutClick)
      zoomInButton.removeEventListener('click', handleZoomInClick)
      panelButton.removeEventListener('mousemove', handlePanelMouseMove)
      panelButton.removeEventListener('mouseleave', handlePanelMouseLeave)
      window.removeEventListener('resize', handleWindowResize)
      overlayRoot.remove()
    }
  }
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max))
