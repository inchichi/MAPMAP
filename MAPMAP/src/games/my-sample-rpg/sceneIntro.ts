const SCENE_INTRO_MESSAGES: Record<string, string> = {
  town: '티르코네일 마을',
  'hunting-ground': '슬라임 숲',
  cave: '동굴',
  'crystal-mine': '잊힌 수정 광산',
  'harvest-village': '딴따라마을',
  'upstream-waterway': '수로 상류길',
  'reed-village': '갈대골',
  'sunken-forest': '가라앉은 숲',
  'ruins-outskirts': '잠긴 신전 외곽',
  'sunken-temple-1f': '잠긴 신전 1층',
  'sunken-temple-2f': '봉인의 방',
  'reed-well': '갈대골 우물 속',
  'north-pass': '북쪽 고갯길',
  'frost-village': '서리목',
  'frozen-lake': '얼어붙은 호수',
  'ice-cave-1f': '얼음 동굴',
  'ice-cave-2f': '얼음 제단'
}

export const getSceneIntroMessage = (sceneId: string): string =>
  SCENE_INTRO_MESSAGES[sceneId] ?? ''
