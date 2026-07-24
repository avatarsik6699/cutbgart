# PHASE 23 — Release Reliability & Operations

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `23` |
| Title | Release Reliability & Operations |
| Status | `⏳ pending` |
| Tag | `v0.23.0` |
| Depends on | PHASE_22 gate passing |

---

## Phase Goal

Make production releases observable, reversible and recoverable before the editor roadmap expands.
The phase replaces mutable deployment assumptions with a verified release identity, adds
pre/post-deploy checks and rollback, establishes measurable reliability objectives and recovery
drills, and keeps all new operational signals free of image content and unapproved visitor
identifiers (SPEC.md §6–§8).

## Research References

- [Google SRE Workbook — Implementing SLOs](https://sre.google/workbook/implementing-slos/)
- [Google SRE Workbook — Canarying Releases](https://sre.google/workbook/canarying-releases/)
- [GitHub deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [Docker image digests](https://docs.docker.com/dhi/core-concepts/digests/)
- [NIST Contingency Planning Guide](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final)
- [web.dev — Core Web Vitals](https://web.dev/articles/vitals)

---

## Scope

### Infra

- [ ] `I1` Build and deploy an immutable release identity (`buildId`, commit SHA, image digest,
  creation time), use the digest—not `latest`—for production and rollback, and retain a bounded
  previous known-good release/config set — _Depends on:_ —
- [ ] `I2` Add a loopback-only candidate start and pre-deploy smoke for boot, health, SSR locales,
  static/model-manifest access, CDN byte ranges and config validity before traffic changes. Never
  upload a user image or real user metadata in deployment checks — _Depends on:_ `I1`
- [ ] `I3` Add post-deploy external smoke for HTTPS, canonical/locale redirects, primary app shell,
  security/legal endpoints, release identity and CDN model range/integrity. On failure, stop and
  execute the documented previous-digest rollback; never mask a failed check as success —
  _Depends on:_ `I1`, `I2`
- [ ] `I4` Make deployment concurrency-safe and auditable: one production deployment at a time,
  protected environment, concise release record, actor/ref/digest, check results, rollback result,
  and secrets redaction. Define manual recovery when GitHub is unavailable — _Depends on:_ `I1`
- [ ] `I5` Define service indicators and owner-approved objectives for public SSR availability,
  CDN/model readiness, release success/rollback time, processing start/completion, download
  success and Core Web Vitals. Use external synthetic/aggregate infrastructure signals first;
  defer any new browser telemetry or identifiers until Phase 24 approval and Phase 25
  implementation — _Depends on:_ `I3`
- [ ] `I6` Configure actionable alerts with severity, owner, escalation, maintenance suppression,
  deduplication and runbook links. Validate alert delivery and resolution for app down, CDN/model
  failure, certificate expiry, disk/resource pressure, backup failure and elevated 5xx; never put
  image data or source URLs in alerts — _Depends on:_ `I5`
- [ ] `I7` Inventory and back up only operational state that actually needs recovery (Umami/Uptime
  data if retained, deployment/config metadata and encrypted secret/certificate material).
  Define owner-approved RPO/RTO, encryption, access, retention and deletion; run a disposable
  restore drill and record measured results — _Depends on:_ `I5`
- [ ] `I8` Add capacity and degradation exercises for constrained CPU/RAM/disk/network, concurrent
  SSR and model downloads, CDN failure and browser offline/cache recovery. Freeze resource budgets
  and document graceful modes plus an emergency disable/rollback procedure for a faulty heavy
  model or release — _Depends on:_ `I2`, `I5`

### Testing and governance

- [ ] `T1` Add a deterministic mocked Chromium critical path to pull-request CI: open app, process
  single and batch fixtures, switch items, edit, undo/redo and download. Keep full host-only
  cross-browser, WebGPU and real-model suites local. Update `AGENTS.md`, `docs/STACK.md` and
  playbooks together so this narrow CI exception is explicit and non-conflicting — _Depends on:_
  `I2`
- [ ] `T2` Add release smoke and rollback integration tests using disposable images/configuration;
  prove deployment by digest, candidate failure isolation, post-deploy failure rollback, lock
  behavior, redaction and idempotent rerun — _Depends on:_ `I1`–`I4`
- [ ] `T3` Create incident, rollback, backup/restore, degraded-mode and status-communication
  runbooks. Run one tabletop incident and one restore/rollback game day; convert every unresolved
  high-severity observation into a blocking review note — _Depends on:_ `I6`–`I8`
- [ ] `T4` Freeze maintenance cadence and owners: per-release verification; monthly
  dependency/CVE/license/model and backup review; quarterly restore, alert, SLO, header and sampled
  device/accessibility review; annual or material-change threat/legal/accessibility review —
  _Depends on:_ `I5`–`I8`

---

## Files

### Create / modify

~~~
.github/workflows/
AGENTS.md
Dockerfile
docker-compose.yml
deploy/nginx/
scripts/
e2e/
tests/
docs/STACK.md
docs/operations/RELIABILITY.md
docs/operations/MAINTENANCE.md
docs/runbooks/DEPLOY.md
docs/runbooks/ROLLBACK.md
docs/runbooks/INCIDENT.md
docs/runbooks/BACKUP_RESTORE.md
docs/PHASE_23.md
~~~

### Do NOT touch

- Add new analytics/browser telemetry before the Phase-24 legal decision
- Back up source images, masks, composites, browser editor state, or arbitrary VPS contents
- Claim high availability, zero downtime, disaster recovery or SLO compliance without evidence
- Introduce Kubernetes, multi-region deployment, session replay, user accounts, or a paid APM
  solely to satisfy this phase

---

## Contracts

### New persistent data (tables / collections / files)

- Bounded operational release records and encrypted backups under the owner-approved schedule.
- No application database, user profile, uploaded image, mask or editor document is added.

### New API endpoints / RPC methods / events

None. Release identity is exposed through deployment/OCI metadata and response headers; do not add
a public endpoint containing sensitive infrastructure details.

### New types / models / shared interfaces

```ts
interface ReleaseIdentity {
  buildId: string
  commitSha: string
  imageDigest: `sha256:${string}`
  createdAt: string
}
```

### New env vars

| Key | Example value | Required |
|-----|---------------|----------|
| `APP_BUILD_ID` | `2026-07-24.1` | production build/deploy |
| `APP_COMMIT_SHA` | full immutable SHA | production build/deploy |

Backup/alert credentials remain platform secrets; names, ownership and rotation are documented in
`docs/STACK.md`, never values.

---

## Gate Checks

Run `/phase-gate 23`; the updated `docs/STACK.md` gate is authoritative. Additionally:

```bash
pnpm build
docker compose config
docker compose build
pnpm e2e:ci-critical
```

Against a disposable deployment, run the candidate/pre-deploy smoke, successful deploy,
forced post-deploy failure with automatic rollback, manual rollback, backup restore and alert
delivery checks. Verify the running image digest/attestation and release identity. Fail if
production uses a mutable tag, rollback is untested, secrets/user data enter records, CI requires
real model downloads, or any SLI/SLO/RPO/RTO/alert has no owner and reviewed target.

---

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

None

## Atomic Commit Message

```text
chore(phase-23): make releases observable reversible and recoverable
```

## Post-Phase Checklist

- [ ] Scope complete; gates green; review notes resolved
- [ ] Run `/context-update 23`
- [ ] Commit on `feat/phase-23`; tag `v0.23.0` after merge
