# QUICK START: Lane Paths for Agents

**STOP. Read this first. DO NOT GUESS PATHS.**

---

## 🎯 Your Mission
You are an agent in a multi-lane system. You need to send/receive messages with other lanes.

**You MUST use the correct paths below. NO GUESSING.**

---

## 📂 Where Are You?

Find your lane's directory:

| Lane | Your Local Directory | What You Read | What You Write |
|------|---------------------|---------------|----------------|
| **Archivist** | `S:/Archivist-Agent` | `lanes/archivist/inbox` | `lanes/archivist/outbox` |
| **Authority** | `S:/Archivist-Agent` | `lanes/authority/inbox` | `lanes/authority/outbox` |
| **Kernel** | `S:/kernel-lane` | `lanes/kernel/inbox` | `lanes/kernel/outbox` |
| **SwarmMind** | `S:/SwarmMind` | `lanes/swarmmind/inbox` | `lanes/swarmmind/outbox` |
| **Library** | `S:/self-organizing-library` | `lanes/library/inbox` | `lanes/library/outbox` |

**Common Mistake:** Don't use long paths with spaces like `SwarmMind Self-Optimizing Multi-Agent AI System`

**Correct:** `S:/SwarmMind` only

---

## 📤 Sending Messages to Other Lanes

To send a message to another lane, write to THEIR inbox:

```javascript
// Example: Kernel sending to SwarmMind
const messagePath = "S:/SwarmMind/lanes/swarmmind/inbox/my-message.json";

// Example: Archivist sending to Library  
const messagePath = "S:/self-organizing-library/lanes/library/inbox/task.json";

// Example: SwarmMind sending to Authority
const messagePath = "S:/Archivist-Agent/lanes/authority/inbox/report.json";
```

---

## 📨 Receiving Messages

Your inbox is where OTHER lanes write to YOU:

```javascript
// SwarmMind checks its inbox
const inboxPath = "S:/SwarmMind/lanes/swarmmind/inbox";
// Look for files from Kernel, Archivist, etc.

// Kernel checks its inbox
const inboxPath = "S:/kernel-lane/lanes/kernel/inbox";
// Look for files from Authority, SwarmMind, etc.
```

---

## 📢 Broadcast Messages

All lanes can read/write to the shared broadcast:

```javascript
const broadcastPath = "S:/Archivist-Agent/lanes/broadcast";
```

---

## 🔧 Code Example: Lane Discovery (Recommended)

```javascript
// Load the lane discovery utility
const { LaneDiscovery } = require('S:/Archivist-Agent/.global/lane-discovery.js');
const discovery = new LaneDiscovery();

// Get any lane's inbox
const archivistInbox = discovery.getInbox('archivist');
// Returns: "S:/Archivist-Agent/lanes/archivist/inbox"

const swarmmindInbox = discovery.getInbox('swarmmind');
// Returns: "S:/SwarmMind/lanes/swarmmind/inbox"

const libraryInbox = discovery.getInbox('library');
// Returns: "S:/self-organizing-library/lanes/library/inbox"

// Get outbox
const myOutbox = discovery.getOutbox('swarmmind');
// Returns: "S:/SwarmMind/lanes/swarmmind/outbox"

// Send message to another lane
discovery.sendToLane('kernel', 'swarmmind', messageObject, 'task-001.json');
// Automatically writes to S:/SwarmMind/lanes/swarmmind/inbox/task-001.json
```

---

## 🚫 FORBIDDEN PATHS (Will Fail)

These paths look right but are WRONG:

- ❌ `S:/SwarmMind Self-Optimizing Multi-Agent AI System` - Contains spaces
- ❌ `S:/SwarmMind-Self-Optimizing-Multi-Agent-AI-System` - Contains hyphens
- ❌ `/SwarmMind/` - Missing drive letter
- ❌ `SwarmMind/` - Relative path

**Use only:** `S:/SwarmMind`

---

## 🐧 Git Bash vs Windows Paths

| Environment | SwarmMind Path | Kernel Path |
|-------------|----------------|-------------|
| **Windows** | `S:\SwarmMind` | `S:\kernel-lane` |
| **Git Bash** | `/s/SwarmMind` | `/s/kernel-lane` |
| **Node.js** | `S:/SwarmMind` | `S:/kernel-lane` |

**Note:** Git Bash uses `/s/` instead of `S:/`

---

## ✅ Quick Checklist

Before sending any message:

- [ ] Path starts with `S:/` or `S:\`
- [ ] Lane name is lowercase (swarmmind, not SwarmMind)
- [ ] No spaces or hyphens in directory names
- [ ] Writing to THEIR inbox, not yours
- [ ] Target directory exists

---

## 🆘 Still Confused?

**Read these files:**
1. `S:/Archivist-Agent/BOOTSTRAP.md` - Entry point
2. `S:/Archivist-Agent/.global/lane-registry.json` - Full path registry
3. `S:/Archivist-Agent/.global/lane-discovery.js` - Path helper code

**Do not guess. Look it up.**
