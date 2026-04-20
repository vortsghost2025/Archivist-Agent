# Inbox Watcher Design

## Problem

Currently, lanes only process inbox messages when explicitly activated. This creates:
- Coordinator must manually route messages
- Lanes can't respond autonomously
- Latency between message send and processing

## Solution

Inbox Watcher: A background process that monitors lane inboxes and triggers processing.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    INBOX WATCHER                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│   │  File Watch  │───▶│  Priority    │───▶│   Trigger    │ │
│   │  (inotify)   │    │  Sorter      │    │   Agent      │ │
│   └──────────────┘    └──────────────┘    └──────────────┘ │
│          │                   │                   │         │
│          ▼                   ▼                   ▼         │
│   New message          P0 > P1 > P2         Agent          │
│   detected             > P3                 activation     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Options

### Option A: Shell Script + Cron
```bash
#!/bin/bash
# watch-inbox.sh

INBOX="lanes/library/inbox"
PROCESSED="lanes/library/inbox/processed"

for msg in $(ls -1 "$INBOX"/*.json 2>/dev/null | sort); do
  # Extract priority
  priority=$(jq -r '.priority' "$msg")
  
  # Process by priority
  if [ "$priority" = "P0" ]; then
    echo "Processing P0: $msg"
    # Trigger agent activation
    kilo run --agent library --task "process-inbox"
  fi
  
  # Move to processed
  mv "$msg" "$PROCESSED/"
done
```

**Pros:** Simple, portable
**Cons:** Polling-based, not real-time

### Option B: Node.js File Watcher
```javascript
// inbox-watcher.js
const fs = require('fs');
const path = require('path');

const inboxPath = './lanes/library/inbox';

fs.watch(inboxPath, (eventType, filename) => {
  if (eventType === 'rename' && filename.endsWith('.json')) {
    const msgPath = path.join(inboxPath, filename);
    const msg = JSON.parse(fs.readFileSync(msgPath, 'utf8'));
    
    if (msg.priority === 'P0') {
      console.log(`P0 detected: ${msg.subject}`);
      // Trigger agent via subprocess
      require('child_process').exec('kilo run --agent library --task process-inbox');
    }
  }
});
```

**Pros:** Real-time, event-driven
**Cons:** Requires Node runtime, process management

### Option C: Git Hook (Post-Receive)
```bash
#!/bin/bash
# .git/hooks/post-receive

while read oldrev newrev refname; do
  # Check if lanes/ changed
  if git diff --name-only $oldrev $newrev | grep -q "lanes/"; then
    # Extract changed messages
    for msg in $(git diff --name-only $oldrev $newrev | grep "lanes/.*inbox.*\.json"); do
      echo "New inbox message: $msg"
      # Notify agent
      notify-send "Lane Inbox" "New message in $msg"
    done
  fi
done
```

**Pros:** Integrated with git workflow
**Cons:** Only triggers on push, not local writes

---

## Recommended Implementation

**Phase 1: Manual Processing (Current)**
- Keep current workflow
- Document routing protocol
- Train on correct paths

**Phase 2: Cron-Based Polling**
- Add shell script for each lane
- Cron job every 5 minutes
- Auto-process P0 messages

**Phase 3: Real-Time Watcher**
- Node.js file watcher
- Integration with Kilo
- Auto-spawn agent on P0

**Phase 4: Unified Hub**
- Central inbox service
- WebSocket notifications
- Dashboard for monitoring

---

## File Structure

```
lanes/
├── archivist/
│   ├── inbox/
│   │   ├── watcher.pid        # Watcher process ID
│   │   ├── watcher.log        # Watcher activity log
│   │   └── *.json             # Incoming messages
│   └── outbox/
├── library/
│   ├── inbox/
│   │   ├── watcher.pid
│   │   ├── watcher.log
│   │   └── *.json
│   └── outbox/
└── swarmmind/
    ├── inbox/
    │   ├── watcher.pid
    │   ├── watcher.log
    │   └── *.json
    └── outbox/
```

---

## Watcher Script Template

```bash
#!/bin/bash
# lanes/library/inbox/watcher.sh

set -euo pipefail

INBOX="$(dirname "$0")"
PROCESSED="$INBOX/processed"
LOG="$INBOX/watcher.log"
PIDFILE="$INBOX/watcher.pid"

# Ensure single instance
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "Watcher already running (PID $(cat "$PIDFILE"))"
  exit 1
fi
echo $$ > "$PIDFILE"

log() {
  echo "[$(date -Iseconds)] $1" >> "$LOG"
}

process_message() {
  local msg="$1"
  local priority=$(jq -r '.priority' "$msg" 2>/dev/null || echo "P3")
  
  log "Processing: $msg (priority: $priority)"
  
  case "$priority" in
    P0)
      log "CRITICAL: P0 message detected - immediate processing"
      # Trigger agent activation
      # This would integrate with your agent runner
      ;;
    P1)
      log "HIGH: P1 message queued"
      ;;
    P2|P3)
      log "NORMAL: Low priority message queued"
      ;;
  esac
  
  # Move to processed
  mv "$msg" "$PROCESSED/" 2>/dev/null || true
}

# Main loop
log "Watcher started (PID $$)"

while true; do
  for msg in $(ls -1 "$INBOX"/*.json 2>/dev/null | sort -r); do
    process_message "$msg"
  done
  sleep 60  # Poll every minute
done
```

---

## Integration with Kilo

The watcher would trigger agent activation via:

```bash
# When P0 detected
kilo run --agent library --task "process-inbox" --priority P0

# Or for continuous monitoring
kilo run --agent library --watch inbox
```

This requires Kilo to support:
- `--task` flag for specific tasks
- `--watch` flag for inbox monitoring
- `--priority` flag for urgency

---

## Status

- **Phase:** Draft
- **Implementation:** Not started
- **Dependencies:** Kilo agent runner integration

---

## Next Steps

1. Review and approve design
2. Implement Phase 2 (Cron-based polling)
3. Test with real messages
4. Iterate based on performance
5. Implement Phase 3 (Real-time watcher)
