import { Command } from "commander";
import { generateDID, loadDID, clearDID } from "@gitbank-agent/sdk";
import { c, printSection, printKV, printDivider } from "../ui/colors.js";
import chalk from "chalk";

export function registerDIDCommands(program: Command): void {
  const did = program
    .command("did")
    .description("Manage your Ed25519 DID (Decentralized Identity) for Gitlawb & agent workflows");

  did
    .command("new")
    .description("Generate a new Ed25519 keypair and DID — stored at ~/.gitbank/did/identity.json")
    .action(() => {
      const existing = loadDID();
      if (existing) {
        console.log();
        console.log(c.warn("  ⚠  You already have a DID:"));
        console.log("     " + c.hash(existing.did));
        console.log();
        console.log(c.muted("  To replace it, run: gitbank did reset"));
        console.log();
        return;
      }
      const doc = generateDID();
      printSection("DID Generated");
      printKV([
        { label: "DID", value: c.hash(doc.did) },
        { label: "Type", value: c.value(doc.type) },
        { label: "Public key", value: c.muted(doc.publicKeyHex) },
        { label: "Created", value: c.muted(doc.createdAt) },
        { label: "Stored at", value: c.muted("~/.gitbank/did/identity.json") },
      ]);
      console.log();
      console.log(c.success("  ✓ DID created and saved (mode 0600)"));
      console.log();
      console.log(c.label("  Use this DID with Gitlawb:"));
      console.log("  " + c.accent("export GITLAWB_DID=" + doc.did));
      console.log("  " + c.accent("export GITLAWB_KEY=~/.gitbank/did/identity.json"));
      console.log();
      console.log(c.label("  Connect to Gitlawb node:"));
      console.log("  " + c.accent("gitbank gitlawb status"));
      console.log();
    });

  did
    .command("show")
    .description("Show your current DID identity")
    .action(() => {
      const doc = loadDID();
      if (!doc) {
        console.log();
        console.log(c.warn("  No DID found."));
        console.log(c.muted("  Generate one: gitbank did new"));
        console.log();
        return;
      }
      printSection("Your DID Identity");
      printKV([
        { label: "DID", value: c.hash(doc.did) },
        { label: "Type", value: c.value(doc.type) },
        { label: "Public key", value: c.muted(doc.publicKeyHex) },
        { label: "Created", value: c.muted(doc.createdAt) },
        { label: "File", value: c.muted("~/.gitbank/did/identity.json (mode 0600)") },
      ]);
      console.log();
      console.log(c.label("  MCP agent config (claude_desktop_config.json):"));
      console.log();
      const mcpConfig = {
        mcpServers: {
          gitbank: {
            command: "node",
            args: ["~/.gitbank/mcp-server.mjs"],
            env: {
              GITLAWB_DID: doc.did,
              GITLAWB_NODE: "https://node.gitlawb.com",
            },
          },
        },
      };
      console.log(c.muted(JSON.stringify(mcpConfig, null, 2).split("\n").map(l => "  " + l).join("\n")));
      console.log();
    });

  did
    .command("reset")
    .description("Delete your local DID and generate a new one (irreversible!)")
    .action(() => {
      clearDID();
      const doc = generateDID();
      printSection("DID Reset");
      printKV([
        { label: "New DID", value: c.hash(doc.did) },
        { label: "Type", value: c.value(doc.type) },
        { label: "Created", value: c.muted(doc.createdAt) },
      ]);
      console.log();
      console.log(c.warn("  ⚠  Old DID is gone. Update any Gitlawb registrations."));
      console.log();
    });

  did
    .command("export")
    .description("Export DID as env vars for use with Gitlawb CLI or MCP config")
    .action(() => {
      const doc = loadDID();
      if (!doc) {
        console.error(c.error("  ✗ No DID found. Run: gitbank did new"));
        process.exit(1);
      }
      console.log();
      console.log(c.label("  # Paste these into your shell or .env:"));
      console.log(chalk.green(`export GITLAWB_DID="${doc.did}"`));
      console.log(chalk.green(`export GITLAWB_KEY="$HOME/.gitbank/did/identity.json"`));
      console.log(chalk.green(`export GITLAWB_NODE="https://node.gitlawb.com"`));
      console.log();
      console.log(c.label("  # Or for gl CLI:"));
      console.log(chalk.green(`gl identity import --did "${doc.did}"`));
      console.log();
    });

  did
    .command("link")
    .description("Show how to link your Gitbank vault to your Gitlawb DID identity")
    .action(() => {
      const doc = loadDID();
      printSection("Link Vault ↔ DID");
      printDivider();

      if (!doc) {
        console.log(c.warn("  No DID yet. First run: gitbank did new"));
        console.log();
        return;
      }

      console.log(c.label("  Your DID:"));
      console.log("  " + c.hash(doc.did));
      console.log();
      console.log(c.label("  Your Gitbank vault is anchored to your GitHub permanent user ID."));
      console.log(c.label("  Your Gitlawb DID is an Ed25519 keypair stored locally."));
      console.log();
      console.log(c.label("  To associate them:"));
      console.log("  1. " + c.accent("gitbank auth me") + c.muted("  ← get your vault address"));
      console.log("  2. " + c.accent("gitbank did export") + c.muted("  ← get your DID"));
      console.log("  3. Add a signed comment in GitHub: " + c.accent("@gitbankbot link did " + doc.did.slice(0, 20) + "..."));
      console.log();
      console.log(c.muted("  Once linked, agents on Gitlawb can reference your vault by DID."));
      console.log();
    });
}
