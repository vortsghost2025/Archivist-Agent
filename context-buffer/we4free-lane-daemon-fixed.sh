#!/usr/bin/env bash
set -euo pipefail

DAEMON="${1:?Usage: we4free-lane-daemon <daemon> <lane>}"
LANE="${2:?Usage: we4free-lane-daemon <daemon> <lane>}"

LANE="${LANE%.lane}"

REPOS="/home/we4free/agent/repos"
NODE="/home/we4free/.nvm/versions/node/v20.20.2/bin/node"
PID_DIR="/run/user/$(id -u)/we4free-lane-daemon"
PID_FILE="${PID_DIR}/${DAEMON}-${LANE}.pid"

declare -A LANE_REPO
LANE_REPO[archivist]="Archivist-Agent"
LANE_REPO[kernel]="kernel-lane"
LANE_REPO[library]="self-organizing-library"
LANE_REPO[swarmmind]="SwarmMind"

REPO="${LANE_REPO[$LANE]:?Unknown lane: $LANE}"

mkdir -p "$PID_DIR"

if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
        echo "${DAEMON}/${LANE} already running as PID $OLD_PID, stopping it"
        kill "$OLD_PID" 2>/dev/null || true
        for i in $(seq 1 10); do
            kill -0 "$OLD_PID" 2>/dev/null || break
            sleep 0.5
        done
        if kill -0 "$OLD_PID" 2>/dev/null; then
            echo "${DAEMON}/${LANE} PID $OLD_PID refused to exit, force killing"
            kill -9 "$OLD_PID" 2>/dev/null || true
            sleep 0.5
        fi
    fi
    rm -f "$PID_FILE"
fi

cd "$REPOS/$REPO"

export HOME=/home/we4free
export NVM_DIR=/home/we4free/.nvm
export PATH="/home/we4free/.nvm/versions/node/v20.20.2/bin:$PATH"
export NODE_ENV=production

cleanup() {
    rm -f "$PID_FILE"
}
trap cleanup EXIT

echo $$ > "$PID_FILE"

case "$DAEMON" in
    heartbeat)
        exec "$NODE" "$REPOS/$REPO/scripts/heartbeat.js" --lane "$LANE" --continuous --interval 60
        ;;
    lane-worker)
        exec "$NODE" "$REPOS/$REPO/scripts/lane-worker.js" --lane "$LANE" --apply --watch --poll-seconds 20
        ;;
    relay-daemon)
        exec "$NODE" "$REPOS/$REPO/scripts/relay-daemon.js" --lane "$LANE" --apply --watch --poll-seconds 20
        ;;
    autonomous-executor)
        exec "$NODE" "$REPOS/$REPO/scripts/autonomous-executor.js" "$LANE" --apply --poll-ms 15000 --remediator-ms 600000
        ;;
    *)
        echo "Unknown daemon: $DAEMON" >&2
        exit 1
        ;;
esac
