const UI_REFERENCE_WIDTH = 1600
const UI_REFERENCE_HEIGHT = 900
// 작은 창(에디터의 게임 프리뷰 iframe 등)에서는 UI가 창 크기에 비례해 계속 줄어야 한다.
// 예전 하한 0.72는 700px 남짓의 iframe에서도 HUD(설계 폭 ~770px)를 86% 크기로 고정해
// 오른쪽이 화면 밖으로 잘렸다. 0.3이면 320px 폭까지도 HUD가 잘리지 않는다(≈277px).
const UI_MIN_SCALE = 0.3
// 큰 화면에서도 UI는 게임 화면과 같은 비율로 커진다(게임 화면은 창에 맞춰 계속 커진다).
// 예전 상한 1 은 2560·4K 화면에서 HUD·창을 1600px 화면 크기로 묶어 두어 상대적으로 너무 작았다.
const UI_SCALE_MULTIPLIER = 1.2

// CSS 로만 자리를 잡는 UI(지명 배너·상태 표시·보스 체력·상점·툴팁)가 같은 배율로 커지게
// 문서 루트에 --ui-scale 을 둔다. 화면 크기가 바뀔 때마다 게임 화면 배율과 함께 갱신한다.
export const syncUiScaleCssVariable = (): void => {
  document.documentElement.style.setProperty('--ui-scale', String(getResponsiveUiScale()))
}

export const getResponsiveUiScale = (): number => {
  const widthScale = window.innerWidth / UI_REFERENCE_WIDTH
  const heightScale = window.innerHeight / UI_REFERENCE_HEIGHT

  return (
    Math.max(Math.min(widthScale, heightScale), UI_MIN_SCALE) * UI_SCALE_MULTIPLIER
  )
}
