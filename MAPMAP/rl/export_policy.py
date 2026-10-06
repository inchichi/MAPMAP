"""Export a trained boss policy as JSON for the game (docs/boss-rl-design.md, "Policy In The Game").

    python export_policy.py runs/main-20m/model.zip runs/main-20m/trial-boss-policy.json

The JSON holds only the actor: observation -> tanh(Linear) -> tanh(Linear) -> Linear -> action scores.
It also stores sample observations with the scores and actions Python picked, so the TypeScript side
can check that it computes the same thing.
"""

import json
import sys

import numpy as np
import torch
from sb3_contrib import MaskablePPO

from boss_env import TIERS, BossFightEnv

SAMPLES_PER_TIER = 20


def main():
    model_path, out_path = sys.argv[1], sys.argv[2]
    model = MaskablePPO.load(model_path, device="cpu")
    state = model.policy.state_dict()
    layers = [
        ("mlp_extractor.policy_net.0", "tanh"),
        ("mlp_extractor.policy_net.2", "tanh"),
        ("action_net", "linear"),
    ]
    exported_layers = [
        {
            "weight": state[f"{name}.weight"].tolist(),
            "bias": state[f"{name}.bias"].tolist(),
            "activation": activation,
        }
        for name, activation in layers
    ]

    samples = []
    for tier in TIERS:
        env = BossFightEnv(seed=777, tier=tier)
        observation, _ = env.reset()
        for _ in range(SAMPLES_PER_TIER):
            mask = env.action_masks()
            with torch.no_grad():
                features = torch.as_tensor(observation[None, :])
                scores = model.policy.action_net(model.policy.mlp_extractor.forward_actor(features))[0].numpy()
            action, _ = model.predict(observation, action_masks=mask, deterministic=True)
            samples.append(
                {
                    "observation": observation.tolist(),
                    "actionMask": mask.tolist(),
                    "scores": scores.tolist(),
                    "action": int(action),
                }
            )
            observation, _, done, _, _ = env.step(action)
            if done:
                observation, _ = env.reset()
        env.close()

    with open(out_path, "w") as file:
        json.dump(
            {
                "observationNames": env.observation_names,
                "actions": env.action_names,
                "layers": exported_layers,
                "samples": samples,
            },
            file,
        )
    print(f"wrote {out_path} ({len(samples)} samples)")


if __name__ == "__main__":
    main()
