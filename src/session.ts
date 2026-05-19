import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SESSION_DIR = path.join(os.homedir(), ".gitbank");
const SESSION_FILE = path.join(SESSION_DIR, "session.json");
const CONFIG_FILE = path.join(SESSION_DIR, "config.json");

interface SessionData {
  cookie: string;
  savedAt: string;
}

interface ConfigData {
  apiUrl?: string;
}

function ensureDir(): void {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true, mode: 0o700 });
  }
}

export function loadSession(): string | null {
  try {
    if (!fs.existsSync(SESSION_FILE)) return null;
    const raw = fs.readFileSync(SESSION_FILE, "utf-8");
    const data: SessionData = JSON.parse(raw);
    return data.cookie ?? null;
  } catch {
    return null;
  }
}

export function saveSession(cookie: string): void {
  ensureDir();
  const data: SessionData = { cookie, savedAt: new Date().toISOString() };
  fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2), {
    mode: 0o600,
  });
}

export function clearSession(): void {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
    }
  } catch {
    // ignore
  }
}

export function loadConfig(): ConfigData {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw) as ConfigData;
  } catch {
    return {};
  }
}

export function saveConfig(data: ConfigData): void {
  ensureDir();
  const existing = loadConfig();
  const merged = { ...existing, ...data };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), {
    mode: 0o600,
  });
}
