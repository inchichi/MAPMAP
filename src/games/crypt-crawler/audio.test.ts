import { describe, expect, it } from 'vitest'

import {
  CROSSFADE_MS,
  DEFAULT_AUDIO_SETTINGS,
  SFX_COOLDOWN_MS,
  applyAudioCommand,
  audioCommandForKey,
  clampVolume,
  crossfadeGains,
  crossfadeProgress,
  describeAudioSettings,
  nextMusicTrack,
  parseAudioSettings,
  shouldPlaySfx
} from './audio'

describe('nextMusicTrack', () => {
  it('maps each floor to its own track', () => {
    expect(nextMusicTrack('ruins', 0, false)).toBe('ruins')
    expect(nextMusicTrack('ruins', 1, false)).toBe('mushroom')
    expect(nextMusicTrack('ruins', 2, false)).toBe('water')
    expect(nextMusicTrack('ruins', 3, false)).toBe('lava')
    expect(nextMusicTrack('ruins', 4, false)).toBe('deep')
  })

  it('lets the boss track win, and gives the floor back when the fight ends', () => {
    expect(nextMusicTrack('lava', 3, true)).toBe('boss')
    expect(nextMusicTrack('boss', 3, true)).toBe('boss')
    expect(nextMusicTrack('boss', 3, false)).toBe('lava')
  })

  it('keeps the current track outside every zone', () => {
    expect(nextMusicTrack('water', undefined, false)).toBe('water')
    expect(nextMusicTrack('water', 9, false)).toBe('water')
    expect(nextMusicTrack('water', -1, false)).toBe('water')
  })
})

describe('crossfadeProgress', () => {
  it('runs from 0 to 1 over the duration and clamps outside it', () => {
    expect(crossfadeProgress(1000, 1000, CROSSFADE_MS)).toBe(0)
    expect(crossfadeProgress(1000, 1000 + CROSSFADE_MS / 2, CROSSFADE_MS)).toBe(0.5)
    expect(crossfadeProgress(1000, 1000 + CROSSFADE_MS, CROSSFADE_MS)).toBe(1)
    expect(crossfadeProgress(1000, 9999, CROSSFADE_MS)).toBe(1)
    expect(crossfadeProgress(1000, 500, CROSSFADE_MS)).toBe(0)
  })

  it('reads "never faded" as finished', () => {
    expect(crossfadeProgress(-Infinity, 0, CROSSFADE_MS)).toBe(1)
  })
})

describe('crossfadeGains', () => {
  it('hands the sound over from one track to the other', () => {
    expect(crossfadeGains(0)).toEqual({ outgoing: 1, incoming: 0 })

    const ended = crossfadeGains(1)
    expect(ended.outgoing).toBeCloseTo(0, 10)
    expect(ended.incoming).toBeCloseTo(1, 10)
  })

  it('keeps constant power through the middle instead of dipping', () => {
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const gains = crossfadeGains(progress)
      expect(gains.outgoing ** 2 + gains.incoming ** 2).toBeCloseTo(1, 10)
    }
    // 선형이었다면 가운데 합이 0.5+0.5=1 이 아니라 각각 0.5 라 소리가 주저앉는다.
    expect(crossfadeGains(0.5).incoming).toBeCloseTo(Math.SQRT1_2, 10)
  })
})

describe('shouldPlaySfx', () => {
  it('plays a sound that has never played', () => {
    expect(shouldPlaySfx(undefined, 0, SFX_COOLDOWN_MS)).toBe(true)
  })

  it('drops repeats inside the cooldown', () => {
    // 공격 한 번에 다섯 마리가 같은 프레임에 맞아도 hit 은 한 번만 울린다.
    expect(shouldPlaySfx(1000, 1000, SFX_COOLDOWN_MS)).toBe(false)
    expect(shouldPlaySfx(1000, 1000 + SFX_COOLDOWN_MS - 1, SFX_COOLDOWN_MS)).toBe(false)
    expect(shouldPlaySfx(1000, 1000 + SFX_COOLDOWN_MS, SFX_COOLDOWN_MS)).toBe(true)
  })
})

describe('clampVolume', () => {
  it('keeps the volume inside 0..1', () => {
    expect(clampVolume(-0.5)).toBe(0)
    expect(clampVolume(0)).toBe(0)
    expect(clampVolume(0.42)).toBe(0.42)
    expect(clampVolume(1)).toBe(1)
    expect(clampVolume(3)).toBe(1)
  })
})

