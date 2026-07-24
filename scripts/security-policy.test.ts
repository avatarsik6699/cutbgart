import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { securityHeaders } from "../src/shared/config/security-headers";

describe("production security policy", () => {
  it("sets the compatible browser boundary headers without unmeasured isolation", () => {
    const csp = securityHeaders["Content-Security-Policy"];
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("'wasm-unsafe-eval'");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("https://cdn.cutbg.art");
    expect(csp).toContain("https://static.cloudflareinsights.com");
    expect(securityHeaders["X-Content-Type-Options"]).toBe("nosniff");
    expect(securityHeaders["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(securityHeaders["Permissions-Policy"]).toContain("camera=()");
    expect(securityHeaders).not.toHaveProperty("Cross-Origin-Opener-Policy");
    expect(securityHeaders).not.toHaveProperty("Cross-Origin-Embedder-Policy");
  });

  it("keeps HSTS and bounded abuse controls at the TLS proxy layer", async () => {
    const nginx = await readFile("deploy/nginx/app.conf", "utf8");
    expect(nginx).toContain(
      'Strict-Transport-Security "max-age=31536000; includeSubDomains"',
    );
    expect(nginx).toContain("zone=public_ssr_per_ip:10m rate=10r/s");
    expect(nginx).toContain("zone=analytics_per_ip:10m rate=2r/s");
    expect(nginx).toMatch(
      /location = \/api\/send \{[\s\S]*client_max_body_size 64k;[\s\S]*limit_req zone=analytics_per_ip/,
    );
    const modelLocation = /location \/models\/ \{([\s\S]*?)\n {4}\}/.exec(nginx)?.[1];
    expect(modelLocation).toContain("limit_except GET HEAD");
    expect(modelLocation).not.toContain("limit_req");
  });

  it("pins production inputs and verifies provenance before deployment", async () => {
    const [dockerfile, compose, workflow] = await Promise.all([
      readFile("Dockerfile", "utf8"),
      readFile("docker-compose.yml", "utf8"),
      readFile(".github/workflows/ci.yml", "utf8"),
    ]);
    expect(dockerfile).toMatch(/FROM node:24-alpine@sha256:[0-9a-f]{64}/);
    expect(dockerfile).toContain("USER node");
    expect(compose).toContain("read_only: true");
    expect(compose).toContain("cap_drop: [ALL]");
    expect(compose).toContain("max-size: 10m");
    expect(compose).not.toMatch(/image: (?:nginx|postgres|certbot)[^@\n]*\n/);
    expect(workflow).not.toMatch(/uses:\s+[^@\s]+@v\d/);
    expect(workflow).not.toContain("ignore-unfixed");
    expect(workflow).toContain("format: cyclonedx");
    expect(workflow).toContain("actions/attest@f7c74d28");
    expect(workflow).toContain("--source-ref refs/heads/main");
    expect(workflow).toContain("environment: production");
  });

  it("publishes a non-placeholder RFC 9116 contact", async () => {
    const securityTxt = await readFile("public/.well-known/security.txt", "utf8");
    expect(securityTxt).toMatch(/^Contact: https:\/\//m);
    expect(securityTxt).toContain("Expires: 2027-07-23T23:59:59Z");
    expect(securityTxt).toContain(
      "Canonical: https://cutbg.art/.well-known/security.txt",
    );
    expect(securityTxt).not.toMatch(/example\.com|TODO|placeholder/i);
  });
});
