/**
 * Walks `src/routes/` and emits `public/sitemap.xml` (SPEC.md §7.5). Runs at
 * build time (`pnpm build`, before `vite build` copies `public/` into the
 * Nitro output) so a new static route can't be forgotten in the sitemap.
 *
 * Convention-based, not a `head()`-parsing crawler: TanStack Router's
 * dot-segment file convention (`dev.remove-background.tsx` -> `/dev/remove-background`)
 * maps directly to a URL path, and directory nesting (`en/about.tsx` ->
 * `/en/about`) maps to a path prefix. The `dev/` test harness is excluded
 * (`noindex` in its own `head()`).
 *
 * Locale alternates (SPEC.md §5.5, Phase 12 I4): each discovered URL is
 * grouped with its sibling locale URLs via Paraglide's own `deLocalizeUrl` —
 * the canonical (delocalized) path is the group key — so per-page translated
 * English slugs (Phase 12 F11) resolve correctly without hardcoding a
 * ru<->en slug mapping here.
 */
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SITE_URL } from "../src/shared/lib/seo";
import {
  baseLocale,
  deLocalizeUrl,
  locales,
  type Locale,
} from "../src/paraglide/runtime";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const ROUTES_DIR = path.join(REPO_ROOT, "src", "routes");
const OUTPUT_PATH = path.join(REPO_ROOT, "public", "sitemap.xml");

function isExcludedFile(routeFile: string): boolean {
  if (routeFile === "__root.tsx") return true;
  if (!routeFile.endsWith(".tsx")) return true;
  if (routeFile.includes(".test.")) return true;
  if (routeFile.includes("$")) return true; // dynamic segment, not statically enumerable
  return false;
}

function routeFileToSegment(routeFile: string): string {
  const withoutExt = routeFile.replace(/\.tsx$/, "");
  const segments = withoutExt.split(".").filter((segment) => segment !== "index");
  return segments.join("/");
}

async function collectRoutePaths(
  dir: string,
  prefixSegments: string[],
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const paths: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name === "dev") continue; // dev-only test harness, noindex
      const nested = await collectRoutePaths(path.join(dir, entry.name), [
        ...prefixSegments,
        entry.name,
      ]);
      paths.push(...nested);
      continue;
    }
    if (!entry.isFile() || isExcludedFile(entry.name)) continue;
    const topSegment = entry.name.split(".")[0];
    if (prefixSegments.length === 0 && topSegment === "dev") continue; // legacy dot-segment form
    const fileSegment = routeFileToSegment(entry.name);
    const segments = [...prefixSegments, fileSegment].filter(Boolean);
    paths.push(segments.length === 0 ? "/" : `/${segments.join("/")}`);
  }

  return paths;
}

function canonicalPath(routePath: string): string {
  const delocalized = deLocalizeUrl(`${SITE_URL}${routePath}`);
  return delocalized.pathname;
}

function localeOf(routePath: string): Locale {
  const nonBaseLocale = locales.find((locale) => locale !== baseLocale);
  if (
    nonBaseLocale &&
    (routePath === `/${nonBaseLocale}` || routePath.startsWith(`/${nonBaseLocale}/`))
  ) {
    return nonBaseLocale;
  }
  return baseLocale;
}

function buildSitemapXml(routePaths: string[]): string {
  const groups = new Map<string, string[]>();
  for (const routePath of routePaths) {
    const key = canonicalPath(routePath);
    const group = groups.get(key) ?? [];
    group.push(routePath);
    groups.set(key, group);
  }

  const urls = routePaths
    .map((routePath) => {
      const group = groups.get(canonicalPath(routePath)) ?? [routePath];
      const alternates = group
        .map((altPath) => {
          const locale = localeOf(altPath);
          return `    <xhtml:link rel="alternate" hreflang="${locale}" href="${SITE_URL}${altPath}" />`;
        })
        .join("\n");
      const defaultHref =
        group.find((altPath) => localeOf(altPath) === baseLocale) ?? routePath;
      return (
        `  <url>\n    <loc>${SITE_URL}${routePath}</loc>\n${alternates}\n` +
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}${defaultHref}" />\n  </url>`
      );
    })
    .join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    `${urls}\n</urlset>\n`
  );
}

async function main() {
  const routePaths = (await collectRoutePaths(ROUTES_DIR, [])).sort();
  const xml = buildSitemapXml(routePaths);
  await writeFile(OUTPUT_PATH, xml, "utf-8");
  console.log(
    `Wrote ${String(routePaths.length)} URLs to ${path.relative(REPO_ROOT, OUTPUT_PATH)}`,
  );
}

void main();
