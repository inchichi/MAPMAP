-- 씬 인트로 메시지 규칙 (TS sceneIntro.ts에서 Lua로 변환).
-- 순수 문자열 — 호스트가 전역 함수를 (scene_id) 인자로 호출해 string을 받는다.
-- sceneIntro.ts와 동일: 알려진 sceneId면 해당 메시지, 아니면 빈 문자열을 돌려준다.

local SCENE_INTRO_MESSAGES = {
  ['town'] = '느티골',
  ['hunting-ground'] = '말캉이 숲',
  ['cave'] = '어스름 굴',
  ['crystal-mine'] = '잊힌 수정 광산',
  ['harvest-village'] = '물레골',
  ['upstream-waterway'] = '윗물길',
  ['reed-village'] = '갈대골',
  ['sunken-forest'] = '잠긴숲',
  ['ruins-outskirts'] = '물밑 신전 외곽',
  ['sunken-temple-1f'] = '물밑 신전 1층',
  ['sunken-temple-2f'] = '봉인의 방',
  ['reed-well'] = '갈대골 우물 속',
  ['north-pass'] = '된바람재',
  ['frost-village'] = '서리목',
  ['frozen-lake'] = '거울못',
  ['ice-cave-1f'] = '서리굴',
  ['ice-cave-2f'] = '얼음 제단',
  ['boss-arena'] = '시험장'
}

function scene_intro_message(scene_id)
  -- TS: map[sceneId] ?? '' — 없는 키는 nil → ''.
  return SCENE_INTRO_MESSAGES[scene_id] or ''
end
