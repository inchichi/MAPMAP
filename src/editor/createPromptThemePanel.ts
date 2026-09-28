import './promptTheme.css'
import { applyPromptThemeRun } from './applyPromptThemeRun'
import { createStyleChangePanel } from './panels/createStyleChangePanel'
import { styleWorkspaceContext } from './styleWorkspaceContext'

type Spec = { theme: string; decorations: string[]; night: boolean; twinkle: boolean; color: { gain: number[]; bias: number[] }; warnings: string[] }
type Run = { id: string; mapId?: string; status: string; stage: number; prompt: string; preview?: string; original?: string; error?: string; warnings?: string[]; spec?: Spec; pipeline?: string; current_object?: string; completed_objects?: number; total_objects?: number }
const stages = ['프롬프트 해석', 'TMX 추출 · 단독 인식 · 개별 계획', '색·명암 보정', 'FLUX 장식 생성', '원본 좌표 정렬', '밤·반짝임', '미리보기/적용']

export const createPromptThemePage = (mountElement: HTMLElement): void => {
  const context = styleWorkspaceContext(location.search)
  if (document.querySelector('[data-prompt-theme-panel]')) return
  const dialog = document.createElement('main')
  dialog.dataset.promptThemePanel = 'true'
  document.title = '스타일 변환 · 게임 콘텐츠 에디터'
  document.body.style.background = '#141820'
  dialog.className = 'theme-lab'
  const style = document.createElement('style')
  style.textContent = '[data-prompt-theme-panel] textarea{box-sizing:border-box}[data-prompt-theme-panel] img{image-rendering:pixelated}'
  dialog.append(style)
  const title = document.createElement('h2')
  title.textContent = `스타일 변환 · ${context.mapId === 'floor-1-ruins' ? '1층 폐허마을' : context.mapId}`
  const back = document.createElement('a')
  back.href = context.editorUrl
  back.textContent = '← 게임 에디터로 돌아가기'
  back.className = 'lab-back'
  const note = document.createElement('p')
  note.textContent = '오브젝트별 맞춤 설정: 장식 영역·보호 영역·배치 좌표 고정 → 각각 FLUX 생성 → 결과별 추출·검수. 중복 조각은 부모 오브젝트에 포함하며, 승인 전 게임은 변경하지 않습니다.'
  const prompt = document.createElement('textarea')
  prompt.setAttribute('aria-label', '테마 프롬프트')
  prompt.value = '크리스마스 밤 마을. 눈과 전구를 추가하고 은은하게 반짝이게 해줘.'
  prompt.placeholder = '원하는 계절, 색감, 장식과 시간대를 설명해주세요.'
  const status = document.createElement('pre')
  status.className = 'lab-log'
  const objects = document.createElement('div')
  objects.className = 'lab-objects'
  const previews = document.createElement('div')
  previews.className = 'lab-previews'
  const controls = document.createElement('div')
  controls.className = 'lab-actions'
  const button = (text: string): HTMLButtonElement => {
    const b = document.createElement('button'); b.textContent = text
    b.className = 'lab-button'; b.type = 'button'
    controls.append(b); return b
  }
  const analyze = button('대상 확인')
  if (!context.crypt) analyze.textContent = '단독 인식 · LLM 계획'
  const generate = button('스타일 생성하기')
  const apply = button('게임에 적용하기 →')
  const history = button('실행 기록 / 결과 다시 열기')
  const records = document.createElement('div')
  records.className = 'lab-records'
  const sectionTitle = (text: string, detail: string): HTMLElement => {
    const wrap = document.createElement('div')
    const heading = document.createElement('h2'); heading.textContent = text
    const caption = document.createElement('p'); caption.textContent = detail
    wrap.append(heading, caption); return wrap
  }
  const stepBar = document.createElement('ol'); stepBar.className = 'lab-steps'
  for (const [i, name] of ['테마 입력', '대상 확인', 'FLUX 생성', '검수 · 적용'].entries()) {
    const li = document.createElement('li'); li.textContent = `0${i+1}  ${name}`; stepBar.append(li)
  }
  const progress = document.createElement('div'); progress.className = 'lab-progress'
  progress.setAttribute('role', 'status')
  const meter = document.createElement('progress'); meter.className = 'lab-meter'; meter.max = 100; meter.value = 0
  meter.setAttribute('aria-label', '오브젝트 생성 진행률')
  const setProgress = (index: number, text: string): void => {
    Array.from(stepBar.children).forEach((step, i) => {
      step.className = i === index ? 'active' : i < index ? 'done' : ''
      if (i === index) step.setAttribute('aria-current', 'step')
      else step.removeAttribute('aria-current')
    })
    progress.textContent = text
  }
  const specTags = document.createElement('div'); specTags.className = 'lab-tags'
  const showSpec = (spec: Spec): void => {
    specTags.replaceChildren()
    const names: Record<string, string> = { christmas: '크리스마스', halloween: '할로윈', autumn: '가을', snow: '쌓인 눈', lights: '전구', garland: '화환' }
    for (const value of [names[spec.theme] ?? spec.theme, spec.night ? '밤' : '낮', ...spec.decorations.map(d => names[d] ?? d), ...(spec.twinkle ? ['반짝임'] : [])]) {
      const tag = document.createElement('span'); tag.textContent = value; specTags.append(tag)
    }
  }
  const emptyPreview = (): void => {
    previews.replaceChildren()
    for (const text of ['ORIGINAL · 원본', 'STYLED · 생성 결과']) {
      const box = document.createElement('div'); box.className = 'lab-empty'
      const caption = document.createElement('strong'); caption.textContent = text
      const hint = document.createElement('span'); hint.textContent = '생성 후 이곳에서 비교할 수 있어요'
      box.append(caption, hint); previews.append(box)
    }
  }
  emptyPreview()
  objects.textContent = '프롬프트를 해석하면 변환할 오브젝트를 선택할 수 있습니다.'
  setProgress(0, '준비됨 · 테마를 입력하고 프롬프트를 해석해주세요.')
  generate.classList.add('primary')
  apply.classList.add('primary')

  generate.disabled = true; apply.disabled = true
  let runId: string | undefined
  let visionPlanId: string | undefined
  let needsVisualReview = false
  let plannedPrompt = ''
  let automaticContract: {dsl: unknown; plan: {asset: string}[]; parent_run_id: string} | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let applying = false
  const api = async (path: string, body?: unknown): Promise<unknown> => {
    const r = await fetch('/api/prompt-theme'+path, body === undefined ? {} : { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
    const data = await r.json()
    if (!r.ok) throw new Error(typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail ?? data))
    return data
  }
  const error = (e: unknown): void => { status.textContent = '오류: '+(e instanceof Error ? e.message : String(e)); progress.textContent = status.textContent }
  const show = (run: Run): void => {
    if ((run.mapId ?? 'town') !== context.mapId) { apply.disabled = true; error(new Error('다른 맵의 결과입니다. 현재 맵은 '+context.mapId)); return }
    const labels: Record<string,string> = { ready: '생성 완료 · 원본과 비교한 뒤 승인해주세요.', running: 'FLUX 생성 중 · 수분이 걸릴 수 있습니다.', queued: '생성 대기 중', failed: '생성 실패 · 상세 기록을 확인해주세요.' }
    labels.review_required = '생성 처리 종료 · 실패 항목과 장식 잘림을 검수해주세요.'
    setProgress(['ready','review_required'].includes(run.status) ? 3 : 2, (labels[run.status] ?? run.status) + (run.current_object ? ` · ${run.current_object} (${run.completed_objects ?? 0}/${run.total_objects ?? 0})` : ''))
    meter.value = run.status === 'ready' ? 100 : (run.completed_objects ?? 0) / Math.max(1, run.total_objects ?? 1) * 100
    if (run.spec) showSpec(run.spec)

    status.textContent = stages.map((s,i) => `${i+1}. ${s} ${i+1<run.stage?'✓':i+1===run.stage?'←':''}`).join('\n')+'\n상태: '+run.status+(run.error?'\n'+run.error:'')+'\n'+(run.warnings??[]).join('\n')
    status.textContent += '\n방식: '+(run.pipeline ?? '이전 공통 장식 방식')+(run.current_object ? `\n대상: ${run.current_object} · ${run.completed_objects ?? 0}/${run.total_objects ?? 0} 완료` : '')
    needsVisualReview = run.status === 'review_required' && run.pipeline === 'town-vision-v1'
    apply.textContent = needsVisualReview ? '검수 완료 · 승인 후 적용' : '게임에 적용하기 →'
    apply.disabled = (!needsVisualReview && run.status !== 'ready') || applying
    applyHint.textContent = run.pipeline === 'town-plan-v1' || run.pipeline === 'town-vision-v1'
      ? '통합 결과: 이전 town 테마를 백업 후 전체 교체합니다. 다른 맵과 수동 배치는 유지합니다.'
      : '결과를 확인했나요? 선택한 오브젝트의 장식만 교체합니다.'
    if (run.status === 'ready' || needsVisualReview || run.pipeline?.endsWith('plan-v1')) changes.showRun(run.id)
    if ((run.status === 'ready' || needsVisualReview) && run.preview) {
      previews.replaceChildren()
      for (const [label,url] of [['원본',run.original],['생성 미리보기',run.preview]] as [string, string | undefined][]) {
        if (!url) continue
        const figure = document.createElement('figure'); figure.className = 'lab-figure'
        const img = document.createElement('img'); img.src=url; img.alt=label; img.style.width='100%'
        const caption=document.createElement('figcaption');caption.textContent=label
        const full = document.createElement('a'); full.href=url; full.target='_blank'; full.rel='noopener'; full.title='원본 크기로 열기'; full.append(img); figure.append(caption,full);previews.append(figure)
      }
    }
  }
  const poll = async (): Promise<void> => {
    if (!runId || !dialog.isConnected) return
    try {
      const run=await api('/runs/'+runId) as Run
      if (run.id !== runId || !dialog.isConnected) return
      show(run)
      if (['queued','running'].includes(run.status)) timer=setTimeout(() => { void poll() },2500)
      else { generate.disabled = !plannedPrompt || plannedPrompt !== prompt.value; analyze.disabled=false; prompt.readOnly=false }
    } catch(e) { error(e); analyze.disabled=false; generate.disabled=false }
  }
  analyze.onclick=async () => {
    try {
      automaticContract=undefined; visionPlanId=undefined; plannedPrompt=''; generate.disabled=true; analyze.disabled=true; prompt.readOnly=true
      status.textContent='해석 중...'; setProgress(0, '프롬프트 해석 중…'); apply.disabled=true; emptyPreview()
      const plan=await api(context.crypt ? '/integration/plan' : '/town-vision/plan',{prompt:prompt.value,mapId:context.mapId}) as {id?:string;spec:Spec;objects:{id:string;category:string;box:number[];profile_label?:string;eligible?:boolean;image?:string}[]; dsl:unknown;plan:{asset:string;prompt?:string;recognition?:unknown}[];parent_run_id:string}
      if (!context.crypt) { visionPlanId=plan.id; contractInput.value=JSON.stringify(plan.plan,null,2) }
      if (context.crypt) { automaticContract=plan; contractInput.value=JSON.stringify({dsl:plan.dsl,plan:plan.plan,parent_run_id:plan.parent_run_id},null,2) }
      plannedPrompt=prompt.value; objects.replaceChildren(); showSpec(plan.spec); setProgress(1, '해석 완료 · 변환할 오브젝트를 선택해주세요.')
      const preferred=['town_hall','tree_1','fountain_1','blacksmith_stall']
      for (const o of plan.objects) {
        const label=document.createElement('label'), input=document.createElement('input')
        input.type='checkbox';input.value=o.id;input.checked=context.crypt ? plan.objects.indexOf(o)<2 : preferred.includes(o.id)
        if (o.eligible === false) { input.checked=false; input.disabled=true }
        if (o.image) {
          const thumbnail=document.createElement('img');thumbnail.src=o.image;thumbnail.alt=o.id
          thumbnail.style.cssText='width:56px;height:56px;object-fit:contain';label.append(thumbnail)
          label.title=plan.plan.find(row=>row.asset===o.id)?.prompt ?? ''
        }
        label.append(input,document.createTextNode(o.profile_label ?? o.id+' ('+o.category+')'));objects.append(label)
      }
      status.textContent=(context.crypt ? '규칙 기반 DSL·Planner\n' : 'Qwen3-VL 단독 인식 + LLM 개별 계획\n')+JSON.stringify(plan.spec,null,2)+'\n분류와 개별 프롬프트를 확인하고 대상을 선택하세요. 복합·미확인 대상은 제외됩니다.'
      generate.disabled=false
    } catch(e) { error(e);generate.disabled=true } finally { analyze.disabled=false;prompt.readOnly=false }
  }
  prompt.oninput=() => {generate.disabled=true;apply.disabled=true;plannedPrompt=''; setProgress(0, '프롬프트가 변경됐습니다. 다시 해석해주세요.')}
  generate.onclick=async () => {
    try {
      if (plannedPrompt!==prompt.value) throw new Error('프롬프트를 다시 해석해주세요.')
      generate.disabled=true;analyze.disabled=true;apply.disabled=true;prompt.readOnly=true;emptyPreview(); setProgress(2, '생성·색 보정 요청 중…')
      const targets=Array.from(objects.querySelectorAll<HTMLInputElement>('input:checked')).map(i=>i.value)
      if (!targets.length) throw new Error('대상을 하나 이상 선택해주세요.')
      if (context.crypt && !automaticContract) throw new Error('먼저 프롬프트를 해석해주세요.')
      if (!context.crypt && !visionPlanId) throw new Error('먼저 단독 인식과 LLM 계획을 실행해주세요.')
      const run=await api(context.crypt ? '/integration/runs' : '/town-vision/runs',context.crypt
        ? {...automaticContract, mapId:context.mapId, plan:automaticContract!.plan.filter(row=>targets.includes(row.asset))}
        : {plan_id:visionPlanId,targets}) as {id:string}
      runId=run.id;void poll()
    } catch(e) {error(e);generate.disabled=false;analyze.disabled=false;prompt.readOnly=false}
  }
  apply.onclick=async () => {
    if (!runId) return
    applying=true;apply.disabled=true
    try {
      if (needsVisualReview) {
        if (!window.confirm('원본·색 보정·장식의 위치와 잘림을 확인했나요? 검수 완료로 승인하고 게임에 적용합니다.')) return
        await api(`/runs/${runId}/visual-accept`, {})
        needsVisualReview=false
      }
      if (context.crypt) {
        await api(`/runs/${runId}/crypt-apply`, {})
        localStorage.setItem('crypt-crawler:style-visible', 'true')
        location.assign(context.editorUrl)
        return
      }
      const warning = await applyPromptThemeRun(runId)
      if (warning) { status.textContent = warning; return }
      setProgress(3, '적용 완료 · 게임 에디터로 돌아가 확인하세요.')
      for (const frame of document.querySelectorAll('iframe')) frame.contentWindow?.postMessage({type:'editor:placement-refresh'},location.origin)
      status.textContent='적용·이 브라우저에 저장 완료. 게임 에디터에서 확인하세요. 장식 버튼으로 색 보정/밤/장식을 함께 끌 수 있습니다. 이전 배치는 브라우저에 백업했습니다.'
      location.assign(`/editor.html?styleRun=${runId}`)
    } catch(e) {error(e)} finally {applying=false;apply.disabled=false}
  }
  history.onclick=async () => {
    try {
      records.replaceChildren()
      recordDetails.open = true
      const runs = await api('/runs') as Run[]
      if (!runs.length) records.textContent = '아직 실행 기록이 없습니다.'
      for (const run of runs.filter(r => (r.mapId ?? 'town') === context.mapId)) {
        const b=document.createElement('button');b.className='lab-record'; b.type='button'
        b.textContent=(run.pipeline ?? '이전 방식')+' · '+run.status+' · '+run.prompt+' · '+run.id.slice(0,8)
        b.onclick=() => {if(timer)clearTimeout(timer);runId=run.id;previews.replaceChildren();show(run);if(['running','queued'].includes(run.status))void poll()}
        records.append(b)
      }
    } catch(e){error(e)}
  }
  window.addEventListener('pagehide',()=>{if(timer)clearTimeout(timer)},{once:true})
  status.textContent=stages.map((s,i)=>`${i+1}. ${s}`).join('\n')+'\n프롬프트를 입력하고 해석부터 시작하세요. 기존 결과는 실행 기록에서 다시 열 수 있습니다.'
  const header = document.createElement('header'); header.className = 'lab-header'
  const brand = document.createElement('div')
  const eyebrow = document.createElement('div'); eyebrow.className = 'lab-eyebrow'; eyebrow.textContent = 'STYLE WORKSPACE / FLUX'
  const subtitle = document.createElement('p'); subtitle.textContent = '원본은 그대로, 분위기는 새롭게.'
  brand.append(eyebrow, title, subtitle); header.append(brand, back)
  const layout = document.createElement('div'); layout.className = 'lab-layout'
  const inputCard = document.createElement('section'); inputCard.className = 'lab-card lab-input'
  const promptLabel = document.createElement('label'); promptLabel.textContent = '테마 프롬프트'; prompt.id='lab-prompt'; promptLabel.htmlFor=prompt.id
  const selectionTools = document.createElement('div'); selectionTools.className = 'lab-selection-tools'
  for (const [text, checked] of [['전체 선택', true], ['선택 해제', false]] as const) {
    const select = document.createElement('button'); select.type = 'button'; select.className = 'lab-button'; select.textContent = text
    select.onclick = () => objects.querySelectorAll<HTMLInputElement>('input').forEach(input => { if (!input.disabled) input.checked = checked })
    selectionTools.append(select)
  }
  inputCard.append(sectionTitle('어떤 분위기를 만들까요?', '원본 구조는 그대로. 색감과 장식만 새롭게.'), promptLabel, prompt, specTags, controls, sectionTitle('변환 대상', '대상을 확인한 뒤 필요한 오브젝트만 선택하세요.'), selectionTools, objects)
  controls.replaceChildren(analyze, generate)
  const outputCard = document.createElement('section'); outputCard.className = 'lab-card lab-output'
  const previewHead = sectionTitle('미리보기 · 비교', '이미지를 누르면 원본 크기로 볼 수 있습니다. 승인 전에는 게임이 바뀌지 않습니다.')
  const applyRow = document.createElement('div'); applyRow.className = 'lab-apply'
  const applyHint = document.createElement('span')
  applyHint.textContent = '결과를 확인했나요? 선택한 오브젝트의 장식만 교체합니다.'
  applyRow.append(applyHint, apply)
  const debug = document.createElement('details'); debug.className = 'lab-details'
  const debugTitle = document.createElement('summary'); debugTitle.textContent = '상세 설정 · 진행 로그'
  debug.append(debugTitle, status)
  outputCard.append(previewHead, progress, meter, previews, applyRow, debug)
  layout.append(inputCard, outputCard)
  // Change List (Generate) + Asset Details (Review) for the opened run; read-only.
  const changes = createStyleChangePanel()
  const advanced = document.createElement('details'); advanced.className = 'lab-details'
  const advancedTitle = document.createElement('summary'); advancedTitle.textContent = '고급 설정 · Visual DSL'
  advanced.append(advancedTitle, changes.dslCard)
  inputCard.append(advanced)
  const contractBox = document.createElement('details'); contractBox.className = 'lab-details'
  const contractTitle = document.createElement('summary'); contractTitle.textContent = `통합 MVP · DSL + Plan 실행 (${context.mapId})`
  const contractNote = document.createElement('p')
  contractNote.textContent = '세리팀 DSL·Planner 연결 전 수동 계약 파일로 실행합니다. 적용하면 기존 town 테마를 백업 후 교체합니다. Crypt와 원본 에셋은 변경하지 않습니다.'
  if (context.crypt) contractNote.textContent = '규칙 기반 DSL·Planner의 전체 계획입니다. 일반 생성은 위에서 체크한 대상만 처리합니다. 이 고급 실행 버튼은 JSON의 전체 계획을 실행합니다.'
  const contractInput = document.createElement('textarea')
  contractInput.setAttribute('aria-label', '통합 계약 JSON')
  contractInput.placeholder = '{"dsl": {...}, "plan": [...]}'
  const sampleButton = document.createElement('button'); sampleButton.type = 'button'; sampleButton.className = 'lab-button'
  sampleButton.textContent = '수동 샘플 불러오기'
  const contractRun = document.createElement('button'); contractRun.type = 'button'; contractRun.className = 'lab-button'
  contractRun.textContent = '계약 검증 · 생성'
  sampleButton.onclick = async () => {
    try { contractInput.value = JSON.stringify(await api(`/integration/sample?mapId=${encodeURIComponent(context.mapId)}`), null, 2) } catch (e) { error(e) }
  }
  contractRun.onclick = async () => {
    contractRun.disabled = true
    try {
      const result = await api('/integration/runs', { ...JSON.parse(contractInput.value), mapId: context.mapId }) as { id: string }
      if (timer) clearTimeout(timer)
      runId = result.id; generate.disabled = true; apply.disabled = true; analyze.disabled = true
      emptyPreview(); void poll()
    } catch (e) { error(e) } finally { contractRun.disabled = false }
  }
  contractBox.append(contractTitle, contractNote, sampleButton, contractInput, contractRun)
  if (!context.crypt) {
    contractTitle.textContent='LLM 개별 프롬프트 · 인식 결과'
    contractNote.textContent='단독 원본을 분류한 뒤 작성한 계획입니다. 확인 후 위 목록에서 생성 대상을 선택하세요.'
    contractInput.readOnly=true;sampleButton.hidden=true;contractRun.hidden=true
    prompt.value='할로윈 밤. 원본 구조를 유지하고 보라색 계열 색감과 명암을 보정해줘. 작은 호박등과 거미줄을 붙여줘.'
  }
  inputCard.append(contractBox)
  if (context.crypt) {
    analyze.disabled = false; generate.disabled = true; prompt.readOnly = false
    prompt.value = '크리스마스 밤. 원본 색은 그대로 두고 눈과 전구를 추가하고 반짝이게 해줘.'
    objects.textContent = '프롬프트를 해석하면 폐허마을 소품 그룹별 계획을 확인할 수 있습니다.'
    note.textContent = '대상: '+context.mapId+' · 기존 결과 유지 · 새 실행은 별도 기록 · 적용은 Crypt 전용 경로'
  }
  const changeCard = document.createElement('section'); changeCard.className = 'lab-card lab-changes'
  changeCard.append(changes.changeList, changes.assetDetails)
  const recordDetails = document.createElement('details'); recordDetails.className = 'lab-history'
  const recordTitle = document.createElement('summary'); recordTitle.textContent = '이전 실험 기록'
  recordDetails.append(recordTitle, history, records)
  note.className = 'lab-footnote'
  dialog.append(header, stepBar, layout, changeCard, recordDetails, note)
  mountElement.replaceChildren(dialog)
  const requestedRun = new URLSearchParams(location.search).get('run')
  if (requestedRun && /^[a-f0-9]{32}$/.test(requestedRun)) { runId = requestedRun; void poll() }
  else if (context.crypt) {
    void (async () => {
      const runs = await api('/runs') as Run[]
      const running = runs.find(run => run.mapId === context.mapId && ['running', 'queued'].includes(run.status))
      if (running) { runId = running.id; await poll(); return }
      const r = await fetch(context.activeUrl, { cache: 'no-store' })
      if (!r.ok) throw new Error('현재 맵의 적용 기록을 찾지 못했습니다.')
      const active = await r.json() as { id: string }
      runId = active.id; await poll()
    })().catch(error)
  }
}
