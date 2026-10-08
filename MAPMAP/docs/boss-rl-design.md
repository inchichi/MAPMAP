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
| 2026-10-06 | Algorithm: MaskablePPO (`sb3-contrib`). | Discrete actions with many skills blocked at any moment (cooldown, range) need action masking. PPO is stable, simple to tune, and well supported. DQN cannot mask cleanly. Search-based methods (MCTS) need a forward model and are too slow per decision. |
| 2026-10-06 | One RL step = one boss decision, taken in the middle of a 50 ms tick, after the player moves and before the boss acts. | It must be the exact moment the game's boss chooses. A first version decided before the tick and drifted from the rule-based fight. A test now checks that "always pick the first allowed skill" replays the rule-based fight exactly. |
| 2026-10-06 | The policy does not see the bot tier. | It must read the player from the fight (damage taken recently, HP, potions), like it would with a real player. |
| 2026-10-06 | Pin `stable-baselines3` and `sb3-contrib` to 2.7.1 and `gymnasium` to 1.2.3 on the server. | 2.8+ needs torch >= 2.8 and would replace the shared `~/venv` torch 2.5.1 (CUDA 12.1). 2.7.1 only adds packages. |
| 2026-10-06 | Train on the CPU by default (`--device cpu`). | The policy is a 64×64 MLP. The Node simulators are the bottleneck. |
| 2026-10-06 | Run the trained policy in the game as plain TypeScript math from exported JSON weights. | It is only 3 small layers, so no ML runtime is needed. A test checks that TS and PyTorch give the same scores and actions on 60 recorded decisions. |
| 2026-10-06 | The training env and the game build the observation with one shared function (`bossObservation.ts`). | If they compute it differently, the policy acts strangely in the game without any error. After the move, 60 recorded decisions gave the same observation (largest difference 3e-8). |
| 2026-10-06 | Add a standalone simulator page (`boss-sim.html`), separate from the game and the editor. | To watch what the policy does in the same simulator it trained in, not in the live game where the arena keeps the player at full HP. |
| 2026-10-08 | The trial boss may use any skill whose cooldown is over, at any distance. Skill ranges stay in the table but only feed the `*_in_range` observation slots. Other bosses keep their range rule. | The user wants the trained boss to always keep every skill as an option. The policy learns by itself where a skill works. The game uses the same rule (`getReadyBossSkills`), so the sim and the game still match. |
| 2026-10-08 | Add a bow player bot and train the boss against it (`--weapon bow`). The observation does not show the weapon. | Sword bots hug the boss, so charge, tongue-pull, and fan-shot were almost never used. A bow bot keeps its distance, so the boss has to use them. |
| 2026-10-08 | The bow bot uses the same attack power as the sword bot (no weapon bonus difference). | So the only difference between the two bots is how they fight, not their damage. |
| 2026-10-08 | Add a magic (staff) bot that uses the staff's basic attack, the energy bolt. It shares the ranged bot logic and the same attack power. | The user asked for magic too. In the game the staff basic attack is a homing shot like the bow, so one ranged rule set covers both. MP skills are not simulated. |
| 2026-10-08 | Train one boss per opponent weapon (`bow-20m`, `magic-20m`), not one boss for all weapons yet. | First see what each weapon teaches. Mixing weapons in one policy is a later step. |
| 2026-10-08 | Run training with one torch thread per process (`rl/run_weapon.sh` sets `OMP_NUM_THREADS=1`). | With default threads, python used about 37 of 48 cores spinning while the Node simulators, the real work, got about 2. |

## Trial Boss

- Map: `boss-arena` (`src/games/my-sample-rpg/assets/maps/boss-arena.tmx`). Switch to it from the editor map picker ("시험장" in the 테스트 group).
- Character: `시험의 수호자-보스`, level 10, troll chief look. Boss key `boss_trial` in `src/games/my-sample-rpg/bossSkills.ts`.
- In `boss-arena`, the player's HP never goes down (damage numbers still show). This is for manual testing only.

Since 2026-10-08 the trial boss ignores the range column when it picks a skill (only cooldowns block it). The range now means "where the skill works well", and the policy sees it as `*_in_range`.

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
  - player move speed 8 tiles/s, attack every 620 ms, 600 ms invulnerability after a hit
