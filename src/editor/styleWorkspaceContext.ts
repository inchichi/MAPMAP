export const styleWorkspaceContext = (search: string) => {
  const params = new URLSearchParams(search)
  const mapId = params.get('map') ?? 'floor-1-ruins'
  const crypt = !['town', 'harvest-village'].includes(mapId)
  return {
    mapId,
    crypt,
    editorUrl: `/editor.html?game=${crypt ? 'crypt' : 'my-sample-rpg'}&map=${encodeURIComponent(mapId)}`,
    activeUrl: mapId === 'floor-0-town' ? '/crypt-style/active.json' : `/crypt-style/active-${mapId}.json`
  }
}
