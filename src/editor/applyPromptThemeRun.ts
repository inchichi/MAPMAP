import { installPromptTheme, loadPlacementsForMap, type PromptThemeApproval } from './placementStore'

export const applyPromptThemeRun = async (runId: string): Promise<string | undefined> => {
  const response = await fetch(`/api/prompt-theme/runs/${runId}/approve`, { method: 'POST' })
  if (!response.ok) throw new Error(await response.text())
  const approval = await response.json() as PromptThemeApproval
  await Promise.all([...new Set(approval.placements.flatMap(item => [item.imageUrl, item.themeSettings?.tilesetImageUrl]).filter((url): url is string => Boolean(url)))].map(url => new Promise<void>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(`결과 이미지를 불러오지 못했습니다: ${url}`))
    image.src = url ?? ''
  })))
  installPromptTheme(approval)
  const saved = loadPlacementsForMap(approval.mapId)
  if (!approval.placements.every(item => saved.some(value => value.id === item.id && value.visible !== false))) {
    throw new Error('브라우저 적용 저장 확인에 실패했습니다.')
  }
  for (const frame of document.querySelectorAll('iframe')) {
    frame.contentWindow?.postMessage({ type: 'editor:placement-refresh' }, location.origin)
  }
  try {
    const log = await fetch(`/api/prompt-theme/runs/${runId}/applied`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement_ids: approval.placements.map(item => item.id) })
    })
    if (!log.ok) throw new Error(await log.text())
  } catch {
    return '브라우저 적용은 완료됐지만 서버 적용 이력 저장에 실패했습니다. 생성 결과는 보존돼 있습니다.'
  }
  return undefined
}
