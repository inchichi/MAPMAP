"""Versioned, auditable routing by decoration type, not arbitrary generated code.

Rules are a planning bootstrap, not an LLM or semantic segmentation model.
Unknown/thin/independent decorations require review until their extractors exist.
"""
import re

TYPES = {
    'snow': ('surface', 'material-mask', 'upper surface', ['snow','눈','설경']),
    'lights': ('emissive', 'material-mask', 'attached edge', ['lights','bulbs','전구','조명']),
    'pumpkin': ('independent', 'semantic-mask-required', 'ground anchor', ['pumpkin','호박']),
    'web': ('thin-line', 'semantic-mask-required', 'corner anchor', ['cobweb','spiderweb','거미줄']),
    'garland': ('hanging', 'semantic-mask-required', 'edge anchors', ['garland','가랜드']),
}


def plan_extraction(text, decorations=()):
    text=text.lower()
    found=[]
    for name,(kind,method,region,words) in TYPES.items():
        if name in decorations or any(word in text for word in words):
            found.append(name)
    # Suggestions only when the user supplied no explicit decoration words.
    if not found:
        if '할로윈' in text or 'halloween' in text: found=['pumpkin','web']
        elif '크리스마스' in text or 'christmas' in text: found=['snow','lights']
    ambiguous=bool(re.search(r'없|제외|말고|하지|않|\b(no|without|except)\b',text))
    items=[dict(type=name,kind=TYPES[name][0],method=TYPES[name][1],region=TYPES[name][2]) for name in found]
    supported=bool(items) and not ambiguous and all(i['method']=='material-mask' for i in items)
    return dict(version='decoration-policy-v1',parser='rules-not-semantic',items=items,
                method='material-mask' if supported else 'review-only-difference',
                materials=found if supported else [],requires_review=True,
                reason='유형별 색 마스크 후보: 실제 장식 여부 검수 필요' if supported else
                '부정 표현·미지정 장식 또는 의미 분할이 필요한 유형: 차영상은 비교 후보로만 저장',
                constraints=['preserve source alpha and geometry','never auto-apply candidates'])
