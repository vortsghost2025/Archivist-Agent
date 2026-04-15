# Quick Start for Restarted Session

## Immediate Actions After Restart

### 1. Verify Config Loaded
```bash
# Check project config exists
cat S:/Archivist-Agent/.kilo/kilo.jsonc

# Check global config exists
cat C:/Users/seand/.config/kilo/kilo.jsonc
```

### 2. Verify Ollama Models
```bash
ollama list | grep -E "qwen2.5-coder|deepseek-coder"
# Should show both models
```

### 3. Run Bridge Tests
```bash
cd S:/Archivist-Agent
node src/bridge/__tests__/bridge.test.js
# Should output: ✓ ALL TESTS PASSED
```

### 4. Test Local Routing
Ask any simple question and verify:
- Response comes quickly (local should be fast)
- No 429 errors
- Model mentioned should be `ollama/qwen2.5-coder:7b` or `ollama/deepseek-coder:6.7b`

---

## If Kilo --continue Fails

### Fallback 1: Import from Handoff
```
Load this file: S:/Archivist-Agent/.artifacts/SESSION_HANDOFF_2026-04-15.md
```

### Fallback 2: Manual Config Check
```bash
# Verify configs are valid JSON
node -e "console.log(JSON.parse(require('fs').readFileSync('C:/Users/seand/.config/kilo/kilo.jsonc')))"
node -e "console.log(JSON.parse(require('fs').readFileSync('S:/Archivist-Agent/.kilo/kilo.jsonc')))"
```

### Fallback 3: Governance Entry Point
```
Read S:/.global/BOOTSTRAP.md first
```

---

## Key Files to Know

| Purpose | File |
|---------|------|
| Session Handoff | `.artifacts/SESSION_HANDOFF_2026-04-15.md` |
| Architecture | `.artifacts/THREE_LAYER_ARCHITECTURE.md` |
| Project Config | `.kilo/kilo.jsonc` |
| Global Config | `C:/Users/seand/.config/kilo/kilo.jsonc` |
| Governance Entry | `S:/.global/BOOTSTRAP.md` |
| Tests | `src/bridge/__tests__/bridge.test.js` |

---

## Quick Test Commands

```bash
# Test verification module
node -e "const v = require('./src/bridge/swarmmind-verify'); console.log(v.VERIFICATION_CATEGORIES);"

# Test routing logger
node -e "const l = require('./src/bridge/routing-logger'); console.log('LOG_DIR:', l.LOG_DIR);"

# Test provider profiles
node -e "const p = require('./src/bridge/provider-profiles'); console.log(p.getProfile('local-fast'));"

# Test agent permissions
node -e "const a = require('./src/bridge/agent-permissions'); console.log(a.getAgentPermissions('code'));"
```

---

## First Task for New Agent

Ask the restarted agent:

> "What model are you using for the 'general' agent? Check your config and tell me the exact model ID."

Expected answer: `ollama/qwen2.5-coder:7b`

If they say `z-ai/glm5` or anything else, the config didn't load correctly.

---

**Status**: Ready for restart
**Critical File**: `SESSION_HANDOFF_2026-04-15.md`
