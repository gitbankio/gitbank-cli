import { Command } from "commander";
import { GitbankClient, Project, Task } from "@gitbank-agent/sdk";
import {
  c,
  printKV,
  printSection,
  printDivider,
  shortHash,
  statusColor,
  basescanUrl,
} from "../ui/colors.js";
import chalk from "chalk";
import readline from "node:readline";

function txLink(hash: string | null | undefined): string {
  if (!hash) return c.muted("—");
  return chalk.underline(c.hash(basescanUrl(hash)));
}

function parseRawAmount(raw: string, token: string): string {
  const decimals = token === "USDC" ? 6 : token === "WETH" ? 18 : token === "cbBTC" ? 8 : 18;
  const n = BigInt(raw);
  const divisor = BigInt(10 ** decimals);
  const whole = n / divisor;
  const fraction = n % divisor;
  if (fraction === BigInt(0)) return whole.toString();
  const frac = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${frac}`;
}

function printProject(p: Project): void {
  const total = parseRawAmount(p.totalBudget, p.token);
  const spent = parseRawAmount(p.spentBudget, p.token);
  printKV([
    { label: "ID", value: c.value(String(p.id)) },
    { label: "Name", value: c.accent(p.name) },
    { label: "Repo", value: c.value(p.repo) },
    { label: "Token", value: c.accent(p.token) },
    { label: "Budget", value: c.value(total + " " + p.token) },
    { label: "Spent", value: c.value(spent + " " + p.token) },
    {
      label: "Remaining",
      value: c.success(
        parseRawAmount(
          (BigInt(p.totalBudget) - BigInt(p.spentBudget)).toString(),
          p.token
        ) +
          " " +
          p.token
      ),
    },
    { label: "Status", value: statusColor(p.status) },
    { label: "Tx hash", value: shortHash(p.txHash) },
    { label: "Created", value: c.muted(new Date(p.createdAt).toLocaleString()) },
  ]);
}

function printTask(t: Task): void {
  const bounty = parseRawAmount(t.bountyAmount, t.token);
  console.log(
    `  ${c.label("#" + t.id)} ` +
      `${c.value("Issue #" + t.issueNumber)}  ` +
      `${c.accent(bounty + " " + t.token)}  ` +
      `${statusColor(t.status)}  ` +
      `${c.muted("@contributor:" + t.contributorGithubId)}`
  );
}

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(c.label("  " + question), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function registerProjectCommands(
  program: Command,
  getClient: () => GitbankClient
): void {
  const projects = program
    .command("projects")
    .description("Project budget and bounty management");

  projects
    .command("list")
    .description("List all your projects")
    .action(async () => {
      const client = getClient();
      const list = await client.getProjects();

      printSection("Projects");

      if (list.length === 0) {
        console.log(c.muted("  No projects found. Create one with: gitbank projects create"));
        console.log();
        return;
      }

      for (const p of list) {
        const total = parseRawAmount(p.totalBudget, p.token);
        const spent = parseRawAmount(p.spentBudget, p.token);
        console.log(
          `  ${c.header("#" + p.id).padEnd(6)}` +
            `  ${c.accent(p.name).padEnd(30)}` +
            `  ${c.value(total + " " + p.token).padEnd(16)}` +
            `  spent: ${c.value(spent)}` +
            `  ${statusColor(p.status)}`
        );
      }
      console.log();
    });

  projects
    .command("create")
    .description("Create a new project with on-chain budget")
    .option("--name <name>", "Project name")
    .option("--repo <repo>", "GitHub repo (owner/repo)")
    .option("--token <token>", "Token (USDC or WETH)")
    .option("--budget <amount>", "Total budget amount")
    .action(
      async (opts: {
        name?: string;
        repo?: string;
        token?: string;
        budget?: string;
      }) => {
        const name = opts.name ?? (await prompt("Project name: "));
        const repo = opts.repo ?? (await prompt("GitHub repo (owner/repo): "));
        const token = (
          opts.token ?? (await prompt("Token [USDC/WETH]: "))
        ).toUpperCase();
        const budget = opts.budget ?? (await prompt("Budget amount: "));

        const client = getClient();
        console.log(c.label(`  Creating project "${name}" with ${budget} ${token} budget...`));

        const project = await client.createProject({ name, repo, token, budget });

        printSection("Project Created");
        printProject(project);
        console.log();
        console.log(c.success("  ✓ Project created on-chain."));
        console.log();
      }
    );

  projects
    .command("show <projectId>")
    .description("Show project details and task list")
    .action(async (projectId: string) => {
      const client = getClient();
      const project = await client.getProject(parseInt(projectId, 10));

      printSection(`Project #${project.id} — ${project.name}`);
      printProject(project);

      if (project.tasks && project.tasks.length > 0) {
        console.log();
        console.log(c.label("  Tasks:"));
        printDivider();
        for (const t of project.tasks) {
          printTask(t);
        }
      } else {
        console.log();
        console.log(c.muted("  No tasks assigned yet."));
      }
      console.log();
    });

  const task = projects
    .command("task")
    .description("Task and bounty management");

  task
    .command("add")
    .description("Assign a bounty to a GitHub issue")
    .requiredOption("--project <id>", "Project ID")
    .requiredOption("--issue <number>", "GitHub issue number")
    .requiredOption("--repo <repo>", "GitHub repo (owner/repo)")
    .requiredOption("--to <githubId>", "Contributor GitHub numeric ID")
    .requiredOption("--bounty <amount>", "Bounty amount")
    .option("--token <token>", "Token (USDC or WETH)", "USDC")
    .action(
      async (opts: {
        project: string;
        issue: string;
        repo: string;
        to: string;
        bounty: string;
        token: string;
      }) => {
        const client = getClient();
        const projectId = parseInt(opts.project, 10);

        console.log(
          c.label(
            `  Assigning ${opts.bounty} ${opts.token.toUpperCase()} bounty to issue #${opts.issue}...`
          )
        );

        const t = await client.createTask(projectId, {
          issueNumber: parseInt(opts.issue, 10),
          repo: opts.repo,
          contributorGithubId: parseInt(opts.to, 10),
          bountyAmount: opts.bounty,
          token: opts.token.toUpperCase(),
        });

        printSection("Bounty Assigned");
        printKV([
          { label: "Task ID", value: c.value(String(t.id)) },
          { label: "Issue", value: c.accent("#" + t.issueNumber) },
          { label: "Repo", value: c.value(t.repo) },
          { label: "Contributor", value: c.value("GitHub ID " + t.contributorGithubId) },
          {
            label: "Bounty",
            value: c.value(parseRawAmount(t.bountyAmount, t.token) + " " + t.token),
          },
          { label: "Status", value: statusColor(t.status) },
          { label: "Tx hash", value: shortHash(t.assignTxHash) },
          { label: "Basescan", value: txLink(t.assignTxHash) },
        ]);
        console.log();
      }
    );

  task
    .command("cancel <projectId> <taskId>")
    .description("Cancel a task and reclaim bounty back to project budget")
    .action(async (projectId: string, taskId: string) => {
      const client = getClient();
      console.log(c.label(`  Cancelling task #${taskId} and reclaiming bounty...`));

      const result = await client.cancelTask(
        parseInt(projectId, 10),
        parseInt(taskId, 10)
      );

      printSection("Task Cancelled");
      printKV([
        { label: "Status", value: c.success(result.status) },
        { label: "Tx hash", value: shortHash(result.txHash) },
        { label: "Basescan", value: txLink(result.txHash) },
      ]);
      console.log();
      console.log(c.success("  ✓ Bounty returned to project budget."));
      console.log();
    });
}
