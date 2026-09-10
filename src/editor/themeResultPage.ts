import { applyPromptThemeRun } from './applyPromptThemeRun'

const runId = location.pathname.split('/')[2]
const bar = document.createElement('section')
bar.style.cssText = 'position:sticky;top:0;z-index:10;background:#252326;border:1px solid #bd9651;padding:16px;display:flex;gap:16px;align-items:center;flex-wrap:wrap'
const apply = document.createElement('button')
apply.textContent = '에디터에 적용'
apply.disabled = true
apply.style.cssText = 'padding:10px 22px;background:#d3a553;border:0;border-radius:8px;font:inherit;cursor:pointer'
const message = document.createElement('span')
message.textContent = '완료 상태 확인 중…'
const logs = document.createElement('a')
logs.href = 'events.jsonl'
logs.textContent = '실행·적용 로그'
const editor = document.createElement('a')
editor.href = '/editor.html'
editor.textContent = '에디터 열기'
bar.append(apply, message, logs, editor)
document.body.prepend(bar)
let applying = false
const check = async (): Promise<void> => {
  try {
    const response = await fetch(`/api/prompt-theme/runs/${runId}`, { cache: 'no-store' })
    if (!response.ok) throw new Error(await response.text())
    const run = await response.json()
    apply.disabled = run.status !== 'ready' || applying
    if (!applying) message.textContent = run.status === 'ready' ? '원본 맵 유지 · 결과를 저장하고 에디터로 이동합니다.' : `아직 적용할 수 없습니다: ${run.status}`
    if (['running', 'queued'].includes(run.status)) window.setTimeout(() => { void check() }, 3000)
  } catch (error) {
    message.textContent = `상태 확인 실패: ${String(error)}`
    window.setTimeout(() => { void check() }, 5000)
  }
}
apply.onclick = async () => {
  applying = true
  apply.disabled = true
  message.textContent = '이미지 확인 · 적용 · 저장 중…'
  try {
    const warning = await applyPromptThemeRun(runId)
    if (warning) {
      message.textContent = warning
      return
    }
    location.assign('/editor.html')
  } catch (error) {
    message.textContent = `적용 실패: ${String(error)}`
  } finally {
    applying = false
    apply.disabled = false
  }
}
void check()
