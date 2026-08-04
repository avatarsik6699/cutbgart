import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

type SourceRule = {
  allowed: readonly string[];
  pattern: RegExp;
  title: string;
};

const workspaceRoot = process.cwd();
const sourceRoot = join(workspaceRoot, "src");
const auditedRoots = [join(sourceRoot, "v2"), join(sourceRoot, "shared", "config")];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    if (
      (extname(entry.name) === ".ts" || extname(entry.name) === ".tsx") &&
      !entry.name.includes(".test.")
    ) {
      return [path];
    }
    return [];
  });
}

function violations(rule: SourceRule): string[] {
  return auditedRoots.flatMap(sourceFiles).flatMap((path) => {
    const repositoryPath = relative(workspaceRoot, path);
    if (rule.allowed.includes(repositoryPath)) {
      return [];
    }
    return rule.pattern.test(readFileSync(path, "utf8")) ? [repositoryPath] : [];
  });
}

describe("v2 shared platform boundaries", () => {
  it.each([
    {
      title: "Vite env access",
      pattern: /import\.meta\.env/,
      allowed: ["src/shared/config/env.ts"],
    },
    {
      title: "native object URL access",
      pattern: /URL\.(?:createObjectURL|revokeObjectURL)/,
      allowed: [
        "src/v2/runtime-browser/artifacts/artifact-url-adapter.ts",
        "src/v2/runtime-browser/platform/download-adapter.ts",
      ],
    },
    {
      title: "browser artifact randomness",
      pattern: /crypto\.randomUUID/,
      allowed: [
        "src/v2/runtime-browser/artifacts/artifact-id-source.ts",
        "src/v2/runtime-browser/platform/editor-id-source.ts",
      ],
    },
    {
      title: "AbortController construction",
      pattern: /new AbortController/,
      allowed: [
        "src/v2/runtime-browser/processing/local-processing-gateway.ts",
        "src/v2/runtime-browser/processing/heavy-job-coordinator.ts",
        "src/v2/runtime-browser/platform/processing-cancellation.ts",
      ],
    },
    {
      title: "native worker construction",
      pattern: /new Worker\s*\(/,
      allowed: [
        "src/v2/runtime-browser/processing/worker-factory.ts",
        "src/v2/runtime-browser/magic-cutout/magic-worker-factory.ts",
        "src/v2/runtime-browser/background/background-image-worker-factory.ts",
        "src/v2/runtime-browser/enhancements/enhancement-worker-factory.ts",
        "src/v2/runtime-browser/snapshot-commit/worker-snapshot-committer.ts",
      ],
    },
    {
      title: "native worker messaging",
      pattern: /\.postMessage\s*\(/,
      allowed: [
        "src/v2/runtime-browser/processing/worker-client.ts",
        "src/v2/runtime-browser/processing/worker/processing.worker.ts",
        "src/v2/runtime-browser/magic-cutout/magic-worker-client.ts",
        "src/v2/runtime-browser/magic-cutout/worker/magic-cutout.worker.ts",
        "src/v2/runtime-browser/background/background-image-client.ts",
        "src/v2/runtime-browser/background/worker/background-image.worker.ts",
        "src/v2/runtime-browser/enhancements/enhancement-worker-client.ts",
        "src/v2/runtime-browser/enhancements/worker/enhancement.worker.ts",
        "src/v2/runtime-browser/snapshot-commit/worker-snapshot-committer.ts",
        "src/v2/runtime-browser/snapshot-commit/worker/snapshot-commit.worker.ts",
      ],
    },
    {
      title: "content image element",
      pattern: /(?:<img\b|createElement\(["']img["'])/,
      allowed: ["src/v2/shared/ui/image.tsx"],
    },
    {
      title: "main-thread image decode",
      pattern:
        /(?:createImageBitmap\s*\(|new Image\s*\(|document\.createElement\(["']img["'])/,
      allowed: [
        "src/v2/runtime-browser/processing/worker/processing.worker.ts",
        "src/v2/runtime-browser/manual-cutout/manual-source-bitmap.ts",
        "src/v2/runtime-browser/magic-cutout/worker/magic-cutout.worker.ts",
        "src/v2/runtime-browser/snapshot-commit/worker/snapshot-commit.worker.ts",
        "src/v2/runtime-browser/background/worker/background-image.worker.ts",
        "src/v2/runtime-browser/enhancements/worker/enhancement.worker.ts",
      ],
    },
    {
      title: "full-resolution canvas processing",
      pattern:
        /(?:new OffscreenCanvas\s*\(|\.getImageData\s*\(|\.putImageData\s*\(|\.convertToBlob\s*\()/,
      allowed: [
        "src/v2/runtime-browser/processing/worker/processing.worker.ts",
        "src/v2/runtime-browser/snapshot-commit/worker/snapshot-commit.worker.ts",
        "src/v2/runtime-browser/magic-cutout/magic-cutout-controller.ts",
        "src/v2/presentation/manual-cutout/manual-cutout-workspace.tsx",
        "src/v2/presentation/magic-cutout/magic-cutout-workspace.tsx",
        "src/v2/runtime-browser/background/worker/background-image.worker.ts",
        "src/v2/runtime-browser/enhancements/worker/enhancement.worker.ts",
      ],
    },
    {
      title: "model-provider runtime access",
      pattern: /from\s+["']@huggingface\/transformers["']/,
      allowed: [
        "src/v2/runtime-browser/processing/worker/processing.worker.ts",
        "src/v2/runtime-browser/magic-cutout/worker/magic-cutout.worker.ts",
        "src/v2/runtime-browser/enhancements/worker/enhancement.worker.ts",
      ],
    },
  ] satisfies readonly SourceRule[])("keeps $title in its owning adapter", (rule) => {
    expect(violations(rule)).toEqual([]);
  });
});
