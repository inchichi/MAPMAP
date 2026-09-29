"""Plan placement semantics independently from source-image registration."""
import hashlib
import json
import re
from PIL import Image, ImageOps
from pixel_style import pixel_prompt
from ground_prop_pilot import extract_sprite


def route_batches(route):
    return route.get('batches',[route])


def attached_prompt(route,fallback):
    commands=['On the '+b['placement'].replace('_',' ')+': '+' '.join(b['commands'])
              for b in route_batches(route)
              if b.get('placement') in {'wall','roof','object_surface'} and b.get('commands')]
    if not commands:return fallback
    return pixel_prompt('Preserve the original geometry, silhouette, size, colors, lighting and gray background. '
        'Keep all doors, windows and openings clear. Add only these attached decorations; no ground props. '+' '.join(commands))


def plan_route(infer, commands, label, evidence=(), repair_attempts=0):
    if not commands:raise ValueError('Ground route needs explicit single-object DSL')
    batches=[]
    for command in commands:
        responses=[]
        feedback=''
        def traced(prompt):
            if feedback and prompt.startswith('Classify'):prompt+='\nPrevious attempt failed validation: '+feedback+' Correct the route without changing the requested object or inventing support.'
            value,raw=infer(prompt)
            responses.append({'value':value,'raw':raw})
            return value,raw
        for attempt in range(min(1,repair_attempts)+1):
            try:
                route=_plan_single_route(traced,[command],label,evidence)
                break
            except ValueError as error:
                if attempt<min(1,repair_attempts):
                    candidate=next(r['value'] for r in reversed(responses) if 'placement' in r['value'])
                    feedback=str(error)+' Rejected candidate: '+json.dumps(candidate,ensure_ascii=False)
                    continue
                error.report={'command':command,'responses':responses,'completed_batches':batches}
                raise
        route['attempts']=responses
        route['commands']=[command]
        batches.append(route)
    if len(batches)==1:return batches[0]
    return {'placement':'mixed' if len({b['placement'] for b in batches})>1 else batches[0]['placement'],
            'items':[item for b in batches for item in b['items']], 'batches':batches}


def identity_words(text):
    text=re.sub(r"[-'’]",'',text.lower())
    return {word[:-1] if len(word)>3 and word.endswith('s') else word for word in re.findall(r'[a-z]+',text)}


