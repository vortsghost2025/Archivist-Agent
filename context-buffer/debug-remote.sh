set -euo pipefail
source ~/.bashrc >/dev/null 2>&1 || true
mkdir -p ~/agent/logs

declare -a LANE_MAP=(
  "library:self-organizing-library"
  "kernel:kernel-lane"
  "swarmmind:SwarmMind"
)

for pair in "${LANE_MAP[@]}"; do
  lane="${pair%%:*}"
  repo="${pair##*:}"
  root="$HOME/agent/repos/$repo"
  if [ ! -d "$root" ]; then
    echo "MISSING:$lane:$root"
    continue
  fi

  pkill -f "$root/scripts/lane-worker.js" || true
  pkill -f "$root/scripts/heartbeat.js --lane $lane" || true

  nohup node "$root/scripts/lane-worker.js" --apply --watch --poll-seconds 20 > "$HOME/agent/logs/${lane}-worker.log" 2>&1 &
  worker_pid=$!
  nohup node "$root/scripts/heartbeat.js" --lane "$lane" > "$HOME/agent/logs/${lane}-heartbeat.log" 2>&1 &
  heartbeat_pid=$!

  echo "STARTED:$lane:worker=$worker_pid:heartbeat=$heartbeat_pid"
done
