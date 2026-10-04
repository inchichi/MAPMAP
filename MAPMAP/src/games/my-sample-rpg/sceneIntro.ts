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
  'sunken-temple-2f': '봉인의 방'
}

export const getSceneIntroMessage = (sceneId: string): string =>
  SCENE_INTRO_MESSAGES[sceneId] ?? ''
