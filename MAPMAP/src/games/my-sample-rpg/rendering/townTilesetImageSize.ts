// town-32.png의 실제 픽셀 크기.
//
// 이 시트는 scripts/generate-transition-tiles.py 와 scripts/append-cave-tiles.py 가
// 아래에 행을 덧붙이며 자라기 때문에, 크기를 여러 파일에 하드코딩하면 시트를 늘릴 때마다
// UI 아이콘이 조용히 어긋난다(배경 스프라이트는 CSS background-size로 시트 전체를
// 스케일하므로 높이가 틀리면 엉뚱한 타일이 눌린 채 표시된다).
//
// 그래서 크기는 여기 한 곳에만 두고, append-cave-tiles.py 가 시트를 다시 쓸 때
// 이 파일의 숫자도 함께 갱신한다. 손으로 고치지 말 것.
export const TOWN_TILESET_IMAGE_WIDTH = 256
export const TOWN_TILESET_IMAGE_HEIGHT = 7200
