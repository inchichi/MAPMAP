// 시뮬레이터 화면의 경기장 그림(canvas 2D). 시뮬레이터 상태를 시험장 타일맵과 게임 캐릭터 그림으로 그린다 — 좌표는 칸 단위.
// 위험 지대는 터지기 전(예고)은 옅게 차오르고, 터진 뒤에는 진하게 칠한다.
import { getBossHazardCenter, isBossEnraged, type BossHazard, type BossHazardKind } from '../bossSkills'
import type { BossArenaData } from '../bossTraining/bossArena'
import { BOSS_MELEE_RANGE_TILES, isPlayerRolling, type Vector } from '../bossTraining/bossFightSim'
import { getPlayerRollVisualState, PLAYER_ROLL_DURATION_MILLISECONDS } from '../playerRoll'
import type { LpcDirection } from '../rendering/lpcCharacterSprites'
import {
  drawBossSprite,
  drawPlayerSprite,
  getBossFrameCount,
  getPlayerFrameCount,
  PLAYER_ATTACK_ANIMATION,
  TILE_PIXELS,
  type ArenaTiles
} from './arenaSprites'
import { SKILL_LABELS, type FightPlayback } from './fightPlayback'

export type ArenaView = {
  // 보여 줄 칸 범위(벽으로 둘러싸인 바깥은 잘라 낸다)
  left: number
  top: number
  columns: number
  rows: number
  tilePixels: number
  tiles: ArenaTiles
}

const HAZARD_COLORS: Partial<Record<BossHazardKind, string>> = {
  'ground-slam': '#ff8a3d',
  'ring-burst': '#ff4fa3',
  'charge-lane': '#ffd23f',
  'fan-shot': '#7df9ff',
  meteor: '#ff5a36',
  'charged-blast': '#c77dff'
}

export const createArenaView = (arena: BossArenaData, tiles: ArenaTiles): ArenaView => {
  const walls = new Set(arena.walls)
  const open: Array<{ x: number; y: number }> = []
  for (let y = 0; y < arena.height; y += 1) {
    for (let x = 0; x < arena.width; x += 1) {
      if (!walls.has(`${x},${y}`)) {
        open.push({ x, y })
      }
    }
  }
  const left = Math.max(0, Math.min(...open.map((tile) => tile.x)) - 1)
  const top = Math.max(0, Math.min(...open.map((tile) => tile.y)) - 1)
  const right = Math.min(arena.width, Math.max(...open.map((tile) => tile.x)) + 2)
  const bottom = Math.min(arena.height, Math.max(...open.map((tile) => tile.y)) + 2)
  return { left, top, columns: right - left, rows: bottom - top, tilePixels: TILE_PIXELS, tiles }
}

const drawHazard = (
  context: CanvasRenderingContext2D,
  view: ArenaView,
  hazard: BossHazard,
  now: number,
  startedAt: number
) => {
  const color = HAZARD_COLORS[hazard.kind] ?? '#ffffff'
  const center = getBossHazardCenter(hazard, now)
  const px = (center.x - view.left) * view.tilePixels
  const py = (center.y - view.top) * view.tilePixels
  const radius = hazard.radiusTiles * view.tilePixels
  const inner = (hazard.innerRadiusTiles ?? 0) * view.tilePixels
  const armed = now >= hazard.armedAt
  const shape = (outer: number) => {
    context.beginPath()
    context.arc(px, py, outer, 0, Math.PI * 2)
    if (inner > 0) {
      context.moveTo(px + Math.min(inner, outer), py)
      context.arc(px, py, Math.min(inner, outer), 0, Math.PI * 2, true)
    }
  }

  context.save()
  context.fillStyle = color
  context.strokeStyle = color
  if (hazard.velocity) {
    // 탄은 날아가기 전에는 보스 곁에서 깜빡인다
    context.globalAlpha = armed ? 0.95 : 0.4
    shape(radius)
    context.fill()
  } else if (armed) {
    context.globalAlpha = 0.6
    shape(radius)
    context.fill()
  } else {
    // 예고: 테두리 + 터질 때까지 차오르는 안쪽
    const progress = Math.min(1, Math.max(0, (now - startedAt) / Math.max(1, hazard.armedAt - startedAt)))
    context.globalAlpha = 0.12
    shape(radius)
    context.fill()
    context.globalAlpha = 0.25
    shape(inner + (radius - inner) * progress)
    context.fill()
    context.globalAlpha = 0.8
    context.lineWidth = 1.5
    context.setLineDash([4, 3])
    shape(radius)
    context.stroke()
  }
  context.restore()
}

