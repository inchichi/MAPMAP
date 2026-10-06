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

## Current Values

| Weapon | Motion | Reach | Targets | `attackBonus` | Cooldown | Single-target DPS vs sword (STR 5 / 15 / 30) | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Iron sword | slash | 1.2 tiles | 1 | 6 | 300 ms | 1.00 / 1.00 / 1.00 | Medium (baseline) |
| Dagger | quick-slash | 1.0 tile | 1 | 4 | 180 ms | 1.01 / 1.12 / 1.17 | Highest: must stand in contact range |
| Spear | thrust | 1.6 tiles | 1 | 6 | 400 ms | 0.86 / 0.86 / 0.86 | Lowest: hits before contact |
| Axe | cleave | 1.6 tiles, 2.2 wide | all in area | 7 | 420 ms | 0.91 / 0.88 / 0.86 | Medium: slow swing, rewards crowds |
| Mace | crush | 1.7 tiles | all in area | 9 | 460 ms | 1.01 / 0.91 / 0.86 | Low: knockback keeps monsters away |

Notes:

- The dagger is a level 1 shop item. It starts even with the level 2 sword and pulls ahead as strength grows. That premium pays for fighting at contact range.
- The axe and mace give up single-target damage for area hits. Against 2 or 3 monsters they beat every other weapon.
- Mace knockback (base 0.45 + 0.25 tiles) pushes a monster to the edge of the next crush, so the player can keep hitting without being touched. A larger knockback pushes monsters out of reach and breaks the combo.

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
| Spear | Lunge: dash 2 tiles and pierce the path (ends next to monsters) | Spear Sweep: hit all within 2 tiles and push them 1 tile | Thunder Javelin: pierce 7 tiles, then a blast that freezes |
| Axe | Whirlwind: 3 hits around the player | Ground Splitter: 5-tile line, push back | Execute: big front hit, double damage below 30% HP |
| Mace | Ground Slam: weak hit, freeze within 2 tiles | Shockwave: 3 rings out to 3 tiles, push back | Earthquake: 3 hits within 4 tiles, long freeze |
| Dagger | Vital Strike: double damage on an adjacent monster | Shadow Step: teleport behind a monster within 4 tiles | Blade Flurry: 6 fast hits around the player plus poison |
| Bow | Multi Shot, Piercing Arrow, Poison Arrow | Arrow Rain: 4 volleys on the nearest monster | Storm Arrows: 5 piercing arrows in a fan |
| Staff | Ice Bolt, Fireball, Chain Lightning | Blizzard: 4 hits and freezes | Meteor: delayed big blast plus burn |

Where the code lives:

- Game data: `playerWeaponSkills.ts` (line, chapter, cooldown, power table). `playerSkills.ts` adds them to the profile index, the damage and mana tables, and the skill window order. Lua mirrors are in `assets/lua/player-skills.lua` and `assets/lua/player-progression.lua` (unlock level).
- Live scene: `rendering/mapView/playerWeaponSkills.ts` (weapon check, cooldown, timed hits, cleanup) and one file per line in `rendering/mapView/weaponSkills/`.
- Icons: `scripts/generate-weapon-skill-icons.py` writes `assets/skills/weapon/*.png` and the base, magic, and bow icons `assets/skills/*_skill.png` from game-icons.net silhouettes (CC BY 3.0) in `scripts/weapon-skill-icons/`. A new icon needs its SVG there, an author line in `licenses/assets/game-icons/SOURCE.txt`, and a rerun of `scripts/build-credits.py`.
- To add a chapter 4 skill: add a definition at the end of `PLAYER_WEAPON_SKILL_DEFINITIONS` (never reorder; save files use the index), add its `cast` in the line file, mirror the table and unlock level in Lua, and add its icon.
- `bossTraining/bossFightSim.ts` still uses one fixed attack (620 ms, 1.6 tiles). It does not know weapons or skills yet.
