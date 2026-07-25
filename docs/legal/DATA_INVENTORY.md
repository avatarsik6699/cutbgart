# Current data inventory and flow map

**Version:** `0.24.0-draft.2`
**Observed:** `2026-07-25`
**Scope:** current deployed `v0.23.0` behavior; no Phase-25 changes are assumed

## Method and live evidence

The audit reviewed the source, production Compose/Nginx configuration, model manifest, security
tests, operational retention documents, and a clean headless Chromium context against
`https://cutbg.art/`. The live response identified build `20260725.20.1`, commit
`e7f4c2a6af1cf6459908cbed2ecdf728040d72f2`, and the Phase-23 image digest.

On a normal first page load the browser:

- created no HTTP cookie and no `localStorage`/`sessionStorage` entry;
- registered the service worker and created the empty
  `bg-remove-model-cache-v2-v0.22.0` Cache Storage;
- requested the first-party Umami script and Cloudflare beacon;
- sent an Umami pageview to `/api/send`;
- sent Cloudflare RUM to `https://cloudflareinsights.com/cdn-cgi/rum`.

The browser payload was inspected by field name and type only; public tokens and generated
identifiers were not copied into this document.

## Flow map

```text
visitor browser
  ├─ HTTPS request ─> Cloudflare edge ─> Nginx/VPS ─> SSR app shell
  │                    └─ optional NEL failure report ─> a.nel.cloudflare.com
  ├─ pageview/events ─> cutbg.art/api/send ─> Nginx ─> self-hosted Umami/Postgres
  ├─ RUM timings ─> cloudflareinsights.com/cdn-cgi/rum ─> Cloudflare Web Analytics
  ├─ model GET/range ─> cdn.cutbg.art/Cloudflare ─> VPS model directory
  │                    └─ on verified CDN failure only ─> Hugging Face/jsDelivr
  ├─ explicit support click ─> Telegram
  └─ local File/Blob ─> browser memory/Web Worker ─> local PNG/ZIP download

operator/maintainer
  ├─ reviewed git ─> GitHub Actions/GHCR ─> VPS deploy
  ├─ synthetic checks ─> Uptime Kuma/Postgres volume
  └─ backup script/runbook ─> local `.ops/backups` by default
                             (production schedule and off-host copy not proven)
```

## Browser-local data

| Data / key | Source and purpose | Storage / lifetime | Access | Identifiability |
|---|---|---|---|---|
| Source image, decoded pixels, masks, brush prompts, foreground/composite, export | User-selected file; local editing and download | Volatile JS/WASM/worker memory and Blob URLs; released on reset, replacement, history eviction, or unmount | Current page and workers only, subject to browser/extension security | May depict people, but never leaves through an application request |
| `qualityMode` = `fast` or `max` | Explicit quality choice | `localStorage`, until user clears site data or chooses another persisted IS-Net mode | Same origin | Preference alone; no user ID |
| Model/WASM responses plus manifest digest/release headers | Provide offline/repeat inference and verify immutable assets | Cache Storage, release-named; old/orphan/corrupt caches removed; user can clear through the storage manager | Same-origin service worker | Public software assets only |
| Service-worker registration | Intercepts reviewed model/WASM GET requests | Browser registration until site data is cleared/unregistered | Same origin | No visitor identifier |
| Locale | URL path (`/` or `/en`), not cookie/local storage | URL/navigation state | Browser and ordinary HTTP recipients | May reveal language preference |
| Current editor/document state | Enable undo/redo and batch work | Memory only; no IndexedDB, server store, or session persistence | Current page | Image-derived; prohibited from telemetry |
| Cookies on ordinary load | None observed; Umami and Cloudflare Web Analytics are cookie-less in the tested path | None | — | — |
| Conditional Cloudflare security cookies | Cloudflare may set `__cf_bm`, `cf_clearance`, `_cfuvid`, or challenge/availability cookies only when the corresponding zone product/rule is active | Product-specific, typically session/short-lived; actual zone configuration is unknown | Cloudflare edge and browser | Can distinguish a browser for security; must be disclosed if enabled |

Generated Paraglide runtime code contains generic cookie/local-storage support, but the configured
strategy is exactly `["url", "baseLocale"]`; it does not use those generated branches.

## Public request and origin-log data

| Fields/categories | Source / purpose | Recipient and location | Retention / deletion | Access / identifiability |
|---|---|---|---|---|
| IP address, timestamp, method, host/path/query, status, bytes, protocol, TLS/edge metadata, User-Agent, referrer, Cloudflare Ray ID and derived country/ASN | Deliver and secure all pages/assets; rate limiting and incident diagnosis | Cloudflare edge, then VPS/Nginx. Exact entities, countries and localization configuration are held/verified in the confidential operator register, not this public repository | Nginx/container logs rotate by size at `3 × 10 MiB`; Cloudflare dashboard/log retention depends on enabled products/account and is unverified | Cloudflare account admins and VPS operator; IP/UA/request sequence can single out a visitor |
| `X-Real-IP` and `X-Forwarded-For` | Preserve client address through Nginx proxy | Nginx passes both to app SSR and Umami `/api/send` | App does not persist them; Umami uses request IP for session/location derivation and says it does not store raw IP; proxy logs remain as above | Potentially identifying during processing |
| NEL failure report: failing URL/referrer, method, phase/protocol, status/error type, elapsed time; IP used transiently to derive ASN/country/metro | Cloudflare browser-based network-failure reporting | `a.nel.cloudflare.com`; Cloudflare | Cloudflare states raw IP is held only for request processing and not logged in NEL; aggregate retention is plan/config dependent | Report contains URL and connection context; non-essential browser telemetry |
| Cloudflare security/challenge signals | DDoS, bot and rate-limit protection | Cloudflare | Product/config dependent and not verified | May use IP, request sequence, device/browser signals, and necessary security cookies |

