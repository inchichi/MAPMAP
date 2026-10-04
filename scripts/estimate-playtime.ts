// 플레이타임 추정기 — 처음 하는 플레이어가 퀘스트를 순서대로 깰 때 걸리는 시간을 게임 데이터로 계산한다.
//
//   npx vite-node scripts/estimate-playtime.ts            (곁가지 포함)
//   set MAIN_ONLY=1&& npx vite-node scripts/estimate-playtime.ts   (메인만 — 최종장 도착 레벨 확인용)
//
// 손으로 어림하던 측정을 같은 기준으로 다시 잴 수 있게 만든 것이다(docs/game-design-30min.md 의 표).
// 퀘스트 정의·맵·전투 공식은 게임 코드에서 그대로 가져오고, 사람의 행동만 아래 가정 상수로 둔다.
//   이동: 맵 충돌 기준 최단 경로(BFS) × 헤맴 배수, 씬이 다르면 포탈을 거친다.
//   전투: 몬스터 체력(게임과 같은 배수) ÷ (힘 + 무기 공격력), 휘두르기 간격, 접근 시간.
//   읽기: 퀘스트 대사 글자 수 ÷ 읽기 속도 + 줄 넘김.
import { readFileSync } from 'node:fs'

import { createMonsterCombatState } from '../src/games/my-sample-rpg/monsterCombat'
import {
  getMonsterExperienceDropAmount,
  getMonsterGoldDropAmount
} from '../src/games/my-sample-rpg/monsterRewards'
import {
  BOSS_DAMAGE_MULTIPLIER,
  BOSS_HP_MULTIPLIER,
  MONSTER_HP_MULTIPLIER
} from '../src/games/my-sample-rpg/monsterTuning'
import { getPlayerExperienceToNextLevel } from '../src/games/my-sample-rpg/playerExperience'
import { QUEST_DEFINITIONS, type QuestDefinition } from '../src/games/my-sample-rpg/questLog'
import { createMapPortalsFromEventLayers } from '../src/games/my-sample-rpg/tiled/createMapPortalsFromEventLayers'
import { createWallTileLookup, isWallTileAt } from '../src/games/my-sample-rpg/tiled/createWallTileLookup'
import { parseTiledMap, type ParsedTiledMap } from '../src/games/my-sample-rpg/tiled/parseTiledMap'

// ---------------------------------------------------------------- 사람 행동 가정
const MOVE_TILES_PER_SECOND = 8 // characterState 기본 이동 속도
const WANDER_FACTOR = 1.35 // 처음 오는 길은 최단 경로보다 돌아간다
const PORTAL_SECONDS = 2 // 포탈 앞에서 F, 씬 로딩
const READ_CHARS_PER_MINUTE = 225
const SECONDS_PER_DIALOGUE_LINE = 0.6 // 줄 넘김 클릭
const SWING_SECONDS = 0.62 // 공격 동작 320ms + 쿨다운 300ms
const HIT_RATE = 0.8 // 몬스터가 움직여 빗나가는 비율
const ENGAGE_SECONDS = 1.2 // 다음 몬스터에게 붙는 시간(이동 외)
const BOSS_FIGHT_FACTOR = 1.8 // 보스: 피하기·물약
const RESPAWN_SECONDS = 8
const ORE_SECONDS = 1.5 // 광석 한 개 캐기
const SHOP_SECONDS = 15 // 상점 둘러보기
const OVERHEAD_FACTOR = 1.1 // 메뉴·스탯 분배·장비 바꾸기
const STRENGTH_PER_LEVEL = 2 // 레벨당 능력치 3 중 2를 힘에
// 메인 이야기와 곁가지. 곁가지는 해금되는 시점에 끼워 넣는다.
const QUEST_ORDER = [
  'q001-first-slime-hunt',
  'q002-potion-survival-basics',
  'q003-pig-trouble',
  'q015-hidden-cache',
  'q004-before-cave',
  'q005-investigate-cave-entrance',
  'q006-slime-boss-shadow',
  'q007-final-supplies',
  'q008-pig-boss-threat',
  'q009-mine-ore-rush',
  'q010-harvest-village-visit',
  'q011-field-pigs',
  'q012-sluice-keeper',
  'q013-manor-spores',
  'q014-weapon-path'
]
const MAIN_QUEST_IDS = new Set([
  'q001-first-slime-hunt',
  'q002-potion-survival-basics',
  'q003-pig-trouble',
  'q004-before-cave',
  'q005-investigate-cave-entrance',
  'q006-slime-boss-shadow',
  'q007-final-supplies',
  'q008-pig-boss-threat',
  'q009-mine-ore-rush',
  'q014-weapon-path'
])
const SHOP_NPC_BY_ID: Record<string, string> = { blacksmith: 'blacksmith' }
const BASIC_WEAPON_BONUS = 2
const UPGRADE_WEAPON = { bonus: 6, price: 240 } // 강철 검(대장간)

