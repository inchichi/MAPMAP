# Boss RL Design

This document records the plan and every decision for training the trial boss with reinforcement learning (RL).
Update it whenever a decision changes. Add new decisions to the log with a date.

## Goal

- Make a **fun** boss, not a strong boss.
- "Fun" means: close fights, 1 to 2 minutes long, many different patterns, and a win rate that fits the player's skill.
- Compare a boss trained with RL against the current rule-based boss in the same simulator.

## Decision Log

| Date | Decision | Why |
|---|---|---|
| 2026-10-06 | Keep monster AI as an if-chain for normal monsters. Do not move to a behavior tree. | Normal monsters have only 5 behaviors. A behavior tree is too much for now. |
| 2026-10-06 | Build a trial boss with 7 patterns, each with a different way to dodge. | RL needs real choices. Old bosses have only 1 or 2 skills. |
| 2026-10-06 | RL chooses **which skill to use and when**. Movement, telegraphs, and damage stay as hand-written rules. | Small action space, safe to ship, easy to compare with the baseline. |
| 2026-10-06 | Train on a remote server, not on the dev PC. | The server has 48 CPU threads and 4 GPUs. |
| 2026-10-06 | Use a headless TypeScript simulator that reuses the game rules (approach A). Do not rewrite the rules in Python. | One source of truth. A policy trained on different rules would act differently in the game. |
| 2026-10-06 | The boss goal is "fun", not "win". | A boss trained only to win learns unavoidable combos. |
| 2026-10-06 | Train against rule-based player bots with 3 skill tiers (novice, normal, expert). | One bot only teaches the boss to exploit that bot. Self-play is a later experiment. |
| 2026-10-06 | Players bring a limited number of potions into the fight. | In the game a potion heals 10 with no cooldown, so an unlimited supply makes the player immortal. |
| 2026-10-06 | Balance the trial boss for a level 10 player with 6 potions: boss HP extra ×4 and boss damage multiplier 1. Other bosses do not change. | A sweep (see Balance) put normal and expert inside their win-rate targets. With damage ×2, plain melee decided every fight. |
| 2026-10-06 | Look up boss HP and damage multipliers by boss key (`getBossKey`), not by appearance. | The trial boss borrows the troll chief's look but needs its own numbers. For every other boss the key equals the appearance, so nothing else changes. |
| 2026-10-06 | Accept that one fixed setting cannot fit all three tiers. Novices stay below target. | This is a reason to try RL: a policy that sees the player's state can go easier on weak players. |

## Trial Boss

- Map: `boss-arena` (`src/games/my-sample-rpg/assets/maps/boss-arena.tmx`). Switch to it from the editor map picker ("시험장" in the 테스트 group).
- Character: `시험의 수호자-보스`, level 10, troll chief look. Boss key `boss_trial` in `src/games/my-sample-rpg/bossSkills.ts`.
- In `boss-arena`, the player's HP never goes down (damage numbers still show). This is for manual testing only.

| Skill | Range (tiles) | Cooldown | How it works | How to dodge |
|---|---|---|---|---|
| charged-blast | 0-5 | 22s | Boss stands still for 2.2s, then a big blast hits 45% of player max HP. | Leave the circle, or deal 5% of boss max HP during the channel to interrupt it. An interrupt staggers the boss for 1.8s. Rolling does not help. |
| tongue-pull | 3-7 | 9s | After 0.45s, pulls the player next to the boss. | Roll during the wind-up. |
| charge | 3-9 | 8s | Shows the path for 0.8s, then dashes 2 tiles past the player. Stops at walls. | Step to the side. |
| ring-burst | 0-5 | 9s | A ring around the boss explodes. The inside is safe. | Stay close to the boss. |
| meteor-shower | 0-12 | 15s | The first rock lands on the player, the rest land nearby with a delay. | Keep moving. |
| fan-shot | 2-10 | 4.5s | 5 bullets in a fan (7 when enraged). | Move into a gap. |
| ground-slam | 0-3 | 6s | Shockwave around the boss. | Move away. |

- After any skill, all other skills wait 1.6s (`getBossSkillGap`). The first skill comes 3s into the fight.
- Below 50% HP the boss is enraged: cooldowns are 20% shorter, and it fires more bullets and meteors.
- Melee: 6 damage when the player is within 1.94 tiles, every 3.8s. Melee has no warning.
- HP: 1,200 at level 10 (`(10 + 2×10) × 10 × 4`).

## System Overview

