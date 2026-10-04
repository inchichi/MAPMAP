// Timing is separate from generation; never restart or mutate the running job.
;(async () => {
  const run = location.pathname.split('/')[2]
  let snapshot = null
  const format = seconds => {
    if (!Number.isFinite(seconds)) return '기록 없음'
    const value = Math.max(0, Math.floor(seconds))
    return `${Math.floor(value / 60)}분 ${String(value % 60).padStart(2, '0')}초`
  }
  const render = () => {
    if (!snapshot) return
    for (const card of document.querySelectorAll('article')) {
      const name = card.querySelector('h2')?.textContent
      const r = snapshot[name]
      if (!r) continue
      let line = card.querySelector('.object-timing')
      if (!line) {
        line = document.createElement('p')
        line.className = 'object-timing'
        line.style.cssText = 'color:#e9c384;font-size:13px;border-top:1px solid #ffffff15;padding-top:8px'
        card.append(line)
      }
      const suffix = r.estimated ? ' · 파일 시각 기준 추정' : ''
      if (r.status === 'pending') line.textContent = '생성 시간: 대기 중'
      else if (r.status === 'reused') line.textContent = `결과 재사용 · 새 생성 없음${r.elapsed_seconds != null ? ' · 처리 '+format(r.elapsed_seconds) : ''}${suffix}`
      else if (r.status === 'running') line.textContent = r.started_at ? `처리 중 ${format(Date.now()/1000-r.started_at)}${suffix}` : '처리 중 · 시작 시각 기록 없음'
      else {
        const parts = []
        if (r.generation_seconds != null) parts.push('FLUX 요청 '+format(r.generation_seconds))
        if (r.elapsed_seconds != null) parts.push('전체 처리 '+format(r.elapsed_seconds))
        line.textContent = (r.status === 'failed' ? '실패까지 · ' : '')+(parts.join(' / ') || '소요 시간 기록 없음')+suffix
      }
    }
  }
  const refresh = async () => {
    try {
      const response = await fetch(`/api/prompt-theme/runs/${run}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('status unavailable')
      const state = await response.json()
      snapshot = state.object_results || {}
      if (Object.values(snapshot).some(r => r.status !== 'pending' && r.started_at == null)) {
        const timing = await fetch('timings.json', { cache: 'no-store' })
        if (timing.ok) snapshot = { ...snapshot, ...(await timing.json()).objects }
      }
      render()
      if (['running', 'queued'].includes(state.status)) setTimeout(refresh, 5000)
    } catch { setTimeout(refresh, 10000) }
  }
  setInterval(render, 1000)
  await refresh()
})()
