# gitbank

Terminal CLI for [Gitbank](https://gitbank.io) — Web3 payments and on-chain project management via GitHub on Base L2.

Manage your GitVault, deposit/withdraw/swap stablecoins, create bounty projects tied to GitHub issues, interact with the [Gitlawb](https://gitlawb.com) decentralized git network, manage DID identity, and connect AI agents via MCP — all from your terminal.

## Install

```bash
npm install -g gitbank
```

Requires **Node.js 18+**.

---

## Quick Start

```bash
gitbank auth login              # Print GitHub OAuth URL
gitbank auth set-cookie "..."   # Paste cookie from browser (VPS/headless)
gitbank auth me                 # Confirm who you are

gitbank balance                 # Check vault balances
gitbank vault deploy            # Deploy GitVault on Base L2 (one-time)
gitbank deposit 100 USDC        # Fund your vault
```

---

## Authentication

Gitbank uses **GitHub OAuth**. Session is stored at `~/.gitbank/session.json` (mode 0600).

```bash
gitbank auth login              # Print OAuth URL + open browser if available
gitbank auth set-cookie <value> # Manually set cookie (VPS / headless)
gitbank auth me                 # Show current user and vault address
gitbank auth logout             # Sign out and clear local session
```

### Login on a VPS or headless server

There is no browser on a remote server, so use the manual cookie flow:

1. Open **`https://gitbank.io/api/auth/github`** in your local browser
2. Complete GitHub login
3. Press **F12** → tab **Application** → **Cookies** → `https://gitbank.io`
4. Find row **`connect.sid`** → click it → copy the **Value**
5. Back on your VPS:

```bash
gitbank auth set-cookie "connect.sid=s%3Axxx..."
gitbank auth me
```

---

## Vault

Your GitVault is a smart contract on Base L2 (chainId 8453).

**Supported tokens:** `USDC` · `WETH` · `cbBTC`

```bash
gitbank vault deploy                         # Deploy GitVault contract (one-time)
gitbank vault key                            # Export execution private key — keep secret!

gitbank balance                              # Live token balances

gitbank deposit <amount> <token>             # Lock tokens into vault
gitbank withdraw <amount> <token> <address>  # Withdraw to an external wallet

gitbank swap <amount> <tokenIn> <tokenOut>   # Swap via Uniswap v3 on Base L2
gitbank swap 100 USDC WETH --slippage 100    # Custom slippage in basis points (default: 50)

gitbank send <amount> <token> <recipient>    # Send to another contributor vault (commit-reveal)
```

---

## Projects & Bounties

On-chain project budgets tied to GitHub repos and issues.

```bash
gitbank projects list                        # List all your projects

# Create a project (flags optional — CLI prompts for missing values)
gitbank projects create \
  --name "My Project" \
  --repo owner/repo \
  --token USDC \
  --budget 1000

gitbank projects show <projectId>            # Project details and task list

# Assign a bounty to a GitHub issue
gitbank projects task add \
  --project <projectId> \
  --issue <issueNumber> \
  --repo owner/repo \
  --to <contributorGitHubNumericId> \
  --bounty <amount> \
  --token USDC

gitbank projects task cancel <projectId> <taskId>   # Cancel task, reclaim bounty
```

> **`--to` requires the GitHub numeric user ID**, not a username. Find it at:
> `https://api.github.com/users/<username>` → look for the `id` field.

---

## Transactions

```bash
gitbank txs                     # Last 20 transactions
gitbank txs --limit 50          # Custom result count
gitbank txs --project <id>      # Filter by project
gitbank txs --offset 20         # Pagination
```

Transaction types: `deposit` · `withdraw` · `swap` · `send` · `assign bounty` · `payout` · `reclaim` · `create project`

---

## Repos

Lists GitHub repos where the Gitbank GitHub App is installed.

```bash
gitbank repos                            # List connected repos (default)
gitbank repos list                       # Same
gitbank repos remove <installationId>    # Remove a GitHub App installation
```

Install the app at: **https://gitbank.io/app**

---

## Stats & Health

```bash
gitbank ping        # API health check (no auth required)
gitbank stats       # Platform stats: total vaults, transactions, projects
```

---

## DID Identity

Ed25519 decentralized identifiers ([did:key spec](https://w3c-ccg.github.io/did-method-key/)), used with Gitlawb and AI agent workflows. Stored at `~/.gitbank/did/identity.json` (mode 0600).

```bash
gitbank did new      # Generate new Ed25519 DID keypair
gitbank did show     # Show current DID + MCP config snippet
gitbank did reset    # Delete and regenerate DID (irreversible)
gitbank did export   # Print GITLAWB_DID / GITLAWB_KEY env vars
gitbank did link     # Instructions to link your vault to your DID
```

---

## Gitlawb — Decentralized Git

[Gitlawb](https://gitlawb.com) is a decentralized git network. Every identity is a cryptographic DID. Every push is signed with Ed25519. No accounts, no passwords.

`gitbank gitlawb` commands delegate to the `gl` CLI — all authentication and signing is handled by `gl` using your local `~/.gitlawb/identity.pem` keypair.

---

### Full setup — from zero to a live repo

One command walks you through the entire flow:

```bash
gitbank gitlawb setup --name my-project
gitbank gitlawb setup --name my-project --description "My first Gitlawb repo"
```

**What it does, step by step:**

| Step | Action |
|---|---|
| 1 | Check `gl` is installed — prints install command if missing |
| 2 | Set node URL (`https://node.gitlawb.com`) |
| 3 | Create Ed25519 DID identity if one doesn't exist |
| 4 | Register your DID with the node (signs a UCAN token) |
| 5 | Create the repository |
| 6 | Clone it locally via DID transport |
| 7 | Print your profile URL and next steps |

After `setup` completes:

```bash
cd my-project
git config user.name  "$(gl identity show)"
git config user.email "$(gl identity show)@gitlawb"

echo "# my-project" > README.md
git add . && git commit -m "init"
git push origin main
```

---

### Prerequisites — install gl

All `gitbank gitlawb` commands require `gl` (the Gitlawb CLI) to be installed on your system.

```bash
# Option 1 — curl (macOS / Linux, recommended):
curl -fsSL https://gitlawb.com/install.sh | sh

# Option 2 — npm:
npm install -g @gitlawb/gl

# Option 3 — build from source (requires Rust):
cargo install --git https://github.com/gitlawb/gitlawb gl git-remote-gitlawb
```

Clone and push also require `git-remote-gitlawb` — included in the curl installer.

```bash
gitbank gitlawb install   # Print full install instructions
gitbank gitlawb doctor    # Check: gl, git-remote-gitlawb, node reachable, identity
```

---

### Individual commands

```bash
# Node
gitbank gitlawb status              # Node status (peers, repos, region)
gitbank gitlawb profile             # Your DID + profile URL on gitlawb.com

# Identity
gitbank gitlawb identity new        # Generate a new Ed25519 keypair and DID
gitbank gitlawb identity show       # Print your DID

# Registration
gitbank gitlawb register            # Register DID with node, save UCAN token

# Repos
gitbank gitlawb repo create <name> [--description]   # Create a repo
gitbank gitlawb repo list                            # List your repos
gitbank gitlawb repo info <name>                     # Repo metadata
gitbank gitlawb repo clone <name> [ownerDid]         # Clone via DID transport

# Pull requests
gitbank gitlawb pr create <repo> --head <branch> --base <branch> --title "..." [--body]
gitbank gitlawb pr list   <repo>
gitbank gitlawb pr view   <repo> <number>
gitbank gitlawb pr diff   <repo> <number>
gitbank gitlawb pr review <repo> <number> --status approved|changes_requested|comment [--body]
gitbank gitlawb pr merge  <repo> <number>

# Issues
gitbank gitlawb issue create <repo> --title "..." [--body]
gitbank gitlawb issue list   <repo>
gitbank gitlawb issue view   <repo> <number>
gitbank gitlawb issue close  <repo> <number>
```

### Override node URL

```bash
gitbank gitlawb --node https://mynode.example.com setup --name my-project
```

Or set permanently:

```bash
export GITLAWB_NODE=https://node.gitlawb.com
```

---

## MCP Server — AI Agent Integration

The CLI ships a complete [Model Context Protocol](https://modelcontextprotocol.io) stdio server with 23 tools for Claude, Cursor, Windsurf, and any MCP-compatible AI agent.

```bash
gitbank mcp serve     # Start MCP server (stdio transport)
gitbank mcp tools     # List all 23 tools with their parameters
gitbank mcp config    # Print claude_desktop_config.json snippet (also saves to ~/.gitbank/)
gitbank mcp install   # Auto-install into Claude Desktop (if the app is installed)
```

**Add to `claude_desktop_config.json`:**

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "gitbank": {
      "command": "node",
      "args": ["/path/to/gitbank", "mcp", "serve"],
      "env": {
        "GITLAWB_DID": "did:key:z6Mk...",
        "GITLAWB_NODE": "https://node.gitlawb.com"
      }
    }
  }
}
```

Or generate the config automatically (path is filled in for you):

```bash
gitbank mcp config
```

**All 23 MCP tools:**

| Group | Tool | What it does |
|---|---|---|
| Info | `gitbank_ping` | API health check |
| Info | `gitbank_me` | Current user + vault address |
| Info | `gitbank_stats` | Platform statistics |
| Vault | `gitbank_balance` | Live token balances |
| Vault | `gitbank_deposit` | Lock tokens into vault |
| Vault | `gitbank_withdraw` | Withdraw to external wallet |
| Vault | `gitbank_swap` | Swap via Uniswap v3 on Base |
| Vault | `gitbank_send` | Send to contributor vault |
| Vault | `gitbank_deploy_vault` | Deploy GitVault contract |
| Projects | `gitbank_list_projects` | List all projects |
| Projects | `gitbank_get_project` | Project details + tasks |
| Projects | `gitbank_create_project` | Create on-chain project |
| Projects | `gitbank_assign_bounty` | Assign bounty to GitHub issue |
| Projects | `gitbank_cancel_task` | Cancel task, reclaim bounty |
| Projects | `gitbank_transactions` | Transaction history |
| Projects | `gitbank_repos` | Connected GitHub repos |
| DID | `gitbank_did_show` | Show local DID |
| DID | `gitbank_did_new` | Generate new DID |
| Gitlawb | `gitlawb_node_status` | Node status |
| Gitlawb | `gitlawb_list_repos` | List repos by DID |
| Gitlawb | `gitlawb_create_repo` | Create decentralized repo |
| Gitlawb | `gitlawb_open_pr` | Open pull request |
| Gitlawb | `gitlawb_read_file` | Read file from repo |

---

## Agent — OpenClaude Integration

Spawn an AI coding agent with Gitbank MCP tools pre-loaded.

> **Requires:** `npm install -g @gitlawb/openclaude`

```bash
gitbank agent run                              # Spawn agent in current directory
gitbank agent run "Fix the auth bug"           # Spawn with a specific task
gitbank agent run --model claude-3-5-haiku-20241022 "task"

gitbank agent setup                            # Check openclaude + gl install status
gitbank agent profile                          # Write .openclaude-profile.json in current dir
gitbank agent info                             # Show openclaude / gitlawb / MCP status
```

---

## Global Options

```bash
gitbank --api <url>    # Override API base URL (default: https://gitbank.io)
gitbank --version      # Show version
gitbank --help         # Show help
```

---

## File Locations

```
~/.gitbank/
  session.json              # GitHub OAuth session cookie  (mode 0600)
  config.json               # API URL override, if set
  did/
    identity.json           # Ed25519 DID keypair          (mode 0600)
  claude-mcp-config.json    # MCP config snapshot (gitbank mcp config)
```

---

## SDK

Full TypeScript SDK available separately:

```bash
npm install @gitbank-agent/sdk
```

See [@gitbank-agent/sdk on npm](https://www.npmjs.com/package/@gitbank-agent/sdk) for the complete API reference.

---

## Links

- [Gitbank](https://gitbank.io) — platform
- [@gitbank-agent/sdk](https://www.npmjs.com/package/@gitbank-agent/sdk) — TypeScript SDK
- [Gitlawb](https://gitlawb.com) — decentralized git network
- [GitHub](https://github.com/gitbankio/gitbank-cli) — source code

## License

MIT
