import { describe, expect, it } from 'vitest'

import {
  createInitialPlayerProfile,
  PLAYER_MAX_LEVEL,
  getPlayerJobPrimaryStatId,
  getPlayerJobPrimaryStatLabel,
  getPlayerJobDisplayName,
  isPlayerJobPromotionAvailable
} from './playerProfile'

describe('createInitialPlayerProfile', () => {
  it('creates the default player HUD profile', () => {
    expect(createInitialPlayerProfile()).toEqual({
      name: 'zl존 준수',
      job: '초보자',
      level: 1,
      experience: {
        current: 0
      },
      statPoints: 0,
      availableSkillPoints: 0,
      totalSkillPointsEarned: 0,
      hp: {
        current: 24,
        max: 24
      },
      mp: {
        current: 12,
        max: 12
      },
      stats: {
        strength: 5,
        agility: 4,
        intelligence: 3,
        luck: 2
      },
      skills: [
        {
          hotkey: '1',
          label: '베기',
          description: '재빠른 근거리 공격',
          level: 0,
          maxLevel: 5
        },
        {
          hotkey: '2',
          label: '방어 자세',
          description: '들어오는 피해를 막아냅니다',
          level: 0,
          maxLevel: 5
        },
        {
          hotkey: '3',
          label: '돌진',
          description: '짧게 빠르게 이동합니다',
          level: 0,
          maxLevel: 5
        },
        {
          hotkey: '4',
          label: '집중',
          description: '마나를 조금 회복합니다',
          level: 0,
          maxLevel: 5
        },
        {
          hotkey: '5',
          label: '아이스 볼트',
          description: '적을 얼리는 얼음 화살',
          level: 0,
          maxLevel: 5
        },
        {
          hotkey: '6',
          label: '파이어볼',
          description: '터지며 불태우는 불덩이',
          level: 0,
          maxLevel: 5
        },
        {
          hotkey: '7',
          label: '체인 라이트닝',
          description: '적들 사이를 튀는 번개',
          level: 0,
          maxLevel: 5
        },
        {
          hotkey: '8',
          label: '멀티샷',
          description: '여러 적에게 동시에 화살',
          level: 0,
          maxLevel: 5
        },
        {
          hotkey: '9',
          label: '관통 화살',
          description: '적들을 꿰뚫는 화살',
          level: 0,
          maxLevel: 5
        },
        {
          hotkey: '0',
          label: '독화살',
          description: '맞은 적을 중독',
          level: 0,
          maxLevel: 5
        }
      ]
    })
  })

  it('keeps the level cap at 100', () => {
    expect(PLAYER_MAX_LEVEL).toBe(100)
  })

  it('keeps the job name without a promotion hint (no fixed classes)', () => {
    expect(
      getPlayerJobDisplayName({
        job: '초보자',
        level: 9
      })
    ).toBe('초보자')
    expect(
      getPlayerJobDisplayName({
        job: '초보자',
        level: 10
      })
    ).toBe('초보자')
    expect(
      isPlayerJobPromotionAvailable({
        level: 10
      })
    ).toBe(true)
  })

  it('maps future jobs to a primary stat', () => {
    expect(getPlayerJobPrimaryStatId('전사')).toBe('strength')
    expect(getPlayerJobPrimaryStatLabel('전사')).toBe('힘')
    expect(getPlayerJobPrimaryStatId('궁수')).toBe('agility')
    expect(getPlayerJobPrimaryStatId('마법사')).toBe('intelligence')
    expect(getPlayerJobPrimaryStatId('도적')).toBe('luck')
    expect(getPlayerJobPrimaryStatId('초보자')).toBeUndefined()
  })
})
