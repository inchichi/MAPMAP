// 보스 연출·특수 기술(bossSkills.ts 의 규칙을 맵 위에 그리고 적용한다): 등장 배너, 분노·시전 깜빡임, 쓰러짐 연출,
// 바닥 위험 지대(독 웅덩이·물기둥·내려찍기·얼음 가시), 혀 당기기, 하수인 소환. 맵 화면(createPixiTiledMapView)의
// 상태는 ctx 로 받는다 — 맵 화면이 다시 할당하는 값(캐릭터 목록·깊이 정렬 층·플레이어 프로필)은 getter 로.
import { Graphics, type Application, type Container, type TextStyle } from 'pixi.js'

import { PLAYER_CHARACTER_ID, type CharacterState } from '../../characterState'
import type { CollisionRect } from '../characterCollision'
import { isMonsterDefeated, type MonsterCombatState } from '../../monsterCombat'
import type { PlayerProfile } from '../../playerProfile'
import type { ParsedTiledMap } from '../../tiled/parseTiledMap'
import { isWallTileAt, type createWallTileLookup } from '../../tiled/createWallTileLookup'
import type { createGameSoundEffects } from '../createGameSoundEffects'
import type { createNpcDialogueOverlay } from '../createNpcDialogueOverlay'
import type { BossHealthView } from '../createBossHealthOverlay'
import { getMonsterDisplayName } from '../../monsterDisplayName'
import {
  BOSS_FIRST_SKILL_DELAY_MILLISECONDS,
  createGroundSlam,
  createPoisonPuddle,
  createWaterPillars,
  getBossHazardDamage,
  getBossKey,
  getBossPresentation,
  getBossSkillCooldown,
  getBossSkillShout,
  getBossSkills,
  getBossSummonPrefix,
  getSummonCountPerCast,
  getTonguePullVector,
  isBossEnraged,
  MAX_ACTIVE_SUMMONS,
  pickBossSkill,
  tickBossHazards,
  TONGUE_PULL_DURATION_MILLISECONDS,
  TONGUE_PULL_WINDUP_MILLISECONDS,
  type BossHazard,
  type BossSkillKind
} from '../../bossSkills'
import { BOSS_SHOUT_DURATION_MILLISECONDS, EVADE_TEXT_STYLE, isBossCharacterId } from './constants'
import type { MonsterPigBehaviorState, RenderedCharacterNode } from './types'

export type BossEncounterContext = {
  app: Application
  map: ParsedTiledMap
  mountElement: HTMLElement
  wallTiles: ReturnType<typeof createWallTileLookup>
  gameSoundEffects: ReturnType<typeof createGameSoundEffects>
  renderedCharacters: Map<string, RenderedCharacterNode>
  monsterSpawnStates: Map<string, CharacterState>
  monsterPigBehaviorStates: Map<string, MonsterPigBehaviorState>
  monsterCombatStates: Map<string, MonsterCombatState>
  monsterRespawnAtById: Map<string, number>
  monsterMagicStatuses: { has: (monsterId: string) => boolean }
  npcDialogueOverlay: ReturnType<typeof createNpcDialogueOverlay>
  sceneIntroBannerElement: HTMLElement
  sceneIntroTextElement: HTMLElement
  sceneIntroMessage: string
  getCharacterStates: () => CharacterState[]
  getDepthSortedLayer: () => Container | undefined
  getPlayerProfile: () => PlayerProfile
  getSceneIntroHideTimeoutId: () => number | undefined
  setSceneIntroHideTimeoutId: (id: number | undefined) => void
  applyDamageToPlayer: (damage: number, now: number, sourceCharacter?: CharacterState) => boolean
  getCharacterPixelCenter: (character: CharacterState) => { x: number; y: number }
  getCharacterStateById: (characterId: string) => CharacterState
  isMonsterCombatStateDefeated: (characterId: string) => boolean
  isPlayerRolling: (now: number) => boolean
  syncCharacterSprite: (character: CharacterState, now?: number) => void
  showCharacterDamageText: (characterId: string, message: string, durationMilliseconds: number, style?: TextStyle) => void
  getBlockingCollisionRects: (excludedCharacterId: string, options?: { ignoreMonsters?: boolean }) => CollisionRect[]
  tryMoveCharacter: (
    characterId: string,
    deltaX: number,
    deltaY: number,
    options?: { preserveFacing?: boolean; ignoreMonsterBlocking?: boolean }
  ) => unknown
}

