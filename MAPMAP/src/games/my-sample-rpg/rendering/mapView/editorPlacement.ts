// 에디터 배치 모드: 마우스로 타일·오브젝트·NPC 배치/지우기, 배치 장식(밤 그늘·전구 빛·테마 색) 렌더.
// 배치 데이터는 맵별 localStorage(placementStore·npcStore). 맵 화면의 상태는 ctx 로 받는다.
import type { ParsedTiledMap } from '../../tiled/parseTiledMap'
import {
  type Application,
  ColorMatrixFilter,
  Container,
  type FederatedPointerEvent,
  Graphics,
  Sprite,
  Text,
  type Texture
} from 'pixi.js'
import { loadTextureSafe } from '../loadTextureSafe'
import { type LpcCharacterSheets } from '../lpcCharacterSprites'
import {
  addPlacement,
  loadPlacementsForMap,
  removePlacement,
  type PlacedItem,
  type PlacementTemplate
} from '../../../../editor/placementStore'
import {
  addNpc,
  loadNpcsForMap,
  removeNpc,
  type NpcWireTemplate
} from '../../../../editor/npcStore'
import { PLAYER_CHARACTER_ID } from '../../characterState'
import type { CharacterState } from '../../characterState'
import { createIdleNpcCharacterController, createNpcCharacter } from '../../lua/luaGameLogic'
import { isWallTileAt } from '../../tiled/createWallTileLookup'
import { doCollisionRectsIntersect, type CollisionRect } from '../characterCollision'
import { type TilesetRenderResources } from '../tiledMapRenderResources'
import { PLAYER_NAME_BADGE_STYLE } from './constants'
import { resolveCharacterTexture } from './tiles'
import { type CreatePixiTiledMapViewInput, type RenderedCharacterNode } from './types'

export type EditorPlacementContext = {
  app: Application
  world: Container
  map: ParsedTiledMap
  sceneId: string
  tilesetResources: Map<string, TilesetRenderResources>
  characterTilesetResources: TilesetRenderResources
  characterSpriteSheet: CreatePixiTiledMapViewInput['characterSpriteSheet']
  controllerRuntime: CreatePixiTiledMapViewInput['controllerRuntime']
  wallTiles: Set<string>
  themeColorTargets: Container[]
  appliedAtlasUrl: string | undefined
  renderedCharacters: Map<string, RenderedCharacterNode>
  interactionLockUntilByCharacterPair: Map<string, number>
  lpcPlaceholderTexture: Texture
  getLpcNpcSheetsFor: (character: CharacterState) => LpcCharacterSheets | undefined
  createLpcCharacterNode: (
    container: Container,
    character: CharacterState,
    npcSheets: LpcCharacterSheets | undefined
  ) => NonNullable<RenderedCharacterNode['lpc']>
  attachCharacterLabelLayer: (characterId: string) => void
  syncCharacterSprite: (character: CharacterState) => void
  getCharacterStateById: (characterId: string) => CharacterState
  getBlockingCollisionRects: (excludedCharacterId: string) => CollisionRect[]
  getDepthSortedLayer: () => Container | undefined
  getCharacterStates: () => CharacterState[]
  setCharacterStates: (value: CharacterState[]) => void
}

