import { Command } from "commander";
import { c, printSection, printDivider } from "../ui/colors.js";
import { loadDID } from "@gitbank-agent/sdk";
import { loadSession, loadConfig } from "../session.js";
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function isOpenClaudeInstalled(): boolean {
  try {
    execSync("openclaude --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function isGLInstalled(): boolean {
  try {
    execSync("gl --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function writeAgentProfile(dir: string, opts: {
  apiUrl?: string;
  gitlawbNode?: string;
  did?: string;
  model?: string;
}): string {
  const profile = {
    model: opts.model ?? "claude-3-5-haiku-20241022",
    baseUrl: "https://api.anthropic.com",
    gitbankApiUrl: opts.apiUrl ?? "https://gitbank.io",
    gitlawbNode: opts.gitlawbNode ?? "https://node.gitlawb.com",
    ...(opts.did ? { gitlawbDid: opts.did } : {}),
    mcpServers: {
      gitbank: {
        command: "node",
        args: [process.argv[1], "mcp", "serve"],
        env: {
          ...(opts.did ? { GITLAWB_DID: opts.did } : {}),
          GITLAWB_NODE: opts.gitlawbNode ?? "https://node.gitlawb.com",
        },
      },
    },
  };

  const profilePath = path.join(dir, ".openclaude-profile.json");
  fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
  return profilePath;
}

export function registerAgentCommands(program: Command): void {
  const agent = program
    .command("agent")
    .description("Spawn an OpenClaude AI agent with full Gitbank + Gitlawb context");

  agent
    .command("run [task]")
    .description("Spawn an OpenClaude agent in the current repo with Gitbank MCP tools")
    .option("--model <model>", "AI model to use (e.g. claude-3-5-haiku-20241022)", "claude-3-5-haiku-20241022")
    .option("--gitlawb-node <url>", "Gitlawb node URL")
    .option("--dir <path>", "Working directory for the agent", process.cwd())
    .action(async (task: string | undefined, opts: { model: string; gitlawbNode?: string; dir: string }) => {
      const did = loadDID();
      const config = loadConfig();

      if (!isOpenClaudeInstalled()) {
        console.log();
        console.log(c.warn("  OpenClaude is not installed."));
        console.log(c.label("  Install with:"));
        console.log("  " + c.accent("npm install -g @gitlawb/openclaude"));
        console.log();
        console.log(c.label("  Then re-run:"));
        console.log("  " + c.accent("gitbank agent run" + (task ? ` "${task}"` : "")));
        console.log();
        return;
      }

      const profilePath = writeAgentProfile(opts.dir, {
        apiUrl: config.apiUrl,
        gitlawbNode: opts.gitlawbNode,
        did: did?.did,
        model: opts.model,
      });

      printSection("Spawning OpenClaude Agent");
      console.log(c.label("  Model:       ") + c.accent(opts.model));
      console.log(c.label("  Working dir: ") + c.value(opts.dir));
      console.log(c.label("  Profile:     ") + c.muted(profilePath));
      console.log(c.label("  MCP server:  ") + c.value("gitbank mcp serve (" + buildGitbankMCPTools_count() + " tools)"));
      if (did) console.log(c.label("  DID:         ") + c.hash(did.did));
      console.log();

      const args = ["--profile", profilePath];
      if (task) args.push("--task", task);

      const proc = spawn("openclaude", args, {
        stdio: "inherit",
        cwd: opts.dir,
        env: {
          ...process.env,
          ...(did ? { GITLAWB_DID: did.did } : {}),
          GITLAWB_NODE: opts.gitlawbNode ?? "https://node.gitlawb.com",
        },
      });

      proc.on("error", (err) => {
        console.error(c.error("  ✗ Failed to spawn OpenClaude: " + err.message));
      });

      await new Promise<void>((resolve) => proc.on("exit", resolve));
    });

  agent
    .command("setup")
    .description("Install OpenClaude + Gitlawb CLI and configure Gitbank MCP integration")
    .action(async () => {
      printSection("Agent Setup");
      printDivider();

      const openClaudeOk = isOpenClaudeInstalled();
      const glOk = isGLInstalled();

      console.log(c.label("  Checking dependencies:"));
      console.log(`  ${openClaudeOk ? c.success("✓") : c.error("✗")}  openclaude   ${openClaudeOk ? c.muted("installed") : c.warn("missing")}`);
      console.log(`  ${glOk ? c.success("✓") : c.error("✗")}  gl (gitlawb) ${glOk ? c.muted("installed") : c.warn("missing")}`);
      console.log();

      if (!openClaudeOk) {
        console.log(c.label("  Install OpenClaude:"));
        console.log("  " + c.accent("npm install -g @gitlawb/openclaude"));
        console.log();
      }
      if (!glOk) {
        console.log(c.label("  Install Gitlawb CLI:"));
        console.log("  " + c.accent("curl -fsSL https://gitlawb.com/install.sh | sh"));
        console.log();
      }

      if (openClaudeOk && glOk) {
        console.log(c.success("  ✓ All dependencies installed."));
        console.log();
      }

      console.log(c.label("  Next steps:"));
      console.log("  1. " + c.accent("gitbank auth login") + c.muted("      ← authenticate GitHub"));
      console.log("  2. " + c.accent("gitbank did new") + c.muted("         ← generate DID identity"));
      console.log("  3. " + c.accent("gitbank mcp config") + c.muted("      ← get Claude Desktop config"));
      console.log("  4. " + c.accent("gitbank agent run \"<task>\"") + c.muted("  ← run an agent"));
      console.log();
    });

  agent
    .command("profile")
    .description("Write .openclaude-profile.json in the current directory with Gitbank MCP pre-configured")
    .option("--model <model>", "Default model", "claude-3-5-haiku-20241022")
    .option("--gitlawb-node <url>", "Gitlawb node URL")
    .action((opts: { model: string; gitlawbNode?: string }) => {
      const did = loadDID();
      const config = loadConfig();
      const dir = process.cwd();

      const profilePath = writeAgentProfile(dir, {
        apiUrl: config.apiUrl,
        gitlawbNode: opts.gitlawbNode,
        did: did?.did,
        model: opts.model,
      });

      printSection("Agent Profile Written");
      console.log(c.success("  ✓ " + profilePath));
      console.log();
      console.log(c.label("  Profile includes:"));
      console.log("  " + c.muted("• Model: ") + c.value(opts.model));
      console.log("  " + c.muted("• Gitbank MCP server (vault, projects, txs, repos)"));
      console.log("  " + c.muted("• Gitlawb node: " + (opts.gitlawbNode ?? "https://node.gitlawb.com")));
      if (did) console.log("  " + c.muted("• DID: " + did.did.slice(0, 30) + "..."));
      console.log();
      console.log(c.label("  Start agent: ") + c.accent("openclaude"));
      console.log();
    });

  agent
    .command("info")
    .description("Show OpenClaude and Gitlawb integration info")
    .action(() => {
      printSection("Agent Integrations");

      const openClaudeOk = isOpenClaudeInstalled();
      const glOk = isGLInstalled();
      const did = loadDID();

      printDivider();
      console.log(c.header("  OpenClaude") + c.muted("  — open-source coding agent (27k ★)"));
      console.log(c.muted("  Works with: OpenAI, Gemini, Claude, Ollama, LM Studio, CodeX, 200+ models"));
      console.log(c.muted("  Install: npm install -g @gitlawb/openclaude"));
      console.log(c.muted("  Repo: https://github.com/Gitlawb/openclaude"));
      console.log(`  Status: ${openClaudeOk ? c.success("installed") : c.warn("not installed")}`);
      console.log();

      printDivider();
      console.log(c.header("  Gitlawb") + c.muted("  — decentralized git · DID identity · IPFS · libp2p"));
      console.log(c.muted("  3 live nodes · Ed25519 DID · UCAN capabilities · MCP server · 25 tools"));
      console.log(c.muted("  Install: curl -fsSL https://gitlawb.com/install.sh | sh"));
      console.log(c.muted("  Docs: https://gitlawb.com/start"));
      console.log(`  gl CLI: ${glOk ? c.success("installed") : c.warn("not installed")}`);
      console.log(`  DID: ${did ? c.hash(did.did) : c.warn("none — run: gitbank did new")}`);
      console.log();

      printDivider();
      console.log(c.header("  Gitbank MCP server") + c.muted("  — " + buildGitbankMCPTools_count() + " tools for Claude + AI agents"));
      console.log(c.muted("  Vault: balance, deposit, withdraw, swap, send"));
      console.log(c.muted("  Projects: list, create, assign bounty, cancel task"));
      console.log(c.muted("  Gitlawb: repos, PRs, issues, read file, DID"));
      console.log(c.muted("  Run: gitbank mcp serve  (stdio transport)"));
      console.log(c.muted("  Config: gitbank mcp config"));
      console.log();
    });
}

function buildGitbankMCPTools_count(): number {
  return 23;
}
