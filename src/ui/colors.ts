import chalk from "chalk";

export const c = {
  header: chalk.bold.blue,
  value: chalk.white,
  label: chalk.dim,
  success: chalk.green,
  error: chalk.red,
  warn: chalk.yellow,
  accent: chalk.cyan,
  muted: chalk.dim,
  hash: chalk.blue,
  pending: chalk.yellow,
  confirmed: chalk.green,
  failed: chalk.red,
};

export function statusColor(status: string): string {
  switch (status) {
    case "confirmed":
      return c.confirmed(status);
    case "pending":
      return c.pending(status);
    case "failed":
      return c.failed(status);
    case "active":
      return c.success(status);
    case "completed":
      return c.confirmed(status);
    case "cancelled":
      return c.muted(status);
    default:
      return c.value(status);
  }
}

export function shortHash(hash: string | null | undefined): string {
  if (!hash) return c.muted("—");
  if (hash.length <= 16) return c.hash(hash);
  return c.hash(`${hash.slice(0, 8)}...${hash.slice(-6)}`);
}

export function formatAmount(
  amount: string | null | undefined,
  token: string | null | undefined
): string {
  if (!amount) return c.muted("—");
  return c.value(amount) + (token ? c.accent(` ${token}`) : "");
}

export function basescanUrl(txHash: string, network = "mainnet"): string {
  if (network === "sepolia") {
    return `https://sepolia.basescan.org/tx/${txHash}`;
  }
  return `https://basescan.org/tx/${txHash}`;
}

export function printKV(
  pairs: Array<{ label: string; value: string }>,
  indent = "  "
): void {
  const maxLen = Math.max(...pairs.map((p) => p.label.length));
  for (const { label, value } of pairs) {
    const pad = " ".repeat(maxLen - label.length);
    console.log(`${indent}${c.label(label + pad + "  ")}${value}`);
  }
}

export function printDivider(width = 58): void {
  console.log(chalk.blue("─".repeat(width)));
}

export function printSection(title: string): void {
  console.log();
  console.log(chalk.bold.blue("  " + title));
  printDivider();
}
