# Weapon Balance

This document explains how melee weapons are balanced and which skills each weapon should get.
Read it when you change weapon stats, melee motions (`rendering/mapView/meleeMotions/`), or weapon skills.

## Rule: Risk Pays

A weapon that makes the player take more risk must deal more damage. A safe weapon must deal less.

Risk comes from three things:

- **Reach.** Monsters hurt the player on contact (about 1 tile). A weapon that hits from farther away lets the player hit and step back before contact.
- **Commitment.** A slow wind-up or a long cooldown locks the player in place while monsters close in.
- **Target count.** Hitting many monsters at once is a reward. Pay for it with lower single-target damage.

## How the Numbers Work

- Basic attack damage = player strength + weapon `attackBonus` (`playerEquipment.ts`).
- Attack period = attack motion (320 ms) + motion cooldown (`cooldownMilliseconds` in each melee motion module).
- Single-target DPS = damage / period.
- As strength grows, the DPS ratio between two weapons moves toward the ratio of their periods.
  So **cooldown sets the late-game ratio** and **`attackBonus` sets the early-game ratio**.
- Compare each weapon with the iron sword (`attackBonus` 6, cooldown 300 ms). It is the baseline (1.00).
- Higher tiers (chapter 2 `temple-*`, chapter 3 `frost-*`) multiply each line's tier 1 `attackBonus` by the same factor (3, 6), so the ratios below still hold. See `docs/game-balance.md`.

## Current Values

Reach lives in one table, `src/games/my-sample-rpg/playerMeleeReach.ts` (`PLAYER_MELEE_REACH`). Game hit checks and the boss fight simulator both read it, so the trained boss sees the same player reach as the game. Basic weapon attacks draw no effect sprite (only the body motion); hit checks use this table.
Single-target reach is measured from the body edge; `side` widens the hit band on each side. Area reach is measured from the body center.

| Weapon | Motion | Reach | Targets | `attackBonus` | Cooldown | Single-target DPS vs sword (STR 5 / 15 / 30) | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Iron sword | slash | 1.4 tiles, ±0.45 side | 1 | 6 | 300 ms | 1.00 / 1.00 / 1.00 | Medium (baseline) |
| Axe | cleave | 1.8 tiles, 2.8 wide | all in area | 7 | 420 ms | 0.91 / 0.88 / 0.86 | Medium: slow swing, rewards crowds |

Notes:

- The axe gives up single-target damage for area hits. Against 2 or 3 monsters it beats every other weapon.

## Weapon Skills

There are no jobs. The equipped weapon line decides which skills the player can use (`getEquippedPlayerWeaponLine`).
Guard, dash, and focus work with any weapon.

Each weapon line gets one skill per chapter. A skill unlocks at the level where its chapter starts.
**A skill that unlocks later is always stronger.** Its power, mana cost, and cooldown are all higher at every skill level.

| Chapter | Unlock level | Power at skill Lv1 to Lv5 | Mana | Cooldown |
| --- | --- | --- | --- | --- |
| 1 | 1 | 10 to 28 | 4 to 8 | 3.5 to 6 s |
| 2 | 15 | 24 to 54 | 9 to 13 | 6 to 8 s |
| 3 | 38 | 48 to 108 | 15 to 22 | 10 to 12 s |

Skill damage = stat attack (intelligence for staff, strength for the rest) + skill power + weapon `attackBonus`.
Multi-hit skills scale that base down per hit (for example 0.5 x 3 hits).

| Line | Chapter 1 | Chapter 2 | Chapter 3 |
| --- | --- | --- | --- |
| Sword | Smash: line of sword waves | Cross Slash: waves in 4 directions | Flash Strike: dash 4 tiles, hit the path twice, no damage taken while dashing |
| Axe | Whirlwind: 3 hits around the player | Ground Splitter: 5-tile line, push back | Execute: big front hit, double damage below 30% HP |
| Bow | Multi Shot, Piercing Arrow, Poison Arrow | Arrow Rain: 4 volleys on the nearest monster | Storm Arrows: 5 piercing arrows in a fan |
| Staff | Ice Bolt, Fireball, Chain Lightning | Blizzard: 4 hits and freezes | Meteor: delayed big blast plus burn |

Where the code lives:

- Game data: `playerWeaponSkills.ts` (line, chapter, cooldown, power table). `playerSkills.ts` adds them to the profile index, the damage and mana tables, and the skill window order. Lua mirrors are in `assets/lua/player-skills.lua` and `assets/lua/player-progression.lua` (unlock level).
- Live scene: `rendering/mapView/playerWeaponSkills.ts` (weapon check, cooldown, timed hits, cleanup) and one file per line in `rendering/mapView/weaponSkills/`.
- Icons: `scripts/generate-weapon-skill-icons.py` writes `assets/skills/weapon/*.png` and the base, magic, and bow icons `assets/skills/*_skill.png` from game-icons.net silhouettes (CC BY 3.0) in `scripts/weapon-skill-icons/`. A new icon needs its SVG there, an author line in `licenses/assets/game-icons/SOURCE.txt`, and a rerun of `scripts/build-credits.py`.
- To add a chapter 4 skill: add a definition at the end of `PLAYER_WEAPON_SKILL_DEFINITIONS` (never reorder; save files use the index), add its `cast` in the line file, mirror the table and unlock level in Lua, and add its icon.
- `bossTraining/bossFightSim.ts` knows two basic attacks: sword (620 ms, reach from `playerMeleeReach.ts`) and bow (300 ms draw, 650 ms period, 7-tile homing arrow). It does not know weapon skills or per-weapon damage yet.
