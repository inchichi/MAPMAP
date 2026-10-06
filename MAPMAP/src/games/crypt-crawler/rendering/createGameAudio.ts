import bossMusicUrl from '../assets/audio/music/boss.ogg'
import deepMusicUrl from '../assets/audio/music/deep.ogg'
import lavaMusicUrl from '../assets/audio/music/lava.ogg'
import mushroomMusicUrl from '../assets/audio/music/mushroom.ogg'
import ruinsMusicUrl from '../assets/audio/music/ruins.ogg'
import waterMusicUrl from '../assets/audio/music/water.ogg'

import bossAlertUrl from '../assets/audio/sfx/boss_alert.wav'
import bossSlamUrl from '../assets/audio/sfx/boss_slam.wav'
import chestUrl from '../assets/audio/sfx/chest.wav'
import coinUrl from '../assets/audio/sfx/coin.wav'
import deathUrl from '../assets/audio/sfx/death.wav'
import hitUrl from '../assets/audio/sfx/hit.wav'
import hitHeavyUrl from '../assets/audio/sfx/hit_heavy.wav'
import killUrl from '../assets/audio/sfx/kill.wav'
import levelUpUrl from '../assets/audio/sfx/levelup.wav'
import playerHurtUrl from '../assets/audio/sfx/player_hurt.wav'
import potionUrl from '../assets/audio/sfx/potion.wav'
import swingUrl from '../assets/audio/sfx/swing.wav'

import {
  CROSSFADE_MS,
  DEFAULT_AUDIO_SETTINGS,
  SFX_COOLDOWN_MS,
  applyAudioCommand,
  audioCommandForKey,
  crossfadeGains,
  crossfadeProgress,
  describeAudioSettings,
  nextMusicTrack,
  parseAudioSettings,
  shouldPlaySfx,
  type AudioSettings,
  type MusicTrack,
  type SfxKey
} from '../audio'

// 실제로 소리를 내는 층. 판정은 전부 ../audio 의 순수 함수가 하고, 여기서는 그 결과를
// HTMLAudioElement 에 옮긴다. Web Audio API 는 이 정도 요구에는 과하다 — 크로스페이드는
// element 두 장을 번갈아 쓰면 된다.

const STORAGE_KEY = 'crypt-crawler:audio'

// 같은 효과음이 연달아 나도 앞 소리를 끊지 않게 몇 장을 돌려 쓴다. 쿨다운이 60ms 라
// 3장이면 180ms 뒤에나 첫 장을 다시 쓰는데, 효과음 대부분이 그보다 짧다(가장 긴 death 만 2.4초).
const SFX_POOL_SIZE = 3

const MUSIC_URLS: Record<MusicTrack, string> = {
  ruins: ruinsMusicUrl,
  mushroom: mushroomMusicUrl,
  water: waterMusicUrl,
  lava: lavaMusicUrl,
  deep: deepMusicUrl,
  boss: bossMusicUrl
}

type SfxPool = {
  audios: HTMLAudioElement[]
  nextIndex: number
}

type MusicDeck = {
  audio: HTMLAudioElement
  // 이 덱에 지금 실려 있는 곡. 같은 곡으로 돌아올 때 src 를 다시 물려 받지 않기 위해서다.
  track: MusicTrack | undefined
}

export type GameAudio = {
  /**
   * 첫 사용자 입력에서 부른다. 그 전에는 재생을 아예 시도하지 않는다 — 브라우저 자동재생
   * 정책에 걸려 콘솔이 거부 로그로 더러워진다.
   */
  unlock: () => void
  /** 매 프레임. 층과 보스 상태를 보고 곡을 고르고 크로스페이드를 진행시킨다. */
  update: (input: { nowMs: number, zoneId: number | undefined, bossActive: boolean }) => void
  playSfx: (key: SfxKey) => void
  /** 볼륨/음소거 키를 처리했으면 화면에 띄울 문구를, 아니면 undefined 를 돌려준다. */
  handleKey: (key: string) => string | undefined
  destroy: () => void
}

