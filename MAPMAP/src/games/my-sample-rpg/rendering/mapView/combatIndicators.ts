// 전투 표시: 플레이어가 지금 싸우는 몬스터 머리 위의 금색 화살표(타겟)와,
// 플레이어를 쫓는(어그로) 몬스터 머리 위의 빨간 '!'. 공격 동작·이펙트와는 상관없는 UI 표시다.
// 타겟은 combat.ts 가 플레이어 공격으로 피해를 줄 때·마법이 대상을 고를 때 markTarget 으로 알려 주고,
// 어그로는 몬스터 행동 상태(monsterPigBehaviorStates.isAggroed)를 매 프레임 읽는다.
// 그림은 작은 픽셀 캔버스로 한 번 만들어 2배로 늘린다. 스프라이트는 메시지 레이어(캐릭터 위)에 두고 씬과 함께 사라진다.
import { Container, Sprite, Texture } from 'pixi.js'

type CombatIndicatorsContext = {
  layer: Container
  // 몬스터 이름표 위 가운데(맵 픽셀). 몬스터가 없거나 쓰러졌으면 undefined.
  getMonsterHeadAnchor: (monsterId: string) => { x: number; y: number } | undefined
  getAggroedMonsterIds: () => Iterable<string>
  getPlayerCenter: () => { x: number; y: number }
  isPlayerAlive: () => boolean
}

const PIXEL_SCALE = 2
// 타겟 화살표는 한눈에 보이게 조금 더 크게
const TARGET_ARROW_SCALE = 3
// 마지막으로 친 뒤 이만큼 지나거나, 이만큼 멀어지면 타겟 표시를 끈다.
const TARGET_TIMEOUT_MILLISECONDS = 5000
const TARGET_MAX_DISTANCE_PIXELS = 12 * 32
const AGGRO_POP_MILLISECONDS = 220

const createPixelTexture = (rows: readonly string[], palette: Record<string, string>): Texture => {
  const canvas = document.createElement('canvas')
  canvas.width = rows[0].length
  canvas.height = rows.length
  const context = canvas.getContext('2d')

  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const color = palette[row[x]]

      if (context && color) {
        context.fillStyle = color
        context.fillRect(x, y, 1, 1)
      }
    }
  })

  const texture = Texture.from(canvas)
  texture.source.scaleMode = 'nearest'
  return texture
}

// 아래를 가리키는 금색 화살표(진갈 외곽선)
const TARGET_ARROW_ROWS = [
  'ooooooooo',
  'oyyyyyyyo',
  'oyYYYYYyo',
  '.oyYYYyo.',
  '..oyYyo..',
  '...oyo...',
  '....o....'
]
// 빨간 느낌표(진한 외곽선 + 흰 테두리로 어느 바닥에서도 보이게)
const AGGRO_MARK_ROWS = [
  '.www.',
  'wkkkw',
  'wkrkw',
  'wkrkw',
  'wkrkw',
  'wkrkw',
  'wkkkw',
  '.wkw.',
  'wkkkw',
  'wkrkw',
  'wkkkw',
  '.www.'
]

let textures: { arrow: Texture; aggro: Texture } | undefined

const getTextures = () => {
  textures ??= {
    arrow: createPixelTexture(TARGET_ARROW_ROWS, { o: '#4a3218', y: '#f2b632', Y: '#ffe48a' }),
    aggro: createPixelTexture(AGGRO_MARK_ROWS, { w: '#ffffff', k: '#5a1010', r: '#e8382c' })
  }
  return textures
}

export type CombatIndicators = {
  markTarget: (monsterId: string, now: number) => void
  update: (now: number) => void
  clear: () => void
}

export const createCombatIndicators = ({
  layer,
  getMonsterHeadAnchor,
  getAggroedMonsterIds,
  getPlayerCenter,
  isPlayerAlive
}: CombatIndicatorsContext): CombatIndicators => {
  const { arrow, aggro } = getTextures()
  const targetSprite = new Sprite(arrow)
  const aggroSprites = new Map<string, { sprite: Sprite; startedAt: number }>()
  let targetId: string | undefined
  let lastTargetedAt = 0

  targetSprite.label = 'combat:target-arrow'
  targetSprite.anchor.set(0.5, 1)
  targetSprite.scale.set(TARGET_ARROW_SCALE)
  targetSprite.visible = false
  layer.addChild(targetSprite)

  const markTarget = (monsterId: string, now: number) => {
    targetId = monsterId
    lastTargetedAt = now
  }

  const clearTarget = () => {
    targetId = undefined
    targetSprite.visible = false
  }

  const update = (now: number) => {
    if (!isPlayerAlive()) {
      clear()
      return
    }

    // 타겟 화살표 — 위아래로 살짝 흔들린다.
    const targetAnchor = targetId ? getMonsterHeadAnchor(targetId) : undefined
    const player = getPlayerCenter()

    if (
      !targetAnchor ||
      now - lastTargetedAt > TARGET_TIMEOUT_MILLISECONDS ||
      Math.hypot(targetAnchor.x - player.x, targetAnchor.y - player.y) > TARGET_MAX_DISTANCE_PIXELS
    ) {
      clearTarget()
    } else {
      targetSprite.visible = true
      targetSprite.position.set(
        Math.round(targetAnchor.x),
        Math.round(targetAnchor.y - 2 + Math.sin(now / 160) * 2)
      )
    }

    // 어그로 '!' — 쫓기 시작할 때 크게 튀어나왔다가 줄어든다. 타겟 화살표가 있으면 그 왼쪽에 선다.
    const aggroedIds = new Set(getAggroedMonsterIds())

    for (const [monsterId, entry] of aggroSprites) {
      if (!aggroedIds.has(monsterId) || !getMonsterHeadAnchor(monsterId)) {
        entry.sprite.destroy()
        aggroSprites.delete(monsterId)
      }
    }

    for (const monsterId of aggroedIds) {
      const anchor = getMonsterHeadAnchor(monsterId)

      if (!anchor) {
        continue
      }

      let entry = aggroSprites.get(monsterId)

      if (!entry) {
        const sprite = new Sprite(aggro)
        sprite.label = `combat:aggro:${monsterId}`
        sprite.anchor.set(0.5, 1)
        layer.addChild(sprite)
        entry = { sprite, startedAt: now }
        aggroSprites.set(monsterId, entry)
      }

      const popProgress = Math.min(1, (now - entry.startedAt) / AGGRO_POP_MILLISECONDS)
      const isTargetToo = monsterId === targetId && targetSprite.visible
      entry.sprite.scale.set(PIXEL_SCALE * (1.6 - 0.6 * popProgress))
      entry.sprite.position.set(Math.round(anchor.x + (isTargetToo ? -22 : 0)), Math.round(anchor.y - 2))
    }
  }

  const clear = () => {
    clearTarget()

    for (const entry of aggroSprites.values()) {
      entry.sprite.destroy()
    }

    aggroSprites.clear()
  }

  return { markTarget, update, clear }
}
