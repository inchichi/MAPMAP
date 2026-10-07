// 무기 계열 스킬 실행: 스킬 목록, 무기 계열 확인, 스킬별 재사용 대기, 예약 타격, 효과 정리.
// 어떤 스킬이 어느 무기 계열·장인지와 위력 표는 playerWeaponSkills.ts(게임 데이터), 스킬 하나하나의 동작은 weaponSkills/*.ts.
// 새 무기 스킬 = weaponSkills/ 의 그 계열 파일에 하나 + playerWeaponSkills.ts 정의 하나.
import type { Container } from 'pixi.js'
import type { CharacterMoveDirection, CharacterState } from '../../characterState'
import { PLAYER_CHARACTER_ID } from '../../characterState'
import type { CollisionRect } from '../characterCollision'
import type { ParsedTiledMap } from '../../tiled/parseTiledMap'
import type { PlayerProfile } from '../../playerProfile'
import { getEquippedPlayerWeaponLine, type PlayerEquipment } from '../../playerEquipment'
import { PLAYER_WEAPON_LINE_LABEL, getPlayerWeaponSkillDefinition } from '../../playerWeaponSkills'
import { getPlayerSkillDamageById, getPlayerSkillLevelById } from '../../lua/luaGameLogic'
import type { MonsterCombatState } from '../../monsterCombat'
import { getFacingDirection } from './meleeMotions/meleeMotion'
import { AXE_SKILLS } from './weaponSkills/axeSkills'
import { BOW_SKILLS } from './weaponSkills/bowSkills'
import { STAFF_SKILLS } from './weaponSkills/staffSkills'
import { SWORD_SKILLS } from './weaponSkills/swordSkills'
import { getDistance, getDistanceToSegment, type Point, type WeaponSkill, type WeaponSkillWorld } from './weaponSkills/weaponSkill'
import { createWeaponSkillEffects } from './weaponSkills/weaponSkillEffects'
import type { LpcMagicEffects } from './lpcMagicEffects'

const WEAPON_SKILLS_BY_ID: ReadonlyMap<string, WeaponSkill> = new Map(
  [...SWORD_SKILLS, ...AXE_SKILLS, ...BOW_SKILLS, ...STAFF_SKILLS].map(
    (skill) => [skill.id, skill]
  )
)

// cast: 썼다, not-ready: 재사용 대기 중, blocked: 쓸 수 없어 이유를 이미 띄웠다, not-weapon-skill: 무기 계열 스킬이 아니다
export type PlayerWeaponSkillTriggerResult = 'cast' | 'not-ready' | 'blocked' | 'not-weapon-skill'

export type PlayerWeaponSkillsContext = {
  map: ParsedTiledMap
  lpcMagic: LpcMagicEffects
  playerProfile: PlayerProfile
  monsterCombatStates: Map<string, MonsterCombatState>
  getCurrentPlayerEquipment: () => PlayerEquipment
  getCharacterStateById: (characterId: string) => CharacterState
  getCharacterStates: () => CharacterState[]
  setCharacterStates: (value: CharacterState[]) => void
  getDepthSortedLayer: () => Container | undefined
  isMonsterCharacter: (character: CharacterState) => boolean
  isMonsterCombatStateDefeated: (characterId: string) => boolean
  getCharacterPixelCenter: (character: CharacterState) => Point
  resolveMonstersInCollisionRect: (hitRect: CollisionRect) => CharacterState[]
  applyDamageToMonster: (characterId: string, damage: number, now: number) => void
  knockbackMonsterAwayFromCharacter: (characterId: string, sourceCharacter: CharacterState, distanceInTiles: number) => void
  freezeMonster: (monsterId: string, durationMilliseconds: number, now: number) => void
  applyMonsterDamageOverTime: (
    monsterId: string,
    kind: 'burn' | 'poison',
    dot: { damagePerTick: number; ticks: number; intervalMilliseconds: number },
    now: number
  ) => void
  spawnMagicImpact: (x: number, y: number, now: number, color: number, radius?: number) => void
  getPlayerBasicAttackDamage: (isMagic: boolean) => number
  tryMoveCharacter: (
    characterId: string,
    deltaX: number,
    deltaY: number,
    options?: { preserveFacing?: boolean; ignoreMonsterBlocking?: boolean }
  ) => boolean
  setPlayerProtectSkillActiveUntilMilliseconds: (value: number) => void
  startPlayerWeaponAttackMotion: (character: CharacterState, now: number, options?: { suppressDamage?: boolean }) => void
  showPlayerMagicMessage: (message: string) => void
}

