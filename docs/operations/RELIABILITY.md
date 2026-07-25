# Reliability contract

## Scope and assumptions

Phase 23 operates the existing single-VPS application, Cloudflare-cached model origin, Uptime Kuma,
Umami, Cloudflare Web Analytics and GitHub delivery chain. It adds no browser event, visitor
identifier, paid APM, second region or availability claim. The values below are conservative
operating objectives, not evidence that the objectives have already been met.

The initial evidence is the five-minute synthetic cadence already selected in `SPEC.md`, the
container budgets frozen in `docker-compose.yml`, the Phase-22 immutable model manifest, existing
aggregate Umami events and Cloudflare's already-enabled aggregate Web Vitals. A single VPS has
planned and unplanned maintenance risk, so the public SSR objective is deliberately 99.0%, not a
high-availability target. Revisit targets after 30 complete days of data; do not loosen one during
an active incident.

## Indicators and objectives

| Indicator | Calculation and source | Initial objective / expected threshold | Owner |
|---|---|---|---|
| Public SSR availability | Successful Uptime Kuma HTTPS probes ÷ scheduled probes, monthly; `/` and `/en` | ≥99.0%; page after two failed 5-minute probes | operator-on-call |
| CDN/model readiness | Successful 1-byte range plus manifest-selected small-file SHA-256 checks ÷ runs, monthly | ≥99.5%; page after two failed probes | operator-on-call |
| Release success | Releases whose candidate and external checks pass without rollback ÷ attempted releases, rolling 10 | ≥95%; any automatic rollback is reviewed | release operator |
| Rollback time | Start of failed external smoke to previous digest passing external smoke | ≤15 minutes; SEV-1 if no known-good state by 15 minutes | release operator |
| Processing start/completion | Existing aggregate `processing_completed` ÷ `processing_started` in Umami, weekly | Observation threshold ≥90% after 30-day baseline; no paging until Phase 24/25 review authorizes any needed instrumentation | product operator |
| Download success proxy | Existing aggregate `download_clicked` ÷ `processing_completed`, weekly | Investigate a ≥20% relative week-over-week drop; this is a funnel proxy, not proof that a browser saved bytes | product operator |
| Core Web Vitals | Cloudflare Web Analytics aggregate p75 by metric | LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1; monthly review, no paging | product operator |
| Elevated proxy errors | Count of Nginx 5xx status lines, five-minute window; no request path emitted | <10 per five minutes | operator-on-call |
| Backup freshness | Age of latest encrypted operational backup | <30 hours | operator |

Processing and download signals reuse previously approved aggregate events. No filename, source URL,
image, mask, prompt, composite or custom visitor ID is added. The download metric must remain
labelled as a proxy until a future approved event can prove completion.

## Alerts

`alerts.json` is the reviewable alert contract. `scripts/operations/validate-alerts.mjs` fails when
one of the six required signals lacks severity, owner, escalation, suppression, deduplication,
threshold or runbook. With `ALERT_DELIVERY_URL` set to a disposable receiver it sends image-free
firing and resolved probes for every signal.

Production notification credentials live only in Uptime Kuma/GitHub secrets. Configure Telegram as
primary for SEV-1 and email as secondary; SEV-2 uses the routing in `alerts.json`. Maintenance
suppression is permitted only for the named approved activity and must have an end time. Never
paste request paths, source URLs, environment files or container dumps into an alert.

## Capacity and graceful degradation

Frozen production budgets:

| Service | CPU | RAM | Process limit |
|---|---:|---:|---:|
| app | 1.0 | 512 MiB | 200 |
| nginx | 0.5 | 256 MiB | 100 |
| umami | 1.0 | 512 MiB | 200 |
| umami-db | 1.0 | 512 MiB | 200 |
| uptime-kuma | 1.0 | 512 MiB | 300 |
| certbot | 0.5 | 256 MiB | 100 |

The bounded exercise is 20 concurrent SSR requests and four concurrent 1-byte model range probes,
with zero failures and SSR p95 ≤2 seconds on the production-parity host. Run
`node scripts/operations/exercise-capacity.mjs`; store only its aggregate JSON. Resource pressure
starts at 80% disk or 85% memory for ten minutes.

Graceful modes are already architectural:

- model CDN failure falls back to the immutable upstream source;
- WebGPU execution failure falls back to WASM and lightweight mode;
- browser offline use may reuse only verified cached public model assets;
- a faulty heavy model is disabled by rolling back the manifest/release, not by a mutable runtime
  edit;
- proxy saturation returns bounded errors while client-side image bytes remain in the browser.

Use the incident runbook for CDN failure, offline/cache recovery and resource pressure. Use the
rollback runbook for a faulty model or application release.

## Drill evidence

The implementation drill is intentionally disposable and contains no production credentials or
visitor data:

- candidate failure leaves `current.env` unchanged;
- forced external-smoke failure invokes previous-digest rollback;
- a second deployment is rejected while the lock is held;
- rerunning the current digest changes no traffic;
- release records omit a planted secret;
- encrypted backup is restored into a new temporary directory and its allowlist manifest is
  checked;
- firing and resolved payloads for all six alert classes reach a loopback receiver;
- bounded concurrent SSR/range probes report aggregate failure counts and p95 only.

The command-adapter and recovery checks run in `pnpm release:test`; the real Docker candidate,
digest switch, forced failure/automatic rollback, idempotency and lock exercise runs in
`pnpm release:test:docker`. Production alert-channel receipt, the Uptime Kuma SSH tunnel, the real
external hostname and a production-parity restore remain explicit operator checks at
`/phase-gate 23`; local evidence is not presented as production SLO compliance.

Implementation evidence on 2026-07-24: `pnpm release:test` completed all six release/recovery tests
in 1.17 seconds; the default capacity exercise completed 20 concurrent SSR probes with zero
failures and 1,498 ms p95 plus four concurrent CDN range probes with zero failures; the Chromium
offline/cache exercise passed in 2.7 seconds; and `pnpm release:test:docker` passed real disposable
image candidate isolation, digest switching, forced automatic rollback, idempotency and lock
behavior. These workstation timings are a repeatable baseline, not the production RTO or SLO
measurement.

### Tabletop: CDN/model failure

Scenario: the CDN returns an invalid range during a release while the application shell remains
available. The operator declares SEV-1, freezes deployment, confirms the upstream client fallback,
runs the manifest integrity check, and rolls back the model/application release if integrity cannot
be restored within 15 minutes. Status messages describe “model download degraded” without a source
URL. No unresolved high-severity gap was found in the repository procedure; real notification
receipt is retained as the phase-gate operator check.

### Restore/rollback game day

Scenario: a candidate passes but the forced post-deploy check fails. The disposable controller
restores the previous digest and identity, then the encrypted fixture backup is checksum-verified
and extracted to an empty target. The drill is successful only when both commands exit zero and
the prior digest remains current. Measured elapsed times are emitted by the gate run and recorded
with its artifact; do not invent production RTO evidence from this local test.
