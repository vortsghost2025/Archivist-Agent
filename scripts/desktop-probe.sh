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

if python3 - "$SHOT" <<'PY'
import sys, zlib, struct
def avg(path):
    with open(path, 'rb') as f: data = f.read()
    pos = 8; idat = b''
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos+4])[0]
        if data[pos+4:pos+8] == b'IDAT': idat += data[pos+8:pos+8+ln]
        pos += 12 + ln
    raw = zlib.decompress(idat)
    n = len(raw)
    if n < 1000: return 0
    return sum(raw[i] for i in range(0, n, 97)) * 97 // n
sys.exit(0 if avg(sys.argv[1]) < 8 else 1)
PY
then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] SCREEN_BLANKED (idle or display off - benign)" >> "$LOG"
  exit 0
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