def _plan_single_route(infer, commands, label, evidence=()):
    identity=re.split(r'\b(?:on|onto|at|near|beside|outside|around|along|under|above|to)\b',commands[0].lower(),maxsplit=1)[0]
    terms=identity_words(identity)-{'add','a','an','the','one','some','small','tiny','large'}
    value, raw = infer('Classify the physical placement of this ONE requested decoration. Return JSON only: '
        '{"placement":"ground|wall|roof|object_surface","item":"Add one ... .","reason":"..."}. '
        'Freestanding objects rest on ground, not on the host surface. Hanging or fixed ornaments attach to wall/roof/surface. '
        'Ground requires an object that can stand independently on its own base. Portability alone is NOT sufficient. '
        'Cables, strings and hanging ornaments need attachment; never reinterpret them as freestanding props. '
        'Do not infer attachment merely because the request says exterior. '
        'Consult original source evidence: outside/beside alone does not establish a supporting surface. '
        'Use the physical support of the requested object, not a default ground placement. '
        'When a command is underspecified, resolve its support from source evidence and the host; '
        'never turn an attached ornament into an independent prop. Correct mistranslated placement in the intermediate commands. '
        'For ground placement item must be exactly ONE English Add one sentence for the object named in COMMAND. '
        'For attached placement item must be null. Never return an array. '
        'SOURCE may mention other objects: do NOT include them. Source is only for checking placement/attributes, '
        'not authorization to expand this command. Do not repeat items or add thematic variants. '
        'Each ground command MUST begin with "Add one " and describe one singular object. '
        'Make that short command visually identifiable: include its defining silhouette and visible material texture, '
        'not just its name or color. Use concrete pixel-readable features, not abstract mood or photorealistic detail. '
        'Retain the requested object identity and explicit attributes. Add only ordinary defining physical features; '
        'do not invent accessories, a container, symbols, a support, or a different object subtype. '
        'Do not include placement phrases such as on ground, outside, near or beside; placement is handled separately. '
        'without host buildings, location clauses, extra objects or new decorations. Use one placement; reject mixed placement with an empty items list. '
        'Keep the original object name and attributes literally in item; do not replace them with synonyms or related objects. '
        'Required identity words: '+json.dumps(sorted(terms))+'. '
        'Evidence: '+json.dumps({'COMMAND':commands[0],'host':label,'source':evidence},ensure_ascii=False)+
        '\nReturn compact JSON only. Keep reason under 100 characters. Do not repeat the rules.')
    if 'item' in value:
        value['items']=[] if value['item'] is None else [value['item']]
    placement=value.get('placement')
    if placement not in {'ground','wall','roof','object_surface'}:raise ValueError('Invalid placement route')
    items=value.get('items',[])
    if not isinstance(items,list) or len(items)>3:raise ValueError('Invalid ground items')
    if any(not isinstance(item,str) for item in items):raise ValueError('Invalid ground item text')
    items=list(dict.fromkeys(items));value['items']=items
    if len(items)>len(commands):raise ValueError('Route invented additional item types')
    if placement=='ground' and (not items or any(not re.fullmatch(r'Add one [ -~]{3,216}',s) for s in items)):
        raise ValueError('Ground route needs explicit single-object DSL')
    if placement=='ground' and any(not terms <= identity_words(item) for item in items):
        raise ValueError('Ground route changed requested identity or attributes')
    if placement!='ground' and items:raise ValueError('Attached route cannot create independent props')
    verdict, audit_raw = infer('Audit placement and decomposition against the original commands. Return JSON '
        '{"supported":true or false,"reason":"..."}. Evaluate the candidate placement actually supplied. '
        'wall, roof and object_surface mean ATTACHED, never freestanding. Empty items for an attached route is correct: '
        'the original command is generated on the host, so no requested object is missing. '
        'If the source requires attachment and the candidate is attached, this is agreement, not a reason to reject. '
        'Reject invented objects, missing requested types, '
        'First check physical support: ground items must stand on their own base without invented supports. '
        'A string, cable or hanging ornament cannot pass as a freestanding ground object merely because it is portable. '
        'freestanding objects attached to walls, or attached ornaments turned into ground props. '
        'Defining shape and material descriptions are allowed only when consistent with the requested object. '
        'Reject changed identity, contradictory explicit attributes, invented accessories or thematic variants. '
        'Single-object generation followed by reuse may implement plural placement. Outside/beside does not mean attached to a wall. '
        +json.dumps({'commands':commands,'route':value,'source':evidence},ensure_ascii=False)+
        '\nReturn compact JSON only. Keep reason under 100 characters.')
    if verdict.get('supported') is not True:raise ValueError('Decoration route audit failed: '+str(verdict.get('reason')))
    return dict(value,raw=raw,audit_raw=audit_raw)


def choose_style_reference(candidates):
    """Prefer a small nonempty source, not a host-building silhouette."""
    usable=[(name,image) for name,image in candidates if image.getbbox()]
    if not usable:raise ValueError('No nonempty pixel style reference')
    return min(usable,key=lambda pair:(abs(pair[1].width-32)+abs(pair[1].height-32),pair[0]))


def ground_prompt(command):
    return pixel_prompt('Use the reference only for pixel-art style, never copy its objects or layout. '
        'Replace all reference content with one isolated game prop. '+command+
        ' Render a single native 32x32 sprite enlarged with nearest-neighbor pixels, centered on flat gray #808080. '
        'Keep the defining silhouette and material texture legible at native size using a few contrasting pixel clusters. '
        'Do not replace material texture with smooth gradients or a featureless solid blob. '
        'No host object, building, ground, floor, scene, text, cast shadow or extra objects. Preserve crisp pixel clusters.')


def generate_ground(folder, command, reference, flux, request_image):
    """Cache within this run only; original sprites are never sent for repainting."""
    key=hashlib.sha256(command.strip().encode()).hexdigest()[:20]
    target=folder/'ground-assets'/key
    if (target/'sprite.png').exists():return Image.open(target/'sprite.png').convert('RGBA'),key
    target.mkdir(parents=True,exist_ok=True)
    ref=ImageOps.contain(reference.convert('RGBA'),(384,384),Image.Resampling.NEAREST)
    canvas=Image.new('RGB',(512,512),'#808080')
    canvas.paste(ref,((512-ref.width)//2,(512-ref.height)//2),ref)
    prompt=ground_prompt(command)
    (target/'dsl.json').write_text(json.dumps({'command':command,'prompt':prompt}),encoding='utf8')
    raw=request_image(target,canvas,prompt,flux,1.0,pipeline='town-ground-v1')
    sprite,report=extract_sprite(raw)
    sprite.save(target/'sprite.png')
    (target/'validation.json').write_text(json.dumps(report),encoding='utf8')
    return sprite,key
