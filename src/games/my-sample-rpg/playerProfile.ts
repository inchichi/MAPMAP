export type PlayerStatBlock = {
  strength: number
  agility: number
  intelligence: number
  luck: number
}

export type PlayerStatId = keyof PlayerStatBlock

export type PlayerResource = {
  current: number
  max: number
}

export type PlayerExperience = {
  current: number
}

export type PlayerSkillSlot = {
  hotkey: string
  label: string
  description: string
  level: number
  maxLevel: number
}

export type PlayerProfile = {
  name: string
  job: string
  level: number
  experience: PlayerExperience
  statPoints: number
  availableSkillPoints: number
  totalSkillPointsEarned: number
  hp: PlayerResource
  mp: PlayerResource
  stats: PlayerStatBlock
  skills: PlayerSkillSlot[]
}

export const PLAYER_JOB_PROMOTION_LEVEL = 10
export const PLAYER_MAX_LEVEL = 100
export const PLAYER_STARTING_JOB = '초보자'

const PLAYER_JOB_PRIMARY_STAT_ID_BY_NAME: Record<string, PlayerStatId> = {
  전사: 'strength',
  궁수: 'agility',
  마법사: 'intelligence',
  도적: 'luck'
}

const PLAYER_STAT_LABEL_BY_ID: Record<PlayerStatId, string> = {
  strength: '힘',
  agility: '민첩',
  intelligence: '지력',
  luck: '행운'
}

export const createInitialPlayerProfile = (): PlayerProfile => ({
  name: 'zl존 준수',
  job: PLAYER_STARTING_JOB,
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

// 직업 고정이 없는 게임이라(무기가 싸우는 법을 정한다) 레벨이 올라도 '전직 가능'을 붙이지 않는다.
export const getPlayerJobDisplayName = ({
  job
}: Pick<PlayerProfile, 'job' | 'level'>): string => job

export const isPlayerJobPromotionAvailable = ({
  level
}: Pick<PlayerProfile, 'level'>): boolean =>
  level >= PLAYER_JOB_PROMOTION_LEVEL

export const isPlayerAtMaxLevel = ({
  level
}: Pick<PlayerProfile, 'level'>): boolean => level >= PLAYER_MAX_LEVEL

export const getPlayerJobPrimaryStatId = (
  job: string
): PlayerStatId | undefined => PLAYER_JOB_PRIMARY_STAT_ID_BY_NAME[job]

export const getPlayerJobPrimaryStatLabel = (
  job: string
): string | undefined => {
  const primaryStatId = getPlayerJobPrimaryStatId(job)

  return primaryStatId ? PLAYER_STAT_LABEL_BY_ID[primaryStatId] : undefined
}
