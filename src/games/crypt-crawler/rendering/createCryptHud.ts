import { Container, Graphics, NineSliceSprite, Text, Texture } from 'pixi.js'

import { getPlayerExperienceToNextLevel } from '../../my-sample-rpg/playerExperience'
import { loadImageTexture } from './loadActorTextures'
import choiceboxUrl from '../assets/hud/choicebox.png'
import lifebarUnderUrl from '../assets/hud/lifebarminiunder.png'
import lifebarProgressUrl from '../assets/hud/lifebarminiprogress.png'

export type CryptHudState = {
  hp: number
  maxHp: number
  level: number
  experience: number
  gold: number
  kills: number
  zoneName: string
  chunks: number
  potions: number
  /** 지금 든 무기. 공격력이 어디서 왔는지 화면에서 보여야 장착이 장착으로 읽힌다. */
  weapon: { name: string, attack: number }
  /** 사거리 안에 F 로 다룰 대상이 있으면 그 안내 문구. 없으면 빈 문자열. */
  interactLabel: string
  /** 보스와 교전 중일 때만 상단 체력바를 띄운다. */
  boss?: { name: string, hp: number, maxHp: number, enraged: boolean }
}

/** 네오둥근모. styles.css 의 @font-face 와 이름이 같아야 한다. */
export const HUD_FONT = 'NeoDunggeunmo'

/** 팩 아트가 1x 라 세계(ZOOM 2)와 픽셀 크기를 맞추려면 2배로 띄운다. */
const UI_SCALE = 2
/** choicebox.png 의 테두리는 사방 5px 이다(실측). */
const PANEL_EDGE = 5
/** 받침 테두리 안쪽 여백 — 화면 px. */
const PANEL_PAD = 4
const INSET = PANEL_EDGE * UI_SCALE + PANEL_PAD

// 팩 팔레트(assets/hud 실측). 크림 받침 위에서는 글자가 어두워야 읽힌다.
const INK = 0x141b1b
const INK_SOFT = 0x965340
const EXP_TRACK = 0x965340
const EXP_FILL = 0xffad5d

const MARGIN = 12
const FONT_SIZE = 16
const LINE = 20
const BAR_WIDTH = 210
const BAR_HEIGHT = 4 * UI_SCALE
const EXP_HEIGHT = 4
const BOSS_BAR_WIDTH = 340

export type HudArt = {
  panel: Texture
  barUnder: Texture
  barFill: Texture
}

/**
 * 팩 UI 아트와 픽셀 폰트를 한 번만 읽는다. HUD 와 지도 오버레이가 같은 것을 나눠 쓴다.
 * 폰트는 **로드가 끝난 뒤에** Text 를 만들어야 한다 — 안 그러면 폴백 글꼴로 굳는다.
 */
export const loadHudArt = async (): Promise<HudArt> => {
  await document.fonts.load(`${FONT_SIZE}px "${HUD_FONT}"`)
  const [panel, barUnder, barFill] = await Promise.all([
    loadImageTexture(choiceboxUrl),
    loadImageTexture(lifebarUnderUrl),
    loadImageTexture(lifebarProgressUrl)
  ])

  return { panel, barUnder, barFill }
}

/** 팩 선택상자를 늘린 받침. 테두리는 아트 그대로 두고 가운데만 늘어난다. */
export const createHudPanel = (texture: Texture): NineSliceSprite => {
  const panel = new NineSliceSprite({
    texture,
    leftWidth: PANEL_EDGE,
    topHeight: PANEL_EDGE,
    rightWidth: PANEL_EDGE,
    bottomHeight: PANEL_EDGE
  })
  panel.scale.set(UI_SCALE)
  return panel
}

/** 받침 배치는 화면 px 로 받고, 9-slice 안쪽 크기로 바꿔 넣는다. */
export const layoutHudPanel = (
  panel: NineSliceSprite,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  panel.position.set(x, y)
  panel.width = width / UI_SCALE
  panel.height = height / UI_SCALE
}

/** 라이프바는 18x4 라 그대로 늘리면 뭉개진다. 양 끝 2px 을 고정하고 가운데만 늘인다. */
const createBar = (texture: Texture): NineSliceSprite => {
  const bar = new NineSliceSprite({
    texture,
    leftWidth: 2,
    topHeight: 1,
    rightWidth: 2,
    bottomHeight: 1,
    height: 4
  })
  bar.scale.set(UI_SCALE)
  return bar
}

const layoutBar = (bar: NineSliceSprite, x: number, y: number, width: number) => {
  bar.position.set(x, y)
  bar.width = width / UI_SCALE
}

