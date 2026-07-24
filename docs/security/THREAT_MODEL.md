# Threat Model

**Release:** v0.22.0 · **Owner:** project maintainer · **Review:** every security
phase, material trust-boundary change, or security incident.

## Invariant

Image pixels and every value derived from them — source filenames, hashes,
EXIF, masks, alpha mattes, brush prompts, composites and export contents —
never leave the browser. They are not sent to cutbg, analytics, model hosts,
support links, CI, logs, monitoring, or vulnerability reports. The only
network payloads allowed during editing are application code, aggregate
allow-listed analytics events, and immutable published model/WASM assets.

## Assets and owners

| Asset | Security objective | Owner |
|---|---|---|
| User images and editor state | Local-only confidentiality; session integrity | Browser runtime / maintainer |
| Exported PNG/ZIP | Correct pixels; no source metadata | Browser runtime / maintainer |
| SSR shell and static assets | Integrity, availability, safe embedding | App + Nginx / maintainer |
| Model/WASM release | Revision, size and SHA-256 integrity | Manifest + model sync / maintainer |
| Model Cache Storage | Published assets only; bounded, recoverable lifecycle | Service worker / maintainer |
| DNS, TLS, Cloudflare and VPS | Origin authenticity and availability | Maintainer |
| GH Actions, GHCR image, SBOM and attestations | Reproducible reviewed provenance | GitHub environment / maintainer |
| Umami and Uptime Kuma | Aggregate operational data only | Maintainer |
| Telegram security/support channel | Confidential intake; no user images | Maintainer |

## Trust boundaries

```text
untrusted local file
  -> browser validation/decode -> in-memory editor -> local PNG/ZIP
                                  |
                                  +-> allow-listed aggregate event -> /api/send -> Umami

browser -> Cloudflare -> Nginx -> SSR app shell
browser -> Cloudflare CDN -> Nginx static model directory
                              ^ atomic verified sync <- immutable upstream revisions

reviewed git/lockfile -> GitHub-hosted runner -> GHCR digest + SBOM + attestations
                                                -> protected production deploy -> VPS
```

Cloudflare, model upstreams, analytics, GHCR, GitHub-hosted runners and the VPS
are separate trust domains. None receives editor content.

## Abuse cases and controls

| Boundary / abuse case | Mitigations | Residual risk / response |
|---|---|---|
| Malformed or decompression-bomb-like upload exhausts memory | MIME allow-list, 20 MB cap, encoded-header validation and 40 MP pre-decode ceiling; browser-only decode | Codec bugs remain browser-vendor risk; advise browser update and reject decode errors |
| XSS or injected dependency reads in-memory pixels | CSP, no arbitrary HTML, lockfile review, dependency/secret scanning, SHA-pinned Actions | CSP keeps required inline hydration and WASM capability; dependency compromise is handled by emergency freeze/rotation |
| Analytics or support link exfiltrates an image/name/hash | Analytics runtime accepts fixed aggregate dimensions only; Playwright records request bodies; support policy forbids real images | Browser extensions can observe page state and are outside the app boundary |
| Cross-site framing tricks a user into actions | CSP `frame-ancestors 'none'`; no accounts or privileged state | Browser/extension compromise remains out of scope |
| Model/WASM file is replaced, truncated or partially synchronized | Immutable revisions, byte size + SHA-256 manifest, verified staging directory, atomic activation, previous release rollback | A simultaneously compromised upstream and reviewer can bless bad bytes; emergency manifest rollback applies |
| Cache holds obsolete/corrupt/quota-exhausting assets | Release-named cache, activation/orphan cleanup, manifest marker, quota recovery, explicit clear action | Cache implementation/storage corruption can still force a re-download |
| SSR or analytics endpoint is flooded | Cloudflare edge controls; Nginx per-IP request/body/time limits; container CPU/memory/PID/log limits | Distributed attacks require Cloudflare rule escalation; emergency override is documented |
| CDN range probe is blocked or cached incorrectly | `/models/` allows GET/HEAD and native range behavior; 206 is never put in Cache Storage; no request rate limit on model location | Cloudflare cache/range regressions require bypassing the affected rule |
| CI action/package/base image is compromised | Full action SHAs, immutable image digests, frozen lockfile, Trivy/dependency/license gates, protected environment | A trusted SHA can later be identified as malicious; freeze and rotate per runbook |
| Wrong image is deployed or rolled back | Deploy uses `name@sha256`, verifies provenance with repository, workflow and `refs/heads/main`, then starts that digest | GitHub/VPS credential compromise requires revocation and independent host inspection |
| Secrets appear in layers or logs | Runtime secrets are Compose/GitHub environment inputs; no secret build args; public Vite identifiers are classified as public | Operators can still paste secrets into logs; incident procedure rotates them |
| Monitoring/admin surfaces become public | Uptime loopback-only; Umami is only reachable behind `/script.js` and `/api/send`; database is internal | VPS firewall/Docker misconfiguration remains an operator risk |

## Explicit exclusions

Accounts, authentication, server-side image processing/storage, payments,
private report storage in git, and telemetry derived from user content are not
part of this system. COOP/COEP are not enabled: current models/CDNs do not need
cross-origin isolation and compatibility was not demonstrated. CSP remains
compatible with TanStack hydration, Vite workers, WebAssembly, WebGPU,
self-hosted Umami and the approved Cloudflare beacon.
