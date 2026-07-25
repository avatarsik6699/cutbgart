import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const mode = process.argv[2];
if (mode !== "candidate" && mode !== "external") {
  throw new Error("Usage: node smoke.mjs candidate|external");
}

const baseUrl = new URL(
  process.env.SMOKE_BASE_URL ??
    (mode === "candidate" ? "http://127.0.0.1:3000" : "https://cutbg.art"),
);
const cdnBaseUrl = new URL(
  `${(process.env.SMOKE_CDN_BASE_URL ?? "https://cdn.cutbg.art/models").replace(/\/$/, "")}/`,
);
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? "20000");
const manifest = JSON.parse(
  await readFile(new URL("./models.manifest.json", import.meta.url), "utf8"),
);

function pass(check) {
  console.log(`[smoke] check=${check} result=pass`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(url, init = {}, retries = 0) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
  throw lastError;
}

async function expectHtml(path, pattern, check) {
  const response = await request(new URL(path, baseUrl), {}, 20);
  assert(response.ok, `${check}: expected a successful response`);
  const body = await response.text();
  assert(pattern.test(body), `${check}: expected SSR marker was absent`);
  pass(check);
  return response;
}

async function checkApplicationShells() {
  await expectHtml("/", /data-testid="home-page"|cutbg/i, "ssr-root");
  await expectHtml("/en", /<html[^>]+lang="en"|Remove Background/i, "ssr-en");

  for (const path of ["/privacy", "/en/privacy"]) {
    const response = await request(new URL(path, baseUrl));
    assert(response.ok, `legal-${path}: expected a successful response`);
  }
  pass("legal-pages");

  const security = await request(new URL("/.well-known/security.txt", baseUrl));
  assert(security.ok, "security-txt: expected a successful response");
  assert(
    /^Contact:\s+https:\/\//m.test(await security.text()),
    "security-txt: disclosure contact is missing",
  );
  pass("security-txt");

  const robots = await request(new URL("/robots.txt", baseUrl));
  assert(robots.ok, "static-assets: robots.txt unavailable");
  const publicManifestResponse = await request(new URL("/models.manifest.json", baseUrl));
  assert(publicManifestResponse.ok, "static-assets: model manifest unavailable");
  const publicManifest = await publicManifestResponse.json();
  assert(
    publicManifest.release === manifest.release,
    "static-assets: model manifest release mismatch",
  );
  pass("static-assets");
}

async function checkReleaseIdentity() {
  const response = await request(new URL("/", baseUrl));
  const expected = {
    "x-cutbg-build-id": process.env.EXPECTED_BUILD_ID,
    "x-cutbg-commit": process.env.EXPECTED_COMMIT_SHA,
    "x-cutbg-image-digest": process.env.EXPECTED_IMAGE_DIGEST,
    "x-cutbg-created-at": process.env.EXPECTED_CREATED_AT,
  };
  for (const [header, value] of Object.entries(expected)) {
    assert(value, `release-identity: missing expected value for ${header}`);
    assert(
      response.headers.get(header) === value,
      `release-identity: ${header} mismatch`,
    );
  }
  pass("release-identity");
}

async function checkRedirects() {
  if (process.env.SMOKE_HTTP_URL) {
    const response = await request(process.env.SMOKE_HTTP_URL, { redirect: "manual" });
    assert([301, 302, 307, 308].includes(response.status), "https-redirect: missing");
    assert(
      response.headers.get("location")?.startsWith("https://"),
      "https-redirect: location is not HTTPS",
    );
    pass("https-redirect");
  }

  if (process.env.SMOKE_CANONICAL_URL) {
    const response = await request(process.env.SMOKE_CANONICAL_URL, {
      redirect: "manual",
    });
    assert([301, 302, 307, 308].includes(response.status), "canonical-redirect: missing");
    const location = response.headers.get("location");
    assert(
      location?.startsWith(baseUrl.origin),
      "canonical-redirect: location does not use the canonical origin",
    );
    pass("canonical-redirect");
  }
}

async function checkModelCdn() {
  const asset = manifest.assets
    .filter((candidate) => candidate.byteSize <= 1024)
    .sort((left, right) => left.byteSize - right.byteSize)[0];
  assert(asset, "cdn-model: manifest has no bounded integrity probe");
  const assetUrl = new URL(asset.path, cdnBaseUrl);

  const range = await request(assetUrl, {
    headers: { Range: "bytes=0-0" },
  });
  assert(range.status === 206, "cdn-range: expected HTTP 206");
  assert(
    /^bytes 0-0\/\d+$/.test(range.headers.get("content-range") ?? ""),
    "cdn-range: invalid Content-Range",
  );
  assert((await range.arrayBuffer()).byteLength === 1, "cdn-range: expected one byte");
  pass("cdn-range");

  const full = await request(assetUrl);
  assert(full.ok, "cdn-integrity: asset unavailable");
  const bytes = Buffer.from(await full.arrayBuffer());
  assert(bytes.byteLength === asset.byteSize, "cdn-integrity: byte size mismatch");
  assert(
    createHash("sha256").update(bytes).digest("hex") === asset.sha256,
    "cdn-integrity: sha256 mismatch",
  );
  pass("cdn-integrity");
}

if (
  mode === "external" &&
  baseUrl.protocol !== "https:" &&
  process.env.SMOKE_ALLOW_HTTP_EXTERNAL !== "1"
) {
  throw new Error("External smoke requires HTTPS");
}
if (process.env.SMOKE_FORCE_FAILURE === "1") {
  throw new Error("Forced post-deploy failure");
}

await checkApplicationShells();
await checkModelCdn();
if (mode === "external") {
  await checkRedirects();
  await checkReleaseIdentity();
}
console.log(`[smoke] mode=${mode} result=pass`);