export const createPlayerWeaponSkills = (ctx: PlayerWeaponSkillsContext) => {
  const { map } = ctx
  const effects = createWeaponSkillEffects({ getDepthSortedLayer: ctx.getDepthSortedLayer, tileHeight: map.tileHeight })
  const readyAtBySkillId = new Map<string, number>()
  let scheduledActions: { at: number; action: (now: number) => void }[] = []

  const getLiveMonsters = () =>
    ctx.getCharacterStates().filter(
      (character) => ctx.isMonsterCharacter(character) && !ctx.isMonsterCombatStateDefeated(character.id)
    )
  const getPlayer = () => ctx.getCharacterStateById(PLAYER_CHARACTER_ID)

  const world: WeaponSkillWorld = {
    getLiveMonsters,
    getMonsterCenter: ctx.getCharacterPixelCenter,
    getMonstersInRect: ctx.resolveMonstersInCollisionRect,
    getMonstersInRadius: (center, radiusPixels) =>
      getLiveMonsters().filter((monster) => getDistance(center, ctx.getCharacterPixelCenter(monster)) <= radiusPixels),
    getMonstersNearSegment: (from, to, halfWidthPixels) =>
      getLiveMonsters().filter(
        (monster) => getDistanceToSegment(ctx.getCharacterPixelCenter(monster), from, to) <= halfWidthPixels
      ),
    getMonsterHpRatio: (monsterId) => {
      const combatState = ctx.monsterCombatStates.get(monsterId)
      return combatState ? combatState.currentHp / combatState.maxHp : 1
    },
    hitMonster: ctx.applyDamageToMonster,
    knockbackMonster: (monsterId, distanceInTiles) =>
      ctx.knockbackMonsterAwayFromCharacter(monsterId, getPlayer(), distanceInTiles),
    freezeMonster: ctx.freezeMonster,
    applyDamageOverTime: ctx.applyMonsterDamageOverTime,
    // 0.25칸씩 나눠 움직여 벽에서 멈춘다(몬스터는 지나간다).
    movePlayer: (direction, distanceInTiles) => {
      const step = 0.25
      let movedTiles = 0
      while (movedTiles < distanceInTiles) {
        const stepTiles = Math.min(step, distanceInTiles - movedTiles)
        const didMove = ctx.tryMoveCharacter(PLAYER_CHARACTER_ID, direction.x * stepTiles, direction.y * stepTiles, {
          ignoreMonsterBlocking: true,
          preserveFacing: true
        })
        if (!didMove) {
          break
        }
        movedTiles += stepTiles
      }
      return movedTiles
    },
    setPlayerFacing: (facing: CharacterMoveDirection) =>
      ctx.setCharacterStates(
        ctx.getCharacterStates().map((character) =>
          character.id === PLAYER_CHARACTER_ID ? { ...character, facing } : character
        )
      ),
    protectPlayer: (durationMilliseconds, now) =>
      ctx.setPlayerProtectSkillActiveUntilMilliseconds(now + durationMilliseconds),
    playPlayerAttackMotion: (now) =>
      ctx.startPlayerWeaponAttackMotion(getPlayer(), now, { suppressDamage: true }),
    getPlayerCenter: () => ctx.getCharacterPixelCenter(getPlayer()),
    impact: (point, color, radiusPixels, now) => ctx.spawnMagicImpact(point.x, point.y, now, color, radiusPixels)
  }

  const triggerPlayerWeaponSkill = (skillId: string, now: number): PlayerWeaponSkillTriggerResult => {
    const definition = getPlayerWeaponSkillDefinition(skillId)
    const skill = WEAPON_SKILLS_BY_ID.get(skillId)
    if (!definition || !skill) {
      return 'not-weapon-skill'
    }

    if (getEquippedPlayerWeaponLine(ctx.getCurrentPlayerEquipment()) !== definition.weaponLine) {
      ctx.showPlayerMagicMessage(`${PLAYER_WEAPON_LINE_LABEL[definition.weaponLine]} 계열 무기를 들어야 한다`)
      return 'blocked'
    }

    if (now < (readyAtBySkillId.get(skillId) ?? 0)) {
      return 'not-ready'
    }

    const player = getPlayer()
    const direction = getFacingDirection(player.facing)
    const didCast = skill.cast({
      now,
      skillLevel: getPlayerSkillLevelById(ctx.playerProfile, skillId) ?? 1,
      baseDamage:
        ctx.getPlayerBasicAttackDamage(definition.weaponLine === 'staff') +
        getPlayerSkillDamageById(ctx.playerProfile, skillId),
      player,
      origin: ctx.getCharacterPixelCenter(player),
      direction,
      tileWidth: map.tileWidth,
      tileHeight: map.tileHeight,
      world,
      effects,
      magic: ctx.lpcMagic,
      schedule: (delayMilliseconds, action) => {
        scheduledActions.push({ at: now + delayMilliseconds, action })
      }
    })

    if (!didCast) {
      ctx.showPlayerMagicMessage('주변에 대상이 없다')
      return 'blocked'
    }

    readyAtBySkillId.set(skillId, now + definition.cooldownMilliseconds)
    return 'cast'
  }

  const updatePlayerWeaponSkills = (now: number) => {
    const dueActions = scheduledActions.filter((scheduled) => scheduled.at <= now)
    if (dueActions.length > 0) {
      scheduledActions = scheduledActions.filter((scheduled) => scheduled.at > now)
      for (const scheduled of dueActions) {
        scheduled.action(now)
      }
    }
    effects.update(now)
  }

  // 사망·부활·씬 정리 때: 예약 타격과 효과를 지운다(재사용 대기는 그대로).
  const clearPlayerWeaponSkills = () => {
    scheduledActions = []
    effects.clear()
  }

  return {
    clearPlayerWeaponSkills,
    triggerPlayerWeaponSkill,
    updatePlayerWeaponSkills
  }
}
