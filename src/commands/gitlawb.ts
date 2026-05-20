import { Command } from "commander";
import { c, printSection, printDivider } from "../ui/colors.js";
import { execSync, spawnSync } from "node:child_process";
import chalk from "chalk";

const DEFAULT_NODE = "https://node.gitlawb.com";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getNode(overrideNode?: string): string {
  return overrideNode ?? process.env["GITLAWB_NODE"] ?? DEFAULT_NODE;
}

function glAvailable(): boolean {
  try {
    execSync("gl --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function gitRemoteAvailable(): boolean {
  try {
    execSync("git-remote-gitlawb --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/** Run a gl command with inherited stdio (user sees output live). Returns exit code. */
function runGl(args: string[], node: string): number {
  const result = spawnSync("gl", args, {
    stdio: "inherit",
    env: { ...process.env, GITLAWB_NODE: node },
  });
  return result.status ?? 1;
}

/** Run a gl command silently and return stdout. Returns null on failure. */
function glCapture(args: string[], node: string): string | null {
  const result = spawnSync("gl", args, {
    stdio: "pipe",
    env: { ...process.env, GITLAWB_NODE: node },
    encoding: "utf8",
  });
  if (result.status !== 0) return null;
  return (result.stdout as string).trim();
}

function printInstallInstructions(): void {
  console.log();
  console.log(c.label("  Install the Gitlawb CLI (gl + git-remote-gitlawb):"));
  console.log();
  console.log("  " + chalk.bold("Recommended (macOS / Linux):"));
  console.log("  " + c.accent("curl -fsSL https://gitlawb.com/install.sh | bash"));
  console.log();
  console.log(c.muted("  Note: must pipe to bash — sh/dash don't support pipefail."));
  console.log();
  console.log("  " + chalk.bold("From source (requires Rust):"));
  console.log("  " + c.accent("cargo install --git https://github.com/gitlawb/gitlawb gl git-remote-gitlawb"));
  console.log();
  console.log(c.muted("  Supports: macOS arm64 · macOS x86_64 · Linux x86_64 · Linux arm64"));
  console.log(c.muted("  After install, run: gitbank gitlawb setup --name <repo>"));
  console.log();
}

/** Convert a DID to short key (strip did:key: prefix). */
function didShortKey(did: string): string {
  return did.replace(/^did:key:/, "");
}

/** Build the HTTP clone URL for a repo (works without git-remote-gitlawb). */
function httpCloneUrl(node: string, did: string, repo: string): string {
  const base = node.replace(/\/$/, "");
  return `${base}/${didShortKey(did)}/${repo}.git`;
}

function requireGl(): void {
  if (!glAvailable()) {
    console.log();
    console.log(c.error("  ✗ Gitlawb CLI (gl) is not installed."));
    printInstallInstructions();
    process.exit(1);
  }
}

function step(n: number, title: string): void {
  console.log();
  console.log(c.header(`  ┌─ Step ${n}: ${title}`));
  console.log();
}

function ok(msg: string): void {
  console.log(c.success("  ✓ " + msg));
}

function info(msg: string): void {
  console.log(c.muted("  " + msg));
}

// ── Main command group ────────────────────────────────────────────────────────

export function registerGitlawbCommands(program: Command): void {
  const gl = program
    .command("gitlawb")
    .description("Gitlawb decentralized git — full workflow from install to live repo")
    .option("--node <url>", "Gitlawb node URL", DEFAULT_NODE);

  // ── setup ─────────────────────────────────────────────────────────────────
  // The main command: walks through the full flow from a bare VPS to a live repo.

  gl
    .command("setup")
    .description("Full setup wizard: install gl → create identity → register → create repo → clone")
    .requiredOption("--name <name>", "Repository name to create on Gitlawb")
    .option("--description <desc>", "Repository description", "")
    .option("--skip-clone", "Skip the git clone step after creating the repo")
    .action(async (opts: { name: string; description: string; skipClone?: boolean }) => {
      const node = getNode((gl.opts() as { node?: string }).node);

      printSection("Gitlawb Setup Wizard");
      console.log(c.muted("  Node: " + node));
      console.log(c.muted("  Repo: " + opts.name));
      console.log();
      printDivider();

      // ── Step 1: Install gl ──────────────────────────────────────────────

      step(1, "Install Gitlawb CLI (gl + git-remote-gitlawb)");

      if (glAvailable()) {
        const ver = glCapture(["--version"], node) ?? "installed";
        ok("gl is installed  (" + ver + ")");
        if (!gitRemoteAvailable()) {
          console.log(c.warn("  ! git-remote-gitlawb is not on PATH."));
          info("Install it to enable git clone/push via DID transport:");
          console.log("  " + c.accent("curl -fsSL https://gitlawb.com/install.sh | sh"));
          console.log();
        } else {
          ok("git-remote-gitlawb is installed");
        }
      } else {
        console.log(c.warn("  gl is not installed. Install it now:"));
        console.log();
        console.log("  " + c.accent("curl -fsSL https://gitlawb.com/install.sh | sh"));
        console.log("  " + c.muted("# or: npm install -g @gitlawb/gl"));
        console.log();
        console.log(c.muted("  After installing, re-run:"));
        console.log("  " + c.accent("gitbank gitlawb setup --name " + opts.name));
        process.exit(0);
      }

      // ── Step 2: Set node URL ────────────────────────────────────────────

      step(2, "Configure node URL");
      console.log(c.label("  " + node));
      console.log();
      if (!process.env["GITLAWB_NODE"]) {
        info("Add this to your ~/.bashrc or ~/.zshrc to make it permanent:");
        console.log("  " + c.accent("export GITLAWB_NODE=" + node));
        console.log();
      } else {
        ok("GITLAWB_NODE is set  (" + process.env["GITLAWB_NODE"] + ")");
      }

      // ── Step 3: Create identity ─────────────────────────────────────────

      step(3, "Create DID identity (Ed25519 keypair)");

      const existingDid = glCapture(["identity", "show"], node);
      if (existingDid) {
        ok("Identity exists:");
        console.log("  " + c.hash(existingDid));
      } else {
        info("No identity found. Generating a new Ed25519 keypair...");
        console.log();
        const code = runGl(["identity", "new"], node);
        if (code !== 0) {
          console.log(c.error("  ✗ Failed to create identity. Run manually: gl identity new"));
          process.exit(1);
        }
      }
      console.log();

      // ── Step 4: Register with node ──────────────────────────────────────

      step(4, "Register DID with node (sign UCAN token)");
      info("Registering DID with " + node + "...");
      console.log();
      runGl(["register", "--node", node], node);
      console.log();
      ok("Registration complete. UCAN token saved to ~/.gitlawb/ucan.json");

      // ── Step 5: Create repository ───────────────────────────────────────

      step(5, `Create repository "${opts.name}"`);
      console.log();
      const repoArgs = ["repo", "create", opts.name, "--node", node];
      if (opts.description) repoArgs.push("--description", opts.description);
      const repoCode = runGl(repoArgs, node);
      console.log();
      if (repoCode !== 0) {
        console.log(c.warn("  ! Repo may already exist, or the create failed. Continuing..."));
      } else {
        ok(`Repository "${opts.name}" created on Gitlawb.`);
      }

      // ── Step 6: Clone ───────────────────────────────────────────────────

      const did = glCapture(["identity", "show"], node);
      let cloned = false;

      if (!opts.skipClone && did) {
        step(6, "Clone repository");

        const didUrl = `gitlawb://${did}/${opts.name}`;
        const httpUrl = httpCloneUrl(node, did, opts.name);

        if (gitRemoteAvailable()) {
          console.log(c.label("  Clone URL (DID): ") + c.accent(didUrl));
          console.log();
          const r = spawnSync("git", ["clone", didUrl], {
            stdio: "inherit",
            env: { ...process.env, GITLAWB_NODE: node },
          });
          console.log();
          if (r.status === 0) {
            ok(`Cloned to ./${opts.name}`);
            cloned = true;
          } else {
            console.log(c.warn("  ! DID clone failed. Falling back to HTTP..."));
          }
        } else {
          info("git-remote-gitlawb not on PATH — using HTTP clone (works without it).");
          console.log();
        }

        if (!cloned) {
          console.log(c.label("  Clone URL (HTTP): ") + c.accent(httpUrl));
          console.log();
          const r = spawnSync("git", ["clone", httpUrl], {
            stdio: "inherit",
            env: { ...process.env, GITLAWB_NODE: node },
          });
          console.log();
          if (r.status === 0) {
            ok(`Cloned to ./${opts.name}`);
            cloned = true;
          } else {
            console.log(c.warn("  ! Clone failed. Try manually:"));
            console.log("  " + c.accent(`git clone "${httpUrl}"`));
          }
        }
      }

      // ── Step 7: Next steps ──────────────────────────────────────────────

      step(7, "Done — your repo is live");
      printDivider();
      console.log();

      if (did) {
        const didKey = did.split(":")[2] ?? "";
        const short = didKey.slice(0, 8);
        console.log(c.label("  Your DID:"));
        console.log("  " + c.hash(did));
        console.log();
        console.log(c.label("  Profile:"));
        console.log("  " + chalk.underline(c.accent(`https://gitlawb.com/${short}`)));
        console.log();
        console.log(c.label("  Browse all repos:"));
        console.log("  " + chalk.underline(c.muted("https://gitlawb.com/node/repos")));
      }

      console.log();
      console.log(c.label("  Next steps inside the repo:"));
      console.log("  " + c.muted("cd " + opts.name));
      if (did) {
        console.log("  " + c.muted(`git config user.name  "${did}"`));
        console.log("  " + c.muted(`git config user.email "${did}@gitlawb"`));
      }
      console.log("  " + c.muted("echo '# " + opts.name + "' > README.md"));
      console.log("  " + c.muted("git add . && git commit -m 'init'"));
      console.log("  " + c.muted("git branch -M main") + c.muted("   # rename default branch if it's 'master'"));
      console.log("  " + c.muted("git push -u origin main"));
      console.log();
      console.log(c.muted("  Manage with:  gitbank gitlawb repo list"));
      console.log(c.muted("  Open a PR:    gitbank gitlawb pr create " + opts.name + " --head <branch> --base main --title \"...\""));
      console.log();
    });

  // ── install ───────────────────────────────────────────────────────────────

  gl
    .command("install")
    .description("Show how to install the Gitlawb CLI (gl + git-remote-gitlawb)")
    .action(() => {
      printSection("Install Gitlawb CLI");
      printInstallInstructions();
    });

  // ── doctor ────────────────────────────────────────────────────────────────

  gl
    .command("doctor")
    .description("Check gl installation, identity, registration, and node connectivity")
    .action(() => {
      const node = getNode((gl.opts() as { node?: string }).node);
      requireGl();
      printSection("Gitlawb Doctor");
      runGl(["doctor", "--node", node], node);
      console.log();
    });

  // ── status ────────────────────────────────────────────────────────────────

  gl
    .command("status")
    .description("Show Gitlawb node status")
    .action(() => {
      const node = getNode((gl.opts() as { node?: string }).node);
      requireGl();
      printSection("Gitlawb Node Status");
      runGl(["node", "status", "--node", node], node);
      console.log();
    });

  // ── profile ───────────────────────────────────────────────────────────────

  gl
    .command("profile")
    .description("Show your Gitlawb profile URL")
    .action(() => {
      const node = getNode((gl.opts() as { node?: string }).node);
      requireGl();
      const did = glCapture(["identity", "show"], node);
      if (!did) {
        console.log(c.warn("  No identity found. Run: gitbank gitlawb setup --name <repo>"));
        process.exit(1);
      }
      const didKey = did.split(":")[2] ?? "";
      const short = didKey.slice(0, 8);
      printSection("Your Gitlawb Profile");
      console.log(c.label("  DID:     ") + c.hash(did));
      console.log(c.label("  Profile: ") + chalk.underline(c.accent(`https://gitlawb.com/${short}`)));
      console.log(c.label("  Repos:   ") + chalk.underline(c.muted("https://gitlawb.com/node/repos")));
      console.log();
    });

  // ── identity ──────────────────────────────────────────────────────────────

  const identityCmd = gl
    .command("identity")
    .description("Manage your Gitlawb Ed25519 identity");

  identityCmd
    .command("new")
    .description("Generate a new Ed25519 keypair and DID")
    .action(() => {
      const node = getNode((gl.opts() as { node?: string }).node);
      requireGl();
      printSection("Create Identity");
      runGl(["identity", "new"], node);
      console.log();
    });

  identityCmd
    .command("show")
    .description("Print your DID")
    .action(() => {
      const node = getNode((gl.opts() as { node?: string }).node);
      requireGl();
      runGl(["identity", "show"], node);
      console.log();
    });

  // ── register ──────────────────────────────────────────────────────────────

  gl
    .command("register")
    .description("Register your DID with the node and save a UCAN bootstrap token")
    .action(() => {
      const node = getNode((gl.opts() as { node?: string }).node);
      requireGl();
      printSection("Register with Gitlawb");
      console.log(c.label("  Node: ") + c.accent(node));
      console.log();
      runGl(["register", "--node", node], node);
      console.log();
      ok("UCAN token saved to ~/.gitlawb/ucan.json");
      console.log();
    });

  // ── repo ──────────────────────────────────────────────────────────────────

  const repoCmd = gl
    .command("repo")
    .description("Repository management on the Gitlawb network");

  repoCmd
    .command("create <name>")
    .description("Create a new repository")
    .option("--description <desc>", "Repository description", "")
    .action((name: string, opts: { description: string }) => {
      const node = getNode((gl.opts() as { node?: string }).node);
      requireGl();
      printSection("Create Repo");
      const args = ["repo", "create", name, "--node", node];
      if (opts.description) args.push("--description", opts.description);
      runGl(args, node);
      console.log();

      const did = glCapture(["identity", "show"], node);
      if (did) {
        ok(`Repo "${name}" created.`);
        console.log();
        console.log(c.label("  Clone with:"));
        console.log("  " + c.accent(`git clone "gitlawb://${did}/${name}"`));
        console.log();
      }
    });

  repoCmd
    .command("list")
    .description("List your repos on Gitlawb")
    .action(() => {
      const node = getNode((gl.opts() as { node?: string }).node);
      requireGl();
      printSection("Gitlawb Repos");
      runGl(["repo", "list", "--node", node], node);
      console.log();
    });

  repoCmd
    .command("info <name>")
    .description("Show metadata for a repository")
    .action((name: string) => {
      const node = getNode((gl.opts() as { node?: string }).node);
      requireGl();
      printSection(`Repo — ${name}`);
      runGl(["repo", "info", name, "--node", node], node);
      console.log();
    });

  repoCmd
    .command("clone <name> [ownerDid]")
    .description("Clone a repository (auto-falls back to HTTP if git-remote-gitlawb is missing)")
    .option("--http", "Force HTTP clone (skip DID transport even if available)")
    .action((name: string, ownerDid: string | undefined, opts: { http?: boolean }) => {
      const node = getNode((gl.opts() as { node?: string }).node);
      requireGl();

      const did = ownerDid ?? glCapture(["identity", "show"], node);
      if (!did) {
        console.log(c.error("  ✗ No DID. Run: gitbank gitlawb identity new"));
        process.exit(1);
      }

      const httpUrl = httpCloneUrl(node, did, name);
      const didUrl = `gitlawb://${did}/${name}`;
      const useDid = !opts.http && gitRemoteAvailable();
      const url = useDid ? didUrl : httpUrl;

      printSection("Clone Repo");
      console.log(c.label("  Transport: ") + (useDid ? c.accent("DID (gitlawb://)") : c.accent("HTTP")));
      console.log(c.label("  URL:       ") + c.accent(url));
      console.log();

      const result = spawnSync("git", ["clone", url], {
        stdio: "inherit",
        env: { ...process.env, GITLAWB_NODE: node },
      });
      console.log();

      if (result.status === 0) {
        ok(`Cloned to ./${name}`);
        console.log();
        console.log(c.label("  Next:"));
        console.log("  " + c.accent(`cd ${name}`));
        console.log("  " + c.accent(`git config user.name  "${did}"`));
        console.log("  " + c.accent(`git config user.email "${did}@gitlawb"`));
        console.log("  " + c.accent("git branch -M main") + c.muted("   # if default is 'master'"));
      } else {
        console.log(c.error("  ✗ Clone failed."));
        if (useDid) {
          console.log(c.muted("  Try HTTP: gitbank gitlawb repo clone " + name + " --http"));
        }
      }
      console.log();
    });

  // ── pr ───────────────────────────────────────────────────────────────────

  const prCmd = gl
    .command("pr")
    .description("Pull request management");

  prCmd
    .command("create <repo>")
    .description("Open a pull request")
    .requiredOption("--head <branch>", "Source branch")
    .requiredOption("--base <branch>", "Target branch")
    .requiredOption("--title <title>", "PR title")
    .option("--body <text>", "PR description")
    .action((repo: string, opts: { head: string; base: string; title: string; body?: string }) => {
      const node = getNode((gl.opts() as { node?: string }).node);
      requireGl();
      const args = ["pr", "create", repo, "--head", opts.head, "--base", opts.base, "--title", opts.title, "--node", node];
      if (opts.body) args.push("--body", opts.body);
      printSection("Create PR");
      runGl(args, node);
      console.log();
    });

  prCmd
    .command("list <repo>")
    .description("List pull requests")
    .action((repo: string) => {
      const node = getNode((gl.opts() as { node?: string }).node);
      requireGl();
      printSection(`PRs — ${repo}`);
      runGl(["pr", "list", repo, "--node", node], node);
      console.log();
    });

  prCmd
    .command("view <repo> <number>")
    .description("View a pull request")
    .action((repo: string, number: string) => {
      const node = getNode((gl.opts() as { node?: string }).node);
      requireGl();
      runGl(["pr", "view", repo, number, "--node", node], node);
      console.log();
    });

  prCmd
    .command("diff <repo> <number>")
    .description("Show the diff for a pull request")
    .action((repo: string, number: string) => {
      const node = getNode((gl.opts() as { node?: string }).node);
      requireGl();
      runGl(["pr", "diff", repo, number, "--node", node], node);
      console.log();
    });

  prCmd
    .command("review <repo> <number>")
    .description("Submit a review")
    .requiredOption("--status <status>", "approved | changes_requested | comment")
    .option("--body <text>", "Review comment")
    .action((repo: string, number: string, opts: { status: string; body?: string }) => {
      const node = getNode((gl.opts() as { node?: string }).node);
      requireGl();
      const args = ["pr", "review", repo, number, "--status", opts.status, "--node", node];
      if (opts.body) args.push("--body", opts.body);
      printSection("Submit Review");
      runGl(args, node);
      console.log();
    });

  prCmd
    .command("merge <repo> <number>")
    .description("Merge a pull request")
    .action((repo: string, number: string) => {
      const node = getNode((gl.opts() as { node?: string }).node);
      requireGl();
      printSection("Merge PR");
      runGl(["pr", "merge", repo, number, "--node", node], node);
      console.log();
    });

  // ── issue ─────────────────────────────────────────────────────────────────

  const issueCmd = gl
    .command("issue")
    .description("Issue management");

  issueCmd
    .command("create <repo>")
    .description("Create an issue")
    .requiredOption("--title <title>", "Issue title")
    .option("--body <text>", "Issue body")
    .action((repo: string, opts: { title: string; body?: string }) => {
      const node = getNode((gl.opts() as { node?: string }).node);
      requireGl();
      const args = ["issue", "create", repo, "--title", opts.title, "--node", node];
      if (opts.body) args.push("--body", opts.body);
      printSection("Create Issue");
      runGl(args, node);
      console.log();
    });

  issueCmd
    .command("list <repo>")
    .description("List issues")
    .action((repo: string) => {
      const node = getNode((gl.opts() as { node?: string }).node);
      requireGl();
      printSection(`Issues — ${repo}`);
      runGl(["issue", "list", repo, "--node", node], node);
      console.log();
    });

  issueCmd
    .command("view <repo> <number>")
    .description("View an issue")
    .action((repo: string, number: string) => {
      const node = getNode((gl.opts() as { node?: string }).node);
      requireGl();
      runGl(["issue", "view", repo, number, "--node", node], node);
      console.log();
    });

  issueCmd
    .command("close <repo> <number>")
    .description("Close an issue")
    .action((repo: string, number: string) => {
      const node = getNode((gl.opts() as { node?: string }).node);
      requireGl();
      printSection("Close Issue");
      runGl(["issue", "close", repo, number, "--node", node], node);
      console.log();
    });
}
