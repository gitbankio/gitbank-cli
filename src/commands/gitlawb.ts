import { Command } from "commander";
import { GitlawbClient } from "@gitbank-agent/sdk";
import { loadDID } from "@gitbank-agent/sdk";
import { c, printSection, printKV, printDivider, shortHash } from "../ui/colors.js";
import { execSync } from "node:child_process";
import chalk from "chalk";

function makeClient(node?: string): GitlawbClient {
  const did = loadDID();
  return new GitlawbClient({ node, did: did?.did });
}

function requireDID(): string {
  const did = loadDID()?.did;
  if (!did) {
    console.error(c.error("  ✗ No DID found."));
    console.error(c.muted("  Generate one: gitbank did new"));
    process.exit(1);
  }
  return did;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function statusBadge(s: string): string {
  if (s === "open" || s === "approved") return c.success(s);
  if (s === "closed" || s === "merged") return c.muted(s);
  if (s === "changes_requested") return c.warn(s);
  return c.value(s);
}

export function registerGitlawbCommands(program: Command): void {
  const gl = program
    .command("gitlawb")
    .description("Gitlawb decentralized git — repos, PRs, issues, and DID identity on the network")
    .option("--node <url>", "Gitlawb node URL (default: https://node.gitlawb.com)");

  // ── Node ─────────────────────────────────────────────────────────────────

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
          { label: "Node",    value: c.accent(client.node) },
          { label: "Online",  value: s.online ? c.success("yes") : c.error("no") },
          { label: "DID",     value: c.hash(s.did) },
          { label: "Region",  value: c.value(s.region ?? "—") },
          { label: "Peers",   value: c.value(String(s.peers)) },
          { label: "Repos",   value: c.value(String(s.repos)) },
          { label: "Writes",  value: c.value(String(s.writesAccepted)) },
          ...(s.version ? [{ label: "Version", value: c.muted(s.version) }] : []),
        ]);
        console.log();
        console.log(c.muted("  Dashboard: https://gitlawb.com/node"));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(c.warn("  Could not reach node: " + msg));
        console.log(c.muted("  Node: " + client.node));
      }
      console.log();
    });

  gl
    .command("register")
    .description("Register your DID with the Gitlawb node and obtain a UCAN bootstrap token")
    .action(async () => {
      const opts = gl.opts() as { node?: string };
      requireDID();
      const client = makeClient(opts.node);
      printSection("Register with Gitlawb");
      console.log(c.label("  DID:  ") + c.hash(client.did!));
      console.log(c.label("  Node: ") + c.accent(client.node));
      console.log();
      try {
        const reg = await client.register();
        console.log(c.success("  ✓ Registered successfully."));
        console.log();
        printKV([
          { label: "DID",      value: c.hash(reg.did) },
          { label: "UCAN",     value: c.muted(reg.ucan.slice(0, 40) + "…") },
          { label: "Saved to", value: c.muted("~/.gitlawb/ucan.json  (via gl register)") },
        ]);
        console.log();
        console.log(c.muted("  Profile: " + client.profileUrl(reg.did).profile));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(c.warn("  Node returned: " + msg));
        console.log();
        console.log(c.label("  You can also register with the gl CLI:"));
        console.log("  " + c.accent("gl register"));
      }
      console.log();
    });

  gl
    .command("profile")
    .description("Show your Gitlawb profile URL and trust score")
    .option("--did <did>", "Look up a specific DID instead of your own")
    .action(async (opts: { did?: string }) => {
      const glOpts = gl.opts() as { node?: string };
      const client = makeClient(glOpts.node);
      const did = opts.did ?? client.did ?? requireDID();
      const urls = client.profileUrl(did);

      printSection("Gitlawb Profile");
      printKV([
        { label: "DID",     value: c.hash(did) },
        { label: "Profile", value: chalk.underline(c.accent(urls.profile)) },
        { label: "Repos",   value: chalk.underline(c.muted(urls.repos)) },
      ]);

      try {
        const trust = await client.trustScore(did);
        console.log();
        printKV([
          { label: "Trust score", value: c.value(String(trust.score)) },
          { label: "Push count",  value: c.value(String(trust.pushCount)) },
          { label: "Registered",  value: c.muted(formatDate(trust.registeredAt)) },
        ]);
      } catch {
        // trust score endpoint may not be available on all nodes
      }
      console.log();
    });

  gl
    .command("doctor")
    .description("Check Gitlawb CLI installation and node connectivity")
    .action(() => {
      printSection("Gitlawb Doctor");

      let glInstalled = false;
      let gitRemoteInstalled = false;
      let nodeReachable = false;

      try { execSync("gl --version", { stdio: "pipe" }); glInstalled = true; } catch { /* not installed */ }
      try { execSync("git-remote-gitlawb --version", { stdio: "pipe" }); gitRemoteInstalled = true; } catch { /* not installed */ }

      const opts = gl.opts() as { node?: string };
      const node = opts.node ?? process.env["GITLAWB_NODE"] ?? "https://node.gitlawb.com";

      try {
        execSync(`curl -sf --max-time 5 "${node}/api/v1/status" -o /dev/null`, { stdio: "pipe" });
        nodeReachable = true;
      } catch { /* unreachable */ }

      const localDid = loadDID();

      console.log(c.label("  Checks:"));
      console.log(`  ${glInstalled ? c.success("✓") : c.error("✗")}  gl CLI              ${glInstalled ? c.muted("installed") : c.warn("missing — npm install -g @gitlawb/gl")}`);
      console.log(`  ${gitRemoteInstalled ? c.success("✓") : c.error("✗")}  git-remote-gitlawb  ${gitRemoteInstalled ? c.muted("installed") : c.warn("missing — needed for clone/push")}`);
      console.log(`  ${nodeReachable ? c.success("✓") : c.error("✗")}  node reachable      ${nodeReachable ? c.muted(node) : c.warn("cannot reach " + node)}`);
      console.log(`  ${localDid ? c.success("✓") : c.warn("!")}  local DID           ${localDid ? c.hash(localDid.did) : c.warn("none — run: gitbank did new")}`);
      console.log();

      if (!glInstalled || !gitRemoteInstalled) {
        console.log(c.label("  Install Gitlawb CLI:"));
        console.log("  " + c.accent("curl -fsSL https://gitlawb.com/install.sh | sh"));
        console.log();
      }
      if (glInstalled) {
        console.log(c.label("  Run the official health check:"));
        console.log("  " + c.accent("gl doctor"));
        console.log();
      }
    });

  // ── Repos ─────────────────────────────────────────────────────────────────

  gl
    .command("repos [ownerDid]")
    .description("List repos on the Gitlawb network (defaults to your own DID)")
    .action(async (ownerDid?: string) => {
      const opts = gl.opts() as { node?: string };
      const client = makeClient(opts.node);
      const did = ownerDid ?? client.did;

      printSection("Gitlawb Repos");
      try {
        const repos = await client.listRepos(did ?? undefined);
        if (repos.length === 0) {
          console.log(c.muted("  No repos found."));
          console.log(c.muted("  Create one: gitbank gitlawb create <name>"));
          console.log();
          return;
        }
        for (const r of repos) {
          console.log(`  ${c.accent(r.name.padEnd(32))} ${c.muted(r.description || "")}`);
          console.log(`  ${c.label("owner  ")} ${c.hash(r.owner)}`);
          console.log(`  ${c.label("branch ")} ${c.value(r.defaultBranch)}`);
          console.log(`  ${c.label("clone  ")} ${c.value(client.cloneUrl(r.name, r.owner))}`);
          console.log(`  ${c.label("updated")} ${c.muted(formatDate(r.updatedAt))}`);
          console.log();
        }
        console.log(c.muted(`  ${repos.length} repo(s).`));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(c.warn("  Cannot fetch repos: " + msg));
        if (did) console.log(c.muted("  DID: " + did));
        console.log(c.muted("  Fallback: gl repo list"));
      }
      console.log();
    });

  gl
    .command("create <name> [description]")
    .description("Create a new repository on the Gitlawb network")
    .action(async (name: string, description?: string) => {
      const opts = gl.opts() as { node?: string };
      requireDID();
      const client = makeClient(opts.node);
      console.log(c.label(`  Creating repo "${name}"...`));
      try {
        const r = await client.createRepo(name, description ?? "");
        printSection("Repo Created");
        printKV([
          { label: "Name",    value: c.accent(r.name) },
          { label: "Owner",   value: c.hash(r.owner) },
          { label: "Branch",  value: c.value(r.defaultBranch) },
          { label: "Clone",   value: c.value(client.cloneUrl(r.name, r.owner)) },
          { label: "Created", value: c.muted(formatDate(r.createdAt)) },
        ]);
        console.log();
        console.log(c.label("  Next steps:"));
        const cloneUrl = client.cloneUrl(r.name, r.owner);
        console.log("  " + c.accent(`git clone ${cloneUrl}`));
        console.log("  " + c.accent(`cd ${r.name}`));
        console.log("  " + c.muted("git config user.name  \"$(gl identity show)\""));
        console.log("  " + c.muted("git config user.email \"$(gl identity show)@gitlawb\""));
        console.log();
        console.log(c.muted("  Profile: " + client.profileUrl(r.owner).profile));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(c.warn("  Node returned: " + msg));
        console.log(c.muted("  Fallback: gl repo create " + name + (description ? ` --description "${description}"` : "")));
      }
      console.log();
    });

  gl
    .command("info <name>")
    .description("Show metadata for a Gitlawb repository")
    .action(async (name: string) => {
      const opts = gl.opts() as { node?: string };
      const client = makeClient(opts.node);
      try {
        const r = await client.getRepo(name);
        printSection(`Repo — ${r.name}`);
        printKV([
          { label: "Name",        value: c.accent(r.name) },
          { label: "Owner",       value: c.hash(r.owner) },
          { label: "Description", value: c.value(r.description || "—") },
          { label: "Branch",      value: c.value(r.defaultBranch) },
          { label: "Clone URL",   value: c.value(client.cloneUrl(r.name, r.owner)) },
          { label: "Created",     value: c.muted(formatDate(r.createdAt)) },
          { label: "Updated",     value: c.muted(formatDate(r.updatedAt)) },
        ]);
      } catch (e: unknown) {
        console.log(c.warn("  " + (e instanceof Error ? e.message : String(e))));
        console.log(c.muted("  Fallback: gl repo info " + name));
      }
      console.log();
    });

  gl
    .command("clone <name> [ownerDid]")
    .description("Clone a Gitlawb repository using DID transport (requires git-remote-gitlawb)")
    .action(async (name: string, ownerDid?: string) => {
      const opts = gl.opts() as { node?: string };
      const client = makeClient(opts.node);
      const did = ownerDid ?? client.did ?? requireDID();
      const url = client.cloneUrl(name, did);

      console.log(c.label("  Cloning: ") + c.accent(url));
      console.log();
      try {
        execSync(`git clone "${url}"`, { stdio: "inherit" });
        console.log();
        console.log(c.success(`  ✓ Cloned to ./${name}`));
        console.log();
        console.log(c.label("  Set your DID as git author:"));
        console.log("  " + c.accent(`cd ${name}`));
        console.log("  " + c.accent("git config user.name  \"$(gl identity show)\""));
        console.log("  " + c.accent("git config user.email \"$(gl identity show)@gitlawb\""));
      } catch {
        console.error(c.error("  ✗ Clone failed."));
        console.error(c.muted("  git-remote-gitlawb must be on PATH."));
        console.error(c.muted("  Install: curl -fsSL https://gitlawb.com/install.sh | sh"));
        process.exit(1);
      }
      console.log();
    });

  // ── Pull Requests ─────────────────────────────────────────────────────────

  const prCmd = gl
    .command("pr")
    .description("Pull request management on Gitlawb repositories");

  prCmd
    .command("list <repo>")
    .description("List pull requests for a repository")
    .action(async (repo: string) => {
      const opts = gl.opts() as { node?: string };
      const client = makeClient(opts.node);
      try {
        const prs = await client.listPRs(repo);
        printSection(`Pull Requests — ${repo}`);
        if (prs.length === 0) {
          console.log(c.muted("  No pull requests."));
          console.log();
          return;
        }
        for (const pr of prs) {
          const num = pr.number ?? pr.id.slice(0, 8);
          console.log(`  ${c.label("#" + String(num).padEnd(4))} ${c.accent(pr.title)}`);
          console.log(`  ${" ".repeat(6)}${statusBadge(pr.status).padEnd(18)} ${c.value(pr.head + " → " + pr.base)}`);
          console.log(`  ${" ".repeat(6)}${c.hash(pr.author)}  ${c.muted(formatDate(pr.createdAt))}`);
          console.log();
        }
        console.log(c.muted(`  ${prs.length} PR(s).`));
      } catch (e: unknown) {
        console.log(c.warn("  " + (e instanceof Error ? e.message : String(e))));
        console.log(c.muted("  Fallback: gl pr list " + repo));
      }
      console.log();
    });

  prCmd
    .command("view <repo> <id>")
    .description("View pull request details")
    .action(async (repo: string, id: string) => {
      const opts = gl.opts() as { node?: string };
      const client = makeClient(opts.node);
      try {
        const pr = await client.getPR(repo, id);
        printSection(`PR #${pr.number ?? id} — ${pr.title}`);
        printKV([
          { label: "Status",   value: statusBadge(pr.status) },
          { label: "Branches", value: c.value(pr.head + " → " + pr.base) },
          { label: "Author",   value: c.hash(pr.author) },
          { label: "Created",  value: c.muted(formatDate(pr.createdAt)) },
          ...(pr.mergedAt ? [{ label: "Merged", value: c.muted(formatDate(pr.mergedAt)) }] : []),
        ]);
        if (pr.body) {
          printDivider();
          console.log();
          pr.body.split("\n").forEach(l => console.log("  " + c.muted(l)));
        }
      } catch (e: unknown) {
        console.log(c.warn("  " + (e instanceof Error ? e.message : String(e))));
        console.log(c.muted("  Fallback: gl pr view " + repo + " " + id));
      }
      console.log();
    });

  prCmd
    .command("diff <repo> <id>")
    .description("Show the unified diff for a pull request")
    .action(async (repo: string, id: string) => {
      const opts = gl.opts() as { node?: string };
      const client = makeClient(opts.node);
      try {
        const diff = await client.getPRDiff(repo, id);
        console.log(diff);
      } catch (e: unknown) {
        console.error(c.error("  ✗ " + (e instanceof Error ? e.message : String(e))));
        console.error(c.muted("  Fallback: gl pr diff " + repo + " " + id));
        process.exit(1);
      }
    });

  prCmd
    .command("review <repo> <id>")
    .description("Submit a review for a pull request")
    .requiredOption("--status <status>", "Review decision: approved | changes_requested | comment")
    .option("--body <text>", "Review comment body")
    .action(async (repo: string, id: string, opts: { status: string; body?: string }) => {
      const glOpts = gl.opts() as { node?: string };
      const client = makeClient(glOpts.node);
      const status = opts.status as "approved" | "changes_requested" | "comment";
      if (!["approved", "changes_requested", "comment"].includes(status)) {
        console.error(c.error("  ✗ --status must be one of: approved, changes_requested, comment"));
        process.exit(1);
      }
      try {
        const review = await client.reviewPR(repo, id, status, opts.body ?? "");
        printSection("Review Submitted");
        printKV([
          { label: "PR",     value: c.value(`${repo} #${id}`) },
          { label: "Status", value: statusBadge(review.status) },
          { label: "Author", value: c.hash(review.author) },
        ]);
        if (opts.body) {
          console.log();
          console.log(c.muted("  " + opts.body));
        }
      } catch (e: unknown) {
        console.log(c.warn("  " + (e instanceof Error ? e.message : String(e))));
        console.log(c.muted(`  Fallback: gl pr review ${repo} ${id} --status ${status}`));
      }
      console.log();
    });

  prCmd
    .command("merge <repo> <id>")
    .description("Merge a pull request")
    .action(async (repo: string, id: string) => {
      const opts = gl.opts() as { node?: string };
      const client = makeClient(opts.node);
      console.log(c.label(`  Merging PR #${id} in ${repo}...`));
      try {
        await client.mergePR(repo, id);
        console.log(c.success(`  ✓ PR #${id} merged.`));
      } catch (e: unknown) {
        console.log(c.warn("  " + (e instanceof Error ? e.message : String(e))));
        console.log(c.muted("  Fallback: gl pr merge " + repo + " " + id));
      }
      console.log();
    });

  prCmd
    .command("open <repo> <head> <base> <title>")
    .description("Open a new pull request")
    .option("--body <text>", "PR description")
    .action(async (repo: string, head: string, base: string, title: string, opts: { body?: string }) => {
      const glOpts = gl.opts() as { node?: string };
      const client = makeClient(glOpts.node);
      console.log(c.label(`  Opening PR "${title}" in ${repo}...`));
      try {
        const pr = await client.openPR(repo, head, base, title, opts.body ?? "");
        printSection("Pull Request Opened");
        printKV([
          { label: "ID",       value: shortHash(pr.id) },
          { label: "Title",    value: c.accent(pr.title) },
          { label: "Branches", value: c.value(pr.head + " → " + pr.base) },
          { label: "Status",   value: statusBadge(pr.status) },
          { label: "Author",   value: c.hash(pr.author) },
        ]);
      } catch (e: unknown) {
        console.log(c.warn("  " + (e instanceof Error ? e.message : String(e))));
        console.log(c.muted(`  Fallback: gl pr create ${repo} --head ${head} --base ${base} --title "${title}"`));
      }
      console.log();
    });

  // ── Issues ────────────────────────────────────────────────────────────────

  const issueCmd = gl
    .command("issue")
    .description("Issue management on Gitlawb repositories");

  issueCmd
    .command("list <repo>", { isDefault: true })
    .description("List issues for a repository")
    .action(async (repo: string) => {
      const opts = gl.opts() as { node?: string };
      const client = makeClient(opts.node);
      try {
        const issues = await client.listIssues(repo);
        printSection(`Issues — ${repo}`);
        if (issues.length === 0) {
          console.log(c.muted("  No open issues."));
          console.log();
          return;
        }
        for (const iss of issues) {
          const num = iss.number ?? iss.id.slice(0, 8);
          const labels = iss.labels.length > 0 ? c.muted(" [" + iss.labels.join(", ") + "]") : "";
          console.log(`  ${c.label("#" + String(num).padEnd(4))} ${c.accent(iss.title)}${labels}`);
          console.log(`  ${" ".repeat(6)}${statusBadge(iss.status).padEnd(18)} ${c.hash(iss.author)}  ${c.muted(formatDate(iss.createdAt))}`);
          console.log();
        }
        console.log(c.muted(`  ${issues.length} issue(s).`));
      } catch (e: unknown) {
        console.log(c.warn("  " + (e instanceof Error ? e.message : String(e))));
        console.log(c.muted("  Fallback: gl issue list " + repo));
      }
      console.log();
    });

  issueCmd
    .command("view <repo> <id>")
    .description("View issue details")
    .action(async (repo: string, id: string) => {
      const opts = gl.opts() as { node?: string };
      const client = makeClient(opts.node);
      try {
        const iss = await client.getIssue(repo, id);
        printSection(`Issue #${iss.number ?? id} — ${iss.title}`);
        printKV([
          { label: "Status",  value: statusBadge(iss.status) },
          { label: "Author",  value: c.hash(iss.author) },
          { label: "Created", value: c.muted(formatDate(iss.createdAt)) },
          ...(iss.closedAt ? [{ label: "Closed", value: c.muted(formatDate(iss.closedAt)) }] : []),
          ...(iss.labels.length ? [{ label: "Labels", value: c.value(iss.labels.join(", ")) }] : []),
        ]);
        if (iss.body) {
          printDivider();
          console.log();
          iss.body.split("\n").forEach(l => console.log("  " + c.muted(l)));
        }
      } catch (e: unknown) {
        console.log(c.warn("  " + (e instanceof Error ? e.message : String(e))));
        console.log(c.muted("  Fallback: gl issue view " + repo + " " + id));
      }
      console.log();
    });

  issueCmd
    .command("create <repo>")
    .description("Create a new issue")
    .requiredOption("--title <title>", "Issue title")
    .option("--body <text>", "Issue body / description")
    .action(async (repo: string, opts: { title: string; body?: string }) => {
      const glOpts = gl.opts() as { node?: string };
      const client = makeClient(glOpts.node);
      console.log(c.label(`  Creating issue in ${repo}...`));
      try {
        const iss = await client.createIssue(repo, opts.title, opts.body ?? "");
        printSection("Issue Created");
        printKV([
          { label: "ID",     value: shortHash(iss.id) },
          { label: "Title",  value: c.accent(iss.title) },
          { label: "Status", value: statusBadge(iss.status) },
          { label: "Author", value: c.hash(iss.author) },
        ]);
      } catch (e: unknown) {
        console.log(c.warn("  " + (e instanceof Error ? e.message : String(e))));
        console.log(c.muted(`  Fallback: gl issue create ${repo} --title "${opts.title}"`));
      }
      console.log();
    });

  issueCmd
    .command("close <repo> <id>")
    .description("Close an issue")
    .action(async (repo: string, id: string) => {
      const opts = gl.opts() as { node?: string };
      const client = makeClient(opts.node);
      console.log(c.label(`  Closing issue #${id} in ${repo}...`));
      try {
        await client.closeIssue(repo, id);
        console.log(c.success(`  ✓ Issue #${id} closed.`));
      } catch (e: unknown) {
        console.log(c.warn("  " + (e instanceof Error ? e.message : String(e))));
        console.log(c.muted("  Fallback: gl issue close " + repo + " " + id));
      }
      console.log();
    });

  // ── Files ─────────────────────────────────────────────────────────────────

  gl
    .command("cat <repo> <filepath>")
    .description("Read a file from a Gitlawb repository")
    .option("--ref <ref>", "Branch or commit ref (default: main)")
    .action(async (repo: string, filepath: string, opts: { ref?: string }) => {
      const glOpts = gl.opts() as { node?: string };
      const client = makeClient(glOpts.node);
      try {
        const content = await client.readFile(repo, filepath, opts.ref ?? "main");
        console.log(content);
      } catch (e: unknown) {
        console.error(c.error("  ✗ " + (e instanceof Error ? e.message : String(e))));
        process.exit(1);
      }
    });

  // ── Install ───────────────────────────────────────────────────────────────

  gl
    .command("install")
    .description("Show installation instructions for the Gitlawb CLI (gl + git-remote-gitlawb)")
    .action(() => {
      printSection("Install Gitlawb CLI");
      printDivider();
      console.log(c.label("  macOS / Linux (recommended):"));
      console.log("  " + c.accent("curl -fsSL https://gitlawb.com/install.sh | sh"));
      console.log();
      console.log(c.muted("  Installs gl and git-remote-gitlawb. Supports:"));
      console.log(c.muted("  macOS arm64, macOS x86_64, Linux x86_64, Linux arm64"));
      console.log();
      printDivider();
      console.log(c.label("  npm:"));
      console.log("  " + c.accent("npm install -g @gitlawb/gl"));
      console.log();
      printDivider();
      console.log(c.label("  Build from source (requires Rust):"));
      console.log("  " + c.accent("cargo install --git https://github.com/gitlawb/gitlawb gl git-remote-gitlawb"));
      console.log();
      printDivider();
      console.log(c.label("  After install:"));
      console.log("  1. " + c.accent("export GITLAWB_NODE=https://node.gitlawb.com"));
      console.log("  2. " + c.accent("gl identity new") + c.muted("  ← or: gitbank did new"));
      console.log("  3. " + c.accent("gl register") + c.muted("         ← or: gitbank gitlawb register"));
      console.log("  4. " + c.accent("gl doctor") + c.muted("           ← verify everything is working"));
      console.log();
      console.log(c.muted("  Docs: https://gitlawb.com/start"));
      console.log();
    });
}
