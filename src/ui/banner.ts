import chalk from "chalk";

const LOGO_LINES = [
  " ██████╗ ██╗████████╗██████╗  █████╗ ███╗   ██╗██╗  ██╗",
  "██╔════╝ ██║╚══██╔══╝██╔══██╗██╔══██╗████╗  ██║██║ ██╔╝",
  "██║  ███╗██║   ██║   ██████╔╝███████║██╔██╗ ██║█████╔╝ ",
  "██║   ██║██║   ██║   ██╔══██╗██╔══██║██║╚██╗██║██╔═██╗ ",
  "╚██████╔╝██║   ██║   ██████╔╝██║  ██║██║ ╚████║██║  ██╗",
  " ╚═════╝ ╚═╝   ╚═╝   ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝",
];

const BANNER_WIDTH = 60;

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function padRight(str: string, width: number): string {
  const visible = stripAnsi(str).length;
  const pad = Math.max(0, width - visible);
  return str + " ".repeat(pad);
}

function bannerRow(content: string, width: number): string {
  return chalk.blue("║") + padRight(content, width) + chalk.blue("║");
}

export function printBanner(): void {
  const W = BANNER_WIDTH;
  console.log(chalk.blue("╔" + "═".repeat(W) + "╗"));
  console.log(bannerRow("", W));
  for (const line of LOGO_LINES) {
    console.log(bannerRow(chalk.bold.blue(line), W));
  }
  console.log(bannerRow("", W));
  console.log(bannerRow(chalk.cyan("  Web3 payments & project management for GitHub teams"), W));
  console.log(bannerRow(chalk.dim("  Base L2 · Zero gas · Soul-bound vaults · Any language"), W));
  console.log(bannerRow("", W));
  console.log(chalk.blue("╚" + "═".repeat(W) + "╝"));
}

export function printHelp(): void {
  printBanner();

  const SEC_W = 16;
  const CMD_W = 28;
  const DSC_W = 28;
  const INNER = 1 + CMD_W + 1 + DSC_W + 1;

  const topLine = chalk.blue("╔" + "═".repeat(SEC_W) + "╦" + "═".repeat(INNER) + "╗");
  const midLine = chalk.blue("╠" + "═".repeat(SEC_W) + "╬" + "═".repeat(INNER) + "╣");
  const botLine = chalk.blue("╚" + "═".repeat(SEC_W) + "╩" + "═".repeat(INNER) + "╝");
  const pipe    = chalk.blue("║");

  function row(section: string, cmd: string, desc: string): string {
    const secCell = padRight(chalk.bold.blue(section), SEC_W);
    const cmdCell = padRight(chalk.yellow(cmd), CMD_W);
    const dscCell = padRight(chalk.dim(desc), DSC_W);
    return `${pipe}${secCell}${pipe} ${cmdCell} ${dscCell}${pipe}`;
  }

  const lines = [
    topLine,
    row(" AUTH",          "auth login",                  "GitHub OAuth · open browser"),
    row("",               "auth logout / me",             "Sign out / show user"),
    midLine,
    row(" VAULT",         "balance",                      "Live vault balances"),
    row("",               "deposit <amt> <token>",        "Lock tokens into vault"),
    row("",               "withdraw <amt> <tok> <addr>",  "Withdraw to address"),
    row("",               "swap <amt> <from> <to>",       "Swap via Uniswap v3"),
    row("",               "send <amt> <tok> <@user>",     "Send to contributor"),
    row("",               "vault deploy / key",           "Deploy vault · export key"),
    midLine,
    row(" PROJECTS",      "projects list / create",       "List or create projects"),
    row("",               "projects show <id>",           "Detail + tasks"),
    row("",               "projects task add / cancel",   "Assign or cancel bounty"),
    midLine,
    row(" GITLAWB",       "gitlawb status",               "Node status & network info"),
    row("",               "gitlawb repos [did]",          "List repos by DID owner"),
    row("",               "gitlawb create <name>",        "Create repo on network"),
    row("",               "gitlawb clone <name> [did]",   "Clone via DID transport"),
    row("",               "gitlawb pr list/open <repo>",  "PR management"),
    row("",               "gitlawb issues <repo>",        "List issues"),
    row("",               "gitlawb cat <repo> <file>",    "Read file from repo"),
    row("",               "gitlawb install",              "Install gl CLI guide"),
    midLine,
    row(" IDENTITY",      "did new / show / reset",       "Ed25519 DID keypair"),
    row("",               "did export / link",            "Export env vars · link vault"),
    midLine,
    row(" MCP SERVER",    "mcp serve",                    "Stdio MCP server for Claude"),
    row("",               "mcp tools",                    "List all 23 MCP tools"),
    row("",               "mcp config / install",         "Config for Claude Desktop"),
    midLine,
    row(" AGENT",         "agent run [task]",             "Spawn OpenClaude agent"),
    row("",               "agent setup / profile",        "Setup deps · write profile"),
    row("",               "agent info",                   "Show integration status"),
    midLine,
    row(" HISTORY",       "txs",                          "Transaction history"),
    row("",               "repos",                        "Connected GitHub repos"),
    row("",               "stats / ping",                 "Platform stats · health"),
    botLine,
  ];

  console.log(lines.join("\n"));
  console.log();
  console.log(
    chalk.dim("  Options: ") +
      chalk.white("--api <url>") +
      chalk.dim("  Override API base URL   ") +
      chalk.white("--help") +
      chalk.dim("  This help")
  );
  console.log(
    chalk.dim("  Session: ") + chalk.dim("~/.gitbank/session.json") +
    chalk.dim("   DID: ") + chalk.dim("~/.gitbank/did/identity.json")
  );
  console.log();
}
