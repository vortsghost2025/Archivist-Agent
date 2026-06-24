import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { Client } from "ssh2";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const SSH_HOSTS: Record<string, { host: string; user: string; identityFile: string }> = {
  "federation-vps": {
    host: "187.77.3.56",
    user: "root",
    identityFile: path.join(os.homedir(), ".ssh", "vps-nopass"),
  },
  "headless": {
    host: "100.95.40.99",
    user: "we4free",
    identityFile: path.join(os.homedir(), ".ssh", "id_ed25519"),
  },
  "vps2": {
    host: "2.25.206.123",
    user: "root",
    identityFile: path.join(os.homedir(), ".ssh", "hermes_vps_kvm2"),
  },
};

const DEFAULT_HOST = "federation-vps";
const COMMAND_TIMEOUT_MS = 30000;

const ExecSchema = z.object({
  host: z.string().default(DEFAULT_HOST).describe("SSH host alias from config"),
  command: z.string().describe("Command to execute on remote host"),
  timeout: z.number().default(COMMAND_TIMEOUT_MS).describe("Timeout in ms"),
});

const UploadSchema = z.object({
  host: z.string().default(DEFAULT_HOST).describe("SSH host alias"),
  localPath: z.string().describe("Local file path to upload"),
  remotePath: z.string().describe("Remote destination path"),
});

const DownloadSchema = z.object({
  host: z.string().default(DEFAULT_HOST).describe("SSH host alias"),
  remotePath: z.string().describe("Remote file path to download"),
  localPath: z.string().describe("Local destination path"),
});

const ServiceStatusSchema = z.object({
  host: z.string().default(DEFAULT_HOST).describe("SSH host alias"),
  service: z.string().describe("Service name (e.g., docker, nginx, federation-backend-1)"),
});

const DockerLogsSchema = z.object({
  host: z.string().default(DEFAULT_HOST).describe("SSH host alias"),
  container: z.string().describe("Docker container name"),
  lines: z.number().default(100).describe("Number of log lines to retrieve"),
  follow: z.boolean().default(false).describe("Whether to follow logs (always false for MCP)"),
});

const ListHostsSchema = z.object({});

async function createConnection(hostAlias: string): Promise<Client> {
  const config = SSH_HOSTS[hostAlias];
  if (!config) {
    throw new Error(`Unknown host: ${hostAlias}. Available: ${Object.keys(SSH_HOSTS).join(", ")}`);
  }

  const privateKey = await fs.readFile(config.identityFile, "utf-8");
  const conn = new Client();

  return new Promise((resolve, reject) => {
    conn.on("ready", () => resolve(conn));
    conn.on("error", (err) => reject(new Error(`SSH connection error to ${hostAlias}: ${err.message}`)));

    conn.connect({
      host: config.host,
      port: 22,
      username: config.user,
      privateKey,
      readyTimeout: 15000,
    });
  });
}

function execCommand(conn: Client, command: string, timeout: number): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      conn.end();
      reject(new Error(`Command timed out after ${timeout}ms: ${command.slice(0, 100)}`));
    }, timeout);

    conn.exec(command, (err, stream) => {
      if (err) { clearTimeout(timer); reject(err); return; }
      let stdout = "";
      let stderr = "";
      stream.on("data", (data: Buffer) => { stdout += data.toString(); });
      stream.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });
      stream.on("close", (code: number | null) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code });
      });
    });
  });
}

