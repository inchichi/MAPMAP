# Game Balance

This document tracks character progression balance: levels, stats, skill points, MP, monster scaling, and equipment.
Read it when you change any of those numbers. Weapon-vs-weapon balance and weapon skills live in `docs/weapon-balance.md`.

When you change a number below, update this document in the same change.
Paths are relative to `src/games/my-sample-rpg/`. Lua mirrors in `assets/lua/` take their constants from the TS files.

## Current Rules

### Level up

| Item | Value | Source |
| --- | --- | --- |
| Stat points per level | 3 | `playerProgression.ts` `PLAYER_LEVEL_UP_STAT_POINTS` |
| Max HP per level | +4 (level up also fully heals) | `playerProgression.ts` `PLAYER_LEVEL_UP_HP_BONUS` |
| Skill points per level | 2 | `playerProgression.ts` `PLAYER_LEVEL_UP_SKILL_POINTS` |
| Max MP per level | +3 (level up also fully refills) | `playerProgression.ts` `PLAYER_LEVEL_UP_MP_BONUS` |
| Max level | 100 | `playerProfile.ts` `PLAYER_MAX_LEVEL` |
| Exp to next level | `140 + (L - 1) * 30` | `playerExperience.ts` |
| Lv1 profile | HP 24, MP 12, STR 5 / AGI 4 / INT 3 / LUK 2 | `playerProfile.ts` `createInitialPlayerProfile` |

At Lv36 a player has 105 stat points, 70 skill points, 164 max HP, and 117 max MP (before INT).

### Stats

| Stat | Effect | Useful up to | Source |
| --- | --- | --- | --- |
| STR | +1 physical damage per point (basic attack, weapon skills, bow skills) | no cap | `playerStatEffects.ts` |
| INT | +1 magic damage per point; +2 max MP per point above 3 | no cap | `playerStatEffects.ts`, `playerProgression.ts` |
| AGI | Move speed `8 + (AGI - 4) * 0.35` tiles/s, clamped to 4..12 | AGI 16 | `playerStatEffects.ts` |
| LUK | Dodge `0.04 + 0.015 * LUK`, capped at 0.35 | LUK 21 | `playerStatEffects.ts` |

AGI and LUK cannot be raised past their useful value (`getPlayerStatMaxUsefulValue`). The stat window shows the limit and marks a capped stat as `최대`.
No stat raises HP or defense.

### Damage

- Basic attack = STR (INT with a staff) + sum of equipped `attackBonus` (`rendering/mapView/playerCombatEffects.ts`).
- Weapon-line skill = basic attack + skill power (`rendering/mapView/playerWeaponSkills.ts`). Power by skill level:
  - chapter 1 skills: 10 / 14 / 18 / 23 / 28
  - chapter 2 skills: 24 / 30 / 37 / 45 / 54
  - chapter 3 skills: 48 / 60 / 74 / 90 / 108
- Magic skills = INT + power (+ weapon bonus only with a staff). Bow skills = basic attack + power (`playerSkills.ts`).
- Smash (베기) = basic attack + 10 / 14 / 18 / 23 / 28, like the other weapon-line skills.

### Skill points and MP

- Skill points come only from level ups: 2 per level. Kills and quests give none. Grinding gives skill points only through exp.
- Skill level cost: 2, 2, 3, 4, 4 (max level 5 costs 15). 19 skills exist, so maxing all costs 285. One weapon line uses about 6-7 skills, about 100 points.
- Budget: Lv10 18 points, Lv36 70, Lv47 92, Lv58 114. The player can max about 4-7 skills, so they must choose.
- Weapon skill unlock levels: chapter 1 Lv1, chapter 2 Lv15, chapter 3 Lv38.
- Max MP = `12 + 3 * (level - 1) + 2 * (INT - 3)` (`playerProgression.ts` `getPlayerMaxManaForProfile`). Skills cost 4-22 MP.
- Loading a save runs `reconcilePlayerProfileWithProgressionRules`. It resets HP / MP max and the skill point budget to the formulas above. Learned skill levels stay; unspent points shrink.

### Monsters