export const createBossEncounter = (ctx: BossEncounterContext) => {
  const {
    app,
    map,
    mountElement,
    wallTiles,
    gameSoundEffects,
    renderedCharacters,
    monsterSpawnStates,
    monsterPigBehaviorStates,
    monsterCombatStates,
    monsterRespawnAtById,
    monsterMagicStatuses,
    npcDialogueOverlay,
    sceneIntroBannerElement,
    sceneIntroTextElement,
    sceneIntroMessage,
    getCharacterStates,
    getDepthSortedLayer,
    getPlayerProfile,
    getSceneIntroHideTimeoutId,
    setSceneIntroHideTimeoutId,
    applyDamageToPlayer,
    getCharacterPixelCenter,
    getCharacterStateById,
    isMonsterCombatStateDefeated,
    isPlayerRolling,
    syncCharacterSprite,
    showCharacterDamageText,
    getBlockingCollisionRects,
    tryMoveCharacter
  } = ctx

  // 보스 특수 기술(bossSkills.ts): 기술별 다시 쓸 수 있는 시각, 바닥 위험 지대와 그 그림, 혀 당기기
  const bossSkillReadyAtById = new Map<string, Partial<Record<BossSkillKind, number>>>()
  let bossHazards: BossHazard[] = []
  const bossHazardGraphicsById = new Map<string, Graphics>()
  let bossHazardSequence = 0
  // 보스 연출: 등장 배너를 이미 띄운 보스, 분노에 들어간 보스, 시전 깜빡임이 끝나는 시각
  const bossIntroShownIds = new Set<string>()
  const bossEnragedIds = new Set<string>()
  const bossFlashUntilById = new Map<string, number>()
  let bossDefeatSlowTimeoutId: number | undefined
  let bossTonguePull:
    | {
        bossId: string
        startedAt: number
        lastAt: number
        vector: { x: number; y: number }
        line: Graphics
      }
    | undefined

  // ---------------------------------------------------------------- 보스 특수 기술(bossSkills.ts)
  // 보스가 어그로 중일 때 근접 공격보다 먼저 확인한다. 썼으면 true(그 틈에 근접 공격은 미룬다).
  function tryUseBossSkill(
    boss: CharacterState,
    bossCenter: { x: number; y: number },
    playerCenter: { x: number; y: number },
    distance: number,
    now: number
  ): boolean {
    let readyAt = bossSkillReadyAtById.get(boss.id)
    if (!readyAt) {
      readyAt = Object.fromEntries(
        getBossSkills(getBossKey(boss)).map((skill) => [
          skill.kind,
          now + BOSS_FIRST_SKILL_DELAY_MILLISECONDS
        ])
      )
      bossSkillReadyAtById.set(boss.id, readyAt)
    }
    announceBoss(boss)
    const combat = monsterCombatStates.get(boss.id)
    const enraged = combat !== undefined && isBossEnraged(combat.currentHp, combat.maxHp)
    if (enraged && !bossEnragedIds.has(boss.id)) {
      // 분노: 한 번 외치고 번쩍인다. 이후 기술 간격이 짧아지고 소환이 늘어난다.
      bossEnragedIds.add(boss.id)
      const line = getBossPresentation(getBossKey(boss))?.enrageLine
      if (line) {
        showCharacterDamageText(boss.id, line, BOSS_SHOUT_DURATION_MILLISECONDS, EVADE_TEXT_STYLE)
      }
      bossFlashUntilById.set(boss.id, now + 600)
    }
    if (getPlayerProfile().hp.current === 0) {
      return false
    }
    const skill = pickBossSkill(getBossKey(boss), distance, readyAt, now)
    if (!skill) {
      return false
    }
    readyAt[skill.kind] = now + getBossSkillCooldown(skill, enraged)
    if (skill.kind === 'summon' && !summonBossMinions(boss, now, enraged)) {
      return false
    }
    // 무엇이 올지 외치고 몸이 번쩍인다(기술 예고)
    showCharacterDamageText(
      boss.id,
      getBossSkillShout(getBossKey(boss), skill.kind),
      BOSS_SHOUT_DURATION_MILLISECONDS,
      EVADE_TEXT_STYLE
    )
    bossFlashUntilById.set(boss.id, now + 300)
    switch (skill.kind) {
      case 'poison-puddle':
        addBossHazards([
          createPoisonPuddle(`${boss.id}:${++bossHazardSequence}`, playerCenter.x, playerCenter.y, now)
        ])
        return true
      case 'water-pillar':
      case 'ice-spike':
        addBossHazards(
          createWaterPillars(
            `${boss.id}:${++bossHazardSequence}`,
            playerCenter.x,
            playerCenter.y,
            now,
            Math.random,
            skill.kind
          )
        )
        return true
      case 'ground-slam':
        addBossHazards([createGroundSlam(`${boss.id}:${++bossHazardSequence}`, bossCenter.x, bossCenter.y, now)])
        return true
      case 'tongue-pull':
        startBossTonguePull(boss.id, bossCenter, playerCenter, now)
        return true
      case 'summon':
        return true
    }
  }

  // 보스가 처음 싸움에 들어서면 칭호와 이름을 배너로 알린다(씬 인트로 배너를 잠깐 빌린다).
  function announceBoss(boss: CharacterState): void {
    if (bossIntroShownIds.has(boss.id)) {
      return
    }
    bossIntroShownIds.add(boss.id)
    const title = getBossPresentation(getBossKey(boss))?.title
    const name = getMonsterDisplayName({ id: boss.id, displayText: boss.displayText })
    window.clearTimeout(getSceneIntroHideTimeoutId())
    sceneIntroTextElement.textContent = title ? `${title}\n${name}` : name
    sceneIntroBannerElement.classList.add('scene-intro-overlay--visible', 'scene-intro-overlay--boss')
    setSceneIntroHideTimeoutId(window.setTimeout(() => {
      sceneIntroBannerElement.classList.remove('scene-intro-overlay--visible')
      window.setTimeout(() => {
        sceneIntroBannerElement.classList.remove('scene-intro-overlay--boss')
        sceneIntroTextElement.textContent = sceneIntroMessage
      }, 220)
    }, 2400))
  }

  // 싸우는 중인 보스(체력바에 띄울 것) — 어그로가 붙은 살아 있는 보스.
  function getActiveBossView(): BossHealthView | undefined {
    const boss = getCharacterStates().find(
      (character) =>
        isBossCharacterId(character.id) &&
        !isMonsterCombatStateDefeated(character.id) &&
        monsterPigBehaviorStates.get(character.id)?.isAggroed === true
    )
    const combat = boss ? monsterCombatStates.get(boss.id) : undefined
    if (!boss || !combat) {
      return undefined
    }
    return {
      title: getBossPresentation(getBossKey(boss))?.title,
      name: getMonsterDisplayName({ id: boss.id, displayText: boss.displayText }),
      hpRatio: combat.maxHp > 0 ? combat.currentHp / combat.maxHp : 0,
      enraged: isBossEnraged(combat.currentHp, combat.maxHp)
    }
  }

  // 보스 시전·분노 깜빡임: 잠깐 밝은 보랏빛으로 물들였다가 되돌린다(마법 상태 색이 있으면 그쪽이 맡는다).
  function updateBossFlashes(now: number): void {
    for (const [bossId, until] of bossFlashUntilById) {
      const node = renderedCharacters.get(bossId)
      if (!node) {
        bossFlashUntilById.delete(bossId)
        continue
      }
      if (until > now) {
        node.sprite.tint = Math.floor(now / 80) % 2 ? 0xffd8ff : 0xffffff
        continue
      }
      if (!monsterMagicStatuses.has(bossId)) {
        node.sprite.tint = 0xffffff
      }
      bossFlashUntilById.delete(bossId)
    }
  }

  // 보스가 쓰러질 때: 화면이 하얗게 번쩍이고 잠깐 느려진다. 남길 말이 있으면 이어서 대화창으로.
  function playBossDefeat(boss: CharacterState): void {
    const flash = document.createElement('div')
    flash.className = 'boss-defeat-flash'
    mountElement.append(flash)
    window.setTimeout(() => flash.remove(), 600)
    app.ticker.speed = 0.4
    window.clearTimeout(bossDefeatSlowTimeoutId)
    bossDefeatSlowTimeoutId = window.setTimeout(() => {
      app.ticker.speed = 1
      const lines = getBossPresentation(getBossKey(boss))?.deathLines
      if (lines && !npcDialogueOverlay.isOpen()) {
        npcDialogueOverlay.show({
          portraitUrl: '',
          pixelArtPortrait: false,
          name: getMonsterDisplayName({ id: boss.id, displayText: boss.displayText }),
          lines
        })
      }
    }, 800)
  }

  function addBossHazards(hazards: BossHazard[]): void {
    for (const hazard of hazards) {
      const graphics = new Graphics()
      graphics.label = `boss-hazard:${hazard.id}`
      // 바닥 무늬: 모든 캐릭터 아래(깊이 정렬 층의 맨 아래)
      graphics.zIndex = -100000
      graphics.position.set(hazard.x * map.tileWidth, hazard.y * map.tileHeight)
      getDepthSortedLayer()?.addChild(graphics)
      bossHazardGraphicsById.set(hazard.id, graphics)
    }
    bossHazards = [...bossHazards, ...hazards]
  }

  function drawBossHazard(graphics: Graphics, hazard: BossHazard, now: number): void {
    const radiusX = hazard.radiusTiles * map.tileWidth
    const radiusY = radiusX * 0.62
    const armed = now >= hazard.armedAt
    graphics.clear()
    if (hazard.kind === 'poison-puddle') {
      if (!armed) {
        // 경고: 독이 날아가 떨어질 자리 — 점점 차오르는 테두리
        const t = 1 - (hazard.armedAt - now) / 900
        graphics.ellipse(0, 0, radiusX, radiusY)
        graphics.stroke({ color: 0xd4ff6a, width: 3, alpha: 0.95 })
        graphics.ellipse(0, 0, radiusX * Math.max(0.15, t), radiusY * Math.max(0.15, t))
        graphics.fill({ color: 0x6fae3a, alpha: 0.5 })
        return
      }
      const pulse = 0.5 + 0.5 * Math.sin(now / 180)
      const fade = Math.min(1, (hazard.expiresAt - now) / 600)
      // 독안개(캐릭터 위 층) 아래에서도 보이게 진하게 칠한다
      graphics.ellipse(0, 0, radiusX, radiusY)
      graphics.fill({ color: 0x4a8a12, alpha: (0.72 + pulse * 0.1) * fade })
      graphics.ellipse(0, 0, radiusX, radiusY)
      graphics.stroke({ color: 0xd4ff6a, width: 3, alpha: 0.95 * fade })
      // 거품 몇 개
      for (let index = 0; index < 4; index += 1) {
        const angle = index * 1.7 + now / 900
        graphics.circle(Math.cos(angle) * radiusX * 0.5, Math.sin(angle) * radiusY * 0.5, 2 + pulse * 1.5)
        graphics.fill({ color: 0xc8f07a, alpha: 0.7 * fade })
      }
      return
    }
    if (hazard.kind === 'ground-slam') {
      if (!armed) {
        // 경고: 보스 둘레로 금이 가며 차오르는 흙빛 고리
        const t = 1 - (hazard.armedAt - now) / 900
        graphics.ellipse(0, 0, radiusX, radiusY)
        graphics.stroke({ color: 0xd8a860, width: 3, alpha: 0.95 })
        graphics.ellipse(0, 0, radiusX * Math.max(0.1, t), radiusY * Math.max(0.1, t))
        graphics.fill({ color: 0x8a5a2a, alpha: 0.35 })
        return
      }
      // 충격파: 바깥으로 번지는 흙먼지 고리
      const burst = 1 - (hazard.expiresAt - now) / 400
      graphics.ellipse(0, 0, radiusX * (0.6 + burst * 0.5), radiusY * (0.6 + burst * 0.5))
      graphics.stroke({ color: 0xf0d8a8, width: 6 * (1 - burst) + 1, alpha: 0.9 * (1 - burst) })
      graphics.ellipse(0, 0, radiusX, radiusY)
      graphics.fill({ color: 0x8a5a2a, alpha: 0.4 * (1 - burst) })
      return
    }
    if (hazard.kind === 'ice-spike' && armed) {
      // 솟는 얼음 가시: 하얀 뾰족한 결정 셋
      const burst = 1 - (hazard.expiresAt - now) / 450
      const height = map.tileHeight * 1.8 * Math.min(1, burst * 3)
      graphics.ellipse(0, 0, radiusX, radiusY)
      graphics.fill({ color: 0xbfe6ff, alpha: 0.45 * (1 - burst) })
      for (const [dx, scale] of [[-0.35, 0.7], [0, 1], [0.35, 0.75]] as const) {
        const w = radiusX * 0.28
        graphics.poly([dx * radiusX - w, 0, dx * radiusX, -height * scale, dx * radiusX + w, 0])
        graphics.fill({ color: 0xeaf8ff, alpha: 0.9 * (1 - burst * 0.6) })
      }
      return
    }
    if (!armed) {
      // 경고: 바닥에 물이 스며 오르는 푸른 고리
      const t = 1 - (hazard.armedAt - now) / 1100
      graphics.ellipse(0, 0, radiusX, radiusY)
      graphics.stroke({ color: 0x8fd8ff, width: 2, alpha: 0.95 })
      graphics.ellipse(0, 0, radiusX * Math.max(0.1, t), radiusY * Math.max(0.1, t))
      graphics.fill({ color: 0x3a8fd0, alpha: 0.3 })
      return
    }
    // 터짐: 솟구치는 물기둥
    const burst = 1 - (hazard.expiresAt - now) / 450
    const height = map.tileHeight * 2.4 * Math.min(1, burst * 3)
    graphics.ellipse(0, 0, radiusX, radiusY)
    graphics.fill({ color: 0x3a8fd0, alpha: 0.55 * (1 - burst) })
    graphics.roundRect(-radiusX * 0.45, -height, radiusX * 0.9, height, radiusX * 0.3)
    graphics.fill({ color: 0xbfe9ff, alpha: 0.8 * (1 - burst * 0.7) })
    graphics.roundRect(-radiusX * 0.25, -height * 0.95, radiusX * 0.5, height * 0.9, radiusX * 0.2)
    graphics.fill({ color: 0xffffff, alpha: 0.7 * (1 - burst * 0.7) })
  }

  function updateBossHazards(now: number): void {
    if (bossHazards.length === 0) {
      return
    }
    const player = getCharacterStateById(PLAYER_CHARACTER_ID)
    const tick = tickBossHazards(
      bossHazards,
      player.position.x + player.collisionSize.width / 2,
      player.position.y + player.collisionSize.height / 2,
      now
    )
    const liveIds = new Set(tick.hazards.map((hazard) => hazard.id))
    for (const [id, graphics] of bossHazardGraphicsById) {
      if (!liveIds.has(id)) {
        graphics.destroy()
        bossHazardGraphicsById.delete(id)
      }
    }
    bossHazards = tick.hazards
    for (const hazard of bossHazards) {
      const graphics = bossHazardGraphicsById.get(hazard.id)
      if (graphics) {
        drawBossHazard(graphics, hazard, now)
      }
    }
    for (const kind of tick.damageKinds) {
      // 물기둥은 공격이라 구르기·방어로 피할 수 있다(보스를 출처로). 독 웅덩이는 바닥 독이라 못 막는다.
      const boss = getCharacterStates().find((character) => isBossCharacterId(character.id))
      applyDamageToPlayer(
        getBossHazardDamage(kind, getPlayerProfile().hp.max),
        now,
        kind === 'water-pillar' ? boss : undefined
      )
    }
  }

  function clearBossHazards(): void {
    for (const graphics of bossHazardGraphicsById.values()) {
      graphics.destroy()
    }
    bossHazardGraphicsById.clear()
    bossHazards = []
  }

  function startBossTonguePull(
    bossId: string,
    bossCenter: { x: number; y: number },
    playerCenter: { x: number; y: number },
    now: number
  ): void {
    clearBossTonguePull()
    const line = new Graphics()
    line.label = 'boss-tongue'
    getDepthSortedLayer()?.addChild(line)
    bossTonguePull = {
      bossId,
      // 입을 벌리고 잠깐 멈췄다가(이때 구르면 빠져나간다) 혀를 내민다
      startedAt: now + TONGUE_PULL_WINDUP_MILLISECONDS,
      lastAt: now + TONGUE_PULL_WINDUP_MILLISECONDS,
      vector: getTonguePullVector(bossCenter, playerCenter),
      line
    }
    gameSoundEffects.play('slimeAttack')
  }

  // 혀 당기기: 짧은 시간 동안 플레이어를 보스 쪽으로 끌고, 그동안 보스 입에서 플레이어까지 혀를 그린다.
  // 끌려가는 길에 벽이 있으면 거기서 멈춘다(tryMoveCharacter). 구르는 중이면 빠져나간다.
  function updateBossTonguePull(now: number): void {
    if (!bossTonguePull) {
      return
    }
    const pull = bossTonguePull
    const boss = getCharacterStates().find((character) => character.id === pull.bossId)
    const bossAlive = boss !== undefined && !isMonsterCombatStateDefeated(boss.id)
    if (now < pull.startedAt) {
      if (!bossAlive) {
        clearBossTonguePull()
      }
      return
    }
    const end = pull.startedAt + TONGUE_PULL_DURATION_MILLISECONDS
    // 프레임이 느려도 끌려가는 거리는 다 채운다: 지난 프레임부터 지금(끝을 넘지 않게)까지의 몫을 먼저 옮긴다.
    const step = (Math.min(now, end) - pull.lastAt) / TONGUE_PULL_DURATION_MILLISECONDS
    if (step > 0 && bossAlive && getPlayerProfile().hp.current > 0 && !isPlayerRolling(now)) {
      tryMoveCharacter(PLAYER_CHARACTER_ID, pull.vector.x * step, pull.vector.y * step, {
        preserveFacing: true
      })
    }
    pull.lastAt = Math.min(now, end)
    if (!boss || !bossAlive || getPlayerProfile().hp.current === 0 || now >= end + 120) {
      clearBossTonguePull()
      return
    }
    const player = getCharacterStateById(PLAYER_CHARACTER_ID)
    const bossPixel = getCharacterPixelCenter(boss)
    const playerPixel = getCharacterPixelCenter(player)
    const mouthY = bossPixel.y - map.tileHeight * 0.9
    pull.line.clear()
    pull.line.moveTo(bossPixel.x, mouthY)
    pull.line.lineTo(playerPixel.x, playerPixel.y - map.tileHeight * 0.3)
    pull.line.stroke({ color: 0xc0506e, width: 5, alpha: 0.95, cap: 'round' })
    pull.line.moveTo(bossPixel.x, mouthY)
    pull.line.lineTo(playerPixel.x, playerPixel.y - map.tileHeight * 0.3)
    pull.line.stroke({ color: 0xf08aa2, width: 2, alpha: 0.9, cap: 'round' })
    pull.line.zIndex = Math.round(Math.max(bossPixel.y, playerPixel.y) + map.tileHeight)
  }

  function clearBossTonguePull(): void {
    bossTonguePull?.line.destroy()
    bossTonguePull = undefined
  }

  // 보스 곁에 쓰러져 있던 하수인을 일으킨다. 살아 있는 하수인이 많으면 부르지 않는다(false).
  function summonBossMinions(boss: CharacterState, now: number, enraged: boolean): boolean {
    const prefix = getBossSummonPrefix(boss.id)
    const minions = getCharacterStates().filter((character) => character.id.startsWith(prefix))
    const aliveCount = minions.filter((minion) => !isMonsterCombatStateDefeated(minion.id)).length
    const waiting = minions.filter(
      (minion) => isMonsterCombatStateDefeated(minion.id) && !monsterRespawnAtById.has(minion.id)
    )
    const count = Math.min(getSummonCountPerCast(enraged), MAX_ACTIVE_SUMMONS + (enraged ? 1 : 0) - aliveCount, waiting.length)
    if (count <= 0) {
      return false
    }
    for (let index = 0; index < count; index += 1) {
      const minion = waiting[index]
      const spawn = monsterSpawnStates.get(minion.id)
      if (!spawn) {
        continue
      }
      // 보스 양옆에 솟아오른다. 벽이면 원래 자리(맵에 둔 자리)에서 일어난다.
      const side = index % 2 === 0 ? -1 : 1
      const candidate = {
        x: Math.round(boss.position.x + side * 2),
        y: Math.round(boss.position.y + 1)
      }
      const blocked =
        isWallTileAt(wallTiles, candidate.x, candidate.y) ||
        getBlockingCollisionRects(minion.id, { ignoreMonsters: true }).some(
          (rect) =>
            candidate.x < rect.x + rect.width &&
            candidate.x + spawn.collisionSize.width > rect.x &&
            candidate.y < rect.y + rect.height &&
            candidate.y + spawn.collisionSize.height > rect.y
        )
      monsterSpawnStates.set(minion.id, {
        ...spawn,
        position: blocked ? { ...spawn.position } : candidate
      })
      monsterRespawnAtById.set(minion.id, now)
    }
    return true
  }

  // 보스가 쓰러지면 남은 하수인과 바닥 위험 지대를 함께 거둔다.
  function clearBossEncounter(bossId: string): void {
    playBossDefeat(getCharacterStateById(bossId))
    bossEnragedIds.delete(bossId)
    const prefix = getBossSummonPrefix(bossId)
    for (const character of getCharacterStates()) {
      if (!character.id.startsWith(prefix)) {
        continue
      }
      const combatState = monsterCombatStates.get(character.id)
      if (combatState && !isMonsterDefeated(combatState)) {
        monsterCombatStates.set(character.id, { ...combatState, currentHp: 0 })
        character.blocksMovement = false
        syncCharacterSprite(character)
      }
      monsterRespawnAtById.delete(character.id)
    }
    bossSkillReadyAtById.delete(bossId)
    clearBossHazards()
    clearBossTonguePull()
  }

  return {
    bossSkillReadyAtById,
    tryUseBossSkill,
    getActiveBossView,
    updateBossFlashes,
    updateBossHazards,
    clearBossHazards,
    updateBossTonguePull,
    clearBossTonguePull,
    clearBossEncounter,
    destroy: () => window.clearTimeout(bossDefeatSlowTimeoutId)
  }
}
