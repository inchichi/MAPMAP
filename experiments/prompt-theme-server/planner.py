"""Build per-group actions and edit prompts from validated DSL and source evidence."""
from collections import Counter
from contracts import Dsl, Plan


def build(dsl, sources):
    dsl=Dsl.model_validate(dsl).model_dump(exclude_none=True)
    if dsl['target_maps']!=[sources['mapId']]: raise ValueError('Planner map mismatch')
    counts=Counter(i['asset'] for i in sources['instances'])
    rows=[]
    for variant in sources['variants']:
        if variant['kind']!='prop' or not counts[variant['id']]: continue
        action='decorate' if dsl['decorations'] else 'recolor'
        additions=[]
        if 'snow' in dsl['decorations']: additions.append('small softly shaded snow caps on upward-facing edges')
        if 'lights' in dsl['decorations']: additions.append('tiny warm golden bulbs attached closely to the object, with a thin cable')
        prompt=(f"Requested visual theme: {dsl['source_text'] or dsl['theme']}. "
                f"Edit only this {variant['width']} by {variant['height']} pixel-art prop shown in the image. "
                'Express the requested theme through small attached decorations only. '
                'Its precise semantic class is unknown; do not reinterpret it as a building or tree. '
                + ('Add '+ ' and '.join(additions)+'. ' if additions else '')
                +'Preserve original shape, scale, openings, supports, internal details and position. '
                'Keep decorations within three original pixels of the silhouette. '
                'Keep the gray background unchanged. No extra objects, text, cast shadows or background scene.')
        rows.append({'asset':variant['id'],'kind':'prop','action':action,'prompt':prompt,
                     'decorations':dsl['decorations'],'candidates':1,'instances':counts[variant['id']],
                     'reason':'TMX connected prop group; unknown semantic label',
                     'recolor_base':dsl.get('color',{}).get('gain',[1,1,1])!=[1,1,1] or dsl.get('color',{}).get('bias',[0,0,0])!=[0,0,0]})
    return [r.model_dump(exclude_none=True) for r in Plan.model_validate(rows).root]
