"""Conservative prompt forwarding, without theme-specific palettes or defaults."""
from contracts import Dsl


def parse(text, map_id, current_night=False):
    p=text.strip().lower()
    if not p or len(p)>1200: raise ValueError('프롬프트는 1~1200자로 입력해주세요.')
    if map_id!='floor-1-ruins': raise ValueError('현재 1층 폐허마을만 지원합니다.')
    return Dsl(parser='prompt-forward-v1',source_text=text,theme=p,
               night=('밤' in p or 'night' in p) and 'no night' not in p,
               twinkle=False, decorations=['prompt-details'],
               color={'gain':[1,1,1],'bias':[0,0,0]},target_maps=[map_id],
               warnings=['원문을 FLUX에 전달합니다. 의미 기반 DSL 해석기는 아닙니다.',
                         '원본에서 시작하며 이전 테마를 상속하지 않습니다.',
                         '자동 색 보정과 반짝임은 사용하지 않습니다. 고급 DSL에서 명시할 수 있습니다.',
                         '차영상 장식 추출은 실험적이며 모델의 구조 변형을 완벽히 구분하지 못합니다.']).model_dump(exclude_none=True)