```
 dev PC                                   training server (ssh capstone)
 ─────────────────────────────            ─────────────────────────────────────
 bossSkills.ts (rules)  ───┐               Node: headless simulator  <──JSON──>  Python: RL (PPO)
 bossTraining/ (sim, bots) ├── same code ──>      (many in parallel)                    │
 boss-arena map           ─┘                                                          ▼
                                                                         trained policy (small MLP weights)
 browser game  <───────────────────────── export to JSON ────────────────────────────┘
```

## Simulator

- Code: `src/games/my-sample-rpg/bossTraining/bossFightSim.ts`.
- Fixed step: 50 ms. Time limit: 180 s. Positions are in tiles, and each character is a point.
- Reuses from the game: every skill rule in `bossSkills.ts` (hazard shapes, timings, damage, charge path, interrupt rule, enrage), boss HP and damage (`monsterCombat.ts`, `monsterTuning.ts`), and roll timing (`playerRoll.ts`).
- Copies these numbers by hand (update them if the game changes):
  - player move speed 8 tiles/s, attack every 620 ms, attack reach 1.6 tiles, 600 ms invulnerability after a hit
  - boss chase speed 2.2 tiles/s, melee range 1.94, melee every 3.8 s, attack pose 820 ms, hit reaction 180 ms (troll chief in `monsterCatalog.ts`)
- Player stats for level L: HP `24 + 4(L-1)`, attack `5 + 2(L-1) + 2` (same assumption as `scripts/estimate-playtime.ts`).
- A swing in reach hits with the bot's accuracy. Real players miss because of facing and timing.
- Boss policy: `BossPolicy(state, availableSkills) -> skill or undefined`. It is called only when the boss is free (not channeling, charging, attacking, or staggered). `ruleBasedBossPolicy` matches the game today: the first available skill in list order.
- The random number generator is seeded (`createSeededRandom`), so the same seed gives the same fight.

### Known gaps from the real game

- No body collision between the player and the boss.
- No monster contact damage. Only boss melee and skills deal damage.
- No player skills (smash, protect, magic) or equipment effects.
- Potions: a 400 ms key-press gap is assumed. The game has no potion cooldown.

## Player Bots

- Code: `src/games/my-sample-rpg/bossTraining/playerBots.ts`.
- What every bot does:
  1. It notices a new hazard only after its reaction time. At that moment it decides once per skill cast whether to dodge and whether to roll.
  2. If a hazard it chose to dodge is about to hit its spot, it walks to the nearest safe spot. If time is almost up, it rolls.
  3. It rolls out of tongue-pull wind-ups. For charged-blast it either attacks to interrupt or runs away.
  4. To beat melee, which has no warning, a bot that "reads the rhythm" rolls **toward** the boss right before the swing. The boss swings the moment the player is in range, so stepping sideways only delays the hit.
  5. Otherwise it walks up to the boss and attacks. It drinks a potion when HP is low.

| Tier | Reaction | Dodge | Roll | Interrupt | Move jitter | Melee read | Potion below | Accuracy |
|---|---|---|---|---|---|---|---|---|
| novice | 400 ms | 50% | 30% | 20% | 0.4 rad | 0% | 35% HP | 60% |
| normal | 280 ms | 65% | 50% | 50% | 0.25 rad | 30% | 40% HP | 75% |
| expert | 180 ms | 85% | 70% | 80% | 0.1 rad | 50% | 45% HP | 85% |

- These numbers are guesses about real players, so they are also a balance knob. On 2026-10-06 the novice was made a bit stronger and the expert a bit less perfect, because the first values (35% dodge, 90% dodge with perfect aim) looked less human than the targets assume.

## Fun Score

- Code: `src/games/my-sample-rpg/bossTraining/fightEvaluation.ts` (`scoreFightFun`).
- Per fight, from 0 to 1:
  - closeness (weight 0.40): player wins with 10-40% HP left = 1. Under 10% = 0.8. It drops to 0 at full HP. If the boss wins, the score is higher when the boss was almost dead. A timeout scores 0.
  - duration (weight 0.25): 60-120 s = 1. It drops to 0 at 20 s and at 180 s.
  - variety (weight 0.35): normalized entropy of skill use over the 7 skills.
- Target player win rate per tier (checked over many fights):

| Tier | Target win rate |
|---|---|
| novice | 30-50% |
| normal | 55-75% |
| expert | 85-97% |

- The weights and bands are first guesses. Tune them after people play the trained boss.

## Balance

