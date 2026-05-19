import { Command } from "commander";
import { GitbankClient } from "@gitbank-agent/sdk";
import {
  c,
  printKV,
  printSection,
  printDivider,
  shortHash,
  formatAmount,
  basescanUrl,
} from "../ui/colors.js";
import chalk from "chalk";

function txLink(hash: string | null | undefined): string {
  if (!hash) return c.muted("—");
  return chalk.underline(c.hash(basescanUrl(hash)));
}

export function registerVaultCommands(
  program: Command,
  getClient: () => GitbankClient
): void {
  program
    .command("balance")
    .description("Check live vault balances")
    .action(async () => {
      const client = getClient();
      const vault = await client.getBalance();

      printSection("Vault Balance");
      printKV([
        {
          label: "Vault address",
          value: vault.vaultAddress
            ? c.hash(vault.vaultAddress)
            : c.warn("Not deployed"),
        },
        {
          label: "Total USD value",
          value: c.value(vault.totalUsdValue || "0"),
        },
      ]);

      if (vault.balances.length > 0) {
        console.log();
        console.log(c.label("  Token Balances:"));
        for (const bal of vault.balances) {
          const padded = bal.symbol.padEnd(6);
          console.log(
            `    ${c.accent(padded)}  ${c.value(bal.balance)}  ${c.muted(bal.token)}`
          );
        }
      } else {
        console.log(c.muted("  No token balances found."));
      }
      console.log();
    });

  program
    .command("deposit <amount> <token>")
    .description("Lock tokens into your GitVault (e.g. deposit 50 USDC)")
    .action(async (amount: string, token: string) => {
      const client = getClient();
      console.log();
      console.log(c.label(`  Locking ${amount} ${token.toUpperCase()} into vault...`));
      const result = await client.lock(token.toUpperCase(), amount);
      printSection("Deposit Submitted");
      printKV([
        { label: "Token", value: c.accent(token.toUpperCase()) },
        { label: "Amount", value: c.value(amount) },
        { label: "Status", value: c.pending(result.status) },
        { label: "Tx hash", value: shortHash(result.txHash) },
        { label: "Basescan", value: txLink(result.txHash) },
      ]);
      console.log();
    });

  program
    .command("withdraw <amount> <token> <address>")
    .description("Withdraw tokens from vault to a wallet address")
    .action(async (amount: string, token: string, address: string) => {
      const client = getClient();
      console.log(c.label(`  Withdrawing ${amount} ${token.toUpperCase()} to ${address}...`));
      const result = await client.unlock(token.toUpperCase(), amount);
      printSection("Withdrawal Submitted");
      printKV([
        { label: "Token", value: c.accent(token.toUpperCase()) },
        { label: "Amount", value: c.value(amount) },
        { label: "Destination", value: c.hash(address) },
        { label: "Status", value: c.pending(result.status) },
        { label: "Tx hash", value: shortHash(result.txHash) },
        { label: "Basescan", value: txLink(result.txHash) },
      ]);
      console.log();
    });

  program
    .command("swap <amount> <tokenIn> <tokenOut>")
    .description("Swap tokens inside vault via Uniswap v3 (e.g. swap 100 USDC WETH)")
    .option("--slippage <bps>", "Slippage tolerance in basis points", "50")
    .action(async (amount: string, tokenIn: string, tokenOut: string, opts: { slippage: string }) => {
      const client = getClient();
      const slippageBps = parseInt(opts.slippage, 10);
      console.log(
        c.label(
          `  Swapping ${amount} ${tokenIn.toUpperCase()} → ${tokenOut.toUpperCase()} (slippage: ${slippageBps}bps)...`
        )
      );
      const result = await client.swap(
        tokenIn.toUpperCase(),
        tokenOut.toUpperCase(),
        amount,
        slippageBps
      );
      printSection("Swap Submitted");
      printKV([
        { label: "Token in", value: formatAmount(amount, tokenIn.toUpperCase()) },
        { label: "Token out", value: c.accent(tokenOut.toUpperCase()) },
        { label: "Slippage", value: c.value(`${slippageBps} bps`) },
        { label: "Status", value: c.pending(result.status) },
        { label: "Tx hash", value: shortHash(result.txHash) },
        { label: "Basescan", value: txLink(result.txHash) },
      ]);
      console.log();
    });

  program
    .command("send <amount> <token> <recipient>")
    .description("Send tokens to another contributor's vault (2-step commit-reveal)")
    .action(async (amount: string, token: string, recipient: string) => {
      const client = getClient();

      const recipientAddr = recipient.startsWith("0x")
        ? recipient
        : recipient.startsWith("@")
        ? recipient
        : recipient;

      console.log(
        c.label(`  Initiating transfer of ${amount} ${token.toUpperCase()} to ${recipientAddr}...`)
      );

      const init = await client.initTransfer(
        token.toUpperCase(),
        recipientAddr,
        amount
      );

      printSection("Transfer Step 1 — Committed");
      printKV([
        { label: "Init hash", value: shortHash(init.initHash) },
        { label: "Expires at", value: c.value(new Date(init.expiresAt).toLocaleString()) },
      ]);

      console.log();
      console.log(c.label("  Finalizing transfer..."));

      const final = await client.finalizeTransfer(init.initHash);

      printSection("Transfer Step 2 — Finalized");
      printKV([
        { label: "Token", value: formatAmount(amount, token.toUpperCase()) },
        { label: "Recipient", value: c.hash(recipientAddr) },
        { label: "Status", value: c.pending(final.status) },
        { label: "Tx hash", value: shortHash(final.txHash) },
        { label: "Basescan", value: txLink(final.txHash) },
      ]);
      console.log();
    });

  const vault = program
    .command("vault")
    .description("Vault management commands");

  vault
    .command("deploy")
    .description("Deploy your GitVault smart contract on Base (one-time)")
    .action(async () => {
      const client = getClient();
      console.log(c.label("  Deploying GitVault on Base L2..."));
      const result = await client.deployVault();
      printSection("Vault Deployed");
      printKV([
        { label: "Vault address", value: c.hash(result.vaultAddress) },
        { label: "Owner address", value: c.hash(result.ownerAddress) },
        { label: "Tx hash", value: shortHash(result.txHash) },
        { label: "Basescan", value: txLink(result.txHash) },
      ]);
      console.log();
      console.log(c.success("  ✓ Your GitVault is live on Base."));
      console.log(
        c.muted("  Deposit tokens via: ") +
          c.accent("gitbank deposit <amount> <token>")
      );
      console.log();
    });

  vault
    .command("key")
    .description("Export your execution private key (emergency self-custody)")
    .action(async () => {
      const client = getClient();
      const key = await client.getKey();
      printSection("Execution Key — KEEP THIS SECRET");
      printDivider();
      printKV([
        { label: "Address", value: c.hash(key.address) },
        { label: "Private key", value: c.warn(key.privateKey) },
      ]);
      console.log();
      console.log(
        c.warn(
          "  WARNING: Anyone with this key can sign transactions from your vault."
        )
      );
      console.log();
    });
}
