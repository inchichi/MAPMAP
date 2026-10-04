import { hydratePlacementsForMapFromServer } from './placementStore'

type Spec = { theme: string; decorations: string[]; night: boolean; twinkle: boolean; color: { gain: number[]; bias: number[] }; warnings: string[] }
type Run = { id: string; status: string; stage: number; prompt: string; preview?: string; original?: string; error?: string; warnings?: string[]; spec?: Spec; pipeline?: string; current_object?: string; completed_objects?: number; total_objects?: number }
const stages = ['프롬프트 해석', 'TMX 원본 추출', '색·명암 보정', 'FLUX 장식 생성', '원본 좌표 정렬', '밤·반짝임', '미리보기/적용']

export const createPromptThemePage = (mountElement: HTMLElement): void => {
  if (document.querySelector('[data-prompt-theme-panel]')) return
  const dialog = document.createElement('main')
  dialog.dataset.promptThemePanel = 'true'
  document.title = '스타일 변환 · 게임 콘텐츠 에디터'
  document.body.style.background = '#141820'
  dialog.style.cssText = 'box-sizing:border-box;width:min(1200px,100%);min-height:100vh;margin:0 auto;background:#20242d;color:#eee;padding:clamp(16px,3vw,36px);font-family:system-ui,sans-serif'
  const style = document.createElement('style')
  style.textContent = '[data-prompt-theme-panel] button:disabled{opacity:.4;cursor:wait!important}[data-prompt-theme-panel] textarea{box-sizing:border-box}[data-prompt-theme-panel] img{image-rendering:pixelated}'
  dialog.append(style)
  const title = document.createElement('h2')
  title.textContent = '스타일 변환 · 마을'
  const back = document.createElement('a')
  back.href = '/editor.html'
  back.textContent = '← 게임 에디터로 돌아가기'
  back.style.cssText = 'display:inline-block;color:#e9c582;margin-bottom:12px'
  const note = document.createElement('p')
  note.textContent = '오브젝트별 맞춤 설정: 장식 영역·보호 영역·배치 좌표 고정 → 각각 FLUX 생성 → 결과별 추출·검수. 현재 등록된 4개 대상만 지원하며, 승인 전 게임은 변경하지 않습니다.'
  const prompt = document.createElement('textarea')
  prompt.setAttribute('aria-label', '테마 프롬프트')
  prompt.value = '크리스마스 밤 마을. 눈과 전구를 추가하고 은은하게 반짝이게 해줘.'
  prompt.style.cssText = 'width:100%;min-height:85px;color:#fff;background:#111827;padding:12px'
  const status = document.createElement('pre')
  status.style.cssText = 'white-space:pre-wrap;line-height:1.7'
  const objects = document.createElement('div')
  objects.style.cssText = 'display:flex;gap:14px;flex-wrap:wrap;margin:14px 0'
  const previews = document.createElement('div')
  previews.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap'
  const controls = document.createElement('div')
  controls.style.cssText = 'display:flex;gap:12px;margin:12px 0;flex-wrap:wrap'
  const button = (text: string): HTMLButtonElement => {
    const b = document.createElement('button'); b.textContent = text
    b.style.cssText = 'background:#705627;color:white;border:1px solid #c0a473;border-radius:7px;padding:8px 14px;cursor:pointer'
    controls.append(b); return b
  }
  const analyze = button('1. 프롬프트 해석')
  const generate = button('2. 생성 시작')
  const apply = button('3. 미리보기 승인 · 적용/저장')
  const history = button('실행 기록 / 결과 다시 열기')
  const records = document.createElement('div')
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
  const error = (e: unknown): void => { status.textContent = '오류: '+(e instanceof Error ? e.message : String(e)) }
  const show = (run: Run): void => {
    status.textContent = stages.map((s,i) => `${i+1}. ${s} ${i+1<run.stage?'✓':i+1===run.stage?'←':''}`).join('\n')+'\n상태: '+run.status+(run.error?'\n'+run.error:'')+'\n'+(run.warnings??[]).join('\n')
    status.textContent += '\n방식: '+(run.pipeline ?? '이전 공통 장식 방식')+(run.current_object ? `\n대상: ${run.current_object} · ${run.completed_objects ?? 0}/${run.total_objects ?? 0} 완료` : '')
    apply.disabled = run.status !== 'ready' || applying
    if (run.status === 'ready' && run.preview) {
      previews.replaceChildren()
      for (const [label,url] of [['원본',run.original],['생성 미리보기',run.preview]] as [string, string | undefined][]) {
        if (!url) continue
        const figure = document.createElement('figure'); figure.style.cssText='width:46%;margin:0'
        const img = document.createElement('img'); img.src=url; img.alt=label; img.style.width='100%'
        const caption=document.createElement('figcaption');caption.textContent=label
        figure.append(caption,img);previews.append(figure)
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
      status.textContent='해석 중...'; apply.disabled=true; previews.replaceChildren()
      const plan=await api('/plan',{prompt:prompt.value}) as {spec:Spec;objects:{id:string;category:string;box:number[];profile_label?:string}[]}
      plannedPrompt=prompt.value; objects.replaceChildren()
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
  prompt.oninput=() => {generate.disabled=true;apply.disabled=true;plannedPrompt=''}
  generate.onclick=async () => {
    try {
      if (plannedPrompt!==prompt.value) throw new Error('프롬프트를 다시 해석해주세요.')
      generate.disabled=true;analyze.disabled=true;apply.disabled=true;prompt.readOnly=true;previews.replaceChildren()
      const targets=Array.from(objects.querySelectorAll<HTMLInputElement>('input:checked')).map(i=>i.value)
      const run=await api('/runs',{prompt:prompt.value,targets}) as {id:string}
      runId=run.id;void poll()
    } catch(e) {error(e);generate.disabled=false;analyze.disabled=false;prompt.readOnly=false}
  }
  apply.onclick=async () => {
    if (!runId) return
    applying=true;apply.disabled=true
    try {
      await api('/runs/'+runId+'/apply',{})
      await hydratePlacementsForMapFromServer('town')
      for (const frame of document.querySelectorAll('iframe')) frame.contentWindow?.postMessage({type:'editor:placement-refresh'},location.origin)
      status.textContent='적용·서버 저장 완료. 상단의 게임 에디터로 돌아가 결과를 확인하세요. 장식 버튼으로 색 보정/밤/장식을 함께 끌 수 있습니다. 이전 배치는 실행 폴더에 백업했습니다.'
    } catch(e) {error(e)} finally {applying=false;apply.disabled=false}
  }
  history.onclick=async () => {
    try {
      records.replaceChildren()
      for (const run of await api('/runs') as Run[]) {
        const b=document.createElement('button');b.style.cssText='display:block;padding:8px;border:1px solid #666;margin:5px 0'
        b.textContent=(run.pipeline ?? '이전 방식')+' · '+run.status+' · '+run.prompt+' · '+run.id.slice(0,8)
        b.onclick=() => {if(timer)clearTimeout(timer);runId=run.id;previews.replaceChildren();show(run);if(['running','queued'].includes(run.status))void poll()}
        records.append(b)
      }
    } catch(e){error(e)}
  }
  window.addEventListener('pagehide',()=>{if(timer)clearTimeout(timer)},{once:true})
  status.textContent=stages.map((s,i)=>`${i+1}. ${s}`).join('\n')+'\n프롬프트를 입력하고 해석부터 시작하세요. 기존 결과는 실행 기록에서 다시 열 수 있습니다.'
  dialog.append(back,title,note,prompt,controls,objects,status,previews,records)
  mountElement.replaceChildren(dialog)
}
