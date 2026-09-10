import {
  Application,
  Container,
  Graphics,
  Sprite,
  Text,
  type Texture,
  type Ticker
} from 'pixi.js'

import {
  BOSS_DAMAGE_MULTIPLIER,
  BOSS_HP_MULTIPLIER,
  spendPlayerStatPoints
} from '../balance'
import { isWithinSwingArc } from '../swingArc'
import { createCryptStyleLayer } from './createCryptStyleLayer'
import { createMonsterAi, stepMonsterAi, type MonsterAiState } from '../monsterAi'
import {
  isBlocked,
  moveWithCollision,
  type DungeonModel,
  type MonsterSpawn,
  type StairsSpawn
} from '../dungeonModel'
import {
  FIRST_FLOOR,
  floorByStem,
  floorLabel,
  floorMemory,
  isStairsOpen,
  stairsDestination,
  type Floor,
  type FloorMemories,
  type FloorMemory
} from '../floors'
import type { CharacterMoveDirection } from '../../my-sample-rpg/characterState'
import {
  applyMonsterDamage,
  createMonsterCombatState,
  isMonsterDefeated,
  type MonsterCombatState
} from '../../my-sample-rpg/monsterCombat'
import { getMonsterExperienceDropAmount } from '../../my-sample-rpg/monsterRewards'
import { grantPlayerExperience } from '../../my-sample-rpg/playerExperience'
import {
  createInitialPlayerProfile,
  type PlayerProfile
} from '../../my-sample-rpg/playerProfile'
import {
  getPlayerMovementSpeedTilesPerSecond,
  getPlayerPhysicalAttackPower,
  shouldPlayerEvadeDamage
} from '../../my-sample-rpg/playerStatEffects'
import {
  createChunkedTilemap,
  createTileTextureLookup,
  type ChunkedTilemap
} from './createChunkedTilemap'
import { createCombatFx, type CombatFx } from './createCombatFx'
import {
  NO_KNOCKBACK,
  NO_SHAKE,
  damageTextLook,
  hitstopTimeScale,
  knockbackStepTiles,
  shakeOffset,
  startHitstop,
  startKnockback,
  startShake,
  stepHitstop,
  stepKnockback,
  stepShake,
  type Knockback
} from '../hitFeel'
import { createBossAi, stepBossAi, type BossAiState } from '../bossAi'
import { findNearestInRange } from '../interactables'
import { rollChestLoot, rollMonsterLoot } from '../loot'
import { HEALTH_POTION, STARTING_WEAPON, isBetterWeapon, type Weapon } from '../items'
import { createLootOverlay } from './createLootOverlay'
import type {
  ActorAnimations,
  ActorDirection,
  DirectionalFrames
} from './loadActorTextures'
import type { Texture as PixiTexture } from 'pixi.js'
import { createCryptHud, HUD_FONT, loadHudArt } from './createCryptHud'
import { createGameAudio } from './createGameAudio'
import { createMapOverlay, type MapOverlay } from './createMapOverlay'
import { discoveredRatio, revealAround } from '../exploration'
import type { ParsedTiledMap } from '../../my-sample-rpg/tiled/parseTiledMap'

const VIEW_WIDTH = 960
const VIEW_HEIGHT = 540
// 16px 아트를 정수 2배로 띄운다. 계약의 내보내기 배율과 같아야 화면과 연구용 렌더가 일치한다.
const ZOOM = 2
const TILE = 16

const MONSTER_SPEED_TILES = 2.8
const PLAYER_RADIUS_TILES = 0.32
const ATTACK_COOLDOWN_MS = 380
const ATTACK_DURATION_MS = 160
const ATTACK_REACH_TILES = 1.7
const PLAYER_INVULNERABLE_MS = 550
const WALK_FRAME_MS = 130

// 기존 게임의 플레이어는 방향별 애니가 없는 정지 타일 한 장이다. 그래서 기존 게임이 쓰는
// 것과 같은 종류의 움직임으로 메운다 — 걸을 때 위아래 흔들림, 공격 시 앞으로 찌르기,
const ATTACK_LUNGE_PIXELS = 3
const HIT_RECOIL_PIXELS = 5
const HIT_RECOIL_MS = 180

// 활성 반경 밖 몬스터는 매 프레임 갱신하지 않는다. 269마리를 전부 돌리면 대형 맵에서
// 프레임이 무너진다 — 화면 한 장이 27x15타일이라 24타일이면 넉넉히 화면 밖까지 덮는다.
const ACTIVE_RADIUS_TILES = 24

// 지도에 드러나는 반경. 화면 반폭이 15타일이라 그보다 조금 넓게 잡아 지나간 길이
// 자연스럽게 이어지게 한다.
const REVEAL_RADIUS_TILES = 17

// 상자 타일. gid = scripts/ninja-dungeon-atlas.json 의 sheets.element.start(1760)
// + row * columns(16) + col + 1 → 닫힘 element(1,3)=1780, 열림 element(1,4)=1781.
// 계약상 시트는 뒤에만 덧붙이므로 이 인덱스는 밀리지 않는다.
// 계단 타일. dungeon(0,0)/(0,1) 은 바닥에 뚫린 구멍이라 "구덩이로 내려간다"에 맞는다.
const STAIRS_DOWN_GID = 1
const STAIRS_UP_GID = 2

const CHEST_CLOSED_GID = 1780
const CHEST_OPEN_GID = 1781
const CHEST_REACH_TILES = 1.6
// 바닥 무기를 F 로 줍는 거리. 상자보다 조금 짧다 — 겹칠 때 상자가 먼저 잡히는 편이 낫다.
const WEAPON_REACH_TILES = 1.3
// 계단은 밟고 서서 누른다. 상자·무기보다 짧게 잡아 계단 옆의 상자를 가로채지 않게 한다.
const STAIRS_REACH_TILES = 0.9
// 휘두르는 동안 손목이 돌아가는 최대 각(라디안). 정지 그림 한 장이라도 베는 것으로 읽힌다.
const SWING_RADIANS = 0.9