| Item | Formula | Source |
| --- | --- | --- |
| HP | `(10 + 2L) * 3` for normal monsters; bosses `* 10 * boss extra` | `monsterCombat.ts`, `monsterTuning.ts` |
| Contact damage | `ceil(L / 2)` (bosses x2); attack swing = contact + 1 | `monsterCombat.ts`, `rendering/mapView/frameUpdate.ts` |
| Damage taken by player | `max(1, ceil(damage * 0.4), damage - total equipment defense)` after dodge / roll / guard | `playerEquipment.ts` `getPlayerDamageTaken` |
| Exp per kill | `12 + 6L` | `monsterRewards.ts` |
| Gold per kill | `10 + 4L` (when no item drops) | `monsterRewards.ts` |

### Level bands

| Chapter | Normal monsters | Bosses | Player level (main / with side quests) |
| --- | --- | --- | --- |
| 1 | 1-12 | 9, 11, 14 | ends Lv10 / Lv16 |
| 2 | 16-29 | frog king 24, swamp priest 30 | ends Lv36 / Lv45 |
| 3 | 38-46 | troll chief 46, frost witch 49 | ends Lv47 / Lv58 |

Quests give about 75% of all exp. Player levels come from `scripts/estimate-playtime.ts`, which does not model skills, skill points, MP, or damage taken.

### Equipment Tiers

| Tier | Item level | Theme | Weapon `attackBonus` | Defense (armor / hat / boots / accessory) |
| --- | --- | --- | --- | --- |
| 1 | 1-3 | starter, shop | line base: sword 6, axe 7, bow 5, staff 5 | best 4 / 3 / 2 / 2 (altar charm Lv22: 5) |
| 2 | 18 | chapter 2 "신전" (`temple-*`) | line base x 3 | 5 / 4 / 3 / 3 = 15 |
| 3 | 40 | chapter 3 "서리" (`frost-*`) | line base x 6 | 6 / 5 / 4 / 6 = 21 |

- Each higher tier has one weapon per line (sword, axe, bow, staff) and one item per armor slot (`playerEquipment.ts`).
- Multiplying the line base keeps the weapon-vs-weapon ratios of `docs/weapon-balance.md`.
- Defense is subtracted from each hit, but at least 40% of the hit always goes through (`PLAYER_MIN_DAMAGE_TAKEN_RATIO`). Full gear cuts normal hits to about 40%; it never makes the player immune.
- Tier 2 / 3 items reuse a tier 1 body sprite through `appearanceId`. Their icons are recolors made by `scripts/generate-weapon-icons.py` and `scripts/generate-tier-gear-icons.py`.
- Blacksmith does not sell tier 2 / 3. They come from drops only.

### Potions

| Potion | Restores | Drops from monster Lv | Sold by |
| --- | --- | --- | --- |
| 체력 / 마나 회복 포션 | 10 HP / 10 MP | 1+ | potion merchants, herbalists |
| 중급 체력 / 마나 포션 | 60 HP / 40 MP | 15+ | herbalists (오디, 이르마) |
| 상급 체력 / 마나 포션 | 150 HP / 80 MP | 38+ | drops only |

Restore amounts live in `playerConsumables.ts` `PLAYER_POTION_RESTORE` and its Lua mirror `assets/lua/player-consumables.lua`.

### Monster Drops

`monsterEquipmentDrops.ts` `rollMonsterDrop`, one roll per kill:

- 20% equipment, else 25% potion, else gold.
- Band = the highest band at or below the monster level. Equipment bands Lv1 / 18 / 40, potion bands Lv1 / 15 / 38.
- 25% of normal drops come from one band lower, so older tiers still show up.
- Bosses always drop equipment of their own band.
- Drops never exceed the monster level.

## Balance Targets

Run `npx vite-node scripts/balance-report.ts` after changing any number here. It builds a melee player at each chapter checkpoint (main-path level, AGI / LUK to their caps, the rest in STR, gear that drops in that chapter) and prints hits to kill and hits survived with the real formulas.

| Metric | Target |
| --- | --- |
| Hits to kill a normal monster of the area | 3-5 |
| Normal swings survived with the chapter's gear | 15-25 (3-4 monsters attack together, so about 5 pack rounds) |
| Normal swings survived without armor | about 8-10 |
| Hits to kill the chapter boss | 20-40 |
| Boss swings survived | 7-11 |

Report on 2026-10-07 (after the changes below):

