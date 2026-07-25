import { execFile } from "node:child_process";
import { createServer, type RequestListener } from "node:http";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
      ),
  );
});

async function listen(
  handler: RequestListener,
): Promise<{ server: ReturnType<typeof createServer>; url: string }> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test address");
  return { server, url: `http://127.0.0.1:${String(address.port)}` };
}

describe("operational recovery and signal checks", () => {
  it("creates an encrypted allowlisted backup and restores it to a disposable target", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cutbg-backup-"));
    const input = path.join(dir, "input");
    const backupDir = path.join(dir, "backups");
    const restoreDir = path.join(dir, "restore");
    const passphrase = path.join(dir, "passphrase");
    await mkdir(input);
    await writeFile(path.join(input, "umami.sql"), "aggregate-only");
    await writeFile(path.join(input, "uptime-kuma.tar"), "monitor-state");
    await writeFile(passphrase, "disposable-test-key");

    const created = await execFileAsync("sh", ["scripts/operations/backup.sh"], {
      env: {
        ...process.env,
        BACKUP_INPUT_DIR: input,
        BACKUP_DIR: backupDir,
        BACKUP_PASSPHRASE_FILE: passphrase,
      },
    });
    expect(created.stdout).toContain("result=pass");
    const archiveName = (await readdir(backupDir)).find((name) =>
      name.endsWith(".tar.gz.enc"),
    );
    expect(archiveName).toBeTruthy();
    const archive = path.join(backupDir, archiveName!);
    expect(await readFile(archive, "utf8")).not.toContain("aggregate-only");

    const restored = await execFileAsync(
      "sh",
      ["scripts/operations/restore.sh", archive, restoreDir],
      { env: { ...process.env, BACKUP_PASSPHRASE_FILE: passphrase } },
    );
    expect(restored.stdout).toContain("mode=drill");
    expect(await readFile(path.join(restoreDir, "umami.sql"), "utf8")).toBe(
      "aggregate-only",
    );
    expect(
      await readFile(path.join(restoreDir, "backup-manifest.json"), "utf8"),
    ).toContain('"source-images"');
  });

  it("validates alert ownership and sends image-free firing/resolved probes", async () => {
    const payloads: unknown[] = [];
    const { url } = await listen((request, response) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk: string) => {
        body += chunk;
      });
      request.on("end", () => {
        payloads.push(JSON.parse(body));
        response.writeHead(204).end();
      });
    });
    const result = await execFileAsync(
      "node",
      ["scripts/operations/validate-alerts.mjs"],
      { env: { ...process.env, ALERT_DELIVERY_URL: url } },
    );
    expect(result.stdout).toContain("state=firing result=pass");
    expect(result.stdout).toContain("state=resolved result=pass");
    expect(payloads).toHaveLength(12);
    expect(JSON.stringify(payloads)).not.toMatch(/image|filename|sourceUrl|mask/i);
  });

  it("exercises bounded concurrent SSR and model-range readiness", async () => {
    const { url } = await listen((request, response) => {
      if (request.headers.range) {
        response.writeHead(206, {
          "content-range": "bytes 0-0/27",
          "content-length": "1",
        });
        response.end("x");
        return;
      }
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<main>cutbg</main>");
    });
    const result = await execFileAsync(
      "node",
      ["scripts/operations/exercise-capacity.mjs"],
      {
        env: {
          ...process.env,
          CAPACITY_BASE_URL: url,
          CAPACITY_CDN_BASE_URL: `${url}/models`,
          CAPACITY_SSR_CONCURRENCY: "8",
          CAPACITY_MODEL_CONCURRENCY: "2",
        },
      },
    );
    const report = JSON.parse(result.stdout) as {
      ssr: { failures: number };
      model: { failures: number };
    };
    expect(report.ssr.failures).toBe(0);
    expect(report.model.failures).toBe(0);
  });
});
