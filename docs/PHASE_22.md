# PHASE 22 — Production Security & Supply Chain Hardening

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `22` |
| Title | Production Security & Supply Chain Hardening |
| Status | `✅ done` |
| Tag | `v0.22.0` |
| Depends on | PHASE_21 gate passing |

---

## Phase Goal

Harden the existing browser-only product and its delivery chain before adding more editor
capabilities. The phase establishes an evidence-backed threat model, protects the browser/CDN/model
boundary, makes dependencies and build inputs verifiable, and provides a safe vulnerability-report
path without introducing accounts, server-side image processing, or image telemetry
(SPEC.md §6–§8).

## Research References

- [NIST Secure Software Development Framework 1.1](https://csrc.nist.gov/pubs/sp/800/218/final)
- [OWASP Top 10:2025](https://owasp.org/Top10/2025/)
- [OWASP HTTP Security Response Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
- [GitHub Actions secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
- [Docker build best practices](https://docs.docker.com/build/building/best-practices/)
- [RFC 9116 — security.txt](https://www.rfc-editor.org/rfc/rfc9116)

---

## Scope

### Security

- [x] `S1` Create a threat model for browser, SSR/Nginx, Cloudflare/CDN, service worker and caches,
  downloaded models/WASM, GitHub Actions/GHCR, VPS, Umami/Uptime, support links, and export. Record
  assets, trust boundaries, abuse cases, mitigations, residual risks, owners, and the invariant
  that image pixels, source filenames, hashes, EXIF, masks, and composites never leave the browser
  — _Depends on:_ —
- [x] `S2` Define and test the production header policy at its authoritative layer: CSP compatible
  with Nuxt/Vite workers, WASM, WebGPU and approved analytics; `frame-ancestors`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and HSTS only after HTTPS
  behavior is verified. Add COOP/COEP/CORP only where measured compatibility justifies them —
  _Depends on:_ `S1`
- [x] `S3` Add positive and negative privacy tests around analytics/network calls and export:
  process single and batch fixtures, reject malformed/decompression-bomb-like inputs within
  limits, and prove that image-derived bytes and source metadata are neither transmitted nor
  embedded in downloaded files — _Depends on:_ `S1`
- [x] `S4` Publish `/.well-known/security.txt` with an owned contact, expiry and disclosure policy;
  document triage, severity, private coordination, remediation and disclosure workflow. No
  unmonitored or placeholder contact may ship — _Depends on:_ `S1`
- [x] `S5` Document dependency, base-image, model-asset and vulnerability response policy with
  supported update windows, severity thresholds, exception owner/expiry, license review, and an
  emergency procedure for a compromised action/package/model — _Depends on:_ `S1`

### Infra

- [x] `I1` Harden production containers: run the app as non-root, pin base images by immutable
  digest, use a minimal runtime, keep secrets out of layers/logs, add health/resource/log-rotation
  limits, and apply read-only filesystem/capability restrictions where a parity test proves
  compatibility — _Depends on:_ `S1`
- [x] `I2` Harden CI: least-privilege workflow permissions, SHA-pinned third-party actions,
  protected-environment deployment, reviewed lockfile changes, dependency/license/container
  scanning, and explicit failure policy. Freeze exact maintained scanners and commands in
  `docs/STACK.md` after consulting their current primary documentation — _Depends on:_ `S5`
- [x] `I3` Generate a machine-readable SBOM and signed GitHub artifact attestation/provenance for
  each production image; verify digest, attestation and expected repository/ref before deployment
  or rollback — _Depends on:_ `I1`, `I2`
- [x] `I4` Replace trust-by-filename for model/WASM assets with a versioned manifest containing
  immutable source revision, byte size and SHA-256. Make synchronization atomic, verify cached and
  newly downloaded bytes, detect corruption/partial files, and retain the previous known-good
  manifest for rollback — _Depends on:_ `S1`, `I2`
- [x] `I5` Specify and implement service-worker/model-cache lifecycle: version/migration,
  activation cleanup, orphan eviction, quota and corruption recovery, storage estimate, and a
  user-invoked “clear downloaded models” action that does not destroy active editor work —
  _Depends on:_ `I4`
- [x] `I6` Add evidence-backed abuse controls for public SSR/static and `/api/send`: request/body
  limits, timeouts and rate limits at the correct proxy/application layer without breaking batch
  editing or CDN range requests. Document Cloudflare/Nginx ownership and a safe override path —
  _Depends on:_ `S1`

### Frontend

- [x] `F1` Add a localized storage/model-management surface showing approximate downloaded-model
  usage, clearing only safe caches, and explaining that source images remain local. It must be
  keyboard accessible and must not expose model brands in the primary processing journey —
  _Depends on:_ `I5`
- [x] `F2` Present a recoverable, localized error when a verified model/WASM asset is unavailable
  or corrupt; offer retry, cache reset, or a supported lighter mode without silently accepting bad
  bytes — _Depends on:_ `I4`, `I5`

---

## Files

### Create / modify

~~~
docs/security/THREAT_MODEL.md
docs/security/SECURE_DEVELOPMENT.md
docs/runbooks/VULNERABILITY_RESPONSE.md
docs/STACK.md
Dockerfile
docker-compose.yml
deploy/nginx/
.github/workflows/
scripts/sync-model-assets.ts
models.manifest.json
public/.well-known/security.txt
src/
tests/
e2e/
docs/PHASE_22.md
~~~

### Do NOT touch

- Add authentication, accounts, server-side image upload/processing, payments, or new analytics
- Add a security control that sends images, masks, filenames, hashes, or EXIF off-device
- Enable COOP/COEP, strict CSP directives, read-only containers, or rate limits without parity tests
- Store scanner credentials, signing keys, tokens, or private disclosure reports in the repository

---

## Contracts

### New persistent data (tables / collections / files)

- Build artifacts: CycloneDX or SPDX SBOM plus GitHub attestation bound to the production image
  digest. They contain build/dependency metadata, not user data.
- Browser model cache remains local and gains an explicit version/cleanup contract. It stores only
  published model/WASM assets and never editor images or masks.

### New API endpoints / RPC methods / events

| Method | Path | Auth | Response |
|--------|------|------|----------|
| `GET` | `/.well-known/security.txt` | public | RFC 9116 text with owned contact and expiry |

### New types / models / shared interfaces

```ts
interface VerifiedModelAsset {
  path: string
  revision: string
  byteSize: number
  sha256: string
}

interface ModelAssetManifest {
  schemaVersion: 1
  release: string
  assets: VerifiedModelAsset[]
}
```

### New env vars

None. Any scanner/deployment credential must use the platform secret store; exact names are frozen
in `docs/STACK.md` without values.

---

## Gate Checks

Run `/phase-gate 22`; the complete `docs/STACK.md` gate applies. Additionally:

```bash
pnpm build
docker compose config
docker compose build
pnpm sync-model-assets -- --check
curl -fsS http://localhost/.well-known/security.txt
```

Run the pinned security/license/container gate documented during `I2`, verify the SBOM and
attestation for a test image, and execute Playwright coverage for storage clearing, corrupt-model
recovery, security headers and the single/batch no-image-egress invariant. Fail on unowned
exceptions, mutable production inputs, placeholder disclosure contacts, leaked metadata, or a
control that breaks the supported editor/CDN path.

---

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

None

## Atomic Commit Message

```text
chore(phase-22): harden production supply chain and browser boundary
```

## Post-Phase Checklist

- [x] Scope complete; gates green; review notes resolved
- [x] Run `/context-update 22`
- [x] Commit on `feat/phase-22`; tag `v0.22.0` after merge