| Checkpoint | Player vs monster Lv | Kill hits | Survived | Boss kill hits | Boss swings survived |
| --- | --- | --- | --- | --- | --- |
| Chapter 1 start | 3 vs 3 | 6 | 16 | | |
| Chapter 1 end | 10 vs 11 | 5 | 20 | 19 | 8 |
| Chapter 2 middle | 22 vs 22 | 3 | 22 | 37 | 9 |
| Chapter 2 end | 33 vs 28 | 3 | 26 | 32 | 11 |
| Chapter 3 start | 36 vs 39 | 3 | 19 | | |
| Chapter 3 middle | 42 vs 44 | 3 | 19 | 27 | 7 |
| Chapter 3 end | 47 vs 46 | 3 | 21 | 30 | 7 |
| Chapter 3, no armor | 40 vs 42 | 4 | 9 | | |
| Chapter 3 start, side quests done | 45 vs 39 | 3 | 23 | | |
| Chapter 3 end, side quests done | 58 vs 46 | 2 | 26 | 24 | 9 |

Before the 40% floor, geared players survived 32-152 normal swings in chapters 1-2 (immune). Side-quest players are slightly ahead of the targets on purpose; it is the reward for side content.
The chapter 1 start (6 hits) is the starter sword at Lv3 with points spread over three stats; an all-STR start kills in 4.

## In-Game Checks

2026-10-06, before the fix. North-pass goblin camp, Lv36 character built in the game UI
(STR 65, AGI 29, INT 3, LUK 22, smash 5, cross slash 2, basic sword, no armor):

- 4 goblins (Lv38-41) died in 24 s using basic attack only.
- HP fell from 164 to 20 in the first 12 s while fighting 3-4 goblins at once.
- Max MP rose from 12 to 2,636 in 100 s (about 10 kills) because each kill gave skill points.

2026-10-07, after the progression fix. Same save and place (STR 79, AGI 16, LUK 21):

- Max MP 117 at Lv36, then +3 per level up. Kills no longer change it.
- Skill points 70 at Lv36 after loading the old save. Smash 5 + cross slash 5 used 30. Two level ups added 4.
- AGI stopped at 16 and LUK at 21 in the stat window.
- HP fell from 164 to 70 in 60 s against respawning goblins. Still no armor.

2026-10-07, after gear tiers. Same place, Lv36 with tier 3 sword / armor / helmet / boots and a tier 2 charm, 80 s:

- Drops: frost spear and frost sword (Lv40-41 goblins), temple boots and temple charm (one band lower), 3 large health potions stacked in one slot, medium mana potion (one band lower).
- HP stayed at 168 / 176. The body sprite showed the iron armor look.

## Known Problems

Fixed on 2026-10-07: defense making geared players immune, survival without HP formula changes, no gear past Lv3, level-blind drops, potions that stop mattering, skill points from kills, unlimited MP, smash not scaling, AGI / LUK points past their cap, chapter 3 band in `docs/chapter3-frozen-north.md`.

Still open. Each needs a design decision.

1. **Side-quest players are over-leveled.** Quest exp brings the player to Lv36 (Lv45 with side quests) while the chapter 2 final boss is Lv30. Side-quest players enter chapter 3 at Lv45 against Lv38 monsters. Kept as the reward for side content (see Balance Targets). If it feels too easy, lower chapter 2 side quest exp.
2. **INT is the only stat without a cap or a second use for melee builds.** Melee players have nowhere to put points after AGI 16 and LUK 21 except STR.
3. **The skill window still shows "사용자 레벨".** It is `totalSkillPointsEarned + 1` and no longer means anything (Lv36 shows 71).

## Change Log

- 2026-10-07: Dagger removed from the game too (items, motion, 3 skills).
- 2026-10-07: Spear and mace removed from the game (items, motions, 6 skills). Old saves drop those items and move skill levels by name (`playerSaveMigration.ts`).
- 2026-10-07: At least 40% of each monster hit goes through defense. Added `scripts/balance-report.ts` and the balance targets.
- 2026-10-07: Equipment tiers 2 (Lv18) and 3 (Lv40) for every weapon line and armor slot. Medium and large potions. Monster drops follow level bands; bosses always drop gear.
- 2026-10-07: Skill points move from kills (monster level per kill) to level ups (2 per level). Max MP moves from skill points to level (+3 per level). Smash adds the basic attack. AGI / LUK stop at their useful cap. Saves are reconciled on load.
- 2026-10-06: Document created from code and an in-game check. No numbers changed.
