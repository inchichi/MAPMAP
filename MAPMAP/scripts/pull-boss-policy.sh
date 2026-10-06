#!/usr/bin/env bash
# 학습 서버의 보스 정책을 JSON 으로 내보내 이 PC 의 rl/runs/<run>/ 으로 가져온다(docs/boss-rl-design.md).
# 시뮬레이터 화면(boss-sim.html)의 정책 목록에 바로 뜬다. 게임에 들어간 정책은 바꾸지 않는다.
#
#   npm run rl:pull               서버에 있는 run 목록
#   npm run rl:pull -- main-20m   그 run 을 내보내고 가져온다
set -euo pipefail

if [ $# -eq 0 ]; then
  ssh capstone 'ls ~/boss-rl/runs'
  exit 0
fi

run="$1"
ssh capstone "cd ~/boss-rl && ~/venv/bin/python export_policy.py runs/$run/model.zip runs/$run/trial-boss-policy.json"
mkdir -p "rl/runs/$run"
scp "capstone:boss-rl/runs/$run/trial-boss-policy.json" "rl/runs/$run/"
scp "capstone:boss-rl/runs/$run/progress.csv" "rl/runs/$run/" 2>/dev/null || true
echo "rl/runs/$run/trial-boss-policy.json"