// ---------------------------------------------------------------- 맵
const MAPS_DIR = new URL('../src/games/my-sample-rpg/assets/maps/', import.meta.url)
const townTilesetXml = readFileSync(
  new URL('../src/games/my-sample-rpg/assets/tilesets/town-32.tsx', import.meta.url),
  'utf8'
)
type Tile = { x: number; y: number }
type Point = { sceneId: string } & Tile
type Scene = {
  map: ParsedTiledMap
  walls: Set<string>
  characters: { name: string; type: string; level: number; tile: Tile }[]
  portals: ReturnType<typeof createMapPortalsFromEventLayers>
}
const SCENE_IDS = ['town', 'hunting-ground', 'cave', 'crystal-mine', 'harvest-village']
const scenes: Record<string, Scene> = {}

for (const sceneId of SCENE_IDS) {
  const map = parseTiledMap({
    mapXml: readFileSync(new URL(`${sceneId}.tmx`, MAPS_DIR), 'utf8'),
    externalTilesets: { '../tilesets/town-32.tsx': townTilesetXml }
  })
  const characters = map.eventLayers.flatMap((layer) =>
    layer.events
      .filter((event) => event.className === 'character')
      .map((event) => ({
        name: event.name,
        type: event.appearanceType ?? '',
        level: Number(event.properties['monster.level'] ?? 1),
        // 캐릭터 좌표: x = 가운데, y = 바닥 (createNpcCharactersFromEventLayers 와 같다)
        tile: { x: Math.floor(event.x / 32), y: Math.floor((event.y - 1) / 32) }
      }))
  )
  scenes[sceneId] = {
    map,
    walls: createWallTileLookup(map),
    characters,
    portals: createMapPortalsFromEventLayers({ map })
  }
}

// 한 씬 안에서 최단 칸 수. 목표 칸이 벽(서 있는 NPC 등)이면 옆 칸에 닿으면 된다.
const distanceCache = new Map<string, number>()
const tilesBetween = (sceneId: string, from: Tile, to: Tile): number => {
  const key = `${sceneId}:${from.x},${from.y}>${to.x},${to.y}`
  const cached = distanceCache.get(key)
  if (cached !== undefined) return cached
  const { map, walls } = scenes[sceneId]
  const seen = new Set([`${from.x},${from.y}`])
  let frontier: Tile[] = [from]
  let steps = 0
  let result = Infinity
  search: while (frontier.length > 0) {
    const next: Tile[] = []
    for (const tile of frontier) {
      if (Math.abs(tile.x - to.x) + Math.abs(tile.y - to.y) <= 1) {
        result = steps
        break search
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = tile.x + dx
        const ny = tile.y + dy
        const k = `${nx},${ny}`
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen.has(k)) continue
        if (isWallTileAt(walls, nx, ny)) continue
        seen.add(k)
        next.push({ x: nx, y: ny })
      }
    }
    frontier = next
    steps += 1
  }
  distanceCache.set(key, result)
  return result
}

// 씬을 넘나드는 이동: 포탈을 거쳐 가는 가장 짧은 길(초). 잠긴 포탈은 빼고 센다.
const travelSeconds = (from: Point, to: Point, lockedPortals: Set<string>): number => {
  const best = new Map<string, number>()
  const walk = (point: Point, spent: number, depth: number): number => {
    const key = `${point.sceneId}:${point.x},${point.y}`
    if ((best.get(key) ?? Infinity) <= spent || depth > 5) return Infinity
    best.set(key, spent)
    let result = Infinity
    if (point.sceneId === to.sceneId) {
      result = spent + tilesBetween(point.sceneId, point, to) / MOVE_TILES_PER_SECOND
    }
    for (const portal of scenes[point.sceneId].portals) {
      if (lockedPortals.has(portal.id)) continue
      const tiles = tilesBetween(point.sceneId, point, {
        x: Math.floor(portal.position.x),
        y: Math.floor(portal.position.y)
      })
      if (!Number.isFinite(tiles)) continue
      result = Math.min(
        result,
        walk(
          { sceneId: portal.targetSceneId, x: portal.targetSpawn.x, y: portal.targetSpawn.y },
          spent + tiles / MOVE_TILES_PER_SECOND + PORTAL_SECONDS,
          depth + 1
        )
      )
    }
    return result
  }
  return walk(from, 0, 0) * WANDER_FACTOR
}

