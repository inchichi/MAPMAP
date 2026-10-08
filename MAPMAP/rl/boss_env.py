"""Gymnasium wrapper around the headless trial-boss simulator (docs/boss-rl-design.md).

Each env starts one Node child process (dist/boss-env-server.mjs, built by `npm run rl:build`)
and talks to it with one JSON object per line. One step = one boss decision.
"""

import json
import subprocess
from pathlib import Path

import gymnasium as gym
import numpy as np

DIST_DIR = Path(__file__).resolve().parent / "dist"
TIERS = ("novice", "normal", "expert")
WEAPONS = ("sword", "bow", "magic")


class BossFightEnv(gym.Env):
    metadata = {"render_modes": []}

    def __init__(self, seed: int = 0, tier: str | None = None, weapon: str = "sword", server_path: Path | None = None):
        # tier=None picks a random opponent tier every episode (training). Set it to fix the opponent (evaluation).
        # weapon is the opponent bot's weapon: "sword" (melee), "bow" or "magic" (both keep distance and shoot).
        self._tier = tier
        self._weapon = weapon
        self._episode_seed = seed * 1_000_003
        self._process = subprocess.Popen(
            ["node", str(server_path or DIST_DIR / "boss-env-server.mjs"), str(DIST_DIR / "boss-arena.json")],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        spec = self._call({"cmd": "spec"})
        self.observation_names = spec["observationNames"]
        self.action_names = spec["actions"]
        self.observation_space = gym.spaces.Box(-np.inf, np.inf, shape=(len(self.observation_names),), dtype=np.float32)
        self.action_space = gym.spaces.Discrete(len(self.action_names))
        self._mask = np.ones(len(self.action_names), dtype=bool)

    def _call(self, message: dict) -> dict:
        self._process.stdin.write(json.dumps(message) + "\n")
        self._process.stdin.flush()
        reply = json.loads(self._process.stdout.readline())
        if "error" in reply:
            raise RuntimeError(reply["error"])
        return reply

    def _unpack(self, reply: dict):
        self._mask = np.array(reply["actionMask"], dtype=bool)
        return np.array(reply["observation"], dtype=np.float32), reply

    def reset(self, *, seed: int | None = None, options: dict | None = None):
        super().reset(seed=seed)
        if seed is not None:
            self._episode_seed = seed
        self._episode_seed += 1
        message = {"cmd": "reset", "seed": self._episode_seed, "weapon": self._weapon}
        tier = (options or {}).get("tier", self._tier)
        if tier:
            message["tier"] = tier
        observation, reply = self._unpack(self._call(message))
        return observation, reply["info"]

    def step(self, action):
        observation, reply = self._unpack(self._call({"cmd": "step", "action": int(action)}))
        return observation, float(reply["reward"]), bool(reply["done"]), False, reply["info"]

    # MaskablePPO reads this to block skills that are on cooldown. The trial boss has no range limit.
    def action_masks(self) -> np.ndarray:
        return self._mask

    def close(self):
        if self._process.poll() is None:
            self._process.stdin.close()
            self._process.terminate()
            self._process.wait()
