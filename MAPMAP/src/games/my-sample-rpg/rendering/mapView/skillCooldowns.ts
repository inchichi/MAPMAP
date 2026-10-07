// 스킬 쿨타임 기록: 스킬마다 쿨타임을 시작하는 곳(playerActions·playerCombatEffects·playerWeaponSkills)이
// 시작 시각과 길이를 여기 남기고, 하단 HUD 스킬 칸이 남은 시간을 읽어 어둡게 덮고 초를 띄운다.
// 쿨타임 판정 자체는 각 모듈의 준비 시각이 맡는다 — 여기는 보여 주기 위한 기록만 한다.

export type SkillCooldownView = {
  remainingMilliseconds: number
  // 0(막 시작) ~ 1(끝)
  progress: number
}

type SkillCooldownEntry = {
  startedAtMilliseconds: number
  durationMilliseconds: number
}

export const getSkillCooldownView = (
  entry: SkillCooldownEntry | undefined,
  now: number
): SkillCooldownView | undefined => {
  if (!entry || entry.durationMilliseconds <= 0) {
    return undefined
  }

  const elapsed = now - entry.startedAtMilliseconds

  if (elapsed >= entry.durationMilliseconds) {
    return undefined
  }

  return {
    remainingMilliseconds: entry.durationMilliseconds - Math.max(0, elapsed),
    progress: Math.max(0, elapsed) / entry.durationMilliseconds
  }
}

// HUD 칸에 띄울 남은 시간 — 1초 이상은 올림한 초, 1초 미만은 소수 한 자리.
export const formatSkillCooldownSeconds = (remainingMilliseconds: number): string =>
  remainingMilliseconds >= 1000
    ? String(Math.ceil(remainingMilliseconds / 1000))
    : (Math.ceil(remainingMilliseconds / 100) / 10).toFixed(1)

export const createSkillCooldownTracker = () => {
  const entries = new Map<string, SkillCooldownEntry>()

  return {
    start: (skillId: string, now: number, durationMilliseconds: number) => {
      entries.set(skillId, { startedAtMilliseconds: now, durationMilliseconds })
    },
    get: (skillId: string, now: number) => getSkillCooldownView(entries.get(skillId), now)
  }
}

export type SkillCooldownTracker = ReturnType<typeof createSkillCooldownTracker>
