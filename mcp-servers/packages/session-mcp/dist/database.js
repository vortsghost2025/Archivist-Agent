import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
function nowISO() {
    return new Date().toISOString();
}
export async function openSessionDb(dbPath) {
    const SQL = await initSqlJs();
    const resolvedPath = path.resolve(dbPath);
    let data = null;
    if (fs.existsSync(resolvedPath)) {
        const raw = fs.readFileSync(resolvedPath);
        if (raw.byteLength > 0)
            data = new Uint8Array(raw);
    }
    const db = data ? new SQL.Database(data) : new SQL.Database();
    function persist() {
        const exported = db.export();
        const dir = path.dirname(resolvedPath);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(resolvedPath, Buffer.from(exported));
    }
    db.run(`
    CREATE TABLE IF NOT EXISTS handoffs (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      agent TEXT NOT NULL,
      lane TEXT NOT NULL,
      generatedAt TEXT NOT NULL,
      compactReason TEXT NOT NULL,
      summary TEXT NOT NULL,
      keyDecisions TEXT NOT NULL,
      openTasks TEXT NOT NULL,
      handoffHash TEXT NOT NULL,
      metadata TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_handoffs_session ON handoffs(sessionId);
    CREATE INDEX IF NOT EXISTS idx_handoffs_created ON handoffs(createdAt);

    CREATE TABLE IF NOT EXISTS compact_states (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      triggerType TEXT NOT NULL,
      reason TEXT NOT NULL,
      udsScore INTEGER NOT NULL,
      checkpointResults TEXT NOT NULL,
      handoffId TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_compact_session ON compact_states(sessionId);

    CREATE TABLE IF NOT EXISTS restore_points (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      label TEXT NOT NULL,
      handoffId TEXT NOT NULL,
      description TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_restore_session ON restore_points(sessionId);
  `);
    function queryAll(sql, params = []) {
        const stmt = db.prepare(sql);
        if (params.length > 0)
            stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
    }
    function queryOne(sql, params = []) {
        const rows = queryAll(sql, params);
        return rows.length > 0 ? rows[0] : null;
    }
    function rowToHandoff(row) {
        return {
            id: row.id,
            sessionId: row.sessionId,
            agent: row.agent,
            lane: row.lane,
            generatedAt: row.generatedAt,
            compactReason: row.compactReason,
            summary: row.summary,
            keyDecisions: JSON.parse(row.keyDecisions || "[]"),
            openTasks: JSON.parse(row.openTasks || "[]"),
            handoffHash: row.handoffHash,
            metadata: JSON.parse(row.metadata || "{}"),
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }
    function rowToCompact(row) {
        return {
            id: row.id,
            sessionId: row.sessionId,
            triggerType: row.triggerType,
            reason: row.reason,
            udsScore: row.udsScore,
            checkpointResults: JSON.parse(row.checkpointResults || "{}"),
            handoffId: row.handoffId,
            createdAt: row.createdAt,
        };
    }
    const insertHandoff = db.prepare(`
    INSERT INTO handoffs (id, sessionId, agent, lane, generatedAt, compactReason, summary, keyDecisions, openTasks, handoffHash, metadata, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const updateHandoff = db.prepare(`
    UPDATE handoffs SET summary = ?, keyDecisions = ?, openTasks = ?, handoffHash = ?, metadata = ?, updatedAt = ?
    WHERE id = ?
  `);
    const insertCompact = db.prepare(`
    INSERT INTO compact_states (id, sessionId, triggerType, reason, udsScore, checkpointResults, handoffId, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const insertRestore = db.prepare(`
    INSERT INTO restore_points (id, sessionId, label, handoffId, description, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
    const deleteHandoffStmt = db.prepare(`DELETE FROM handoffs WHERE id = ?`);
    const deleteCompactStmt = db.prepare(`DELETE FROM compact_states WHERE id = ?`);
    const deleteRestoreStmt = db.prepare(`DELETE FROM restore_points WHERE id = ?`);
    return {
        addHandoff(handoff) {
            const id = handoff.id || uuidv4();
            const createdAt = nowISO();
            const updatedAt = createdAt;
            insertHandoff.bind([
                id,
                handoff.sessionId,
                handoff.agent,
                handoff.lane,
                handoff.generatedAt,
                handoff.compactReason,
                handoff.summary,
                JSON.stringify(handoff.keyDecisions),
                JSON.stringify(handoff.openTasks),
                handoff.handoffHash,
                JSON.stringify(handoff.metadata),
                createdAt,
                updatedAt,
            ]);
            insertHandoff.step();
            insertHandoff.free();
            insertHandoff.reset();
            persist();
            return { ...handoff, id, createdAt, updatedAt };
        },
        getHandoff(id) {
            const row = queryOne("SELECT * FROM handoffs WHERE id = ?", [id]);
            return row ? rowToHandoff(row) : null;
        },
        getLatestHandoff(sessionId) {
            const row = queryOne("SELECT * FROM handoffs WHERE sessionId = ? ORDER BY createdAt DESC LIMIT 1", [sessionId]);
            return row ? rowToHandoff(row) : null;
        },
        listHandoffs(sessionId, limit = 20) {
            let rows;
            if (sessionId) {
                rows = queryAll("SELECT * FROM handoffs WHERE sessionId = ? ORDER BY createdAt DESC LIMIT ?", [sessionId, limit]);
            }
            else {
                rows = queryAll("SELECT * FROM handoffs ORDER BY createdAt DESC LIMIT ?", [limit]);
            }
            return rows.map(rowToHandoff);
        },
        addCompactState(state) {
            const id = uuidv4();
            const createdAt = nowISO();
            insertCompact.bind([
                id,
                state.sessionId,
                state.triggerType,
                state.reason,
                state.udsScore,
                JSON.stringify(state.checkpointResults),
                state.handoffId,
                createdAt,
            ]);
            insertCompact.step();
            insertCompact.free();
            insertCompact.reset();
            persist();
            return { ...state, id, createdAt };
        },
        getCompactState(id) {
            const row = queryOne("SELECT * FROM compact_states WHERE id = ?", [id]);
            return row ? rowToCompact(row) : null;
        },
        listCompactStates(sessionId, limit = 20) {
            let rows;
            if (sessionId) {
                rows = queryAll("SELECT * FROM compact_states WHERE sessionId = ? ORDER BY createdAt DESC LIMIT ?", [sessionId, limit]);
            }
            else {
                rows = queryAll("SELECT * FROM compact_states ORDER BY createdAt DESC LIMIT ?", [limit]);
            }
            return rows.map(rowToCompact);
        },
        addRestorePoint(point) {
            const id = uuidv4();
            const createdAt = nowISO();
            insertRestore.bind([id, point.sessionId, point.label, point.handoffId, point.description, createdAt]);
            insertRestore.step();
            insertRestore.free();
            insertRestore.reset();
            persist();
            return { ...point, id, createdAt };
        },
        getRestorePoint(id) {
            const row = queryOne("SELECT * FROM restore_points WHERE id = ?", [id]);
            return row ? row : null;
        },
        listRestorePoints(sessionId, limit = 20) {
            let rows;
            if (sessionId) {
                rows = queryAll("SELECT * FROM restore_points WHERE sessionId = ? ORDER BY createdAt DESC LIMIT ?", [sessionId, limit]);
            }
            else {
                rows = queryAll("SELECT * FROM restore_points ORDER BY createdAt DESC LIMIT ?", [limit]);
            }
            return rows;
        },
        getStats(sessionId) {
            let handoffsCount, compactsCount, restoresCount;
            let tags;
            if (sessionId) {
                handoffsCount = queryOne("SELECT COUNT(*) as c FROM handoffs WHERE sessionId = ?", [sessionId])?.c ?? 0;
                compactsCount = queryOne("SELECT COUNT(*) as c FROM compact_states WHERE sessionId = ?", [sessionId])?.c ?? 0;
                restoresCount = queryOne("SELECT COUNT(*) as c FROM restore_points WHERE sessionId = ?", [sessionId])?.c ?? 0;
                tags = queryAll("SELECT DISTINCT lane FROM handoffs WHERE sessionId = ?", [sessionId]).map((r) => r.lane);
            }
            else {
                handoffsCount = queryOne("SELECT COUNT(*) as c FROM handoffs")?.c ?? 0;
                compactsCount = queryOne("SELECT COUNT(*) as c FROM compact_states")?.c ?? 0;
                restoresCount = queryOne("SELECT COUNT(*) as c FROM restore_points")?.c ?? 0;
                tags = queryAll("SELECT DISTINCT lane FROM handoffs").map((r) => r.lane);
            }
            return {
                totalHandoffs: handoffsCount,
                totalCompacts: compactsCount,
                totalRestorePoints: restoresCount,
                tags,
            };
        },
        searchHandoffs(query, sessionId, limit = 10) {
            const tokens = query.split(/\s+/).filter(Boolean);
            if (tokens.length === 0)
                return [];
            const clauses = tokens.map(() => "(summary LIKE ? OR compactReason LIKE ?)").join(" AND ");
            const sql = `SELECT * FROM handoffs WHERE ${sessionId ? "sessionId = ? AND " : ""}${clauses} ORDER BY createdAt DESC LIMIT ?`;
            const params = [];
            if (sessionId)
                params.push(sessionId);
            for (const t of tokens)
                params.push(`%${t}%`, `%${t}%`);
            params.push(limit);
            const rows = queryAll(sql, params);
            return rows.map(rowToHandoff);
        },
        deleteHandoff(id) {
            deleteHandoffStmt.bind([id]);
            deleteHandoffStmt.step();
            const changes = db.getRowsModified();
            deleteHandoffStmt.free();
            deleteHandoffStmt.reset();
            persist();
            return changes > 0;
        },
        deleteCompactState(id) {
            deleteCompactStmt.bind([id]);
            deleteCompactStmt.step();
            const changes = db.getRowsModified();
            deleteCompactStmt.free();
            deleteCompactStmt.reset();
            persist();
            return changes > 0;
        },
        deleteRestorePoint(id) {
            deleteRestoreStmt.bind([id]);
            deleteRestoreStmt.step();
            const changes = db.getRowsModified();
            deleteRestoreStmt.free();
            deleteRestoreStmt.reset();
            persist();
            return changes > 0;
        },
    };
}
//# sourceMappingURL=database.js.map