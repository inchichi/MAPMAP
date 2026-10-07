// 플레이어 원거리·마법 전투: 화살·에너지볼·마법 발사체, 시전(지팡이 끝 빛), 마법 스킬(얼음 화살·화염구·연쇄 번개),
// 몬스터 마법 상태(빙결·화상·중독). 이동·수명 규칙은 playerProjectile.ts 등 순수 로직, 여기는 그리기·판정·배선.
// 맵 화면의 상태는 ctx 로 받는다.
import type { ParsedTiledMap } from '../../tiled/parseTiledMap'
import type { PlayerEquipment } from '../../playerEquipment'
import type { PlayerProfile } from '../../playerProfile'
import {
  AnimatedSprite,
  Container,
  Graphics,
  Sprite,
  Texture,
  type TextStyle
} from 'pixi.js'
import { type LpcAnimationName } from '../lpcCharacterSprites'
import { PLAYER_CHARACTER_ID } from '../../characterState'
import type { CharacterState } from '../../characterState'
import { getEquippedPlayerAttackBonus, getEquippedPlayerWeaponAttackKind } from '../../playerEquipment'
import {
  createPlayerProjectile,
  getPlayerProjectileDirectionFromFacing,
  getPlayerProjectileHitRect,
  getPlayerProjectileRotation,
  PLAYER_ENERGY_BOLT_BASE_POWER,
  PLAYER_MAGIC_ATTACK_COOLDOWN_MILLISECONDS,
  PLAYER_MAGIC_ATTACK_TARGET_RANGE_PIXELS,
  selectPlayerMagicTarget,
  steerPlayerProjectileToward,
  stepPlayerProjectile,
  type PlayerProjectileKind,
  type PlayerProjectileState
} from '../../playerProjectile'
import {
  PLAYER_CHAIN_LIGHTNING_SKILL_ID,
  PLAYER_FIREBALL_SKILL_ID,
  PLAYER_ICE_BOLT_SKILL_ID,
  PLAYER_MULTI_SHOT_SKILL_ID,
  PLAYER_PIERCING_ARROW_SKILL_ID,
  PLAYER_POISON_ARROW_SKILL_ID
} from '../../playerSkills'
import {
  MULTI_SHOT_DAMAGE_RATIO,
  PIERCING_ARROW_MAX_HITS,
  POISON_TICK_COUNT,
  POISON_TICK_INTERVAL_MILLISECONDS,
  getMultiShotArrowCount,
  getPoisonDamagePerTick,
  selectMultiShotTargets
} from '../../playerBowSkills'
import {
  FIREBALL_BURN_TICK_COUNT,
  FIREBALL_BURN_TICK_INTERVAL_MILLISECONDS,
  FIREBALL_SPLASH_DAMAGE_RATIO,
  PLAYER_MAGIC_CAST_RECOVERY_MILLISECONDS,
  PLAYER_MAGIC_CAST_WINDUP_MILLISECONDS,
  getChainLightningHitDamage,
  getChainLightningJumpCount,
  getFireballBurnDamagePerTick,
  getIceBoltFreezeDurationMilliseconds,
  selectChainLightningTargets,
  selectFireballSplashTargets
} from '../../playerMagicSkills'
import { createLuaPlayerStatEffects } from '../../playerStatEffectsLua'
import { getPlayerSkillDamageById, getPlayerSkillLevelById } from '../../lua/luaGameLogic'
import { createWallTileLookup, isWallTileAt } from '../../tiled/createWallTileLookup'
import { type CollisionRect } from '../characterCollision'
import { createGameSoundEffects } from '../createGameSoundEffects'
import { EVADE_TEXT_DURATION_MILLISECONDS, EVADE_TEXT_STYLE } from './constants'
import { type RenderedCharacterNode } from './types'
import { getMagicFacing, type LpcMagicEffects } from './lpcMagicEffects'

export type PlayerCombatEffectsContext = {
  map: ParsedTiledMap
  // 마법·화살이 겨눌 몬스터를 골랐다 — 머리 위 타겟 표시(combatIndicators.ts)
  onPlayerTargetSelected: (monsterId: string) => void
  // 마법 손그림(Extended LPC Magic Pack) 재생
  lpcMagic: LpcMagicEffects
  wallTiles: ReturnType<typeof createWallTileLookup>
  gameSoundEffects: ReturnType<typeof createGameSoundEffects>
  renderedCharacters: Map<string, RenderedCharacterNode>
  monsterPigAnimatedSprites: Map<string, AnimatedSprite>
  playerStatEffects: ReturnType<typeof createLuaPlayerStatEffects>
  characterPixelWidth: number
  characterPixelHeight: number
  applyDamageToMonster: (characterId: string, damage: number, now: number) => void
  getCharacterPixelCenter: (character: CharacterState) => { x: number; y: number }
  getCharacterStateById: (characterId: string) => CharacterState
  isMonsterCharacter: (character: CharacterState) => boolean
  isMonsterCombatStateDefeated: (characterId: string) => boolean
  resolveClosestMonsterInCollisionRect: (hitRect: CollisionRect) => CharacterState | undefined
  resolveMonstersInCollisionRect: (hitRect: CollisionRect) => CharacterState[]
  isPlayerRolling: (now: number) => boolean
  showCharacterDamageText: (characterId: string, message: string, durationMilliseconds: number, style?: TextStyle) => void
  getDepthSortedLayer: () => Container | undefined
  getCurrentPlayerEquipment: () => PlayerEquipment
  getIsSceneTransitionPending: () => boolean
  getLpcArrowTexture: () => Texture
  getPlayerProfile: () => PlayerProfile
  getSyncPlayerCharacterVisual: () => (nowMilliseconds?: number) => void
  getCharacterStates: () => CharacterState[]
  setCharacterStates: (value: CharacterState[]) => void
}

