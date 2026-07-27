import { spawn, type ChildProcess } from "node:child_process";
import { loadEnv } from "vite";

const ROOT_URL = "http://127.0.0.1:3000";
const START_TIMEOUT_MS = 30_000;
const DEFAULT_PROJECTS = ["chromium", "firefox", "webkit", "Mobile Safari"] as const;

// Vite reads `.env*` itself, while the Playwright config runs in a separate
// Node process. Mirror Vite's public client env into that process so test
// selection sees the same feature flags as the application under test.
const viteEnv = loadEnv("development", process.cwd());
for (const [key, value] of Object.entries(viteEnv)) {
  process.env[key] ??= value;
}

function stopProcessTree(child: ChildProcess): void {
  if (!child.pid || child.exitCode !== null) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

async function waitForServer(server: ChildProcess): Promise<void> {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Vite exited before becoming ready (${String(server.exitCode)})`);
    }
    try {
      const response = await fetch(ROOT_URL, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) return;
    } catch {
      // Vite is still starting; retry on a short deterministic interval.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Vite did not become ready within ${String(START_TIMEOUT_MS)}ms`);
}

const server = spawn(
  "pnpm",
  [
    "exec",
    "vite",
    "dev",
    "--mode",
    "e2e",
    "--host",
    "127.0.0.1",
    "--port",
    "3000",
    "--strictPort",
  ],
  { stdio: "inherit", detached: true },
);

function stopServer(): void {
  stopProcessTree(server);
}

process.once("SIGINT", () => {
  stopServer();
  process.exit(130);
});
process.once("SIGTERM", () => {
  stopServer();
  process.exit(143);
});

let exitCode: number;
try {
  await waitForServer(server);
  const forwardedArgs = process.argv.slice(2);
  const hasExplicitProject = forwardedArgs.some(
    (argument) => argument === "--project" || argument.startsWith("--project="),
  );
  // Keep one Vite lifecycle, but let Playwright collect and execute one browser
  // project at a time. A single multi-project invocation can invalidate
  // Paraglide's dev SSR module context while projects are collected, causing
  // English requests to hydrate from the Russian base locale. Tests inside
  // each project remain fully parallel according to playwright.config.ts.
  const runs = hasExplicitProject
    ? [forwardedArgs]
    : DEFAULT_PROJECTS.map((project) => [...forwardedArgs, `--project=${project}`]);

  exitCode = 0;
  for (const args of runs) {
    const playwright = spawn("pnpm", ["exec", "playwright", "test", ...args], {
      stdio: "inherit",
    });
    exitCode = await new Promise<number>((resolve) => {
      playwright.once("exit", (code, signal) => {
        resolve(code ?? (signal === "SIGINT" ? 130 : 1));
      });
    });
    if (exitCode !== 0) break;
  }
} finally {
  stopServer();
}

process.exit(exitCode);