export const createEditorPlacement = (ctx: EditorPlacementContext) => {
  const {
    app,
    world,
    map,
    sceneId,
    tilesetResources,
    characterTilesetResources,
    characterSpriteSheet,
    controllerRuntime,
    wallTiles,
    themeColorTargets,
    appliedAtlasUrl,
    renderedCharacters,
    interactionLockUntilByCharacterPair,
    lpcPlaceholderTexture,
    getLpcNpcSheetsFor,
    createLpcCharacterNode,
    attachCharacterLabelLayer,
    syncCharacterSprite,
    getCharacterStateById,
    getBlockingCollisionRects,
    getDepthSortedLayer,
    getCharacterStates,
    setCharacterStates
  } = ctx

  // ── 마우스 에셋 배치(에디터 배치 모드) ──
  // 에디터가 배치 모드+놓을 항목을 postMessage로 켜면, 게임 캔버스 클릭이 그 칸에 배치를 만든다.
  // 배치 데이터는 맵별 localStorage(placementStore)에 저장돼 새로고침·재접속에도 유지된다.
  let placementMode: 'off' | 'place' | 'erase' = 'off'
  // 타일/오브젝트 배치 템플릿 또는 NPC 와이어 템플릿(kind로 구분).
  let placementTemplate: PlacementTemplate | NpcWireTemplate | null = null
  let placementSprites: Sprite[] = []
  const decorationLayer = new Container()
  decorationLayer.label = 'layer:generated-decorations'
  world.addChild(decorationLayer)
  const nightShade = new Graphics()
    .rect(0, 0, map.pixelWidth, map.pixelHeight)
    .fill({ color: 0x07132e, alpha: 0.58 })
  nightShade.label = 'decoration:night-shade'
  nightShade.visible = false
  decorationLayer.addChild(nightShade)
  const bulbLights = new Container()
  bulbLights.label = 'decoration:twinkling-bulbs'
  bulbLights.eventMode = 'none'
  decorationLayer.addChild(bulbLights)
  let decorationRevision = 0
  let lightTime = 0
  let twinkleEnabled = true
  const themeColorFilter = new ColorMatrixFilter()
  const animateDecorationLights = (): void => {
    lightTime += app.ticker.deltaMS / 1000
    bulbLights.children.forEach((light, index) => {
      light.alpha = twinkleEnabled ? 0.65 + 0.25 * Math.sin(lightTime * 2.2 + index * 1.7) : 0.85
    })
  }
  app.ticker.add(animateDecorationLights)

  const addBulbLights = async (item: PlacedItem, sprite: Sprite, revision: number): Promise<void> => {
    if (!item.imageUrl) return
    const image = new Image()
    image.src = item.imageUrl
    try { await image.decode() } catch { return }
    if (revision !== decorationRevision) return
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, image.width, image.height).data
    // Merge nearby warm pixels into one glow per small bulb region.
    const cells = new Map<string, { x: number; y: number; count: number }>()
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const i = (y * image.width + x) * 4
        if (pixels[i + 3] < 180 || pixels[i] < 210 || pixels[i + 1] < 150 || pixels[i + 2] > 105) continue
        const key = `${Math.floor(x / 8)},${Math.floor(y / 8)}`
        const cell = cells.get(key) ?? { x: 0, y: 0, count: 0 }
        cell.x += x; cell.y += y; cell.count++
        cells.set(key, cell)
      }
    }
    for (const cell of cells.values()) {
      if (cell.count < 2) continue
      const light = new Graphics()
        .circle(0, 0, 9).fill({ color: 0xffbe55, alpha: 0.07 })
        .circle(0, 0, 5).fill({ color: 0xffc65a, alpha: 0.16 })
        .circle(0, 0, 1.5).fill({ color: 0xfff0b0, alpha: 0.7 })
      light.position.set(
        sprite.x + (cell.x / cell.count - sprite.anchor.x * image.width) * sprite.scale.x,
        sprite.y + (cell.y / cell.count - sprite.anchor.y * image.height) * sprite.scale.y
      )
      bulbLights.addChild(light)
    }
  }
  // 수기 배치 NPC는 정적 스프라이트가 아니라 게임의 CharacterState로 스폰된다(이동 차단 + 대사).
  // 스폰한 NPC의 id 집합 — 저장소와 비교(reconcile)해 추가/삭제를 반영한다.
  const placedNpcIds = new Set<string>()

  const textureForPlacement = async (
    item: PlacedItem
  ): Promise<Texture | undefined> => {
    if (item.kind === 'tile' && item.tileId !== undefined) {
      // 맵에 타일셋이 하나면 source가 안 맞아도 그걸로 폴백.
      const tileset =
        map.tilesets.find((candidate) => candidate.source === item.tilesetSource) ??
        map.tilesets[0]
      const resources = tileset ? tilesetResources.get(tileset.source) : undefined
      return resources?.tileTextures[item.tileId]
    }
    if (item.kind === 'object' && item.imageUrl) {
      return await loadTextureSafe(item.imageUrl)
    }
    return undefined
  }

  const renderPlacements = async (items: PlacedItem[]): Promise<void> => {
    const revision = ++decorationRevision
    for (const light of bulbLights.removeChildren()) light.destroy()
    const settings = items.find(item => item.visible !== false && item.themeSettings)?.themeSettings
    // Explicit generated settings belong to the current map; only legacy decorations use the town fallback.
    const enabled = Boolean(settings) || (sceneId === 'town' && items.some(item => item.renderLayer === 'decoration' && item.visible !== false))
    nightShade.visible = enabled && (settings ? settings.night > 0 : true)
    nightShade.alpha = settings ? Math.max(0, Math.min(0.8, settings.night)) / 0.58 : 1
    twinkleEnabled = settings?.twinkle ?? true
    bulbLights.visible = enabled
    const gain = settings?.color.gain ?? [1, 1, 1]
    const bias = settings?.color.bias ?? [0, 0, 0]
    themeColorFilter.matrix = [gain[0],0,0,0,bias[0], 0,gain[1],0,0,bias[1], 0,0,gain[2],0,bias[2], 0,0,0,1,0]
    for (const target of themeColorTargets) target.filters = settings ? [themeColorFilter] : []
    for (const sprite of placementSprites) {
      sprite.parent?.removeChild(sprite)
      sprite.destroy()
    }
    placementSprites = []
    const depthSortedLayer = getDepthSortedLayer()
    if (!depthSortedLayer) {
      return
    }
    for (const item of items) {
      if (item.visible === false) {
        continue
      }
      const texture = await textureForPlacement(item)
      if (revision !== decorationRevision) return
      if (!texture) {
        continue
      }
      const sprite = new Sprite(texture)
      const displayScale =
        typeof item.displayScale === 'number' && item.displayScale > 0
          ? item.displayScale
          : 1
      sprite.scale.set(displayScale)
      if (item.anchor === 'bottom-center') {
        sprite.anchor.set(0.5, 1)
        sprite.position.set(
          (item.col + 0.5) * map.tileWidth,
          (item.row + 1) * map.tileHeight
        )
      } else {
        sprite.position.set(item.col * map.tileWidth, item.row * map.tileHeight)
      }
      // 지우기 히트테스트에서 어느 배치인지 역추적하기 위해 배치 id를 표식으로 단다.
      sprite.label = item.id
      // 자기 아래 가장자리 기준 깊이정렬 — 캐릭터/지붕과 같은 규칙으로 자연스럽게 겹친다.
      sprite.zIndex =
        item.anchor === 'bottom-center'
          ? sprite.y + 0.6
          : item.row * map.tileHeight +
            (texture.height || map.tileHeight) * displayScale +
            0.6
      if (item.renderLayer === 'decoration') {
        decorationLayer.addChild(sprite)
        if (enabled && !item.themeSettings) void addBulbLights(item, sprite, revision)
      } else {
        depthSortedLayer.addChild(sprite)
      }
      placementSprites.push(sprite)
    }
    depthSortedLayer.sortChildren()
    decorationLayer.setChildIndex(bulbLights, decorationLayer.children.length - 1)
  }

  const refreshPlacements = (): void => {
    const nextAtlasUrl = loadPlacementsForMap(sceneId).find(item => item.visible !== false && item.themeSettings)?.themeSettings?.tilesetImageUrl
    if (nextAtlasUrl !== appliedAtlasUrl) {
      window.location.reload()
      return
    }
    void renderPlacements(loadPlacementsForMap(sceneId))
  }

  // ── 수기 배치 NPC(에디터 NPC 탭) ──
  // 외형(appearanceType)을 텍스처로 풀어 최소 캐릭터 렌더 노드를 만든다(플레이어/몬스터 부속 없음).
  // 부팅 캐릭터 빌드 루프의 비(非)플레이어·비몬스터 경로만 옮긴 것. renderedCharacters에 등록해야
  // syncCharacterSprite가 매 틱 위치/깊이를 잡는다(엔트리가 없으면 throw).
  const createRenderedNpcNode = (character: CharacterState): void => {
    const depthSortedLayer = getDepthSortedLayer()
    if (!depthSortedLayer) {
      return
    }
    const resolved = resolveCharacterTexture(
      character.appearanceType,
      characterTilesetResources.tileTextures,
      characterSpriteSheet.tileset,
      map.tilesets,
      tilesetResources,
      map.tileWidth
    )
    const container = new Container()
    container.label = `character:${character.id}:container`
    container.sortableChildren = true
    // 에디터로 놓은 NPC 도 LPC 시트가 있으면(이번 씬에서 이미 불러 둔 외형) 같은 그림체로.
    const npcSheets = getLpcNpcSheetsFor(character)
    const sprite = new Sprite(npcSheets ? lpcPlaceholderTexture : resolved.texture)
    sprite.label = `character:${character.id}`
    sprite.scale.set(npcSheets ? 1 : resolved.renderScale)
    sprite.roundPixels = true
    sprite.zIndex = 10
    container.addChild(sprite)
    const lpcNode = npcSheets ? createLpcCharacterNode(container, character, npcSheets) : undefined
    const displayLabel =
      character.displayText === undefined
        ? undefined
        : new Text({ style: PLAYER_NAME_BADGE_STYLE, text: character.displayText })
    if (displayLabel) {
      displayLabel.label = `character:${character.id}:display-label`
      displayLabel.roundPixels = true
      displayLabel.zIndex = 16
      container.addChild(displayLabel)
    }
    renderedCharacters.set(character.id, {
      container,
      sprite,
      renderScale: npcSheets ? 1 : resolved.renderScale,
      lpc: lpcNode,
      displayLabel
    })
    depthSortedLayer.addChild(container)
    attachCharacterLabelLayer(character.id)
  }

  const despawnPlacedNpc = (id: string): void => {
    const renderNode = renderedCharacters.get(id)
    if (renderNode) {
      renderNode.container.parent?.removeChild(renderNode.container)
      renderNode.container.destroy({ children: true })
      renderNode.labelContainer?.removeFromParent()
      renderNode.labelContainer?.destroy({ children: true })
      renderedCharacters.delete(id)
    }
    setCharacterStates(getCharacterStates().filter((character) => character.id !== id))
    placedNpcIds.delete(id)
    // 이 NPC를 대상으로 한 상호작용 잠금 항목 정리 — 같은 id는 다시 안 생기므로 죽은 항목(장기 세션 누수 방지).
    for (const lockKey of [...interactionLockUntilByCharacterPair.keys()]) {
      if (lockKey.endsWith(`:${id}`) || lockKey.endsWith(`:${id}:quest`)) {
        interactionLockUntilByCharacterPair.delete(lockKey)
      }
    }
  }

  // 저장소(npcStore)의 NPC 목록과 현재 스폰 상태를 맞춘다 — 새 항목은 스폰, 사라진 항목은 디스폰.
  // 반복 호출(부팅·storage·클릭)해도 같은 id를 두 번 스폰하지 않도록 placedNpcIds로 가드한다.
  const refreshNpcs = (): void => {
    const stored = loadNpcsForMap(sceneId)
    const storedById = new Map(stored.map((npc) => [npc.id, npc] as const))
    let changed = false

    for (const id of [...placedNpcIds]) {
      if (!storedById.has(id)) {
        despawnPlacedNpc(id)
        changed = true
      }
    }

    for (const npc of stored) {
      if (placedNpcIds.has(npc.id)) {
        continue
      }
      const character = createNpcCharacter({
        id: npc.id,
        appearanceType: npc.appearanceType,
        position: { x: npc.col, y: npc.row },
        collisionSize: { width: 1, height: 1 },
        displayText: npc.name,
        controller: createIdleNpcCharacterController({
          dialogueLines: npc.dialogueLines
        })
      })
      try {
        // 외형이 캐릭터 시트에 없으면 resolveCharacterTexture가 throw — 그 NPC만 건너뛴다.
        createRenderedNpcNode(character)
      } catch (error) {
        console.warn(`[npc] 외형을 해석하지 못해 건너뜀: ${npc.appearanceType}`, error)
        continue
      }
      setCharacterStates([...getCharacterStates(), character])
      placedNpcIds.add(npc.id)
      syncCharacterSprite(character)
      changed = true
    }

    if (changed) {
      // 컨트롤러 부착(대사 NPC 상호작용 활성)·충돌 반영을 즉시 갱신.
      controllerRuntime.syncCharacters(getCharacterStates())
    }
  }

  // 한 칸이 NPC를 놓기에 적합한지: 맵 안 + 벽 아님 + 다른 캐릭터(플레이어/NPC/몬스터)와 안 겹침.
  const isNpcSpawnableTile = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
      return false
    }
    if (isWallTileAt(wallTiles, x, y)) {
      return false
    }
    const rect: CollisionRect = { x, y, width: 1, height: 1 }
    return !getBlockingCollisionRects('').some((blocker) =>
      doCollisionRectsIntersect(rect, blocker)
    )
  }

  // 플레이어를 중심으로 바깥쪽 링부터 훑어 가장 가까운 빈 칸을 찾는다(자기 칸은 제외).
  const findSpawnTileNearPlayer = (player: {
    x: number
    y: number
  }): { x: number; y: number } | undefined => {
    const px = Math.round(player.x)
    const py = Math.round(player.y)
    for (let radius = 1; radius <= 8; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          // 현재 반지름의 테두리 칸만(안쪽은 이전 반지름에서 이미 검사됨).
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) {
            continue
          }
          const x = px + dx
          const y = py + dy
          if (isNpcSpawnableTile(x, y)) {
            return { x, y }
          }
        }
      }
    }
    return undefined
  }

  // 에디터 생성 NPC를 플레이어 옆 빈 칸에 스폰한다(npcStore에 저장 후 refreshNpcs가 CharacterState로
  // 만든다 — 수기 배치 NPC와 같은 경로). 외형이 시트에 없으면 refreshNpcs의 try/catch가 스킵한다.
  const spawnNpcNearPlayer = (template: {
    appearanceType: string
    name?: string
    dialogueLines?: string[]
  }): boolean => {
    const player = getCharacterStateById(PLAYER_CHARACTER_ID)
    if (!player) {
      return false
    }
    const spot = findSpawnTileNearPlayer(player.position)
    if (!spot) {
      console.warn('[npc] 플레이어 주변에 빈 칸이 없어 NPC를 스폰하지 못했습니다.')
      return false
    }
    addNpc(
      sceneId,
      {
        appearanceType: template.appearanceType,
        name: template.name,
        dialogueLines: template.dialogueLines
      },
      spot.x,
      spot.y
    )
    refreshNpcs()
    return true
  }

  // 배치 NPC를 클릭 지점(스프라이트 픽셀 영역)으로 맞혀 지운다. 맞으면 true(이후 배치 지우기 생략).
  const eraseNpcAtPoint = (x: number, y: number): boolean => {
    for (const id of [...placedNpcIds].reverse()) {
      const renderNode = renderedCharacters.get(id)
      if (!renderNode) {
        continue
      }
      const left = renderNode.container.x
      const top = renderNode.container.y
      if (
        x >= left &&
        x < left + renderNode.sprite.width &&
        y >= top &&
        y < top + renderNode.sprite.height
      ) {
        removeNpc(sceneId, id)
        refreshNpcs()
        return true
      }
    }
    return false
  }

  app.stage.eventMode = 'static'
  app.stage.hitArea = app.screen
  const eraseAtPoint = (x: number, y: number): void => {
    // 칸 앵커가 아니라 스프라이트의 실제 픽셀 영역으로 맞힌다. 오브젝트는 여러 칸을 덮으므로
    // 가운데/아래를 클릭해도 지워진다(타일은 1칸이라 그대로 동작). 위(나중에 그린)것부터 검사.
    for (let i = placementSprites.length - 1; i >= 0; i -= 1) {
      const sprite = placementSprites[i]
      const left = sprite.x
      const top = sprite.y
      if (x >= left && x < left + sprite.width && y >= top && y < top + sprite.height) {
        const id = typeof sprite.label === 'string' ? sprite.label : ''
        if (id) {
          removePlacement(sceneId, id)
          refreshPlacements()
        }
        return
      }
    }
  }
  const handleStagePointerDown = (event: FederatedPointerEvent): void => {
    if (placementMode === 'off') {
      return
    }
    const local = world.toLocal(event.global) // 카메라 줌/스크롤이 반영된 맵 픽셀 좌표.
    const col = Math.floor(local.x / map.tileWidth)
    const row = Math.floor(local.y / map.tileHeight)
    if (col < 0 || col >= map.width || row < 0 || row >= map.height) {
      return
    }
    // 우클릭(button 2)은 모드와 무관하게 클릭 지점의 배치를 지운다(배치 중에도 바로 삭제).
    // NPC를 먼저 맞혀보고(기능 엔티티), 없으면 타일/오브젝트 배치를 지운다.
    if (event.button === 2) {
      if (eraseNpcAtPoint(local.x, local.y)) {
        return
      }
      eraseAtPoint(local.x, local.y)
      return
    }
    if (placementMode === 'place' && placementTemplate) {
      if (placementTemplate.kind === 'npc') {
        // 이동 차단 캐릭터(플레이어/다른 NPC/몬스터)와 겹치는 칸에 차단 NPC를 놓으면 서로 갇혀
        // 빠져나올 수 없으므로 막는다(특히 플레이어 자기 칸에 놓으면 소프트락).
        const targetRect: CollisionRect = { x: col, y: row, width: 1, height: 1 }
        const overlapsBlocker = getBlockingCollisionRects('').some((rect) =>
          doCollisionRectsIntersect(targetRect, rect)
        )
        if (overlapsBlocker) {
          console.warn('[npc] 다른 캐릭터(플레이어 포함)와 겹치는 칸에는 NPC를 놓을 수 없습니다.')
          return
        }
        // NPC는 기능 엔티티 — 저장 후 게임의 CharacterState로 스폰한다(저장소엔 NpcTemplate 필드만).
        addNpc(
          sceneId,
          {
            appearanceType: placementTemplate.appearanceType,
            name: placementTemplate.name,
            dialogueLines: placementTemplate.dialogueLines
          },
          col,
          row
        )
        refreshNpcs()
      } else {
        addPlacement(sceneId, placementTemplate, col, row)
        refreshPlacements()
      }
    } else if (placementMode === 'erase') {
      if (eraseNpcAtPoint(local.x, local.y)) {
        return
      }
      eraseAtPoint(local.x, local.y)
    }
  }
  app.stage.on('pointerdown', handleStagePointerDown)
  // 배치 모드에서 우클릭 시 브라우저 컨텍스트 메뉴를 막아 '우클릭 삭제'가 정상 동작하게 한다.
  const handleCanvasContextMenu = (event: MouseEvent): void => {
    if (placementMode !== 'off') {
      event.preventDefault()
    }
  }
  app.canvas.addEventListener('contextmenu', handleCanvasContextMenu)


  const destroy = () => {
    app.stage.off('pointerdown', handleStagePointerDown)
    app.canvas.removeEventListener('contextmenu', handleCanvasContextMenu)
    app.ticker.remove(animateDecorationLights)
    decorationRevision++
  }

  return {
    refreshPlacements,
    refreshNpcs,
    spawnNpcNearPlayer,
    setPlacementMode: (mode: 'off' | 'place' | 'erase') => {
      placementMode = mode
    },
    setPlacementTemplate: (
      template: PlacementTemplate | NpcWireTemplate | null
    ) => {
      placementTemplate = template
    },
    destroy
  }
}
