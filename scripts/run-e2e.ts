import { spawn, type ChildProcess } from "node:child_process";

const ROOT_URL = "http://127.0.0.1:3000";
const START_TIMEOUT_MS = 30_000;

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
  ["exec", "vite", "dev", "--host", "127.0.0.1", "--port", "3000", "--strictPort"],
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
  const playwright = spawn(
    "pnpm",
    ["exec", "playwright", "test", ...process.argv.slice(2)],
    {
      stdio: "inherit",
    },
  );
  exitCode = await new Promise<number>((resolve) => {
    playwright.once("exit", (code, signal) => {
      resolve(code ?? (signal === "SIGINT" ? 130 : 1));
    });
  });
} finally {
  stopServer();
}

process.exit(exitCode);
