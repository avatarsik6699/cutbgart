import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const SHA_ONE = "1".repeat(40);
const SHA_TWO = "2".repeat(40);
const DIGEST_ONE = `sha256:${"a".repeat(64)}`;
const DIGEST_TWO = `sha256:${"b".repeat(64)}`;

async function createHarness() {
  const dir = await mkdtemp(path.join(tmpdir(), "cutbg-release-"));
  const bin = path.join(dir, "bin");
  const state = path.join(dir, "state");
  await mkdir(bin);
  await mkdir(state);
  const docker = path.join(bin, "docker");
  await writeFile(
    docker,
    `#!/bin/sh
set -eu
printf '%s\\n' "$*" >> "$FAKE_DOCKER_LOG"
case "$1 $2" in
  "compose config"|"compose pull"|"compose --profile"|"compose up") exit 0 ;;
  "image inspect")
    case "$4" in
      *version*) printf '%s\\n' "$APP_BUILD_ID" ;;
      *revision*) printf '%s\\n' "$APP_COMMIT_SHA" ;;
      *created*) printf '%s\\n' "$APP_CREATED_AT" ;;
    esac
    exit 0
    ;;
  "run -d")
    [ "\${FAKE_CANDIDATE_FAILURE:-0}" = "0" ] || exit 17
    printf '%s\\n' candidate-id
    exit 0
    ;;
  "port cutbg-candidate-"*) printf '%s\\n' "127.0.0.1:49152"; exit 0 ;;
  "exec -e")
    [ "\${FAKE_CANDIDATE_SMOKE_FAILURE:-0}" = "0" ] || exit 18
    exit 0
    ;;
  "rm -f") exit 0 ;;
  "compose exec")
    if [ "\${FAKE_POST_FAILURE_ONCE:-0}" = "1" ] && [ ! -f "$FAKE_POST_MARKER" ]; then
      : > "$FAKE_POST_MARKER"
      exit 19
    fi
    exit 0
    ;;
esac
exit 0
`,
    { mode: 0o755 },
  );
  const log = path.join(dir, "docker.log");
  return { dir, bin, state, log };
}

function identity(build: string, sha: string, digest: string) {
  return {
    APP_IMAGE: `ghcr.io/example/cutbg@${digest}`,
    APP_BUILD_ID: build,
    APP_COMMIT_SHA: sha,
    APP_CREATED_AT: "2026-07-24T12:00:00Z",
  };
}

async function deploy(
  harness: Awaited<ReturnType<typeof createHarness>>,
  values: Record<string, string>,
) {
  return execFileAsync("sh", ["scripts/release/deploy.sh"], {
    cwd: ROOT,
    env: {
      ...process.env,
      PATH: `${harness.bin}:${process.env.PATH ?? ""}`,
      FAKE_DOCKER_LOG: harness.log,
      FAKE_POST_MARKER: path.join(harness.dir, "post-failed"),
      RELEASE_ROOT: ROOT,
      RELEASE_STATE_DIR: harness.state,
      RELEASE_CONFIG_FILE: path.join(harness.dir, "release.conf"),
      RELEASE_MANAGE_NGINX: "0",
      RELEASE_SYNC_MODELS: "0",
      RELEASE_ALLOW_FIRST_DEPLOY: "1",
      SMOKE_BASE_URL: "http://127.0.0.1:3000",
      SMOKE_CDN_BASE_URL: "http://127.0.0.1:3000/models",
      SMOKE_ALLOW_HTTP_EXTERNAL: "1",
      SMOKE_HTTP_URL: "",
      SMOKE_CANONICAL_URL: "",
      DEPLOY_ACTOR: "release-test",
      DEPLOY_REF: "refs/heads/main",
      DEPLOY_RUN_ID: "23",
      ...values,
    },
  });
}

describe("release deployment controller", () => {
  it("requires an immutable digest and keeps secrets out of records", async () => {
    const harness = await createHarness();
    await expect(
      deploy(harness, {
        ...identity("bad", SHA_ONE, DIGEST_ONE),
        APP_IMAGE: "ghcr.io/example/cutbg:latest",
      }),
    ).rejects.toThrow();

    const secret = "not-for-release-records";
    await deploy(harness, {
      ...identity("20260724.1.1", SHA_ONE, DIGEST_ONE),
      GHCR_TOKEN: secret,
    });
    const history = path.join(harness.state, "history");
    const records = await readdir(history);
    const contents = await Promise.all(
      records.map((record) => readFile(path.join(history, record), "utf8")),
    );
    expect(contents.join("\n")).not.toContain(secret);
    expect(contents.join("\n")).toContain(DIGEST_ONE);
  });

  it("isolates candidate failure and serializes deployments", async () => {
    const harness = await createHarness();
    await deploy(harness, identity("20260724.1.1", SHA_ONE, DIGEST_ONE));
    const before = await readFile(path.join(harness.state, "current.env"), "utf8");

    await expect(
      deploy(harness, {
        ...identity("20260724.2.1", SHA_TWO, DIGEST_TWO),
        FAKE_CANDIDATE_FAILURE: "1",
      }),
    ).rejects.toThrow();
    expect(await readFile(path.join(harness.state, "current.env"), "utf8")).toBe(before);

    await mkdir(path.join(harness.state, "deploy.lock"));
    await expect(
      deploy(harness, identity("20260724.2.1", SHA_TWO, DIGEST_TWO)),
    ).rejects.toThrow(/deployment-lock-held/);
  });

  it("rolls back a forced post-deploy failure and reruns idempotently", async () => {
    const harness = await createHarness();
    await deploy(harness, identity("20260724.1.1", SHA_ONE, DIGEST_ONE));
    const firstLog = await readFile(harness.log, "utf8");
    const firstUpCount = firstLog.match(/compose up -d app/g)?.length ?? 0;

    const rerun = await deploy(harness, identity("20260724.1.1", SHA_ONE, DIGEST_ONE));
    expect(rerun.stdout).toContain("action=already-current");
    const rerunLog = await readFile(harness.log, "utf8");
    expect(rerunLog.match(/compose up -d app/g)?.length ?? 0).toBe(firstUpCount);

    await expect(
      deploy(harness, {
        ...identity("20260724.2.1", SHA_TWO, DIGEST_TWO),
        FAKE_POST_FAILURE_ONCE: "1",
      }),
    ).rejects.toThrow(/post-deploy-smoke-failed/);
    const current = await readFile(path.join(harness.state, "current.env"), "utf8");
    expect(current).toContain(DIGEST_ONE);
    expect(current).not.toContain(DIGEST_TWO);
    const records = await readdir(path.join(harness.state, "history"));
    const recordBodies = await Promise.all(
      records.map((record) =>
        readFile(path.join(harness.state, "history", record), "utf8"),
      ),
    );
    expect(recordBodies.join("\n")).toContain('"rollback": "pass"');
  });
});
