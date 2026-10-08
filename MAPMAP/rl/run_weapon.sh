#!/bin/bash
# Train against one opponent weapon, evaluate, export, then exit (docs/boss-rl-design.md, "How To Run").
#
#   setsid nohup ./run_weapon.sh bow bow-20m 22 1 > runs/bow-20m.log 2>&1 < /dev/null &
#
# Arguments: <weapon> <run name> <envs> <seed> [timesteps]
set -e
cd "$(dirname "$0")"
WEAPON=$1
NAME=$2
ENVS=$3
SEED=$4
STEPS=${5:-20000000}

# One torch thread per process. Without this every env worker and the learner start one OpenMP thread per core and
# spin, so python ate about 37 cores while the Node simulators got about 2.
export OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1

~/venv/bin/python train.py --timesteps "$STEPS" --envs "$ENVS" --seed "$SEED" --weapon "$WEAPON" --name "$NAME"
~/venv/bin/python evaluate.py --policy rule --weapon "$WEAPON" --episodes 500 > "runs/$NAME/eval-rule.txt"
~/venv/bin/python evaluate.py --policy model --model "runs/$NAME/model.zip" --weapon "$WEAPON" --episodes 500 > "runs/$NAME/eval-model.txt"
~/venv/bin/python evaluate.py --policy model --model "runs/$NAME/model.zip" --weapon sword --episodes 500 > "runs/$NAME/eval-model-vs-sword.txt"
~/venv/bin/python export_policy.py "runs/$NAME/model.zip" "runs/$NAME/trial-boss-policy.json"
touch "runs/$NAME/DONE"
