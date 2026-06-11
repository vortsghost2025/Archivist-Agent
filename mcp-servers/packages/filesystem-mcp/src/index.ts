import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Allowed roots - restrict to project directory and user home
const ALLOWED_ROOTS = [
  path.resolve("S:/Archivist-Agent"),
  path.resolve(process.env.USERPROFILE || "C:/Users/seand"),
].filter(Boolean);

// Security: validate path is within allowed roots
function validatePath(requestedPath: string): string {
  const resolved = path.resolve(requestedPath);
  const allowed = ALLOWED_ROOTS.some(root => resolved.startsWith(root));
  if (!allowed) {
    throw new Error(`Path not allowed: ${resolved}. Allowed roots: ${ALLOWED_ROOTS.join(", ")}`);
  }
  return resolved;
}

// Tool schemas
const ReadFileSchema = z.object({
  path: z.string().describe("File path to read"),
  encoding: z.enum(["utf-8", "base64"]).default("utf-8").describe("Encoding"),
});

const WriteFileSchema = z.object({
  path: z.string().describe("File path to write"),
  content: z.string().describe("Content to write"),
  encoding: z.enum(["utf-8", "base64"]).default("utf-8").describe("Encoding"),
});

const ListDirSchema = z.object({
  path: z.string().describe("Directory path to list"),
  recursive: z.boolean().default(false).describe("List recursively"),
});

const SearchFilesSchema = z.object({
  path: z.string().describe("Root directory to search"),
  pattern: z.string().describe("Glob pattern (e.g., **/*.ts)"),
  maxResults: z.number().default(100).describe("Maximum results"),
});

const DeleteFileSchema = z.object({
  path: z.string().describe("File or directory path to delete"),
  recursive: z.boolean().default(false).describe("Delete directories recursively"),
});

const FileInfoSchema = z.object({
  path: z.string().describe("File path to get info"),
});

// Create server
const server = new Server(
  {
    name: "archivist-filesystem",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "fs_read",
      description: "Read a file from the filesystem",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to read" },
          encoding: { type: "string", enum: ["utf-8", "base64"], default: "utf-8" },
        },
        required: ["path"],
      },
    },
    {
      name: "fs_write",
      description: "Write content to a file (creates directories if needed)",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to write" },
          content: { type: "string", description: "Content to write" },
          encoding: { type: "string", enum: ["utf-8", "base64"], default: "utf-8" },
        },
        required: ["path", "content"],
      },
    },
    {
      name: "fs_list",
      description: "List directory contents",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path to list" },
          recursive: { type: "boolean", default: false },
        },
        required: ["path"],
      },
    },
    {
      name: "fs_search",
      description: "Search files by glob pattern",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Root directory to search" },
          pattern: { type: "string", description: "Glob pattern (e.g., **/*.ts)" },
          maxResults: { type: "number", default: 100 },
        },
        required: ["path", "pattern"],
      },
    },
    {
      name: "fs_delete",
      description: "Delete a file or directory",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "File or directory path to delete" },
          recursive: { type: "boolean", default: false },
        },
        required: ["path"],
      },
    },
    {
      name: "fs_info",
      description: "Get file/directory metadata",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to get info" },
        },
        required: ["path"],
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "fs_read": {
        const { path: filePath, encoding = "utf-8" } = ReadFileSchema.parse(args);
        const validated = validatePath(filePath);
        const content = await fs.readFile(validated, encoding as BufferEncoding);
        const stats = await fs.stat(validated);
        return {
          content: [{ type: "text", text: JSON.stringify({ content, encoding, size: stats.size }) }],
          structuredContent: { content, encoding, size: stats.size },
        };
      }

      case "fs_write": {
        const { path: filePath, content, encoding = "utf-8" } = WriteFileSchema.parse(args);
        const validated = validatePath(filePath);
        await fs.mkdir(path.dirname(validated), { recursive: true });
        await fs.writeFile(validated, content, encoding as BufferEncoding);
        const stats = await fs.stat(validated);
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, path: validated, bytesWritten: stats.size }) }],
          structuredContent: { success: true, path: validated, bytesWritten: stats.size },
        };
      }

      case "fs_list": {
        const { path: dirPath, recursive = false } = ListDirSchema.parse(args);
        const validated = validatePath(dirPath);
        
        async function listDir(dir: string, base: string, isRecursive: boolean): Promise<Array<{
          name: string;
          path: string;
          relativePath: string;
          type: "file" | "directory";
          size: number;
          modified: string;
        }>> {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          const results: Array<{
            name: string;
            path: string;
            relativePath: string;
            type: "file" | "directory";
            size: number;
            modified: string;
          }> = [];
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(base, fullPath);
            const stats = await fs.stat(fullPath);
            results.push({
              name: entry.name,
              path: fullPath,
              relativePath,
              type: entry.isDirectory() ? "directory" : "file" as const,
              size: stats.size,
              modified: stats.mtime.toISOString(),
            });
            if (isRecursive && entry.isDirectory()) {
              results.push(...await listDir(fullPath, base, true));
            }
          }
          return results;
        }

        const entries = await listDir(validated, validated, recursive);
        return {
          content: [{ type: "text", text: JSON.stringify({ entries }) }],
          structuredContent: { entries },
        };
      }

      case "fs_search": {
        const { path: rootPath, pattern, maxResults = 100 } = SearchFilesSchema.parse(args);
        const validated = validatePath(rootPath);
        
        async function searchFiles(dir: string, pattern: string, base: string, results: string[], limit: number) {
          if (results.length >= limit) return;
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (results.length >= limit) break;
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(base, fullPath);
            
            // Simple glob matching
            const matches = minimatch(relativePath, pattern) || minimatch(entry.name, pattern);
            if (matches) {
              results.push(fullPath);
            }
            if (entry.isDirectory()) {
              await searchFiles(fullPath, pattern, base, results, limit);
            }
          }
        }

        const matches: string[] = [];
        await searchFiles(validated, pattern, validated, matches, maxResults);
        
        const matchDetails = matches.map(m => ({
          path: m,
          name: path.basename(m),
          relativePath: path.relative(validated, m),
        }));

        return {
          content: [{ type: "text", text: JSON.stringify({ matches: matchDetails }) }],
          structuredContent: { matches: matchDetails },
        };
      }

      case "fs_delete": {
        const { path: filePath, recursive = false } = DeleteFileSchema.parse(args);
        const validated = validatePath(filePath);
        await fs.rm(validated, { recursive, force: true });
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, path: validated }) }],
          structuredContent: { success: true, path: validated },
        };
      }

      case "fs_info": {
        const { path: filePath } = FileInfoSchema.parse(args);
        const validated = validatePath(filePath);
        const stats = await fs.stat(validated);
        return {
          content: [{ type: "text", text: JSON.stringify({
            path: validated,
            name: path.basename(validated),
            type: stats.isDirectory() ? "directory" : "file",
            size: stats.size,
            created: stats.birthtime.toISOString(),
            modified: stats.mtime.toISOString(),
            accessed: stats.atime.toISOString(),
          }) }],
          structuredContent: {
            path: validated,
            name: path.basename(validated),
            type: stats.isDirectory() ? "directory" : "file",
            size: stats.size,
            created: stats.birthtime.toISOString(),
            modified: stats.mtime.toISOString(),
            accessed: stats.atime.toISOString(),
          },
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

// Simple glob matching
function minimatch(str: string, pattern: string): boolean {
  const regex = new RegExp(
    "^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$"
  );
  return regex.test(str);
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Archivist Filesystem MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});