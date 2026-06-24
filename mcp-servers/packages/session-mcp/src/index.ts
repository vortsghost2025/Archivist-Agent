import fs from "fs";
import { openSessionDb } from "./database.js";
import { buildSessionTools } from "./tools.js";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  id?: unknown;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
}

const dbPath = process.env.SESSION_MEMORY_DB || "S:/Archivist-Agent/.session-memory/session.db";
let db: Awaited<ReturnType<typeof openSessionDb>>;
let tools: ReturnType<typeof buildSessionTools>;
let toolsByName: Map<string, (typeof tools)[0]>;
let initPromise: Promise<void>;

async function initialize() {
  db = await openSessionDb(dbPath);
  tools = buildSessionTools(db);
  toolsByName = new Map(tools.map((t) => [t.name, t]));
}

initPromise = initialize();

function coerceId(id: unknown): string | undefined {
  if (id === null || id === undefined) return undefined;
  return String(id);
}

function send(data: string): void {
  fs.writeSync(1, data + "\n");
}

function respond(id: unknown, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id: coerceId(id), result };
}

function error(id: unknown, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id: coerceId(id), error: { code, message } };
}

process.on("unhandledRejection", (err) => {
  process.stderr.write(`Unhandled rejection: ${err}\n`);
});

process.stdin.on("end", () => { setTimeout(() => process.exit(0), 2000); });
process.stdin.setEncoding("utf8");
let buffer = "";
process.stdin.on("data", (chunk: string) => {
  buffer += chunk;
  while (true) {
    const idx = buffer.indexOf("\n");
    if (idx === -1) break;
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg: JsonRpcRequest;
    try {
      msg = JSON.parse(line);
    } catch {
      send(JSON.stringify(error(null, -32700, "Parse error")));
      continue;
    }
    handleMessage(msg).catch((err) => {
      process.stderr.write(`handleMessage error: ${err}\n`);
    });
  }
});

async function handleMessage(msg: JsonRpcRequest): Promise<void> {
  await initPromise;
  if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0") {
    send(JSON.stringify(error(msg.id, -32600, "Invalid Request")));
    return;
  }
  const id = msg.id;
  const method = msg.method as string;
  if (method === "initialized") {
    return;
  }
  if (method === "ping") {
    send(JSON.stringify(respond(id, {})));
    return;
  }
  if (method === "initialize") {
    send(JSON.stringify(respond(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "archivist-session", version: "1.0.0" },
    })));
    return;
  }
  if (method === "tools/list") {
    send(JSON.stringify(respond(id, { tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) })));
    return;
  }
  if (method === "tools/call") {
    const toolName = (msg.params as { name: string } | undefined)?.name;
    if (!toolName) {
      send(JSON.stringify(error(id, -32601, "Tool name required")));
      return;
    }
    const tool = toolsByName.get(toolName);
    if (!tool) {
      send(JSON.stringify(error(id, -32601, `Tool not found: ${toolName}`)));
      return;
    }
    try {
      const result = await tool.handler((msg.params as { arguments: unknown } | undefined)?.arguments ?? {});
      const content = typeof result === "string" ? result : JSON.stringify(result);
      send(JSON.stringify(respond(id, { content: [{ type: "text", text: content }] })));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      send(JSON.stringify(error(id, -32000, message)));
    }
    return;
  }
  send(JSON.stringify(error(id, -32601, `Method not found: ${method}`)));
}

initialize().catch((err) => {
  process.stderr.write(`Initialization error: ${err}\n`);
  process.exit(1);
});
