// 무기 계열 스킬이 함께 쓰는 짧은 그래픽 효과(퍼지는 고리, 빛줄기, 휘두른 궤적, 떨어지는 공격).
// 효과마다 진행률(0~1)로 매 프레임 다시 그리고, 끝나면 지운다. 사망·씬 이동 때 clear 로 모두 지운다.
import { Container, Graphics } from 'pixi.js'
import type { Point } from './weaponSkill'

type ActiveEffect = {
  graphics: Graphics
  startedAt: number
  durationMilliseconds: number
  draw: (graphics: Graphics, progress: number) => void
}

export type WeaponSkillEffects = ReturnType<typeof createWeaponSkillEffects>

export const createWeaponSkillEffects = (ctx: {
  getDepthSortedLayer: () => Container | undefined
  tileHeight: number
}) => {
  const activeEffects: ActiveEffect[] = []

  const add = (
    depthY: number,
    now: number,
    durationMilliseconds: number,
    draw: (graphics: Graphics, progress: number) => void
  ) => {
    const graphics = new Graphics()
    graphics.zIndex = depthY + ctx.tileHeight * 2
    ctx.getDepthSortedLayer()?.addChild(graphics)
    activeEffects.push({ graphics, startedAt: now, durationMilliseconds, draw })
    draw(graphics, 0)
  }

  // 바닥에 납작하게 퍼지는 고리(충격파, 착탄)
  const ring = (center: Point, radiusPixels: number, color: number, durationMilliseconds: number, now: number) =>
    add(center.y, now, durationMilliseconds, (graphics, progress) => {
      const radius = radiusPixels * (0.25 + 0.75 * progress)
      const alpha = 1 - progress
      graphics.clear()
      graphics.ellipse(center.x, center.y, radius, radius * 0.6).fill({ color, alpha: 0.18 * alpha })
      graphics.ellipse(center.x, center.y, radius, radius * 0.6).stroke({ color, width: 3, alpha })
    })

  // 곧게 뻗는 빛줄기(찌르기, 화살, 순간이동 궤적)
  const streak = (from: Point, to: Point, color: number, widthPixels: number, durationMilliseconds: number, now: number) =>
    add(Math.max(from.y, to.y), now, durationMilliseconds, (graphics, progress) => {
      const alpha = 1 - progress
      graphics.clear()
      graphics.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ color, width: widthPixels + 3, alpha: 0.35 * alpha })
      graphics.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ color: 0xffffff, width: Math.max(1, widthPixels / 2), alpha })
    })

  // 휘두른 궤적: startAngle 에서 endAngle 까지 그려지며 사라진다(라디안, 화면 좌표)
  const arc = (
    center: Point,
    radiusPixels: number,
    startAngle: number,
    endAngle: number,
    color: number,
    durationMilliseconds: number,
    now: number
  ) =>
    add(center.y, now, durationMilliseconds, (graphics, progress) => {
      const sweepProgress = Math.min(1, progress * 2)
      const alpha = progress < 0.5 ? 1 : 2 - progress * 2
      graphics.clear()
      graphics
        .arc(center.x, center.y, radiusPixels, startAngle, startAngle + (endAngle - startAngle) * sweepProgress)
        .stroke({ color, width: 6, alpha: 0.4 * alpha })
      graphics
        .arc(center.x, center.y, radiusPixels, startAngle, startAngle + (endAngle - startAngle) * sweepProgress)
        .stroke({ color: 0xffffff, width: 2, alpha })
    })

  // 위에서 떨어지는 공격(운석, 화살비, 벼락): 떨어지는 동안 그림자가 커지고 닿으면 사라진다
  const fall = (target: Point, sizePixels: number, color: number, durationMilliseconds: number, now: number) =>
    add(target.y, now, durationMilliseconds, (graphics, progress) => {
      const height = sizePixels * 6 * (1 - progress)
      graphics.clear()
      graphics.ellipse(target.x, target.y, sizePixels * progress, sizePixels * 0.5 * progress).fill({ color: 0x000000, alpha: 0.25 })
      graphics.circle(target.x, target.y - height, sizePixels * 0.45).fill({ color, alpha: 0.9 })
      graphics
        .moveTo(target.x, target.y - height - sizePixels * 2)
        .lineTo(target.x, target.y - height)
        .stroke({ color, width: sizePixels * 0.3, alpha: 0.5 })
    })

  const update = (now: number) => {
    for (let index = activeEffects.length - 1; index >= 0; index -= 1) {
      const effect = activeEffects[index]
      const progress = (now - effect.startedAt) / effect.durationMilliseconds

      if (progress >= 1) {
        effect.graphics.removeFromParent()
        effect.graphics.destroy()
        activeEffects.splice(index, 1)
        continue
      }

      effect.draw(effect.graphics, Math.max(0, progress))
    }
  }

  const clear = () => {
    for (const effect of activeEffects) {
      effect.graphics.removeFromParent()
      effect.graphics.destroy()
    }
    activeEffects.length = 0
  }

  return { ring, streak, arc, fall, update, clear }
}