const server = new Server(
  { name: "archivist-ssh", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "ssh_exec",
      description: "Execute a command on a remote host via SSH. Use for VPS management, Docker ops, service checks, file operations on remote servers.",
      inputSchema: {
        type: "object",
        properties: {
          host: { type: "string", default: DEFAULT_HOST, description: "SSH host alias (federation-vps, headless, vps2)" },
          command: { type: "string", description: "Command to execute remotely" },
          timeout: { type: "number", default: COMMAND_TIMEOUT_MS, description: "Timeout in ms" },
        },
        required: ["command"],
      },
    },
    {
      name: "ssh_upload",
      description: "Upload a local file to a remote host via SCP (exec-based). For deploying files to VPS.",
      inputSchema: {
        type: "object",
        properties: {
          host: { type: "string", default: DEFAULT_HOST, description: "SSH host alias" },
          localPath: { type: "string", description: "Local file path to upload" },
          remotePath: { type: "string", description: "Remote destination path" },
        },
        required: ["localPath", "remotePath"],
      },
    },
    {
      name: "ssh_download",
      description: "Download a remote file from a VPS to local filesystem via cat-over-SSH.",
      inputSchema: {
        type: "object",
        properties: {
          host: { type: "string", default: DEFAULT_HOST, description: "SSH host alias" },
          remotePath: { type: "string", description: "Remote file path to download" },
          localPath: { type: "string", description: "Local destination path" },
        },
        required: ["remotePath", "localPath"],
      },
    },
    {
      name: "ssh_service_status",
      description: "Check status of a systemd service or Docker container on a remote host.",
      inputSchema: {
        type: "object",
        properties: {
          host: { type: "string", default: DEFAULT_HOST, description: "SSH host alias" },
          service: { type: "string", description: "Service name (e.g., docker, nginx, federation-backend-1)" },
        },
        required: ["service"],
      },
    },
    {
      name: "ssh_docker_logs",
      description: "Fetch Docker container logs from a remote host. For debugging production issues.",
      inputSchema: {
        type: "object",
        properties: {
          host: { type: "string", default: DEFAULT_HOST, description: "SSH host alias" },
          container: { type: "string", description: "Docker container name" },
          lines: { type: "number", default: 100, description: "Number of log lines" },
          follow: { type: "boolean", default: false },
        },
        required: ["container"],
      },
    },
    {
      name: "ssh_list_hosts",
      description: "List all configured SSH host aliases and their connection info (no secrets).",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "ssh_exec": {
        const { host = DEFAULT_HOST, command, timeout = COMMAND_TIMEOUT_MS } = ExecSchema.parse(args);
        const conn = await createConnection(host);
        try {
          const result = await execCommand(conn, command, timeout);
          return {
            content: [{ type: "text", text: JSON.stringify({ host, command, ...result }, null, 2) }],
          };
        } finally {
          conn.end();
        }
      }

      case "ssh_upload": {
        const { host = DEFAULT_HOST, localPath, remotePath } = UploadSchema.parse(args);
        const fileContent = await fs.readFile(localPath);
        const encoded = fileContent.toString("base64");
        const conn = await createConnection(host);
        try {
          const cmd = `mkdir -p "$(dirname "${remotePath}")" && base64 -d > "${remotePath}" << 'EOF_BASE64'\n${encoded}\nEOF_BASE64`;
          const result = await execCommand(conn, cmd, 60000);
          return {
            content: [{ type: "text", text: JSON.stringify({ host, localPath, remotePath, exitCode: result.exitCode, stderr: result.stderr, bytesUploaded: fileContent.length }) }],
          };
        } finally {
          conn.end();
        }
      }

      case "ssh_download": {
        const { host = DEFAULT_HOST, remotePath, localPath } = DownloadSchema.parse(args);
        const conn = await createConnection(host);
        try {
          const result = await execCommand(conn, `base64 "${remotePath}"`, 60000);
          if (result.exitCode !== 0) {
            throw new Error(`Failed to read remote file: ${result.stderr}`);
          }
          const decoded = Buffer.from(result.stdout.trim(), "base64");
          await fs.mkdir(path.dirname(localPath), { recursive: true });
          await fs.writeFile(localPath, decoded);
          return {
            content: [{ type: "text", text: JSON.stringify({ host, remotePath, localPath, bytesDownloaded: decoded.length }) }],
          };
        } finally {
          conn.end();
        }
      }

      case "ssh_service_status": {
        const { host = DEFAULT_HOST, service } = ServiceStatusSchema.parse(args);
        const conn = await createConnection(host);
        try {
          const cmd = `docker ps --filter "name=${service}" --format "{{.Status}}" 2>/dev/null || systemctl is-active ${service} 2>/dev/null || echo "unknown"`;
          const result = await execCommand(conn, cmd, 10000);
          return {
            content: [{ type: "text", text: JSON.stringify({ host, service, status: result.stdout.trim(), exitCode: result.exitCode }) }],
          };
        } finally {
          conn.end();
        }
      }

      case "ssh_docker_logs": {
        const { host = DEFAULT_HOST, container, lines = 100 } = DockerLogsSchema.parse(args);
        const conn = await createConnection(host);
        try {
          const result = await execCommand(conn, `docker logs --tail ${lines} ${container} 2>&1`, 15000);
          return {
            content: [{ type: "text", text: JSON.stringify({ host, container, lines, logs: result.stdout }) }],
          };
        } finally {
          conn.end();
        }
      }

      case "ssh_list_hosts": {
        ListHostsSchema.parse(args);
        const hosts = Object.entries(SSH_HOSTS).map(([alias, cfg]) => ({
          alias,
          host: cfg.host,
          user: cfg.user,
        }));
        return {
          content: [{ type: "text", text: JSON.stringify({ hosts, default: DEFAULT_HOST }) }],
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Archivist SSH MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});