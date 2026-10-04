import { beforeEach, describe, expect, it, vi } from 'vitest'

type FakeAudio = {
  src: string
  volume: number
  currentTime: number
  loop: boolean
  preload: string
  paused: boolean
  playCount: number
  play: () => Promise<void>
  pause: () => void
}

const made: FakeAudio[] = []

class AudioStub {
  src = ''
  volume = 1
  currentTime = 0
  loop = false
  preload = ''
  paused = true
  playCount = 0
  constructor (src?: string) {
    if (src !== undefined) this.src = src
    made.push(this as unknown as FakeAudio)
  }

  play (): Promise<void> {
    this.paused = false
    this.playCount += 1
    return Promise.resolve()
  }

  pause (): void {
    this.paused = true
  }
}

const store = new Map<string, string>()
vi.stubGlobal('Audio', AudioStub)
vi.stubGlobal('window', {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) }
  }
})

let nowMs = 0
vi.stubGlobal('performance', { now: () => nowMs })

const { createGameAudio } = await import('./createGameAudio')

const decks = () => made.filter((a) => a.loop)
const name = (a: FakeAudio) => a.src.split('/').pop() ?? '(none)'

describe('createGameAudio', () => {
  beforeEach(() => {
    made.length = 0
    store.clear()
    nowMs = 0
  })

  it('A: nothing plays before unlock', () => {
    const g = createGameAudio()
    for (let t = 0; t < 5000; t += 16) g.update({ nowMs: t, zoneId: 0, bossActive: false })
    expect(made.every((a) => a.playCount === 0)).toBe(true)
  })

  it('B: after unlock the floor track fades in and reaches full volume', () => {
    const g = createGameAudio()
    g.unlock()
    for (let t = 0; t <= 1200; t += 16) g.update({ nowMs: t, zoneId: 0, bossActive: false })
    const playing = decks().filter((d) => !d.paused)
    console.log('B playing:', playing.map((d) => [name(d), d.volume]))
    expect(playing).toHaveLength(1)
    expect(playing[0].volume).toBeCloseTo(0.5, 6)
  })

  it('C: muted at boot, then unmute mid-game', () => {
    store.set('crypt-crawler:audio', JSON.stringify({ bgmVolume: 0.5, sfxVolume: 0.8, muted: true }))
    const g = createGameAudio()
    g.unlock()
    for (let t = 0; t <= 1200; t += 16) g.update({ nowMs: t, zoneId: 0, bossActive: false })
    const d = decks().filter((x) => !x.paused)
    console.log('C muted volumes:', d.map((x) => [name(x), x.volume]))
    expect(d.every((x) => x.volume === 0)).toBe(true)
    console.log('C unmute msg:', g.handleKey('0'))
    g.update({ nowMs: 1216, zoneId: 0, bossActive: false })
    console.log('C after unmute:', decks().filter((x) => !x.paused).map((x) => [name(x), x.volume]))
  })

  it('D: sfx cooldown + pool rotation', () => {
    const g = createGameAudio()
    g.unlock()
    nowMs = 1000
    for (let i = 0; i < 5; i += 1) g.playSfx('hit')
    const hits = made.filter((a) => a.src.includes('hit.'))
    console.log('D hit playCounts:', hits.map((a) => a.playCount))
    expect(hits.reduce((s, a) => s + a.playCount, 0)).toBe(1)
    nowMs = 1060
    g.playSfx('hit')
    expect(hits.reduce((s, a) => s + a.playCount, 0)).toBe(2)
  })

  it('E: sfx volume follows the setting live', () => {
    const g = createGameAudio()
    g.unlock()
    nowMs = 100
    g.playSfx('coin')
    console.log('E first coin volume:', made.find((a) => a.src.includes('coin'))?.volume)
    g.handleKey('<')
    nowMs = 500
    g.playSfx('coin')
    const coins = made.filter((a) => a.src.includes('coin'))
    console.log('E coin volumes after sfxDown:', coins.map((a) => [a.volume, a.playCount]))
  })

  it('F: zone change mid-fade is ignored, then honoured', () => {
    const g = createGameAudio()
    g.unlock()
    const seq: string[] = []
    const snap = () => {
      const p = decks().filter((d) => !d.paused).map(name).join('+')
      if (seq[seq.length - 1] !== p) seq.push(p)
    }
    for (let t = 0; t <= 700; t += 16) { g.update({ nowMs: t, zoneId: 0, bossActive: false }); snap() }
    for (let t = 716; t <= 900; t += 16) { g.update({ nowMs: t, zoneId: 2, bossActive: false }); snap() }
    // 페이드 도중에 보스 진입
    for (let t = 916; t <= 1100; t += 16) { g.update({ nowMs: t, zoneId: 2, bossActive: true }); snap() }
    for (let t = 1116; t <= 2400; t += 16) { g.update({ nowMs: t, zoneId: 2, bossActive: true }); snap() }
    for (let t = 2416; t <= 4000; t += 16) { g.update({ nowMs: t, zoneId: 2, bossActive: false }); snap() }
    console.log('F sequence:', seq)
  })

  it('G: mute persists to storage', () => {
    const g = createGameAudio()
    g.handleKey('0')
    console.log('G stored:', store.get('crypt-crawler:audio'))
    g.handleKey(',')
    console.log('G stored2:', store.get('crypt-crawler:audio'))
  })

  it('H: sfx while muted, then unmuted — does the cooldown clock leak?', () => {
    const g = createGameAudio()
    g.unlock()
    g.handleKey('0')
    nowMs = 1000
    g.playSfx('swing')
    g.handleKey('0')
    nowMs = 1001
    g.playSfx('swing')
    const s = made.filter((a) => a.src.includes('swing'))
    console.log('H swing counts:', s.map((a) => a.playCount))
  })

  it('I: destroy stops everything', () => {
    const g = createGameAudio()
    g.unlock()
    for (let t = 0; t <= 1200; t += 16) g.update({ nowMs: t, zoneId: 0, bossActive: false })
    g.destroy()
    console.log('I paused after destroy:', made.every((a) => a.paused))
    // destroy 뒤에도 update 가 한 번 더 오면?
    g.update({ nowMs: 1300, zoneId: 1, bossActive: false })
    console.log('I after post-destroy update:', decks().map((d) => [name(d), d.paused, d.volume]))
  })
})
