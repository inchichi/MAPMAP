import { Assets, Container, Graphics, Sprite, type Texture } from 'pixi.js'

type Manifest = {
  id: string
  mapId: string
  width: number
  height: number
  overlay: string
  night: number
  bulbs: [number, number][]
  source_hashes: Record<string, string>
}

/** Visual-only layer: never edits TMX tiles, actor positions or collision. */
export async function createCryptStyleLayer(mapId: string, width: number, height: number) {
  const container = new Container()
  const lights = new Graphics()
  let points: [number, number][] = []
  let disposed = false
  let lastTick = -1
  let activeId = ''
  let checking = false
  const visibility = () => { container.visible = localStorage.getItem('crypt-crawler:style-visible') !== 'false' }
  visibility()
  window.addEventListener('storage', visibility)
  const refresh = async () => {
    if (disposed || checking || !['floor-0-town', 'floor-1-ruins'].includes(mapId)) return
    checking = true
    try {
      const selection = mapId === 'floor-0-town' ? 'active' : `active-${mapId}`
      const response = await fetch(`/crypt-style/${selection}.json`, { cache: 'no-store' })
      if (!response.ok) return
      const manifest: Manifest = await response.json()
      if (manifest.id === activeId) return
      if (manifest.mapId !== mapId || manifest.width !== width || manifest.height !== height
        || !/^[a-f0-9]{32}$/.test(manifest.id)
        || manifest.overlay !== `/theme-runs/${manifest.id}/decoration-map.png`) throw new Error('Crypt style dimensions/path mismatch')
      const source = await fetch(`/crypt-maps/${mapId}.tmx`, { cache: 'no-store' })
      if (!source.ok) throw new Error('Cannot verify source map')
      const digest = await crypto.subtle.digest('SHA-256', await source.arrayBuffer())
      const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
      if (hash !== manifest.source_hashes[`public/crypt-maps/${mapId}.tmx`]) throw new Error('Crypt source map changed')
      const texture = await Assets.load<Texture>(manifest.overlay)
      if (disposed) return
      if (texture.width !== width || texture.height !== height) throw new Error('Crypt overlay size mismatch')
      container.removeChild(lights)
      for (const child of container.removeChildren()) child.destroy()
      const night = new Graphics().rect(0, 0, width, height).fill({ color: 0x0c173a, alpha: Math.max(0, Math.min(.7, manifest.night)) })
      container.addChild(night, new Sprite(texture), lights)
      // One batched Graphics, bounded to 512 lights rather than thousands of sprites.
      const stride = Math.max(1, Math.ceil(manifest.bulbs.length / 512))
      points = manifest.bulbs.filter(([x, y], i) => i % stride === 0 && x >= 0 && y >= 0 && x < width && y < height)
      activeId = manifest.id
      container.label = `crypt-style:${activeId}`
    } catch (error) {
      console.warn('Crypt decoration not applied:', error)
    } finally { checking = false }
  }
  await refresh()
  const interval = window.setInterval(() => { void refresh() }, 5000)
  return {
    container,
    update(now: number) {
      const tick = Math.floor(now / 100)
      if (tick === lastTick || !container.visible) return
      lastTick = tick
      lights.clear()
      for (const [i, point] of points.entries()) {
        const alpha = .12 + .25 * (1 + Math.sin(now / 650 + i * 2.4)) / 2
        lights.circle(point[0] + .5, point[1] + .5, 1.3).fill({ color: 0xffdd86, alpha })
      }
    },
    destroy() {
      disposed = true
      window.clearInterval(interval)
      window.removeEventListener('storage', visibility)
    }
  }
}
