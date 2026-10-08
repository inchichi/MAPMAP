"""Win rate and fun over training: evaluate saved checkpoints per tier (docs/boss-rl-design.md).

    python eval_checkpoints.py --run bow-20m --weapon bow --count 10 --episodes 200 --workers 30

Writes runs/<run>/checkpoint-eval.csv with one row per (checkpoint, tier).
"""

import argparse
import csv
import re
from multiprocessing import Pool
from pathlib import Path

import numpy as np

from boss_env import TIERS, BossFightEnv

RUNS_DIR = Path(__file__).resolve().parent / "runs"


def evaluate(job):
    path, steps, tier, weapon, episodes, seed = job
    from sb3_contrib import MaskablePPO

    model = MaskablePPO.load(path, device="cpu")
    env = BossFightEnv(seed=seed, tier=tier, weapon=weapon)
    wins, durations, funs = 0, [], []
    for _ in range(episodes):
        observation, info = env.reset()
        done = False
        while not done:
            action, _ = model.predict(observation, action_masks=env.action_masks(), deterministic=True)
            observation, _, done, _, info = env.step(action)
        wins += info["outcome"] == "player-win"
        durations.append(info["durationMilliseconds"] / 1000)
        funs.append(info["fun"]["total"])
    env.close()
    return {
        "steps": steps,
        "tier": tier,
        "win_rate": wins / episodes,
        "seconds": float(np.mean(durations)),
        "fun": float(np.mean(funs)),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", required=True)
    parser.add_argument("--weapon", default="sword")
    parser.add_argument("--count", type=int, default=10)
    parser.add_argument("--episodes", type=int, default=200)
    parser.add_argument("--workers", type=int, default=30)
    parser.add_argument("--seed", type=int, default=12345)
    args = parser.parse_args()

    run_dir = RUNS_DIR / args.run
    checkpoints = sorted(
        (int(re.search(r"_(\d+)_steps", path.name).group(1)), path)
        for path in (run_dir / "checkpoints").glob("*_steps.zip")
    )
    # evenly spaced checkpoints, always including the last one
    picks = sorted({round(i * (len(checkpoints) - 1) / max(1, args.count - 1)) for i in range(args.count)})
    jobs = [
        (str(checkpoints[i][1]), checkpoints[i][0], tier, args.weapon, args.episodes, args.seed)
        for i in picks
        for tier in TIERS
    ]
    with Pool(args.workers) as pool:
        rows = pool.map(evaluate, jobs)
    with open(run_dir / "checkpoint-eval.csv", "w", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(sorted(rows, key=lambda row: (row["steps"], TIERS.index(row["tier"]))))
    print(f"wrote {run_dir / 'checkpoint-eval.csv'} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