- Player weapon (`PlayerWeapon`): `sword` (default), `bow`, or `magic`. Ranged weapons follow the game's basic attacks (`playerCombatEffects.ts`, `playerProjectile.ts`, `playerMagicSkills.ts`). Their numbers are in `PLAYER_RANGED_ATTACKS`:

| Weapon | Cast (locked in place, no roll) | Period | Aim range | Projectile | Max travel |
|---|---|---|---|---|---|
| bow | 300 ms draw | 650 ms | 7 tiles | arrow, 13.1 tiles/s | 7 tiles |
| magic | 220 ms staff thrust | 650 ms | 7 tiles | energy bolt, 10.6 tiles/s | 11 tiles |

  - At release, if the boss is in aim range, a homing projectile flies toward the boss and hits when it reaches the boss body. A miss (accuracy roll) fires nothing.
  - No walls block projectiles in the sim. Homing is perfect (the game's energy bolt turns at 7 rad/s).
  - Magic MP skills (ice bolt, fireball, chain lightning) and bow skills are not simulated.
- Player attack reach is not copied: it is the sword reach from `playerMeleeReach.ts` (1.4) + 0.4 for the boss body = 1.8 tiles. On 2026-10-07 it went from 1.6 to 1.8; the rule-based baseline moved little (normal bot win rate 63% → 65%, expert 98% both before and after). Retrain the boss policy so it learns the new reach.
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

- **Ranged bots** (`createPlayerBot(skill, random, 'bow' | 'magic')`): same tiers and same dodge rules. Instead of step 5 it keeps 4.8-6.6 tiles from the boss (outside the ring-burst, inside the aim range) and shoots while standing. It does not start a draw if a hazard it noticed would hit it during the draw, and it does not shoot while dodging. When it reads the boss melee, it rolls **away** from the boss. It shoots from where it stands to interrupt charged-blast.
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

Range-free trial boss (2026-10-08, rule-based boss, 300 fights per tier, seed 1, level 10, 6 potions):

| Bot | novice win | normal win | expert win | Avg length (n / no / e) | Fun (n / no / e) |
|---|---|---|---|---|---|
| sword | 10% | 68% ✓ | 99% | 38 / 42 / 41 s | 0.60 / 0.77 / 0.78 |
| bow | 99% | 100% | 100% | 61 / 49 / 45 s | 0.88 / 0.72 / 0.61 |
| magic | 100% | 100% | 100% | 61 / 49 / 44 s | 0.88 / 0.74 / 0.62 |

- Bow and magic bots play almost the same (magic casts a bit faster, its bolt is slower). Both beat the rule-based boss almost every time. The boss chases at 2.2 tiles/s and the player walks at 8, so melee almost never lands (about 2 damage per fight). Most damage comes from meteors, then charge and fan-shot.
- With the range limit gone, the rule boss (first ready skill) now uses tongue-pull and charge about 4-6 times per fight against the bow bot.
- This is the starting point for training against the bow bot. Whether a policy can push bow players into the target bands, or whether the boss needs new numbers for ranged players, is still open.

What is still off, and why it is left as is:
- **Novices lose too often.** Each skill hit costs 16-45% of max HP, so missed dodges add up fast. Any setting that helps novices pushes experts to 100%. A learned policy can adapt to the player instead.
- **Fights are about 40 s, not 60-120 s.** More boss HP makes fights longer but drops normal players below target.
- **Ranged skills are rare.** charge, tongue-pull, and fan-shot are used less than once per fight because the bots hug the boss. ring-burst almost never hits for the same reason. A policy could keep them for when the player backs off.
- Melee is still the largest damage source, but skills now deal about half of the damage.

## RL Environment

- TS side: `src/games/my-sample-rpg/bossTraining/bossEnv.ts` (pure, tested in `bossEnv.test.ts`).
- Server process: `scripts/boss-env-server.ts`. `npm run rl:build` bundles it with esbuild into `rl/dist/boss-env-server.mjs` and writes `rl/dist/boss-arena.json`. Only `rl/` is copied to the server, not the whole repo.
- Protocol: one JSON object per line over stdin/stdout.
  - `{"cmd":"reset","seed":N,"tier":"normal"}`: leave out `tier` to pick a random tier per episode.
  - `{"cmd":"step","action":K}`
  - `{"cmd":"spec"}`: returns the observation and action names.
- Python side: `rl/boss_env.py` is a Gymnasium env with one Node child per env, plus `action_masks()` for MaskablePPO.
- Decision point: the boss is free, at least one skill is available, and no "no skill" hold is active. The rest of the fight runs inside the simulator.
- Opponent weapon: `weapon` in the reset message, or the `WEAPON` environment variable of the server (default `sword`). `rl/boss_env.py` takes `weapon=`, and `train.py` / `evaluate.py` take `--weapon sword|bow|magic`.
- `rl/run_weapon.sh <weapon> <name> <envs> <seed> [steps]`: train, evaluate (rule boss, model, model against the sword bot), export the JSON, then exit. It caps torch at one thread per process.
- Actions (8): `none`, then the 7 skills in list order. Skills on cooldown are masked (the trial boss has no range limit). A masked action is treated as `none`. After `none`, the env does not ask again for 500 ms.
- Observation (36 numbers, the order is a contract, see `BOSS_ENV_OBSERVATION_NAMES`):
  - player offset and distance (in units of 10 tiles), player HP, boss HP, enraged
  - potions left, player rolling, roll ready, boss melee ready, hazard count, fight time
  - player damage taken and boss damage taken in the last 10 s
  - for each skill: cooldown left and in range
  - last action (one-hot)
- Reward: the fun score (0-1) when the fight ends, 0 before that. Per-tier win-rate penalties and step shaping are not used yet. Add them only if training needs them.
- Opponents: novice, normal, and expert at random per episode.
- `rl/train.py`: MaskablePPO, MLP 64×64, `n_steps` 256 per env, batch 2048, 5 epochs, lr 3e-4, gamma 0.995, entropy 0.01, `SubprocVecEnv`. Writes `rl/runs/<name>/` (model, checkpoints, `progress.csv`).
- `rl/evaluate.py`: plays a fixed number of fights per tier with `--policy rule|model|random` on the same seeds.
- Still to do: export the MLP weights as JSON and run inference in TypeScript inside the game.

## Training Results

| Date | Run | Steps | Envs | Speed | Notes |
|---|---|---|---|---|---|
| 2026-10-06 | `smoke` | 100k | 16 | 5,800 steps/s (24 s) | Pipeline check. Mean fight reward went from 0.63 to 0.69. |
| 2026-10-06 | `main-20m` | 20M | 32 | 8,200 steps/s (41 min) | Mean fight reward went from 0.65 to 0.76 and stayed flat after about 8M steps. The model is on the server in `~/boss-rl/runs/main-20m/` and on the dev PC in `rl/runs/main-20m/` (git-ignored). |

Evaluation on the server (200 fights per tier, seed 12345):

| Tier | Rule boss: win / fun | `smoke` model: win / fun |
|---|---|---|
| novice | 9% / 0.52 | 13% / 0.60 |
| normal | 62% ✓ / 0.69 | 68% ✓ / 0.72 |
| expert | 98% ✗ / 0.73 | 94% ✓ / 0.72 |

The smoke model is not a result. It only shows that learning moves the numbers in the right direction.

`main-20m` against the rule-based boss (500 fights per tier, seed 12345, deterministic policy):

| Tier | Rule boss: win / length / fun | `main-20m`: win / length / fun |
|---|---|---|
| novice | 10% / 38 s / 0.52 | 60% / 51 s / **0.76** |
| normal | 62% ✓ / 42 s / 0.70 | 82% / 44 s / **0.76** |
| expert | 98% / 42 s / 0.73 | 98% / 43 s / **0.74** |

Skills per fight:

| Tier | Rule boss | `main-20m` |
|---|---|---|
| novice | ground-slam 3.6, ring-burst 3.3, meteor 2.5, charged-blast 2.2 | ring-burst 5.8, meteor 3.0, ground-slam 2.6, charged-blast 1.8 |
| expert | ground-slam 4.1, ring-burst 4.0, meteor 2.9, charged-blast 2.3, fan-shot 0.6 | ground-slam 5.1, ring-burst 4.2, meteor 3.0, charged-blast 2.0, fan-shot 1.1 |

What the policy learned:
- **It adapts to the player without being told the tier.** Against novices it swaps ground-slam, which hurts players who stay close, for ring-burst, which is harmless to them. That keeps novices alive and makes fights longer and closer. Against experts it does the opposite and uses more ground-slam and fan-shot.
- **The fun score went up for every tier**, and the most for novices (0.52 → 0.76).
- **It overshoots the win-rate targets.** Novices now win 60% (target 30-50%) and normal players win 82% (target 55-75%). Expert stays at 98%. The reward is only the fun score, and its closeness part prefers close player wins. The planned win-rate term was not added yet.
- Charge and tongue-pull are still almost never used, because the bots stay close.

### Bow and magic runs (2026-10-08)

| Run | Opponent | Steps | Envs | Speed | Time |
|---|---|---|---|---|---|
| `bow-20m` | bow bot, random tier | 20M | 22 | about 2,500 steps/s | 133 min |
| `magic-20m` | magic bot, random tier | 20M | 22 | about 2,500 steps/s | 132 min |

Both ran at the same time on the server with `rl/run_weapon.sh`. Results are on the dev PC in `rl/runs/bow-20m/` and `rl/runs/magic-20m/` (git-ignored): `progress.csv`, `checkpoint-eval.csv`, `eval-*.txt`, `trial-boss-policy.json`, `model.zip`. The simulator page shows them under "학습 지표". The game still uses `main-20m`.

500 fights per tier, seed 12345, deterministic policy (player win / fun / HP left on win):

| Opponent | Tier | Rule boss | Trained boss | Trained boss vs sword bot (win) |
|---|---|---|---|---|
| bow | novice | 100% / 0.87 / 53% | 99% / **0.95** / 42% | 5% |
| bow | normal | 100% / 0.72 / 68% | 100% / **0.85** / 51% | 81% |
| bow | expert | 100% / 0.61 / 81% | 100% / **0.72** / 66% | 100% |
| magic | novice | 100% / 0.89 / 53% | 99% / **0.95** / 41% | 2% |
| magic | normal | 100% / 0.73 / 68% | 100% / **0.86** / 49% | 71% ✓ |
| magic | expert | 100% / 0.61 / 81% | 100% / **0.73** / 63% | 99% |

What the runs show:
- **The fun score went up for every tier** (novice 0.87 → 0.95, normal 0.72 → 0.85, expert 0.61 → 0.72). The boss made fights closer: ranged players now win with 41-66% HP left instead of 53-81%.
- **The player win rate stayed at 99-100% the whole time** (`checkpoint-eval.csv`, 10 checkpoints). The reward has no win-rate term, and its closeness part prefers close player wins, so the boss never tries to win. Even so, no checkpoint ever pulled a ranged bot below 98%. With today's skills the boss probably cannot beat a player who keeps 5-6 tiles away.
- **Learning flattened after about 4M steps** (fun reward about 0.82 at 1M, 0.84 from 4M to 20M).
- **The boss learned to punish distance**: fan-shot (5-7 per fight) and charge (4-6) became its main skills, and it uses ring-burst and tongue-pull less than the rule boss.
- Against the sword bot, the boss trained on ranged bots is harsher on novices (2-5% win, rule boss 10%) and softer on normal players (71-81%, rule boss 68%).
- Bow and magic results are almost the same, as expected from their near-identical basic attacks.

Next change to the reward: add a per-tier win-rate term so the policy aims for the target band. Its weight should adjust during training, raised while a tier's rolling win rate is outside its band and lowered when it is inside (a Lagrangian-style controller). A fixed per-episode bonus or penalty for winning only pushes the win rate to 0% or 100%.

## Policy In The Game

- The trial boss (`boss_trial`) picks skills with the trained policy. Every other boss still uses the rule (first available skill).
- Files:
  - `src/games/my-sample-rpg/assets/boss/trial-boss-policy.json`: exported weights (`rl/export_policy.py`), plus 60 sample decisions used by the test
  - `bossTraining/bossObservation.ts`: the 36 observation slots and 8 actions, shared with the training env
  - `bossTraining/bossPolicyNetwork.ts`: forward pass and masked argmax (deterministic, same as `evaluate.py`)
  - `rendering/mapView/trialBossPolicy.ts`: per-fight memory (start time, last action, "no skill" hold, damage taken) and the call into the network. `bossEncounter.ts` asks it instead of `pickBossSkill` for the trial boss.
- If the JSON does not match the current observation and action layout, the game logs a warning and falls back to the rule.
- `main-20m` was trained while skills still had range limits. With the range-free rule it can now pick skills at distances it never saw allowed, so it may act oddly until it is retrained.
- Two observation slots are not known in the game, so they are filled with fixed values: potions left = full, and roll ready = "not rolling right now".
- **In `boss-arena` the player's HP never drops**, so the policy always sees a healthy player who takes no damage. It then plays as if the player were strong. To test how it adapts to a weak player, turn the arena's infinite HP off (`combat.ts`, the `boss-arena` check in `applyDamageToPlayer`).
- To ship a new policy:

```bash
# on the server
~/venv/bin/python export_policy.py runs/<run>/model.zip runs/<run>/trial-boss-policy.json
# on the dev PC
scp capstone:boss-rl/runs/<run>/trial-boss-policy.json src/games/my-sample-rpg/assets/boss/
npx vitest run src/games/my-sample-rpg/bossTraining
```

- Checked on 2026-10-06 in a headless browser: in about 30 s of moving around the arena, the `main-20m` policy used ring-burst, charged-blast, ground-slam, and meteor-shower, with no errors.

## Simulator Page

- Open `http://localhost:5173/boss-sim.html` while `npm run dev` is running. It does not need the game or the editor.
- Code: `src/games/my-sample-rpg/bossSimViewer/` (`main.ts` for the page, `fightPlayback.ts` for one fight, `drawFight.ts` for the canvas, `arenaSprites.ts` for the game art). It uses the same simulator, bots, and policy as training.
- It draws the real `boss-arena` tilemap and the game sprites: the LPC knight with the starter sword for the player bot, and the troll chief sheet at the game's boss scale (×2) for the boss. Hazards are simple colored shapes, not the game's effects.
- "무기" picks the bot weapon (검 / 활 / 마법). The bow bot has the hunting bow and the LPC arrow sprite. The magic bot has the magic staff and the game's purple energy bolt (Ninja Adventure energy ball, tinted).
- Two panels play the same seed and the same bot tier with two boss policies (default: RL policy vs rule-based). The bot uses the same random numbers in both panels, so any difference comes from the boss policy.
- Each panel shows hazards (dashed = warning, filled = hitting), skill cooldowns, the last decision with the policy's action probabilities (masked softmax of the scores), an event log, and the fun score when the fight ends.
- To watch a policy trained on the server, pull it first. `npm run rl:pull` lists the runs on the server. `npm run rl:pull -- <run>` runs `export_policy.py` on the server and copies the JSON (and `progress.csv`) to `rl/runs/<run>/` on this PC. The "학습 결과" dropdown lists every `rl/runs/*/trial-boss-policy.json`. It does not change the game's copy.
- "파일" loads a policy JSON from anywhere else.
- **학습 지표** (below 일괄 평가): every `rl/runs/<run>/` with a `progress.csv`, with a checkbox per run to compare. Code: `trainingRunData.ts` (reads the files, tested) and `trainingMetrics.ts` (charts and tables). It shows:
  - final results per tier from `eval-rule.txt`, `eval-model.txt`, `eval-model-vs-sword.txt` (win rate against the target band, fun, length, HP left on win, skill use)
  - the fun reward curve from `progress.csv` (smoothed)
  - win rate and fun per tier over training from `checkpoint-eval.csv` (`rl/eval_checkpoints.py`)
  - policy entropy and explained variance from `progress.csv`
  - The opponent weapon comes from the `weapon=` line in the eval files. Runs without eval files count as sword runs.
- `npm run rl:pull -- <run>` also copies `checkpoint-eval.csv` and `eval-*.txt` when the server has them. Make them on the server with `rl/run_weapon.sh` (eval files) and `eval_checkpoints.py --run <run> --weapon <weapon>` (checkpoint curve).
- "일괄 평가" runs many fights per tier without drawing and shows win rate, length, HP left, fun, and skill use. Seeds start at the seed in the toolbar.
- `bossTraining/networkBossPolicy.ts` wraps the exported network as a simulator `BossPolicy`. It follows the env's decision rule (500 ms hold after "none"), and a test checks that it plays the same fight as the env.
- `bossTraining/bossArena.ts` turns the arena map into a `FightSetup`. Scripts and the page share it.

## Training Server

- SSH alias `capstone` (see `~/.ssh/config` on the dev PC). Do not put keys or passwords in this repo.
- Ubuntu 24.04 in a Docker container, 2× Xeon Gold 5317 (48 threads), 62 GB RAM, 4× RTX 3090 24 GB, 1.5 TB free disk.
- The GPUs are shared: 16-21 GB of each was already in use on 2026-10-06.
- Python 3.12 with `~/venv` (torch 2.5.1 CUDA 12.1, numpy), Node 24, npm 11.
- Installed on 2026-10-06 into `~/venv` from `rl/requirements.txt`: stable-baselines3 2.7.1, sb3-contrib 2.7.1, gymnasium 1.2.3, plus their small dependencies (pandas, matplotlib, cloudpickle). torch and numpy did not change.
- There is no `rsync` on the server. Copy with tar over ssh (see How To Run).
- Work folder: `~/boss-rl` (a copy of `rl/`).

## How To Run

```bash
npx vite-node scripts/simulate-boss-fight.ts
FIGHTS=1000 SEED=7 POTIONS=6 npx vite-node scripts/simulate-boss-fight.ts
WEAPON=bow npx vite-node scripts/simulate-boss-fight.ts
JSON=1 npx vite-node scripts/simulate-boss-fight.ts
npx vitest run src/games/my-sample-rpg/bossTraining

# build the env bundle and copy rl/ to the server
npm run rl:build
tar czf - -C rl --exclude runs --exclude __pycache__ . | ssh capstone 'mkdir -p ~/boss-rl && cd ~/boss-rl && tar xzf -'

# on the server
cd ~/boss-rl
~/venv/bin/python evaluate.py --policy rule --episodes 300
~/venv/bin/python train.py --timesteps 2000000 --envs 32 --name first-run
~/venv/bin/python evaluate.py --policy model --model runs/first-run/model.zip --episodes 300
# against the bow / magic bot: train, evaluate, export, then exit (frees the server)
setsid nohup ./run_weapon.sh bow bow-20m 22 1 > runs/bow-20m.log 2>&1 < /dev/null &
setsid nohup ./run_weapon.sh magic magic-20m 22 2 > runs/magic-20m.log 2>&1 < /dev/null &
```

- Do not stop runs with `pkill -f <pattern>` over ssh: the pattern also matches the ssh command itself and kills the session. Use a PID, or a bracket pattern like `pkill -f "[b]oss-env-server"`.
- Old zombie (`<defunct>`) processes on the server are children of PID 1, which does not reap them. They use no CPU or memory.

## Next Steps

1. ~~Decide the balance knobs.~~ Done on 2026-10-06 (see Balance).
2. ~~Build the Node ↔ Python bridge and a Gymnasium environment.~~ Done on 2026-10-06.
3. ~~Install the RL packages on the server.~~ Done on 2026-10-06. ~~First real training run.~~ Done on 2026-10-06 (`main-20m`, see Training Results).
4. Add the per-tier win-rate term to the reward and train again.
5. ~~Export the policy and load it into the game for the trial boss.~~ Done on 2026-10-06 (see Policy In The Game).
6. Optional: self-play, where the player is also trained.
7. ~~Train against the bow and magic bots.~~ Done on 2026-10-08 (`bow-20m`, `magic-20m`). Ranged players still win 99-100%. Before more training, decide whether the boss needs tools against ranged players (game balance) and add the per-tier win-rate term (step 4). Then decide whether one policy should face every weapon.
