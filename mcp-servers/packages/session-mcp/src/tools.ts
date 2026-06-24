import { z } from "zod";
import type { SessionDatabase, SessionHandoff, CompactState, RestorePoint, SessionStats } from "./database.js";

export function buildSessionTools(db: SessionDatabase) {
  return [
    {
      name: "session_create_handoff",
      description: "Create a new session handoff for compact/restore. Called before compaction to preserve context.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "Session identifier" },
          agent: { type: "string", description: "Agent identity (e.g., archivist, kernel, swarmmind)" },
          lane: { type: "string", description: "Lane identifier (e.g., archivist, authority, kernel)" },
          generatedAt: { type: "string", description: "ISO timestamp when handoff was created" },
          compactReason: { type: "string", description: "Reason for compaction (auto, manual, recovery)" },
          summary: { type: "string", description: "Brief summary of session state" },
          keyDecisions: { type: "array", items: { type: "string" }, description: "Key decisions made in session" },
          openTasks: { type: "array", items: { type: "string" }, description: "Open tasks to carry forward" },
          handoffHash: { type: "string", description: "Hash of handoff content for verification" },
          metadata: { type: "object", description: "Additional metadata" },
        },
        required: ["sessionId", "agent", "lane", "generatedAt", "compactReason", "summary", "keyDecisions", "openTasks", "handoffHash"],
        additionalProperties: false,
      },
      handler: async (args: unknown) => {
        const parsed = z.object({
          sessionId: z.string().min(1),
          agent: z.string().min(1),
          lane: z.string().min(1),
          generatedAt: z.string().datetime(),
          compactReason: z.string().min(1),
          summary: z.string().min(1),
          keyDecisions: z.array(z.string()),
          openTasks: z.array(z.string()),
          handoffHash: z.string().min(1),
          metadata: z.record(z.unknown()).optional(),
        }).parse(args);

        const handoff = db.addHandoff({ ...parsed, metadata: parsed.metadata ?? {} });
        return { ok: true, handoff };
      },
    },
    {
      name: "session_get_latest_handoff",
      description: "Get the most recent handoff for a session. Used during restore.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "Session identifier" },
        },
        required: ["sessionId"],
        additionalProperties: false,
      },
      handler: async (args: unknown) => {
        const { sessionId } = z.object({ sessionId: z.string().min(1) }).parse(args);
        const handoff = db.getLatestHandoff(sessionId);
        return { ok: true, handoff };
      },
    },
    {
      name: "session_list_handoffs",
      description: "List handoffs for a session, most recent first.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "Session identifier (optional, omit for all)" },
          limit: { type: "integer", maximum: 100, default: 20 },
        },
        additionalProperties: false,
      },
      handler: async (args: unknown) => {
        const { sessionId, limit } = z.object({ sessionId: z.string().optional(), limit: z.number().int().positive().max(100).optional() }).parse(args);
        const handoffs = db.listHandoffs(sessionId, limit ?? 20);
        return { ok: true, handoffs };
      },
    },
    {
      name: "session_search_handoffs",
      description: "Search handoffs by query string.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          sessionId: { type: "string", description: "Session identifier (optional)" },
          limit: { type: "integer", maximum: 100, default: 10 },
        },
        required: ["query"],
        additionalProperties: false,
      },
      handler: async (args: unknown) => {
        const { query, sessionId, limit } = z.object({ query: z.string().min(1), sessionId: z.string().optional(), limit: z.number().int().positive().max(100).optional() }).parse(args);
        const handoffs = db.searchHandoffs(query, sessionId, limit ?? 10);
        return { ok: true, handoffs };
      },
    },
    {
      name: "session_record_compact",
      description: "Record a compaction event with checkpoint results and UDS score.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "Session identifier" },
          triggerType: { type: "string", enum: ["auto", "manual", "recovery"], description: "What triggered compaction" },
          reason: { type: "string", description: "Detailed reason" },
          udsScore: { type: "integer", minimum: 0, maximum: 100, description: "User Drift Score at compaction" },
          checkpointResults: { type: "object", description: "Results of 7 checkpoints" },
          handoffId: { type: "string", description: "ID of handoff created before compaction" },
        },
        required: ["sessionId", "triggerType", "reason", "udsScore", "checkpointResults", "handoffId"],
        additionalProperties: false,
      },
      handler: async (args: unknown) => {
        const parsed = z.object({
          sessionId: z.string().min(1),
          triggerType: z.enum(["auto", "manual", "recovery"]),
          reason: z.string().min(1),
          udsScore: z.number().int().min(0).max(100),
          checkpointResults: z.record(z.boolean()),
          handoffId: z.string().uuid(),
        }).parse(args);

        const state = db.addCompactState(parsed);
        return { ok: true, compactState: state };
      },
    },
    {
      name: "session_list_compacts",
      description: "List compaction events for a session.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "Session identifier (optional)" },
          limit: { type: "integer", maximum: 100, default: 20 },
        },
        additionalProperties: false,
      },
      handler: async (args: unknown) => {
        const { sessionId, limit } = z.object({ sessionId: z.string().optional(), limit: z.number().int().positive().max(100).optional() }).parse(args);
        const states = db.listCompactStates(sessionId, limit ?? 20);
        return { ok: true, compactStates: states };
      },
    },
    {
      name: "session_create_restore_point",
      description: "Create a named restore point linked to a handoff.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "Session identifier" },
          label: { type: "string", description: "Human-readable label (e.g., pre-deploy, post-audit)" },
          handoffId: { type: "string", description: "ID of handoff to restore to" },
          description: { type: "string", description: "Description of restore point" },
        },
        required: ["sessionId", "label", "handoffId", "description"],
        additionalProperties: false,
      },
      handler: async (args: unknown) => {
        const parsed = z.object({
          sessionId: z.string().min(1),
          label: z.string().min(1),
          handoffId: z.string().uuid(),
          description: z.string().min(1),
        }).parse(args);

        const point = db.addRestorePoint(parsed);
        return { ok: true, restorePoint: point };
      },
    },
    {
      name: "session_list_restore_points",
      description: "List restore points for a session.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "Session identifier (optional)" },
          limit: { type: "integer", maximum: 100, default: 20 },
        },
        additionalProperties: false,
      },
      handler: async (args: unknown) => {
        const { sessionId, limit } = z.object({ sessionId: z.string().optional(), limit: z.number().int().positive().max(100).optional() }).parse(args);
        const points = db.listRestorePoints(sessionId, limit ?? 20);
        return { ok: true, restorePoints: points };
      },
    },
    {
      name: "session_get_stats",
      description: "Get aggregate statistics for a session.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "Session identifier (optional)" },
        },
        additionalProperties: false,
      },
      handler: async (args: unknown) => {
        const { sessionId } = z.object({ sessionId: z.string().optional() }).parse(args);
        const stats = db.getStats(sessionId);
        return { ok: true, stats };
      },
    },
    {
      name: "session_verify_handoff_hash",
      description: "Verify a handoff hash matches the stored handoff content.",
      inputSchema: {
        type: "object",
        properties: {
          handoffId: { type: "string", description: "ID of handoff to verify" },
          providedHash: { type: "string", description: "Hash to verify against" },
        },
        required: ["handoffId", "providedHash"],
        additionalProperties: false,
      },
      handler: async (args: unknown) => {
        const { handoffId, providedHash } = z.object({ handoffId: z.string().uuid(), providedHash: z.string().min(1) }).parse(args);
        const handoff = db.getHandoff(handoffId);
        if (!handoff) return { ok: false, error: "Handoff not found" };
        return { ok: true, matches: handoff.handoffHash === providedHash, storedHash: handoff.handoffHash };
      },
    },
  ];
}
