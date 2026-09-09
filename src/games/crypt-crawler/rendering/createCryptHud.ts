import { Container, Graphics, Text } from 'pixi.js'

import { getPlayerExperienceToNextLevel } from '../../my-sample-rpg/playerExperience'

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

const BAR_WIDTH = 210
const BAR_HEIGHT = 12
const PAD = 14

/** 화면 고정 HUD. 월드 컨테이너가 아니라 stage 에 직접 붙어 카메라를 따라가지 않는다. */
export const createCryptHud = (stage: Container, viewWidth: number, viewHeight: number) => {
  const root = new Container()
  stage.addChild(root)

  const panel = new Graphics()
  root.addChild(panel)

  const label = (x: number, y: number, size: number, colour: number) => {
    const text = new Text({
      text: '',
      style: { fontFamily: 'monospace', fontSize: size, fill: colour }
    })
    text.position.set(x, y)
    root.addChild(text)
    return text
  }

  const hpText = label(PAD, PAD + BAR_HEIGHT + 4, 12, 0xf2e9e4)
  const zoneText = label(PAD, PAD + BAR_HEIGHT + 22, 13, 0xc9b6d8)
  const statsText = label(PAD, viewHeight - PAD - 16, 12, 0xf2e9e4)
  const hintText = label(viewWidth - 360, viewHeight - PAD - 16, 11, 0x8a7f96)
  hintText.text = 'WASD 이동 · Space 공격 · F 줍기/열기 · Q 물약 · M 지도'

  const bossPanel = new Graphics()
  root.addChild(bossPanel)
  const bossText = label(0, 0, 12, 0xf2e9e4)
  bossText.anchor.set(0.5, 1)
  // 안내는 밝은 바닥 위에서도 읽혀야 한다 — 받침 없이 금색 글씨만 두면 묻힌다.
  const promptPanel = new Graphics()
  root.addChild(promptPanel)
  const promptText = label(0, 0, 12, 0xffd166)
  promptText.anchor.set(0.5, 0.5)

  const update = (state: CryptHudState) => {
    const hpRatio = state.maxHp > 0 ? Math.max(0, state.hp / state.maxHp) : 0
    // 최고 레벨에서는 필요 경험치가 0이다 — 바를 비우지 말고 가득 채워 둔다.
    const needed = getPlayerExperienceToNextLevel(state.level)
    const expRatio = needed > 0 ? Math.min(1, state.experience / needed) : 1

    panel.clear()
    // 하단 정보 줄 받침 — 밝은 바닥 위에서 글자가 묻히지 않게.
    panel.rect(0, viewHeight - 34, viewWidth, 34).fill({ color: 0x141118, alpha: 0.7 })
    // 체력
    // 좌상단 묶음 받침 — 체력바·HP 숫자·층 이름을 함께 덮는다. 이것만 없어서 1·3·5층의
    // 밝은 바닥에서 글자가 묻혔다(나머지 HUD 는 전부 받침이 깔려 있다).
    panel
      .roundRect(PAD - 8, PAD - 6, BAR_WIDTH + 16, BAR_HEIGHT + 46, 5)
      .fill({ color: 0x141118, alpha: 0.72 })
    panel.rect(PAD, PAD, BAR_WIDTH, BAR_HEIGHT).fill({ color: 0x2a2431, alpha: 0.85 })
    panel.rect(PAD, PAD, BAR_WIDTH * hpRatio, BAR_HEIGHT).fill({ color: 0xd7263d })
    // 경험치 — 체력 바 바로 아래 얇게
    panel.rect(PAD, PAD + BAR_HEIGHT + 1, BAR_WIDTH, 3).fill({ color: 0x2a2431, alpha: 0.85 })
    panel.rect(PAD, PAD + BAR_HEIGHT + 1, BAR_WIDTH * expRatio, 3).fill({ color: 0x6ab7ff })

    // 보스 체력바 — 교전 중에만.
    bossPanel.clear()
    if (state.boss) {
      const width = 340
      const x = (viewWidth - width) / 2
      const ratio = state.boss.maxHp > 0 ? Math.max(0, state.boss.hp / state.boss.maxHp) : 0
      // 이름까지 덮는 받침 — 밝은 바닥 위에서도 읽혀야 한다.
      bossPanel
        .roundRect(x - 10, 12, width + 20, 40, 5)
        .fill({ color: 0x141118, alpha: 0.82 })
      bossPanel.rect(x, 36, width, 10).fill({ color: 0x2a2431 })
      bossPanel
        .rect(x, 36, width * ratio, 10)
        .fill({ color: state.boss.enraged ? 0xff6b3d : 0xd7263d })
      bossText.text = state.boss.enraged ? `${state.boss.name}  (격노)` : state.boss.name
      bossText.position.set(viewWidth / 2, 33)
      bossText.visible = true
    } else {
      bossText.visible = false
    }

    promptPanel.clear()
    promptText.visible = state.interactLabel !== ''
    if (promptText.visible) {
      promptText.text = state.interactLabel
      const promptY = viewHeight - 72
      promptText.position.set(viewWidth / 2, promptY)
      const boxWidth = promptText.width + 20
      promptPanel
        .roundRect(viewWidth / 2 - boxWidth / 2, promptY - 12, boxWidth, 24, 4)
        .fill({ color: 0x1a1620, alpha: 0.86 })
    }

    hpText.text = `HP ${Math.ceil(state.hp)} / ${state.maxHp}   Lv ${state.level}`
    zoneText.text = state.zoneName
    statsText.text =
      `${state.weapon.name} +${state.weapon.attack}   금화 ${state.gold}   ` +
      `물약 ${state.potions}   처치 ${state.kills}   청크 ${state.chunks}`
  }

  return { update, root }
}