describe('audioCommandForKey', () => {
  it('reads the volume and mute keys, and leaves gameplay keys alone', () => {
    expect(audioCommandForKey(',')).toBe('bgmDown')
    expect(audioCommandForKey('.')).toBe('bgmUp')
    expect(audioCommandForKey('<')).toBe('sfxDown')
    expect(audioCommandForKey('>')).toBe('sfxUp')
    expect(audioCommandForKey('0')).toBe('toggleMute')
    // 지도(m), 상호작용(f), 물약(q), 이동, 공격은 오디오가 가로채면 안 된다.
    for (const key of ['m', 'f', 'q', 'w', 'a', 's', 'd', ' ']) {
      expect(audioCommandForKey(key)).toBeUndefined()
    }
  })
})

describe('applyAudioCommand', () => {
  it('steps each channel on its own without float drift', () => {
    const quieter = applyAudioCommand(DEFAULT_AUDIO_SETTINGS, 'bgmDown')
    expect(quieter.bgmVolume).toBe(0.4)
    expect(quieter.sfxVolume).toBe(DEFAULT_AUDIO_SETTINGS.sfxVolume)

    const thrice = ['bgmDown', 'bgmDown', 'bgmDown'] as const
    expect(thrice.reduce(applyAudioCommand, DEFAULT_AUDIO_SETTINGS).bgmVolume).toBe(0.2)
  })

  it('stops at the ends of the range', () => {
    const silent = { ...DEFAULT_AUDIO_SETTINGS, bgmVolume: 0, sfxVolume: 1 }
    expect(applyAudioCommand(silent, 'bgmDown').bgmVolume).toBe(0)
    expect(applyAudioCommand(silent, 'sfxUp').sfxVolume).toBe(1)
  })

  it('toggles mute both ways and keeps the volumes for when it comes back', () => {
    const muted = applyAudioCommand(DEFAULT_AUDIO_SETTINGS, 'toggleMute')
    expect(muted.muted).toBe(true)
    expect(muted.bgmVolume).toBe(DEFAULT_AUDIO_SETTINGS.bgmVolume)
    expect(applyAudioCommand(muted, 'toggleMute').muted).toBe(false)
  })

  it('does not touch the settings it was given', () => {
    const before = { ...DEFAULT_AUDIO_SETTINGS }
    applyAudioCommand(DEFAULT_AUDIO_SETTINGS, 'bgmUp')
    expect(DEFAULT_AUDIO_SETTINGS).toEqual(before)
  })
})

describe('describeAudioSettings', () => {
  it('shows both channels, or just says it is muted', () => {
    expect(describeAudioSettings({ bgmVolume: 0.5, sfxVolume: 0.8, muted: false }))
      .toBe('음악 50% · 효과음 80%')
    expect(describeAudioSettings({ bgmVolume: 0.5, sfxVolume: 0.8, muted: true }))
      .toBe('음소거 (0)')
  })
})

describe('parseAudioSettings', () => {
  it('reads back what was stored', () => {
    const stored = JSON.stringify({ bgmVolume: 0.3, sfxVolume: 0.9, muted: true })
    expect(parseAudioSettings(stored)).toEqual({
      bgmVolume: 0.3,
      sfxVolume: 0.9,
      muted: true
    })
  })

  it('falls back to defaults for nothing, garbage, and broken fields', () => {
    expect(parseAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS)
    expect(parseAudioSettings('not json')).toEqual(DEFAULT_AUDIO_SETTINGS)
    expect(parseAudioSettings('{}')).toEqual(DEFAULT_AUDIO_SETTINGS)
    expect(parseAudioSettings(JSON.stringify({ bgmVolume: 'loud' })).bgmVolume)
      .toBe(DEFAULT_AUDIO_SETTINGS.bgmVolume)
    expect(parseAudioSettings(JSON.stringify({ sfxVolume: null })).sfxVolume)
      .toBe(DEFAULT_AUDIO_SETTINGS.sfxVolume)
  })

  it('clamps volumes that are out of range', () => {
    const stored = JSON.stringify({ bgmVolume: 12, sfxVolume: -4 })
    expect(parseAudioSettings(stored)).toEqual({
      bgmVolume: 1,
      sfxVolume: 0,
      muted: false
    })
  })
})
