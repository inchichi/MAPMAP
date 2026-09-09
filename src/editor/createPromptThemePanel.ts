import './promptTheme.css'
import { installPromptTheme, type PromptThemeApproval } from './placementStore'

type Spec = { theme: string; decorations: string[]; night: boolean; twinkle: boolean; color: { gain: number[]; bias: number[] }; warnings: string[] }
type Run = { id: string; status: string; stage: number; prompt: string; preview?: string; original?: string; error?: string; warnings?: string[]; spec?: Spec; pipeline?: string; current_object?: string; completed_objects?: number; total_objects?: number }
const stages = ['프롬프트 해석', 'TMX 원본 추출', '색·명암 보정', 'FLUX 장식 생성', '원본 좌표 정렬', '밤·반짝임', '미리보기/적용']

export const createPromptThemePage = (mountElement: HTMLElement): void => {
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
  title.textContent = '스타일 변환'
  const back = document.createElement('a')
  back.href = '/editor.html'
  back.textContent = '← 게임 에디터로 돌아가기'
  back.className = 'lab-back'
  const note = document.createElement('p')
  note.textContent = '오브젝트별 맞춤 설정: 장식 영역·보호 영역·배치 좌표 고정 → 각각 FLUX 생성 → 결과별 추출·검수. 현재 등록된 4개 대상만 지원하며, 승인 전 게임은 변경하지 않습니다.'
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
  const analyze = button('1. 프롬프트 해석')
  const generate = button('2. 생성 시작')
  const apply = button('3. 미리보기 승인 · 적용/저장')
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
  let plannedPrompt = ''
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
    const labels: Record<string,string> = { ready: '생성 완료 · 원본과 비교한 뒤 승인해주세요.', running: 'FLUX 생성 중 · 수분이 걸릴 수 있습니다.', queued: '생성 대기 중', failed: '생성 실패 · 상세 기록을 확인해주세요.' }
    setProgress(run.status === 'ready' ? 3 : 2, (labels[run.status] ?? run.status) + (run.current_object ? ` · ${run.current_object} (${run.completed_objects ?? 0}/${run.total_objects ?? 0})` : ''))
    if (run.spec) showSpec(run.spec)

    status.textContent = stages.map((s,i) => `${i+1}. ${s} ${i+1<run.stage?'✓':i+1===run.stage?'←':''}`).join('\n')+'\n상태: '+run.status+(run.error?'\n'+run.error:'')+'\n'+(run.warnings??[]).join('\n')
    status.textContent += '\n방식: '+(run.pipeline ?? '이전 공통 장식 방식')+(run.current_object ? `\n대상: ${run.current_object} · ${run.completed_objects ?? 0}/${run.total_objects ?? 0} 완료` : '')
    apply.disabled = run.status !== 'ready' || applying
    if (run.status === 'ready' && run.preview) {
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
      else { generate.disabled = plannedPrompt !== prompt.value; analyze.disabled=false; prompt.readOnly=false }
    } catch(e) { error(e); analyze.disabled=false; generate.disabled=false }
  }
  analyze.onclick=async () => {
    try {
      status.textContent='해석 중...'; setProgress(0, '프롬프트 해석 중…'); apply.disabled=true; emptyPreview()
      const plan=await api('/plan',{prompt:prompt.value}) as {spec:Spec;objects:{id:string;category:string;box:number[];profile_label?:string}[]}
      plannedPrompt=prompt.value; objects.replaceChildren(); showSpec(plan.spec); setProgress(1, '해석 완료 · 변환할 오브젝트를 선택해주세요.')
      const preferred=['town_hall','tree_1','fountain_1','blacksmith_stall']
      for (const o of plan.objects) {
        const label=document.createElement('label'), input=document.createElement('input')
        input.type='checkbox';input.value=o.id;input.checked=preferred.includes(o.id)
        label.append(input,document.createTextNode(o.profile_label ?? o.id+' ('+o.category+')'));objects.append(label)
      }
      status.textContent='규칙 기반 해석 (지원: 크리스마스/겨울·할로윈·가을)\n'+JSON.stringify(plan.spec,null,2)+'\n위 설정을 확인한 다음 생성하세요. FLUX 생성은 수분 소요됩니다.'
      generate.disabled=false
    } catch(e) { error(e);generate.disabled=true }
  }
  prompt.oninput=() => {generate.disabled=true;apply.disabled=true;plannedPrompt=''; setProgress(0, '프롬프트가 변경됐습니다. 다시 해석해주세요.')}
  generate.onclick=async () => {
    try {
      if (plannedPrompt!==prompt.value) throw new Error('프롬프트를 다시 해석해주세요.')
      generate.disabled=true;analyze.disabled=true;apply.disabled=true;prompt.readOnly=true;emptyPreview(); setProgress(2, 'FLUX 생성 요청 중…')
      const targets=Array.from(objects.querySelectorAll<HTMLInputElement>('input:checked')).map(i=>i.value)
      const run=await api('/runs',{prompt:prompt.value,targets}) as {id:string}
      runId=run.id;void poll()
    } catch(e) {error(e);generate.disabled=false;analyze.disabled=false;prompt.readOnly=false}
  }
  apply.onclick=async () => {
    if (!runId) return
    applying=true;apply.disabled=true
    try {
      const approval = await api('/runs/'+runId+'/approve',{}) as PromptThemeApproval
      installPromptTheme(approval)
      setProgress(3, '적용 완료 · 게임 에디터로 돌아가 확인하세요.')
      for (const frame of document.querySelectorAll('iframe')) frame.contentWindow?.postMessage({type:'editor:placement-refresh'},location.origin)
      status.textContent='적용·이 브라우저에 저장 완료. 상단의 게임 에디터로 돌아가 결과를 확인하세요. 장식 버튼으로 색 보정/밤/장식을 함께 끌 수 있습니다. 이전 배치는 브라우저에 백업했습니다. 선택한 오브젝트의 장식만 교체했습니다.'
    } catch(e) {error(e)} finally {applying=false;apply.disabled=false}
  }
  history.onclick=async () => {
    try {
      records.replaceChildren()
      recordDetails.open = true
      const runs = await api('/runs') as Run[]
      if (!runs.length) records.textContent = '아직 실행 기록이 없습니다.'
      for (const run of runs) {
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
  inputCard.append(sectionTitle('어떤 분위기로 바꿀까요?', '계절·색감·장식·시간대를 한 문장으로 설명해주세요.'), promptLabel, prompt, controls, sectionTitle('변환할 오브젝트', '원본 크기와 구조는 유지하고 장식만 따로 생성합니다.'), objects, specTags)
  controls.replaceChildren(analyze, generate)
  const outputCard = document.createElement('section'); outputCard.className = 'lab-card lab-output'
  const previewHead = sectionTitle('미리보기 · 비교', '이미지를 누르면 원본 크기로 볼 수 있습니다. 승인 전에는 게임이 바뀌지 않습니다.')
  const applyRow = document.createElement('div'); applyRow.className = 'lab-apply'
  applyRow.append(document.createTextNode('결과를 확인했나요? 선택한 오브젝트의 장식만 교체합니다.'), apply)
  const debug = document.createElement('details'); debug.className = 'lab-details'
  const debugTitle = document.createElement('summary'); debugTitle.textContent = '상세 설정 · 진행 로그'
  debug.append(debugTitle, status)
  outputCard.append(previewHead, progress, previews, applyRow, debug)
  layout.append(inputCard, outputCard)
  const recordDetails = document.createElement('details'); recordDetails.className = 'lab-history'
  const recordTitle = document.createElement('summary'); recordTitle.textContent = '이전 실험 기록'
  recordDetails.append(recordTitle, history, records)
  note.className = 'lab-footnote'
  dialog.append(header, stepBar, layout, recordDetails, note)
  mountElement.replaceChildren(dialog)
}
