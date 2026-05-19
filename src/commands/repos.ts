import { Command } from "commander";
import { GitbankClient } from "@gitbank-agent/sdk";
import { c, printSection } from "../ui/colors.js";

export function registerRepoCommands(
  program: Command,
  getClient: () => GitbankClient
): void {
  const repos = program
    .command("repos")
    .description("Manage connected GitHub repos");

  repos
    .command("list", { isDefault: true })
    .description("List GitHub repos with Gitbank installed")
    .action(async () => {
      const client = getClient();
      const list = await client.getRepos();

      printSection("Connected Repos");

      if (list.length === 0) {
        console.log(c.muted("  No repos connected."));
        console.log(c.muted("  Install the GitHub App at: https://gitbank.io/app"));
        console.log();
        return;
      }

      for (const r of list) {
        const vis = r.private ? c.warn("[private]") : c.success("[public]");
        console.log(
          `  ${vis}  ${c.accent(r.repoFullName.padEnd(40))}  ` +
            `${c.muted("branch: " + r.defaultBranch)}`
        );
        console.log(`  ${" ".repeat(11)}${c.muted(r.htmlUrl)}`);
        console.log();
      }

      console.log(
        c.muted(
          `  ${list.length} repo(s) connected.  Remove: gitbank repos remove <installationId>`
        )
      );
      console.log();
    });

  repos
    .command("remove <installationId>")
    .description("Remove a GitHub App installation")
    .action(async (installationId: string) => {
      const client = getClient();
      await client.removeRepo(parseInt(installationId, 10));
      console.log(c.success(`  ✓ Installation ${installationId} removed.`));
      console.log();
    });
}
