# Deploy Plan: Starmap + P011 NPC Agency to VPS

**Created:** 2026-06-24 20:25
**Project:** S:\federation
**VPS:** root@187.77.3.56 (alias: federation-vps)

## Current State

- Local HEAD: `a760cce` (2 commits ahead of VPS)
- VPS `/opt/federation` HEAD: `c28b9dc` (P011 code already in git, not deployed to Docker)
- VPS containers: all healthy (15 containers running)
- starmap3d.html: 2 uncommitted local changes (HORIZON_STATUS.md + starmap3d.html)
- P011 files exist in VPS `/opt/federation` but NOT in Docker runtime paths

## Deploy Steps

### Step 1: Commit uncommitted starmap changes
```bash
cd S:\federation
git add federation-game/frontend/starmap3d.html .horizon/HORIZON_STATUS.md
git commit -m "chore: update starmap + horizon status for deploy"
```

### Step 2: Push to remote
```bash
git push origin main
```

### Step 3: VPS — pull latest + copy starmap to Docker frontend
```bash
ssh root@187.77.3.56
cd /opt/federation && git pull
cp /opt/federation/federation-game/frontend/starmap3d.html /docker/federation-game/federation-game/frontend/
```

### Step 4: VPS — deploy P011 backend files to Docker
```bash
cp /opt/federation/federation-game/backend/npc_artifacts.py /docker/federation-game/backend/
cp /opt/federation/federation-game/backend/npc_messaging.py /docker/federation-game/backend/
cp /opt/federation/federation-game/backend/npc_sandbox.py /docker/federation-game/backend/
cp /opt/federation/federation-game/backend/npc_cognition.py /docker/federation-game/backend/
```

### Step 5: VPS — deploy npc-sandbox directory + updated docker-compose
```bash
cp -r /opt/federation/federation-game/npc-sandbox /docker/federation-game/
cp /opt/federation/federation-game/docker-compose-vps.yml /docker/federation-game/docker-compose.yml
```

### Step 6: VPS — build sandbox container + restart backend/worker
```bash
cd /docker/federation-game
docker compose build npc-sandbox
docker compose up -d npc-sandbox
docker compose restart backend worker
```

### Step 7: Verify
```bash
curl -s http://localhost:9002/health          # sandbox health
docker compose ps                              # all containers up
docker logs federation-game-worker-1 --tail 20 # worker healthy
curl -s https://federation-game.deliberatefederation.cloud/starmap3d.html | head -5  # starmap served
```

## Rollback

If anything breaks:
```bash
# Revert docker-compose
cd /docker/federation-game
git -C /opt/federation checkout c28b9dc
cp /opt/federation/federation-game/docker-compose.yml /docker/federation-game/docker-compose.yml
docker compose down npc-sandbox
docker compose restart backend worker
```

## Risk Assessment

- **Low risk:** starmap deploy is just a frontend HTML file copy
- **Medium risk:** P011 adds a new container (npc-sandbox) + modifies docker-compose. If sandbox build fails, backend/worker still work (SANDBOX_URL is optional)
- **Rollback is clean:** revert docker-compose, remove sandbox container
