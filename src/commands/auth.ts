import { Command } from "commander";
import chalk from "chalk";
import { GitbankClient, GitbankAuthError } from "@gitbank-agent/sdk";
import { loadSession, saveSession, clearSession } from "../session.js";
import { c, printKV, printSection } from "../ui/colors.js";
import { execSync } from "node:child_process";
import http from "node:http";
import { URL } from "node:url";

function openBrowser(url: string): void {
  try {
    const platform = process.platform;
    if (platform === "darwin") execSync(`open "${url}"`);
    else if (platform === "win32") execSync(`start "" "${url}"`);
    else execSync(`xdg-open "${url}" 2>/dev/null || true`);
  } catch {
    // ignore open errors
  }
}

async function pollForSession(
  client: GitbankClient,
  timeoutMs = 120_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const interval = 2000;

  process.stdout.write(c.label("  Waiting for GitHub OAuth"));

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    process.stdout.write(c.accent("."));
    try {
      await client.me();
      const cookie = client.getCookie();
      if (cookie) {
        saveSession(cookie);
        process.stdout.write("\n");
        return;
      }
    } catch (err) {
      if (!(err instanceof GitbankAuthError)) {
        process.stdout.write("\n");
        throw err;
      }
    }
  }
  process.stdout.write("\n");
  throw new Error("OAuth timeout — please try again");
}

async function loginWithLocalCallback(
  client: GitbankClient,
  _apiUrl: string
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const server = http.createServer((req, res) => {
      if (!req.url) {
        res.end();
        return;
      }
      const url = new URL(req.url, "http://localhost");
      const cookie = url.searchParams.get("cookie");
      if (cookie) {
        client.setCookie(cookie);
        saveSession(cookie);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          `<html><body style="font-family:monospace;background:#0a0a0a;color:#3b82f6;padding:40px">
            <h2>✓ Gitbank CLI authenticated</h2>
            <p>You can close this tab and return to your terminal.</p>
          </body></html>`
        );
        server.close();
        resolve(true);
      } else {
        res.writeHead(400);
        res.end("No cookie");
        resolve(false);
      }
    });

    server.listen(0, "127.0.0.1", () => {
      resolve(false);
    });

    server.on("error", () => resolve(false));

    setTimeout(() => {
      server.close();
      resolve(false);
    }, 5000);
  });
}

export function registerAuthCommands(
  program: Command,
  getClient: () => GitbankClient
): void {
  const auth = program
    .command("auth")
    .description("Manage GitHub authentication");

  auth
    .command("login")
    .description("Authenticate via GitHub OAuth")
    .action(async () => {
      const client = getClient();
      const loginUrl = client.getLoginUrl();

      console.log();
      console.log(c.header("  GitHub OAuth Login"));
      console.log(c.label("  ─────────────────────────────────────────────────────────"));
      console.log(c.label("  Opening browser at:"));
      console.log("  " + chalk.underline(loginUrl));
      console.log();

      openBrowser(loginUrl);

      console.log(c.label("  If your browser did not open, visit the URL above manually."));
      console.log(c.label("  Polling for authentication (up to 2 minutes)..."));
      console.log();

      try {
        await pollForSession(client, 120_000);
        const user = await client.me();
        console.log(c.success("  ✓ Authenticated!"));
        console.log();
        printKV([
          { label: "GitHub user", value: c.accent("@" + user.githubLogin) },
          { label: "GitHub ID", value: c.value(String(user.githubId)) },
          { label: "Role", value: c.value(user.role) },
          {
            label: "Vault",
            value: user.vaultAddress
              ? c.hash(user.vaultAddress)
              : c.warn("Not deployed — run: gitbank vault deploy"),
          },
        ]);
        console.log();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(c.error("  ✗ Login failed: " + msg));
        process.exit(1);
      }
    });

  auth
    .command("logout")
    .description("Sign out and clear local session")
    .action(async () => {
      const client = getClient();
      try {
        if (client.getCookie()) {
          await client.logout();
        }
      } catch {
        // ignore logout errors
      }
      clearSession();
      console.log(c.success("  ✓ Signed out — session cleared."));
    });

  auth
    .command("me")
    .description("Show currently authenticated user")
    .action(async () => {
      const client = getClient();
      try {
        const user = await client.me();
        printSection("Current User");
        printKV([
          { label: "GitHub user", value: c.accent("@" + user.githubLogin) },
          { label: "GitHub ID", value: c.value(String(user.githubId)) },
          { label: "Role", value: c.value(user.role) },
          {
            label: "Vault address",
            value: user.vaultAddress
              ? c.hash(user.vaultAddress)
              : c.warn("Not deployed"),
          },
          {
            label: "Owner address",
            value: user.ownerAddress
              ? c.hash(user.ownerAddress)
              : c.muted("—"),
          },
        ]);
        console.log();
      } catch (err: unknown) {
        if (err instanceof GitbankAuthError) {
          console.error(c.error("  ✗ " + err.message));
          process.exit(1);
        }
        throw err;
      }
    });
}
