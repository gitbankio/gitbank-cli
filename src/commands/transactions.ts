import { Command } from "commander";
import { GitbankClient, Transaction } from "@gitbank-agent/sdk";
import {
  c,
  printSection,
  printDivider,
  shortHash,
  statusColor,
  basescanUrl,
} from "../ui/colors.js";
import chalk from "chalk";

const TYPE_LABELS: Record<string, string> = {
  lock: "deposit",
  unlock: "withdraw",
  swap: "swap",
  transfer: "send",
  bounty_assign: "assign bounty",
  bounty_payout: "payout",
  bounty_reclaim: "reclaim",
  project_create: "create project",
};

function formatTx(tx: Transaction): void {
  const label = TYPE_LABELS[tx.type] ?? tx.type;
  const amountIn = tx.amountIn
    ? `${tx.amountIn}${tx.tokenIn ? " " + tx.tokenIn : ""}`
    : "";
  const amountOut = tx.amountOut
    ? ` → ${tx.amountOut}${tx.tokenOut ? " " + tx.tokenOut : ""}`
    : "";
  const hash = tx.txHash ? chalk.underline(c.hash(basescanUrl(tx.txHash))) : c.muted("—");

  console.log(
    `  ${c.label("#" + String(tx.id).padEnd(5))} ` +
      `${c.accent(label.padEnd(16))} ` +
      `${c.value((amountIn + amountOut).padEnd(24))} ` +
      `${statusColor(tx.status).padEnd(12)} ` +
      `${shortHash(tx.txHash)}`
  );
  console.log(
    `  ${" ".repeat(6)}` +
      `${c.muted(new Date(tx.createdAt).toLocaleString())}` +
      (tx.txHash ? `  ${hash}` : "")
  );
}

export function registerTransactionCommands(
  program: Command,
  getClient: () => GitbankClient
): void {
  program
    .command("txs")
    .description("View transaction history")
    .option("--project <id>", "Filter by project ID")
    .option("--limit <n>", "Max results", "20")
    .option("--offset <n>", "Offset for pagination", "0")
    .action(
      async (opts: { project?: string; limit: string; offset: string }) => {
        const client = getClient();
        const txs = await client.getTransactions({
          projectId: opts.project ? parseInt(opts.project, 10) : undefined,
          limit: parseInt(opts.limit, 10),
          offset: parseInt(opts.offset, 10),
        });

        printSection("Transaction History");

        if (txs.length === 0) {
          console.log(c.muted("  No transactions found."));
          console.log();
          return;
        }

        for (const tx of txs) {
          formatTx(tx);
          printDivider(56);
        }

        console.log(c.muted(`  Showing ${txs.length} transaction(s).`));
        if (txs.length === parseInt(opts.limit, 10)) {
          console.log(
            c.muted(
              `  For more: gitbank txs --offset ${parseInt(opts.offset, 10) + txs.length}`
            )
          );
        }
        console.log();
      }
    );
}
