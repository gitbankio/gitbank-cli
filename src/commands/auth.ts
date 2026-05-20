import { Command } from "commander";
import chalk from "chalk";
import { GitbankClient, GitbankAuthError } from "@gitbank-agent/sdk";
import { loadSession, saveSession, clearSession } from "../session.js";
import { c, printKV, printSection } from "../ui/colors.js";
import { execSync } from "node:child_process";

function isHeadless(): boolean {
  return (
    !process.env.DISPLAY &&
    !process.env.WAYLAND_DISPLAY &&
    process.platform !== "darwin" &&
    process.platform !== "win32"
  );
}

function openBrowser(url: string): boolean {
  try {
    const platform = process.platform;
    if (platform === "darwin") {
      execSync(`open "${url}"`);
      return true;
    } else if (platform === "win32") {
      execSync(`start "" "${url}"`);
      return true;
    } else if (process.env.DISPLAY || process.env.WAYLAND_DISPLAY) {
      execSync(`xdg-open "${url}" 2>/dev/null`);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

async function verifyCookieAndPrint(client: GitbankClient): Promise<void> {
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
      const headless = isHeadless();

      console.log();
      console.log(c.header("  GitHub OAuth Login"));
      console.log(c.label("  ─────────────────────────────────────────────────────────"));
      console.log();
      console.log(c.label("  Open this URL in your browser to login with GitHub:"));
      console.log();
      console.log("  " + chalk.bold.underline(loginUrl));
      console.log();

      if (!headless) {
        const opened = openBrowser(loginUrl);
        if (opened) {
          console.log(c.muted("  Browser opened automatically."));
          console.log();
        }
      }

      if (headless) {
        console.log(c.warn("  ┌─ Headless / VPS detected ───────────────────────────────┐"));
        console.log(c.warn("  │                                                          │"));
        console.log(c.warn("  │  Your browser cannot open automatically on this server.  │"));
        console.log(c.warn("  │                                                          │"));
        console.log(c.warn("  │  Steps:                                                  │"));
        console.log(c.warn("  │  1. Open the URL above in your LOCAL browser              │"));
        console.log(c.warn("  │  2. Complete GitHub login                                 │"));
        console.log(c.warn("  │  3. Open browser DevTools (F12)                          │"));
        console.log(c.warn('  │     Application → Cookies → find "connect.sid"           │'));
        console.log(c.warn("  │  4. Copy the full cookie value                           │"));
        console.log(c.warn("  │  5. Run on this VPS:                                     │"));
        console.log(c.warn("  │                                                          │"));
        console.log(c.warn('  │     ' + chalk.bold('gitbank auth set-cookie "connect.sid=<value>"') + '      │'));
        console.log(c.warn("  │                                                          │"));
        console.log(c.warn("  └──────────────────────────────────────────────────────────┘"));
        console.log();
      } else {
        console.log(c.label("  After completing login in your browser, run:"));
        console.log();
        console.log("  " + chalk.bold("gitbank auth me"));
        console.log();
        console.log(c.muted("  Or if auth did not persist, use:"));
        console.log(c.muted('  gitbank auth set-cookie "connect.sid=<value from browser cookies>"'));
        console.log();
      }
    });

  auth
    .command("set-cookie <cookie>")
    .description('Manually set session cookie (for VPS/headless — copy from browser DevTools)')
    .action(async (rawCookie: string) => {
      const client = getClient();

      let cookie = rawCookie.trim();
      if (!cookie.startsWith("connect.sid=")) {
        cookie = `connect.sid=${cookie}`;
      }

      client.setCookie(cookie);

      try {
        await verifyCookieAndPrint(client);
        saveSession(cookie);
        console.log(c.success("  ✓ Session saved to ~/.gitbank/session.json"));
        console.log();
      } catch (err: unknown) {
        if (err instanceof GitbankAuthError) {
          console.error(c.error("  ✗ Cookie is invalid or expired — please login again and copy a fresh cookie."));
          process.exit(1);
        }
        throw err;
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
          console.error(c.muted('  Run: gitbank auth login'));
          process.exit(1);
        }
        throw err;
      }
    });
}
