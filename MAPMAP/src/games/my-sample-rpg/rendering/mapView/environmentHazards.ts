// 환경 피해: 독안개·눈보라 칸에 서 있을 때의 피해·둔화, 상태 효과 알약(HUD 표시) 목록.
// 맵 화면의 상태는 ctx 로 받는다.
import type { TextStyle } from 'pixi.js'
import type { PlayerProfile } from '../../playerProfile'
import type { ParsedTiledMap } from '../../tiled/parseTiledMap'
import { PLAYER_CHARACTER_ID } from '../../characterState'
import type { CharacterState } from '../../characterState'
import { type StatusEffectPill } from '../createStatusEffectsOverlay'
import {
  POISON_FOG_TICK_MILLISECONDS,
  getPoisonFogDamage,
  getRemainingImmunitySeconds,
  isPoisonFogImmune,
  isPoisonFogTileType,
  isBlizzardTileType
} from '../../poisonFog'
import { DAMAGE_TEXT_STYLE, EVADE_TEXT_DURATION_MILLISECONDS, EVADE_TEXT_STYLE } from './constants'
import { createRoofTileLookup, isCharacterOnGrass } from './tiles'

export type EnvironmentHazardsContext = {
  getCharacterStateById: (characterId: string) => CharacterState
  getColdImmuneUntil: () => number
  getPoisonFogImmuneUntil: () => number
  map: ParsedTiledMap
  playerProfile: PlayerProfile
  syncPlayerDerivedCharacterStats: () => void
  applyDamageToPlayer: (damage: number, now: number, sourceCharacter?: CharacterState) => boolean
  showCharacterDamageText: (characterId: string, message: string, durationMilliseconds: number, style?: TextStyle) => void
  getIsSlowedByBlizzard: () => boolean
  setIsSlowedByBlizzard: (value: boolean) => void
}

export const createEnvironmentHazards = (ctx: EnvironmentHazardsContext) => {
  const {
    getCharacterStateById,
    getColdImmuneUntil,
    getPoisonFogImmuneUntil,
    map,
    playerProfile,
    syncPlayerDerivedCharacterStats,
    applyDamageToPlayer,
    showCharacterDamageText,
    getIsSlowedByBlizzard,
    setIsSlowedByBlizzard
  } = ctx

  const poisonFogTiles = createRoofTileLookup(map, isPoisonFogTileType)
  let poisonFogNextTickAt = 0
  let wasInPoisonFog = false
  const blizzardTiles = createRoofTileLookup(map, isBlizzardTileType)
  let blizzardNextTickAt = 0
  let wasInBlizzard = false

  // 독안개: 안개 칸에 서 있고 해독 향이 꺼져 있으면 1초마다 최대 체력의 5%. 갑옷·보호 스킬로는 못 막는다
  // (숨이 막히는 것이라 — applyDamageToPlayer 에 공격자를 넘기지 않는다).
  const isPlayerInPoisonFog = (): boolean =>
    poisonFogTiles.size > 0 &&
    isCharacterOnGrass(getCharacterStateById(PLAYER_CHARACTER_ID), poisonFogTiles)
  const resolvePoisonFogDamage = (now: number) => {
    const inFog = isPlayerInPoisonFog() && playerProfile.hp.current > 0
    const immune = isPoisonFogImmune(getPoisonFogImmuneUntil(), Date.now())
    if (inFog && !wasInPoisonFog) {
      poisonFogNextTickAt = now + POISON_FOG_TICK_MILLISECONDS
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        immune ? '해독 향이 독안개를 막는다' : '독안개! 숨이 막힌다',
        EVADE_TEXT_DURATION_MILLISECONDS * 2,
        immune ? EVADE_TEXT_STYLE : DAMAGE_TEXT_STYLE
      )
    }
    wasInPoisonFog = inFog
    if (!inFog || immune || now < poisonFogNextTickAt) {
      return
    }
    poisonFogNextTickAt = now + POISON_FOG_TICK_MILLISECONDS
    applyDamageToPlayer(getPoisonFogDamage(playerProfile.hp.max), now)
  }
  // 눈보라: 독안개와 같은 피해에 걸음이 느려진다. 생강차를 마시면 둘 다 막는다.
  const resolveBlizzardDamage = (now: number) => {
    const inBlizzard =
      blizzardTiles.size > 0 &&
      playerProfile.hp.current > 0 &&
      isCharacterOnGrass(getCharacterStateById(PLAYER_CHARACTER_ID), blizzardTiles)
    const immune = isPoisonFogImmune(getColdImmuneUntil(), Date.now())
    if (inBlizzard && !wasInBlizzard) {
      blizzardNextTickAt = now + POISON_FOG_TICK_MILLISECONDS
      showCharacterDamageText(
        PLAYER_CHARACTER_ID,
        immune ? '생강차 덕에 몸이 따뜻하다' : '눈보라! 몸이 얼어붙는다',
        EVADE_TEXT_DURATION_MILLISECONDS * 2,
        immune ? EVADE_TEXT_STYLE : DAMAGE_TEXT_STYLE
      )
    }
    wasInBlizzard = inBlizzard
    const slowed = inBlizzard && !immune
    if (slowed !== getIsSlowedByBlizzard()) {
      setIsSlowedByBlizzard(slowed)
      syncPlayerDerivedCharacterStats()
    }
    if (!inBlizzard || immune || now < blizzardNextTickAt) {
      return
    }
    blizzardNextTickAt = now + POISON_FOG_TICK_MILLISECONDS
    applyDamageToPlayer(getPoisonFogDamage(playerProfile.hp.max), now)
  }
  const getStatusEffectPills = (): StatusEffectPill[] => {
    const pills: StatusEffectPill[] = []
    const remaining = getRemainingImmunitySeconds(getPoisonFogImmuneUntil(), Date.now())
    if (remaining > 0) {
      pills.push({ kind: 'buff', text: `해독 향 ${remaining}초` })
    } else if (wasInPoisonFog) {
      pills.push({ kind: 'danger', text: '독안개 — 해독 향이 필요하다' })
    }
    const warm = getRemainingImmunitySeconds(getColdImmuneUntil(), Date.now())
    if (warm > 0) {
      pills.push({ kind: 'buff', text: `생강차 ${warm}초` })
    } else if (wasInBlizzard) {
      pills.push({ kind: 'danger', text: '눈보라 — 생강차가 필요하다' })
    }
    return pills
  }

  return {
    getStatusEffectPills,
    resolveBlizzardDamage,
    resolvePoisonFogDamage
  }
}
