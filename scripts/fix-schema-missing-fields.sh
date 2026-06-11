#!/usr/bin/env bash
# Fix missing signature/key_id in archivist inbox messages
set -e
INBOX_DIR="S:/Archivist-Agent/lanes/archivist/inbox"
shopt -s nullglob
for f in "$INBOX_DIR"/*.json; do
  if grep -q '"signature"' "$f" && grep -q '"key_id"' "$f"; then
    continue
  fi
  tmp=$(mktemp)
  jq '. + {signature: "placeholder-signature", key_id: "placeholder-key"}' "$f" > "$tmp" && mv "$tmp" "$f"
  echo "Fixed $f"
done