export const createPlayerCombatEffects = (ctx: PlayerCombatEffectsContext) => {
  const {
    onPlayerTargetSelected,
    map,
    lpcMagic,
    wallTiles,
    gameSoundEffects,
    renderedCharacters,
    monsterPigAnimatedSprites,
    playerStatEffects,
    characterPixelWidth,
    characterPixelHeight,
    applyDamageToMonster,
    getCharacterPixelCenter,
    getCharacterStateById,
    isMonsterCharacter,
    isMonsterCombatStateDefeated,
    resolveClosestMonsterInCollisionRect,
    resolveMonstersInCollisionRect,
    isPlayerRolling,
    showCharacterDamageText,
    getDepthSortedLayer,
    getCurrentPlayerEquipment,
    getIsSceneTransitionPending,
    getLpcArrowTexture,
    getPlayerProfile,
    getSyncPlayerCharacterVisual,
    getCharacterStates,
    setCharacterStates
  } = ctx

  // 무기별 기본 공격 발사체(화살·에너지볼). 이동/수명은 playerProjectile.ts 순수 로직,
  // 여기는 스프라이트·벽/몬스터 판정·데미지 배선만 담당한다.
  // 에너지볼트(마법 공격)는 targetId 몬스터를 따라간다.
  const activePlayerProjectiles = new Map<
    string,
    {
      state: PlayerProjectileState
      sprite: Container
      targetId?: string
      // 마법 발사체: 명중 시 데미지와 스킬 효과(빙결·폭발)를 이 값으로 처리한다.
      magic?: { skillId?: string; skillLevel: number; damage: number }
      physicalDamage?: number
      // 관통 화살: 이미 꿰뚫은 몬스터는 다시 맞지 않는다.
      pierceHitIds?: Set<string>
      // 독화살: 맞은 적을 중독시키는 스킬 레벨
      poisonSkillLevel?: number
    }
  >()
  let playerProjectileCounter = 0
  // 명중 순간의 짧은 빛 번짐(에너지볼트). 수명이 끝나면 지운다.
  const activeProjectileImpacts: Array<{
    sprite: Container
    startedAtMilliseconds: number
  }> = []
  let playerMagicAttackReadyAtMilliseconds = 0

  const createArrowProjectileSprite = (rotation: number): Container => {
    const container = new Container()
    // LPC 화살 그림(오른쪽 향함)을 진행 방향으로 돌린다.
    if (getLpcArrowTexture().width > 1) {
      const arrowSprite = new Sprite(getLpcArrowTexture())
      arrowSprite.anchor.set(0.75, 0.5)
      arrowSprite.roundPixels = true
      container.addChild(arrowSprite)
      container.rotation = rotation
      return container
    }
    const arrow = new Graphics()
    // 오른쪽(+x)을 향해 그린 뒤 진행 방향으로 회전: 몸통 → 촉 → 깃 순서.
    arrow.rect(-7, -1, 11, 2)
    arrow.fill({ color: 0x8b5a2b })
    arrow.poly([7, -3, 12, 0, 7, 3])
    arrow.fill({ color: 0xd8dde4 })
    arrow.poly([-7, -3, -3, 0, -7, 3])
    arrow.fill({ color: 0xf2f2e9 })
    container.addChild(arrow)
    container.rotation = rotation
    return container
  }

  const createEnergyBallProjectileSprite = (): Container => {
    const container = new Container()
    const glow = new Graphics()
    glow.circle(0, 0, 8)
    glow.fill({ color: 0x7fd4ff, alpha: 0.35 })
    const core = new Graphics()
    core.circle(0, 0, 4.5)
    core.fill({ color: 0xe8f7ff })
    core.stroke({ color: 0x9fe0ff, width: 1.5 })
    container.addChild(glow, core)
    return container
  }

  // 에너지볼트: 꼬리가 긴 보랏빛 마력 화살. 오른쪽(+x)을 향해 그린 뒤 진행 방향으로 회전한다.
  const createEnergyBoltProjectileSprite = (rotation: number): Container => {
    const container = new Container()
    const tail = new Graphics()
    tail.poly([-18, 0, -4, -3.5, 4, 0, -4, 3.5])
    tail.fill({ color: 0x9b7bff, alpha: 0.45 })
    const glow = new Graphics()
    glow.ellipse(1, 0, 9, 6)
    glow.fill({ color: 0xb79bff, alpha: 0.4 })
    const core = new Graphics()
    core.ellipse(2, 0, 5, 2.6)
    core.fill({ color: 0xf4efff })
    core.stroke({ color: 0xc9b6ff, width: 1 })
    container.addChild(tail, glow, core)
    container.rotation = rotation
    return container
  }

  const MAGIC_IMPACT_DURATION_MILLISECONDS = 260
  // 명중 순간의 빛 번짐(색·크기는 마법마다).
  const spawnMagicImpact = (x: number, y: number, now: number, color: number, radius = 10) => {
    const container = new Container()
    const burst = new Graphics()
    burst.circle(0, 0, radius)
    burst.fill({ color, alpha: 0.55 })
    burst.circle(0, 0, radius * 0.4)
    burst.fill({ color: 0xffffff })
    container.addChild(burst)
    container.position.set(x, y)
    container.zIndex = Math.round(y + map.tileHeight * 2)
    getDepthSortedLayer()?.addChild(container)
    activeProjectileImpacts.push({ sprite: container, startedAtMilliseconds: now })
  }

  const spawnPlayerProjectile = (
    character: CharacterState,
    kind: PlayerProjectileKind,
    options: {
      direction?: { x: number; y: number }
      targetId?: string
      magic?: { skillId?: string; skillLevel: number; damage: number }
      origin?: { x: number; y: number }
      // 활 스킬처럼 기본 공격력과 다른 물리 피해를 주는 화살
      physicalDamage?: number
      pierce?: boolean
      poisonSkillLevel?: number
    } = {}
  ) => {
    const direction =
      options.direction ?? getPlayerProjectileDirectionFromFacing(character.facing)
    const state = createPlayerProjectile({
      kind,
      originX:
        options.origin?.x ?? character.position.x * map.tileWidth + characterPixelWidth / 2,
      originY:
        options.origin?.y ?? character.position.y * map.tileHeight + characterPixelHeight / 2,
      direction
    })
    const rotation = getPlayerProjectileRotation(direction)
    const sprite =
      kind === 'arrow'
        ? createArrowProjectileSprite(rotation)
        : kind === 'energy-bolt'
          ? createEnergyBoltProjectileSprite(rotation)
          : kind === 'ice-bolt'
            ? // 얼음 화살은 날아가는 그림 없이 맞은 자리에서 얼음 가시가 솟는다(LPC 마법 그림)
              new Container()
            : kind === 'fireball'
              ? lpcMagic.createFireLionProjectile(direction)
              : createEnergyBallProjectileSprite()

    playerProjectileCounter += 1
    const projectileId = `player-projectile-${playerProjectileCounter}`
    sprite.label = projectileId
    sprite.position.set(state.x, state.y)
    sprite.zIndex = Math.round(state.y + map.tileHeight)
    getDepthSortedLayer()?.addChild(sprite)


    activePlayerProjectiles.set(projectileId, {
      state,
      sprite,
      targetId: options.targetId,
      magic: options.magic,
      physicalDamage: options.physicalDamage,
      pierceHitIds: options.pierce ? new Set() : undefined,
      poisonSkillLevel: options.poisonSkillLevel
    })
  }

  // ---------------------------------------------------------------- 마법(시전·마법 공격·마법 스킬)
  // 마법 공격(D)과 마법 스킬은 마법 무기를 장착해야 쓸 수 있다. 시전은 공통 흐름:
  //   대상 조준 → 지팡이를 들어 마법진을 펼치는 준비(windup) → 마법 발동 → 여운(recovery).
  // 준비 중에는 걷기·구르기·다른 공격이 막힌다.
  type PlayerMagicCast = {
    startedAtMilliseconds: number
    releaseAtMilliseconds: number
    endAtMilliseconds: number
    facing: CharacterState['facing']
    release?: (now: number) => void
    // 플레이어 LPC 동작(지팡이 시전 = spellcast, 활 = shoot)
    animation: LpcAnimationName
    windupMilliseconds: number
    recoveryMilliseconds: number
  }
  let playerMagicCast: PlayerMagicCast | undefined
  const playerMagicSkillReadyAtMilliseconds = new Map<string, number>()
  const PLAYER_MAGIC_SKILL_COOLDOWN_MILLISECONDS: Record<string, number> = {
    [PLAYER_ICE_BOLT_SKILL_ID]: 900,
    [PLAYER_FIREBALL_SKILL_ID]: 1400,
    [PLAYER_CHAIN_LIGHTNING_SKILL_ID]: 1800
  }
  const MAGIC_COLOR = {
    arcane: 0xb79bff,
    ice: 0x8fd8ff,
    fire: 0xff8a3d,
    lightning: 0xfff2a0
  } as const

  const isPlayerCasting = (now: number): boolean =>
    playerMagicCast !== undefined && now < playerMagicCast.releaseAtMilliseconds

  const hasMagicWeaponEquipped = (): boolean =>
    getEquippedPlayerWeaponAttackKind(getCurrentPlayerEquipment()) === 'magic'

  const getLivingMonsterMagicPoints = () =>
    getCharacterStates()
      .filter(
        (character) =>
          isMonsterCharacter(character) && !isMonsterCombatStateDefeated(character.id)
      )
      .map((character) => ({ id: character.id, ...getCharacterPixelCenter(character) }))

  const showPlayerMagicMessage = (message: string) => {
    showCharacterDamageText(
      PLAYER_CHARACTER_ID,
      message,
      EVADE_TEXT_DURATION_MILLISECONDS,
      EVADE_TEXT_STYLE
    )
  }

  // 시전 가능 여부 + 조준. 안 되면 이유를 띄우고 undefined.
  const preparePlayerMagic = (now: number) => {
    if (
      getPlayerProfile().hp.current === 0 ||
      getIsSceneTransitionPending() ||
      isPlayerRolling(now) ||
      playerMagicCast !== undefined
    ) {
      return undefined
    }

    if (!hasMagicWeaponEquipped()) {
      showPlayerMagicMessage('마법 무기를 장착해야 한다')
      return undefined
    }

    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
    const origin = getCharacterPixelCenter(playerCharacter)
    const target = selectPlayerMagicTarget({
      originX: origin.x,
      originY: origin.y,
      facing: playerCharacter.facing,
      candidates: getLivingMonsterMagicPoints()
    })

    if (!target) {
      showPlayerMagicMessage('주변에 대상이 없다')
      return undefined
    }

    onPlayerTargetSelected(target.id)
    return { playerCharacter, origin, target }
  }

  const beginPlayerMagicCast = (
    now: number,
    origin: { x: number; y: number },
    target: { x: number; y: number },
    release: (now: number) => void,
    options: {
      animation?: LpcAnimationName
      windupMilliseconds?: number
      recoveryMilliseconds?: number
      // 활 쏘기는 시전 소리 없이 동작만
      playCastSound?: boolean
    } = {}
  ) => {
    const windup = options.windupMilliseconds ?? PLAYER_MAGIC_CAST_WINDUP_MILLISECONDS
    const recovery = options.recoveryMilliseconds ?? PLAYER_MAGIC_CAST_RECOVERY_MILLISECONDS
    // 대상 쪽으로 돌아선다 — 상하/좌우 중 더 큰 축.
    const dx = target.x - origin.x
    const dy = target.y - origin.y
    const facing: CharacterState['facing'] =
      Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down'
    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
    setCharacterStates(getCharacterStates().map((character) =>
      character.id === PLAYER_CHARACTER_ID ? { ...playerCharacter, facing } : character
    ))
    playerMagicCast = {
      startedAtMilliseconds: now,
      releaseAtMilliseconds: now + windup,
      endAtMilliseconds: now + windup + recovery,
      facing,
      release,
      animation: options.animation ?? 'spellcast',
      windupMilliseconds: windup,
      recoveryMilliseconds: recovery
    }
    if (options.playCastSound ?? true) {
      gameSoundEffects.play('playerSkill')
    }
    getSyncPlayerCharacterVisual()(now)
    updatePlayerMagicCast(now)
  }

  // 마법이 나가는 곳 — LPC 시전(spellcast) 동작에서 두 손을 가장 높이 든 프레임의 손 사이
  // (캐릭터 중심 기준 픽셀).
  const STAFF_TIP_OFFSET_BY_FACING: Record<string, { x: number; y: number }> = {
    up: { x: 0, y: -30 },
    left: { x: -12, y: -24 },
    down: { x: 0, y: -22 },
    right: { x: 12, y: -24 }
  }
  const getPlayerStaffTipPosition = (facing: CharacterState['facing']) => {
    const center = getCharacterPixelCenter(getCharacterStateById(PLAYER_CHARACTER_ID))
    const offset = STAFF_TIP_OFFSET_BY_FACING[facing] ?? STAFF_TIP_OFFSET_BY_FACING.down
    return { x: center.x + offset.x, y: center.y + offset.y }
  }

  function updatePlayerMagicCast(now: number) {
    const cast = playerMagicCast

    if (!cast) {
      return
    }

    if (getPlayerProfile().hp.current === 0 || now >= cast.endAtMilliseconds) {
      playerMagicCast = undefined
      return
    }

    if (cast.release && now >= cast.releaseAtMilliseconds) {
      const release = cast.release
      cast.release = undefined
      release(now)
    }

  }

  const clearPlayerMagicCast = () => {
    if (!playerMagicCast) {
      return
    }
    playerMagicCast = undefined
  }

  // 발동 시점에 대상이 이미 쓰러졌으면 그 자리에서 다시 조준한다.
  const resolveMagicReleaseTarget = (targetId: string) => {
    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
    const origin = getCharacterPixelCenter(playerCharacter)
    const living = getLivingMonsterMagicPoints()
    const target =
      living.find((point) => point.id === targetId) ??
      selectPlayerMagicTarget({
        originX: origin.x,
        originY: origin.y,
        facing: playerCharacter.facing,
        candidates: living
      })
    return { playerCharacter, origin, target }
  }

  const fireHomingMagicProjectile = (
    kind: PlayerProjectileKind,
    targetId: string | undefined,
    magic: { skillId?: string; skillLevel: number; damage: number }
  ) => {
    const { playerCharacter, origin, target } = targetId
      ? resolveMagicReleaseTarget(targetId)
      : { ...findPlayerAimTarget(), target: undefined }
    const tip = getPlayerStaffTipPosition(playerCharacter.facing)
    const direction = target
      ? (() => {
          const length = Math.hypot(target.x - origin.x, target.y - origin.y) || 1
          return { x: (target.x - origin.x) / length, y: (target.y - origin.y) / length }
        })()
      : getPlayerProjectileDirectionFromFacing(playerCharacter.facing)
    spawnPlayerProjectile(playerCharacter, kind, {
      direction,
      targetId: target?.id,
      magic,
      origin: tip
    })
  }

  // 마법 공력 공통: 지력 마법 공격력 + 자체 위력 + 마법 무기 보너스(검·활 보너스는 안 더한다).
  const getPlayerMagicDamage = (power: number): number =>
    playerStatEffects.getPlayerMagicAttackPower(getPlayerProfile()) +
    power +
    (hasMagicWeaponEquipped() ? getEquippedPlayerAttackBonus(getCurrentPlayerEquipment()) : 0)

  // 조준 대상(사거리 안 가장 가까운 몬스터). 없으면 undefined — 기본 공격은 그때 정면으로 쏜다.
  const findPlayerAimTarget = () => {
    const playerCharacter = getCharacterStateById(PLAYER_CHARACTER_ID)
    const origin = getCharacterPixelCenter(playerCharacter)
    const target = selectPlayerMagicTarget({
      originX: origin.x,
      originY: origin.y,
      facing: playerCharacter.facing,
      candidates: getLivingMonsterMagicPoints()
    })
    return { playerCharacter, origin, target }
  }

  // 정면 한 칸 앞(조준 대상이 없을 때 돌아설 기준점).
  const getPlayerFacingPoint = (playerCharacter: CharacterState, origin: { x: number; y: number }) => {
    const direction = getPlayerProjectileDirectionFromFacing(playerCharacter.facing)
    return { x: origin.x + direction.x * map.tileWidth, y: origin.y + direction.y * map.tileHeight }
  }

  // 지팡이 기본 공격: 지팡이를 찌르며 에너지볼트(MP 없음). 대상을 조준해 따라간다.
  const triggerPlayerStaffAttack = (now: number) => {
    if (now < playerMagicAttackReadyAtMilliseconds || playerMagicCast) {
      return
    }
    const { origin, target, playerCharacter } = findPlayerAimTarget()
    playerMagicAttackReadyAtMilliseconds = now + PLAYER_MAGIC_ATTACK_COOLDOWN_MILLISECONDS
    beginPlayerMagicCast(
      now,
      origin,
      target ?? getPlayerFacingPoint(playerCharacter, origin),
      () =>
        fireHomingMagicProjectile('energy-bolt', target?.id, {
          skillLevel: 1,
          damage: getPlayerMagicDamage(PLAYER_ENERGY_BOLT_BASE_POWER)
        })
    )
  }

  // 활 기본 공격: 시위를 당겨(쏘기 동작) 조준 화살을 날린다. 피해는 힘 기반 물리 공격력.
  const PLAYER_BOW_DRAW_MILLISECONDS = 300
  const PLAYER_BOW_RECOVERY_MILLISECONDS = 180
  const triggerPlayerBowAttack = (now: number) => {
    if (now < playerMagicAttackReadyAtMilliseconds || playerMagicCast) {
      return
    }
    const { origin, target, playerCharacter } = findPlayerAimTarget()
    playerMagicAttackReadyAtMilliseconds = now + PLAYER_MAGIC_ATTACK_COOLDOWN_MILLISECONDS
    beginPlayerMagicCast(
      now,
      origin,
      target ?? getPlayerFacingPoint(playerCharacter, origin),
      () => {
        fireAimedArrow(target?.id)
        gameSoundEffects.play('playerRollWhoosh')
      },
      {
        animation: 'shoot',
        windupMilliseconds: PLAYER_BOW_DRAW_MILLISECONDS,
        recoveryMilliseconds: PLAYER_BOW_RECOVERY_MILLISECONDS,
        playCastSound: false
      }
    )
  }

  const fireAimedArrow = (
    targetId: string | undefined,
    damageOverride?: number,
    extra: { pierce?: boolean; poisonSkillLevel?: number } = {}
  ) => {
    const { playerCharacter, origin, target } = targetId
      ? resolveMagicReleaseTarget(targetId)
      : { ...findPlayerAimTarget(), target: undefined }
    const direction = target
      ? (() => {
          const length = Math.hypot(target.x - origin.x, target.y - origin.y) || 1
          return { x: (target.x - origin.x) / length, y: (target.y - origin.y) / length }
        })()
      : getPlayerProjectileDirectionFromFacing(playerCharacter.facing)
    spawnPlayerProjectile(playerCharacter, 'arrow', {
      direction,
      // 관통 화살은 유도하지 않고 곧게 날아간다.
      targetId: extra.pierce ? undefined : target?.id,
      physicalDamage: damageOverride,
      pierce: extra.pierce,
      poisonSkillLevel: extra.poisonSkillLevel
    })
  }

  // 마법 스킬(아이스 볼트·파이어볼·체인 라이트닝). MP 차감은 triggerPlayerSkillById 가 한다.
  const triggerPlayerMagicSkill = (skillId: string, now: number): boolean => {
    if (now < (playerMagicSkillReadyAtMilliseconds.get(skillId) ?? 0)) {
      showPlayerMagicMessage('아직 준비되지 않았다')
      return false
    }

    const prepared = preparePlayerMagic(now)

    if (!prepared) {
      return false
    }

    const skillLevel = getPlayerSkillLevelById(getPlayerProfile(), skillId) ?? 1
    const damage = getPlayerMagicDamage(getPlayerSkillDamageById(getPlayerProfile(), skillId))
    const targetId = prepared.target.id
    playerMagicSkillReadyAtMilliseconds.set(
      skillId,
      now + (PLAYER_MAGIC_SKILL_COOLDOWN_MILLISECONDS[skillId] ?? 1000)
    )

    if (skillId === PLAYER_ICE_BOLT_SKILL_ID) {
      beginPlayerMagicCast(now, prepared.origin, prepared.target, () =>
        fireHomingMagicProjectile('ice-bolt', targetId, { skillId, skillLevel, damage })
      )
    } else if (skillId === PLAYER_FIREBALL_SKILL_ID) {
      beginPlayerMagicCast(now, prepared.origin, prepared.target, () =>
        fireHomingMagicProjectile('fireball', targetId, { skillId, skillLevel, damage })
      )
    } else {
      beginPlayerMagicCast(now, prepared.origin, prepared.target, (releaseNow) =>
        releaseChainLightning(targetId, skillLevel, damage, releaseNow)
      )
    }

    return true
  }

  // 활 스킬(멀티샷·관통 화살·독화살). 활이 필요하고, 쏘기 동작 끝에 화살이 나간다.
  // MP 차감은 triggerPlayerSkillById 가 한다.
  const PLAYER_BOW_SKILL_COOLDOWN_MILLISECONDS: Record<string, number> = {
    [PLAYER_MULTI_SHOT_SKILL_ID]: 1200,
    [PLAYER_PIERCING_ARROW_SKILL_ID]: 1500,
    [PLAYER_POISON_ARROW_SKILL_ID]: 1000
  }
  const triggerPlayerBowSkill = (skillId: string, now: number): boolean => {
    if (getEquippedPlayerWeaponAttackKind(getCurrentPlayerEquipment()) !== 'bow') {
      showPlayerMagicMessage('활을 장착해야 한다')
      return false
    }
    if (
      getPlayerProfile().hp.current === 0 ||
      getIsSceneTransitionPending() ||
      isPlayerRolling(now) ||
      playerMagicCast !== undefined
    ) {
      return false
    }
    if (now < (playerMagicSkillReadyAtMilliseconds.get(skillId) ?? 0)) {
      showPlayerMagicMessage('아직 준비되지 않았다')
      return false
    }
    const { origin, target, playerCharacter } = findPlayerAimTarget()
    // 관통 화살은 대상이 없어도 정면으로 쏠 수 있다. 나머지는 조준 대상이 있어야 한다.
    if (!target && skillId !== PLAYER_PIERCING_ARROW_SKILL_ID) {
      showPlayerMagicMessage('주변에 대상이 없다')
      return false
    }
    const skillLevel = getPlayerSkillLevelById(getPlayerProfile(), skillId) ?? 1
    const damage = getPlayerBasicAttackDamage(false) + getPlayerSkillDamageById(getPlayerProfile(), skillId)
    playerMagicSkillReadyAtMilliseconds.set(
      skillId,
      now + (PLAYER_BOW_SKILL_COOLDOWN_MILLISECONDS[skillId] ?? 1000)
    )
    const aimPoint = target ?? getPlayerFacingPoint(playerCharacter, origin)
    beginPlayerMagicCast(
      now,
      origin,
      aimPoint,
      () => {
        gameSoundEffects.play('playerRollWhoosh')
        if (skillId === PLAYER_MULTI_SHOT_SKILL_ID) {
          const releaseOrigin = getCharacterPixelCenter(getCharacterStateById(PLAYER_CHARACTER_ID))
          const targets = selectMultiShotTargets(
            releaseOrigin,
            getLivingMonsterMagicPoints(),
            getMultiShotArrowCount(skillLevel),
            PLAYER_MAGIC_ATTACK_TARGET_RANGE_PIXELS
          )
          for (const multiTarget of targets) {
            fireAimedArrow(multiTarget.id, Math.max(1, Math.round(damage * MULTI_SHOT_DAMAGE_RATIO)))
          }
        } else if (skillId === PLAYER_PIERCING_ARROW_SKILL_ID) {
          fireAimedArrow(target?.id, damage, { pierce: true })
        } else {
          fireAimedArrow(target?.id, damage, { poisonSkillLevel: skillLevel })
        }
      },
      {
        animation: 'shoot',
        windupMilliseconds: PLAYER_BOW_DRAW_MILLISECONDS,
        recoveryMilliseconds: PLAYER_BOW_RECOVERY_MILLISECONDS,
        playCastSound: false
      }
    )
    return true
  }

  // ---- 체인 라이트닝: 즉발. 지팡이 끝 → 첫 대상 → 가까운 적들로 번개가 튄다 ----
  function releaseChainLightning(
    targetId: string,
    skillLevel: number,
    damage: number,
    now: number
  ) {
    const { target } = resolveMagicReleaseTarget(targetId)

    if (!target) {
      return
    }

    const chain = selectChainLightningTargets({
      first: target,
      candidates: getLivingMonsterMagicPoints(),
      jumpCount: getChainLightningJumpCount(skillLevel)
    })
    // 맞은 적마다 번개 발톱이 내리꽂힌다(LPC 마법 그림).
    chain.forEach((point, index) => {
      applyDamageToMonster(point.id, getChainLightningHitDamage(damage, index), now)
      lpcMagic.play('lightning-claw', point.x, point.y + 10, { scale: 0.6, durationMilliseconds: 520 })
    })
  }

  // ---- 몬스터 상태 이상: 빙결(이동·공격 정지) / 화상(주기 피해) ----
  type MonsterMagicStatus = {
    frozenUntilMilliseconds: number
    // 지속 피해(화상·중독). 하나만 걸린다 — 새로 걸리면 덮어쓴다.
    dotKind: 'burn' | 'poison'
    burnTicksLeft: number
    burnNextTickAtMilliseconds: number
    burnDamagePerTick: number
    burnIntervalMilliseconds: number
  }
  const monsterMagicStatuses = new Map<string, MonsterMagicStatus>()

  const getMonsterMagicStatus = (monsterId: string): MonsterMagicStatus => {
    let status = monsterMagicStatuses.get(monsterId)
    if (!status) {
      status = {
        frozenUntilMilliseconds: 0,
        dotKind: 'burn',
        burnTicksLeft: 0,
        burnNextTickAtMilliseconds: 0,
        burnDamagePerTick: 0,
        burnIntervalMilliseconds: FIREBALL_BURN_TICK_INTERVAL_MILLISECONDS
      }
      monsterMagicStatuses.set(monsterId, status)
    }
    return status
  }

  const isMonsterFrozen = (monsterId: string, now: number): boolean =>
    (monsterMagicStatuses.get(monsterId)?.frozenUntilMilliseconds ?? 0) > now

  const freezeMonster = (monsterId: string, durationMilliseconds: number, now: number) => {
    const status = getMonsterMagicStatus(monsterId)
    status.frozenUntilMilliseconds = Math.max(
      status.frozenUntilMilliseconds,
      now + durationMilliseconds
    )
    // 얼면 불은 꺼진다.
    status.burnTicksLeft = 0
    showCharacterDamageText(monsterId, '빙결!', EVADE_TEXT_DURATION_MILLISECONDS, EVADE_TEXT_STYLE)
  }

  const applyMonsterDamageOverTime = (
    monsterId: string,
    kind: MonsterMagicStatus['dotKind'],
    dot: { damagePerTick: number; ticks: number; intervalMilliseconds: number },
    now: number
  ) => {
    const status = getMonsterMagicStatus(monsterId)
    status.dotKind = kind
    status.burnTicksLeft = dot.ticks
    status.burnDamagePerTick = dot.damagePerTick
    status.burnIntervalMilliseconds = dot.intervalMilliseconds
    status.burnNextTickAtMilliseconds = now + dot.intervalMilliseconds
    if (kind === 'burn') {
      // 불이 붙으면 얼음은 녹는다.
      status.frozenUntilMilliseconds = Math.min(status.frozenUntilMilliseconds, now)
    } else {
      showCharacterDamageText(monsterId, '중독!', EVADE_TEXT_DURATION_MILLISECONDS, EVADE_TEXT_STYLE)
    }
  }

  const igniteMonster = (monsterId: string, damagePerTick: number, now: number) =>
    applyMonsterDamageOverTime(monsterId, 'burn', {
      damagePerTick,
      ticks: FIREBALL_BURN_TICK_COUNT,
      intervalMilliseconds: FIREBALL_BURN_TICK_INTERVAL_MILLISECONDS
    }, now)

  const updateMonsterMagicStatuses = (now: number) => {
    for (const [monsterId, status] of monsterMagicStatuses) {
      const node = renderedCharacters.get(monsterId)
      const defeated = isMonsterCombatStateDefeated(monsterId)
      const frozen = !defeated && status.frozenUntilMilliseconds > now

      if (!defeated && status.burnTicksLeft > 0 && now >= status.burnNextTickAtMilliseconds) {
        status.burnTicksLeft -= 1
        status.burnNextTickAtMilliseconds = now + status.burnIntervalMilliseconds
        applyDamageToMonster(monsterId, status.burnDamagePerTick, now)
        const center = getCharacterPixelCenter(getCharacterStateById(monsterId))
        spawnMagicImpact(
          center.x,
          center.y - 4,
          now,
          status.dotKind === 'poison' ? 0x8fe36a : MAGIC_COLOR.fire,
          6
        )
      }

      const burning = !isMonsterCombatStateDefeated(monsterId) && status.burnTicksLeft > 0

      if (node) {
        node.sprite.tint = frozen
          ? 0x9fdcff
          : burning
            ? status.dotKind === 'poison'
              ? 0xb8f08a
              : 0xffb488
            : 0xffffff
        const animated = monsterPigAnimatedSprites.get(monsterId)
        if (frozen) {
          animated?.stop()
        } else if (animated && !animated.playing && !defeated) {
          animated.play()
        }
      }

      if (defeated || (!frozen && !burning)) {
        if (node) {
          node.sprite.tint = 0xffffff
        }
        monsterMagicStatuses.delete(monsterId)
      }
    }

  }

  const clearMagicEffects = () => {
    clearPlayerMagicCast()
    lpcMagic.clear()
    monsterMagicStatuses.clear()
  }

  // 기본 공격 데미지 = 스탯 공격력 + 장비 보너스. 스탯 항은 공격 종류로 갈린다:
  // 마법(에너지볼)은 지력 기반 마법 공격력, 근접·활은 힘 기반 물리 공격력.
  const getPlayerBasicAttackDamage = (isMagic: boolean): number =>
    (isMagic
      ? playerStatEffects.getPlayerMagicAttackPower(getPlayerProfile())
      : playerStatEffects.getPlayerPhysicalAttackPower(getPlayerProfile())) +
    getEquippedPlayerAttackBonus(getCurrentPlayerEquipment())

  // 마법 발사체 명중: 데미지 + 종류별 효과(빙결 / 폭발·화상).
  const applyMagicProjectileHit = (
    state: PlayerProjectileState,
    magic: { skillId?: string; skillLevel: number; damage: number },
    targetId: string,
    now: number
  ) => {
    applyDamageToMonster(targetId, magic.damage, now)

    if (state.kind === 'ice-bolt') {
      lpcMagic.play('ice-spikes', state.x, state.y + 8, { durationMilliseconds: 520 })
      if (!isMonsterCombatStateDefeated(targetId)) {
        freezeMonster(targetId, getIceBoltFreezeDurationMilliseconds(magic.skillLevel), now)
      }
      return
    }

    if (state.kind === 'fireball') {
      lpcMagic.play('fire-burst', state.x, state.y + 10, {
        facing: getMagicFacing(state.direction),
        scale: 0.6,
        durationMilliseconds: 560
      })
      const burn = getFireballBurnDamagePerTick(magic.skillLevel)
      if (!isMonsterCombatStateDefeated(targetId)) {
        igniteMonster(targetId, burn, now)
      }
      for (const splash of selectFireballSplashTargets(
        { x: state.x, y: state.y },
        targetId,
        getLivingMonsterMagicPoints()
      )) {
        applyDamageToMonster(
          splash.id,
          Math.max(1, Math.round(magic.damage * FIREBALL_SPLASH_DAMAGE_RATIO)),
          now
        )
        if (!isMonsterCombatStateDefeated(splash.id)) {
          igniteMonster(splash.id, burn, now)
        }
      }
      return
    }

    spawnMagicImpact(state.x, state.y, now, MAGIC_COLOR.arcane, 10)
  }

  const removePlayerProjectile = (projectileId: string) => {
    const projectile = activePlayerProjectiles.get(projectileId)
    if (!projectile) {
      return
    }
    projectile.sprite.removeFromParent()
    projectile.sprite.destroy({ children: true })
    activePlayerProjectiles.delete(projectileId)
  }

  // 매 프레임: 발사체 이동 → 벽/사거리/몬스터 판정 → 스프라이트 동기화.
  const updatePlayerProjectiles = (now: number, deltaMilliseconds: number) => {
    for (let index = activeProjectileImpacts.length - 1; index >= 0; index -= 1) {
      const impact = activeProjectileImpacts[index]
      const progress =
        (now - impact.startedAtMilliseconds) / MAGIC_IMPACT_DURATION_MILLISECONDS
      if (progress >= 1) {
        impact.sprite.removeFromParent()
        impact.sprite.destroy({ children: true })
        activeProjectileImpacts.splice(index, 1)
        continue
      }
      impact.sprite.scale.set(1 + progress * 1.6)
      impact.sprite.alpha = 1 - progress
    }

    for (const [projectileId, projectile] of activePlayerProjectiles) {
      // 유도: 대상이 살아 있으면 그쪽으로 꺾고 조준 링을 따라 붙인다. 쓰러지면 직진.
      if (projectile.targetId) {
        const target = getCharacterStates().find(
          (character) => character.id === projectile.targetId
        )

        if (target && !isMonsterCombatStateDefeated(target.id)) {
          const center = getCharacterPixelCenter(target)
          projectile.state = steerPlayerProjectileToward(
            projectile.state,
            center.x,
            center.y,
            deltaMilliseconds
          )
        } else {
          projectile.targetId = undefined
        }
      }

      const { next, expired } = stepPlayerProjectile(
        projectile.state,
        deltaMilliseconds
      )
      projectile.state = next

      let finished = expired

      if (
        !finished &&
        isWallTileAt(
          wallTiles,
          Math.floor(next.x / map.tileWidth),
          Math.floor(next.y / map.tileHeight)
        )
      ) {
        finished = true
      }

      if (!finished && projectile.pierceHitIds) {
        // 관통: 겹친 몬스터를 모두 맞히고 계속 날아간다.
        for (const monster of resolveMonstersInCollisionRect(getPlayerProjectileHitRect(next))) {
          if (projectile.pierceHitIds.has(monster.id)) {
            continue
          }
          projectile.pierceHitIds.add(monster.id)
          applyDamageToMonster(
            monster.id,
            projectile.physicalDamage ?? getPlayerBasicAttackDamage(false),
            now
          )
          spawnMagicImpact(next.x, next.y, now, 0xcfe8ff, 7)
        }
        if (projectile.pierceHitIds.size >= PIERCING_ARROW_MAX_HITS) {
          finished = true
        }
      } else if (!finished) {
        const targetMonster = resolveClosestMonsterInCollisionRect(
          getPlayerProjectileHitRect(next)
        )

        if (targetMonster) {
          if (projectile.magic) {
            applyMagicProjectileHit(next, projectile.magic, targetMonster.id, now)
          } else {
            applyDamageToMonster(
              targetMonster.id,
              projectile.physicalDamage ??
                getPlayerBasicAttackDamage(next.kind === 'energy-ball'),
              now
            )
            if (
              projectile.poisonSkillLevel !== undefined &&
              !isMonsterCombatStateDefeated(targetMonster.id)
            ) {
              applyMonsterDamageOverTime(targetMonster.id, 'poison', {
                damagePerTick: getPoisonDamagePerTick(projectile.poisonSkillLevel),
                ticks: POISON_TICK_COUNT,
                intervalMilliseconds: POISON_TICK_INTERVAL_MILLISECONDS
              }, now)
            }
          }
          finished = true
        }
      }

      if (finished) {
        removePlayerProjectile(projectileId)
        continue
      }

      projectile.sprite.position.set(next.x, next.y)
      projectile.sprite.zIndex = Math.round(next.y + map.tileHeight)

      if (next.kind === 'energy-bolt' || next.kind === 'ice-bolt' || next.kind === 'fireball') {
        projectile.sprite.rotation = getPlayerProjectileRotation(next.direction)
        projectile.sprite.alpha = 0.85 + 0.15 * Math.sin(next.traveledPixels / 6)
      } else if (next.kind === 'arrow') {
        // 조준 화살도 꺾이며 날아가므로 진행 방향으로 계속 돌린다.
        projectile.sprite.rotation = getPlayerProjectileRotation(next.direction)
      }

      if (next.kind === 'energy-ball') {
        // 에너지볼만 은은한 맥동 — 진행 거리 기반이라 일시정지 중에는 멈춘다.
        const pulse = 1 + 0.12 * Math.sin(next.traveledPixels / 9)
        projectile.sprite.scale.set(pulse)
      }
    }
  }

  const clearPlayerProjectiles = () => {
    for (const projectileId of [...activePlayerProjectiles.keys()]) {
      removePlayerProjectile(projectileId)
    }
    for (const impact of activeProjectileImpacts) {
      impact.sprite.removeFromParent()
      impact.sprite.destroy({ children: true })
    }
    activeProjectileImpacts.length = 0
  }

  return {
    applyMonsterDamageOverTime,
    clearMagicEffects,
    clearPlayerProjectiles,
    freezeMonster,
    getPlayerBasicAttackDamage,
    isMonsterFrozen,
    isPlayerCasting,
    monsterMagicStatuses,
    showPlayerMagicMessage,
    triggerPlayerBowAttack,
    triggerPlayerBowSkill,
    triggerPlayerMagicSkill,
    triggerPlayerStaffAttack,
    updateMonsterMagicStatuses,
    updatePlayerMagicCast,
    updatePlayerProjectiles,
    getPlayerMagicCast: () => playerMagicCast,
    spawnMagicImpact
  }
}
