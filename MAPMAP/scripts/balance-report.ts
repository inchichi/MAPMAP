// 장별 전투 밸런스 점검표 — 게임의 실제 공식(레벨업·스탯·장비·몬스터·받는 피해)으로
// "몇 대 때려야 잡나 / 몇 대 맞으면 쓰러지나"를 장 체크포인트마다 뽑는다. 목표 범위는 docs/game-balance.md.
//   npx vite-node scripts/balance-report.ts
import { createMonsterCombatState } from '../src/games/my-sample-rpg/monsterCombat'
import { BOSS_DAMAGE_MULTIPLIER, MONSTER_HP_MULTIPLIER, getBossHpMultiplier } from '../src/games/my-sample-rpg/monsterTuning'
import { createInitialPlayerProfile } from '../src/games/my-sample-rpg/playerProfile'
import { grantPlayerLevelUpRewards, spendPlayerStatPoint } from '../src/games/my-sample-rpg/playerProgression'
import { getPlayerPhysicalAttackPower } from '../src/games/my-sample-rpg/playerStatEffects'
import {
  getPlayerDamageTaken,
  getPlayerEquipmentItemDefinitionById
} from '../src/games/my-sample-rpg/playerEquipment'

type Checkpoint = {
  name: string
  playerLevel: number
  monsterLevel: number
  boss?: { key: string; level: number }
  gear: string[]
}

// 메인 진행 기준 도착 레벨(scripts/estimate-playtime.ts)과 그 장에서 드롭으로 모일 법한 장비.
const CHECKPOINTS: Checkpoint[] = [
  { name: '1장 초반', playerLevel: 3, monsterLevel: 3, gear: ['basic-sword', 'basic-armor', 'basic-boots'] },
  {
    name: '1장 끝',
    playerLevel: 10,
    monsterLevel: 11,
    boss: { key: 'monster_pig_boss', level: 14 },
    gear: ['iron-sword', 'Leather_Armor', 'Leather_Helmet', 'leather-boots', 'smith-charm']
  },
  {
    name: '2장 중반',
    playerLevel: 22,
    monsterLevel: 22,
    boss: { key: 'monster_frog_king', level: 24 },
    gear: ['temple-sword', 'temple-armor', 'Iron_Helmet', 'leather-boots', 'smith-charm']
  },
  {
    name: '2장 끝',
    playerLevel: 33,
    monsterLevel: 28,
    boss: { key: 'monster_swamp_priest', level: 30 },
    gear: ['temple-sword', 'temple-armor', 'temple-helmet', 'temple-boots', 'altar-charm']
  },
  {
    name: '3장 초반',
    playerLevel: 36,
    monsterLevel: 39,
    gear: ['temple-sword', 'temple-armor', 'temple-helmet', 'temple-boots', 'altar-charm']
  },
  {
    name: '3장 중반',
    playerLevel: 42,
    monsterLevel: 44,
    boss: { key: 'monster_troll_chief', level: 46 },
    gear: ['frost-sword', 'frost-armor', 'temple-helmet', 'temple-boots', 'altar-charm']
  },
  {
    name: '3장 끝',
    playerLevel: 47,
    monsterLevel: 46,
    boss: { key: 'monster_frost_witch', level: 49 },
    gear: ['frost-sword', 'frost-armor', 'frost-helmet', 'frost-boots', 'frost-charm']
  },
  { name: '3장 맨몸', playerLevel: 40, monsterLevel: 42, gear: ['basic-sword'] },
  // 곁가지 퀘스트까지 한 사람(2장 끝 Lv45, 3장 끝 Lv58)
  {
    name: '3장 초반(곁가지)',
    playerLevel: 45,
    monsterLevel: 39,
    gear: ['temple-sword', 'temple-armor', 'temple-helmet', 'temple-boots', 'altar-charm']
  },
  {
    name: '3장 끝(곁가지)',
    playerLevel: 58,
    monsterLevel: 46,
    boss: { key: 'monster_frost_witch', level: 49 },
    gear: ['frost-sword', 'frost-armor', 'frost-helmet', 'frost-boots', 'frost-charm']
  }
]

// 근접 위주 빌드: 효과 상한(민첩 16, 행운 21)까지는 힘·민첩·행운을 고루, 그 뒤는 전부 힘.
const buildPlayer = (level: number) => {
  let profile = grantPlayerLevelUpRewards(createInitialPlayerProfile(), level - 1)
  const order = ['strength', 'agility', 'luck'] as const
  for (let index = 0; profile.statPoints > 0; index += 1) {
    profile =
      spendPlayerStatPoint(profile, order[index % order.length]) ??
      spendPlayerStatPoint(profile, 'strength') ??
      profile
  }
  return profile
}

const sum = (ids: string[], key: 'attackBonus' | 'defense') =>
  ids.reduce((total, id) => total + (getPlayerEquipmentItemDefinitionById(id)?.[key] ?? 0), 0)

const rows = CHECKPOINTS.map((checkpoint) => {
  const player = buildPlayer(checkpoint.playerLevel)
  const hit = getPlayerPhysicalAttackPower(player) + sum(checkpoint.gear, 'attackBonus')
  const defense = sum(checkpoint.gear, 'defense')
  const monster = createMonsterCombatState(checkpoint.monsterLevel, { hpMultiplier: MONSTER_HP_MULTIPLIER })
  // 공격 동작이 있는 몬스터는 접촉 피해 + 1 로 친다(frameUpdate).
  const monsterSwing = monster.contactDamage + 1
  const boss = checkpoint.boss
    ? createMonsterCombatState(checkpoint.boss.level, {
        hpMultiplier: getBossHpMultiplier(checkpoint.boss.key),
        damageMultiplier: BOSS_DAMAGE_MULTIPLIER
      })
    : undefined
  const taken = (damage: number) => getPlayerDamageTaken(damage, defense)

  return {
    checkpoint: checkpoint.name,
    level: `${checkpoint.playerLevel} vs ${checkpoint.monsterLevel}`,
    hp: player.hp.max,
    hit,
    defense,
    killHits: Math.ceil(monster.maxHp / hit),
    monsterHit: `${monsterSwing}→${taken(monsterSwing)}`,
    survivedHits: Math.ceil(player.hp.max / taken(monsterSwing)),
    bossKillHits: boss ? Math.ceil(boss.maxHp / hit) : '',
    bossHit: boss ? `${boss.contactDamage + 1}→${taken(boss.contactDamage + 1)}` : '',
    bossSurvivedHits: boss ? Math.ceil(player.hp.max / taken(boss.contactDamage + 1)) : ''
  }
})

console.table(rows)
