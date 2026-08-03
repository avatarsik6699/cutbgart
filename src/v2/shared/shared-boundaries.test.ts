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
      allowed: ["src/v2/runtime-browser/artifacts/artifact-url-adapter.ts"],
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
        "src/v2/runtime-browser/platform/processing-cancellation.ts",
      ],
    },
    {
      title: "native worker construction",
      pattern: /new Worker\s*\(/,
      allowed: ["src/v2/runtime-browser/processing/worker-factory.ts"],
    },
    {
      title: "native worker messaging",
      pattern: /\.postMessage\s*\(/,
      allowed: [
        "src/v2/runtime-browser/processing/worker-client.ts",
        "src/v2/runtime-browser/processing/worker/processing.worker.ts",
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
      allowed: ["src/v2/runtime-browser/processing/worker/processing.worker.ts"],
    },
    {
      title: "full-resolution canvas processing",
      pattern:
        /(?:new OffscreenCanvas\s*\(|\.getImageData\s*\(|\.putImageData\s*\(|\.convertToBlob\s*\()/,
      allowed: ["src/v2/runtime-browser/processing/worker/processing.worker.ts"],
    },
    {
      title: "model-provider runtime access",
      pattern: /from\s+["']@huggingface\/transformers["']/,
      allowed: ["src/v2/runtime-browser/processing/worker/processing.worker.ts"],
    },
  ] satisfies readonly SourceRule[])("keeps $title in its owning adapter", (rule) => {
    expect(violations(rule)).toEqual([]);
  });
});
