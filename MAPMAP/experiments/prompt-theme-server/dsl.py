"""Deterministic Visual DSL v1. Explicitly not an LLM/semantic classifier."""
import re
from contracts import Dsl


def parse(text, map_id, current_night=True):
    p = text.strip().lower()
    if not p or len(p)>1200: raise ValueError('프롬프트는 1~1200자로 입력해주세요.')
    if map_id!='floor-1-ruins': raise ValueError('자동 Planner는 현재 1층 폐허마을을 지원합니다.')
    if not any(w in p for w in ['크리스마스','christmas','겨울','winter']):
        raise ValueError('현재 검증된 자동 경로는 크리스마스/겨울입니다. 다른 테마는 아직 지원하지 않습니다.')
    if any(w in p for w in ['할로윈','halloween','가을','autumn','삭제','제거','remove','새 집','새 건물']):
        raise ValueError('혼합 테마나 오브젝트 추가·삭제 요청은 아직 지원하지 않습니다.')
    decorations=[]
    for key, words in {'snow':['눈','snow'],'lights':['전구','조명','lights','bulbs']}.items():
        mentioned=any(w in p for w in words)
        negated=any(re.search(re.escape(w)+r'\s*(?:은|는|을|를)?\s*(?:없이|빼|제외|없)',p) or 'no '+w in p for w in words)
        if mentioned and not negated: decorations.append(key)
    if any(w in p for w in ['가랜드','화환','garland','wreath','호박']):
        raise ValueError('현재 장식 추출은 눈·전구만 지원합니다.')
    day=any(w in p for w in ['낮','daytime','no night','밤 말고'])
    night=False if day else True if any(w in p for w in ['밤','night']) else current_night
    if night!=current_night: raise ValueError('부분 수정은 기존 시간대를 유지합니다. 전체 맵 시간대 전환은 아직 지원하지 않습니다.')
    color_requested=any(w in p for w in ['색','명암','recolor','tint','shade'])
    preserve=any(w in p for w in ['원본 색','색은 그대로','색 변경 없이','no recolor'])
    color={'gain':[1.03,.97,.98],'bias':[-.015,0,.045]} if color_requested and not preserve else {'gain':[1,1,1],'bias':[0,0,0]}
    if not decorations and (not color_requested or preserve):
        raise ValueError('눈·전구 또는 색·명암 변경을 명시해주세요. 변경 없는 요청은 생성하지 않습니다.')
    return Dsl(parser='rules-dsl-v1',source_text=text,theme='christmas',season='winter',
               lighting='existing-night' if night else 'existing-day',weather='snowy' if 'snow' in decorations else None,
               night=night,twinkle='lights' in decorations and any(w in p for w in ['반짝','twinkl','깜빡'])
               and not any(w in p for w in ['반짝임 없이','반짝이지','no twinkl']),
               decorations=decorations,color=color,target_maps=[map_id],
               warnings=['규칙 기반 DSL입니다. 세부 색상명·광원 방향은 해석하지 않으며, 색 보정은 고정 겨울 팔레트입니다.',
                         '선택한 소품만 변경합니다. 선택하지 않은 기존 장식과 조명은 유지합니다.',
                         'Crypt 종류는 미분류 소품입니다. 집/나무라고 자동 추정하지 않습니다.']).model_dump(exclude_none=True)