Balance knobs for the trial boss: boss HP, boss melee damage, potion count, and the bot profiles.

First baseline (2026-10-06, before balancing: HP extra ×3.5, damage ×2, 10 potions, bots always hit):
- Every tier won 83-99% of fights in about 30 s.
- Melee dealt most of the damage.
- The bots stayed in melee range, so ranged skills were rare, and ring-burst almost never hit.

Sweep (2026-10-06, rule-based boss, 200-300 fights per cell, player win rate novice / normal / expert):

| Boss melee | HP extra | Potions | Result |
|---|---|---|---|
| ×2 (11 dmg) | 3.5 | 8 | 6% / 63% / 99% |
| ×2 | 5 | 8 | 0% / 8% / 86% |
| ×1 (6 dmg) | 3.5 | 8 | 36% / 84% / 99% |
| ×1 | **4** | **6** | **9% / 66% / 97%** ← chosen |
| ×1 | 4.5 | 8 | 6% / 59% / 95% |
| ×1 | 5 | 10 | 5% / 56% / 99% |

Current result (rule-based boss, 300 fights per tier, seed 1, level 10, 6 potions):

| Tier | Player win rate | Target | Avg length | HP left on win | Fun score |
|---|---|---|---|---|---|
| novice | 6% | 30-50% ✗ | 37 s | 17% | 0.50 |
| normal | 64% | 55-75% ✓ | 43 s | 34% | 0.72 |
| expert | 97% | 85-97% ✓ | 42 s | 49% | 0.73 |

What is still off, and why it is left as is:
- **Novices lose too often.** Each skill hit costs 16-45% of max HP, so missed dodges add up fast. Any setting that helps novices pushes experts to 100%. A learned policy can adapt to the player instead.
- **Fights are about 40 s, not 60-120 s.** More boss HP makes fights longer but drops normal players below target.
- **Ranged skills are rare.** charge, tongue-pull, and fan-shot are used less than once per fight because the bots hug the boss. ring-burst almost never hits for the same reason. A policy could keep them for when the player backs off.
- Melee is still the largest damage source, but skills now deal about half of the damage.

## RL Plan (draft)

- Decision point: when the boss is free and at least one skill is available. Actions: one per skill, plus "no skill" (keep chasing and melee). Mask out unavailable skills.
- Observation (first version): distance and direction to the player, player HP ratio, boss HP ratio, enraged flag, cooldown left for each skill, player roll ready, active hazard count, time since the last skill, last skill used.
- Reward: the fun score at the end of the fight, plus a penalty when a batch's win rate leaves the tier target. Small per-step shaping only if learning stalls.
- Opponents: a mix of the 3 tiers, randomized per episode.
- Algorithm: PPO with action masking (for example `sb3-contrib` MaskablePPO). The policy is a small MLP, so the CPU simulator is the bottleneck, not the GPU.
- Bridge: a Node process runs many simulator copies, and Python talks to it over stdin/stdout JSON. Batch the steps if it is too slow.
- Export: save the MLP weights as JSON and run inference in TypeScript inside the game. No ML runtime is needed in the browser.
- Evaluate with `scripts/simulate-boss-fight.ts` against the rule-based baseline, using the same seeds.

## Training Server

- SSH alias `capstone` (see `~/.ssh/config` on the dev PC). Do not put keys or passwords in this repo.
- Ubuntu 24.04 in a Docker container, 2× Xeon Gold 5317 (48 threads), 62 GB RAM, 4× RTX 3090 24 GB, 1.5 TB free disk.
- The GPUs are shared: 16-21 GB of each was already in use on 2026-10-06.
- Already installed: Python 3.12 with `~/venv` (torch 2.5.1 CUDA, numpy), Node 24, npm 11.
- Not installed yet: `gymnasium`, `stable-baselines3`, `sb3-contrib`. Ask before installing.

## How To Run

```bash
npx vite-node scripts/simulate-boss-fight.ts
FIGHTS=1000 SEED=7 POTIONS=6 npx vite-node scripts/simulate-boss-fight.ts
JSON=1 npx vite-node scripts/simulate-boss-fight.ts
npx vitest run src/games/my-sample-rpg/bossTraining
```

## Next Steps

1. ~~Decide the balance knobs.~~ Done on 2026-10-06 (see Balance).
2. Build the Node ↔ Python bridge and a Gymnasium environment.
3. Install the RL packages on the server (with approval) and run a first PPO training.
4. Export the policy and load it into the game for the trial boss.
5. Optional: self-play, where the player is also trained.
