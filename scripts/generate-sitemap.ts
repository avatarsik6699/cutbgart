/**
 * Walks `src/routes/` and emits `public/sitemap.xml` (SPEC.md §7.5). Runs at
 * build time (`pnpm build`, before `vite build` copies `public/` into the
 * Nitro output) so a new static route can't be forgotten in the sitemap.
 *
 * Convention-based, not a `head()`-parsing crawler: TanStack Router's
 * dot-segment file convention (`dev.remove-background.tsx` -> `/dev/remove-background`)
 * maps directly to a URL path, and this project's only non-public route is
 * the `dev/` test harness (`noindex` in its own `head()`), so excluding the
 * `dev` top segment by filename is sufficient without needing dynamic
 * (`$param`) route support.
 */
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SITE_URL } from "../src/shared/lib/seo";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const ROUTES_DIR = path.join(REPO_ROOT, "src", "routes");
const OUTPUT_PATH = path.join(REPO_ROOT, "public", "sitemap.xml");

function isExcluded(routeFile: string): boolean {
  if (routeFile === "__root.tsx") return true;
  if (!routeFile.endsWith(".tsx")) return true;
  if (routeFile.includes(".test.")) return true;
  if (routeFile.includes("$")) return true; // dynamic segment, not statically enumerable
  const topSegment = routeFile.split(".")[0];
  return topSegment === "dev"; // dev-only test harness, noindex
}

function routeFileToPath(routeFile: string): string {
  const withoutExt = routeFile.replace(/\.tsx$/, "");
  const segments = withoutExt.split(".").filter((segment) => segment !== "index");
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

async function collectRoutePaths(): Promise<string[]> {
  const entries = await readdir(ROUTES_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && !isExcluded(entry.name))
    .map((entry) => routeFileToPath(entry.name))
    .sort();
}

function buildSitemapXml(routePaths: string[]): string {
  const urls = routePaths
    .map((routePath) => `  <url>\n    <loc>${SITE_URL}${routePath}</loc>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

async function main() {
  const routePaths = await collectRoutePaths();
  const xml = buildSitemapXml(routePaths);
  await writeFile(OUTPUT_PATH, xml, "utf-8");
  console.log(
    `Wrote ${String(routePaths.length)} URLs to ${path.relative(REPO_ROOT, OUTPUT_PATH)}`,
  );
}

void main();