// 보스 기술
const BOSS_SLAM_RADIUS_TILES = 3.6
const BOSS_SLAM_DAMAGE_SCALE = 2.4
const BOSS_CHARGE_DAMAGE_SCALE = 1.8
const BOSS_CONTACT_TILES = 1.3
const SLAM_RING_MS = 360

// 화면 흔들림은 보스 내려찍기와 플레이어 피격에만 쓴다. 몬스터를 벨 때마다 흔들면
// 밝은 픽셀아트가 계속 떨려 멀미가 난다.
const SLAM_SHAKE_PIXELS = 4
const HURT_SHAKE_PIXELS = 2.5
const SHAKE_MS = 150

// depth 는 깊은 물에만 깔리는 짙은 층이다(TMX opacity 0.38). 그늘(0.18)과 뜻이 달라
// 레이어를 나눴다 — 팩의 수면이 한 장뿐이라 깊이는 겹쳐 얹는 수밖에 없다.
const RENDERED_LAYERS =
  ['ground', 'ground_deco', 'depth', 'shadow', 'wall', 'wall_deco', 'prop'] as const

// 계약의 맵 배경색. 벽 덩어리 내부는 타일을 그리지 않으므로 이 색이 곧 암반으로 읽힌다.
const BACKGROUND = '#2a2431'

const FACING_STEPS: Record<CharacterMoveDirection, { x: number, y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
}

type TilePosition = { tileX: number, tileY: number }

type SpawnedActor = Pick<MonsterSpawn, 'kind' | 'level' | 'tileX' | 'tileY'>

type MonsterRuntime = {
  spawn: SpawnedActor
  /** 층 기억에 죽음을 적을 때 쓰는 `model.monsters` / `model.bosses` 안의 자리. */
  spawnIndex: number
  sprite: Sprite
  // 몬스터 시트는 방향별이지만 보스 시트는 동작별 한 줄이다. 방향을 받아 프레임 목록을
  // 돌려주는 함수로 감싸 양쪽을 같은 루프에서 다룬다.
  frames: (facing: ActorDirection) => PixiTexture[]
  ai: MonsterAiState
  combat: MonsterCombatState
  x: number
  y: number
  facing: ActorDirection
  frameIndex: number
  frameClockMs: number
  isBoss: boolean
  bossAi: BossAiState
  knock: Knockback
}

/** 지금 서 있는 층에만 있는 것들. 층을 옮기면 통째로 버리고 새로 만든다. */
type FloorScene = {
  floor: Floor
  map: ParsedTiledMap
  model: DungeonModel
  memory: FloorMemory
  /** 이 층에 들어선 자리. 죽으면 여기로 되살아난다. */
  entry: TilePosition
  root: Container
  style: Awaited<ReturnType<typeof createCryptStyleLayer>>
  actors: Container
  tilemap: ChunkedTilemap
  fx: CombatFx
  loot: Awaited<ReturnType<typeof createLootOverlay>>
  mapOverlay: MapOverlay
  monsters: MonsterRuntime[]
  chestSprites: Sprite[]
  openChestTexture: PixiTexture
  slamRing: Graphics
}

export type CryptViewAssets = {
  atlas: Texture
  // Ninja Adventure 'Boy' — 던전 타일셋과 같은 팩·같은 작가. walk 는 방향당 4프레임,
  // idle/attack 은 방향당 1프레임이다.
  player: ActorAnimations
  // 종류별 몬스터·보스 스프라이트. 층마다 나오는 종류가 다르므로 `loadFloor` 가 채워 넣는다.
  monsterFrames: Map<string, DirectionalFrames>
  bossFrames: Map<string, PixiTexture[]>
}

/** 한 층의 TMX 를 읽어 오는 일. fetch 는 뷰 바깥(main.ts)에 둔다. */
export type LoadFloor = (
  floor: Floor
) => Promise<{ map: ParsedTiledMap, model: DungeonModel }>

const directionFromMove = (
  dx: number,
  dy: number,
  fallback: CharacterMoveDirection
): CharacterMoveDirection => {
  if (dx === 0 && dy === 0) {
    return fallback
  }
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left'
  }
  return dy > 0 ? 'down' : 'up'
}

