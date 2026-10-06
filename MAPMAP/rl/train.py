"""Train the trial boss with MaskablePPO (docs/boss-rl-design.md, "RL Plan").

    python train.py --timesteps 2000000 --envs 32 --name first-run

Writes runs/<name>/model.zip, checkpoints, and progress.csv.
"""

import argparse
from pathlib import Path

from sb3_contrib import MaskablePPO
from stable_baselines3.common.callbacks import CheckpointCallback
from stable_baselines3.common.logger import configure
from stable_baselines3.common.vec_env import SubprocVecEnv, VecMonitor

from boss_env import BossFightEnv

RUNS_DIR = Path(__file__).resolve().parent / "runs"


def make_env(rank: int, base_seed: int):
    return lambda: BossFightEnv(seed=base_seed * 1000 + rank)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--timesteps", type=int, default=1_000_000)
    parser.add_argument("--envs", type=int, default=32)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--name", default="run")
    # The policy is a small MLP. The Node simulators on the CPU are the bottleneck, so the GPU does not help much.
    parser.add_argument("--device", default="cpu")
    args = parser.parse_args()

    out_dir = RUNS_DIR / args.name
    out_dir.mkdir(parents=True, exist_ok=True)
    env = VecMonitor(SubprocVecEnv([make_env(rank, args.seed) for rank in range(args.envs)]))
    model = MaskablePPO(
        "MlpPolicy",
        env,
        n_steps=256,
        batch_size=2048,
        n_epochs=5,
        learning_rate=3e-4,
        # One reward at the end of a fight of about 20-40 decisions, so look far ahead.
        gamma=0.995,
        ent_coef=0.01,
        policy_kwargs={"net_arch": [64, 64]},
        seed=args.seed,
        device=args.device,
        verbose=1,
    )
    model.set_logger(configure(str(out_dir), ["stdout", "csv"]))
    checkpoints = CheckpointCallback(save_freq=max(1, 200_000 // args.envs), save_path=str(out_dir / "checkpoints"))
    model.learn(total_timesteps=args.timesteps, callback=checkpoints)
    model.save(out_dir / "model")
    env.close()
    print(f"saved {out_dir / 'model.zip'}")


if __name__ == "__main__":
    main()
