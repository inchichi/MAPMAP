// 소리의 "언제·얼마나"만 여기서 정한다. HTMLAudioElement 를 실제로 만지는 부분은
// rendering/createGameAudio.ts 에 있다. 헤드리스에서는 소리가 나지 않으므로 판정을 이쪽으로
// 전부 끌어내야 테스트로 증명할 수 있다.

export type SfxKey =
  | 'swing'
  | 'hit'
  | 'hit_heavy'
  | 'kill'
  | 'coin'
  | 'chest'
  | 'potion'
  | 'levelup'
  | 'player_hurt'
  | 'death'
  | 'boss_slam'
  | 'boss_alert'

export type MusicTrack = 'ruins' | 'mushroom' | 'water' | 'lava' | 'deep' | 'boss'

// 존 id 가 곧 내려가는 순서다(0 폐허 → 4 구덩이의 눈). TMX 의 zoneId 로 그대로 색인한다.
const MUSIC_BY_ZONE_ID: readonly MusicTrack[] = [
  'ruins',
  'mushroom',
  'water',
  'lava',
  'deep'
]

// 뚝 끊기면 싸구려로 들린다. 0.6초면 발걸음 두 번 안에 넘어가면서도 갈아탄 게 느껴진다.
export const CROSSFADE_MS = 600

// 같은 효과음이 한 프레임에 여러 번 나면 진폭이 겹쳐 귀가 아프다.
export const SFX_COOLDOWN_MS = 60

const VOLUME_STEP = 0.1

/**
 * 지금 울려야 할 곡. 보스 반경 안이면 층 곡을 밀어내고 boss 가 이긴다.
 * 존 밖(zoneId 없음)에서는 곡을 바꾸지 않는다 — 존 사이 틈을 지날 때마다 크로스페이드가
 * 일어나면 어느 곡도 끝까지 들리지 않는다.
 */
export const nextMusicTrack = (
  current: MusicTrack,
  zoneId: number | undefined,
  bossActive: boolean
): MusicTrack => {
  if (bossActive) {
    return 'boss'
  }
  if (zoneId === undefined || zoneId < 0 || zoneId >= MUSIC_BY_ZONE_ID.length) {
    return current
  }

  return MUSIC_BY_ZONE_ID[zoneId]
}

/**
 * 크로스페이드 진행도 0~1. 시작 시각이 `-Infinity` 면 1이 나오므로 "진행 중 아님"과
 * "한 번도 안 바꿈"을 같은 값으로 다룰 수 있다.
 */
export const crossfadeProgress = (
  startedAtMs: number,
  nowMs: number,
  durationMs: number
): number => Math.min(1, Math.max(0, (nowMs - startedAtMs) / durationMs))

/**
 * 겹치는 구간의 두 곡 이득. 선형으로 섞으면 가운데서 합이 꺼져 소리가 잠깐 주저앉는다.
 * 사인/코사인으로 섞으면 제곱합이 1로 유지돼(등가 파워) 그 꺼짐이 없다.
 */
export const crossfadeGains = (
  progress: number
): { outgoing: number, incoming: number } => ({
  outgoing: Math.cos((progress * Math.PI) / 2),
  incoming: Math.sin((progress * Math.PI) / 2)
})

/**
 * 같은 효과음을 다시 울려도 되는지. 공격 한 번에 몬스터 다섯이 맞으면 같은 프레임에
 * hit 이 다섯 번 들어온다. `lastPlayedAtMs` 가 없으면 아직 한 번도 울리지 않았다는 뜻이다.
 */
export const shouldPlaySfx = (
  lastPlayedAtMs: number | undefined,
  nowMs: number,
  cooldownMs: number
): boolean => lastPlayedAtMs === undefined || nowMs - lastPlayedAtMs >= cooldownMs

export type AudioSettings = {
  bgmVolume: number
  sfxVolume: number
  muted: boolean
}

// 음악은 배경이라 낮게, 효과음은 타격감이라 높게 시작한다.
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  bgmVolume: 0.5,
  sfxVolume: 0.8,
  muted: false
}

export const clampVolume = (volume: number): number => Math.min(1, Math.max(0, volume))

export type AudioCommand = 'bgmDown' | 'bgmUp' | 'sfxDown' | 'sfxUp' | 'toggleMute'

/**
 * 볼륨/음소거 키. M 은 지도가 이미 쓰므로 피했다.
 * `,` `.` 로 음악, 같은 자리에 shift 를 더한 `<` `>` 로 효과음, `0` 으로 음소거.
 * (US 배열 기준이다. 다른 배열에서는 shift 조합의 key 값이 달라 효과음 쪽이 안 먹는다.)
 */
export const audioCommandForKey = (key: string): AudioCommand | undefined => {
  switch (key) {
    case ',':
      return 'bgmDown'
    case '.':
      return 'bgmUp'
    case '<':
      return 'sfxDown'
    case '>':
      return 'sfxUp'
    case '0':
      return 'toggleMute'
    default:
      return undefined
  }
}

export const applyAudioCommand = (
  settings: AudioSettings,
  command: AudioCommand
): AudioSettings => {
  switch (command) {
    case 'bgmDown':
      return { ...settings, bgmVolume: stepVolume(settings.bgmVolume, -VOLUME_STEP) }
    case 'bgmUp':
      return { ...settings, bgmVolume: stepVolume(settings.bgmVolume, VOLUME_STEP) }
    case 'sfxDown':
      return { ...settings, sfxVolume: stepVolume(settings.sfxVolume, -VOLUME_STEP) }
    case 'sfxUp':
      return { ...settings, sfxVolume: stepVolume(settings.sfxVolume, VOLUME_STEP) }
    case 'toggleMute':
      return { ...settings, muted: !settings.muted }
  }
}

/** 볼륨을 바꾼 직후 화면에 띄우는 한 줄. 키가 안 보이는 조작이라 이게 유일한 안내다. */
export const describeAudioSettings = (settings: AudioSettings): string =>
  settings.muted
    ? '음소거 (0)'
    : `음악 ${percent(settings.bgmVolume)}% · 효과음 ${percent(settings.sfxVolume)}%`

/** localStorage 에서 읽은 문자열을 설정으로 되돌린다. 깨졌거나 없으면 기본값이다. */
export const parseAudioSettings = (raw: string | null): AudioSettings => {
  if (raw === null) {
    return DEFAULT_AUDIO_SETTINGS
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AudioSettings>

    return {
      bgmVolume: volumeOr(parsed.bgmVolume, DEFAULT_AUDIO_SETTINGS.bgmVolume),
      sfxVolume: volumeOr(parsed.sfxVolume, DEFAULT_AUDIO_SETTINGS.sfxVolume),
      muted: parsed.muted === true
    }
  } catch {
    return DEFAULT_AUDIO_SETTINGS
  }
}

// 저장된 값은 손으로 고쳐졌을 수 있다. NaN 을 볼륨에 대입하면 브라우저가 예외를 던진다.
const volumeOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? clampVolume(value) : fallback

// 0.1 씩 더하면 부동소수 오차가 쌓여 0.7000000000000001 이 된다. 둘째 자리에서 끊는다.
const stepVolume = (volume: number, delta: number): number =>
  clampVolume(Math.round((volume + delta) * 100) / 100)

const percent = (volume: number): number => Math.round(volume * 100)