// F 안내 문구. 계단·상자·바닥 무기가 F 를 나눠 쓰므로 무엇이 잡혔는지 알려 준다. 지금 든 것보다
// 약한 무기를 가리킬 때만 현재 공격력을 덧붙인다 — 늘 붙이면 읽을 것이 늘기만 한다.
const interactLabelFor = (
  stairs: StairsSpawn | undefined,
  stairsOpen: boolean,
  chestFirst: boolean,
  ground: Weapon | undefined,
  held: Weapon
): string => {
  if (stairs) {
    if (!stairsOpen) {
      return '아직 열리지 않았다  —  이 층의 보스를 잡아야 한다'
    }
    return stairs.direction === 'down' ? 'F  아래층으로' : 'F  위층으로'
  }
  if (chestFirst) {
    return 'F  상자 열기'
  }
  if (!ground) {
    return ''
  }

  return isBetterWeapon(ground, held)
    ? `F  ${ground.name} +${ground.attack} 바꿔 들기`
    : `F  ${ground.name} +${ground.attack} 바꿔 들기  (지금 +${held.attack})`
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const createCryptView = async (
  host: HTMLElement,
  assets: CryptViewAssets,
  loadFloor: LoadFloor
) => {
  const app = new Application()
  // 캔버스는 뷰포트 고정. 맵 크기로 만들면 12288px 맵에서 백버퍼가 MAX_TEXTURE_SIZE 를 넘는다.
  await app.init({
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    background: BACKGROUND,
    antialias: false,
    roundPixels: true
  })
  host.appendChild(app.canvas)

  const world = new Container()
  world.scale.set(ZOOM)
  app.stage.addChild(world)

  // HUD 아트(팩 UI + 픽셀 폰트)는 한 번만 읽어 HUD 와 지도 오버레이가 나눠 쓴다.
  const hudArt = await loadHudArt()
  const hud = createCryptHud(app.stage, hudArt, VIEW_WIDTH, VIEW_HEIGHT)
  const audio = createGameAudio()

  // 384² TMX 한 장을 파싱하고 청크를 굽는 데 수백 ms 가 걸린다. 그동안 화면이 배경색만
  // 남으면 멈춘 것으로 보인다.
  const loadingPanel = new Graphics()
    .rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
    .fill({ color: 0x141118, alpha: 0.92 })
  const loadingText = new Text({
    text: '',
    style: { fontFamily: HUD_FONT, fontSize: 16, fill: 0xf2eaf1, align: 'center' }
  })
  loadingText.anchor.set(0.5)
  loadingText.position.set(VIEW_WIDTH / 2, VIEW_HEIGHT / 2)
  const loading = new Container()
  loading.addChild(loadingPanel, loadingText)
  loading.visible = false
  app.stage.addChild(loading)

  const showLoading = (message: string) => {
    loadingText.text = message
    loading.visible = true
  }

  // ------------------------------------------------------------------ 플레이어
  let profile: PlayerProfile = createInitialPlayerProfile()
  let playerX = 0
  let playerY = 0
  let facing: CharacterMoveDirection = 'down'
  let walkClockMs = 0
  let walkFrame = 0
  let attackStartedAtMs = -Infinity
  let nextAttackAtMs = 0
  let invulnerableUntilMs = 0
  // 피격 반동. 시작 시각이 -Infinity 면 진행도가 1이라 세기가 0이 된다(분기 없이 꺼진다).
  let recoil = { startedAtMs: -Infinity, dirX: 0, dirY: 0 }
  // 타격감 상태. 히트스톱은 남은 시간(ms), 흔들림은 감쇠 중인 한 번의 흔들림이다.
  let hitstopMs = 0
  let shake = NO_SHAKE
  let gold = 0
  let potions = 0
  let kills = 0
  let weapon: Weapon = STARTING_WEAPON

  const playerSprite = new Sprite(assets.player.idle.down[0])
  playerSprite.anchor.set(0.5, 0.75)

  const floatingTexts: { text: Text, untilMs: number }[] = []

  // 층을 짓는 동안에는 없다 — update 가 그 사이에 무엇도 만지지 않게 하는 유일한 신호다.
  let scene: FloorScene | undefined
  const memories: FloorMemories = new Map()

  // 내려찍기 충격파 — 퍼지는 고리 한 장. 그림은 층마다 새로 만드는 Graphics 에 그린다.
  const slamEffect = {
    startedAtMs: -Infinity,
    x: 0,
    y: 0,
    show: (x: number, y: number, nowMs: number) => {
      slamEffect.startedAtMs = nowMs
      slamEffect.x = x
      slamEffect.y = y
    },
    update: (ring: Graphics, nowMs: number) => {
      const progress = (nowMs - slamEffect.startedAtMs) / SLAM_RING_MS
      if (progress < 0 || progress > 1) {
        ring.visible = false
        return
      }
      ring.visible = true
      ring.clear()
      ring
        .circle(0, 0, BOSS_SLAM_RADIUS_TILES * TILE * progress)
        .stroke({ color: 0xff8080, width: 2, alpha: 1 - progress })
      ring.position.set(slamEffect.x * TILE, slamEffect.y * TILE)
    }
  }

  const showFloatingText = (
    x: number,
    y: number,
    label: string,
    colour: number,
    fontSize = 8
  ) => {
    if (!scene) {
      return
    }
    const text = new Text({
      text: label,
      style: { fontFamily: 'monospace', fontSize, fill: colour }
    })
    text.anchor.set(0.5, 1)
    text.position.set(x * TILE, y * TILE - 10)
    text.zIndex = 9999
    scene.actors.addChild(text)
    floatingTexts.push({ text, untilMs: app.ticker.lastTime + 650 })
  }

  // 피격 표시용 짧은 붉은 점멸.
  const flash = (sprite: Sprite) => {
    sprite.tint = 0xff6b6b
    window.setTimeout(() => {
      // 층을 옮기며 스프라이트가 사라진 뒤에 타이머가 돌 수 있다.
      if (!sprite.destroyed) {
        sprite.tint = 0xffffff
      }
    }, 90)
  }

  // ------------------------------------------------------------------- 층 전환
  const buildScene = async (
    floor: Floor,
    arrival: TilePosition | undefined
  ): Promise<FloorScene> => {
    const { map, model } = await loadFloor(floor)
    const memory = floorMemory(memories, floor, model.width, model.height)

    const root = new Container()
    const tilemap = createChunkedTilemap(map, assets.atlas, RENDERED_LAYERS)
    root.addChild(tilemap.container)
    const style = await createCryptStyleLayer(floor.stem, model.width * 16, model.height * 16)
    root.addChild(style.container)

    const actors = new Container()
    actors.sortableChildren = true
    root.addChild(actors)
    world.addChild(root)

    const fx = await createCombatFx(actors)
    const loot = await createLootOverlay(actors)
    loot.setHeldWeapon(weapon)

    // 상자는 타일 레이어에 굽지 않고 스프라이트로 그린다 — 열면 텍스처를 바꿔야 하기 때문이다.
    const tileTextureFor = createTileTextureLookup(map, assets.atlas)
    const closedChestTexture = tileTextureFor(CHEST_CLOSED_GID)
    const openChestTexture = tileTextureFor(CHEST_OPEN_GID)
    const chestSprites = model.chests.map((chest, index) => {
      const sprite = new Sprite(
        memory.openedChests.has(index) ? openChestTexture : closedChestTexture
      )
      sprite.anchor.set(0.5, 0.75)
      sprite.position.set((chest.tileX + 0.5) * TILE, (chest.tileY + 1) * TILE)
      sprite.zIndex = chest.tileY
      actors.addChild(sprite)
      return sprite
    })

    // 계단. 오브젝트로만 있으면 384x384 맵에서 보이지 않는 칸을 맨몸으로 찾아야 한다.
    // 타일을 그리고, 그 위에 은은한 고리를 얹어 멀리서도 눈에 띄게 한다.
    for (const stairs of model.stairs) {
      const isDown = stairs.direction === 'down'
      const halo = new Graphics()
        .circle(0, 0, TILE * 0.9)
        .fill({ color: isDown ? 0xffd166 : 0x8ecae6, alpha: 0.18 })
      halo.position.set((stairs.tileX + 0.5) * TILE, (stairs.tileY + 0.5) * TILE)
      halo.zIndex = stairs.tileY - 0.1
      actors.addChild(halo)

      const sprite = new Sprite(tileTextureFor(isDown ? STAIRS_DOWN_GID : STAIRS_UP_GID))
      sprite.anchor.set(0.5, 0.75)
      sprite.position.set((stairs.tileX + 0.5) * TILE, (stairs.tileY + 1) * TILE)
      sprite.zIndex = stairs.tileY
      actors.addChild(sprite)
    }

    const monsters: MonsterRuntime[] = []
    const spawn = (actor: SpawnedActor, spawnIndex: number, isBoss: boolean) => {
      const bossTextures = isBoss ? assets.bossFrames.get(actor.kind) : undefined
      const directional = assets.monsterFrames.get(actor.kind)
      const frames: ((facing: ActorDirection) => PixiTexture[]) | undefined =
        bossTextures ? () => bossTextures : directional ? (facing) => directional[facing] : undefined
      if (!frames) {
        console.warn('[crypt] 스프라이트가 없어 건너뜀:', actor.kind)
        return
      }
      const sprite = new Sprite(frames('down')[0])
      sprite.anchor.set(0.5, 0.75)
      sprite.visible = false
      if (isBoss) {
        sprite.scale.set(2)
      }
      actors.addChild(sprite)
      monsters.push({
        spawn: actor,
        spawnIndex,
        sprite,
        frames,
        ai: createMonsterAi(actor.tileX + 0.5, actor.tileY + 0.5),
        combat: createMonsterCombatState(
          actor.level,
          isBoss
            ? { hpMultiplier: BOSS_HP_MULTIPLIER, damageMultiplier: BOSS_DAMAGE_MULTIPLIER }
            : {}
        ),
        x: actor.tileX + 0.5,
        y: actor.tileY + 0.5,
        facing: 'down',
        frameIndex: 0,
        frameClockMs: 0,
        isBoss,
        bossAi: createBossAi(),
        knock: NO_KNOCKBACK
      })
    }
    // 이미 잡은 것은 아예 만들지 않는다. 다시 내려왔다고 되살아나면 오르내리기가 벌이 된다.
    model.monsters.forEach((actor, index) => {
      if (!memory.defeatedMonsters.has(index)) {
        spawn(actor, index, false)
      }
    })
    model.bosses.forEach((actor, index) => {
      if (!memory.defeatedBosses.has(index)) {
        spawn(actor, index, true)
      }
    })

    // 내려찍기 충격파 — 퍼지는 고리 한 장. 보스 기술이 "일어났다"는 걸 눈으로 알려 준다.
    const slamRing = new Graphics()
    slamRing.visible = false
    slamRing.zIndex = 99999
    actors.addChild(slamRing)

    actors.addChild(playerSprite)

    const mapOverlay = createMapOverlay(
      app.stage, hudArt, model, memory.exploration, VIEW_WIDTH, VIEW_HEIGHT
    )
    // 다시 찾은 층. 지도 캔버스는 새로 만들어 비어 있는데 갱신은 "이번에 새로 드러난 칸이
    // 있을 때"만 돌므로, 지나온 길이 영영 안 나온다. 들어설 때 한 번 통째로 칠한다.
    if (discoveredRatio(memory.exploration) > 0) {
      mapOverlay.repaintAround(
        model.width / 2, model.height / 2, Math.max(model.width, model.height)
      )
    }

    return {
      floor,
      map,
      model,
      memory,
      entry: arrival ?? model.playerSpawn,
      root,
      style,
      actors,
      tilemap,
      fx,
      loot,
      mapOverlay,
      monsters,
      chestSprites,
      openChestTexture,
      slamRing
    }
  }

  const teardownScene = () => {
    if (!scene) {
      return
    }
    scene.mapOverlay.destroy()
    scene.style.destroy()
    // 플레이어만 층을 따라 이동한다. 나머지는 층과 함께 버린다.
    scene.actors.removeChild(playerSprite)
    world.removeChild(scene.root)
    scene.root.destroy({ children: true })
    floatingTexts.length = 0
    scene = undefined
  }

  const enterFloor = async (floor: Floor, arrival: TilePosition | undefined) => {
    showLoading(`${floorLabel(floor)}\n\n불러오는 중…`)
    teardownScene()
    // 로딩 화면을 실제로 한 번 그려 둔다. 이 뒤의 파싱은 스레드를 통째로 잡는다.
    app.render()
    await new Promise((resolve) => {
      window.setTimeout(resolve, 0)
    })

    const built = await buildScene(floor, arrival)
    playerX = built.entry.tileX + 0.5
    playerY = built.entry.tileY + 0.5
    scene = built
    loading.visible = false
    window.parent.postMessage({ type: 'game:scene-changed', sceneId: floor.stem }, location.origin)
  }

  // 계단은 게임 루프 안에서 밟는다. 실패해도 루프를 죽이지 않고 화면에 이유를 남긴다.
  const travel = async (from: FloorScene, stairs: StairsSpawn) => {
    const destination = stairsDestination(from.floor, stairs.direction, stairs.target)
    await enterFloor(destination, {
      tileX: stairs.targetTileX,
      tileY: stairs.targetTileY
    })
  }

  // ------------------------------------------------------------------ 입력
  const pressed = new Set<string>()
  // 눌린 순간에만 처리해야 하는 입력은 플래그로 받아 다음 프레임에 한 번 소비한다.
  let wantsInteract = false
  let wantsPotion = false
  const onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase()
    // 브라우저는 사용자 입력이 있기 전까지 재생을 막는다. 첫 입력에서 소리를 깨운다.
    audio.unlock()
    if (!event.repeat) {
      // 볼륨/음소거는 눌렀다는 표시가 없으면 먹었는지 알 수 없다. 바꾼 값을 띄운다.
      const audioMessage = audio.handleKey(key)
      if (audioMessage) {
        showFloatingText(playerX, playerY, audioMessage, 0x9ad0ff)
      }
    }
    // 토글은 눌린 순간에만 뒤집는다. held() 로 보면 누르고 있는 동안 매 프레임 열고 닫힌다.
    if (key === 'm' && !event.repeat && scene) {
      scene.mapOverlay.toggleExpanded()
    }
    if (key === 'f' && !event.repeat) {
      wantsInteract = true
    }
    if (key === 'q' && !event.repeat) {
      wantsPotion = true
    }
    pressed.add(key)
    if (event.key === ' ') {
      event.preventDefault()
    }
  }
  const onKeyUp = (event: KeyboardEvent) => pressed.delete(event.key.toLowerCase())
  const onPointerDown = () => {
    audio.unlock()
    pressed.add(' ')
  }
  const onPointerUp = () => pressed.delete(' ')
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  app.canvas.addEventListener('pointerdown', onPointerDown)
  app.canvas.addEventListener('pointerup', onPointerUp)

  const held = (...keys: string[]) => keys.some((key) => pressed.has(key))

  const respawn = (current: FloorScene) => {
    // 맵 시작점이 아니라 이 층에 들어선 자리다. 아니면 죽을 때마다 전 구간을 다시 걷는다.
    playerX = current.entry.tileX + 0.5
    playerY = current.entry.tileY + 0.5
    profile = { ...profile, hp: { ...profile.hp, current: profile.hp.max } }
    gold = Math.floor(gold * 0.9)
  }

  // 플레이어 피해. 기존 게임과 같은 순서다 — 무적 시간 → 행운 회피 → 체력 차감.
  const damagePlayer = (amount: number, nowMs: number, fromX: number, fromY: number) => {
    if (nowMs < invulnerableUntilMs) {
      return
    }
    if (shouldPlayerEvadeDamage(profile)) {
      showFloatingText(playerX, playerY, '회피', 0x9be7a2)
      return
    }

    const applied = Math.max(1, Math.round(amount))
    profile = {
      ...profile,
      hp: { ...profile.hp, current: Math.max(0, profile.hp.current - applied) }
    }
    invulnerableUntilMs = nowMs + PLAYER_INVULNERABLE_MS
    const away = Math.hypot(playerX - fromX, playerY - fromY) || 1
    recoil = {
      startedAtMs: nowMs,
      dirX: (playerX - fromX) / away,
      dirY: (playerY - fromY) / away
    }
    shake = startShake(HURT_SHAKE_PIXELS, SHAKE_MS)
    flash(playerSprite)
    audio.playSfx('player_hurt')
    showFloatingText(playerX, playerY, String(applied), 0xff8080)
  }

  const openChest = (current: FloorScene, index: number) => {
    const chest = current.model.chests[index]
    current.memory.openedChests.add(index)
    current.chestSprites[index].texture = current.openChestTexture
    audio.playSfx('chest')
    // 상자 칸은 상자 그림에 가리므로 한 칸 남쪽에 쏟아 놓는다. 금화·물약은 밟는 순간
    // 들어오고 무기만 남는다. 남쪽이 벽인 상자가 있으므로(맵에 그렇게 놓여 있다),
    // 밟을 수 있는 칸으로 물러선다. 상자 칸 자신은 항상 통행 가능하므로 마지막 후보로 둔다.
    const dropTile =
      [[0, 1], [0, -1], [-1, 0], [1, 0]]
        .map(([dx, dy]) => ({ x: chest.tileX + dx, y: chest.tileY + dy }))
        .find((tile) => !isBlocked(current.model, tile.x, tile.y))
      ?? { x: chest.tileX, y: chest.tileY }
    current.loot.dropAt(
      dropTile.x,
      dropTile.y,
      rollChestLoot(chest.tier, profile.level, Math.random)
    )
  }

  // ------------------------------------------------------------------- 루프
  const update = (ticker: Ticker) => {
    const current = scene
    if (!current) {
      return
    }
    const { model, map } = current
    current.style.update(ticker.lastTime)
    const realDeltaMs = ticker.deltaMS
    // 히트스톱: 실제 시간은 그대로 흐르되 게임 시간만 늦춘다. 쿨다운·무적 시간은 nowMs
    // 기준이라 영향받지 않고, 이동과 애니메이션만 잠깐 끈적해진다.
    const deltaMs = realDeltaMs * hitstopTimeScale(hitstopMs)
    hitstopMs = stepHitstop(hitstopMs, realDeltaMs)
    const nowMs = ticker.lastTime
    const deltaSeconds = deltaMs / 1000

    if (profile.hp.current <= 0) {
      audio.playSfx('death')
      respawn(current)
    }

    // 이동
    const inputX = (held('arrowright', 'd') ? 1 : 0) - (held('arrowleft', 'a') ? 1 : 0)
    const inputY = (held('arrowdown', 's') ? 1 : 0) - (held('arrowup', 'w') ? 1 : 0)
    const length = Math.hypot(inputX, inputY)
    const attacking = nowMs < attackStartedAtMs + ATTACK_DURATION_MS
    const moving = length > 0 && !attacking
    if (moving) {
      const step = (getPlayerMovementSpeedTilesPerSecond(profile) * deltaSeconds) / length
      const moved = moveWithCollision(
        model, playerX, playerY, inputX * step, inputY * step, PLAYER_RADIUS_TILES
      )
      playerX = moved.x
      playerY = moved.y
      facing = directionFromMove(inputX, inputY, facing)
      walkClockMs += deltaMs
      if (walkClockMs >= WALK_FRAME_MS) {
        walkClockMs -= WALK_FRAME_MS
        walkFrame = (walkFrame + 1) % assets.player.walk[facing].length
      }
    } else {
      walkClockMs = 0
      walkFrame = 0
    }

    // 공격
    if (held(' ') && nowMs >= nextAttackAtMs) {
      nextAttackAtMs = nowMs + ATTACK_COOLDOWN_MS
      attackStartedAtMs = nowMs
      current.fx.playSlash(playerX, playerY, facing)
      audio.playSfx('swing')
      // 무기 공격력은 힘에 그대로 더한다. 등급도 배율도 없으니 이 한 줄이 장착의 전부다.
      const damage = getPlayerPhysicalAttackPower(profile) + weapon.attack
      for (const monster of current.monsters) {
        if (isMonsterDefeated(monster.combat)) {
          continue
        }
        if (!isWithinSwingArc(playerX, playerY, facing, monster.x, monster.y, ATTACK_REACH_TILES)) {
          continue
        }
        const struck = applyMonsterDamage(monster.combat, damage)
        const applied = monster.combat.currentHp - struck.currentHp
        monster.combat = struck
        if (applied > 0) {
          flash(monster.sprite)
          // 체력의 4분의 1을 한 번에 깎으면 묵직한 쪽으로 바꾼다.
          audio.playSfx(applied * 4 >= monster.combat.maxHp ? 'hit_heavy' : 'hit')
          const look = damageTextLook(applied, monster.combat.maxHp)
          showFloatingText(monster.x, monster.y, String(applied), look.color, look.fontSize)
          hitstopMs = startHitstop(hitstopMs)
          // 보스는 밀리지 않는다. 돌진 중에 밀려나면 예고해 둔 궤도가 어긋난다.
          if (!monster.isBoss) {
            monster.knock = startKnockback(playerX, playerY, monster.x, monster.y)
          }
        }
        if (isMonsterDefeated(monster.combat)) {
          current.fx.playDeath(monster.sprite)
          audio.playSfx('kill')
          kills += 1
          // 층을 떠났다 돌아와도 죽은 채로 있어야 한다.
          const defeated = monster.isBoss
            ? current.memory.defeatedBosses
            : current.memory.defeatedMonsters
          defeated.add(monster.spawnIndex)
          current.loot.dropAt(
            Math.floor(monster.x),
            Math.floor(monster.y),
            rollMonsterLoot(monster.spawn.level, Math.random)
          )
          const rewarded = grantPlayerExperience(
            profile, getMonsterExperienceDropAmount(monster.spawn.level)
          )
          // 레벨업 보상은 스탯 포인트로 들어온다. 이 게임엔 스탯 창이 없어 바로 분배한다.
          profile = rewarded.levelsGained > 0
            ? spendPlayerStatPoints(rewarded.nextProfile)
            : rewarded.nextProfile
          if (rewarded.levelsGained > 0) {
            audio.playSfx('levelup')
            showFloatingText(playerX, playerY, '레벨 업!', 0xffd166)
          }
        }
      }
    }

    const attackProgress = (nowMs - attackStartedAtMs) / ATTACK_DURATION_MS
    const lunge = attacking ? Math.sin(attackProgress * Math.PI) * ATTACK_LUNGE_PIXELS : 0
    playerSprite.texture = attacking
      ? assets.player.attack[facing][0]
      : moving
        ? assets.player.walk[facing][walkFrame]
        : assets.player.idle[facing][0]
    const recoilStrength =
      HIT_RECOIL_PIXELS * (1 - Math.min(1, (nowMs - recoil.startedAtMs) / HIT_RECOIL_MS)) ** 2
    const facingStep = FACING_STEPS[facing]
    playerSprite.position.set(
      playerX * TILE + facingStep.x * lunge + recoil.dirX * recoilStrength,
      playerY * TILE + facingStep.y * lunge + recoil.dirY * recoilStrength
    )
    playerSprite.zIndex = playerY
    // 든 무기는 플레이어 스프라이트를 그대로 따라간다 — 돌진과 반동까지 함께 움직인다.
    current.loot.updateHeldWeapon(
      playerSprite.position.x,
      playerSprite.position.y,
      facing,
      attacking ? Math.sin(attackProgress * Math.PI) * SWING_RADIANS : 0,
      playerY
    )

    // 밟은 금화·물약은 그냥 들어온다. 무기만 F 로 줍는다.
    const collected = current.loot.collectTouched(playerX, playerY)
    gold += collected.gold
    potions += collected.potions
    if (collected.gold > 0) {
      audio.playSfx('coin')
      showFloatingText(playerX, playerY, `+${collected.gold}`, 0xffd166)
    }

    // 이 층에 남은 보스 = 하행 계단의 자물쇠. 스프라이트가 없어 못 띄운 보스도 세야
    // 계단이 거저 열리지 않는다. 그래서 스폰 목록이 아니라 맵이 적어 둔 수로 센다.
    const bossesAlive = model.bosses.length - current.memory.defeatedBosses.size

    // F 대상 고르기. 계단이 가장 좁은 사거리라 먼저 본다 — 밟고 선 사람의 뜻은 분명하다.
    const nearStairs = findNearestInRange(
      model.stairs, playerX, playerY, STAIRS_REACH_TILES
    )
    const stairsOpen =
      nearStairs !== undefined && isStairsOpen(nearStairs.item.direction, bossesAlive)
    const nearChest = findNearestInRange(
      model.chests, playerX, playerY, CHEST_REACH_TILES,
      (index) => current.memory.openedChests.has(index)
    )
    const nearWeapon = findNearestInRange(
      current.loot.groundWeapons, playerX, playerY, WEAPON_REACH_TILES
    )
    const chestFirst =
      nearChest !== undefined &&
      (nearWeapon === undefined || nearChest.distanceTiles <= nearWeapon.distanceTiles)
    if (wantsInteract) {
      wantsInteract = false
      if (nearStairs) {
        if (stairsOpen) {
          void travel(current, nearStairs.item).catch((error: unknown) => {
            showLoading(`층을 열지 못했습니다\n\n${errorMessage(error)}`)
          })
          return
        }
        showFloatingText(playerX, playerY, '아직 열리지 않았다', 0xff8080)
      } else if (nearChest && chestFirst) {
        openChest(current, nearChest.index)
      } else if (nearWeapon) {
        // 바꿔 든다 — 들고 있던 것은 그 자리에 남으니 잘못 주워도 되돌릴 수 있다.
        weapon = current.loot.swapWeapon(nearWeapon.index, weapon)
        current.loot.setHeldWeapon(weapon)
        showFloatingText(playerX, playerY, `${weapon.name} +${weapon.attack}`, 0xffd166)
      }
    }

    // 물약 (Q)
    if (wantsPotion) {
      wantsPotion = false
      if (potions > 0 && profile.hp.current < profile.hp.max) {
        potions -= 1
        audio.playSfx('potion')
        const healed = Math.max(1, Math.round(profile.hp.max * HEALTH_POTION.healRatio))
        profile = {
          ...profile,
          hp: { ...profile.hp, current: Math.min(profile.hp.max, profile.hp.current + healed) }
        }
        showFloatingText(playerX, playerY, `+${healed}`, 0x8ce99a)
      }
    }

    // 몬스터 — 활성 반경 안만 갱신한다.
    for (const monster of current.monsters) {
      if (isMonsterDefeated(monster.combat)) {
        continue
      }
      const distanceX = monster.x - playerX
      const distanceY = monster.y - playerY
      if (Math.abs(distanceX) > ACTIVE_RADIUS_TILES || Math.abs(distanceY) > ACTIVE_RADIUS_TILES) {
        monster.sprite.visible = false
        continue
      }
      monster.sprite.visible = true

      // 보스는 예고 → 기술 → 경직 주기를 도는 별도 AI 를 쓴다. 잡몹과 같은 로직이면
      // 그냥 체력 많은 잡몹이 된다.
      let moveX = 0
      let moveY = 0
      if (monster.isBoss) {
        const hpRatio = monster.combat.currentHp / monster.combat.maxHp
        const stepped = stepBossAi(
          monster.bossAi, monster.x, monster.y, playerX, playerY, hpRatio, nowMs
        )
        // 예고는 매 프레임 진행도를 내므로, 울릴 순간은 phase 가 막 바뀐 프레임으로 잡는다.
        if (stepped.ai.phase === 'telegraph' && monster.bossAi.phase !== 'telegraph') {
          audio.playSfx('boss_alert')
        }
        monster.bossAi = stepped.ai
        moveX = stepped.action.moveX
        moveY = stepped.action.moveY

        // 예고 중에는 붉게 달아오른다 — 무엇이 올지 읽을 시간을 준다.
        const telegraph = stepped.action.telegraph
        monster.sprite.tint = telegraph > 0
          ? 0xffffff - Math.round(telegraph * 0x60) * 0x0101
          : stepped.ai.enraged ? 0xffc0c0 : 0xffffff

        if (stepped.action.slam) {
          slamEffect.show(monster.x, monster.y, nowMs)
          audio.playSfx('boss_slam')
          shake = startShake(SLAM_SHAKE_PIXELS, SHAKE_MS)
          if (Math.hypot(playerX - monster.x, playerY - monster.y) <= BOSS_SLAM_RADIUS_TILES) {
            damagePlayer(
              Math.round(monster.combat.contactDamage * BOSS_SLAM_DAMAGE_SCALE),
              nowMs, monster.x, monster.y
            )
          }
        }
        if (
          stepped.action.chargeHit &&
          Math.hypot(playerX - monster.x, playerY - monster.y) <= BOSS_CONTACT_TILES
        ) {
          damagePlayer(
            Math.round(monster.combat.contactDamage * BOSS_CHARGE_DAMAGE_SCALE),
            nowMs, monster.x, monster.y
          )
        }
      } else {
        const stepped = stepMonsterAi(
          monster.ai, monster.x, monster.y, playerX, playerY, nowMs,
          { aggroTiles: 7, leashTiles: 14, attackTiles: 1.1, attackCooldownMs: 900 }
        )
        monster.ai = stepped.ai
        moveX = stepped.intent.moveX * MONSTER_SPEED_TILES
        moveY = stepped.intent.moveY * MONSTER_SPEED_TILES
        if (stepped.intent.attack) {
          damagePlayer(monster.combat.contactDamage, nowMs, monster.x, monster.y)
        }
      }

      if (moveX !== 0 || moveY !== 0) {
        const moved = moveWithCollision(
          model, monster.x, monster.y,
          moveX * deltaSeconds, moveY * deltaSeconds, 0.3
        )
        monster.x = moved.x
        monster.y = moved.y
        monster.facing = directionFromMove(moveX, moveY, monster.facing)
        monster.frameClockMs += deltaMs
        if (monster.frameClockMs >= WALK_FRAME_MS) {
          monster.frameClockMs = 0
          monster.frameIndex = (monster.frameIndex + 1) % monster.frames(monster.facing).length
        }
      }

      // 넉백은 AI 이동 뒤에 얹는다. 같은 충돌 판정을 쓰므로 벽을 뚫고 밀려나지 않는다.
      if (monster.knock.remainingMs > 0) {
        const pushTiles = knockbackStepTiles(monster.knock, deltaMs)
        const pushed = moveWithCollision(
          model, monster.x, monster.y,
          monster.knock.dirX * pushTiles, monster.knock.dirY * pushTiles, 0.3
        )
        monster.x = pushed.x
        monster.y = pushed.y
        monster.knock = stepKnockback(monster.knock, deltaMs)
      }

      const monsterFrameList = monster.frames(monster.facing)
      monster.sprite.texture = monsterFrameList[monster.frameIndex % monsterFrameList.length]
      monster.sprite.position.set(monster.x * TILE, monster.y * TILE)
      monster.sprite.zIndex = monster.y
    }

    slamEffect.update(current.slamRing, nowMs)
    current.fx.update(deltaMs)

    // 화면 근처에 살아 있는 보스가 있으면 상단 체력바를 띄운다.
    const engagedBoss = current.monsters.find(
      (monster) =>
        monster.isBoss &&
        !isMonsterDefeated(monster.combat) &&
        Math.hypot(monster.x - playerX, monster.y - playerY) <= ACTIVE_RADIUS_TILES
    )

    // 떠오르는 글자 정리
    for (let index = floatingTexts.length - 1; index >= 0; index -= 1) {
      const entry = floatingTexts[index]
      entry.text.y -= deltaSeconds * 18
      if (nowMs >= entry.untilMs) {
        entry.text.destroy()
        floatingTexts.splice(index, 1)
      }
    }

    // 카메라 — 월드를 옮긴다(캔버스는 고정).
    const halfWidth = VIEW_WIDTH / (2 * ZOOM)
    const halfHeight = VIEW_HEIGHT / (2 * ZOOM)
    const cameraX = Math.min(
      Math.max(playerX * TILE, halfWidth), map.width * TILE - halfWidth
    )
    const cameraY = Math.min(
      Math.max(playerY * TILE, halfHeight), map.height * TILE - halfHeight
    )
    // 흔들림은 실제 시간으로 잦아든다 — 히트스톱 중에 늘어지면 두 연출이 서로 뭉갠다.
    shake = stepShake(shake, realDeltaMs)
    const shakeNow = shakeOffset(shake)
    world.position.set(
      Math.round((halfWidth - cameraX) * ZOOM + shakeNow.x),
      Math.round((halfHeight - cameraY) * ZOOM + shakeNow.y)
    )
    current.tilemap.cull(cameraX - halfWidth, cameraY - halfHeight, halfWidth * 2, halfHeight * 2)

    // 곡은 층을 따라간다 — audio.ts 의 층 곡 표가 층 순서로 색인되므로 층 번호를 그대로
    // 넘긴다. 보스가 활성 반경 안에 있으면 그쪽이 이긴다(체력바와 같은 판정).
    audio.update({
      nowMs,
      zoneId: current.floor.index,
      bossActive: engagedBoss !== undefined
    })
    // 지도: 새로 드러난 칸이 있을 때만 다시 칠한다.
    if (revealAround(current.memory.exploration, playerX, playerY, REVEAL_RADIUS_TILES) > 0) {
      current.mapOverlay.repaintAround(playerX, playerY, REVEAL_RADIUS_TILES)
    }
    current.mapOverlay.update(playerX, playerY)

    hud.update({
      hp: profile.hp.current,
      maxHp: profile.hp.max,
      level: profile.level,
      experience: profile.experience.current,
      gold,
      kills,
      zoneName: floorLabel(current.floor),
      chunks: current.tilemap.visibleChunkCount(),
      potions,
      weapon,
      interactLabel: interactLabelFor(
        nearStairs?.item, stairsOpen, chestFirst, nearWeapon?.item.weapon, weapon
      ),
      boss: engagedBoss && !isMonsterDefeated(engagedBoss.combat)
        ? {
            name: current.floor.bossName,
            hp: engagedBoss.combat.currentHp,
            maxHp: engagedBoss.combat.maxHp,
            enraged: engagedBoss.bossAi.enraged
          }
        : undefined
    })
  }

  const requestedFloor = new URLSearchParams(location.search).get('floor')
  await enterFloor(requestedFloor ? floorByStem(requestedFloor) : FIRST_FLOOR, undefined)

  // 카메라 위치와 청크 컬링은 update 안에 있다. 한 번 돌려두지 않으면 첫 프레임이
  // 배경색만 있는 빈 화면으로 나온다.
  update(app.ticker)
  app.render()

  app.ticker.maxFPS = 60
  app.ticker.add(update)

  return {
    // 티커가 멈춘 환경(헤드리스 캡처 등)에서 한 프레임을 강제로 그린다.
    render: () => {
      update(app.ticker)
      app.render()
    },
    goToFloor: async (stem: string) => {
      if (loading.visible) return
      await enterFloor(floorByStem(stem), undefined)
    },
    destroy: () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      app.canvas.removeEventListener('pointerdown', onPointerDown)
      app.canvas.removeEventListener('pointerup', onPointerUp)
      teardownScene()
      audio.destroy()
      app.destroy(true, { children: true })
    }
  }
}