const findCharacter = (name: string): Point => {
  for (const sceneId of SCENE_IDS) {
    const found = scenes[sceneId].characters.find((character) => character.name === name)
    if (found) return { sceneId, ...found.tile }
  }
  throw new Error(`NPC ${name} 를 맵에서 찾지 못했다`)
}

// ---------------------------------------------------------------- 플레이어 상태
const player = {
  at: findCharacter('wizard'),
  level: 1,
  experience: 0,
  gold: 150,
  weaponBonus: BASIC_WEAPON_BONUS
}
const lockedPortals = new Set(['mine_shortcut'])
const damagePerHit = () => 5 + (player.level - 1) * STRENGTH_PER_LEVEL + player.weaponBonus
const gainExperience = (amount: number) => {
  player.experience += amount
  while (player.experience >= getPlayerExperienceToNextLevel(player.level)) {
    player.experience -= getPlayerExperienceToNextLevel(player.level)
    player.level += 1
  }
}
const moveTo = (to: Point): number => {
  const seconds = travelSeconds(player.at, to, lockedPortals)
  player.at = to
  return seconds
}

// 몬스터 처치: 그 씬의 같은 종류(또는 이름) 몬스터를 돌며 required 마리를 잡는다.
const fightMonsters = (
  sceneId: string,
  match: (character: Scene['characters'][number]) => boolean,
  required: number
): { travel: number; combat: number } => {
  const targets = scenes[sceneId].characters.filter(match)
  if (targets.length === 0) throw new Error(`${sceneId} 에 맞는 몬스터가 없다`)
  let travel = 0
  let combat = 0
  for (let index = 0; index < required; index += 1) {
    const target = targets[index % targets.length]
    if (index >= targets.length) combat += RESPAWN_SECONDS / targets.length // 다시 생길 때까지
    travel += moveTo({ sceneId, ...target.tile })
    const isBoss = target.name.endsWith('-보스')
    const { maxHp } = createMonsterCombatState(
      target.level,
      isBoss
        ? { hpMultiplier: BOSS_HP_MULTIPLIER, damageMultiplier: BOSS_DAMAGE_MULTIPLIER }
        : { hpMultiplier: MONSTER_HP_MULTIPLIER }
    )
    const hits = Math.ceil(maxHp / damagePerHit())
    combat += ((hits * SWING_SECONDS) / HIT_RATE + ENGAGE_SECONDS) * (isBoss ? BOSS_FIGHT_FACTOR : 1)
    gainExperience(getMonsterExperienceDropAmount(target.level))
    player.gold += getMonsterGoldDropAmount(target.level)
  }
  return { travel, combat }
}

const readSeconds = (lines: string[] | undefined): number =>
  (lines ?? []).reduce(
    (total, line) => total + (line.length / READ_CHARS_PER_MINUTE) * 60 + SECONDS_PER_DIALOGUE_LINE,
    0
  )

// ---------------------------------------------------------------- 퀘스트 진행
type Row = { id: string; title: string; main: boolean; travel: number; combat: number; read: number; other: number; startLevel: number; level: number }
const rows: Row[] = []
let giverAlreadyPresent = false // 자동 완료 퀘스트 다음 퀘스트는 그 자리에서 맡는다

const MAIN_ONLY = process.env.MAIN_ONLY === '1'

