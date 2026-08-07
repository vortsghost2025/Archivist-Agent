#!/usr/bin/env bash
set -uo pipefail
LOG="/home/we4free/agent/repos/Archivist-Agent/context-buffer/desktop-probe.log"
SHOT="$(mktemp --suffix=.png)"
PROMPT="You are a desktop health monitor. Report ONLY anomalies: black screen, frozen UI, unexpected error dialogs, or a completely empty desktop. If the desktop looks normal with a terminal and/or a visible app window, reply: HEALTHY. Otherwise name the anomaly in one short sentence."
TRAP_CMD="rm -f $SHOT"
trap 'rm -f "$SHOT"' EXIT

DISPLAY="${DISPLAY:-:0}" timeout 15 gnome-screenshot -f "$SHOT" >/dev/null 2>&1
if [ ! -s "$SHOT" ]; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] CAPTURE_FAILED" >> "$LOG"
  exit 1
fi

OUT=$(python3 - "$SHOT" "$PROMPT" <<'PY'
import base64, json, sys, urllib.request
img = open(sys.argv[1], 'rb').read()
payload = {'model': 'qwen3.5:2b', 'prompt': sys.argv[2],
           'images': [base64.b64encode(img).decode()], 'stream': False, 'think': False}
req = urllib.request.Request('http://100.95.92.117:11434/api/generate',
                             data=json.dumps(payload).encode(),
                             headers={'Content-Type': 'application/json'})
try:
    print(json.load(urllib.request.urlopen(req, timeout=120))['response'])
except Exception as e:
    print(f'VISION_ERROR: {e}')
PY
)

echo "$OUT" | grep -qi "HEALTHY" || echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $OUT" >> "$LOG"
