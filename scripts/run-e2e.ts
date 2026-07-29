import { spawn, type ChildProcess } from "node:child_process";
import { chromium } from "@playwright/test";
import { loadEnv } from "vite";

const START_TIMEOUT_MS = 30_000;
const DEFAULT_PROJECTS = [
  { name: "chromium" },
  // Persistent Magic/Manual layers intentionally retain full-resolution
  // alpha buffers. Running several software-rendered browser pages in
  // parallel makes Firefox/WebKit contend for the same host memory and turns
  // deterministic canvas assertions into scheduler timeouts.
  { name: "firefox", workers: 1 },
  { name: "webkit", workers: 1 },
  { name: "Mobile Safari", workers: 1 },
] as const;

// Vite reads `.env*` itself, while the Playwright config runs in a separate
// Node process. Mirror Vite's public client env into that process so test
// selection sees the same feature flags as the application under test.
const viteEnv = loadEnv("development", process.cwd());
for (const [key, value] of Object.entries(viteEnv)) {
  process.env[key] ??= value;
}
const ROOT_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

function stopProcessTree(child: ChildProcess): void {
  if (!child.pid || child.exitCode !== null) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

async function stopProcessTreeAndWait(child: ChildProcess): Promise<void> {
  stopProcessTree(child);
  if (child.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
  });
}

async function waitForRoute(server: ChildProcess, path: string): Promise<void> {
  const url = new URL(path, ROOT_URL).toString();
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Vite exited before becoming ready (${String(server.exitCode)})`);
    }
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(1_000),
      });
      const isReady = response.ok;
      await response.arrayBuffer();
      if (isReady) return;
    } catch {
      // Vite or this SSR route is still starting; retry deterministically.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${url} did not become ready within ${String(START_TIMEOUT_MS)}ms`);
}

async function waitForServer(server: ChildProcess): Promise<void> {
  // Probe a static asset so readiness does not make the base locale the first
  // SSR render. Locale pages are compiled deliberately in the browser below.
  await waitForRoute(server, "/favicon.ico");
}

async function warmBrowserLocales(verify: boolean): Promise<void> {
  const browser = await chromium.launch();
  try {
    for (const [path, locale] of [
      ["/en/", "en"],
      ["/", "ru"],
    ] as const) {
      const context = await browser.newContext({ serviceWorkers: "block" });
      try {
        const page = await context.newPage();
        await page.goto(new URL(path, ROOT_URL).toString(), {
          waitUntil: "domcontentloaded",
        });
        await page
          .locator('[data-slot="site-header"][data-hydrated="true"]')
          .waitFor({ state: "attached", timeout: START_TIMEOUT_MS });
        const actualLocale = await page.locator("html").getAttribute("lang");
        if (verify && actualLocale !== locale) {
          throw new Error(
            `Cold browser warm-up expected ${locale} at ${path}, received ${String(actualLocale)}`,
          );
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

function startServer(): ChildProcess {
  return spawn(
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
}

let server = startServer();

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
  // The first Vite process primes Paraglide's freshly generated SSR/client
  // module graph. A clean second process then verifies both hydrated locales
  // before parallel Playwright workers can observe the cold base-locale leak.
  await waitForServer(server);
  await warmBrowserLocales(false);
  await stopProcessTreeAndWait(server);
  server = startServer();
  await waitForServer(server);
  await warmBrowserLocales(true);
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
    : DEFAULT_PROJECTS.map((project) => [
        ...forwardedArgs,
        `--project=${project.name}`,
        ...("workers" in project ? [`--workers=${String(project.workers)}`] : []),
      ]);

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
