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
const auditedRoots = [
  join(sourceRoot, "editor"),
  join(sourceRoot, "shared", "config"),
  join(sourceRoot, "shared", "ui"),
];

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

describe("editor platform boundaries", () => {
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
        "src/editor/runtime/artifacts/artifact-url-adapter.ts",
        "src/editor/runtime/platform/download-adapter.ts",
      ],
    },
    {
      title: "browser artifact randomness",
      pattern: /crypto\.randomUUID/,
      allowed: [
        "src/editor/runtime/artifacts/artifact-id-source.ts",
        "src/editor/runtime/platform/editor-id-source.ts",
      ],
    },
    {
      title: "AbortController construction",
      pattern: /new AbortController/,
      allowed: [
        "src/editor/runtime/processing/local-processing-gateway.ts",
        "src/editor/runtime/processing/heavy-job-coordinator.ts",
        "src/editor/runtime/platform/processing-cancellation.ts",
      ],
    },
    {
      title: "native worker construction",
      pattern: /new Worker\s*\(/,
      allowed: [
        "src/editor/runtime/processing/worker-factory.ts",
        "src/editor/runtime/magic-cutout/magic-worker-factory.ts",
        "src/editor/runtime/background/background-image-worker-factory.ts",
        "src/editor/runtime/enhancements/enhancement-worker-factory.ts",
        "src/editor/runtime/snapshot-commit/worker-snapshot-committer.ts",
        "src/editor/runtime/export/export-worker-factory.ts",
      ],
    },
    {
      title: "native worker messaging",
      pattern: /\.postMessage\s*\(/,
      allowed: [
        "src/editor/runtime/processing/worker-client.ts",
        "src/editor/runtime/processing/worker/processing.worker.ts",
        "src/editor/runtime/magic-cutout/magic-worker-client.ts",
        "src/editor/runtime/magic-cutout/worker/magic-cutout.worker.ts",
        "src/editor/runtime/background/background-image-client.ts",
        "src/editor/runtime/background/worker/background-image.worker.ts",
        "src/editor/runtime/enhancements/enhancement-worker-client.ts",
        "src/editor/runtime/enhancements/worker/enhancement.worker.ts",
        "src/editor/runtime/snapshot-commit/worker-snapshot-committer.ts",
        "src/editor/runtime/snapshot-commit/worker/snapshot-commit.worker.ts",
        "src/editor/runtime/export/export-resize-client.ts",
        "src/editor/runtime/export/export-resize.worker.ts",
      ],
    },
    {
      title: "content image element",
      pattern: /(?:<img\b|createElement\(["']img["'])/,
      allowed: ["src/shared/ui/media/image.tsx"],
    },
    {
      title: "main-thread image decode",
      pattern:
        /(?:createImageBitmap\s*\(|new Image\s*\(|document\.createElement\(["']img["'])/,
      allowed: [
        "src/editor/runtime/processing/worker/processing.worker.ts",
        "src/editor/runtime/manual-cutout/manual-source-bitmap.ts",
        "src/editor/runtime/magic-cutout/worker/magic-cutout.worker.ts",
        "src/editor/runtime/snapshot-commit/worker/snapshot-commit.worker.ts",
        "src/editor/runtime/background/worker/background-image.worker.ts",
        "src/editor/runtime/enhancements/worker/enhancement.worker.ts",
        "src/editor/runtime/export/export-resize.worker.ts",
      ],
    },
    {
      title: "full-resolution canvas processing",
      pattern:
        /(?:new OffscreenCanvas\s*\(|\.getImageData\s*\(|\.putImageData\s*\(|\.convertToBlob\s*\()/,
      allowed: [
        "src/editor/runtime/processing/worker/processing.worker.ts",
        "src/editor/runtime/snapshot-commit/worker/snapshot-commit.worker.ts",
        "src/editor/runtime/magic-cutout/magic-cutout-controller.ts",
        "src/widgets/editor/ui/manual-cutout/manual-cutout-workspace.tsx",
        "src/widgets/editor/ui/magic-cutout/magic-cutout-workspace.tsx",
        "src/editor/runtime/background/worker/background-image.worker.ts",
        "src/editor/runtime/enhancements/worker/enhancement.worker.ts",
        "src/editor/runtime/export/export-resize.worker.ts",
      ],
    },
    {
      title: "model-provider runtime access",
      pattern: /from\s+["']@huggingface\/transformers["']/,
      allowed: [
        "src/editor/runtime/processing/worker/processing.worker.ts",
        "src/editor/runtime/magic-cutout/worker/magic-cutout.worker.ts",
        "src/editor/runtime/enhancements/worker/enhancement.worker.ts",
      ],
    },
  ] satisfies readonly SourceRule[])("keeps $title in its owning adapter", (rule) => {
    expect(violations(rule)).toEqual([]);
  });
});
