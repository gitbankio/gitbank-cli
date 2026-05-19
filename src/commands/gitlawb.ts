import { Command } from "commander";
import { GitlawbClient } from "@gitbank-agent/sdk";
import { loadDID } from "@gitbank-agent/sdk";
import { c, printSection, printKV, printDivider, shortHash } from "../ui/colors.js";
import { execSync } from "node:child_process";

function makeClient(node?: string): GitlawbClient {
  const did = loadDID();
  return new GitlawbClient({ node, did: did?.did });
}

export function registerGitlawbCommands(program: Command): void {
  const gl = program
    .command("gitlawb")
    .description("Gitlawb decentralized git network — repos, PRs, issues via DID identity")
    .option("--node <url>", "Gitlawb node URL (default: https://node.gitlawb.com)");

  gl
    .command("status")
    .description("Check Gitlawb node status and network info")
    .action(async () => {
      const opts = gl.opts() as { node?: string };
      const client = makeClient(opts.node);
      printSection("Gitlawb Node Status");
      try {
        const s = await client.nodeStatus();
        printKV([
          { label: "Node", value: c.accent(client.node) },
          { label: "Online", value: s.online ? c.success("yes") : c.error("no") },
          { label: "DID", value: c.hash(s.did) },
          { label: "Region", value: c.value(s.region) },
          { label: "Peers", value: c.value(String(s.peers)) },
          { label: "Repos", value: c.value(String(s.repos)) },
          { label: "Writes", value: c.value(String(s.writesAccepted)) },
        ]);
      } catch {
        printKV([{ label: "Node", value: c.accent(client.node) }]);
        console.log(c.muted("  (node API endpoint may vary — check https://gitlawb.com/node)"));
      }
      console.log();
    });

  gl
    .command("repos [ownerDid]")
    .description("List repos on the Gitlawb network")
    .action(async (ownerDid?: string) => {
      const opts = gl.opts() as { node?: string };
      const client = makeClient(opts.node);
      const did = ownerDid ?? loadDID()?.did;

      printSection("Gitlawb Repos");
      try {
        const repos = await client.listRepos(did);
        if (repos.length === 0) {
          console.log(c.muted("  No repos found."));
          console.log(c.muted("  Create one: gitbank gitlawb create <name>"));
          console.log();
          return;
        }
        for (const r of repos) {
          console.log(`  ${c.accent(r.name.padEnd(32))} ${c.muted(r.description || "")}`);
          console.log(`  ${c.label("owner  ")} ${c.hash(r.owner)}`);
          console.log(`  ${c.label("clone  ")} ${c.value(client.cloneUrl(r.name, r.owner))}`);
          console.log();
        }
        console.log(c.muted(`  ${repos.length} repo(s). Clone: git clone gitlawb://<did>/<name>`));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(c.warn("  Cannot fetch repos: " + msg));
        console.log(c.muted("  Node: " + client.node));
        if (did) console.log(c.muted("  DID:  " + did));
        console.log();
        console.log(c.muted("  Install gl: curl -fsSL https://gitlawb.com/install.sh | sh"));
        console.log(c.muted("  Then: gl repo list"));
      }
      console.log();
    });

  gl
    .command("create <name> [description]")
    .description("Create a new repo on the Gitlawb network")
    .action(async (name: string, description?: string) => {
      const opts = gl.opts() as { node?: string };
      const client = makeClient(opts.node);
      console.log(c.label(`  Creating repo "${name}" on ${client.node}...`));
      try {
        const r = await client.createRepo(name, description ?? "");
        printSection("Repo Created");
        printKV([
          { label: "Name", value: c.accent(r.name) },
          { label: "Owner", value: c.hash(r.owner) },
          { label: "Clone URL", value: c.value(client.cloneUrl(r.name, r.owner)) },
        ]);
        console.log();
        console.log(c.muted("  Clone: ") + c.accent(`git clone ${client.cloneUrl(r.name, r.owner)}`));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(c.warn("  Node returned: " + msg));
        console.log(c.muted("  Fallback: gl repo create " + name));
      }
      console.log();
    });

  gl
    .command("clone <name> [ownerDid]")
    .description("Clone a Gitlawb repo using DID transport")
    .action(async (name: string, ownerDid?: string) => {
      const opts = gl.opts() as { node?: string };
      const client = makeClient(opts.node);
      const did = ownerDid ?? loadDID()?.did;
      if (!did) {
        console.error(c.error("  ✗ No DID found. Run: gitbank did new"));
        process.exit(1);
      }
      const url = client.cloneUrl(name, did);
      console.log(c.label(`  Cloning ${url}...`));
      console.log();
      try {
        execSync(`git clone "${url}"`, { stdio: "inherit" });
        console.log();
        console.log(c.success(`  ✓ Cloned to ./${name}`));
      } catch {
        console.error(c.error("  ✗ Clone failed."));
        console.error(c.muted("  Ensure git-remote-gitlawb is installed:"));
        console.error(c.muted("  curl -fsSL https://gitlawb.com/install.sh | sh"));
      }
      console.log();
    });

  const prCmd = gl
    .command("pr")
    .description("Pull request management on Gitlawb repos");

  prCmd
    .command("list <repo>")
    .description("List pull requests for a Gitlawb repo")
    .action(async (repo: string) => {
      const opts = gl.opts() as { node?: string };
      const client = makeClient(opts.node);
      try {
        const prs = await client.listPRs(repo);
        printSection(`PRs — ${repo}`);
        if (prs.length === 0) {
          console.log(c.muted("  No open PRs."));
        }
        for (const pr of prs) {
          console.log(`  ${c.label(pr.id.slice(0, 8))}  ${c.accent(pr.title)}  ${c.muted(pr.status)}`);
          console.log(`  ${c.label("author")}  ${c.hash(pr.author)}  ${c.muted(pr.head + " → " + pr.base)}`);
          console.log();
        }
      } catch (e: unknown) {
        console.log(c.warn("  " + (e instanceof Error ? e.message : String(e))));
      }
      console.log();
    });

  prCmd
    .command("open <repo> <head> <base> <title>")
    .description("Open a pull request on a Gitlawb repo")
    .option("--body <text>", "PR description")
    .action(async (repo: string, head: string, base: string, title: string, opts: { body?: string }) => {
      const glOpts = gl.opts() as { node?: string };
      const client = makeClient(glOpts.node);
      console.log(c.label(`  Opening PR "${title}" on ${repo}...`));
      try {
        const pr = await client.openPR(repo, head, base, title, opts.body ?? "");
        printSection("PR Opened");
        printKV([
          { label: "ID", value: shortHash(pr.id) },
          { label: "Title", value: c.accent(pr.title) },
          { label: "Branches", value: c.value(pr.head + " → " + pr.base) },
          { label: "Status", value: c.value(pr.status) },
          { label: "Author", value: c.hash(pr.author) },
        ]);
      } catch (e: unknown) {
        console.log(c.warn("  " + (e instanceof Error ? e.message : String(e))));
        console.log(c.muted("  Try: gl pr create " + repo + " --head " + head + " --base " + base + ' --title "' + title + '"'));
      }
      console.log();
    });

  gl
    .command("issues <repo>")
    .description("List issues for a Gitlawb repo")
    .action(async (repo: string) => {
      const opts = gl.opts() as { node?: string };
      const client = makeClient(opts.node);
      try {
        const issues = await client.listIssues(repo);
        printSection(`Issues — ${repo}`);
        if (issues.length === 0) {
          console.log(c.muted("  No open issues."));
        }
        for (const iss of issues) {
          console.log(`  ${c.label(iss.id.slice(0, 8))}  ${c.accent(iss.title)}  ${c.muted(iss.status)}`);
          console.log(`  ${c.label("author")}  ${c.hash(iss.author)}`);
          console.log();
        }
      } catch (e: unknown) {
        console.log(c.warn("  " + (e instanceof Error ? e.message : String(e))));
      }
      console.log();
    });

  gl
    .command("cat <repo> <filepath>")
    .description("Read a file from a Gitlawb repo")
    .option("--ref <ref>", "Branch or commit ref", "main")
    .action(async (repo: string, filepath: string, opts: { ref: string }) => {
      const glOpts = gl.opts() as { node?: string };
      const client = makeClient(glOpts.node);
      try {
        const content = await client.readFile(repo, filepath, opts.ref);
        console.log(content);
      } catch (e: unknown) {
        console.error(c.error("  ✗ " + (e instanceof Error ? e.message : String(e))));
        process.exit(1);
      }
    });

  gl
    .command("install")
    .description("Show instructions to install the Gitlawb CLI (gl)")
    .action(() => {
      printSection("Install Gitlawb CLI");
      console.log(c.label("  Run this to install gl and git-remote-gitlawb:"));
      console.log();
      console.log("  " + c.accent("curl -fsSL https://gitlawb.com/install.sh | sh"));
      console.log();
      printDivider();
      console.log(c.label("  After install, generate your DID identity:"));
      console.log("  " + c.accent("gl identity new"));
      console.log();
      console.log(c.label("  Or use Gitbank's built-in DID:"));
      console.log("  " + c.accent("gitbank did new"));
      console.log();
      console.log(c.muted("  Docs: https://gitlawb.com/start"));
      console.log();
    });
}