for (const questId of QUEST_ORDER.filter((id) => !MAIN_ONLY || MAIN_QUEST_IDS.has(id))) {
  const definition = QUEST_DEFINITIONS.find((quest) => quest.id === questId) as QuestDefinition
  const row: Row = { id: questId, title: definition.title, main: MAIN_QUEST_IDS.has(questId), travel: 0, combat: 0, read: 0, other: 0, startLevel: player.level, level: 0 }
  const giver = findCharacter(definition.giverNpcId)

  if (!giverAlreadyPresent) row.travel += moveTo(giver)
  giverAlreadyPresent = false
  row.read += readSeconds(definition.startDialogueLines)

  for (const objective of definition.objectives) {
    const { target } = objective
    if (objective.type === 'monster-defeat') {
      const result = fightMonsters(
        target.sceneId ?? player.at.sceneId,
        (character) =>
          target.characterId
            ? character.name === target.characterId
            : character.type === target.appearanceType,
        objective.required
      )
      row.travel += result.travel
      row.combat += result.combat
    } else if (objective.type === 'talk') {
      row.travel += moveTo(findCharacter(target.npcId ?? ''))
      row.read += readSeconds(definition.talkTargetDialogueLines ?? definition.activeDialogueLines)
    } else if (objective.type === 'scene-enter') {
      const sceneId = target.sceneId ?? ''
      if (player.at.sceneId !== sceneId) {
        // 그 씬의 아무 칸이나 — 들어가자마자 완료되므로 가장 가까운 도착 칸
        const arrivals = SCENE_IDS.flatMap((id) =>
          scenes[id].portals.filter((portal) => portal.targetSceneId === sceneId && !lockedPortals.has(portal.id))
        ).map((portal) => ({ sceneId, x: portal.targetSpawn.x, y: portal.targetSpawn.y }))
        row.travel += Math.min(...arrivals.map((arrival) => travelSeconds(player.at, arrival, lockedPortals)))
        player.at = arrivals.reduce((best, arrival) =>
          travelSeconds(player.at, arrival, lockedPortals) < travelSeconds(player.at, best, lockedPortals) ? arrival : best
        )
      }
    } else if (objective.type === 'item-acquire') {
      // 광석: 광맥을 돌며 캔다(광맥마다 2개 가정)
      const veins = scenes['crystal-mine'].characters.filter((character) => character.name.startsWith('수정광맥'))
      for (let index = 0; index < Math.ceil(objective.required / 2); index += 1) {
        row.travel += moveTo({ sceneId: 'crystal-mine', ...veins[index % veins.length].tile })
      }
      row.other += objective.required * ORE_SECONDS
    } else if (objective.type === 'shop-open') {
      row.travel += moveTo(findCharacter(SHOP_NPC_BY_ID[target.shopId ?? ''] ?? target.shopId ?? ''))
      row.other += SHOP_SECONDS
    } else if (objective.type === 'item-use') {
      row.other += 2
    }
  }

  if (definition.autoTurnInOnSceneEnter) {
    giverAlreadyPresent = true // 마법사가 멀리서 말을 걸고 다음 퀘스트를 바로 맡긴다
  } else {
    row.travel += moveTo(giver)
  }
  row.read += readSeconds(definition.completionDialogueLines)
  gainExperience(definition.rewards.experience)
  player.gold += definition.rewards.gold
  if (questId === 'q009-mine-ore-rush') lockedPortals.delete('mine_shortcut')
  // 마을에 들를 때 돈이 되면 강철 검을 산다
  if (player.weaponBonus < UPGRADE_WEAPON.bonus && player.at.sceneId === 'town' && player.gold >= UPGRADE_WEAPON.price) {
    player.gold -= UPGRADE_WEAPON.price
    player.weaponBonus = UPGRADE_WEAPON.bonus
    row.other += SHOP_SECONDS
  }
  row.level = player.level
  rows.push(row)
}

// ---------------------------------------------------------------- 출력
const minutes = (seconds: number) => (seconds * OVERHEAD_FACTOR) / 60
const fmt = (value: number) => value.toFixed(1)
console.log('| 퀘스트 | 구분 | 이동 | 전투 | 읽기 | 기타 | 합계(분) | 레벨 (시작→끝) |')
console.log('|---|---|---|---|---|---|---|---|')
for (const row of rows) {
  const total = row.travel + row.combat + row.read + row.other
  console.log(
    `| ${row.id} ${row.title} | ${row.main ? '메인' : '곁가지'} | ${fmt(minutes(row.travel))} | ${fmt(minutes(row.combat))} | ${fmt(minutes(row.read))} | ${fmt(minutes(row.other))} | ${fmt(minutes(total))} | ${row.startLevel}→${row.level} |`
  )
}
const sum = (filter: (row: Row) => boolean, key?: keyof Row) =>
  rows.filter(filter).reduce((total, row) => total + (key ? (row[key] as number) : row.travel + row.combat + row.read + row.other), 0)
for (const [label, filter] of [
  ['메인', (row: Row) => row.main],
  ['전부', () => true]
] as const) {
  console.log(
    `${label}: 약 ${fmt(minutes(sum(filter)))}분 (이동 ${fmt(minutes(sum(filter, 'travel')))} · 전투 ${fmt(minutes(sum(filter, 'combat')))} · 읽기 ${fmt(minutes(sum(filter, 'read')))} · 기타 ${fmt(minutes(sum(filter, 'other')))})`
  )
}
console.log(`끝난 뒤: 레벨 ${player.level}, 골드 ${player.gold}, 무기 공격력 +${player.weaponBonus}`)
