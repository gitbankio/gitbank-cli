#!/usr/bin/env node
import { Command } from "commander";
import { GitbankClient, GitbankAuthError, GitbankError } from "@gitbank-agent/sdk";
import { loadSession, saveSession, loadConfig } from "./session.js";
import { printHelp } from "./ui/banner.js";
import { c } from "./ui/colors.js";
import { registerAuthCommands } from "./commands/auth.js";
import { registerVaultCommands } from "./commands/vault.js";
import { registerProjectCommands } from "./commands/projects.js";
import { registerTransactionCommands } from "./commands/transactions.js";
import { registerRepoCommands } from "./commands/repos.js";
import { registerStatsCommands } from "./commands/stats.js";
import { registerGitlawbCommands } from "./commands/gitlawb.js";
import { registerDIDCommands } from "./commands/did.js";
import { registerMCPCommands } from "./commands/mcp.js";
import { registerAgentCommands } from "./commands/agent.js";

const program = new Command();

let apiUrl = "https://gitbank.io";

function getClient(): GitbankClient {
  const cookie = loadSession();
  return new GitbankClient({
    baseUrl: apiUrl,
    cookie: cookie ?? undefined,
    onCookieUpdate: (newCookie: string) => {
      saveSession(newCookie);
    },
  });
}

program
  .name("gitbank")
  .description("Gitbank CLI — Web3 payments & project management for GitHub teams")
  .version("0.1.0")
  .option("--api <url>", "Override Gitbank API base URL")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts() as { api?: string };
    if (opts.api) {
      apiUrl = opts.api;
    } else {
      const config = loadConfig();
      if (config.apiUrl) apiUrl = config.apiUrl;
    }
  })
  .addHelpCommand(false)
  .helpOption(false);

program
  .command("help", { isDefault: false })
  .description("Show the Gitbank command dashboard")
  .action(() => {
    printHelp();
  });

program.on("--help", () => {
  printHelp();
});

program.configureHelp({
  formatHelp: () => {
    printHelp();
    return "";
  },
});

registerAuthCommands(program, getClient);
registerVaultCommands(program, getClient);
registerProjectCommands(program, getClient);
registerTransactionCommands(program, getClient);
registerRepoCommands(program, getClient);
registerStatsCommands(program, getClient);
registerGitlawbCommands(program);
registerDIDCommands(program);
registerMCPCommands(program);
registerAgentCommands(program);

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    printHelp();
    process.exit(0);
  }

  try {
    await program.parseAsync(process.argv);
  } catch (err: unknown) {
    if (err instanceof GitbankAuthError) {
      console.error();
      console.error(c.error("  ✗ Not authenticated."));
      console.error(c.muted("    Run: ") + c.accent("gitbank auth login"));
      console.error();
      process.exit(1);
    }

    if (err instanceof GitbankError) {
      console.error();
      console.error(c.error(`  ✗ ${err.message}`));
      if (err.statusCode) {
        console.error(c.muted(`    HTTP ${err.statusCode}`));
      }
      console.error();
      process.exit(1);
    }

    if (err instanceof Error) {
      console.error();
      console.error(c.error("  ✗ " + err.message));
      if (process.env["DEBUG"]) {
        console.error(err.stack);
      }
      console.error();
      process.exit(1);
    }

    throw err;
  }
}

main();