/** 화면 고정 HUD. 월드 컨테이너가 아니라 stage 에 직접 붙어 카메라를 따라가지 않는다. */
export const createCryptHud = (
  stage: Container,
  art: HudArt,
  viewWidth: number,
  viewHeight: number
) => {
  const root = new Container()
  stage.addChild(root)

  const label = (x: number, y: number, colour: number) => {
    const text = new Text({
      text: '',
      style: { fontFamily: HUD_FONT, fontSize: FONT_SIZE, fill: colour }
    })
    text.position.set(x, y)
    return text
  }

  // ---- 좌상단 묶음: 체력·경험치·층 이름.
  const statusHeight = INSET * 2 + BAR_HEIGHT + 4 + EXP_HEIGHT + 4 + LINE * 2
  const statusPanel = createHudPanel(art.panel)
  layoutHudPanel(statusPanel, MARGIN, MARGIN, BAR_WIDTH + INSET * 2, statusHeight)

  const contentX = MARGIN + INSET
  const contentY = MARGIN + INSET
  const hpUnder = createBar(art.barUnder)
  layoutBar(hpUnder, contentX, contentY, BAR_WIDTH)
  const hpFill = createBar(art.barFill)

  // 경험치는 체력과 다른 종류의 눈금이다 — 실선 한 줄이 라이프바 두 개보다 덜 시끄럽다.
  const expBar = new Graphics()
  const expY = contentY + BAR_HEIGHT + 4

  const hpText = label(contentX, expY + EXP_HEIGHT + 4, INK)
  const zoneText = label(contentX, expY + EXP_HEIGHT + 4 + LINE, INK_SOFT)

  root.addChild(statusPanel, hpUnder, hpFill, expBar, hpText, zoneText)

  // ---- 하단 정보 줄.
  const footerHeight = INSET * 2 + LINE
  const footerY = viewHeight - footerHeight
  const footerPanel = createHudPanel(art.panel)
  layoutHudPanel(footerPanel, 0, footerY, viewWidth, footerHeight)

  const statsText = label(INSET, footerY + INSET, INK)
  const hintText = label(viewWidth - INSET, footerY + INSET, INK_SOFT)
  hintText.anchor.set(1, 0)
  hintText.text = 'WASD 이동 · Space 공격 · F 줍기/열기 · Q 물약 · M 지도'

  root.addChild(footerPanel, statsText, hintText)

  // ---- 보스 체력바 — 교전 중에만.
  const bossHeight = INSET * 2 + LINE + 2 + BAR_HEIGHT
  const bossPanel = createHudPanel(art.panel)
  layoutHudPanel(
    bossPanel, (viewWidth - (BOSS_BAR_WIDTH + INSET * 2)) / 2, MARGIN,
    BOSS_BAR_WIDTH + INSET * 2, bossHeight
  )
  const bossText = label(viewWidth / 2, MARGIN + INSET, INK)
  bossText.anchor.set(0.5, 0)
  const bossBarY = MARGIN + INSET + LINE + 2
  const bossUnder = createBar(art.barUnder)
  layoutBar(bossUnder, (viewWidth - BOSS_BAR_WIDTH) / 2, bossBarY, BOSS_BAR_WIDTH)
  const bossFill = createBar(art.barFill)

  const boss = new Container()
  boss.visible = false
  boss.addChild(bossPanel, bossUnder, bossFill, bossText)
  root.addChild(boss)

  // ---- 상호작용 안내.
  const promptPanel = createHudPanel(art.panel)
  const promptText = label(0, 0, INK)
  promptText.anchor.set(0.5, 0)
  const prompt = new Container()
  prompt.visible = false
  prompt.addChild(promptPanel, promptText)
  root.addChild(prompt)

  const update = (state: CryptHudState) => {
    const hpRatio = state.maxHp > 0 ? Math.max(0, state.hp / state.maxHp) : 0
    // 최고 레벨에서는 필요 경험치가 0이다 — 바를 비우지 말고 가득 채워 둔다.
    const needed = getPlayerExperienceToNextLevel(state.level)
    const expRatio = needed > 0 ? Math.min(1, state.experience / needed) : 1

    // 9-slice 는 양 끝 2px 이 고정이라 그보다 좁아질 수 없다. 빈 체력은 아예 감춘다.
    hpFill.visible = hpRatio > 0
    layoutBar(hpFill, contentX, contentY, Math.max(4 * UI_SCALE, Math.round(BAR_WIDTH * hpRatio)))

    // 라이프바와 같은 검은 테두리를 둘러야 두 눈금이 한 벌로 보인다.
    expBar.clear()
    expBar.rect(contentX - 1, expY - 1, BAR_WIDTH + 2, EXP_HEIGHT + 2).fill(INK)
    expBar.rect(contentX, expY, BAR_WIDTH, EXP_HEIGHT).fill(EXP_TRACK)
    expBar
      .rect(contentX, expY, Math.round(BAR_WIDTH * expRatio), EXP_HEIGHT)
      .fill(EXP_FILL)

    boss.visible = state.boss !== undefined
    if (state.boss) {
      const ratio = state.boss.maxHp > 0 ? Math.max(0, state.boss.hp / state.boss.maxHp) : 0
      bossFill.visible = ratio > 0
      layoutBar(
        bossFill, (viewWidth - BOSS_BAR_WIDTH) / 2, bossBarY,
        Math.max(4 * UI_SCALE, Math.round(BOSS_BAR_WIDTH * ratio))
      )
      // 격노는 색이 아니라 말로 알린다 — 라이프바 아트는 빨강 한 장뿐이다.
      bossText.text = state.boss.enraged ? `${state.boss.name}  (격노)` : state.boss.name
    }

    prompt.visible = state.interactLabel !== ''
    if (prompt.visible) {
      promptText.text = state.interactLabel
      const width = Math.round(promptText.width) + INSET * 2
      const y = viewHeight - footerHeight - 12 - (INSET * 2 + LINE)
      layoutHudPanel(promptPanel, Math.round((viewWidth - width) / 2), y, width, INSET * 2 + LINE)
      promptText.position.set(Math.round(viewWidth / 2), y + INSET)
    }

    hpText.text = `HP ${Math.ceil(state.hp)} / ${state.maxHp}   Lv ${state.level}`
    zoneText.text = state.zoneName
    statsText.text =
      `${state.weapon.name} +${state.weapon.attack}   금화 ${state.gold}   ` +
      `물약 ${state.potions}   처치 ${state.kills}   청크 ${state.chunks}`
  }

  return { update, root }
}
