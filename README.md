# gitbank

Terminal CLI for [Gitbank](https://gitbank.io) — Web3 payments and project management built into GitHub on Base L2.

Manage GitVaults, deposit/withdraw/swap tokens, run bounty projects, interact with the [Gitlawb](https://gitlawb.com) decentralized git network, manage DID identity, and connect AI agents via MCP — all from your terminal.

## Install

```bash
npm install -g gitbank
```

Requires **Node.js 18+**.

---

## Quick Start

```bash
# Login with GitHub
gitbank auth login

# Check vault balance
gitbank balance

# Deposit 100 USDC
gitbank deposit 100 USDC

# List your projects
gitbank projects list

# Generate a DID identity
gitbank did new

# Expose 23 tools to Claude via MCP
gitbank mcp serve
```

---

## Commands

### Auth

```bash
gitbank auth login        # Start GitHub OAuth (opens browser)
gitbank auth logout       # Sign out
gitbank auth me           # Show current user + vault address
```

### Vault

```bash
gitbank balance                          # Live vault balances (USDC, WETH, cbBTC)
gitbank deposit <amount> <token>         # Lock tokens into vault
gitbank withdraw <amount> <token> <addr> # Withdraw to external address
gitbank swap <amount> <from> <to>        # Swap via Uniswap v3 on Base L2
gitbank send <amount> <token> <@user>    # Send to contributor's vault
gitbank vault deploy                     # Deploy GitVault contract (one-time)
gitbank vault key                        # Export vault private key
```

**Supported tokens:** `USDC`, `WETH`, `cbBTC`

### Projects & Bounties

```bash
gitbank projects list                               # List your projects
gitbank projects create <name> <repo> <token> <budget>  # Create on-chain project
gitbank projects show <id>                          # Project details + tasks

gitbank projects task add <projectId> <issue> <repo> <githubId> <amount> <token>
gitbank projects task cancel <projectId> <taskId>
```

### Gitlawb — Decentralized Git

```bash
gitbank gitlawb status                  # Node status + peer info
gitbank gitlawb repos [did]             # List repos by DID owner
gitbank gitlawb create <name> [desc]    # Create repo on network
gitbank gitlawb clone <name> [did]      # Clone via DID transport

gitbank gitlawb pr list <repo>          # List pull requests
gitbank gitlawb pr open <repo> <head> <base> <title>  # Open a PR

gitbank gitlawb issues <repo>           # List issues
gitbank gitlawb cat <repo> <file>       # Read file from repo

gitbank gitlawb install                 # Install Gitlawb CLI guide
```

**Environment variables for Gitlawb:**

| Variable | Description |
|---|---|
| `GITLAWB_NODE` | Node URL (default: `https://node.gitlawb.com`) |
| `GITLAWB_DID` | Your DID identifier |
| `GITLAWB_KEY` | Path to identity key file |

### DID Identity

Ed25519 decentralized identifiers ([did:key](https://w3c-ccg.github.io/did-method-key/) spec), stored at `~/.gitbank/did/identity.json` (mode 0600).

```bash
gitbank did new        # Generate new Ed25519 DID keypair
gitbank did show       # Show current DID + MCP config snippet
gitbank did reset      # Delete and regenerate DID
gitbank did export     # Print shell export commands (GITLAWB_DID, GITLAWB_KEY)
gitbank did link       # Instructions to link DID to your vault
```

### MCP Server — AI Agent Integration

Expose 23 Gitbank tools to Claude, Cursor, Windsurf, or any MCP-compatible AI agent.

```bash
gitbank mcp serve          # Start JSON-RPC 2.0 stdio MCP server
gitbank mcp tools          # List all 23 available tools
gitbank mcp config         # Print Claude Desktop config JSON
gitbank mcp install        # Copy MCP server to ~/.gitbank/mcp-server.mjs
```

**Add to `claude_desktop_config.json`:**

macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "gitbank": {
      "command": "gitbank",
      "args": ["mcp", "serve"],
      "env": {
        "GITLAWB_DID": "did:key:z6Mk...",
        "GITLAWB_NODE": "https://node.gitlawb.com"
      }
    }
  }
}
```

Or generate the config automatically:

```bash
gitbank mcp config
```

**MCP Tools (23 total):**

| Group | Tools |
|---|---|
| Auth & Info | `gitbank_ping`, `gitbank_me`, `gitbank_stats` |
| Vault | `gitbank_balance`, `gitbank_deposit`, `gitbank_withdraw`, `gitbank_swap`, `gitbank_send`, `gitbank_deploy_vault` |
| Projects | `gitbank_list_projects`, `gitbank_get_project`, `gitbank_create_project`, `gitbank_assign_bounty`, `gitbank_cancel_task`, `gitbank_transactions`, `gitbank_repos` |
| DID | `gitbank_did_show`, `gitbank_did_new` |
| Gitlawb | `gitlawb_node_status`, `gitlawb_list_repos`, `gitlawb_create_repo`, `gitlawb_open_pr`, `gitlawb_read_file` |

### Agent — OpenClaude Integration

Spawn an [OpenClaude](https://github.com/Gitlawb/openclaude) coding agent with full Gitbank context pre-loaded.

```bash
gitbank agent run [task]       # Spawn OpenClaude agent on current repo
gitbank agent setup            # Install openclaude globally
gitbank agent profile          # Write .claude/gitbank-profile.md to current repo
gitbank agent info             # Show integration status (openclaude, gitlawb, mcp)
```

### History & Status

```bash
gitbank txs              # Transaction history
gitbank repos            # Connected GitHub repos
gitbank stats            # Platform stats (vaults, txs, projects)
gitbank ping             # API health check
```

---

## Global Options

```bash
gitbank --api <url>   # Override API base URL (default: https://gitbank.io)
gitbank --help        # Show help dashboard
```

---

## Session

Authentication is stored at `~/.gitbank/session.json` (mode 0600). The session cookie is written automatically after `gitbank auth login` completes the GitHub OAuth flow.

```
~/.gitbank/
  session.json          # GitHub OAuth session cookie
  did/
    identity.json       # Ed25519 DID keypair (private key included)
  mcp-server.mjs        # MCP server binary (after: gitbank mcp install)
  claude-mcp-config.json
```

---

## Workflow Example

```bash
# 1. Authenticate
gitbank auth login

# 2. Deploy your vault (once)
gitbank vault deploy

# 3. Fund your vault
gitbank deposit 1000 USDC

# 4. Create a bounty project
gitbank projects create "Backend Rewrite" owner/repo USDC 1000

# 5. Assign a bounty to a GitHub issue
gitbank projects task add 1 42 owner/repo 123456 200 USDC
#    projectId↑  issue↑  repo↑      githubId↑  amount↑

# 6. Generate your DID for decentralized git
gitbank did new

# 7. Push to Gitlawb
gitbank gitlawb create my-project
git remote add gitlawb $(gitbank gitlawb repos | grep my-project | ...)
git push gitlawb main

# 8. Connect Claude to your vault
gitbank mcp config     # Copy output to claude_desktop_config.json
# → Claude can now deposit, create bounties, manage repos
```

---

## SDK

The full TypeScript SDK is available separately:

```bash
npm install @gitbank/sdk
```

See [@gitbank/sdk on npm](https://www.npmjs.com/package/@gitbank/sdk) for the complete API reference.

---

## Links

- [Gitbank](https://gitbank.io) — platform
- [@gitbank-agent/sdk](https://www.npmjs.com/package/@gitbank-agent/sdk) — TypeScript SDK
- [Gitlawb](https://gitlawb.com) — decentralized git network
- [OpenClaude](https://github.com/Gitlawb/openclaude) — open-source coding agent
- [GitHub](https://github.com/gitbankio/gitbank-cli) — source code

## License

MIT
