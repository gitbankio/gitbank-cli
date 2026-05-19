import { Command } from "commander";
import { c, printSection, printKV, printDivider } from "../ui/colors.js";
import { loadDID } from "@gitbank-agent/sdk";
import { loadConfig } from "../session.js";
import chalk from "chalk";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

export function registerMCPCommands(program: Command): void {
  const mcp = program
    .command("mcp")
    .description("MCP server — expose Gitbank + Gitlawb tools to Claude and AI agents");

  mcp
    .command("serve")
    .description("Start the Gitbank MCP server (stdio transport — connect via claude_desktop_config.json)")
    .option("--gitlawb-node <url>", "Gitlawb node URL")
    .option("--verbose", "Print tool calls to stderr")
    .action(async (opts: { gitlawbNode?: string; verbose?: boolean }) => {
      const config = loadConfig();
      const { runMCPServer } = await import("../mcp/server.js");
      await runMCPServer({
        apiUrl: config.apiUrl,
        gitlawbNode: opts.gitlawbNode,
        verbose: opts.verbose,
      });
    });

  mcp
    .command("tools")
    .description("List all MCP tools available in the Gitbank server")
    .action(async () => {
      const { GitbankClient, GitlawbClient, buildGitbankMCPTools } = await import("@gitbank-agent/sdk");
      const { loadSession } = await import("../session.js");

      const cookie = loadSession();
      const did = loadDID();
      const config = loadConfig();

      const gitbank = new GitbankClient({ baseUrl: config.apiUrl, cookie: cookie ?? undefined });
      const gitlawb = new GitlawbClient({ did: did?.did });
      const tools = buildGitbankMCPTools(gitbank, gitlawb);

      printSection(`MCP Tools (${tools.length} total)`);

      const groups: Record<string, typeof tools> = {};
      for (const t of tools) {
        const prefix = t.name.startsWith("gitlawb_") ? "Gitlawb" : "Gitbank";
        if (!groups[prefix]) groups[prefix] = [];
        groups[prefix].push(t);
      }

      for (const [group, groupTools] of Object.entries(groups)) {
        console.log(c.header(`  ${group}:`));
        printDivider(56);
        for (const t of groupTools) {
          const required = (t.inputSchema as { required?: string[] }).required ?? [];
          const props = Object.keys((t.inputSchema as { properties?: Record<string, unknown> }).properties ?? {});
          const args = props.length > 0 ? `  ${c.muted(props.map(p => (required.includes(p) ? p : "[" + p + "]")).join(", "))}` : "";
          console.log(`  ${chalk.yellow(t.name.padEnd(30))}${args}`);
          console.log(`  ${c.muted("  " + t.description)}`);
          console.log();
        }
      }
    });

  mcp
    .command("config")
    .description("Print claude_desktop_config.json snippet to register Gitbank MCP server")
    .action(() => {
      const did = loadDID();
      const config = loadConfig();

      const cliPath = process.argv[1];
      const serverPath = path.join(os.homedir(), ".gitbank", "mcp-server.mjs");

      printSection("Claude Desktop MCP Config");

      const mcpConfig = {
        mcpServers: {
          gitbank: {
            command: "node",
            args: [cliPath, "mcp", "serve"],
            env: {
              ...(did ? { GITLAWB_DID: did.did } : {}),
              ...(config.apiUrl ? { GITBANK_API_URL: config.apiUrl } : {}),
              GITLAWB_NODE: "https://node.gitlawb.com",
            },
          },
        },
      };

      console.log(c.label("  Add this to ~/Library/Application Support/Claude/claude_desktop_config.json"));
      console.log(c.label("  (macOS) or %APPDATA%\\Claude\\claude_desktop_config.json (Windows):"));
      console.log();
      console.log(chalk.cyan(JSON.stringify(mcpConfig, null, 2).split("\n").map(l => "  " + l).join("\n")));
      console.log();

      console.log(c.label("  Or for Cursor / Windsurf / any MCP-compatible editor:"));
      console.log();
      console.log(chalk.cyan([
        "  {",
        `    \"command\": \"node\",`,
        `    \"args\": [\"${cliPath}\", \"mcp\", \"serve\"]`,
        "  }",
      ].join("\n")));
      console.log();

      const autoPath = path.join(os.homedir(), ".gitbank", "claude-mcp-config.json");
      try {
        fs.mkdirSync(path.dirname(autoPath), { recursive: true, mode: 0o700 });
        fs.writeFileSync(autoPath, JSON.stringify(mcpConfig, null, 2), { mode: 0o600 });
        console.log(c.success("  ✓ Config saved to: " + autoPath));
      } catch {
        // ignore write errors
      }
      console.log();
    });

  mcp
    .command("install")
    .description("Auto-install Gitbank MCP config into Claude Desktop app")
    .action(() => {
      const did = loadDID();
      const config = loadConfig();
      const cliPath = process.argv[1];

      const claudePaths = [
        path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json"),
        path.join(os.homedir(), "AppData", "Roaming", "Claude", "claude_desktop_config.json"),
        path.join(os.homedir(), ".config", "Claude", "claude_desktop_config.json"),
      ];

      const mcpEntry = {
        command: "node",
        args: [cliPath, "mcp", "serve"],
        env: {
          ...(did ? { GITLAWB_DID: did.did } : {}),
          ...(config.apiUrl ? { GITBANK_API_URL: config.apiUrl } : {}),
          GITLAWB_NODE: "https://node.gitlawb.com",
        },
      };

      let installed = false;
      for (const configPath of claudePaths) {
        if (!fs.existsSync(path.dirname(configPath))) continue;
        let existing: Record<string, unknown> = {};
        try {
          existing = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>;
        } catch {
          // new file
        }
        if (!existing["mcpServers"]) existing["mcpServers"] = {};
        (existing["mcpServers"] as Record<string, unknown>)["gitbank"] = mcpEntry;
        fs.writeFileSync(configPath, JSON.stringify(existing, null, 2));
        console.log(c.success("  ✓ Installed into: " + configPath));
        installed = true;
        break;
      }

      if (!installed) {
        console.log(c.warn("  Claude Desktop config not found at standard paths."));
        console.log(c.muted("  Run: gitbank mcp config  to get the snippet manually."));
      }
      console.log();
    });
}