const circle = (context: CanvasRenderingContext2D, x: number, y: number, radius: number) => {
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
}

// 시뮬레이터 좌표는 몸 가운데다. 그림은 발끝을 기준으로 그리므로 반 칸쯤 아래가 발이다.
const FOOT_OFFSET_TILES = 0.45
// 플레이어 공격 동작(mapView/constants 의 공격 동작 시간)
const PLAYER_ATTACK_POSE_MILLISECONDS = 320
const WALK_FRAMES_PER_SECOND = 11
const BOSS_RUN_FRAMES_PER_SECOND = 9

const getDirection = (vector: Vector): LpcDirection =>
  Math.abs(vector.x) >= Math.abs(vector.y) ? (vector.x >= 0 ? 'right' : 'left') : vector.y >= 0 ? 'down' : 'up'

const drawShadow = (context: CanvasRenderingContext2D, x: number, y: number, width: number) => {
  context.save()
  context.fillStyle = 'rgba(0, 0, 0, 0.28)'
  context.beginPath()
  context.ellipse(x, y, width, width * 0.4, 0, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

const drawPlayer = (context: CanvasRenderingContext2D, playback: FightPlayback, x: number, y: number) => {
  const { state, trail, motion } = playback
  const { player, boss, now } = state
  const previous = trail[trail.length - 2] ?? player
  const moved = { x: player.x - previous.x, y: player.y - previous.y }
  const moving = moved.x !== 0 || moved.y !== 0
  const toBoss = { x: boss.x - player.x, y: boss.y - player.y }
  const rolling = isPlayerRolling(state)
  const attackElapsed = motion.playerAttackAt === undefined ? Infinity : now - motion.playerAttackAt

  drawShadow(context, x, y, 11)
  context.save()
  context.translate(x, y)
  if (player.invulnerableUntil > now && Math.floor(now / 100) % 2 === 0) {
    context.globalAlpha = 0.45
  }
  if (rolling) {
    const roll = getPlayerRollVisualState({
      vector: player.rollVector,
      progress: (now - player.rollStartedAt) / PLAYER_ROLL_DURATION_MILLISECONDS
    })
    context.translate(roll.offsetX, roll.offsetY - 16)
    context.rotate(roll.rotation)
    context.translate(0, 16)
  }
  const pose =
    player.hp <= 0
      ? { animation: 'hurt' as const, direction: 'down' as const, frame: getPlayerFrameCount('hurt') - 1 }
      : attackElapsed < PLAYER_ATTACK_POSE_MILLISECONDS
        ? {
            animation: PLAYER_ATTACK_ANIMATION,
            direction: getDirection(toBoss),
            frame: Math.floor((attackElapsed / PLAYER_ATTACK_POSE_MILLISECONDS) * getPlayerFrameCount(PLAYER_ATTACK_ANIMATION))
          }
        : {
            animation: 'walk' as const,
            direction: getDirection(rolling ? player.rollVector : moving ? moved : toBoss),
            frame: moving || rolling ? 1 + (Math.floor((now / 1000) * WALK_FRAMES_PER_SECOND) % 8) : 0
          }
  drawPlayerSprite(context, pose, 0, 0)
  context.restore()
}

const drawBoss = (context: CanvasRenderingContext2D, playback: FightPlayback, x: number, y: number) => {
  const { state, motion } = playback
  const { player, boss, now } = state
  const facingRight = player.x >= boss.x
  const attack = motion.bossAttack && now < motion.bossAttack.until ? motion.bossAttack : undefined
  const pose = attack
    ? {
        animation: 'attack' as const,
        frame: Math.floor(((now - attack.startedAt) / (attack.until - attack.startedAt)) * getBossFrameCount('attack'))
      }
    : boss.hitReactionUntil > now
      ? { animation: 'hit' as const, frame: 0 }
      : motion.bossMoving || boss.charge
        ? { animation: 'run' as const, frame: Math.floor((now / 1000) * BOSS_RUN_FRAMES_PER_SECOND) }
        : { animation: 'idle' as const, frame: 0 }

  drawShadow(context, x, y, 30)
  context.save()
  // 기 모으는 중이면 보라빛, 분노하면 붉은빛이 감돈다
  if (boss.channel || isBossEnraged(boss.hp, boss.maxHp)) {
    context.shadowColor = boss.channel ? '#c77dff' : '#ff2e2e'
    context.shadowBlur = boss.channel ? 20 + 8 * Math.sin(now / 80) : 12
  }
  if (boss.hp <= 0) {
    context.globalAlpha = 0.4
  }
  drawBossSprite(context, { ...pose, facingRight }, x, y)
  context.restore()
}

export const drawFight = (context: CanvasRenderingContext2D, view: ArenaView, playback: FightPlayback) => {
  const { state } = playback
  const { player, boss, now } = state
  const tile = view.tilePixels
  const toPixels = (point: { x: number; y: number }) => ({
    x: (point.x - view.left) * tile,
    y: (point.y - view.top) * tile
  })
  const source = [view.left * tile, view.top * tile, view.columns * tile, view.rows * tile] as const
  const target = [0, 0, view.columns * tile, view.rows * tile] as const
  context.imageSmoothingEnabled = false
  context.drawImage(view.tiles.ground, ...source, ...target)

  for (const hazard of state.hazards) {
    drawHazard(context, view, hazard, now, playback.getHazardStartedAt(hazard.id))
  }

  const bossAt = toPixels(boss)
  const playerAt = toPixels(player)

  // 지나온 자리
  context.save()
  context.strokeStyle = '#3a7bd5'
  context.lineWidth = 2
  context.globalAlpha = 0.35
  context.beginPath()
  playback.trail.forEach((point, index) => {
    const at = toPixels(point)
    if (index === 0) {
      context.moveTo(at.x, at.y)
    } else {
      context.lineTo(at.x, at.y)
    }
  })
  context.stroke()
  context.restore()

  // 보스 근접 사거리(빨강 = 지금 칠 수 있음)
  context.save()
  context.strokeStyle = boss.nextMeleeAt <= now ? '#d62828' : '#ffffff'
  context.globalAlpha = 0.5
  context.setLineDash([3, 4])
  circle(context, bossAt.x, bossAt.y, BOSS_MELEE_RANGE_TILES * tile)
  context.stroke()
  context.restore()

  // 캐릭터는 아래에 있는 쪽이 앞에 온다
  const foot = FOOT_OFFSET_TILES * tile
  const characters = [
    { y: playerAt.y, draw: () => drawPlayer(context, playback, playerAt.x, playerAt.y + foot) },
    { y: bossAt.y, draw: () => drawBoss(context, playback, bossAt.x, bossAt.y + foot) }
  ].sort((a, b) => a.y - b.y)
  characters.forEach((character) => character.draw())

  context.drawImage(view.tiles.roof, ...source, ...target)

  // 혀 당기기
  if (boss.tongue) {
    context.save()
    context.strokeStyle = '#ff6fae'
    context.lineWidth = now >= boss.tongue.startAt ? 5 : 2
    context.setLineDash(now >= boss.tongue.startAt ? [] : [6, 4])
    context.beginPath()
    context.moveTo(bossAt.x, bossAt.y)
    context.lineTo(playerAt.x, playerAt.y)
    context.stroke()
    context.restore()
  }

  // 방금 쓴 기술 이름
  const skill = playback.lastSkill
  if (skill && now - skill.at < 1200) {
    context.save()
    context.font = `bold ${Math.round(tile * 0.6)}px sans-serif`
    context.textAlign = 'center'
    context.lineWidth = 4
    context.strokeStyle = '#000'
    context.fillStyle = '#fff'
    const text = SKILL_LABELS[skill.kind] ?? skill.kind
    context.strokeText(text, bossAt.x, bossAt.y - 2.8 * tile)
    context.fillText(text, bossAt.x, bossAt.y - 2.8 * tile)
    context.restore()
  }
}
