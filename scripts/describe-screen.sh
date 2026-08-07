#!/usr/bin/env bash
set -euo pipefail
OLLAMA_HOST="${OLLAMA_HOST:-100.95.92.117:11434}"
MODEL="${1:-qwen3.5:2b}"
PROMPT="${2:-Describe what is on this computer screen in 2-3 short sentences. Name visible app windows and any text you can read.}"
SHOT="${3:-$(mktemp --suffix=.png)}"
capture() {
  DISPLAY="${DISPLAY:-:0}" timeout 15 gnome-screenshot -f "$SHOT" >/dev/null 2>&1 || true
}
if [ ! -s "$SHOT" ]; then
  capture
fi
run_vision() {
  python3 - "$SHOT" "$MODEL" "$PROMPT" "$OLLAMA_HOST" <<'PY'
import base64, json, sys, urllib.request
img = open(sys.argv[1], 'rb').read()
if not img:
    sys.exit(2)
payload = {'model': sys.argv[2], 'prompt': sys.argv[3],
           'images': [base64.b64encode(img).decode()], 'stream': False, 'think': False}
req = urllib.request.Request(f'http://{sys.argv[4]}/api/generate',
                             data=json.dumps(payload).encode(),
                             headers={'Content-Type': 'application/json'})
try:
    print(json.load(urllib.request.urlopen(req, timeout=180))['response'])
except Exception as e:
    print(f'VISION_ERROR: {e}', file=sys.stderr)
    sys.exit(1)
PY
}
if ! run_vision; then
  capture
  run_vision
fi
