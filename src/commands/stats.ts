import { Command } from "commander";
import { GitbankClient } from "@gitbank-agent/sdk";
import { c, printSection, printKV } from "../ui/colors.js";
import chalk from "chalk";

export function registerStatsCommands(
  program: Command,
  getClient: () => GitbankClient
): void {
  program
    .command("stats")
    .description("Show platform-wide stats (no auth required)")
    .action(async () => {
      const client = getClient();
      const stats = await client.getStats();

      printSection("Gitbank Platform Stats");
      printKV([
        { label: "Total vaults", value: c.value(String(stats.totalVaults)) },
        {
          label: "Total transactions",
          value: c.value(String(stats.totalTransactions)),
        },
        { label: "Total projects", value: c.value(String(stats.totalProjects)) },
      ]);
      console.log();
      console.log(c.muted("  Contracts live on Base L2 (chainId 8453)"));
      console.log(
        c.muted("  Factory: ") +
          chalk.underline(
            c.hash(
              "https://basescan.org/address/0xAA0a4ff46733EBaE8E658642A1314f18980fc77B"
            )
          )
      );
      console.log();
    });

  program
    .command("ping")
    .description("Check API health")
    .action(async () => {
      const client = getClient();
      const result = await client.healthz();
      console.log(c.success("  ✓ API is " + result.status));
    });
}
