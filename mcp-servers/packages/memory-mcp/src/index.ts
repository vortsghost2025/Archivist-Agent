import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Memory storage directory
const MEMORY_DIR = path.resolve("S:/Archivist-Agent/.mcp-memory");

// Memory structure
interface MemoryEntry {
  key: string;
  value: unknown;
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  metadata?: Record<string, unknown>;
}

interface SessionMemory {
  sessionId: string;
  entries: MemoryEntry[];
  createdAt: string;
  updatedAt: string;
}

// Tool schemas
const MemorySetSchema = z.object({
  sessionId: z.string().describe("Session identifier"),
  key: z.string().describe("Memory key"),
  value: z.unknown().describe("Value to store (JSON serializable)"),
  tags: z.array(z.string()).default([]).describe("Optional tags for categorization"),
  metadata: z.record(z.unknown()).optional().describe("Optional metadata"),
});

const MemoryGetSchema = z.object({
  sessionId: z.string().describe("Session identifier"),
  key: z.string().describe("Memory key to retrieve"),
});

const MemoryListSchema = z.object({
  sessionId: z.string().describe("Session identifier"),
  tags: z.array(z.string()).optional().describe("Filter by tags"),
  limit: z.number().default(50).describe("Maximum entries to return"),
});

const MemoryDeleteSchema = z.object({
  sessionId: z.string().describe("Session identifier"),
  key: z.string().describe("Memory key to delete"),
});

const MemoryClearSchema = z.object({
  sessionId: z.string().describe("Session identifier to clear entirely"),
});

const MemorySearchSchema = z.object({
  sessionId: z.string().describe("Session identifier"),
  query: z.string().describe("Search query for values"),
  limit: z.number().default(20).describe("Maximum results"),
});

// Create server
const server = new Server(
  {
    name: "archivist-memory",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize memory directory
async function initMemoryDir() {
  await fs.mkdir(MEMORY_DIR, { recursive: true });
}

async function getSessionFile(sessionId: string): Promise<string> {
  return path.join(MEMORY_DIR, `${sessionId}.json`);
}

async function loadSession(sessionId: string): Promise<SessionMemory> {
  const file = await getSessionFile(sessionId);
  try {
    const data = await fs.readFile(file, "utf-8");
    return JSON.parse(data);
  } catch {
    return {
      sessionId,
      entries: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

async function saveSession(session: SessionMemory): Promise<void> {
  const file = await getSessionFile(session.sessionId);
  session.updatedAt = new Date().toISOString();
  await fs.writeFile(file, JSON.stringify(session, null, 2));
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "memory_set",
      description: "Store a value in session memory",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "Session identifier" },
          key: { type: "string", description: "Memory key" },
          value: { description: "Value to store (JSON serializable)" },
          tags: { type: "array", items: { type: "string" }, default: [] },
          metadata: { type: "object", description: "Optional metadata" },
        },
        required: ["sessionId", "key", "value"],
      },
    },
    {
      name: "memory_get",
      description: "Retrieve a value from session memory",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "Session identifier" },
          key: { type: "string", description: "Memory key to retrieve" },
        },
        required: ["sessionId", "key"],
      },
    },
    {
      name: "memory_list",
      description: "List all memory entries for a session",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "Session identifier" },
          tags: { type: "array", items: { type: "string" }, description: "Filter by tags" },
          limit: { type: "number", default: 50 },
        },
        required: ["sessionId"],
      },
    },
    {
      name: "memory_delete",
      description: "Delete a memory entry",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "Session identifier" },
          key: { type: "string", description: "Memory key to delete" },
        },
        required: ["sessionId", "key"],
      },
    },
    {
      name: "memory_clear",
      description: "Clear all memory for a session",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "Session identifier to clear" },
        },
        required: ["sessionId"],
      },
    },
    {
      name: "memory_search",
      description: "Search memory values by query",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "Session identifier" },
          query: { type: "string", description: "Search query" },
          limit: { type: "number", default: 20 },
        },
        required: ["sessionId", "query"],
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    await initMemoryDir();

    switch (name) {
      case "memory_set": {
        const { sessionId, key, value, tags = [], metadata } = MemorySetSchema.parse(args);
        const session = await loadSession(sessionId);
        
        const now = new Date().toISOString();
        const existingIndex = session.entries.findIndex(e => e.key === key);
        
        const entry: MemoryEntry = {
          key,
          value,
          sessionId,
          createdAt: existingIndex >= 0 ? session.entries[existingIndex].createdAt : now,
          updatedAt: now,
          tags,
          metadata,
        };

        if (existingIndex >= 0) {
          session.entries[existingIndex] = entry;
        } else {
          session.entries.push(entry);
        }

        await saveSession(session);
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, key, sessionId }) }],
          structuredContent: { success: true, key, sessionId },
        };
      }

      case "memory_get": {
        const { sessionId, key } = MemoryGetSchema.parse(args);
        const session = await loadSession(sessionId);
        const entry = session.entries.find(e => e.key === key);
        
        if (!entry) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Key not found", key, sessionId }) }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(entry) }],
          structuredContent: entry,
        };
      }

      case "memory_list": {
        const { sessionId, tags, limit = 50 } = MemoryListSchema.parse(args);
        const session = await loadSession(sessionId);
        
        let entries = session.entries;
        if (tags && tags.length > 0) {
          entries = entries.filter(e => tags.some(t => e.tags.includes(t)));
        }
        
        entries = entries
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, limit);

        return {
          content: [{ type: "text", text: JSON.stringify({ entries }) }],
          structuredContent: { entries },
        };
      }

      case "memory_delete": {
        const { sessionId, key } = MemoryDeleteSchema.parse(args);
        const session = await loadSession(sessionId);
        const initialLength = session.entries.length;
        session.entries = session.entries.filter(e => e.key !== key);
        
        if (session.entries.length === initialLength) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Key not found", key, sessionId }) }],
            isError: true,
          };
        }

        await saveSession(session);
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, key, sessionId }) }],
          structuredContent: { success: true, key, sessionId },
        };
      }

      case "memory_clear": {
        const { sessionId } = MemoryClearSchema.parse(args);
        const session = await loadSession(sessionId);
        const clearedCount = session.entries.length;
        session.entries = [];
        await saveSession(session);
        
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, sessionId, clearedCount }) }],
          structuredContent: { success: true, sessionId, clearedCount },
        };
      }

      case "memory_search": {
        const { sessionId, query, limit = 20 } = MemorySearchSchema.parse(args);
        const session = await loadSession(sessionId);
        const lowerQuery = query.toLowerCase();
        
        const results = session.entries
          .map(entry => {
            const valueStr = JSON.stringify(entry.value).toLowerCase();
            const keyStr = entry.key.toLowerCase();
            const tagStr = entry.tags.join(" ").toLowerCase();
            
            let score = 0;
            if (valueStr.includes(lowerQuery)) score += 3;
            if (keyStr.includes(lowerQuery)) score += 2;
            if (tagStr.includes(lowerQuery)) score += 1;
            
            return { ...entry, score };
          })
          .filter(r => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);

        return {
          content: [{ type: "text", text: JSON.stringify({ results }) }],
          structuredContent: { results },
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Archivist Memory MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});