Nginx's standard access log is not content-redacted beyond the fact that the application never
accepts image bodies. Query strings may still contain user-entered text if future routes introduce
it; no such public form exists now.

## Umami analytics

Production loads `/script.js` unconditionally when its build variables exist. Umami 3.2.0 is
self-hosted on the VPS; Postgres is not public.

| Stored/derived data | Purpose | Location / recipient | Retention / deletion | Identifiability |
|---|---|---|---|---|
| Website UUID, hostname, path plus query, page title, referrer, browser language, screen dimensions | Pageview, referrer, locale, device and journey aggregates | Umami/Postgres on VPS; infrastructure provider unknown | Repository states rolling 90 days, but no purge job or database retention enforcement was found: **control gap** | Events and a session UUID can single out a browser session even without a named person |
| User-Agent-derived browser, OS and device; IP-derived country/region/city; generated event/session/visit UUIDs | Aggregate visitors, sessions and geography | Umami/Postgres | Same unenforced 90-day target | Raw IP is documented by Umami as used but not stored; derived/session data remains pseudonymous, not guaranteed anonymous |
| Fixed custom event names | Model load, processing, download and fallback funnel | Umami/Postgres | Same | Session-linked behavioral sequence |
| Custom event dimensions | `qualityMode`; `inferencePath` | Umami/Postgres | Same | Technical preferences linked to a session |

The typed application wrapper drops filename, hashes, pixels, masks, prompts, arbitrary runtime
keys, and image-derived values. The application does not call `umami.identify`.

## Cloudflare Web Analytics

The deployed beacon is non-essential and currently loads on every page. Observed payload fields
included page location/referrer, a generated page-load ID, event type, network/navigation timings,
paint timings, transfer/decoded sizes, protocol, JS/timing version, site token, and JS heap size
values. Cloudflare states that the product uses no cookie/localStorage and does not track people
across customer properties, but the network request still necessarily processes an IP address and
device/request metadata at Cloudflare.

Account-specific retention, enabled dashboard dimensions, contracting entity, countries and Data
Localization settings cannot be proven from the repository and remain unverified risks. Their
exact values belong in the confidential processor register; the public policy must still disclose
the recipient category and applicable transfer fact/safeguard. Optional analytics remains
fail-closed until the settings needed for it are verified.

## Model and runtime requests

| Flow | Data sent | Recipient | Retention / risk |
|---|---|---|---|
| Primary model/CDN | GET/range URL for an immutable public model/WASM asset plus ordinary request headers/IP | Cloudflare and the VPS origin at `cdn.cutbg.art` | CDN/origin logs as above; no image bytes or editor values |
| Verified fallback | Same asset request after a CDN load failure | Hugging Face Hub and jsDelivr according to Transformers.js defaults | Third-party request logs/policies apply; visitor IP and headers cross another trust boundary |
| Manifest | GET `/models.manifest.json` | cutbg/Cloudflare/VPS | Public release metadata only |

Fallback hosts are not analytics processors, but they are recipients of visitor request metadata
when the primary asset path fails.

## Support and security contact

Clicking Telegram is voluntary and leaves cutbg. Telegram receives the visitor's Telegram account
data and any message/attachment they choose to send; cloud chats are stored by Telegram across its
infrastructure. Project policy tells maintainers not to request or retain real images, filenames,
hashes, EXIF, masks, composites, credentials, or private proofs. The public UI must make the
third-party transition clear. The owner has confirmed `avatarsik6699@gmail.com` as the privacy
channel; publishing it also introduces Google/Gmail as a recipient of data a requester voluntarily
sends and requires mailbox security/retention controls.

## Operational and maintainer data

| Data | Location | Retention |
|---|---|---|
| Uptime monitor URLs, timestamps, statuses, response times, notification channel configuration | VPS `uptime-kuma-data` | stated rolling 90 days; enforcement/config must be verified |
| Release actor/ref/run ID, commit, digest, build/creation time, config hash and check outcomes | GitHub plus VPS `.ops/releases` | GitHub plan policy; VPS last 10 records/3 config snapshots |
| CI logs, SBOM, provenance, package metadata | GitHub Actions/GHCR | license artifacts 30 days; uploaded SBOM 90 days; GHCR/account policy otherwise |
| Backup capability for Umami/Uptime/release/TLS state | `scripts/operations/backup.sh` writes to local `.ops/backups` by default; a production schedule, existing artifacts and off-host destination are not proven | Script deletes daily artifacts after 14 days; the owner reports no known configured remote backup. Treat actual storage as unknown until host verification |
| TLS subscriber/domain data and certificate transparency records | Let's Encrypt/ISRG | provider policy; certificate/domain facts are public |

## Current factual defects requiring Phase 25

1. The published privacy page says analytics receives no personal data. That absolute statement is
   unsupported because IP/request data is processed and Umami stores session-level behavior.
2. Translation files describe analytics cookies that were not observed and are not used by Umami
   or Cloudflare Web Analytics on the normal path.
3. The privacy component does not render the existing storage heading/body at all.
4. Analytics runs before any choice.
5. Cloudflare NEL is enabled at the edge without a public explanation.
6. The documented Umami/Uptime 90-day target is not demonstrably enforced.
7. The controller is known to be an individual and a privacy email is confirmed, but full identity,
   formal address, processor contracts, Cloudflare settings and transfer evidence are unresolved.
8. Phase-23 backup scripts/runbooks are documented as if scheduled operational backups exist, but
   the owner reports none and repository evidence cannot prove a production schedule or off-host
   copy.
