import { GitbankClient, GitlawbClient, buildGitbankMCPTools, MCPTool, MCPToolResult } from "@gitbank-agent/sdk";
import { loadSession } from "../session.js";
import { loadDID } from "@gitbank-agent/sdk";

interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function reply(id: string | number | null, result: unknown): string {
  const r: JSONRPCResponse = { jsonrpc: "2.0", id, result };
  return JSON.stringify(r);
}

function errReply(id: string | number | null, code: number, message: string): string {
  const r: JSONRPCResponse = { jsonrpc: "2.0", id, error: { code, message } };
  return JSON.stringify(r);
}

const SERVER_INFO = {
  name: "gitbank-mcp",
  version: "0.1.0",
  description: "Gitbank + Gitlawb MCP server — vault ops, on-chain payments, decentralized git for AI agents",
};

export async function runMCPServer(opts: {
  apiUrl?: string;
  gitlawbNode?: string;
  verbose?: boolean;
}): Promise<void> {
  const cookie = loadSession();
  const did = loadDID();

  const gitbank = new GitbankClient({
    baseUrl: opts.apiUrl ?? "https://gitbank.io",
    cookie: cookie ?? undefined,
  });

  const gitlawb = new GitlawbClient({
    node: opts.gitlawbNode,
    did: did?.did,
  });

  const tools: MCPTool[] = buildGitbankMCPTools(gitbank, gitlawb);
  const toolMap = new Map<string, MCPTool>(tools.map(t => [t.name, t]));

  if (opts.verbose) {
    process.stderr.write(`[gitbank-mcp] Starting — ${tools.length} tools loaded\n`);
    process.stderr.write(`[gitbank-mcp] Gitbank: ${gitbank["baseUrl"]}\n`);
    process.stderr.write(`[gitbank-mcp] Gitlawb: ${gitlawb.node}\n`);
    if (did) process.stderr.write(`[gitbank-mcp] DID: ${did.did}\n`);
  }

  const toolList = tools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));

  process.stdin.setEncoding("utf-8");
  let buffer = "";

  process.stdin.on("data", async (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let req: JSONRPCRequest;
      try {
        req = JSON.parse(trimmed) as JSONRPCRequest;
      } catch {
        process.stdout.write(errReply(null, -32700, "Parse error") + "\n");
        continue;
      }

      const { id, method, params } = req;

      try {
        if (method === "initialize") {
          process.stdout.write(
            reply(id, {
              protocolVersion: "2024-11-05",
              capabilities: { tools: {} },
              serverInfo: SERVER_INFO,
            }) + "\n"
          );
        } else if (method === "notifications/initialized") {
          // no-op
        } else if (method === "tools/list") {
          process.stdout.write(reply(id, { tools: toolList }) + "\n");
        } else if (method === "tools/call") {
          const toolName = String((params as Record<string, unknown>)?.["name"] ?? "");
          const toolArgs = ((params as Record<string, unknown>)?.["arguments"] ?? {}) as Record<string, unknown>;

          const tool = toolMap.get(toolName);
          if (!tool) {
            process.stdout.write(errReply(id, -32602, `Unknown tool: ${toolName}`) + "\n");
            continue;
          }

          if (opts.verbose) {
            process.stderr.write(`[gitbank-mcp] call ${toolName} ${JSON.stringify(toolArgs)}\n`);
          }

          const result: MCPToolResult = await tool.handler(toolArgs);
          process.stdout.write(reply(id, result) + "\n");
        } else if (method === "ping") {
          process.stdout.write(reply(id, {}) + "\n");
        } else {
          process.stdout.write(errReply(id, -32601, `Method not found: ${method}`) + "\n");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stdout.write(errReply(id, -32603, `Internal error: ${msg}`) + "\n");
      }
    }
  });

  process.stdin.on("end", () => {
    process.exit(0);
  });

  await new Promise<never>(() => {});
}