export const createGameAudio = (): GameAudio => {
  const decks: MusicDeck[] = [createMusicDeck(), createMusicDeck()]
  const sfxPools: Record<SfxKey, SfxPool> = {
    swing: createSfxPool(swingUrl),
    hit: createSfxPool(hitUrl),
    hit_heavy: createSfxPool(hitHeavyUrl),
    kill: createSfxPool(killUrl),
    coin: createSfxPool(coinUrl),
    chest: createSfxPool(chestUrl),
    potion: createSfxPool(potionUrl),
    levelup: createSfxPool(levelUpUrl),
    player_hurt: createSfxPool(playerHurtUrl),
    death: createSfxPool(deathUrl),
    boss_slam: createSfxPool(bossSlamUrl),
    boss_alert: createSfxPool(bossAlertUrl)
  }
  const lastPlayedAtMs = new Map<SfxKey, number>()

  let settings = loadSettings()
  // Start editor previews silently; the existing mute key can enable audio again.
  if (window.parent && window.parent !== window) {
    settings = { ...settings, muted: true }
    saveSettings(settings)
  }
  let unlocked = false
  // 울려야 할 곡. 잠금이 풀리기 전에도 층을 따라 갱신된다.
  let wantedTrack: MusicTrack = 'ruins'
  // 실제로 재생 중인 곡. 아직 아무것도 울리지 않았으면 없다.
  let soundingTrack: MusicTrack | undefined
  let playingIndex = 0
  let fadeStartedAtMs = -Infinity

  const crossfadeTo = (track: MusicTrack, nowMs: number) => {
    playingIndex = 1 - playingIndex
    const deck = decks[playingIndex]
    if (deck.track !== track) {
      deck.track = track
      deck.audio.src = MUSIC_URLS[track]
    }
    deck.audio.currentTime = 0
    deck.audio.volume = 0
    void deck.audio.play().catch(() => undefined)
    soundingTrack = track
    fadeStartedAtMs = nowMs
  }

  const applyMusicGains = (progress: number) => {
    const volume = settings.muted ? 0 : settings.bgmVolume
    const gains = crossfadeGains(progress)
    decks[playingIndex].audio.volume = volume * gains.incoming

    const fadingOut = decks[1 - playingIndex].audio
    if (progress < 1) {
      fadingOut.volume = volume * gains.outgoing
      return
    }
    // 다 넘어간 뒤에도 지난 곡을 계속 흘리면 소리 없이 대역폭만 먹는다.
    if (!fadingOut.paused) {
      fadingOut.pause()
    }
  }

  const update = ({
    nowMs,
    zoneId,
    bossActive
  }: { nowMs: number, zoneId: number | undefined, bossActive: boolean }) => {
    // 페이드 도중에는 곡을 다시 바꾸지 않는다. 존 경계나 보스 반경 가장자리를 서성이면
    // 매 프레임 새 페이드가 시작돼 어느 곡도 제대로 들리지 않는다.
    if (crossfadeProgress(fadeStartedAtMs, nowMs, CROSSFADE_MS) >= 1) {
      wantedTrack = nextMusicTrack(wantedTrack, zoneId, bossActive)
      if (unlocked && soundingTrack !== wantedTrack) {
        crossfadeTo(wantedTrack, nowMs)
      }
    }

    applyMusicGains(crossfadeProgress(fadeStartedAtMs, nowMs, CROSSFADE_MS))
  }

  const playSfx = (key: SfxKey) => {
    if (!unlocked || settings.muted || settings.sfxVolume === 0) {
      return
    }
    // 효과음 쿨다운은 자기들끼리만 비교하므로 게임 티커와 다른 시계를 써도 된다.
    // performance.now() 는 티커가 멈춘 헤드리스에서도 흐른다.
    const nowMs = performance.now()
    if (!shouldPlaySfx(lastPlayedAtMs.get(key), nowMs, SFX_COOLDOWN_MS)) {
      return
    }
    lastPlayedAtMs.set(key, nowMs)

    const pool = sfxPools[key]
    const audio = pool.audios[pool.nextIndex]
    pool.nextIndex = (pool.nextIndex + 1) % pool.audios.length
    audio.volume = settings.sfxVolume
    audio.currentTime = 0
    void audio.play().catch(() => undefined)
  }

  const handleKey = (key: string) => {
    const command = audioCommandForKey(key)
    if (!command) {
      return undefined
    }
    settings = applyAudioCommand(settings, command)
    saveSettings(settings)

    return describeAudioSettings(settings)
  }

  return {
    unlock: () => {
      unlocked = true
    },
    update,
    playSfx,
    handleKey,
    destroy: () => {
      for (const deck of decks) {
        deck.audio.pause()
      }
      for (const pool of Object.values(sfxPools)) {
        for (const audio of pool.audios) {
          audio.pause()
        }
      }
    }
  }
}

const createMusicDeck = (): MusicDeck => {
  const audio = new Audio()
  audio.loop = true
  audio.volume = 0
  // src 는 첫 크로스페이드에서 물린다. 곡 여섯 개를 미리 받아두면 부팅이 느려진다.
  return { audio, track: undefined }
}

const createSfxPool = (url: string): SfxPool => ({
  audios: Array.from({ length: SFX_POOL_SIZE }, () => {
    const audio = new Audio(url)
    audio.preload = 'auto'
    return audio
  }),
  nextIndex: 0
})

const loadSettings = (): AudioSettings => {
  try {
    return parseAudioSettings(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    // 샌드박스 iframe 등에서는 localStorage 접근 자체가 예외를 던진다.
    return DEFAULT_AUDIO_SETTINGS
  }
}

const saveSettings = (settings: AudioSettings) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // 저장에 실패해도 이번 판의 소리는 그대로 들려야 한다.
  }
}
