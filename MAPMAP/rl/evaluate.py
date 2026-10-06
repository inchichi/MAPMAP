"""Compare boss policies against each bot tier on the same seeds (docs/boss-rl-design.md).

    python evaluate.py --policy rule                       # current game boss (baseline)
    python evaluate.py --policy model --model runs/first-run/model.zip
"""

import argparse
from collections import Counter

import numpy as np

from boss_env import TIERS, BossFightEnv

TARGET_WIN_RATE = {"novice": (0.30, 0.50), "normal": (0.55, 0.75), "expert": (0.85, 0.97)}


def first_allowed_skill(mask: np.ndarray) -> int:
    # Same as the game today: the first available skill in list order, or no skill.
    allowed = np.flatnonzero(mask[1:])
    return int(allowed[0]) + 1 if len(allowed) else 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--policy", choices=["rule", "model", "random"], default="rule")
    parser.add_argument("--model")
    parser.add_argument("--episodes", type=int, default=300)
    parser.add_argument("--seed", type=int, default=12345)
    args = parser.parse_args()

    model = None
    if args.policy == "model":
        from sb3_contrib import MaskablePPO

        model = MaskablePPO.load(args.model, device="cpu")
    rng = np.random.default_rng(args.seed)

    print(f"policy={args.policy} episodes/tier={args.episodes}")
    for tier in TIERS:
        env = BossFightEnv(seed=args.seed, tier=tier)
        wins, durations, funs, hp_left = 0, [], [], []
        skills = Counter()
        for _ in range(args.episodes):
            observation, info = env.reset()
            done = False
            while not done:
                mask = env.action_masks()
                if model is not None:
                    action, _ = model.predict(observation, action_masks=mask, deterministic=True)
                elif args.policy == "random":
                    action = rng.choice(np.flatnonzero(mask))
                else:
                    action = first_allowed_skill(mask)
                observation, reward, done, _, info = env.step(action)
            wins += info["outcome"] == "player-win"
            durations.append(info["durationMilliseconds"] / 1000)
            funs.append(info["fun"]["total"])
            if info["outcome"] == "player-win":
                hp_left.append(info["playerHpRatio"])
            skills.update(info["skillUses"])
        env.close()
        low, high = TARGET_WIN_RATE[tier]
        win_rate = wins / args.episodes
        mark = "ok" if low <= win_rate <= high else "off"
        uses = ", ".join(f"{name} {count / args.episodes:.1f}" for name, count in skills.most_common())
        print(
            f"[{tier}] win {win_rate:.0%} (target {low:.0%}-{high:.0%} {mark}) "
            f"| {np.mean(durations):.1f}s | hp left on win {np.mean(hp_left) if hp_left else 0:.0%} "
            f"| fun {np.mean(funs):.3f}\n  skills/fight: {uses}"
        )


if __name__ == "__main__":
    main()
