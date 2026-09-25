export const styleWorkspaceContext = (search: string) => {
  const params = new URLSearchParams(search)
  const mapId = params.get('map') ?? 'floor-1-ruins'
  const crypt = mapId !== 'town'
  return {
    mapId,
    crypt,
    editorUrl: crypt ? `/editor.html?game=crypt&map=${encodeURIComponent(mapId)}` : '/editor.html',
    activeUrl: mapId === 'floor-0-town' ? '/crypt-style/active.json' : `/crypt-style/active-${mapId}.json`
  }
}
